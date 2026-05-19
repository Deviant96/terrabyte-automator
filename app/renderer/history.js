/* global marked */
'use strict';

let allRequests = [];

const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const historySearch = document.getElementById('history-search');
const historyFilterStatus = document.getElementById('history-filter-status');
const historySort = document.getElementById('history-sort');
const btnExportHistory = document.getElementById('btn-export-history');

function formatScheduleMode(mode) {
  switch (mode) {
    case 'next_week':
      return 'Next week';
    case 'custom_start_date':
      return 'Custom start date';
    default:
      return 'This week';
  }
}

function formatScheduleStartDate(req) {
  const rawDate = req.article_schedule_start_date || req.schedule_date || '';
  return rawDate ? new Date(rawDate.replace(' ', 'T')).toLocaleString() : '—';
}

async function loadHistory() {
  allRequests = await window.api.requestGetAll();
  renderHistory();
}

function renderHistory() {
  const search = historySearch.value.toLowerCase();
  const statusFilter = historyFilterStatus.value;
  const sort = historySort.value;

  let rows = allRequests.slice();

  if (search) {
    rows = rows.filter(r =>
      (r.prompt || '').toLowerCase().includes(search) ||
      (r.keyword || '').toLowerCase().includes(search) ||
      (r.request_id || '').toLowerCase().includes(search)
    );
  }
  if (statusFilter) {
    rows = rows.filter(r => r.status === statusFilter);
  }
  rows.sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db2 = new Date(b.created_at).getTime();
    return sort === 'asc' ? da - db2 : db2 - da;
  });

  historyList.innerHTML = '';

  if (!rows.length) {
    historyEmpty.classList.remove('hidden');
    return;
  }
  historyEmpty.classList.add('hidden');

  rows.forEach((req, i) => {
    const item = document.createElement('div');
    item.className = 'history-item animate-fadein';
    item.style.animationDelay = (i * 0.04) + 's';

    const date = req.created_at ? new Date(req.created_at).toLocaleString() : '';
    const promptSnippet = (req.prompt || '').slice(0, 120) + ((req.prompt || '').length > 120 ? '...' : '');
    const scheduleMode = formatScheduleMode(req.article_schedule_time || 'this_week');
    const scheduleStartDate = formatScheduleStartDate(req);

    item.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-mono text-accent">${req.request_id}</span>
            <span class="status-badge status-${req.status}">${req.status}</span>
            ${req.platform ? '<span class="text-xs text-muted">• ' + req.platform + '</span>' : ''}
            ${req.urgent ? '<span class="text-xs text-warning">• Urgent</span>' : ''}
          </div>
          <p class="text-sm text-slate-300 truncate">${promptSnippet}</p>
          ${req.keyword ? '<p class="text-xs text-muted mt-1"># ' + req.keyword + '</p>' : ''}
          <div class="mt-2 flex flex-wrap gap-2 text-xs">
            <span class="schedule-chip">Mode: ${scheduleMode}</span>
            <span class="schedule-chip">Start: ${scheduleStartDate}</span>
          </div>
        </div>
        <div class="flex-shrink-0 text-right">
          <p class="text-xs text-muted">${date}</p>
          <div class="flex gap-2 mt-2 justify-end">
            ${req.output ? '<button class="btn-ghost text-xs btn-view-output" data-id="' + req.request_id + '">View</button>' : ''}
            <button class="btn-ghost text-xs text-danger btn-delete-history" data-id="' + req.request_id + '">Delete</button>
          </div>
        </div>
      </div>
      ${req.error_message ? '<p class="text-xs text-danger mt-2 bg-danger/10 px-3 py-1 rounded-lg">' + req.error_message + '</p>' : ''}
    `;

    // View output
    item.querySelector('.btn-view-output')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openOutputModal(req.output, req.request_id);
    });

    // Delete
    item.querySelector('.btn-delete-history')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.requestDelete(req.request_id);
      allRequests = allRequests.filter(r => r.request_id !== req.request_id);
      renderHistory();
      showToast('info', 'Request deleted');
    });

    historyList.appendChild(item);
  });
}

function openOutputModal(output, requestId) {
  const modal = document.getElementById('modal-expand');
  const modalContent = document.getElementById('modal-output-content');
  modalContent.innerHTML = marked.parse(output || '');
  document.querySelector('#modal-expand .font-semibold').textContent = 'AI Output — ' + requestId;
  modal.classList.remove('hidden');
}

// Filters
historySearch.addEventListener('input', renderHistory);
historyFilterStatus.addEventListener('change', renderHistory);
historySort.addEventListener('change', renderHistory);

// Export
btnExportHistory.addEventListener('click', async () => {
  const ok = await window.api.dbExport();
  if (ok) showToast('success', 'History exported');
  else showToast('info', 'Export cancelled');
});

// Auto-load when history screen is shown
window.loadHistory = loadHistory;
window.renderHistory = renderHistory;
