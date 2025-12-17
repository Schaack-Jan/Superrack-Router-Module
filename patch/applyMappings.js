// Verantwortlich für das Validieren und Anwenden von Rack→Channel-Mappings
// Export: applyMappings(instance, mappings)

/**
 * Validiert und wendet Mappings (Rack->Channel) auf die Instance-Konfiguration an.
 * - Rack: 1..64
 * - Channel: 1..99
 * Aktualisiert this.config[`rack_channel_index_${rack}`] = String(channel)
 * Ruft anschließend instance.configUpdated(instance.config), um Folgeeffekte (Actions/Feedbacks/Variablen) zu aktualisieren.
 *
 * @param {any} instance - ModuleInstance aus main.js
 * @param {Object} mappings - Objekt mit Keys als Rack-IDs und Values als Channel-IDs
 * @returns {{updated:number, applied:Object}} Anzahl der angewendeten Paare und das bereinigte Objekt
 */
async function applyMappings(instance, mappings) {
	if (!instance || typeof instance !== 'object') throw new Error('applyMappings: invalid instance')
	if (!mappings || typeof mappings !== 'object') throw new Error('applyMappings: invalid mappings payload')

	const cleaned = {}
	let updated = 0
	for (const [rack, channel] of Object.entries(mappings)) {
		const r = parseInt(rack, 10)
		const ch = parseInt(channel, 10)
		if (Number.isInteger(r) && r >= 1 && r <= 64 && Number.isInteger(ch) && ch >= 1 && ch <= 99) {
			cleaned[r] = ch
		}
	}

	// Wende die bereinigten Mappings an
	instance.config = instance.config || {}
	for (const [r, ch] of Object.entries(cleaned)) {
		const key = `rack_channel_index_${r}`
		const prev = instance.config[key]
		const next = String(ch)
		if (prev !== next) {
			instance.config[key] = next
			updated++
		}
	}

	// Folge-Updates innerhalb des Moduls auslösen
	if (typeof instance.configUpdated === 'function') {
		await instance.configUpdated(instance.config)
	}

	// Logging über die interne Logik
	if (typeof instance._log === 'function') {
		instance._log('info', 'Mappings angewendet', { updated, total: Object.keys(cleaned).length })
	}

	return { updated, applied: cleaned }
}

module.exports = { applyMappings }

