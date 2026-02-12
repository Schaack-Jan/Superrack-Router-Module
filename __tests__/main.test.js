jest.mock('@companion-module/base', () => {
	const actual = jest.requireActual('@companion-module/base')
	class InstanceBaseMock {
		constructor() {}
	}
	return {
		...actual,
		InstanceBase: InstanceBaseMock,
		runEntrypoint: jest.fn(),
	}
})

const ModuleInstance = require('../main').ModuleInstance || require('../main')

describe('ModuleInstance core logic', () => {
	function createInstance() {
		const internal = {}
		const instance = new ModuleInstance(internal)
		instance.setVariableValues = jest.fn()
		instance._log = jest.fn()
		instance.updateStatus = jest.fn()
		instance.saveConfig = jest.fn()
		instance.updateActions = jest.fn()
		instance.updateFeedbacks = jest.fn()
		instance.updateVariableDefinitions = jest.fn()
		instance.config = {}
		return instance
	}

	test('routeRack updates lastRoutedRacks and calls sequence', async () => {
		const instance = createInstance()
		instance._executeRackSequence = jest.fn()
		await instance.routeRack(5)
		expect(instance._executeRackSequence).toHaveBeenCalledWith(5)
		expect(instance.state.lastRoutedRacks[0]).toBe(5)
		expect(instance.state.sequenceRunning).toBe(false)
	})

	test('routeSnapshot calls sequence and updates state', async () => {
		const instance = createInstance()
		instance._executeSnapshotSequence = jest.fn()
		await instance.routeSnapshot(2)
		expect(instance._executeSnapshotSequence).toHaveBeenCalledWith(2)
		expect(instance.state.sequenceRunning).toBe(false)
	})

	test('routePlugin calls sequence and updates state', async () => {
		const instance = createInstance()
		instance._executePluginSequence = jest.fn()
		await instance.routePlugin(3)
		expect(instance._executePluginSequence).toHaveBeenCalledWith(3)
		expect(instance.state.sequenceRunning).toBe(false)
	})

	test('_updateVariables sets correct values', () => {
		const instance = createInstance()
		instance.state.lastRoutedRacks = [1,2]
		instance.state.failedStepsTotal = 5
		instance.state.activeSourceIndex = 7
		instance.state.activeSourceLabel = 'Test'
		instance.state.lastActionTimestamp = 123456
		instance._updateVariables({ setActionTimestamp: true })
		expect(instance.setVariableValues).toHaveBeenCalledWith(expect.objectContaining({
			last_routed_racks: JSON.stringify([1,2]),
			failed_steps_total: 5,
			active_source_index: 7,
			active_source_label: 'Test',
			last_action_timestamp: 123456
		}))
	})

	test('_executeSequence runs through and resets sequence state', async () => {
		const instance = createInstance()
		const steps = [{ type: 'cc', channel: 1, controller: 1, value: 1, delay: 0 }]
		await instance._executeSequence(steps, { type: 'rack', rackId: 1 })
		expect(instance.state.sequenceRunning).toBe(false)
		expect(instance._log).toHaveBeenCalledWith('info', expect.stringContaining('sequence started'), expect.anything())
	})

	test('getMidiSequenceForRack returns null for missing entry', () => {
		const instance = createInstance()
		instance.hotMap = []
		expect(instance.getMidiSequenceForRack(99)).toBeNull()
	})

	test('getMidiSequenceForSnapshot returns null for missing entry', () => {
		const instance = createInstance()
		instance.hotMap = []
		expect(instance.getMidiSequenceForSnapshot(99)).toBeNull()
	})

	test('getMidiSequenceForPlugin returns null for missing entry', () => {
		const instance = createInstance()
		instance.hotMap = []
		expect(instance.getMidiSequenceForPlugin(99)).toBeNull()
	})

	test('_applyConfigToLocalScopes updates config fields', () => {
		const instance = createInstance()
		instance.config = { logLevel: 'debug', http: { port: 1234 }, rackCount: 32, channelCount: 64 }
		instance._http.port = 1111
		instance.rackCount = 16
		instance.channelCount = 32
		instance._applyConfigToLocalScopes()
		expect(instance.logLevel).toBe('debug')
		expect(instance._http.port).toBe(1234)
		expect(instance.rackCount).toBe(32)
		expect(instance.channelCount).toBe(64)
	})

	test('configUpdated handles port change and errors', async () => {
		const instance = createInstance()
		instance._http.port = 1000
		instance._http.restarting = false
		instance._http.started = true
		instance.config = { http: { port: 2000 } }
		instance.saveConfig = jest.fn()
		instance.updateActions = jest.fn()
		instance.updateFeedbacks = jest.fn()
		instance.updateVariableDefinitions = jest.fn()
		instance._applyConfigToLocalScopes = jest.fn()
		instance._http.restarting = false
		instance._http.started = true
		instance._http.server = { close: jest.fn() }
		await instance.configUpdated({ http: { port: 2000 } })
		expect(instance._http.port).toBe(2000)
	})
})

describe('Companion API Blackbox', () => {
	const actions = require('../actions')
	const feedbacks = require('../feedbacks')
	const variables = require('../variables')

	function createMockSelf() {
		return {
			channelCount: 8,
			rackMap: { 1: { id: 1 }, 2: { id: 2 } },
			hotMap: [{ rack: 1, plugin: 1, snapshot: 1 }],
			hotPlugin: { mapping: [{ id: 1, value: 1 }], type: 'cc', channel: 1 },
			hotSnapshot: { mapping: [{ id: 1, value: 1 }], type: 'program', channel: 2 },
			setActionDefinitions: jest.fn(),
			setFeedbackDefinitions: jest.fn(),
			setVariableDefinitions: jest.fn(),
			state: { activeSourceIndex: 1, lastRoutedRacks: [1], sequenceRunning: false },
			log: jest.fn(),
			_log: jest.fn(),
			routeRack: jest.fn(),
			routeSnapshot: jest.fn(),
			routePlugin: jest.fn(),
		}
	}

	test('actions definitions are set and callbacks work', async () => {
		const self = createMockSelf()
		actions(self)
		const defs = self.setActionDefinitions.mock.calls[0][0]
		// route_rack
		await defs.route_rack.callback({ options: { rackId: 1 } })
		expect(self.routeRack).toHaveBeenCalledWith(1)
		// route_hot_snapshots
		await defs.route_hot_snapshots.callback({ options: { snapshotId: 1 } })
		expect(self.routeSnapshot).toHaveBeenCalledWith(1)
		// route_hot_plugins
		await defs.route_hot_plugins.callback({ options: { pluginId: 1 } })
		expect(self.routePlugin).toHaveBeenCalledWith(1)
		// trigger_channel
		await defs.trigger_channel.callback({ options: { channel: '1' } })
		expect(self.routeRack).toHaveBeenCalledWith(1)
	})

	test('feedbacks definitions are set and callbacks work', async () => {
		const self = createMockSelf()
		await feedbacks(self)
		const defs = self.setFeedbackDefinitions.mock.calls[0][0]
		// active_source
		expect(defs.active_source.callback({ options: { sourceIndex: 1 } })).toBe(true)
		// rack_last_used
		expect(defs.rack_last_used.callback({ options: { rackId: 1 } })).toBe(true)
		// sequence_running
		expect(defs.sequence_running.callback({})).toBe(false)
	})

	test('variables definitions are set', () => {
		const self = createMockSelf()
		variables(self)
		const defs = self.setVariableDefinitions.mock.calls[0][0]
		expect(defs.find(v => v.variableId === 'last_routed_racks')).toBeDefined()
		expect(defs.find(v => v.variableId === 'midi_last_type')).toBeDefined()
	})
})
