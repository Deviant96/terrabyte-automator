'use strict';

let settingsCache = {};
let socialAccounts = [];

const PLATFORM_LABELS = {
  instagram: 'Instagram',
  threads: 'Threads',
  facebook: 'Facebook'
};

function applyInterfaceSettings(cfg) {
  const darkMode = cfg.dark_mode !== false;
  const animationsEnabled = cfg.animations_enabled !== false;
  const compactMode = !!cfg.compact_mode;

  document.documentElement.classList.toggle('dark', darkMode);
  document.body.classList.toggle('light-mode', !darkMode);
  document.body.classList.toggle('no-animations', !animationsEnabled);
  document.body.classList.toggle('compact-mode', compactMode);
}

function applyInterfacePreviewFromToggles() {
  applyInterfaceSettings({
    ...settingsCache,
    dark_mode: getToggle('cfg-dark-mode'),
    animations_enabled: getToggle('cfg-animations'),
    compact_mode: getToggle('cfg-compact')
  });
}

async function loadSettings() {
  settingsCache = await window.api.configGet();
  socialAccounts = Array.isArray(settingsCache.social_accounts)
    ? settingsCache.social_accounts.slice()
    : [];
  applySettingsToForm(settingsCache);
  applyInterfaceSettings(settingsCache);
  renderSocialAccounts();
  hideSocialAccountForm();

  const pathHint = document.getElementById('settings-path-hint');
  if (pathHint) {
    pathHint.textContent = settingsCache.settings_path
      ? `Config file: ${settingsCache.settings_path}`
      : '';
  }
}

function applySettingsToForm(cfg) {
  setValue('cfg-webhook-url', cfg.webhook_url || '');
  setValue('cfg-webhook-token', cfg.webhook_token || '');
  setValue('cfg-webhook-timeout', cfg.webhook_timeout || 30000);
  setValue('cfg-ai-provider', cfg.ai_provider || 'openai');
  setValue('cfg-ai-model', cfg.ai_model || 'gpt-4o');
  setValue('cfg-temperature', cfg.temperature ?? 0.7);
  setValue('cfg-max-tokens', cfg.max_tokens || 2048);
  setValue('cfg-default-article-schedule-time', cfg.default_article_schedule_week || 'this_week');
  setValue('cfg-default-article-custom-start-date', cfg.default_article_custom_start_date || '');
  setValue('cfg-meta-system-user-token', cfg.meta_system_user_token || '');
  setValue('cfg-meta-app-secret', cfg.meta_app_secret || '');
  setValue('cfg-meta-graph-version', cfg.meta_graph_version || 'v21.0');
  setValue('cfg-sheets-spreadsheet-id', cfg.sheets_spreadsheet_id || '');
  setValue('cfg-sheets-tab-name', cfg.sheets_tab_name || 'Runs');
  setValue('cfg-sheets-poll-interval', cfg.sheets_poll_interval_ms ?? 300);

  const saPathEl = document.getElementById('cfg-sheets-sa-path');
  if (saPathEl) {
    saPathEl.textContent = cfg.sheets_service_account_path || 'No file selected';
  }

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

function maskToken(token) {
  const value = String(token || '');
  if (!value) return '—';
  if (value.length <= 10) return '•'.repeat(Math.min(value.length, 8));
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSocialAccounts() {
  const list = document.getElementById('social-accounts-list');
  const empty = document.getElementById('social-accounts-empty');
  if (!list || !empty) return;

  list.innerHTML = '';

  if (!socialAccounts.length) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  socialAccounts.forEach((account) => {
    const platform = account.platform || 'instagram';
    const item = document.createElement('div');
    item.className = 'social-account-item';
    item.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1 space-y-1.5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="social-account-platform ${escapeHtml(platform)}">${escapeHtml(PLATFORM_LABELS[platform] || platform)}</span>
            <span class="text-sm font-medium text-slate-200 truncate">${escapeHtml(account.label || 'Untitled')}</span>
            ${account.source === 'meta_sync' ? '<span class="text-xs text-accent">Synced</span>' : ''}
          </div>
          <p class="social-account-meta">ID: ${escapeHtml(account.account_id || '—')}</p>
          <p class="social-account-token-mask">Token: ${escapeHtml(maskToken(account.access_token))}</p>
          ${account.notes ? `<p class="text-xs text-muted">${escapeHtml(account.notes)}</p>` : ''}
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button type="button" class="btn-ghost text-xs btn-edit-social-account" data-id="${escapeHtml(account.id)}">Edit</button>
          <button type="button" class="btn-ghost text-xs text-danger btn-remove-social-account" data-id="${escapeHtml(account.id)}">Remove</button>
        </div>
      </div>
    `;

    item.querySelector('.btn-edit-social-account')?.addEventListener('click', () => {
      openSocialAccountForm(account);
    });

    item.querySelector('.btn-remove-social-account')?.addEventListener('click', () => {
      removeSocialAccount(account.id);
    });

    list.appendChild(item);
  });
}

function showSocialAccountForm() {
  const form = document.getElementById('social-account-form');
  if (form) form.classList.remove('hidden');
}

function hideSocialAccountForm() {
  const form = document.getElementById('social-account-form');
  if (form) form.classList.add('hidden');
  resetSocialAccountForm();
}

function resetSocialAccountForm() {
  setValue('social-account-edit-id', '');
  setValue('social-account-platform', 'instagram');
  setValue('social-account-label', '');
  setValue('social-account-account-id', '');
  setValue('social-account-token', '');
  setValue('social-account-notes', '');
  const title = document.getElementById('social-account-form-title');
  if (title) title.textContent = 'Add Account';
}

function openSocialAccountForm(account) {
  const title = document.getElementById('social-account-form-title');
  if (title) title.textContent = account ? 'Edit Account' : 'Add Account';

  setValue('social-account-edit-id', account?.id || '');
  setValue('social-account-platform', account?.platform || 'instagram');
  setValue('social-account-label', account?.label || '');
  setValue('social-account-account-id', account?.account_id || '');
  setValue('social-account-token', account?.access_token || '');
  setValue('social-account-notes', account?.notes || '');
  showSocialAccountForm();
}

function collectSocialAccountFromForm() {
  const id = document.getElementById('social-account-edit-id')?.value.trim() || '';
  const platform = document.getElementById('social-account-platform')?.value || 'instagram';
  const label = document.getElementById('social-account-label')?.value.trim() || '';
  const accountId = document.getElementById('social-account-account-id')?.value.trim() || '';
  const accessToken = document.getElementById('social-account-token')?.value.trim() || '';
  const notes = document.getElementById('social-account-notes')?.value.trim() || '';

  return {
    id: id || `acc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform,
    label,
    account_id: accountId,
    access_token: accessToken,
    notes
  };
}

function saveSocialAccountFromForm() {
  const account = collectSocialAccountFromForm();

  if (!account.label) {
    showToast('error', 'Account label is required.');
    document.getElementById('social-account-label')?.focus();
    return;
  }
  if (!account.account_id) {
    showToast('error', 'Account / Page ID is required.');
    document.getElementById('social-account-account-id')?.focus();
    return;
  }
  if (!account.access_token) {
    showToast('error', 'Access token is required.');
    document.getElementById('social-account-token')?.focus();
    return;
  }

  const editId = document.getElementById('social-account-edit-id')?.value.trim() || '';
  if (editId) {
    const idx = socialAccounts.findIndex((a) => a.id === editId);
    if (idx >= 0) socialAccounts[idx] = account;
    else socialAccounts.push(account);
  } else {
    socialAccounts.push(account);
  }

  renderSocialAccounts();
  hideSocialAccountForm();
  showToast('success', editId ? 'Account updated (save settings to persist)' : 'Account added (save settings to persist)');
}

function removeSocialAccount(id) {
  if (!confirm('Remove this social account from local config?')) return;
  socialAccounts = socialAccounts.filter((a) => a.id !== id);
  renderSocialAccounts();
  const editingId = document.getElementById('social-account-edit-id')?.value.trim();
  if (editingId === id) hideSocialAccountForm();
  showToast('info', 'Account removed (save settings to persist)');
}

// Wire toggle buttons
['cfg-dark-mode', 'cfg-animations', 'cfg-compact', 'cfg-debug-logs', 'cfg-verbose'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    const current = el.getAttribute('aria-checked') === 'true';
    el.setAttribute('aria-checked', String(!current));

    if (id === 'cfg-dark-mode' || id === 'cfg-animations' || id === 'cfg-compact') {
      applyInterfacePreviewFromToggles();
    }
  });
});

document.getElementById('btn-add-social-account')?.addEventListener('click', () => {
  openSocialAccountForm(null);
});

document.getElementById('btn-cancel-social-account')?.addEventListener('click', () => {
  hideSocialAccountForm();
});

document.getElementById('btn-save-social-account')?.addEventListener('click', () => {
  saveSocialAccountFromForm();
});

let isMetaSyncing = false;

document.getElementById('btn-sync-meta-accounts')?.addEventListener('click', async () => {
  if (isMetaSyncing) return;

  const systemUserToken = document.getElementById('cfg-meta-system-user-token')?.value.trim() || '';
  const appSecret = document.getElementById('cfg-meta-app-secret')?.value.trim() || '';
  const graphVersion = document.getElementById('cfg-meta-graph-version')?.value.trim() || 'v21.0';
  const btn = document.getElementById('btn-sync-meta-accounts');
  const btnText = document.getElementById('btn-sync-meta-accounts-text');

  if (!systemUserToken) {
    showToast('error', 'Paste your Meta System User token first.');
    document.getElementById('cfg-meta-system-user-token')?.focus();
    return;
  }

  isMetaSyncing = true;
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Syncing...';
  showToast('info', 'Syncing Facebook & Instagram from Meta...');

  try {
    // Persist master credentials first so reload keeps them even if sync fails mid-way
    await window.api.configSet({
      meta_system_user_token: systemUserToken,
      meta_app_secret: appSecret,
      meta_graph_version: graphVersion
    });

    const result = await window.api.metaSyncAccounts({
      systemUserToken,
      appSecret,
      graphVersion,
      persist: true
    });

    if (!result.success) {
      showToast('error', result.message || 'Meta sync failed.');
      return;
    }

    socialAccounts = Array.isArray(result.accounts) ? result.accounts.slice() : [];
    settingsCache = {
      ...settingsCache,
      meta_system_user_token: systemUserToken,
      meta_app_secret: appSecret,
      meta_graph_version: graphVersion,
      social_accounts: socialAccounts
    };
    renderSocialAccounts();
    hideSocialAccountForm();
    showToast('success', result.message || 'Accounts synced.');
  } catch (err) {
    showToast('error', 'Meta sync failed: ' + (err.message || err));
  } finally {
    isMetaSyncing = false;
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Sync Facebook & Instagram';
  }
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
    default_article_schedule_time: '',
    default_article_schedule_week: document.getElementById('cfg-default-article-schedule-time').value,
    default_article_custom_start_date: document.getElementById('cfg-default-article-custom-start-date').value.trim(),
    dark_mode: getToggle('cfg-dark-mode'),
    animations_enabled: getToggle('cfg-animations'),
    compact_mode: getToggle('cfg-compact'),
    debug_logs: getToggle('cfg-debug-logs'),
    verbose_mode: getToggle('cfg-verbose'),
    social_accounts: socialAccounts,
    meta_system_user_token: document.getElementById('cfg-meta-system-user-token')?.value.trim() || '',
    meta_app_secret: document.getElementById('cfg-meta-app-secret')?.value.trim() || '',
    meta_graph_version: document.getElementById('cfg-meta-graph-version')?.value.trim() || 'v21.0',
    sheets_spreadsheet_id: document.getElementById('cfg-sheets-spreadsheet-id')?.value.trim() || '',
    sheets_tab_name: document.getElementById('cfg-sheets-tab-name')?.value.trim() || 'Runs',
    sheets_poll_interval_ms: Math.max(300, parseInt(document.getElementById('cfg-sheets-poll-interval')?.value, 10) || 300)
  };

  await window.api.configSet(data);
  settingsCache = { ...settingsCache, ...data };
  applyInterfaceSettings(settingsCache);
  showToast('success', 'Settings saved');
});

document.getElementById('btn-pick-sheets-sa')?.addEventListener('click', async () => {
  const result = await window.api.sheetsPickServiceAccount();
  if (result.canceled) return;
  if (!result.success) {
    showToast('error', result.message || 'Failed to import service account JSON.');
    return;
  }
  const saPathEl = document.getElementById('cfg-sheets-sa-path');
  if (saPathEl) saPathEl.textContent = result.path;
  settingsCache.sheets_service_account_path = result.path;
  showToast('success', 'Service account JSON saved');
});

document.getElementById('btn-test-sheets')?.addEventListener('click', async () => {
  await window.api.configSet({
    sheets_spreadsheet_id: document.getElementById('cfg-sheets-spreadsheet-id')?.value.trim() || '',
    sheets_tab_name: document.getElementById('cfg-sheets-tab-name')?.value.trim() || 'Runs',
    sheets_poll_interval_ms: Math.max(300, parseInt(document.getElementById('cfg-sheets-poll-interval')?.value, 10) || 300)
  });
  showToast('info', 'Testing Google Sheets…');
  const result = await window.api.sheetsTest();
  if (result.success) showToast('success', result.message);
  else showToast('error', result.message || 'Sheets test failed.');
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

// Apply interface preferences on app startup, even before opening Settings.
(async () => {
  try {
    settingsCache = await window.api.configGet();
    applyInterfaceSettings(settingsCache);
  } catch {
    // No-op: keep current defaults if settings cannot be read.
  }
})();
