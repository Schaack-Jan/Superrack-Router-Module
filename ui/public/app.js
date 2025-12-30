let NUM_X
let NUM_Y
let EMPTY_MAPPING
let isMouseDown = false

let MAPPING = {}
let cellRefs = [] // 2D matrix of cells [y][x]            : VORHER : cellRefs[rack][channels]
let yCells = [] // flat list per y                        : VORHER : rackCells
let xToY = [] // maps x -> y id or null                   : VORHER : channelToRack

const statusEl = document.getElementById('status')

const homeBtn = document.getElementById('home-btn')
const loadBtn = document.getElementById('load-btn')
const clearBtn = document.getElementById('clear-btn')
const exportBtn = document.getElementById('export-btn')
const importInput = document.getElementById('import-input')
const importBtn = document.getElementById('import-btn')

const setStatus = (connected) => {
    if (!statusEl) return
    statusEl.classList.toggle('connected', connected)
    statusEl.classList.toggle('disconnected', !connected)
    statusEl.textContent = connected ? 'Connected' : 'Disconnected'
}

const checkHealth = () => {
    setInterval(() => {
        fetch('/health')
            .then((res) => res.json())
            .then((data) => setStatus((data.status ?? 'disconnected') === 'ok'))
            .catch(() => {})
    }, 10000)
}

const exportMappings = (namePrefix) => {
    if (!MAPPING || MAPPING === {}) return
    const mappings = {}
    if (Array.isArray(MAPPING)) {
        for (const map of MAPPING) {
            if (!map || map.value == null) continue
            mappings[map.id] = map.value
        }
    }
    const blob = new Blob([JSON.stringify({ MAPPING }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (!namePrefix ? '' : namePrefix + '-') + 'mappings.json'
    a.click()
    URL.revokeObjectURL(url)
    a.remove()
}

function importMappings(file) {
    const reader = new FileReader()
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result)
            clearAllMappings()
            const pendingCells = []
            const mappingsObj = data.mappings || null
            const mappingArr = data.MAPPING || data.mapping || null

            if (Array.isArray(EMPTY_MAPPING)) {
                MAPPING = EMPTY_MAPPING.map((m) => (m ? { id: m.id, value: null } : m))
            } else {
                MAPPING = []
            }
            xToY = new Array(NUM_X + 1).fill(null)

            const assignAndMark = (r, ch) => {
                if (!MAPPING[r]) MAPPING[r] = { id: r, value: null }
                // Clear previous mapping per rack
                const oldCh = MAPPING[r].value
                if (oldCh != null) {
                    const oldCell = cellRefs[r]?.[oldCh]
                    if (oldCell) oldCell.classList.remove('active', 'success', 'pending')
                    xToY[oldCh] = null
                }
                MAPPING[r].value = ch
                xToY[ch] = r
                const cell = cellRefs[r]?.[ch]
                if (cell) {
                    cell.classList.add('pending')
                    pendingCells.push(cell)
                }
            }

            if (mappingsObj && typeof mappingsObj === 'object') {
                for (const [rack, x] of Object.entries(mappingsObj)) {
                    const r = parseInt(rack, 10)
                    const ch = parseInt(x, 10)
                    if (
                        Number.isInteger(r) &&
                        Number.isInteger(ch) &&
                        r >= 1 &&
                        r <= NUM_Y &&
                        ch >= 1 &&
                        ch <= NUM_X
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
                        r <= NUM_Y &&
                        ch >= 1 &&
                        ch <= NUM_X
                    ) {
                        assignAndMark(r, ch)
                    }
                }
            }

            const res = await sendMatrixToServer()
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
            for (let r = 1; r <= NUM_Y; r++) {
                const rc = yCells[r] || []
                for (const c of rc) c.classList.remove('pending')
            }
            showAlert(`Mapping import failed: ${err.message}`, 'error')
        }
    }
    reader.readAsText(file)
}

const clearAllMappings = () => {
    MAPPING = EMPTY_MAPPING
    const activeCells = PATCH_CONTAINER.querySelectorAll(
        '[data-y][data-x].active, [data-y][data-x].pending, [data-y][data-x].success',
    )
    for (const cell of activeCells) {
        cell.classList.remove('active', 'pending', 'success')
    }
}

const loadFromCompanion = async () => {
    try {
        const res = await fetch(MAPPING_URL)
        const data = await res.json()
        clearAllMappings()
        let mapping = data.mapping || []
        for (const map of mapping) {
            if (!map) continue
            const cell = cellRefs[map.id]?.[map.value]
            if (cell) cell.classList.add('success')
            // keep xToY in sync
            if (Number.isInteger(map.id) && Number.isInteger(map.value)) {
                xToY[map.value] = map.id
                if (!yCells[map.id]) yCells[map.id] = { id: map.id, value: null }
                yCells[map.id].value = map.value
            }
        }
        // no success alert here
    } catch (err) {
        showAlert(`Error loading config: ${err.message}`, 'error')
    }
}

const showAlert = (message, type = 'info', timeoutMs = 3000) => {
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

const selectXForY = (y, x) => {
    const clickedCell = cellRefs[y]?.[x]
    if (clickedCell) clickedCell.classList.add('pending')

    const prevX = MAPPING[y]?.value ?? null
    const prevXForY = xToY[x] ?? null

    // If another y uses this x, clear only that cell
    if (prevXForY && prevXForY !== y) {
        const otherCell = cellRefs[prevXForY]?.[x]
        if (otherCell) otherCell.classList.remove('active', 'success', 'pending')
        MAPPING[prevXForY].value = null
        xToY[x] = null
    }

    // Update mapping for current y
    if (prevX === x) {
        MAPPING[y].value = null
        xToY[x] = null
    } else {
        // Clear previous cell of this y, if any
        if (prevX != null) {
            const prevCell = cellRefs[y]?.[prevX]
            if (prevCell) prevCell.classList.remove('active', 'success', 'pending')
            xToY[prevX] = null
        }
        MAPPING[y].value = x
        xToY[x] = y
    }

    persistMappingUpdate(y, prevX).catch(() => {
        // rollback mapping and UI
        if (prevXForY && prevXForY !== y) {
            // restore other y's cell
            const otherCell = cellRefs[prevXForY]?.[x]
            if (otherCell) otherCell.classList.add('success')
            MAPPING[prevXForY].value = x
            xToY[x] = prevXForY
        }

        MAPPING[y].value = prevX
        if (clickedCell) clickedCell.classList.remove('pending')
        if (prevX != null) {
            const prevCell = cellRefs[y]?.[prevX]
            if (prevCell) prevCell.classList.add('success')
            xToY[prevX] = y
        } else {
            // ensure no residual state on current y/x
            const curCell = cellRefs[y]?.[x]
            if (curCell) curCell.classList.remove('active', 'success', 'pending')
            xToY[x] = prevXForY ?? null
        }
        showAlert('Error while patching – change has been reverted', 'error')
    })
}

const persistMappingUpdate = async (changeYId, previousValue) => {
    try {
        const res = await sendMatrixToServer()
        const data = await res.json()
        if (!(data && data.success !== false)) {
            throw new Error('Backend reports an error during patch update')
        }

        const newValue = MAPPING[changeYId]?.value ?? null
        // Only update the two relevant cells: previous and new
        if (previousValue != null) {
            const prevCell = cellRefs[changeYId]?.[previousValue]
            if (prevCell) prevCell.classList.remove('active', 'pending', 'success')
        }
        if (newValue != null) {
            const successCell = cellRefs[changeYId]?.[newValue]
            if (successCell) {
                successCell.classList.remove('pending')
                successCell.classList.add('success')
            }
        }
    } catch (err) {
        showAlert('Error while patching – change has been reverted', 'error')
        throw err
    }
}

const startupPatchMatrix = async (res, yLabel) => {
    let data
    try {
        data = await res.json()
    } catch (_) {
        data = {}
    }
    setStatus(Boolean(data && (data.success ?? true)))
    if (!PATCH_CONTAINER) {
        console.warn('patchContainer not found')
        return
    }

    // Read meta with safe defaults
    NUM_X = Number(data?.meta?.numX) || 0
    NUM_Y = Number(data?.meta?.numY) || 0
    EMPTY_MAPPING = Array.isArray(data?.meta?.emptyMapping) ? data.meta.emptyMapping : null

    // Initialize mappings robustly
    const incoming = Array.isArray(data?.mapping) ? data.mapping : []
    if (NUM_Y <= 0 || NUM_X <= 0) {
        // try to infer from incoming mapping
        for (const m of incoming) {
            if (!m) continue
            NUM_X = Math.max(NUM_X, Number(m.id) || 0)
            NUM_Y = Math.max(NUM_Y, Number(m.value) || 0)
            NUM_Y = Math.max(NUM_Y, Number(m.id) || 0)
            NUM_X = Math.max(NUM_X, Number(m.value) || 0)
        }
    }
    if (NUM_Y <= 0 || NUM_X <= 0) {
        console.warn('No x/y meta available; cannot build matrix')
        PATCH_CONTAINER.innerHTML = '<div style="padding:8px">Keine Metadaten für X/Y gefunden.</div>'
        return
    }

    // Build MAPPING array of length NUM_Y+1
    MAPPING = new Array(NUM_Y + 1)
    for (let yCell = 1; yCell <= NUM_Y; yCell++) {
        MAPPING[yCell] = { id: yCell, value: null }
    }
    for (const m of incoming) {
        if (!m) continue
        const r = Number(m.id)
        const v = Number(m.value)
        if (r >= 1 && r <= NUM_Y && v >= 1 && v <= NUM_X) {
            MAPPING[r].value = v
        }
    }

    // Build quick lookup for x -> y
    xToY = new Array(NUM_X + 1).fill(null)
    for (let r = 1; r <= NUM_Y; r++) {
        const v = MAPPING[r].value
        if (v != null) xToY[v] = r
    }

    // Render
    PATCH_CONTAINER.innerHTML = ''
    const table = document.createElement('div')
    table.className = 'patch-table'
    table.style.gridTemplateColumns = `100px repeat(${NUM_X}, 30px)`

    const emptyHeader = document.createElement('div')
    emptyHeader.className = 'patch-header-cell corner-cell'
    table.appendChild(emptyHeader)

    for (let xCell = 1; xCell <= NUM_X; xCell++) {
        const header = document.createElement('div')
        header.className = 'patch-header-cell'
        header.innerText = `${xCell}`
        table.appendChild(header)
    }

    cellRefs = new Array(NUM_Y + 1)
    yCells = new Array(NUM_Y + 1)

    for (let y = 1; y <= NUM_Y; y++) {
        const label = document.createElement('div')
        label.className = 'patch-y-label'
        label.innerText = `${yLabel} ${y}`
        table.appendChild(label)

        cellRefs[y] = new Array(NUM_X + 1)
        yCells[y] = []

        for (let x = 1; x <= NUM_X; x++) {
            const cell = document.createElement('div')
            cell.className = 'patch-cell'
            cell.setAttribute('data-y', `${y}`)
            cell.setAttribute('data-x', `${x}`)
            if (MAPPING[y].value === x) {
                cell.classList.add('success')
            }
            const inner = document.createElement('div')
            inner.className = 'patch-cell-inner'
            cell.appendChild(inner)
            cell.addEventListener('click', () => selectXForY(y, x))
            table.appendChild(cell)
            cellRefs[y][x] = cell
            yCells[y].push(cell)
        }
    }

    PATCH_CONTAINER.appendChild(table)
    document.addEventListener('mouseup', () => {
        isMouseDown = false
    })
}

const sendMatrixToServer = async () => {
    return await fetch(UPDATE_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({mapping: MAPPING}),
    })
}

// Attach UI event listeners if elements exist
if (typeof window !== 'undefined') {
    if (homeBtn) homeBtn.addEventListener('click', () => window.location.href = '/')
    if (loadBtn) loadBtn.addEventListener('click', loadFromCompanion)
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            clearAllMappings()

            const res = await sendMatrixToServer()
            const resp = await res.json()
            if (!(resp && resp.success !== false)) {
                showAlert(`Clearing patch failed`, 'error')
            }
        })
    }
    if (exportBtn) exportBtn.addEventListener('click', () => exportMappings(EXPORT_NAME))
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