let NUM_RACKS
let NUM_CHANNELS
let EMPTY_MAPPING

let isMouseDown = false
let rackMappings = {}
let cellRefs = [] // 2D matrix of cells [rack][channel]
let rackCells = [] // flat list per rack
let channelToRack = [] // maps channel -> rack id or null

const patchContainer = document.getElementById('patch-matrix-container')
const statusEl = document.getElementById('status')
const loadBtn = document.getElementById('load-btn')
const saveBtn = document.getElementById('save-btn')
const clearBtn = document.getElementById('clear-btn')
const exportBtn = document.getElementById('export-btn')
const importInput = document.getElementById('import-input')
const importBtn = document.getElementById('import-btn')

function setStatus(connected) {
	if (!statusEl) return
	statusEl.classList.toggle('connected', connected)
	statusEl.classList.toggle('disconnected', !connected)
	statusEl.textContent = connected ? 'Connected' : 'Disconnected'
}

function initPatchMatrix() {
	fetch('/patch/mappings').then((res) => startupPatchMatrix(res))

	setInterval(() => {
		fetch('/health')
			.then((res) => res.json())
			.then((data) => setStatus((data.status ?? 'disconnected') === 'ok'))
			.catch(() => {})
	}, 10000)
}

async function startupPatchMatrix(res) {
	let data
	try {
		data = await res.json()
	} catch (_) {
		data = {}
	}
	setStatus(Boolean(data && (data.success ?? true)))
	const container = document.getElementById('patch-matrix-container') || patchContainer
	if (!container) {
		console.warn('patch-matrix-container not found')
		return
	}

	// Read meta with safe defaults
	NUM_RACKS = Number(data?.meta?.maxRacks) || 0
	NUM_CHANNELS = Number(data?.meta?.numChannels) || 0
	EMPTY_MAPPING = Array.isArray(data?.meta?.emptyMapping) ? data.meta.emptyMapping : null

	// Initialize mappings robustly
	const incoming = Array.isArray(data?.mapping) ? data.mapping : []
	if (NUM_RACKS <= 0 || NUM_CHANNELS <= 0) {
		// try to infer from incoming mapping
		for (const m of incoming) {
			if (!m) continue
			NUM_RACKS = Math.max(NUM_RACKS, Number(m.id) || 0)
			NUM_CHANNELS = Math.max(NUM_CHANNELS, Number(m.value) || 0)
		}
	}
	if (NUM_RACKS <= 0 || NUM_CHANNELS <= 0) {
		console.warn('No rack/channel meta available; cannot build matrix')
		container.innerHTML = '<div style="padding:8px">Keine Metadaten für Racks/Kanäle gefunden.</div>'
		return
	}

	// Build rackMappings array of length NUM_RACKS+1
	rackMappings = new Array(NUM_RACKS + 1)
	for (let r = 1; r <= NUM_RACKS; r++) {
		rackMappings[r] = { id: r, value: null }
	}
	for (const m of incoming) {
		if (!m) continue
		const r = Number(m.id)
		const v = Number(m.value)
		if (r >= 1 && r <= NUM_RACKS && v >= 1 && v <= NUM_CHANNELS) {
			rackMappings[r].value = v
		}
	}

	// Build quick lookup for channel -> rack
	channelToRack = new Array(NUM_CHANNELS + 1).fill(null)
	for (let r = 1; r <= NUM_RACKS; r++) {
		const v = rackMappings[r].value
		if (v != null) channelToRack[v] = r
	}

	// Render
	container.innerHTML = ''
	const table = document.createElement('div')
	table.className = 'patch-table'
	table.style.gridTemplateColumns = `100px repeat(${NUM_CHANNELS}, 30px)`

	const emptyHeader = document.createElement('div')
	emptyHeader.className = 'patch-header-cell corner-cell'
	table.appendChild(emptyHeader)

	for (let c = 1; c <= NUM_CHANNELS; c++) {
		const header = document.createElement('div')
		header.className = 'patch-header-cell'
		header.innerText = c
		table.appendChild(header)
	}

	cellRefs = new Array(NUM_RACKS + 1)
	rackCells = new Array(NUM_RACKS + 1)

	for (let r = 1; r <= NUM_RACKS; r++) {
		const label = document.createElement('div')
		label.className = 'patch-rack-label'
		label.innerText = `Rack ${r}`
		table.appendChild(label)

		cellRefs[r] = new Array(NUM_CHANNELS + 1)
		rackCells[r] = []

		for (let c = 1; c <= NUM_CHANNELS; c++) {
			const cell = document.createElement('div')
			cell.className = 'patch-cell'
			cell.setAttribute('data-rack', r)
			cell.setAttribute('data-channel', c)
			if (rackMappings[r].value === c) {
				cell.classList.add('success')
			}
			const inner = document.createElement('div')
			inner.className = 'patch-cell-inner'
			cell.appendChild(inner)
			cell.addEventListener('click', () => selectChannelForRack(r, c))
			table.appendChild(cell)
			cellRefs[r][c] = cell
			rackCells[r].push(cell)
		}
	}

	container.appendChild(table)
	document.addEventListener('mouseup', () => {
		isMouseDown = false
	})
}

// Attach UI event listeners if elements exist
if (typeof window !== 'undefined') {
	if (loadBtn) loadBtn.addEventListener('click', loadFromCompanion)
	if (saveBtn)
		saveBtn.addEventListener('click', async () => {
			try {
				await saveToCompanion()
			} catch (_) {}
		})
	if (clearBtn) clearBtn.addEventListener('click', clearAllMappings)
	if (exportBtn) exportBtn.addEventListener('click', exportMappings)
	if (importInput)
		importInput.addEventListener('change', (e) => {
			if (e.target.files && e.target.files[0]) importMappings(e.target.files[0])
		})
	if (importBtn) importBtn.addEventListener('click', () => importInput && importInput.click())

	// Init after DOM ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => initPatchMatrix())
	} else {
		initPatchMatrix()
	}
}

function selectChannelForRack(rack, channel) {
	const clickedCell = cellRefs[rack]?.[channel]
	if (clickedCell) clickedCell.classList.add('pending')

	const prevChannel = rackMappings[rack]?.value ?? null
	const prevRackForChannel = channelToRack[channel] ?? null

	// If another rack uses this channel, clear only that cell
	if (prevRackForChannel && prevRackForChannel !== rack) {
		const otherCell = cellRefs[prevRackForChannel]?.[channel]
		if (otherCell) otherCell.classList.remove('active', 'success', 'pending')
		rackMappings[prevRackForChannel].value = null
		channelToRack[channel] = null
	}

	// Update mapping for current rack
	if (prevChannel === channel) {
		rackMappings[rack].value = null
		channelToRack[channel] = null
	} else {
		// Clear previous cell of this rack, if any
		if (prevChannel != null) {
			const prevCell = cellRefs[rack]?.[prevChannel]
			if (prevCell) prevCell.classList.remove('active', 'success', 'pending')
			channelToRack[prevChannel] = null
		}
		rackMappings[rack].value = channel
		channelToRack[channel] = rack
	}

	persistMappingUpdate(rack, prevChannel).catch(() => {
		// rollback mapping and UI
		if (prevRackForChannel && prevRackForChannel !== rack) {
			// restore other rack's cell
			const otherCell = cellRefs[prevRackForChannel]?.[channel]
			if (otherCell) otherCell.classList.add('success')
			rackMappings[prevRackForChannel].value = channel
			channelToRack[channel] = prevRackForChannel
		}

		rackMappings[rack].value = prevChannel
		if (clickedCell) clickedCell.classList.remove('pending')
		if (prevChannel != null) {
			const prevCell = cellRefs[rack]?.[prevChannel]
			if (prevCell) prevCell.classList.add('success')
			channelToRack[prevChannel] = rack
		} else {
			// ensure no residual state on current rack/channel
			const curCell = cellRefs[rack]?.[channel]
			if (curCell) curCell.classList.remove('active', 'success', 'pending')
			channelToRack[channel] = prevRackForChannel ?? null
		}
		showAlert('Fehler beim Patchen – Änderung wurde zurückgesetzt', 'error')
	})
}

async function persistMappingUpdate(changedRackId, previousValue) {
	try {
		const res = await fetch('/patch/update', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mapping: rackMappings }),
		})
		const data = await res.json()
		if (!(data && data.success !== false)) {
			throw new Error('Backend meldet Fehler')
		}

		const newValue = rackMappings[changedRackId]?.value ?? null
		// Only update the two relevant cells: previous and new
		if (previousValue != null) {
			const prevCell = cellRefs[changedRackId]?.[previousValue]
			if (prevCell) prevCell.classList.remove('active', 'pending', 'success')
		}
		if (newValue != null) {
			const successCell = cellRefs[changedRackId]?.[newValue]
			if (successCell) {
				successCell.classList.remove('pending')
				successCell.classList.add('success')
			}
		}
	} catch (err) {
		showAlert('Fehler beim Patchen – Änderung wurde zurückgesetzt', 'error')
		throw err
	}
}

function clearAllMappings() {
	rackMappings = EMPTY_MAPPING
	const parent = document.getElementById('patch-matrix-container')
	const activeCells = parent.querySelectorAll(
		'[data-rack][data-channel].active, [data-rack][data-channel].pending, [data-rack][data-channel].success',
	)
	for (const cell of activeCells) {
		cell.classList.remove('active', 'pending', 'success')
	}
}

function exportMappings() {
	// Erzeuge flache Struktur { mappings: { rackId: channel } }
	const mappings = {}
	if (Array.isArray(rackMappings)) {
		for (const map of rackMappings) {
			if (!map || map.value == null) continue
			mappings[map.id] = map.value
		}
	}
	const blob = new Blob([JSON.stringify({ mappings }, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = 'mappings.json'
	a.click()
	URL.revokeObjectURL(url)
}

function importMappings(file) {
	const reader = new FileReader()
	reader.onload = async (e) => {
		try {
			const data = JSON.parse(e.target.result)
			clearAllMappings()
			const pendingCells = []
			const mappingsObj = data.mappings || null
			const mappingArr = data.rackMappings || data.mapping || null

			if (Array.isArray(EMPTY_MAPPING)) {
				rackMappings = EMPTY_MAPPING.map((m) => (m ? { id: m.id, value: null } : m))
			} else {
				rackMappings = []
			}
			channelToRack = new Array(NUM_CHANNELS + 1).fill(null)

			const assignAndMark = (r, ch) => {
				if (!rackMappings[r]) rackMappings[r] = { id: r, value: null }
				// Clear previous mapping per rack
				const oldCh = rackMappings[r].value
				if (oldCh != null) {
					const oldCell = cellRefs[r]?.[oldCh]
					if (oldCell) oldCell.classList.remove('active', 'success', 'pending')
					channelToRack[oldCh] = null
				}
				rackMappings[r].value = ch
				channelToRack[ch] = r
				const cell = cellRefs[r]?.[ch]
				if (cell) {
					cell.classList.add('pending')
					pendingCells.push(cell)
				}
			}

			if (mappingsObj && typeof mappingsObj === 'object') {
				for (const [rack, channel] of Object.entries(mappingsObj)) {
					const r = parseInt(rack, 10)
					const ch = parseInt(channel, 10)
					if (
						Number.isInteger(r) &&
						Number.isInteger(ch) &&
						r >= 1 &&
						r <= NUM_RACKS &&
						ch >= 1 &&
						ch <= NUM_CHANNELS
					) {
						assignAndMark(r, ch)
					}
				}
			} else if (Array.isArray(mappingArr)) {
				for (const map of mappingArr) {
					if (!map) continue
					const r = parseInt(map.id, 10)
					const ch = parseInt(map.value, 10)
					if (
						Number.isInteger(r) &&
						Number.isInteger(ch) &&
						r >= 1 &&
						r <= NUM_RACKS &&
						ch >= 1 &&
						ch <= NUM_CHANNELS
					) {
						assignAndMark(r, ch)
					}
				}
			}

			const res = await fetch('/patch/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mapping: rackMappings }),
			})
			const resp = await res.json()
			if (!(resp && resp.success !== false)) {
				throw new Error('Backend meldet Fehler beim Import-Speichern')
			}

			for (const cell of pendingCells) {
				cell.classList.remove('pending')
				cell.classList.add('success')
			}

			showAlert('Mapping imported successfully.')
		} catch (err) {
			// remove pending marks efficiently
			for (let r = 1; r <= NUM_RACKS; r++) {
				const rc = rackCells[r] || []
				for (const c of rc) c.classList.remove('pending')
			}
			showAlert(`Mapping import failed: ${err.message}`, 'error')
		}
	}
	reader.readAsText(file)
}

async function loadFromCompanion() {
	try {
		const res = await fetch('/patch/mappings')
		const data = await res.json()
		clearAllMappings()
		let mapping = data.mapping || []
		for (const map of mapping) {
			if (!map) continue
			const cell = cellRefs[map.id]?.[map.value]
			if (cell) cell.classList.add('success')
			// keep channelToRack in sync
			if (Number.isInteger(map.id) && Number.isInteger(map.value)) {
				channelToRack[map.value] = map.id
				if (!rackMappings[map.id]) rackMappings[map.id] = { id: map.id, value: null }
				rackMappings[map.id].value = map.value
			}
		}
		// no success alert here
	} catch (err) {
		showAlert(`Error loading config: ${err.message}`, 'error')
	}
}

// Leichte Alert-Hilfe: zeigt Meldungen oben rechts an, fällt auf console zurück
function showAlert(message, type = 'info', timeoutMs = 3000) {
	try {
		let container = document.getElementById('alert-container')
		if (!container) {
			container = document.createElement('div')
			container.id = 'alert-container'
			container.style.position = 'fixed'
			container.style.top = '12px'
			container.style.right = '12px'
			container.style.zIndex = '9999'
			container.style.display = 'flex'
			container.style.flexDirection = 'column'
			container.style.gap = '8px'
			document.body.appendChild(container)
		}
		const el = document.createElement('div')
		el.textContent = String(message ?? '')
		el.style.padding = '8px 12px'
		el.style.borderRadius = '6px'
		el.style.fontSize = '13px'
		el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'
		el.style.background = type === 'error' ? '#ffdddd' : type === 'success' ? '#ddffdd' : '#eef3ff'
		el.style.color = '#222'
		el.style.border = '1px solid ' + (type === 'error' ? '#ff9999' : type === 'success' ? '#99dd99' : '#bcccff')
		container.appendChild(el)
		const timeout = Number.isFinite(timeoutMs) ? timeoutMs : 3000
		if (timeout > 0)
			setTimeout(() => {
				el.remove()
			}, timeout)
	} catch (_) {
		// Fallback
		if (type === 'error') console.error(message)
		else console.log(message)
	}
}
