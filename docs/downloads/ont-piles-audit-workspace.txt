// ==UserScript==
// @name         ONT Base Piles Audit Workspace (abelrigm)
// @namespace    https://github.com/rigoabell/abelrigm_repository
// @version      1.0.0
// @updateURL    https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/ont-piles-audit-workspace.user.js
// @downloadURL  https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/ont-piles-audit-workspace.user.js
// @description  Adds a workspace cell between the piles audit header and the pile cards.
// @author       abelrigm
// @match        https://ont-base.corp.amazon.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
  On an ICQA piles audit, the header cell holds Home, the audit date, and
  Audit Is Complete. The pile cards (Problem Solve, Exceptions, Add-Ins) sit
  under that header. This script inserts one full-width cell between them.
  The empty body of that cell is the work surface.
*/

(function () {
  'use strict';

  const VERSION = '1.0.0';
  const HOST = 'ont-base.corp.amazon.com';
  const CELL_ID = 'ont-piles-workspace-col';
  const CARD_ID = 'ont-piles-workspace';
  const BODY_ID = 'ont-piles-workspace-body';
  const STYLE_ID = 'ont-piles-workspace-style';
  const FULL_COLUMN = /\bcol-(?:xs|sm|md|lg)-12\b/;
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
    '  color: #333;',
    '  font-size: 22px;',
    '  font-weight: 700;',
    '  line-height: 1.3;',
    '  padding: 14px 16px;',
    '  text-align: center;',
    '}',
    '#' + BODY_ID + ' {',
    '  background: #fff;',
    '  min-height: 180px;',
    '  padding: 16px;',
    '}'
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
    head.textContent = 'Workspace';

    const body = doc.createElement('div');
    body.id = BODY_ID;
    body.className = 'ont-piles-workspace-body';
    body.setAttribute('data-work-surface', '1');

    card.appendChild(head);
    card.appendChild(body);
    column.appendChild(card);
    return column;
  }

  function placeWorkspace(doc) {
    if (!doc || typeof doc.getElementById !== 'function') return null;
    const existing = doc.getElementById(CELL_ID);
    if (existing) return existing;
    const header = headerColumn(doc);
    if (!header || !header.parentElement || typeof header.parentElement.insertBefore !== 'function') {
      return null;
    }
    ensureStyle(doc);
    const cell = buildCell(doc);
    header.parentElement.insertBefore(cell, header.nextSibling || null);
    return cell;
  }

  const api = {
    VERSION: VERSION,
    CELL_ID: CELL_ID,
    BODY_ID: BODY_ID,
    isAuditPage: isAuditPage,
    headerColumn: headerColumn,
    placeWorkspace: placeWorkspace
  };

  if (globalThis.__pilesExpose) globalThis.__piles = api;
  if (globalThis.__pilesNoBoot) return;

  const installed = Symbol.for('abelrigm.ontPilesAuditWorkspace');
  if (globalThis[installed]) return;
  globalThis[installed] = true;

  const href = (globalThis.location && globalThis.location.href) || '';
  if (!isAuditPage(href) || !globalThis.document) return;

  const doc = globalThis.document;
  placeWorkspace(doc);

  const root = doc.body || doc.documentElement;
  if (!root || typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(function () {
    if (!doc.getElementById(CELL_ID)) placeWorkspace(doc);
  });
  observer.observe(root, { childList: true, subtree: true });
})();
