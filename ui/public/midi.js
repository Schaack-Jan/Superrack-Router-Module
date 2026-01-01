const typeSelect = document.getElementById('midi-type')
const channelInput = document.getElementById('midi-channel')

let pluginChannel = null
let snapshotChannel = null
let isPlugin = false

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
            if (isPlugin && parseInt(value) === parseInt(snapshotChannel)) {
                showAlert('This MIDI channel is already assigned to the Snapshot mapping. Please choose a different channel.', 'error')
                channelInput.value = pluginChannel
                return
            }
            if (!isPlugin && parseInt(value) === parseInt(pluginChannel)) {
                showAlert('This MIDI channel is already assigned to the Plugin mapping. Please choose a different channel.', 'error')
                channelInput.value = snapshotChannel
                return
            }
            break
        default:
            showAlert('Unknown MIDI setting, please refresh the page.', 'error')
    }

    const res = await sendToServer(payload)
    const resp = await res.json()
    if (resp && resp.status === 400 && resp.error) {
        showAlert(resp.error, 'error')
        if (isPlugin) channelInput.value = pluginChannel
        else channelInput.value = snapshotChannel
        return
    }
    if (!(resp && resp.success !== false)) {
        showAlert('Failed to update MIDI setting on server.', 'error')
    } else {
        showAlert('MIDI setting updated successfully.')
        if (payload.channel !== undefined) {
            if (isPlugin) pluginChannel = payload.channel
            else snapshotChannel = payload.channel
        }
    }
}

const initMidi = async () => {
    isPlugin = window.location.pathname.includes('plugin')
    const pluginRes = await fetch('/midi/plugin/mapping')
    const pluginData = await pluginRes.json()
    pluginChannel = pluginData.channel
    const snapshotRes = await fetch('/midi/snapshot/mapping')
    const snapshotData = await snapshotRes.json()
    snapshotChannel = snapshotData.channel

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
