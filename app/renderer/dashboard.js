/* global marked, flatpickr */
'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
let currentRequestId = null;
let isSubmitting = false;
let urgentActive = false;
let schedulePicker = null;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const btnSubmit = document.getElementById('btn-submit');
const btnSubmitText = document.getElementById('btn-submit-text');
const btnSubmitSpinner = document.getElementById('btn-submit-spinner');
const toggleUrgent = document.getElementById('toggle-urgent');
const promptField = document.getElementById('field-prompt');

const statusEmpty = document.getElementById('status-empty');
const statusContent = document.getElementById('status-content');
const statusRequestId = document.getElementById('status-request-id');
const statusBadge = document.getElementById('status-badge');
const statusPlatform = document.getElementById('status-platform');
const statusErrorRow = document.getElementById('status-error-row');
const statusErrorMsg = document.getElementById('status-error-msg');

const outputEmpty = document.getElementById('output-empty');
const outputSkeleton = document.getElementById('output-skeleton');
const outputContent = document.getElementById('output-content');
const btnCopyOutput = document.getElementById('btn-copy-output');
const btnExpandOutput = document.getElementById('btn-expand-output');

const modalExpand = document.getElementById('modal-expand');
const modalOutputContent = document.getElementById('modal-output-content');
const btnCloseModal = document.getElementById('btn-close-modal');

// ─── Flatpickr datetime picker ───────────────────────────────────────────────
schedulePicker = flatpickr('#field-schedule', {
  enableTime: true,
  dateFormat: 'Y-m-d H:i',
  time_24hr: true,
  minDate: 'today',
  disableMobile: true,
  position: 'auto',
  static: false
});

// ─── Prompt action buttons ───────────────────────────────────────────────────
document.getElementById('btn-prompt-clear').addEventListener('click', () => {
  promptField.value = '';
  promptField.focus();
});

document.getElementById('btn-prompt-copy').addEventListener('click', async () => {
  const text = promptField.value;
  if (!text.trim()) { showToast('warning', 'Nothing to copy.'); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast('success', 'Prompt copied');
  } catch { showToast('error', 'Copy failed'); }
});

document.getElementById('btn-prompt-paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      const start = promptField.selectionStart;
      const end = promptField.selectionEnd;
      const before = promptField.value.slice(0, start);
      const after = promptField.value.slice(end);
      promptField.value = before + text + after;
      promptField.selectionStart = promptField.selectionEnd = start + text.length;
      promptField.focus();
    }
  } catch { showToast('error', 'Paste failed — clipboard access denied.'); }
});

// ─── Urgent toggle ───────────────────────────────────────────────────────────
toggleUrgent.addEventListener('click', () => {
  urgentActive = !urgentActive;
  toggleUrgent.setAttribute('aria-checked', String(urgentActive));
});

// ─── Submit ──────────────────────────────────────────────────────────────────
btnSubmit.addEventListener('click', async () => {
  if (isSubmitting) return;

  const prompt = promptField.value.trim();
  const platform = document.getElementById('field-platform').value;
  const keyword = document.getElementById('field-keyword').value.trim();
  const scheduleDate = schedulePicker ? schedulePicker.input.value : document.getElementById('field-schedule').value;

  if (!prompt) {
    showToast('error', 'Prompt is required.');
    promptField.focus();
    return;
  }

  // Check webhook config
  const cfg = await window.api.configGet();
  if (!cfg.webhook_url) {
    showToast('error', 'Webhook URL missing. Please configure it in Settings.');
    return;
  }

  setSubmitting(true);

  try {
    const result = await window.api.requestSubmit({
      prompt,
      platform,
      keyword,
      urgent: urgentActive,
      schedule_date: scheduleDate
    });

    currentRequestId = result.request_id;
    updateStatusPanel({ request_id: result.request_id, status: 'Pending', platform });
    showOutputSkeleton();
    showToast('success', 'Request submitted successfully');
  } catch (err) {
    showToast('error', 'Submission failed: ' + err.message);
  } finally {
    setSubmitting(false);
  }
});

function setSubmitting(state) {
  isSubmitting = state;
  btnSubmit.disabled = state;
  btnSubmitText.textContent = state ? 'Sending...' : 'Submit Request';
  btnSubmitSpinner.classList.toggle('hidden', !state);
}

// ─── Status Panel ─────────────────────────────────────────────────────────────
function updateStatusPanel(data) {
  statusEmpty.classList.add('hidden');
  statusContent.classList.remove('hidden');

  statusRequestId.textContent = data.request_id || '';
  statusPlatform.textContent = data.platform || '—';

  const badge = data.status || 'Pending';
  statusBadge.textContent = badge;
  statusBadge.className = 'status-badge status-' + badge;

  if (data.error_message) {
    statusErrorRow.classList.remove('hidden');
    statusErrorMsg.textContent = data.error_message;
  } else {
    statusErrorRow.classList.add('hidden');
  }
}

// ─── Output Panel ─────────────────────────────────────────────────────────────
function showOutputSkeleton() {
  outputEmpty.classList.add('hidden');
  outputSkeleton.classList.remove('hidden');
  outputContent.classList.add('hidden');
  btnCopyOutput.classList.add('hidden');
  btnExpandOutput.classList.add('hidden');
}

function showOutputContent(md) {
  outputSkeleton.classList.add('hidden');
  outputEmpty.classList.add('hidden');
  outputContent.classList.remove('hidden');
  btnCopyOutput.classList.remove('hidden');
  btnExpandOutput.classList.remove('hidden');
  outputContent.innerHTML = marked.parse(md || '');
}

function showOutputEmpty() {
  outputEmpty.classList.remove('hidden');
  outputSkeleton.classList.add('hidden');
  outputContent.classList.add('hidden');
  btnCopyOutput.classList.add('hidden');
  btnExpandOutput.classList.add('hidden');
}

// ─── Live updates from main process ──────────────────────────────────────────
window.api.onRequestUpdate((data) => {
  if (!currentRequestId || data.request_id !== currentRequestId) return;

  updateStatusPanel(data);

  if (data.status === 'Completed') {
    showOutputContent(data.output || '');
    // refresh history if open
    if (typeof renderHistory === 'function') renderHistory();
  } else if (data.status === 'Error') {
    showOutputEmpty();
    if (typeof renderHistory === 'function') renderHistory();
  }
});

// ─── Copy ────────────────────────────────────────────────────────────────────
btnCopyOutput.addEventListener('click', async () => {
  const text = outputContent.innerText;
  try {
    await navigator.clipboard.writeText(text);
    showToast('success', 'Copied to clipboard');
  } catch {
    showToast('error', 'Copy failed');
  }
});

// ─── Expand modal ─────────────────────────────────────────────────────────────
btnExpandOutput.addEventListener('click', () => {
  modalOutputContent.innerHTML = outputContent.innerHTML;
  modalExpand.classList.remove('hidden');
});
btnCloseModal.addEventListener('click', () => {
  modalExpand.classList.add('hidden');
});
modalExpand.addEventListener('click', (e) => {
  if (e.target === modalExpand) modalExpand.classList.add('hidden');
});

// ─── Toast (global) ──────────────────────────────────────────────────────────
function showToast(type, message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;

  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };

  toast.innerHTML = (icons[type] || icons.info) + '<span>' + message + '</span>';
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 4000);
}

// Make showToast global
window.showToast = showToast;

// ─── Listen for toasts from main process ─────────────────────────────────────
window.api.onToast((data) => showToast(data.type || 'info', data.message));
