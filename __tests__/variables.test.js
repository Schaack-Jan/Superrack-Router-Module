const { applyMidiStepToVariables } = require('../lib/midi-map')

describe('Variable filling on MIDI steps', () => {
  function createMockInstance() {
    const vars = {}
    return {
      setVariableValues: (obj) => Object.assign(vars, obj),
      getVars: () => vars,
    }
  }

  test('fills variables for CC step', () => {
    const instance = createMockInstance()
    const ok = applyMidiStepToVariables(instance, { type: 'cc', channel: 2, controller: 7, value: 64, delay: 0 })
    expect(ok).toBe(true)
    const v = instance.getVars()
    expect(v.midi_last_type).toBe('cc')
    expect(v.midi_last_channel).toBe(2)
    expect(v.midi_last_controller).toBe('7')
    expect(v.midi_last_value).toBe('64')
  })

  test('fills variables for noteon step', () => {
    const instance = createMockInstance()
    const ok = applyMidiStepToVariables(instance, { type: 'noteon', channel: 1, note: 60, value: 127, delay: 0 })
    expect(ok).toBe(true)
    const v = instance.getVars()
    expect(v.midi_last_type).toBe('noteon')
    expect(v.midi_last_channel).toBe(1)
    expect(v.midi_last_controller).toBe('60')
    expect(v.midi_last_value).toBe('127')
  })

  test('fills variables for program step', () => {
    const instance = createMockInstance()
    const ok = applyMidiStepToVariables(instance, { type: 'program', channel: 3, program: 10, delay: 0 })
    expect(ok).toBe(true)
    const v = instance.getVars()
    expect(v.midi_last_type).toBe('program')
    expect(v.midi_last_channel).toBe(3)
    expect(v.midi_last_controller).toBe('10')
    expect(v.midi_last_value).toBe('')
  })

  test('returns false for unknown type', () => {
    const instance = createMockInstance()
    const ok = applyMidiStepToVariables(instance, { type: 'xyz', channel: 1, delay: 0 })
    expect(ok).toBe(false)
    const v = instance.getVars()
    expect(v.midi_last_type).toBeUndefined()
  })
})

