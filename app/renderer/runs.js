'use strict';

let runsPollTimer = null;
let runsPollIntervalMs = 300;
let runsLoading = false;

const runsList = document.getElementById('runs-list');
const runsEmpty = document.getElementById('runs-empty');
const runsError = document.getElementById('runs-error');
const runsPollHint = document.getElementById('runs-poll-hint');
const btnRefreshRuns = document.getElementById('btn-refresh-runs');
const modalRunDetails = document.getElementById('modal-run-details');
const runDetailsContent = document.getElementById('run-details-content');
const btnCloseRunDetails = document.getElementById('btn-close-run-details');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function runStatusClass(status) {
  const value = String(status || '').toLowerCase();
  if (['success', 'ok', 'completed', 'done', 'finished'].includes(value)) return 'workflow-status-success';
  if (['error', 'failed', 'fail'].includes(value)) return 'workflow-status-error';
  if (['pending', 'processing', 'progress', 'in_progress', 'running', 'queued'].includes(value)) return 'workflow-status-progress';
  return 'workflow-status-neutral';
}

async function refreshRunsPollInterval() {
  try {
    const cfg = await window.api.configGet();
    const value = Number(cfg.sheets_poll_interval_ms);
    runsPollIntervalMs = Number.isFinite(value) && value >= 300 ? value : 300;
  } catch {
    runsPollIntervalMs = 300;
  }
}

function openRunDetails(run) {
  if (!runDetailsContent || !modalRunDetails) return;
  runDetailsContent.innerHTML = `
    <div class="flex items-center gap-2 mb-1">
      <span class="workflow-status-badge ${runStatusClass(run.status)}">${escapeHtml(run.status || '—')}</span>
      <span class="text-xs text-muted">${escapeHtml(run.process || '')}</span>
    </div>
    <div class="run-detail-grid">
      <div><span class="text-xs text-muted">req_id</span><p class="font-mono text-accent text-xs break-all">${escapeHtml(run.req_id || '—')}</p></div>
      <div><span class="text-xs text-muted">created_at</span><p class="text-slate-200">${escapeHtml(run.created_at || '—')}</p></div>
      <div><span class="text-xs text-muted">schedule_date</span><p class="text-slate-200">${escapeHtml(run.schedule_date || '—')}</p></div>
      <div><span class="text-xs text-muted">process</span><p class="text-slate-200">${escapeHtml(run.process || '—')}</p></div>
      <div><span class="text-xs text-muted">status</span><p class="text-slate-200">${escapeHtml(run.status || '—')}</p></div>
      <div class="sm:col-span-2"><span class="text-xs text-muted">error</span><p class="${run.error ? 'text-danger' : 'text-slate-200'}">${escapeHtml(run.error || '—')}</p></div>
    </div>
  `;
  modalRunDetails.classList.remove('hidden');
}

function renderRuns(runs) {
  if (!runsList || !runsEmpty) return;
  runsList.innerHTML = '';

  if (!runs.length) {
    runsEmpty.classList.remove('hidden');
    return;
  }
  runsEmpty.classList.add('hidden');

  runs.forEach((run) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1 space-y-1.5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-mono text-accent">${escapeHtml(run.req_id)}</span>
            <span class="workflow-status-badge ${runStatusClass(run.status)}">${escapeHtml(run.status || '—')}</span>
            ${run.process ? `<span class="text-xs text-muted">· ${escapeHtml(run.process)}</span>` : ''}
          </div>
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="schedule-chip">Created: ${escapeHtml(run.created_at || '—')}</span>
            <span class="schedule-chip">Schedule: ${escapeHtml(run.schedule_date || '—')}</span>
          </div>
          ${run.error ? `<p class="text-xs text-danger mt-1">${escapeHtml(run.error)}</p>` : ''}
        </div>
        <span class="text-xs text-accent flex-shrink-0">Open details</span>
      </div>
    `;
    item.addEventListener('click', () => openRunDetails(run));
    runsList.appendChild(item);
  });
}

async function loadRuns({ force = false } = {}) {
  if (runsLoading) return;
  runsLoading = true;
  if (runsError) {
    runsError.classList.add('hidden');
    runsError.textContent = '';
  }
  if (runsPollHint) runsPollHint.textContent = force ? 'Refreshing…' : `Auto every ${runsPollIntervalMs}ms`;

  try {
    const result = await window.api.sheetsGetLatest({ limit: 10, force });
    if (!result.success) {
      if (runsError) {
        runsError.textContent = result.message || 'Failed to load runs.';
        runsError.classList.remove('hidden');
      }
      renderRuns([]);
      if (runsPollHint) runsPollHint.textContent = 'Error';
      return;
    }
    renderRuns(result.runs || []);
    if (runsPollHint) runsPollHint.textContent = `Auto every ${runsPollIntervalMs}ms`;
  } catch (err) {
    if (runsError) {
      runsError.textContent = err.message || 'Failed to load runs.';
      runsError.classList.remove('hidden');
    }
  } finally {
    runsLoading = false;
  }
}

function stopRunsPolling() {
  if (runsPollTimer) {
    clearInterval(runsPollTimer);
    runsPollTimer = null;
  }
}

async function startRunsPolling() {
  stopRunsPolling();
  await refreshRunsPollInterval();
  await loadRuns({ force: true });
  runsPollTimer = setInterval(() => {
    loadRuns({ force: false });
  }, runsPollIntervalMs);
}

btnRefreshRuns?.addEventListener('click', () => {
  loadRuns({ force: true });
});

btnCloseRunDetails?.addEventListener('click', () => {
  modalRunDetails?.classList.add('hidden');
});

modalRunDetails?.addEventListener('click', (e) => {
  if (e.target === modalRunDetails) modalRunDetails.classList.add('hidden');
});

window.loadRuns = loadRuns;
window.startRunsPolling = startRunsPolling;
window.stopRunsPolling = stopRunsPolling;
