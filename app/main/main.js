const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
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
const meta = require('./meta');
const sheets = require('./sheets');

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
  if (
    data &&
    (Object.prototype.hasOwnProperty.call(data, 'sheets_spreadsheet_id') ||
      Object.prototype.hasOwnProperty.call(data, 'sheets_tab_name') ||
      Object.prototype.hasOwnProperty.call(data, 'sheets_service_account_path') ||
      Object.prototype.hasOwnProperty.call(data, 'sheets_poll_interval_ms'))
  ) {
    sheets.clearCache();
  }
  return true;
});

// Requests
ipcMain.handle('request-submit', async (_, payload) => {
  const requestId = `REQ-${Date.now()}`;
  const now = new Date().toISOString();

  const keywords = Array.isArray(payload.keywords)
    ? payload.keywords.map((k) => String(k || '').trim()).filter(Boolean)
    : String(payload.keyword || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

  const record = {
    request_id: requestId,
    prompt: payload.prompt || keywords.join(', '),
    keyword: JSON.stringify(keywords),
    platform: payload.platform || '',
    schedule_date: payload.schedule_date || '',
    article_schedule_time: payload.article_schedule_time || '',
    article_schedule_week: payload.article_schedule_week || 'this_week',
    article_schedule_start_date: payload.article_schedule_start_date || payload.schedule_date || '',
    status: 'Pending',
    output: '',
    error_message: '',
    created_at: now,
    updated_at: now
  };

  db.insertRequest(record);

  // fire webhook in background
  webhook.send(requestId, { ...payload, keywords }, mainWindow);

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

// Meta social sync (Facebook + Instagram from System User token)
ipcMain.handle('meta-sync-accounts', async (_, payload = {}) => {
  return meta.syncFacebookInstagram({
    systemUserToken: payload.systemUserToken,
    appSecret: payload.appSecret,
    graphVersion: payload.graphVersion,
    persist: payload.persist !== false
  });
});

// Google Sheets runs
ipcMain.handle('sheets-get-latest', async (_, payload = {}) => {
  try {
    const limit = Number(payload.limit) || 10;
    const force = !!payload.force;
    const runs = await sheets.getLatestRuns(limit, { force });
    return { success: true, runs };
  } catch (err) {
    return { success: false, message: err.message || 'Failed to fetch runs.', runs: [] };
  }
});

ipcMain.handle('sheets-get-run', async (_, payload = {}) => {
  try {
    const run = await sheets.getRunByReqId(payload.reqId, { force: !!payload.force });
    return { success: true, run };
  } catch (err) {
    return { success: false, message: err.message || 'Failed to fetch run.', run: null };
  }
});

ipcMain.handle('sheets-test', async () => {
  try {
    return await sheets.testConnection();
  } catch (err) {
    return { success: false, message: err.message || 'Sheets connection failed.' };
  }
});

ipcMain.handle('sheets-pick-service-account', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Google Service Account JSON',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths?.[0]) {
    return { success: false, canceled: true };
  }
  try {
    const dest = await sheets.saveServiceAccountJson(result.filePaths[0]);
    return { success: true, path: dest };
  } catch (err) {
    return { success: false, message: err.message || 'Failed to save service account file.' };
  }
});

ipcMain.handle('sheets-get-service-account-path', () => {
  return sheets.getServiceAccountPath();
});
