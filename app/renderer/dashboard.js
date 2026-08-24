/* global marked, flatpickr */
'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
let currentRequestId = null;
let isSubmitting = false;
let customStartPicker = null;
let keywords = [];
let dragKeywordIndex = null;
const MAX_KEYWORDS = 5;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const btnSubmit = document.getElementById('btn-submit');
const btnSubmitText = document.getElementById('btn-submit-text');
const btnSubmitSpinner = document.getElementById('btn-submit-spinner');
const keywordChipBox = document.getElementById('keyword-chip-box');
const keywordChipsEl = document.getElementById('keyword-chips');
const keywordInput = document.getElementById('field-keyword-input');
const keywordCountEl = document.getElementById('keyword-count');
const keywordHintEl = document.getElementById('keyword-hint');
const btnKeywordClear = document.getElementById('btn-keyword-clear');
const btnKeywordCopy = document.getElementById('btn-keyword-copy');
const btnKeywordPaste = document.getElementById('btn-keyword-paste');
const scheduleModeField = document.getElementById('field-schedule-mode');
const weekTimeWrap = document.getElementById('week-time-wrap');
const weekTimeField = document.getElementById('field-week-time');
const customScheduleWrap = document.getElementById('custom-schedule-wrap');
const scheduleHint = document.getElementById('schedule-hint');
const schedulePreview = document.getElementById('schedule-preview');
const schedulePreviewList = document.getElementById('schedule-preview-list');
const btnSetArticleScheduleDefault = document.getElementById('btn-set-article-schedule-default');

const statusEmpty = document.getElementById('status-empty');
const statusContent = document.getElementById('status-content');
const statusRequestId = document.getElementById('status-request-id');
const statusBadge = document.getElementById('status-badge');
const statusErrorRow = document.getElementById('status-error-row');
const statusErrorMsg = document.getElementById('status-error-msg');

const outputEmpty = document.getElementById('output-empty');
const outputSkeleton = document.getElementById('output-skeleton');
const outputContent = document.getElementById('output-content');
const responseStatusBadge = document.getElementById('response-status-badge');
const responseProcess = document.getElementById('response-process');
const responseRequestId = document.getElementById('response-request-id');
const responseScheduleDate = document.getElementById('response-schedule-date');
const responseCreatedAt = document.getElementById('response-created-at');
const responseErrorWrap = document.getElementById('response-error-wrap');
const responseError = document.getElementById('response-error');
const sheetPollHint = document.getElementById('sheet-poll-hint');
const btnCopyResponseId = document.getElementById('btn-copy-response-id');

const modalExpand = document.getElementById('modal-expand');
const modalOutputContent = document.getElementById('modal-output-content');
const btnCloseModal = document.getElementById('btn-close-modal');

let sheetPollTimer = null;
let sheetPollIntervalMs = 300;
let sheetPolling = false;

// ─── Flatpickr datetime picker ───────────────────────────────────────────────
customStartPicker = flatpickr('#field-article-start-date', {
  enableTime: true,
  dateFormat: 'Y-m-d H:i',
  time_24hr: true,
  minDate: 'today',
  disableMobile: true,
  position: 'auto',
  static: false
});

const scheduleHintsByMode = {
  this_week: 'Pick time only for this week.',
  next_week: 'Pick time only for next week.',
  custom_start_date: 'Pick a custom start date and time.'
};

function formatLocalDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function nextMondayAtNine(now = new Date()) {
  const next = new Date(now);
  const day = next.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  next.setDate(next.getDate() + daysUntilMonday);
  next.setHours(9, 0, 0, 0);
  return next;
}

function parseTimeParts(input) {
  const match = /^(\d{1,2}):(\d{2})$/.exec((input || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function getCurrentTimeParts() {
  const fromInput = parseTimeParts(weekTimeField?.value || '');
  if (fromInput) return fromInput;

  const selected = customStartPicker?.selectedDates?.[0] || null;
  if (selected) {
    return { hours: selected.getHours(), minutes: selected.getMinutes() };
  }

  const now = new Date();
  return { hours: now.getHours(), minutes: now.getMinutes() };
}

function getModeDefaultDate(mode, timeInput) {
  const parsed = parseTimeParts(timeInput || '');
  const time = getCurrentTimeParts();
  const hours = parsed ? parsed.hours : time.hours;
  const minutes = parsed ? parsed.minutes : time.minutes;

  if (mode === 'next_week') {
    const nextWeek = nextMondayAtNine();
    nextWeek.setHours(hours, minutes, 0, 0);
    return nextWeek;
  }

  if (mode === 'this_week') {
    const thisWeek = new Date();
    thisWeek.setHours(hours, minutes, 0, 0);
    return thisWeek;
  }

  if (mode === 'custom_start_date') {
    const current = customStartPicker?.selectedDates?.[0] ? new Date(customStartPicker.selectedDates[0]) : new Date();
    current.setHours(time.hours, time.minutes, 0, 0);
    return current;
  }

  return null;
}

function resolveScheduleStartDate(mode, rawInput) {
  if (mode === 'custom_start_date') {
    return rawInput || '';
  }

  const time = parseTimeParts(rawInput) || getCurrentTimeParts();
  const baseDate = mode === 'next_week' ? nextMondayAtNine() : new Date();
  baseDate.setHours(time.hours, time.minutes, 0, 0);
  return formatLocalDateTime(baseDate);
}

function updateScheduleModeUi(mode) {
  const isCustom = mode === 'custom_start_date';
  weekTimeWrap.classList.toggle('hidden', isCustom);
  customScheduleWrap.classList.toggle('hidden', !isCustom);
  scheduleHint.textContent = scheduleHintsByMode[mode] || scheduleHintsByMode.this_week;
  updateSchedulePreview();
}

function applyModeDefaultDate(mode) {
  const nextDate = getModeDefaultDate(mode, weekTimeField?.value || '');
  if (nextDate) {
    const hh = String(nextDate.getHours()).padStart(2, '0');
    const mm = String(nextDate.getMinutes()).padStart(2, '0');
    if (weekTimeField) weekTimeField.value = `${hh}:${mm}`;
    if (customStartPicker && mode === 'custom_start_date') {
      customStartPicker.setDate(nextDate, true);
    }
  }
  updateSchedulePreview();
}

scheduleModeField.addEventListener('change', () => {
  const mode = scheduleModeField.value;
  updateScheduleModeUi(mode);
  applyModeDefaultDate(mode);
});

weekTimeField?.addEventListener('input', updateSchedulePreview);
weekTimeField?.addEventListener('change', updateSchedulePreview);

if (customStartPicker?.config?.onChange) {
  customStartPicker.config.onChange.push(() => {
    updateScheduleModeUi(scheduleModeField.value);
    updateSchedulePreview();
  });
}

async function applyScheduleDefaults() {
  const cfg = await window.api.configGet();
  const defaultMode = cfg.default_article_schedule_week || 'this_week';
  const defaultTimeValue = cfg.default_article_schedule_time || '';
  const defaultCustomStart = cfg.default_article_custom_start_date || '';

  scheduleModeField.value = defaultMode;
  updateScheduleModeUi(defaultMode);

  if (defaultMode === 'custom_start_date' && defaultCustomStart) {
    const parsedDate = new Date(defaultCustomStart.replace(' ', 'T'));
    if (!Number.isNaN(parsedDate.getTime())) {
      if (customStartPicker) customStartPicker.setDate(parsedDate, true);
    }
  } else if (defaultTimeValue) {
    if (weekTimeField) weekTimeField.value = defaultTimeValue;
  }

  if (!weekTimeField?.value && !defaultCustomStart) {
    applyModeDefaultDate(defaultMode);
  }
}

async function saveCurrentScheduleAsDefault() {
  const articleScheduleTime = scheduleModeField.value || 'this_week';
  const scheduleInput = articleScheduleTime === 'custom_start_date'
    ? (customStartPicker ? customStartPicker.input.value.trim() : document.getElementById('field-article-start-date').value.trim())
    : (weekTimeField ? weekTimeField.value.trim() : '');

  if (!scheduleInput) {
    showToast('error', articleScheduleTime === 'custom_start_date' ? 'Pick a custom start date before saving it as the default.' : 'Pick a time before saving it as the default.');
    return;
  }

  const defaultScheduleStart = resolveScheduleStartDate(articleScheduleTime, scheduleInput);
  const defaultTimeValue = articleScheduleTime === 'custom_start_date' ? defaultScheduleStart : scheduleInput;

  await window.api.configSet({
    default_article_schedule_time: defaultTimeValue,
    default_article_schedule_week: articleScheduleTime,
    default_article_custom_start_date: defaultScheduleStart
  });

  const settingsModeField = document.getElementById('cfg-default-article-schedule-time');
  const settingsCustomDateField = document.getElementById('cfg-default-article-custom-start-date');
  if (settingsModeField) settingsModeField.value = articleScheduleTime;
  if (settingsCustomDateField) settingsCustomDateField.value = defaultScheduleStart;

  showToast('success', 'Default article schedule saved');
}

applyScheduleDefaults().then(() => {
  updateSubmitEnabled();
  updateSchedulePreview();
});

btnSetArticleScheduleDefault?.addEventListener('click', saveCurrentScheduleAsDefault);

// ─── Keyword chips ───────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeKeyword(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function parseKeywordChunks(raw) {
  return String(raw || '')
    .split(/[,\n]+/)
    .map(normalizeKeyword)
    .filter(Boolean);
}

function updateKeywordMeta() {
  if (keywordCountEl) keywordCountEl.textContent = `${keywords.length} / ${MAX_KEYWORDS}`;
  if (keywordChipBox) keywordChipBox.classList.toggle('is-full', keywords.length >= MAX_KEYWORDS);
  if (keywordHintEl) {
    if (keywords.length === MAX_KEYWORDS) {
      keywordHintEl.textContent = '5 keywords ready. Drag to reorder · double-click to edit.';
    } else {
      keywordHintEl.textContent = `Exactly 5 keywords required to submit. (${MAX_KEYWORDS - keywords.length} remaining)`;
    }
  }
  if (keywordInput) {
    keywordInput.disabled = keywords.length >= MAX_KEYWORDS;
    keywordInput.placeholder = keywords.length >= MAX_KEYWORDS
      ? 'Maximum 5 keywords reached'
      : 'Type a keyword, then comma or Enter...';
  }
  updateSubmitEnabled();
  updateSchedulePreview();
}

function updateSubmitEnabled() {
  if (!btnSubmit) return;
  const canSubmit = !isSubmitting && keywords.length === MAX_KEYWORDS;
  btnSubmit.disabled = !canSubmit;
}

function renderKeywordChips() {
  if (!keywordChipsEl) return;
  keywordChipsEl.innerHTML = '';

  keywords.forEach((keyword, index) => {
    const chip = document.createElement('div');
    chip.className = 'keyword-chip';
    chip.draggable = true;
    chip.dataset.index = String(index);
    chip.innerHTML = `
      <span class="keyword-chip-label" title="${escapeHtml(keyword)}">${escapeHtml(keyword)}</span>
      <button type="button" class="keyword-chip-remove" title="Remove" aria-label="Remove keyword">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    chip.querySelector('.keyword-chip-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      keywords.splice(index, 1);
      renderKeywordChips();
    });

    chip.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startKeywordEdit(index, chip);
    });

    chip.addEventListener('dragstart', (e) => {
      dragKeywordIndex = index;
      chip.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    });

    chip.addEventListener('dragend', () => {
      dragKeywordIndex = null;
      chip.classList.remove('is-dragging');
      keywordChipsEl.querySelectorAll('.keyword-chip').forEach((el) => el.classList.remove('is-drag-over'));
    });

    chip.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      chip.classList.add('is-drag-over');
    });

    chip.addEventListener('dragleave', () => {
      chip.classList.remove('is-drag-over');
    });

    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      chip.classList.remove('is-drag-over');
      const from = dragKeywordIndex;
      const to = index;
      if (from === null || from === to) return;
      const [moved] = keywords.splice(from, 1);
      keywords.splice(to, 0, moved);
      renderKeywordChips();
    });

    keywordChipsEl.appendChild(chip);
  });

  updateKeywordMeta();
}

function startKeywordEdit(index, chipEl) {
  const current = keywords[index];
  if (current == null) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'keyword-chip-edit';
  input.value = current;
  let finished = false;

  const finish = (commit) => {
    if (finished) return;
    finished = true;
    if (commit) {
      const next = normalizeKeyword(input.value);
      if (!next) {
        keywords.splice(index, 1);
      } else if (keywords.some((k, i) => i !== index && k.toLowerCase() === next.toLowerCase())) {
        showToast('warning', 'Duplicate keyword.');
      } else {
        keywords[index] = next;
      }
    }
    renderKeywordChips();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));

  chipEl.replaceWith(input);
  input.focus();
  input.select();
}

function addKeywordsFromRaw(raw, { silentFull = false } = {}) {
  const chunks = parseKeywordChunks(raw);
  if (!chunks.length) return 0;

  let added = 0;
  for (const chunk of chunks) {
    if (keywords.length >= MAX_KEYWORDS) {
      if (!silentFull) showToast('warning', 'Maximum 5 keywords allowed.');
      break;
    }
    if (keywords.some((k) => k.toLowerCase() === chunk.toLowerCase())) continue;
    keywords.push(chunk);
    added += 1;
  }

  if (added) renderKeywordChips();
  return added;
}

function commitComposerValue() {
  if (!keywordInput) return;
  const raw = keywordInput.value;
  keywordInput.value = '';
  addKeywordsFromRaw(raw);
}

keywordChipBox?.addEventListener('click', (e) => {
  if (e.target === keywordChipBox || e.target === keywordChipsEl) {
    keywordInput?.focus();
  }
});

keywordInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    commitComposerValue();
    return;
  }
  if (e.key === 'Backspace' && !keywordInput.value && keywords.length) {
    keywords.pop();
    renderKeywordChips();
  }
});

keywordInput?.addEventListener('input', () => {
  if (!keywordInput.value.includes(',')) return;
  const parts = keywordInput.value.split(',');
  const complete = parts.slice(0, -1).join(',');
  const rest = parts[parts.length - 1];
  keywordInput.value = rest;
  addKeywordsFromRaw(complete);
});

btnKeywordClear?.addEventListener('click', () => {
  keywords = [];
  if (keywordInput) keywordInput.value = '';
  renderKeywordChips();
  keywordInput?.focus();
});

btnKeywordCopy?.addEventListener('click', async () => {
  if (!keywords.length) { showToast('warning', 'Nothing to copy.'); return; }
  try {
    await navigator.clipboard.writeText(keywords.join(', '));
    showToast('success', 'Keywords copied');
  } catch { showToast('error', 'Copy failed'); }
});

btnKeywordPaste?.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    const added = addKeywordsFromRaw(text);
    if (!added && keywords.length >= MAX_KEYWORDS) {
      showToast('warning', 'Maximum 5 keywords allowed.');
    } else if (!added) {
      showToast('warning', 'No new keywords to add.');
    }
    keywordInput?.focus();
  } catch { showToast('error', 'Paste failed — clipboard access denied.'); }
});

// ─── Schedule preview (5 consecutive weekdays) ───────────────────────────────
function isWeekday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function parseLocalDateTime(value) {
  if (!value) return null;
  const parsed = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getScheduleStartDateObj() {
  const mode = scheduleModeField?.value || 'this_week';
  const scheduleInput = mode === 'custom_start_date'
    ? (customStartPicker ? customStartPicker.input.value.trim() : document.getElementById('field-article-start-date')?.value.trim() || '')
    : (weekTimeField ? weekTimeField.value.trim() : '');

  if (!scheduleInput) return null;
  const raw = resolveScheduleStartDate(mode, scheduleInput);
  return parseLocalDateTime(raw);
}

function buildWeekdayScheduleDates(startDate, count) {
  if (!startDate) return [];
  const dates = [];
  const cursor = new Date(startDate);
  // Advance off weekend so first slot is a weekday
  while (!isWeekday(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  while (dates.length < count) {
    if (isWeekday(cursor)) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function formatPreviewDate(date) {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function updateSchedulePreview() {
  if (!schedulePreview || !schedulePreviewList) return;

  if (!keywords.length) {
    schedulePreview.classList.add('hidden');
    schedulePreviewList.innerHTML = '';
    return;
  }

  schedulePreview.classList.remove('hidden');
  const start = getScheduleStartDateObj();
  const dates = start ? buildWeekdayScheduleDates(start, keywords.length) : [];

  schedulePreviewList.innerHTML = keywords.map((keyword, index) => {
    const dateLabel = dates[index] ? formatPreviewDate(dates[index]) : 'Set schedule start first';
    return `
      <li class="schedule-preview-item">
        <span class="schedule-preview-index">${index + 1}</span>
        <span class="schedule-preview-keyword" title="${escapeHtml(keyword)}">${escapeHtml(keyword)}</span>
        <span class="schedule-preview-date">${escapeHtml(dateLabel)}</span>
      </li>
    `;
  }).join('');
}

// ─── Submit ──────────────────────────────────────────────────────────────────
btnSubmit.addEventListener('click', async () => {
  if (isSubmitting) return;

  if (keywords.length !== MAX_KEYWORDS) {
    showToast('error', 'Exactly 5 keywords are required.');
    keywordInput?.focus();
    return;
  }

  const keywordsPayload = keywords.slice();
  const prompt = keywordsPayload.join(', ');
  const articleScheduleTime = scheduleModeField.value || 'this_week';
  const scheduleInput = articleScheduleTime === 'custom_start_date'
    ? (customStartPicker ? customStartPicker.input.value.trim() : document.getElementById('field-article-start-date').value.trim())
    : (weekTimeField ? weekTimeField.value.trim() : '');

  if (!scheduleInput) {
    showToast('error', articleScheduleTime === 'custom_start_date' ? 'Schedule date and time is required.' : 'Schedule time is required.');
    return;
  }

  const scheduleDate = resolveScheduleStartDate(articleScheduleTime, scheduleInput);
  const startObj = parseLocalDateTime(scheduleDate);
  const scheduleDates = startObj
    ? buildWeekdayScheduleDates(startObj, MAX_KEYWORDS).map(formatLocalDateTime)
    : [];

  // Check webhook config
  const cfg = await window.api.configGet();
  if (!cfg.webhook_url) {
    showToast('error', 'Webhook URL missing. Please configure it in Settings.');
    return;
  }

  setSubmitting(true);

  try {
    const timeValue = articleScheduleTime === 'custom_start_date' ? scheduleDate : (weekTimeField?.value || '');
    const result = await window.api.requestSubmit({
      prompt,
      keywords: keywordsPayload,
      keyword: keywordsPayload.join(', '),
      schedule_date: scheduleDate,
      schedule_dates: scheduleDates,
      article_schedule_time: timeValue,
      article_schedule_week: articleScheduleTime,
      article_schedule_start_date: scheduleDate
    });

    currentRequestId = result.request_id;
    updateStatusPanel({ request_id: result.request_id, status: 'Pending' });
    await startSheetPolling(result.request_id);
    showToast('success', 'Request submitted successfully');
  } catch (err) {
    showToast('error', 'Submission failed: ' + err.message);
  } finally {
    setSubmitting(false);
    updateSubmitEnabled();
  }
});

function setSubmitting(state) {
  isSubmitting = state;
  btnSubmitText.textContent = state ? 'Sending...' : 'Submit Request';
  btnSubmitSpinner.classList.toggle('hidden', !state);
  updateSubmitEnabled();
}

renderKeywordChips();

// ─── Status Panel ─────────────────────────────────────────────────────────────
function updateStatusPanel(data) {
  statusEmpty.classList.add('hidden');
  statusContent.classList.remove('hidden');

  statusRequestId.textContent = data.request_id || '';

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

// ─── Sheet Status Panel ──────────────────────────────────────────────────────
function statusBadgeClass(status) {
  const value = String(status || '').toLowerCase();
  if (['success', 'ok', 'completed', 'done', 'finished'].includes(value)) return 'workflow-status-success';
  if (['error', 'failed', 'fail'].includes(value)) return 'workflow-status-error';
  if (['pending', 'processing', 'progress', 'in_progress', 'running', 'queued'].includes(value)) return 'workflow-status-progress';
  return 'workflow-status-neutral';
}

function showOutputSkeleton() {
  outputEmpty.classList.add('hidden');
  outputSkeleton.classList.remove('hidden');
  outputContent.classList.add('hidden');
}

function showSheetStatus(run) {
  outputSkeleton.classList.add('hidden');
  outputEmpty.classList.add('hidden');
  outputContent.classList.remove('hidden');

  const status = run?.status || 'unknown';
  if (responseStatusBadge) {
    responseStatusBadge.textContent = status;
    responseStatusBadge.className = 'workflow-status-badge ' + statusBadgeClass(status);
  }
  if (responseProcess) responseProcess.textContent = run?.process ? `Process: ${run.process}` : '';
  if (responseRequestId) responseRequestId.textContent = run?.req_id || currentRequestId || '—';
  if (responseScheduleDate) responseScheduleDate.textContent = run?.schedule_date || '—';
  if (responseCreatedAt) responseCreatedAt.textContent = run?.created_at || '—';

  if (run?.error) {
    responseErrorWrap?.classList.remove('hidden');
    if (responseError) responseError.textContent = run.error;
  } else {
    responseErrorWrap?.classList.add('hidden');
  }
}

function showSheetWaiting(message) {
  outputSkeleton.classList.add('hidden');
  outputContent.classList.add('hidden');
  outputEmpty.classList.remove('hidden');
  const title = outputEmpty?.querySelector('p.text-muted.text-sm');
  if (title) title.textContent = message || 'Waiting for this req_id to appear in Google Sheet…';
}

function showOutputEmpty() {
  outputEmpty.classList.remove('hidden');
  outputSkeleton.classList.add('hidden');
  outputContent.classList.add('hidden');
  if (sheetPollHint) sheetPollHint.textContent = 'Waiting for request…';
  stopSheetPolling();
}

async function refreshSheetPollInterval() {
  try {
    const cfg = await window.api.configGet();
    const value = Number(cfg.sheets_poll_interval_ms);
    sheetPollIntervalMs = Number.isFinite(value) && value >= 300 ? value : 300;
  } catch {
    sheetPollIntervalMs = 300;
  }
}

async function pollActiveSheetStatus({ force = false } = {}) {
  if (!currentRequestId || sheetPolling) return;
  sheetPolling = true;
  try {
    const result = await window.api.sheetsGetRun({ reqId: currentRequestId, force });
    if (!currentRequestId) return;

    if (!result.success) {
      if (sheetPollHint) sheetPollHint.textContent = 'Sheet error';
      showSheetWaiting(result.message || 'Unable to read Google Sheet.');
      return;
    }

    if (!result.run) {
      if (sheetPollHint) sheetPollHint.textContent = `Polling every ${sheetPollIntervalMs}ms`;
      showSheetWaiting('Request submitted. Waiting for sheet row…');
      return;
    }

    if (sheetPollHint) sheetPollHint.textContent = `Live · every ${sheetPollIntervalMs}ms`;
    showSheetStatus(result.run);
  } finally {
    sheetPolling = false;
  }
}

function stopSheetPolling() {
  if (sheetPollTimer) {
    clearInterval(sheetPollTimer);
    sheetPollTimer = null;
  }
}

async function startSheetPolling(requestId) {
  stopSheetPolling();
  currentRequestId = requestId;
  await refreshSheetPollInterval();
  showOutputSkeleton();
  if (sheetPollHint) sheetPollHint.textContent = `Polling every ${sheetPollIntervalMs}ms`;
  await pollActiveSheetStatus({ force: true });
  sheetPollTimer = setInterval(() => {
    pollActiveSheetStatus({ force: false });
  }, sheetPollIntervalMs);
}

// ─── Live updates from main process ──────────────────────────────────────────
window.api.onRequestUpdate((data) => {
  if (!currentRequestId || data.request_id !== currentRequestId) return;

  updateStatusPanel(data);

  if (data.status === 'Completed' || data.status === 'Processing' || data.status === 'Pending') {
    // Sheet becomes source of truth for process/status; keep local app state badge updated.
    if (typeof renderHistory === 'function') renderHistory();
  } else if (data.status === 'Error') {
    showSheetStatus({
      req_id: data.request_id || currentRequestId,
      status: 'error',
      process: '',
      schedule_date: '',
      created_at: '',
      error: data.error_message || 'Request failed.'
    });
    if (typeof renderHistory === 'function') renderHistory();
  }
});

btnCopyResponseId?.addEventListener('click', async () => {
  const text = responseRequestId?.textContent || '';
  if (!text || text === '—') { showToast('warning', 'No request ID yet.'); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast('success', 'Request ID copied');
  } catch {
    showToast('error', 'Copy failed');
  }
});

// ─── Expand modal (used by History) ──────────────────────────────────────────
btnCloseModal?.addEventListener('click', () => {
  modalExpand.classList.add('hidden');
});
modalExpand?.addEventListener('click', (e) => {
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
