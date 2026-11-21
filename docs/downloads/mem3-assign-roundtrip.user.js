// ==UserScript==
// @name         Assign Round Trip (abelrigm)
// @namespace    https://mem3.amazon.local/
// @version      1.3.1
// @updateURL    https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/mem3-assign-roundtrip.user.js
// @downloadURL  https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/mem3-assign-roundtrip.user.js
// @description  Unassign one Control Tower login, watch the station, then assign that same login back.
// @author       abelrigm
// @match        https://beta.control-tower.meta.amazon.dev/*
// @match        https://beta.control-tower.meta.amazon.dev/MEM3/*
// @match        https://beta.control-tower.meta.amazon.dev/MEM3/assignments*
// @match        https://control-tower.meta.amazon.dev/*
// @match        https://control-tower.meta.amazon.dev/MEM3/*
// @match        https://control-tower.meta.amazon.dev/MEM3/assignments*
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // Separate from the productivity panel. One login is taken off a station
    // and, if that person stays off, put back on the same station.
    // fiber calls the button's own handler. fiber-all also calls the handlers
    // on the boxes around it. native is a mouse click.
    // A login counts as off once the last 3 seconds show them gone. The watch
    // stops then. It never waits longer than 10 seconds. A menu that only
    // closes for a moment does not count.

    const VERSION = '1.3.1';
    const LINE_LABEL = 'CRET Line 1 (O) + Line Support';
    const PANEL_ID = 'mem3-assign-roundtrip';
    const METHODS = ['fiber', 'fiber-all', 'native'];
    const WATCH_MS = 10000;
    const SAMPLE_MS = 500;
    const TAIL = 6;
    const PANEL_JUNK = '.mem3-uph-badge, .mem3-line-avg-badge, .mem3-popup-uph, .mem3-popup-clock, .mem3-popup-idle, .mem3-yield';

    function normalizeLogin(value) {
        return String(value || '').replace(/\s+/g, '').trim().toLowerCase();
    }

    function looksLikeLogin(value) {
        return /^[a-z][a-z0-9._-]{2,31}$/.test(normalizeLogin(value));
    }

    function plain(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function rowMarkFromTexts(texts, personIndex) {
        const parts = [];
        const list = texts || [];
        for (let i = 0; i < list.length; i++) {
            if (i === personIndex) continue;
            const text = plain(list[i]);
            if (text) parts.push(text);
        }
        return parts.join(' | ');
    }

    function isNoneLabel(value) {
        return /^none$/i.test(plain(value));
    }

    function isDisabledLabel(value) {
        return /^disabled$/i.test(plain(value));
    }

    function isTargetHeading(text) {
        const name = plain(text).toLowerCase().replace(/\d+(\.\d+)?\s*uph\s*avg.*/i, '').trim();
        return name.indexOf('cret line 1 (o)') !== -1 && name.indexOf('line support') !== -1;
    }

    function classifyEmployee(anchorText, cellText) {
        const anchor = plain(anchorText);
        if (isNoneLabel(anchor)) return { employee: 'None', login: '' };
        if (isDisabledLabel(anchor)) return { employee: 'DISABLED', login: '' };
        if (looksLikeLogin(anchor)) return { employee: normalizeLogin(anchor), login: normalizeLogin(anchor) };
        let raw = plain(cellText).replace(/\boverride\b/ig, '');
        raw = plain(raw);
        if (isDisabledLabel(raw)) return { employee: 'DISABLED', login: '' };
        if (!raw || isNoneLabel(raw)) return { employee: 'None', login: '' };
        if (looksLikeLogin(raw)) return { employee: normalizeLogin(raw), login: normalizeLogin(raw) };
        return { employee: raw, login: '' };
    }

    function rosterTable(title, rows) {
        const lines = [title || LINE_LABEL, 'Assignment\tEmployee'];
        const list = rows || [];
        for (let i = 0; i < list.length; i++) {
            lines.push(plain(list[i].assignment) + '\t' + (list[i].employee || 'None'));
        }
        return lines.join('\n');
    }

    function isOtherLine(text) {
        const name = plain(text).toLowerCase();
        if (!name || isTargetHeading(name)) return false;
        return /cret\s+line\s+\d|bigs\s+line|decant/i.test(name);
    }

    // Control Tower's assign field placeholder is "Search for login, badge, etc..."
    function isSearchHint(placeholder, id) {
        const hint = (plain(placeholder) + ' ' + plain(id)).toLowerCase();
        return hint.indexOf('search for login') !== -1 || hint.indexOf('search-field-') === 0;
    }

    function stableEnd(samples, want, tail) {
        if (!samples || samples.length < tail) return false;
        for (let i = samples.length - tail; i < samples.length; i++) {
            if (!!samples[i] !== !!want) return false;
        }
        return true;
    }

    // goal "gone": the login should be off the station.
    // goal "here": the login should be on that same station.
    // left / arrived / assigned mean the last 3 seconds held.
    // blinked means it changed and did not hold.
    function outcome(samples, goal) {
        const want = goal === 'here';
        if (!samples || samples.length < TAIL) return 'short';
        if (!stableEnd(samples, want, TAIL)) {
            const end = !!samples[samples.length - 1];
            if (end === want) return 'blinked';
            for (let i = 0; i < samples.length; i++) {
                if (!!samples[i] === want) return 'blinked';
            }
            return goal === 'gone' ? 'stayed' : 'missing';
        }
        if (goal === 'gone') return 'left';
        for (let i = 0; i < samples.length - TAIL; i++) {
            if (!samples[i]) return 'arrived';
        }
        return 'assigned';
    }

    function ready(samples, goal) {
        const result = outcome(samples, goal);
        if (goal === 'gone') return result === 'left';
        return result === 'arrived' || result === 'assigned';
    }

    function sampleText(samples) {
        let text = '';
        const list = samples || [];
        for (let i = 0; i < list.length; i++) text += list[i] ? '1' : '0';
        return text;
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function waitFor(read, ms) {
        const start = Date.now();
        return new Promise(function (resolve) {
            (function poll() {
                let hit = null;
                try { hit = read(); } catch (e) { hit = null; }
                if (hit) return resolve(hit);
                if (Date.now() - start > ms) return resolve(null);
                setTimeout(poll, 80);
            })();
        });
    }

    function pageWindow() {
        return (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
    }

    function pageClick(el) {
        if (!el) return;
        const win = pageWindow();
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: 2, height: 2 };
        const x = Math.round(rect.left + Math.max(1, rect.width) / 2);
        const y = Math.round(rect.top + Math.max(1, rect.height) / 2);
        const base = {
            bubbles: true, cancelable: true, composed: true, view: win, button: 0,
            clientX: x, clientY: y, screenX: x, screenY: y,
            pointerId: 1, pointerType: 'mouse', isPrimary: true, width: 1, height: 1
        };
        const down = { buttons: 1 };
        const up = { buttons: 0 };
        const keys = Object.keys(base);
        for (let i = 0; i < keys.length; i++) {
            down[keys[i]] = base[keys[i]];
            up[keys[i]] = base[keys[i]];
        }
        try { if (el.focus) el.focus(); } catch (e0) { /* ignore */ }
        try {
            el.dispatchEvent(new win.PointerEvent('pointerdown', down));
            el.dispatchEvent(new win.MouseEvent('mousedown', down));
            el.dispatchEvent(new win.PointerEvent('pointerup', up));
            el.dispatchEvent(new win.MouseEvent('mouseup', up));
            el.dispatchEvent(new win.MouseEvent('click', up));
        } catch (e) {
            try { el.click(); } catch (e2) { /* ignore */ }
        }
    }

    function reactFiber(el) {
        if (!el) return null;
        let keys = [];
        try { keys = Object.keys(el); } catch (e) { return null; }
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('__reactFiber') === 0 || keys[i].indexOf('__reactInternalInstance') === 0) return el[keys[i]];
        }
        return null;
    }

    function isMdnClickWrapper(fn) {
        if (typeof fn !== 'function') return true;
        const src = Function.prototype.toString.call(fn);
        return src.indexOf('defaultPrevented') !== -1 && src.indexOf('noopener') !== -1;
    }

    function reactEvent(el) {
        return {
            target: el,
            currentTarget: el,
            type: 'click',
            button: 0,
            bubbles: true,
            cancelable: true,
            defaultPrevented: false,
            preventDefault: function () { this.defaultPrevented = true; },
            stopPropagation: function () {},
            persist: function () {},
            nativeEvent: { target: el, preventDefault: function () {}, stopPropagation: function () {} },
            isDefaultPrevented: function () { return !!this.defaultPrevented; },
            isPropagationStopped: function () { return false; }
        };
    }

    function collectClicks(el) {
        const fns = [];
        let fiber = reactFiber(el);
        let hops = 0;
        while (fiber && hops < 20) {
            const props = fiber.memoizedProps || fiber.pendingProps;
            if (props && typeof props.onClick === 'function' && !isMdnClickWrapper(props.onClick)) fns.push(props.onClick);
            fiber = fiber.return;
            hops++;
        }
        return fns;
    }

    function clickControl(el, mode) {
        if (!el) return '';
        if (mode === 'native') {
            pageClick(el);
            try { el.click(); } catch (e) { /* ignore */ }
            return 'native';
        }
        const fns = collectClicks(el);
        if (!fns.length) {
            pageClick(el);
            return 'pointer';
        }
        if (mode === 'fiber-all') {
            for (let i = fns.length - 1; i >= 0; i--) {
                try { fns[i](reactEvent(el)); } catch (e2) { /* keep going */ }
            }
            return fns.length > 1 ? 'fiber-all' : 'fiber';
        }
        try { fns[0](reactEvent(el)); return 'fiber'; }
        catch (e3) { return 'fiber-error'; }
    }

    function shown(el) {
        if (!el || !el.getBoundingClientRect) return false;
        const rect = el.getBoundingClientRect();
        return rect.width >= 1 && rect.height >= 1;
    }

    function inPanel(el) {
        return !!(el && el.closest && el.closest('#' + PANEL_ID));
    }

    function inTooltip(el) {
        return !!(el && el.closest && el.closest('[id^="tooltip-"]'));
    }

    function textWithSpaces(el) {
        if (!el) return '';
        if (el.nodeType === 3) return el.textContent || '';
        let text = '';
        const kids = el.childNodes || [];
        for (let i = 0; i < kids.length; i++) {
            if (text && kids[i].nodeType !== 3) text += ' ';
            text += textWithSpaces(kids[i]);
        }
        return text;
    }

    function cleanText(el) {
        if (!el) return '';
        const clone = el.cloneNode(true);
        const junk = clone.querySelectorAll ? clone.querySelectorAll(PANEL_JUNK) : [];
        for (let i = 0; i < junk.length; i++) junk[i].remove();
        return plain(textWithSpaces(clone));
    }

    function stationRows() {
        const out = [];
        const tables = document.querySelectorAll('table');
        for (let t = 0; t < tables.length; t++) {
            if (inPanel(tables[t]) || inTooltip(tables[t])) continue;
            const rows = tables[t].querySelectorAll('tbody tr');
            for (let i = 0; i < rows.length; i++) out.push(rows[i]);
        }
        return out;
    }

    function rowAnchors(row) {
        if (!row || !row.querySelectorAll) return [];
        return row.querySelectorAll('a[role="button"], a[mdn-link]');
    }

    function personCell(row) {
        const cells = row.querySelectorAll('td');
        for (let i = 0; i < cells.length; i++) {
            const anchors = rowAnchors(cells[i]);
            for (let a = 0; a < anchors.length; a++) {
                const text = plain(anchors[a].textContent);
                if (isNoneLabel(text) || looksLikeLogin(text)) return cells[i];
            }
        }
        return cells.length > 1 ? cells[1] : (cells[0] || null);
    }

    function rowMark(row) {
        if (!row || !row.querySelectorAll) return '';
        const cells = row.querySelectorAll('td');
        const person = personCell(row);
        const texts = [];
        let personIndex = -1;
        for (let i = 0; i < cells.length; i++) {
            texts.push(cleanText(cells[i]));
            if (cells[i] === person) personIndex = i;
        }
        return rowMarkFromTexts(texts, personIndex);
    }

    function rowAddress(row) {
        const rows = stationRows();
        let index = -1;
        for (let i = 0; i < rows.length; i++) if (rows[i] === row) index = i;
        return { mark: rowMark(row), index: index };
    }

    function findRow(address) {
        if (!address || !address.mark) return null;
        const rows = stationRows();
        const hits = [];
        for (let i = 0; i < rows.length; i++) {
            if (rowMark(rows[i]) === address.mark) hits.push({ row: rows[i], index: i });
        }
        if (!hits.length) return null;
        for (let i = 0; i < hits.length; i++) {
            if (hits[i].index === address.index) return hits[i].row;
        }
        return hits[0].row;
    }

    function anchorWithText(row, login) {
        const want = normalizeLogin(login);
        const anchors = rowAnchors(row);
        for (let i = 0; i < anchors.length; i++) {
            if (normalizeLogin(anchors[i].textContent) === want) return anchors[i];
        }
        return null;
    }

    function noneAnchor(row) {
        const anchors = rowAnchors(row);
        for (let i = 0; i < anchors.length; i++) {
            if (isNoneLabel(anchors[i].textContent)) return anchors[i];
        }
        return null;
    }

    function findLoginRow(login) {
        const rows = stationRows();
        for (let i = 0; i < rows.length; i++) {
            if (anchorWithText(rows[i], login)) return rows[i];
        }
        return null;
    }

    function loginOnBoard(login) {
        return !!findLoginRow(login);
    }

    function loginOnRow(address, login) {
        const row = findRow(address);
        return !!(row && anchorWithText(row, login));
    }

    function boardLogins() {
        const seen = Object.create(null);
        const out = [];
        const rows = stationRows();
        for (let i = 0; i < rows.length; i++) {
            const anchors = rowAnchors(rows[i]);
            for (let a = 0; a < anchors.length; a++) {
                const login = normalizeLogin(anchors[a].textContent);
                if (!looksLikeLogin(login) || seen[login]) continue;
                seen[login] = true;
                out.push(login);
            }
        }
        out.sort();
        return out;
    }

    function headingLabel(el) {
        if (!el) return '';
        const clone = el.cloneNode(true);
        const junk = clone.querySelectorAll ? clone.querySelectorAll(PANEL_JUNK) : [];
        for (let i = 0; i < junk.length; i++) junk[i].remove();
        return plain(clone.textContent).replace(/\d+(\.\d+)?\s*UPH\s*avg.*/i, '').trim();
    }

    function ownText(el) {
        let text = '';
        const nodes = el && el.childNodes ? el.childNodes : [];
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType === 3) text += nodes[i].textContent;
        }
        return plain(text);
    }

    function findTargetHeading() {
        const heads = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
        for (let i = 0; i < heads.length; i++) {
            if (inPanel(heads[i])) continue;
            if (isTargetHeading(headingLabel(heads[i]))) return heads[i];
        }
        const nodes = document.querySelectorAll('div, span, button, a');
        for (let i = 0; i < nodes.length; i++) {
            if (inPanel(nodes[i])) continue;
            const text = ownText(nodes[i]);
            if (!text || text.length > 80) continue;
            if (isTargetHeading(text)) return nodes[i];
        }
        return null;
    }

    function containsOtherLine(root, self) {
        if (!root || !root.querySelectorAll) return false;
        const heads = root.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"], div, span, button');
        for (let i = 0; i < heads.length; i++) {
            if (heads[i] === self) continue;
            const label = heads[i].matches && heads[i].matches('h1, h2, h3, h4, h5, h6, [role="heading"]')
                ? headingLabel(heads[i])
                : ownText(heads[i]);
            if (isOtherLine(label)) return true;
        }
        return false;
    }

    function groupRoot(heading) {
        let el = heading ? heading.parentElement : null;
        let best = null;
        for (let i = 0; i < 8 && el; i++) {
            if (containsOtherLine(el, heading)) break;
            if (el.querySelector && el.querySelector('table')) best = el;
            el = el.parentElement;
        }
        return best;
    }

    function tablesIn(root) {
        const out = [];
        if (!root || !root.querySelectorAll) return out;
        const tables = root.querySelectorAll('table');
        for (let i = 0; i < tables.length; i++) {
            if (inPanel(tables[i]) || inTooltip(tables[i])) continue;
            out.push(tables[i]);
        }
        return out;
    }

    function tablesFor(heading) {
        const found = tablesIn(groupRoot(heading));
        if (found.length) return found;
        let sib = heading ? heading.nextElementSibling : null;
        for (let i = 0; i < 4 && sib; i++) {
            if (sib.tagName === 'TABLE' && !inTooltip(sib) && !inPanel(sib)) return [sib];
            const nested = tablesIn(sib);
            if (nested.length && !containsOtherLine(sib, heading)) return nested;
            sib = sib.nextElementSibling;
        }
        return [];
    }

    function readRoster(heading) {
        const out = [];
        const tables = tablesFor(heading);
        for (let t = 0; t < tables.length; t++) {
            const rows = tables[t].querySelectorAll('tbody tr');
            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll('td');
                if (cells.length < 2) continue;
                const assignment = cleanText(cells[0]);
                if (!assignment || /^assignment$/i.test(assignment)) continue;
                let chosen = null;
                for (let c = 1; c < cells.length; c++) {
                    const anchors = rowAnchors(cells[c]);
                    let anchorText = '';
                    for (let a = 0; a < anchors.length; a++) {
                        const text = plain(anchors[a].textContent);
                        if (isNoneLabel(text) || isDisabledLabel(text) || looksLikeLogin(text)) {
                            anchorText = text;
                            break;
                        }
                    }
                    const who = classifyEmployee(anchorText, cleanText(cells[c]));
                    if (!chosen) chosen = who;
                    if (who.login || who.employee === 'DISABLED') {
                        chosen = who;
                        break;
                    }
                }
                if (!chosen) chosen = { employee: 'None', login: '' };
                out.push({
                    assignment: assignment,
                    employee: chosen.employee,
                    login: chosen.login
                });
            }
        }
        return out;
    }

    function tooltipIds() {
        const ids = Object.create(null);
        const tips = document.querySelectorAll('[id^="tooltip-"]');
        for (let i = 0; i < tips.length; i++) {
            if (tips[i].id && shown(tips[i])) ids[tips[i].id] = true;
        }
        return ids;
    }

    function visibleButton(pattern, known) {
        const buttons = document.querySelectorAll('button');
        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (inPanel(btn)) continue;
            if (!pattern.test(plain(btn.textContent))) continue;
            if (!shown(btn)) continue;
            const tip = btn.closest && btn.closest('[id^="tooltip-"]');
            if (known && tip && known[tip.id]) continue;
            return btn;
        }
        return null;
    }

    function assignSearch(known) {
        const inputs = document.querySelectorAll('input');
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            if (inPanel(input) || !inTooltip(input)) continue;
            if (!isSearchHint(input.getAttribute('placeholder') || '', input.id || '')) continue;
            if (!shown(input)) continue;
            const tip = input.closest('[id^="tooltip-"]');
            if (known && tip && known[tip.id]) continue;
            return input;
        }
        return null;
    }

    function rowHasLoginToken(el, login) {
        if (!el) return false;
        const want = normalizeLogin(login);
        const nodes = el.querySelectorAll ? el.querySelectorAll('td, a, span, div, button') : [];
        const pool = nodes.length ? nodes : [el];
        for (let i = 0; i < pool.length; i++) {
            if (pool[i].children && pool[i].children.length) continue;
            const text = plain(pool[i].textContent).toLowerCase();
            if (!text) continue;
            if (text === want) return true;
            const tokens = text.match(/[a-z][a-z0-9._-]{2,31}/g) || [];
            if (tokens.indexOf(want) !== -1) return true;
        }
        return false;
    }

    function assignButtonFor(login) {
        const buttons = document.querySelectorAll('button');
        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (inPanel(btn) || !inTooltip(btn)) continue;
            if (!/^assign$/i.test(plain(btn.textContent))) continue;
            if (!shown(btn)) continue;
            const row = (btn.closest && (btn.closest('tr') || btn.closest('[id^="tooltip-"]'))) || btn.parentElement;
            if (rowHasLoginToken(row, login)) return btn;
        }
        return null;
    }

    function writeLogin(input, value) {
        const win = pageWindow();
        const proto = win.HTMLInputElement && win.HTMLInputElement.prototype;
        const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
        try { input.focus(); } catch (e) { /* ignore */ }
        if (input._valueTracker) {
            try { input._valueTracker.setValue(''); } catch (e2) { /* ignore */ }
        }
        if (desc && desc.set) desc.set.call(input, value);
        else input.value = value;
        try {
            input.dispatchEvent(new win.InputEvent('input', {
                bubbles: true, cancelable: true, data: value, inputType: 'insertText'
            }));
        } catch (e3) {
            input.dispatchEvent(new win.Event('input', { bubbles: true }));
        }
        input.dispatchEvent(new win.Event('change', { bubbles: true }));
    }

    async function typeLogin(input, login) {
        writeLogin(input, '');
        let typed = '';
        for (let i = 0; i < login.length; i++) {
            typed += login.charAt(i);
            writeLogin(input, typed);
            await sleep(60);
        }
        return input.value || '';
    }

    async function settledAssign(login) {
        let last = null;
        let seen = 0;
        const start = Date.now();
        while (Date.now() - start < WATCH_MS) {
            const button = assignButtonFor(login);
            if (button && button === last) {
                seen += 1;
                if (seen >= 3) return button;
            } else {
                last = button;
                seen = button ? 1 : 0;
            }
            await sleep(200);
        }
        return assignButtonFor(login);
    }

    function assignmentError() {
        const nodes = document.querySelectorAll('[role="dialog"], [role="alert"], div');
        for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            if (inPanel(el)) continue;
            const text = plain(el.textContent);
            if (text.toLowerCase().indexOf('error has occurred during assignment') === -1) continue;
            if (text.length > 400) continue;
            return text;
        }
        return '';
    }

    function dismissAssignmentError() {
        const nodes = document.querySelectorAll('[role="dialog"], [role="alert"], div');
        for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            const text = plain(el.textContent);
            if (text.toLowerCase().indexOf('error has occurred during assignment') === -1) continue;
            if (text.length > 400) continue;
            const buttons = el.querySelectorAll('button, [role="button"]');
            for (let b = 0; b < buttons.length; b++) {
                if (!/^(ok|close|dismiss|got it)$/i.test(plain(buttons[b].textContent))) continue;
                pageClick(buttons[b]);
                return;
            }
        }
    }

    function buttonGone(btn) {
        if (!btn || !btn.isConnected) return true;
        return !shown(btn);
    }

    function closeOpenMenu() {
        const cancel = visibleButton(/^cancel$/i);
        if (cancel) pageClick(cancel);
    }

    async function openFor(el, mode, read) {
        const known = tooltipIds();
        const start = Date.now();
        let opener = clickControl(el, mode);
        let found = await waitFor(function () { return read(known); }, Math.min(2000, WATCH_MS));
        if (!found && opener !== 'native' && Date.now() - start < WATCH_MS) {
            opener = clickControl(el, 'native');
            found = await waitFor(function () { return read(known); }, Math.max(0, WATCH_MS - (Date.now() - start)));
        }
        if (!found) found = read(null);
        return { found: found, opener: opener };
    }

    let busy = false;
    let stop = false;
    const runs = [];

    function rootNode() {
        return document.getElementById(PANEL_ID);
    }

    function panelQuery(selector) {
        const host = rootNode();
        const root = host && host.shadowRoot;
        return root ? root.querySelector(selector) : null;
    }

    function setStatus(text) {
        const node = panelQuery('[data-status]');
        if (node) node.textContent = text || '';
    }

    function paintLog() {
        const node = panelQuery('[data-log]');
        if (!node) return;
        const lines = [];
        for (let i = 0; i < runs.length; i++) lines.push(runs[i].text);
        node.textContent = lines.join('\n');
        node.scrollTop = node.scrollHeight;
    }

    function log(text, extra) {
        const entry = { at: new Date().toISOString(), text: text };
        if (extra) {
            const keys = Object.keys(extra);
            for (let i = 0; i < keys.length; i++) entry[keys[i]] = extra[keys[i]];
        }
        runs.push(entry);
        if (runs.length > 80) runs.shift();
        paintLog();
    }

    function hold(on) {
        const root = document.documentElement;
        if (!root || !root.setAttribute) return;
        if (on) root.setAttribute('data-mem3-ps-hold', '1');
        else root.removeAttribute('data-mem3-ps-hold');
    }

    function setBusy(on) {
        busy = on;
        const go = panelQuery('[data-go]');
        const all = panelQuery('[data-all]');
        const stopBtn = panelQuery('[data-stop]');
        const line = panelQuery('[data-line]');
        if (go) go.disabled = on;
        if (all) all.disabled = on;
        if (line) line.disabled = on;
        if (stopBtn) stopBtn.disabled = !on;
    }

    async function watch(read, label, goal) {
        const samples = [];
        const start = Date.now();
        while (Date.now() - start < WATCH_MS) {
            if (stop) break;
            let here = false;
            try { here = !!read(); } catch (e) { here = false; }
            samples.push(here);
            if (ready(samples, goal)) break;
            const left = Math.max(0, Math.ceil((WATCH_MS - (Date.now() - start)) / 1000));
            setStatus(label + ' · ' + left + 's · ' + (here ? 'on the station' : 'off the station'));
            await sleep(SAMPLE_MS);
        }
        return samples;
    }

    async function unassignLogin(login, mode) {
        if (isNoneLabel(login) || isDisabledLabel(login)) {
            return { ok: false, text: mode + ' · ' + login + ' is not a person.' };
        }
        const row = findLoginRow(login);
        if (!row) return { ok: false, text: mode + ' · ' + login + ' is not on a station.' };
        const address = rowAddress(row);
        const anchor = anchorWithText(row, login);
        try { anchor.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { /* ignore */ }
        await sleep(80);
        const opened = await openFor(anchor, mode, function (known) {
            return visibleButton(/^unassign$/i, known);
        });
        if (!opened.found) {
            return {
                ok: false,
                address: address,
                text: mode + ' · Unassign did not open for ' + login + '.'
            };
        }
        await sleep(200);
        const clicked = clickControl(opened.found, mode);
        const gone = await waitFor(function () { return buttonGone(opened.found) ? true : null; }, WATCH_MS);
        const samples = await watch(function () { return loginOnBoard(login); }, mode + ' unassign ' + login, 'gone');
        const result = outcome(samples, 'gone');
        return {
            ok: result === 'left',
            address: address,
            result: result,
            samples: sampleText(samples),
            opener: opened.opener,
            click: clicked,
            buttonGone: !!gone,
            text: mode + ' · menu opened with ' + opened.opener +
                ' · Unassign click ' + clicked +
                ' · button ' + (gone ? 'closed' : 'stayed') +
                ' · ' + result + ' · ' + sampleText(samples)
        };
    }

    async function assignLogin(login, mode, address) {
        const row = findRow(address) || findLoginRow(login);
        const opener = row ? noneAnchor(row) : null;
        if (!opener) {
            return { ok: false, text: mode + ' · That station does not show None, so Assign was not clicked.' };
        }
        try { opener.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { /* ignore */ }
        const opened = await openFor(opener, mode, function (known) { return assignSearch(known); });
        if (!opened.found) {
            return { ok: false, text: mode + ' · The login search did not open.' };
        }
        const typed = await typeLogin(opened.found, login);
        let button = await settledAssign(login);
        if (!button) {
            writeLogin(opened.found, login);
            button = await settledAssign(login);
        }
        if (!button) {
            return { ok: false, text: mode + ' · Assign did not show for ' + login + '. Search says "' + typed + '".' };
        }
        const clicked = clickControl(button, mode);
        const error = assignmentError();
        dismissAssignmentError();
        const samples = await watch(function () { return loginOnRow(address, login); }, mode + ' assign ' + login, 'here');
        const result = outcome(samples, 'here');
        let text = mode + ' · Assign click ' + clicked + ' · ' + result + ' · ' + sampleText(samples);
        if (error) text += ' · ' + error;
        return {
            ok: result === 'arrived' || result === 'assigned',
            result: result,
            samples: sampleText(samples),
            click: clicked,
            typed: typed,
            error: error,
            text: text
        };
    }

    async function roundTrip(login, mode) {
        closeOpenMenu();
        await sleep(150);
        log(mode + ' · unassign ' + login);
        const off = await unassignLogin(login, mode);
        log(off.text, { samples: off.samples || '', result: off.result || '' });
        if (stop) return { stopped: true, off: !!off.ok, back: false, address: off.address };
        if (!off.ok) {
            log(mode + ' · skipped Assign. ' + login + ' did not stay off the station.');
            return { stopped: false, off: false, back: false };
        }
        log(mode + ' · assign ' + login + ' back on that station');
        const back = await assignLogin(login, mode, off.address);
        log(back.text, { samples: back.samples || '', result: back.result || '' });
        return { stopped: !!stop, off: true, back: !!back.ok, address: off.address };
    }

    function pausePanel() {
        const box = panelQuery('[data-pause]');
        return !!(box && box.checked);
    }

    async function afterResume(login, address) {
        hold(false);
        const samples = await watch(function () {
            return address ? loginOnRow(address, login) : loginOnBoard(login);
        }, 'After the panel resumed', 'here');
        const on = outcome(samples, 'here');
        log('After the productivity panel resumed · ' + on + ' · ' + sampleText(samples));
    }

    async function run(modes) {
        if (busy) return;
        const input = panelQuery('[data-login]');
        const login = normalizeLogin(input && input.value);
        if (!looksLikeLogin(login)) {
            setStatus('Type a login, for example abelrigm.');
            return;
        }
        if (!loginOnBoard(login)) {
            setStatus(login + ' is not on a station.');
            return;
        }
        stop = false;
        setBusy(true);
        const pause = pausePanel();
        if (pause) hold(true);
        else log('Productivity panel was left alone.');
        let address = null;
        try {
            for (let i = 0; i < modes.length; i++) {
                if (stop) break;
                const before = findLoginRow(login);
                address = before ? rowAddress(before) : address;
                await roundTrip(login, modes[i]);
                if (stop) break;
            }
        } catch (e) {
            log('Stopped on an error · ' + (e && e.message ? e.message : String(e)));
        } finally {
            if (pause) await afterResume(login, address);
            else hold(false);
            setBusy(false);
            setStatus(stop ? 'Stopped.' : 'Done.');
        }
    }

    async function runLine(mode) {
        if (busy) return;
        const heading = findTargetHeading();
        if (!heading) {
            setStatus(LINE_LABEL + ' is not on this page.');
            return;
        }
        const roster = readRoster(heading);
        const title = headingLabel(heading) || ownText(heading) || LINE_LABEL;
        const table = rosterTable(title, roster);
        const people = [];
        for (let i = 0; i < roster.length; i++) {
            if (roster[i].login) people.push(roster[i].login);
        }
        log(table);
        copyText(table, 'Copied the original roster.');
        if (!people.length) {
            setStatus('Copied the roster. Nobody is signed in on ' + title + '.');
            return;
        }
        stop = false;
        setBusy(true);
        const pause = pausePanel();
        if (pause) hold(true);
        log(title + ' · ' + people.length + ' signed in · ' + mode +
            (pause ? ' · productivity panel paused' : ' · productivity panel left alone'));
        let address = null;
        let last = '';
        try {
            for (let i = 0; i < people.length; i++) {
                if (stop) break;
                const login = people[i];
                last = login;
                setStatus((i + 1) + '/' + people.length + ' · ' + login);
                const trip = await roundTrip(login, mode);
                if (trip && trip.address) address = trip.address;
                if (stop) break;
                if (trip && trip.off && !trip.back) {
                    log('Stopped. ' + login + ' is off the station and Assign did not put them back.');
                    stop = true;
                    break;
                }
            }
        } catch (e) {
            log('Stopped on an error · ' + (e && e.message ? e.message : String(e)));
        } finally {
            if (pause) await afterResume(last, address);
            else hold(false);
            setBusy(false);
            setStatus(stop ? 'Stopped.' : 'Done. ' + people.length + ' people on ' + title + '.');
        }
    }

    function refreshLogins() {
        const list = panelQuery('#logins');
        if (!list || busy) return;
        const names = boardLogins();
        const html = [];
        for (let i = 0; i < names.length; i++) html.push('<option value="' + names[i] + '"></option>');
        list.innerHTML = html.join('');
    }

    function copyText(text, okStatus) {
        const done = function () { setStatus(okStatus || 'Copied.'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () {
                setStatus('The table is in the box below.');
            });
            return;
        }
        setStatus('The table is in the box below.');
    }

    function copyRoster() {
        const heading = findTargetHeading();
        if (!heading) {
            setStatus(LINE_LABEL + ' is not on this page.');
            return;
        }
        const title = headingLabel(heading) || ownText(heading) || LINE_LABEL;
        const table = rosterTable(title, readRoster(heading));
        log(table);
        copyText(table, 'Copied the original roster.');
    }

    function clipText(value, max) {
        const text = String(value == null ? '' : value);
        return text.length > max ? text.slice(0, max) + '…' : text;
    }

    function debugTooltips() {
        const out = [];
        const tips = document.querySelectorAll('[id^="tooltip-"]');
        for (let i = 0; i < tips.length; i++) {
            const tip = tips[i];
            if (inPanel(tip) || !shown(tip)) continue;
            const inputs = [];
            const fields = tip.querySelectorAll('input, textarea');
            for (let f = 0; f < fields.length; f++) {
                inputs.push({
                    id: fields[f].id || '',
                    placeholder: fields[f].getAttribute('placeholder') || '',
                    value: clipText(fields[f].value, 40)
                });
            }
            const buttons = [];
            const found = tip.querySelectorAll('button, a[role="button"], a[mdn-link]');
            for (let b = 0; b < found.length; b++) {
                const label = clipText(plain(found[b].textContent), 40);
                if (label) buttons.push(label);
            }
            out.push({
                id: tip.id || '',
                inputs: inputs,
                buttons: buttons,
                html: clipText(tip.outerHTML, 900)
            });
        }
        return out;
    }

    function collectDebug() {
        let href = '';
        try { href = location.href; } catch (e) { href = ''; }
        const heading = findTargetHeading();
        const title = heading ? (headingLabel(heading) || ownText(heading) || LINE_LABEL) : '';
        const status = panelQuery('[data-status]');
        return {
            script: 'Assign Round Trip',
            version: VERSION,
            at: new Date().toISOString(),
            href: href,
            pause: pausePanel(),
            busy: busy,
            line: title,
            roster: heading ? readRoster(heading) : [],
            status: status ? (status.textContent || '') : '',
            runs: runs,
            tooltips: debugTooltips()
        };
    }

    function copyDebug() {
        const text = JSON.stringify(collectDebug(), null, 2);
        log('Copied debug.');
        copyText(text, 'Copied debug.');
    }

    function paint() {
        if (document.getElementById(PANEL_ID)) return;
        const host = document.createElement('div');
        host.id = PANEL_ID;
        host.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483000;width:420px;';
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = [
            '<style>',
            ':host{all:initial;}',
            '.box{box-sizing:border-box;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:10px;',
            'font:13px/1.4 Segoe UI,sans-serif;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);}',
            '.head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;}',
            'strong{font-size:14px;} .ver{color:#8b949e;}',
            '.hint{margin:0 0 8px;color:#8b949e;}',
            '.check{display:flex;align-items:center;gap:8px;margin-top:8px;color:#c9d1d9;}',
            '.check input{width:auto;margin:0;}',
            'label{display:block;margin:6px 0;color:#c9d1d9;}',
            'input,select,button{font:13px Segoe UI,sans-serif;}',
            'input,select{width:100%;box-sizing:border-box;margin-top:3px;background:#0d1117;color:#e6edf3;',
            'border:1px solid #30363d;border-radius:6px;padding:6px 8px;}',
            '.actions{display:flex;gap:8px;margin-top:8px;}',
            'button{flex:1;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:7px 8px;cursor:pointer;}',
            'button[data-go],button[data-line]{background:#238636;border-color:#2ea043;}',
            'button:disabled{opacity:.45;cursor:default;}',
            '[data-status]{min-height:18px;margin-top:8px;color:#d29922;}',
            'pre{max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:#0d1117;',
            'border-radius:6px;padding:8px;margin:8px 0 0;}',
            '</style>',
            '<div class="box">',
            '<div class="head"><strong>Assign test</strong><span class="ver">', VERSION, '</span></div>',
            '<p class="hint">Line 1 Odd + Support reads CRET Line 1 (O) + Line Support, copies who is on each station, then unassigns each signed-in person and assigns that same person back if they stay off. It moves on as soon as that result has held, and it stops waiting at 10 seconds. No login to type. None and disabled stations stay as they are. Leave Pause unchecked when the productivity panel is turned off.</p>',
            '<label>One person, optional<input data-login list="logins" placeholder="abelrigm" autocomplete="off" spellcheck="false"></label>',
            '<datalist id="logins"></datalist>',
            '<label>Click<select data-method>',
            '<option value="fiber">fiber — the button only</option>',
            '<option value="fiber-all">fiber-all — the button and the boxes around it</option>',
            '<option value="native">native — a mouse click</option>',
            '</select></label>',
            '<div class="actions"><button data-line>Line 1 Odd + Support, one by one</button></div>',
            '<div class="actions"><button data-go>Unassign, then assign back</button><button data-all>Try all 3</button></div>',
            '<label class="check"><input type="checkbox" data-pause> Pause the productivity panel</label>',
            '<div class="actions"><button data-roster>Copy roster</button><button data-debug>Copy debug</button><button data-stop disabled>Stop</button></div>',
            '<div data-status></div>',
            '<pre data-log></pre>',
            '</div>'
        ].join('');
        document.body.appendChild(host);
        root.querySelector('[data-line]').addEventListener('click', function () {
            const method = root.querySelector('[data-method]').value;
            runLine(method);
        });
        root.querySelector('[data-go]').addEventListener('click', function () {
            const method = root.querySelector('[data-method]').value;
            run([method]);
        });
        root.querySelector('[data-all]').addEventListener('click', function () { run(METHODS.slice()); });
        root.querySelector('[data-stop]').addEventListener('click', function () {
            stop = true;
            setStatus('Stopping after this check.');
        });
        root.querySelector('[data-roster]').addEventListener('click', copyRoster);
        root.querySelector('[data-debug]').addEventListener('click', copyDebug);
        root.querySelector('[data-login]').addEventListener('focus', refreshLogins);
        refreshLogins();
    }

    function boot() {
        if (typeof document === 'undefined' || !document.body) return;
        paint();
        setInterval(refreshLogins, 2000);
    }

    const root = typeof globalThis !== 'undefined' ? globalThis : window;
    if (root.__ASSIGN_TEST_EXPORT) {
        root.__assignRoundTrip = {
            version: VERSION,
            methods: METHODS,
            watchMs: WATCH_MS,
            outcome: outcome,
            stableEnd: stableEnd,
            rowMarkFromTexts: rowMarkFromTexts,
            looksLikeLogin: looksLikeLogin,
            isNoneLabel: isNoneLabel,
            isSearchHint: isSearchHint,
            isTargetHeading: isTargetHeading,
            isOtherLine: isOtherLine,
            classifyEmployee: classifyEmployee,
            rosterTable: rosterTable,
            ready: ready,
            lineLabel: LINE_LABEL,
            sampleText: sampleText
        };
    }
    if (root.__mem3AssignRoundTrip) return;
    root.__mem3AssignRoundTrip = true;
    if (!root.__ASSIGN_TEST_EXPORT) boot();
})();
