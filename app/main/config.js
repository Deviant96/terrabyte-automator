'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const defaults = {
  webhook_url: '',
  webhook_token: '',
  webhook_timeout: 30000,
  ai_provider: 'openai',
  ai_model: 'gpt-4o',
  temperature: 0.7,
  max_tokens: 2048,
  default_article_schedule_time: '',
  default_article_schedule_week: 'this_week',
  default_article_custom_start_date: '',
  dark_mode: true,
  animations_enabled: true,
  compact_mode: false,
  database_path: '',
  debug_logs: false,
  verbose_mode: false,
  social_accounts: [],
  meta_system_user_token: '',
  meta_app_secret: '',
  meta_graph_version: 'v21.0',
  sheets_spreadsheet_id: '12KZ6emJQJyVKUpnGAdYXHuGmgWJ4k2TWQwlE7vA1f8Y',
  sheets_tab_name: 'Runs',
  sheets_poll_interval_ms: 300,
  sheets_service_account_path: ''
};

/** Legacy path used during development before userData migration. */
function getLegacySettingsPath() {
  return path.join(__dirname, '../../config/settings.json');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Writable settings location:
 * Windows: %APPDATA%\terrabyte-automator\settings.json
 * (Electron app.getPath('userData'))
 */
function getSettingsPath() {
  const userDataDir = app.getPath('userData');
  ensureDir(userDataDir);
  return path.join(userDataDir, 'settings.json');
}

function migrateLegacySettingsIfNeeded(settingsPath) {
  if (fs.existsSync(settingsPath)) return;

  const legacyPath = getLegacySettingsPath();
  if (!fs.existsSync(legacyPath)) return;

  try {
    ensureDir(path.dirname(settingsPath));
    fs.copyFileSync(legacyPath, settingsPath);
  } catch {
    // Ignore migration failures; defaults will be used until a successful save.
  }
}

function readSettingsFile(settingsPath) {
  const raw = fs.readFileSync(settingsPath, 'utf8');
  return { ...defaults, ...JSON.parse(raw) };
}

function load() {
  try {
    const settingsPath = getSettingsPath();
    migrateLegacySettingsIfNeeded(settingsPath);
    if (!fs.existsSync(settingsPath)) {
      return { ...defaults };
    }
    return readSettingsFile(settingsPath);
  } catch {
    return { ...defaults };
  }
}

function getAll() {
  const data = load();
  return {
    ...data,
    settings_path: getSettingsPath()
  };
}

function setAll(data) {
  const settingsPath = getSettingsPath();
  ensureDir(path.dirname(settingsPath));

  // Never persist computed fields
  const incoming = { ...(data || {}) };
  delete incoming.settings_path;

  const current = load();
  const merged = { ...current, ...incoming };
  const payload = JSON.stringify(merged, null, 2);

  // Atomic-ish write: temp file then rename (safer on Windows/prod)
  const tempPath = `${settingsPath}.tmp`;
  fs.writeFileSync(tempPath, payload, 'utf8');
  fs.renameSync(tempPath, settingsPath);

  return {
    ...merged,
    settings_path: settingsPath
  };
}

module.exports = { getAll, setAll, getSettingsPath, defaults };
