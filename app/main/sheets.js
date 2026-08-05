'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { app } = require('electron');
const config = require('./config');

const REQUIRED_COLUMNS = ['req_id', 'created_at', 'schedule_date', 'process', 'status', 'error'];

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
  if (cachedAuth && cachedAuthKey === key) return cachedAuth;

  let credentials;
  try {
    credentials = JSON.parse(key);
  } catch {
    throw new Error('Invalid Google Service Account JSON file.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  cachedAuth = await auth.getClient();
  cachedAuthKey = key;
  return cachedAuth;
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
  REQUIRED_COLUMNS
};
