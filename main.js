const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const defaults = require('./default-variables')
const { startHttpServer, stopHttpServer } = require('./ui/http')
const { applyMidiStepToVariables } = require('./lib/midi-map')

const MIDI_STEP_DELAY_MS = 50

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
		this.hotMap = defaults.hotMap
		this.emptyMapping = defaults.mapping(this.rackCount)
		this.rackMap = this.emptyMapping
		this.hotPlugin = defaults.hotPlugin
		this.hotSnapshot = defaults.hotSnapshot

		this.logLevel = defaults.logLevel ?? 'error'
		this._http = defaults.httpSettings
	}

	// Companion lifecycle method: Called when the module is initialized
	async init(config) {
		this.config = config
		this._applyConfigToLocalScopes()
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updateStatus(InstanceStatus.Ok)
		await startHttpServer(this)
	}

	// Companion lifecycle method: Called when the module is destroyed
	async destroy() {
		this._log('debug', 'destroy start')
		this.state.sequenceRunning = false
		await stopHttpServer(this)
		this._log('debug', 'destroy done')
	}

	// Companion lifecycle method: Called when the configuration is updated
	async configUpdated(config) {
		this.config = config
		this._applyConfigToLocalScopes(true)
		try {
			this.updateActions()
		} catch {}
		try {
			this.updateFeedbacks()
		} catch {}
		try {
			this.updateVariableDefinitions()
		} catch {}
		const desiredPort = parseInt(this.config?.http?.port, 10)
		if (Number.isInteger(desiredPort) && desiredPort !== this._http.port) {
			this._log('info', 'HTTP port change detected', { from: this._http.port, to: desiredPort })
			if (this._http.restarting) {
				this._log('debug', 'HTTP restart already in progress')
				return
			}
			this._http.restarting = true
			try {
				await stopHttpServer(this)
				this._http.port = desiredPort
				await startHttpServer(this)
			} catch (err) {
				this._log('error', 'Failed to restart HTTP server', { error: err?.message })
				this.updateStatus(InstanceStatus.Error)
			} finally {
				this._http.restarting = false
			}
		}
	}

	// Companion lifecycle method: Defines the configuration fields for the module
	getConfigFields() {
		this.config = this.config || {}

		return [
			{
				type: 'static-text',
				id: 'info_intro',
				label: 'Info',
				value:
					'This module does not open its own MIDI connection. Additionally, create a Generic-MIDI instance and use actions there (CC) with the variables from the help. The built-in  <a href="http://127.0.0.1:' +
					(this._http?.port ?? '') +
					'/patch" target="_blank" rel="noopener noreferrer">routepatch</a> UI is served by this module on the configured HTTP port (default ' +
					(this._http?.port ?? '') +
					').',
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
				label: 'Rack count',
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
				id: 'channelCount',
				label: 'Channel count',
				min: 32,
				max: 512,
				default: this.channelCount,
				tooltip: 'Number of channels (min 32, max 512)',
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
		]
	}

	_applyConfigToLocalScopes(preventConfigReupdate = false) {
		let changed = false

		const newLogLevel = this.config?.logLevel || 'error'
		if (newLogLevel !== this.logLevel) {
			this.logLevel = newLogLevel
			changed = true
		}

		const desiredHttpPort = this.config?.http?.port || this._http.port
		if (desiredHttpPort !== this._http.port) {
			this._http.port = desiredHttpPort
			changed = true
		}

		const mrRaw = this.config?.rackCount
		const mr = parseInt(mrRaw, 10)
		if ([64, 32, 16, 8, 4].includes(mr) && mr !== this.rackCount) {
			this.rackCount = mr
			changed = true
		}

		// channelCount: clamp [32,512]
		const chCountRaw = this.config?.channelCount
		const chParsed = parseInt(chCountRaw, 10)
		let clamped = this.channelCount
		if (Number.isInteger(chParsed)) {
			clamped = Math.min(512, Math.max(32, chParsed))
		}
		if (clamped !== this.channelCount) {
			this.channelCount = clamped
			changed = true
		}

		// rackMap stays as-is from defaults when present
		if (this.config?.rackMap && this.config.rackMap !== {}) {
			this.rackMap = this.config.rackMap
		}

		if (this.config?.hotPlugin && this.config.hotPlugin !== {}) {
			this.hotPlugin = this.config.hotPlugin
		}

		if (this.config?.hotSnapshot && this.config.hotSnapshot !== {}) {
			this.hotSnapshot = this.config.hotSnapshot
		}

		if (!preventConfigReupdate && changed) {
			this.saveConfig(this.config)
		}
	}

	updateActions() {
		try {
			if (typeof UpdateActions === 'function') {
				UpdateActions(this)
			}
		} catch (e) {
			this._log('error', 'updateActions failed', { error: e?.message })
		}
	}

	updateFeedbacks() {
		try {
			if (typeof UpdateFeedbacks === 'function') {
				UpdateFeedbacks(this)
			}
		} catch (e) {
			this._log('error', 'updateFeedbacks failed', { error: e?.message })
		}
	}

	updateVariableDefinitions() {
		try {
			if (typeof UpdateVariableDefinitions === 'function') {
				UpdateVariableDefinitions(this)
			}
		} catch (e) {
			this._log('error', 'updateVariableDefinitions failed', { error: e?.message })
		}
	}

	_sendMidiStep(step) {
		// Statt direkt zu senden: Variablen setzen, von Generic-MIDI aus nutzbar
		const ch = step.channel
		let controller = ''
		let value = ''
		let status = ''
		if (step.type === 'cc') {
			status = 'cc'
			controller = String(step.controller)
			value = String(step.value)
		} else if (step.type === 'noteon') {
			status = 'noteon'
			controller = String(step.note)
			value = String(step.value)
		} else if (step.type === 'program') {
			status = 'program'
			controller = String(step.program)
			value = ''
		} else {
			this._log('warn', 'unknown MIDI Type', { type: step.type })
			return
		}
		this.setVariableValues({
			midi_last_type: status,
			midi_last_channel: ch,
			midi_last_controller: controller,
			midi_last_value: value,
			last_action_timestamp: Date.now(),
		})
		this._log('debug', 'MIDI step prepared', { status, ch, controller, value })
	}

	_shouldLog(level) {
		const order = ['error', 'warn', 'info', 'debug']
		return order.indexOf(level) <= order.indexOf(this.logLevel)
	}

	_log(level, msg, data) {
		if (!this._shouldLog(level)) return
		const line = msg + (data ? ` ${JSON.stringify(data)}` : '')
		this.log(level, line)
	}

	// Liefert die MIDI-Sequenz für ein Rack über hotMap
	getMidiSequenceForRack(rackId) {
		const entry = this.hotMap.find((e) => String(e.rack) === String(rackId))
		if (!entry) return null
		const pluginStep = this.hotPlugin?.mapping?.find((p) => p && p.id === entry.plugin)
		const snapshotStep = this.hotSnapshot?.mapping?.find((s) => s && s.id === entry.snapshot)
		if (!pluginStep || !snapshotStep) return null
		return [
			{ type: this.hotSnapshot.type, channel: this.hotSnapshot.channel, controller: snapshotStep.id, value: snapshotStep.value, delay: 0 },
			{ type: this.hotPlugin.type, channel: this.hotPlugin.channel, controller: pluginStep.id, value: pluginStep.value, delay: 0 },
		]
	}

	// Liefert die MIDI-Sequenz für einen Hot Snapshot
	getMidiSequenceForSnapshot(snapshotId) {
		const entry = this.hotMap.find((e) => String(e.snapshot) === String(snapshotId))
		if (!entry) return null
		const snapshotStep = this.hotSnapshot?.mapping?.find((s) => s && s.id === entry.snapshot)
		if (!snapshotStep) return null
		return [
			{ type: this.hotSnapshot.type, channel: this.hotSnapshot.channel, controller: snapshotStep.id, value: snapshotStep.value, delay: 0 },
		]
	}

	// Liefert die MIDI-Sequenz für ein Hot Plugin
	getMidiSequenceForPlugin(pluginId) {
		const entry = this.hotMap.find((e) => String(e.plugin) === String(pluginId))
		if (!entry) return null
		const pluginStep = this.hotPlugin?.mapping?.find((p) => p && p.id === entry.plugin)
		if (!pluginStep) return null
		return [
			{ type: this.hotPlugin.type, channel: this.hotPlugin.channel, controller: pluginStep.id, value: pluginStep.value, delay: 0 },
		]
	}

	// --- Routing Actions ---
	async routeRack(rackId) {
		this.state.sequenceRunning = true
		this.state.sequenceStartTs = Date.now()
		try {
			await this._executeRackSequence(rackId)
			this.state.lastRoutedRacks = [rackId, ...(this.state.lastRoutedRacks || []).filter((id) => id !== rackId)].slice(0, 8)
		} finally {
			this.state.sequenceRunning = false
			this._updateVariables()
		}
	}

	async routeSnapshot(snapshotId) {
		this.state.sequenceRunning = true
		this.state.sequenceStartTs = Date.now()
		try {
			await this._executeSnapshotSequence(snapshotId)
		} finally {
			this.state.sequenceRunning = false
			this._updateVariables()
		}
	}

	async routePlugin(pluginId) {
		this.state.sequenceRunning = true
		this.state.sequenceStartTs = Date.now()
		try {
			await this._executePluginSequence(pluginId)
		} finally {
			this.state.sequenceRunning = false
			this._updateVariables()
		}
	}

	async _executeSequence(steps, logContext) {
		if (!steps) {
			this._log('warn', `${logContext.type} not found in hotMap`, logContext)
			return
		}
		this._log('info', `${logContext.type} sequence started`, { ...logContext, steps: steps.length })
		this.state.sequenceStartTs = Date.now()
		for (const step of steps) {
			if (Date.now() - this.state.sequenceStartTs > this.state.sequenceTimeoutMs) {
				this._log('error', `timeout during ${logContext.type} sequence`, logContext)
				this.state.failedStepsTotal++
				this._updateVariables()
				return
			}
			try {
				applyMidiStepToVariables(this, step)
				this.state.lastActionTimestamp = Date.now()
				this._updateVariables({ setActionTimestamp: true })
			} catch (e) {
				this._log('error', 'midi step error', { ...logContext, error: e.message })
				this.state.failedStepsTotal++
				this._updateVariables()
			}
			const totalDelay = (step.delay > 0 ? step.delay : 0) + MIDI_STEP_DELAY_MS
			if (totalDelay > 0) await new Promise((res) => setTimeout(res, totalDelay))
		}
		this._log('info', `ended ${logContext.type} sequence`, logContext)
	}

	async _executeRackSequence(rackId) {
		const steps = this.getMidiSequenceForRack(rackId)
		await this._executeSequence(steps, { type: 'rack', rackId })
	}

	async _executeSnapshotSequence(snapshotId) {
		const steps = this.getMidiSequenceForSnapshot(snapshotId)
		await this._executeSequence(steps, { type: 'snapshot', snapshotId })
	}

	async _executePluginSequence(pluginId) {
		const steps = this.getMidiSequenceForPlugin(pluginId)
		await this._executeSequence(steps, { type: 'plugin', pluginId })
	}

	_updateVariables(opts = {}) {
		const values = {
			last_routed_racks: JSON.stringify(this.state.lastRoutedRacks || []),
			failed_steps_total: this.state.failedStepsTotal,
			active_source_index: this.state.activeSourceIndex,
			active_source_label: this.state.activeSourceLabel,
		}
		if (opts.setActionTimestamp) {
			values.last_action_timestamp = this.state.lastActionTimestamp
		}
		this.setVariableValues(values)
	}

	_buildRackChoices() {
		return this.hotMap.map((entry) => ({ id: String(entry.rack), label: `Rack ${entry.rack} (Plugin ${entry.plugin}, Snapshot ${entry.snapshot})` }))
	}

	_buildHotSnapshotChoices() {
		// IDs 1–6
		return Array.from({ length: 6 }, (_, i) => ({ id: String(i + 1), label: `Hot Snapshot ${i + 1}` }))
	}

	_buildHotPluginChoices() {
		// IDs 1–12
		return Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), label: `Hot Plugin ${i + 1}` }))
	}
}

try {
	runEntrypoint(ModuleInstance, UpgradeScripts)
} catch (e) {
	console.error('[BOOT][FATAL] runEntrypoint error', e)
}
