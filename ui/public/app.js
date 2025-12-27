let NUM_RACKS;
let NUM_CHANNELS;
let EMPTY_MAPPING

let isMouseDown = false;
let rackMappings = {};

const patchContainer = document.getElementById('patch-matrix-container');
const statusEl = document.getElementById('status');
const loadBtn = document.getElementById('load-btn');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');
const importBtn = document.getElementById('import-btn');

function setStatus(connected) {
  if (!statusEl) return;
  statusEl.classList.toggle('connected', connected);
  statusEl.classList.toggle('disconnected', !connected);
  statusEl.textContent = connected ? 'Connected' : 'Disconnected';
}

function initPatchMatrix() {
  fetch('/patch/mappings').then(res => startupPatchMatrix(res));

  setInterval(() => {
    fetch('/health')
      .then(res => res.json())
      .then(data => setStatus((data.status ?? 'disconnected') === 'ok'))
      .catch(() => {});
  }, 10000)
}

async function startupPatchMatrix(res) {
  const data = await res.json();
  setStatus(data?.success ?? false);

  clearAllMappings();
  rackMappings = data.mapping || [];
  NUM_RACKS = data.meta.maxRacks || 0;
  NUM_CHANNELS = data.meta.numChannels || 0;
  EMPTY_MAPPING = data.meta.emptyMapping

  patchContainer.innerHTML = '';
  const table = document.createElement('div');
  table.className = 'patch-table';
  table.style.gridTemplateColumns = `100px repeat(${NUM_CHANNELS}, 30px)`;

  const emptyHeader = document.createElement('div');
  emptyHeader.className = 'patch-header-cell corner-cell';
  table.appendChild(emptyHeader);

  for (let c = 1; c <= NUM_CHANNELS; c++) {
    const header = document.createElement('div');
    header.className = 'patch-header-cell';
    header.innerText = c;
    table.appendChild(header);
  }

  for (let r = 1; r <= NUM_RACKS; r++) {

    const label = document.createElement('div');
    label.className = 'patch-rack-label';
    label.innerText = `Rack ${r}`;
    table.appendChild(label);

    for (let c = 1; c <= NUM_CHANNELS; c++) {
      const cell = document.createElement('div');
      cell.className = 'patch-cell';
      cell.setAttribute('data-rack', r);
      cell.setAttribute('data-channel', c);
      if (rackMappings[r] && rackMappings[r].value === c) {
        // initial successful mapping from backend -> mark success
        cell.classList.add('success');
      }

      const inner = document.createElement('div');
      inner.className = 'patch-cell-inner';
      cell.appendChild(inner);

      cell.addEventListener('click', () => selectChannelForRack(r, c));
      table.appendChild(cell);
    }
  }

  patchContainer.appendChild(table);
  document.addEventListener('mouseup', () => { isMouseDown = false; });
}

function selectChannelForRack(rack, channel) {
    // Ensure only one channel per rack and only one rack per channel
    for (let r = 1; r < rackMappings.length; r++) {
        if (r !== rack && rackMappings[r]?.value === channel) {
            rackMappings[r].value = null;
            // Deactivate the cell in the DOM
            const cell = document.querySelector(`div[data-rack="${r}"][data-channel="${channel}"]`);
            if (cell) {
              cell.classList.remove('active');
              cell.classList.remove('success');
              cell.classList.remove('pending');
            }
        }
    }

    const cells = document.querySelectorAll(`div[data-rack="${rack}"]`);
    cells.forEach(cell => { cell.classList.remove('active'); cell.classList.remove('success'); cell.classList.remove('pending'); });

    const clickedCell = document.querySelector(`div[data-rack="${rack}"][data-channel="${channel}"]`);

    // mark pending immediately
    if (clickedCell) clickedCell.classList.add('pending');

    const previousValue = rackMappings[rack]?.value ?? null;

    // toggle selection
    if (previousValue === channel) {
        rackMappings[rack].value = null;
    } else {
        rackMappings[rack].value = channel;
    }

    // Persist immediately to backend and update UI on response
    persistMappingUpdate(rack, previousValue).catch(() => {
        // on error, revert UI and value
        rackMappings[rack].value = previousValue;
        if (clickedCell) {
          clickedCell.classList.remove('pending');
          if (previousValue && previousValue !== channel) {
            const prevCell = document.querySelector(`div[data-rack="${rack}"][data-channel="${previousValue}"]`);
            if (prevCell) prevCell.classList.add('success');
          }
        }
        showAlert('Fehler beim Patchen – Änderung wurde zurückgesetzt', 'error');
    });
}

async function persistMappingUpdate(changedRackId, previousValue) {
  try {
    const res = await fetch('/patch/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapping: rackMappings })
    });
    const data = await res.json();
    if (!(data && data.success !== false)) {
      throw new Error('Backend meldet Fehler');
    }

    // success: mark the selected cell as success, clear pending
    const newValue = rackMappings[changedRackId]?.value ?? null;
    // clear all states for rack
    const rackCells = document.querySelectorAll(`div[data-rack="${changedRackId}"]`);
    rackCells.forEach(cell => { cell.classList.remove('active'); cell.classList.remove('pending'); cell.classList.remove('success'); });

    if (newValue != null) {
      const successCell = document.querySelector(`div[data-rack="${changedRackId}"][data-channel="${newValue}"]`);
      if (successCell) successCell.classList.add('success');
    }

    // Also ensure uniqueness UI for any other racks that were auto-cleared above
    for (let r = 1; r < rackMappings.length; r++) {
      if (r === changedRackId) continue;
      const val = rackMappings[r]?.value;
      if (val == null) {
        const cleared = document.querySelectorAll(`div[data-rack="${r}"]`);
        cleared.forEach(c => { c.classList.remove('active'); c.classList.remove('pending'); c.classList.remove('success'); });
      }
    }

    // No success alert here (only import success should alert)
  } catch (err) {
    // keep error alert
    showAlert('Fehler beim Patchen – Änderung wurde zurückgesetzt', 'error');
    throw err;
  }
}

function clearAllMappings() {
  rackMappings = EMPTY_MAPPING
  let parent = document.getElementById('patch-matrix-container')
  const activeCells = parent.querySelectorAll('[data-rack][data-channel].active, [data-rack][data-channel].pending, [data-rack][data-channel].success')
  for (const cell of activeCells) {
    cell.classList.remove('active')
    cell.classList.remove('pending')
    cell.classList.remove('success')
  }
}

function exportMappings() {
  // Erzeuge flache Struktur { mappings: { rackId: channel } }
  const mappings = {};
  if (Array.isArray(rackMappings)) {
    for (const map of rackMappings) {
      if (!map || map.value == null) continue;
      mappings[map.id] = map.value;
    }
  }
  const blob = new Blob([JSON.stringify({ mappings }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mappings.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importMappings(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      clearAllMappings();
      const pendingCells = [];
      // Unterstütze beide Formate: { mappings: { rack: channel } } und { rackMappings: [...]} oder { mapping: [...] }
      const mappingsObj = data.mappings || null;
      const mappingArr = data.rackMappings || data.mapping || null;

      // reset rackMappings to empty mapping clone if available
      if (Array.isArray(EMPTY_MAPPING)) {
        rackMappings = EMPTY_MAPPING.map(m => m ? { id: m.id, value: null } : m);
      } else {
        rackMappings = [];
      }

      if (mappingsObj && typeof mappingsObj === 'object') {
        for (const [rack, channel] of Object.entries(mappingsObj)) {
          const r = parseInt(rack, 10);
          const ch = parseInt(channel, 10);
          if (Number.isInteger(r) && Number.isInteger(ch) && r >= 1 && r <= NUM_RACKS && ch >= 1 && ch <= NUM_CHANNELS) {
            if (!rackMappings[r]) rackMappings[r] = { id: r, value: null };
            rackMappings[r].value = ch;
            const cell = document.querySelector(`div[data-rack="${r}"][data-channel="${ch}"]`);
            if (cell) { cell.classList.add('pending'); pendingCells.push(cell); }
          }
        }
      } else if (Array.isArray(mappingArr)) {
        for (const map of mappingArr) {
          if (!map) continue;
          const r = parseInt(map.id, 10);
          const ch = parseInt(map.value, 10);
          if (Number.isInteger(r) && Number.isInteger(ch) && r >= 1 && r <= NUM_RACKS && ch >= 1 && ch <= NUM_CHANNELS) {
            if (!rackMappings[r]) rackMappings[r] = { id: r, value: null };
            rackMappings[r].value = ch;
            const cell = document.querySelector(`div[data-rack="${r}"][data-channel="${ch}"]`);
            if (cell) { cell.classList.add('pending'); pendingCells.push(cell); }
          }
        }
      }

      // Persist all imported mappings in one request
      const res = await fetch('/patch/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapping: rackMappings })
      });
      const resp = await res.json();
      if (!(resp && resp.success !== false)) {
        throw new Error('Backend meldet Fehler beim Import-Speichern');
      }

      // mark all pending cells as success
      for (const cell of pendingCells) {
        cell.classList.remove('pending');
        cell.classList.add('success');
      }
    } catch (err) {
      // rollback UI states
      const parent = document.getElementById('patch-matrix-container');
      const pending = parent.querySelectorAll('.patch-cell.pending');
      pending.forEach(c => c.classList.remove('pending'));
      showAlert(`Mapping import failed: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file);
}

async function loadFromCompanion() {
  try {
    const res = await fetch('/patch/mappings');
    const data = await res.json();
    clearAllMappings();
    let mapping = data.mapping || [];
    for (const map of mapping) {
        if (!map) continue
        const cell = document.querySelector(`div[data-rack="${map.id}"][data-channel="${map.value}"]`);
        if (cell) cell.classList.add('success');
    }

    // no success alert here
  } catch (err) {
    showAlert(`Error loading config: ${err.message}`, 'error')
  }
}

function showAlert(message, type = 'success') {
    const container = document.getElementById('alert-container')
    container.style.display = 'block'

    const alertType = type === 'error' || type === 'danger' ? 'error' : 'success'
    container.innerHTML = `
    <div class="custom-alert custom-alert-${alertType}">
      ${message}
      <button class="close-btn" onclick="this.parentElement.parentElement.style.display='none';this.parentElement.parentElement.innerHTML='';">&times;</button>
    </div>
  `
    container.style.display = 'block'

    setTimeout(() => {
        container.style.display = 'none'
        container.innerHTML = ''
    }, 5000)
}

async function saveToCompanion() {
  try {
    const res = await fetch('/patch/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapping: rackMappings })
    });
    await res.json();
  } catch (err) {
    showAlert(`Error saving config: ${err.message}`, 'error')
  }
}

if (loadBtn) loadBtn.addEventListener('click', loadFromCompanion);
if (saveBtn) saveBtn.addEventListener('click', saveToCompanion);
if (clearBtn) clearBtn.addEventListener('click', clearAllMappings);
if (exportBtn) exportBtn.addEventListener('click', exportMappings);
if (importInput) importInput.addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) importMappings(e.target.files[0]); });
if (importBtn) importBtn.addEventListener('click', () => importInput && importInput.click());

initPatchMatrix();
