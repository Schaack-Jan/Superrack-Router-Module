const { validateRackMidiMap, parseMidiMapString } = require('../lib/midi-map')

describe('midi-map lib', () => {
	test('validateRackMidiMap returns true for a valid map', () => {
		const valid = {
			racks: {
				1: {
					name: 'Rack 1',
					enabled: true,
					midiSteps: [
						{ type: 'cc', channel: 1, controller: 12, value: 100, delay: 0 },
						{ type: 'noteon', channel: 1, note: 60, value: 127, delay: 1 },
						{ type: 'program', channel: 1, program: 10, delay: 2 },
					],
				},
			},
		}
		expect(validateRackMidiMap(valid)).toBe(true)
	})

	test('validateRackMidiMap returns false for invalid structure', () => {
		const invalid = { racks: { A: { name: 1, enabled: 'yes', midiSteps: [] } } }
		expect(validateRackMidiMap(invalid)).toBe(false)
	})

	test('parseMidiMapString returns default on malformed JSON', () => {
		const parsed = parseMidiMapString('{')
		expect(parsed).toEqual({ racks: {} })
	})

	test('parseMidiMapString returns validated object', () => {
		const raw = JSON.stringify({ racks: { 2: { name: 'Rack 2', enabled: false, midiSteps: [] } } })
		const parsed = parseMidiMapString(raw)
		expect(parsed).toEqual({ racks: { 2: { name: 'Rack 2', enabled: false, midiSteps: [] } } })
	})
})
