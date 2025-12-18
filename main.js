const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const defaults = require('./default-variables')
const fastifyFactory = require('fastify')
const fastifyStatic = require('@fastify/static')

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

	}

	async init(config) {
		this.config = config
		this._applyConfigToLocalScopes()
		await this._loadAllJsonFromConfig()
		this.updateStatus(InstanceStatus.Ok)
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		await this._startHttpServer()
	}


	async destroy() {
		this.log('debug', 'destroy')
		await this._stopHttpServer()
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
		const desiredPort = parseInt(this.config?.http.port, 10)
		if (desiredPort !== this._http.port) {
            this._http.port = desiredPort
			await this._stopHttpServer()
			await this._startHttpServer()
		}
	}

	getConfigFields() {
        this.config = this.config || {};

		const fields = [
			{
				type: 'static-text',
				id: 'info_intro',
				label: 'Info',
				value:
					'This module does not open its own MIDI connection. Additionally, create a Generic-MIDI instance and use actions there (CC) with the variables from the help.',
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
		]

		/*const maxRacks = parseInt(this.config?.maxRacks, 10) || this.rackCount || 64
		for (let rack = 1; rack <= maxRacks; rack++) {
			if (!(rack in this.config.racks) || this.config.racks[rack] === '') {
				this.config.racks[rack] = {
					"id": rack,
					"value": null
				}
			}

			fields.push({
				type: 'textinput',
				id: `racks[${rack}].value`,
				label: `Kanal Index für Rack ${rack}`,
				width: 3,
				value: this.config.racks?.[rack]?.value ?? null,
			})
		}*/

		return fields
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

        if (!preventConfigReupdate) {
            this.saveConfig(this.config)
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

	async _startHttpServer() {
		if (this._http.started) {
			this._log('debug', 'HTTP server already running')
			return
		}
		const fastify = fastifyFactory({ logger: false })

		// Static für Patch-UI (Fastify v5 + @fastify/static v8)
		fastify.register(fastifyStatic, {
			root: [require('path').join(__dirname, 'public'), __dirname],
			prefix: '/patch/',
		})

		// Root der Patch-UI
		fastify.get('/patch', async (req, reply) => {
			return reply.sendFile('public/index.html')
		})
		fastify.get('/patch/', async (req, reply) => {
			return reply.sendFile('public/index.html')
		})

		fastify.get('/health', async (req, reply) => {
			return {
				status: 'ok',
				sequenceRunning: this.state.sequenceRunning,
				activeSourceIndex: this.state.activeSourceIndex,
			}
		})

		// Neuer Endpoint: Aktuelle Mappings aus der Config abrufen
		fastify.get('/patch/mappings', async (req, reply) => {
			const maxRacks = parseInt(this.config?.maxRacks, 10) || this.rackCount || 64
			console.log(this.config)
			reply.code(200)
			return { success: true, mapping: this.config.racks, meta: { maxRacks, numChannels: 99 } }
		})

		fastify.get('/config/reset', async (req, reply) => {
			this.saveConfig({})
			this._applyConfigToLocalScopes()
			this.updateActions()
			this.updateFeedbacks()
			this.updateVariableDefinitions()
		})

		// Neuer Endpunkt: Mappings anwenden (anschliessen)
		fastify.post('/patch/update', async (req, reply) => {
			try {
				const body = req.body || {}

				const mapping = body.mapping || []
				this.config.racks = mapping

				this.saveConfig(this.config)
				this._applyConfigToLocalScopes()
				this.updateActions()
				this.updateFeedbacks()
				this.updateVariableDefinitions()

				reply.code(200)
				return { status: 200, result: { updated: mapping.length, total: mapping.length } }
			} catch (e) {
				this._log('error', 'HTTP update failed', { error: e?.message })
				reply.code(500)
				return { status: 500, error: e?.message }
			}
		})

		fastify.patch('/rack/:id', async (req, reply) => {
			try {
				const { id } = req.params || {}
				const body = req.body || {}
				const rackId = parseInt(id, 10)
				if (isNaN(rackId)) {
					reply.code(400)
					return { status: 400, error: 'invalid rack id' }
				}

				const rackConfig = this.config.racks?.[rackId] || { id: rackId, value: null }
				const newValue = body.value
				if (newValue == null || isNaN(parseInt(newValue, 10))) {
					reply.code(400)
					return { status: 400, error: 'invalid channel value' }
				}

				rackConfig.value = parseInt(newValue, 10)
				this.config.racks[rackId] = rackConfig

				this.saveConfig(this.config)
				this._applyConfigToLocalScopes()
				this.updateActions()
				this.updateFeedbacks()
				this.updateVariableDefinitions()
				reply.code(200)
				return { status: 200, message: 'success' }
			} catch (e) {
				this._log('error', 'HTTP rack patch failed', { error: e?.message })
				reply.code(500)
				return { status: 500, error: e?.message }
			}
		})

        const host  = '0.0.0.0'
        try {
			await fastify.listen({ port: this._http.port, host: host })
			this._http.server = fastify
			this._http.started = true
			this._log('info', `HTTP server started, listening on ${host}:${this._http.port}`)
		} catch (err) {
			this._log('error', `Failed to start HTTP server on ${host}:${this._http.port}`)
		}
	}

	async _stopHttpServer() {
		if (this._http.server && this._http.started) {
			try {
				await this._http.server.close()
				this._log('info', 'HTTP server stopped')
			} catch (err) {
				this._log('error', 'Failed to stop HTTP server')
			}
		}
		this._http.server = null
		this._http.started = false
	}
}

try {
	runEntrypoint(ModuleInstance, UpgradeScripts)
} catch (e) {
	console.error('[BOOT][FATAL] runEntrypoint error', e)
}
