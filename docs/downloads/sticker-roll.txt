// ==UserScript==
// @name         Sticker Roll (abelrigm)
// @namespace    https://github.com/rigoabell/abelrigm_repository
// @version      1.3.0
// @updateURL    https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/sticker-roll.user.js
// @downloadURL  https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/sticker-roll.user.js
// @description  Print a side roll of stickers from a list. Each sticker has a barcode above the value. Click through two colors.
// @author       abelrigm
// @match        http://*/*
// @match        https://*/*
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

/*
  A sticker button at the top center opens the panel. Paste a list and press Print.
  A roll of stickers sits on the left or the right. A linear barcode is on top, the value underneath.
  Click a sticker: first color, second color, then white again.
  Colors and paint mode are set in the panel. Drag the handle at the bottom of the roll to resize it.
  The red close button hides the roll. The sticker button shows that same roll again.
  Name a list to save it, open it from History, or Export the values.
*/

(function () {
  'use strict';

  const VERSION = '1.3.0';
  const STORAGE_KEY = 'abelrigm.stickerRoll.v1';
  const MAX_STICKERS = 500;
  const MAX_LISTS = 30;
  const MIN_SCALE = 0.6;
  const MAX_SCALE = 2.2;
  const BASE_ROLL = 248;
  const DEFAULT_COLOR_1 = '#f6c945';
  const DEFAULT_COLOR_2 = '#8ec5ff';

  function clampScale(value) {
    const number = Number(value);
    if (!isFinite(number)) return 1;
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, number));
    return Math.round(clamped * 100) / 100;
  }

  function normalizeHex(value, fallback) {
    const text = String(value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(text)) return text.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(text)) {
      return ('#' + text.slice(1).split('').map((part) => part + part).join('')).toLowerCase();
    }
    return fallback;
  }

  function isDark(value) {
    const hex = normalizeHex(value, '#ffffff');
    const channels = [0, 2, 4].map((offset) => {
      const unit = parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255;
      return unit <= 0.03928 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
    });
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return luminance < 0.42;
  }

  function parseList(text) {
    const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!raw) return [];
    const lines = raw.split('\n');
    const pieces = lines.length > 1 ? lines : raw.split(/[,;\t]/);
    const values = [];
    pieces.forEach((piece) => {
      const cells = lines.length > 1 && piece.indexOf('\t') !== -1 ? piece.split('\t') : [piece];
      cells.forEach((cell) => {
        const value = String(cell || '').trim();
        if (value) values.push(value);
      });
    });
    return values;
  }

  function alignMarks(values, marks) {
    const next = [];
    const source = Array.isArray(marks) ? marks : [];
    for (let i = 0; i < values.length; i += 1) {
      const mark = Number(source[i]);
      next.push(mark === 1 || mark === 2 ? mark : 0);
    }
    return next;
  }

  function sameValues(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }

  function applyClick(mark, mode) {
    const current = mark === 1 || mark === 2 ? mark : 0;
    if (mode === 0 || mode === 1 || mode === 2) return mode;
    return (current + 1) % 3;
  }

  function stickerTextColor(mark, color1, color2) {
    if (mark !== 1 && mark !== 2) return '#1a1a1a';
    return isDark(mark === 1 ? color1 : color2) ? '#ffffff' : '#1a1a1a';
  }

  function stickerFill(mark, color1, color2) {
    if (mark === 1) return color1;
    if (mark === 2) return color2;
    return '#ffffff';
  }

  function dockSide(rollSide) {
    return rollSide === 'right' ? 'left' : 'right';
  }

  function sanitizeMode(mode) {
    if (mode === 0 || mode === 1 || mode === 2) return mode;
    if (mode === '0' || mode === '1' || mode === '2') return Number(mode);
    return 'cycle';
  }

  function sanitizeLists(lists) {
    if (!Array.isArray(lists)) return [];
    const saved = [];
    lists.forEach((list) => {
      if (!list || typeof list !== 'object') return;
      const values = Array.isArray(list.values)
        ? list.values.map((value) => String(value).trim()).filter(Boolean).slice(0, MAX_STICKERS)
        : [];
      const name = String(list.name || '').trim().slice(0, 80);
      if (!name || !values.length) return;
      saved.push({
        id: String(list.id || name).slice(0, 48),
        name: name,
        values: values,
        marks: alignMarks(values, list.marks),
        savedAt: Number(list.savedAt) || 0,
      });
    });
    return saved.slice(0, MAX_LISTS);
  }

  function defaultState() {
    return {
      side: 'left',
      color1: DEFAULT_COLOR_1,
      color2: DEFAULT_COLOR_2,
      mode: 'cycle',
      name: '',
      draft: '',
      values: [],
      marks: [],
      rollVisible: false,
      panelOpen: false,
      scale: 1,
      hidden: false,
      lists: [],
    };
  }

  function sanitizeState(raw) {
    const next = defaultState();
    if (!raw || typeof raw !== 'object') return next;
    next.side = raw.side === 'right' ? 'right' : 'left';
    next.color1 = normalizeHex(raw.color1, DEFAULT_COLOR_1);
    next.color2 = normalizeHex(raw.color2, DEFAULT_COLOR_2);
    next.mode = sanitizeMode(raw.mode);
    next.name = String(raw.name || '').slice(0, 80);
    next.draft = String(raw.draft || '');
    next.values = Array.isArray(raw.values)
      ? raw.values.map((value) => String(value).trim()).filter(Boolean).slice(0, MAX_STICKERS)
      : [];
    next.marks = alignMarks(next.values, raw.marks);
    next.rollVisible = raw.rollVisible === true && next.values.length > 0;
    next.panelOpen = raw.panelOpen === true;
    next.scale = clampScale(raw.scale);
    next.hidden = false;
    next.lists = sanitizeLists(raw.lists);
    return next;
  }

  function readStored(raw) {
    let parsed = raw;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (error) { parsed = null; }
    }
    return sanitizeState(parsed);
  }

  function printModel(previous, draft) {
    const parsed = parseList(draft);
    const values = parsed.slice(0, MAX_STICKERS);
    if (!values.length) return { error: 'Add a value' };
    const marks = alignMarks(values, sameValues(values, previous && previous.values) ? previous.marks : null);
    let status = String(values.length);
    if (parsed.length > values.length) status = values.length + ' of ' + parsed.length;
    return { values: values, marks: marks, status: status, rollVisible: true };
  }

  function fallbackName(values) {
    if (!values || !values.length) return '';
    const head = String(values[0]).slice(0, 24);
    if (values.length === 1) return head;
    return head + ' +' + (values.length - 1);
  }

  function upsertList(lists, entry) {
    const name = String(entry.name || '').trim().slice(0, 80);
    const values = (entry.values || []).slice(0, MAX_STICKERS);
    if (!name || !values.length) return { lists: sanitizeLists(lists), error: 'Nothing to save' };
    const existing = (Array.isArray(lists) ? lists : []).find((list) => {
      return String(list.name || '').trim().toLowerCase() === name.toLowerCase();
    });
    const saved = {
      id: existing ? existing.id : entry.id,
      name: name,
      values: values.slice(),
      marks: alignMarks(values, entry.marks),
      savedAt: entry.savedAt || Date.now(),
    };
    return {
      lists: [saved].concat((lists || []).filter((list) => list.id !== saved.id)).slice(0, MAX_LISTS),
      entry: saved,
    };
  }

  function exportBody(values) {
    const lines = Array.isArray(values) ? values : [];
    return lines.join('\n') + (lines.length ? '\n' : '');
  }

  function exportFileName(name) {
    const clean = String(name || 'sticker-roll')
      .trim()
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60);
    return (clean || 'sticker-roll') + '.txt';
  }

  // Code 128 symbol widths. 0-102 are data, 103-105 are the start codes, 106 is stop.
  const CODE128 = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
  ];

  function code128Bits(text) {
    const value = String(text || '');
    if (!value || value.length > 80) return '';
    const symbols = [104];
    for (let i = 0; i < value.length; i += 1) {
      let code = value.charCodeAt(i);
      if (code < 32 || code > 127) code = 63;
      symbols.push(code - 32);
    }
    let sum = symbols[0];
    for (let i = 1; i < symbols.length; i += 1) sum += symbols[i] * i;
    symbols.push(sum % 103);
    symbols.push(106);
    let bits = '';
    symbols.forEach((symbol) => {
      const pattern = CODE128[symbol];
      let bar = true;
      for (let i = 0; i < pattern.length; i += 1) {
        bits += (bar ? '1' : '0').repeat(Number(pattern.charAt(i)));
        bar = !bar;
      }
    });
    return bits;
  }

  function barcodeDataUrl(text) {
    const bits = code128Bits(text);
    if (!bits) return '';
    const quiet = 10;
    const height = 60;
    const width = bits.length + quiet * 2;
    let x = quiet;
    let run = 0;
    let bars = '';
    function paint() {
      if (!run) return;
      bars += '<rect x="' + x + '" y="0" width="' + run + '" height="' + height + '" fill="#000"/>';
      x += run;
      run = 0;
    }
    for (let i = 0; i < bits.length; i += 1) {
      if (bits.charAt(i) === '1') run += 1;
      else {
        paint();
        x += 1;
      }
    }
    paint();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" shape-rendering="crispEdges">'
      + '<rect width="100%" height="100%" fill="#fff"/>' + bars + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  const api = {
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    MAX_STICKERS: MAX_STICKERS,
    MAX_LISTS: MAX_LISTS,
    MIN_SCALE: MIN_SCALE,
    MAX_SCALE: MAX_SCALE,
    BASE_ROLL: BASE_ROLL,
    clampScale: clampScale,
    DEFAULT_COLOR_1: DEFAULT_COLOR_1,
    DEFAULT_COLOR_2: DEFAULT_COLOR_2,
    normalizeHex: normalizeHex,
    isDark: isDark,
    parseList: parseList,
    alignMarks: alignMarks,
    sameValues: sameValues,
    applyClick: applyClick,
    stickerTextColor: stickerTextColor,
    stickerFill: stickerFill,
    dockSide: dockSide,
    sanitizeMode: sanitizeMode,
    sanitizeState: sanitizeState,
    readStored: readStored,
    printModel: printModel,
    fallbackName: fallbackName,
    upsertList: upsertList,
    exportBody: exportBody,
    exportFileName: exportFileName,
    code128Bits: code128Bits,
    barcodeDataUrl: barcodeDataUrl,
  };

  if (globalThis.__srExpose) globalThis.__sr = api;
  if (globalThis.__srNoBoot) return;

  const installed = Symbol.for('abelrigm.stickerRoll');
  if (globalThis[installed]) return;
  globalThis[installed] = true;

  function storageGet() {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(STORAGE_KEY, null);
    } catch (error) { /* use the page store */ }
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function storageSet(payload) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(STORAGE_KEY, payload);
        return;
      }
    } catch (error) { /* use the page store */ }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) { /* private mode */ }
  }

  const state = readStored(storageGet());
  const barcodeCache = new Map();
  let persistTimer = 0;
  let root = null;

  function payload() {
    return {
      side: state.side,
      color1: state.color1,
      color2: state.color2,
      mode: state.mode,
      name: state.name,
      draft: state.draft,
      values: state.values,
      marks: state.marks,
      rollVisible: state.rollVisible,
      panelOpen: state.panelOpen,
      scale: state.scale,
      hidden: state.hidden,
      lists: state.lists,
    };
  }

  function writeState() {
    persistTimer = 0;
    storageSet(payload());
  }

  function persist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(writeState, 160);
  }

  function flush() {
    if (persistTimer) clearTimeout(persistTimer);
    writeState();
  }

  function cachedBarcode(value) {
    if (barcodeCache.has(value)) return barcodeCache.get(value);
    const url = barcodeDataUrl(value);
    barcodeCache.set(value, url);
    return url;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function paintSticker(button, mark) {
    const color = stickerFill(mark, state.color1, state.color2);
    button.dataset.mark = String(mark);
    button.style.background = color;
    button.style.color = stickerTextColor(mark, state.color1, state.color2);
    const names = ['white', 'color 1', 'color 2'];
    button.setAttribute('aria-label', button.dataset.value + ', ' + (names[mark] || names[0]));
  }

  function syncShell() {
    if (!root) return;
    root.dataset.side = state.side;
    root.dataset.roll = state.rollVisible ? 'on' : 'off';
    root.dataset.panel = state.panelOpen ? 'open' : 'closed';
    root.hidden = state.hidden;
    root.style.setProperty('--sr-scale', String(state.scale || 1));
    const bar = root.querySelector('#sr-bar');
    const launch = root.querySelector('#sr-launch');
    if (bar) bar.hidden = !state.panelOpen;
    if (launch) launch.hidden = state.panelOpen;
    const sideButton = root.querySelector('[data-action="side"]');
    if (sideButton) {
      sideButton.textContent = state.side === 'right' ? 'Right' : 'Left';
      sideButton.title = state.side === 'right' ? 'Roll is on the right' : 'Roll is on the left';
    }
    root.querySelectorAll('input[data-color]').forEach((input) => {
      const next = input.dataset.color === '2' ? state.color2 : state.color1;
      if (input.value.toLowerCase() !== next) input.value = next;
    });
    root.querySelectorAll('[data-mode]').forEach((button) => {
      const on = String(state.mode) === button.dataset.mode;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (button.dataset.mode === '1') {
        button.style.background = state.color1;
        button.style.color = isDark(state.color1) ? '#ffffff' : '#1a1a1a';
      } else if (button.dataset.mode === '2') {
        button.style.background = state.color2;
        button.style.color = isDark(state.color2) ? '#ffffff' : '#1a1a1a';
      }
    });
    const roll = root.querySelector('#sr-roll');
    if (roll) roll.hidden = !(state.rollVisible && state.panelOpen);
  }

  function repaintStickers() {
    if (!root) return;
    root.querySelectorAll('.sr-sticker').forEach((button) => {
      paintSticker(button, Number(button.dataset.mark) || 0);
    });
  }

  function renderRoll() {
    const roll = root.querySelector('#sr-stickers');
    roll.replaceChildren();
    state.values.forEach((value, index) => {
      const button = el('button', 'sr-sticker');
      button.type = 'button';
      button.setAttribute('role', 'listitem');
      button.dataset.index = String(index);
      button.dataset.value = value;
      button.title = value;
      const image = el('img', 'sr-code');
      image.alt = 'barcode';
      image.draggable = false;
      const url = cachedBarcode(value);
      if (url) image.src = url;
      else image.hidden = true;
      const label = el('span', 'sr-value', value);
      if (value.length > 42) label.classList.add('is-long');
      else if (value.length > 24) label.classList.add('is-medium');
      button.append(image, label);
      paintSticker(button, state.marks[index] || 0);
      roll.append(button);
    });
    syncShell();
  }

  function fillHistory() {
    const select = root.querySelector('#sr-history');
    const selected = select.value;
    select.replaceChildren();
    const placeholder = el('option', '', 'History');
    placeholder.value = '';
    select.append(placeholder);
    state.lists.forEach((list) => {
      const option = el('option', '', list.name);
      option.value = list.id;
      select.append(option);
    });
    if ([].some.call(select.options, (option) => option.value === selected)) select.value = selected;
  }

  function setStatus(text) {
    const status = root.querySelector('#sr-status');
    if (status) status.textContent = text || '';
  }

  function setColor(slot, value) {
    const fallback = slot === '2' ? DEFAULT_COLOR_2 : DEFAULT_COLOR_1;
    const hex = normalizeHex(value, fallback);
    if (slot === '2') state.color2 = hex;
    else state.color1 = hex;
    syncShell();
    repaintStickers();
    persist();
  }

  function setMode(mode) {
    const next = sanitizeMode(mode);
    state.mode = String(state.mode) === String(next) && next !== 'cycle' ? 'cycle' : next;
    syncShell();
    persist();
  }

  function setSide(side) {
    state.side = side === 'right' ? 'right' : 'left';
    syncShell();
    persist();
  }

  function setPanel(open) {
    state.panelOpen = open === true;
    state.hidden = false;
    if (!state.panelOpen && root) {
      const box = root.querySelector('#sr-list');
      if (box) box.blur();
    }
    if (!root) mount();
    else syncShell();
    persist();
  }

  function showUi() {
    setPanel(true);
  }

  function hideUi() {
    setPanel(false);
  }

  function onPrint() {
    const box = root.querySelector('#sr-list');
    const printed = printModel(state, box.value);
    if (printed.error) {
      setStatus(printed.error);
      box.focus();
      return;
    }
    state.values = printed.values;
    state.marks = printed.marks;
    state.draft = box.value;
    state.rollVisible = true;
    state.hidden = false;
    state.panelOpen = true;
    renderRoll();
    setStatus(printed.status);
    persist();
  }

  function onSave() {
    if (!state.values.length) {
      const printed = printModel(state, root.querySelector('#sr-list').value);
      if (printed.error) {
        setStatus('Print a list first');
        return;
      }
      state.values = printed.values;
      state.marks = printed.marks;
      state.draft = root.querySelector('#sr-list').value;
      state.rollVisible = true;
      renderRoll();
    }
    const nameInput = root.querySelector('#sr-name');
    const name = nameInput.value.trim() || fallbackName(state.values);
    const saved = upsertList(state.lists, {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      values: state.values,
      marks: state.marks,
      savedAt: Date.now(),
    });
    if (saved.error) {
      setStatus(saved.error);
      return;
    }
    state.lists = saved.lists;
    state.name = saved.entry.name;
    nameInput.value = saved.entry.name;
    fillHistory();
    root.querySelector('#sr-history').value = saved.entry.id;
    setStatus('Saved');
    persist();
  }

  function onLoad(id) {
    const entry = state.lists.find((list) => list.id === id);
    if (!entry) return;
    state.name = entry.name;
    state.values = entry.values.slice();
    state.marks = entry.marks.slice();
    state.draft = entry.values.join('\n');
    state.rollVisible = true;
    root.querySelector('#sr-name').value = entry.name;
    root.querySelector('#sr-list').value = state.draft;
    renderRoll();
    setStatus(state.values.length + ' loaded');
    persist();
  }

  function onDelete() {
    const select = root.querySelector('#sr-history');
    if (!select.value) {
      setStatus('Pick a saved list');
      return;
    }
    state.lists = state.lists.filter((list) => list.id !== select.value);
    fillHistory();
    setStatus('Deleted');
    persist();
  }

  function onExport() {
    const box = root.querySelector('#sr-list');
    const values = state.values.length ? state.values : parseList(box.value);
    if (!values.length) {
      setStatus('Nothing to export');
      return;
    }
    const name = root.querySelector('#sr-name').value.trim() || fallbackName(values);
    const blob = new Blob([exportBody(values)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = el('a');
    link.href = url;
    link.download = exportFileName(name);
    document.documentElement.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus('Exported');
  }

  function onListInput() {
    state.draft = root.querySelector('#sr-list').value;
    persist();
  }

  function mount() {
    if (root) root.remove();
    root = el('div');
    root.id = 'sr-root';

    const style = el('style');
    style.textContent = [
      '#sr-root{position:fixed;inset:0;z-index:2147483647;pointer-events:none;color-scheme:light;',
      'font-family:"Segoe UI",system-ui,-apple-system,sans-serif;color:#2a2a2a;}',
      '#sr-root[hidden]{display:none !important;}',
      '#sr-root *,#sr-root *::before,#sr-root *::after{box-sizing:border-box;}',
      '#sr-launch,#sr-bar,#sr-roll,#sr-grip{pointer-events:auto;}',
      '#sr-bar{position:absolute;top:8px;left:0;right:0;width:max-content;max-width:calc(100% - 16px);',
      'margin:0 auto;transform:none;',
      'display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:center;',
      'padding:8px 10px;',
      'background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:16px;',
      'box-shadow:0 1px 1px rgba(0,0,0,.05),0 7px 14px rgba(0,0,0,.08);',
      'font-size:11px;line-height:1.2;}',
      '#sr-root[data-roll="on"][data-side="left"] #sr-bar{left:calc(248px * var(--sr-scale, 1));right:8px;}',
      '#sr-root[data-roll="on"][data-side="right"] #sr-bar{left:8px;right:calc(248px * var(--sr-scale, 1));}',
      '#sr-launch{position:absolute !important;top:12px !important;left:50% !important;transform:translateX(-50%) !important;',
      'z-index:4 !important;width:24px !important;height:24px !important;margin:0 !important;padding:0 !important;',
      'border-radius:50% !important;border:1px solid rgba(0,0,0,.08) !important;background:#fff !important;',
      'box-shadow:0 1px 1px rgba(0,0,0,.05),0 4px 10px rgba(0,0,0,.12) !important;cursor:pointer !important;',
      'opacity:1 !important;visibility:visible !important;font-size:13px !important;line-height:1 !important;',
      'display:flex !important;align-items:center !important;justify-content:center !important;}',
      '#sr-launch:hover{background:#fff !important;}',
      '#sr-bar{z-index:3;}',
      '#sr-roll{z-index:1;}',
      '#sr-bar:has(#sr-list:focus){align-items:flex-start;border-radius:16px;background:#fff;}',
      '#sr-list{width:148px;height:22px;margin:0;padding:3px 8px;resize:none;overflow:hidden;',
      'border:1px solid transparent;border-radius:999px;background:rgba(255,255,255,.55);',
      'color:#333;font:inherit;outline:none;}',
      '#sr-list::placeholder{color:#9a9a9a;}',
      '#sr-list:focus{width:220px;height:92px;overflow:auto;border-radius:8px;',
      'border-color:rgba(0,0,0,.14);background:#fff;}',
      '#sr-name{width:76px;height:22px;margin:0;padding:2px 7px;border:1px solid transparent;',
      'border-radius:999px;background:rgba(255,255,255,.55);color:#333;font:inherit;outline:none;}',
      '#sr-name:focus{border-color:rgba(0,0,0,.14);background:#fff;}',
      '#sr-history{width:92px;height:22px;margin:0;padding:0 4px;border:1px solid transparent;',
      'border-radius:999px;background:rgba(255,255,255,.7);color:#444;font:inherit;outline:none;}',
      '#sr-bar button{margin:0;border:0;background:transparent;color:#444;font:inherit;font-weight:600;',
      'border-radius:999px;padding:3px 7px;cursor:pointer;line-height:1.2;}',
      '#sr-print{background:#2c2c2c !important;color:#fff !important;padding:4px 10px !important;}',
      '#sr-bar button:hover{background:rgba(0,0,0,.06);}',
      '#sr-print:hover{background:#111 !important;}',
      '#sr-hide{width:22px !important;height:22px !important;padding:0 !important;border-radius:50% !important;',
      'background:#d01212 !important;color:#fff !important;font-size:14px !important;font-weight:700 !important;}',
      '#sr-hide:hover{background:#a30e0e !important;}',
      '#sr-status{min-width:0;max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#888;}',
      '#sr-key{color:#888;font-size:10px;font-weight:700;}',
      '#sr-bar .sr-mode{border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:8px;padding:3px 7px;}',
      '#sr-bar .sr-mode[aria-pressed="true"]{box-shadow:inset 0 0 0 1.5px #222;}',
      '#sr-bar input[type="color"]{-webkit-appearance:none;appearance:none;',
      'width:16px;height:16px;padding:0;border:1px solid rgba(0,0,0,.25);border-radius:50%;',
      'background:transparent;cursor:pointer;}',
      '#sr-bar input[type="color"]::-webkit-color-swatch-wrapper{padding:0;}',
      '#sr-bar input[type="color"]::-webkit-color-swatch{border:0;border-radius:50%;}',
      '#sr-roll{position:absolute;top:0;bottom:0;width:calc(248px * var(--sr-scale, 1));',
      'display:flex;flex-direction:column;overflow:hidden;background:#f4f3f1;}',
      '#sr-stickers{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;',
      'padding:10px 0 8px;scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.28) transparent;}',
      '#sr-root[data-side="left"] #sr-roll{left:0;box-shadow:12px 0 28px rgba(0,0,0,.16);}',
      '#sr-root[data-side="right"] #sr-roll{right:0;box-shadow:-12px 0 28px rgba(0,0,0,.16);}',
      '#sr-stickers::-webkit-scrollbar{width:8px;}',
      '#sr-stickers::-webkit-scrollbar-thumb{background:rgba(0,0,0,.25);border-radius:8px;}',
      '#sr-grip{flex:none;height:28px;display:flex;align-items:center;justify-content:center;cursor:ns-resize;',
      'touch-action:none;background:#f4f3f1;border-top:1px solid rgba(0,0,0,.08);}',
      '#sr-grip i{display:block;width:42px;max-width:46%;height:4px;border-radius:4px;background:rgba(0,0,0,.35);}',
      '.sr-sticker{all:unset;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;',
      'justify-content:flex-start;width:calc(100% - calc(28px * var(--sr-scale, 1)));',
      'min-height:calc(86px * var(--sr-scale, 1));margin:calc(4px * var(--sr-scale, 1)) calc(14px * var(--sr-scale, 1));',
      'padding:calc(8px * var(--sr-scale, 1)) calc(8px * var(--sr-scale, 1)) calc(7px * var(--sr-scale, 1));',
      'border-radius:calc(16px * var(--sr-scale, 1));background:#fff;cursor:pointer;position:relative;overflow:hidden;user-select:none;',
      'box-shadow:0 1px 1px rgba(0,0,0,.05),0 7px 14px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.85);',
      'border:1px solid rgba(0,0,0,.06);transition:background-color .12s ease,color .12s ease;}',
      '.sr-sticker::before{content:"";position:absolute;left:0;right:0;top:0;height:42%;',
      'background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0));pointer-events:none;}',
      '.sr-sticker:focus-visible{outline:2px solid #222;outline-offset:2px;}',
      '.sr-sticker:active{transform:scale(.985);}',
      '.sr-code{width:100%;height:calc(46px * var(--sr-scale, 1));object-fit:fill;',
      'background:#fff;padding:0;border-radius:2px;',
      'position:relative;z-index:1;pointer-events:none;}',
      '.sr-value{position:relative;z-index:1;margin-top:calc(3px * var(--sr-scale, 1));max-width:100%;text-align:center;',
      'font-weight:600;font-size:calc(13px * var(--sr-scale, 1));line-height:1.15;letter-spacing:0;',
      'overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.sr-value.is-medium{font-size:calc(11px * var(--sr-scale, 1));}',
      '.sr-value.is-long{font-size:calc(10px * var(--sr-scale, 1));}',
      '#sr-launch[hidden],#sr-bar[hidden],#sr-roll[hidden]{display:none !important;}',
    ].join('');
    root.append(style);

    const bar = el('div');
    bar.id = 'sr-bar';
    const list = el('textarea');
    list.id = 'sr-list';
    list.placeholder = 'values';
    list.rows = 1;
    list.spellcheck = false;
    list.title = 'One value per line. Commas work on a single line. Ctrl+Enter prints.';
    list.value = state.draft || state.values.join('\n');
    list.setAttribute('aria-label', 'Sticker values');

    const print = el('button', '', 'Print');
    print.id = 'sr-print';
    print.type = 'button';
    print.dataset.action = 'print';
    print.title = 'Print the list as a sticker roll';

    const side = el('button', '', state.side === 'right' ? 'Right' : 'Left');
    side.type = 'button';
    side.dataset.action = 'side';
    side.title = 'Which side the roll sits on';

    const color1 = el('input');
    color1.type = 'color';
    color1.dataset.color = '1';
    color1.value = state.color1;
    color1.title = 'First click color';
    color1.setAttribute('aria-label', 'First click color');

    const color2 = el('input');
    color2.type = 'color';
    color2.dataset.color = '2';
    color2.value = state.color2;
    color2.title = 'Second click color';
    color2.setAttribute('aria-label', 'Second click color');

    const name = el('input');
    name.id = 'sr-name';
    name.type = 'text';
    name.placeholder = 'name';
    name.value = state.name || '';
    name.maxLength = 80;
    name.setAttribute('aria-label', 'List name');
    name.autocomplete = 'off';

    const save = el('button', '', 'Save');
    save.type = 'button';
    save.dataset.action = 'save';
    save.title = 'Save this list under the name';

    const history = el('select');
    history.id = 'sr-history';
    history.title = 'Saved lists';
    history.setAttribute('aria-label', 'Saved lists');

    const exportButton = el('button', '', 'Export');
    exportButton.type = 'button';
    exportButton.dataset.action = 'export';
    exportButton.title = 'Download the values as a text file';

    const cycle = el('button', 'sr-mode', 'Cycle');
    cycle.type = 'button';
    cycle.dataset.mode = 'cycle';
    cycle.title = 'Clicks go to color 1, then color 2, then white';

    const paint1 = el('button', 'sr-mode', '1');
    paint1.type = 'button';
    paint1.dataset.mode = '1';
    paint1.title = 'Paint color 1';

    const paint2 = el('button', 'sr-mode', '2');
    paint2.type = 'button';
    paint2.dataset.mode = '2';
    paint2.title = 'Paint color 2';

    const paintWhite = el('button', 'sr-mode', 'White');
    paintWhite.type = 'button';
    paintWhite.dataset.mode = '0';
    paintWhite.title = 'Paint white';

    const del = el('button', '', 'Del');
    del.type = 'button';
    del.dataset.action = 'delete';
    del.title = 'Delete the selected saved list';

    const hide = el('button', '', '×');
    hide.id = 'sr-hide';
    hide.type = 'button';
    hide.dataset.action = 'hide';
    hide.title = 'Close the panel';
    hide.setAttribute('aria-label', 'Close the panel');

    const status = el('span', '', '');
    status.id = 'sr-status';
    status.setAttribute('aria-live', 'polite');

    bar.append(list, print, side, cycle, paint1, color1, paint2, color2, paintWhite, name, save, history, exportButton, del, hide, status);

    const launch = el('button', '', '🏷️');
    launch.id = 'sr-launch';
    launch.type = 'button';
    launch.dataset.action = 'open';
    launch.title = 'Open sticker roll';
    launch.setAttribute('aria-label', 'Open sticker roll');

    const roll = el('div');
    roll.id = 'sr-roll';
    const stickers = el('div');
    stickers.id = 'sr-stickers';
    stickers.setAttribute('role', 'list');
    stickers.setAttribute('aria-label', 'Sticker roll');
    const grip = el('div');
    grip.id = 'sr-grip';
    grip.tabIndex = 0;
    grip.title = 'Drag down to enlarge the roll, up to shrink it';
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'horizontal');
    grip.setAttribute('aria-label', 'Resize the roll');
    grip.append(el('i'));
    roll.append(stickers, grip);
    grip.addEventListener('pointerdown', (event) => {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      grip.setPointerCapture(event.pointerId);
      const startY = event.clientY;
      const startScale = state.scale;
      function move(ev) {
        state.scale = clampScale(startScale + (ev.clientY - startY) / 160);
        root.style.setProperty('--sr-scale', String(state.scale));
      }
      function end() {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', end);
        grip.removeEventListener('pointercancel', end);
        persist();
      }
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    });
    grip.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') state.scale = clampScale(state.scale + 0.08);
      else if (event.key === 'ArrowUp') state.scale = clampScale(state.scale - 0.08);
      else return;
      event.preventDefault();
      root.style.setProperty('--sr-scale', String(state.scale));
      persist();
    });

    root.append(launch, bar, roll);
    root.addEventListener('pointerdown', (event) => event.stopPropagation());
    root.addEventListener('mousedown', (event) => event.stopPropagation());
    root.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      const modeButton = event.target.closest('[data-mode]');
      if (action) {
        event.preventDefault();
        const kind = action.dataset.action;
        if (kind === 'print') onPrint();
        else if (kind === 'side') setSide(state.side === 'left' ? 'right' : 'left');
        else if (kind === 'save') onSave();
        else if (kind === 'export') onExport();
        else if (kind === 'delete') onDelete();
        else if (kind === 'open') setPanel(true);
        else if (kind === 'hide') setPanel(false);
      } else if (modeButton && bar.contains(modeButton)) {
        event.preventDefault();
        setMode(modeButton.dataset.mode);
      } else {
        const sticker = event.target.closest('.sr-sticker');
        if (sticker && roll.contains(sticker)) {
          event.preventDefault();
          const index = Number(sticker.dataset.index);
          const mark = applyClick(state.marks[index], state.mode);
          state.marks[index] = mark;
          paintSticker(sticker, mark);
          persist();
        }
      }
      event.stopPropagation();
    });

    list.addEventListener('input', onListInput);
    list.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onPrint();
      }
    });
    name.addEventListener('input', () => {
      state.name = name.value;
      persist();
    });
    name.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onSave();
      }
    });
    history.addEventListener('change', () => {
      if (history.value) onLoad(history.value);
    });
    root.querySelectorAll('input[type="color"]').forEach((input) => {
      input.addEventListener('input', () => setColor(input.dataset.color, input.value));
    });

    document.documentElement.appendChild(root);
    fillHistory();
    if (state.rollVisible) renderRoll();
    else syncShell();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Show sticker roll', showUi);
    GM_registerMenuCommand('Close sticker panel', hideUi);
    GM_registerMenuCommand('Move sticker roll', () => {
      showUi();
      setSide(state.side === 'left' ? 'right' : 'left');
    });
  }

  mount();
})();
