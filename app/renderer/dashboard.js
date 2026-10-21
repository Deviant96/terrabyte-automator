/* global marked, flatpickr */
'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
let currentRequestId = null;
let isSubmitting = false;
let customStartPicker = null;
let keywords = [];
let dragKeywordIndex = null;
let dashboardViewMode = 'last';
const MAX_KEYWORDS = 5;
const PROCESS_STEPS = [
  { label: 'Starting', hint: 'Starting automation', match: ['starting automation'] },
  { label: 'Articles', hint: 'Generating articles', match: ['generating articles'] },
  { label: 'Images', hint: 'Generating images', match: ['generating images'] },
  { label: 'Details', hint: 'Filling article details', match: ['filling article details'] },
  { label: 'Posting', hint: 'Posting articles', match: ['posting articles'] },
  { label: 'Image URLs', hint: 'Filling rows for image urls', match: ['filling rows for image urls', 'image urls'] },
  { label: 'Socials', hint: 'Posting socials', match: ['posting socials'] },
  { label: 'Complete', hint: 'All workflow completed', match: ['all workflow completed', 'all workflow comple', 'workflow completed'] }
];

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
const statusCardTitle = document.getElementById('status-card-title');
const sheetStatusTitle = document.getElementById('sheet-status-title');
const timelineTitle = document.getElementById('timeline-title');
const timelineModeBadge = document.getElementById('timeline-mode-badge');
const timelineHint = document.getElementById('timeline-hint');
const progressTimeline = document.getElementById('progress-timeline');
const timelineEmpty = document.getElementById('timeline-empty');
const sheetStatusNote = document.getElementById('sheet-status-note');

const modalExpand = document.getElementById('modal-expand');
const modalOutputContent = document.getElementById('modal-output-content');
const btnCloseModal = document.getElementById('btn-close-modal');

let sheetPollTimer = null;
let sheetPollIntervalMs = 300;
let sheetPolling = false;
let timelineAnimTimers = [];

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

function formatSheetDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const parsed = parseLocalDateTime(raw);
  return parsed ? formatPreviewDate(parsed) : raw;
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
    setDashboardMode('current');
    updateStatusPanel({ request_id: result.request_id, status: 'Pending' });
    renderTimeline({ req_id: result.request_id, process: 'Starting automation', status: 'pending' });
    await startSheetPolling(result.request_id, { mode: 'current' });
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
setDashboardMode('last');
renderTimeline(null);
loadLatestSheetRun();

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

// ─── Current / Last mode + timeline ──────────────────────────────────────────
function setDashboardMode(mode) {
  dashboardViewMode = mode === 'current' ? 'current' : 'last';
  const isCurrent = dashboardViewMode === 'current';
  if (statusCardTitle) statusCardTitle.textContent = isCurrent ? 'Current Status' : 'Last Status';
  if (sheetStatusTitle) sheetStatusTitle.textContent = isCurrent ? 'Sheet Status' : 'Last Sheet Status';
  if (timelineTitle) timelineTitle.textContent = isCurrent ? 'Current Progress' : 'Last Progress';
  if (timelineModeBadge) {
    timelineModeBadge.textContent = isCurrent ? 'Current' : 'Last';
    timelineModeBadge.classList.toggle('is-current', isCurrent);
  }
  if (sheetStatusNote) {
    sheetStatusNote.textContent = isCurrent
      ? 'Live from Google Sheet · current run'
      : 'From Google Sheet · last run';
  }
}

function normalizeProcess(value) {
  return String(value || '').toLowerCase().replace(/\.+/g, '').replace(/\s+/g, ' ').trim();
}

function isRunFinished(status) {
  const value = String(status || '').toLowerCase();
  return ['finished', 'completed', 'done', 'success', 'ok'].includes(value);
}

function isRunError(status, error) {
  const value = String(status || '').toLowerCase();
  return ['error', 'failed', 'fail'].includes(value) || !!(error && String(error).trim());
}

function mapSheetStatusToBadge(status) {
  const value = String(status || '').toLowerCase();
  if (['success', 'ok', 'completed', 'done', 'finished'].includes(value)) return 'Completed';
  if (['error', 'failed', 'fail'].includes(value)) return 'Error';
  if (['pending', 'queued'].includes(value)) return 'Pending';
  return 'Processing';
}

function resolveProcessStep(run) {
  if (!run) return { index: -1, allDone: false, hasError: false };
  const hasError = isRunError(run.status, run.error);
  if (isRunFinished(run.status)) {
    return { index: PROCESS_STEPS.length - 1, allDone: true, hasError: false };
  }

  const process = normalizeProcess(run.process);
  let index = 0;
  if (process) {
    const found = PROCESS_STEPS.findIndex((step) =>
      step.match.some((token) => process.includes(token))
    );
    if (found >= 0) index = found;
  }
  return { index, allDone: false, hasError };
}

function animationsAllowed() {
  return !document.body.classList.contains('no-animations')
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clearTimelineAnimTimers() {
  timelineAnimTimers.forEach((id) => clearTimeout(id));
  timelineAnimTimers = [];
}

function timelineStepState(i, { index, allDone, hasError, hasRun }) {
  if (!hasRun) return 'is-upcoming';
  if (allDone || (index >= 0 && i < index)) return 'is-done';
  if (index >= 0 && i === index && hasError) return 'is-error';
  if (index >= 0 && i === index) return 'is-current';
  return 'is-upcoming';
}

function setTimelineStepState(el, state, { extra = [], force = false } = {}) {
  const prev = el.dataset.state || 'is-upcoming';
  if (!force && prev === state && extra.length === 0) return prev;
  el.classList.remove(
    'is-upcoming', 'is-done', 'is-current', 'is-error',
    'just-done', 'just-current', 'just-complete', 'is-revealing'
  );
  el.classList.add(state, ...extra);
  el.dataset.state = state;
  if (state === 'is-current') el.setAttribute('aria-current', 'step');
  else el.removeAttribute('aria-current');
  return prev;
}

function ensureTimelineDom() {
  if (!progressTimeline || progressTimeline.dataset.built === '1') return;
  progressTimeline.innerHTML = PROCESS_STEPS.map((step, i) => `
    <div class="progress-step is-upcoming" data-index="${i}" data-state="is-upcoming" title="${escapeHtml(step.hint)}">
      <span class="progress-node">
        <span class="progress-node-glow"></span>
        <span class="progress-node-ring"></span>
        <svg class="progress-mark progress-check" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.2 8.4 L6.6 11.6 L12.8 4.6"></path>
        </svg>
        <svg class="progress-mark progress-x" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4 L12 12"></path>
          <path d="M12 4 L4 12"></path>
        </svg>
      </span>
      <span class="progress-connector" aria-hidden="true">
        <span class="progress-connector-fill"></span>
        <span class="progress-connector-spark"></span>
      </span>
      <span class="progress-label">${escapeHtml(step.label)}</span>
    </div>
  `).join('');
  progressTimeline.dataset.built = '1';
  progressTimeline.addEventListener('animationend', (event) => {
    const step = event.target.closest?.('.progress-step');
    if (!step) return;
    if (event.animationName === 'spark-travel' || (event.animationName === 'node-complete' && !step.nextElementSibling)) {
      step.classList.remove('just-done');
    }
    if (event.animationName === 'node-activate' || event.animationName === 'error-shake') {
      step.classList.remove('just-current');
    }
    if (event.animationName === 'complete-burst') {
      step.classList.remove('just-complete');
    }
  });
}

function updateTimelineChrome(run) {
  if (!run) {
    timelineEmpty?.classList.remove('hidden');
    if (timelineHint) timelineHint.textContent = 'No run loaded yet.';
    return;
  }
  timelineEmpty?.classList.add('hidden');
  if (timelineHint) {
    timelineHint.textContent = run.process || run.status || run.req_id || '';
  }
}

function renderTimeline(run) {
  if (!progressTimeline) return;
  ensureTimelineDom();
  const resolved = resolveProcessStep(run);
  const reqId = run?.req_id || '';
  const signature = `${reqId}|${resolved.index}|${resolved.allDone}|${resolved.hasError}|${run ? 1 : 0}`;
  updateTimelineChrome(run);
  if (signature === progressTimeline.dataset.sig) return;

  const prevIndex = progressTimeline.dataset.index === undefined || progressTimeline.dataset.index === ''
    ? -1
    : Number(progressTimeline.dataset.index);
  const prevReqId = progressTimeline.dataset.reqId || '';
  const prevAllDone = progressTimeline.dataset.allDone === '1';
  const hadRun = progressTimeline.dataset.hasRun === '1';

  progressTimeline.dataset.sig = signature;
  progressTimeline.dataset.reqId = reqId;
  progressTimeline.dataset.index = String(resolved.index);
  progressTimeline.dataset.allDone = resolved.allDone ? '1' : '0';
  progressTimeline.dataset.hasRun = run ? '1' : '0';

  const steps = [...progressTimeline.querySelectorAll('.progress-step')];
  const animate = animationsAllowed();
  const isNewRun = !!(run && reqId && reqId !== prevReqId);
  const firstPaint = !!(run && !hadRun);
  const advanced = !!(run && !isNewRun && hadRun && resolved.index > prevIndex);
  const cascade = animate && run && (isNewRun || firstPaint || (advanced && resolved.index - prevIndex > 1));
  const targetStates = steps.map((_, i) => timelineStepState(i, { ...resolved, hasRun: !!run }));

  clearTimelineAnimTimers();

  if (!run || !animate) {
    steps.forEach((el, i) => setTimelineStepState(el, targetStates[i], { force: true }));
    return;
  }

  if (cascade) {
    steps.forEach((el) => setTimelineStepState(el, 'is-upcoming', { force: true }));
    targetStates.forEach((state, i) => {
      if (state === 'is-upcoming') return;
      const extra = [];
      if (state === 'is-done') extra.push('just-done');
      if (state === 'is-current' || state === 'is-error') extra.push('just-current');
      if (resolved.allDone && i === steps.length - 1) extra.push('just-complete');
      const timer = setTimeout(() => {
        setTimelineStepState(steps[i], state, { extra, force: true });
      }, i * 120);
      timelineAnimTimers.push(timer);
    });
    return;
  }

  if (advanced) {
    steps.forEach((el, i) => {
      const state = targetStates[i];
      if (state === 'is-done' && i >= prevIndex && i < resolved.index) {
        setTimelineStepState(el, 'is-done', { extra: ['just-done'] });
      } else if (state === 'is-current' || state === 'is-error') {
        const timer = setTimeout(() => {
          setTimelineStepState(el, state, { extra: ['just-current'] });
        }, 480);
        timelineAnimTimers.push(timer);
      } else if (el.dataset.state !== state) {
        setTimelineStepState(el, state);
      }
    });
    if (resolved.allDone && !prevAllDone) {
      const last = steps[steps.length - 1];
      const timer = setTimeout(() => last.classList.add('just-complete'), 480);
      timelineAnimTimers.push(timer);
    }
    return;
  }

  steps.forEach((el, i) => {
    const state = targetStates[i];
    const extra = [];
    if (state === 'is-error' && el.dataset.state !== 'is-error') extra.push('just-current');
    if (resolved.allDone && !prevAllDone && i === steps.length - 1) extra.push('just-complete');
    setTimelineStepState(el, state, extra.length ? { extra } : {});
  });
}

async function loadLatestSheetRun() {
  setDashboardMode('last');
  renderTimeline(null);
  try {
    const result = await window.api.sheetsGetLatest({ limit: 1, force: true });
    if (dashboardViewMode === 'current') return;
    if (!result.success) {
      if (timelineHint) timelineHint.textContent = result.message || 'Could not load last run.';
      if (sheetPollHint) sheetPollHint.textContent = 'No last run';
      return;
    }
    const run = result.runs?.[0];
    if (!run) {
      if (timelineHint) timelineHint.textContent = 'No previous run found.';
      if (sheetPollHint) sheetPollHint.textContent = 'No last run';
      return;
    }

    currentRequestId = run.req_id;
    updateStatusPanel({
      request_id: run.req_id,
      status: mapSheetStatusToBadge(run.status),
      error_message: run.error || ''
    });
    showSheetStatus(run);

    if (!isRunFinished(run.status) && !isRunError(run.status, run.error)) {
      await startSheetPolling(run.req_id, { mode: 'last' });
    } else if (sheetPollHint) {
      sheetPollHint.textContent = 'Last completed run';
    }
  } catch (err) {
    if (timelineHint) timelineHint.textContent = err.message || 'Could not load last run.';
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
  if (responseScheduleDate) {
    responseScheduleDate.textContent = formatSheetDateTime(run?.schedule_date);
    responseScheduleDate.title = run?.schedule_date || '';
  }
  if (responseCreatedAt) {
    responseCreatedAt.textContent = formatSheetDateTime(run?.created_at);
    responseCreatedAt.title = run?.created_at || '';
  }

  updateStatusPanel({
    request_id: run?.req_id || currentRequestId || '',
    status: mapSheetStatusToBadge(run?.status),
    error_message: run?.error || ''
  });

  if (run?.error) {
    responseErrorWrap?.classList.remove('hidden');
    if (responseError) responseError.textContent = run.error;
  } else {
    responseErrorWrap?.classList.add('hidden');
  }

  renderTimeline(run);
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
      showSheetWaiting(
        dashboardViewMode === 'current'
          ? 'Request submitted. Waiting for sheet row…'
          : 'Waiting for the last run to appear in Google Sheet…'
      );
      return;
    }

    if (sheetPollHint) {
      sheetPollHint.textContent = dashboardViewMode === 'current'
        ? `Live · every ${sheetPollIntervalMs}ms`
        : `Last run · every ${sheetPollIntervalMs}ms`;
    }
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

async function startSheetPolling(requestId, { mode = 'current' } = {}) {
  stopSheetPolling();
  currentRequestId = requestId;
  setDashboardMode(mode);
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
