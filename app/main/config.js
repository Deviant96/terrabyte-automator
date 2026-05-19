const path = require('path');
const fs = require('fs');

const SETTINGS_PATH = path.join(__dirname, '../../config/settings.json');

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
  verbose_mode: false
};

function load() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

function getAll() {
  return load();
}

function setAll(data) {
  const current = load();
  const merged = { ...current, ...data };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2));
}

module.exports = { getAll, setAll };
