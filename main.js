const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const defaults = require('./default-variables')
const { startHttpServer, stopHttpServer } = require('./ui/http')
const { validateRackMidiMap, parseMidiMapString } = require('./lib/midi-map')

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
        this.midiMapObj = { racks: {} }
        this.emptyMapping = defaults.mapping(this.rackCount)
        this.rackMap = this.emptyMapping

		this.logLevel = defaults.logLevel ?? 'error'
		this._http = defaults.httpSettings

	}

	async init(config) {
		this.config = config
		this._applyConfigToLocalScopes()
		await this._loadAllJsonFromConfig()
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updateStatus(InstanceStatus.Ok)
		await startHttpServer(this)
	}


	async destroy() {
		this._log('debug', 'destroy start')
		this.state.sequenceRunning = false
		await stopHttpServer(this)
		this._log('debug', 'destroy done')
	}

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
            this._http.port = desiredPort
			await stopHttpServer(this)
			await startHttpServer(this)
		}
	}

	getConfigFields() {
        this.config = this.config || {};

		return [
			{
				type: 'static-text',
				id: 'info_intro',
				label: 'Info',
				value:
					'This module does not open its own MIDI connection. Additionally, create a Generic-MIDI instance and use actions there (CC) with the variables from the help. The built-in  <a href="http://127.0.0.1:'+ (this._http?.port ?? '') +'/patch" target="_blank" rel="noopener noreferrer">routepatch</a> UI is served by this module on the configured HTTP port (default '+ (this._http?.port ?? '') +').',
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
                tooltip: 'Number of channels (min 32, max 512)'
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
		]
	}

	_applyConfigToLocalScopes(preventConfigReupdate = false) {
		let changed = false
		const prev = { ...this.config }

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

        // midiMap remains string in config; ensure present
        if (typeof this.config?.midiMap === 'string') {
            this.midiMap = this.config.midiMap
        } else if (!this.config?.midiMap) {
            this.config = this.config || {}
            this.config.midiMap = this.midiMap
            changed = true
        }

        // rackMap stays as-is from defaults when present
        if (this.config?.rackMap && this.config.rackMap !== {}) {
            this.rackMap = this.config.rackMap
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

	async _loadAllJsonFromConfig() {
        const raw = typeof this.config?.midiMap === 'string' ? this.config.midiMap : (this.midiMap || '')
        this.midiMapObj = parseMidiMapString(raw)
        if (!validateRackMidiMap(this.midiMapObj)) {
            this._log('warn', 'Invalid midiMap JSON structure, using empty racks')
            this.midiMapObj = { racks: {} }
        }
	}

	_parseJsonField(kind, validateFn, defaults) {
		if (kind !== 'midiMap') return
		const raw = this?.midiMap || ''
        const parsed = parseMidiMapString(raw)
        this.midiMapObj = validateRackMidiMap(parsed) ? parsed : defaults
	}

	_validateRackMidiMap(obj) {
        return validateRackMidiMap(obj)
	}

	async _executeRackSequence(rackId) {
        const rack = this.midiMapObj?.racks?.[rackId]
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
