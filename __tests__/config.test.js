const { validateRackMidiMap, parseMidiMapString } = require('../lib/midi-map')

describe('Configuration parsing and validation', () => {
  test('parseMidiMapString handles empty string as default', () => {
    const parsed = parseMidiMapString('')
    expect(parsed).toEqual({ racks: {} })
  })

  test('validateRackMidiMap rejects missing racks', () => {
    expect(validateRackMidiMap({})).toBe(false)
    expect(validateRackMidiMap({ racks: null })).toBe(false)
  })

  test('validateRackMidiMap accepts empty racks object', () => {
    expect(validateRackMidiMap({ racks: {} })).toBe(true)
  })

  test('parseMidiMapString accepts valid JSON with empty racks', () => {
    const raw = JSON.stringify({ racks: {} })
    const parsed = parseMidiMapString(raw)
    expect(parsed).toEqual({ racks: {} })
  })
})

