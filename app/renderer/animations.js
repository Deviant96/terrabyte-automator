'use strict';

// ─── Screen Navigation ────────────────────────────────────────────────────────
const navItems = document.querySelectorAll('.nav-item[data-screen]');
const screens = document.querySelectorAll('.screen');

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const target = item.dataset.screen;
    switchScreen(target);
  });
});

function switchScreen(name) {
  navItems.forEach(n => n.classList.toggle('active', n.dataset.screen === name));
  screens.forEach(s => {
    const active = s.id === 'screen-' + name;
    s.classList.toggle('active', active);
    s.classList.toggle('hidden', !active);
  });

  // Load data for specific screens
  if (name === 'history' && typeof loadHistory === 'function') loadHistory();
  if (name === 'settings' && typeof loadSettings === 'function') loadSettings();
  if (name === 'runs' && typeof startRunsPolling === 'function') startRunsPolling();
  if (name !== 'runs' && typeof stopRunsPolling === 'function') stopRunsPolling();
  if (name === 'sheet-editor' && typeof loadSheetEditor === 'function') loadSheetEditor();
}

// ─── Keyboard shortcut: Ctrl+, opens settings ─────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault();
    switchScreen('settings');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
    e.preventDefault();
    switchScreen('history');
  }
  if (e.key === 'Escape') {
    if (typeof sheetEditorHandleEscape === 'function' && sheetEditorHandleEscape()) return;
    document.getElementById('modal-expand')?.classList.add('hidden');
    document.getElementById('modal-run-details')?.classList.add('hidden');
  }
});

// ─── Initial load ─────────────────────────────────────────────────────────────
(async () => {
  // Check if webhook is configured on startup
  const cfg = await window.api.configGet();
  if (!cfg.webhook_url) {
    setTimeout(() => {
      showToast('warning', 'Webhook URL not configured. Visit Settings.');
    }, 800);
  }
})();
