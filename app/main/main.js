const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, '../assets/icons/icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  const db = require('./database');
  await db.initDb();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC Handlers ──────────────────────────────────────────────────────────

const db = require('./database');
const webhook = require('./webhook');
const config = require('./config');

// Window controls
ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

// Config
ipcMain.handle('config-get', () => config.getAll());
ipcMain.handle('config-set', (_, data) => {
  config.setAll(data);
  return true;
});

// Requests
ipcMain.handle('request-submit', async (_, payload) => {
  const requestId = `REQ-${Date.now()}`;
  const now = new Date().toISOString();

  const record = {
    request_id: requestId,
    prompt: payload.prompt,
    keyword: payload.keyword || '',
    platform: payload.platform || '',
    urgent: payload.urgent ? 1 : 0,
    schedule_date: payload.schedule_date || '',
    status: 'Pending',
    output: '',
    error_message: '',
    created_at: now,
    updated_at: now
  };

  db.insertRequest(record);

  // fire webhook in background
  webhook.send(requestId, payload, mainWindow);

  return { request_id: requestId };
});

ipcMain.handle('request-get-all', () => db.getAllRequests());
ipcMain.handle('request-get-one', (_, id) => db.getRequest(id));
ipcMain.handle('request-delete', (_, id) => {
  db.deleteRequest(id);
  return true;
});
ipcMain.handle('request-clear-all', () => {
  db.clearAll();
  return true;
});

// DB export
ipcMain.handle('db-export', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export History',
    defaultPath: `terrabyte_history_${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!result.canceled && result.filePath) {
    const rows = db.getAllRequests();
    fs.writeFileSync(result.filePath, JSON.stringify(rows, null, 2));
    return true;
  }
  return false;
});

// Webhook test
ipcMain.handle('webhook-test', async () => {
  return webhook.test();
});
