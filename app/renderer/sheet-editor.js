'use strict';

const sheetEditorStatus = document.getElementById('sheet-editor-status');
const sheetEditorTitle = document.getElementById('sheet-editor-title');
const sheetEditorTab = document.getElementById('sheet-editor-tab');
const sheetEditorError = document.getElementById('sheet-editor-error');
const sheetEditorHint = document.getElementById('sheet-editor-hint');
const sheetEditorHead = document.getElementById('sheet-editor-head');
const sheetEditorBody = document.getElementById('sheet-editor-body');
const sheetEditorEmpty = document.getElementById('sheet-editor-empty');
const sheetEditorA1 = document.getElementById('sheet-editor-a1');
const sheetEditorFormula = document.getElementById('sheet-editor-formula');
const btnRefreshSheetEditor = document.getElementById('btn-refresh-sheet-editor');
const sheetEditorScreen = document.getElementById('screen-sheet-editor');
const sheetGridScroll = document.getElementById('sheet-editor-grid-wrap');

let workbookTitle = '';
let tabs = [];
let currentTab = '';
let grid = [];
let selected = { row: 0, col: 0 };
let loading = false;
let editing = false;
let editOriginal = '';
let ignoreInputBlur = false;
let formulaDirty = false;

function colIndexToA1(index) {
  let n = Number(index) + 1;
  if (!Number.isFinite(n) || n < 1) n = 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function cellA1(row, col) {
  return `${colIndexToA1(col)}${row + 1}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isSheetEditorActive() {
  return sheetEditorScreen?.classList.contains('active');
}

function setStatus(text) {
  if (sheetEditorStatus) sheetEditorStatus.textContent = text;
}

function setError(message) {
  if (!sheetEditorError) return;
  if (!message) {
    sheetEditorError.classList.add('hidden');
    sheetEditorError.textContent = '';
    return;
  }
  sheetEditorError.textContent = message;
  sheetEditorError.classList.remove('hidden');
}

function cellValue(row, col) {
  return String(grid[row]?.[col] ?? '');
}

function getCellEl(row, col) {
  return sheetEditorBody?.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
}

function updateCellDisplay(row, col) {
  const td = getCellEl(row, col);
  if (!td || td.querySelector('.sheet-cell-input')) return;
  td.textContent = cellValue(row, col);
  td.title = cellValue(row, col);
}

function stopEditing({ restore = false } = {}) {
  const input = sheetEditorBody?.querySelector('.sheet-cell-input');
  if (!input) {
    editing = false;
    return;
  }
  const row = Number(input.dataset.row);
  const col = Number(input.dataset.col);
  const td = input.parentElement;
  ignoreInputBlur = true;
  input.remove();
  editing = false;
  if (td) {
    td.textContent = restore ? editOriginal : cellValue(row, col);
    td.title = td.textContent;
  }
  ignoreInputBlur = false;
}

async function saveCell(row, col, value) {
  const next = String(value ?? '');
  const prev = cellValue(row, col);
  if (next === prev) return true;
  if (!currentTab) return false;

  if (!grid[row]) grid[row] = [];
  grid[row][col] = next;
  updateCellDisplay(row, col);
  setStatus('Saving…');

  try {
    const result = await window.api.sheetsEditorUpdateCell({
      sheetName: currentTab,
      row,
      col,
      value: next
    });
    if (!result.success) {
      grid[row][col] = prev;
      updateCellDisplay(row, col);
      setStatus('Save failed');
      if (typeof showToast === 'function') showToast('error', result.message || 'Failed to save cell.');
      return false;
    }
    setStatus('Saved');
    return true;
  } catch (err) {
    grid[row][col] = prev;
    updateCellDisplay(row, col);
    setStatus('Save failed');
    if (typeof showToast === 'function') showToast('error', err.message || 'Failed to save cell.');
    return false;
  }
}

async function commitFormulaBar() {
  if (!formulaDirty) return true;
  formulaDirty = false;
  return saveCell(selected.row, selected.col, sheetEditorFormula?.value ?? '');
}

function syncFormulaBar() {
  if (!sheetEditorA1 || !sheetEditorFormula) return;
  sheetEditorA1.textContent = cellA1(selected.row, selected.col);
  if (document.activeElement !== sheetEditorFormula) {
    sheetEditorFormula.value = cellValue(selected.row, selected.col);
    formulaDirty = false;
  }
}

function selectCell(row, col, { scroll = true } = {}) {
  const maxRow = Math.max(0, grid.length - 1);
  const maxCol = Math.max(0, (grid[0]?.length || 1) - 1);
  const nextRow = Math.min(maxRow, Math.max(0, row));
  const nextCol = Math.min(maxCol, Math.max(0, col));

  sheetEditorBody?.querySelectorAll('td.selected').forEach((el) => el.classList.remove('selected'));
  sheetEditorHead?.querySelectorAll('th.selected-col').forEach((el) => el.classList.remove('selected-col'));
  sheetEditorBody?.querySelectorAll('th.selected-row').forEach((el) => el.classList.remove('selected-row'));

  selected = { row: nextRow, col: nextCol };
  getCellEl(nextRow, nextCol)?.classList.add('selected');
  sheetEditorHead?.querySelector(`th[data-col="${nextCol}"]`)?.classList.add('selected-col');
  sheetEditorBody?.querySelector(`th[data-row="${nextRow}"]`)?.classList.add('selected-row');
  syncFormulaBar();

  if (scroll) {
    getCellEl(nextRow, nextCol)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function startEdit({ replaceWith } = {}) {
  if (!grid.length || editing) return;
  const td = getCellEl(selected.row, selected.col);
  if (!td) return;

  editing = true;
  editOriginal = cellValue(selected.row, selected.col);
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'sheet-cell-input';
  input.dataset.row = String(selected.row);
  input.dataset.col = String(selected.col);
  input.value = replaceWith != null ? replaceWith : editOriginal;
  td.textContent = '';
  td.appendChild(input);
  input.focus();
  if (replaceWith != null) {
    input.setSelectionRange(input.value.length, input.value.length);
  } else {
    input.select();
  }

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value;
      const row = selected.row;
      const col = selected.col;
      stopEditing();
      await saveCell(row, col, value);
      selectCell(row + 1, col);
      sheetGridScroll?.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const value = input.value;
      const row = selected.row;
      const col = selected.col;
      stopEditing();
      await saveCell(row, col, value);
      selectCell(row, col + (e.shiftKey ? -1 : 1));
      sheetGridScroll?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      stopEditing({ restore: true });
      if (sheetEditorFormula) sheetEditorFormula.value = editOriginal;
      sheetGridScroll?.focus();
    }
  });

  input.addEventListener('blur', async () => {
    if (ignoreInputBlur || !editing) return;
    const value = input.value;
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    stopEditing();
    await saveCell(row, col, value);
    syncFormulaBar();
  });
}

function renderTabs(preferredTab) {
  if (!sheetEditorTab) return;
  sheetEditorTab.innerHTML = '';
  if (!tabs.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No tabs';
    sheetEditorTab.appendChild(option);
    return;
  }
  tabs.forEach((tab) => {
    const option = document.createElement('option');
    option.value = tab.title;
    option.textContent = tab.title;
    sheetEditorTab.appendChild(option);
  });
  const match = tabs.find((tab) => tab.title === preferredTab);
  sheetEditorTab.value = match ? match.title : tabs[0].title;
}

function renderGrid() {
  if (!sheetEditorHead || !sheetEditorBody) return;

  if (!grid.length) {
    sheetEditorHead.innerHTML = '';
    sheetEditorBody.innerHTML = '';
    sheetEditorEmpty?.classList.remove('hidden');
    return;
  }
  sheetEditorEmpty?.classList.add('hidden');

  const colCount = grid[0].length;
  const headCells = ['<th class="sheet-corner"></th>'];
  for (let c = 0; c < colCount; c += 1) {
    headCells.push(`<th data-col="${c}">${colIndexToA1(c)}</th>`);
  }
  sheetEditorHead.innerHTML = `<tr>${headCells.join('')}</tr>`;

  const body = [];
  for (let r = 0; r < grid.length; r += 1) {
    const cells = [`<th data-row="${r}">${r + 1}</th>`];
    for (let c = 0; c < colCount; c += 1) {
      const value = cellValue(r, c);
      cells.push(`<td data-row="${r}" data-col="${c}" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`);
    }
    body.push(`<tr>${cells.join('')}</tr>`);
  }
  sheetEditorBody.innerHTML = body.join('');
  selectCell(Math.min(selected.row, grid.length - 1), Math.min(selected.col, colCount - 1), { scroll: false });
}

async function loadSheetGrid(sheetName) {
  if (!sheetName) return;
  currentTab = sheetName;
  setStatus('Loading…');
  const result = await window.api.sheetsEditorLoad({ sheetName });
  if (!result.success) {
    grid = [];
    renderGrid();
    setError(result.message || 'Failed to load sheet.');
    setStatus('Error');
    return;
  }
  setError('');
  grid = result.values || [];
  selected = { row: 0, col: 0 };
  renderGrid();
  const notes = [];
  if (result.truncatedRows || result.truncatedCols) {
    notes.push('Showing the first 400 rows and 40 columns.');
  }
    notes.push('Click a cell, edit the text, then press Enter or click away to save.');
  if (sheetEditorHint) {
    sheetEditorHint.textContent = notes.join(' ');
    sheetEditorHint.classList.remove('hidden');
  }
  setStatus('Ready');
  sheetGridScroll?.focus({ preventScroll: true });
}

async function loadSheetEditor() {
  if (!sheetEditorScreen) return;
  if (loading) return;

  loading = true;
  setError('');
  setStatus('Connecting…');
  if (sheetEditorTitle) sheetEditorTitle.textContent = '';

  try {
    const cfg = await window.api.configGet();
    const preferred = currentTab || cfg.sheets_tab_name || '';
    const result = await window.api.sheetsEditorTabs();
    if (!result.success) {
      tabs = [];
      grid = [];
      renderTabs('');
      renderGrid();
      setError(result.message || 'Failed to load spreadsheet.');
      setStatus('Error');
      return;
    }

    workbookTitle = result.title || '';
    tabs = result.tabs || [];
    if (sheetEditorTitle) {
      sheetEditorTitle.textContent = workbookTitle ? workbookTitle : '';
    }
    renderTabs(preferred);
    const nextTab = sheetEditorTab?.value || tabs[0]?.title || '';
    if (!nextTab) {
      grid = [];
      renderGrid();
      setError('This spreadsheet has no tabs.');
      setStatus('Error');
      return;
    }
    await loadSheetGrid(nextTab);
  } catch (err) {
    setError(err.message || 'Failed to load spreadsheet.');
    setStatus('Error');
  } finally {
    loading = false;
  }
}

sheetEditorBody?.addEventListener('mousedown', async (e) => {
  const td = e.target.closest('td[data-row][data-col]');
  if (!td || !sheetEditorBody.contains(td)) return;
  const row = Number(td.dataset.row);
  const col = Number(td.dataset.col);
  if (editing && (row !== selected.row || col !== selected.col)) {
    const input = sheetEditorBody.querySelector('.sheet-cell-input');
    const value = input ? input.value : cellValue(selected.row, selected.col);
    const prevRow = selected.row;
    const prevCol = selected.col;
    stopEditing();
    await saveCell(prevRow, prevCol, value);
  }
  await commitFormulaBar();
  selectCell(row, col, { scroll: false });
  if (document.activeElement !== sheetEditorFormula) {
    sheetGridScroll?.focus();
  }
});

sheetEditorBody?.addEventListener('dblclick', (e) => {
  const td = e.target.closest('td[data-row][data-col]');
  if (!td) return;
  startEdit();
});

sheetEditorTab?.addEventListener('change', async () => {
  await commitFormulaBar();
  stopEditing({ restore: true });
  await loadSheetGrid(sheetEditorTab.value);
});

btnRefreshSheetEditor?.addEventListener('click', () => {
  stopEditing({ restore: true });
  formulaDirty = false;
  loadSheetEditor();
});

sheetEditorFormula?.addEventListener('input', () => {
  formulaDirty = true;
});

sheetEditorFormula?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const row = selected.row;
    const col = selected.col;
    formulaDirty = false;
    await saveCell(row, col, sheetEditorFormula.value);
    selectCell(row + 1, col);
    sheetGridScroll?.focus();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    formulaDirty = false;
    sheetEditorFormula.value = cellValue(selected.row, selected.col);
    sheetGridScroll?.focus();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const row = selected.row;
    const col = selected.col;
    formulaDirty = false;
    await saveCell(row, col, sheetEditorFormula.value);
    selectCell(row, col + (e.shiftKey ? -1 : 1));
    sheetGridScroll?.focus();
  }
});

sheetEditorFormula?.addEventListener('blur', () => {
  commitFormulaBar();
});

sheetGridScroll?.addEventListener('keydown', async (e) => {
  if (!isSheetEditorActive() || !grid.length || editing) return;
  if (document.activeElement === sheetEditorFormula) return;

  const moveKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'];
  if (moveKeys.includes(e.key)) e.preventDefault();

  if (e.key === 'ArrowUp') selectCell(selected.row - 1, selected.col);
  else if (e.key === 'ArrowDown') selectCell(selected.row + 1, selected.col);
  else if (e.key === 'ArrowLeft') selectCell(selected.row, selected.col - 1);
  else if (e.key === 'ArrowRight') selectCell(selected.row, selected.col + 1);
  else if (e.key === 'Tab') selectCell(selected.row, selected.col + (e.shiftKey ? -1 : 1));
  else if (e.key === 'Enter' || e.key === 'F2') startEdit();
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    await saveCell(selected.row, selected.col, '');
    syncFormulaBar();
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    startEdit({ replaceWith: e.key });
  }
});

function sheetEditorHandleEscape() {
  if (!isSheetEditorActive()) return false;
  if (editing) {
    stopEditing({ restore: true });
    if (sheetEditorFormula) sheetEditorFormula.value = editOriginal;
    sheetGridScroll?.focus();
    return true;
  }
  return false;
}

window.loadSheetEditor = loadSheetEditor;
window.sheetEditorHandleEscape = sheetEditorHandleEscape;
