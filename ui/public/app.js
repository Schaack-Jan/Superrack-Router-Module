let NUM_RACKS;
let NUM_CHANNELS;
let EMPTY_MAPPING

let isMouseDown = false;
let rackMappings = {};
let cellRefs = []; // 2D matrix of cells [rack][channel]
let rackCells = []; // flat list per rack

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

  // Ensure container exists
  const container = document.getElementById('patch-matrix-container') || patchContainer;
  if (!container) {
    console.warn('patch-matrix-container not found');
    return;
  }

  clearAllMappings();
  rackMappings = data.mapping || [];
  NUM_RACKS = data.meta.maxRacks || 0;
  NUM_CHANNELS = data.meta.numChannels || 0;
  EMPTY_MAPPING = data.meta.emptyMapping

  container.innerHTML = '';
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

  cellRefs = new Array(NUM_RACKS + 1);
  rackCells = new Array(NUM_RACKS + 1);

  for (let r = 1; r <= NUM_RACKS; r++) {

    const label = document.createElement('div');
    label.className = 'patch-rack-label';
    label.innerText = `Rack ${r}`;
    table.appendChild(label);

    cellRefs[r] = new Array(NUM_CHANNELS + 1);
    rackCells[r] = [];

    for (let c = 1; c <= NUM_CHANNELS; c++) {
      const cell = document.createElement('div');
      cell.className = 'patch-cell';
      cell.setAttribute('data-rack', r);
      cell.setAttribute('data-channel', c);
      if (rackMappings[r] && rackMappings[r].value === c) {
        cell.classList.add('success');
      }

      const inner = document.createElement('div');
      inner.className = 'patch-cell-inner';
      cell.appendChild(inner);

      cell.addEventListener('click', () => selectChannelForRack(r, c));
      table.appendChild(cell);

      cellRefs[r][c] = cell;
      rackCells[r].push(cell);
    }
  }

  container.appendChild(table);
  document.addEventListener('mouseup', () => { isMouseDown = false; });
}

// Attach UI event listeners if elements exist
if (typeof window !== 'undefined') {
  if (loadBtn) loadBtn.addEventListener('click', loadFromCompanion);
  if (saveBtn) saveBtn.addEventListener('click', async () => { try { await saveToCompanion(); } catch(_){} });
  if (clearBtn) clearBtn.addEventListener('click', clearAllMappings);
  if (exportBtn) exportBtn.addEventListener('click', exportMappings);
  if (importInput) importInput.addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) importMappings(e.target.files[0]); });
  if (importBtn) importBtn.addEventListener('click', () => importInput && importInput.click());

  // Init after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initPatchMatrix());
  } else {
    initPatchMatrix();
  }
}

function selectChannelForRack(rack, channel) {
  // Ensure uniqueness: only one rack per channel
  for (let r = 1; r < rackMappings.length; r++) {
    if (r !== rack && rackMappings[r]?.value === channel) {
      const prevCell = cellRefs[r]?.[channel];
      if (prevCell) {
        prevCell.classList.remove('active','success','pending');
      }
      rackMappings[r].value = null;
    }
  }

  // Clear states for this rack quickly
  const cells = rackCells[rack] || [];
  for (const cell of cells) {
    cell.classList.remove('active','success','pending');
  }

  const clickedCell = cellRefs[rack]?.[channel];
  if (clickedCell) clickedCell.classList.add('pending');

  const previousValue = rackMappings[rack]?.value ?? null;

  // toggle selection
  if (previousValue === channel) {
    rackMappings[rack].value = null;
  } else {
    rackMappings[rack].value = channel;
  }

  persistMappingUpdate(rack, previousValue).catch(() => {
    rackMappings[rack].value = previousValue;
    if (clickedCell) {
      clickedCell.classList.remove('pending');
      if (previousValue && previousValue !== channel) {
        const prevCell = cellRefs[rack]?.[previousValue];
        if (prevCell) prevCell.classList.add('success');
      }
    }
    showAlert('Fehler beim Patchen – Änderung wurde zurückgesetzt', 'error');
  });
}

async function persistMappingUpdate(changedRackId, previousValue) {
  try {
    const res = await fetch('/patch/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapping: rackMappings })
    });
    const data = await res.json();
    if (!(data && data.success !== false)) {
      throw new Error('Backend meldet Fehler');
    }

    const newValue = rackMappings[changedRackId]?.value ?? null;
    const cells = rackCells[changedRackId] || [];
    for (const cell of cells) {
      cell.classList.remove('active','pending','success');
    }

    if (newValue != null) {
      const successCell = cellRefs[changedRackId]?.[newValue];
      if (successCell) successCell.classList.add('success');
    }

    // Also clear other racks that became empty
    for (let r = 1; r < rackMappings.length; r++) {
      if (r === changedRackId) continue;
      const val = rackMappings[r]?.value;
      if (val == null) {
        const rc = rackCells[r] || [];
        for (const c of rc) c.classList.remove('active','pending','success');
      }
    }
  } catch (err) {
    showAlert('Fehler beim Patchen – Änderung wurde zurückgesetzt', 'error');
    throw err;
  }
}

function clearAllMappings() {
  rackMappings = EMPTY_MAPPING
  const parent = document.getElementById('patch-matrix-container')
  const activeCells = parent.querySelectorAll('[data-rack][data-channel].active, [data-rack][data-channel].pending, [data-rack][data-channel].success')
  for (const cell of activeCells) {
    cell.classList.remove('active','pending','success')
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
      const mappingsObj = data.mappings || null;
      const mappingArr = data.rackMappings || data.mapping || null;

      if (Array.isArray(EMPTY_MAPPING)) {
        rackMappings = EMPTY_MAPPING.map(m => m ? { id: m.id, value: null } : m);
      } else {
        rackMappings = [];
      }

      const assignAndMark = (r, ch) => {
        if (!rackMappings[r]) rackMappings[r] = { id: r, value: null };
        rackMappings[r].value = ch;
        const cell = cellRefs[r]?.[ch];
        if (cell) { cell.classList.add('pending'); pendingCells.push(cell); }
      }

      if (mappingsObj && typeof mappingsObj === 'object') {
        for (const [rack, channel] of Object.entries(mappingsObj)) {
          const r = parseInt(rack, 10);
          const ch = parseInt(channel, 10);
          if (Number.isInteger(r) && Number.isInteger(ch) && r >= 1 && r <= NUM_RACKS && ch >= 1 && ch <= NUM_CHANNELS) {
            assignAndMark(r, ch);
          }
        }
      } else if (Array.isArray(mappingArr)) {
        for (const map of mappingArr) {
          if (!map) continue;
          const r = parseInt(map.id, 10);
          const ch = parseInt(map.value, 10);
          if (Number.isInteger(r) && Number.isInteger(ch) && r >= 1 && r <= NUM_RACKS && ch >= 1 && ch <= NUM_CHANNELS) {
            assignAndMark(r, ch);
          }
        }
      }

      const res = await fetch('/patch/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapping: rackMappings })
      });
      const resp = await res.json();
      if (!(resp && resp.success !== false)) {
        throw new Error('Backend meldet Fehler beim Import-Speichern');
      }

      for (const cell of pendingCells) {
        cell.classList.remove('pending');
        cell.classList.add('success');
      }

      showAlert('Mapping imported successfully.');
    } catch (err) {
      for (let r = 1; r <= NUM_RACKS; r++) {
        const rc = rackCells[r] || [];
        for (const c of rc) c.classList.remove('pending');
      }
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
      if (!map) continue;
      const cell = cellRefs[map.id]?.[map.value];
      if (cell) cell.classList.add('success');
    }
    // no success alert here
  } catch (err) {
    showAlert(`Error loading config: ${err.message}`, 'error');
  }
}
