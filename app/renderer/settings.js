'use strict';

let settingsCache = {};

async function loadSettings() {
  settingsCache = await window.api.configGet();
  applySettingsToForm(settingsCache);
}

function applySettingsToForm(cfg) {
  setValue('cfg-webhook-url', cfg.webhook_url || '');
  setValue('cfg-webhook-token', cfg.webhook_token || '');
  setValue('cfg-webhook-timeout', cfg.webhook_timeout || 30000);
  setValue('cfg-ai-provider', cfg.ai_provider || 'openai');
  setValue('cfg-ai-model', cfg.ai_model || 'gpt-4o');
  setValue('cfg-temperature', cfg.temperature ?? 0.7);
  setValue('cfg-max-tokens', cfg.max_tokens || 2048);

  setToggle('cfg-dark-mode', cfg.dark_mode !== false);
  setToggle('cfg-animations', cfg.animations_enabled !== false);
  setToggle('cfg-compact', !!cfg.compact_mode);
  setToggle('cfg-debug-logs', !!cfg.debug_logs);
  setToggle('cfg-verbose', !!cfg.verbose_mode);
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setToggle(id, state) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('aria-checked', String(state));
}

function getToggle(id) {
  const el = document.getElementById(id);
  return el ? el.getAttribute('aria-checked') === 'true' : false;
}

// Wire toggle buttons
['cfg-dark-mode', 'cfg-animations', 'cfg-compact', 'cfg-debug-logs', 'cfg-verbose'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    const current = el.getAttribute('aria-checked') === 'true';
    el.setAttribute('aria-checked', String(!current));
  });
});

// Save
document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const data = {
    webhook_url: document.getElementById('cfg-webhook-url').value.trim(),
    webhook_token: document.getElementById('cfg-webhook-token').value.trim(),
    webhook_timeout: parseInt(document.getElementById('cfg-webhook-timeout').value) || 30000,
    ai_provider: document.getElementById('cfg-ai-provider').value,
    ai_model: document.getElementById('cfg-ai-model').value.trim(),
    temperature: parseFloat(document.getElementById('cfg-temperature').value) || 0.7,
    max_tokens: parseInt(document.getElementById('cfg-max-tokens').value) || 2048,
    dark_mode: getToggle('cfg-dark-mode'),
    animations_enabled: getToggle('cfg-animations'),
    compact_mode: getToggle('cfg-compact'),
    debug_logs: getToggle('cfg-debug-logs'),
    verbose_mode: getToggle('cfg-verbose')
  };

  await window.api.configSet(data);
  settingsCache = data;
  showToast('success', 'Settings saved');
});

// Test Webhook
document.getElementById('btn-test-webhook').addEventListener('click', async () => {
  // Save first so latest URL is used
  const url = document.getElementById('cfg-webhook-url').value.trim();
  const token = document.getElementById('cfg-webhook-token').value.trim();
  await window.api.configSet({ webhook_url: url, webhook_token: token });

  showToast('info', 'Testing webhook...');
  const result = await window.api.webhookTest();
  if (result.success) {
    showToast('success', 'Webhook connected: ' + result.message);
  } else {
    showToast('error', 'Webhook failed: ' + result.message);
  }
});

// Export DB
document.getElementById('btn-export-db').addEventListener('click', async () => {
  const ok = await window.api.dbExport();
  if (ok) showToast('success', 'Logs exported');
  else showToast('info', 'Export cancelled');
});

// Clear history
document.getElementById('btn-clear-history').addEventListener('click', async () => {
  if (!confirm('Delete all request history? This cannot be undone.')) return;
  await window.api.requestClearAll();
  showToast('info', 'History cleared');
  if (typeof loadHistory === 'function') loadHistory();
});

window.loadSettings = loadSettings;
