const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const defaults = require('./default-variables')
const { startHttpServer, stopHttpServer } = require('./ui/http')
const { MidiManager } = require('./midi')

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.state = {
			activeSourceIndex: null,
			activeSourceLabel: '',
			lastRoutedRacks: [],
			lastActionTimestamp: 0,
			failedStepsTotal: 0,
			sequenceRunning: false,
			sequenceStartTs: 0,
			sequenceTimeoutMs: 1000,
		}
        this.rackCount = defaults.rackCount
        this.channelCount = defaults.channelCount
        this.midiMap = defaults.midi
        this.emptyMapping = defaults.mapping(this.rackCount)
        this.rackMap = this.emptyMapping

		this.logLevel = defaults.logLevel ?? 'error'
		this._http = defaults.httpSettings
		this._midi = new MidiManager((level, msg, data) => this._log(level, msg, data))
	}

	async init(config) {
		this.config = config
		this._applyConfigToLocalScopes()
		await this._loadAllJsonFromConfig()
		// Apply MIDI config and refresh ports before building config fields
		this._midi.applyConfig(this.config?.midi)
		this.updateStatus(InstanceStatus.Ok)
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		await startHttpServer(this)
	}


	async destroy() {
		this.log('debug', 'destroy')
		await stopHttpServer(this)
		this._midi.destroy()
	}

	async configUpdated(config) {
		this.config = config
		this._applyConfigToLocalScopes(true)
		// re-apply midi config
		this._midi.applyConfig(this.config?.midi)
		try { this.updateActions() } catch {}
		try { this.updateFeedbacks() } catch {}
		try { this.updateVariableDefinitions() } catch {}
		const desiredPort = parseInt(this.config?.http.port, 10)
		if (desiredPort !== this._http.port) {
            this._http.port = desiredPort
			this._http = await stopHttpServer(this._http, this)
			this._http = await startHttpServer(this._http, this)
		}
	}

	getConfigFields() {
        this.config = this.config || {}
        const midiAvailable = this._midi.isAvailable()
        let outputChoices = this._midi.getOutputChoices()
        const hasOutputs = Array.isArray(outputChoices) && outputChoices.length > 0
        if (!hasOutputs) {
            // Provide a clear fallback entry to avoid 'undefined' rendering
            outputChoices = [{ id: '__none__', label: 'No MIDI outputs found' }]
        }

		return [
			{
				type: 'static-text',
				id: 'info_intro',
				label: 'Info',
				value:
					midiAvailable
						? (hasOutputs
							? 'Internal MIDI can be enabled to send messages directly to selected ports. Generic-MIDI can still be used in parallel.'
							: 'Internal MIDI is available but no outputs were found. Ensure your MIDI devices/virtual ports (e.g., loopMIDI) are present.')
						: 'Internal MIDI unavailable: native addons are disabled. Use Generic-MIDI or enable native addons in the Companion runtime.'
			},
			{
				type: 'dropdown',
				id: 'logLevel',
				label: 'Log level',
				choices: [
					{ id: 'error', label: 'error' },
					{ id: 'warn', label: 'warn' },
					{ id: 'info', label: 'info' },
					{ id: 'debug', label: 'debug' },
				],
				default: this.logLevel,
			},
			{
				type: 'dropdown',
				id: 'rackCount',
				label: 'Rack configuration',
				choices: [
					{ id: 64, label: '64' },
					{ id: 32, label: '32' },
					{ id: 16, label: '16' },
					{ id: 8, label: '8' },
					{ id: 4, label: '4' },
				],
				default: this.rackCount,
			},
			{
				type: 'number',
				id: 'http.port',
				label: 'HTTP Port',
				min: 1,
				max: 65535,
				default: this._http.port,
				tooltip: 'Port for the Fastify HTTP server',
			},
			{
				type: 'textinput',
				id: 'midiMap',
				label: 'Superrack MIDI Map (JSON)',
				width: 12,
				default: this.midiMap,
				multiline: true,
			},
			{
				type: 'checkbox',
				id: 'midi.enabled',
				label: 'Enable internal MIDI (experimental)',
				default: !!(this.config?.midi?.enabled),
				tooltip: 'If enabled, the module will open selected MIDI outputs and send the steps directly.',
				enabled: midiAvailable && hasOutputs,
			},
			{
				type: 'dropdown',
				id: 'midi.outputs',
				label: 'MIDI Outputs',
				multiple: true,
				choices: outputChoices,
				default: hasOutputs && Array.isArray(this.config?.midi?.outputs) ? this.config.midi.outputs : [],
				tooltip: 'Select one or more MIDI output ports to send messages to.',
				enabled: midiAvailable && hasOutputs,
			},
		]
	}

	_applyConfigToLocalScopes(preventConfigReupdate = false) {
		this.logLevel = this.config?.logLevel || 'error'
		this._http.port = this.config?.http?.port || this._http.port
		const mr = parseInt(this.config?.rackCount, 10)
		if ([64, 32, 16, 8, 4].includes(mr)) this.rackCount = mr
        if (this.config.rackCount !== this.rackCount) this.config.rackCount = mr

        if (this.config?.midiMap && this.config.midiMap !== {}) {
            this.midiMap = this.config.midiMap
        } else {
            this.config.midiMap = this.midiMap
        }

        if (this.config?.rackMap && this.config.rackMap !== {}) {
            this.rackMap = this.config.rackMap
        } else {
            this.config.rackMap = this.rackMap
        }

        // Ensure midi config object exists and is persisted
		if (!this.config.midi) this.config.midi = { enabled: false, outputs: [] }
		if (!Array.isArray(this.config.midi.outputs)) this.config.midi.outputs = []
		if (typeof this.config.midi.enabled !== 'boolean') this.config.midi.enabled = false

        if (!preventConfigReupdate) {
            this.saveConfig(this.config)
        }
	}

	_sendMidiStep(step) {
		// Send via internal MIDI (if enabled)
		try {
			this._midi.sendStep(step)
		} catch (e) {
			this._log('warn', 'internal MIDI send error', { error: e.message })
		}
		// Remove old variable-based MIDI simulation per user request; keep timestamp only
		this.setVariableValues({
			last_action_timestamp: Date.now(),
		})
		this._log('debug', 'MIDI step dispatched', { type: step.type, channel: step.channel })
	}

	_shouldLog(level) {
		const order = ['error', 'warn', 'info', 'debug']
		return order.indexOf(level) <= order.indexOf(this.logLevel)
	}

	_log(level, msg, data) {
		if (!this._shouldLog(level)) return
		const line = `[${level.toUpperCase()}] ${msg}` + (data ? ` ${JSON.stringify(data)}` : '')
		this.log(level === 'debug' ? 'debug' : level, line)
	}

	async _loadAllJsonFromConfig() {
		this._parseJsonField('midiMap', this._validateRackMidiMap, { racks: {} })
	}

	_parseJsonField(kind, validateFn, defaults) {
		const raw = this?.[kind] || ''
		let parsed = defaults
		if (raw.trim()) {
			try {
				const j = JSON.parse(raw)
				if (validateFn(j)) parsed = j
			} catch {}
		}
		if (kind === 'routing') this.rackMap = parsed
		else if (kind === 'midi') this.midiMap = parsed
	}

	_validateRackMidiMap(obj) {
		if (!obj || typeof obj !== 'object' || !obj.racks) return false
		for (const [rackId, rack] of Object.entries(obj.racks)) {
			if (!/^\d+$/.test(rackId)) return false
			if (
				!rack ||
				typeof rack !== 'object' ||
				typeof rack.name !== 'string' ||
				typeof rack.enabled !== 'boolean' ||
				!Array.isArray(rack.midiSteps)
			)
				return false
			if (rack.midiSteps.length > 1000) return false
			for (const step of rack.midiSteps) {
				if (!['cc', 'noteon', 'program'].includes(step.type)) return false
				if (typeof step.channel !== 'number' || step.channel < 1 || step.channel > 16) return false
				if (typeof step.delay !== 'number' || step.delay < 0) return false
				if (step.type === 'cc') {
					if (typeof step.controller !== 'number' || step.controller < 0 || step.controller > 127) return false
					if (typeof step.value !== 'number' || step.value < 0 || step.value > 127) return false
				}
				if (step.type === 'noteon') {
					if (typeof step.note !== 'number' || step.note < 0 || step.note > 127) return false
					if (typeof step.value !== 'number' || step.value < 0 || step.value > 127) return false
				}
				if (step.type === 'program') {
					if (typeof step.program !== 'number' || step.program < 0 || step.program > 127) return false
				}
			}
		}
		return true
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}

	_updateVariables() {
		this.setVariableValues({
			active_source_index: this.state.activeSourceIndex ?? '',
			active_source_label: this.state.activeSourceLabel ?? '',
			last_routed_racks: this.state.lastRoutedRacks.join(','),
			last_action_timestamp: this.state.lastActionTimestamp,
			failed_steps_total: this.state.failedStepsTotal,
		})
	}

	_buildHotSnapshotChoices() {
        const racks = this.state.midiMap?.racks || {}

		let firstSteps = []
		for (const rackId in racks) {
			const steps = racks[rackId]?.midiSteps
			if (Array.isArray(steps) && steps.length > 0) {
				firstSteps.push({
					...steps[0],
				})
			}
		}

		firstSteps = firstSteps.filter(
			(step, index, self) =>
				index === self.findIndex((s) => s.channel === step.channel && s.controller === step.controller),
		)

		return firstSteps.map(function (step, index) {
			let label = 'Hot Snapshot - ' + (step.controller + 1)

			return {
				id: index,
				label: label,
				midi: step,
			}
		})
	}

	_buildHotPluginChoices() {
		const racks = this.midiMap?.racks || {}

		let firstSteps = []
		for (const rackId in racks) {
			const steps = racks[rackId]?.midiSteps
			if (Array.isArray(steps) && steps.length > 0) {
				firstSteps.push({
					...steps[1],
				})
			}
		}

		firstSteps = firstSteps.filter(
			(step, index, self) =>
				index === self.findIndex((s) => s.channel === step.channel && s.controller === step.controller),
		)

		return firstSteps.map(function (step, index) {
			let label = 'Hot Plugin - ' + (step.controller + 1)

			return {
				id: index,
				label: label,
				midi: step,
			}
		})
	}

	_buildRackChoices() {
		const racks = this.midiMap?.racks || {}
		return Object.keys(racks).map((r) => ({ id: parseInt(r, 10), label: `Rack ${r}` }))
	}

	async routeRack(rackId) {
		if (rackId == null) {
			this._log('warn', 'routeRack without rackid')
			return
		}
		if (this.state.sequenceRunning) {
			this._log('warn', 'sequence running – skipping rack', { rackId })
			return
		}
		this.state.sequenceRunning = true
		this.state.sequenceStartTs = Date.now()
		this.state.lastRoutedRacks = [rackId]
		this._updateVariables()
		await this._executeRackSequence(rackId)
		this.state.sequenceRunning = false
		this._log('info', 'routeRack completed', { rackId })
	}

	async routeSnapshot(snapshotId) {
		const hotSnapshots = this._buildHotSnapshotChoices()
		const snapshot = hotSnapshots.find((s) => s.id === snapshotId)
		if (!snapshot) {
			this._log('warn', 'hot snapshot not found', { snapshotId })
			return
		}
		this._sendMidiStep(snapshot.midi)
		this._log('info', 'execute hot snapshot', { snapshotId, midi: snapshot.midi })
	}

	async routePlugin(pluginId) {
		const hotPlugins = this._buildHotPluginChoices()
		const plugin = hotPlugins.find((s) => s.id === pluginId)
		if (!plugin) {
			this._log('warn', 'hot plugin not found', { pluginId })
			return
		}
		this._sendMidiStep(plugin.midi)
		this._log('info', 'execute hot plugin', { pluginId, midi: plugin.midi })
	}

	async _executeRackSequence(rackId) {
        const rack = this.midiMap?.racks?.[rackId]
        if (!rack) {
			this._log('warn', 'rack not found', { rackId })
			return
		}
		if (!rack.enabled) {
			this._log('debug', 'rack disabled', { rackId })
			return
		}
		this._log('info', 'rack sequence started', { rackId, steps: rack.midiSteps.length })
		for (const step of rack.midiSteps) {
			if (Date.now() - this.state.sequenceStartTs > this.state.sequenceTimeoutMs) {
				this._log('error', 'timeout during rack sequence', { rackId })
				this.state.failedStepsTotal++
				this._updateVariables()
				return
			}
			try {
				this._sendMidiStep(step)
			} catch (e) {
				this._log('error', 'midi step error', { rackId, error: e.message })
				this.state.failedStepsTotal++
				this._updateVariables()
			}
			if (step.delay > 0) await new Promise((res) => setTimeout(res, step.delay))
		}
		this._log('info', 'ended rack sequence', { rackId })
	}
}

try {
	runEntrypoint(ModuleInstance, UpgradeScripts)
} catch (e) {
	console.error('[BOOT][FATAL] runEntrypoint error', e)
}
