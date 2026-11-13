// ==UserScript==
// @name         MEM3 Control Tower - Station Roster (abelrigm)
// @namespace    https://mem3.amazon.local/
// @version      1.0.0
// @description  Export every station in every department with the login, empty, or disabled.
// @author       abelrigm
// @updateURL    https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/mem3-station-roster.user.js
// @downloadURL  https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/mem3-station-roster.user.js
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

    // One button on the assignments page. It stays off the group headings so the
    // productivity panel still reads those names. Each station row becomes one
    // line: department, group, station, and a value of a login, empty, or disabled.

    const SCRIPT_VERSION = '1.0.0';
    const BUTTON_ID = 'mem3-station-export';
    const JUNK = '.mem3-uph-badge, .mem3-line-avg-badge, .mem3-popup-uph, .mem3-popup-clock, .mem3-popup-idle, .mem3-yield, .mem3-clock-ring, .mem3-clock-pill';
    const SKIP = '#mem3-floor-summary, #mem3-ps-board, #mem3-run-panel, #mem3-unassign-panel, #' + BUTTON_ID;

    function cleanClone(el) {
        const clone = el.cloneNode(true);
        if (clone.querySelectorAll) {
            const junk = clone.querySelectorAll(JUNK);
            for (let i = 0; i < junk.length; i++) junk[i].remove();
        }
        return clone;
    }

    function plainText(el) {
        if (!el) return '';
        const clone = cleanClone(el);
        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function employeeCellText(cell) {
        if (!cell) return '';
        const clone = cleanClone(cell);
        const anchors = clone.querySelectorAll ? clone.querySelectorAll('a') : [];
        const logins = [];
        for (let i = 0; i < anchors.length; i++) {
            const text = (anchors[i].textContent || '').replace(/\s+/g, ' ').trim();
            if (/^(none|disabled)$/i.test(text)) continue;
            if (/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(text)) logins.push(text);
        }
        if (logins.length) return logins.join(' ');
        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function textWithBreaks(el) {
        if (!el) return '';
        const clone = cleanClone(el);
        const doc = clone.ownerDocument || (typeof document !== 'undefined' ? document : null);
        if (clone.querySelectorAll && doc && doc.createTextNode) {
            const breaks = clone.querySelectorAll('br, div, p, li');
            for (let i = 0; i < breaks.length; i++) {
                const node = breaks[i];
                if (!node.parentNode) continue;
                node.parentNode.insertBefore(doc.createTextNode('\n'), node);
            }
        }
        return (clone.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
    }

    const NOT_LOGIN = {
        none: true, disabled: true, assign: true, unassign: true, employee: true, assignment: true,
        see: true, ps: true, pa: true, the: true, and: true, station: true, half: true,
        customer: true, returns: true, odd: true, even: true, problem: true, solve: true,
        cret: true, crets: true, line: true, priority: true, idle: true, uph: true, avg: true
    };

    function stationLabel(assignment, group) {
        const lines = String(assignment || '').split(/\n+/).map(function (line) {
            return line.replace(/\s+/g, ' ').trim();
        }).filter(Boolean);
        const groupKey = String(group || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        const specific = [];
        for (let i = 0; i < lines.length; i++) {
            const key = lines[i].toLowerCase().replace(/[^a-z0-9]+/g, '');
            if (/^crets?\s*problem\s*solve$/i.test(lines[i])) continue;
            if (groupKey && key === groupKey) continue;
            specific.push(lines[i]);
        }
        const chosen = (specific.length ? specific : lines).map(function (line) {
            return line.replace(/\s*\|\s*see\s+ps\s+pa\s*$/i, '').replace(/\s+/g, ' ').trim();
        }).filter(Boolean);
        return chosen.join(' | ');
    }

    function employeeValue(text) {
        const flat = String(text || '').replace(/\s+/g, ' ').trim();
        const bare = flat.replace(/[.!]+$/g, '');
        if (!bare || /^none$/i.test(bare)) return 'empty';
        if (/^disabled$/i.test(bare)) return 'disabled';
        const tokens = flat.match(/[A-Za-z][A-Za-z0-9._-]{2,31}/g) || [];
        const logins = [];
        let disabled = false;
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i].toLowerCase();
            if (token === 'disabled') {
                disabled = true;
                continue;
            }
            if (NOT_LOGIN[token]) continue;
            if (logins.indexOf(token) === -1) logins.push(token);
        }
        if (logins.length) return logins.join('; ');
        if (disabled || /\bdisabled\b/i.test(flat)) return 'disabled';
        return 'empty';
    }

    function buildRoster(entries) {
        const rows = [];
        const source = entries || [];
        for (let i = 0; i < source.length; i++) {
            const entry = source[i] || {};
            const group = String(entry.group || '').replace(/\s+/g, ' ').trim();
            const department = String(entry.department || '').replace(/\s+/g, ' ').trim() || group;
            const station = stationLabel(entry.assignment, group);
            if (!station || /^assignment$/i.test(station)) continue;
            rows.push({
                department: department,
                group: group,
                station: station,
                value: employeeValue(entry.employee)
            });
        }
        return rows;
    }

    function csvField(value) {
        const text = String(value == null ? '' : value);
        if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
        return text;
    }

    function toCsv(rows) {
        const lines = ['department,group,station,value'];
        const list = rows || [];
        for (let i = 0; i < list.length; i++) {
            const row = list[i];
            lines.push([row.department, row.group, row.station, row.value].map(csvField).join(','));
        }
        return lines.join('\n');
    }

    function skipTree(el) {
        return !!(el && el.closest && el.closest(SKIP));
    }

    function cardForHeading(heading) {
        let el = heading;
        for (let i = 0; i < 8 && el; i++) {
            if (el !== heading && el.querySelectorAll) {
                const headings = el.querySelectorAll('h5');
                if (el.querySelector('table') && headings.length === 1 && headings[0] === heading) return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    function isDepartmentHeading(el) {
        if (!el || !el.matches) return false;
        if (el.matches('h1, h2, h3, h4')) return true;
        if (el.getAttribute && el.getAttribute('role') === 'heading') {
            const level = Number(el.getAttribute('aria-level'));
            return !level || level < 5;
        }
        return false;
    }

    function titleOf(el) {
        if (!el || !el.tagName) return '';
        const tag = el.tagName;
        if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TABLE' || tag === 'SCRIPT' || tag === 'STYLE') return '';
        if (el.querySelector && (el.querySelector('table') || el.querySelector('h5') || el.querySelector('button'))) return '';
        const text = plainText(el);
        if (!text || text.length > 80) return '';
        if (/^(priority\b|assignment|employee|export stations)/i.test(text)) return '';
        if (/\b(updated|refresh|ago)\b/i.test(text) || /\d{1,2}:\d{2}/.test(text)) return '';
        return text;
    }

    function departmentName(card, group) {
        let node = card;
        while (node && node.parentElement) {
            let prev = node.previousElementSibling;
            while (prev) {
                let name = '';
                if (isDepartmentHeading(prev) && !(prev.querySelector && prev.querySelector('table'))) name = plainText(prev);
                if (!name) name = titleOf(prev);
                if (name && name !== group) return name;
                prev = prev.previousElementSibling;
            }
            node = node.parentElement;
            if (!node || node === document.body || node === document.documentElement) break;
        }
        return '';
    }

    function collectEntries(doc) {
        const entries = [];
        const headings = doc.querySelectorAll('h5');
        const seen = [];
        for (let i = 0; i < headings.length; i++) {
            const heading = headings[i];
            if (skipTree(heading)) continue;
            const card = cardForHeading(heading);
            if (!card || skipTree(card) || seen.indexOf(card) !== -1) continue;
            seen.push(card);
            const group = plainText(heading);
            const department = departmentName(card, group);
            const table = card.querySelector('table');
            if (!table) continue;
            const body = table.querySelectorAll('tbody tr');
            for (let r = 0; r < body.length; r++) {
                const cells = body[r].querySelectorAll('td');
                if (!cells.length) continue;
                const assignment = textWithBreaks(cells[0]);
                if (!assignment || /^assignment$/i.test(assignment.replace(/\s+/g, ' ').trim())) continue;
                const employee = employeeCellText(cells.length > 1 ? cells[1] : cells[0]);
                entries.push({
                    department: department,
                    group: group,
                    assignment: assignment,
                    employee: employee
                });
            }
        }
        return entries;
    }

    function countValues(rows) {
        let empty = 0;
        let disabled = 0;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].value === 'empty') empty += 1;
            else if (rows[i].value === 'disabled') disabled += 1;
        }
        return { empty: empty, disabled: disabled };
    }

    function downloadCsv(csv) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        const day = new Date();
        const stamp = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
        link.href = URL.createObjectURL(blob);
        link.download = 'mem3-stations-' + stamp + '.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    }

    function copyText(text) {
        return new Promise(function (resolve, reject) {
            const nav = typeof navigator !== 'undefined' ? navigator : null;
            if (nav && nav.clipboard && nav.clipboard.writeText) {
                nav.clipboard.writeText(text).then(resolve).catch(function () {
                    fallbackCopy(text).then(resolve).catch(reject);
                });
                return;
            }
            fallbackCopy(text).then(resolve).catch(reject);
        });
    }

    function fallbackCopy(text) {
        return new Promise(function (resolve, reject) {
            const area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.cssText = 'position:fixed; left:0; top:0; width:1px; height:1px; opacity:0;';
            document.body.appendChild(area);
            area.focus();
            area.select();
            try {
                if (document.execCommand('copy')) resolve();
                else reject(new Error('copy failed'));
            } catch (e) { reject(e); }
            finally { area.remove(); }
        });
    }

    function setStatus(text) {
        const node = document.querySelector('#' + BUTTON_ID + ' [data-status]');
        if (node) node.textContent = text || '';
    }

    function exportStations() {
        const rows = buildRoster(collectEntries(document));
        const csv = toCsv(rows);
        const box = document.querySelector('#' + BUTTON_ID + ' textarea');
        if (box) {
            box.hidden = false;
            box.value = csv;
        }
        const counts = countValues(rows);
        try { downloadCsv(csv); } catch (e) { /* the textarea still holds the export */ }
        const summary = 'Exported ' + rows.length + ' stations. ' + counts.empty + ' empty, ' + counts.disabled + ' disabled.';
        copyText(csv).then(function () {
            setStatus(summary + ' Copied.');
        }).catch(function () {
            setStatus(summary + ' The file downloaded. Clipboard was blocked.');
        });
    }

    function ensureButton() {
        if (!document.body || document.getElementById(BUTTON_ID)) return;
        const bar = document.createElement('div');
        bar.id = BUTTON_ID;
        bar.style.cssText = 'position:fixed; right:12px; bottom:12px; z-index:2147483646; width:min(420px, calc(100% - 24px));' +
            ' display:flex; flex-direction:column; gap:6px; align-items:flex-end;' +
            ' font-family:Segoe UI, system-ui, sans-serif;';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Export stations';
        button.style.cssText = 'padding:8px 12px; border-radius:8px; border:1px solid #1d3b64; background:#1d3b64; color:#fff;' +
            ' font:700 13px Segoe UI, system-ui, sans-serif; cursor:pointer;';
        button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            exportStations();
        });
        const status = document.createElement('div');
        status.setAttribute('data-status', '');
        status.style.cssText = 'font-size:12px; font-weight:650; color:#1d3b64; background:#fff; padding:2px 4px;';
        const area = document.createElement('textarea');
        area.readOnly = true;
        area.hidden = true;
        area.setAttribute('aria-label', 'Station export');
        area.style.cssText = 'width:100%; height:140px; box-sizing:border-box; font:12px ui-monospace, Consolas, monospace;';
        bar.appendChild(area);
        bar.appendChild(button);
        bar.appendChild(status);
        document.body.appendChild(bar);
    }

    const root = typeof globalThis !== 'undefined' ? globalThis : window;
    if (root.__STATION_ROSTER_EXPORT) {
        root.__stationRoster = {
            version: SCRIPT_VERSION,
            employeeValue: employeeValue,
            stationLabel: stationLabel,
            buildRoster: buildRoster,
            toCsv: toCsv,
            countValues: countValues
        };
    }
    if (root.__mem3StationRosterInstalled) return;
    root.__mem3StationRosterInstalled = true;
    if (root.__STATION_ROSTER_EXPORT) return;
    function boot() {
        if (typeof document === 'undefined' || !document.body) return;
        ensureButton();
    }
    boot();
    setInterval(boot, 1500);
})();
