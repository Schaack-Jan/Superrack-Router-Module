const NUM_RACKS = 64;
const NUM_CHANNELS = 99;

let isMouseDown = false;
let rackMappings = {};

const patchContainer = document.getElementById('patch-matrix-container');
const statusEl = document.getElementById('status');
const loadBtn = document.getElementById('load-btn');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');

function setStatus(connected) {
  if (!statusEl) return;
  statusEl.classList.toggle('connected', connected);
  statusEl.classList.toggle('disconnected', !connected);
  statusEl.textContent = connected ? 'Connected' : 'Disconnected';
}

async function ping() {
  try {
    const res = await fetch('/health');
    if (res.ok) setStatus(true); else setStatus(false);
  } catch {
    setStatus(false);
  }
}

function initPatchMatrix() {
  patchContainer.innerHTML = '';
  const table = document.createElement('div');
  table.className = 'patch-table';
  table.style.gridTemplateColumns = `100px repeat(${NUM_CHANNELS}, 30px)`;

  const emptyHeader = document.createElement('div');
  emptyHeader.className = 'patch-header-cell';
  table.appendChild(emptyHeader);

  for (let c = 1; c <= NUM_CHANNELS; c++) {
    const header = document.createElement('div');
    header.className = 'patch-header-cell';
    header.innerText = c;
    table.appendChild(header);
  }

  for (let r = 1; r <= NUM_RACKS; r++) {
    rackMappings[r] = null;

    const label = document.createElement('div');
    label.className = 'patch-rack-label';
    label.innerText = `Rack ${r}`;
    table.appendChild(label);

    for (let c = 1; c <= NUM_CHANNELS; c++) {
      const cell = document.createElement('div');
      cell.className = 'patch-cell';
      cell.id = `cell-${r}-${c}`;
      const inner = document.createElement('div');
      inner.className = 'patch-cell-inner';
      cell.appendChild(inner);

      cell.addEventListener('click', () => selectChannelForRack(r, c));
      cell.addEventListener('mousedown', () => { isMouseDown = true; selectChannelForRack(r, c); });
      cell.addEventListener('mouseenter', () => { if (isMouseDown) selectChannelForRack(r, c); });

      table.appendChild(cell);
    }
  }

  patchContainer.appendChild(table);
  document.addEventListener('mouseup', () => { isMouseDown = false; });
}

function selectChannelForRack(rack, channel) {
  rackMappings[rack] = channel;
  for (let c = 1; c <= NUM_CHANNELS; c++) {
    const cell = document.getElementById(`cell-${rack}-${c}`);
    if (cell) cell.classList.remove('active');
  }
  const selectedCell = document.getElementById(`cell-${rack}-${channel}`);
  if (selectedCell) selectedCell.classList.add('active');
}

function clearAllMappings() {
  for (let r = 1; r <= NUM_RACKS; r++) {
    rackMappings[r] = null;
    for (let c = 1; c <= NUM_CHANNELS; c++) {
      const cell = document.getElementById(`cell-${r}-${c}`);
      if (cell) cell.classList.remove('active');
    }
  }
}

function exportMappings() {
  const mappings = {};
  for (let r = 1; r <= NUM_RACKS; r++) {
    if (rackMappings[r] !== null) mappings[r] = rackMappings[r];
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
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      clearAllMappings();
      const mappings = data.mappings || {};
      for (const [rack, channel] of Object.entries(mappings)) {
        const r = parseInt(rack, 10);
        const ch = parseInt(channel, 10);
        if (r >= 1 && r <= NUM_RACKS && ch >= 1 && ch <= NUM_CHANNELS) {
          rackMappings[r] = ch;
          const cell = document.getElementById(`cell-${r}-${ch}`);
          if (cell) cell.classList.add('active');
        }
      }
      alert('Mappings importiert.');
    } catch (err) {
      alert('Ungültige Datei: ' + err.message);
    }
  };
  reader.readAsText(file);
}

async function loadFromCompanion() {
  try {
    const res = await fetch('/patch/mappings');
    const data = await res.json();
    clearAllMappings();
    const mappings = data.mappings || {};
    for (const [rack, channel] of Object.entries(mappings)) {
      const r = parseInt(rack, 10);
      const ch = parseInt(channel, 10);
      if (r >= 1 && r <= NUM_RACKS && ch >= 1 && ch <= NUM_CHANNELS) {
        rackMappings[r] = ch;
        const cell = document.getElementById(`cell-${r}-${ch}`);
        if (cell) cell.classList.add('active');
      }
    }
    alert('Aktuelle Config geladen.');
  } catch (err) {
    alert('Fehler beim Laden der Config: ' + err.message);
  }
}

async function saveToCompanion() {
  const mappings = {};
  for (let r = 1; r <= NUM_RACKS; r++) {
    if (rackMappings[r] !== null) mappings[r] = rackMappings[r];
  }
  try {
    const res = await fetch('/patch/anschliessen', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings })
    });
    const data = await res.json();
    alert('Angewendet: ' + (data?.result?.updated ?? 0) + ' Mappings');
  } catch (err) {
    alert('Fehler beim Anwenden: ' + err.message);
  }
}

if (loadBtn) loadBtn.addEventListener('click', loadFromCompanion);
if (saveBtn) saveBtn.addEventListener('click', saveToCompanion);
if (clearBtn) clearBtn.addEventListener('click', clearAllMappings);
if (exportBtn) exportBtn.addEventListener('click', exportMappings);
if (importInput) importInput.addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) importMappings(e.target.files[0]); });

initPatchMatrix();
ping();
loadFromCompanion();
