'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { app } = require('electron');
const config = require('./config');

const REQUIRED_COLUMNS = ['req_id', 'created_at', 'schedule_date', 'process', 'status', 'error'];
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const EDITOR_MAX_ROWS = 400;
const EDITOR_MAX_COLS = 40;
const EDITOR_MIN_ROWS = 20;
const EDITOR_MIN_COLS = 8;
const EDITOR_EXTRA_ROWS = 12;
const EDITOR_EXTRA_COLS = 4;

let cachedAuth = null;
let cachedAuthKey = '';
let cachedRows = null;
let cachedAt = 0;
let inflight = null;

function getServiceAccountPath() {
  const settings = config.getAll();
  if (settings.sheets_service_account_path) {
    return settings.sheets_service_account_path;
  }
  return path.join(app.getPath('userData'), 'google-service-account.json');
}

function getPollIntervalMs() {
  const settings = config.getAll();
  const value = Number(settings.sheets_poll_interval_ms);
  if (!Number.isFinite(value) || value < 300) return 300;
  return Math.floor(value);
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function parseCreatedAt(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const asDate = new Date(raw.includes('T') || raw.includes('-') ? raw.replace(' ', 'T') : raw);
  const ts = asDate.getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

async function getAuthClient() {
  const keyPath = getServiceAccountPath();
  if (!fs.existsSync(keyPath)) {
    throw new Error('Google Service Account JSON not found. Add it in Settings.');
  }

  const key = fs.readFileSync(keyPath, 'utf8');

  let credentials;
  try {
    credentials = JSON.parse(key);
  } catch {
    throw new Error('Invalid Google Service Account JSON file.');
  }

  const cacheKey = `${key}::${SHEETS_SCOPE}`;
  if (cachedAuth && cachedAuthKey === cacheKey) return cachedAuth;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [SHEETS_SCOPE]
  });

  cachedAuth = await auth.getClient();
  cachedAuthKey = cacheKey;
  return cachedAuth;
}

function getSpreadsheetId() {
  const spreadsheetId = (config.getAll().sheets_spreadsheet_id || '').trim();
  if (!spreadsheetId) {
    throw new Error('Google Spreadsheet ID is not configured.');
  }
  return spreadsheetId;
}

function quoteSheetName(name) {
  return `'${String(name || '').replace(/'/g, "''")}'`;
}

function colIndexToA1(index) {
  let n = Number(index) + 1;
  if (!Number.isFinite(n) || n < 1) n = 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function cellA1(rowIndex, colIndex) {
  return `${colIndexToA1(colIndex)}${Number(rowIndex) + 1}`;
}

function friendlySheetsError(err) {
  const message = String(err?.message || err || 'Google Sheets request failed.');
  const status = err?.code || err?.response?.status;
  if (status === 403 || /insufficient|permission|forbidden/i.test(message)) {
    return 'The service account cannot edit this spreadsheet. Share it with the service account email as Editor (not Viewer).';
  }
  return message;
}

async function getSheetsClient() {
  const auth = await getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

async function listTabs() {
  const spreadsheetId = getSpreadsheetId();
  const sheetsApi = await getSheetsClient();
  const response = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'properties.title,spreadsheetId,sheets.properties(sheetId,title,index,gridProperties)'
  });

  const tabs = (response.data.sheets || []).map((sheet) => ({
    title: sheet.properties?.title || '',
    sheetId: sheet.properties?.sheetId,
    index: sheet.properties?.index || 0,
    rowCount: sheet.properties?.gridProperties?.rowCount || 0,
    columnCount: sheet.properties?.gridProperties?.columnCount || 0
  })).filter((tab) => tab.title);

  return {
    spreadsheetId,
    title: response.data.properties?.title || '',
    tabs
  };
}

function padGrid(values) {
  const rows = Array.isArray(values) ? values.map((row) => (Array.isArray(row) ? row : [])) : [];
  const usedRows = rows.length;
  const usedCols = rows.reduce((max, row) => Math.max(max, row.length), 0);

  const rowCount = Math.min(
    EDITOR_MAX_ROWS,
    Math.max(EDITOR_MIN_ROWS, usedRows + EDITOR_EXTRA_ROWS)
  );
  const colCount = Math.min(
    EDITOR_MAX_COLS,
    Math.max(EDITOR_MIN_COLS, usedCols + EDITOR_EXTRA_COLS)
  );

  const grid = [];
  for (let r = 0; r < rowCount; r += 1) {
    const source = rows[r] || [];
    const next = [];
    for (let c = 0; c < colCount; c += 1) {
      next.push(source[c] == null ? '' : String(source[c]));
    }
    grid.push(next);
  }

  return {
    values: grid,
    usedRows,
    usedCols,
    rowCount,
    colCount,
    truncatedRows: usedRows > EDITOR_MAX_ROWS,
    truncatedCols: usedCols > EDITOR_MAX_COLS
  };
}

async function getSheetGrid(sheetName) {
  const spreadsheetId = getSpreadsheetId();
  const name = String(sheetName || '').trim();
  if (!name) throw new Error('Sheet tab name is required.');

  const sheetsApi = await getSheetsClient();
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: quoteSheetName(name),
    majorDimension: 'ROWS',
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING'
  });

  const padded = padGrid(response.data.values || []);
  return {
    spreadsheetId,
    sheetName: name,
    ...padded
  };
}

async function updateSheetCell({ sheetName, row, col, value }) {
  const spreadsheetId = getSpreadsheetId();
  const name = String(sheetName || '').trim();
  const rowIndex = Number(row);
  const colIndex = Number(col);
  if (!name) throw new Error('Sheet tab name is required.');
  if (!Number.isInteger(rowIndex) || rowIndex < 0) throw new Error('Invalid row.');
  if (!Number.isInteger(colIndex) || colIndex < 0) throw new Error('Invalid column.');

  const sheetsApi = await getSheetsClient();
  const a1 = `${quoteSheetName(name)}!${cellA1(rowIndex, colIndex)}`;
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: a1,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[value == null ? '' : String(value)]]
    }
  });

  clearCache();
  return {
    success: true,
    sheetName: name,
    row: rowIndex,
    col: colIndex,
    a1: cellA1(rowIndex, colIndex),
    value: value == null ? '' : String(value)
  };
}

function mapRows(values) {
  if (!Array.isArray(values) || values.length < 2) return [];

  const headers = (values[0] || []).map(normalizeHeader);
  const index = {};
  REQUIRED_COLUMNS.forEach((col) => {
    index[col] = headers.indexOf(col);
  });

  const missing = REQUIRED_COLUMNS.filter((col) => index[col] < 0);
  if (missing.length) {
    throw new Error(`Sheet is missing columns: ${missing.join(', ')}`);
  }

  const rows = [];
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i] || [];
    const reqId = String(row[index.req_id] || '').trim();
    if (!reqId) continue;

    rows.push({
      req_id: reqId,
      created_at: String(row[index.created_at] || '').trim(),
      schedule_date: String(row[index.schedule_date] || '').trim(),
      process: String(row[index.process] || '').trim(),
      status: String(row[index.status] || '').trim(),
      error: String(row[index.error] || '').trim(),
      _created_at_ts: parseCreatedAt(row[index.created_at])
    });
  }

  return rows;
}

async function fetchRowsFromSheet({ force = false } = {}) {
  const settings = config.getAll();
  const spreadsheetId = (settings.sheets_spreadsheet_id || '').trim();
  const sheetName = (settings.sheets_tab_name || 'Runs').trim() || 'Runs';
  const ttl = getPollIntervalMs();

  if (!spreadsheetId) {
    throw new Error('Google Spreadsheet ID is not configured.');
  }

  const now = Date.now();
  if (!force && cachedRows && (now - cachedAt) < ttl) {
    return cachedRows;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const range = `'${sheetName.replace(/'/g, "''")}'!A:Z`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    const rows = mapRows(response.data.values || []);
    cachedRows = rows;
    cachedAt = Date.now();
    return rows;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

async function getLatestRuns(limit = 10, options = {}) {
  const rows = await fetchRowsFromSheet(options);
  return rows
    .slice()
    .sort((a, b) => b._created_at_ts - a._created_at_ts || String(b.req_id).localeCompare(String(a.req_id)))
    .slice(0, Math.max(1, limit))
    .map(({ _created_at_ts, ...rest }) => rest);
}

async function getRunByReqId(reqId, options = {}) {
  const id = String(reqId || '').trim();
  if (!id) return null;
  const rows = await fetchRowsFromSheet(options);
  const match = rows.find((row) => row.req_id === id);
  if (!match) return null;
  const { _created_at_ts, ...rest } = match;
  return rest;
}

function clearCache() {
  cachedRows = null;
  cachedAt = 0;
  cachedAuth = null;
  cachedAuthKey = '';
}

async function saveServiceAccountJson(sourcePath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error('Service account file not found.');
  }
  const raw = fs.readFileSync(sourcePath, 'utf8');
  JSON.parse(raw); // validate
  const dest = path.join(app.getPath('userData'), 'google-service-account.json');
  fs.writeFileSync(dest, raw, 'utf8');
  config.setAll({ sheets_service_account_path: dest });
  clearCache();
  return dest;
}

async function testConnection() {
  const rows = await fetchRowsFromSheet({ force: true });
  return {
    success: true,
    message: `Connected. Found ${rows.length} run row(s).`,
    count: rows.length
  };
}

module.exports = {
  getLatestRuns,
  getRunByReqId,
  getPollIntervalMs,
  getServiceAccountPath,
  saveServiceAccountJson,
  testConnection,
  clearCache,
  listTabs,
  getSheetGrid,
  updateSheetCell,
  friendlySheetsError,
  REQUIRED_COLUMNS
};
