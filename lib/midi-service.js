const DEFAULT_PORT_BASENAME = 'SuperRack Router'
const ECHO_SUPPRESS_MS = 250
const SENT_HISTORY_LIMIT = 32

// Converts a validated midi-map step ({type, channel, controller/note/program, value})
// into raw MIDI bytes. Returns null for unknown types.
function midiStepToBytes(step) {
	if (!step || typeof step !== 'object') return null
	const ch = Number(step.channel)
	if (!Number.isInteger(ch) || ch < 1 || ch > 16) return null
	const status = ch - 1
	if (step.type === 'cc') {
		return [0xb0 | status, Number(step.controller) & 0x7f, Number(step.value) & 0x7f]
	}
	if (step.type === 'noteon') {
		return [0x90 | status, Number(step.note ?? step.controller) & 0x7f, Number(step.value) & 0x7f]
	}
	if (step.type === 'program') {
		return [0xc0 | status, Number(step.program ?? step.controller) & 0x7f]
	}
	return null
}

// Backend selection: virtual ports are only possible on macOS (CoreMIDI) and
// Linux (ALSA). On Windows RtMidi cannot create virtual ports, so we open an
// existing (loopMIDI) port by name instead.
function resolveBackend(config, platform) {
	if (!config?.midiEnabled) return 'none'
	return platform === 'win32' ? 'rtmidi-open' : 'rtmidi-virtual'
}

function portBaseName(instance) {
	const raw = instance.config?.midiPortName
	const name = typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_PORT_BASENAME
	return name
}

function midiConfigSnapshot(config) {
	return JSON.stringify({
		enabled: !!config?.midiEnabled,
		portName: config?.midiPortName || '',
		inChannel: config?.midiInChannel ?? null,
		inController: config?.midiInController ?? null,
	})
}

function _findPortIndexByName(port, name) {
	const needle = name.toLowerCase()
	const count = port.getPortCount()
	for (let i = 0; i < count; i++) {
		if (String(port.getPortName(i)).toLowerCase().includes(needle)) return i
	}
	return -1
}

function _recordSent(midiState, bytes) {
	midiState.lastSent.push({ bytes: bytes.join(','), ts: Date.now() })
	if (midiState.lastSent.length > SENT_HISTORY_LIMIT) midiState.lastSent.shift()
}

function _isEcho(midiState, bytes) {
	const key = bytes.join(',')
	const now = Date.now()
	return midiState.lastSent.some((e) => e.bytes === key && now - e.ts <= ECHO_SUPPRESS_MS)
}

// Handles a raw incoming MIDI message. Default trigger mapping: a CC on the
// configured channel/controller carries the mixer channel number as value and
// routes the rack mapped to that channel (same semantics as trigger_channel).
function handleIncomingMidi(instance, message) {
	const midiState = instance._midi
	if (!midiState || !Array.isArray(message) || message.length < 2) return
	if (_isEcho(midiState, message)) {
		instance._log('debug', 'MIDI in: suppressed echo of own message', { message })
		return
	}
	const status = message[0] & 0xf0
	const channel = (message[0] & 0x0f) + 1
	if (status !== 0xb0) return // only CC is mapped for now
	const controller = message[1]
	const value = message[2] ?? 0

	const wantChannel = parseInt(instance.config?.midiInChannel, 10) || 1
	const wantController = parseInt(instance.config?.midiInController, 10)
	const controllerMatch = Number.isInteger(wantController) ? controller === wantController : controller === 1
	if (channel !== wantChannel || !controllerMatch) return

	const { resolveRackForChannel } = require('./midi-map')
	const rackId = resolveRackForChannel(instance.rackMap, value)
	instance._log('info', 'MIDI in: trigger channel received', { channel, controller, value, rackId })
	if (rackId) {
		Promise.resolve(instance.routeRack(rackId)).catch((e) => {
			instance._log('error', 'MIDI in: routeRack failed', { rackId, error: e?.message })
		})
	} else {
		instance._log('warn', 'MIDI in: no rack mapped to channel', { value })
	}
}

async function startMidiService(instance) {
	instance._midi = instance._midi || {
		started: false,
		restarting: false,
		backend: 'none',
		input: null,
		output: null,
		lastSent: [],
	}
	const midiState = instance._midi
	if (midiState.started) {
		instance._log('debug', 'MIDI service already running')
		return
	}
	midiState.configSnapshot = midiConfigSnapshot(instance.config)
	const backend = resolveBackend(instance.config, process.platform)
	midiState.backend = backend
	if (backend === 'none') {
		instance._log('debug', 'MIDI service disabled (variables-only mode)')
		return
	}

	let midi
	try {
		midi = require('@julusian/midi')
	} catch (e) {
		instance._log('error', 'MIDI service: native module @julusian/midi could not be loaded', { error: e?.message })
		midiState.backend = 'none'
		return
	}

	const baseName = portBaseName(instance)
	const inName = `${baseName} In`
	const outName = `${baseName} Out`

	let input = null
	let output = null
	try {
		output = new midi.Output()
		input = new midi.Input()

		if (backend === 'rtmidi-virtual') {
			output.openVirtualPort(outName)
			input.openVirtualPort(inName)
			instance._log('info', 'MIDI service: virtual ports created', { in: inName, out: outName })
		} else {
			// Windows: open existing (loopMIDI) ports matching the configured name
			const outIdx = _findPortIndexByName(output, baseName)
			const inIdx = _findPortIndexByName(input, baseName)
			if (outIdx < 0 || inIdx < 0) {
				instance._log(
					'error',
					`MIDI service: no MIDI port matching "${baseName}" found. Create a loopMIDI port with this name (see HELP).`,
					{
						outFound: outIdx >= 0,
						inFound: inIdx >= 0,
					},
				)
				output.destroy()
				input.destroy()
				return
			}
			output.openPort(outIdx)
			input.openPort(inIdx)
			instance._log('info', 'MIDI service: opened existing ports', {
				in: input.getPortName(inIdx),
				out: output.getPortName(outIdx),
			})
		}

		input.on('message', (_deltaTime, message) => {
			try {
				handleIncomingMidi(instance, message)
			} catch (e) {
				instance._log('error', 'MIDI in: handler error', { error: e?.message })
			}
		})

		midiState.input = input
		midiState.output = output
		midiState.lastSent = []
		midiState.started = true
	} catch (e) {
		// RtMidi init can fail on systems without a MIDI subsystem (e.g. headless Linux without ALSA seq)
		instance._log('error', 'MIDI service: failed to start, falling back to variables-only mode', { error: e?.message })
		try {
			if (output) output.destroy()
		} catch {}
		try {
			if (input) input.destroy()
		} catch {}
		midiState.started = false
		midiState.input = null
		midiState.output = null
	}
}

async function stopMidiService(instance) {
	const midiState = instance._midi
	if (!midiState) return
	for (const key of ['input', 'output']) {
		const port = midiState[key]
		if (!port) continue
		try {
			port.closePort()
		} catch {}
		try {
			port.destroy()
		} catch {}
		midiState[key] = null
	}
	if (midiState.started) instance._log('info', 'MIDI service stopped')
	midiState.started = false
	midiState.lastSent = []
}

// Sends one midi-map step on the output port. Returns true if it was sent.
function sendMidiStep(instance, step) {
	const midiState = instance._midi
	if (!midiState?.started || !midiState.output) return false
	const bytes = midiStepToBytes(step)
	if (!bytes) return false
	try {
		midiState.output.sendMessage(bytes)
		_recordSent(midiState, bytes)
		instance._log('debug', 'MIDI out: sent', { bytes })
		return true
	} catch (e) {
		instance._log('error', 'MIDI out: send failed', { error: e?.message })
		return false
	}
}

module.exports = {
	startMidiService,
	stopMidiService,
	sendMidiStep,
	handleIncomingMidi,
	midiStepToBytes,
	resolveBackend,
	midiConfigSnapshot,
	DEFAULT_PORT_BASENAME,
	ECHO_SUPPRESS_MS,
}
