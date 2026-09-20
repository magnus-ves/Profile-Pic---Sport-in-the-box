'use strict';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  settings: null,
  athletes: [],
  selectedAthleteId: null,
  searchTerm: '',
  onlyNotPhotographed: false,
  videoDevices: [],
  stream: null,
  crop: { cx: 0.5, cy: 0.5, size: 0.6 }, // relative to displayed video rect (0..1)
  zoom: 100,
  dragging: false,
  dragStart: null,
  replaceImageEl: null,
  animationHandle: null,
  lastDisplayFrameSentAt: 0
};

const FILENAME_FORMATS = {
  country_license: { label: '[country_short]_[license]', needs: ['country', 'license'] },
  country_id: { label: '[country_short]_[id]', needs: ['country', 'athleteId'] },
  club_name: { label: '[club_name]_[name]', needs: ['club', 'name'] },
  license: { label: '[license]', needs: ['license'] },
  id: { label: '[id]', needs: ['athleteId'] }
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function uuid() {
  return 'a-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function underscored(value) {
  return (value || '').toString().trim().replace(/\s+/g, '_');
}

function fieldValue(athlete, field) {
  return athlete[field] || '';
}

function buildFilename(athlete, formatKey) {
  const format = FILENAME_FORMATS[formatKey] || FILENAME_FORMATS.country_license;
  const missing = format.needs.filter((f) => !fieldValue(athlete, f));
  let base = '';
  switch (formatKey) {
    case 'country_license':
      base = `${underscored(athlete.country)}_${underscored(athlete.license)}`;
      break;
    case 'country_id':
      base = `${underscored(athlete.country)}_${underscored(athlete.athleteId)}`;
      break;
    case 'club_name':
      base = `${underscored(athlete.club)}_${underscored(athlete.name)}`;
      break;
    case 'license':
      base = underscored(athlete.license);
      break;
    case 'id':
      base = underscored(athlete.athleteId);
      break;
    default:
      base = underscored(athlete.name);
  }
  return { fileName: `${base}.png`, missing };
}

function fieldLabel(field) {
  return { country: 'Land', license: 'Lisens', athleteId: 'ID', club: 'Klubb', name: 'Navn' }[field] || field;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------
const HEADER_KEYWORDS = {
  navn: 'name', name: 'name',
  land: 'country', country: 'country',
  klubb: 'club', club: 'club',
  lisens: 'license', license: 'license',
  id: 'athleteId'
};

function detectDelimiter(line) {
  const counts = { ',': (line.match(/,/g) || []).length, ';': (line.match(/;/g) || []).length, '\t': (line.match(/\t/g) || []).length };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines[0]);
  const rows = lines.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, '')));

  let headerMap = null;
  const firstRowLower = rows[0].map((c) => c.toLowerCase());
  const matches = firstRowLower.filter((c) => HEADER_KEYWORDS[c]).length;
  let dataRows = rows;
  if (matches >= 2) {
    headerMap = firstRowLower.map((c) => HEADER_KEYWORDS[c] || null);
    dataRows = rows.slice(1);
  } else {
    headerMap = ['name', 'country', 'club', 'license', 'athleteId'];
  }

  const result = [];
  for (const row of dataRows) {
    if (row.every((c) => !c)) continue;
    const athlete = { id: uuid(), name: '', country: '', club: '', license: '', athleteId: '', photographed: false, lastPhotoAt: null };
    row.forEach((cell, idx) => {
      const field = headerMap[idx];
      if (field) athlete[field] = cell;
    });
    if (athlete.name || athlete.license || athlete.athleteId) result.push(athlete);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
async function loadAll() {
  state.settings = await window.bassengfoto.settings.load();
  state.athletes = await window.bassengfoto.athletes.load();
  applyTheme(state.settings.theme);
}

async function saveSettings() {
  await window.bassengfoto.settings.save(state.settings);
}

async function saveAthletes() {
  await window.bassengfoto.athletes.save(state.athletes);
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
function applyTheme(theme) {
  const app = document.getElementById('app');
  app.classList.remove('theme-light', 'theme-dark');
  app.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
  document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  const lightRadio = document.getElementById('theme-light-radio');
  const darkRadio = document.getElementById('theme-dark-radio');
  if (lightRadio && darkRadio) {
    lightRadio.checked = theme !== 'dark';
    darkRadio.checked = theme === 'dark';
  }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ---------------------------------------------------------------------------
// Athlete list rendering
// ---------------------------------------------------------------------------
function renderAthleteList() {
  const list = document.getElementById('athlete-list');
  list.innerHTML = '';
  const term = state.searchTerm.toLowerCase();
  const filtered = state.athletes.filter((a) => {
    if (state.onlyNotPhotographed && a.photographed) return false;
    if (!term) return true;
    return [a.name, a.country, a.club, a.license, a.athleteId].some((v) => (v || '').toLowerCase().includes(term));
  });

  for (const athlete of filtered) {
    const li = document.createElement('li');
    li.className = 'athlete-item' + (athlete.id === state.selectedAthleteId ? ' selected' : '');
    li.dataset.id = athlete.id;

    const name = document.createElement('div');
    name.className = 'athlete-name';
    name.textContent = athlete.name || '(uten navn)';

    const sub = document.createElement('div');
    sub.className = 'athlete-sub';
    sub.textContent = [athlete.country, athlete.club].filter(Boolean).join(' · ');

    const statusRow = document.createElement('div');
    statusRow.className = 'status-row';
    const dot = document.createElement('span');
    dot.className = 'status-dot' + (athlete.photographed ? ' done' : '');
    const statusText = document.createElement('span');
    statusText.textContent = athlete.photographed
      ? `Fotografert ${new Date(athlete.lastPhotoAt).toLocaleTimeString('no-NO')}`
      : 'Ikke fotografert';
    statusRow.append(dot, statusText);

    li.append(name, sub, statusRow);
    li.addEventListener('click', () => selectAthlete(athlete.id));
    list.appendChild(li);
  }

  document.getElementById('athlete-count').textContent = `${filtered.length} av ${state.athletes.length} utøvere`;
}

function selectAthlete(id) {
  state.selectedAthleteId = id;
  renderAthleteList();
  updateFilenamePreview();
}

function getSelectedAthlete() {
  return state.athletes.find((a) => a.id === state.selectedAthleteId) || null;
}

function updateFilenamePreview() {
  const athlete = getSelectedAthlete();
  const nameEl = document.getElementById('selected-athlete-name');
  const previewEl = document.getElementById('filename-preview');
  const warningEl = document.getElementById('missing-field-warning');

  if (!athlete) {
    nameEl.textContent = 'Ingen utøver valgt';
    previewEl.textContent = '';
    warningEl.classList.add('hidden');
    return;
  }

  nameEl.textContent = athlete.name || '(uten navn)';
  const { fileName, missing } = buildFilename(athlete, state.settings.filenameFormat);
  previewEl.textContent = fileName;
  if (missing.length > 0) {
    warningEl.textContent = `⚠ Mangler felt for valgt filnavn-format: ${missing.map(fieldLabel).join(', ')}`;
    warningEl.classList.remove('hidden');
  } else {
    warningEl.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// Search / filter
// ---------------------------------------------------------------------------
function initSidebarControls() {
  document.getElementById('search-athletes').addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    renderAthleteList();
  });
  document.getElementById('filter-not-photographed').addEventListener('change', (e) => {
    state.onlyNotPhotographed = e.target.checked;
    renderAthleteList();
  });
}

// ---------------------------------------------------------------------------
// Modals: add athlete manually
// ---------------------------------------------------------------------------
function initAddAthleteModal() {
  const modal = document.getElementById('modal-add-athlete');
  document.getElementById('btn-add-athlete').addEventListener('click', () => {
    ['add-name', 'add-country', 'add-club', 'add-license', 'add-id'].forEach((id) => (document.getElementById(id).value = ''));
    modal.classList.remove('hidden');
  });
  document.getElementById('btn-cancel-add').addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('btn-save-add').addEventListener('click', async () => {
    const athlete = {
      id: uuid(),
      name: document.getElementById('add-name').value.trim(),
      country: document.getElementById('add-country').value.trim(),
      club: document.getElementById('add-club').value.trim(),
      license: document.getElementById('add-license').value.trim(),
      athleteId: document.getElementById('add-id').value.trim(),
      photographed: false,
      lastPhotoAt: null
    };
    if (!athlete.name) {
      alert('Navn er påkrevd.');
      return;
    }
    state.athletes.unshift(athlete);
    await saveAthletes();
    renderAthleteList();
    modal.classList.add('hidden');
  });
}

// ---------------------------------------------------------------------------
// Modals: paste CSV
// ---------------------------------------------------------------------------
function initPasteCsvModal() {
  const modal = document.getElementById('modal-paste-csv');
  document.getElementById('btn-paste-csv').addEventListener('click', () => {
    document.getElementById('paste-textarea').value = '';
    modal.classList.remove('hidden');
  });
  document.getElementById('btn-cancel-paste').addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('btn-save-paste').addEventListener('click', async () => {
    const text = document.getElementById('paste-textarea').value;
    const parsed = parseCsvText(text);
    if (parsed.length === 0) {
      alert('Fant ingen gyldige rader å importere.');
      return;
    }
    state.athletes = state.athletes.concat(parsed);
    await saveAthletes();
    renderAthleteList();
    modal.classList.add('hidden');
  });

  document.getElementById('btn-import-csv').addEventListener('click', async () => {
    const text = await window.bassengfoto.csv.chooseFile();
    if (!text) return;
    const parsed = parseCsvText(text);
    if (parsed.length === 0) {
      alert('Fant ingen gyldige rader i filen.');
      return;
    }
    state.athletes = state.athletes.concat(parsed);
    await saveAthletes();
    renderAthleteList();
  });
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------
function initSettingsPanel() {
  const outputFolderEl = document.getElementById('settings-output-folder');
  const indicatorEl = document.getElementById('output-folder-indicator');

  function refreshFolderUI() {
    const folder = state.settings.outputFolder;
    outputFolderEl.textContent = folder || 'Ingen mappe valgt';
    indicatorEl.textContent = folder ? '📁 ' + folder.split(/[\\/]/).pop() : 'Ingen mappe valgt';
  }
  refreshFolderUI();

  document.getElementById('btn-choose-folder').addEventListener('click', async () => {
    const folder = await window.bassengfoto.settings.chooseOutputFolder();
    if (folder) {
      state.settings.outputFolder = folder;
      await saveSettings();
      refreshFolderUI();
    }
  });

  document.getElementById('btn-open-folder').addEventListener('click', () => {
    if (state.settings.outputFolder) window.bassengfoto.shell.openFolder(state.settings.outputFolder);
  });

  const formatSelect = document.getElementById('filename-format-select');
  formatSelect.value = state.settings.filenameFormat;
  function updateFormatExample() {
    const examples = {
      country_license: 'NOR_AA0000',
      country_id: 'NOR_199',
      club_name: 'Bergen_SK_Jane_Doe',
      license: 'AA0000',
      id: '199'
    };
    document.getElementById('filename-format-example').textContent = examples[formatSelect.value];
  }
  updateFormatExample();
  formatSelect.addEventListener('change', async () => {
    state.settings.filenameFormat = formatSelect.value;
    updateFormatExample();
    await saveSettings();
    updateFilenamePreview();
  });

  const sizeSelect = document.getElementById('image-size-select');
  sizeSelect.value = String(state.settings.imageSize);
  sizeSelect.addEventListener('change', async () => {
    state.settings.imageSize = parseInt(sizeSelect.value, 10);
    await saveSettings();
    resizePreviewCanvas();
  });

  document.getElementById('theme-light-radio').addEventListener('change', async () => {
    state.settings.theme = 'light';
    applyTheme('light');
    await saveSettings();
  });
  document.getElementById('theme-dark-radio').addEventListener('change', async () => {
    state.settings.theme = 'dark';
    applyTheme('dark');
    await saveSettings();
  });

  document.getElementById('theme-toggle').addEventListener('click', async () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.settings.theme);
    await saveSettings();
  });
}

function resizePreviewCanvas() {
  const canvas = document.getElementById('preview-canvas');
  canvas.width = state.settings.imageSize;
  canvas.height = state.settings.imageSize;
}

// ---------------------------------------------------------------------------
// Camera handling
// ---------------------------------------------------------------------------
async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  state.videoDevices = devices.filter((d) => d.kind === 'videoinput');
  const select = document.getElementById('camera-select');
  select.innerHTML = '';
  const noCameraMsg = document.getElementById('no-camera-msg');

  if (state.videoDevices.length === 0) {
    noCameraMsg.classList.add('show');
    return;
  }
  noCameraMsg.classList.remove('show');

  state.videoDevices.forEach((d, idx) => {
    const option = document.createElement('option');
    option.value = d.deviceId;
    option.textContent = d.label || `Kamera ${idx + 1}`;
    select.appendChild(option);
  });

  const preferred = state.settings.lastCameraId && state.videoDevices.some((d) => d.deviceId === state.settings.lastCameraId)
    ? state.settings.lastCameraId
    : state.videoDevices[0].deviceId;
  select.value = preferred;
  await startCamera(preferred);
}

async function startCamera(deviceId) {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false
    });
    state.stream = stream;
    const video = document.getElementById('video');
    video.srcObject = stream;
    state.settings.lastCameraId = deviceId;
    await saveSettings();
    // Refresh labels now that permission is granted
    const devices = await navigator.mediaDevices.enumerateDevices();
    state.videoDevices = devices.filter((d) => d.kind === 'videoinput');
    const select = document.getElementById('camera-select');
    Array.from(select.options).forEach((opt, idx) => {
      const match = state.videoDevices.find((d) => d.deviceId === opt.value);
      if (match && match.label) opt.textContent = match.label;
    });
  } catch (err) {
    console.error('Kunne ikke starte kamera', err);
    document.getElementById('no-camera-msg').classList.add('show');
    document.getElementById('no-camera-msg').textContent = 'Kunne ikke starte kamera: ' + err.message;
  }
}

function initCameraControls() {
  document.getElementById('camera-select').addEventListener('change', (e) => {
    startCamera(e.target.value);
  });
  document.getElementById('btn-refresh-cameras').addEventListener('click', () => {
    listCameras();
  });
}

// ---------------------------------------------------------------------------
// Crop overlay (drag + zoom)
// ---------------------------------------------------------------------------
function getDisplayedVideoRect() {
  const video = document.getElementById('video');
  const stage = document.getElementById('camera-stage');
  const stageW = stage.clientWidth;
  const stageH = stage.clientHeight;
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const videoRatio = vw / vh;
  const stageRatio = stageW / stageH;

  let dispW, dispH, offX, offY;
  if (videoRatio > stageRatio) {
    dispW = stageW;
    dispH = stageW / videoRatio;
    offX = 0;
    offY = (stageH - dispH) / 2;
  } else {
    dispH = stageH;
    dispW = stageH * videoRatio;
    offX = (stageW - dispW) / 2;
    offY = 0;
  }
  return { offX, offY, dispW, dispH, stageW, stageH };
}

function drawCropOverlay() {
  const canvas = document.getElementById('crop-overlay');
  const stage = document.getElementById('camera-stage');
  canvas.width = stage.clientWidth;
  canvas.height = stage.clientHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const rect = getDisplayedVideoRect();
  const size = state.crop.size * Math.min(rect.dispW, rect.dispH);
  const cx = rect.offX + state.crop.cx * rect.dispW;
  const cy = rect.offY + state.crop.cy * rect.dispH;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(cx - size / 2, cy - size / 2, size, size);
  ctx.strokeStyle = '#22c07f';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

function initCropInteraction() {
  const canvas = document.getElementById('crop-overlay');

  canvas.addEventListener('mousedown', (e) => {
    const box = canvas.getBoundingClientRect();
    state.dragging = true;
    state.dragStart = { x: e.clientX - box.left, y: e.clientY - box.top };
  });
  window.addEventListener('mousemove', (e) => {
    if (!state.dragging) return;
    const box = canvas.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    const dx = x - state.dragStart.x;
    const dy = y - state.dragStart.y;
    state.dragStart = { x, y };

    const rect = getDisplayedVideoRect();
    state.crop.cx = clamp(state.crop.cx + dx / rect.dispW, 0.05, 0.95);
    state.crop.cy = clamp(state.crop.cy + dy / rect.dispH, 0.05, 0.95);
    drawCropOverlay();
  });
  window.addEventListener('mouseup', () => (state.dragging = false));

  document.getElementById('zoom-slider').addEventListener('input', (e) => {
    state.zoom = parseInt(e.target.value, 10);
    state.crop.size = clamp(0.9 * (100 / state.zoom), 0.15, 0.95);
    drawCropOverlay();
  });

  window.addEventListener('resize', drawCropOverlay);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------------
// Chroma key processing
// ---------------------------------------------------------------------------
function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function applyChromaKey(imageData) {
  const { chromaKey } = state.settings;
  if (!chromaKey.enabled) return imageData;

  const data = imageData.data;
  const { r: kr, g: kg, b: kb } = chromaKey.keyColor;
  const tol = chromaKey.tolerance;
  const feather = Math.max(chromaKey.feather, 1);

  let replaceR = 255, replaceG = 255, replaceB = 255;
  if (chromaKey.mode === 'color') {
    const hex = chromaKey.replaceColor.replace('#', '');
    replaceR = parseInt(hex.substring(0, 2), 16);
    replaceG = parseInt(hex.substring(2, 4), 16);
    replaceB = parseInt(hex.substring(4, 6), 16);
  }

  const bgImage = chromaKey.mode === 'image' ? state.replaceImageEl : null;
  let bgData = null;
  if (bgImage && bgImage.complete) {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = imageData.width;
    bgCanvas.height = imageData.height;
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.drawImage(bgImage, 0, 0, bgCanvas.width, bgCanvas.height);
    bgData = bgCtx.getImageData(0, 0, bgCanvas.width, bgCanvas.height).data;
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = colorDistance(r, g, b, kr, kg, kb);

    let keyness = 0;
    if (dist < tol) keyness = 1;
    else if (dist < tol + feather) keyness = 1 - (dist - tol) / feather;

    if (keyness <= 0) continue;

    if (chromaKey.mode === 'transparent') {
      data[i + 3] = Math.round(data[i + 3] * (1 - keyness));
    } else if (chromaKey.mode === 'color') {
      data[i] = r * (1 - keyness) + replaceR * keyness;
      data[i + 1] = g * (1 - keyness) + replaceG * keyness;
      data[i + 2] = b * (1 - keyness) + replaceB * keyness;
    } else if (chromaKey.mode === 'image' && bgData) {
      data[i] = r * (1 - keyness) + bgData[i] * keyness;
      data[i + 1] = g * (1 - keyness) + bgData[i + 1] * keyness;
      data[i + 2] = b * (1 - keyness) + bgData[i + 2] * keyness;
    }
  }
  return imageData;
}

function initChromaControls() {
  const toggle = document.getElementById('chroma-toggle');
  const controls = document.getElementById('chroma-controls');
  const swatch = document.getElementById('key-color-swatch');
  const toleranceSlider = document.getElementById('tolerance-slider');
  const featherSlider = document.getElementById('feather-slider');
  const modeSelect = document.getElementById('chroma-mode-select');
  const colorInput = document.getElementById('replace-color-input');
  const chooseBgBtn = document.getElementById('btn-choose-bg-image');

  function syncUiFromSettings() {
    const ck = state.settings.chromaKey;
    toggle.checked = ck.enabled;
    controls.classList.toggle('hidden', !ck.enabled);
    swatch.style.background = `rgb(${ck.keyColor.r}, ${ck.keyColor.g}, ${ck.keyColor.b})`;
    toleranceSlider.value = ck.tolerance;
    featherSlider.value = ck.feather;
    modeSelect.value = ck.mode;
    colorInput.value = ck.replaceColor;
    colorInput.classList.toggle('hidden', ck.mode !== 'color');
    chooseBgBtn.classList.toggle('hidden', ck.mode !== 'image');
    if (ck.mode === 'image' && ck.replaceImagePath) loadReplaceImage(ck.replaceImagePath);
  }
  syncUiFromSettings();

  toggle.addEventListener('change', async () => {
    state.settings.chromaKey.enabled = toggle.checked;
    controls.classList.toggle('hidden', !toggle.checked);
    await saveSettings();
  });

  toleranceSlider.addEventListener('input', async () => {
    state.settings.chromaKey.tolerance = parseInt(toleranceSlider.value, 10);
    await saveSettings();
  });
  featherSlider.addEventListener('input', async () => {
    state.settings.chromaKey.feather = parseInt(featherSlider.value, 10);
    await saveSettings();
  });
  modeSelect.addEventListener('change', async () => {
    state.settings.chromaKey.mode = modeSelect.value;
    colorInput.classList.toggle('hidden', modeSelect.value !== 'color');
    chooseBgBtn.classList.toggle('hidden', modeSelect.value !== 'image');
    await saveSettings();
  });
  colorInput.addEventListener('input', async () => {
    state.settings.chromaKey.replaceColor = colorInput.value;
    await saveSettings();
  });
  chooseBgBtn.addEventListener('click', async () => {
    const filePath = await window.bassengfoto.settings.chooseReplaceImage();
    if (filePath) {
      state.settings.chromaKey.replaceImagePath = filePath;
      await saveSettings();
      loadReplaceImage(filePath);
    }
  });

  let pickingColor = false;
  document.getElementById('btn-pick-color').addEventListener('click', () => {
    pickingColor = true;
  });
  document.getElementById('preview-canvas').addEventListener('click', async (e) => {
    if (!pickingColor) return;
    pickingColor = false;
    const canvas = document.getElementById('preview-canvas');
    const box = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - box.left) / box.width) * canvas.width);
    const y = Math.round(((e.clientY - box.top) / box.height) * canvas.height);
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    state.settings.chromaKey.keyColor = { r: pixel[0], g: pixel[1], b: pixel[2] };
    swatch.style.background = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
    await saveSettings();
  });
}

async function loadReplaceImage(filePath) {
  const dataUrl = await window.bassengfoto.fs.readImageAsDataUrl(filePath);
  if (!dataUrl) return;
  const img = new Image();
  img.src = dataUrl;
  state.replaceImageEl = img;
}

// ---------------------------------------------------------------------------
// Fullt kamerabilde til visningsskjermen (uklippet, opptil 1920x1080)
// ---------------------------------------------------------------------------
let fullFrameCanvasEl = null;

function captureFullFrameCanvas(video) {
  if (!video.videoWidth || !video.videoHeight) return null;
  const maxW = 1920;
  const maxH = 1080;
  const scale = Math.min(1, maxW / video.videoWidth, maxH / video.videoHeight);
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);

  if (!fullFrameCanvasEl) fullFrameCanvasEl = document.createElement('canvas');
  if (fullFrameCanvasEl.width !== w || fullFrameCanvasEl.height !== h) {
    fullFrameCanvasEl.width = w;
    fullFrameCanvasEl.height = h;
  }
  const ctx = fullFrameCanvasEl.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);
  return fullFrameCanvasEl;
}

// ---------------------------------------------------------------------------
// Preview render loop
// ---------------------------------------------------------------------------
function renderPreviewFrame() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('preview-canvas');
  const ctx = canvas.getContext('2d');

  if (video.readyState >= 2 && video.videoWidth > 0) {
    const rect = getDisplayedVideoRect();
    const size = state.crop.size * Math.min(rect.dispW, rect.dispH);
    const cx = state.crop.cx * rect.dispW;
    const cy = state.crop.cy * rect.dispH;

    const scaleX = video.videoWidth / rect.dispW;
    const scaleY = video.videoHeight / rect.dispH;

    const srcSize = size * scaleX;
    const srcSizeY = size * scaleY;
    const srcX = cx * scaleX - srcSize / 2;
    const srcY = cy * scaleY - srcSizeY / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, srcX, srcY, srcSize, srcSizeY, 0, 0, canvas.width, canvas.height);

    if (state.settings.chromaKey.enabled) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyChromaKey(imageData);
      ctx.putImageData(imageData, 0, 0);
    }

    const now = performance.now();
    if (now - state.lastDisplayFrameSentAt > 150) {
      state.lastDisplayFrameSentAt = now;
      const fullFrameCanvas = captureFullFrameCanvas(video);
      if (fullFrameCanvas) {
        window.bassengfoto.display.sendFrame({
          dataUrl: fullFrameCanvas.toDataURL('image/jpeg', 0.75),
          crop: { cx: state.crop.cx, cy: state.crop.cy, size: state.crop.size }
        });
      }
    }
  }

  drawCropOverlay();
  state.animationHandle = requestAnimationFrame(renderPreviewFrame);
}

// ---------------------------------------------------------------------------
// Capture & save
// ---------------------------------------------------------------------------
function showSaveConfirmation(message, isError) {
  const el = document.getElementById('save-confirmation');
  el.textContent = message;
  el.classList.remove('hidden');
  el.style.background = isError ? '#f8d7da' : '';
  el.style.color = isError ? '#721c24' : '';
  setTimeout(() => el.classList.add('hidden'), 4000);
}

async function captureAndSave() {
  const athlete = getSelectedAthlete();
  if (!athlete) {
    alert('Velg en utøver før du tar bilde.');
    return;
  }

  const { fileName, missing } = buildFilename(athlete, state.settings.filenameFormat);
  if (missing.length > 0) {
    alert(`Kan ikke lagre: mangler felt (${missing.map(fieldLabel).join(', ')}) for valgt filnavn-format.`);
    return;
  }

  const canvas = document.getElementById('preview-canvas');

  const doSave = async () => {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const arrayBuffer = await blob.arrayBuffer();
    const result = await window.bassengfoto.image.save(fileName, arrayBuffer);
    if (result.success) {
      athlete.photographed = true;
      athlete.lastPhotoAt = new Date().toISOString();
      await saveAthletes();
      renderAthleteList();
      showSaveConfirmation(`✔ Lagret: ${fileName}`, false);
      window.bassengfoto.display.sendCaptured({
        dataUrl: canvas.toDataURL('image/png'),
        athleteName: athlete.name
      });
    } else {
      showSaveConfirmation(`✖ Feil: ${result.error}`, true);
    }
  };

  const check = await window.bassengfoto.image.checkExists(fileName);
  if (check.error) {
    showSaveConfirmation(`✖ ${check.error}`, true);
    return;
  }
  if (check.exists) {
    openOverwriteModal(fileName, doSave);
  } else {
    await doSave();
  }
}

function openOverwriteModal(fileName, onConfirm) {
  const modal = document.getElementById('modal-confirm-overwrite');
  document.getElementById('overwrite-message').textContent = `Filen "${fileName}" finnes allerede i output-mappen. Vil du overskrive den?`;
  modal.classList.remove('hidden');

  const confirmBtn = document.getElementById('btn-confirm-overwrite');
  const cancelBtn = document.getElementById('btn-cancel-overwrite');

  const cleanup = () => {
    modal.classList.add('hidden');
    confirmBtn.removeEventListener('click', onConfirmClick);
    cancelBtn.removeEventListener('click', onCancelClick);
  };
  const onConfirmClick = async () => {
    cleanup();
    await onConfirm();
  };
  const onCancelClick = () => cleanup();

  confirmBtn.addEventListener('click', onConfirmClick);
  cancelBtn.addEventListener('click', onCancelClick);
}

function initCapture() {
  document.getElementById('btn-capture').addEventListener('click', captureAndSave);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.getElementById('tab-kamera').classList.contains('active')) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
      e.preventDefault();
      captureAndSave();
    }
  });
}

// ---------------------------------------------------------------------------
// Visningsskjerm (eksternt vindu for eksternt display)
// ---------------------------------------------------------------------------
function initDisplayWindowButton() {
  document.getElementById('btn-open-display').addEventListener('click', () => {
    window.bassengfoto.display.open();
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  await loadAll();
  resizePreviewCanvas();
  initTabs();
  initSidebarControls();
  initAddAthleteModal();
  initPasteCsvModal();
  initSettingsPanel();
  initCameraControls();
  initCropInteraction();
  initChromaControls();
  initCapture();
  initDisplayWindowButton();
  renderAthleteList();
  updateFilenamePreview();

  await listCameras();
  navigator.mediaDevices.addEventListener('devicechange', listCameras);

  drawCropOverlay();
  state.animationHandle = requestAnimationFrame(renderPreviewFrame);
}

document.addEventListener('DOMContentLoaded', init);
