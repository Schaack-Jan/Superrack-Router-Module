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

function setStatus(connected) {
  if (!statusEl) return;
  statusEl.classList.toggle('connected', connected);
  statusEl.classList.toggle('disconnected', !connected);
  statusEl.textContent = connected ? 'Connected' : 'Disconnected';
}

function initPatchMatrix() {
  fetch('/patch/mappings').then(res => startupPatchMatrix(res));

  setInterval(() => {
    fetch('/health').then(res => res.json()).then(data => setStatus((data.status ?? 'disconnected') === 'ok'));
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
  emptyHeader.className = 'patch-header-cell';
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
        cell.classList.add('active');
      }

      const inner = document.createElement('div');
      inner.className = 'patch-cell-inner';
      cell.appendChild(inner);

      cell.addEventListener('click', () => selectChannelForRack(r, c));
      /*cell.addEventListener('mousedown', () => { isMouseDown = true; selectChannelForRack(r, c); });
      cell.addEventListener('mouseenter', () => { if (isMouseDown) selectChannelForRack(r, c); });*/

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
            if (cell) cell.classList.remove('active');
        }
    }

    const cells = document.querySelectorAll(`div[data-rack="${rack}"]`);
    cells.forEach(cell => cell.classList.remove('active'));

    if (rackMappings[rack].value === channel) {
        rackMappings[rack].value = null;
    } else {
        rackMappings[rack].value = channel;
        const clickedCell = document.querySelector(`div[data-rack="${rack}"][data-channel="${channel}"]`);
        if (clickedCell) clickedCell.classList.add('active');
    }
}

function clearAllMappings() {
  rackMappings = EMPTY_MAPPING
  let parent = document.getElementById('patch-matrix-container')
  const activeCells = parent.querySelectorAll('[data-rack][data-channel].active')
  for (const cell of activeCells) {
    cell.classList.remove('active')
  }
}

function exportMappings() {
  const blob = new Blob([JSON.stringify({ rackMappings }, null, 2)], { type: 'application/json' });
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
          rackMappings[r].value = ch;
          const cell = document.querySelector(`div[data-rack="${r}"][data-channel="${ch}"]`);
          if (cell) cell.classList.add('active');
        }
      }
      showAlert(`Mapping imported successfully.`)
    } catch (err) {
      showAlert(`Mapping import failed: ${err.message}`, 'error')
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
        if (cell) cell.classList.add('active');
    }

    showAlert('Current config loaded from Companion.')
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
    const data = await res.json();
    showAlert('Mapping saved successfully.')
  } catch (err) {
    showAlert(`Error saving config: ${err.message}`, 'error')
  }
}

if (loadBtn) loadBtn.addEventListener('click', loadFromCompanion);
if (saveBtn) saveBtn.addEventListener('click', saveToCompanion);
if (clearBtn) clearBtn.addEventListener('click', clearAllMappings);
if (exportBtn) exportBtn.addEventListener('click', exportMappings);
if (importInput) importInput.addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) importMappings(e.target.files[0]); });

initPatchMatrix();
