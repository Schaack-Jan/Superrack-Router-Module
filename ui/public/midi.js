const typeSelect = document.getElementById('midi-type')
const channelInput = document.getElementById('midi-channel')

const updateMidiSetting = async (e) => {
    const id = e.target.id
    const value = e.target.value

    let payload = {}
    switch (id) {
        case "midi-type":
            payload.eventType = value
            break
        case "midi-channel":
            payload.channel = parseInt(value)
            break
        default:
            showAlert('Unknown MIDI setting, please refresh the page', 'error')
    }

    const res = await sendToServer(payload)
    const resp = await res.json()
    if (!(resp && resp.success !== false)) {
        showAlert('Failed to update MIDI setting on server', 'error')
    } else {
        showAlert('Updated MIDI setting successfully')
    }
}

const initMidi = async () => {
    const res = await fetch(MAPPING_URL)
    const data = await res.json()

    typeSelect.value = data.type
    channelInput.value = data.channel
}

const sendToServer = async (payload) => {
    return await fetch(UPDATE_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
}

if (typeof window !== 'undefined') {
    typeSelect.addEventListener('change', updateMidiSetting)
    channelInput.addEventListener('change', updateMidiSetting)

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initMidi())
    } else {
        initMidi()
    }
}
