// ==UserScript==
// @name         ONT Base Piles Audit Workspace (abelrigm)
// @namespace    https://github.com/rigoabell/abelrigm_repository
// @version      1.1.0
// @updateURL    https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/ont-piles-audit-workspace.user.js
// @downloadURL  https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/ont-piles-audit-workspace.user.js
// @description  Count BIGS and sortable piles on the audit page and show the EOS total.
// @author       abelrigm
// @match        https://ont-base.corp.amazon.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
  On an ICQA piles audit, the header cell holds Home, the audit date, and
  Audit Is Complete. The pile cards sit under that header. This script inserts
  one cell between them.

  The cell is the EOS piles count from the workbook, without the color blocks.
  BIGS: a pallet is 20, a cage is 15, a shuttle is 100.
  Sortable: a pallet is 150, a tote is 5.
  EOS adds Problem Solve, Exceptions, and Add Ins.
  Add Ins includes shuttles. Problem Solve and Exceptions do not.
  Misships, AR BIGS, Refurb, Audit, and ADS stay out of that total.
*/

(function () {
  'use strict';

  const VERSION = '1.1.0';
  const HOST = 'ont-base.corp.amazon.com';
  const CELL_ID = 'ont-piles-workspace-col';
  const CARD_ID = 'ont-piles-workspace';
  const BODY_ID = 'ont-piles-workspace-body';
  const STYLE_ID = 'ont-piles-workspace-style';
  const EOS_ID = 'ont-piles-eos';
  const FULL_COLUMN = /\bcol-(?:xs|sm|md|lg)-12\b/;
  const RATES = {
    pallet: 20,
    cage: 15,
    shuttle: 100,
    sortablePallet: 150,
    tote: 5
  };
  const BIGS_ROWS = [
    { id: 'misships', label: 'Misships' },
    { id: 'arBigs', label: 'AR BIGS' },
    { id: 'refurb', label: 'Refurb' },
    { id: 'problemSolve', label: 'Problem Solve' },
    { id: 'exceptions', label: 'Exceptions' },
    { id: 'addIns', label: 'Add Ins' },
    { id: 'audit', label: 'Audit' },
    { id: 'ads', label: 'ADS' }
  ];
  const SORT_ROWS = [
    { id: 'problemSolve', label: 'Problem Solve' },
    { id: 'exceptions', label: 'Exceptions' },
    { id: 'addIns', label: 'Add Ins' }
  ];
  const BIGS_FIELDS = [
    { key: 'pallets', label: 'Pallets' },
    { key: 'cages', label: 'Cages' },
    { key: 'shuttles', label: 'Shuttles' }
  ];
  const SORT_FIELDS = [
    { key: 'pallets', label: 'Pallets' },
    { key: 'totes', label: 'Totes' }
  ];
  const EOS_LINES = [
    { key: 'addIns', label: 'Add Ins' },
    { key: 'ps', label: 'PS' },
    { key: 'exceptions', label: 'Exceptions' },
    { key: 'total', label: 'Total' }
  ];
  const CSS = [
    '#' + CELL_ID + ' { clear: both; }',
    '#' + CARD_ID + ' {',
    '  background: #fff;',
    '  border: 1px solid #ddd;',
    '  border-radius: 4px;',
    '  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);',
    '  margin: 8px 0 16px;',
    '  overflow: hidden;',
    '}',
    '#' + CARD_ID + ' .ont-piles-workspace-head {',
    '  background: #f7f7f7;',
    '  border-bottom: 1px solid #e6e6e6;',
    '  color: #222;',
    '  font-size: 22px;',
    '  font-weight: 700;',
    '  line-height: 1.3;',
    '  padding: 14px 16px;',
    '  text-align: center;',
    '}',
    '#' + BODY_ID + ' { background: #fff; padding: 16px 18px 20px; }',
    '#' + EOS_ID + ' { color: #222; font-size: 14px; }',
    '#' + EOS_ID + ' h3 {',
    '  font-size: 15px; font-weight: 700; margin: 16px 0 4px;',
    '}',
    '#' + EOS_ID + ' h3:first-child { margin-top: 0; }',
    '#' + EOS_ID + ' .ont-piles-note { color: #555; margin: 0 0 8px; }',
    '#' + EOS_ID + ' .ont-piles-line {',
    '  align-items: center; column-gap: 8px; display: grid; margin: 4px 0;',
    '}',
    '#' + EOS_ID + ' .ont-piles-bigs {',
    '  grid-template-columns: minmax(8.5rem, 1.5fr) repeat(3, minmax(4.2rem, 0.7fr)) minmax(4rem, 0.55fr);',
    '}',
    '#' + EOS_ID + ' .ont-piles-sort {',
    '  grid-template-columns: minmax(8.5rem, 1.5fr) repeat(2, minmax(4.2rem, 0.7fr)) minmax(4rem, 0.55fr);',
    '}',
    '#' + EOS_ID + ' .ont-piles-sum {',
    '  grid-template-columns: 8.5rem minmax(4rem, 6rem);',
    '}',
    '#' + EOS_ID + ' .ont-piles-head { color: #444; font-size: 12px; font-weight: 700; }',
    '#' + EOS_ID + ' input {',
    '  border: 1px solid #ccc; border-radius: 3px; box-sizing: border-box;',
    '  font: inherit; padding: 4px 6px; width: 100%;',
    '}',
    '#' + EOS_ID + ' .ont-piles-out { font-variant-numeric: tabular-nums; font-weight: 700; }',
    '#' + EOS_ID + ' .ont-piles-total { border-top: 1px solid #ccc; font-size: 16px; margin-top: 6px; padding-top: 6px; }'
  ].join('\n');

  function isAuditPage(href) {
    let url;
    try {
      url = new URL(String(href), 'https://' + HOST);
    } catch (error) {
      return false;
    }
    if (url.hostname !== HOST) return false;
    return /\/icqa\/piles\/audit\/?$/.test(url.pathname);
  }

  function headerColumn(doc) {
    if (!doc || typeof doc.getElementById !== 'function') return null;
    const status = doc.getElementById('audit-status-container');
    if (!status) return null;
    let node = status.parentElement;
    while (node) {
      if (FULL_COLUMN.test(node.className || '')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function count(value) {
    const number = typeof value === 'number' ? value : Number(String(value == null ? '' : value).trim());
    if (!Number.isFinite(number) || number < 0) return 0;
    return number;
  }

  function formatCount(value) {
    const number = count(value);
    if (Object.is(number, -0)) return '0';
    if (Math.abs(number - Math.round(number)) < 1e-9) return String(Math.round(number));
    return String(Math.round(number * 1000) / 1000);
  }

  function blankGroup(rows, fields) {
    const group = {};
    rows.forEach(function (row) {
      const entry = {};
      fields.forEach(function (field) {
        entry[field.key] = 0;
      });
      group[row.id] = entry;
    });
    return group;
  }

  function blankState() {
    return {
      bigs: blankGroup(BIGS_ROWS, BIGS_FIELDS),
      sortable: blankGroup(SORT_ROWS, SORT_FIELDS)
    };
  }

  function bigsUnits(counts) {
    const pallets = count(counts && counts.pallets);
    const cages = count(counts && counts.cages);
    const shuttles = count(counts && counts.shuttles);
    const palletUnits = pallets * RATES.pallet;
    const cageUnits = cages * RATES.cage;
    const shuttleUnits = shuttles * RATES.shuttle;
    return {
      pallets: pallets,
      cages: cages,
      shuttles: shuttles,
      palletUnits: palletUnits,
      cageUnits: cageUnits,
      shuttleUnits: shuttleUnits,
      units: palletUnits + cageUnits + shuttleUnits
    };
  }

  function sortUnits(counts) {
    const pallets = count(counts && counts.pallets);
    const totes = count(counts && counts.totes);
    const palletUnits = pallets * RATES.sortablePallet;
    const toteUnits = totes * RATES.tote;
    return {
      pallets: pallets,
      totes: totes,
      palletUnits: palletUnits,
      toteUnits: toteUnits,
      units: palletUnits + toteUnits
    };
  }

  function compute(state) {
    const source = state || {};
    const bigs = {};
    const sortable = {};
    BIGS_ROWS.forEach(function (row) {
      bigs[row.id] = bigsUnits(source.bigs && source.bigs[row.id]);
    });
    SORT_ROWS.forEach(function (row) {
      sortable[row.id] = sortUnits(source.sortable && source.sortable[row.id]);
    });
    const addIns = bigs.addIns.units + sortable.addIns.units;
    const ps = bigs.problemSolve.palletUnits + bigs.problemSolve.cageUnits + sortable.problemSolve.units;
    const exceptions = bigs.exceptions.palletUnits + bigs.exceptions.cageUnits + sortable.exceptions.units;
    return {
      bigs: bigs,
      sortable: sortable,
      eos: {
        addIns: addIns,
        ps: ps,
        exceptions: exceptions,
        total: addIns + ps + exceptions
      }
    };
  }

  function fieldId(kind, path) {
    return 'ont-piles-' + kind + '-' + path.replace(/\./g, '-');
  }

  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildLines(doc, parent, className, rows, fields, group) {
    const head = el(doc, 'div', 'ont-piles-line ont-piles-head ' + className);
    head.appendChild(el(doc, 'span', '', 'Work'));
    fields.forEach(function (field) {
      head.appendChild(el(doc, 'span', '', field.label));
    });
    head.appendChild(el(doc, 'span', '', 'Units'));
    parent.appendChild(head);

    rows.forEach(function (row) {
      const line = el(doc, 'div', 'ont-piles-line ' + className);
      line.appendChild(el(doc, 'span', '', row.label));
      fields.forEach(function (field) {
        const path = group + '.' + row.id + '.' + field.key;
        const input = doc.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '1';
        input.value = '';
        input.id = fieldId('in', path);
        input.setAttribute('data-ont-input', path);
        input.setAttribute('aria-label', row.label + ' ' + field.label);
        line.appendChild(input);
      });
      const unitsPath = group + '.' + row.id + '.units';
      const units = el(doc, 'span', 'ont-piles-out', '0');
      units.id = fieldId('out', unitsPath);
      units.setAttribute('data-ont-out', unitsPath);
      line.appendChild(units);
      parent.appendChild(line);
    });
  }

  function buildCalculator(doc) {
    const root = el(doc, 'div', '');
    root.id = EOS_ID;

    const bigsTitle = el(doc, 'h3', '', 'BIGS');
    root.appendChild(bigsTitle);
    root.appendChild(el(doc, 'p', 'ont-piles-note', 'Pallet × 20. Cage × 15. Shuttle × 100.'));
    buildLines(doc, root, 'ont-piles-bigs', BIGS_ROWS, BIGS_FIELDS, 'bigs');

    root.appendChild(el(doc, 'h3', '', 'Sortable'));
    root.appendChild(el(doc, 'p', 'ont-piles-note', 'Pallet × 150. Tote × 5.'));
    buildLines(doc, root, 'ont-piles-sort', SORT_ROWS, SORT_FIELDS, 'sortable');

    root.appendChild(el(doc, 'h3', '', 'EOS'));
    root.appendChild(el(
      doc,
      'p',
      'ont-piles-note',
      'Add Ins, PS, and Exceptions. Add Ins includes shuttles. PS and Exceptions do not.'
    ));
    EOS_LINES.forEach(function (line) {
      const row = el(doc, 'div', 'ont-piles-line ont-piles-sum' + (line.key === 'total' ? ' ont-piles-total' : ''));
      row.appendChild(el(doc, 'span', '', line.label));
      const value = el(doc, 'span', 'ont-piles-out', '0');
      value.id = fieldId('out', 'eos.' + line.key);
      value.setAttribute('data-ont-out', 'eos.' + line.key);
      row.appendChild(value);
      root.appendChild(row);
    });
    return root;
  }

  function setPath(target, path, value) {
    const parts = path.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]] || typeof node[parts[i]] !== 'object') return;
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }

  function getPath(source, path) {
    const parts = path.split('.');
    let node = source;
    for (let i = 0; i < parts.length; i++) {
      if (node == null) return 0;
      node = node[parts[i]];
    }
    return node;
  }

  function readState(root) {
    const state = blankState();
    const inputs = root.querySelectorAll('[data-ont-input]');
    for (let i = 0; i < inputs.length; i++) {
      const path = inputs[i].getAttribute('data-ont-input');
      if (path) setPath(state, path, count(inputs[i].value));
    }
    return state;
  }

  function writeOutputs(root, result) {
    const nodes = root.querySelectorAll('[data-ont-out]');
    for (let i = 0; i < nodes.length; i++) {
      const path = nodes[i].getAttribute('data-ont-out');
      nodes[i].textContent = formatCount(getPath(result, path));
    }
  }

  function fillInputs(root, state) {
    const inputs = root.querySelectorAll('[data-ont-input]');
    for (let i = 0; i < inputs.length; i++) {
      const path = inputs[i].getAttribute('data-ont-input');
      const value = count(getPath(state, path));
      inputs[i].value = value ? formatCount(value) : '';
    }
  }

  function auditKey(doc, href) {
    let date = '';
    let shift = '';
    let number = '';
    try {
      const url = new URL(String(href || ''), 'https://' + HOST);
      date = url.searchParams.get('audit_date') || '';
      shift = url.searchParams.get('audit_shift') || '';
      number = url.searchParams.get('audit_number') || '';
      if (!date && doc && typeof doc.querySelector === 'function') {
        const link = doc.querySelector('a[href*="audit_date="]');
        if (link && link.getAttribute) {
          const nested = new URL(link.getAttribute('href'), url.origin);
          date = nested.searchParams.get('audit_date') || '';
          shift = shift || nested.searchParams.get('audit_shift') || '';
          number = number || nested.searchParams.get('audit_number') || '';
        }
      }
    } catch (error) {
      return 'ont-piles-eos';
    }
    if (!date && !shift && !number) return 'ont-piles-eos';
    return 'ont-piles-eos:' + [date, shift, number].join(':');
  }

  function loadState(storage, key) {
    if (!storage || !key || typeof storage.getItem !== 'function') return null;
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch (error) {
      return null;
    }
  }

  function saveState(storage, key, state) {
    if (!storage || !key || typeof storage.setItem !== 'function') return;
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch (error) {
      return;
    }
  }

  function refresh(doc) {
    const root = doc && doc.getElementById(EOS_ID);
    if (!root || typeof root.querySelectorAll !== 'function') return null;
    const state = readState(root);
    const result = compute(state);
    writeOutputs(root, result);
    const storage = root.ontStorage;
    const key = root.ontKey;
    if (storage && key) saveState(storage, key, state);
    return result;
  }

  function ensureCalculator(doc, options) {
    const body = doc.getElementById(BODY_ID);
    if (!body) return null;
    let root = doc.getElementById(EOS_ID);
    if (!root) {
      root = buildCalculator(doc);
      body.appendChild(root);
    }
    const settings = options || {};
    root.ontStorage = settings.storage || null;
    root.ontKey = auditKey(doc, settings.href || '');
    if (root.getAttribute('data-bound') !== '1') {
      const saved = loadState(root.ontStorage, root.ontKey);
      if (saved) fillInputs(root, saved);
      const inputs = root.querySelectorAll('[data-ont-input]');
      for (let i = 0; i < inputs.length; i++) {
        inputs[i].addEventListener('input', function () {
          refresh(doc);
        });
      }
      root.setAttribute('data-bound', '1');
    }
    refresh(doc);
    return root;
  }

  function ensureStyle(doc) {
    if (doc.getElementById(STYLE_ID) || typeof doc.createElement !== 'function') return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    const parent = doc.head || doc.body || doc.documentElement;
    if (parent && typeof parent.appendChild === 'function') parent.appendChild(style);
  }

  function buildCell(doc) {
    const column = doc.createElement('div');
    column.id = CELL_ID;
    column.className = 'col-sm-12';

    const card = doc.createElement('div');
    card.id = CARD_ID;
    card.className = 'ont-piles-workspace';
    card.setAttribute('data-ont-piles-workspace', '1');

    const head = doc.createElement('div');
    head.className = 'ont-piles-workspace-head';
    head.textContent = 'EOS piles';

    const body = doc.createElement('div');
    body.id = BODY_ID;
    body.className = 'ont-piles-workspace-body';
    body.setAttribute('data-work-surface', '1');

    card.appendChild(head);
    card.appendChild(body);
    column.appendChild(card);
    return column;
  }

  function placeWorkspace(doc, options) {
    if (!doc || typeof doc.getElementById !== 'function') return null;
    let cell = doc.getElementById(CELL_ID);
    if (!cell) {
      const header = headerColumn(doc);
      if (!header || !header.parentElement || typeof header.parentElement.insertBefore !== 'function') {
        return null;
      }
      ensureStyle(doc);
      cell = buildCell(doc);
      header.parentElement.insertBefore(cell, header.nextSibling || null);
    }
    ensureCalculator(doc, options || {});
    return cell;
  }

  const api = {
    VERSION: VERSION,
    CELL_ID: CELL_ID,
    BODY_ID: BODY_ID,
    RATES: RATES,
    isAuditPage: isAuditPage,
    headerColumn: headerColumn,
    placeWorkspace: placeWorkspace,
    blankState: blankState,
    compute: compute,
    auditKey: auditKey,
    refresh: refresh
  };

  if (globalThis.__pilesExpose) globalThis.__piles = api;
  if (globalThis.__pilesNoBoot) return;

  const installed = Symbol.for('abelrigm.ontPilesAuditWorkspace');
  if (globalThis[installed]) return;
  globalThis[installed] = true;

  const href = (globalThis.location && globalThis.location.href) || '';
  if (!isAuditPage(href) || !globalThis.document) return;

  const doc = globalThis.document;
  const storage = globalThis.localStorage;
  placeWorkspace(doc, { href: href, storage: storage });

  const root = doc.body || doc.documentElement;
  if (!root || typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(function () {
    if (!doc.getElementById(CELL_ID) || !doc.getElementById(EOS_ID)) {
      placeWorkspace(doc, { href: href, storage: storage });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
})();
