// Lazy-load @julusian/midi in a CommonJS-friendly way and handle environments
// where native addons may be disabled (e.g., Companion sandbox).

let midiLib = null

class MidiManager {
	constructor(logFn) {
		this._log = (level, msg, data) => {
			try {
				logFn?.(level, msg, data)
			} catch {}
		}

		this.enabled = false
		this.selectedOutputs = []
		this.outputs = []
		this.inputs = []
		this._openOutputs = []
		this._available = false
	}

	_ensureLib() {
		if (midiLib) {
			this._available = true
			return true
		}
		try {
			// Attempt to require native library; may fail if addons are disabled
			// Note: keep this a lazy require so the module can load without crashing
			// even if native addons are blocked in the runtime.
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			midiLib = require('@julusian/midi')
			this._available = true
			return true
		} catch (e) {
			this._available = false
			// Specific handling for disabled native addons (as used by Companion)
			if (e?.code === 'ERR_DLOPEN_DISABLED') {
				this._log(
					'warn',
					'Native addons disabled – internal MIDI unavailable. Use Generic-MIDI or enable addons.',
					{ code: e.code }
				)
			} else {
				this._log('warn', 'Failed to load @julusian/midi', { error: e?.message || String(e) })
			}
			return false
		}
	}

	refreshPorts() {
		this.outputs = []
		this.inputs = []
		if (!this._ensureLib()) return { outputs: [], inputs: [] }
		try {
			const out = new midiLib.Output()
			const count = out.getPortCount()
			for (let i = 0; i < count; i++) this.outputs.push({ index: i, name: out.getPortName(i) })
			out.closePort?.()
		} catch (e) {
			this._log('warn', 'MIDI: failed to list output ports', { error: e?.message || String(e) })
		}
		try {
			const input = new midiLib.Input()
			const count = input.getPortCount()
			for (let i = 0; i < count; i++) this.inputs.push({ index: i, name: input.getPortName(i) })
			input.closePort?.()
		} catch (e) {
			// listing inputs can fail on some setups; this is non-fatal
			this._log('debug', 'MIDI: failed to list input ports (ignored)', { error: e?.message || String(e) })
		}
		return { outputs: this.outputs, inputs: this.inputs }
	}

	getOutputChoices() {
		if (!this.outputs?.length) this.refreshPorts()
		return (this.outputs || []).map((p) => ({ id: `${p.index}|${p.name}`, label: p.name }))
	}

	applyConfig(cfg = {}) {
		const enabled = !!cfg.enabled
		const outputsCfg = Array.isArray(cfg.outputs) ? cfg.outputs : []
		this.enabled = enabled
		this.refreshPorts()
		const selected = []
		for (const id of outputsCfg) {
			const [idxStr, name] = String(id).split('|')
			const idx = parseInt(idxStr, 10)
			let match = this.outputs.find((p) => p?.name === name)
			if (!match) match = this.outputs.find((p) => p?.index === idx)
			if (match) selected.push({ name: match.name, index: match.index })
		}
		this.selectedOutputs = selected
		this._reopenOutputs()
	}

	_reopenOutputs() {
		for (const out of this._openOutputs) {
			try {
				out.closePort?.()
			} catch {}
		}
		this._openOutputs = []
		if (!this.enabled) {
			this._log('info', 'MIDI disabled – no ports opened')
			return
		}
		if (!this._ensureLib()) {
			this._log('warn', 'MIDI unavailable – native addons disabled')
			return
		}
		for (const sel of this.selectedOutputs) {
			try {
				const out = new midiLib.Output()
				out.openPort(sel.index)
				this._openOutputs.push(out)
				this._log('info', 'MIDI output opened', { index: sel.index, name: sel.name })
			} catch (e) {
				this._log('warn', 'Failed to open MIDI output', {
					index: sel?.index,
					name: sel?.name,
					error: e?.message || String(e),
				})
			}
		}
	}

	destroy() {
		for (const out of this._openOutputs) {
			try {
				out.closePort?.()
			} catch {}
		}
		this._openOutputs = []
	}

	sendStep(step) {
		if (!this.enabled || this._openOutputs.length === 0) return
		if (!this._ensureLib()) return
		const ch = Math.max(1, Math.min(16, step?.channel || 1))
		const channelNibble = (ch - 1) & 0x0f
		let message = null
		if (step?.type === 'cc') {
			const controller = Math.max(0, Math.min(127, step.controller))
			const value = Math.max(0, Math.min(127, step.value))
			message = [0xb0 | channelNibble, controller & 0x7f, value & 0x7f]
		} else if (step?.type === 'noteon') {
			const note = Math.max(0, Math.min(127, step.note))
			const value = Math.max(0, Math.min(127, step.value))
			message = [0x90 | channelNibble, note & 0x7f, value & 0x7f]
		} else if (step?.type === 'program') {
			const program = Math.max(0, Math.min(127, step.program))
			message = [0xc0 | channelNibble, program & 0x7f]
		} else {
			this._log('warn', 'MIDI: unknown step type', { type: step?.type })
			return
		}
		for (const out of this._openOutputs) {
			try {
				out.sendMessage(message)
				this._log('debug', 'MIDI sent', { message })
			} catch (e) {
				this._log('warn', 'MIDI send failed', { error: e?.message || String(e) })
			}
		}
	}

	isAvailable() {
		return !!this._available || this._ensureLib()
	}
}

module.exports = { MidiManager }
