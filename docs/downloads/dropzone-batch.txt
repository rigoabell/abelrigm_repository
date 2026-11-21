// ==UserScript==
// @name         Dropzone Batch (abelrigm)
// @namespace    https://github.com/rigoabell/abelrigm_repository
// @version      0.2.5
// @updateURL    https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/dropzone-batch.user.js
// @downloadURL  https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/dropzone-batch.user.js
// @description  Paste containers and one dropzone. Sends each container, then that dropzone, as a scan-gun burst.
// @author       abelrigm
// @match        https://aft-moveapp.na.aftx.amazonoperations.app/*
// @match        https://aft-moveapp.eu.aftx.amazonoperations.app/*
// @match        https://aft-moveapp.fe.aftx.amazonoperations.app/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '0.2.5';
  const PANEL_ID = 'dz-batch-panel';
  const SCAN_STRATEGY = 'focus';
  const SCAN_SUFFIX = 'Enter';
  const SCAN_GAP_MS = 0;
  const SCAN_PAUSE_MS = 200;
  const STORE = 'dz_batch_v1';
  const KEY_EVENTS = new Set(['keydown', 'keypress', 'keyup']);

  const listenerStats = [];
  const wrapMap = new WeakMap();
  const logs = [];
  const attempts = [];
  const results = [];
  const realScans = [];

  let generation = 0;
  let running = false;
  let skipRequested = false;
  let currentContainer = '';
  let realBuffer = [];
  let realTimer = 0;
  const doneIds = new Set();
  const skippedIds = [];

  function noteListener(type, target) {
    const name = describe(target);
    const found = listenerStats.find((row) => row.type === type && row.target === name);
    if (found) {
      found.count += 1;
      return;
    }
    if (listenerStats.length < 40) listenerStats.push({ type, target: name, count: 1 });
  }

  function patchWindow(win) {
    let proto;
    try {
      proto = win.EventTarget && win.EventTarget.prototype;
    } catch (err) {
      return;
    }
    if (!proto || proto.__dzPatched) return;
    const origAdd = proto.addEventListener;
    const origRemove = proto.removeEventListener;
    if (typeof origAdd !== 'function') return;

    try {
      proto.addEventListener = function dzAddEventListener(type, listener, options) {
        if (!listener || !KEY_EVENTS.has(type)) return origAdd.call(this, type, listener, options);
        try {
          noteListener(type, this);
        } catch (err) {
          /* keep the page listener */
        }
        let wrapped = wrapMap.get(listener);
        if (!wrapped) {
          wrapped = function dzWrappedKey(event) {
            try {
              const target = event && event.target;
              if (target && typeof target.closest === 'function' && target.closest('#' + PANEL_ID)) return;
            } catch (err) {
              /* deliver the event */
            }
            if (typeof listener === 'function') return listener.apply(this, arguments);
            if (listener && typeof listener.handleEvent === 'function') return listener.handleEvent(event);
          };
          try {
            wrapMap.set(listener, wrapped);
          } catch (err) {
            return origAdd.call(this, type, listener, options);
          }
        }
        return origAdd.call(this, type, wrapped, options);
      };

      proto.removeEventListener = function dzRemoveEventListener(type, listener, options) {
        const wrapped = listener ? wrapMap.get(listener) : null;
        return origRemove.call(this, type, wrapped || listener, options);
      };
      proto.__dzPatched = true;
    } catch (err) {
      /* the page locked its event prototype; the panel still runs */
    }
  }

  patchWindow(window);
  try {
    patchWindow(unsafeWindow);
  } catch (err) {
    /* sandbox has no page window */
  }

  function log(message) {
    const stamp = new Date().toLocaleTimeString('en-US', {
      timeZone: 'America/Chicago',
      hour12: false,
    });
    logs.push(stamp + ' ' + message);
    if (logs.length > 200) logs.shift();
    console.log('[DropzoneBatch]', message);
  }

  function chicagoNow() {
    return new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      hour12: false,
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function clip(value, max) {
    const text = String(value == null ? '' : value);
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function cleanToken(value) {
    return String(value || '').trim().replace(/^["']|["']$/g, '').trim();
  }

  function parseContainers(text) {
    return String(text || '')
      .split(/[\r\n,;\t]+/)
      .map(cleanToken)
      .filter(Boolean);
  }

  function remainingContainers(text, doneList, skippedList, dropzone) {
    const done = new Set(doneList || []);
    const skips = new Map();
    (skippedList || []).forEach((id) => {
      skips.set(id, (skips.get(id) || 0) + 1);
    });
    const zone = cleanToken(dropzone).toLowerCase();
    return parseContainers(text).filter((id) => {
      if (done.has(id)) return false;
      if (zone && id.toLowerCase() === zone) return false;
      const leftSkips = skips.get(id) || 0;
      if (leftSkips > 0) {
        skips.set(id, leftSkips - 1);
        return false;
      }
      return true;
    });
  }

  function stableText(text) {
    return String(text || '')
      .replace(/\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?/gi, '#')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function newBadPhrase(before, after) {
    const needles = [
      'invalid',
      'not found',
      'unknown barcode',
      'unsuccessful',
      'not be moved',
      'can not',
      'cannot',
      "can't",
      'does not',
      "doesn't",
      'unrecognized',
      'no such',
      'already scanned',
      'try a different',
      'try again',
      'failed',
      'error',
      'unknown',
    ];
    const prev = String(before || '').toLowerCase();
    const next = String(after || '').toLowerCase();
    for (const phrase of needles) {
      if (next.includes(phrase) && !prev.includes(phrase)) return phrase;
    }
    return '';
  }

  function dropzoneAccepted(text) {
    return String(text || '').toLowerCase().includes('move successful');
  }

  function loadStore() {
    try {
      const value = GM_getValue(STORE, null);
      if (value && typeof value === 'object') return value;
    } catch (err) {
      /* fall through */
    }
    try {
      const raw = localStorage.getItem(STORE);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function saveStore(partial) {
    const next = Object.assign({}, loadStore(), partial);
    try {
      GM_setValue(STORE, next);
    } catch (err) {
      /* ignore */
    }
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch (err) {
      /* ignore */
    }
  }

  function todayKey() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  }

  function describe(node) {
    try {
      if (!node) return 'null';
      if (node === window) return 'window';
      try {
        if (typeof unsafeWindow !== 'undefined' && node === unsafeWindow) return 'window';
      } catch (err) {
        /* ignore */
      }
      if (typeof Document !== 'undefined' && node instanceof Document) return 'document';
      if (!node.tagName) return String(node);
      let text = node.tagName.toLowerCase();
      if (node.id) text += '#' + node.id;
      if (typeof node.className === 'string' && node.className.trim()) {
        text += '.' + node.className.trim().split(/\s+/).slice(0, 3).join('.');
      }
      const hint = node.getAttribute && (
        node.getAttribute('aria-label')
        || node.getAttribute('placeholder')
        || node.getAttribute('name')
        || node.getAttribute('data-testid')
      );
      if (hint) text += '[' + clip(hint, 40) + ']';
      if (node.ownerDocument && node.ownerDocument !== document) text = 'iframe ' + text;
      return text;
    } catch (err) {
      return 'unreadable';
    }
  }

  function isOurNode(node) {
    return !!(node && node.closest && node.closest('#' + PANEL_ID));
  }

  function eachRoot(visit) {
    const seen = new Set();
    const walk = (root) => {
      if (!root || seen.has(root) || !root.querySelectorAll) return;
      seen.add(root);
      visit(root);
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) walk(el.shadowRoot);
      });
    };
    walk(document);
    document.querySelectorAll('iframe, frame').forEach((frame) => {
      try {
        if (frame.contentDocument) walk(frame.contentDocument);
      } catch (err) {
        /* cross-origin frame */
      }
    });
  }

  function collect(selector) {
    const out = [];
    eachRoot((root) => {
      try {
        root.querySelectorAll(selector).forEach((el) => out.push(el));
      } catch (err) {
        /* ignore a bad root */
      }
    });
    return out;
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1 || !el.getBoundingClientRect) return false;
    const view = el.ownerDocument && el.ownerDocument.defaultView;
    if (!view) return false;
    const style = view.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function deepActive(doc) {
    let el = doc && doc.activeElement;
    const guard = new Set();
    while (el && el.shadowRoot && el.shadowRoot.activeElement && !guard.has(el)) {
      guard.add(el);
      el = el.shadowRoot.activeElement;
    }
    return el;
  }

  function pageFocus() {
    const docs = [];
    eachRoot((root) => {
      const doc = root.nodeType === 9 ? root : root.ownerDocument;
      if (doc && docs.indexOf(doc) === -1) docs.push(doc);
    });
    if (docs.indexOf(document) === -1) docs.unshift(document);
    let fallback = document.body || document.documentElement;
    for (const doc of docs) {
      const el = deepActive(doc);
      if (!el || isOurNode(el)) continue;
      if (el === doc.body || el === doc.documentElement) {
        fallback = el;
        continue;
      }
      return el;
    }
    return fallback;
  }

  function bodyText() {
    let out = '';
    const walk = (node) => {
      if (!node || out.length > 200000) return;
      if (node.nodeType === 3) {
        out += node.nodeValue;
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return;
      if (node.nodeType === 1) {
        if (node.id === PANEL_ID) return;
        const tag = node.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
        if (node.shadowRoot) walk(node.shadowRoot);
      }
      const kids = node.childNodes;
      for (let i = 0; i < kids.length; i += 1) walk(kids[i]);
    };
    if (document.body) walk(document.body);
    document.querySelectorAll('iframe, frame').forEach((frame) => {
      try {
        if (frame.contentDocument && frame.contentDocument.body) walk(frame.contentDocument.body);
      } catch (err) {
        /* cross-origin frame */
      }
    });
    return out.replace(/\s+/g, ' ').trim();
  }

  function codeFor(ch) {
    if (/^[a-zA-Z]$/.test(ch)) return 'Key' + ch.toUpperCase();
    if (/^[0-9]$/.test(ch)) return 'Digit' + ch;
    if (ch === ' ') return 'Space';
    if (ch === '-' || ch === '_') return 'Minus';
    if (ch === '.') return 'Period';
    if (ch === ',') return 'Comma';
    if (ch === '/') return 'Slash';
    if (ch === '\\') return 'Backslash';
    return '';
  }

  function legacyCode(ch) {
    if (ch === 'Enter') return 13;
    if (ch === 'Tab') return 9;
    if (/^[a-zA-Z]$/.test(ch)) return ch.toUpperCase().charCodeAt(0);
    return ch.charCodeAt(0);
  }

  function fireKey(view, target, type, ch) {
    const keyCode = legacyCode(ch);
    const init = {
      key: ch,
      code: ch === 'Enter' ? 'Enter' : ch === 'Tab' ? 'Tab' : codeFor(ch),
      bubbles: true,
      cancelable: true,
      composed: true,
      keyCode: keyCode,
      which: type === 'keypress' && ch !== 'Enter' && ch !== 'Tab' ? ch.charCodeAt(0) : keyCode,
      charCode: type === 'keypress' ? ch.charCodeAt(0) : 0,
    };
    let event;
    try {
      event = new view.KeyboardEvent(type, init);
    } catch (err) {
      event = new KeyboardEvent(type, init);
    }
    try {
      Object.defineProperty(event, 'keyCode', { configurable: true, get: () => keyCode });
      Object.defineProperty(event, 'which', { configurable: true, get: () => init.which });
      Object.defineProperty(event, 'charCode', { configurable: true, get: () => init.charCode });
    } catch (err) {
      /* browser locked the event fields */
    }
    return target.dispatchEvent(event);
  }

  function fireChar(view, target, ch) {
    let allowed = true;
    ['keydown', 'keypress', 'keyup'].forEach((type) => {
      try {
        if (!fireKey(view, target, type, ch)) allowed = false;
      } catch (err) {
        allowed = false;
      }
    });
    return allowed;
  }

  function viewOf(target) {
    return (target && target.ownerDocument && target.ownerDocument.defaultView) || window;
  }

  function fieldValue(el) {
    if (!el) return '';
    if (typeof el.value === 'string') return el.value;
    return el.textContent || '';
  }

  function setNativeValue(el, value) {
    const view = viewOf(el);
    const proto = el.tagName === 'TEXTAREA'
      ? view.HTMLTextAreaElement.prototype
      : view.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, value);
    else el.value = value;
  }

  function rankInput(el) {
    let score = 0;
    if (isVisible(el)) score += 10;
    if (!el.disabled) score += 3;
    if (!el.readOnly) score += 1;
    const blob = [
      el.placeholder,
      el.getAttribute && el.getAttribute('aria-label'),
      el.name,
      el.id,
      el.getAttribute && el.getAttribute('data-testid'),
    ].join(' ');
    if (/scan|barcode|container|drop|location|tote|lpn|bin/i.test(blob)) score += 8;
    if (el === deepActive(el.ownerDocument)) score += 12;
    return score;
  }

  function findScanInput() {
    const inputs = collect('input, textarea').filter((el) => {
      if (isOurNode(el)) return false;
      if (el.tagName === 'TEXTAREA') return true;
      const type = String(el.type || 'text').toLowerCase();
      return type === 'text' || type === 'search' || type === 'tel' || type === 'number' || type === '';
    });
    inputs.sort((a, b) => rankInput(b) - rankInput(a));
    return inputs[0] || null;
  }

  function chooseTarget(strategy) {
    if (strategy === 'body') return document.body || document.documentElement;
    if (strategy === 'fill') return findScanInput() || pageFocus() || document.body;
    return pageFocus() || document.body || document.documentElement;
  }

  function releasePanelFocus() {
    const active = document.activeElement;
    if (isOurNode(active) && typeof active.blur === 'function') active.blur();
  }

  async function burst(target, text, withChars) {
    const view = viewOf(target);
    const gap = SCAN_GAP_MS;
    let prevented = 0;
    if (withChars) {
      for (const ch of Array.from(text)) {
        if (generationStopped()) return prevented;
        if (!fireChar(view, target, ch)) prevented += 1;
        if (gap) await sleep(gap);
      }
    }
    if (generationStopped()) return prevented;
    if (!fireChar(view, target, SCAN_SUFFIX)) prevented += 1;
    return prevented;
  }

  function fillField(el, text) {
    const doc = el.ownerDocument;
    const view = viewOf(el);
    try { el.focus(); } catch (err) { /* ignore */ }
    if (typeof el.select === 'function') {
      try { el.select(); } catch (err) { /* ignore */ }
    }
    let execOk = false;
    try {
      execOk = !!(doc.execCommand && doc.execCommand('insertText', false, text));
    } catch (err) {
      execOk = false;
    }
    if (!execOk || (typeof el.value === 'string' && el.value !== text)) {
      try { setNativeValue(el, text); } catch (err) { el.value = text; }
      try {
        el.dispatchEvent(new view.InputEvent('input', {
          bubbles: true,
          composed: true,
          data: text,
          inputType: 'insertText',
        }));
      } catch (err) {
        el.dispatchEvent(new view.Event('input', { bubbles: true }));
      }
      el.dispatchEvent(new view.Event('change', { bubbles: true }));
      return execOk ? 'exec+native' : 'native';
    }
    return 'exec';
  }

  async function waitForSettle(beforeRaw, beforeSig) {
    const timeout = 8000;
    const settleMs = 250;
    const start = Date.now();
    let sawChange = false;
    let last = beforeSig;
    let stableAt = 0;
    while (Date.now() - start < timeout) {
      if (generationStopped() || skipRequested) {
        return {
          changed: sawChange,
          bad: '',
          excerpt: clip(bodyText(), 400),
          accepted: false,
          stopped: generationStopped(),
          skipped: skipRequested,
        };
      }
      const raw = bodyText();
      const sig = stableText(raw);
      if (sig !== last) {
        last = sig;
        if (sig !== beforeSig) {
          sawChange = true;
          stableAt = Date.now();
        }
      } else if (sawChange && stableAt && Date.now() - stableAt >= settleMs) {
        break;
      }
      await sleep(40);
    }
    const afterRaw = bodyText();
    return {
      changed: sawChange,
      bad: newBadPhrase(beforeRaw, afterRaw),
      excerpt: clip(afterRaw, 400),
      accepted: dropzoneAccepted(afterRaw),
      stopped: generationStopped(),
      skipped: skipRequested,
    };
  }

  let activeGeneration = 0;
  function generationStopped() {
    return activeGeneration !== generation;
  }

  async function sendScan(value, kind) {
    if (skipRequested) {
      return {
        changed: false,
        bad: '',
        excerpt: '',
        accepted: false,
        stopped: false,
        skipped: true,
        sent: false,
      };
    }
    releasePanelFocus();
    const strategy = SCAN_STRATEGY;
    const beforeRaw = bodyText();
    const beforeSig = stableText(beforeRaw);
    const target = chooseTarget(strategy);
    const attempt = {
      at: chicagoNow(),
      kind: kind,
      value: value,
      strategy: strategy,
      suffix: SCAN_SUFFIX,
      target: describe(target),
      focus: describe(pageFocus()),
    };
    log(kind + ' ' + value + ' via ' + strategy + ' -> ' + attempt.target);
    try {
      if (strategy === 'fill' || strategy === 'both') {
        const input = findScanInput();
        attempt.input = input ? describe(input) : 'none';
        attempt.fill = input ? fillField(input, value) : 'no input';
        attempt.valueAfterFill = input ? clip(fieldValue(input), 80) : '';
      }
      const keyTarget = strategy === 'fill'
        ? (findScanInput() || target)
        : target;
      attempt.keyTarget = describe(keyTarget);
      attempt.prevented = await burst(keyTarget, value, strategy !== 'fill');
    } catch (err) {
      attempt.error = String(err && err.message ? err.message : err);
    }
    const settled = await waitForSettle(beforeRaw, beforeSig);
    attempt.changed = settled.changed;
    attempt.bad = settled.bad;
    attempt.after = settled.excerpt;
    attempts.push(attempt);
    if (attempts.length > 20) attempts.shift();
    return {
      changed: settled.changed,
      bad: settled.bad,
      excerpt: settled.excerpt,
      accepted: settled.accepted,
      stopped: settled.stopped,
      skipped: !!settled.skipped || skipRequested,
      sent: true,
    };
  }

  function pushResult(row) {
    results.push(row);
    renderResults();
    saveStore({ results: results.slice(-100) });
  }

  function rememberDone(container) {
    doneIds.add(container);
    saveStore({ doneDay: todayKey(), doneIds: Array.from(doneIds) });
    updateCount();
  }

  function rememberSkip(container) {
    if (!container) return;
    skippedIds.push(container);
    saveStore({ doneDay: todayKey(), skippedIds: skippedIds.slice() });
    updateCount();
  }

  function noteSkip(container, detail) {
    rememberSkip(container);
    pushResult({
      container: container,
      status: 'skip',
      detail: detail,
    });
  }

  function requestSkip() {
    if (running) {
      if (skipRequested) return;
      skipRequested = true;
      setStatus('Skipping ' + (currentContainer || 'the next container') + '.');
      return;
    }
    const next = remainingContainers(valueOf('dz-containers'), doneIds, skippedIds, valueOf('dz-dropzone'))[0];
    if (!next) {
      setStatus('Nothing left to skip.');
      return;
    }
    noteSkip(next, 'Skipped that line. Other copies of this text still run.');
    setStatus('Skipped one ' + next + '. Other copies still run.');
  }

  function clickPageContinue() {
    const dialog = document.getElementById('exception-wrapper') || document.getElementById('exception-info');
    const scopes = dialog ? [dialog, document.body] : [document.body];
    for (const scope of scopes) {
      const nodes = scope.querySelectorAll('button, [role="button"], a, div, span');
      for (const el of nodes) {
        if (!el || el.closest('#' + PANEL_ID)) continue;
        if (!isVisible(el)) continue;
        const text = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (text.length > 24) continue;
        if (text !== 'continue' && text !== 'continue c') continue;
        try { el.click(); } catch (err) { /* the page can ignore it */ }
        return true;
      }
    }
    const exception = document.getElementById('exception-body');
    if (!exception || !isVisible(exception)) return false;
    const target = document.body || document.documentElement;
    fireChar(viewOf(target), target, 'c');
    return true;
  }

  async function dismissRejection(alive) {
    const before = stableText(bodyText());
    clickPageContinue();
    const start = Date.now();
    while (alive() && Date.now() - start < 2000) {
      if (stableText(bodyText()) !== before) return true;
      await sleep(80);
    }
    return false;
  }

  async function pause(ms, alive) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (!alive() || skipRequested) return;
      await sleep(40);
    }
  }

  async function runBatch() {
    if (running) return;
    const dropzone = cleanToken(valueOf('dz-dropzone'));
    const all = parseContainers(valueOf('dz-containers'));
    const todo = remainingContainers(valueOf('dz-containers'), doneIds, skippedIds, dropzone);
    if (!dropzone) {
      setStatus('Enter the dropzone first.');
      return;
    }
    if (!all.length) {
      setStatus('Paste at least one container.');
      return;
    }
    if (!todo.length) {
      const onlyZone = all.every((id) => id.toLowerCase() === dropzone.toLowerCase());
      setStatus(onlyZone
        ? 'Every pasted line is the dropzone. Paste container barcodes.'
        : 'Those containers are already done or skipped today. Reset done to run them again.');
      return;
    }

    running = true;
    skipRequested = false;
    generation += 1;
    activeGeneration = generation;
    const token = activeGeneration;
    const resultsAtStart = results.length;
    const alive = () => token === generation;
    setRunning(true);
    const zoneLines = all.filter((id) => id.toLowerCase() === dropzone.toLowerCase()).length;
    let startText = 'Running ' + todo.length + ' container' + (todo.length === 1 ? '' : 's') + ' to ' + dropzone + '.';
    if (zoneLines) {
      startText += ' Left out ' + zoneLines + ' line' + (zoneLines === 1 ? '' : 's') + ' that match the dropzone.';
    }
    setStatus(startText);

    try {
      for (let index = 0; index < todo.length; index += 1) {
        if (!alive()) break;
        const container = todo[index];
        currentContainer = container;
        if (doneIds.has(container)) continue;
        if (skipRequested) {
          skipRequested = false;
          noteSkip(container, 'Skipped before the scan.');
          continue;
        }
        const step = (index + 1) + '/' + todo.length;
        setStatus(step + ' scan container ' + container);
        const containerScan = await sendScan(container, 'container');
        if (!alive() || containerScan.stopped) break;
        if (containerScan.skipped) {
          skipRequested = false;
          if (!containerScan.sent) {
            noteSkip(container, 'Skipped before the scan.');
            continue;
          }
          noteSkip(container, 'Skipped after the container scan. Dropzone was not sent.');
          setStatus('Skipped ' + container + '. Clear the page back to Scan container, then press Start.');
          break;
        }
        if (!containerScan.changed) {
          pushResult({
            container: container,
            status: 'stuck',
            detail: 'Page did not change after the container scan.',
          });
          setStatus('Stopped on ' + container + '. Tap Continue if the page is waiting, then press Start.');
          break;
        }
        if (containerScan.bad) {
          noteSkip(container, 'Skipped that line. Container scan showed “' + containerScan.bad + '”. Other copies still run.');
          await dismissRejection(alive);
          continue;
        }

        await pause(SCAN_PAUSE_MS, alive);
        if (!alive()) break;
        if (skipRequested) {
          skipRequested = false;
          noteSkip(container, 'Skipped before the dropzone scan.');
          setStatus('Skipped ' + container + '. Clear the page back to Scan container, then press Start.');
          break;
        }
        setStatus(step + ' scan dropzone ' + dropzone);
        const dropScan = await sendScan(dropzone, 'dropzone');
        if (!alive() || dropScan.stopped) break;
        if (dropScan.skipped) {
          skipRequested = false;
          noteSkip(container, 'Skipped that line. Other copies of this text still run.');
          await dismissRejection(alive);
          continue;
        }
        if (!dropScan.changed) {
          pushResult({
            container: container,
            status: 'stuck',
            detail: 'Container was sent. Page did not change after the dropzone.',
          });
          setStatus('Stopped on ' + container + '. Tap Continue if the page is waiting, then press Start.');
          break;
        }
        if (dropScan.bad || !dropScan.accepted) {
          noteSkip(container, dropScan.bad
            ? 'Skipped that line. Dropzone scan showed “' + dropScan.bad + '”. Other copies still run.'
            : 'Skipped that line. The page did not say Move Successful. Other copies still run.');
          await dismissRejection(alive);
          continue;
        }
        rememberDone(container);
        pushResult({
          container: container,
          status: 'ok',
          detail: 'Sent to ' + dropzone + '.',
        });
        currentContainer = '';
        await pause(SCAN_PAUSE_MS, alive);
      }
    } catch (err) {
      log('run error ' + (err && err.message ? err.message : err));
      setStatus('Stopped on an error. Copy debug.');
    }

    currentContainer = '';
    running = false;
    setRunning(false);
    if (alive()) {
      const mine = results.slice(resultsAtStart);
      const ok = mine.filter((row) => row.status === 'ok').length;
      const skipped = mine.filter((row) => row.status === 'skip').length;
      const bad = mine.filter((row) => row.status !== 'ok' && row.status !== 'skip').length;
      const status = document.getElementById('dz-status');
      if (status && /^(Stopped|Skipped)/.test(status.textContent)) return;
      setStatus('Finished. ' + ok + ' sent, ' + skipped + ' skipped, ' + bad + ' not sent.');
    }
  }

  function stopBatch() {
    generation += 1;
    running = false;
    setRunning(false);
    setStatus('Stopped.');
  }

  function valueOf(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function setStatus(text) {
    const el = document.getElementById('dz-status');
    if (el) el.textContent = text;
    log(text);
  }

  function setRunning(isRunning) {
    const start = document.getElementById('dz-start');
    const stop = document.getElementById('dz-stop');
    if (start) start.disabled = isRunning;
    if (stop) stop.disabled = !isRunning;
  }

  function updateCount() {
    const el = document.getElementById('dz-count');
    if (!el) return;
    const all = parseContainers(valueOf('dz-containers'));
    const todo = remainingContainers(valueOf('dz-containers'), doneIds, skippedIds, valueOf('dz-dropzone')).length;
    el.replaceChildren();
    [
      [String(todo), 'to run'],
      [String(doneIds.size), 'done today'],
      [String(skippedIds.length), 'skipped'],
      [String(all.length), 'pasted'],
    ].forEach(([num, label]) => {
      const chip = document.createElement('span');
      chip.className = 'dz-stat';
      const strong = document.createElement('b');
      strong.textContent = num;
      chip.append(strong, document.createTextNode(' ' + label));
      el.appendChild(chip);
    });
  }

  function renderResults() {
    const list = document.getElementById('dz-results');
    if (!list) return;
    list.textContent = '';
    const view = results.slice(-40).reverse();
    if (!view.length) {
      const empty = document.createElement('div');
      empty.className = 'dz-empty';
      empty.textContent = 'Nothing sent yet.';
      list.appendChild(empty);
      return;
    }
    view.forEach((row) => {
      const item = document.createElement('div');
      item.className = 'dz-result dz-' + row.status;
      const dot = document.createElement('span');
      dot.className = 'dz-dot';
      const copy = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = row.container;
      const detail = document.createElement('span');
      detail.textContent = row.detail;
      copy.append(name, detail);
      item.append(dot, copy);
      list.appendChild(item);
    });
  }

  function updateFocusLine() {
    const el = document.getElementById('dz-focus');
    if (!el || running) return;
    el.textContent = 'Keys go to: ' + describe(pageFocus());
  }

  function inputSnapshot() {
    return collect('input, textarea, [contenteditable="true"]').slice(0, 25).map((el) => ({
      el: describe(el),
      type: el.type || '',
      value: clip(fieldValue(el), 80),
      placeholder: clip(el.placeholder || '', 60),
      aria: clip((el.getAttribute && el.getAttribute('aria-label')) || '', 60),
      disabled: !!el.disabled,
      readOnly: !!el.readOnly,
      visible: isVisible(el),
      focused: el === deepActive(el.ownerDocument),
    }));
  }

  function buttonSnapshot() {
    return collect('button, [role="button"], input[type="submit"]')
      .map((el) => clip(String(el.innerText || el.value || '').replace(/\s+/g, ' ').trim(), 80))
      .filter(Boolean)
      .slice(0, 20);
  }

  function frameSnapshot() {
    return Array.from(document.querySelectorAll('iframe, frame')).slice(0, 8).map((frame) => {
      let sameOrigin = false;
      let inputs = 0;
      try {
        sameOrigin = !!frame.contentDocument;
        if (sameOrigin) inputs = frame.contentDocument.querySelectorAll('input, textarea').length;
      } catch (err) {
        sameOrigin = false;
      }
      return {
        src: clip(frame.getAttribute('src') || '', 180),
        sameOrigin: sameOrigin,
        inputs: inputs,
      };
    });
  }

  function handlerKind(fn) {
    if (!fn) return 'none';
    return typeof fn === 'function' ? 'function' : typeof fn;
  }

  function buildDebug() {
    const text = bodyText();
    return {
      script: 'Dropzone Batch',
      version: VERSION,
      generatedAt: chicagoNow() + ' America/Chicago',
      href: location.href,
      title: document.title,
      readyState: document.readyState,
      jobId: new URLSearchParams(location.search).get('jobId') || '',
      settings: {
        dropzone: cleanToken(valueOf('dz-dropzone')),
        strategy: SCAN_STRATEGY,
        suffix: SCAN_SUFFIX,
        gapMs: SCAN_GAP_MS,
        pauseMs: SCAN_PAUSE_MS,
        containerCount: parseContainers(valueOf('dz-containers')).length,
        containers: parseContainers(valueOf('dz-containers')).slice(0, 300),
      },
      focus: describe(pageFocus()),
      activeElement: describe(deepActive(document)),
      onkeydown: {
        window: handlerKind(window.onkeydown),
        document: handlerKind(document.onkeydown),
        body: handlerKind(document.body && document.body.onkeydown),
      },
      listeners: listenerStats,
      listenersNote: 'Counts are key listeners registered in this frame after the script started.',
      frames: frameSnapshot(),
      inputs: inputSnapshot(),
      buttons: buttonSnapshot(),
      running: running,
      doneIds: Array.from(doneIds).slice(0, 300),
      skippedIds: skippedIds.slice(0, 300),
      results: results.slice(-100),
      attempts: attempts,
      realScans: realScans,
      log: logs.slice(-80),
      pageText: clip(text, 1800),
    };
  }

  function debugText() {
    return [
      'Dropzone Batch v' + VERSION + ' — Copy debug',
      'Paste everything below into the chat.',
      JSON.stringify(buildDebug(), null, 2),
    ].join('\n');
  }

  async function copyDebug(button) {
    const text = debugText();
    let copied = false;
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        copied = true;
      }
    } catch (err) {
      copied = false;
    }
    if (!copied) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (err) {
        copied = false;
      }
    }
    if (button) {
      const previous = button.textContent;
      button.textContent = copied ? 'Copied' : 'Copy failed';
      setTimeout(() => {
        button.textContent = previous;
      }, 1500);
    }
    const fallback = document.getElementById('dz-fallback');
    if (!copied && fallback) {
      fallback.hidden = false;
      fallback.value = text;
      fallback.focus();
      fallback.select();
      setStatus('Clipboard blocked. Copy the debug box in the status column.');
    } else if (fallback) {
      fallback.hidden = true;
      fallback.value = '';
      if (!running) setStatus('Debug copied. Paste it in the chat.');
    }
    return copied;
  }

  function persistForm() {
    const panel = document.getElementById(PANEL_ID);
    saveStore({
      dropzone: valueOf('dz-dropzone'),
      containers: valueOf('dz-containers'),
      minimized: panel ? panel.classList.contains('dz-min') : false,
    });
  }

  function removeFinished() {
    const ok = new Set(results.filter((row) => row.status === 'ok').map((row) => row.container));
    const box = document.getElementById('dz-containers');
    if (!box) return;
    box.value = box.value.split(/\r?\n/).filter((line) => {
      const value = cleanToken(line);
      return value && !ok.has(value);
    }).join('\n');
    persistForm();
    updateCount();
  }

  function clearContainers() {
    const box = document.getElementById('dz-containers');
    if (!box) return;
    if (running) {
      generation += 1;
      running = false;
      setRunning(false);
    }
    box.value = '';
    persistForm();
    updateCount();
    setStatus('Container list cleared.');
  }

  function resetDone() {
    doneIds.clear();
    skippedIds.length = 0;
    saveStore({ doneDay: todayKey(), doneIds: [], skippedIds: [] });
    updateCount();
    setStatus('Done and skipped lists cleared.');
  }

  function recordRealKey(event) {
    if (!event.isTrusted) return;
    if (isOurNode(event.target)) return;
    const last = realBuffer[realBuffer.length - 1];
    realBuffer.push({
      t: Math.round(event.timeStamp),
      delta: last ? Math.round(event.timeStamp - last.t) : 0,
      key: event.key,
      code: event.code,
      target: describe(event.target),
    });
    if (realBuffer.length > 80) realBuffer.shift();
    clearTimeout(realTimer);
    realTimer = setTimeout(finishRealScan, 300);
  }

  function finishRealScan() {
    if (!realBuffer.length) return;
    const keys = realBuffer.splice(0);
    const chars = keys.filter((item) => item.key && item.key.length === 1);
    const deltas = keys.map((item) => item.delta).filter((delta) => delta > 0);
    const avg = deltas.length ? Math.round(deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length) : 0;
    const ends = keys.filter((item) => !item.key || item.key.length !== 1).map((item) => item.key);
    const gunLike = chars.length >= 3 && avg > 0 && avg < 45;
    const scan = {
      at: chicagoNow(),
      gunLike: gunLike,
      text: chars.map((item) => item.key).join(''),
      ends: ends,
      avgGapMs: avg,
      target: keys[0] ? keys[0].target : '',
      keys: keys,
    };
    realScans.push(scan);
    if (realScans.length > 3) realScans.shift();
    const line = document.getElementById('dz-real');
    if (line && gunLike) {
      line.textContent = 'Last gun scan: ' + (scan.text || '(no text)')
        + '  end=' + (ends.join('+') || 'none')
        + '  avg ' + avg + 'ms'
        + '  at ' + (scan.target || 'page');
    }
  }

  function addStyle(css) {
    try {
      if (typeof GM_addStyle === 'function') {
        GM_addStyle(css);
        return;
      }
    } catch (err) {
      /* fall through */
    }
    const style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function mount() {
    if (!document.body || document.getElementById(PANEL_ID)) return;
    const store = loadStore();
    const today = todayKey();
    doneIds.clear();
    skippedIds.length = 0;
    if (store.doneDay === today) {
      if (Array.isArray(store.doneIds)) store.doneIds.forEach((id) => doneIds.add(id));
      if (Array.isArray(store.skippedIds)) {
        store.skippedIds.forEach((id) => {
          if (id) skippedIds.push(id);
        });
      }
    }

    addStyle(`
      #${PANEL_ID} {
        position: fixed; left: 16px; right: 16px; bottom: 16px; top: 50vh; z-index: 2147483647;
        display: flex; flex-direction: column; overflow: hidden;
        color: #e8edf4; background: #10141b; border: 1px solid #2a3140; border-radius: 16px;
        box-shadow: 0 18px 48px rgba(0,0,0,.42);
        font: 13px/1.45 "Segoe UI", system-ui, sans-serif;
      }
      #${PANEL_ID}, #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID}.dz-min { top: auto; }
      #${PANEL_ID} header {
        display: flex; align-items: center; gap: 10px; padding: 12px 16px; flex: 0 0 auto;
        background: #161b24; border-bottom: 1px solid #2a3140;
      }
      #${PANEL_ID} .dz-mark { width: 8px; height: 8px; border-radius: 99px; background: #3b82f6; flex: 0 0 auto; }
      #${PANEL_ID} .dz-title { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
      #${PANEL_ID} .dz-title b { font-size: 14px; font-weight: 650; }
      #${PANEL_ID} .dz-ver { color: #8b97a8; font-size: 11px; }
      #${PANEL_ID} .dz-spacer { flex: 1; }
      #${PANEL_ID} header button {
        font: inherit; color: #c5ceda; background: #10141b; border: 1px solid #2c3544;
        border-radius: 8px; cursor: pointer; width: 28px; height: 28px; padding: 0;
      }
      #${PANEL_ID} .dz-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 1fr); }
      #${PANEL_ID}.dz-min .dz-body { display: none; }
      #${PANEL_ID} .dz-form, #${PANEL_ID} .dz-report {
        min-height: 0; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px 16px;
      }
      #${PANEL_ID} .dz-report { background: #0c1016; border-left: 1px solid #2a3140; }
      #${PANEL_ID} label, #${PANEL_ID} .dz-kicker {
        color: #8b97a8; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      }
      #${PANEL_ID} input[type="text"], #${PANEL_ID} textarea {
        width: 100%; font: inherit; color: #e8edf4; background: #0c1016; border: 1px solid #2c3544;
        border-radius: 10px; padding: 10px 12px; outline: none;
      }
      #${PANEL_ID} .dz-report textarea { background: #10141b; }
      #${PANEL_ID} input[type="text"]:focus, #${PANEL_ID} textarea:focus { border-color: #3b82f6; }
      #${PANEL_ID} #dz-containers {
        flex: 1; min-height: 88px; resize: none;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; line-height: 1.5;
      }
      #${PANEL_ID} .dz-actions, #${PANEL_ID} .dz-foot, #${PANEL_ID} .dz-meta-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      #${PANEL_ID} .dz-actions button, #${PANEL_ID} .dz-foot button {
        font: inherit; font-weight: 650; cursor: pointer; border-radius: 10px; padding: 9px 14px;
        color: #e8edf4; background: #1a202b; border: 1px solid #2c3544;
      }
      #${PANEL_ID} button.dz-primary { background: #2563eb; border-color: #2563eb; color: #fff; }
      #${PANEL_ID} button.dz-debug { margin-left: auto; background: #3a2a10; border-color: #a16207; color: #fbbf24; }
      #${PANEL_ID} button:disabled { opacity: .45; cursor: default; }
      #${PANEL_ID} .dz-report-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      #${PANEL_ID} .dz-stats { display: flex; gap: 6px; flex-wrap: wrap; }
      #${PANEL_ID} .dz-stat {
        color: #8b97a8; background: #161b24; border-radius: 999px; padding: 4px 10px; font-size: 12px;
      }
      #${PANEL_ID} .dz-stat b { color: #e8edf4; font-weight: 650; }
      #${PANEL_ID} .dz-status {
        padding: 10px 12px; border-radius: 10px; background: #161b24; color: #e8edf4;
      }
      #${PANEL_ID} .dz-results { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 6px; }
      #${PANEL_ID} .dz-result {
        display: grid; grid-template-columns: 8px minmax(0, 1fr); gap: 10px; align-items: start;
        padding: 8px 10px; border-radius: 10px; background: #161b24;
      }
      #${PANEL_ID} .dz-result div { display: flex; flex-direction: column; min-width: 0; }
      #${PANEL_ID} .dz-dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 99px; background: #64748b; }
      #${PANEL_ID} .dz-result b { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-weight: 650; }
      #${PANEL_ID} .dz-result span { color: #8b97a8; }
      #${PANEL_ID} .dz-ok .dz-dot { background: #4ade80; }
      #${PANEL_ID} .dz-error .dz-dot { background: #f87171; }
      #${PANEL_ID} .dz-stuck .dz-dot { background: #fbbf24; }
      #${PANEL_ID} .dz-skip .dz-dot { background: #38bdf8; }
      #${PANEL_ID} .dz-empty { color: #8b97a8; padding: 8px 2px; }
      #${PANEL_ID} .dz-meta-line { margin-top: auto; }
      #${PANEL_ID} .dz-foot { justify-content: flex-end; }
      #${PANEL_ID} .dz-focus, #${PANEL_ID} .dz-real { color: #8b97a8; font-size: 12px; }
      #${PANEL_ID} button.dz-linkish {
        background: transparent; color: #c5ceda; border-color: transparent; padding: 6px 8px; font-weight: 600;
      }
      #${PANEL_ID} #dz-fallback { min-height: 88px; }
      #${PANEL_ID} #dz-fallback[hidden] { display: none !important; }
      @media (max-width: 860px) {
        #${PANEL_ID} { top: 34vh; }
        #${PANEL_ID} .dz-body { grid-template-columns: 1fr; overflow: auto; }
        #${PANEL_ID} .dz-report { border-left: 0; border-top: 1px solid #2a3140; }
      }
    `);

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    if (store.minimized) panel.classList.add('dz-min');
    panel.innerHTML = `
      <header>
        <span class="dz-mark" aria-hidden="true"></span>
        <div class="dz-title">
          <b>Dropzone Batch</b>
          <span class="dz-ver">v${VERSION}</span>
        </div>
        <span class="dz-spacer"></span>
        <button type="button" id="dz-min" title="Collapse the panel">–</button>
      </header>
      <div class="dz-body">
        <section class="dz-form">
          <label for="dz-dropzone">Dropzone</label>
          <input id="dz-dropzone" type="text" autocomplete="off" spellcheck="false" placeholder="Dropzone code">
          <label for="dz-containers">Containers</label>
          <textarea id="dz-containers" spellcheck="false" placeholder="One container per line"></textarea>
          <div class="dz-actions">
            <button type="button" id="dz-start" class="dz-primary">Start</button>
            <button type="button" id="dz-stop" disabled>Stop</button>
            <button type="button" id="dz-skip">Skip</button>
            <button type="button" id="dz-debug" class="dz-debug">Copy debug</button>
          </div>
        </section>
        <section class="dz-report" aria-label="Status">
          <div class="dz-report-head">
            <span class="dz-kicker">Status</span>
            <div class="dz-stats" id="dz-count"></div>
          </div>
          <div class="dz-status" id="dz-status">Paste containers, set the dropzone, then Start.</div>
          <div class="dz-results" id="dz-results"></div>
          <div class="dz-meta-line">
            <span class="dz-focus" id="dz-focus">Keys go to: …</span>
            <span class="dz-real" id="dz-real">No gun scan yet</span>
          </div>
          <div class="dz-foot">
            <button type="button" class="dz-linkish" id="dz-clear">Clear list</button>
            <button type="button" class="dz-linkish" id="dz-remove">Remove finished</button>
            <button type="button" class="dz-linkish" id="dz-reset">Reset done</button>
          </div>
          <textarea id="dz-fallback" hidden readonly></textarea>
        </section>
      </div>
    `;
    document.body.appendChild(panel);

    const dropzone = document.getElementById('dz-dropzone');
    const containers = document.getElementById('dz-containers');
    dropzone.value = store.dropzone || '';
    containers.value = store.containers || '';

    document.getElementById('dz-start').addEventListener('click', () => runBatch());
    document.getElementById('dz-stop').addEventListener('click', () => stopBatch());
    document.getElementById('dz-skip').addEventListener('click', () => requestSkip());
    document.getElementById('dz-debug').addEventListener('click', (event) => copyDebug(event.currentTarget));
    document.getElementById('dz-clear').addEventListener('click', clearContainers);
    document.getElementById('dz-remove').addEventListener('click', removeFinished);
    document.getElementById('dz-reset').addEventListener('click', resetDone);
    document.getElementById('dz-min').addEventListener('click', () => {
      panel.classList.toggle('dz-min');
      persistForm();
    });
    [dropzone, containers].forEach((el) => {
      el.addEventListener('input', () => {
        updateCount();
        persistForm();
      });
      el.addEventListener('change', persistForm);
    });

    updateCount();
    renderResults();
    updateFocusLine();
  }

  window.addEventListener('keydown', recordRealKey, true);

  function boot() {
    mount();
    setInterval(() => {
      if (document.body && !document.getElementById(PANEL_ID)) mount();
      updateFocusLine();
    }, 1000);
    try {
      GM_registerMenuCommand('Copy debug', () => copyDebug(document.getElementById('dz-debug')));
    } catch (err) {
      /* menu is optional */
    }
  }

  if (window.top === window) {
    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot, { once: true });
  }
})();
