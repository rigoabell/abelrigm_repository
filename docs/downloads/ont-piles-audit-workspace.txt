// ==UserScript==
// @name         ONT Base Piles Audit Workspace (abelrigm)
// @namespace    https://github.com/rigoabell/abelrigm_repository
// @version      1.3.0
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
  Problem Solve, Exceptions, and Add Ins sit on one sheet: BIGS, then sortable, then EOS.
  BIGS: a pallet is 20, a cage is 15, a shuttle is 100.
  Sortable: a pallet is 150, a tote is 5.
  Add Ins includes shuttles. Problem Solve and Exceptions do not.
  Misships, AR BIGS, Refurb, Audit, and ADS stay out of that total.
*/

(function () {
  'use strict';

  const VERSION = '1.3.0';
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
  const SHEET_ROWS = [
    { id: 'problemSolve', label: 'Problem Solve', eos: 'ps' },
    { id: 'exceptions', label: 'Exceptions', eos: 'exceptions' },
    { id: 'addIns', label: 'Add Ins', eos: 'addIns' }
  ];
  const OTHER_ROWS = [
    { id: 'misships', label: 'Misships' },
    { id: 'arBigs', label: 'AR BIGS' },
    { id: 'refurb', label: 'Refurb' },
    { id: 'audit', label: 'Audit' },
    { id: 'ads', label: 'ADS' }
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
    '#' + EOS_ID + ', #' + EOS_ID + ' * { box-sizing: border-box; }',
    '#' + EOS_ID + ' { color: #1c2430; font-size: 14px; }',
    '#' + EOS_ID + ' h3 { font-size: 15px; font-weight: 700; margin: 18px 0 8px; }',
    '#' + EOS_ID + ' .ont-piles-note { color: #66707c; margin: 8px 2px 0; }',
    '#' + EOS_ID + ' .ont-piles-frame {',
    '  border: 1px solid #e1e5ea; border-radius: 12px; overflow: hidden;',
    '}',
    '#' + EOS_ID + ' table { border-collapse: collapse; margin: 0; width: 100%; }',
    '#' + EOS_ID + ' th, #' + EOS_ID + ' td {',
    '  background: #fff; border: 0; border-bottom: 1px solid #e6eaee; border-right: 1px solid #e6eaee;',
    '  font-weight: 400; padding: 8px 10px; text-align: center; vertical-align: middle;',
    '}',
    '#' + EOS_ID + ' tr > :last-child { border-right: 0; }',
    '#' + EOS_ID + ' tbody tr:last-child > * { border-bottom: 0; }',
    '#' + EOS_ID + ' .ont-piles-group th {',
    '  background: #f3f5f8; color: #3c4654; font-size: 11px; font-weight: 700;',
    '  letter-spacing: 0.08em; padding: 8px 10px; text-align: center; text-transform: uppercase;',
    '}',
    '#' + EOS_ID + ' .ont-piles-head th {',
    '  background: #f8f9fb; color: #5c6772; font-size: 12px; font-weight: 700; line-height: 1.25;',
    '}',
    '#' + EOS_ID + ' .ont-piles-col { display: block; }',
    '#' + EOS_ID + ' .ont-piles-rate { color: #8b95a1; display: block; font-size: 11px; font-weight: 600; }',
    '#' + EOS_ID + ' tbody td:first-child, #' + EOS_ID + ' .ont-piles-head th:first-child {',
    '  background: #fbfcfd; font-weight: 600; text-align: left; white-space: nowrap; width: 8.5rem;',
    '}',
    '#' + EOS_ID + ' .ont-piles-other tr:last-child > * { border-bottom: 0; }',
    '#' + EOS_ID + ' .ont-piles-bigs { margin: 0; }',
    '#' + EOS_ID + ' .ont-piles-split { box-shadow: inset 2px 0 0 #d7dde6; }',
    '#' + EOS_ID + ' input {',
    '  -moz-appearance: textfield; appearance: textfield; background: #f4f6f8;',
    '  border: 1px solid transparent; border-radius: 6px; box-sizing: border-box;',
    '  font: inherit; font-variant-numeric: tabular-nums; padding: 6px 4px; text-align: center; width: 100%;',
    '}',
    '#' + EOS_ID + ' input::-webkit-outer-spin-button, #' + EOS_ID + ' input::-webkit-inner-spin-button {',
    '  -webkit-appearance: none; margin: 0;',
    '}',
    '#' + EOS_ID + ' input::placeholder { color: #b7c0ca; }',
    '#' + EOS_ID + ' input:hover { background: #eef1f5; }',
    '#' + EOS_ID + ' input:focus {',
    '  background: #fff; border-color: #2f6fed; outline: 2px solid rgba(47, 111, 237, 0.18); outline-offset: 0;',
    '}',
    '#' + EOS_ID + ' .ont-piles-out { display: block; font-variant-numeric: tabular-nums; font-weight: 700; text-align: right; }',
    '#' + EOS_ID + ' .ont-piles-eos { background: #f3f6fb; }',
    '#' + EOS_ID + ' .ont-piles-total td { background: #f6f8fb; font-weight: 700; }',
    '#' + EOS_ID + ' .ont-piles-total .ont-piles-eos { background: #e7eef9; }'
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

  function countInput(doc, rowLabel, path, fieldLabel) {
    const input = doc.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.value = '';
    input.placeholder = '0';
    input.id = fieldId('in', path);
    input.setAttribute('data-ont-input', path);
    input.setAttribute('aria-label', rowLabel + ' ' + fieldLabel);
    return input;
  }

  function unitsOut(doc, path) {
    const units = el(doc, 'span', 'ont-piles-out', '0');
    units.id = fieldId('out', path);
    units.setAttribute('data-ont-out', path);
    return units;
  }

  function cell(doc, className) {
    return el(doc, 'td', className || '');
  }

  function buildCalculator(doc) {
    const root = el(doc, 'div', '');
    root.id = EOS_ID;

    const sheet = el(doc, 'table', 'ont-piles-bigs');
    const head = el(doc, 'thead', '');
    const groups = el(doc, 'tr', 'ont-piles-group');
    groups.appendChild(el(doc, 'th', ''));
    const bigsHead = el(doc, 'th', '', 'BIGS');
    bigsHead.colSpan = 4;
    groups.appendChild(bigsHead);
    const sortHead = el(doc, 'th', 'ont-piles-split', 'Sortable');
    sortHead.colSpan = 3;
    groups.appendChild(sortHead);
    groups.appendChild(el(doc, 'th', 'ont-piles-split', 'EOS'));
    head.appendChild(groups);

    const columns = el(doc, 'tr', 'ont-piles-head');
    [
      'Work',
      'Pallets × 20',
      'Cages × 15',
      'Shuttles × 100',
      'Units',
      'Pallets × 150',
      'Totes × 5',
      'Units',
      ''
    ].forEach(function (label, index) {
      const split = index === 5 || index === 8 ? 'ont-piles-split' : '';
      columns.appendChild(columnHead(doc, label, split));
    });
    head.appendChild(columns);
    sheet.appendChild(head);

    const body = el(doc, 'tbody', '');
    SHEET_ROWS.forEach(function (row) {
      const line = el(doc, 'tr', '');
      line.appendChild(el(doc, 'td', '', row.label));
      BIGS_FIELDS.forEach(function (field) {
        const holder = cell(doc);
        holder.appendChild(countInput(doc, row.label, 'bigs.' + row.id + '.' + field.key, field.label));
        line.appendChild(holder);
      });
      const bigsUnitsCell = cell(doc);
      bigsUnitsCell.appendChild(unitsOut(doc, 'bigs.' + row.id + '.units'));
      line.appendChild(bigsUnitsCell);
      SORT_FIELDS.forEach(function (field, index) {
        const holder = cell(doc, index === 0 ? 'ont-piles-split' : '');
        holder.appendChild(countInput(doc, row.label, 'sortable.' + row.id + '.' + field.key, field.label));
        line.appendChild(holder);
      });
      const sortUnitsCell = cell(doc);
      sortUnitsCell.appendChild(unitsOut(doc, 'sortable.' + row.id + '.units'));
      line.appendChild(sortUnitsCell);
      const eosCell = cell(doc, 'ont-piles-split ont-piles-eos');
      eosCell.appendChild(unitsOut(doc, 'eos.' + row.eos));
      line.appendChild(eosCell);
      body.appendChild(line);
    });

    const total = el(doc, 'tr', 'ont-piles-total');
    total.appendChild(el(doc, 'td', '', 'Total'));
    for (let i = 0; i < 7; i++) total.appendChild(cell(doc, i === 4 ? 'ont-piles-split' : ''));
    const totalEos = cell(doc, 'ont-piles-split ont-piles-eos');
    totalEos.appendChild(unitsOut(doc, 'eos.total'));
    total.appendChild(totalEos);
    body.appendChild(total);
    sheet.appendChild(body);
    const frame = el(doc, 'div', 'ont-piles-frame');
    frame.appendChild(sheet);
    root.appendChild(frame);
    root.appendChild(el(doc, 'p', 'ont-piles-note', 'Shuttles count on Add Ins only.'));

    root.appendChild(el(doc, 'h3', '', 'Other BIGS'));
    root.appendChild(el(doc, 'p', 'ont-piles-note', 'These stay out of the total.'));
    const other = el(doc, 'table', 'ont-piles-other');
    const otherHead = el(doc, 'tr', 'ont-piles-head');
    ['Work', 'Pallets × 20', 'Cages × 15', 'Shuttles × 100', 'Units'].forEach(function (label) {
      otherHead.appendChild(columnHead(doc, label, ''));
    });
    other.appendChild(otherHead);
    OTHER_ROWS.forEach(function (row) {
      const line = el(doc, 'tr', '');
      line.appendChild(el(doc, 'td', '', row.label));
      BIGS_FIELDS.forEach(function (field) {
        const holder = cell(doc);
        holder.appendChild(countInput(doc, row.label, 'bigs.' + row.id + '.' + field.key, field.label));
        line.appendChild(holder);
      });
      const units = cell(doc);
      units.appendChild(unitsOut(doc, 'bigs.' + row.id + '.units'));
      line.appendChild(units);
      other.appendChild(line);
    });
    const otherFrame = el(doc, 'div', 'ont-piles-frame');
    otherFrame.appendChild(other);
    root.appendChild(otherFrame);
    return root;
  }

  function columnHead(doc, label, className) {
    const th = el(doc, 'th', className || '');
    const parts = String(label).split(' × ');
    th.appendChild(el(doc, 'span', 'ont-piles-col', parts[0]));
    if (parts[1]) th.appendChild(el(doc, 'span', 'ont-piles-rate', ' × ' + parts[1]));
    return th;
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
