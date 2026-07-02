jest.mock('@julusian/midi', () => {
	const state = {
		outputs: [],
		inputs: [],
		outputPortNames: [],
		inputPortNames: [],
		failConstructor: false,
	}

	class MockPort {
		constructor(names) {
			if (state.failConstructor) throw new Error('Failed to initialise RtMidi')
			this._names = names
			this._handlers = {}
			this.openVirtualPort = jest.fn()
			this.openPort = jest.fn()
			this.closePort = jest.fn()
			this.destroy = jest.fn()
			this.sendMessage = jest.fn()
		}
		getPortCount() {
			return this._names().length
		}
		getPortName(i) {
			return this._names()[i]
		}
		on(event, cb) {
			this._handlers[event] = cb
		}
		emit(event, ...args) {
			if (this._handlers[event]) this._handlers[event](...args)
		}
	}

	class Output extends MockPort {
		constructor() {
			super(() => state.outputPortNames)
			state.outputs.push(this)
		}
	}
	class Input extends MockPort {
		constructor() {
			super(() => state.inputPortNames)
			state.inputs.push(this)
		}
	}

	return { Output, Input, __state: state }
})

const midiMock = require('@julusian/midi')
const {
	startMidiService,
	stopMidiService,
	sendMidiStep,
	midiStepToBytes,
	resolveBackend,
	midiConfigSnapshot,
	ECHO_SUPPRESS_MS,
} = require('../lib/midi-service')
const { resolveRackForChannel } = require('../lib/midi-map')

function createInstance(config = {}) {
	return {
		config: { midiEnabled: true, ...config },
		rackMap: [],
		_log: jest.fn(),
		routeRack: jest.fn().mockResolvedValue(undefined),
	}
}

function setPlatform(platform) {
	const original = Object.getOwnPropertyDescriptor(process, 'platform')
	Object.defineProperty(process, 'platform', { value: platform })
	return () => Object.defineProperty(process, 'platform', original)
}

beforeEach(() => {
	midiMock.__state.outputs.length = 0
	midiMock.__state.inputs.length = 0
	midiMock.__state.outputPortNames = []
	midiMock.__state.inputPortNames = []
	midiMock.__state.failConstructor = false
	jest.clearAllMocks()
})

describe('midiStepToBytes', () => {
	test('encodes cc on channel 1', () => {
		expect(midiStepToBytes({ type: 'cc', channel: 1, controller: 10, value: 127 })).toEqual([0xb0, 10, 127])
	})
	test('encodes noteon on channel 16', () => {
		expect(midiStepToBytes({ type: 'noteon', channel: 16, note: 64, value: 100 })).toEqual([0x9f, 64, 100])
	})
	test('encodes program change on channel 2 (two bytes)', () => {
		expect(midiStepToBytes({ type: 'program', channel: 2, program: 5 })).toEqual([0xc1, 5])
	})
	test('rejects unknown type and invalid channel', () => {
		expect(midiStepToBytes({ type: 'sysex', channel: 1 })).toBeNull()
		expect(midiStepToBytes({ type: 'cc', channel: 0, controller: 1, value: 1 })).toBeNull()
		expect(midiStepToBytes({ type: 'cc', channel: 17, controller: 1, value: 1 })).toBeNull()
		expect(midiStepToBytes(null)).toBeNull()
	})
})

describe('resolveBackend', () => {
	test('is none when MIDI is disabled', () => {
		expect(resolveBackend({ midiEnabled: false }, 'darwin')).toBe('none')
		expect(resolveBackend(undefined, 'linux')).toBe('none')
	})
	test('creates virtual ports on macOS and Linux', () => {
		expect(resolveBackend({ midiEnabled: true }, 'darwin')).toBe('rtmidi-virtual')
		expect(resolveBackend({ midiEnabled: true }, 'linux')).toBe('rtmidi-virtual')
	})
	test('opens existing ports on Windows', () => {
		expect(resolveBackend({ midiEnabled: true }, 'win32')).toBe('rtmidi-open')
	})
})

describe('resolveRackForChannel', () => {
	test('resolves from array-form rackMap', () => {
		const rackMap = [null, { id: 1, value: 7 }, { id: 2, value: 9 }]
		expect(resolveRackForChannel(rackMap, 9)).toBe(2)
		expect(resolveRackForChannel(rackMap, 1)).toBeNull()
	})
	test('resolves from object-form rackMap', () => {
		const rackMap = { 1: { id: 1, value: 7 }, 2: { value: 9 } }
		expect(resolveRackForChannel(rackMap, 7)).toBe(1)
		expect(resolveRackForChannel(rackMap, 9)).toBe(2)
	})
	test('returns null for empty/invalid maps', () => {
		expect(resolveRackForChannel(null, 5)).toBeNull()
		expect(resolveRackForChannel([], 5)).toBeNull()
	})
})

describe('startMidiService (virtual backend)', () => {
	let restorePlatform
	beforeEach(() => {
		restorePlatform = setPlatform('linux')
	})
	afterEach(() => restorePlatform())

	test('creates virtual in/out ports with configured base name', async () => {
		const instance = createInstance({ midiPortName: 'My Router' })
		await startMidiService(instance)
		expect(instance._midi.started).toBe(true)
		expect(instance._midi.backend).toBe('rtmidi-virtual')
		expect(midiMock.__state.outputs[0].openVirtualPort).toHaveBeenCalledWith('My Router Out')
		expect(midiMock.__state.inputs[0].openVirtualPort).toHaveBeenCalledWith('My Router In')
	})

	test('stays in variables-only mode when disabled', async () => {
		const instance = createInstance({ midiEnabled: false })
		await startMidiService(instance)
		expect(instance._midi.started).toBe(false)
		expect(instance._midi.backend).toBe('none')
		expect(midiMock.__state.outputs).toHaveLength(0)
	})

	test('falls back to variables-only mode when RtMidi init fails', async () => {
		midiMock.__state.failConstructor = true
		const instance = createInstance()
		await startMidiService(instance)
		expect(instance._midi.started).toBe(false)
		expect(instance._log).toHaveBeenCalledWith('error', expect.stringContaining('failed to start'), expect.anything())
	})

	test('is idempotent while running', async () => {
		const instance = createInstance()
		await startMidiService(instance)
		await startMidiService(instance)
		expect(midiMock.__state.outputs).toHaveLength(1)
	})
})

describe('startMidiService (Windows open-by-name backend)', () => {
	let restorePlatform
	beforeEach(() => {
		restorePlatform = setPlatform('win32')
	})
	afterEach(() => restorePlatform())

	test('opens existing loopMIDI ports matched by name', async () => {
		midiMock.__state.outputPortNames = ['Microsoft GS Wavetable', 'SuperRack Router 1']
		midiMock.__state.inputPortNames = ['SuperRack Router 1']
		const instance = createInstance()
		await startMidiService(instance)
		expect(instance._midi.started).toBe(true)
		expect(midiMock.__state.outputs[0].openPort).toHaveBeenCalledWith(1)
		expect(midiMock.__state.inputs[0].openPort).toHaveBeenCalledWith(0)
	})

	test('logs an error and stays stopped when no port matches', async () => {
		midiMock.__state.outputPortNames = ['Microsoft GS Wavetable']
		midiMock.__state.inputPortNames = []
		const instance = createInstance()
		await startMidiService(instance)
		expect(instance._midi.started).toBe(false)
		expect(instance._log).toHaveBeenCalledWith('error', expect.stringContaining('loopMIDI'), expect.anything())
		expect(midiMock.__state.outputs[0].destroy).toHaveBeenCalled()
	})
})

describe('sendMidiStep', () => {
	let restorePlatform
	beforeEach(() => {
		restorePlatform = setPlatform('linux')
	})
	afterEach(() => restorePlatform())

	test('sends encoded bytes on the output port', async () => {
		const instance = createInstance()
		await startMidiService(instance)
		const ok = sendMidiStep(instance, { type: 'cc', channel: 1, controller: 20, value: 64 })
		expect(ok).toBe(true)
		expect(instance._midi.output.sendMessage).toHaveBeenCalledWith([0xb0, 20, 64])
	})

	test('returns false when the service is not running', () => {
		const instance = createInstance({ midiEnabled: false })
		expect(sendMidiStep(instance, { type: 'cc', channel: 1, controller: 1, value: 1 })).toBe(false)
	})
})

describe('incoming MIDI trigger mapping', () => {
	let restorePlatform
	beforeEach(() => {
		restorePlatform = setPlatform('linux')
	})
	afterEach(() => restorePlatform())

	test('routes the rack mapped to the CC value', async () => {
		const instance = createInstance({ midiInChannel: 1, midiInController: 1 })
		instance.rackMap = [null, { id: 1, value: 5 }, { id: 2, value: 6 }]
		await startMidiService(instance)
		midiMock.__state.inputs[0].emit('message', 0, [0xb0, 1, 6])
		expect(instance.routeRack).toHaveBeenCalledWith(2)
	})

	test('ignores CC on other channels or controllers', async () => {
		const instance = createInstance({ midiInChannel: 2, midiInController: 10 })
		instance.rackMap = [null, { id: 1, value: 5 }]
		await startMidiService(instance)
		midiMock.__state.inputs[0].emit('message', 0, [0xb0, 10, 5]) // channel 1, not 2
		midiMock.__state.inputs[0].emit('message', 0, [0xb1, 11, 5]) // wrong controller
		expect(instance.routeRack).not.toHaveBeenCalled()
	})

	test('warns when no rack is mapped to the value', async () => {
		const instance = createInstance({ midiInChannel: 1, midiInController: 1 })
		instance.rackMap = []
		await startMidiService(instance)
		midiMock.__state.inputs[0].emit('message', 0, [0xb0, 1, 99])
		expect(instance.routeRack).not.toHaveBeenCalled()
		expect(instance._log).toHaveBeenCalledWith('warn', expect.stringContaining('no rack mapped'), expect.anything())
	})

	test('suppresses echoes of just-sent messages', async () => {
		const instance = createInstance({ midiInChannel: 1, midiInController: 1 })
		instance.rackMap = [null, { id: 1, value: 5 }]
		await startMidiService(instance)
		sendMidiStep(instance, { type: 'cc', channel: 1, controller: 1, value: 5 })
		midiMock.__state.inputs[0].emit('message', 0, [0xb0, 1, 5])
		expect(instance.routeRack).not.toHaveBeenCalled()

		// after the suppression window the same message triggers again
		instance._midi.lastSent[0].ts = Date.now() - ECHO_SUPPRESS_MS - 1
		midiMock.__state.inputs[0].emit('message', 0, [0xb0, 1, 5])
		expect(instance.routeRack).toHaveBeenCalledWith(1)
	})
})

describe('stopMidiService', () => {
	let restorePlatform
	beforeEach(() => {
		restorePlatform = setPlatform('linux')
	})
	afterEach(() => restorePlatform())

	test('closes and destroys both ports', async () => {
		const instance = createInstance()
		await startMidiService(instance)
		const output = midiMock.__state.outputs[0]
		const input = midiMock.__state.inputs[0]
		await stopMidiService(instance)
		expect(instance._midi.started).toBe(false)
		expect(output.closePort).toHaveBeenCalled()
		expect(output.destroy).toHaveBeenCalled()
		expect(input.closePort).toHaveBeenCalled()
		expect(input.destroy).toHaveBeenCalled()
	})

	test('is safe to call when never started', async () => {
		const instance = createInstance({ midiEnabled: false })
		await expect(stopMidiService(instance)).resolves.toBeUndefined()
	})
})

describe('midiConfigSnapshot', () => {
	test('changes only when MIDI-relevant fields change', () => {
		const a = midiConfigSnapshot({
			midiEnabled: true,
			midiPortName: 'X',
			midiInChannel: 1,
			midiInController: 1,
			logLevel: 'debug',
		})
		const b = midiConfigSnapshot({
			midiEnabled: true,
			midiPortName: 'X',
			midiInChannel: 1,
			midiInController: 1,
			logLevel: 'error',
		})
		const c = midiConfigSnapshot({ midiEnabled: true, midiPortName: 'Y', midiInChannel: 1, midiInController: 1 })
		expect(a).toBe(b)
		expect(a).not.toBe(c)
	})
})
