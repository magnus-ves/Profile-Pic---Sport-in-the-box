const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = () => app.getPath('userData');
const ATHLETES_FILE = () => path.join(USER_DATA_DIR(), 'athletes.json');
const SETTINGS_FILE = () => path.join(USER_DATA_DIR(), 'settings.json');

const DEFAULT_SETTINGS = {
  outputFolder: null,
  filenameFormat: 'country_license',
  lastCameraId: null,
  chromaKey: {
    enabled: false,
    keyColor: { r: 0, g: 177, b: 64 },
    tolerance: 40,
    feather: 12,
    mode: 'transparent', // 'transparent' | 'color' | 'image'
    replaceColor: '#ffffff',
    replaceImagePath: null
  },
  imageSize: 700,
  displayOverlayImagePath: path.join(__dirname, 'renderer', 'assets', 'idle-overlay.png')
};

function ensureUserDataDir() {
  const dir = USER_DATA_DIR();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Kunne ikke lese', filePath, err);
    return fallback;
  }
}

function writeJsonSafe(filePath, data) {
  ensureUserDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

let mainWindow;
let displayWindow = null;

function createDisplayWindow() {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.focus();
    return;
  }
  displayWindow = new BrowserWindow({
    width: 900,
    height: 900,
    title: 'Bassengfoto — Visningsskjerm',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  displayWindow.setMenuBarVisibility(false);
  displayWindow.loadFile(path.join(__dirname, 'renderer', 'display.html'));
  displayWindow.on('closed', () => {
    displayWindow = null;
  });
}

function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Bassengfoto',
    backgroundColor: '#1b1f24',
    icon: path.join(__dirname, 'build', 'icon.png'),
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 16, y: 16 }
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  ensureUserDataDir();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC: Settings ----------
ipcMain.handle('settings:load', () => {
  const stored = readJsonSafe(SETTINGS_FILE(), {});
  return { ...DEFAULT_SETTINGS, ...stored, chromaKey: { ...DEFAULT_SETTINGS.chromaKey, ...(stored.chromaKey || {}) } };
});

ipcMain.handle('settings:save', (event, settings) => {
  writeJsonSafe(SETTINGS_FILE(), settings);
  return true;
});

ipcMain.handle('settings:chooseOutputFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Velg mappe for lagring av bilder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('settings:chooseReplaceImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Velg bakgrunnsbilde',
    filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('settings:chooseOverlayImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Velg overleggsbilde for visningsskjerm (bør ha gjennomsiktighet)',
    filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('fs:readImageAsDataUrl', (event, filePath) => {
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace('.', '') || 'png';
    return `data:image/${ext};base64,${buf.toString('base64')}`;
  } catch (err) {
    return null;
  }
});

// ---------- IPC: Athletes ----------
ipcMain.handle('athletes:load', () => {
  return readJsonSafe(ATHLETES_FILE(), []);
});

ipcMain.handle('athletes:save', (event, athletes) => {
  writeJsonSafe(ATHLETES_FILE(), athletes);
  return true;
});

// ---------- IPC: CSV import ----------
ipcMain.handle('csv:chooseFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Velg CSV-fil med utøvere',
    filters: [{ name: 'CSV/Tekst', extensions: ['csv', 'txt', 'tsv'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  try {
    return fs.readFileSync(result.filePaths[0], 'utf-8');
  } catch (err) {
    return null;
  }
});

// ---------- IPC: Save image ----------
ipcMain.handle('image:checkExists', (event, fileName) => {
  const settings = readJsonSafe(SETTINGS_FILE(), DEFAULT_SETTINGS);
  if (!settings.outputFolder) return { error: 'Ingen output-mappe valgt' };
  const fullPath = path.join(settings.outputFolder, fileName);
  return { exists: fs.existsSync(fullPath), fullPath };
});

ipcMain.handle('image:save', (event, { fileName, buffer }) => {
  const settings = readJsonSafe(SETTINGS_FILE(), DEFAULT_SETTINGS);
  if (!settings.outputFolder) {
    return { success: false, error: 'Ingen output-mappe er valgt i innstillinger.' };
  }
  try {
    if (!fs.existsSync(settings.outputFolder)) {
      fs.mkdirSync(settings.outputFolder, { recursive: true });
    }
    const fullPath = path.join(settings.outputFolder, fileName);
    fs.writeFileSync(fullPath, Buffer.from(buffer));
    return { success: true, fullPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('shell:openFolder', (event, folderPath) => {
  if (folderPath) shell.openPath(folderPath);
});

// ---------- IPC: Display window (extern skjerm ved bassenget) ----------
ipcMain.handle('display:open', () => {
  createDisplayWindow();
  return true;
});

ipcMain.handle('display:isOpen', () => {
  return !!(displayWindow && !displayWindow.isDestroyed());
});

ipcMain.on('display:frame', (event, dataUrl) => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.webContents.send('display:frame', dataUrl);
  }
});

ipcMain.on('display:captured', (event, payload) => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.webContents.send('display:captured', payload);
  }
});

ipcMain.on('display:overlay', (event, dataUrl) => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.webContents.send('display:overlay', dataUrl);
  }
});
