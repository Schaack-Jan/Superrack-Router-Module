function validateRackMidiMap(obj) {
  if (!obj || typeof obj !== 'object' || !obj.racks || typeof obj.racks !== 'object') return false
  for (const [rackId, rack] of Object.entries(obj.racks)) {
    if (!/^\d+$/.test(rackId)) return false
    if (!rack || typeof rack !== 'object' || typeof rack.name !== 'string' || typeof rack.enabled !== 'boolean' || !Array.isArray(rack.midiSteps)) return false
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

function parseMidiMapString(raw) {
  let parsed = { racks: {} }
  const str = typeof raw === 'string' ? raw : ''
  if (str && str.trim()) {
    try {
      const j = JSON.parse(str)
      if (validateRackMidiMap(j)) {
        parsed = j
      }
    } catch (e) {
      // ignore, return default
    }
  }
  return parsed
}

module.exports = { validateRackMidiMap, parseMidiMapString }

