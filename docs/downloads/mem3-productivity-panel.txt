// ==UserScript==
// @name         Productivity Panel
// @namespace    https://mem3.amazon.local/
// @version      1.12.15
// @updateURL    https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/mem3-productivity-panel.user.js
// @downloadURL  https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/mem3-productivity-panel.user.js
// @description  Shows each associate's Primary Grading rate, plus total work time and idle time from FCLM Time Details, for each side and the total.
// @author       abelrigm
// @match        https://beta.control-tower.meta.amazon.dev/*
// @match        https://beta.control-tower.meta.amazon.dev/MEM3/*
// @match        https://beta.control-tower.meta.amazon.dev/MEM3/assignments*
// @match        https://control-tower.meta.amazon.dev/*
// @match        https://control-tower.meta.amazon.dev/MEM3/*
// @match        https://oidc.prod.na.maask.amazonoperations.com/authentication*
// @match        https://*.maask.amazonoperations.com/authentication*
// @match        https://*.cloudfront.net/idp-selection*
// @match        https://menu.na.aft.amazonoperations.app/*
// @connect      fclm-portal.amazon.com
// @connect      midway-auth.amazon.com
// @connect      midway.amazon.com
// @connect      idp.federate.amazon.com
// @connect      federate.amazon.com
// @connect      gist.githubusercontent.com
// @connect      gist.github.com
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @connect      extendsclass.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const WAREHOUSE = 'MEM3';
    const SCRIPT_LABEL = 'Productivity Panel';
    const SCRIPT_VERSION = '1.12.15';
    const SCRIPT_UPDATE_URL = 'https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/downloads/mem3-productivity-panel.user.js';
    const SCRIPT_UPDATE_MS = 5 * 60 * 1000;
    const UPDATE_PROMPT_ID = 'mem3-update-prompt';
    let promptedUpdateVer = '';

    function scriptVersionNewer(remote, local) {
        const parts = function (v) {
            return String(v || '').trim().split(/[^\d]+/).map(function (n) { return parseInt(n, 10) || 0; });
        };
        const a = parts(remote);
        const b = parts(local);
        const n = Math.max(a.length, b.length);
        for (let i = 0; i < n; i++) {
            const x = a[i] || 0;
            const y = b[i] || 0;
            if (x > y) return true;
            if (x < y) return false;
        }
        return false;
    }

    function openScriptInstall() {
        if (typeof GM_openInTab === 'function') {
            GM_openInTab(SCRIPT_UPDATE_URL, { active: true });
            return;
        }
        window.open(SCRIPT_UPDATE_URL, '_blank');
    }

    function updateStep(text, highlight) {
        const item = document.createElement('li');
        item.textContent = text;
        item.style.cssText = 'margin:0 0 10px 0; line-height:1.4;' + (highlight
            ? 'background:#3d2e00; border:2px solid #d29922; border-radius:8px; padding:10px 12px; font-weight:800; font-size:16px;'
            : 'font-weight:650;');
        return item;
    }

    function showUpdatePrompt(remote) {
        if (!document.body) {
            setTimeout(function () { showUpdatePrompt(remote); }, 500);
            return;
        }
        let overlay = document.getElementById(UPDATE_PROMPT_ID);
        if (overlay) {
            const verEl = overlay.querySelector('[data-ver]');
            if (verEl) verEl.textContent = remote;
            return;
        }
        overlay = document.createElement('div');
        overlay.id = UPDATE_PROMPT_ID;
        overlay.style.cssText = 'position:fixed; inset:0; z-index:2147483646; background:rgba(0,0,0,0.55); ' +
            'display:flex; align-items:center; justify-content:center; ' +
            'font-family:Segoe UI,system-ui,sans-serif; color:#ffffff;';
        const card = document.createElement('div');
        card.style.cssText = 'width:min(560px, calc(100% - 24px)); background:#161b22; ' +
            'border:1px solid #8b949e; border-radius:12px; padding:18px;';
        const title = document.createElement('div');
        title.textContent = 'Stop. Do these steps in order.';
        title.style.cssText = 'font-size:20px; font-weight:800;';
        const note = document.createElement('div');
        note.style.cssText = 'font-size:15px; font-weight:650; color:#ffffff; margin-top:8px;';
        note.appendChild(document.createTextNode('You have version ' + SCRIPT_VERSION + '. Version '));
        const verEl = document.createElement('span');
        verEl.setAttribute('data-ver', remote);
        verEl.textContent = remote;
        note.appendChild(verEl);
        note.appendChild(document.createTextNode(' is ready. Do not skip the refresh.'));
        const steps = document.createElement('ol');
        steps.style.cssText = 'margin:14px 0 0; padding-left:22px; font-size:15px; color:#ffffff;';
        steps.appendChild(updateStep('A new tab just opened. Click that tab.'));
        steps.appendChild(updateStep('On that tab, click Install. The button might say Update or Reinstall. Click it.'));
        steps.appendChild(updateStep('Come back to this tab. This is the screen you are looking at right now.'));
        steps.appendChild(updateStep('Refresh this screen. Click the round arrow at the top of the browser. Or press the F5 key.', true));
        steps.appendChild(updateStep('Wait until the page finishes loading. Then you are done.'));
        const warn = document.createElement('div');
        warn.textContent = 'If you do not refresh this screen, nothing changed. You are still on the old panel.';
        warn.style.cssText = 'margin-top:4px; font-size:15px; font-weight:800; color:#d29922;';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; margin-top:16px;';
        const later = document.createElement('button');
        later.type = 'button';
        later.textContent = 'Not now';
        later.style.cssText = 'padding:8px 12px; border-radius:8px; cursor:pointer; color:#ffffff; ' +
            'background:#0d1117; border:1px solid #8b949e; font:800 13px Segoe UI,system-ui,sans-serif;';
        later.addEventListener('click', function () { overlay.remove(); });
        const go = document.createElement('button');
        go.type = 'button';
        go.textContent = 'Open the update tab again';
        go.style.cssText = 'padding:8px 12px; border-radius:8px; cursor:pointer; color:#ffffff; ' +
            'background:#0d1117; border:1px solid #58a6ff; font:800 13px Segoe UI,system-ui,sans-serif;';
        go.addEventListener('click', function () { openScriptInstall(); });
        row.appendChild(later);
        row.appendChild(go);
        card.appendChild(title);
        card.appendChild(note);
        card.appendChild(steps);
        card.appendChild(warn);
        card.appendChild(row);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        openScriptInstall();
    }

    function pullScriptUpdate() {
        if (typeof GM_xmlhttpRequest !== 'function') return;
        GM_xmlhttpRequest({
            method: 'GET',
            url: SCRIPT_UPDATE_URL + '?t=' + Date.now(),
            timeout: 20000,
            anonymous: false,
            onload: function (r) {
                const src = r.responseText || '';
                if (r.status < 200 || r.status >= 400) return;
                if (src.length < 8000 || src.indexOf('==UserScript==') === -1) return;
                if (src.indexOf('Productivity Panel') === -1) return;
                const m = /@version\s+(\S+)/.exec(src);
                if (!m) return;
                const remote = m[1];
                if (remote === SCRIPT_VERSION || !scriptVersionNewer(remote, SCRIPT_VERSION)) return;
                if (promptedUpdateVer === remote && document.getElementById(UPDATE_PROMPT_ID)) return;
                promptedUpdateVer = remote;
                showUpdatePrompt(remote);
            }
        });
    }

    function startSilentUpdates() {
        pullScriptUpdate();
        setInterval(pullScriptUpdate, SCRIPT_UPDATE_MS);
    }

    // The badge is this function only. Bypass, Image Cap, Jobs, and Decant
    // are not substitutes when Primary Grading is missing.
    const PRIMARY_GRADING = { name: 'Primary Grading', id: '1667843456854' };
    const ROLLUP_PROCESSES = [
        { id: '01003026', label: 'C-Returns', primary: true }
    ];
    const DAY_SHIFT_HOUR = 6;
    const NIGHT_SHIFT_HOUR = 18;
    const WINDOW_PRESETS = [
        { id: 'all', label: 'All shift', short: 'All', group: 'Shift', startMin: 0, endMin: 11 * 60 + 59 },
        { id: 'h1', label: '1st half', short: '1st', group: 'Halves', startMin: 0, endMin: 6 * 60 + 15 },
        { id: 'h2', label: '2nd half', short: '2nd', group: 'Halves', startMin: 6 * 60 + 15, endMin: 11 * 60 + 59 },
        { id: 'q1', label: 'Q1', short: 'Q1', group: 'Quarters', startMin: 0, endMin: 3 * 60 },
        { id: 'q2', label: 'Q2', short: 'Q2', group: 'Quarters', startMin: 3 * 60, endMin: 6 * 60 + 15 },
        { id: 'q3', label: 'Q3', short: 'Q3', group: 'Quarters', startMin: 6 * 60 + 15, endMin: 8 * 60 + 30 },
        { id: 'q4', label: 'Q4', short: 'Q4', group: 'Quarters', startMin: 8 * 60 + 30, endMin: 11 * 60 + 59 },
        { id: 'fs1', label: '1st fast start', short: '1st', group: 'Fast starts', startMin: 60, endMin: 60 + 45 },
        { id: 'fs2', label: '2nd fast start', short: '2nd', group: 'Fast starts', startMin: 6 * 60 + 30, endMin: 7 * 60 + 14 }
    ];
    const WINDOW_GROUPS = ['Shift', 'Halves', 'Quarters', 'Fast starts'];
    let ACTIVE_WINDOW = 'all';
    const REFRESH_MS = 5 * 60 * 1000;
    const REFRESH_CHOICE_KEY = 'mem3-refresh-min';
    const IDLE_START_MIN = 11;
    const TIME_WORKERS = 4;
    const UPH_TARGET = 30;

    const TARGET_SECTIONS = {
        'LINE 1 ODD':  ['CRET Line 1 (O)'],
        'LINE 1 EVEN': ['CRET Line 1 (E)'],
        'LINE 2 ODD':  ['CRET Line 2 (O)'],
        'LINE 2 EVEN': ['CRET Line 2 (E)'],
        'LINE 3 ODD':  ['CRET LINE 3 (O)'],
        'LINE 3 EVEN': ['CRET Line 3 (E)'],
        'LINE 4 ODD':  ['CRET Line 4 (O)'],
        'LINE 4 EVEN': ['CRET Line 4 (E)']
    };
    const BIGS_GROUP = 'BIGS Line + Line Support';

    function panelEntries() {
        const out = [];
        const keys = Object.keys(TARGET_SECTIONS);
        for (let i = 0; i < keys.length; i++) out.push({ name: keys[i], labels: TARGET_SECTIONS[keys[i]] });
        out.push({ name: 'BIGS', labels: [BIGS_GROUP] });
        return out;
    }

    const DECOR_CLASS = 'mem3-uph-badge';
    const BIGS_IDLE_CLASS = 'mem3-bigs-idle';
    const SECTION_BADGE_CLASS = 'mem3-line-avg-badge';
    const POPUP_CLASS = 'mem3-popup-uph';
    const FLOOR_SUMMARY_ID = 'mem3-floor-summary';
    const DATE_DEBUG_ID = 'mem3-uph-date-debug';
    const CORNER_DEBUG_ID = 'mem3-corner-debug';
    const PHOTO_DEBUG_ID = 'mem3-corner-photo-debug';

    const DEBUG = {
        startedAt: new Date().toISOString(),
        lastRunError: null,
        lastStatus: null,
        rollupSize: null,
        rollupFunctions: null,
        rollupParse: null,
        perLine: {},
        sampleMatched: [],
        logs: []
    };
    const MAX_DEBUG_LOGS = 60;

    function pushDebug(level, args) {
        const msg = [].slice.call(args).map(function (a) {
            if (a instanceof Error) return a.message;
            if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch (e) { return String(a); }
            }
            return String(a);
        }).join(' ');
        DEBUG.logs.push({ t: new Date().toISOString(), level: level, msg: msg });
        if (DEBUG.logs.length > MAX_DEBUG_LOGS) DEBUG.logs.shift();
    }

    const log = function () { pushDebug('log', arguments); console.log.apply(console, ['[MEM3-UPH]'].concat([].slice.call(arguments))); };
    const warn = function () { pushDebug('warn', arguments); console.warn.apply(console, ['[MEM3-UPH]'].concat([].slice.call(arguments))); };

    function normalizeName(s) {
        return (s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',');
    }

    function isLogin(text) {
        return /^[a-z][a-z0-9._-]{2,31}$/i.test(text) && text.indexOf(',') === -1;
    }

    /* ---------------------------------------------------------------
       Identity: Control Tower's own employee roster API.
       Records look like:
         { login, name: "Last,First", id: <FCLM employee id>, badge, jobTitle }
       Manager fields exist on the same record, so only exact key names
       are accepted - "name" yes, "managerName" never.
       --------------------------------------------------------------- */
    // Null-prototype maps so a login like "constructor" cannot match Object.prototype.
    const IDENTITY = {
        byLogin: Object.create(null),
        byName: Object.create(null),
        byId: Object.create(null),
        byBadge: Object.create(null),
        count: 0
    };

    const KEY_LOGIN = /^(login|alias|username|user)$/i;
    const KEY_NAME = /^(name|fullname|full_name|employeename|employee_name|associatename)$/i;
    const KEY_ID = /^(id|employeeid|employee_id|empid|associateid|personid)$/i;
    const KEY_BADGE = /^(badge|badgeid|badge_id|badgenumber)$/i;
    const KEY_TITLE = /^(jobtitle|job_title|title|jobrole)$/i;
    const PERSON_NAME_RE = /^[A-Za-z][A-Za-z'`. -]*,\s*[A-Za-z][A-Za-z'`. -]*$/;

    function storeIdentity(rec) {
        if (!rec.login) return;
        const existing = IDENTITY.byLogin[rec.login];
        if (!existing) IDENTITY.count++;
        const merged = existing || { login: rec.login, name: null, id: null, badge: null, jobTitle: null, idCandidates: [] };
        if (rec.name) merged.name = rec.name;
        if (rec.badge) merged.badge = rec.badge;
        if (rec.jobTitle) merged.jobTitle = rec.jobTitle;
        if (rec.id) {
            if (merged.idCandidates.indexOf(rec.id) === -1) merged.idCandidates.push(rec.id);
            if (!merged.id) merged.id = rec.id;
            IDENTITY.byId[rec.id] = merged;
        }
        IDENTITY.byLogin[rec.login] = merged;
        if (merged.name) IDENTITY.byName[normalizeName(merged.name)] = merged;
        if (merged.badge) IDENTITY.byBadge[merged.badge] = merged;
    }

    // Different payloads can carry different numeric ids for the same person;
    // the one FCLM actually reports rates for wins.
    function resolveEmpId(person) {
        if (!person) return null;
        const list = person.idCandidates || [];
        for (let i = 0; i < list.length; i++) {
            if (LAST_ROLLUP[list[i]]) return list[i];
        }
        return person.id || null;
    }

    function harvestJson(data) {
        // The roster payload is ~750 KB and holds every badge at the site, so the
        // walk has to cover all of it or logins go missing and rows stay unmatched.
        let budget = 1000000;
        const stack = [data];
        while (stack.length && budget > 0) {
            const node = stack.pop();
            budget--;
            if (!node || typeof node !== 'object') continue;
            if (Array.isArray(node)) {
                for (let i = 0; i < node.length; i++) stack.push(node[i]);
                continue;
            }
            let keys;
            try { keys = Object.keys(node); } catch (e) { continue; }

            const rec = { login: null, name: null, id: null, badge: null, jobTitle: null };
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                const v = node[k];
                if (v && typeof v === 'object') { stack.push(v); continue; }
                if (v === null || v === undefined) continue;
                const s = String(v).trim();
                if (!s || s.length > 60) continue;
                if (KEY_LOGIN.test(k) && isLogin(s)) rec.login = s.toLowerCase();
                else if (KEY_NAME.test(k) && PERSON_NAME_RE.test(s)) rec.name = s;
                else if (KEY_ID.test(k) && /^\d{5,12}$/.test(s)) rec.id = s;
                else if (KEY_BADGE.test(k) && /^\d{5,12}$/.test(s)) rec.badge = s;
                else if (KEY_TITLE.test(k)) rec.jobTitle = s;
            }
            if (rec.login && (rec.name || rec.id)) storeIdentity(rec);
        }
    }

    const CAPTURED_REQUESTS = {};
    const IDENTITY_ENDPOINTS = /get_employee_roster|read_assignments/i;

    function captureRequest(url, method, body) {
        if (!url || !IDENTITY_ENDPOINTS.test(String(url))) return;
        const key = String(url).split('?')[0];
        if (CAPTURED_REQUESTS[key]) return;
        CAPTURED_REQUESTS[key] = {
            url: String(url),
            method: (method || 'GET').toUpperCase(),
            body: (typeof body === 'string') ? body.slice(0, 4000) : null
        };
    }

    function installNetworkSniffer() {
        try {
            const origFetch = window.fetch;
            if (typeof origFetch === 'function' && !origFetch.mem3Patched) {
                const patched = function (input, init) {
                    const promise = origFetch.apply(this, arguments);
                    try {
                        const url = (typeof input === 'string') ? input : (input && input.url) || '';
                        const method = (init && init.method) || (input && input.method) || 'GET';
                        const body = (init && typeof init.body === 'string') ? init.body : null;
                        captureRequest(url, method, body);
                        promise.then(function (res) {
                            const ct = (res.headers && res.headers.get) ? res.headers.get('content-type') : '';
                            if (ct && ct.indexOf('json') !== -1) {
                                res.clone().json().then(harvestJson).catch(function () {});
                            }
                        }).catch(function () {});
                    } catch (e) { /* ignore */ }
                    return promise;
                };
                patched.mem3Patched = true;
                window.fetch = patched;
            }
        } catch (e) { /* ignore */ }

        try {
            const proto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
            if (proto && !proto.mem3Patched) {
                const origOpen = proto.open;
                const origSend = proto.send;
                proto.open = function (method, url) {
                    this.mem3Url = url;
                    this.mem3Method = method;
                    return origOpen.apply(this, arguments);
                };
                proto.send = function (body) {
                    const xhr = this;
                    try { captureRequest(xhr.mem3Url, xhr.mem3Method, (typeof body === 'string') ? body : null); } catch (e) { /* ignore */ }
                    xhr.addEventListener('load', function () {
                        try {
                            const type = xhr.responseType;
                            if (type !== '' && type !== 'text' && type !== 'json') return;
                            const payload = (type === 'json') ? xhr.response : xhr.responseText;
                            if (!payload) return;
                            harvestJson(typeof payload === 'string' ? JSON.parse(payload) : payload);
                        } catch (e) { /* not json */ }
                    });
                    return origSend.apply(this, arguments);
                };
                proto.mem3Patched = true;
            }
        } catch (e) { /* ignore */ }
    }

    let identityLoaded = false;

    async function loadIdentities() {
        identityLoaded = true;
        const requests = [];
        const keys = Object.keys(CAPTURED_REQUESTS);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('get_employee_roster') !== -1) requests.push(CAPTURED_REQUESTS[keys[i]]);
        }
        if (!requests.length) {
            requests.push({ url: '/api/v1/get_employee_roster', method: 'POST', body: JSON.stringify({ whid: WAREHOUSE }) });
        }

        for (let i = 0; i < requests.length; i++) {
            const req = requests[i];
            try {
                const init = { method: req.method, credentials: 'include' };
                if (req.method !== 'GET' && req.body) {
                    init.body = req.body;
                    init.headers = { 'Content-Type': 'application/json' };
                }
                const res = await fetch(req.url, init);
                const text = await res.text();
                let parsed = null;
                try { parsed = JSON.parse(text); } catch (e) { /* not json */ }
                if (parsed) harvestJson(parsed);
            } catch (e) {
                warn('identity request failed:', e);
            }
        }
        log('identities loaded: ' + IDENTITY.count);
    }

    /* ---------------------------------------------------------------
       FCLM rollup - the UPH source.
       --------------------------------------------------------------- */
    function shiftAnchor(now) {
        const start = new Date(now);
        const hour = now.getHours();
        let shift = 'Day';
        if (hour >= NIGHT_SHIFT_HOUR) {
            shift = 'Night';
            start.setHours(NIGHT_SHIFT_HOUR, 0, 0, 0);
        } else if (hour >= DAY_SHIFT_HOUR) {
            start.setHours(DAY_SHIFT_HOUR, 0, 0, 0);
        } else {
            shift = 'Night';
            start.setDate(start.getDate() - 1);
            start.setHours(NIGHT_SHIFT_HOUR, 0, 0, 0);
        }
        start.setMinutes(0, 0, 0);
        return { start: start, shift: shift };
    }

    function windowPreset(id) {
        for (let i = 0; i < WINDOW_PRESETS.length; i++) {
            if (WINDOW_PRESETS[i].id === id) return WINDOW_PRESETS[i];
        }
        return WINDOW_PRESETS[0];
    }

    function windowBounds(id, now) {
        const anchor = shiftAnchor(now || new Date());
        const preset = windowPreset(id);
        const start = new Date(anchor.start.getTime() + preset.startMin * 60000);
        const liveEnd = new Date((now || new Date()).getTime() + 5 * 60 * 1000);
        let end = liveEnd;
        if (preset.endMin !== null) {
            end = new Date(anchor.start.getTime() + preset.endMin * 60000);
            end.setSeconds(preset.endMin % 60 === 59 ? 59 : 0, 0);
            if (preset.id !== 'all' && end > liveEnd) end = liveEnd;
        }
        if (end < start) end = new Date(start.getTime());
        return { start: start, end: end, shift: anchor.shift, id: preset.id, label: preset.label, live: false };
    }

    function shortClock(d) {
        let h = d.getHours();
        const min = d.getMinutes();
        h = h % 12 || 12;
        return h + ':' + (min < 10 ? '0' + min : String(min));
    }

    function getShiftWindow(windowId) {
        const now = new Date();
        const bounds = windowBounds(windowId || ACTIVE_WINDOW, now);
        const start = bounds.start;
        const end = bounds.end;
        const pad = function (n) { return String(n).padStart(2, '0'); };
        const fmt = function (d) {
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.000';
        };
        return {
            start: fmt(start), end: fmt(end), shift: bounds.shift,
            window: bounds.id, label: bounds.label
        };
    }

    function getShiftWindowForLink(windowId) {
        const w = getShiftWindow(windowId);
        const tzMin = -new Date().getTimezoneOffset();
        const sign = tzMin >= 0 ? '+' : '-';
        const absMin = Math.abs(tzMin);
        const pad = function (n) { return String(n).padStart(2, '0'); };
        const tz = sign + pad(Math.floor(absMin / 60)) + pad(absMin % 60);
        return {
            startLink: w.start.replace('.000', '') + tz,
            endLink: w.end.replace('.000', '') + tz
        };
    }

    let FCLM_DOWN = false;

    function gmDetail(r) {
        if (!r) return {};
        return {
            status: r.status || 0,
            finalUrl: r.finalUrl || '',
            error: r.error ? String(r.error) : '',
            length: r.responseText ? String(r.responseText).length : 0
        };
    }

    function gmFetch(url) {
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 60000,
                anonymous: false,
                onload: function (r) {
                    DEBUG.lastGm = { url: url, ok: true, detail: gmDetail(r) };
                    if (r.status >= 200 && r.status < 400) {
                        if (String(url).indexOf('fclm-portal.amazon.com') !== -1) FCLM_DOWN = false;
                        resolve(r.responseText);
                    } else reject(new Error('HTTP ' + r.status + (r.finalUrl ? (' · ' + r.finalUrl) : '')));
                },
                onerror: function (r) {
                    const detail = gmDetail(r);
                    const msg = 'Network error' + (detail.status ? (' HTTP ' + detail.status) : '') +
                        (detail.finalUrl ? (' · ' + detail.finalUrl) : '') +
                        (detail.error ? (' · ' + detail.error) : '');
                    DEBUG.lastGm = { url: url, ok: false, error: msg, detail: detail };
                    if (String(url).indexOf('fclm-portal.amazon.com') !== -1) FCLM_DOWN = true;
                    reject(new Error(msg));
                },
                ontimeout: function (r) {
                    DEBUG.lastGm = { url: url, ok: false, error: 'Timeout', detail: gmDetail(r) };
                    reject(new Error('Timeout'));
                }
            });
        });
    }

    function parseTableRows(html) {
        const rows = [];
        const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
        const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
        const decoder = document.createElement('div');
        let m;
        while ((m = trRe.exec(html)) !== null) {
            const cells = [];
            let cm;
            cellRe.lastIndex = 0;
            while ((cm = cellRe.exec(m[1])) !== null) {
                decoder.innerHTML = cm[1].replace(/<[^>]+>/g, '');
                cells.push((decoder.textContent || '').replace(/\s+/g, ' ').trim());
            }
            if (cells.length > 0) rows.push(cells);
        }
        return rows;
    }

    // Keep every function section, not just grading and bypass - people who only
    // show up under another function (decant, problem solve) still have a rate.
    const EMP_TYPES = { AMZN: true, TEMP: true, '3PTY': true };
    const NON_FUNCTION_ROW = /^(employee|total|type|name|login|shift|department|process)\b/i;
    // Functions are split into size classes; those sub-headers must not be
    // mistaken for the function itself or grading and bypass get merged.
    const SIZE_ROW = /^(small|medium|large|x-?large|xl|oversize[d]?|sortable|non-?sortable|heavy|bulky|misc|other)$/i;

    function addFunctionSample(entry, key, units, uph) {
        let slot = entry.functions[key];
        if (!slot) { slot = { units: 0, hours: 0, uph: 0 }; entry.functions[key] = slot; }
        slot.units += units;
        if (units > 0 && uph > 0) slot.hours += units / uph;
        if (slot.hours > 0) slot.uph = slot.units / slot.hours;
        return slot;
    }

    function textOf(el) {
        return ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
    }

    function parseNumber(text) {
        const n = parseFloat(String(text || '').replace(/,/g, ''));
        return isFinite(n) ? n : null;
    }

    function columnHeaders(table) {
        const headRows = table.querySelectorAll('thead tr');
        const width = 48;
        const grid = [];
        for (let r = 0; r < headRows.length; r++) {
            grid[r] = [];
            for (let c = 0; c < width; c++) grid[r][c] = null;
        }
        for (let r = 0; r < headRows.length; r++) {
            let c = 0;
            const cells = headRows[r].children;
            for (let i = 0; i < cells.length; i++) {
                while (c < width && grid[r][c] !== null) c++;
                const colspan = parseInt(cells[i].getAttribute('colspan') || '1', 10) || 1;
                const rowspan = parseInt(cells[i].getAttribute('rowspan') || '1', 10) || 1;
                const label = textOf(cells[i]);
                for (let dc = 0; dc < colspan && c + dc < width; dc++) {
                    for (let dr = 0; dr < rowspan && r + dr < headRows.length; dr++) {
                        grid[r + dr][c + dc] = label;
                    }
                }
                c += colspan;
            }
        }
        const headers = [];
        for (let c = 0; c < width; c++) {
            const parts = [];
            for (let r = 0; r < grid.length; r++) {
                const label = grid[r][c];
                if (label && parts.indexOf(label) === -1) parts.push(label);
            }
            if (parts.length) headers.push({ index: c, header: parts.join(' / ') });
        }
        return headers;
    }

    // BIGs uses Medium and Large EACH. Hours for a size are its units divided by
    // that size's UPH. The rate is both sizes' units divided by both sizes' hours.
    // Customer Returns uses the overall rate: total units divided by paid hours.
    function blendMediumLarge(mediumUnits, mediumUph, largeUnits, largeUph) {
        let units = 0;
        let hours = 0;
        function add(count, rate) {
            if (!(count > 0) || !(rate > 0)) return;
            units += count;
            hours += count / rate;
        }
        add(mediumUnits, mediumUph);
        add(largeUnits, largeUph);
        return {
            units: units,
            hours: hours,
            uph: hours > 0 ? (units / hours) : 0
        };
    }

    function columnSpan(cell) {
        return parseInt((cell && cell.getAttribute && cell.getAttribute('colspan')) || '1', 10) || 1;
    }

    function rowWidth(row) {
        let n = 0;
        const cells = row.children;
        for (let i = 0; i < cells.length; i++) n += columnSpan(cells[i]);
        return n;
    }

    function headerWidth(headers) {
        let n = 0;
        for (let i = 0; i < headers.length; i++) n = Math.max(n, headers[i].index + 1);
        return n;
    }

    // Empty EACH-Small cells are often left out of the row. The header still
    // has those columns, so a raw index reads Large as Medium and Heavy as Large.
    function shipmentStart(headers) {
        for (let i = 0; i < headers.length; i++) {
            const h = headers[i].header.toLowerCase();
            if ((/each-/.test(h) || h.indexOf('shipmentreturned') !== -1) && /\b(unit|uph)\b/.test(h)) {
                return headers[i].index;
            }
        }
        return headerWidth(headers);
    }

    function bodyColumn(headers, row, headerIndex) {
        const deficit = Math.max(0, headerWidth(headers) - rowWidth(row));
        const start = shipmentStart(headers);
        return headerIndex >= start ? headerIndex - deficit : headerIndex;
    }

    function cellAt(row, col) {
        if (col < 0) return null;
        const cells = row.children;
        let at = 0;
        for (let i = 0; i < cells.length; i++) {
            const span = columnSpan(cells[i]);
            if (col >= at && col < at + span) return cells[i];
            at += span;
        }
        return null;
    }

    function columnValue(row, headers, matcher) {
        for (let i = 0; i < headers.length; i++) {
            const h = headers[i].header.toLowerCase();
            if (!matcher(h)) continue;
            const cell = cellAt(row, bodyColumn(headers, row, headers[i].index));
            if (!cell) continue;
            const n = parseNumber(textOf(cell));
            if (n === null) continue;
            return { value: n, header: headers[i].header };
        }
        return { value: null, header: '' };
    }

    function eachSizeHeader(header, size) {
        if (header.indexOf('paid hour') !== -1) return false;
        if (/heavy/.test(header)) return false;
        if (size === 'medium') return /each-medium|\bmedium\b/.test(header);
        return /each-large|\blarge\b/.test(header) && !/x-?\s*large/.test(header);
    }

    function sizeFromClass(className) {
        const c = String(className || '').toLowerCase();
        if (!c || /heavy/.test(c)) return '';
        if (/each-medium|size-medium/.test(c)) return 'medium';
        if ((/each-large|size-large/.test(c)) && !/x-large|xlarge/.test(c)) return 'large';
        return '';
    }

    function sizeFromHeader(header) {
        const h = String(header || '').toLowerCase();
        if (!h || /heavy/.test(h) || /x-?\s*large/.test(h)) return '';
        if (/each-medium|\bmedium\b/.test(h)) return 'medium';
        if (/each-large|\blarge\b/.test(h)) return 'large';
        return '';
    }

    function headerAt(headers, index) {
        for (let i = 0; i < (headers || []).length; i++) {
            if (headers[i].index === index) return headers[i].header;
        }
        return '';
    }

    // A short row drops empty size cells, so the body column sits left of the header.
    function headerIndexForBody(headers, row, bodyCol) {
        const deficit = Math.max(0, headerWidth(headers) - rowWidth(row));
        const start = shipmentStart(headers);
        return bodyCol >= start ? bodyCol + deficit : bodyCol;
    }

    // Paid hours, UNIT, UPH, and JPH often share one size class. The rate is UNIT and UPH.
    function metricKind(className, header) {
        const blob = (String(className || '') + ' ' + String(header || '')).toLowerCase();
        if (/\bjph\b/.test(blob)) return 'jph';
        if (/\buph\b/.test(blob)) return 'uph';
        if (/\bunits?\b/.test(blob)) return 'units';
        if (/paid hour|\bhours\b/.test(blob)) return 'hours';
        return '';
    }

    function sizePair(row, headers, size) {
        const picked = { units: null, uph: null, unitHeader: '', uphHeader: '' };
        const bare = [];
        const cells = row.children || [];
        let col = 0;
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const header = headerAt(headers, headerIndexForBody(headers, row, col));
            const sizeName = sizeFromClass(cell.className) || sizeFromHeader(header);
            if (sizeName === size) {
                const n = parseNumber(textOf(cell));
                const kind = metricKind(cell.className, header);
                if (n !== null) {
                    if (kind === 'units' && picked.units === null) {
                        picked.units = n;
                        picked.unitHeader = header;
                    } else if (kind === 'uph' && picked.uph === null) {
                        picked.uph = n;
                        picked.uphHeader = header;
                    } else if (kind !== 'hours' && kind !== 'jph') bare.push(n);
                }
            }
            col += columnSpan(cell);
        }
        if (picked.units === null) {
            const hit = columnValue(row, headers, function (h) {
                return eachSizeHeader(h, size) && /\bunits?\b/.test(h);
            });
            if (hit.value !== null) {
                picked.units = hit.value;
                picked.unitHeader = hit.header;
            }
        }
        if (picked.uph === null) {
            const hit = columnValue(row, headers, function (h) {
                return eachSizeHeader(h, size) && /\buph\b/.test(h);
            });
            if (hit.value !== null) {
                picked.uph = hit.value;
                picked.uphHeader = hit.header;
            }
        }
        // Unlabeled cells stay in the old order: paid hours, then UNIT, then UPH.
        // A fourth number is JPH and is not the rate.
        if (picked.units === null || picked.uph === null) {
            const list = bare.length >= 4 ? bare.slice(1, 3) : bare;
            if (list.length >= 2) {
                if (picked.units === null) {
                    picked.units = list[list.length - 2];
                    picked.unitHeader = size + ' class';
                }
                if (picked.uph === null) {
                    picked.uph = list[list.length - 1];
                    picked.uphHeader = size + ' class';
                }
            }
        }
        return {
            units: picked.units || 0,
            uph: picked.uph || 0,
            unitHeader: picked.unitHeader,
            uphHeader: picked.uphHeader
        };
    }

    function bestNumber(row, headers, matcher) {
        let best = null;
        let bestHeader = '';
        let bestScore = -100;
        for (let i = 0; i < headers.length; i++) {
            const h = headers[i].header.toLowerCase();
            if (!matcher(h)) continue;
            const cell = cellAt(row, bodyColumn(headers, row, headers[i].index));
            if (!cell) continue;
            const n = parseNumber(textOf(cell));
            if (n === null) continue;
            const blob = ((cell.className || '') + ' ' + h).toLowerCase();
            const flat = blob.replace(/[^a-z0-9]+/g, '');
            let score = 0;
            if (flat.indexOf('shipmentreturned') !== -1) score += 10;
            if (flat.indexOf('problemsolve') !== -1) score -= 10;
            if (/size-total|each-total|\/ total\b/.test(blob)) score += 5;
            else if (/size-small|size-medium|size-large|size-heavy|each-small|each-medium|each-large|each-heavy|\bsmall\b|\bmedium\b|\blarge\b|\bheavy/.test(blob)) score -= 5;
            if (score > bestScore) { bestScore = score; best = n; bestHeader = headers[i].header; }
        }
        return { value: best, header: bestHeader };
    }

    function overallRate(row, headers) {
        const unitsPick = bestNumber(row, headers, function (h) { return /\bunits?\b/.test(h); });
        let uphPick = bestNumber(row, headers, function (h) { return /\buph\b/.test(h); });
        if (uphPick.value === null) uphPick = bestNumber(row, headers, function (h) { return /\bjph\b/.test(h); });
        const hoursPick = bestNumber(row, headers, function (h) { return /paid hours/.test(h); });
        const units = unitsPick.value || 0;
        const paidHours = hoursPick.value || 0;
        let uph = uphPick.value;
        if (units > 0 && paidHours > 0) uph = units / paidHours;
        else if (uph === null) uph = 0;
        return {
            units: units,
            hours: paidHours,
            uph: uph || 0,
            unitHeader: unitsPick.header,
            uphHeader: (units > 0 && paidHours > 0) ? 'units / paid hours' : uphPick.header,
            hoursHeader: hoursPick.header
        };
    }

    function bestText(row, headers, matcher) {
        for (let i = 0; i < headers.length; i++) {
            if (!matcher(headers[i].header.toLowerCase())) continue;
            const cell = cellAt(row, bodyColumn(headers, row, headers[i].index));
            if (cell) return textOf(cell);
        }
        return '';
    }

    function parseFunctionRollup(html, proc, fnCounts, parseInfo) {
        const info = parseInfo || {};
        const byEmpId = {};
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const wantedId = 'function-' + PRIMARY_GRADING.id;
        const tables = doc.querySelectorAll('table[id^="function-"]');
        info.functionTables = [];
        let table = doc.getElementById(wantedId);
        for (let i = 0; i < tables.length && info.functionTables.length < 8; i++) {
            info.functionTables.push({
                id: tables[i].id,
                rows: tables[i].querySelectorAll('tbody tr').length,
                caption: textOf(tables[i].querySelector('caption')).slice(0, 80)
            });
            if (!table && tables[i].id.indexOf(PRIMARY_GRADING.id) !== -1) table = tables[i];
        }
        info.tableId = table ? table.id : null;
        info.tableFound = !!table;
        info.employeeRows = 0;
        info.keptRows = 0;
        info.skippedRows = 0;
        if (!table) return byEmpId;

        const headers = columnHeaders(table);
        info.headers = headers.map(function (h) { return h.header; }).slice(0, 24);
        const pending = Object.create(null);
        const bodyRows = table.querySelectorAll('tbody tr').length
            ? table.querySelectorAll('tbody tr')
            : table.querySelectorAll('tr');
        for (let i = 0; i < bodyRows.length; i++) {
            const row = bodyRows[i];
            const first = textOf(row.children[0]);
            if (!EMP_TYPES[first]) continue;
            info.employeeRows++;
            const empId = bestText(row, headers, function (h) { return /(^|\/ )id$/.test(h) || /employee id/.test(h); })
                || textOf(row.children[1]);
            if (!/^\d+$/.test(empId)) { info.skippedRows++; continue; }
            const overall = overallRate(row, headers);
            const medium = sizePair(row, headers, 'medium');
            const large = sizePair(row, headers, 'large');
            const blended = blendMediumLarge(medium.units, medium.uph, large.units, large.uph);
            if (!(overall.units > 0) && !(overall.uph > 0) && !(blended.units > 0)) {
                info.skippedRows++;
                continue;
            }
            if (!pending[empId]) pending[empId] = { name: textOf(row.children[2]), rows: [] };
            pending[empId].rows.push({
                units: overall.units,
                uph: overall.uph,
                hours: overall.hours,
                bigsUnits: blended.units,
                bigsUph: blended.uph,
                bigsHours: blended.hours,
                mediumUnits: medium.units,
                mediumUph: medium.uph,
                largeUnits: large.units,
                largeUph: large.uph,
                job: 'ShipmentReturned',
                unitHeader: overall.unitHeader,
                uphHeader: overall.uphHeader,
                hoursHeader: overall.hoursHeader
            });
        }

        const ids = Object.keys(pending);
        for (let i = 0; i < ids.length; i++) {
            const empId = ids[i];
            const rows = pending[empId].rows;
            function rowUnits(row) {
                return Math.max(row.units || 0, row.bigsUnits || 0);
            }
            let chosen = null;
            for (let r = 0; r < rows.length; r++) {
                if (!/shipment\s*returned/i.test(rows[r].job || '')) continue;
                if (!chosen || rowUnits(rows[r]) > rowUnits(chosen)) chosen = rows[r];
            }
            if (!chosen) {
                for (let r = 0; r < rows.length; r++) {
                    if (!chosen || rowUnits(rows[r]) > rowUnits(chosen)) chosen = rows[r];
                }
            }
            if (!chosen) { info.skippedRows++; continue; }
            byEmpId[empId] = { name: pending[empId].name, functions: {} };
            byEmpId[empId].functions[PRIMARY_GRADING.name] = {
                units: chosen.units,
                hours: chosen.hours > 0 ? chosen.hours : (chosen.uph > 0 ? chosen.units / chosen.uph : 0),
                uph: chosen.uph,
                bigsUnits: chosen.bigsUnits || 0,
                bigsHours: chosen.bigsHours > 0 ? chosen.bigsHours : (chosen.bigsUph > 0 ? chosen.bigsUnits / chosen.bigsUph : 0),
                bigsUph: chosen.bigsUph || 0,
                mediumUnits: chosen.mediumUnits || 0,
                mediumUph: chosen.mediumUph || 0,
                largeUnits: chosen.largeUnits || 0,
                largeUph: chosen.largeUph || 0
            };
            info.keptRows++;
            if (!info.sample) {
                info.sample = {
                    empId: empId,
                    name: pending[empId].name,
                    units: chosen.units,
                    hours: chosen.hours,
                    uph: chosen.uph,
                    unitHeader: chosen.unitHeader,
                    uphHeader: chosen.uphHeader,
                    hoursHeader: chosen.hoursHeader
                };
            }
            if (fnCounts) fnCounts[PRIMARY_GRADING.name] = (fnCounts[PRIMARY_GRADING.name] || 0) + 1;
        }
        return byEmpId;
    }

    function mergeRollup(target, src) {
        const ids = Object.keys(src);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            if (!target[id]) { target[id] = src[id]; continue; }
            const fns = src[id].functions;
            const keys = Object.keys(fns);
            for (let k = 0; k < keys.length; k++) {
                const slot = fns[keys[k]];
                const merged = addFunctionSample(target[id], keys[k], slot.units, slot.uph);
                if (slot.bigsUnits > 0 && slot.bigsUph > 0) {
                    merged.bigsUnits = (merged.bigsUnits || 0) + slot.bigsUnits;
                    merged.bigsHours = (merged.bigsHours || 0) + (slot.bigsHours > 0 ? slot.bigsHours : (slot.bigsUnits / slot.bigsUph));
                    merged.bigsUph = merged.bigsHours > 0 ? (merged.bigsUnits / merged.bigsHours) : 0;
                }
            }
        }
    }

    function rollupUrl(processId, w) {
        return 'https://fclm-portal.amazon.com/reports/functionRollup?warehouseId=' + WAREHOUSE +
            '&spanType=Day&startDate=' + encodeURIComponent(w.start) +
            '&endDate=' + encodeURIComponent(w.end) +
            '&reportFormat=HTML&processId=' + processId +
            '&functionId=' + PRIMARY_GRADING.id;
    }

    async function getRollup() {
        const w = getShiftWindow();
        const merged = {};
        const fnCounts = {};

        let anyFetchOk = false;
        const parseInfo = {
            url: rollupUrl(ROLLUP_PROCESSES[0].id, w),
            containsFunctionId: false,
            tableRows: 0,
            headers: [],
            employeeRows: 0,
            keptRows: 0,
            skippedRows: 0,
            error: null
        };
        const results = await Promise.all(ROLLUP_PROCESSES.map(async function (proc) {
            const url = rollupUrl(proc.id, w);
            parseInfo.url = url;
            try {
                const html = await gmFetch(url);
                anyFetchOk = true;
                parseInfo.containsFunctionId = html.indexOf(PRIMARY_GRADING.id) !== -1;
                parseInfo.htmlLength = html.length;
                return parseFunctionRollup(html, proc, fnCounts, parseInfo);
            } catch (e) {
                parseInfo.error = e.message;
                warn('rollup failed for ' + proc.label + ':', e);
                return {};
            }
        }));
        if (!anyFetchOk) throw new Error('FCLM rollup unreachable');
        for (let i = 0; i < results.length; i++) mergeRollup(merged, results[i]);

        DEBUG.rollupSize = Object.keys(merged).length;
        DEBUG.rollupFunctions = fnCounts;
        DEBUG.rollupParse = parseInfo;
        log('rollup parsed: ' + DEBUG.rollupSize + ' associates for ' +
            PRIMARY_GRADING.name + ' [' + PRIMARY_GRADING.id + ']');
        return merged;
    }

    let LAST_ROLLUP = {};
    let LAST_ROLLUP_AT = null;

    function gradingLabel() {
        return PRIMARY_GRADING.name + ' [' + PRIMARY_GRADING.id + ']';
    }

    function personUsesBigsRate(empId) {
        const line = (BOARD_PEOPLE[empId] && BOARD_PEOPLE[empId].line) || '';
        return line === 'BIGS';
    }

    function statsFor(empId, forBigs) {
        const entry = empId ? LAST_ROLLUP[empId] : null;
        const empty = { uph: 0, units: 0, hasData: false, fn: gradingLabel() };
        if (!entry) return empty;
        const slot = entry.functions && entry.functions[PRIMARY_GRADING.name];
        if (!slot) return empty;
        const bigs = forBigs === true || (forBigs !== false && personUsesBigsRate(empId));
        const units = bigs ? (slot.bigsUnits || 0) : (slot.units || 0);
        const uph = bigs ? (slot.bigsUph || 0) : (slot.uph || 0);
        if (!(units > 0) && !(uph > 0)) return empty;
        return {
            uph: uph,
            units: units,
            hasData: true,
            fn: gradingLabel()
        };
    }

    function fclmEmpUrl(empId, windowId) {
        const w = getShiftWindowForLink(windowId);
        return 'https://fclm-portal.amazon.com/employee/timeDetails?employeeId=' + empId +
            '&warehouseId=' + WAREHOUSE +
            '&startTime=' + encodeURIComponent(w.startLink) +
            '&endTime=' + encodeURIComponent(w.endLink);
    }

    function timeDetailsLink(empId) {
        const link = document.createElement('a');
        link.href = fclmEmpUrl(empId);
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Open FCLM Time Details';
        link.style.cssText = 'display:inline-block; margin-top:6px; font-size:12px; color:#58a6ff; text-decoration:underline;';
        link.addEventListener('click', function (e) { e.stopPropagation(); });
        return link;
    }

    function shiftDetailsLink(empId) {
        const link = document.createElement('a');
        link.href = fclmEmpUrl(empId, 'all');
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Open FCLM details';
        link.setAttribute('data-mem3-shift-details', '1');
        link.style.cssText = 'display:block; width:max-content; margin-top:6px; font-size:12px; color:#58a6ff; text-decoration:underline;';
        link.addEventListener('click', function (e) { e.stopPropagation(); });
        return link;
    }

    // Clock rows are total work time. Idle is indirect time plus Time Off Task.
    let LAST_TIME = Object.create(null);
    const TIME_IN_FLIGHT = Object.create(null);
    const TIME_TRIES = Object.create(null);
    const TIME_ISSUES = Object.create(null);
    const BOARD_PEOPLE = Object.create(null);
    const MAX_TIME_TRIES = 1;
    let TIME_LOADING = false;
    let SUPPRESS_ENSURE = false;
    let timeGeneration = 0;
    let refreshCycle = 0;
    let refreshGeneration = 0;
    let refreshBusy = false;
    let refreshDue = false;
    let refreshTimer = null;
    let refreshClockTimer = null;
    let nextRefreshAt = 0;
    let livePaintTimer = null;
    let BOARD_IDS = [];
    let BIGS_IDS = [];

    function parseDuration(text) {
        const parts = String(text || '').trim().split(':').map(function (p) { return Number(p); });
        if (!parts.length || parts.some(function (n) { return !isFinite(n); })) return 0;
        if (parts.length >= 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
        if (parts.length === 2) return parts[0] + parts[1] / 60;
        return 0;
    }

    function formatDuration(minutes) {
        const total = Math.max(0, Math.round(minutes || 0));
        const hours = Math.floor(total / 60);
        const mins = total % 60;
        if (hours > 0) return hours + 'h ' + mins + 'm';
        return mins + 'm';
    }

    function lastRightAlign(row) {
        const cells = row.querySelectorAll('td.rightAlign');
        return cells.length ? (cells[cells.length - 1].textContent || '').trim() : '';
    }

    function functionBucket(cls, title) {
        const c = String(cls || '').toLowerCase();
        if (c.indexOf('timeofftask') !== -1 || c.indexOf('time-off-task') !== -1) return 'tot';
        if (c.indexOf('indirect') !== -1) return 'indirect';
        if (String(title || '').indexOf('\u2666') !== -1) return 'direct';
        return 'other';
    }

    // The latest function row is the current stretch. Idle starts once that
    // stretch has been indirect or Time Off Task for 11 minutes. A diamond in
    // the title is still that stretch, so it counts the same way. Someone
    // whose latest punch is out is not idle.
    function isClockedOut(empId) {
        if (!empId) return false;
        return clockFor(personForEmp(empId), empId) === 'out';
    }

    function showsIdleNow(time, empId) {
        if (isClockedOut(empId)) return false;
        const fn = time && time.lastFunction;
        if (!fn) return false;
        if (fn.bucket !== 'indirect' && fn.bucket !== 'tot') return false;
        return (fn.minutes || 0) >= IDLE_START_MIN;
    }

    function idleNowSig(time, empId) {
        if (isClockedOut(empId)) return 'out';
        return showsIdleNow(time, empId) ? '1' : '0';
    }

    function idleNowTitle(time, empId) {
        if (isClockedOut(empId)) return 'Clocked out.';
        const fn = time && time.lastFunction;
        if (!fn) return '';
        const which = fn.title || fn.bucket;
        const lead = showsIdleNow(time, empId) ? 'Idle now. ' : 'Not idle yet. ';
        return lead + which + ' for ' + formatDuration(fn.minutes) + '. Idle starts at ' + IDLE_START_MIN + ' minutes.';
    }

    function parseTimeDetails(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        let totalMin = 0, idleMin = 0, paidMin = 0, offMin = 0, totMin = 0, activeMin = 0;
        const clocks = doc.querySelectorAll('tr.clock-seg');
        for (let i = 0; i < clocks.length; i++) {
            const minutes = parseDuration(lastRightAlign(clocks[i]));
            const cls = (clocks[i].getAttribute('class') || '').toLowerCase();
            totalMin += minutes;
            if (cls.indexOf('off-clock') !== -1 || cls.indexOf('un-paid') !== -1 || cls.indexOf('unpaid') !== -1) offMin += minutes;
            else if (cls.indexOf('on-clock') !== -1 || cls.indexOf('clockpaid') !== -1 || cls.indexOf('paid') !== -1) paidMin += minutes;
        }
        const fns = doc.querySelectorAll('tr.function-seg');
        let lastFunction = null;
        const segments = [];
        const scale = chartScale(doc, new Date());
        let rowSample = '';
        for (let i = 0; i < fns.length; i++) {
            const cls = (fns[i].getAttribute('class') || '').toLowerCase();
            const title = ((fns[i].querySelector('td') || {}).textContent || '').trim();
            const minutes = parseDuration(lastRightAlign(fns[i]));
            const bucket = functionBucket(cls, title);
            if (bucket === 'tot') { totMin += minutes; idleMin += minutes; }
            else if (bucket === 'indirect') idleMin += minutes;
            else if (bucket === 'direct') activeMin += minutes;
            lastFunction = { title: title.slice(0, 120), bucket: bucket, minutes: minutes };
            if (!rowSample && (bucket === 'indirect' || bucket === 'tot')) rowSample = sampleFunctionRow(fns[i]);
            segments.push(readFunctionSegment(fns[i], bucket, minutes, title, scale));
        }
        const titleEl = doc.querySelector('title');
        return {
            hasTime: clocks.length > 0,
            totalMin: totalMin,
            idleMin: idleMin,
            paidMin: paidMin,
            clockedMin: paidMin > 0 ? paidMin : totalMin,
            offMin: offMin,
            totMin: totMin,
            activeMin: activeMin,
            clockRows: clocks.length,
            functionRows: fns.length,
            htmlLength: html.length,
            sawClock: html.indexOf('clock-seg') !== -1,
            sawFunction: html.indexOf('function-seg') !== -1,
            pageTitle: titleEl ? (titleEl.textContent || '').trim().slice(0, 120) : '',
            error: null,
            noData: clocks.length === 0 && /time details/i.test(titleEl ? titleEl.textContent || '' : ''),
            lastFunction: lastFunction,
            segments: segments,
            rowSample: rowSample,
            currentlyIdle: showsIdleNow({ lastFunction: lastFunction })
        };
    }

    // Breaks are 9:00–9:15 and 2:30–2:45. The watched window is 10 minutes
    // before through 10 minutes after, 35 minutes. 15 minutes of idle is 42.8%.
    // 19.6 minutes is 56%, and that is an extended break. Days use AM then PM.
    // Nights use PM then AM. Idle here is indirect time plus Time Off Task.
    const BREAK_SPAN_MIN = 35;
    const BREAK_FLAG_MIN = 19.6;
    const BREAK_WINDOWS = {
        days: [
            { id: 'first', label: '8:50–9:25 AM', startMin: 8 * 60 + 50, endMin: 9 * 60 + 25 },
            { id: 'second', label: '2:20–2:55 PM', startMin: 14 * 60 + 20, endMin: 14 * 60 + 55 }
        ],
        nights: [
            { id: 'first', label: '8:50–9:25 PM', startMin: 20 * 60 + 50, endMin: 21 * 60 + 25 },
            { id: 'second', label: '2:20–2:55 AM', startMin: 2 * 60 + 20, endMin: 2 * 60 + 55 }
        ]
    };
    const ENGAGE_KEY = 'mem3-extended-v1';
    const ENGAGE_URL = 'https://extendsclass.com/api/json-storage/bin/eacddae';
    let engageChain = Promise.resolve();

    function parseClockMin(text) {
        const match = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?\s*m\.?/i.exec(String(text || ''));
        if (!match) return null;
        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        if (hour < 1 || hour > 12 || minute > 59) return null;
        const ap = match[3].toUpperCase();
        if (ap === 'P' && hour < 12) hour += 12;
        if (ap === 'A' && hour === 12) hour = 0;
        return hour * 60 + minute;
    }

    function parseClockRange(text) {
        const found = [];
        const re = /(\d{1,2}:\d{2}(?::\d{2})?\s*[ap]\.?\s*m\.?)/gi;
        const raw = String(text || '');
        let match;
        while ((match = re.exec(raw))) {
            found.push(match[1]);
            if (found.length === 2) break;
        }
        if (found.length < 2) return null;
        const start = parseClockMin(found[0]);
        let end = parseClockMin(found[1]);
        if (start == null || end == null) return null;
        if (end <= start) end += 1440;
        return { startMin: start, endMin: end };
    }

    // FCLM often prints 08:50-09:15 or 2:20-2:45 with no AM/PM. On days,
    // 6:00–11:59 stay in the morning and 1:00–5:59 are the afternoon. On
    // nights, 6:00–11:59 are the evening and 1:00–5:59 are after midnight.
    function clockFromParts(hour, minute, shiftName) {
        if (hour > 23 || minute > 59 || hour < 0 || minute < 0) return null;
        if (hour >= 13) return hour * 60 + minute;
        if (hour === 0) return minute;
        if (hour === 12) return (shiftName === 'nights' ? 0 : 12) * 60 + minute;
        if (shiftName === 'nights') {
            if (hour >= 6) return (hour + 12) * 60 + minute;
            return hour * 60 + minute;
        }
        if (hour >= 6) return hour * 60 + minute;
        return (hour + 12) * 60 + minute;
    }

    function parseIsoRange(text) {
        const found = [];
        const re = /\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/g;
        let match;
        while ((match = re.exec(String(text || '')))) {
            const hour = parseInt(match[1], 10);
            const minute = parseInt(match[2], 10);
            if (hour > 23 || minute > 59) continue;
            found.push(hour * 60 + minute);
            if (found.length === 2) break;
        }
        if (found.length < 2) return null;
        let end = found[1];
        if (end <= found[0]) end += 1440;
        return { startMin: found[0], endMin: end };
    }

    function parseLooseRange(text, shiftName) {
        const found = [];
        const re = /\b(\d{1,2}):(\d{2})(?::\d{2})?\b/g;
        let match;
        while ((match = re.exec(String(text || '')))) {
            const hour = parseInt(match[1], 10);
            const minute = parseInt(match[2], 10);
            if (hour > 23 || minute > 59) continue;
            found.push(clockFromParts(hour, minute, shiftName));
            if (found.length === 4) break;
        }
        for (let i = 0; i < found.length - 1; i++) {
            const start = found[i];
            let end = found[i + 1];
            if (start == null || end == null) continue;
            if (end <= start) end += 1440;
            const span = end - start;
            if (span >= 1 && span <= 360) return { startMin: start, endMin: end };
        }
        return null;
    }

    function rangeFromText(text, shiftName, minutes) {
        return parseClockRange(text) || parseIsoRange(text) || parseLooseRange(text, shiftName) || singleClockRange(text, shiftName, minutes);
    }

    function singleClockRange(text, shiftName, minutes) {
        if (!(minutes > 0)) return null;
        const am = parseClockMin(text);
        if (am != null && !parseClockRange(text)) return { startMin: am, endMin: am + minutes };
        const found = [];
        const re = /\b(\d{1,2}):(\d{2})\b/g;
        let match;
        while ((match = re.exec(String(text || '')))) {
            found.push({ hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) });
            if (found.length > 1) return null;
        }
        if (found.length !== 1 || found[0].hour === 0) return null;
        const start = clockFromParts(found[0].hour, found[0].minute, shiftName);
        if (start == null) return null;
        return { startMin: start, endMin: start + minutes };
    }

    function chartOriginMin(shiftName) {
        return shiftName === 'nights' ? 18 * 60 : 6 * 60;
    }

    function defaultBreakScale(date) {
        const shiftName = breakShiftName(date || new Date());
        return { shiftName: shiftName, originMin: chartOriginMin(shiftName), pxPerMin: 1 };
    }

    function pxProp(style, name) {
        const re = new RegExp('(?:^|;)\\s*' + name.replace('-', '\\-') + '\\s*:\\s*([\\d.]+)px', 'i');
        const match = re.exec(String(style || ''));
        return match ? parseFloat(match[1]) : null;
    }

    function rangeFromStyle(style, minutes, scale) {
        if (!style) return null;
        const leftPct = /(?:^|;)\s*left\s*:\s*([\d.]+)%/i.exec(style);
        const widthPct = /(?:^|;)\s*width\s*:\s*([\d.]+)%/i.exec(style);
        if (leftPct && widthPct) {
            const span = 12 * 60;
            const width = parseFloat(widthPct[1]);
            if (width >= 1 && width < 80) {
                const start = scale.originMin + (parseFloat(leftPct[1]) / 100) * span;
                const dur = (width / 100) * span;
                return { startMin: start, endMin: start + dur };
            }
        }
        if (!(minutes > 0)) return null;
        const margin = pxProp(style, 'margin-left');
        const leftPx = margin != null ? margin : pxProp(style, 'left');
        const widthPx = pxProp(style, 'width');
        if (leftPx == null || !(widthPx > 0) || widthPx >= 600) return null;
        const pxPerMin = widthPx / minutes;
        const expected = scale.pxPerMin || 1;
        if (pxPerMin < expected * 0.8 || pxPerMin > expected * 1.25) return null;
        const start = scale.originMin + leftPx / pxPerMin;
        return { startMin: start, endMin: start + minutes };
    }

    function rangeFromImages(row, minutes, scale) {
        if (!row || !row.querySelectorAll || !(minutes > 0)) return null;
        const imgs = row.querySelectorAll('img');
        if (!imgs || !imgs.length) return null;
        let offset = 0;
        const expected = scale.pxPerMin || 1;
        for (let i = 0; i < imgs.length; i++) {
            const width = parseFloat(imgs[i].getAttribute('width') || '');
            if (!(width > 0)) continue;
            const ratio = width / minutes;
            const height = parseFloat(imgs[i].getAttribute('height') || '');
            if (ratio >= expected * 0.8 && ratio <= expected * 1.25 && (height === 0 || height > 2 || imgs[i].getAttribute('title'))) {
                const start = scale.originMin + offset / ratio;
                return { startMin: start, endMin: start + minutes };
            }
            if (height > 0 && height <= 2 && width < 400) offset += width;
        }
        return null;
    }

    function parseHourTick(text, shiftName) {
        const match = /^(\d{1,2})(?::00)?\s*([ap])?\.?\s*m?\.?$/i.exec(String(text || '').trim());
        if (!match) return null;
        const hour = parseInt(match[1], 10);
        const minute = 0;
        if (match[2]) {
            const ap = match[2].toUpperCase();
            if (hour < 1 || hour > 12) return null;
            let h = hour;
            if (ap === 'P' && h < 12) h += 12;
            if (ap === 'A' && h === 12) h = 0;
            return h * 60 + minute;
        }
        return clockFromParts(hour, minute, shiftName);
    }

    function chartScale(doc, date) {
        const scale = defaultBreakScale(date);
        if (!doc || !doc.querySelectorAll) return scale;
        const nodes = doc.querySelectorAll('td, div, span, th');
        const marks = [];
        for (let i = 0; i < nodes.length && marks.length < 24; i++) {
            const text = String(nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
            if (!text || text.length > 8) continue;
            const min = parseHourTick(text, scale.shiftName);
            if (min == null) continue;
            const style = nodes[i].getAttribute && nodes[i].getAttribute('style');
            const left = style ? pxProp(style, 'left') : null;
            const margin = style ? pxProp(style, 'margin-left') : null;
            const px = margin != null ? margin : left;
            if (px == null) continue;
            marks.push({ min: min, px: px });
        }
        if (marks.length < 2) return scale;
        marks.sort(function (a, b) { return a.px - b.px; });
        for (let i = 1; i < marks.length; i++) {
            const dPx = marks[i].px - marks[0].px;
            let dMin = marks[i].min - marks[0].min;
            if (dMin <= 0) dMin += 1440;
            if (dPx < 1) continue;
            const pxPerMin = dPx / dMin;
            if (pxPerMin < 0.5 || pxPerMin > 4) continue;
            return {
                shiftName: scale.shiftName,
                originMin: marks[0].min - marks[0].px / pxPerMin,
                pxPerMin: pxPerMin
            };
        }
        return scale;
    }

    function sampleFunctionRow(row) {
        const bits = [];
        const cls = row && row.getAttribute && row.getAttribute('class');
        if (cls) bits.push('class=' + cls);
        const nodes = row && row.querySelectorAll ? row.querySelectorAll('*') : [];
        for (let i = 0; i < nodes.length && bits.length < 8; i++) {
            const el = nodes[i];
            if (!el || !el.getAttribute) continue;
            const tag = el.tagName || 'el';
            const title = el.getAttribute('title');
            const style = el.getAttribute('style');
            const width = el.getAttribute('width');
            if (title) bits.push(tag + ' title=' + String(title).slice(0, 140));
            if (style) bits.push(tag + ' style=' + String(style).slice(0, 160));
            if (width) bits.push(tag + ' width=' + width);
        }
        const text = String((row && row.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 160);
        if (text) bits.push('text=' + text);
        return bits.join(' | ').slice(0, 500);
    }

    function pushClockBlob(el, blobs) {
        if (!el || !el.getAttribute) return;
        const names = ['title', 'data-original-title', 'data-tooltip', 'aria-label', 'data-time', 'data-start', 'data-end'];
        for (let i = 0; i < names.length; i++) {
            const value = el.getAttribute(names[i]);
            if (value) blobs.push(value);
        }
        const start = el.getAttribute('data-start');
        const end = el.getAttribute('data-end');
        if (start && end) blobs.push(start + ' - ' + end);
    }

    function readFunctionSegment(row, bucket, minutes, title, scale) {
        const used = scale && scale.shiftName ? scale : defaultBreakScale(new Date());
        const blobs = [];
        pushClockBlob(row, blobs);
        if (row && row.querySelectorAll) {
            const titled = row.querySelectorAll('[title]');
            for (let i = 0; i < titled.length; i++) pushClockBlob(titled[i], blobs);
            const cells = row.querySelectorAll('td');
            for (let i = 0; i < cells.length; i++) {
                const cls = String(cells[i].className || '');
                if (cls.indexOf('rightAlign') !== -1) continue;
                blobs.push(cells[i].textContent || '');
            }
        }
        let range = null;
        for (let i = 0; i < blobs.length && !range; i++) range = rangeFromText(blobs[i], used.shiftName, minutes);
        if (!range && row && row.getAttribute) range = rangeFromStyle(row.getAttribute('style') || '', minutes, used);
        if (!range && row && row.querySelectorAll) {
            const styled = row.querySelectorAll('[style]');
            for (let i = 0; i < styled.length && !range; i++) {
                range = rangeFromStyle(styled[i].getAttribute('style') || '', minutes, used);
            }
        }
        if (!range) range = rangeFromImages(row, minutes, used);
        return {
            bucket: bucket,
            minutes: minutes,
            startMin: range ? range.startMin : null,
            endMin: range ? range.endMin : null,
            title: String(title || '').slice(0, 120)
        };
    }

    function breakShiftName(date) {
        const hour = date.getHours();
        return (hour >= DAY_SHIFT_HOUR && hour < NIGHT_SHIFT_HOUR) ? 'days' : 'nights';
    }

    function breakWindows(date) {
        return BREAK_WINDOWS[breakShiftName(date || new Date())];
    }

    function overlapMinutes(start, end, w0, w1) {
        if (start == null || end == null) return 0;
        let best = 0;
        for (let shift = -1440; shift <= 1440; shift += 1440) {
            const hit = Math.min(end + shift, w1) - Math.max(start + shift, w0);
            if (hit > best) best = hit;
        }
        return best;
    }

    function idleInWindow(segments, window) {
        let sum = 0;
        const list = segments || [];
        for (let i = 0; i < list.length; i++) {
            const seg = list[i];
            if (!seg || (seg.bucket !== 'indirect' && seg.bucket !== 'tot')) continue;
            sum += overlapMinutes(seg.startMin, seg.endMin, window.startMin, window.endMin);
        }
        return sum;
    }

    function windowIdlePct(idleMin) {
        return ((Number(idleMin) || 0) / BREAK_SPAN_MIN) * 100;
    }

    function isExtendedIdle(idleMin) {
        return (Number(idleMin) || 0) + 1e-6 >= BREAK_FLAG_MIN;
    }

    function extendedHits(segments, date) {
        const windows = breakWindows(date || new Date());
        const hits = [];
        for (let i = 0; i < windows.length; i++) {
            const idleMin = idleInWindow(segments, windows[i]);
            if (!isExtendedIdle(idleMin)) continue;
            hits.push({
                id: windows[i].id,
                label: windows[i].label,
                idleMin: idleMin,
                pct: windowIdlePct(idleMin)
            });
        }
        return hits;
    }

    function engagedColor(pct) {
        const shown = Math.round(Number(pct) || 0);
        if (shown >= 100) return '#3fb950';
        if (shown >= 96) return '#d29922';
        return '#f85149';
    }

    function formatBreakMinutes(min) {
        const n = Math.round((Number(min) || 0) * 10) / 10;
        if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
        return n.toFixed(1);
    }

    function emptyEngage() {
        return { flags: [], rev: 0 };
    }

    function loadEngage() {
        let raw = '';
        try {
            if (typeof GM_getValue === 'function') raw = GM_getValue(ENGAGE_KEY, '') || '';
        } catch (e) { raw = ''; }
        if (!raw) {
            try { raw = localStorage.getItem(ENGAGE_KEY) || ''; } catch (e2) { raw = ''; }
        }
        if (!raw) return emptyEngage();
        try {
            const doc = JSON.parse(raw);
            if (!doc || !Array.isArray(doc.flags)) return emptyEngage();
            return doc;
        } catch (e3) {
            return emptyEngage();
        }
    }

    function saveEngageLocal(doc) {
        const text = JSON.stringify(doc);
        try {
            if (typeof GM_setValue === 'function') GM_setValue(ENGAGE_KEY, text);
        } catch (e) { /* the page copy below still records it */ }
        try { localStorage.setItem(ENGAGE_KEY, text); } catch (e2) { /* storage can be blocked */ }
    }

    function pruneEngage(doc, now) {
        const cutoff = now.getTime() - (18 * 60 * 60 * 1000);
        const current = shiftId(now);
        const keep = [];
        const flags = doc.flags || [];
        for (let i = 0; i < flags.length; i++) {
            const row = flags[i];
            if (!row || !row.id) continue;
            if (row.shiftId === current || (row.flaggedAtMs || 0) >= cutoff) keep.push(row);
        }
        doc.flags = keep;
        return doc;
    }

    function engageSnapshot(doc) {
        const flags = ((doc && doc.flags) || []).map(function (row) {
            const windows = (row.windows || []).map(function (item) {
                return { id: item.id || '', idleMin: Math.round((item.idleMin || 0) * 10) / 10 };
            }).sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
            return {
                id: row.id || '',
                login: row.login || '',
                empId: row.empId || '',
                shiftId: row.shiftId || '',
                windows: windows,
                engagedBy: row.engagedBy || '',
                engagedAtMs: row.engagedAtMs || 0,
                detail: row.detail || ''
            };
        }).sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
        return JSON.stringify(flags);
    }

    function engageOn() {
        return !!(ENGAGE_URL && typeof GM_xmlhttpRequest === 'function');
    }

    function engageRequest(method, extra) {
        const headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
        };
        if (extra && extra.baseRev != null) headers['X-Engage-Base'] = String(extra.baseRev);
        let url = ENGAGE_URL;
        if (method === 'GET') url += '?t=' + Date.now();
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                method: method,
                url: url,
                headers: headers,
                data: extra && extra.doc ? JSON.stringify(extra.doc) : undefined,
                timeout: 20000,
                onload: function (res) { resolve(res || {}); },
                onerror: function () { reject(new Error('extended breaks')); },
                ontimeout: function () { reject(new Error('extended breaks timeout')); }
            });
        });
    }

    function readSharedEngage() {
        return engageRequest('GET').then(function (res) {
            if (!res || res.status < 200 || res.status >= 300) throw new Error('extended breaks read');
            const doc = parseSharedBody(res.responseText || '');
            if (!doc || !Array.isArray(doc.flags)) return emptyEngage();
            if (typeof doc.rev !== 'number') doc.rev = 0;
            return doc;
        });
    }

    function writeSharedEngage(doc, baseRev) {
        return engageRequest('PUT', { doc: doc, baseRev: baseRev }).then(function (res) {
            if (res && res.status === 409) return { conflict: true };
            if (!res || res.status < 200 || res.status >= 300) throw new Error('extended breaks write');
            return { conflict: false };
        });
    }

    function mergeEngage(local, remote) {
        const byId = Object.create(null);
        function take(row) {
            if (!row || !row.id) return;
            const prev = byId[row.id];
            const copy = JSON.parse(JSON.stringify(row));
            if (!prev) {
                byId[row.id] = copy;
                return;
            }
            const windows = {};
            const lists = [prev.windows || [], copy.windows || []];
            for (let n = 0; n < lists.length; n++) {
                for (let i = 0; i < lists[n].length; i++) {
                    const item = lists[n][i];
                    if (!item || !item.id) continue;
                    const had = windows[item.id];
                    if (!had || (item.idleMin || 0) > (had.idleMin || 0)) windows[item.id] = item;
                }
            }
            const ids = Object.keys(windows);
            copy.windows = [];
            for (let i = 0; i < ids.length; i++) copy.windows.push(windows[ids[i]]);
            if (prev.engagedAtMs && (!copy.engagedAtMs || prev.engagedAtMs < copy.engagedAtMs)) {
                copy.engagedBy = prev.engagedBy;
                copy.engagedAt = prev.engagedAt;
                copy.engagedAtMs = prev.engagedAtMs;
                copy.detail = prev.detail;
            }
            if ((prev.flaggedAtMs || 0) && (!copy.flaggedAtMs || prev.flaggedAtMs < copy.flaggedAtMs)) {
                copy.flaggedAtMs = prev.flaggedAtMs;
            }
            byId[row.id] = copy;
        }
        const lists = [(local && local.flags) || [], (remote && remote.flags) || []];
        for (let n = 0; n < lists.length; n++) {
            for (let i = 0; i < lists[n].length; i++) take(lists[n][i]);
        }
        const out = emptyEngage();
        const ids = Object.keys(byId);
        for (let i = 0; i < ids.length; i++) out.flags.push(byId[ids[i]]);
        out.rev = Math.max((local && local.rev) || 0, (remote && remote.rev) || 0);
        return out;
    }

    function publishEngageOnce(localDoc, attempt) {
        return readSharedEngage().then(function (remote) {
            const merged = pruneEngage(mergeEngage(localDoc, remote), new Date());
            const base = remote.rev || 0;
            if (engageSnapshot(merged) === engageSnapshot(remote)) {
                merged.rev = base;
                saveEngageLocal(merged);
                return merged;
            }
            merged.rev = base + 1;
            return writeSharedEngage(merged, base).then(function (result) {
                if (result.conflict) {
                    if (attempt >= 4) throw new Error('extended breaks conflict');
                    return publishEngageOnce(localDoc, attempt + 1);
                }
                return readSharedEngage().then(function (after) {
                    const checked = pruneEngage(mergeEngage(localDoc, after), new Date());
                    if (engageSnapshot(checked) !== engageSnapshot(after)) {
                        if (attempt >= 4) throw new Error('extended breaks write');
                        return publishEngageOnce(localDoc, attempt + 1);
                    }
                    checked.rev = after.rev || merged.rev;
                    saveEngageLocal(checked);
                    return checked;
                });
            });
        });
    }

    function publishEngage(doc) {
        if (!engageOn()) return Promise.resolve(doc);
        const job = engageChain.then(function () {
            return publishEngageOnce(doc, 0);
        });
        engageChain = job.then(function (next) { return next; }, function () { return null; });
        return job;
    }

    function saveEngage(doc) {
        pruneEngage(doc, new Date());
        saveEngageLocal(doc);
        if (engageOn()) return publishEngage(doc);
        return Promise.resolve(doc);
    }

    function pullEngage() {
        if (!engageOn()) return Promise.resolve(loadEngage());
        return publishEngage(loadEngage());
    }

    function flagFor(empId, login, now) {
        const doc = loadEngage();
        const shift = shiftId(now || new Date());
        const name = String(login || '').trim().toLowerCase();
        const flags = doc.flags || [];
        for (let i = 0; i < flags.length; i++) {
            const row = flags[i];
            if (!row || row.shiftId !== shift) continue;
            if (empId && row.empId === empId) return row;
            if (name && row.login === name) return row;
        }
        return null;
    }

    function extendedBreakOpen(empId, login, now) {
        const row = flagFor(empId, login, now || new Date());
        if (!row || row.engagedAtMs) return null;
        return row;
    }

    function rememberExtendedBreak(empId, record, now) {
        if (!record || !record.segments) return;
        const when = now || new Date();
        const hits = extendedHits(record.segments, when);
        if (!hits.length) return;
        const person = personForEmp(empId);
        const login = String((person && person.login) || '').trim().toLowerCase();
        const doc = loadEngage();
        const shift = shiftId(when);
        const id = shift + '|' + (login || empId);
        let row = null;
        for (let i = 0; i < doc.flags.length; i++) {
            if (doc.flags[i] && doc.flags[i].id === id) row = doc.flags[i];
        }
        let changed = false;
        if (!row) {
            row = {
                id: id,
                login: login,
                empId: empId,
                shiftId: shift,
                windows: [],
                flaggedAtMs: when.getTime()
            };
            doc.flags.push(row);
            changed = true;
        }
        if (!row.windows) row.windows = [];
        for (let i = 0; i < hits.length; i++) {
            let had = null;
            for (let w = 0; w < row.windows.length; w++) {
                if (row.windows[w] && row.windows[w].id === hits[i].id) had = row.windows[w];
            }
            if (!had) {
                row.windows.push(hits[i]);
                changed = true;
            } else if ((hits[i].idleMin || 0) > (had.idleMin || 0) + 0.05) {
                had.idleMin = hits[i].idleMin;
                had.pct = hits[i].pct;
                had.label = hits[i].label;
                changed = true;
            }
        }
        if (changed) saveEngage(doc);
    }

    // A finished extended-break pass stays on this computer. A refresh paints
    // those results and does not walk the Time Details rows again.
    const BREAK_CHECKED_KEY = 'mem3-extended-checked-v1';
    let BREAK_CHECKED = null;
    let BREAK_RUNNING = false;
    let BREAK_FORCE = false;

    function readBreakChecked() {
        if (BREAK_CHECKED) return BREAK_CHECKED;
        let raw = '';
        try {
            if (typeof GM_getValue === 'function') raw = GM_getValue(BREAK_CHECKED_KEY, '') || '';
        } catch (e) { raw = ''; }
        if (!raw) {
            try { raw = localStorage.getItem(BREAK_CHECKED_KEY) || ''; } catch (e2) { raw = ''; }
        }
        let doc = null;
        try { doc = raw ? JSON.parse(raw) : null; } catch (e3) { doc = null; }
        if (!doc || typeof doc !== 'object') doc = { shiftId: '', ids: {}, finished: false };
        if (!doc.ids || typeof doc.ids !== 'object') doc.ids = {};
        BREAK_CHECKED = doc;
        return BREAK_CHECKED;
    }

    function writeBreakChecked() {
        const text = JSON.stringify(readBreakChecked());
        try {
            if (typeof GM_setValue === 'function') GM_setValue(BREAK_CHECKED_KEY, text);
        } catch (e) { /* the page copy below still records it */ }
        try { localStorage.setItem(BREAK_CHECKED_KEY, text); } catch (e2) { /* storage can be blocked */ }
    }

    function checkedForShift(now) {
        const doc = readBreakChecked();
        const shift = shiftId(now || new Date());
        if (doc.shiftId !== shift) {
            doc.shiftId = shift;
            doc.ids = {};
            doc.finished = false;
            writeBreakChecked();
        }
        return doc;
    }

    function extendedChecked(empId, now) {
        if (!empId) return false;
        return !!checkedForShift(now).ids[empId];
    }

    function breakCalcFinished(now) {
        return !!checkedForShift(now).finished;
    }

    function clearBreakChecked(now) {
        const doc = readBreakChecked();
        doc.shiftId = shiftId(now || new Date());
        doc.ids = {};
        doc.finished = false;
        writeBreakChecked();
    }

    function reloadBreakChecked() {
        BREAK_CHECKED = null;
        readBreakChecked();
    }

    function noteExtendedChecked(empId, now) {
        if (!empId) return;
        const doc = checkedForShift(now);
        doc.ids[empId] = 1;
        writeBreakChecked();
    }

    function markBreakCalcFinished(now) {
        const doc = checkedForShift(now);
        doc.finished = true;
        writeBreakChecked();
    }

    function clearUnengagedFlags(now) {
        const shift = shiftId(now || new Date());
        const doc = loadEngage();
        const keep = [];
        let changed = false;
        const flags = doc.flags || [];
        for (let i = 0; i < flags.length; i++) {
            const row = flags[i];
            if (row && row.shiftId === shift && !row.engagedAtMs) {
                changed = true;
                continue;
            }
            keep.push(row);
        }
        if (!changed) return;
        doc.flags = keep;
        saveEngage(doc);
    }

    function engageExtended(empId, login, by, text, now) {
        const when = now || new Date();
        const actor = String(by || '').trim().toLowerCase();
        const detail = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 240);
        if (!looksLikeLogin(actor) || !detail) return null;
        const doc = loadEngage();
        const shift = shiftId(when);
        const name = String(login || '').trim().toLowerCase();
        let row = null;
        const flags = doc.flags || [];
        for (let i = 0; i < flags.length; i++) {
            const item = flags[i];
            if (!item || item.shiftId !== shift) continue;
            if ((empId && item.empId === empId) || (name && item.login === name)) row = item;
        }
        if (!row || row.engagedAtMs) return null;
        row.engagedBy = actor;
        row.engagedAt = clockText(when);
        row.engagedAtMs = when.getTime();
        row.detail = detail;
        saveEngage(doc);
        return row;
    }

    function extendedPersonKey(row) {
        if (row && row.empId) return 'id:' + row.empId;
        if (row && row.login) return 'login:' + row.login;
        return 'row:' + ((row && row.id) || '');
    }

    function collapseExtendedRows(rows) {
        const by = Object.create(null);
        const order = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;
            const key = extendedPersonKey(row);
            const prev = by[key];
            if (!prev) {
                by[key] = JSON.parse(JSON.stringify(row));
                order.push(key);
                continue;
            }
            const windows = Object.create(null);
            const lists = [prev.windows || [], row.windows || []];
            for (let n = 0; n < lists.length; n++) {
                for (let w = 0; w < lists[n].length; w++) {
                    const item = lists[n][w];
                    if (!item || !item.id) continue;
                    const had = windows[item.id];
                    if (!had || (item.idleMin || 0) > (had.idleMin || 0)) windows[item.id] = item;
                }
            }
            const ids = Object.keys(windows);
            prev.windows = [];
            for (let w = 0; w < ids.length; w++) prev.windows.push(windows[ids[w]]);
            if (row.engagedAtMs && !prev.engagedAtMs) {
                prev.engagedBy = row.engagedBy;
                prev.engagedAt = row.engagedAt;
                prev.engagedAtMs = row.engagedAtMs;
                prev.detail = row.detail;
            }
        }
        const out = [];
        for (let i = 0; i < order.length; i++) out.push(by[order[i]]);
        return out;
    }

    function extendedRows(empIds, now) {
        const when = now || new Date();
        const shift = shiftId(when);
        const doc = loadEngage();
        const flags = doc.flags || [];
        if (!empIds) {
            const all = [];
            for (let i = 0; i < flags.length; i++) {
                if (flags[i] && flags[i].shiftId === shift) all.push(flags[i]);
            }
            return collapseExtendedRows(all);
        }
        const out = [];
        for (let i = 0; i < empIds.length; i++) {
            const row = flagFor(empIds[i], '', when);
            if (row) out.push(row);
        }
        return collapseExtendedRows(out);
    }

    function extendedBreakStats(empIds, now) {
        const rows = extendedRows(empIds, now);
        let engaged = 0;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].engagedAtMs) engaged++;
        }
        const count = rows.length;
        return { count: count, engaged: engaged, pct: count ? (engaged / count) * 100 : 100, rows: rows };
    }

    // Latest attendance punch says whether someone is clocked in right now.
    // Out and meal start are clocked out. In, meal end, and return are clocked in.
    const CLOCK = { byKey: Object.create(null), loadedAt: 0, rows: 0, keys: 0, lastError: '' };
    let clockLoading = false;

    function punchClass(punchType) {
        const raw = String(punchType || '').toLowerCase();
        if (raw.indexOf('out') !== -1 || raw.indexOf('meal start') !== -1) return 'out';
        if (raw.indexOf('in') !== -1 || raw.indexOf('meal end') !== -1 || raw.indexOf('return') !== -1) return 'in';
        return '';
    }

    function swapPersonName(value) {
        const trimmed = String(value || '').trim();
        const comma = trimmed.indexOf(',');
        if (comma === -1) return '';
        const last = trimmed.slice(0, comma).trim();
        const first = trimmed.slice(comma + 1).trim();
        if (!first || !last) return '';
        return (first + ' ' + last).replace(/\s+/g, ' ');
    }

    function readPunch(row) {
        let type = '';
        let ts = NaN;
        if (row.length > 5) {
            if (punchClass(row[4])) type = row[4];
            const parsed = Date.parse(row[5]);
            if (isFinite(parsed)) ts = parsed;
        }
        for (let c = 0; c < row.length; c++) {
            const cell = String(row[c] || '').trim();
            if (!type && punchClass(cell)) type = cell;
            if (!isFinite(ts)) {
                const parsed = Date.parse(cell);
                if (isFinite(parsed) && parsed > 1577836800000) ts = parsed;
            }
        }
        return { cls: punchClass(type), ts: ts };
    }

    function rememberPunch(key, cls, ts) {
        const id = String(key || '').trim().toLowerCase();
        if (!id || !cls) return;
        const prev = CLOCK.byKey[id];
        if (!prev || ts >= prev.ts) CLOCK.byKey[id] = { cls: cls, ts: ts };
    }

    function csvToRows(text) {
        const rows = [];
        let row = [];
        let cell = '';
        let quoted = false;
        const src = String(text || '');
        for (let i = 0; i < src.length; i++) {
            const ch = src.charAt(i);
            if (quoted) {
                if (ch === '"') {
                    if (src.charAt(i + 1) === '"') { cell += '"'; i++; }
                    else quoted = false;
                } else cell += ch;
            } else if (ch === '"') quoted = true;
            else if (ch === ',') { row.push(cell); cell = ''; }
            else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
            else if (ch !== '\r') cell += ch;
        }
        if (cell.length || row.length) { row.push(cell); rows.push(row); }
        return rows;
    }

    function indexAttendance(rows) {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 4) continue;
            const punch = readPunch(row);
            if (!punch.cls || !isFinite(punch.ts)) continue;
            rememberPunch(row[0], punch.cls, punch.ts);
            const name = String(row[1] || '').trim();
            if (name) {
                rememberPunch(normalizeName(name), punch.cls, punch.ts);
                const swapped = swapPersonName(name);
                if (swapped) rememberPunch(normalizeName(swapped), punch.cls, punch.ts);
            }
            for (let c = 0; c < row.length; c++) {
                const cell = String(row[c] || '').trim();
                if (/^\d{5,12}$/.test(cell) || isLogin(cell)) rememberPunch(cell, punch.cls, punch.ts);
            }
        }
    }

    function isoDate(d) {
        const pad = function (n) { return String(n).padStart(2, '0'); };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function attendanceUrl(day) {
        return 'https://fclm-portal.amazon.com/reports/employeeAttendance?reportFormat=CSV&warehouseId=' +
            encodeURIComponent(WAREHOUSE) + '&spanType=Day&startDateDay=' + encodeURIComponent(day);
    }

    function clockFor(person, empId) {
        const keys = [];
        if (empId) keys.push(String(empId).trim().toLowerCase());
        if (person && person.login) keys.push(String(person.login).trim().toLowerCase());
        if (person && person.badge) keys.push(String(person.badge).trim().toLowerCase());
        if (person && person.name) {
            keys.push(normalizeName(person.name));
            const swapped = swapPersonName(person.name);
            if (swapped) keys.push(normalizeName(swapped));
        }
        const list = person && person.idCandidates ? person.idCandidates : [];
        for (let i = 0; i < list.length; i++) keys.push(String(list[i]).trim().toLowerCase());
        let best = null;
        for (let i = 0; i < keys.length; i++) {
            const hit = CLOCK.byKey[keys[i]];
            if (hit && (!best || hit.ts > best.ts)) best = hit;
        }
        return best ? best.cls : '';
    }

    function clockLabel(status) {
        if (status === 'in') return { text: 'Clocked in', short: 'IN', color: '#2ea043' };
        if (status === 'out') return { text: 'Clocked out', short: 'OUT', color: '#f85149' };
        return null;
    }

    function isAvatarBox(el) {
        if (!el || !el.getBoundingClientRect) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 16 || r.width > 96 || r.height < 16 || r.height > 96) return false;
        return Math.abs(r.width - r.height) <= 14;
    }

    function pageComputedStyle(el) {
        try {
            const win = pageWindow();
            if (win && win.getComputedStyle) return win.getComputedStyle(el);
        } catch (e) { /* the page window may be mid-draw */ }
        try {
            if (window.getComputedStyle) return window.getComputedStyle(el);
        } catch (e2) { /* ignore */ }
        return null;
    }

    function elementBackground(el) {
        if (!el) return '';
        const inline = el.style && el.style.backgroundImage;
        if (inline && inline !== 'none') return inline;
        const attr = el.getAttribute ? (el.getAttribute('style') || '') : '';
        const fromAttr = /url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(attr);
        if (fromAttr && fromAttr[2]) return 'url("' + fromAttr[2] + '")';
        const cs = pageComputedStyle(el);
        return (cs && cs.backgroundImage) || '';
    }

    function avatarNodes(tr) {
        const out = [];
        if (!tr || !tr.querySelectorAll) return out;
        const seen = [];
        function take(list) {
            for (let i = 0; i < list.length; i++) {
                if (seen.indexOf(list[i]) !== -1) continue;
                seen.push(list[i]);
                out.push(list[i]);
            }
        }
        take(tr.querySelectorAll('div, span, img'));
        const hosts = tr.querySelectorAll('*');
        for (let i = 0; i < hosts.length; i++) {
            const root = hosts[i].shadowRoot;
            if (!root || !root.querySelectorAll) continue;
            take(root.querySelectorAll('div, span, img'));
        }
        return out;
    }

    function avatarEl(tr) {
        const nodes = avatarNodes(tr);
        let fallback = null;
        let imgFallback = null;
        for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            if (String(el.tagName || '').toUpperCase() === 'IMG') {
                const src = el.getAttribute('src') || el.currentSrc || el.src || '';
                if (!src || src.indexOf('data:image/svg') === 0) continue;
                const ir = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 32, height: 32 };
                if (ir.width >= 18 && ir.height >= 18 && ir.width <= 96 && ir.height <= 96) return el;
                if (!imgFallback) imgFallback = el;
                continue;
            }
            const bg = elementBackground(el);
            if (!bg || bg === 'none') continue;
            if (/badgephoto|employeephoto|avatar|portrait/i.test(bg)) return el;
            if (!fallback && isAvatarBox(el) && /url\(/i.test(bg)) fallback = el;
        }
        return fallback || imgFallback;
    }

    function cssImageUrl(value) {
        const match = /url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(String(value || ''));
        return match ? match[2] : '';
    }

    function badgePhotoUrl(el) {
        if (!el) return '';
        if (String(el.tagName || '').toUpperCase() === 'IMG') {
            const src = el.getAttribute('src') || el.currentSrc || el.src || '';
            if (src && src.indexOf('data:image/svg') !== 0) return src;
        }
        return cssImageUrl(elementBackground(el));
    }

    const CLOCK_PHOTO_PX = 32;
    const CLOCK_RING_PX = 6;

    function restoreAvatar(el) {
        if (!el || !el.style) return;
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.minWidth = CLOCK_PHOTO_PX + 'px';
        el.style.minHeight = CLOCK_PHOTO_PX + 'px';
        el.style.flexShrink = '0';
        el.style.borderRadius = '50%';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.overflow = 'visible';
        el.style.position = 'relative';
        el.removeAttribute('data-mem3-clock');
    }

    function clearClockOnEl(el) {
        restoreAvatar(el);
        const rings = el.querySelectorAll ? el.querySelectorAll('.mem3-clock-ring') : [];
        for (let i = 0; i < rings.length; i++) rings[i].remove();
    }

    function clearClockDecor(tr) {
        if (!tr) return;
        const rings = tr.querySelectorAll('.mem3-clock-ring');
        for (let i = 0; i < rings.length; i++) rings[i].remove();
        const marked = tr.querySelectorAll('.mem3-clock-in, .mem3-clock-out, [data-mem3-clock]');
        for (let i = 0; i < marked.length; i++) {
            marked[i].classList.remove('mem3-clock-in', 'mem3-clock-out');
            restoreAvatar(marked[i]);
        }
        const photos = tr.querySelectorAll('div, span');
        for (let i = 0; i < photos.length; i++) {
            const bg = elementBackground(photos[i]);
            if (bg.indexOf('badgephotos') !== -1) restoreAvatar(photos[i]);
        }
        const pill = tr.querySelector('.mem3-clock-pill');
        if (pill) pill.remove();
    }

    function paintClockOverlay(tr, avatar, status) {
        const stale = tr.querySelectorAll('.mem3-clock-ring');
        for (let i = 0; i < stale.length; i++) stale[i].remove();
        restoreAvatar(avatar);
        if (!status) return;
        const label = clockLabel(status);
        avatar.setAttribute('data-mem3-clock', status);
        const ring = document.createElement('span');
        ring.className = 'mem3-clock-ring';
        ring.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; box-sizing:border-box; ' +
            'border-radius:50%; pointer-events:none; border:0; background:transparent; z-index:5; ' +
            'box-shadow:0 0 0 ' + CLOCK_RING_PX + 'px ' + label.color;
        avatar.appendChild(ring);
    }

    function paintClockPill(tr) {
        if (!tr || !tr.querySelectorAll) return;
        const pills = tr.querySelectorAll('.mem3-clock-pill');
        for (let i = 0; i < pills.length; i++) pills[i].remove();
    }

    function ensurePopupClock(box, person, empId) {
        if (!box) return;
        const label = clockLabel(clockFor(person, empId));
        let node = box.querySelector('.mem3-popup-clock');
        if (!label) {
            if (node) node.remove();
            return;
        }
        if (!node) {
            node = document.createElement('div');
            node.className = 'mem3-popup-clock';
            node.style.cssText = 'font-weight:800; font-size:16px; line-height:1.2; margin-top:2px;';
            const idle = box.querySelector('.mem3-popup-idle');
            if (idle && idle.parentElement) idle.parentElement.appendChild(node);
            else box.appendChild(node);
        }
        node.textContent = label.text;
        node.style.color = label.color;
    }

    function paintAllClockRings() {
        if (psBoardHolding()) return;
        if (!CLOCK.loadedAt) return;
        installPulseStyles();
        const rows = document.querySelectorAll('table tbody tr');
        for (let i = 0; i < rows.length; i++) {
            const tr = rows[i];
            if (tr.closest('#' + FLOOR_SUMMARY_ID)) continue;
            const found = findLoginInRow(tr);
            if (!found) {
                clearClockDecor(tr);
                continue;
            }
            const person = IDENTITY.byLogin[found.login];
            const status = clockFor(person, resolveEmpId(person));
            const avatar = avatarEl(tr);
            const leftover = tr.querySelectorAll('.mem3-clock-in, .mem3-clock-out');
            for (let m = 0; m < leftover.length; m++) leftover[m].classList.remove('mem3-clock-in', 'mem3-clock-out');
            if (avatar) paintClockOverlay(tr, avatar, status);
            else clearClockDecor(tr);
            paintClockPill(tr);
        }
        const popups = document.querySelectorAll('.' + POPUP_CLASS);
        for (let i = 0; i < popups.length; i++) {
            const box = popups[i];
            const person = IDENTITY.byLogin[box.dataset.login] || null;
            ensurePopupClock(box, person, box.dataset.empId || '');
        }
    }

    function scheduleClockLoad(force) {
        if (!force && CLOCK.loadedAt && Date.now() - CLOCK.loadedAt < refreshIntervalMs()) {
            paintAllClockRings();
            return Promise.resolve();
        }
        if (FCLM_DOWN || clockLoading) return Promise.resolve();
        clockLoading = true;
        const today = new Date();
        const yesterday = new Date(today.getTime());
        yesterday.setDate(yesterday.getDate() - 1);
        const days = [isoDate(yesterday), isoDate(today)];
        return Promise.all(days.map(function (day) { return gmFetch(attendanceUrl(day)); })).then(function (parts) {
            CLOCK.byKey = Object.create(null);
            let rows = 0;
            for (let i = 0; i < parts.length; i++) {
                const parsed = csvToRows(parts[i]);
                rows += parsed.length;
                indexAttendance(parsed);
            }
            CLOCK.rows = rows;
            CLOCK.keys = Object.keys(CLOCK.byKey).length;
            if (!CLOCK.keys) {
                CLOCK.lastError = 'attendance CSV had no punches';
                warn('clock status:', CLOCK.lastError);
                return;
            }
            CLOCK.lastError = '';
            CLOCK.loadedAt = Date.now();
            paintAllClockRings();
        }).catch(function (e) {
            CLOCK.lastError = (e && e.message) ? e.message : String(e);
            warn('clock status failed:', e);
        }).then(function () {
            clockLoading = false;
        });
    }

    function windowGapText() {
        return 'No data for ' + windowPreset(ACTIVE_WINDOW).label;
    }

    function uphGapText() {
        return 'No UPH for ' + windowPreset(ACTIVE_WINDOW).label;
    }

    function uphHeadline(stats) {
        if (stats && stats.hasData) return (stats.uph > 0 ? stats.uph.toFixed(1) : '0') + ' UPH';
        return uphGapText();
    }

    function formatUnits(n) {
        return Math.round(Number(n) || 0).toLocaleString('en-US');
    }

    function unitsHeadline(stats) {
        if (!stats || !stats.hasData) return '';
        return formatUnits(stats.units) + ' units';
    }

    function makeUnitsHint(n, px) {
        const el = document.createElement('span');
        el.className = 'mem3-units-hint';
        el.textContent = formatUnits(n) + ' units';
        el.style.cssText = 'font-size:' + (px || 11) + 'px; font-weight:600; color:#8b949e; ' +
            'letter-spacing:0.02em; font-variant-numeric:tabular-nums; white-space:nowrap;';
        return el;
    }

    function idleHeadline(time) {
        if (time && time.noData) return windowGapText();
        return idleLabel(idlePercent(time)) + ' IDLE';
    }

    function timeSettled(record) {
        return !!(record && (record.hasTime || record.noData));
    }

    function timeFinished(empId) {
        if (TIME_IN_FLIGHT[empId]) return false;
        const t = LAST_TIME[empId];
        if (showsIdle(t) || (t && (t.noData || (t.gaveUp && t.cycle === refreshCycle)))) return true;
        return (TIME_TRIES[empId] || 0) >= MAX_TIME_TRIES;
    }

    // A full recalc deletes saved rows first. Someone new has no row yet
    // and is read with everyone else on the next pass.
    function needsTimeThisCycle(empId) {
        const t = LAST_TIME[empId];
        if (t && (timeSettled(t) || t.gaveUp)) return false;
        if ((TIME_TRIES[empId] || 0) >= MAX_TIME_TRIES) return false;
        return true;
    }

    function idlePercent(t) {
        if (!t || !t.hasTime) return null;
        const denom = t.clockedMin > 0 ? t.clockedMin : 0;
        if (!(denom > 0)) return null;
        return (t.idleMin / denom) * 100;
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function timeFound(record) {
        return !!(record && record.hasTime);
    }

    function triesLeft(empId) {
        return (TIME_TRIES[empId] || 0) < MAX_TIME_TRIES;
    }

    // One person, one Time Details page. Drop the page before the next person.
    async function fetchTimeUntilFound(empId, gen, force) {
        if (!empId || TIME_IN_FLIGHT[empId]) return;
        if (!force && (timeSettled(LAST_TIME[empId]) || !triesLeft(empId))) return;
        TIME_IN_FLIGHT[empId] = true;
        let last = null;
        let html = '';
        let aborted = false;
        function stopForNewCycle() {
            if (gen == null || gen === timeGeneration) return false;
            aborted = true;
            return true;
        }
        try {
            while (triesLeft(empId)) {
                if (stopForNewCycle()) return;
                TIME_TRIES[empId] = (TIME_TRIES[empId] || 0) + 1;
                const n = TIME_TRIES[empId];
                try {
                    html = await gmFetch(fclmEmpUrl(empId));
                    if (stopForNewCycle()) return;
                    last = parseTimeDetails(html);
                    html = '';
                    last.tries = n;
                    if (timeFound(last) || last.noData) {
                        rememberTime(empId, last);
                        return;
                    }
                } catch (e) {
                    html = '';
                    if (stopForNewCycle()) return;
                    last = {
                        hasTime: false, totalMin: 0, idleMin: 0, clockedMin: 0,
                        error: e.message, tries: n, sawClock: false
                    };
                    if (FCLM_DOWN) break;
                }
                if (stopForNewCycle()) return;
                if (triesLeft(empId)) await sleep(500);
            }
            if (stopForNewCycle()) return;
            if (last) rememberTime(empId, last);
        } finally {
            html = '';
            delete TIME_IN_FLIGHT[empId];
            if (aborted && (TIME_TRIES[empId] || 0) > 0) {
                noteTimeIssue(empId, 'Lookup was interrupted', { try: TIME_TRIES[empId] || 0 });
            }
            noteTimeProgress();
            if (!pagesHeld()) pumpRefresh();
        }
    }

    function ensureTime(empId) {
        if (!empId || refreshBusy || pagesHeld()) return;
        if (timeSettled(LAST_TIME[empId]) || !triesLeft(empId)) return;
        const held = LAST_TIME[empId];
        if (held && held.gaveUp && held.cycle === refreshCycle) return;
        fetchTimeUntilFound(empId, timeGeneration);
    }

    function timeFor(empId) {
        if (!empId) return null;
        if (LAST_TIME[empId]) return LAST_TIME[empId];
        if (!SUPPRESS_ENSURE) ensureTime(empId);
        return null;
    }

    function timeText(t) {
        if (!t) return 'Total and IDLE time loading';
        if (t.error) return 'Time details unavailable';
        if (!t.hasTime) return t.sawClock === false ? 'Time Details had no clock rows' : 'No clock rows on Time Details';
        const pct = idlePercent(t);
        return (pct === null ? '—' : pct.toFixed(1) + '%') + ' IDLE \u00b7 ' +
            formatDuration(t.idleMin) + ' / ' + formatDuration(t.clockedMin) + ' clocked in';
    }

    function visibleEmpIds() {
        const ids = [];
        const seen = Object.create(null);
        const panels = panelEntries();
        for (let i = 0; i < panels.length; i++) {
            const labels = panels[i].labels;
            for (let j = 0; j < labels.length; j++) {
                const h = findH5(labels[j]);
                const table = h ? findTable(h) : null;
                if (!table) continue;
                const trs = table.querySelectorAll('tbody tr');
                for (let r = 0; r < trs.length; r++) {
                    const found = findLoginInRow(trs[r]);
                    if (!found) continue;
                    const person = IDENTITY.byLogin[found.login];
                    const empId = resolveEmpId(person);
                    if (!empId || seen[empId]) continue;
                    seen[empId] = true;
                    ids.push(empId);
                }
            }
        }
        return ids;
    }

    function rememberTime(empId, record) {
        if (!record) return;
        const incomingGood = !!(timeFound(record) || record.noData);
        record.cycle = refreshCycle;
        record.fetchedAt = Date.now();
        record.gaveUp = !incomingGood;
        record.refreshing = false;
        LAST_TIME[empId] = record;
        recordTimeIssue(empId, record);
        if (!DEBUG.timeSample) {
            DEBUG.timeSample = {
                empId: empId,
                hasTime: !!record.hasTime,
                noData: !!record.noData,
                error: record.error || '',
                tries: record.tries || 0
            };
        }
        if (DEBUG.timeLoad) DEBUG.timeLoad.done = (DEBUG.timeLoad.done || 0) + 1;
        scheduleLivePaint();
    }

    // The progress bar moves immediately. Rows, line idle, and the floor idle
    // follow on the next tick from whatever has arrived so far.
    function scheduleLivePaint() {
        noteTimeProgress();
        if (livePaintTimer || unassigning || psBoardHolding()) return;
        livePaintTimer = setTimeout(function () {
            livePaintTimer = null;
            if (unassigning || psBoardHolding()) return;
            render();
        }, 50);
    }

    function resetTimeTries() {
        const tried = Object.keys(TIME_TRIES);
        for (let i = 0; i < tried.length; i++) delete TIME_TRIES[tried[i]];
        clearTimeIssues();
    }

    function clearTimeIssues() {
        const keys = Object.keys(TIME_ISSUES);
        for (let i = 0; i < keys.length; i++) delete TIME_ISSUES[keys[i]];
        paintIssueIcon();
        const panel = document.getElementById('mem3-time-issues-panel');
        if (panel) fillIssuePanel(panel);
    }

    const PHOTO_BY_LOGIN = Object.create(null);
    let photoSaveTimer = 0;

    function loadPhotoCache() {
        try {
            if (typeof GM_getValue !== 'function') return;
            const raw = GM_getValue('mem3-badge-photos', '');
            const parsed = raw ? JSON.parse(raw) : null;
            if (!parsed || typeof parsed !== 'object') return;
            const keys = Object.keys(parsed);
            for (let i = 0; i < keys.length; i++) {
                if (typeof parsed[keys[i]] === 'string' && parsed[keys[i]]) PHOTO_BY_LOGIN[keys[i]] = parsed[keys[i]];
            }
        } catch (e) { /* this browser has no saved faces */ }
    }

    function rememberPhoto(login, url) {
        const key = String(login || '').trim().toLowerCase();
        const src = String(url || '').trim();
        if (!key || !src || src.length > 2000 || PHOTO_BY_LOGIN[key] === src) return;
        PHOTO_BY_LOGIN[key] = src;
        if (photoSaveTimer) return;
        photoSaveTimer = setTimeout(function () {
            photoSaveTimer = 0;
            try {
                if (typeof GM_setValue === 'function') GM_setValue('mem3-badge-photos', JSON.stringify(PHOTO_BY_LOGIN));
            } catch (e) { /* ignore */ }
        }, 400);
    }

    function rememberBoardPerson(empId, person, line, station, photo) {
        if (!empId) return;
        const prev = BOARD_PEOPLE[empId] || {};
        const login = (person && person.login) || prev.login || '';
        const kept = photo || prev.photo || '';
        BOARD_PEOPLE[empId] = {
            login: login,
            name: (person && person.name) || prev.name || '',
            badge: (person && person.badge) || prev.badge || '',
            line: line || prev.line || '',
            station: station || prev.station || '',
            photo: kept
        };
        if (kept) rememberPhoto(login, kept);
    }

    function noteTimeIssue(empId, reason, extra) {
        if (!empId || !reason) return;
        let row = TIME_ISSUES[empId];
        if (!row) {
            row = { empId: String(empId), reasons: [], attempts: [], firstAt: new Date().toISOString() };
            TIME_ISSUES[empId] = row;
        }
        if (row.reasons.indexOf(reason) === -1) row.reasons.push(reason);
        if (extra && row.attempts.length < 8) row.attempts.push(extra);
        row.updatedAt = new Date().toISOString();
        paintIssueIcon();
        const panel = document.getElementById('mem3-time-issues-panel');
        if (panel) fillIssuePanel(panel);
    }

    function recordTimeIssue(empId, record) {
        if (!empId || !record) return;
        const tries = record.tries || TIME_TRIES[empId] || 1;
        let reason = '';
        if (record.error) reason = record.error;
        else if (timeFound(record) && !(record.clockedMin > 0)) reason = 'Clock rows had no minutes';
        else if (!timeFound(record) && !record.noData) reason = 'Time Details page had no clock rows';
        else if (tries > 1) reason = 'Resolved on try ' + tries;
        else return;
        noteTimeIssue(empId, reason, {
            try: tries,
            error: record.error || '',
            pageTitle: record.pageTitle || '',
            sawClock: !!record.sawClock,
            hasTime: !!record.hasTime,
            noData: !!record.noData,
            clockedMin: record.clockedMin || 0,
            idleMin: record.idleMin || 0
        });
    }

    function issueIds() {
        return Object.keys(TIME_ISSUES);
    }

    function settleUnfinished(ids) {
        for (let i = 0; i < ids.length; i++) {
            const empId = ids[i];
            if (!needsTimeThisCycle(empId)) continue;
            TIME_TRIES[empId] = MAX_TIME_TRIES;
            rememberTime(empId, {
                hasTime: false,
                totalMin: 0,
                idleMin: 0,
                clockedMin: 0,
                error: 'Time details stopped for this cycle',
                tries: MAX_TIME_TRIES,
                sawClock: false
            });
        }
    }

    // Line ids first, so both open pages stay on the lines until those ids are taken.
    function cycleEmpIds() {
        const ids = [];
        const seen = Object.create(null);
        const lists = [BOARD_IDS, BIGS_IDS];
        for (let s = 0; s < lists.length; s++) {
            const list = lists[s] || [];
            for (let i = 0; i < list.length; i++) {
                const id = list[i];
                if (!id || seen[id]) continue;
                seen[id] = true;
                ids.push(id);
            }
        }
        return ids.length ? ids : visibleEmpIds();
    }

    async function loadBoardTimes() {
        if (TIME_LOADING || BREAK_RUNNING) return;
        const gen = ++timeGeneration;
        const ids = [];
        const queued = Object.create(null);
        let cursor = 0;
        // The assignment rows fill in after the first paint. Pick up anyone
        // who shows up while these pages are already open.
        function pullNew() {
            const pool = cycleEmpIds();
            for (let i = 0; i < pool.length; i++) {
                const id = pool[i];
                if (!id || queued[id] || !needsTimeThisCycle(id)) continue;
                queued[id] = true;
                ids.push(id);
            }
            if (DEBUG.timeLoad) DEBUG.timeLoad.ids = ids.length;
        }
        DEBUG.timeLoad = {
            ids: 0,
            cycle: refreshCycle,
            startedAt: new Date().toISOString(),
            done: 0,
            finished: false,
            error: null,
            maxTries: MAX_TIME_TRIES
        };
        pullNew();
        if (!ids.length) {
            if (DEBUG.timeLoad) DEBUG.timeLoad.finished = true;
            return;
        }
        TIME_LOADING = true;
        const worker = async function () {
            while (gen === timeGeneration && !FCLM_DOWN) {
                pullNew();
                if (cursor >= ids.length) return;
                const empId = ids[cursor++];
                await fetchTimeUntilFound(empId, gen, true);
            }
        };
        try {
            const workers = [];
            for (let i = 0; i < TIME_WORKERS; i++) workers.push(worker());
            await Promise.all(workers);
            if (gen !== timeGeneration) return;
            // One short pause so a board that was still painting can join this cycle.
            await sleep(500);
            if (gen !== timeGeneration) return;
            pullNew();
            if (cursor < ids.length && !FCLM_DOWN) {
                const more = [];
                for (let i = 0; i < TIME_WORKERS; i++) more.push(worker());
                await Promise.all(more);
            }
            if (gen !== timeGeneration) return;
            settleUnfinished(ids);
            if (DEBUG.timeLoad) DEBUG.timeLoad.finished = true;
            render();
        } catch (e) {
            if (DEBUG.timeLoad) {
                DEBUG.timeLoad.error = e.message;
                DEBUG.timeLoad.finished = true;
            }
            if (gen === timeGeneration) {
                settleUnfinished(ids);
                render();
            }
        } finally {
            TIME_LOADING = false;
        }
        try {
            if (gen === timeGeneration) {
                const forceBreaks = BREAK_FORCE;
                BREAK_FORCE = false;
                await runExtendedBreaks(forceBreaks);
            }
        } finally {
            if (!pagesHeld()) pumpRefresh();
        }
    }

    function extendedCalcProgress() {
        const ids = cycleEmpIds();
        const doc = checkedForShift(new Date());
        let done = 0;
        for (let i = 0; i < ids.length; i++) {
            if (doc.ids[ids[i]]) done++;
        }
        return { done: done, total: ids.length };
    }

    function breakTimeReady(empId) {
        const record = LAST_TIME[empId];
        if (!record) return false;
        if (record.segments) return true;
        return !!(record.hasTime || record.noData || record.gaveUp || record.error);
    }

    // Someone already calculated stays saved. A new associate, or one whose
    // time arrived after the last pass, is the only person this walks.
    function pendingBreakIds(now) {
        const ids = cycleEmpIds();
        const doc = checkedForShift(now || new Date());
        const out = [];
        for (let i = 0; i < ids.length; i++) {
            const empId = ids[i];
            if (!empId || doc.ids[empId] || !breakTimeReady(empId)) continue;
            out.push(empId);
        }
        return out;
    }

    function allBreaksChecked(now) {
        const ids = cycleEmpIds();
        if (!ids.length) return false;
        const doc = checkedForShift(now || new Date());
        for (let i = 0; i < ids.length; i++) {
            if (!doc.ids[ids[i]]) return false;
        }
        return true;
    }

    // Idle percent owns the Time Details pages. Extended breaks start only
    // after that pass, and only for associates who are not already saved.
    async function runExtendedBreaks(force) {
        if (BREAK_RUNNING) {
            if (force) BREAK_FORCE = true;
            return;
        }
        if (TIME_LOADING) {
            if (force) BREAK_FORCE = true;
            return;
        }
        const when = new Date();
        if (force) {
            clearBreakChecked(when);
            clearUnengagedFlags(when);
        }
        const ids = pendingBreakIds(when);
        if (!ids.length) {
            const doc = checkedForShift(when);
            const finished = allBreaksChecked(when);
            if (doc.finished !== finished) {
                doc.finished = finished;
                writeBreakChecked();
            }
            return;
        }
        BREAK_RUNNING = true;
        paintProgress();
        await sleep(250);
        try {
            const doc = checkedForShift(when);
            for (let i = 0; i < ids.length; i++) {
                const empId = ids[i];
                const record = LAST_TIME[empId];
                if (record && record.segments) rememberExtendedBreak(empId, record, when);
                doc.ids[empId] = 1;
                paintProgress();
                if (i % 8 === 7) {
                    writeBreakChecked();
                    await sleep(40);
                }
            }
            doc.finished = allBreaksChecked(when);
            writeBreakChecked();
        } finally {
            BREAK_RUNNING = false;
            paintProgress();
            try { render(); } catch (e2) { /* the next paint still has the flags */ }
            if (BREAK_FORCE) {
                BREAK_FORCE = false;
                await runExtendedBreaks(true);
            }
        }
    }

    function requestExtendedRecalc() {
        const when = new Date();
        BREAK_FORCE = true;
        clearBreakChecked(when);
        clearUnengagedFlags(when);
        if (BREAK_RUNNING || TIME_LOADING || refreshBusy) return;
        const progress = timeProgress();
        if (progress.total > 0 && progress.done >= progress.total) {
            runExtendedBreaks(true);
            return;
        }
        refreshData();
    }

    // Between the 5-minute recalcs, a person who just showed up gets an idle
    // page. Their rate comes from the rollup already downloaded.
    function queueMissingTimes() {
        if (unassigning || refreshBusy || TIME_LOADING || BREAK_RUNNING || FCLM_DOWN || !LAST_ROLLUP_AT) return;
        const pool = cycleEmpIds();
        for (let i = 0; i < pool.length; i++) {
            if (!needsTimeThisCycle(pool[i])) continue;
            loadBoardTimes();
            return;
        }
    }

    function queueMissingBreaks() {
        if (unassigning || refreshBusy || TIME_LOADING || BREAK_RUNNING || FCLM_DOWN || !LAST_ROLLUP_AT) return;
        if (!pendingBreakIds(new Date()).length) return;
        runExtendedBreaks(false);
    }

    function clearTimeCache() {
        LAST_TIME = Object.create(null);
        resetTimeTries();
        DEBUG.timeSample = null;
        timeGeneration++;
    }

    /* ---------------------------------------------------------------
       Page decoration.
       --------------------------------------------------------------- */
    function findH5(label) {
        const needle = label.toLowerCase();
        const all = document.querySelectorAll('h3, h4, h5, [role="heading"]');
        for (let i = 0; i < all.length; i++) {
            const text = (all[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (text.indexOf(needle) !== -1) return all[i];
        }
        return null;
    }

    function findTable(h) {
        let c = h;
        for (let i = 0; i < 10; i++) {
            c = c.parentElement;
            if (!c) return null;
            const t = c.querySelector('table');
            if (t) return t;
        }
        return null;
    }

    // Every login on the floor is known from the roster API, so match rows against
    // that exact list instead of guessing which cell holds a person.
    function findLoginInRow(tr) {
        const anchors = tr.querySelectorAll('a[role="button"], a[mdn-link]');
        for (let i = 0; i < anchors.length; i++) {
            const text = (anchors[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (IDENTITY.byLogin[text]) return { el: anchors[i], login: text };
        }
        const els = tr.querySelectorAll('a, button, span, td');
        for (let i = els.length - 1; i >= 0; i--) {
            const el = els[i];
            const text = (el.textContent || '').trim().toLowerCase();
            if (text.length < 3 || text.length > 32) continue;
            if (IDENTITY.byLogin[text]) return { el: el, login: text };
        }
        const rowText = tr.textContent || '';
        const tokens = rowText.toLowerCase().match(/[a-z][a-z0-9._-]{2,31}/g) || [];
        for (let i = 0; i < tokens.length; i++) {
            if (IDENTITY.byLogin[tokens[i]]) return { el: null, login: tokens[i] };
        }
        return null;
    }

    function textSkipping(el, skipClass) {
        if (!el) return '';
        const cls = String(el.className || '');
        if (skipClass && cls.indexOf(skipClass) !== -1) return '';
        const nodes = el.childNodes;
        if (nodes && nodes.length) {
            let text = '';
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (!node) continue;
                if (node.nodeType === 3) text += node.textContent || '';
                else text += ' ' + textSkipping(node, skipClass);
            }
            return text;
        }
        const kids = el.children || [];
        if (!kids.length) return String(el.textContent || '');
        let text = '';
        for (let i = 0; i < kids.length; i++) text += ' ' + textSkipping(kids[i], skipClass);
        return text;
    }

    function rowAssignmentText(tr) {
        const td = tr.querySelector('td');
        const raw = td ? textSkipping(td, 'mem3-cr-station') : (tr.textContent || '');
        return String(raw || '').replace(/\s+/g, ' ').trim();
    }

    function directText(el) {
        if (!el) return '';
        const kids = el.children || [];
        if (el.childNodes && el.childNodes.length) {
            let text = '';
            for (let i = 0; i < el.childNodes.length; i++) {
                const node = el.childNodes[i];
                if (node && node.nodeType === 3) text += node.textContent || '';
            }
            const direct = text.replace(/\s+/g, ' ').trim();
            if (direct || kids.length) return direct;
        }
        if (kids.length) return '';
        return String(el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    // A disabled station stays on the board, but it is not an open station
    // and it is not part of the utilization percent.
    function stationIsDisabled(tr) {
        if (!tr) return false;
        if (String((tr.getAttribute && tr.getAttribute('aria-disabled')) || '').toLowerCase() === 'true') return true;
        const cls = String(tr.className || '');
        if (/(?:^|\s)(?:disabled|is-disabled|station-disabled)(?:\s|$)/i.test(cls)) return true;
        const stack = [tr];
        while (stack.length) {
            const el = stack.pop();
            const kids = el.children || [];
            for (let i = 0; i < kids.length; i++) {
                const child = kids[i];
                const childCls = String(child.className || '');
                if (childCls.indexOf(DECOR_CLASS) !== -1 || childCls.indexOf(BIGS_IDLE_CLASS) !== -1) continue;
                stack.push(child);
            }
            if (el === tr) continue;
            const own = directText(el);
            if (own && /\bdisabled\b/i.test(own)) return true;
            const label = el.getAttribute ? String(el.getAttribute('aria-label') || el.getAttribute('title') || '') : '';
            if (/\bdisabled\b/i.test(label)) return true;
        }
        return false;
    }

    // A Customer Returns station reads like:
    //   Customer Returns
    //   1st Half: Station 3-06 | 2nd Half: Station 3-70
    // Waterspiders and other roles on the same line are not stations.
    // CRETS Waterspider and both CRETS EOL rows stay on the board.
    // Their time stays out of the BIGS Line + Line Support idle percent.
    function excludedFromBigsIdle(text) {
        const t = String(text || '').replace(/\s+/g, ' ');
        if (!/\bcrets?\b/i.test(t)) return false;
        if (/water\s*spider/i.test(t)) return true;
        if (/\beol\b/i.test(t) || /end\s+of\s+line/i.test(t)) return true;
        return false;
    }

    function isCustomerReturnsStation(text) {
        const t = String(text || '').replace(/\s+/g, ' ').trim();
        const split = t.match(/^(.*?)\s*1st\s*half\b/i);
        const area = (split ? split[1] : t).trim();
        return /^customer\s+returns$/i.test(area);
    }

    function formatOpenStation(text) {
        const t = String(text || '').replace(/\s+/g, ' ').trim();
        const match = t.match(/1st\s*half:?\s*(.*?)\s*\|\s*2nd\s*half:?\s*(.*?)$/i);
        function code(value) {
            const hit = String(value || '').match(/(\d+)\s*-\s*(\d+)/);
            if (hit) return hit[1] + '-' + hit[2];
            return String(value || '').replace(/\bstation\b/ig, '').replace(/customer\s+returns/ig, '').replace(/\s+/g, ' ').trim();
        }
        if (!match) return code(t);
        const parts = [];
        if (code(match[1])) parts.push('1st Half ' + code(match[1]));
        if (code(match[2])) parts.push('2nd Half ' + code(match[2]));
        return parts.join(' | ');
    }

    // Board cells read "1st Half: Station 4-23 | 2nd Half: Station 4-49" and wrap
    // wherever the column runs out. Every Customer Returns row gets the same 3 lines.
    function customerReturnsLines(text) {
        const cleaned = cleanStationText(text);
        if (!isCustomerReturnsStation(cleaned)) return null;
        const match = cleaned.match(/1st\s*half:?\s*(.*?)(?:\s*\|\s*|\s+)(?=2nd\s*half\b)\s*2nd\s*half:?\s*(.*)$/i);
        if (!match) return null;
        function halfLine(label, value) {
            const raw = String(value || '').replace(/\s+/g, ' ').trim();
            const code = raw.match(/(\d+)\s*-\s*(\d+)/);
            if (code) return label + ': Station ' + code[1] + '-' + code[2];
            const rest = raw.replace(/^station\b\s*/i, '').trim();
            if (!rest || /^none$/i.test(rest)) return label + ': None';
            return label + ': Station ' + rest;
        }
        return [
            'Customer Returns',
            halfLine('1st Half', match[1]),
            halfLine('2nd Half', match[2])
        ];
    }

    function customerReturnsCopy(lines) {
        if (!lines || lines.length < 3) return '';
        return 'Customer returns ' + lines[1] + ' | ' + lines[2];
    }

    function armStationCopy(block) {
        if (!block || block.getAttribute('data-mem3-copy') === '1') return;
        block.setAttribute('data-mem3-copy', '1');
        block.style.cursor = 'pointer';
        if (!block.title) block.title = 'Click to copy';
        block.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const text = block.getAttribute('data-copy') || '';
            if (!text) return;
            copyText(text).then(function () {
                block.title = 'Copied';
                setTimeout(function () {
                    if (block.title === 'Copied') block.title = 'Click to copy';
                }, 1200);
            }).catch(function () {
                block.title = 'Copy failed';
                setTimeout(function () {
                    if (block.title === 'Copy failed') block.title = 'Click to copy';
                }, 1500);
            });
        });
    }

    function findStationNode(root) {
        let best = null;
        function visit(el) {
            const kids = el.children || [];
            for (let i = 0; i < kids.length; i++) {
                const child = kids[i];
                const cls = String(child.className || '');
                if (cls.indexOf('mem3-cr-station') !== -1 || cls.indexOf(DECOR_CLASS) !== -1 || cls.indexOf(BIGS_IDLE_CLASS) !== -1) continue;
                const text = textSkipping(child, 'mem3-cr-station');
                if (!isCustomerReturnsStation(text) || !/1st\s*half/i.test(text)) continue;
                best = child;
                visit(child);
            }
        }
        visit(root);
        return best;
    }

    function customerReturnsCell(tr) {
        if (!tr || !tr.querySelectorAll) return null;
        const tds = tr.querySelectorAll('td');
        let fallback = null;
        for (let i = 0; i < tds.length; i++) {
            const text = textSkipping(tds[i], 'mem3-cr-station');
            if (!isCustomerReturnsStation(text)) continue;
            if (findStationNode(tds[i])) return tds[i];
            if (!fallback) fallback = tds[i];
        }
        return fallback;
    }

    function hideStationSource(el) {
        if (!el || !el.style) return;
        el.setAttribute('data-mem3-cr-hidden', '1');
        el.setAttribute('aria-hidden', 'true');
        el.style.position = 'absolute';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.overflow = 'hidden';
        el.style.clip = 'rect(0, 0, 0, 0)';
        el.style.whiteSpace = 'nowrap';
        el.style.padding = '0';
        el.style.margin = '0';
        el.style.pointerEvents = 'none';
    }

    function restoreStationSource(el) {
        if (!el || !el.style) return;
        el.removeAttribute('data-mem3-cr-hidden');
        el.removeAttribute('aria-hidden');
        el.style.position = '';
        el.style.width = '';
        el.style.height = '';
        el.style.overflow = '';
        el.style.clip = '';
        el.style.whiteSpace = '';
        el.style.padding = '';
        el.style.margin = '';
        el.style.pointerEvents = '';
    }

    function copyStationFont(from, to) {
        if (!window.getComputedStyle || !from || !to || !to.style) return;
        let cs = null;
        try { cs = window.getComputedStyle(from); } catch (e) { cs = null; }
        if (!cs) return;
        if (cs.fontSize && cs.fontSize !== '0px') to.style.fontSize = cs.fontSize;
        if (cs.fontWeight) to.style.fontWeight = cs.fontWeight;
        if (cs.fontFamily) to.style.fontFamily = cs.fontFamily;
        if (cs.color) to.style.color = cs.color;
    }

    function fillStationBlock(block, lines) {
        while (block.firstChild) block.removeChild(block.firstChild);
        for (let i = 0; i < lines.length; i++) {
            const row = document.createElement('div');
            row.textContent = lines[i];
            row.style.whiteSpace = 'nowrap';
            block.appendChild(row);
        }
    }

    // Each line is its own table, so a wide Assignment column pushes that line's
    // photos to the right of the line above. Lock the two-column tables to one width.
    function pinAssignmentColumn(cell) {
        if (!cell || !cell.style) return;
        cell.style.width = '13em';
        cell.style.maxWidth = '13em';
        cell.style.boxSizing = 'border-box';
        const table = cell.closest && cell.closest('table');
        if (!table || !table.style || !table.querySelectorAll) return;
        const rows = table.querySelectorAll('tr');
        let twoCol = false;
        for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].children || [];
            if (cells.length > 2) return;
            if (cells.length === 2) twoCol = true;
        }
        if (!twoCol) return;
        table.style.tableLayout = 'fixed';
        table.style.width = '100%';
        for (let i = 0; i < rows.length; i++) {
            const first = rows[i].children && rows[i].children[0];
            if (!first || !first.style) continue;
            const span = Number(first.getAttribute && first.getAttribute('colspan') || 1);
            if (span > 1) continue;
            first.style.width = '13em';
            first.style.maxWidth = '13em';
            first.style.boxSizing = 'border-box';
        }
    }

    function layoutCustomerReturns(tr) {
        if (!tr) return;
        const cell = customerReturnsCell(tr);
        const stale = tr.querySelectorAll ? tr.querySelectorAll('.mem3-cr-station') : [];
        if (!cell) {
            for (let i = 0; i < stale.length; i++) stale[i].remove();
            const hidden = tr.querySelectorAll ? tr.querySelectorAll('[data-mem3-cr-hidden]') : [];
            for (let i = 0; i < hidden.length; i++) restoreStationSource(hidden[i]);
            return;
        }
        const source = findStationNode(cell) || cell;
        const lines = customerReturnsLines(textSkipping(source, 'mem3-cr-station'));
        if (!lines) return;
        const sig = lines.join('\n');
        const copyValue = customerReturnsCopy(lines);
        let block = source.nextElementSibling;
        if (!block || String(block.className || '').indexOf('mem3-cr-station') === -1) {
            const parent = source.parentElement || cell;
            const kids = parent.children || [];
            block = null;
            for (let i = 0; i < kids.length; i++) {
                if (String(kids[i].className || '').indexOf('mem3-cr-station') !== -1) {
                    block = kids[i];
                    break;
                }
            }
        }
        const hiddenOk = source !== cell && source.getAttribute && source.getAttribute('data-mem3-cr-hidden') === '1';
        const flatOk = source === cell && cell.getAttribute && cell.getAttribute('data-mem3-cr-flat') === '1';
        pinAssignmentColumn(cell);
        if (block && block.getAttribute('data-sig') === sig && (hiddenOk || flatOk)) {
            block.setAttribute('data-copy', copyValue);
            armStationCopy(block);
            return;
        }
        if (!block) {
            block = document.createElement('div');
            block.className = 'mem3-cr-station';
            const parent = source.parentElement || cell;
            if (source !== cell && parent.insertBefore) parent.insertBefore(block, source);
            else if (cell.insertBefore) cell.insertBefore(block, cell.firstChild);
            else cell.appendChild(block);
        } else if (source !== cell && source.parentElement && block.parentElement === source.parentElement && block !== source.nextElementSibling) {
            source.parentElement.insertBefore(block, source);
        }
        block.className = 'mem3-cr-station';
        block.setAttribute('data-sig', sig);
        block.setAttribute('data-copy', copyValue);
        block.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; gap:1px; ' +
            'line-height:1.3; cursor:pointer;';
        copyStationFont(source, block);
        fillStationBlock(block, lines);
        armStationCopy(block);
        if (source !== cell) hideStationSource(source);
        else {
            const kids = cell.children || [];
            for (let i = 0; i < kids.length; i++) {
                if (kids[i] === block) continue;
                hideStationSource(kids[i]);
            }
            cell.setAttribute('data-mem3-cr-flat', '1');
            cell.style.fontSize = '0';
            cell.style.lineHeight = '0';
            if (!block.style.fontSize) block.style.fontSize = '13px';
            block.style.lineHeight = '1.3';
        }
    }

    function layoutAllCustomerReturns() {
        const tables = document.querySelectorAll('table');
        for (let t = 0; t < tables.length; t++) {
            const table = tables[t];
            if (table.closest && table.closest('#' + FLOOR_SUMMARY_ID)) continue;
            const trs = tableRows(table);
            for (let i = 0; i < trs.length; i++) layoutCustomerReturns(trs[i]);
        }
    }

    function badgeHost(el, tr) {
        if (!el) {
            const tds = tr.querySelectorAll('td');
            return tds.length > 1 ? tds[1] : tds[0] || tr;
        }
        if (el.tagName === 'TD') return el;
        return el.parentElement || el;
    }

    function shownTenth(n) {
        if (n === null || n === undefined || !isFinite(n)) return null;
        return Number(n.toFixed(1));
    }

    function uphColor(uph, bigs) {
        const shown = shownTenth(uph);
        if (shown === null || shown <= 0) return '#8b949e';
        if (bigs) {
            if (shown >= 19) return '#2ea043';
            if (shown >= 16) return '#d29922';
            return '#f85149';
        }
        if (shown >= UPH_TARGET) return '#2ea043';
        if (shown >= UPH_TARGET * 0.75) return '#d29922';
        return '#f85149';
    }

    function idleColor(pct) {
        const shown = shownTenth(pct);
        if (shown === null) return '#8b949e';
        if (shown < 22) return '#2ea043';
        if (shown <= 24) return '#d29922';
        return '#f85149';
    }

    function sideIdlePct(idleMin, clockedMin) {
        if (!(clockedMin > 0)) return null;
        return (idleMin / clockedMin) * 100;
    }

    function idleLabel(pct) {
        return pct === null ? '\u2014' : pct.toFixed(1) + '%';
    }

    function installPulseStyles() {
        let style = document.getElementById('mem3-pulse-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'mem3-pulse-style';
            document.head.appendChild(style);
        }
        style.textContent = '' +
            '@keyframes mem3PulseGreen { 0%, 100% { box-shadow: 0 0 0 2px #3fb950; }' +
            ' 50% { box-shadow: 0 0 0 4px #7ee787; } }' +
            '@keyframes mem3PulseRed { 0%, 100% { box-shadow: 0 0 0 2px #f85149; }' +
            ' 50% { box-shadow: 0 0 0 4px #ffa198; } }' +
            '.mem3-pulse-best { border-radius: 6px; padding: 0 4px;' +
            ' animation: mem3PulseGreen 1.4s ease-in-out infinite; }' +
            '.mem3-pulse-worst { border-radius: 6px; padding: 0 4px;' +
            ' animation: mem3PulseRed 1.4s ease-in-out infinite; }' +
            '@keyframes mem3YieldPulse { 0%, 100% { transform: scale(1); opacity: 1; }' +
            ' 50% { transform: scale(1.22); opacity: 0.55; } }' +
            '.mem3-yield-mark { display:inline-flex; transform-origin:center; }' +
            '.mem3-idle-now { animation: mem3YieldPulse 1.05s ease-in-out infinite; }' +
            '.mem3-extended-break { animation: none; }' +
            '@keyframes mem3EngagePulse { 0%, 100% { background:#f85149; color:#ffffff; }' +
            ' 50% { background:#ffa198; color:#3d0c0c; } }' +
            '.mem3-engage-pulse { animation: mem3EngagePulse 1.05s ease-in-out infinite; }' +
            '.mem3-yield { position:relative; display:inline-flex; flex:0 0 auto; cursor:default; }' +
            '.mem3-yield-tip { display:none; position:absolute; left:50%; bottom:calc(100% + 8px);' +
            ' transform:translateX(-50%); z-index:30; padding:8px 12px; text-align:left;' +
            ' background:#0d1117; color:#ffffff; border:1px solid #8b949e; border-radius:8px;' +
            ' font:700 14px Segoe UI,system-ui,sans-serif; pointer-events:none; white-space:normal; }' +
            '.mem3-yield-title { display:block; margin-bottom:2px; font-size:11px; font-weight:800;' +
            ' letter-spacing:0.06em; text-transform:uppercase; color:#8b949e; }' +
            '.mem3-yield-pct { display:block; font-size:16px; font-weight:800; white-space:nowrap; }' +
            '.mem3-yield-sub { display:block; margin-top:8px; font-size:11px; font-weight:800;' +
            ' letter-spacing:0.04em; text-transform:uppercase; color:#8b949e; }' +
            '.mem3-yield-station { display:block; margin-top:3px; font-size:14px; font-weight:700; white-space:nowrap; }' +
            '.mem3-yield-click { cursor:pointer; }' +
            '.mem3-yield-tip.mem3-yield-hover-open { display:block; position:fixed; left:0; top:0; bottom:auto;' +
            ' transform:none; z-index:2147483646; pointer-events:auto; overflow-x:hidden; overflow-y:auto; }' +
            '.mem3-yield-open { display:block; position:fixed; left:50%; top:50%; bottom:auto;' +
            ' transform:translate(-50%, -50%); z-index:2147483646; pointer-events:auto;' +
            ' max-height:min(70vh, 520px); overflow:auto; min-width:260px; }' +
            '.mem3-clock-ring { pointer-events:none; }';
    }

    function shownUph(line) {
        return line.avgUph > 0 ? shownTenth(line.avgUph) : null;
    }

    function shownIdle(line) {
        return shownTenth(sideIdlePct(line.idleMin || 0, line.clockedMin || 0));
    }

    function extremeRanks(lines) {
        let bestUph = null, worstUph = null, bestIdle = null, worstIdle = null;
        for (let i = 0; i < lines.length; i++) {
            const uph = shownUph(lines[i]);
            const idleShown = shownIdle(lines[i]);
            if (uph !== null) {
                if (bestUph === null || uph > bestUph) bestUph = uph;
                if (lines[i].name !== 'BIGS' && (worstUph === null || uph < worstUph)) worstUph = uph;
            }
            if (idleShown !== null) {
                if (bestIdle === null || idleShown < bestIdle) bestIdle = idleShown;
                if (worstIdle === null || idleShown > worstIdle) worstIdle = idleShown;
            }
        }
        if (bestUph === worstUph) { bestUph = null; worstUph = null; }
        if (bestIdle === worstIdle) { bestIdle = null; worstIdle = null; }
        return { bestUph: bestUph, worstUph: worstUph, bestIdle: bestIdle, worstIdle: worstIdle };
    }

    function metricRank(shown, best, worst) {
        if (shown === null) return '';
        if (best !== null && shown === best) return 'best';
        if (worst !== null && shown === worst) return 'worst';
        return '';
    }

    function uphHighlight(line, ranks) {
        const shown = shownUph(line);
        if (shown === null || !ranks) return '';
        if (ranks.bestUph !== null && shown === ranks.bestUph) return 'best';
        if (line && line.name === 'BIGS') return '';
        if (ranks.worstUph !== null && shown === ranks.worstUph) return 'worst';
        return '';
    }

    function makePill(text, color, fontSize) {
        const span = document.createElement('span');
        span.textContent = text;
        span.style.cssText = 'display:inline-block; padding:2px 9px; border-radius:12px; ' +
            'background:' + color + '33; color:#ffffff; border:1px solid ' + color + '; ' +
            'font-weight:700; font-size:' + fontSize + 'px; font-family:Segoe UI,system-ui,sans-serif; ' +
            'white-space:nowrap;';
        return span;
    }

    function showsIdle(time) {
        return idlePercent(time) !== null;
    }

    function coverageText(both, identified) {
        if (!identified) return '0% both';
        return Math.round((both / identified) * 100) + '% both';
    }

    function timeProgress() {
        let done = 0;
        for (let i = 0; i < BOARD_IDS.length; i++) {
            if (timeFinished(BOARD_IDS[i])) done++;
        }
        return { done: done, total: BOARD_IDS.length };
    }

    function paintProgress() {
        const el = document.getElementById('mem3-idle-progress');
        const p = timeProgress();
        const idleGoing = !!TIME_LOADING;
        if (el) {
            const label = el.querySelector('[data-label]');
            const fill = el.querySelector('[data-fill]');
            const pct = p.total ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
            if (label) label.textContent = p.total ? ('Calculating Idle Time Percent ' + p.done + ' / ' + p.total) : 'Calculating Idle Time Percent';
            if (fill) fill.style.width = pct + '%';
            el.style.display = (idleGoing && p.total > 0) ? 'block' : 'none';
        }
        const breaks = document.getElementById('mem3-break-progress');
        if (breaks) {
            const b = extendedCalcProgress();
            const breakLabel = breaks.querySelector('[data-label]');
            const breakFill = breaks.querySelector('[data-fill]');
            const breakPct = b.total ? Math.min(100, Math.round((b.done / b.total) * 100)) : 0;
            if (breakLabel) {
                breakLabel.textContent = b.total
                    ? ('Calculating Extended Breaks ' + b.done + ' / ' + b.total)
                    : 'Calculating Extended Breaks';
            }
            if (breakFill) breakFill.style.width = breakPct + '%';
            breaks.style.display = (BREAK_RUNNING && !idleGoing && b.total > 0) ? 'block' : 'none';
        }
        paintIssueIcon();
    }

    let progressTimer = null;
    function noteTimeProgress() {
        paintProgress();
    }

    function collectMountDebug() {
        const node = document.getElementById(FLOOR_SUMMARY_ID);
        const bar = findToolbar();
        const headers = {};
        const panels = panelEntries();
        for (let i = 0; i < panels.length; i++) {
            const label = panels[i].labels[0];
            const h = findH5(label);
            const table = h ? findTable(h) : null;
            headers[panels[i].name] = {
                headerFound: !!h,
                tableFound: !!table,
                rows: table ? table.querySelectorAll('tbody tr').length : 0
            };
        }
        return {
            version: SCRIPT_VERSION,
            href: location.href,
            pathname: location.pathname,
            readyState: document.readyState,
            hasBody: !!document.body,
            isAssignmentsPage: isAssignmentsPage(),
            assignmentsReady: assignmentsReady(),
            boardStarted: boardStarted,
            toolbarFound: !!bar,
            toolbarTag: bar ? (bar.tagName || '') : '',
            summaryPresent: !!node,
            summaryHasChildren: !!(node && node.firstChild),
            summaryChildCount: node ? node.childNodes.length : 0,
            summaryParent: node && node.parentElement ? node.parentElement.tagName : null,
            lastRollupAt: LAST_ROLLUP_AT ? LAST_ROLLUP_AT.toISOString() : null,
            hasLastSummary: !!LAST_SUMMARY,
            lastRunError: DEBUG.lastRunError,
            lastStatus: DEBUG.lastStatus,
            identityCount: IDENTITY.count,
            gmClipboard: typeof GM_setClipboard,
            runPanelPresent: !!document.getElementById('mem3-run-panel'),
            fclmDown: FCLM_DOWN,
            lastGm: DEBUG.lastGm || null,
            headers: headers
        };
    }

    function collectCornerDebug() {
        const out = { script: SCRIPT_LABEL, what: 'corner-debug', version: SCRIPT_VERSION };
        try { out.mount = collectMountDebug(); }
        catch (e) { out.mountError = (e && e.message) ? e.message : String(e); }
        try { out.summary = collectSummaryDebug(); }
        catch (e) { out.summaryError = (e && e.message) ? e.message : String(e); }
        return out;
    }

    function roundRect(r) {
        return {
            x: Math.round(r.left * 10) / 10,
            y: Math.round(r.top * 10) / 10,
            w: Math.round(r.width * 10) / 10,
            h: Math.round(r.height * 10) / 10
        };
    }

    function describeBox(el) {
        if (!el || !el.getBoundingClientRect) return null;
        const r = el.getBoundingClientRect();
        let cs = null;
        cs = pageComputedStyle(el);
        const out = {
            tag: el.tagName || '',
            id: el.id || '',
            className: clip(el.className && el.className.baseVal != null ? el.className.baseVal : el.className, 80),
            rect: roundRect(r)
        };
        if (cs) {
            out.radius = cs.borderRadius;
            out.overflow = cs.overflow + '/' + cs.overflowX + '/' + cs.overflowY;
            out.fit = cs.objectFit;
            out.pos = cs.position;
            out.pad = cs.padding;
            out.border = cs.borderTopWidth + ' ' + cs.borderTopColor;
            out.shadow = cs.boxShadow && cs.boxShadow !== 'none' ? clip(cs.boxShadow, 120) : '';
            out.outline = cs.outline && cs.outline !== 'none' ? clip(cs.outline + ' / ' + cs.outlineOffset, 80) : '';
            out.bg = cs.backgroundImage && cs.backgroundImage !== 'none' ? clip(cs.backgroundImage, 100) : '';
        }
        if (el.tagName === 'IMG') {
            out.natural = (el.naturalWidth || 0) + 'x' + (el.naturalHeight || 0);
            out.src = clip(el.currentSrc || el.src || '', 80);
        }
        return out;
    }

    function avatarParentChain(el, stop) {
        const out = [];
        let node = el;
        let hops = 0;
        while (node && node !== stop && hops < 8) {
            const r = node.getBoundingClientRect();
            if (r.width <= 220 && r.height <= 220) out.push(describeBox(node));
            node = node.parentElement;
            hops++;
        }
        return out;
    }

    function collectRowPhotoDebug(tr) {
        const found = findLoginInRow(tr);
        const login = found ? found.login : '';
        const rings = tr.querySelectorAll('.mem3-clock-ring');
        const imgs = tr.querySelectorAll('img');
        const avatar = avatarEl(tr);
        const host = avatar ? (avatar.closest('td') || tr) : (tr.querySelector('td') || tr);
        const person = login ? IDENTITY.byLogin[login] : null;
        const status = clockFor(person, resolveEmpId(person));
        const station = clip((tr.innerText || '').replace(/\s+/g, ' ').trim(), 80);
        const row = {
            login: login,
            station: station,
            status: status || '',
            imgCount: imgs.length,
            ringCount: rings.length,
            avatar: describeBox(avatar),
            host: describeBox(host),
            chain: avatar ? avatarParentChain(avatar, tr) : [],
            rings: []
        };
        if (avatar) {
            const ar = avatar.getBoundingClientRect();
            row.avatarSize = Math.round(Math.min(ar.width, ar.height) * 10) / 10;
        }
        for (let i = 0; i < rings.length; i++) {
            const ring = rings[i];
            const rr = ring.getBoundingClientRect();
            const item = describeBox(ring);
            item.styleLeft = ring.style.left;
            item.styleTop = ring.style.top;
            item.styleWidth = ring.style.width;
            item.styleHeight = ring.style.height;
            if (avatar) {
                const ar = avatar.getBoundingClientRect();
                item.dx = Math.round((rr.left + rr.width / 2 - (ar.left + ar.width / 2)) * 10) / 10;
                item.dy = Math.round((rr.top + rr.height / 2 - (ar.top + ar.height / 2)) * 10) / 10;
                item.dw = Math.round((rr.width - Math.min(ar.width, ar.height)) * 10) / 10;
            }
            row.rings.push(item);
        }
        const extraImgs = [];
        for (let i = 0; i < imgs.length && extraImgs.length < 4; i++) extraImgs.push(describeBox(imgs[i]));
        row.imgs = extraImgs;
        return row;
    }

    function collectPhotoDebug() {
        const rows = document.querySelectorAll('table tbody tr');
        const withRing = [];
        const leftoverEmpty = [];
        const noAvatar = [];
        const offCenter = [];
        let signed = 0;
        let avatars = 0;
        let rings = 0;
        for (let i = 0; i < rows.length; i++) {
            const tr = rows[i];
            if (tr.closest('#' + FLOOR_SUMMARY_ID)) continue;
            const found = findLoginInRow(tr);
            const ringNodes = tr.querySelectorAll('.mem3-clock-ring, [data-mem3-clock]');
            if (found) signed++;
            if (found && avatarEl(tr)) avatars++;
            if (ringNodes.length) rings++;
            if (!found && ringNodes.length) {
                leftoverEmpty.push(collectRowPhotoDebug(tr));
                continue;
            }
            if (!found) continue;
            const row = collectRowPhotoDebug(tr);
            if (!row.avatar && noAvatar.length < 8) noAvatar.push(row);
            if ((row.ringCount || (row.avatar && row.avatar.outline)) && withRing.length < 16) withRing.push(row);
            if (row.rings[0] && (Math.abs(row.rings[0].dx) > 1.5 || Math.abs(row.rings[0].dy) > 1.5) && offCenter.length < 8) {
                offCenter.push(row);
            }
        }
        return {
            script: SCRIPT_LABEL,
            what: 'photo-debug',
            version: SCRIPT_VERSION,
            logic: {
                pick: 'badgephotos background-image div first, else square bg-image, else img',
                host: 'ring is a child covering the photo (inset 0)',
                ring: 'box-shadow 0 0 0 6px, concentric, outside the face',
                place: 'photo stays 32px circle with background-size cover'
            },
            clock: { loadedAt: CLOCK.loadedAt, rows: CLOCK.rows, keys: CLOCK.keys, error: CLOCK.lastError },
            counts: {
                tableRows: rows.length,
                signed: signed,
                avatars: avatars,
                rowsWithRing: rings,
                leftoverEmpty: leftoverEmpty.length,
                noAvatar: noAvatar.length,
                offCenter: offCenter.length
            },
            leftoverEmpty: leftoverEmpty,
            noAvatar: noAvatar,
            offCenter: offCenter,
            sampleWithRing: withRing
        };
    }

    function breakDebug() {
        let withClock = 0;
        let sample = null;
        for (let i = 0; i < BOARD_IDS.length; i++) {
            const id = BOARD_IDS[i];
            const time = LAST_TIME[id];
            if (!time) continue;
            if (!sample && time.rowSample) sample = { empId: id, row: time.rowSample };
            const segs = time.segments || [];
            for (let s = 0; s < segs.length; s++) {
                if (segs[s] && segs[s].startMin != null) { withClock++; break; }
            }
        }
        let count = 0;
        let pct = 100;
        try {
            const stats = extendedBreakStats(BOARD_IDS);
            count = stats.count;
            pct = stats.pct;
        } catch (e) { /* the floor copy still returns the rest */ }
        return { count: count, engagedPct: pct, withClock: withClock, rowSample: sample };
    }

    function collectSummaryDebug() {
        const progress = timeProgress();
        let withTime = 0;
        let noData = 0;
        let failed = 0;
        let retrying = 0;
        for (let i = 0; i < BOARD_IDS.length; i++) {
            const id = BOARD_IDS[i];
            const t = LAST_TIME[id];
            if (t && t.hasTime) withTime++;
            else if (t && t.noData) noData++;
            else if ((TIME_TRIES[id] || 0) >= MAX_TIME_TRIES) failed++;
            else retrying++;
        }
        return {
            script: SCRIPT_LABEL,
            progress: progress,
            withTime: withTime,
            noData: noData,
            failed: failed,
            retrying: retrying,
            maxTries: MAX_TIME_TRIES,
            timeLoad: DEBUG.timeLoad || null,
            boardIds: BOARD_IDS.length,
            sides: DEBUG.perLine,
            summary: LAST_SUMMARY,
            version: SCRIPT_VERSION,
            mount: collectMountDebug(),
            page: { url: location.href, readyState: document.readyState },
            runtime: {
                startedAt: DEBUG.startedAt,
                lastRunError: DEBUG.lastRunError,
                lastStatus: DEBUG.lastStatus,
                rollupSize: DEBUG.rollupSize,
                identityCount: IDENTITY.count,
                shiftWindow: getShiftWindow(),
                clock: { loadedAt: CLOCK.loadedAt, rows: CLOCK.rows, keys: CLOCK.keys, error: CLOCK.lastError }
            },
            rollup: { functions: DEBUG.rollupFunctions },
            matching: { perLine: DEBUG.perLine, sampleMatched: DEBUG.sampleMatched },
            breaks: breakDebug(),
            logs: DEBUG.logs,
            unassign: {
                anchors: associateAnchors().length,
                log: UNASSIGN_LOG
            }
        };
    }

    function clearDecorations() {
        const nodes = document.querySelectorAll('.' + DECOR_CLASS + ', .' + BIGS_IDLE_CLASS + ', .' + SECTION_BADGE_CLASS + ', body > .mem3-yield-hover-open');
        for (let i = 0; i < nodes.length; i++) nodes[i].remove();
    }

    function placeBadgeCell(el, col, row) {
        el.style.gridColumn = String(col);
        el.style.gridRow = String(row);
        el.style.justifySelf = 'start';
    }

    function badgeGridStyle(withYield) {
        const cols = withYield ? 'max-content max-content' : 'max-content';
        return 'display:inline-grid; grid-template-columns:' + cols + '; ' +
            'grid-template-rows:auto auto auto; column-gap:6px; row-gap:4px; margin-left:8px; ' +
            'vertical-align:middle; flex:0 0 auto; align-self:center; align-items:center;';
    }

    let cursorTipNode = null;
    let cursorTipHold = null;

    function cursorTipEl() {
        if (cursorTipNode && cursorTipNode.parentNode) return cursorTipNode;
        cursorTipNode = document.createElement('div');
        cursorTipNode.id = 'mem3-cursor-tip';
        cursorTipNode.style.cssText = 'position:fixed; z-index:2147483647; display:none; pointer-events:none; ' +
            'padding:3px 7px; border-radius:4px; background:#161b22; color:#ffffff; ' +
            'border:1px solid #8b949e; font:600 12px Segoe UI,system-ui,sans-serif; ' +
            'line-height:1.25; white-space:nowrap;';
        (document.body || document.documentElement).appendChild(cursorTipNode);
        return cursorTipNode;
    }

    function moveCursorTip(x, y) {
        const tip = cursorTipEl();
        tip.style.display = 'block';
        let left = x + 12;
        let top = y + 18;
        const rect = tip.getBoundingClientRect();
        if (left + rect.width > window.innerWidth - 4) left = Math.max(4, x - rect.width - 12);
        if (top + rect.height > window.innerHeight - 4) top = Math.max(4, y - rect.height - 12);
        tip.style.left = Math.round(left) + 'px';
        tip.style.top = Math.round(top) + 'px';
    }

    function holdNativeTitles(from) {
        const saved = [];
        let node = from;
        while (node && node !== document.body && node !== document.documentElement) {
            if (node.getAttribute && node.hasAttribute('title')) {
                saved.push({ el: node, title: node.getAttribute('title') });
                node.removeAttribute('title');
            }
            node = node.parentElement;
        }
        return saved;
    }

    function releaseNativeTitles(saved) {
        if (!saved) return;
        for (let i = 0; i < saved.length; i++) {
            const item = saved[i];
            if (item.el && item.el.setAttribute) item.el.setAttribute('title', item.title);
        }
    }

    function showCursorTip(text, x, y, from) {
        const tip = cursorTipEl();
        if (tip.textContent !== text) tip.textContent = text;
        if (!cursorTipHold) cursorTipHold = holdNativeTitles(from);
        moveCursorTip(x, y);
    }

    function hideCursorTip() {
        if (cursorTipNode) cursorTipNode.style.display = 'none';
        releaseNativeTitles(cursorTipHold);
        cursorTipHold = null;
    }

    function bindCursorTip(el, text) {
        if (!el || !text) return;
        el.addEventListener('mouseenter', function (e) {
            showCursorTip(text, e.clientX, e.clientY, el);
        });
        el.addEventListener('mousemove', function (e) {
            showCursorTip(text, e.clientX, e.clientY, el);
        });
        el.addEventListener('mouseleave', hideCursorTip);
    }

    function fullNameForLogin(login) {
        const key = String(login || '').trim().toLowerCase();
        if (!key) return '';
        const ident = IDENTITY.byLogin[key];
        const raw = ident && ident.name ? String(ident.name).trim() : '';
        if (!raw) return '';
        const pretty = swapPersonName(raw) || raw;
        if (!pretty || pretty.toLowerCase() === key) return '';
        return pretty;
    }

    function bindLoginNameTip(el, login) {
        if (!el) return;
        const name = fullNameForLogin(login);
        if (!name) return;
        el.setAttribute('data-mem3-name-tip', name);
        if (el.getAttribute('data-mem3-name-bound') === '1') return;
        el.setAttribute('data-mem3-name-bound', '1');
        el.addEventListener('mouseenter', function (e) {
            const label = el.getAttribute('data-mem3-name-tip') || '';
            if (label) showCursorTip(label, e.clientX, e.clientY, el);
        });
        el.addEventListener('mousemove', function (e) {
            const label = el.getAttribute('data-mem3-name-tip') || '';
            if (label) showCursorTip(label, e.clientX, e.clientY, el);
        });
        el.addEventListener('mouseleave', hideCursorTip);
    }

    function yieldTriangle(color, label, pulse) {
        const mark = document.createElement('span');
        mark.className = 'mem3-yield-mark ' + (pulse ? 'mem3-idle-now' : 'mem3-extended-break');
        mark.style.marginLeft = '0';
        mark.style.pointerEvents = 'none';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 22');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '18');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.pointerEvents = 'none';
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', '12,1.2 22.6,20.8 1.4,20.8');
        poly.setAttribute('fill', color);
        poly.style.pointerEvents = 'fill';
        poly.style.cursor = 'default';
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', '10.7');
        bar.setAttribute('y', '7');
        bar.setAttribute('width', '2.6');
        bar.setAttribute('height', '7');
        bar.setAttribute('rx', '0.6');
        bar.setAttribute('fill', '#0d1117');
        bar.style.pointerEvents = 'none';
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', '12');
        dot.setAttribute('cy', '17.2');
        dot.setAttribute('r', '1.35');
        dot.setAttribute('fill', '#0d1117');
        dot.style.pointerEvents = 'none';
        svg.appendChild(poly);
        svg.appendChild(bar);
        svg.appendChild(dot);
        mark.appendChild(svg);
        if (label) bindCursorTip(poly, label);
        return mark;
    }

    function yieldSlot() {
        const slot = document.createElement('span');
        slot.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; ' +
            'width:22px; height:20px; flex:0 0 auto; pointer-events:none;';
        return slot;
    }

    function rowYieldSlots(time, empId) {
        const top = yieldSlot();
        const bottom = yieldSlot();
        const person = personForEmp(empId);
        const extended = extendedBreakOpen(empId, person && person.login);
        const idleNow = showsIdleNow(time, empId);
        const sig = yieldSig(time, empId);
        if (extended) {
            top.appendChild(yieldTriangle('#f85149', 'Took Extended Break', false));
            if (idleNow) {
                bottom.appendChild(yieldTriangle('#d29922', 'Currently Idle', true));
            }
        } else if (idleNow) {
            top.appendChild(yieldTriangle('#d29922', 'Currently Idle', true));
        }
        return { top: top, bottom: bottom, sig: sig };
    }

    function loosenBadgeHost(host) {
        let node = host;
        for (let i = 0; i < 4 && node && node.style; i++) {
            node.style.overflow = 'visible';
            const tag = String(node.tagName || '').toUpperCase();
            if (tag === 'TD' || tag === 'TR') break;
            node = node.parentElement;
        }
    }

    function rowHasOverride(el) {
        if (!el || !el.querySelectorAll) return false;
        const nodes = el.querySelectorAll('button, a, span, div');
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const cls = String(node.className || '');
            if (cls.indexOf(DECOR_CLASS) !== -1 || cls.indexOf(BIGS_IDLE_CLASS) !== -1) continue;
            if (/^override$/i.test(directText(node).replace(/\s+/g, ' ').trim())) return true;
        }
        return false;
    }

    function keepBadgeBesideLogin(host) {
        if (!host || !host.style) return;
        loosenBadgeHost(host);
        const tag = String(host.tagName || '').toUpperCase();
        if (tag === 'TR' || tag === 'TABLE') return;
        if (tag === 'TD') {
            host.style.overflow = 'visible';
            host.style.verticalAlign = 'middle';
            host.style.display = 'flex';
            host.style.flexDirection = 'row';
            host.style.flexWrap = 'nowrap';
            host.style.alignItems = 'center';
            return;
        }
        host.style.display = 'flex';
        host.style.flexDirection = 'row';
        host.style.flexWrap = 'nowrap';
        host.style.alignItems = 'center';
    }

    // The photo, the login, and the UPH share one horizontal center. Idle hangs under the UPH.
    function centerEmployeeLine(tr, loginEl, badge) {
        const host = (badge && badge.parentElement) || (loginEl && loginEl.parentElement);
        keepBadgeBesideLogin(host);
        if (badge && badge.style) badge.style.alignSelf = 'center';
        if (loginEl && loginEl.style) loginEl.style.alignSelf = 'center';
        const avatar = avatarEl(tr);
        if (avatar && avatar.style) avatar.style.alignSelf = 'center';
        let node = host;
        while (node && node.parentElement && node !== tr) {
            const parent = node.parentElement;
            if (avatar && parent.contains && parent.contains(avatar)) {
                keepBadgeBesideLogin(parent);
                break;
            }
            node = parent;
        }
    }

    // Override lives in the same row as the name. The grid has to be a sibling
    // of the name box, placed before Override, or a tight row wraps it under the login.
    function placeBesideLogin(tr, loginEl, badge) {
        let node = loginEl;
        while (node && node.parentElement && node.parentElement !== tr) {
            const parent = node.parentElement;
            const tag = String(parent.tagName || '').toUpperCase();
            if (tag === 'TD' || tag === 'TR' || tag === 'TABLE') break;
            if (rowHasOverride(parent) && !rowHasOverride(node)) {
                keepBadgeBesideLogin(parent);
                const before = node.nextSibling;
                if (before !== badge) {
                    if (before) parent.insertBefore(badge, before);
                    else parent.appendChild(badge);
                }
                centerEmployeeLine(tr, loginEl, badge);
                return;
            }
            node = parent;
        }
        const host = badgeHost(loginEl, tr);
        keepBadgeBesideLogin(host);
        if (badge.parentElement !== host) host.appendChild(badge);
        centerEmployeeLine(tr, loginEl, badge);
    }

    function makeBadge(stats, known, time, empId) {
        const wrap = document.createElement('span');
        wrap.className = DECOR_CLASS;
        const marks = rowYieldSlots(time, empId);
        wrap.style.cssText = badgeGridStyle(true);
        const noTime = !!(time && time.noData);
        const color = (known && stats.hasData) ? uphColor(stats.uph, personUsesBigsRate(empId)) : '#8b949e';
        const rateText = !known ? '?' : (stats.hasData ? ((stats.uph > 0 ? stats.uph.toFixed(1) : '0') + ' UPH') : uphGapText());
        const pct = idlePercent(time);
        const idleText = noTime ? windowGapText() : (idleLabel(pct) + ' IDLE');
        const nowTitle = idleNowTitle(time, empId);
        wrap.title = rateText + ' \u00b7 ' + (noTime ? windowGapText() : timeText(time)) + (nowTitle ? ' \u00b7 ' + nowTitle : '');
        const rate = makePill(rateText, color, 16.5);
        const idle = makePill(idleText, noTime ? '#8b949e' : idleColor(pct), 16.5);
        const spacer = idle.cloneNode(true);
        spacer.style.visibility = 'hidden';
        spacer.setAttribute('aria-hidden', 'true');
        placeBadgeCell(marks.top, 1, 2);
        placeBadgeCell(marks.bottom, 1, 3);
        placeBadgeCell(spacer, 2, 1);
        placeBadgeCell(rate, 2, 2);
        placeBadgeCell(idle, 2, 3);
        wrap.appendChild(marks.top);
        wrap.appendChild(marks.bottom);
        wrap.appendChild(spacer);
        wrap.appendChild(rate);
        wrap.appendChild(idle);
        wrap.setAttribute('data-sig', (known ? '1' : '0') + '|' + rateText + '|' + idleText + '|' + marks.sig);
        return wrap;
    }

    function placeRowBadge(tr, found, stats, known, time, empId) {
        const preview = makeBadge(stats, known, time, empId);
        const sig = preview.getAttribute('data-sig');
        const existing = tr.querySelector('.' + DECOR_CLASS);
        let badge = preview;
        if (existing && existing.getAttribute('data-sig') === sig) {
            badge = existing;
        } else if (existing && existing.parentNode) {
            existing.parentNode.replaceChild(preview, existing);
        }
        if (found && found.el) {
            placeBesideLogin(tr, found.el, badge);
            bindLoginNameTip(found.el, found.login);
        }
        else {
            const host = badgeHost(null, tr);
            keepBadgeBesideLogin(host);
            if (badge.parentElement !== host) host.appendChild(badge);
        }
        centerEmployeeLine(tr, found && found.el, badge);
    }

    function assignmentHasBigs(text) {
        return /\bbigs\b/i.test(String(text || ''));
    }

    function makeBigsIdleBadge(time, empId) {
        const wrap = document.createElement('span');
        wrap.className = BIGS_IDLE_CLASS;
        wrap.style.cssText = 'display:inline-grid; grid-template-columns:22px auto; grid-template-rows:20px 20px; ' +
            'column-gap:6px; align-items:center; margin-left:8px; vertical-align:middle;';
        const noTime = !!(time && time.noData);
        const pct = idlePercent(time);
        const idleText = noTime ? windowGapText() : (idleLabel(pct) + ' IDLE');
        const nowTitle = idleNowTitle(time, empId);
        wrap.title = (noTime ? windowGapText() : timeText(time)) + (nowTitle ? ' \u00b7 ' + nowTitle : '');
        const marks = rowYieldSlots(time, empId);
        placeBadgeCell(marks.top, 1, 1);
        placeBadgeCell(marks.bottom, 1, 2);
        const idlePill = makePill(idleText, noTime ? '#8b949e' : idleColor(pct), 16.5);
        placeBadgeCell(idlePill, 2, 1);
        wrap.appendChild(marks.top);
        wrap.appendChild(marks.bottom);
        wrap.appendChild(idlePill);
        wrap.setAttribute('data-sig', idleText + '|' + marks.sig);
        return wrap;
    }

    function placeBigsIdle(tr, found, time, empId) {
        if (found && found.el) bindLoginNameTip(found.el, found.login);
        const badge = makeBigsIdleBadge(time, empId);
        const sig = badge.getAttribute('data-sig');
        const existing = tr.querySelector('.' + BIGS_IDLE_CLASS);
        if (existing && existing.getAttribute('data-sig') === sig) return;
        if (existing && existing.parentNode) existing.parentNode.replaceChild(badge, existing);
        else badgeHost(found.el, tr).appendChild(badge);
    }

    function tableRows(table) {
        const body = table.querySelectorAll('tbody tr');
        if (body.length) return body;
        const all = table.querySelectorAll('tr');
        const rows = [];
        for (let i = 0; i < all.length; i++) {
            if (all[i].closest && all[i].closest('thead')) continue;
            rows.push(all[i]);
        }
        return rows;
    }

    // BIGS Line + Line Support is the BIGs column and counts in Total.
    // Any other row whose name contains BIGS keeps an idle badge only.
    function decorateBigsStations() {
        const ids = [];
        const seen = Object.create(null);
        const tables = document.querySelectorAll('table');
        for (let t = 0; t < tables.length; t++) {
            const table = tables[t];
            if (table.closest && table.closest('#' + FLOOR_SUMMARY_ID)) continue;
            const trs = tableRows(table);
            for (let i = 0; i < trs.length; i++) {
                const tr = trs[i];
                const show = assignmentHasBigs(tr.textContent) && !tr.querySelector('.' + DECOR_CLASS);
                if (!show) {
                    const leftover = tr.querySelector('.' + BIGS_IDLE_CLASS);
                    if (leftover) leftover.remove();
                    continue;
                }
                const found = findLoginInRow(tr);
                if (!found) {
                    const leftover = tr.querySelector('.' + BIGS_IDLE_CLASS);
                    if (leftover) leftover.remove();
                    continue;
                }
                const person = IDENTITY.byLogin[found.login];
                const empId = resolveEmpId(person);
                if (empId) rememberBoardPerson(empId, person, 'BIGS', rowAssignmentText(tr), badgePhotoUrl(avatarEl(tr)));
                if (empId && !seen[empId]) {
                    seen[empId] = true;
                    ids.push(empId);
                }
                placeBigsIdle(tr, found, timeFor(empId), empId);
            }
        }
        BIGS_IDS = ids;
    }

    function shortPanelName(name) {
        const line = /^LINE\s+(\d+)\s+(ODD|EVEN)/i.exec(name);
        if (line) return 'L' + line[1] + ' ' + (line[2].toUpperCase() === 'ODD' ? 'Odd' : 'Even');
        return name;
    }

    function buttonLabel(el) {
        return (el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    // The hashed css-* classes on this bar change; find it by the Section
    // button, CSV export, and login search that always sit together.
    function searchInputIn(host) {
        if (!host || !host.querySelector) return null;
        const inputs = host.querySelectorAll('input');
        for (let i = 0; i < inputs.length; i++) {
            const hint = ((inputs[i].getAttribute('placeholder') || '') + ' ' +
                (inputs[i].getAttribute('aria-label') || '') + ' ' +
                (inputs[i].getAttribute('aria-placeholder') || '')).toLowerCase();
            if (hint.indexOf('search') !== -1 || hint.indexOf('login') !== -1) return inputs[i];
        }
        return null;
    }

    function findToolbar() {
        const buttons = document.querySelectorAll('button');
        for (let i = 0; i < buttons.length; i++) {
            if (!/^section$/i.test(buttonLabel(buttons[i]))) continue;
            let host = buttons[i].parentElement;
            for (let hops = 0; host && hops < 8; hops++) {
                if (searchInputIn(host)) return host;
                host = host.parentElement;
            }
        }
        const search = searchInputIn(document);
        if (search) {
            let host = search.parentElement;
            for (let hops = 0; host && hops < 8; hops++) {
                if (host.querySelector('button')) return host;
                host = host.parentElement;
            }
        }
        return null;
    }

    function formatPageDate(d) {
        const pad = function (n) { return String(n).padStart(2, '0'); };
        return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + d.getFullYear();
    }

    function findDatePicker() {
        return document.querySelector('input[aria-placeholder="Select date"]') ||
            document.querySelector('input[id^="datepicker"]');
    }

    function pageWindow() {
        return (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
    }

    function nativeValueSetter() {
        const win = pageWindow();
        const proto = win.HTMLInputElement && win.HTMLInputElement.prototype;
        const desc = proto && (win.Object || Object).getOwnPropertyDescriptor(proto, 'value');
        return desc && desc.set ? desc.set : null;
    }

    function fireInputEvents(el, data, inputType) {
        const win = pageWindow();
        try {
            el.dispatchEvent(new win.InputEvent('input', {
                bubbles: true, cancelable: true, data: data, inputType: inputType || 'insertText'
            }));
        } catch (e) {
            el.dispatchEvent(new win.Event('input', { bubbles: true }));
        }
        el.dispatchEvent(new win.Event('change', { bubbles: true }));
    }

    function writeInputValue(el, value) {
        const setter = nativeValueSetter();
        if (el._valueTracker) {
            try { el._valueTracker.setValue(''); } catch (e) { /* ignore */ }
        }
        if (setter) setter.call(el, value);
        else el.value = value;
    }

    function typeDateValue(el, value) {
        const win = pageWindow();
        try { el.focus(); } catch (e) { /* ignore */ }
        writeInputValue(el, '');
        fireInputEvents(el, null, 'deleteContentBackward');
        let acc = '';
        for (let i = 0; i < value.length; i++) {
            acc += value[i];
            writeInputValue(el, acc);
            try {
                el.dispatchEvent(new win.KeyboardEvent('keydown', { key: value[i], bubbles: true }));
            } catch (e2) { /* ignore */ }
            fireInputEvents(el, value[i], 'insertText');
            try {
                el.dispatchEvent(new win.KeyboardEvent('keyup', { key: value[i], bubbles: true }));
            } catch (e3) { /* ignore */ }
        }
        try {
            el.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            el.dispatchEvent(new win.KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        } catch (e4) { /* ignore */ }
        try { el.blur(); } catch (e5) { /* ignore */ }
    }

    function insertTextValue(el, value) {
        try { el.focus(); } catch (e) { /* ignore */ }
        try {
            if (el.select) el.select();
            if (el.setSelectionRange) el.setSelectionRange(0, (el.value || '').length);
        } catch (e2) { /* ignore */ }
        let ok = false;
        try { ok = document.execCommand('insertText', false, value); } catch (e3) { ok = false; }
        fireInputEvents(el, value, 'insertFromPaste');
        try { el.blur(); } catch (e4) { /* ignore */ }
        return ok;
    }

    function pageClick(el) {
        if (!el) return;
        const win = pageWindow();
        const rect = el.getBoundingClientRect();
        const x = Math.round(rect.left + Math.max(1, rect.width) / 2);
        const y = Math.round(rect.top + Math.max(1, rect.height) / 2);
        const base = {
            bubbles: true, cancelable: true, composed: true, view: win,
            button: 0,
            clientX: x, clientY: y, screenX: x, screenY: y,
            pointerId: 1, pointerType: 'mouse', isPrimary: true, width: 1, height: 1
        };
        const down = {};
        const up = {};
        const keys = Object.keys(base);
        for (let i = 0; i < keys.length; i++) {
            down[keys[i]] = base[keys[i]];
            up[keys[i]] = base[keys[i]];
        }
        down.buttons = 1;
        up.buttons = 0;
        try { el.focus(); } catch (e0) { /* ignore */ }
        try {
            el.dispatchEvent(new win.PointerEvent('pointerover', up));
            el.dispatchEvent(new win.MouseEvent('mouseover', up));
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

    function makeReactClickEvent(el) {
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

    function collectReactClicks(el) {
        const fns = [];
        let fiber = reactFiber(el);
        let hops = 0;
        while (fiber && hops < 20) {
            const props = fiber.memoizedProps || fiber.pendingProps;
            if (props && typeof props.onClick === 'function' && !isMdnClickWrapper(props.onClick)) {
                fns.push(props.onClick);
            }
            fiber = fiber.return;
            hops++;
        }
        return fns;
    }

    function reactClick(el, direction) {
        const fns = collectReactClicks(el);
        if (!fns.length) return '';
        if (direction === 'inner') {
            try { fns[0](makeReactClickEvent(el)); return 'fiber'; }
            catch (e) { return 'fiber-error'; }
        }
        for (let i = fns.length - 1; i >= 0; i--) {
            try { fns[i](makeReactClickEvent(el)); }
            catch (e) { /* keep going so a closer does not hide Unassign */ }
        }
        return fns.length > 1 ? 'fiber-all' : 'fiber';
    }

    function clickUnassignButton(btn, mode) {
        if (!btn) return '';
        if (mode === 'native') {
            pageClick(btn);
            try { btn.click(); } catch (e) { /* ignore */ }
            return 'native';
        }
        if (mode === 'inner') {
            const via = reactClick(btn, 'inner');
            if (via) return via;
            pageClick(btn);
            try { btn.click(); } catch (e) { /* ignore */ }
            return 'native';
        }
        const via = reactClick(btn, 'all');
        if (via) return via;
        pageClick(btn);
        try { btn.click(); } catch (e2) { /* ignore */ }
        return 'pointer';
    }

    const UNASSIGN_PASSWORD = 'MEM3';
    let unassigning = false;
    let psHoldSeen = false;

    // The problem-solve sheet sets this while it clicks None, Assign, or Unassign.
    // Rewriting rows or the tooltip during that click keeps Control Tower from
    // painting the new station until a refresh.
    function psBoardHolding() {
        const root = document.documentElement;
        return !!(root && root.hasAttribute && root.hasAttribute('data-mem3-ps-hold'));
    }

    function notePsHold() {
        if (psBoardHolding()) {
            psHoldSeen = true;
            return;
        }
        if (!psHoldSeen) return;
        psHoldSeen = false;
        scheduleRender();
    }
    const UNASSIGN_LOG = [];

    function pushUnassignLog(entry) {
        entry.at = new Date().toISOString();
        UNASSIGN_LOG.push(entry);
        if (UNASSIGN_LOG.length > 20) UNASSIGN_LOG.shift();
    }

    function clip(value, max) {
        const text = String(value || '');
        return text.length > max ? text.slice(0, max) + '…' : text;
    }

    function describeElement(el) {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        let keys = [];
        try { keys = Object.keys(el); } catch (e) { keys = []; }
        let reactProps = null;
        let fiber = null;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (!reactProps && (key.indexOf('__reactProps') === 0 || key.indexOf('__reactEventHandlers') === 0)) {
                const props = el[key];
                let names = [];
                try { names = props ? Object.keys(props).slice(0, 40) : []; } catch (e2) { names = []; }
                reactProps = {
                    key: key,
                    propNames: names,
                    onClick: props && typeof props.onClick === 'function' ? clip(props.onClick, 400) : ''
                };
            }
            if (!fiber && (key.indexOf('__reactFiber') === 0 || key.indexOf('__reactInternalInstance') === 0)) {
                const node = el[key];
                const props = node && node.memoizedProps;
                const type = node && node.type;
                fiber = {
                    key: key,
                    type: type && (type.displayName || type.name || (typeof type === 'string' ? type : '')) || '',
                    onClick: props && typeof props.onClick === 'function' ? clip(props.onClick, 400) : ''
                };
            }
        }
        return {
            tag: el.tagName || '',
            id: el.id || '',
            text: clip((el.textContent || '').replace(/\s+/g, ' ').trim(), 120),
            visible: rect.width >= 1 && rect.height >= 1,
            rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
            outerHTML: clip(el.outerHTML, 500),
            reactProps: reactProps,
            fiber: fiber
        };
    }

    function cleanStationText(text) {
        let station = String(text || '').replace(/\s+/g, ' ').trim();
        station = station.replace(/\s+No UPH for\b.*$/i, '');
        station = station.replace(/\s+\d+(?:\.\d+)?\s+UPH\b.*$/i, '');
        station = station.replace(/\s+\d+(?:\.\d+)?%\s+IDLE\b.*$/i, '');
        station = station.replace(/\s+[—–-]\s+IDLE\b.*$/i, '');
        station = station.replace(/\s+IDLE NOW\b.*$/i, '');
        return station.replace(/\s+/g, ' ').replace(/\s*\|\s*$/, '').trim();
    }

    function unassignTarget(anchor) {
        const login = (anchor && anchor.textContent || '').replace(/\s+/g, ' ').trim();
        const person = IDENTITY.byLogin[login.toLowerCase()];
        const tr = anchor && anchor.closest ? anchor.closest('tr') : null;
        let station = tr ? String(tr.innerText || tr.textContent || '') : '';
        station = station.replace(/\s+/g, ' ').trim();
        if (login && station) {
            const idx = station.toLowerCase().lastIndexOf(login.toLowerCase());
            if (idx !== -1) station = station.slice(0, idx) + station.slice(idx + login.length);
            station = cleanStationText(station);
        }
        return {
            login: login,
            name: (person && person.name) ? person.name : '',
            station: station || ''
        };
    }

    function describeAnchor(anchor) {
        const tr = anchor.closest('tr');
        return {
            login: (anchor.textContent || '').replace(/\s+/g, ' ').trim(),
            outerHTML: clip(anchor.outerHTML, 400),
            element: describeElement(anchor),
            rowText: tr ? clip((tr.innerText || '').replace(/\s+/g, ' ').trim(), 300) : ''
        };
    }

    function looksLikeLogin(text) {
        return /^[a-z][a-z0-9._-]{2,31}$/i.test(String(text || '').trim());
    }

    function boardAnchors(includeSkipped) {
        const out = [];
        const tables = document.querySelectorAll('table');
        for (let t = 0; t < tables.length; t++) {
            if (tables[t].closest('#' + FLOOR_SUMMARY_ID)) continue;
            const anchors = tables[t].querySelectorAll('tbody a[role="button"], tbody a[mdn-link]');
            for (let a = 0; a < anchors.length; a++) {
                const anchor = anchors[a];
                if (!includeSkipped && anchor.getAttribute('data-mem3-unassign-skip') === '1') continue;
                const login = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
                if (!looksLikeLogin(login)) continue;
                if (out.indexOf(anchor) !== -1) continue;
                out.push(anchor);
            }
        }
        return out;
    }

    function associateAnchors(includeSkipped) {
        const out = [];
        const anchors = boardAnchors(includeSkipped);
        for (let i = 0; i < anchors.length; i++) {
            const login = (anchors[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (!IDENTITY.byLogin[login]) continue;
            out.push(anchors[i]);
        }
        return out;
    }

    function stationCodes(text) {
        const found = String(text || '').match(/\d+-\d+/g);
        const out = [];
        if (!found) return out;
        for (let i = 0; i < found.length; i++) {
            if (out.indexOf(found[i]) === -1) out.push(found[i]);
        }
        out.sort();
        return out;
    }

    function sameStation(marked, live) {
        const left = stationCodes(marked);
        const right = stationCodes(live);
        if (!left.length || left.length !== right.length) return false;
        for (let i = 0; i < left.length; i++) {
            if (left[i] !== right[i]) return false;
        }
        return true;
    }

    function anchorOnMarkedStation(login, station) {
        const want = String(login || '').trim().toLowerCase();
        if (!want || !stationCodes(station).length) return null;
        const anchors = boardAnchors(true);
        for (let i = 0; i < anchors.length; i++) {
            const person = boardPersonFromAnchor(anchors[i]);
            if (String(person.login || '').toLowerCase() !== want) continue;
            if (sameStation(station, person.station)) return anchors[i];
        }
        return null;
    }

    function findAnchorByLogin(login) {
        return findAnchorForPerson(login, '');
    }

    function findAnchorForPerson(login, station) {
        const wantL = String(login || '').trim().toLowerCase();
        const wantS = String(station || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!wantL) return null;
        const anchors = boardAnchors(true);
        let fallback = null;
        for (let i = 0; i < anchors.length; i++) {
            const person = boardPersonFromAnchor(anchors[i]);
            if (String(person.login || '').toLowerCase() !== wantL) continue;
            if (!fallback) fallback = anchors[i];
            if (wantS && String(person.station || '').toLowerCase() === wantS) return anchors[i];
        }
        return wantS ? null : fallback;
    }

    function rowStillOnBoard(login, station) {
        const wantL = String(login || '').trim().toLowerCase();
        const wantS = String(station || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!wantL) return false;
        if (!wantS) return countLoginOnBoard(login) > 0;
        const anchors = boardAnchors(true);
        for (let i = 0; i < anchors.length; i++) {
            const person = boardPersonFromAnchor(anchors[i]);
            if (String(person.login || '').toLowerCase() !== wantL) continue;
            if (String(person.station || '').toLowerCase() === wantS) return true;
        }
        return false;
    }

    function personKey(p) {
        return String(p && p.login || '').toLowerCase() + '|' + String(p && p.station || '').toLowerCase();
    }

    function snapshotBoardPeople() {
        const anchors = boardAnchors(true);
        const out = [];
        const seen = Object.create(null);
        for (let i = 0; i < anchors.length; i++) {
            const person = boardPersonFromAnchor(anchors[i]);
            if (!person.login) continue;
            const key = personKey(person);
            if (seen[key]) continue;
            seen[key] = true;
            out.push(person);
        }
        return out;
    }

    function upsertPerson(list, person) {
        const key = personKey(person);
        for (let i = 0; i < list.length; i++) {
            if (personKey(list[i]) === key) {
                const cur = list[i];
                cur.name = person.name || cur.name;
                cur.login = person.login || cur.login;
                cur.station = person.station || cur.station;
                cur.empId = person.empId || cur.empId;
                if (person.leftBoard !== undefined) cur.leftBoard = person.leftBoard;
                if (person.tries) cur.tries = person.tries;
                if (person.clickMethod) cur.clickMethod = person.clickMethod;
                return cur;
            }
        }
        list.push(person);
        return person;
    }

    function countLoginOnBoard(login) {
        const want = String(login || '').trim().toLowerCase();
        if (!want) return 0;
        let n = 0;
        const tables = document.querySelectorAll('table');
        for (let t = 0; t < tables.length; t++) {
            if (tables[t].closest('#' + FLOOR_SUMMARY_ID)) continue;
            const anchors = tables[t].querySelectorAll('tbody a[role="button"], tbody a[mdn-link]');
            for (let a = 0; a < anchors.length; a++) {
                const text = (anchors[a].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                if (text === want) n++;
            }
        }
        return n;
    }

    function loginStillOnBoard(login) {
        return countLoginOnBoard(login) > 0;
    }

    function uniqueBoardLogins() {
        const seen = Object.create(null);
        const logins = [];
        const anchors = associateAnchors(true);
        for (let i = 0; i < anchors.length; i++) {
            const login = (anchors[i].textContent || '').replace(/\s+/g, ' ').trim();
            const key = login.toLowerCase();
            if (!key || seen[key]) continue;
            seen[key] = true;
            logins.push(login);
        }
        return logins;
    }

    function boardPersonFromAnchor(anchor) {
        const t = unassignTarget(anchor);
        const person = t.login ? IDENTITY.byLogin[t.login.toLowerCase()] : null;
        return {
            name: t.name || '',
            login: t.login || '',
            station: t.station || '',
            empId: person ? (resolveEmpId(person) || '') : ''
        };
    }

    function nextBoardPeople(n) {
        const people = snapshotBoardPeople();
        return people.slice(0, n);
    }

    function formatReassignList(people) {
        const lines = ['Reassign these people:'];
        for (let i = 0; i < people.length; i++) {
            const p = people[i];
            lines.push('');
            lines.push((i + 1) + '. Name: ' + (p.name || '(none)'));
            lines.push('   Login: ' + (p.login || '(none)'));
            lines.push('   Station: ' + (p.station || '(none)'));
            if (p.empId) lines.push('   Employee ID: ' + p.empId);
            lines.push('   Left board: ' + (p.leftBoard ? 'yes' : 'no'));
        }
        return lines.join('\n');
    }

    function visibleActionButton(pattern) {
        const buttons = document.querySelectorAll('button');
        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (!pattern.test((btn.textContent || '').trim())) continue;
            if (btn.closest('#' + FLOOR_SUMMARY_ID) || btn.closest('#mem3-unassign-panel') ||
                btn.closest('#mem3-run-panel') || btn.closest('#' + CORNER_DEBUG_ID) ||
                btn.closest('#' + PHOTO_DEBUG_ID) || btn.closest('#' + LEAVING_ID) ||
                btn.closest('#mem3-early-pass') || btn.closest('#mem3-leaving-list')) continue;
            const rect = btn.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) continue;
            return btn;
        }
        return null;
    }

    function findUnassignButton() {
        return visibleActionButton(/^unassign$/i);
    }

    function findCancelButton() {
        return visibleActionButton(/^cancel$/i);
    }

    function tooltipRecord(unassignBtn) {
        if (!unassignBtn) return null;
        const tip = unassignBtn.closest('[id^="tooltip-"]') || unassignBtn.parentElement;
        if (!tip) return { missing: true };
        const buttons = tip.querySelectorAll('button');
        const described = [];
        for (let i = 0; i < buttons.length; i++) described.push(describeElement(buttons[i]));
        const last = buttons.length ? buttons[buttons.length - 1] : null;
        return {
            id: tip.id || '',
            buttonCount: buttons.length,
            lastButtonText: last ? (last.textContent || '').replace(/\s+/g, ' ').trim() : '',
            buttons: described,
            outerHTML: clip(tip.outerHTML, 2000)
        };
    }

    let RUN_STOP = false;

    function runPanel() {
        let panel = document.getElementById('mem3-run-panel');
        if (panel) return panel;
        panel = document.createElement('div');
        panel.id = 'mem3-run-panel';
        panel.style.cssText = 'position:fixed; inset:0; z-index:2147483646; display:flex; align-items:center; ' +
            'justify-content:center; pointer-events:none; background:transparent; ' +
            'font-family:Segoe UI,system-ui,sans-serif; color:#ffffff;';
        const card = document.createElement('div');
        card.setAttribute('data-card', '');
        card.style.cssText = 'pointer-events:auto; width:min(480px, calc(100% - 32px)); background:#161b22; ' +
            'border:1px solid #8b949e; border-radius:12px; padding:16px; box-shadow:0 16px 48px rgba(0,0,0,0.45);';
        card.innerHTML = '<div data-title style="font-size:16px; font-weight:800;"></div>' +
            '<div data-count style="margin-top:8px; font-size:28px; font-weight:800; font-variant-numeric:tabular-nums;"></div>' +
            '<div style="margin-top:10px; height:8px; background:#0d1117; border-radius:99px; overflow:hidden;">' +
            '<div data-fill style="height:100%; width:0; background:#58a6ff;"></div></div>' +
            '<div data-current style="margin-top:10px; font-size:14px; font-weight:700;"></div>' +
            '<div data-detail style="margin-top:4px; font-size:13px; font-weight:600; color:#c9d1d9; white-space:pre-wrap; max-height:240px; overflow:auto;"></div>' +
            '<div data-stats style="margin-top:8px; font-size:12px; font-weight:700; color:#8b949e;"></div>' +
            '<div style="display:flex; justify-content:flex-end; margin-top:12px;">' +
            '<button type="button" data-action style="padding:6px 12px; border-radius:8px; cursor:pointer; color:#ffffff; ' +
            'background:#0d1117; border:1px solid #8b949e; font:800 12px Segoe UI,system-ui,sans-serif;">Stop</button></div>';
        card.querySelector('[data-action]').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const node = document.getElementById('mem3-run-panel');
            const finished = node && node.getAttribute('data-finished') === '1';
            if (unassigning && !finished) {
                RUN_STOP = true;
                const detail = card.querySelector('[data-detail]');
                if (detail) detail.textContent = 'Stopping after this associate';
            } else if (node) {
                node.remove();
            }
        });
        panel.appendChild(card);
        document.body.appendChild(panel);
        return panel;
    }

    function lockBoard(on) {
        const panel = runPanel();
        panel.style.pointerEvents = on ? 'auto' : 'none';
        panel.style.background = on ? 'rgba(13,17,23,0.55)' : 'transparent';
    }

    function paintRunPanel(state) {
        const panel = runPanel();
        if (unassigning && !state.finished) lockBoard(true);
        if (state.finished) lockBoard(false);
        const total = state.total || 0;
        const done = state.done || 0;
        const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
        panel.setAttribute('data-finished', state.finished ? '1' : '0');
        panel.querySelector('[data-title]').textContent = state.title || '';
        panel.querySelector('[data-count]').textContent = done + ' / ' + total;
        const fill = panel.querySelector('[data-fill]');
        fill.style.width = pct + '%';
        fill.style.background = state.barColor || '#58a6ff';
        panel.querySelector('[data-current]').textContent = state.current || '';
        panel.querySelector('[data-detail]').textContent = state.detail || '';
        panel.querySelector('[data-stats]').textContent = state.stats || '';
        panel.querySelector('[data-action]').textContent = state.finished ? 'Close' : 'Stop';
    }

    function visibleTooltipIds() {
        const ids = [];
        const tips = document.querySelectorAll('[id^="tooltip-"]');
        for (let i = 0; i < tips.length; i++) {
            const rect = tips[i].getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) continue;
            if (tips[i].id) ids.push(tips[i].id);
        }
        return ids;
    }

    function findUnassignInNewTooltip(known, login) {
        let best = null;
        let bestRank = -1;
        const want = String(login || '').trim().toLowerCase();
        const buttons = document.querySelectorAll('button');
        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (!/^unassign$/i.test((btn.textContent || '').trim())) continue;
            if (btn.closest('#' + FLOOR_SUMMARY_ID) || btn.closest('#mem3-unassign-panel') ||
                btn.closest('#mem3-run-panel') || btn.closest('#' + CORNER_DEBUG_ID) ||
                btn.closest('#' + PHOTO_DEBUG_ID) || btn.closest('#' + LEAVING_ID) ||
                btn.closest('#mem3-early-pass') || btn.closest('#mem3-leaving-list')) continue;
            const tip = btn.closest('[id^="tooltip-"]');
            if (!tip || known[tip.id]) continue;
            const rect = btn.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) continue;
            if (want) {
                const box = tip.querySelector('.' + POPUP_CLASS);
                if (box && box.dataset.login && box.dataset.login.toLowerCase() !== want) continue;
            }
            const num = parseInt(String(tip.id).replace(/\D/g, ''), 10);
            const rank = isNaN(num) ? i : num;
            if (!best || rank >= bestRank) {
                best = btn;
                bestRank = rank;
            }
        }
        return best;
    }

    function waitFor(read, ms) {
        const start = Date.now();
        return new Promise(function (resolve) {
            (function poll() {
                const hit = read();
                if (hit) return resolve(hit);
                if (Date.now() - start > ms) return resolve(null);
                setTimeout(poll, 80);
            })();
        });
    }

    function userClick(el) {
        try { el.click(); }
        catch (e) { pageClick(el); }
    }

    function fireEscape() {
        const win = pageWindow();
        const opts = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
        try {
            document.dispatchEvent(new win.KeyboardEvent('keydown', opts));
            document.dispatchEvent(new win.KeyboardEvent('keyup', opts));
        } catch (e) { /* ignore */ }
        try {
            const active = document.activeElement;
            if (active && active.dispatchEvent) {
                active.dispatchEvent(new win.KeyboardEvent('keydown', opts));
                active.dispatchEvent(new win.KeyboardEvent('keyup', opts));
            }
        } catch (e2) { /* ignore */ }
    }

    async function closeMenuWithoutUnassign() {
        let closedBy = '';
        for (let i = 0; i < 6; i++) {
            if (!findUnassignButton() && !findCancelButton()) {
                return { closedBy: closedBy || 'already', closed: true };
            }
            const cancel = findCancelButton();
            if (cancel) {
                pageClick(cancel);
                closedBy = 'cancel';
            } else {
                fireEscape();
                closedBy = closedBy || 'escape';
            }
            const closed = await waitFor(function () {
                return (findUnassignButton() || findCancelButton()) ? null : true;
            }, 600);
            if (closed) return { closedBy: closedBy, closed: true };
        }
        fireEscape();
        await sleep(150);
        return { closedBy: closedBy || 'none', closed: !findUnassignButton() };
    }

    async function closeAllAssociateMenus() {
        return closeMenuWithoutUnassign();
    }

    async function openAssociateMenu(anchor, login, station) {
        const attempts = [];
        const want = String(login || (anchor && anchor.textContent) || '').replace(/\s+/g, ' ').trim();
        for (let round = 0; round < 3; round++) {
            if (findUnassignButton() || findCancelButton()) {
                attempts.push({ method: 'close-stale', round: round });
                await closeAllAssociateMenus();
            }
            if (!anchor || !anchor.isConnected) {
                const again = want ? findAnchorForPerson(want, station) : null;
                if (!again) {
                    attempts.push({ method: 'detached', round: round });
                    break;
                }
                anchor = again;
            }
            const known = Object.create(null);
            const existing = visibleTooltipIds();
            for (let i = 0; i < existing.length; i++) known[existing[i]] = true;
            const readNew = function () { return findUnassignInNewTooltip(known, want); };
            try { anchor.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { /* ignore */ }
            await sleep(round ? 160 : 60);
            pageClick(anchor);
            attempts.push({ method: 'pointer', round: round });
            let button = await waitFor(readNew, 1100);
            if (!button) {
                pageClick(anchor);
                attempts.push({ method: 'pointer-retry', round: round });
                button = await waitFor(readNew, 1600);
            }
            if (button) return { button: button, attempts: attempts, anchor: anchor };
            await closeAllAssociateMenus();
        }
        return { button: null, attempts: attempts, anchor: anchor };
    }

    async function probeAll(button) {
        if (unassigning) return;
        unassigning = true;
        RUN_STOP = false;
        const original = button.textContent;
        const seen = Object.create(null);
        const logins = [];
        const initial = associateAnchors(true);
        for (let i = 0; i < initial.length; i++) {
            const login = (initial[i].textContent || '').replace(/\s+/g, ' ').trim();
            const key = login.toLowerCase();
            if (!key || seen[key]) continue;
            seen[key] = true;
            logins.push(login);
        }
        const batch = {
            mode: 'probe',
            clickedUnassign: false,
            clickedLastButton: false,
            total: logins.length,
            found: 0,
            missed: 0,
            people: []
        };
        const savedScroll = captureScroll(document.body);
        try {
            if (!logins.length) {
                batch.error = 'no associate';
                pushUnassignLog(batch);
                button.textContent = 'No one signed in';
                paintRunPanel({
                    title: 'Probe finished',
                    done: 0,
                    total: 0,
                    detail: 'Nobody is signed in',
                    finished: true
                });
                return;
            }
            paintRunPanel({
                title: 'Probing associates',
                done: 0,
                total: logins.length,
                detail: 'Opening each menu, then closing it',
                stats: 'Menus found 0 · missed 0'
            });
            for (let i = 0; i < logins.length; i++) {
                if (RUN_STOP) {
                    batch.stopped = true;
                    break;
                }
                const login = logins[i];
                button.textContent = 'Probing ' + (i + 1) + '/' + logins.length;
                paintRunPanel({
                    title: 'Probing associates',
                    done: i,
                    total: logins.length,
                    current: login,
                    detail: 'Opening menu',
                    stats: 'Menus found ' + batch.found + ' · missed ' + batch.missed
                });
                const anchor = findAnchorByLogin(login);
                const step = { login: login, clickedUnassign: false };
                if (!anchor) {
                    step.error = 'login not on board';
                    batch.missed++;
                    batch.people.push(step);
                    continue;
                }
                try { anchor.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { /* ignore */ }
                await sleep(120);
                step.anchor = describeAnchor(anchor);
                const opened = await openAssociateMenu(anchor);
                step.open = opened.attempts;
                step.unassignFound = !!opened.button;
                step.tooltip = tooltipRecord(opened.button);
                step.close = await closeMenuWithoutUnassign();
                step.menuStillOpen = !!findUnassignButton();
                if (step.menuStillOpen) step.secondClose = await closeMenuWithoutUnassign();
                step.stillAssigned = loginStillOnBoard(login);
                if (step.unassignFound) batch.found++;
                else batch.missed++;
                batch.people.push(step);
                await sleep(150);
            }
            pushUnassignLog(batch);
            button.textContent = 'Probed ' + batch.found + '/' + batch.total;
            paintRunPanel({
                title: batch.stopped ? 'Probe stopped' : 'Probe finished',
                done: batch.people.length,
                total: logins.length,
                detail: 'Menus were closed. Nobody was unassigned.',
                stats: 'Menus found ' + batch.found + ' · missed ' + batch.missed,
                barColor: batch.missed ? '#d29922' : '#2ea043',
                finished: true
            });
        } catch (e) {
            batch.error = (e && e.message) ? e.message : String(e);
            pushUnassignLog(batch);
            button.textContent = 'Probe failed';
            paintRunPanel({
                title: 'Probe failed',
                done: batch.people.length,
                total: logins.length,
                detail: batch.error,
                stats: 'Menus found ' + batch.found + ' · missed ' + batch.missed,
                barColor: '#f85149',
                finished: true
            });
        } finally {
            try { restoreScroll(savedScroll); } catch (e2) { /* ignore */ }
            unassigning = false;
            setTimeout(function () { button.textContent = original; }, 4000);
        }
    }

    const UNASSIGN_WATCH_MS = 10000;
    const UNASSIGN_SAMPLE_MS = 500;
    const UNASSIGN_HOLD = 6;

    function stillAssigned(login, station) {
        if (station) return rowStillOnBoard(login, station);
        return countLoginOnBoard(login) > 0;
    }

    function heldOff(samples) {
        if (!samples || samples.length < UNASSIGN_HOLD) return false;
        for (let i = samples.length - UNASSIGN_HOLD; i < samples.length; i++) {
            if (samples[i]) return false;
        }
        return true;
    }

    function sampleBits(samples) {
        let text = '';
        const list = samples || [];
        for (let i = 0; i < list.length; i++) text += list[i] ? '1' : '0';
        return text;
    }

    function missingFromMarkedStation(login, station) {
        if (!stationCodes(station).length) return false;
        let anchors = [];
        try { anchors = boardAnchors(true); } catch (e) { return false; }
        if (!anchors.length) return false;
        return !anchorOnMarkedStation(login, station);
    }

    async function stayedOffStation(login, station) {
        if (!stationCodes(station).length) return false;
        const samples = [];
        const start = Date.now();
        while (Date.now() - start < UNASSIGN_WATCH_MS) {
            if (RUN_STOP || leavingStop) return false;
            if (!missingFromMarkedStation(login, station)) samples.push(false);
            else samples.push(true);
            if (samples.length >= UNASSIGN_HOLD) {
                let held = true;
                for (let i = samples.length - UNASSIGN_HOLD; i < samples.length; i++) {
                    if (!samples[i]) { held = false; break; }
                }
                if (held) return true;
            }
            await sleep(UNASSIGN_SAMPLE_MS);
        }
        return false;
    }

    async function watchUnassign(login, station) {
        const samples = [];
        const start = Date.now();
        while (Date.now() - start < UNASSIGN_WATCH_MS) {
            if (RUN_STOP || leavingStop) break;
            samples.push(!!stillAssigned(login, station));
            if (heldOff(samples)) break;
            await sleep(UNASSIGN_SAMPLE_MS);
        }
        return { gone: heldOff(samples), samples: sampleBits(samples) };
    }

    function noteUnassignWatch(record, watched) {
        if (!record) return;
        record.leftBoard = !!watched.gone;
        record.samples = watched.samples || '';
        record.afterCount = countLoginOnBoard(record.login || '');
    }

    async function unassignAnchor(anchor, record) {
        const login = (record && (record.login || (record.target && record.target.login)))
            || ((anchor.textContent || '').replace(/\s+/g, ' ').trim());
        const before = countLoginOnBoard(login);
        const station = record && record.station ? record.station : '';
        if (record) record.beforeCount = before;
        if (record) record.login = record.login || login;
        if (login && before === 0) {
            const watched = await watchUnassign(login, station);
            noteUnassignWatch(record, watched);
            return watched.gone;
        }
        const opened = await openAssociateMenu(anchor, login, station);
        if (opened.anchor) anchor = opened.anchor;
        if (record) {
            record.open = opened.attempts;
            record.tooltip = tooltipRecord(opened.button);
        }
        if (!opened.button) return false;
        const target = opened.button;
        await sleep(250);
        if (record) record.clickedUnassign = true;
        const via = clickUnassignButton(target, 'inner');
        if (record) record.clickMethod = via || 'fiber';
        const buttonGone = await waitFor(function () {
            if (!target.isConnected) return true;
            const rect = target.getBoundingClientRect();
            return (rect.width < 1 || rect.height < 1) ? true : null;
        }, 2500);
        if (record) record.buttonGone = !!buttonGone;
        if (!buttonGone) await closeAllAssociateMenus();
        if (record) {
            record.landed = !!buttonGone;
            record.leftBoard = station ? !rowStillOnBoard(login, station) : countLoginOnBoard(login) < before;
            record.afterCount = countLoginOnBoard(login);
        }
        // A manual Unassign leaves the person on the board. The click landed when the menu closed.
        return !!buttonGone;
    }

    async function unassignCount(button, limit) {
        if (unassigning) return;
        unassigning = true;
        RUN_STOP = false;
        const original = button.textContent;
        const people = nextBoardPeople(limit);
        const batch = {
            mode: limit === 1 ? 'unassign-one' : 'unassign-' + limit,
            limit: limit,
            people: people,
            reassign: ''
        };
        let left = 0;
        try {
            if (!people.length) {
                batch.error = 'no associate';
                pushUnassignLog(batch);
                button.textContent = 'No one signed in';
                paintRunPanel({
                    title: 'Unassign finished',
                    done: 0,
                    total: 0,
                    detail: 'Nobody is signed in',
                    finished: true
                });
                return;
            }
            batch.reassign = formatReassignList(people);
            try { await copyText(batch.reassign); } catch (e0) { /* ignore */ }
            paintRunPanel({
                title: 'Unassigning associates',
                done: 0,
                total: people.length,
                detail: batch.reassign,
                stats: 'Copied Name, Login, Station for reassign'
            });
            for (let i = 0; i < people.length; i++) {
                if (RUN_STOP) {
                    batch.stopped = true;
                    break;
                }
                const person = people[i];
                const login = person.login;
                person.tries = 0;
                person.clickedUnassign = false;
                button.textContent = 'Unassigning ' + (i + 1) + '/' + people.length;
                paintRunPanel({
                    title: 'Unassigning associates',
                    done: left,
                    total: people.length,
                    current: (person.name ? person.name + '  ' : '') + login,
                    detail: person.station || 'Opening menu',
                    stats: 'Copied Name, Login, Station for reassign'
                });
                while (!person.landed && person.tries < 2 && !RUN_STOP) {
                    person.tries++;
                    await closeAllAssociateMenus();
                    const anchor = findAnchorForPerson(login, person.station);
                    if (!anchor) break;
                    const fresh = boardPersonFromAnchor(anchor);
                    person.station = fresh.station || person.station;
                    person.name = fresh.name || person.name;
                    person.empId = fresh.empId || person.empId;
                    await sleep(80);
                    person.landed = await unassignAnchor(anchor, person);
                    if (person.landed) break;
                    await sleep(300);
                }
                if (person.landed) left++;
                await sleep(400);
            }
            batch.done = left;
            batch.reassign = formatReassignList(people);
            pushUnassignLog(batch);
            try { await copyText(batch.reassign); } catch (e2) { /* ignore */ }
            button.textContent = 'Unassigned ' + left + '/' + people.length;
            paintRunPanel({
                title: batch.stopped ? 'Unassign stopped' : 'Unassign finished',
                done: left,
                total: people.length,
                detail: batch.reassign,
                stats: 'Copied Name, Login, Station for reassign',
                barColor: left === people.length ? '#2ea043' : '#d29922',
                finished: true
            });
        } catch (e) {
            batch.error = (e && e.message) ? e.message : String(e);
            batch.reassign = formatReassignList(people);
            pushUnassignLog(batch);
            try { await copyText(batch.reassign); } catch (e2) { /* ignore */ }
            button.textContent = 'Unassign failed';
            paintRunPanel({
                title: 'Unassign failed',
                done: left,
                total: people.length,
                detail: batch.reassign || batch.error,
                barColor: '#f85149',
                finished: true
            });
        } finally {
            unassigning = false;
            setTimeout(function () { button.textContent = original; }, 4000);
        }
    }

    async function unassignOne(button) {
        return unassignCount(button, 1);
    }

    async function unassignAll(button) {
        if (unassigning) return;
        unassigning = true;
        RUN_STOP = false;
        const original = button.textContent;
        const people = snapshotBoardPeople();
        const batch = { mode: 'unassign-all', limit: people.length, people: people, passes: 1, missed: [] };
        let left = 0;
        try {
            await closeAllAssociateMenus();
            batch.reassign = formatReassignList(people);
            try { await copyText(batch.reassign); } catch (e0) { /* ignore */ }
            lockBoard(true);
            paintRunPanel({
                title: 'Unassigning associates',
                done: 0,
                total: people.length,
                detail: batch.reassign,
                stats: 'Copied Name, Login, Station for reassign'
            });
            if (!people.length) {
                batch.error = 'no associate';
                pushUnassignLog(batch);
                button.textContent = 'No one signed in';
                paintRunPanel({
                    title: 'Unassign finished',
                    done: 0,
                    total: 0,
                    detail: 'Nobody is signed in',
                    finished: true
                });
                return;
            }
            const missed = [];
            for (let i = 0; i < people.length; i++) {
                if (RUN_STOP) {
                    batch.stopped = true;
                    break;
                }
                const person = people[i];
                person.tries = 0;
                person.clickedUnassign = false;
                button.textContent = 'Unassigning ' + (i + 1) + '/' + people.length;
                paintRunPanel({
                    title: 'Unassigning associates',
                    done: left,
                    total: people.length,
                    current: (person.name ? person.name + '  ' : '') + person.login,
                    detail: person.station || 'Opening menu',
                    stats: 'Copied reassign list · clicked ' + left
                });
                while (!person.landed && person.tries < 2 && !RUN_STOP) {
                    person.tries++;
                    await closeAllAssociateMenus();
                    const anchor = findAnchorForPerson(person.login, person.station);
                    if (!anchor) break;
                    const fresh = boardPersonFromAnchor(anchor);
                    person.station = fresh.station || person.station;
                    person.name = fresh.name || person.name;
                    person.empId = fresh.empId || person.empId;
                    try { anchor.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e1) { /* ignore */ }
                    await sleep(80);
                    person.landed = await unassignAnchor(anchor, person);
                    if (person.landed) break;
                    await sleep(300);
                }
                if (person.landed) left++;
                else missed.push(person);
                await sleep(250);
            }
            batch.done = left;
            batch.missed = missed;
            batch.failed = missed.length;
            batch.reassign = formatReassignList(people);
            pushUnassignLog(batch);
            try { await copyText(batch.reassign); } catch (e2) { /* ignore */ }
            button.textContent = missed.length ? ('Unassigned ' + left + ' · missed ' + missed.length) : ('Unassigned ' + left);
            paintRunPanel({
                title: batch.stopped ? 'Unassign stopped' : (missed.length ? 'Unassign finished — missed' : 'Unassign finished'),
                done: left,
                total: people.length,
                detail: missed.length
                    ? ('Unassign did not land:\n' + formatReassignList(missed))
                    : batch.reassign,
                stats: 'They stay on the board, same as unassigning by hand. Clicked ' + left +
                    (missed.length ? (' · missed ' + missed.length) : ''),
                barColor: missed.length ? '#d29922' : '#2ea043',
                finished: true
            });
        } catch (e) {
            batch.error = (e && e.message) ? e.message : String(e);
            batch.reassign = formatReassignList(people);
            pushUnassignLog(batch);
            try { await copyText(batch.reassign); } catch (e2) { /* ignore */ }
            warn('unassign failed:', e);
            button.textContent = 'Unassign failed';
            paintRunPanel({
                title: 'Unassign failed',
                done: left,
                total: people.length,
                detail: batch.reassign || batch.error,
                barColor: '#f85149',
                finished: true
            });
        } finally {
            unassigning = false;
            lockBoard(false);
            setTimeout(function () { button.textContent = original; }, 4000);
        }
    }

    function askPassword(titleText, noteText, onOk) {
        if (unassigning) return;
        const old = document.getElementById('mem3-unassign-panel');
        if (old) old.remove();
        const overlay = document.createElement('div');
        overlay.id = 'mem3-unassign-panel';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:2147483646; background:rgba(0,0,0,0.55); ' +
            'display:flex; align-items:center; justify-content:center; ' +
            'font-family:Segoe UI,system-ui,sans-serif; color:#ffffff;';
        const card = document.createElement('div');
        card.style.cssText = 'width:min(420px, calc(100% - 32px)); background:#161b22; ' +
            'border:1px solid #30363d; border-radius:12px; padding:16px;';
        const title = document.createElement('div');
        title.textContent = titleText;
        title.style.cssText = 'font-size:16px; font-weight:800;';
        const note = document.createElement('div');
        note.textContent = noteText;
        note.style.cssText = 'font-size:13px; font-weight:500; color:#c9d1d9; margin-top:6px; white-space:pre-wrap;';
        const input = document.createElement('input');
        input.type = 'password';
        input.placeholder = 'Password';
        input.style.cssText = 'display:block; width:100%; box-sizing:border-box; margin-top:12px; ' +
            'padding:8px 10px; border-radius:8px; border:1px solid #8b949e; background:#0d1117; ' +
            'color:#ffffff; font:600 14px Segoe UI,system-ui,sans-serif;';
        const error = document.createElement('div');
        error.style.cssText = 'min-height:18px; margin-top:6px; font-size:12px; font-weight:700; color:#f85149;';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; margin-top:8px;';
        function close() { overlay.remove(); }
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        cancel.style.cssText = 'padding:6px 12px; border-radius:8px; cursor:pointer; color:#ffffff; ' +
            'background:#0d1117; border:1px solid #8b949e; font:800 12px Segoe UI,system-ui,sans-serif;';
        cancel.addEventListener('click', close);
        const go = document.createElement('button');
        go.type = 'button';
        go.textContent = 'Unassign';
        go.style.cssText = 'padding:6px 12px; border-radius:8px; cursor:pointer; color:#ffffff; ' +
            'background:#0d1117; border:1px solid #f85149; font:800 12px Segoe UI,system-ui,sans-serif;';
        function submit() {
            if (input.value !== UNASSIGN_PASSWORD) {
                error.textContent = 'Wrong password';
                input.focus();
                return;
            }
            close();
            onOk();
        }
        go.addEventListener('click', submit);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') submit();
        });
        row.appendChild(cancel);
        row.appendChild(go);
        card.appendChild(title);
        card.appendChild(note);
        card.appendChild(input);
        card.appendChild(error);
        card.appendChild(row);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        input.focus();
    }

    function askUnassignConfirm(button, titleText, noteText, onOk) {
        if (unassigning) return;
        const count = boardAnchors().length;
        if (!count) return;
        askPassword(titleText, noteText, onOk);
    }

    function askUnassignAll(button) {
        const count = snapshotBoardPeople().length;
        askUnassignConfirm(
            button,
            'Unassign ' + count + (count === 1 ? ' assignment' : ' assignments') + '?',
            'This unassigns every signed-in login on the assignment tables, including second stations.\nName, Login, and Station are copied first so you can reassign them.\nDo not click the page. Enter the password to continue.',
            function () { unassignAll(button); }
        );
    }

    function askUnassignOne(button) {
        const people = nextBoardPeople(1);
        const target = people[0] || {};
        const lines = ['Temporary test. This unassigns one person:'];
        if (target.name) lines.push('Name: ' + target.name);
        lines.push('Login: ' + (target.login || '(none)'));
        if (target.station) lines.push('Station: ' + target.station);
        lines.push('Enter the password to continue.');
        askUnassignConfirm(
            button,
            'Unassign one associate?',
            lines.join('\n'),
            function () { unassignCount(button, 1); }
        );
    }

    function askUnassignThree(button) {
        const people = nextBoardPeople(3);
        const lines = ['This unassigns 3 people in sequence.', 'Name, Login, and Station are copied so you can reassign them.', ''];
        for (let i = 0; i < people.length; i++) {
            const p = people[i];
            lines.push((i + 1) + '. ' + (p.name || p.login));
            lines.push('   Login: ' + p.login);
            lines.push('   Station: ' + (p.station || '(none)'));
        }
        lines.push('');
        lines.push('Enter the password to continue.');
        askUnassignConfirm(
            button,
            'Unassign 3 associates?',
            lines.join('\n'),
            function () { unassignCount(button, 3); }
        );
    }

    function findDatePickerSuffix() {
        const input = findDatePicker();
        if (!input) return null;
        let n = input.parentElement;
        for (let hops = 0; n && hops < 10; hops++) {
            const suffixes = n.querySelectorAll('[mdn-input-box-suffix]');
            if (suffixes.length) return suffixes[suffixes.length - 1];
            n = n.parentElement;
        }
        return null;
    }

    function todayIsoDate(d) {
        const pad = function (n) { return String(n).padStart(2, '0'); };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function findMiniCalToday() {
        const iso = todayIsoDate(new Date());
        const pop = document.querySelector('[id^="datepicker-popover"]');
        const root = pop || document;
        return root.querySelector('[id^="mini-cal-"][id$="-' + iso + '"]');
    }

    function clickTodayInCalendar() {
        const cell = findMiniCalToday();
        if (!cell) return null;
        const span = cell.querySelector('span') || cell;
        pageClick(cell);
        if (span !== cell) pageClick(span);
        return cell.id;
    }

    let dateApplied = false;
    let dateAttempts = 0;
    let dateMethodIndex = 0;
    let dateCalTries = 0;
    const DATE_TRACE = {
        expected: null,
        valueWhenFound: null,
        valueAfterSet: null,
        applied: false,
        skippedAlreadyToday: false,
        changeDispatched: false,
        appliedAt: null,
        attempts: 0,
        pickerId: null,
        methodsTried: [],
        methodThatWorked: null,
        gaveUp: false,
        suffixFound: false,
        popoverId: null,
        cellId: null
    };

    function pickerMatchesToday(input, today) {
        return !!input && (input.value || '') === today;
    }

    function trySetDateMethod(input, today, method) {
        DATE_TRACE.methodsTried.push(method);
        DATE_TRACE.changeDispatched = true;
        if (method === 'insertText') insertTextValue(input, today);
        else if (method === 'nativeSetter') {
            try { input.focus(); } catch (e) { /* ignore */ }
            writeInputValue(input, today);
            fireInputEvents(input, today, 'insertFromPaste');
            try { input.blur(); } catch (e2) { /* ignore */ }
        } else if (method === 'typeSlashes') typeDateValue(input, today);
        else if (method === 'typeDigits') typeDateValue(input, today.replace(/\D/g, ''));
        DATE_TRACE.valueAfterSet = input.value || '';
        return pickerMatchesToday(input, today);
    }

    function applyTodayDateOnce() {
        if (dateApplied) {
            placeDateDebugButton();
            return;
        }
        const input = findDatePicker();
        if (!input) {
            dateAttempts++;
            DATE_TRACE.attempts = dateAttempts;
            if (dateAttempts < 40) setTimeout(applyTodayDateOnce, 250);
            return;
        }
        const today = formatPageDate(new Date());
        DATE_TRACE.expected = today;
        DATE_TRACE.pickerId = input.id || null;
        DATE_TRACE.attempts = dateAttempts;
        if (DATE_TRACE.valueWhenFound === null) DATE_TRACE.valueWhenFound = input.value || '';

        if (pickerMatchesToday(input, today)) {
            DATE_TRACE.skippedAlreadyToday = DATE_TRACE.methodsTried.length === 0;
            DATE_TRACE.valueAfterSet = input.value || '';
            DATE_TRACE.applied = DATE_TRACE.methodsTried.length > 0;
            if (!DATE_TRACE.methodThatWorked && DATE_TRACE.methodsTried.length) {
                DATE_TRACE.methodThatWorked = DATE_TRACE.methodsTried[DATE_TRACE.methodsTried.length - 1];
            }
            DATE_TRACE.appliedAt = DATE_TRACE.appliedAt || new Date().toISOString();
            dateApplied = true;
            log('date picker is today', today);
            placeDateDebugButton();
            return;
        }

        const methods = ['calendarToday'];
        if (dateMethodIndex >= methods.length) {
            DATE_TRACE.gaveUp = true;
            DATE_TRACE.valueAfterSet = input.value || '';
            dateApplied = true;
            warn('date picker did not accept', today, 'value=', input.value);
            placeDateDebugButton();
            return;
        }

        const method = methods[dateMethodIndex];
        dateMethodIndex++;
        if (method === 'calendarToday') {
            DATE_TRACE.methodsTried.push(method);
            DATE_TRACE.changeDispatched = true;
            const suffix = findDatePickerSuffix();
            DATE_TRACE.suffixFound = !!suffix;
            if (suffix) pageClick(suffix);
            else DATE_TRACE.methodsTried.push('suffix-missing');
            setTimeout(function () {
                const pop = document.querySelector('[id^="datepicker-popover"]');
                DATE_TRACE.popoverId = pop ? pop.id : null;
                const cellId = clickTodayInCalendar();
                DATE_TRACE.cellId = cellId;
                DATE_TRACE.methodsTried.push(cellId ? ('mini-cal:' + cellId) : 'mini-cal:no-hit');
                const live = findDatePicker() || input;
                DATE_TRACE.valueAfterSet = live.value || '';
                setTimeout(function () {
                    const again = findDatePicker();
                    const todayNow = formatPageDate(new Date());
                    if (!pickerMatchesToday(again, todayNow) && dateCalTries < 8) {
                        dateCalTries++;
                        dateMethodIndex = 0;
                    }
                    applyTodayDateOnce();
                }, 300);
            }, 350);
            placeDateDebugButton();
            return;
        }
        const ok = trySetDateMethod(input, today, method);
        if (ok) {
            DATE_TRACE.methodThatWorked = method;
            DATE_TRACE.applied = true;
            DATE_TRACE.appliedAt = new Date().toISOString();
            dateApplied = true;
            log('date picker set to', today, 'via', method);
            placeDateDebugButton();
            return;
        }
        // React often commits on the next tick; re-check before the next method.
        setTimeout(applyTodayDateOnce, 200);
        placeDateDebugButton();
    }

    function collectDateDebug() {
        const input = findDatePicker();
        const expected = formatPageDate(new Date());
        const current = input ? (input.value || '') : null;
        return {
            script: SCRIPT_LABEL,
            what: 'date picker',
            now: new Date().toISOString(),
            expectedToday: expected,
            matchesToday: current === expected,
            picker: input ? {
                found: true,
                id: input.id || null,
                value: current,
                placeholder: input.getAttribute('aria-placeholder') || input.placeholder || null,
                disabled: !!input.disabled
            } : { found: false },
            apply: DATE_TRACE
        };
    }

    function placeDateDebugButton() {
        const btn = document.getElementById(DATE_DEBUG_ID);
        if (btn) btn.remove();
    }

    function placeYieldHover(wrap, tip) {
        if (!wrap.isConnected) return;
        if (tip.parentElement !== document.body) document.body.appendChild(tip);
        tip.classList.add('mem3-yield-hover-open');
        tip.style.maxHeight = 'none';
        tip.style.left = '0px';
        tip.style.top = '0px';
        const sign = wrap.getBoundingClientRect();
        let panelW = tip.offsetWidth;
        const panelH = tip.scrollHeight;
        const margin = 10;
        const gap = 8;
        const spaceAbove = Math.max(0, sign.top - margin - gap);
        const spaceBelow = Math.max(0, window.innerHeight - sign.bottom - margin - gap);
        const fitsAbove = panelH <= spaceAbove;
        const fitsBelow = panelH <= spaceBelow;
        let maxH = panelH;
        let top;
        if (fitsAbove || (!fitsBelow && spaceAbove >= spaceBelow)) {
            maxH = Math.min(panelH, spaceAbove);
            top = sign.top - gap - maxH;
        } else {
            maxH = Math.min(panelH, spaceBelow);
            top = sign.bottom + gap;
        }
        if (top < margin) top = margin;
        if (top + maxH > window.innerHeight - margin) maxH = Math.max(48, window.innerHeight - margin - top);
        tip.style.maxHeight = Math.round(maxH) + 'px';
        panelW = tip.offsetWidth;
        let left = sign.left + (sign.width / 2) - (panelW / 2);
        const maxLeft = window.innerWidth - margin - panelW;
        if (left > maxLeft) left = maxLeft;
        if (left < margin) left = margin;
        tip.style.left = Math.round(left) + 'px';
        tip.style.top = Math.round(top) + 'px';
    }

    function pointNearRect(rect, x, y, pad) {
        return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
    }

    function bindYieldHover(wrap, tip) {
        const NEAR = 12;
        let hideTimer = null;
        let move = null;
        function hide() {
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
            tip.classList.remove('mem3-yield-hover-open');
            tip.style.maxHeight = '';
            tip.style.left = '';
            tip.style.top = '';
            if (tip.parentElement === document.body) tip.remove();
            if (move) {
                document.removeEventListener('mousemove', move, true);
                window.removeEventListener('scroll', move, true);
                window.removeEventListener('resize', move, true);
                move = null;
            }
        }
        function scheduleHide() {
            if (hideTimer) return;
            hideTimer = setTimeout(hide, 120);
        }
        function onMove(e) {
            if (!tip.classList.contains('mem3-yield-hover-open')) return;
            if (e.type === 'scroll') {
                if (tip.contains(e.target)) return;
                placeYieldHover(wrap, tip);
                return;
            }
            if (e.type !== 'mousemove') { placeYieldHover(wrap, tip); return; }
            const x = e.clientX;
            const y = e.clientY;
            const onSign = pointNearRect(wrap.getBoundingClientRect(), x, y, NEAR);
            const onPanel = pointNearRect(tip.getBoundingClientRect(), x, y, NEAR);
            if (onSign || onPanel) {
                if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
                return;
            }
            scheduleHide();
        }
        wrap.addEventListener('mouseenter', function () {
            placeYieldHover(wrap, tip);
            if (move) return;
            move = onMove;
            document.addEventListener('mousemove', move, true);
            window.addEventListener('scroll', move, true);
            window.addEventListener('resize', move, true);
        });
    }

    function closeYieldPanels() {
        const open = document.querySelectorAll('.mem3-yield-open');
        for (let i = 0; i < open.length; i++) {
            open[i].classList.remove('mem3-yield-open');
            if (open[i].parentElement === document.body) open[i].remove();
        }
        const shade = document.getElementById('mem3-yield-shade');
        if (shade) shade.remove();
    }

    function makeYieldSign(signed, stations, openStations, clickPanel, disabledStations) {
        if (!(stations > 0)) return null;
        const pct = (signed / stations) * 100;
        const shown = Math.round(pct);
        const wrap = document.createElement('span');
        wrap.className = 'mem3-yield' + (clickPanel ? ' mem3-yield-click' : '');
        const mark = document.createElement('span');
        mark.className = 'mem3-yield-mark';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 22');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '15');
        svg.setAttribute('aria-hidden', 'true');
        if (shown >= 100) {
            const check = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            check.setAttribute('d', 'M4.2 11.4 L9.4 16.6 L20.2 5.2');
            check.setAttribute('fill', 'none');
            check.setAttribute('stroke', '#2ea043');
            check.setAttribute('stroke-width', '3.4');
            check.setAttribute('stroke-linecap', 'round');
            check.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(check);
        } else {
            const color = shown < 90 ? '#f85149' : '#d29922';
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            poly.setAttribute('points', '12,1.2 22.6,20.8 1.4,20.8');
            poly.setAttribute('fill', color);
            const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bar.setAttribute('x', '10.7');
            bar.setAttribute('y', '7');
            bar.setAttribute('width', '2.6');
            bar.setAttribute('height', '7');
            bar.setAttribute('rx', '0.6');
            bar.setAttribute('fill', '#0d1117');
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', '12');
            dot.setAttribute('cy', '17.2');
            dot.setAttribute('r', '1.35');
            dot.setAttribute('fill', '#0d1117');
            svg.appendChild(poly);
            svg.appendChild(bar);
            svg.appendChild(dot);
        }
        mark.appendChild(svg);
        const tip = document.createElement('span');
        tip.className = 'mem3-yield-tip';
        const title = document.createElement('span');
        title.className = 'mem3-yield-title';
        title.textContent = 'Utilization';
        const ratio = document.createElement('span');
        ratio.className = 'mem3-yield-pct';
        ratio.textContent = shown + '% · ' + signed + '/' + stations;
        tip.appendChild(title);
        tip.appendChild(ratio);
        const open = openStations || [];
        const disabled = disabledStations || [];
        function stationList(heading, items, color) {
            if (!items.length) return;
            const sub = document.createElement('span');
            sub.className = 'mem3-yield-sub';
            sub.textContent = heading;
            tip.appendChild(sub);
            for (let i = 0; i < items.length; i++) {
                const row = document.createElement('span');
                row.className = 'mem3-yield-station';
                row.textContent = items[i];
                if (color) row.style.color = color;
                tip.appendChild(row);
            }
        }
        if (!open.length) {
            const sub = document.createElement('span');
            sub.className = 'mem3-yield-sub';
            sub.textContent = disabled.length ? 'No empty stations' : 'Every station is signed in';
            tip.appendChild(sub);
        }
        stationList('Empty stations', open);
        stationList('Disabled', disabled, '#8b949e');
        wrap.appendChild(mark);
        wrap.appendChild(tip);
        if (clickPanel) {
            if (!makeYieldSign.bound) {
                makeYieldSign.bound = true;
                document.addEventListener('click', closeYieldPanels);
            }
            tip.addEventListener('click', function (e) { e.stopPropagation(); });
            wrap.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const willOpen = !tip.classList.contains('mem3-yield-open');
                closeYieldPanels();
                if (!willOpen) return;
                const shade = document.createElement('div');
                shade.id = 'mem3-yield-shade';
                shade.style.cssText = 'position:fixed; inset:0; z-index:2147483645; background:rgba(0,0,0,0.45);';
                shade.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    closeYieldPanels();
                });
                document.body.appendChild(shade);
                document.body.appendChild(tip);
                tip.classList.add('mem3-yield-open');
            });
        } else {
            bindYieldHover(wrap, tip);
        }
        return wrap;
    }

    function panelTitle(name) {
        if (name === 'BIGS') return 'BIGs';
        const line = /^LINE\s+(\d+)\s+(ODD|EVEN)/i.exec(name);
        if (line) return 'L' + line[1] + ' ' + (line[2].toUpperCase() === 'ODD' ? 'Odd' : 'Even');
        return name;
    }

    function summaryColumn(name) {
        const columns = {
            'LINE 1 ODD': '2',
            'LINE 1 EVEN': '3',
            'LINE 2 ODD': '4',
            'LINE 2 EVEN': '5',
            'LINE 3 ODD': '6',
            'LINE 3 EVEN': '7',
            'LINE 4 ODD': '8',
            'LINE 4 EVEN': '9'
        };
        return columns[name] || '';
    }

    function makeSummaryCell(opts) {
        const c = uphColor(opts.uph, opts.summaryKey === 'BIGS');
        const cell = document.createElement('div');
        cell.style.cssText = opts.lead
            ? 'display:flex; flex-direction:column; justify-content:center; gap:2px; ' +
              (opts.stacked
                  ? 'width:100%; box-sizing:border-box; min-width:0; margin:0; '
                  : 'flex:1.15 1 0; min-width:0; margin:0 10px 0 0; ') +
              'padding:6px 10px; background:#0d1117; border:1px solid #8b949e; ' +
              'border-left:5px solid #8b949e; border-radius:8px;'
            : 'display:flex; flex-direction:column; justify-content:center; gap:1px; ' +
              'flex:1 1 0; min-width:0; padding:2px 4px; border-left:3px solid #30363d;';

        const kicker = document.createElement('div');
        kicker.textContent = opts.kicker;
        kicker.style.cssText = opts.lead
            ? 'font-size:14px; letter-spacing:0.08em; text-transform:uppercase; ' +
              'color:#ffffff; font-weight:800; white-space:nowrap;'
            : 'font-size:13px; letter-spacing:0.04em; text-transform:uppercase; ' +
              'color:#ffffff; font-weight:800; white-space:nowrap;';
        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex; align-items:center; gap:6px; min-width:0;';
        titleRow.appendChild(kicker);
        const yieldSign = makeYieldSign(opts.signed, opts.stations, opts.openStations, !!opts.lead, opts.disabledStations);
        if (yieldSign) titleRow.appendChild(yieldSign);

        const valueRow = document.createElement('div');
        valueRow.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; gap:2px; line-height:1.05;';
        const size = 22;
        const idlePct = opts.idlePct;
        const ic = idleColor(idlePct);
        const scopeIds = opts.empIds || [];
        const idleScope = opts.idleIds || scopeIds;
        const idleCount = idleIdsIn(idleScope).idle.length;
        cell.setAttribute('data-summary', opts.summaryKey || '');
        function viewButton(title, onClick) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = title;
            btn.setAttribute('aria-label', title);
            btn.setAttribute('data-view', 'eye');
            btn.style.cssText = 'padding:0; margin:0; border:0; background:transparent; cursor:pointer; line-height:0;';
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">' +
                '<path fill="#ffffff" d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/>' +
                '<circle cx="12" cy="12" r="2.2" fill="#161b22"/></svg>';
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            });
            return btn;
        }
        function addMetric(value, unit, color, rank, px, spec) {
            const above = !!(spec && spec.labelAbove);
            const group = document.createElement('span');
            group.style.cssText = above
                ? 'display:flex; flex-direction:column; align-items:flex-start; gap:0; max-width:100%;'
                : 'display:inline-flex; align-items:baseline; gap:4px; max-width:100%;' +
                    (opts.lead ? ' flex-wrap:nowrap; white-space:nowrap;' : ' flex-wrap:wrap;');
            const key = spec && spec.key ? spec.key : '';
            const nums = document.createElement('span');
            nums.style.cssText = 'display:inline-flex; align-items:center; gap:4px;';
            if (key) (above ? nums : group).setAttribute('data-rank-for', key);
            const rankHost = above ? nums : group;
            if (rank === 'best') rankHost.className = 'mem3-pulse-best';
            else if (rank === 'worst') rankHost.className = 'mem3-pulse-worst';
            if (spec && spec.onView) nums.appendChild(viewButton(spec.viewTitle || 'View', spec.onView));
            const num = document.createElement('span');
            num.textContent = value;
            if (key) num.setAttribute('data-metric', key);
            num.style.cssText = 'font-size:' + (px || size) + 'px; font-weight:700; color:' + color +
                '; font-variant-numeric:tabular-nums;';
            nums.appendChild(num);
            const label = document.createElement('span');
            label.textContent = unit;
            label.style.cssText = 'font-size:10px; font-weight:600; color:#8b949e; line-height:1.1;';
            if (above) group.appendChild(label);
            group.appendChild(nums);
            if (!above) group.appendChild(label);
            valueRow.appendChild(group);
        }
        const scopeLabel = opts.scopeLabel || 'Total';
        addMetric(opts.value, 'UPH', opts.uph > 0 ? c : '#c9d1d9', opts.uphRank || '', size, {
            key: 'uph',
            labelAbove: true,
            viewTitle: 'View UPH, lowest first',
            onView: function () { openRosterPopup(scopeLabel, scopeIds, 'uph'); }
        });
        addMetric(idleLabel(idlePct), 'IDLE', ic, opts.idleRank || '', size, {
            key: 'idle',
            labelAbove: true,
            viewTitle: 'View idle percent, highest first',
            onView: function () { openRosterPopup(scopeLabel, idleScope, 'idle'); }
        });
        addMetric(String(idleCount), 'ASSOCIATES IDLE', idleCount > 0 ? '#f85149' : '#c9d1d9', '', size, {
            key: 'idleCount',
            labelAbove: true,
            viewTitle: 'View associates idle for 11 minutes',
            onView: function () { openRosterPopup(scopeLabel, idleScope, 'idleNow'); }
        });
        const breakStats = extendedBreakStats(scopeIds);
        const breakColor = engagedColor(breakStats.pct);
        const breakGroup = document.createElement('span');
        breakGroup.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; gap:1px; max-width:100%;';
        const breakNums = document.createElement('span');
        breakNums.style.cssText = 'display:inline-flex; align-items:center; gap:6px;';
        breakNums.appendChild(viewButton('View extended breaks', function () {
            openExtendedList(scopeLabel, scopeIds);
        }));
        const breakCount = document.createElement('span');
        breakCount.setAttribute('data-metric', 'extended');
        breakCount.textContent = String(breakStats.count);
        breakCount.style.cssText = 'font-size:' + size + 'px; font-weight:700; color:' + breakColor +
            '; font-variant-numeric:tabular-nums;';
        const breakPct = document.createElement('span');
        breakPct.setAttribute('data-metric', 'extendedPct');
        breakPct.textContent = Math.round(breakStats.pct) + '%';
        breakPct.style.cssText = 'font-size:' + size + 'px; font-weight:700; color:' + breakColor +
            '; font-variant-numeric:tabular-nums;';
        const breakLabel = document.createElement('span');
        breakLabel.textContent = 'EXTENDED BREAKS';
        breakLabel.style.cssText = 'font-size:10px; font-weight:600; color:#8b949e; line-height:1.1;';
        const breakBar = document.createElement('span');
        breakBar.textContent = '|';
        breakBar.style.cssText = 'font-size:' + size + 'px; font-weight:700; color:#ffffff;';
        breakNums.appendChild(breakCount);
        breakNums.appendChild(breakBar);
        breakNums.appendChild(breakPct);
        breakGroup.appendChild(breakLabel);
        breakGroup.appendChild(breakNums);
        valueRow.appendChild(breakGroup);
        addMetric(formatUnits(opts.units || 0), 'units', '#8b949e', '', 13, { key: 'units' });
        addMetric(formatDuration(opts.idleMin || 0), 'hrs idle', '#8b949e', '', 13, { key: 'idleHours' });

        cell.appendChild(titleRow);
        cell.appendChild(valueRow);
        return cell;
    }

    let LAST_SUMMARY = null;

    function ensureSummaryActions() {
        let actions = document.getElementById('mem3-summary-actions');
        if (actions && actions.getAttribute('data-mem3-probe') !== 'actions-v1946') actions.remove();
        if (actions && actions.isConnected && actions.getAttribute('data-mem3-probe') === 'actions-v1946') return actions;
        actions = document.createElement('div');
        actions.id = 'mem3-summary-actions';
        actions.setAttribute('data-mem3-probe', 'actions-v1946');
        actions.style.cssText = 'display:grid; grid-template-columns:188px 188px; gap:6px; ' +
            'align-self:flex-start; margin-left:auto;';
        const copyBtn = panelChipButton('Copy debug', function () {
            copyText(JSON.stringify(collectSummaryDebug(), null, 2)).then(function () {
                copyBtn.textContent = 'Copied';
                setTimeout(function () { copyBtn.textContent = 'Copy debug'; }, 1500);
            }).catch(function () {
                copyBtn.textContent = 'Copy failed';
                setTimeout(function () { copyBtn.textContent = 'Copy debug'; }, 2000);
            });
        });
        actions.appendChild(makeShowLeavingButton());
        actions.appendChild(makeEarlyUnassignButton());
        actions.appendChild(makeViewNotesButton());
        actions.appendChild(makeExtendedBreaksButton());
        actions.appendChild(makeRecalcBreaksButton());
        actions.appendChild(copyBtn);
        return actions;
    }

    let summaryWatchAt = 0;

    function idleStretchMin(time) {
        const fn = time && time.lastFunction;
        return fn ? (fn.minutes || 0) : 0;
    }

    function sortIdleIds(ids) {
        ids.sort(function (a, b) {
            const gap = idleStretchMin(LAST_TIME[b]) - idleStretchMin(LAST_TIME[a]);
            if (gap) return gap;
            const an = (personForEmp(a).name || personForEmp(a).login || a).toLowerCase();
            const bn = (personForEmp(b).name || personForEmp(b).login || b).toLowerCase();
            if (an < bn) return -1;
            if (an > bn) return 1;
            return String(a) < String(b) ? -1 : (String(a) > String(b) ? 1 : 0);
        });
        return ids;
    }

    function uniqueIds(ids) {
        const seen = Object.create(null);
        const out = [];
        const list = ids || [];
        for (let i = 0; i < list.length; i++) {
            const id = list[i];
            if (!id || seen[id]) continue;
            seen[id] = true;
            out.push(id);
        }
        return out;
    }

    function lineIdsOf(data) {
        const ids = [];
        const lines = (data && data.lines) || [];
        for (let i = 0; i < lines.length; i++) {
            const list = lines[i].empIds || [];
            for (let j = 0; j < list.length; j++) ids.push(list[j]);
        }
        return uniqueIds(ids);
    }

    function lineIdleIdsOf(data) {
        const ids = [];
        const lines = (data && data.lines) || [];
        for (let i = 0; i < lines.length; i++) {
            const list = lines[i].idleIds || lines[i].empIds || [];
            for (let j = 0; j < list.length; j++) ids.push(list[j]);
        }
        return uniqueIds(ids);
    }

    // Idle starts at 11 minutes on the latest function row.
    // A shorter indirect or Time Off Task row is the lag after a scan.
    function idleIdsIn(ids) {
        const pool = uniqueIds(ids);
        const idle = [];
        const under10 = [];
        for (let i = 0; i < pool.length; i++) {
            const id = pool[i];
            const time = LAST_TIME[id];
            const fn = time && time.lastFunction;
            if (isClockedOut(id)) continue;
            if (!fn) continue;
            if (fn.bucket !== 'indirect' && fn.bucket !== 'tot') continue;
            if (showsIdleNow(time, id)) idle.push(id);
            else under10.push(id);
        }
        return { idle: sortIdleIds(idle), under10: sortIdleIds(under10) };
    }

    function idleScan() {
        return idleIdsIn(BOARD_IDS);
    }

    function personSortName(id) {
        const person = personForEmp(id);
        return (person.name || person.login || id).toLowerCase();
    }

    function worstUphIds(ids) {
        const list = uniqueIds(ids);
        list.sort(function (a, b) {
            const as = statsFor(a);
            const bs = statsFor(b);
            const au = as.hasData ? as.uph : -1;
            const bu = bs.hasData ? bs.uph : -1;
            if (au !== bu) return au - bu;
            const an = personSortName(a);
            const bn = personSortName(b);
            if (an < bn) return -1;
            if (an > bn) return 1;
            return String(a) < String(b) ? -1 : (String(a) > String(b) ? 1 : 0);
        });
        return list;
    }

    function worstIdleIds(ids) {
        const list = uniqueIds(ids);
        list.sort(function (a, b) {
            const ap = idlePercent(LAST_TIME[a]);
            const bp = idlePercent(LAST_TIME[b]);
            const av = ap === null ? -1 : ap;
            const bv = bp === null ? -1 : bp;
            if (av !== bv) return bv - av;
            const an = personSortName(a);
            const bn = personSortName(b);
            if (an < bn) return -1;
            if (an > bn) return 1;
            return String(a) < String(b) ? -1 : (String(a) > String(b) ? 1 : 0);
        });
        return list;
    }

    function idleAssociateIds() {
        return idleScan().idle;
    }

    function stationLabel(text) {
        const raw = String(text || '').replace(/\s+/g, ' ').trim();
        if (!raw) return '';
        if (/1st\s*half/i.test(raw) || /station/i.test(raw)) return formatOpenStation(raw);
        return raw;
    }

    function idleAssociateDebug(empId) {
        const person = personForEmp(empId);
        const time = LAST_TIME[empId];
        const stats = statsFor(empId);
        const fn = time && time.lastFunction;
        let timeUrl = '';
        try { timeUrl = fclmEmpUrl(empId); } catch (e) { timeUrl = ''; }
        return {
            script: SCRIPT_LABEL,
            version: SCRIPT_VERSION,
            what: 'idle-associate',
            capturedAt: new Date().toISOString(),
            window: windowPreset(ACTIVE_WINDOW).label,
            associate: person.name || person.login || person.empId,
            login: person.login,
            empId: person.empId,
            station: stationLabel(person.station),
            stationRaw: person.station || '',
            line: person.line,
            uph: stats.hasData ? stats.uph : null,
            units: stats.hasData ? stats.units : null,
            idlePercent: idlePercent(time),
            idleForMin: fn ? fn.minutes : null,
            idleHours: time && time.hasTime ? (Number(time.idleMin) || 0) / 60 : null,
            idleStartsAtMin: IDLE_START_MIN,
            clock: person.clock,
            shownAs: showsIdleNow(time, empId)
                ? ('Idle for ' + formatDuration(idleStretchMin(time)))
                : 'Not currently in Idle Time.',
            why: idleNowReason(time, empId),
            lastFunction: fn || null,
            currentlyIdle: showsIdleNow(time, empId),
            time: timeSnapshot(time, empId),
            rollup: rollupSnapshot(empId),
            timeUrl: timeUrl
        };
    }

    function idleAssociatesDebug() {
        const scan = idleScan();
        const associates = [];
        const under10 = [];
        for (let i = 0; i < scan.idle.length; i++) associates.push(idleAssociateDebug(scan.idle[i]));
        for (let i = 0; i < scan.under10.length; i++) under10.push(idleAssociateDebug(scan.under10[i]));
        return {
            script: SCRIPT_LABEL,
            version: SCRIPT_VERSION,
            what: 'idle-associates',
            capturedAt: new Date().toISOString(),
            window: windowPreset(ACTIVE_WINDOW).label,
            rule: 'Latest function row is indirect or Time Off Task for at least 11 minutes. A shorter row is not counted. A diamond in the title is still that stretch. A clocked-out associate is not counted.',
            count: associates.length,
            under10Count: under10.length,
            associates: associates,
            under10: under10
        };
    }

    function idleField(label, value, color) {
        const row = document.createElement('div');
        row.style.cssText = 'font-size:12px; font-weight:650; line-height:1.35;';
        const name = document.createElement('span');
        name.textContent = label + ' ';
        name.style.cssText = 'color:#8b949e; font-weight:700;';
        const val = document.createElement('span');
        val.textContent = value;
        if (color) val.style.color = color;
        row.appendChild(name);
        row.appendChild(val);
        return row;
    }

    function rosterPeople(ids, mode) {
        if (mode === 'uph') return worstUphIds(ids);
        if (mode === 'idle') return worstIdleIds(ids);
        return idleIdsIn(ids).idle;
    }

    function rosterDebug(title, ids) {
        const associates = [];
        for (let i = 0; i < ids.length; i++) associates.push(idleAssociateDebug(ids[i]));
        return {
            script: SCRIPT_LABEL,
            version: SCRIPT_VERSION,
            what: 'roster',
            capturedAt: new Date().toISOString(),
            window: windowPreset(ACTIVE_WINDOW).label,
            title: title,
            count: associates.length,
            associates: associates
        };
    }

    function photoForEmp(empId) {
        const stored = (BOARD_PEOPLE[empId] && BOARD_PEOPLE[empId].photo) || '';
        const login = String((personForEmp(empId).login) || '').toLowerCase();
        if (!login) return stored;
        const tables = document.querySelectorAll('table');
        for (let t = 0; t < tables.length; t++) {
            const table = tables[t];
            if (table.closest && table.closest('#' + FLOOR_SUMMARY_ID)) continue;
            const trs = tableRows(table);
            for (let i = 0; i < trs.length; i++) {
                const found = findLoginInRow(trs[i]);
                if (!found || found.login !== login) continue;
                const url = badgePhotoUrl(avatarEl(trs[i]));
                if (!url) continue;
                if (BOARD_PEOPLE[empId]) BOARD_PEOPLE[empId].photo = url;
                rememberPhoto(login, url);
                return url;
            }
        }
        return stored;
    }

    function idleNowReason(time, empId) {
        const fn = time && time.lastFunction;
        if (isClockedOut(empId)) return 'Latest punch is clocked out, so they are not counted as idle now.';
        if (!fn) return 'No function row was read from Time Details.';
        const mins = fn.minutes || 0;
        const lead = 'Latest function row is ' + (fn.bucket || 'unknown') + ', ' +
            formatDuration(mins) + ', title ' + (fn.title || '') + '.';
        if (fn.bucket !== 'indirect' && fn.bucket !== 'tot') return lead + ' That row is not indirect or Time Off Task.';
        if (mins < IDLE_START_MIN) return lead + ' That is under ' + IDLE_START_MIN + ' minutes, so they are not counted as idle now.';
        return lead + ' Idle for uses this one row. It is not the idle total for the window.';
    }

    function idleHoursLabel(minutes) {
        const hours = (Number(minutes) || 0) / 60;
        return '(' + hours.toFixed(2) + ' Hours of Idle Time)';
    }

    function idleNowYield() {
        const mark = yieldTriangle('#d29922', 'Currently Idle', true);
        mark.style.marginLeft = '6px';
        const svg = mark.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '15');
        }
        return mark;
    }

    function rosterPhoto(empId, login) {
        const photoPx = CLOCK_PHOTO_PX * 3;
        const ringPx = CLOCK_RING_PX * 3;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'flex:0 0 auto; padding:' + ringPx + 'px; line-height:0;';
        const photo = document.createElement('div');
        photo.setAttribute('data-mem3-photo', '1');
        const url = (empId && photoForEmp(empId)) || photoForLogin(login);
        photo.style.cssText = 'position:relative; width:' + photoPx + 'px; height:' + photoPx + 'px; ' +
            'border-radius:50%; background:#21262d center/cover no-repeat;';
        if (url) photo.style.backgroundImage = 'url("' + String(url).replace(/"/g, '') + '")';
        const person = empId ? personForEmp(empId) : null;
        const ident = IDENTITY.byLogin[String(login || '').trim().toLowerCase()] || null;
        const clock = clockLabel((person && person.clockStatus) || clockFor(ident, empId));
        if (clock) {
            photo.title = clock.text;
            const ring = document.createElement('span');
            ring.className = 'mem3-popup-clock-ring';
            ring.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; box-sizing:border-box; ' +
                'border-radius:50%; pointer-events:none; border:0; background:transparent; ' +
                'box-shadow:0 0 0 ' + ringPx + 'px ' + clock.color + ';';
            photo.appendChild(ring);
        }
        wrap.appendChild(photo);
        return wrap;
    }

    function personCard(empId) {
        const person = personForEmp(empId);
        const time = LAST_TIME[empId];
        const stats = statsFor(empId);
        const card = document.createElement('div');
        card.style.cssText = 'display:flex; align-items:center; gap:8px; background:#0d1117; ' +
            'border:1px solid #30363d; border-radius:8px; padding:8px;';
        card.appendChild(rosterPhoto(empId, person.login));
        const info = document.createElement('div');
        info.style.cssText = 'flex:1 1 auto; min-width:0;';
        const name = document.createElement('div');
        name.textContent = person.name || person.login || person.empId;
        name.style.cssText = 'font-size:14px; font-weight:800; margin-bottom:4px;';
        info.appendChild(name);
        info.appendChild(idleField('Login', person.login || '\u2014'));
        info.appendChild(idleField('Station', stationLabel(person.station) || '\u2014'));
        info.appendChild(idleField(
            'UPH',
            stats.hasData ? (stats.uph > 0 ? stats.uph.toFixed(1) : '0') : '\u2014',
            stats.hasData ? uphColor(stats.uph, personUsesBigsRate(empId)) : '#8b949e'
        ));
        const pct = idlePercent(time);
        const idleRow = idleField('Idle', idleLabel(pct), idleColor(pct));
        if (time && time.hasTime) {
            const hours = document.createElement('span');
            hours.textContent = ' ' + idleHoursLabel(time.idleMin);
            hours.style.color = '#ffffff';
            idleRow.appendChild(hours);
        }
        info.appendChild(idleRow);
        if (showsIdleNow(time, empId)) {
            const stretch = idleField('Idle for', formatDuration(idleStretchMin(time)));
            stretch.appendChild(idleNowYield());
            info.appendChild(stretch);
        } else {
            const quiet = document.createElement('div');
            quiet.textContent = 'Not currently in Idle Time.';
            quiet.style.cssText = 'font-size:12px; font-weight:650; line-height:1.35;';
            info.appendChild(quiet);
        }
        info.appendChild(timeDetailsLink(empId));
        card.appendChild(info);
        return card;
    }

    function openRosterPopup(scopeLabel, ids, mode) {
        const old = document.getElementById('mem3-roster-popup');
        if (old) old.remove();
        const people = rosterPeople(ids, mode);
        const titles = {
            uph: 'UPH, lowest first',
            idle: 'Idle percent, highest first',
            idleNow: 'Idle for 11 minutes'
        };
        const notes = {
            uph: 'Lowest rate first. Someone with no Primary Grading rate is at the top.',
            idle: 'Highest idle percent first. The percent is the whole window, not this stretch.',
            idleNow: 'Latest function row is indirect or Time Off Task for at least 11 minutes. Clocked-out associates are left out.'
        };
        const headingText = (scopeLabel || 'Total') + ' \u00b7 ' + (titles[mode] || 'Associates');
        installPulseStyles();
        const overlay = document.createElement('div');
        overlay.id = 'mem3-roster-popup';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:2147483646; background:rgba(0,0,0,0.55); ' +
            'display:flex; align-items:flex-start; justify-content:center; padding:32px 16px; ' +
            'font-family:Segoe UI,system-ui,sans-serif; color:#ffffff;';
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        const card = document.createElement('div');
        card.style.cssText = 'width:min(720px, 100%); max-height:calc(100vh - 64px); overflow:auto; ' +
            'background:#161b22; border:1px solid #30363d; border-radius:12px; padding:18px 18px 8px;';
        const top = document.createElement('div');
        top.style.cssText = 'display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:8px;';
        const headingWrap = document.createElement('div');
        const heading = document.createElement('div');
        heading.textContent = headingText;
        heading.style.cssText = 'font-size:18px; font-weight:800;';
        const sub = document.createElement('div');
        sub.textContent = people.length + (people.length === 1 ? ' associate' : ' associates');
        sub.style.cssText = 'font-size:13px; font-weight:500; color:#c9d1d9; margin-top:4px;';
        headingWrap.appendChild(heading);
        headingWrap.appendChild(sub);
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex; gap:8px; flex:0 0 auto;';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = 'padding:6px 12px; border-radius:8px; cursor:pointer; color:#ffffff; ' +
            'background:#0d1117; border:1px solid #8b949e; font:800 12px Segoe UI,system-ui,sans-serif;';
        close.addEventListener('click', function () { overlay.remove(); });
        actions.appendChild(close);
        top.appendChild(headingWrap);
        top.appendChild(actions);
        card.appendChild(top);
        const note = document.createElement('div');
        note.textContent = notes[mode] || '';
        note.style.cssText = 'font-size:12px; font-weight:500; color:#8b949e; margin:0 0 12px;';
        card.appendChild(note);
        if (!people.length) {
            const empty = document.createElement('div');
            empty.textContent = mode === 'idleNow'
                ? 'No associate has been idle for 11 minutes.'
                : 'No associates on this list.';
            empty.style.cssText = 'font-size:13px; font-weight:650; margin-bottom:12px;';
            card.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-bottom:12px;';
            for (let i = 0; i < people.length; i++) list.appendChild(personCard(people[i]));
            card.appendChild(list);
        }
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    function summaryIsMounted() {
        const node = document.getElementById(FLOOR_SUMMARY_ID);
        return !!(node && node.firstChild);
    }

    function ensureFloorSummary() {
        if (unassigning) return;
        if (!isAssignmentsPage() || !assignmentsReady()) return;
        if (summaryIsMounted()) return;
        if (LAST_SUMMARY) {
            placeFloorSummary();
            return;
        }
        const now = Date.now();
        if (now - summaryWatchAt < 2000) return;
        summaryWatchAt = now;
        render();
    }

    function summaryStructureSig(data) {
        return 'v54|' + ACTIVE_WINDOW + '|' + (LAST_ROLLUP_AT ? '1' : '0') + '|' +
            (data.floorSigned || 0) + '/' + (data.floorStations || 0) + '|' +
            (data.floorOpen || []).join(';') + '|' +
            (data.floorDisabled || []).join(';') + '|' +
            data.floorStaffed + '|' + (data.asOf || '') + '|' +
            (data.lines || []).map(function (l) {
                return l.name + ':' + l.withData + ':' + l.staffed + ':' +
                    (l.signed || 0) + '/' + (l.stations || 0) + ':' +
                    (l.openStations || []).join(';') + ':' +
                    (l.disabledStations || []).join(';') + ':' + (l.empIds || []).join('.') +
                    ':' + (l.idleIds || []).join('.');
            }).join(',');
    }

    function summaryCellByKey(node, key) {
        const cells = node.querySelectorAll('[data-summary]');
        for (let i = 0; i < cells.length; i++) {
            if (cells[i].getAttribute('data-summary') === key) return cells[i];
        }
        return null;
    }

    function paintSummaryMetrics(node, data) {
        const ranks = extremeRanks(data.lines);
        function paint(key, spec) {
            const cell = summaryCellByKey(node, key);
            if (!cell) return false;
            function num(metric, text, color) {
                const el = cell.querySelector('[data-metric="' + metric + '"]');
                if (!el) return;
                if (el.textContent !== text) el.textContent = text;
                if (color) el.style.color = color;
            }
            function rank(metric, which) {
                const el = cell.querySelector('[data-rank-for="' + metric + '"]');
                if (!el) return;
                el.classList.remove('mem3-pulse-best', 'mem3-pulse-worst');
                if (which === 'best') el.classList.add('mem3-pulse-best');
                else if (which === 'worst') el.classList.add('mem3-pulse-worst');
            }
            num('uph', spec.uphText, spec.uph > 0 ? uphColor(spec.uph, key === 'BIGS') : '#c9d1d9');
            rank('uph', spec.uphRank || '');
            num('units', formatUnits(spec.units || 0), '#8b949e');
            num('idle', idleLabel(spec.idlePct), idleColor(spec.idlePct));
            rank('idle', spec.idleRank || '');
            num('idleCount', String(spec.idleCount), spec.idleCount > 0 ? '#f85149' : '#c9d1d9');
            const breaks = extendedBreakStats(spec.empIds);
            const breakColor = engagedColor(breaks.pct);
            num('extended', String(breaks.count), breakColor);
            num('extendedPct', Math.round(breaks.pct) + '%', breakColor);
            num('idleHours', formatDuration(spec.idleMin || 0), '#8b949e');
            return true;
        }
        const totalIds = lineIdsOf(data);
        const totalIdleIds = lineIdleIdsOf(data);
        if (!paint('total', {
            uphText: data.floorAvg > 0 ? data.floorAvg.toFixed(1) : '\u2014',
            uph: data.floorAvg,
            idlePct: sideIdlePct(data.floorIdleMin || 0, data.floorClockedMin || 0),
            idleCount: idleIdsIn(totalIdleIds).idle.length,
            empIds: totalIds,
            units: data.floorUnits || 0,
            idleMin: data.floorIdleMin || 0
        })) return false;
        for (let i = 0; i < data.lines.length; i++) {
            const line = data.lines[i];
            if (!paint(line.name, {
                uphText: line.avgUph > 0 ? line.avgUph.toFixed(1) : '\u2014',
                uph: line.avgUph,
                uphRank: uphHighlight(line, ranks),
                idlePct: sideIdlePct(line.idleMin || 0, line.clockedMin || 0),
                idleRank: metricRank(shownIdle(line), ranks.bestIdle, ranks.worstIdle),
                idleCount: idleIdsIn(line.idleIds || line.empIds || []).idle.length,
                empIds: line.empIds || [],
                units: line.totalUnits || 0,
                idleMin: line.idleMin || 0
            })) return false;
        }
        return true;
    }

    function placeFloorSummary(summary) {
        if (summary) LAST_SUMMARY = summary;
        const data = LAST_SUMMARY;
        if (!data) return;
        const bar = findToolbar();
        const main = document.querySelector('main') || document.querySelector('[role="main"]');
        if ((!bar || !bar.parentElement) && !main) {
            setTimeout(ensureFloorSummary, 300);
            return;
        }

        let node = document.getElementById(FLOOR_SUMMARY_ID);
        if (bar && bar.parentElement) {
            if (node && node.previousElementSibling !== bar) {
                node.remove();
                node = null;
            }
            if (!node) {
                node = document.createElement('div');
                node.id = FLOOR_SUMMARY_ID;
                if (bar.nextSibling) bar.parentElement.insertBefore(node, bar.nextSibling);
                else bar.parentElement.appendChild(node);
            }
        } else if (!node) {
            node = document.createElement('div');
            node.id = FLOOR_SUMMARY_ID;
            main.insertBefore(node, main.firstChild);
        }

        const sig = summaryStructureSig(data);
        if (node.getAttribute('data-sig') === sig && node.firstChild) {
            if (paintSummaryMetrics(node, data)) {
                paintProgress();
                return;
            }
        }
        node.setAttribute('data-sig', sig);
        const actions = ensureSummaryActions();
        if (actions.parentElement) actions.remove();

        node.style.cssText = 'display:flex; flex-direction:column; align-items:stretch; gap:8px; ' +
            'flex:0 0 auto; width:100%; height:auto; min-width:0; box-sizing:border-box; margin:8px 0 6px; padding:8px 10px; ' +
            'overflow:visible; background:#161b22; border:1px solid #30363d; border-radius:10px; ' +
            'font-family:Segoe UI,system-ui,sans-serif; color:#ffffff;';

        while (node.firstChild) node.removeChild(node.firstChild);
        installPulseStyles();
        const ranks = extremeRanks(data.lines);

        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:flex-start; justify-content:space-between; gap:8px; width:100%;';
        const titleWrap = document.createElement('div');
        titleWrap.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; gap:1px;';
        const nameRow = document.createElement('div');
        nameRow.style.cssText = 'display:flex; align-items:baseline; gap:8px;';
        const nameEl = document.createElement('div');
        nameEl.textContent = 'Productivity Panel';
        nameEl.style.cssText = 'font-size:14px; font-weight:800; letter-spacing:0.04em; ' +
            'text-transform:uppercase; color:#ffffff; white-space:nowrap;';
        const versionEl = document.createElement('div');
        versionEl.textContent = 'v' + SCRIPT_VERSION;
        versionEl.style.cssText = 'font-size:14px; font-weight:800; letter-spacing:0.03em; color:#ffffff;';
        const byline = document.createElement('div');
        byline.textContent = 'Developed by abelrigm';
        byline.style.cssText = 'font-size:10px; font-weight:600; color:#8b949e; line-height:1;';
        nameRow.appendChild(nameEl);
        nameRow.appendChild(versionEl);
        nameRow.appendChild(makeInfoButton());
        titleWrap.appendChild(nameRow);
        titleWrap.appendChild(byline);
        const refreshRow = document.createElement('div');
        refreshRow.setAttribute('data-mem3-refresh', '');
        refreshRow.style.cssText = 'display:flex; align-items:center; gap:6px; margin-top:4px;';
        const count = document.createElement('div');
        count.setAttribute('data-mem3-refresh-count', '');
        count.style.cssText = 'font:800 12px Segoe UI,system-ui,sans-serif; color:#f5c518; min-width:108px;';
        const every = document.createElement('select');
        every.setAttribute('data-mem3-refresh-every', '');
        every.style.cssText = 'padding:2px 4px; border-radius:6px; border:1px solid #30363d; background:#0d1117; ' +
            'color:#fff; font:700 12px Segoe UI,system-ui,sans-serif;';
        for (let minute = 1; minute <= 5; minute++) {
            const opt = document.createElement('option');
            opt.value = String(minute);
            opt.textContent = minute + ' min';
            every.appendChild(opt);
        }
        every.value = String(refreshMinutes());
        every.addEventListener('change', function () {
            const picked = parseInt(every.value, 10);
            if (picked < 1 || picked > 5) return;
            saveRefreshMinutes(picked);
            scheduleNextRefresh();
        });
        refreshRow.appendChild(count);
        refreshRow.appendChild(every);
        titleWrap.appendChild(refreshRow);
        paintRefreshCountdown();
        header.appendChild(titleWrap);

        const windows = document.createElement('div');
        windows.style.cssText = 'display:flex; width:100%; flex-wrap:nowrap; gap:12px; align-items:flex-end; min-width:0;';
        const anchor = shiftAnchor(new Date());
        function presetRange(preset) {
            const start = new Date(anchor.start.getTime() + preset.startMin * 60000);
            const endText = preset.endMin === null
                ? 'now'
                : shortClock(new Date(anchor.start.getTime() + preset.endMin * 60000));
            return shortClock(start) + '–' + endText;
        }
        function windowButton(title, active, onClick) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = title;
            btn.style.cssText = 'flex:1 1 0; min-width:0; padding:5px 8px; border-radius:8px; cursor:pointer; ' +
                'text-align:center; color:#ffffff; background:#0d1117; ' +
                'font:800 12px Segoe UI,system-ui,sans-serif; letter-spacing:0.03em; text-transform:uppercase; ' +
                'white-space:nowrap; ' +
                (active
                    ? 'border:1px solid #8b949e; border-left:4px solid #ffffff;'
                    : 'border:1px solid #30363d; border-left:4px solid #30363d;');
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            });
            return btn;
        }
        for (let g = 0; g < WINDOW_GROUPS.length; g++) {
            const groupName = WINDOW_GROUPS[g];
            const group = document.createElement('div');
            group.style.cssText = 'display:flex; flex-direction:column; gap:3px; min-width:0; ' +
                (groupName === 'Shift' ? 'flex:0 0 auto;' : 'flex:1 1 0;');
            const groupLabel = document.createElement('div');
            groupLabel.textContent = groupName;
            groupLabel.style.cssText = 'font:800 10px Segoe UI,system-ui,sans-serif; letter-spacing:0.06em; ' +
                'text-transform:uppercase; color:#ffffff;';
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; gap:4px;';
            for (let w = 0; w < WINDOW_PRESETS.length; w++) {
                const preset = WINDOW_PRESETS[w];
                if (preset.group !== groupName) continue;
                row.appendChild(windowButton(preset.short, preset.id === ACTIVE_WINDOW, function () {
                    forceWindow(preset.id);
                }));
            }
            group.appendChild(groupLabel);
            group.appendChild(row);
            windows.appendChild(group);
        }
        windows.appendChild(windowButton('Reload', false, function () { forceWindow(ACTIVE_WINDOW); }));
        const activePreset = windowPreset(ACTIVE_WINDOW);
        const caption = document.createElement('div');
        caption.textContent = activePreset.label + '  ' + presetRange(activePreset);
        caption.style.cssText = 'font:700 12px Segoe UI,system-ui,sans-serif; color:#ffffff;';
        node.appendChild(header);
        node.appendChild(windows);
        node.appendChild(caption);
        if (!LAST_ROLLUP_AT) {
            const miss = document.createElement('div');
            miss.textContent = refreshBusy
                ? 'Recalculating UPH and idle'
                : 'No UPH \u2014 sign in to Midway, then Reload';
            miss.style.cssText = 'font:700 12px Segoe UI,system-ui,sans-serif; color:#d29922;';
            node.appendChild(miss);
        }

        const progress = document.createElement('div');
        progress.id = 'mem3-idle-progress';
        progress.style.cssText = 'width:100%; margin:0; display:none;';
        progress.innerHTML = '<div data-label style="font-size:11px; color:#8b949e; font-weight:600; margin-bottom:4px;">Calculating Idle Time Percent</div>' +
            '<div style="height:6px; background:#0d1117; border-radius:99px; overflow:hidden;">' +
            '<div data-fill style="height:100%; width:0; background:#58a6ff;"></div></div>';
        node.appendChild(progress);
        const breakProgress = document.createElement('div');
        breakProgress.id = 'mem3-break-progress';
        breakProgress.style.cssText = 'width:100%; margin:0; display:none;';
        breakProgress.innerHTML = '<div data-label style="font-size:11px; color:#8b949e; font-weight:600; margin-bottom:4px;">Calculating Extended Breaks</div>' +
            '<div style="height:6px; background:#0d1117; border-radius:99px; overflow:hidden;">' +
            '<div data-fill style="height:100%; width:0; background:#d29922;"></div></div>';
        node.appendChild(breakProgress);

        const metrics = document.createElement('div');
        metrics.style.cssText = 'display:grid; grid-template-columns:minmax(168px,1.15fr) repeat(8,minmax(0,1fr)); ' +
            'grid-template-rows:auto auto; column-gap:0; row-gap:6px; width:100%; min-width:0; ' +
            'overflow-x:auto; overflow-y:hidden; align-items:start;';

        const totalIds = lineIdsOf(data);
        const totalCell = makeSummaryCell({
            summaryKey: 'total',
            scopeLabel: 'Total',
            empIds: totalIds,
            idleIds: lineIdleIdsOf(data),
            kicker: 'Total',
            value: data.floorAvg > 0 ? data.floorAvg.toFixed(1) : '\u2014',
            uph: data.floorAvg,
            units: data.floorUnits || 0,
            idleMin: data.floorIdleMin || 0,
            idlePct: sideIdlePct(data.floorIdleMin || 0, data.floorClockedMin || 0),
            signed: data.floorSigned || 0,
            stations: data.floorStations || 0,
            openStations: data.floorOpen || [],
            disabledStations: data.floorDisabled || [],
            lead: true,
            title: 'Average of the side rates and BIGs. Total work time and IDLE time are summed once per associate from FCLM Time Details.'
        });
        totalCell.style.gridColumn = '1';
        totalCell.style.gridRow = '1 / span 2';
        totalCell.style.alignSelf = 'start';
        totalCell.style.height = 'auto';
        metrics.appendChild(totalCell);

        for (let i = 0; i < data.lines.length; i++) {
            const line = data.lines[i];
            const cell = makeSummaryCell({
                summaryKey: line.name,
                scopeLabel: panelTitle(line.name),
                empIds: line.empIds || [],
                idleIds: line.idleIds || line.empIds || [],
                kicker: panelTitle(line.name),
                value: line.avgUph > 0 ? line.avgUph.toFixed(1) : '\u2014',
                uph: line.avgUph,
                units: line.totalUnits || 0,
                idleMin: line.idleMin || 0,
                idlePct: sideIdlePct(line.idleMin || 0, line.clockedMin || 0),
                uphRank: uphHighlight(line, ranks),
                idleRank: metricRank(shownIdle(line), ranks.bestIdle, ranks.worstIdle),
                signed: line.signed || 0,
                stations: line.stations || 0,
                openStations: line.openStations || [],
                disabledStations: line.disabledStations || [],
                title: panelTitle(line.name) + ' \u00b7 ' + gradingLabel() +
                    (line.avgUph > 0 ? '' : ' \u00b7 no rate this shift') +
                    ' \u00b7 ' + idleLabel(sideIdlePct(line.idleMin || 0, line.clockedMin || 0)) + ' IDLE \u00b7 ' +
                    formatDuration(line.idleMin || 0) + ' / ' + formatDuration(line.clockedMin || 0) + ' clocked in'
            });
            if (line.name === 'BIGS') {
                cell.style.gridColumn = '2';
                cell.style.gridRow = '2';
            } else {
                cell.style.gridColumn = summaryColumn(line.name);
                cell.style.gridRow = '1';
            }
            metrics.appendChild(cell);
        }

        node.appendChild(metrics);
        header.appendChild(actions);
        paintEarlyLog();
        paintProgress();
        node.setAttribute('data-sig', sig);
    }

    function makeLineBadge(avgUph, totalUnits, withData, staffed, totalMin, idleMin, clockedMin, both, crSigned, crStations, openStations, disabledStations, bigs) {
        const wrap = document.createElement('span');
        wrap.className = SECTION_BADGE_CLASS;
        wrap.style.cssText = 'display:inline-flex; gap:10px; margin-left:14px; align-items:center; ' +
            'font-family:Segoe UI,system-ui,sans-serif; font-weight:normal; font-size:12px; vertical-align:middle;';
        const c = uphColor(avgUph, bigs);
        const pct = sideIdlePct(idleMin, clockedMin);
        const rateGroup = document.createElement('span');
        rateGroup.style.cssText = 'display:inline-flex; align-items:baseline; gap:5px;';
        rateGroup.appendChild(makePill((avgUph > 0 ? avgUph.toFixed(1) : '-') + ' UPH', c, 18));
        rateGroup.appendChild(makeUnitsHint(totalUnits, 12));
        wrap.appendChild(rateGroup);
        wrap.appendChild(makePill(idleLabel(pct) + ' IDLE', idleColor(pct), 18));
        const sign = makeYieldSign(crSigned, crStations, openStations, false, disabledStations);
        if (sign) wrap.appendChild(sign);
        return wrap;
    }

    function decorateSection(panelName, sectionLabels) {
        const uphList = [];
        const empIds = [];
        const idleIds = [];
        const idleLeftOut = [];
        let totalUnits = 0, staffed = 0, total = 0, withData = 0, totalMin = 0, idleMin = 0, clockedMin = 0, both = 0;
        let crStations = 0, crSigned = 0;
        const openStations = [];
        const disabledStations = [];

        for (let s = 0; s < sectionLabels.length; s++) {
            const h = findH5(sectionLabels[s]);
            if (!h) { warn('section header not found:', sectionLabels[s]); continue; }
            const table = findTable(h);
            if (!table) { warn('no table for', sectionLabels[s]); continue; }

            const trs = table.querySelectorAll('tbody tr');
            for (let i = 0; i < trs.length; i++) {
                const tr = trs[i];
                total++;
                const assignment = rowAssignmentText(tr);
                const returnsStation = isCustomerReturnsStation(assignment);
                const disabled = returnsStation && stationIsDisabled(tr);
                if (disabled) {
                    const disabledLabel = formatOpenStation(assignment);
                    if (disabledLabel) disabledStations.push(disabledLabel);
                }
                const crStation = returnsStation && !disabled;
                if (crStation) crStations++;

                const found = findLoginInRow(tr);
                if (crStation && found) crSigned++;
                else if (crStation) {
                    const openLabel = formatOpenStation(assignment);
                    if (openLabel) openStations.push(openLabel);
                }
                if (!found) {
                    const leftover = tr.querySelector('.' + DECOR_CLASS);
                    if (leftover) leftover.remove();
                    continue;
                }
                staffed++;

                const person = IDENTITY.byLogin[found.login];
                const empId = resolveEmpId(person);
                const stats = statsFor(empId, panelName === 'BIGS');
                const time = timeFor(empId);
                const skipIdle = panelName === 'BIGS' && excludedFromBigsIdle(assignment);
                if (skipIdle && idleLeftOut.indexOf(assignment) === -1) idleLeftOut.push(assignment);
                if (empId) {
                    if (empIds.indexOf(empId) === -1) empIds.push(empId);
                    if (!skipIdle && idleIds.indexOf(empId) === -1) idleIds.push(empId);
                    rememberBoardPerson(empId, person, panelName, rowAssignmentText(tr), badgePhotoUrl(avatarEl(tr)));
                }
                if (stats.hasData) withData++;
                if (stats.hasData && showsIdle(time)) both++;
                if (stats.uph > 0) { uphList.push(stats.uph); totalUnits += stats.units; }
                if (!skipIdle && time && time.hasTime) {
                    totalMin += time.totalMin;
                    idleMin += time.idleMin;
                    clockedMin += time.clockedMin || 0;
                }

                let sampled = 0;
                for (let n = 0; n < DEBUG.sampleMatched.length; n++) {
                    if (DEBUG.sampleMatched[n].panel === panelName) sampled++;
                }
                if (sampled < 2) {
                    const entry = empId ? LAST_ROLLUP[empId] : null;
                    const slot = entry && entry.functions && entry.functions[PRIMARY_GRADING.name];
                    DEBUG.sampleMatched.push({
                        panel: panelName,
                        login: found.login,
                        empId: empId,
                        fns: entry ? Object.keys(entry.functions || {}) : [],
                        shown: stats,
                        popupWouldShow: statsFor(empId, panelName === 'BIGS'),
                        sizes: slot ? {
                            units: slot.units,
                            uph: slot.uph,
                            mediumUnits: slot.mediumUnits,
                            mediumUph: slot.mediumUph,
                            largeUnits: slot.largeUnits,
                            largeUph: slot.largeUph,
                            bigsUnits: slot.bigsUnits,
                            bigsUph: slot.bigsUph
                        } : null
                    });
                }

                placeRowBadge(tr, found, stats, !!empId, time, empId);
            }
        }

        let sum = 0;
        for (let i = 0; i < uphList.length; i++) sum += uphList[i];
        const avgUph = uphList.length ? (sum / uphList.length) : 0;

        const firstH = findH5(sectionLabels[0]);
        if (firstH) {
            const lineBadge = makeLineBadge(avgUph, totalUnits, withData, staffed, totalMin, idleMin, clockedMin, both, crSigned, crStations, openStations, disabledStations, panelName === 'BIGS');
            const lineSig = avgUph.toFixed(1) + '|' + totalUnits + '|' + staffed + '|' +
                (idleMin || 0) + '|' + (clockedMin || 0) + '|' + (crSigned || 0) + '/' + (crStations || 0) +
                '|' + disabledStations.join(';');
            lineBadge.setAttribute('data-sig', lineSig);
            const existingLine = firstH.querySelector('.' + SECTION_BADGE_CLASS);
            if (!existingLine) firstH.appendChild(lineBadge);
            else if (existingLine.getAttribute('data-sig') !== lineSig) {
                existingLine.parentNode.replaceChild(lineBadge, existingLine);
            }
        }
        return {
            avgUph: avgUph, totalUnits: totalUnits, staffed: staffed, total: total, withData: withData,
            totalMin: totalMin, idleMin: idleMin, clockedMin: clockedMin, both: both, empIds: empIds,
            idleIds: idleIds, idleLeftOut: idleLeftOut,
            crStations: crStations, crSigned: crSigned, openStations: openStations, disabledStations: disabledStations
        };
    }

    /* ---------------------------------------------------------------
       Associate popup: inject the rate where the name and id already are.
       --------------------------------------------------------------- */
    function personFromText(text) {
        const numbers = text.match(/\d{5,12}/g) || [];
        for (let i = 0; i < numbers.length; i++) {
            const hit = IDENTITY.byId[numbers[i]] || IDENTITY.byBadge[numbers[i]];
            if (hit) return hit;
        }
        // "Last,First" may be followed by job title and button labels, and first
        // names can be multi-word, so drop trailing words until something matches.
        const nameMatch = text.match(/[A-Za-z][A-Za-z'`-]+,\s*[A-Za-z][A-Za-z'`. -]*/);
        if (nameMatch) {
            const words = nameMatch[0].trim().split(/\s+/);
            while (words.length) {
                const hit = IDENTITY.byName[normalizeName(words.join(' '))];
                if (hit) return hit;
                words.pop();
            }
        }
        const tokens = text.toLowerCase().match(/[a-z][a-z0-9._-]{2,31}/g) || [];
        for (let i = 0; i < tokens.length; i++) {
            if (IDENTITY.byLogin[tokens[i]]) return IDENTITY.byLogin[tokens[i]];
        }
        return null;
    }

    function makePopupLine(person, empId, stats) {
        const box = document.createElement('div');
        box.className = POPUP_CLASS;
        const color = uphColor(stats.uph, personUsesBigsRate(empId));
        box.style.cssText = 'margin:10px 0; padding:8px 10px; border-radius:8px; ' +
            'background:' + color + '22; border:1px solid ' + color + '; ' +
            'border-left:4px solid ' + color + '; ' +
            'font-family:Segoe UI,system-ui,sans-serif; font-size:13px; color:#ffffff;';

        const headline = document.createElement('div');
        headline.className = 'mem3-popup-head';
        headline.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; gap:2px;';
        const uphHead = document.createElement('div');
        uphHead.className = 'mem3-popup-uph-value';
        uphHead.style.cssText = 'font-weight:700; color:#ffffff; font-size:22.5px; line-height:1.2;';
        const opened = timeFor(empId);
        const noTime = !!(opened && opened.noData);
        uphHead.textContent = uphHeadline(stats);
        const unitsHead = document.createElement('div');
        unitsHead.className = 'mem3-popup-units';
        unitsHead.style.cssText = 'font-weight:600; font-size:12px; line-height:1.2; color:#8b949e;';
        unitsHead.textContent = unitsHeadline(stats);
        unitsHead.style.display = unitsHead.textContent ? '' : 'none';
        const idleHead = document.createElement('div');
        idleHead.className = 'mem3-popup-idle';
        idleHead.style.cssText = 'font-weight:700; font-size:22.5px; line-height:1.2;';
        idleHead.textContent = idleHeadline(opened);
        idleHead.style.color = noTime ? '#ffffff' : idleColor(idlePercent(opened));
        headline.appendChild(uphHead);
        headline.appendChild(unitsHead);
        headline.appendChild(idleHead);
        box.appendChild(headline);
        paintPopupBreak(box, empId, person && person.login);
        box.dataset.empId = empId || '';
        box.dataset.login = person && person.login ? person.login : '';
        ensurePopupClock(box, person, empId);

        if (empId) box.appendChild(timeDetailsLink(empId));

        if (!unassigning) {
            const dbg = document.createElement('button');
            dbg.type = 'button';
            dbg.textContent = 'Copy debug';
            dbg.style.cssText = 'display:inline-block; margin-top:6px; margin-left:12px; padding:0; border:0; ' +
                'background:transparent; font-size:12px; color:#58a6ff; text-decoration:underline; cursor:pointer; ' +
                'font-family:Segoe UI,system-ui,sans-serif;';
            dbg.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const entry = empId ? LAST_ROLLUP[empId] : null;
                const payload = {
                    login: person && person.login,
                    name: person && person.name,
                    empId: empId,
                    functions: entry ? entry.functions : null,
                    lineBadge: statsFor(empId),
                    popup: statsFor(empId),
                    time: timeFor(empId),
                    rollupSize: DEBUG.rollupSize,
                    rollupParse: DEBUG.rollupParse,
                    timeLoad: DEBUG.timeLoad || null,
                    timeSample: DEBUG.timeSample || null,
                    boardIds: BOARD_IDS.length
                };
                copyText(JSON.stringify(payload, null, 2)).then(function () {
                    dbg.textContent = 'Copied';
                    setTimeout(function () { dbg.textContent = 'Copy debug'; }, 1500);
                }).catch(function () {
                    dbg.textContent = 'Copy failed';
                    setTimeout(function () { dbg.textContent = 'Copy debug'; }, 2000);
                });
            });
            box.appendChild(dbg);
        }
        box.appendChild(makePopupLeavingButton(person));
        box.appendChild(makePopupNotesButton(person));
        syncPopupEngage(box, person, empId);
        paintPopupLeaving(box, person);
        return box;
    }

    const STOP_TAGS = { TR: true, TBODY: true, TABLE: true, BODY: true, HTML: true };

    function decoratePopups() {
        const buttons = document.querySelectorAll('button');
        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (!/^unassign$/i.test((btn.textContent || '').trim())) continue;

            // The popup may be a portal dialog or a popover nested in the cell, so
            // walk up only until there is real content - never as far as the row.
            let host = btn.closest('[role="dialog"]');
            if (!host) {
                host = btn.parentElement;
                let hops = 0;
                while (host && hops < 6 && !STOP_TAGS[host.tagName] &&
                       (host.textContent || '').replace(/\s+/g, ' ').trim().length < 25) {
                    host = host.parentElement;
                    hops++;
                }
            }
            if (!host || STOP_TAGS[host.tagName]) continue;
            if (unassigning) {
                const extras = host.querySelectorAll('button');
                for (let x = 0; x < extras.length; x++) {
                    if (/^copy debug$/i.test((extras[x].textContent || '').trim())) extras[x].remove();
                }
            }
            const existing = host.querySelector('.' + POPUP_CLASS);
            if (existing) {
                const openedNow = timeFor(existing.dataset.empId);
                const openedPctNow = idlePercent(openedNow);
                const head = existing.querySelector('.mem3-popup-head');
                if (head) head.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; gap:2px;';
                const uphNode = existing.querySelector('.mem3-popup-uph-value');
                if (uphNode) uphNode.textContent = uphHeadline(statsFor(existing.dataset.empId));
                const unitsNode = existing.querySelector('.mem3-popup-units');
                if (unitsNode) {
                    unitsNode.textContent = unitsHeadline(statsFor(existing.dataset.empId));
                    unitsNode.style.display = unitsNode.textContent ? '' : 'none';
                }
                const idleNode = existing.querySelector('.mem3-popup-idle');
                if (idleNode) {
                    idleNode.textContent = idleHeadline(openedNow);
                    idleNode.style.color = (openedNow && openedNow.noData) ? '#ffffff' : idleColor(openedPctNow);
                    idleNode.style.display = '';
                }
                const timeNode = existing.querySelector('.mem3-popup-time');
                if (timeNode) timeNode.remove();
                const popupPerson = IDENTITY.byLogin[existing.dataset.login] || personFromText(existing.textContent || '');
                ensurePopupClock(existing, popupPerson, existing.dataset.empId || '');
                if (!existing.querySelector('[data-mem3-leaving-early]')) {
                    existing.appendChild(makePopupLeavingButton(popupPerson));
                }
                if (!existing.querySelector('[data-mem3-enter-notes]')) {
                    const leaveBtn = existing.querySelector('[data-mem3-leaving-early]');
                    const notesBtn = makePopupNotesButton(popupPerson);
                    if (leaveBtn && leaveBtn.parentElement === existing) {
                        existing.insertBefore(notesBtn, leaveBtn.nextSibling);
                    } else existing.appendChild(notesBtn);
                }
                paintPopupBreak(existing, existing.dataset.empId || '', existing.dataset.login || '');
                syncPopupEngage(existing, popupPerson, existing.dataset.empId || '');
                paintPopupLeaving(existing, popupPerson);
                placeNameLeaving(host, popupPerson);
                continue;
            }

            const text = (host.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text || text.length > 400) continue;

            const person = personFromText(text);
            if (!person) continue;

            const empId = resolveEmpId(person);
            const line = makePopupLine(person, empId, statsFor(empId));
            let anchor = btn;
            while (anchor.parentElement && anchor.parentElement !== host) anchor = anchor.parentElement;
            if (anchor.parentElement === host) host.insertBefore(line, anchor);
            else host.appendChild(line);
            placeNameLeaving(host, person);
        }
    }

    function watchForPopups() {
        let pending = null;
        const schedule = function () {
            if (pending) return;
            pending = setTimeout(function () {
                pending = null;
                if (psBoardHolding()) return;
                try { decoratePopups(); } catch (e) { warn('popup decorate failed:', e); }
            }, 80);
        };
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('click', schedule, true);
    }

    /* ---------------------------------------------------------------
       Debug copy.
       --------------------------------------------------------------- */
    function collectDebugSnapshot() {
        const sections = {};
        const panels = panelEntries();
        for (let i = 0; i < panels.length; i++) {
            sections[panels[i].name] = panels[i].labels.map(function (label) {
                const h = findH5(label);
                return { label: label, found: !!h, hasTable: !!(h && findTable(h)) };
            });
        }
        return {
            script: SCRIPT_LABEL,
            page: { url: location.href, readyState: document.readyState },
            runtime: {
                startedAt: DEBUG.startedAt,
                lastRunError: DEBUG.lastRunError,
                lastStatus: DEBUG.lastStatus,
                rollupSize: DEBUG.rollupSize,
                identityCount: IDENTITY.count,
                shiftWindow: getShiftWindow(),
                clock: { loadedAt: CLOCK.loadedAt, rows: CLOCK.rows, keys: CLOCK.keys, error: CLOCK.lastError }
            },
            rollup: { functions: DEBUG.rollupFunctions },
            matching: { perLine: DEBUG.perLine, sampleMatched: DEBUG.sampleMatched },
            sections: sections,
            logs: DEBUG.logs
        };
    }

    function copyText(text) {
        return new Promise(function (resolve, reject) {
            if (typeof GM_setClipboard === 'function') {
                try { GM_setClipboard(text, { type: 'text' }); resolve(); return; } catch (e) { /* fall through */ }
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(resolve).catch(reject);
                return;
            }
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed; left:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            try {
                if (document.execCommand('copy')) resolve();
                else reject(new Error('copy failed'));
            } catch (e) { reject(e); } finally { ta.remove(); }
        });
    }

    function placeCornerDebugButton() {
        if (!document.body) {
            setTimeout(placeCornerDebugButton, 200);
            return;
        }
        let btn = document.getElementById(CORNER_DEBUG_ID);
        if (btn && btn.parentElement === document.body) return;
        if (btn) btn.remove();
        btn = document.createElement('button');
        btn.id = CORNER_DEBUG_ID;
        btn.type = 'button';
        btn.innerHTML = 'Copy debug<br>v' + SCRIPT_VERSION;
        btn.style.cssText = 'position:fixed; left:12px; bottom:12px; z-index:2147483647; ' +
            'padding:8px 10px; border-radius:8px; cursor:pointer; text-align:left; ' +
            'color:#ffffff; background:#161b22; border:1px solid #8b949e; ' +
            'font:800 11px/1.3 Segoe UI,system-ui,sans-serif; letter-spacing:0.03em; ' +
            'text-transform:uppercase; box-shadow:0 8px 24px rgba(0,0,0,0.45);';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const original = 'Copy debug<br>v' + SCRIPT_VERSION;
            copyText(JSON.stringify(collectCornerDebug(), null, 2)).then(function () {
                btn.textContent = 'Copied';
                setTimeout(function () { btn.innerHTML = original; }, 1500);
            }).catch(function () {
                btn.textContent = 'Copy failed';
                setTimeout(function () { btn.innerHTML = original; }, 2000);
            });
        });
        document.body.appendChild(btn);
    }

    function removeCornerPhotoDebugButton() {
        const btn = document.getElementById(PHOTO_DEBUG_ID);
        if (btn) btn.remove();
    }

    /* ---------------------------------------------------------------
       Run loop.
       --------------------------------------------------------------- */
    // Control Tower fills the assignment rows in well after the tables exist, and
    // keeps re-rendering them, so decoration is driven by DOM changes rather than
    // by a one-shot scan. Data fetching stays on its own slower schedule.
    const RENDER_MIN_GAP_MS = 1500;
    let rowObserver = null;
    let renderTimer = null;
    let lastRenderAt = 0;

    let lastSignature = null;
    let lastIdentified = null;

    function observeRows() {
        if (!rowObserver) return;
        rowObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Cheap fingerprint of the assignment tables so constant React re-renders
    // don't cause a badge rebuild when nothing actually changed.
    function tablesSignature() {
        let sig = '';
        const panels = panelEntries();
        for (let i = 0; i < panels.length; i++) {
            const labels = panels[i].labels;
            for (let j = 0; j < labels.length; j++) {
                const h = findH5(labels[j]);
                const table = h ? findTable(h) : null;
                if (!table) { sig += '-|'; continue; }
                const text = table.textContent || '';
                let sum = 0;
                for (let c = 0; c < text.length; c += 16) sum = (sum + text.charCodeAt(c)) % 1000000007;
                sig += table.querySelectorAll('tbody tr').length + '.' + text.length + '.' + sum + '|';
            }
        }
        const tables = document.querySelectorAll('table');
        for (let t = 0; t < tables.length; t++) {
            const trs = tableRows(tables[t]);
            for (let i = 0; i < trs.length; i++) {
                if (!assignmentHasBigs(trs[i].textContent)) continue;
                sig += 'b' + (trs[i].textContent || '').length + ';';
            }
        }
        return sig;
    }

    function isAssignmentsPage() {
        const path = (location.pathname || '').toLowerCase();
        const href = (location.href || '').toLowerCase();
        return path.indexOf('/assignments') !== -1 || href.indexOf('/assignments') !== -1;
    }

    function assignmentsReady() {
        const keys = Object.keys(TARGET_SECTIONS);
        for (let i = 0; i < keys.length; i++) {
            const h = findH5(TARGET_SECTIONS[keys[i]][0]);
            if (!h) continue;
            const table = findTable(h);
            if (table && table.querySelectorAll('tbody tr').length > 0) return true;
            if (h) return true;
        }
        return !!findToolbar();
    }

    function render() {
        if (unassigning || psBoardHolding()) return;
        if (!isAssignmentsPage() || !assignmentsReady()) return;
        lastRenderAt = Date.now();
        if (rowObserver) rowObserver.disconnect();
        SUPPRESS_ENSURE = true;
        try {
            DEBUG.sampleMatched = [];
            DEBUG.perLine = {};

            const avgList = [];
            const lineStats = [];
            let floorUnits = 0, floorStaffed = 0, floorTotal = 0, floorRated = 0;
            let floorCrStations = 0, floorCrSigned = 0;
            const floorOpen = [];
            const floorDisabled = [];
            let floorTotalMin = 0, floorIdleMin = 0, floorClockedMin = 0, floorBoth = 0;
            const floorSeen = Object.create(null);
            BOARD_IDS = [];
            const panels = panelEntries();
            for (let i = 0; i < panels.length; i++) {
                const s = decorateSection(panels[i].name, panels[i].labels);
                lineStats.push({
                    name: panels[i].name,
                    avgUph: s.avgUph,
                    totalUnits: s.totalUnits,
                    staffed: s.staffed,
                    withData: s.withData,
                    totalMin: s.totalMin,
                    idleMin: s.idleMin,
                    clockedMin: s.clockedMin,
                    both: s.both,
                    stations: s.crStations,
                    signed: s.crSigned,
                    openStations: s.openStations || [],
                    disabledStations: s.disabledStations || [],
                    empIds: s.empIds || [],
                    idleIds: s.idleIds || s.empIds || [],
                    idleLeftOut: s.idleLeftOut || []
                });
                DEBUG.perLine[panels[i].name] = lineStats[lineStats.length - 1];
                if (s.avgUph > 0) avgList.push(s.avgUph);
                floorUnits += s.totalUnits;
                floorStaffed += s.staffed;
                floorTotal += s.total;
                floorRated += s.withData;
                floorBoth += s.both || 0;
                floorCrStations += s.crStations || 0;
                floorCrSigned += s.crSigned || 0;
                const opens = s.openStations || [];
                for (let o = 0; o < opens.length; o++) floorOpen.push(panelTitle(panels[i].name) + '  ' + opens[o]);
                const disabledList = s.disabledStations || [];
                for (let d = 0; d < disabledList.length; d++) floorDisabled.push(panelTitle(panels[i].name) + '  ' + disabledList[d]);
                const ids = s.empIds || [];
                const countedIdle = Object.create(null);
                const idleList = s.idleIds || ids;
                for (let n = 0; n < idleList.length; n++) countedIdle[idleList[n]] = true;
                for (let e = 0; e < ids.length; e++) {
                    if (floorSeen[ids[e]]) continue;
                    floorSeen[ids[e]] = true;
                    BOARD_IDS.push(ids[e]);
                    const t = LAST_TIME[ids[e]];
                    if (t && t.hasTime && countedIdle[ids[e]]) {
                        floorTotalMin += t.totalMin;
                        floorIdleMin += t.idleMin;
                        floorClockedMin += t.clockedMin || 0;
                    }
                }
            }
            decorateBigsStations();
            let sum = 0;
            for (let i = 0; i < avgList.length; i++) sum += avgList[i];
            const floorAvg = avgList.length ? (sum / avgList.length) : 0;

            const identified = floorStaffed + '/' + floorTotal;
            DEBUG.lastStatus = 'floor ' + floorAvg.toFixed(1) + ' UPH · ' + identified +
                ' identified · ' + floorRated + ' rated';
            if (identified !== lastIdentified) {
                lastIdentified = identified;
                log('floor ' + floorAvg.toFixed(1) + ' UPH \u00b7 ' + identified + ' identified \u00b7 ' +
                    floorRated + ' rated \u00b7 ' + floorUnits.toLocaleString() + ' units');
            }
            placeFloorSummary({
                floorAvg: floorAvg,
                floorUnits: floorUnits,
                floorRated: floorRated,
                floorStaffed: floorStaffed,
                floorTotalMin: floorTotalMin,
                floorIdleMin: floorIdleMin,
                floorClockedMin: floorClockedMin,
                floorBoth: floorBoth,
                floorStations: floorCrStations,
                floorSigned: floorCrSigned,
                floorOpen: floorOpen,
                floorDisabled: floorDisabled,
                asOf: LAST_ROLLUP_AT ? LAST_ROLLUP_AT.toLocaleTimeString() : '',
                lines: lineStats
            });
            decoratePopups();
            layoutAllCustomerReturns();
        } catch (e) {
            DEBUG.lastRunError = (e && e.message) ? e.message : String(e);
            warn('render failed:', e);
        } finally {
            SUPPRESS_ENSURE = false;
            lastSignature = tablesSignature();
            observeRows();
            scheduleLinePairs();
            if (CLOCK.loadedAt) paintAllClockRings();
            queueMissingTimes();
            queueMissingBreaks();
            placeGroupUnassignButtons();
        }
    }

    function yieldSig(time, empId) {
        const person = personForEmp(empId);
        const extended = extendedBreakOpen(empId, person && person.login);
        const idleNow = showsIdleNow(time, empId);
        if (extended && idleNow) return 'extended+idle';
        if (extended) return 'extended';
        if (idleNow) return 'idle';
        return 'none';
    }

    function expectedIdleText(time) {
        const noTime = !!(time && time.noData);
        const pct = idlePercent(time);
        return noTime ? windowGapText() : (idleLabel(pct) + ' IDLE');
    }

    function expectedRateText(empId) {
        const stats = statsFor(empId);
        if (!empId) return '?';
        if (!stats.hasData) return uphGapText();
        return (stats.uph > 0 ? stats.uph.toFixed(1) : '0') + ' UPH';
    }

    // Control Tower replaces rows and drops badges without changing the assignment text.
    function rowsMissingBadges() {
        try {
            if (!isAssignmentsPage() || !assignmentsReady()) return false;
            const panels = panelEntries();
            for (let i = 0; i < panels.length; i++) {
                const labels = panels[i].labels;
                for (let j = 0; j < labels.length; j++) {
                    const h = findH5(labels[j]);
                    const table = h ? findTable(h) : null;
                    if (!table) continue;
                    const trs = table.querySelectorAll('tbody tr');
                    for (let r = 0; r < trs.length; r++) {
                        const tr = trs[r];
                        const found = findLoginInRow(tr);
                        if (!found) continue;
                        const badge = tr.querySelector('.' + DECOR_CLASS);
                        if (!badge) return true;
                        const empId = resolveEmpId(IDENTITY.byLogin[found.login]);
                        const sig = badge.getAttribute('data-sig') || '';
                        const rowTime = empId ? LAST_TIME[empId] : null;
                        if (sig.indexOf(expectedRateText(empId)) === -1) return true;
                        if (sig.indexOf(expectedIdleText(rowTime)) === -1) return true;
                        if (sig.slice(sig.lastIndexOf('|') + 1) !== yieldSig(rowTime, empId)) return true;
                    }
                }
            }
            const tables = document.querySelectorAll('table');
            for (let t = 0; t < tables.length; t++) {
                const table = tables[t];
                if (table.closest && table.closest('#' + FLOOR_SUMMARY_ID)) continue;
                const trs = tableRows(table);
                for (let i = 0; i < trs.length; i++) {
                    const tr = trs[i];
                    if (!assignmentHasBigs(tr.textContent) || tr.querySelector('.' + DECOR_CLASS)) continue;
                    const found = findLoginInRow(tr);
                    if (!found) continue;
                    const badge = tr.querySelector('.' + BIGS_IDLE_CLASS);
                    if (!badge) return true;
                    const empId = resolveEmpId(IDENTITY.byLogin[found.login]);
                    const bigsTime = empId ? LAST_TIME[empId] : null;
                    if ((badge.getAttribute('data-sig') || '') !== expectedIdleText(bigsTime) + '|' + yieldSig(bigsTime, empId)) return true;
                }
            }
        } catch (e) {
            return false;
        }
        return false;
    }

    function headingLabel(heading) {
        if (!heading) return '';
        const clone = heading.cloneNode ? heading.cloneNode(true) : heading;
        if (clone.querySelectorAll) {
            const junk = clone.querySelectorAll('.' + SECTION_BADGE_CLASS + ', .' + DECOR_CLASS);
            for (let i = 0; i < junk.length; i++) junk[i].remove();
        }
        return groupNameFromHeading((clone.textContent || '').replace(/\s+/g, ' ').trim());
    }

    function inPageChrome(el) {
        let node = el;
        while (node && node !== document.body) {
            const tag = String(node.tagName || '').toUpperCase();
            if (tag === 'NAV' || tag === 'HEADER') return true;
            if (tag === 'BUTTON' && node !== el) return true;
            node = node.parentElement;
        }
        return false;
    }

    function groupRoot(heading) {
        if (!heading || inPageChrome(heading)) return null;
        let el = heading;
        for (let i = 0; i < 12 && el && el.parentElement; i++) {
            const parent = el.parentElement;
            if (!parent || parent === document.body || parent === document.documentElement) break;
            if (String(parent.tagName || '').toUpperCase() === 'NAV') return null;
            const heads = parent.querySelectorAll('h3, h4, h5');
            let others = 0;
            for (let h = 0; h < heads.length; h++) {
                if (inPageChrome(heads[h])) continue;
                if (!el.contains(heads[h])) others++;
            }
            if (others && el.querySelector && el.querySelector('table') && !el.querySelector('nav')) return el;
            el = parent;
            if (inPageChrome(el)) return null;
        }
        return null;
    }

    function anchorInRoot(root, login) {
        const want = String(login || '').trim().toLowerCase();
        if (!root || !root.querySelectorAll || !want) return null;
        const anchors = root.querySelectorAll('tbody a[role="button"], tbody a[mdn-link]');
        for (let i = 0; i < anchors.length; i++) {
            const text = (anchors[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (text === want) return anchors[i];
        }
        return null;
    }

    function peopleInGroup(root) {
        if (!root || !root.querySelectorAll) return [];
        const tables = root.querySelectorAll('table');
        const out = [];
        const seen = Object.create(null);
        for (let t = 0; t < tables.length; t++) {
            if (tables[t].closest && tables[t].closest('#' + FLOOR_SUMMARY_ID)) continue;
            const anchors = tables[t].querySelectorAll('tbody a[role="button"], tbody a[mdn-link]');
            for (let a = 0; a < anchors.length; a++) {
                const login = (anchors[a].textContent || '').replace(/\s+/g, ' ').trim();
                if (/^(none|disabled)$/i.test(login)) continue;
                if (!looksLikeLogin(login)) continue;
                const key = login.toLowerCase();
                if (seen[key]) continue;
                seen[key] = true;
                const person = boardPersonFromAnchor(anchors[a]);
                if (!person.login) person.login = key;
                out.push(person);
            }
        }
        return out;
    }

    function liveRootFor(heading, fallback) {
        const label = headingLabel(heading);
        if (!label) return fallback;
        const heads = document.querySelectorAll('h3, h4, h5');
        for (let i = 0; i < heads.length; i++) {
            if (headingLabel(heads[i]) !== label) continue;
            const root = groupRoot(heads[i]);
            if (root && root.isConnected !== false && root.querySelector && root.querySelector('table')) return root;
        }
        return fallback;
    }

    async function unassignGroup(button, root) {
        if (unassigning) return;
        const heading = button && button.previousElementSibling;
        if (heading && /^H[1-6]$/.test(heading.tagName || '')) root = liveRootFor(heading, root);
        const people = peopleInGroup(root);
        unassigning = true;
        RUN_STOP = false;
        holdLeaving(true);
        const original = button.textContent;
        const batch = { mode: 'unassign-group', people: people, reassign: '' };
        let left = 0;
        try {
            if (!people.length) {
                batch.error = 'no associate';
                pushUnassignLog(batch);
                button.textContent = 'Nobody signed in';
                return;
            }
            batch.reassign = formatReassignList(people);
            try { await copyText(batch.reassign); } catch (e0) { /* ignore */ }
            paintRunPanel({
                title: 'Unassigning group',
                done: 0,
                total: people.length,
                detail: batch.reassign,
                stats: 'Copied Name, Login, Station for reassign'
            });
            for (let i = 0; i < people.length; i++) {
                if (RUN_STOP) {
                    batch.stopped = true;
                    break;
                }
                const person = people[i];
                const login = person.login;
                person.tries = 0;
                person.clickedUnassign = false;
                button.textContent = 'Unassigning ' + (i + 1) + '/' + people.length;
                paintRunPanel({
                    title: 'Unassigning group',
                    done: left,
                    total: people.length,
                    current: (person.name ? person.name + '  ' : '') + login,
                    detail: person.station || 'Opening menu',
                    stats: 'Copied Name, Login, Station for reassign'
                });
                let stayedOff = false;
                let watchedOnce = false;
                while (person.tries < 4 && !RUN_STOP) {
                    const anchor = anchorInRoot(root, login);
                    if (!anchor) break;
                    person.tries++;
                    await closeAllAssociateMenus();
                    const fresh = boardPersonFromAnchor(anchor);
                    person.station = fresh.station || person.station;
                    person.name = fresh.name || person.name;
                    person.empId = fresh.empId || person.empId;
                    await sleep(80);
                    watchedOnce = true;
                    const ok = await unassignAnchor(anchor, person);
                    if (ok) {
                        stayedOff = true;
                        break;
                    }
                    await sleep(300);
                }
                if (!stayedOff && !watchedOnce) {
                    const watched = await watchUnassign(login, '');
                    stayedOff = watched.gone;
                    person.samples = watched.samples;
                }
                person.leftBoard = stayedOff;
                if (person.leftBoard) left++;
                await sleep(400);
            }
            batch.done = left;
            batch.reassign = formatReassignList(people);
            pushUnassignLog(batch);
            try { await copyText(batch.reassign); } catch (e2) { /* ignore */ }
            button.textContent = 'Unassigned ' + left + '/' + people.length;
            paintRunPanel({
                title: batch.stopped ? 'Unassign stopped' : 'Unassign finished',
                done: left,
                total: people.length,
                detail: batch.reassign,
                stats: 'Copied Name, Login, Station for reassign',
                barColor: left === people.length ? '#2ea043' : '#d29922',
                finished: true
            });
        } catch (e) {
            batch.error = (e && e.message) ? e.message : String(e);
            batch.reassign = formatReassignList(people);
            pushUnassignLog(batch);
            button.textContent = 'Unassign failed';
            paintRunPanel({
                title: 'Unassign failed',
                done: left,
                total: people.length,
                detail: batch.reassign || batch.error,
                barColor: '#f85149',
                finished: true
            });
        } finally {
            holdLeaving(false);
            unassigning = false;
            setTimeout(function () {
                if (button.isConnected) button.textContent = original;
            }, 4000);
        }
    }

    function askUnassignGroup(button, heading) {
        const live = heading && heading.isConnected ? heading : null;
        const root = live ? groupRoot(live) : null;
        if (!root) return;
        const people = peopleInGroup(root);
        const name = headingLabel(live) || 'this group';
        if (!people.length) {
            const previous = button.textContent;
            button.textContent = 'Nobody signed in';
            setTimeout(function () {
                if (button.isConnected && button.textContent === 'Nobody signed in') button.textContent = previous;
            }, 2000);
            return;
        }
        askPassword(
            'Unassign ' + name + '?',
            people.length + (people.length === 1 ? ' person is' : ' people are') +
                ' signed in on this group. Enter the password to continue.',
            function () { unassignGroup(button, root); }
        );
    }

    function placeGroupUnassignButtons() {
        if (!isAssignmentsPage() || unassigning) return;
        const stray = document.querySelectorAll('[data-mem3-unassign-group]');
        for (let s = 0; s < stray.length; s++) {
            if (inPageChrome(stray[s])) stray[s].remove();
        }
        const heads = document.querySelectorAll('h3, h4, h5');
        const seen = [];
        for (let i = 0; i < heads.length; i++) {
            const heading = heads[i];
            if (heading.closest && heading.closest('#' + FLOOR_SUMMARY_ID)) continue;
            if (inPageChrome(heading)) continue;
            const root = groupRoot(heading);
            if (!root || !root.querySelector || !root.querySelector('table')) continue;
            if (seen.indexOf(root) !== -1) continue;
            seen.push(root);
            if (root.querySelector('[data-mem3-unassign-group]')) continue;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('data-mem3-unassign-group', '1');
            btn.textContent = 'Unassign Group';
            btn.style.cssText = 'display:inline-block; margin:4px 0 8px 8px; padding:4px 8px; border-radius:6px; ' +
                'border:1px solid #f85149; background:#0d1117; color:#fff; cursor:pointer; ' +
                'font:800 11px Segoe UI,system-ui,sans-serif; vertical-align:middle;';
            btn.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                askUnassignGroup(btn, heading);
            });
            if (heading.parentNode) heading.parentNode.insertBefore(btn, heading.nextSibling);
        }
    }

    function repairBoard() {
        placeGroupUnassignButtons();
        if (unassigning || !LAST_ROLLUP_AT) return;
        if (rowsMissingBadges()) scheduleLivePaint();
    }

    function scheduleRender() {
        if (unassigning || psBoardHolding()) return;
        if (renderTimer) return;
        const wait = Math.max(250, RENDER_MIN_GAP_MS - (Date.now() - lastRenderAt));
        renderTimer = setTimeout(function () {
            renderTimer = null;
            if (unassigning || psBoardHolding()) return;
            if (tablesSignature() === lastSignature) {
                if (rowsMissingBadges()) {
                    render();
                    return;
                }
                if (!summaryIsMounted()) {
                    if (rowObserver) rowObserver.disconnect();
                    try { ensureFloorSummary(); } finally { observeRows(); }
                }
                placeDateDebugButton();
                paintAllClockRings();
                return;
            }
            render();
        }, wait);
    }

    let rollupRetryTimer = null;
    let rollupRetryN = 0;

    function scheduleRollupRetry() {
        if (rollupRetryTimer) return;
        if (rollupRetryN >= 6) return;
        if (Object.keys(LAST_ROLLUP).length) return;
        const delays = [3000, 20000, 30000, 30000, 30000, 30000];
        const delay = delays[rollupRetryN] || 30000;
        rollupRetryN++;
        rollupRetryTimer = setTimeout(function () {
            rollupRetryTimer = null;
            refreshData();
        }, delay);
    }

    function refreshMinutes() {
        let raw = '';
        try {
            if (typeof GM_getValue === 'function') raw = GM_getValue(REFRESH_CHOICE_KEY, '') || '';
        } catch (e) { raw = ''; }
        if (!raw) {
            try { raw = localStorage.getItem(REFRESH_CHOICE_KEY) || ''; } catch (e2) { raw = ''; }
        }
        const n = parseInt(raw, 10);
        if (n >= 1 && n <= 5) return n;
        return 5;
    }

    function saveRefreshMinutes(n) {
        const text = String(n);
        try {
            if (typeof GM_setValue === 'function') GM_setValue(REFRESH_CHOICE_KEY, text);
        } catch (e) { /* the page copy below still records it */ }
        try { localStorage.setItem(REFRESH_CHOICE_KEY, text); } catch (e2) { /* storage can be blocked */ }
    }

    function refreshIntervalMs() {
        return refreshMinutes() * 60 * 1000;
    }

    function paintRefreshCountdown() {
        let nodes = [];
        try { nodes = document.querySelectorAll('[data-mem3-refresh-count]'); } catch (e) { return; }
        let text = 'Recalc now';
        if (refreshBusy) text = 'Recalculating';
        else if (nextRefreshAt) {
            const sec = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            text = 'Recalc in ' + m + ':' + (s < 10 ? '0' : '') + s;
        }
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].textContent !== text) nodes[i].textContent = text;
        }
    }

    function armRefreshClock() {
        if (refreshClockTimer) return;
        refreshClockTimer = setInterval(paintRefreshCountdown, 1000);
    }

    // Drop every rate and idle time before the new pages come back,
    // so the panel paints empty and then fills from this pass only.
    function wipePanelForRefresh() {
        clearTimeCache();
        LAST_ROLLUP = {};
        LAST_ROLLUP_AT = null;
        DEBUG.rollupSize = 0;
        DEBUG.rollupFunctions = null;
        DEBUG.rollupParse = null;
        lastIdentified = null;
        try { clearDecorations(); } catch (e) { /* the board may not be up yet */ }
    }

    function scheduleNextRefresh() {
        if (refreshTimer) clearTimeout(refreshTimer);
        const wait = refreshIntervalMs();
        nextRefreshAt = Date.now() + wait;
        armRefreshClock();
        paintRefreshCountdown();
        refreshTimer = setTimeout(function () {
            refreshTimer = null;
            refreshData();
        }, wait);
    }

    function pagesHeld() {
        return TIME_LOADING || BREAK_RUNNING || Object.keys(TIME_IN_FLIGHT).length > 0;
    }

    function pumpRefresh() {
        if (unassigning || refreshBusy || pagesHeld() || !refreshDue) return;
        refreshDue = false;
        refreshData();
    }

    async function refreshData() {
        if (unassigning) return;
        if (refreshBusy || pagesHeld()) {
            refreshDue = true;
            return;
        }
        const gen = ++refreshGeneration;
        refreshBusy = true;
        refreshDue = false;
        wipePanelForRefresh();
        scheduleNextRefresh();
        paintRefreshCountdown();
        try {
            try { render(); } catch (e0) { /* an empty paint can wait for the new pages */ }
            if (!identityLoaded) await loadIdentities();
            if (gen !== refreshGeneration) return;
            let next = null;
            try {
                next = await getRollup();
                if (DEBUG.lastRunError === 'FCLM rollup unreachable') DEBUG.lastRunError = null;
            } catch (e) {
                DEBUG.lastRunError = (e && e.message) ? e.message : String(e);
                warn('refresh failed:', e);
            }
            if (gen !== refreshGeneration) return;
            if (next) {
                LAST_ROLLUP = next;
                LAST_ROLLUP_AT = new Date();
                rollupRetryN = 0;
                if (rollupRetryTimer) {
                    clearTimeout(rollupRetryTimer);
                    rollupRetryTimer = null;
                }
            } else {
                scheduleRollupRetry();
            }
            refreshCycle++;
            lastIdentified = null;
            render();
            if (gen !== refreshGeneration) return;
            const clockDone = scheduleClockLoad(true);
            await loadBoardTimes();
            if (gen !== refreshGeneration) return;
            await clockDone;
        } catch (e) {
            DEBUG.lastRunError = (e && e.message) ? e.message : String(e);
            warn('refresh failed:', e);
            try { render(); } catch (e2) { /* ignore */ }
        } finally {
            refreshBusy = false;
            if (refreshDue && !pagesHeld()) {
                refreshDue = false;
                refreshData();
            }
        }
    }

    function forceWindow(id) {
        ACTIVE_WINDOW = windowPreset(id).id;
        refreshGeneration++;
        clearTimeCache();
        refreshDue = true;
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
        if (!refreshBusy && !pagesHeld()) {
            refreshDue = false;
            refreshData();
        }
    }

    let boardStarted = false;
    let lastPath = '';

    function showAssignments() {
        if (!isAssignmentsPage()) return;
        lastSignature = null;
        const attempt = function () {
            if (!isAssignmentsPage()) return;
            if (!assignmentsReady()) {
                setTimeout(attempt, 400);
                return;
            }
            if (!boardStarted) {
                boardStarted = true;
                watchForPopups();
                rowObserver = new MutationObserver(scheduleRender);
                observeRows();
                refreshData();
                return;
            }
            if (LAST_ROLLUP_AT) render();
            else refreshData();
        };
        attempt();
    }

    function watchRoute() {
        lastPath = location.pathname;
        setInterval(function () {
            if (location.pathname !== lastPath) {
                lastPath = location.pathname;
                showAssignments();
                return;
            }
            ensureFloorSummary();
            placeCornerDebugButton();
            removeCornerPhotoDebugButton();
            notePsHold();
        }, 400);
        document.addEventListener('click', function (e) {
            const el = e.target && e.target.closest ? e.target.closest('button, a') : null;
            if (!el) return;
            if (!/^assignments$/i.test((el.textContent || '').replace(/\s+/g, ' ').trim())) return;
            setTimeout(showAssignments, 300);
            setTimeout(showAssignments, 1200);
        }, true);
    }

    function personForEmp(empId) {
        const board = BOARD_PEOPLE[empId] || {};
        const ident = IDENTITY.byId[empId] || (board.login ? IDENTITY.byLogin[board.login] : null);
        const raw = (ident && ident.name) || board.name || '';
        const pretty = swapPersonName(raw) || raw;
        const login = (ident && ident.login) || board.login || '';
        const clock = clockFor(ident, empId);
        return {
            empId: String(empId),
            name: pretty,
            login: login,
            badge: (ident && ident.badge) || board.badge || '',
            line: board.line || '',
            station: board.station || '',
            clock: clock === 'in' ? 'Clocked in' : (clock === 'out' ? 'Clocked out' : ''),
            clockStatus: clock
        };
    }

    function timeSnapshot(record, empId) {
        if (!record) return null;
        return {
            hasTime: !!record.hasTime,
            noData: !!record.noData,
            gaveUp: !!record.gaveUp,
            error: record.error || '',
            tries: record.tries || 0,
            cycle: record.cycle || 0,
            totalMin: record.totalMin || 0,
            idleMin: record.idleMin || 0,
            clockedMin: record.clockedMin || 0,
            paidMin: record.paidMin || 0,
            clockRows: record.clockRows || 0,
            functionRows: record.functionRows || 0,
            sawClock: !!record.sawClock,
            sawFunction: !!record.sawFunction,
            pageTitle: record.pageTitle || '',
            fetchedAt: record.fetchedAt || 0,
            lastFunction: record.lastFunction || null,
            currentlyIdle: showsIdleNow(record, empId),
            rowSample: record.rowSample || '',
            segments: (record.segments || []).filter(function (seg) {
                return seg && (seg.bucket === 'indirect' || seg.bucket === 'tot');
            }).slice(0, 10).map(function (seg) {
                return {
                    bucket: seg.bucket,
                    minutes: seg.minutes,
                    startMin: seg.startMin,
                    endMin: seg.endMin,
                    title: seg.title || ''
                };
            })
        };
    }

    function rollupSnapshot(empId) {
        const entry = LAST_ROLLUP[empId];
        if (!entry || !entry.functions) return null;
        const names = Object.keys(entry.functions);
        const out = {};
        for (let i = 0; i < names.length && i < 12; i++) {
            const slot = entry.functions[names[i]] || {};
            out[names[i]] = { uph: slot.uph || 0, units: slot.units || 0 };
        }
        return out;
    }

    function associateDebug(empId) {
        const person = personForEmp(empId);
        let timeUrl = '';
        try { timeUrl = fclmEmpUrl(empId); } catch (e) { timeUrl = ''; }
        return {
            script: SCRIPT_LABEL,
            version: SCRIPT_VERSION,
            what: 'associate',
            capturedAt: new Date().toISOString(),
            window: windowPreset(ACTIVE_WINDOW).label,
            person: person,
            issue: TIME_ISSUES[empId] || null,
            finished: timeFinished(empId),
            inFlight: !!TIME_IN_FLIGHT[empId],
            tries: TIME_TRIES[empId] || 0,
            time: timeSnapshot(LAST_TIME[empId], empId),
            rollup: rollupSnapshot(empId),
            timeUrl: timeUrl
        };
    }

    function allAssociatesDebug() {
        const ids = cycleEmpIds();
        const associates = [];
        for (let i = 0; i < ids.length; i++) associates.push(associateDebug(ids[i]));
        return {
            script: SCRIPT_LABEL,
            version: SCRIPT_VERSION,
            what: 'all-associates',
            capturedAt: new Date().toISOString(),
            window: windowPreset(ACTIVE_WINDOW).label,
            progress: timeProgress(),
            issueCount: issueIds().length,
            associates: associates
        };
    }

    function sortedIssueIds() {
        const ids = issueIds();
        ids.sort(function (a, b) {
            const pa = personForEmp(a);
            const pb = personForEmp(b);
            const an = (pa.name || pa.login || a).toLowerCase();
            const bn = (pb.name || pb.login || b).toLowerCase();
            if (an < bn) return -1;
            if (an > bn) return 1;
            return String(a) < String(b) ? -1 : (String(a) > String(b) ? 1 : 0);
        });
        return ids;
    }

    function paintIssueIcon() {
        const btn = document.getElementById('mem3-time-issues');
        if (btn) {
            const n = issueIds().length;
            btn.textContent = n ? ('Time issues ' + n) : 'Time issues';
            btn.title = n
                ? (n + (n === 1 ? ' associate' : ' associates') + ' had trouble loading time')
                : 'No time issues this refresh. Click to copy every associate.';
            btn.style.borderColor = n ? '#d29922' : '#8b949e';
            btn.style.color = n ? '#d29922' : '#ffffff';
        }
    }

    function copyDebugButton(label, build) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.style.cssText = 'flex:0 0 auto; padding:6px 10px; border-radius:8px; cursor:pointer; color:#ffffff; ' +
            'background:#0d1117; border:1px solid #58a6ff; font:800 12px Segoe UI,system-ui,sans-serif;';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            copyText(JSON.stringify(build(), null, 2)).then(function () {
                btn.textContent = 'Copied';
                setTimeout(function () { btn.textContent = label; }, 1200);
            }).catch(function () {
                btn.textContent = 'Copy failed';
                setTimeout(function () { btn.textContent = label; }, 1500);
            });
        });
        return btn;
    }

    function fillIssuePanel(overlay) {
        const list = overlay.querySelector('[data-issue-list]');
        const countEl = overlay.querySelector('[data-issue-count]');
        if (!list) return;
        const ids = sortedIssueIds();
        if (countEl) {
            countEl.textContent = ids.length
                ? (ids.length + (ids.length === 1 ? ' associate needed another look.' : ' associates needed another look.'))
                : 'No time issues this refresh.';
        }
        while (list.firstChild) list.removeChild(list.firstChild);
        if (!ids.length) {
            const empty = document.createElement('div');
            empty.textContent = 'Everyone who was looked up came back clean. Copy all still includes every associate on the board.';
            empty.style.cssText = 'font-size:13px; font-weight:500; color:#c9d1d9;';
            list.appendChild(empty);
            return;
        }
        for (let i = 0; i < ids.length; i++) {
            const empId = ids[i];
            const person = personForEmp(empId);
            const issue = TIME_ISSUES[empId];
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:flex-start; justify-content:space-between; gap:12px; ' +
                'background:#0d1117; border:1px solid #30363d; border-radius:8px; padding:10px 12px; margin-bottom:8px;';
            const text = document.createElement('div');
            text.style.cssText = 'min-width:0;';
            const name = document.createElement('div');
            name.textContent = person.name || person.login || person.empId;
            name.style.cssText = 'font-size:14px; font-weight:800;';
            const meta = document.createElement('div');
            const bits = [];
            if (person.login) bits.push(person.login);
            if (person.line) bits.push(person.line);
            if (person.clock) bits.push(person.clock);
            bits.push(person.empId);
            meta.textContent = bits.join(' · ');
            meta.style.cssText = 'font-size:12px; font-weight:600; color:#8b949e; margin-top:2px;';
            const why = document.createElement('div');
            why.textContent = issue && issue.reasons ? issue.reasons.join(' · ') : '';
            why.style.cssText = 'font-size:13px; font-weight:600; color:#d29922; margin-top:4px;';
            text.appendChild(name);
            text.appendChild(meta);
            text.appendChild(why);
            row.appendChild(text);
            row.appendChild(copyDebugButton('Copy', function () { return associateDebug(empId); }));
            list.appendChild(row);
        }
    }

    function openIssuePanel() {
        const old = document.getElementById('mem3-time-issues-panel');
        if (old) {
            old.remove();
            return;
        }
        const overlay = document.createElement('div');
        overlay.id = 'mem3-time-issues-panel';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:2147483646; background:rgba(0,0,0,0.55); ' +
            'display:flex; align-items:flex-start; justify-content:center; padding:32px 16px; ' +
            'font-family:Segoe UI,system-ui,sans-serif; color:#ffffff;';
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        const card = document.createElement('div');
        card.style.cssText = 'width:min(720px, 100%); max-height:calc(100vh - 64px); overflow:auto; ' +
            'background:#161b22; border:1px solid #30363d; border-radius:12px; padding:18px 18px 8px;';
        const top = document.createElement('div');
        top.style.cssText = 'display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:8px;';
        const headingWrap = document.createElement('div');
        const heading = document.createElement('div');
        heading.textContent = 'Time issues';
        heading.style.cssText = 'font-size:18px; font-weight:800;';
        const sub = document.createElement('div');
        sub.setAttribute('data-issue-count', '1');
        sub.style.cssText = 'font-size:13px; font-weight:500; color:#c9d1d9; margin-top:4px;';
        headingWrap.appendChild(heading);
        headingWrap.appendChild(sub);
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex; gap:8px; flex:0 0 auto;';
        actions.appendChild(copyDebugButton('Copy all', allAssociatesDebug));
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = 'padding:6px 12px; border-radius:8px; cursor:pointer; color:#ffffff; ' +
            'background:#0d1117; border:1px solid #8b949e; font:800 12px Segoe UI,system-ui,sans-serif;';
        close.addEventListener('click', function () { overlay.remove(); });
        actions.appendChild(close);
        top.appendChild(headingWrap);
        top.appendChild(actions);
        card.appendChild(top);
        const note = document.createElement('div');
        note.textContent = 'These are the associates whose time page failed or came back empty. Copy all includes every associate on the board, not only this list.';
        note.style.cssText = 'font-size:12px; font-weight:500; color:#8b949e; margin:0 0 12px;';
        card.appendChild(note);
        const list = document.createElement('div');
        list.setAttribute('data-issue-list', '1');
        card.appendChild(list);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        fillIssuePanel(overlay);
    }

    function makeIssueButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'mem3-time-issues';
        btn.textContent = 'Time issues';
        btn.title = 'Associates whose time page had trouble';
        btn.style.cssText = 'flex:0 0 auto; padding:4px 8px; border-radius:8px; cursor:pointer; ' +
            'font:800 11px Segoe UI,system-ui,sans-serif; letter-spacing:0.03em; text-transform:uppercase; ' +
            'color:#ffffff; background:#0d1117; border:1px solid #8b949e; white-space:nowrap;';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openIssuePanel();
        });
        return btn;
    }

    function makeInfoButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'i';
        btn.title = 'What this panel means';
        btn.style.cssText = 'width:18px; height:18px; padding:0; border-radius:50%; cursor:pointer; ' +
            'border:1px solid #8b949e; background:#0d1117; color:#ffffff; ' +
            'font:700 12px Segoe UI,system-ui,sans-serif; line-height:16px;';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openInfoPanel();
        });
        return btn;
    }

    function infoSection(title) {
        const section = document.createElement('section');
        section.style.cssText = 'margin:0 0 16px;';
        const h = document.createElement('div');
        h.textContent = title;
        h.style.cssText = 'font-size:12px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; ' +
            'color:#8b949e; margin:0 0 8px;';
        section.appendChild(h);
        return section;
    }

    function infoCard(parent, kicker, body) {
        const card = document.createElement('div');
        card.style.cssText = 'background:#0d1117; border:1px solid #30363d; border-radius:8px; padding:10px 12px;';
        const k = document.createElement('div');
        k.textContent = kicker;
        k.style.cssText = 'font-size:13px; font-weight:800; margin-bottom:4px;';
        const p = document.createElement('div');
        p.textContent = body;
        p.style.cssText = 'font-size:13px; font-weight:500; line-height:1.4; color:#ffffff;';
        card.appendChild(k);
        card.appendChild(p);
        parent.appendChild(card);
        return card;
    }

    function infoRows(pairs) {
        const table = document.createElement('div');
        table.style.cssText = 'display:grid; grid-template-columns:148px 1fr; gap:0; ' +
            'background:#0d1117; border:1px solid #30363d; border-radius:8px; overflow:hidden;';
        for (let i = 0; i < pairs.length; i++) {
            const name = document.createElement('div');
            name.textContent = pairs[i][0];
            name.style.cssText = 'padding:7px 10px; font-size:12px; font-weight:800; border-top:1px solid #30363d;';
            const value = document.createElement('div');
            value.textContent = pairs[i][1];
            value.style.cssText = 'padding:7px 10px; font-size:13px; font-weight:600; border-top:1px solid #30363d;';
            if (i === 0) { name.style.borderTop = '0'; value.style.borderTop = '0'; }
            table.appendChild(name);
            table.appendChild(value);
        }
        return table;
    }

    function infoSwatch(color, label) {
        const chip = document.createElement('div');
        chip.style.cssText = 'display:flex; align-items:center; gap:8px; background:#0d1117; ' +
            'border:1px solid #30363d; border-radius:8px; padding:8px 10px; flex:1 1 0;';
        const dot = document.createElement('span');
        dot.style.cssText = 'width:10px; height:10px; border-radius:50%; background:' + color + '; flex:0 0 auto;';
        const text = document.createElement('span');
        text.textContent = label;
        text.style.cssText = 'font-size:13px; font-weight:700;';
        chip.appendChild(dot);
        chip.appendChild(text);
        return chip;
    }

    function openInfoPanel() {
        const old = document.getElementById('mem3-info-panel');
        if (old) old.remove();
        const overlay = document.createElement('div');
        overlay.id = 'mem3-info-panel';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:2147483646; background:rgba(0,0,0,0.55); ' +
            'display:flex; align-items:flex-start; justify-content:center; padding:32px 16px; ' +
            'font-family:Segoe UI,system-ui,sans-serif; color:#ffffff;';
        const card = document.createElement('div');
        card.style.cssText = 'width:min(760px, 100%); max-height:calc(100vh - 64px); overflow:auto; ' +
            'background:#161b22; border:1px solid #30363d; border-radius:12px; padding:18px 18px 8px;';

        const top = document.createElement('div');
        top.style.cssText = 'display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px;';
        const headingWrap = document.createElement('div');
        const heading = document.createElement('div');
        heading.textContent = 'How to read this panel';
        heading.style.cssText = 'font-size:18px; font-weight:800;';
        const sub = document.createElement('div');
        sub.textContent = 'Primary Grading rate and IDLE percent for the window you select.';
        const credit = document.createElement('div');
        credit.textContent = 'Developed by abelrigm';
        credit.style.cssText = 'font-size:12px; font-weight:600; color:#8b949e; margin-top:4px;';
        sub.style.cssText = 'font-size:13px; font-weight:500; color:#c9d1d9; margin-top:4px;';
        headingWrap.appendChild(heading);
        headingWrap.appendChild(sub);
        headingWrap.appendChild(credit);
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = 'padding:6px 12px; border-radius:8px; cursor:pointer; color:#ffffff; ' +
            'background:#0d1117; border:1px solid #8b949e; font:800 12px Segoe UI,system-ui,sans-serif;';
        close.addEventListener('click', function () { overlay.remove(); });
        top.appendChild(headingWrap);
        top.appendChild(close);
        card.appendChild(top);

        const defs = infoSection('On the board');
        const defGrid = document.createElement('div');
        defGrid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:8px;';
        infoCard(defGrid, 'Rate',
            'Primary Grading [1667843456854] from Function Rollup. Customer Returns uses the overall rate, total units divided by paid hours. BIGs uses Medium and Large EACH units divided by the hours those units took. The rate reads the UNIT and UPH columns. Paid hours and JPH are left out.');
        infoCard(defGrid, 'IDLE percent',
            'From FCLM Time Details for the selected window. Indirect time plus Time Off Task, divided by paid time clocked in.');
        infoCard(defGrid, 'Total',
            'The average of the side rates. Each person is counted once.');
        infoCard(defGrid, 'No data',
            'No UPH for a window means a Customer Returns person has no overall Primary Grading units, or a BIGs person has no Medium or Large units. No data for a window means Time Details has no clock time, which is what you see when someone came in later.');
        defs.appendChild(defGrid);
        card.appendChild(defs);

        const idleSec = infoSection('IDLE time percent');
        idleSec.appendChild(infoRows([
            ['Formula', 'Indirect time + Time Off Task, divided by paid time clocked in'],
            ['Counts', 'Indirect function time and Time Off Task in the selected window'],
            ['Does not count', 'Active graded time, or time outside the window'],
            ['BIGs', 'BIGS Line + Line Support. It sits under L1 Odd and has the same rate, idle percent, associates idle, units, and hours. Those associates count in Total. The idle percent leaves out CRETS Waterspider and both CRETS EOL rows. Their own row still shows a rate and an idle percent.'],
            ['Other BIGS rows', 'A station outside that group whose name contains BIGS shows idle on the row and stays out of the line totals.'],
            ['Idle now', 'A red yield sign sits between the login and the UPH and idle percent. The latest function row is indirect or Time Off Task, and that row has lasted at least 11 minutes. A diamond in the function title is still that stretch. A shorter row is the lag after a scan. Someone who is clocked out is not counted. Earlier idle in the window still counts in the percent. In or Out stays on the photo ring.'],
            ['ASSOCIATES IDLE', 'The number under the idle percent is how many associates on that side, or on the whole floor for Total, have been idle for at least 11 minutes. The white eye on the left opens that list.'],
            ['View', 'The eye left of UPH lists that side from the lowest rate. The eye left of the idle percent lists it from the highest idle percent. Total does the same for everyone on the lines and on BIGs.'],
            ['Hours idle', 'Under units, the idle hours are the indirect time plus Time Off Task already in the idle percent.']
        ]));
        card.appendChild(idleSec);

        const utilSec = infoSection('Station utilization');
        utilSec.appendChild(infoRows([
            ['What counts', 'Customer Returns stations only. A station reads “Customer Returns” and then the half assignment, such as Station 3-06.'],
            ['Left out', 'Waterspiders, disabled stations, and every other role on the line'],
            ['Disabled', 'A station marked Disabled is left out of the percent and is not listed as empty. The utilization popup lists it under Disabled.'],
            ['Red sign', 'Under 90% of those stations have an associate signed in'],
            ['Yellow sign', '90% up to, but not including, 100%'],
            ['Green check', '100%'],
            ['Hover', 'On a side, hover shows Utilization, the percent, the empty stations, and the disabled stations. On Total, click the sign to open that same panel.']
        ]));
        card.appendChild(utilSec);

        const colors = infoSection('IDLE colors');
        const colorRow = document.createElement('div');
        colorRow.style.cssText = 'display:flex; gap:8px;';
        colorRow.appendChild(infoSwatch('#2ea043', 'Under 22%'));
        colorRow.appendChild(infoSwatch('#d29922', '22% to 24%'));
        colorRow.appendChild(infoSwatch('#f85149', 'Over 24%'));
        colors.appendChild(colorRow);
        const ring = document.createElement('div');
        ring.textContent = 'A ring marks the best and worst side. Best IDLE is the lowest percent. Best rate is the highest UPH.';
        ring.style.cssText = 'font-size:13px; font-weight:500; margin-top:8px;';
        colors.appendChild(ring);
        card.appendChild(colors);

        const times = infoSection('Time frames');
        const timeNote = document.createElement('div');
        timeNote.textContent = 'Days start at 6:00 AM. Nights start at 6:00 PM and use the same gaps. All shift is 6:00–5:59 (11 hr 59 min). Each recalculation clears the rates and idle times on the panel, then reads everyone again. Reload, or picking a window, starts that pass immediately.';
        timeNote.style.cssText = 'font-size:13px; font-weight:500; margin-bottom:8px;';
        times.appendChild(timeNote);
        times.appendChild(infoRows([
            ['All shift', '6:00–5:59'],
            ['1st half', '6:00–12:15'],
            ['2nd half', '12:15–5:59'],
            ['Q1', '6:00–9:00'],
            ['Q2', '9:00–12:15'],
            ['Q3', '12:15–2:30'],
            ['Q4', '2:30–5:59'],
            ['1st fast start', '7:00–7:45'],
            ['2nd fast start', '12:30–1:14']
        ]));
        card.appendChild(times);

        const reports = infoSection('Two different reports');
        const reportGrid = document.createElement('div');
        reportGrid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:8px;';
        infoCard(reportGrid, 'Function Rollup',
            'Counts units and paid hours by job function. This panel uses Primary Grading only.');
        infoCard(reportGrid, 'Multi-Process Inspector',
            'Counts units and time by labor process. It is not the rate on this panel.');
        reports.appendChild(reportGrid);
        const why = document.createElement('div');
        why.style.cssText = 'display:grid; gap:8px; margin-top:8px;';
        infoCard(why, 'Why the units differ',
            'The reports do not count the same activities or always the same people. One return can create more than one job action, such as a photograph and a completed grade. Some people show in Multi-Process Inspector and not under Primary Grading.');
        infoCard(why, 'Why the hours differ',
            'Multi-Process Inspector assigns time to a labor process. Function Rollup assigns paid hours to a function. Rollup hours are not Multi-Process Inspector hours plus undefined time. Use Primary Grading units with Primary Grading hours. Do not mix the two reports.');
        infoCard(why, 'What to tell an associate',
            '“What’s my rate?” for this board is Primary Grading in Function Rollup. It is a coaching number. Formal action still uses the site’s approved metric.');
        reports.appendChild(why);
        card.appendChild(reports);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    /* ---------------------------------------------------------------
       Line pairs: similar groups sit side by side. Odd is the left card,
       even is the right card. Layout runs only when the order changes.
       --------------------------------------------------------------- */
    const SIM_THRESHOLD = 0.95;

    function groupNameFromHeading(text) {
        return (text || '')
            .replace(/\d+(\.\d+)?\s*UPH\s*avg.*/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function groupName(card) {
        const h = card.querySelector && card.querySelector('h5');
        if (!h) return '';
        const clone = h.cloneNode(true);
        const junk = clone.querySelectorAll('.' + SECTION_BADGE_CLASS + ', .' + DECOR_CLASS);
        for (let i = 0; i < junk.length; i++) junk[i].remove();
        return groupNameFromHeading(clone.textContent);
    }

    function normalizeGroupName(text) {
        return groupNameFromHeading(text)
            .replace(/priority\s+\d+/gi, '')
            .replace(/\(\s*[oOeE]\s*\)/g, '')
            .replace(/[^a-z0-9]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function pairTokens(text) {
        const n = normalizeGroupName(text);
        if (!n) return [];
        return n.split(' ').filter(Boolean);
    }

    function uniqueTokens(list) {
        const seen = Object.create(null);
        const out = [];
        for (let i = 0; i < list.length; i++) {
            if (seen[list[i]]) continue;
            seen[list[i]] = true;
            out.push(list[i]);
        }
        return out;
    }

    function nameSimilarity(a, b) {
        const ta = uniqueTokens(pairTokens(a));
        const tb = uniqueTokens(pairTokens(b));
        if (!ta.length && !tb.length) return 1;
        if (!ta.length || !tb.length) return 0;
        const setB = Object.create(null);
        for (let i = 0; i < tb.length; i++) setB[tb[i]] = true;
        let inter = 0;
        for (let j = 0; j < ta.length; j++) {
            if (setB[ta[j]]) inter++;
        }
        return (2 * inter) / (ta.length + tb.length);
    }

    function sideOrder(name) {
        if (/\(\s*o\s*\)|\bodd\b/i.test(name)) return 0;
        if (/\(\s*e\s*\)|\beven\b/i.test(name)) return 1;
        return 2;
    }

    function clusterBySimilarity(items) {
        const n = items.length;
        const parent = [];
        for (let i = 0; i < n; i++) parent[i] = i;
        function find(x) {
            while (parent[x] !== x) {
                parent[x] = parent[parent[x]];
                x = parent[x];
            }
            return x;
        }
        function union(a, b) {
            const pa = find(a);
            const pb = find(b);
            if (pa !== pb) parent[pb] = pa;
        }
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (nameSimilarity(items[i].name, items[j].name) >= SIM_THRESHOLD) union(i, j);
            }
        }
        const buckets = Object.create(null);
        const order = [];
        for (let i = 0; i < n; i++) {
            const root = find(i);
            if (!buckets[root]) {
                buckets[root] = [];
                order.push(root);
            }
            buckets[root].push(items[i]);
        }
        return order.map(function (root) {
            buckets[root].sort(function (a, b) {
                const d = sideOrder(a.name) - sideOrder(b.name);
                if (d) return d;
                return a.index - b.index;
            });
            return buckets[root];
        });
    }

    function isGroupCard(el) {
        return !!(el && el.querySelector && el.querySelector('h5') && el.querySelector('table'));
    }

    function findCardRoot(h) {
        let el = h;
        for (let i = 0; i < 12 && el; i++) {
            const parent = el.parentElement;
            if (!parent) break;
            let cardCount = 0;
            const kids = parent.children;
            for (let k = 0; k < kids.length; k++) {
                if (isGroupCard(kids[k])) cardCount++;
            }
            if (cardCount >= 2 && isGroupCard(el)) return { card: el, grid: parent };
            el = parent;
        }
        return null;
    }

    function collectDepartments() {
        const byGrid = [];
        const seen = [];
        const h5s = document.querySelectorAll('h5');
        for (let i = 0; i < h5s.length; i++) {
            const found = findCardRoot(h5s[i]);
            if (!found) continue;
            if (seen.indexOf(found.grid) !== -1) {
                for (let g = 0; g < byGrid.length; g++) {
                    if (byGrid[g].grid !== found.grid) continue;
                    if (byGrid[g].cards.indexOf(found.card) === -1) byGrid[g].cards.push(found.card);
                    break;
                }
                continue;
            }
            seen.push(found.grid);
            byGrid.push({ grid: found.grid, cards: [found.card] });
        }
        return byGrid;
    }

    function setImp(el, prop, value) {
        if (el.style.getPropertyValue(prop) === value) return false;
        el.style.setProperty(prop, value, 'important');
        return true;
    }

    function groupCardsInGrid(grid) {
        const cards = [];
        const kids = grid.children;
        for (let i = 0; i < kids.length; i++) {
            if (isGroupCard(kids[i])) cards.push(kids[i]);
        }
        return cards;
    }

    function sameCardOrder(grid, ordered) {
        const current = groupCardsInGrid(grid);
        if (current.length !== ordered.length) return false;
        for (let i = 0; i < ordered.length; i++) {
            if (current[i] !== ordered[i]) return false;
        }
        return true;
    }

    function captureScroll(fromEl) {
        const out = [{ win: true, top: window.scrollY, left: window.scrollX }];
        let n = fromEl;
        while (n && n !== document.documentElement) {
            if (n.scrollHeight > n.clientHeight + 4) out.push({ el: n, top: n.scrollTop, left: n.scrollLeft });
            n = n.parentElement;
        }
        return out;
    }

    function restoreScroll(saved) {
        for (let i = 0; i < saved.length; i++) {
            const s = saved[i];
            if (s.win) window.scrollTo(s.left, s.top);
            else {
                s.el.scrollTop = s.top;
                s.el.scrollLeft = s.left;
            }
        }
    }

    function styleCardCell(card) {
        setImp(card, 'width', '100%');
        setImp(card, 'max-width', 'none');
        setImp(card, 'min-width', '0');
        setImp(card, 'box-sizing', 'border-box');
        setImp(card, 'align-self', 'stretch');
        setImp(card, 'justify-self', 'stretch');
        setImp(card, 'display', 'flex');
        setImp(card, 'flex-direction', 'column');
    }

    function equalizeCardSizes(cards) {
        let maxH = 0;
        let currentMin = 0;
        for (let i = 0; i < cards.length; i++) {
            const h = cards[i].offsetHeight;
            if (h > maxH) maxH = h;
            const minH = parseFloat(cards[i].style.getPropertyValue('min-height')) || 0;
            if (minH > currentMin) currentMin = minH;
        }
        if (maxH < 1) return;
        if (currentMin && Math.abs(maxH - currentMin) < 3) return;
        const px = maxH + 'px';
        for (let i = 0; i < cards.length; i++) {
            setImp(cards[i], 'min-height', px);
            setImp(cards[i], 'width', '100%');
        }
    }

    function layoutDepartment(grid, clusters) {
        setImp(grid, 'display', 'grid');
        setImp(grid, 'grid-template-columns', '1fr 1fr');
        setImp(grid, 'grid-auto-flow', 'row');
        setImp(grid, 'align-items', 'stretch');
        setImp(grid, 'justify-items', 'stretch');
        const ordered = [];
        const slots = [];
        let row = 1;
        for (let c = 0; c < clusters.length; c++) {
            const cluster = clusters[c];
            for (let i = 0; i < cluster.length; i++) {
                if (i > 0 && i % 2 === 0) row++;
                const alone = cluster.length < 2;
                const col = alone ? (sideOrder(cluster[i].name) === 1 ? '2' : '1') : String((i % 2) + 1);
                ordered.push(cluster[i].card);
                slots.push({ card: cluster[i].card, row: String(row), col: col });
            }
            row++;
        }
        if (!sameCardOrder(grid, ordered)) {
            const saved = captureScroll(grid);
            for (let i = 0; i < ordered.length; i++) grid.appendChild(ordered[i]);
            restoreScroll(saved);
        }
        for (let i = 0; i < slots.length; i++) {
            styleCardCell(slots[i].card);
            setImp(slots[i].card, 'grid-row', slots[i].row);
            setImp(slots[i].card, 'grid-column', slots[i].col);
        }
        equalizeCardSizes(ordered);
    }

    function pairDepartments() {
        if (!isAssignmentsPage()) return;
        const deps = collectDepartments();
        for (let d = 0; d < deps.length; d++) {
            const items = [];
            for (let i = 0; i < deps[d].cards.length; i++) {
                items.push({
                    card: deps[d].cards[i],
                    name: groupName(deps[d].cards[i]),
                    index: i
                });
            }
            items.sort(function (a, b) { return a.name.localeCompare(b.name); });
            layoutDepartment(deps[d].grid, clusterBySimilarity(items));
        }
    }

    let linePairApplying = false;
    let linePairTimer = null;
    let linePairObs = null;

    function tickLinePairs() {
        if (linePairApplying || psBoardHolding()) return;
        linePairApplying = true;
        if (linePairObs && typeof linePairObs.disconnect === 'function') linePairObs.disconnect();
        if (rowObserver) rowObserver.disconnect();
        try {
            pairDepartments();
        } catch (e) {
            warn('line pair layout failed:', e);
        } finally {
            if (linePairObs && document.body) {
                linePairObs.observe(document.body, { childList: true, subtree: true });
            }
            observeRows();
            setTimeout(function () { linePairApplying = false; }, 50);
        }
    }

    function scheduleLinePairs() {
        if (!isAssignmentsPage() || linePairApplying || linePairTimer) return;
        linePairTimer = setTimeout(function () {
            linePairTimer = null;
            tickLinePairs();
        }, 2000);
    }

    function isPanelDecorNode(node) {
        if (!node || node.nodeType !== 1 || !node.closest) return false;
        return !!(node.closest('#' + FLOOR_SUMMARY_ID) ||
            node.closest('.' + DECOR_CLASS) ||
            node.closest('.' + BIGS_IDLE_CLASS) ||
            node.closest('.' + SECTION_BADGE_CLASS) ||
            node.closest('.' + POPUP_CLASS) ||
            node.id === CORNER_DEBUG_ID ||
            node.id === UPDATE_PROMPT_ID ||
            node.id === LEAVING_ID ||
            node.closest('#' + LEAVING_ID) ||
            node.id === 'mem3-early-pass' ||
            node.closest('#mem3-early-pass') ||
            node.id === 'mem3-leaving-list' ||
            node.closest('#mem3-leaving-list'));
    }

    function initLinePairs() {
        if (linePairObs) return;
        linePairObs = new MutationObserver(function (muts) {
            if (linePairApplying) return;
            for (let i = 0; i < muts.length; i++) {
                const m = muts[i];
                const added = m.addedNodes || [];
                const removed = m.removedNodes || [];
                let ours = added.length + removed.length > 0;
                for (let a = 0; a < added.length; a++) {
                    if (added[a].nodeType === 1 && !isPanelDecorNode(added[a])) ours = false;
                }
                for (let r = 0; r < removed.length; r++) {
                    if (removed[r].nodeType === 1 && !isPanelDecorNode(removed[r])) ours = false;
                }
                if (!ours) {
                    scheduleLinePairs();
                    return;
                }
            }
        });
        if (isAssignmentsPage()) tickLinePairs();
        if (document.body) linePairObs.observe(document.body, { childList: true, subtree: true });
    }

    const LEAVING_ID = 'mem3-leaving-panel';
    const LEAVING_KEY = 'mem3-leaving-v1';
    const ACTOR_KEY = 'mem3-leaving-actor';
    const LEAVING_POLL_MS = 20000;
    const LEAVING_KEEP_MS = 12 * 60 * 60 * 1000;
    const LEAVING_SHARE_URL = 'https://extendsclass.com/api/json-storage/bin/edfeccc';
    let leavingShareChain = Promise.resolve();
    let leavingShareError = '';
    let leavingStop = false;
    let leavingBusy = false;
    let leavingHeld = false;

    // Every install reads and writes this same list, so a mark on one computer shows on the others.
    function leavingPad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function shiftId(date) {
        const hour = date.getHours();
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        if (hour < 6) start.setDate(start.getDate() - 1);
        const name = (hour >= 6 && hour < 18) ? 'days' : 'nights';
        return start.getFullYear() + '-' + leavingPad(start.getMonth() + 1) + '-' + leavingPad(start.getDate()) + '-' + name;
    }

    function formatLeaveTime(min) {
        let hour = Math.floor(min / 60) % 24;
        const minute = min % 60;
        const suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        if (hour === 0) hour = 12;
        return leavingPad(hour) + ':' + leavingPad(minute) + ' ' + suffix;
    }

    function maskLeaveTime(text) {
        const raw = String(text || '');
        if (raw.indexOf(':') !== -1) {
            const bits = raw.split(':');
            const hour = bits[0].replace(/\D/g, '').slice(0, 2);
            const minute = (bits[1] || '').replace(/\D/g, '').slice(0, 2);
            return hour + ':' + minute;
        }
        const digits = raw.replace(/\D/g, '').slice(0, 4);
        if (digits.length <= 2) return digits;
        return digits.slice(0, 2) + ':' + digits.slice(2);
    }

    function finishLeaveTime(text) {
        const raw = String(text || '');
        if (raw.indexOf(':') !== -1) {
            const bits = raw.split(':');
            const hour = bits[0].replace(/\D/g, '').slice(0, 2);
            const minute = (bits[1] || '').replace(/\D/g, '').slice(0, 2);
            if (!hour && !minute) return '';
            return hour.padStart(2, '0') + ':' + minute.padStart(2, '0');
        }
        const digits = raw.replace(/\D/g, '').slice(0, 4);
        if (!digits) return '';
        if (digits.length <= 2) return digits.padStart(2, '0') + ':00';
        return digits.slice(0, 2) + ':' + digits.slice(2).padStart(2, '0');
    }

    function clockText(date) {
        return formatLeaveTime(date.getHours() * 60 + date.getMinutes());
    }

    function parseLeaveTime(text) {
        const match = String(text || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
        if (!match) return null;
        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        if (hour < 1 || hour > 12 || minute > 59) return null;
        const pm = match[3].toLowerCase() === 'pm';
        if (hour === 12) hour = pm ? 12 : 0;
        else if (pm) hour += 12;
        return hour * 60 + minute;
    }

    function shiftMinute(min) {
        if (min < 6 * 60) return min + 24 * 60;
        return min;
    }

    function emptyLeaving() {
        return { shifts: {} };
    }

    function loadLeaving() {
        let raw = '';
        try {
            if (typeof GM_getValue === 'function') raw = GM_getValue(LEAVING_KEY, '') || '';
        } catch (e) { raw = ''; }
        if (!raw) {
            try { raw = localStorage.getItem(LEAVING_KEY) || ''; } catch (e2) { raw = ''; }
        }
        if (!raw) return emptyLeaving();
        try {
            const doc = JSON.parse(raw);
            if (!doc || typeof doc !== 'object' || !doc.shifts) return emptyLeaving();
            return doc;
        } catch (e3) {
            return emptyLeaving();
        }
    }

    function loadActor() {
        let raw = '';
        try {
            if (typeof GM_getValue === 'function') raw = GM_getValue(ACTOR_KEY, '') || '';
        } catch (e) { raw = ''; }
        if (!raw) {
            try { raw = localStorage.getItem(ACTOR_KEY) || ''; } catch (e2) { raw = ''; }
        }
        return String(raw || '').trim().toLowerCase();
    }

    function saveActor(login) {
        const text = String(login || '').trim().toLowerCase();
        try {
            if (typeof GM_setValue === 'function') GM_setValue(ACTOR_KEY, text);
        } catch (e) { /* the page copy below still records it */ }
        try { localStorage.setItem(ACTOR_KEY, text); } catch (e2) { /* storage can be blocked */ }
    }

    function loginFromWelcome(text) {
        const match = String(text || '').replace(/\s+/g, ' ').trim().match(/^welcome\s+([a-z][a-z0-9._-]{2,31})$/i);
        if (!match) return '';
        const login = match[1].toLowerCase();
        if (login === 'back' || login === 'there' || login === 'user') return '';
        return login;
    }

    function signedInLogin() {
        try {
            const nav = document.querySelector('#app-layout-content-1 nav') ||
                document.querySelector('main nav') || document.querySelector('nav');
            if (!nav) return '';
            const nodes = nav.querySelectorAll('div');
            for (let i = 0; i < nodes.length; i++) {
                const login = loginFromWelcome(elementOwnText(nodes[i])) || loginFromWelcome(nodes[i].textContent);
                if (!login) continue;
                saveActor(login);
                return login;
            }
        } catch (e) { /* this page has no welcome line */ }
        return '';
    }

    function requireActor() {
        const actor = signedInLogin();
        if (looksLikeLogin(actor)) return actor;
        setLeavingStatus('Control Tower has not shown who is signed in.');
        return '';
    }

    function signedInNote() {
        const note = document.createElement('div');
        note.setAttribute('data-signed-in', '');
        const actor = signedInLogin();
        note.textContent = looksLikeLogin(actor)
            ? 'Signed in as ' + personLabel(actor)
            : 'Control Tower has not shown who is signed in.';
        note.style.cssText = 'font-size:12px; color:#8b949e; margin-bottom:8px;';
        return note;
    }

    function personLabel(login) {
        const key = String(login || '').trim().toLowerCase();
        if (!key || key === 'board') return 'The board';
        const person = IDENTITY.byLogin[key];
        if (person && person.name) return person.name;
        return key;
    }

    function clockToMs(clock, now) {
        const min = parseLeaveTime(clock);
        if (min == null || !now) return 0;
        const stamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
            Math.floor(min / 60) % 24, min % 60, 0, 0);
        if (stamp.getTime() > now.getTime() + 60000) stamp.setDate(stamp.getDate() - 1);
        return stamp.getTime();
    }

    function eventTime(item, now) {
        if (item && typeof item.atMs === 'number' && item.atMs > 0) return item.atMs;
        return clockToMs(item && item.at, now);
    }

    function rowTime(row, now) {
        if (!row) return 0;
        if (typeof row.markedAtMs === 'number' && row.markedAtMs > 0) return row.markedAtMs;
        if (typeof row.clearedAtMs === 'number' && row.clearedAtMs > 0) return row.clearedAtMs;
        return clockToMs(row.clearedAt || row.takenOffAt || row.markedAt, now);
    }

    function recordActivity(doc, by, text, now, extra) {
        if (!doc.activity) doc.activity = {};
        const id = shiftId(now);
        if (!doc.activity[id]) doc.activity[id] = [];
        const item = {
            at: clockText(now),
            atMs: now.getTime(),
            by: String(by || '').trim().toLowerCase() || 'board',
            text: text
        };
        if (extra) {
            if (extra.action) item.action = extra.action;
            if (extra.who) item.who = String(extra.who).trim().toLowerCase();
            if (extra.said) item.said = extra.said;
            if (extra.detail) item.detail = extra.detail;
        }
        doc.activity[id].push(item);
    }

    function activityLine(event) {
        const actor = personLabel(event && event.by);
        const when = event && event.at ? ' at ' + event.at : '';
        const who = personLabel(event && event.who);
        if (event && event.action === 'clear') {
            return actor + ' cleared ' + who + ' from leaving at ' + event.said + when;
        }
        if (event && event.action === 'update') {
            return actor + ' updated ' + who + ' to leave at ' + event.said + when;
        }
        if (event && event.action === 'mark') {
            return actor + ' marked ' + who + ' leaving at ' + event.said +
                (event.detail ? ' from ' + event.detail : '') + when;
        }
        if (event && event.action === 'same') {
            return actor + ' left ' + who + ' leaving at ' + event.said + when;
        }
        if (event && event.action === 'unassign') return actor + ' unassigned ' + who + when;
        if (event && event.action === 'miss') return actor + ' found ' + who + ' was not on a station' + when;
        if (event && event.action === 'drop') {
            const said = String(event.text || '').replace(/^\S+/, who);
            return (said || (who + ' fell off the early out because they were no longer at the station')) + when;
        }
        if (event && event.action === 'fail') return actor + ' could not take ' + who + ' off' + when;
        if (event && event.action === 'back') {
            return actor + ' saw ' + who + ' back on ' + (event.detail || '') + when;
        }
        const text = String((event && event.text) || '');
        let match = text.match(/^cleared (\S+) marked at (.+)$/);
        if (match) return actor + ' cleared ' + personLabel(match[1]) + ' from leaving at ' + match[2] + when;
        match = text.match(/^cleared (\S+) from leaving at (.+)$/);
        if (match) return actor + ' cleared ' + personLabel(match[1]) + ' from leaving at ' + match[2] + when;
        match = text.match(/^updated (\S+) from .+ to (.+)$/);
        if (match) return actor + ' updated ' + personLabel(match[1]) + ' to leave at ' + match[2] + when;
        match = text.match(/^marked (\S+) leaving at (\d{1,2}:\d{2} [AP]M)(?: from (.+))?$/);
        if (match) {
            return actor + ' marked ' + personLabel(match[1]) + ' leaving at ' + match[2] +
                (match[3] ? ' from ' + match[3] : '') + when;
        }
        match = text.match(/^unassigned (\S+)$/);
        if (match) return actor + ' unassigned ' + personLabel(match[1]) + when;
        match = text.match(/^could not take (\S+) off$/);
        if (match) return actor + ' could not take ' + personLabel(match[1]) + ' off' + when;
        match = text.match(/^(\S+) was not on a station$/);
        if (match) return actor + ' found ' + personLabel(match[1]) + ' was not on a station' + when;
        match = text.match(/^(\S+) fell off the early out because they were no longer at (.+)$/);
        if (match) {
            return personLabel(match[1]) + ' fell off the early out because they were no longer at ' + match[2] + when;
        }
        match = text.match(/^(\S+) back on (.+)$/);
        if (match) return actor + ' saw ' + personLabel(match[1]) + ' back on ' + match[2] + when;
        match = text.match(/^(\S+) already marked at (.+)$/);
        if (match) return actor + ' left ' + personLabel(match[1]) + ' leaving at ' + match[2] + when;
        if (event && event.action === 'note') return actor + ' ' + text + when;
        return actor + (text ? ' ' + text : '') + when;
    }

    function recentActivity(doc, now) {
        const cutoff = now.getTime() - LEAVING_KEEP_MS;
        const out = [];
        const act = (doc && doc.activity) || {};
        const ids = Object.keys(act);
        for (let n = 0; n < ids.length; n++) {
            const list = act[ids[n]] || [];
            for (let i = 0; i < list.length; i++) {
                const when = eventTime(list[i], now);
                if (when && when >= cutoff) out.push(list[i]);
            }
        }
        out.sort(function (a, b) { return eventTime(b, now) - eventTime(a, now); });
        return out;
    }

    function activityKind(event) {
        if (!event) return '';
        if (event.action === 'mark' || event.action === 'update' || event.action === 'clear' ||
            event.action === 'unassign' || event.action === 'miss' || event.action === 'drop') return event.action;
        const text = String(event.text || '');
        if (/^marked \S+ leaving at /.test(text)) return 'mark';
        if (/^updated \S+ /.test(text)) return 'update';
        if (/^cleared \S+ /.test(text)) return 'clear';
        if (/^unassigned \S+$/.test(text)) return 'unassign';
        if (/ was not on a station$/.test(text)) return 'miss';
        if (/ fell off the early out because /.test(text)) return 'drop';
        return '';
    }

    function activityWho(event) {
        if (!event) return '';
        if (event.who) return String(event.who).trim().toLowerCase();
        const text = String(event.text || '');
        let match = text.match(/^(?:marked|updated|cleared|unassigned) (\S+)/);
        if (match) return match[1].toLowerCase();
        match = text.match(/^(\S+) was not on a station$/);
        if (match) return match[1].toLowerCase();
        match = text.match(/^(\S+) fell off the early out because /);
        return match ? match[1].toLowerCase() : '';
    }

    function activitySaid(event) {
        if (!event) return '';
        if (event.said) return event.said;
        const text = String(event.text || '');
        const match = text.match(/leaving at (\d{1,2}:\d{2}(?: [AP]M)?)|to leave at (\d{1,2}:\d{2} [AP]M)/);
        return match ? (match[1] || match[2] || '') : '';
    }

    function restoreLatestMarks(doc, now) {
        if (!doc) return false;
        const events = recentActivity(doc, now);
        const seen = Object.create(null);
        let changed = false;
        for (let i = 0; i < events.length; i++) {
            const kind = activityKind(events[i]);
            const who = activityWho(events[i]);
            if (!kind || !who || seen[who]) continue;
            seen[who] = true;
            if (kind !== 'mark' && kind !== 'update') continue;
            const said = activitySaid(events[i]);
            if (!said) continue;
            const rows = shiftRows(doc, now);
            let open = null;
            let same = null;
            for (let r = 0; r < rows.length; r++) {
                if (!rows[r] || rows[r].login !== who) continue;
                if (leavingOpen(rows[r])) open = rows[r];
                if (rows[r].id === who + '-' + said) same = rows[r];
            }
            if (open || !same) continue;
            const when = eventTime(events[i], now);
            const closedAt = rowRevisionTime(same, now);
            if (when && closedAt && when <= closedAt) continue;
            same.status = 'said';
            same.said = said;
            same.markedAt = events[i].at || same.markedAt;
            if (when) same.markedAtMs = when;
            same.clearedAt = '';
            same.clearedAtMs = 0;
            same.clearedBy = '';
            same.takenOffAt = '';
            same.takenHow = '';
            same.back = '';
            changed = true;
        }
        return changed;
    }

    function pruneLeaving(doc, now) {
        if (!doc) return doc;
        const cutoff = now.getTime() - LEAVING_KEEP_MS;
        const shifts = doc.shifts || {};
        Object.keys(shifts).forEach(function (id) {
            const rows = shifts[id] || [];
            const keep = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
                const open = row.status === 'said' || row.status === 'stuck';
                const when = rowTime(row, now);
                if (!when) {
                    if (open) keep.push(row);
                    continue;
                }
                if (when >= cutoff) keep.push(row);
            }
            if (keep.length) shifts[id] = keep;
            else delete shifts[id];
        });
        function trimMap(bucket, timeOf) {
            if (!bucket) return;
            Object.keys(bucket).forEach(function (id) {
                const list = bucket[id] || [];
                const keep = [];
                for (let i = 0; i < list.length; i++) {
                    const when = timeOf(list[i], now);
                    if (when && when >= cutoff) keep.push(list[i]);
                }
                if (keep.length) bucket[id] = keep;
                else delete bucket[id];
            });
        }
        trimMap(doc.activity, eventTime);
        trimMap(doc.runs, eventTime);
        return doc;
    }

    function saveLeavingLocal(doc) {
        const text = JSON.stringify(doc);
        try {
            if (typeof GM_setValue === 'function') GM_setValue(LEAVING_KEY, text);
        } catch (e) { /* the page copy below still records it */ }
        try { localStorage.setItem(LEAVING_KEY, text); } catch (e2) { /* storage can be blocked */ }
    }

    function collapseOpenLeaving(rows) {
        const list = rows || [];
        const now = new Date();
        const best = Object.create(null);
        for (let i = 0; i < list.length; i++) {
            const row = list[i];
            if (!leavingOpen(row) || !row.login) continue;
            const prev = best[row.login];
            if (!prev || rowRevisionTime(row, now) >= rowRevisionTime(prev, now)) {
                if (prev && prev !== row) {
                    prev.status = 'cancelled';
                    prev.takenHow = prev.takenHow || 'replaced';
                }
                best[row.login] = row;
            } else {
                row.status = 'cancelled';
                row.takenHow = row.takenHow || 'replaced';
            }
        }
        return list;
    }

    function saveLeaving(doc) {
        restoreLatestMarks(doc, new Date());
        const shifts = doc.shifts || {};
        Object.keys(shifts).forEach(function (id) {
            collapseOpenLeaving(shifts[id]);
        });
        pruneLeaving(doc, new Date());
        saveLeavingLocal(doc);
        if (leavingShareOn()) return publishLeaving(doc);
        return Promise.resolve(doc);
    }

    function leavingShareOn() {
        return !!(LEAVING_SHARE_URL && typeof GM_xmlhttpRequest === 'function');
    }

    function enableLeavingShare() {
        // Sharing is already on for every install.
    }

    function parseSharedBody(text) {
        const raw = String(text || '').replace(/^\uFEFF/, '');
        const start = raw.indexOf('{');
        if (start < 0) throw new Error('shared list');
        let depth = 0;
        let inStr = false;
        let esc = false;
        for (let i = start; i < raw.length; i++) {
            const ch = raw.charAt(i);
            if (inStr) {
                if (esc) esc = false;
                else if (ch === '\\') esc = true;
                else if (ch === '"') inStr = false;
                continue;
            }
            if (ch === '"') inStr = true;
            else if (ch === '{') depth += 1;
            else if (ch === '}') {
                depth -= 1;
                if (depth === 0) return JSON.parse(raw.slice(start, i + 1));
            }
        }
        throw new Error('shared list');
    }

    function leavingStatusRank(status) {
        if (status === 'cancelled') return 4;
        if (status === 'off') return 3;
        if (status === 'stuck') return 2;
        if (status === 'said') return 1;
        return 0;
    }

    function rowRevisionTime(row, now) {
        if (!row) return 0;
        let latest = 0;
        if (typeof row.markedAtMs === 'number' && row.markedAtMs > latest) latest = row.markedAtMs;
        if (typeof row.clearedAtMs === 'number' && row.clearedAtMs > latest) latest = row.clearedAtMs;
        const clock = clockToMs(row.clearedAt || row.takenOffAt || row.markedAt, now);
        if (clock > latest) latest = clock;
        return latest;
    }

    function leavingOpen(row) {
        return !!(row && (row.status === 'said' || row.status === 'stuck'));
    }

    function mergeLeavingRows(left, right) {
        const byId = Object.create(null);
        const now = new Date();
        function take(row) {
            if (!row || !row.id) return;
            const prev = byId[row.id];
            const copy = JSON.parse(JSON.stringify(row));
            if (!prev) {
                byId[row.id] = copy;
                return;
            }
            const stampA = rowRevisionTime(prev, now);
            const stampB = rowRevisionTime(copy, now);
            const openA = leavingOpen(prev);
            const openB = leavingOpen(copy);
            if (openB && !openA && stampB > stampA) {
                byId[row.id] = copy;
                return;
            }
            if (openA && !openB && stampA > stampB) return;
            const rankA = leavingStatusRank(prev.status);
            const rankB = leavingStatusRank(copy.status);
            const histA = (prev.history || []).length;
            const histB = (copy.history || []).length;
            if (rankB > rankA || (rankB === rankA && histB > histA) ||
                (rankB === rankA && histB === histA && copy.back && !prev.back)) {
                byId[row.id] = copy;
            }
        }
        const lists = [left || [], right || []];
        for (let n = 0; n < lists.length; n++) {
            for (let i = 0; i < lists[n].length; i++) take(lists[n][i]);
        }
        const out = [];
        const ids = Object.keys(byId);
        for (let i = 0; i < ids.length; i++) out.push(byId[ids[i]]);
        return out;
    }

    function mergeLeavingEvents(left, right, keyFn) {
        const seen = Object.create(null);
        const out = [];
        function take(item) {
            if (!item) return;
            const key = keyFn(item);
            if (seen[key]) return;
            seen[key] = true;
            out.push(item);
        }
        const lists = [left || [], right || []];
        for (let n = 0; n < lists.length; n++) {
            for (let i = 0; i < lists[n].length; i++) take(lists[n][i]);
        }
        return out;
    }

    function mergeLeaving(local, remote) {
        const a = local && local.shifts ? local : emptyLeaving();
        const b = remote && remote.shifts ? remote : emptyLeaving();
        const out = emptyLeaving();
        out.activity = {};
        out.runs = {};
        const shiftIds = Object.create(null);
        const aShifts = a.shifts || {};
        const bShifts = b.shifts || {};
        Object.keys(aShifts).forEach(function (id) { shiftIds[id] = true; });
        Object.keys(bShifts).forEach(function (id) { shiftIds[id] = true; });
        Object.keys(shiftIds).forEach(function (id) {
            out.shifts[id] = collapseOpenLeaving(mergeLeavingRows(aShifts[id], bShifts[id]));
        });
        const actIds = Object.create(null);
        const aAct = a.activity || {};
        const bAct = b.activity || {};
        Object.keys(aAct).forEach(function (id) { actIds[id] = true; });
        Object.keys(bAct).forEach(function (id) { actIds[id] = true; });
        Object.keys(actIds).forEach(function (id) {
            out.activity[id] = mergeLeavingEvents(aAct[id], bAct[id], function (item) {
                return item.at + '|' + item.by + '|' + item.text;
            });
        });
        const runIds = Object.create(null);
        const aRuns = a.runs || {};
        const bRuns = b.runs || {};
        Object.keys(aRuns).forEach(function (id) { runIds[id] = true; });
        Object.keys(bRuns).forEach(function (id) { runIds[id] = true; });
        Object.keys(runIds).forEach(function (id) {
            out.runs[id] = mergeLeavingEvents(aRuns[id], bRuns[id], function (item) {
                return (item.at || '') + '|' + (item.by || '') + '|' + (item.kind || '') + '|' +
                    (item.summary || '') + '|' + (item.login || '');
            });
        });
        out.rev = Math.max(a.rev || 0, b.rev || 0);
        return out;
    }

    function leavingBody(doc) {
        const copy = JSON.parse(JSON.stringify(doc || emptyLeaving()));
        delete copy.rev;
        return JSON.stringify(copy);
    }

    function shareRequest(method, extra) {
        const headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
        };
        if (extra && extra.baseRev != null) headers['X-Leaving-Base'] = String(extra.baseRev);
        let url = LEAVING_SHARE_URL;
        if (method === 'GET') url += '?t=' + Date.now();
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                method: method,
                url: url,
                headers: headers,
                data: extra && extra.doc ? JSON.stringify(extra.doc) : undefined,
                timeout: 20000,
                onload: function (res) { resolve(res || {}); },
                onerror: function () { reject(new Error('shared list')); },
                ontimeout: function () { reject(new Error('shared list timeout')); }
            });
        });
    }

    function readSharedLeaving() {
        return shareRequest('GET').then(function (res) {
            if (!res || res.status < 200 || res.status >= 300) throw new Error('shared list read');
            const doc = parseSharedBody(res.responseText || '');
            if (!doc || !doc.shifts) return emptyLeaving();
            return doc;
        });
    }

    function writeSharedLeaving(doc, baseRev) {
        return shareRequest('PUT', { doc: doc, baseRev: baseRev }).then(function (res) {
            if (res && res.status === 409) return { conflict: true };
            if (!res || res.status < 200 || res.status >= 300) throw new Error('shared list write');
            return { conflict: false };
        });
    }

    function publishLeavingOnce(localDoc, attempt) {
        return readSharedLeaving().then(function (remote) {
            const merged = mergeLeaving(localDoc, remote);
            const base = remote.rev || 0;
            if (leavingBody(merged) === leavingBody(remote)) {
                merged.rev = base;
                saveLeavingLocal(merged);
                return merged;
            }
            merged.rev = base + 1;
            return writeSharedLeaving(merged, base).then(function (result) {
                if (result.conflict) {
                    if (attempt >= 4) throw new Error('gist conflict');
                    return publishLeavingOnce(localDoc, attempt + 1);
                }
                saveLeavingLocal(merged);
                return merged;
            });
        });
    }

    function publishLeaving(doc) {
        if (!leavingShareOn()) return Promise.resolve(doc);
        const job = leavingShareChain.then(function () {
            return publishLeavingOnce(doc, 0);
        }).then(function (next) {
            leavingShareError = '';
            try {
                const nodes = document.querySelectorAll('[data-leaving-status]');
                for (let i = 0; i < nodes.length; i++) {
                    if (String(nodes[i].textContent || '').indexOf('shared list did not load') !== -1) {
                        nodes[i].textContent = 'Other computers can see it.';
                    }
                }
            } catch (e) { /* the list is not open */ }
            return next;
        }, function (err) {
            leavingShareError = err && err.message ? err.message : 'shared list failed';
            throw err;
        });
        leavingShareChain = job.then(function (next) { return next; }, function () { return null; });
        return job;
    }

    function pullLeaving() {
        if (!leavingShareOn()) return Promise.resolve(loadLeaving());
        return publishLeaving(loadLeaving());
    }

    function whenLeavingShared() {
        return leavingShareChain;
    }

    function shiftRows(doc, date) {
        const id = shiftId(date);
        if (!doc.shifts[id]) doc.shifts[id] = [];
        return doc.shifts[id];
    }

    function addLeaving(doc, login, saidMin, station, now) {
        const rows = shiftRows(doc, now);
        const name = String(login || '').trim().toLowerCase();
        const said = formatLeaveTime(saidMin);
        const at = clockText(now);
        let open = null;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].login !== name) continue;
            if (rows[i].status !== 'said' && rows[i].status !== 'stuck') continue;
            open = rows[i];
            break;
        }
        if (open) {
            if (!open.history) open.history = [{ said: open.said, at: open.markedAt }];
            if (open.said === said) return { doc: doc, row: open, added: false, updated: false };
            const previous = open.said;
            open.history.push({ said: said, at: at });
            open.said = said;
            open.saidMin = saidMin;
            open.markedAt = at;
            open.markedAtMs = now.getTime();
            open.id = name + '-' + said;
            if (station) open.station = station;
            return { doc: doc, row: open, added: false, updated: true, previous: previous };
        }
        let closed = null;
        const nextId = name + '-' + said;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i].id === nextId) closed = rows[i];
        }
        if (closed) {
            closed.status = 'said';
            closed.said = said;
            closed.saidMin = saidMin;
            closed.markedAt = at;
            closed.markedAtMs = now.getTime();
            closed.clearedAt = '';
            closed.clearedAtMs = 0;
            closed.clearedBy = '';
            closed.takenOffAt = '';
            closed.takenHow = '';
            closed.back = '';
            if (station) closed.station = station;
            if (!closed.history) closed.history = [];
            closed.history.push({ said: said, at: at });
            return { doc: doc, row: closed, added: true, updated: false };
        }
        const row = {
            id: name + '-' + said,
            login: name,
            said: said,
            saidMin: saidMin,
            station: station || '',
            markedAt: at,
            markedAtMs: now.getTime(),
            status: 'said',
            takenOffAt: '',
            takenHow: '',
            back: '',
            history: [{ said: said, at: at }]
        };
        rows.push(row);
        return { doc: doc, row: row, added: true, updated: false };
    }

    function cancelLeaving(doc, id, now) {
        const rows = shiftRows(doc, now);
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].id !== id) continue;
            if (rows[i].status !== 'cancelled') {
                rows[i].status = 'cancelled';
                rows[i].clearedAt = clockText(now);
                rows[i].clearedAtMs = now.getTime();
            }
            return rows[i];
        }
        return null;
    }

    function throughMinute(value) {
        if (value && typeof value.getHours === 'function') {
            return value.getHours() * 60 + value.getMinutes();
        }
        const n = Number(value);
        if (!isFinite(n)) return 0;
        return ((Math.floor(n) % 1440) + 1440) % 1440;
    }

    function dueLeaving(rows, through) {
        const limit = shiftMinute(throughMinute(through));
        const out = [];
        const list = rows || [];
        for (let i = 0; i < list.length; i++) {
            const row = list[i];
            if (!row || row.status !== 'said') continue;
            if (shiftMinute(row.saidMin) <= limit) out.push(row);
        }
        return out;
    }

    function fellOffPlace(station) {
        const lines = leavingStationLines(station);
        if (lines.length) return lines.join(', ');
        const cleaned = cleanStationText(station);
        return cleaned || 'the station';
    }

    function dropFromEarlyOut(doc, row, now, by) {
        if (!row || !leavingOpen(row)) return false;
        const stamp = now || new Date();
        const place = fellOffPlace(row.station);
        const text = row.login + ' fell off the early out because they were no longer at ' + place;
        row.status = 'cancelled';
        row.clearedAt = clockText(stamp);
        row.clearedAtMs = stamp.getTime();
        row.clearedBy = '';
        row.takenHow = 'no longer at the station';
        row.fellOffAt = clockText(stamp);
        row.fellOffAtMs = stamp.getTime();
        row.fellWhy = 'no longer at the station';
        if (!row.history) row.history = [];
        row.history.push({ said: row.said, at: row.fellOffAt, why: row.fellWhy });
        recordActivity(doc, by || 'board', text, stamp, {
            action: 'drop', who: row.login, said: row.said, detail: place
        });
        pushEarlyRun(doc, {
            at: row.fellOffAt,
            by: by || 'board',
            kind: 'drop',
            shiftId: shiftId(stamp),
            login: row.login,
            said: row.said,
            station: row.station || '',
            summary: text
        });
        return true;
    }

    function markTakenOff(row, now, how) {
        row.status = 'off';
        row.takenOffAt = clockText(now);
        row.takenHow = how || '';
        return row;
    }

    function noteBack(row, station, now) {
        if (!row || row.status !== 'off' || !station || row.back) return false;
        row.back = station + ' at ' + clockText(now);
        return true;
    }

    function stationForLogin(login) {
        try {
            const anchor = findAnchorForPerson(login, '');
            if (!anchor) return '';
            const person = boardPersonFromAnchor(anchor);
            return person.station || '';
        } catch (e) {
            return '';
        }
    }

    function noteReturns(doc, rows, now) {
        let changed = false;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.status !== 'off') continue;
            if (!loginStillOnBoard(row.login)) continue;
            const where = stationForLogin(row.login) || 'a station';
            if (!noteBack(row, where, now)) continue;
            recordActivity(doc, 'board', row.login + ' back on ' + row.back, now, {
                action: 'back', who: row.login, detail: row.back
            });
            changed = true;
        }
        return changed;
    }

    const LIST_PHOTO_PX = 42;

    function rowShowsLogin(tr, login) {
        const want = String(login || '').trim().toLowerCase();
        if (!want || !tr || !tr.querySelectorAll) return false;
        const anchors = tr.querySelectorAll('a[role="button"], a[mdn-link]');
        for (let i = 0; i < anchors.length; i++) {
            const text = (anchors[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (text === want) return true;
        }
        return false;
    }

    function photoFromBoard(login) {
        const tables = document.querySelectorAll('table');
        for (let t = 0; t < tables.length; t++) {
            if (tables[t].closest && tables[t].closest('#' + FLOOR_SUMMARY_ID)) continue;
            const trs = tableRows(tables[t]);
            for (let i = 0; i < trs.length; i++) {
                const found = findLoginInRow(trs[i]);
                if (!(found && found.login === login) && !rowShowsLogin(trs[i], login)) continue;
                const url = badgePhotoUrl(avatarEl(trs[i]));
                if (url) return url;
            }
        }
        return '';
    }

    function photoForLogin(login) {
        const key = String(login || '').trim().toLowerCase();
        if (!key) return '';
        if (PHOTO_BY_LOGIN[key]) return PHOTO_BY_LOGIN[key];
        const person = IDENTITY.byLogin[key];
        const empId = person && resolveEmpId(person);
        if (empId) {
            const url = photoForEmp(empId);
            if (url) {
                rememberPhoto(key, url);
                return url;
            }
        }
        try {
            const url = photoFromBoard(key);
            if (url) {
                rememberPhoto(key, url);
                return url;
            }
        } catch (e) { /* the board may be mid-draw */ }
        return '';
    }

    function listPhoto(login) {
        const photo = document.createElement('div');
        photo.setAttribute('data-mem3-list-photo', '1');
        const url = photoForLogin(login);
        photo.style.cssText = 'flex:0 0 auto; width:' + LIST_PHOTO_PX + 'px; height:' + LIST_PHOTO_PX + 'px; ' +
            'margin-top:1px; border-radius:50%; overflow:hidden; background:#21262d;';
        if (url) {
            const img = document.createElement('img');
            img.alt = '';
            img.src = url;
            img.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
            photo.appendChild(img);
        }
        return photo;
    }

    function armClearButton(clear, onConfirm) {
        let armed = false;
        clear.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (!armed) {
                armed = true;
                clear.textContent = 'Confirm';
                clear.style.background = '#f85149';
                clear.style.borderColor = '#f85149';
                clear.style.color = '#ffffff';
                return;
            }
            onConfirm();
        });
    }

    function leavingStationLines(station) {
        const lines = customerReturnsLines(station);
        if (lines && lines.length) return lines;
        const cleaned = cleanStationText(station);
        if (!cleaned) return [];
        return [cleaned];
    }

    function leavingLine(row) {
        const lines = [personLabel(row.login) + ' leaving at ' + row.said];
        const station = leavingStationLines(row.station);
        for (let i = 0; i < station.length; i++) lines.push(station[i]);
        if (row.status === 'stuck') lines.push('Still on the station');
        return lines.join('\n');
    }

    function quarterStart(row) {
        let min = row && typeof row.saidMin === 'number' ? row.saidMin : parseLeaveTime(row && row.said);
        if (min == null || !isFinite(min)) return null;
        min = ((min % 1440) + 1440) % 1440;
        return Math.floor(min / 15) * 15;
    }

    function leavingQuarterCounts(rows) {
        const buckets = Object.create(null);
        const order = [];
        const list = rows || [];
        for (let i = 0; i < list.length; i++) {
            const start = quarterStart(list[i]);
            if (start == null) continue;
            if (!buckets[start]) {
                buckets[start] = 0;
                order.push(start);
            }
            buckets[start] += 1;
        }
        order.sort(function (a, b) { return shiftMinute(a) - shiftMinute(b); });
        const out = [];
        for (let i = 0; i < order.length; i++) {
            out.push({ label: formatLeaveTime(order[i]), count: buckets[order[i]] });
        }
        return out;
    }

    function leavingCopyText(rows) {
        const list = rows || [];
        const lines = [list.length + ' leaving early'];
        const quarters = leavingQuarterCounts(list);
        for (let i = 0; i < quarters.length; i++) lines.push(quarters[i].label + '\t' + quarters[i].count);
        if (list.length) lines.push('');
        for (let i = 0; i < list.length; i++) {
            lines.push(leavingLine(list[i]));
            if (i < list.length - 1) lines.push('');
        }
        return lines.join('\n');
    }

    function notesCopyText(rows) {
        const list = rows || [];
        const lines = [list.length + (list.length === 1 ? ' note' : ' notes')];
        for (let i = 0; i < list.length; i++) {
            const note = list[i];
            const who = note.kind === 'line' ? note.about : personLabel(note.about);
            lines.push('');
            lines.push(who);
            lines.push(note.text || '');
        }
        return lines.join('\n');
    }

    function setLeavingStatus(text) {
        const nodes = document.querySelectorAll('[data-leaving-status]');
        for (let i = 0; i < nodes.length; i++) nodes[i].textContent = text || '';
    }

    function watchLeavingShare(text, pending) {
        if (!pending || !pending.then) return;
        pending.then(function () {
            const nodes = document.querySelectorAll('[data-leaving-status]');
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].textContent === text) nodes[i].textContent = text + ' Other computers can see it.';
            }
        }, function () {
            const nodes = document.querySelectorAll('[data-leaving-status]');
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].textContent === text) nodes[i].textContent = text + ' Saved here. The other computers did not get it.';
            }
        });
    }

    function holdLeaving(on) {
        const root = document.documentElement;
        if (!root || !root.setAttribute) return;
        if (on) {
            if (!root.hasAttribute || !root.hasAttribute('data-mem3-ps-hold')) {
                root.setAttribute('data-mem3-ps-hold', '1');
                leavingHeld = true;
            }
            return;
        }
        if (leavingHeld && root.removeAttribute) {
            root.removeAttribute('data-mem3-ps-hold');
            leavingHeld = false;
        }
    }

    function pushEarlyRun(doc, run) {
        if (!doc.runs) doc.runs = {};
        const id = run.shiftId || shiftId(new Date());
        run.shiftId = id;
        if (!doc.runs[id]) doc.runs[id] = [];
        doc.runs[id].push(run);
        if (doc.runs[id].length > 40) doc.runs[id].shift();
    }

    function slimEarlyClick(record, error) {
        const tip = record && record.tooltip;
        const buttons = [];
        const list = (tip && tip.buttons) || [];
        for (let i = 0; i < list.length; i++) {
            const button = list[i];
            if (!button) continue;
            buttons.push({ text: button.text || '', visible: button.visible !== false });
        }
        return {
            beforeCount: record ? record.beforeCount : null,
            afterCount: record ? record.afterCount : null,
            leftBoard: !!(record && record.leftBoard),
            clickedUnassign: !!(record && record.clickedUnassign),
            clickMethod: record ? (record.clickMethod || '') : '',
            buttonGone: !!(record && record.buttonGone),
            tooltipButtons: buttons,
            error: error || ''
        };
    }

    function collectEarlyDebug() {
        const now = new Date();
        const doc = loadLeaving();
        const id = shiftId(now);
        return {
            script: 'Leaving Early',
            version: SCRIPT_VERSION,
            at: now.toISOString(),
            shiftId: id,
            actor: signedInLogin(),
            share: leavingShareOn(),
            shareError: leavingShareError,
            rev: doc.rev || 0,
            leavingBusy: leavingBusy,
            unassigning: unassigning,
            psHold: psBoardHolding(),
            rows: (doc.shifts && doc.shifts[id]) || [],
            activity: (doc.activity && doc.activity[id]) || [],
            runs: (doc.runs && doc.runs[id]) || []
        };
    }

    function markedLeaving(rows) {
        const out = [];
        const list = rows || [];
        for (let i = 0; i < list.length; i++) {
            if (list[i] && list[i].status === 'said') out.push(list[i]);
        }
        return out;
    }

    function refreshLeaving() {
        if (!isAssignmentsPage()) return;
        if (leavingBusy || unassigning) {
            paintEarlyLog();
            return;
        }
        const now = new Date();
        const doc = loadLeaving();
        if (noteReturns(doc, shiftRows(doc, now), now)) saveLeaving(doc);
        watchMarkedStations();
        paintEarlyLog();
        if (leavingShareOn()) {
            pullLeaving().then(function () {
                paintEarlyLog();
                decoratePopups();
            }).catch(function () {});
        }
    }

    async function unassignMarkedLeaves(by, throughMin) {
        const actor = String(by || loadActor() || '').trim().toLowerCase() || 'board';
        const now = new Date();
        const through = typeof throughMin === 'number' ? throughMinute(throughMin) : throughMinute(now);
        const throughLabel = formatLeaveTime(through);
        let blocked = '';
        if (!isAssignmentsPage()) blocked = 'Not on the assignments page.';
        else if (leavingBusy || unassigning) blocked = 'An unassign is already running.';
        else if (psBoardHolding()) blocked = 'The problem-solve sheet is holding the page.';
        if (blocked) {
            const doc = loadLeaving();
            pushEarlyRun(doc, {
                at: clockText(now), by: actor, kind: 'unassign', shiftId: shiftId(now),
                summary: blocked, steps: []
            });
            saveLeaving(doc);
            setLeavingStatus(blocked);
            paintEarlyLog();
            return;
        }
        const doc = loadLeaving();
        const waiting = markedLeaving(shiftRows(doc, now));
        const rows = dueLeaving(waiting, through);
        const run = {
            at: clockText(now),
            by: actor,
            kind: 'unassign',
            shiftId: shiftId(now),
            through: throughLabel,
            waiting: waiting.map(function (row) {
                return { login: row.login, said: row.said, station: row.station || '' };
            }),
            due: rows.length,
            steps: [],
            summary: ''
        };
        if (!rows.length) {
            run.summary = waiting.length
                ? 'Nobody is leaving through ' + throughLabel + '. ' + waiting.length + ' are later.'
                : 'Nobody on this list is waiting.';
            recordActivity(doc, actor, run.summary, now, { action: 'note' });
            pushEarlyRun(doc, run);
            saveLeaving(doc);
            setLeavingStatus(run.summary);
            finishEarlyProgress(run.summary);
            paintEarlyLog();
            return;
        }
        leavingStop = false;
        leavingBusy = true;
        unassigning = true;
        holdLeaving(true);
        let off = 0;
        const taken = [];
        const fellNames = [];
        const left = [];
        try {
            recordActivity(doc, actor, 'started unassign through ' + throughLabel, now, { action: 'note' });
            paintEarlyProgress(0, rows.length, '');
            for (let i = 0; i < rows.length; i++) {
                if (leavingStop) {
                    for (let j = i; j < rows.length; j++) left.push(rows[j].login);
                    break;
                }
                const row = rows[i];
                paintEarlyProgress(i, rows.length, row.login);
                setLeavingStatus('Unassigning ' + (i + 1) + '/' + rows.length + ' · ' + row.login);
                let anchor = anchorOnMarkedStation(row.login, row.station);
                const stamp = new Date();
                const step = {
                    at: clockText(stamp),
                    login: row.login,
                    said: row.said,
                    station: row.station || '',
                    result: ''
                };
                if (!anchor) {
                    const gone = await stayedOffStation(row.login, row.station);
                    anchor = anchorOnMarkedStation(row.login, row.station);
                    if (!anchor && gone && !leavingStop) {
                        dropFromEarlyOut(doc, row, stamp, actor);
                        step.result = 'fell off';
                        step.note = 'Not on the marked station.';
                        fellNames.push(row.login);
                        run.steps.push(step);
                        paintEarlyProgress(i + 1, rows.length, '');
                        continue;
                    }
                }
                if (!anchor) {
                    if (leavingStop) {
                        left.push(row.login);
                        for (let j = i + 1; j < rows.length; j++) left.push(rows[j].login);
                        step.result = 'stopped';
                        run.steps.push(step);
                        break;
                    }
                    step.result = 'skipped';
                    step.note = 'The station check did not hold.';
                    run.steps.push(step);
                    paintEarlyProgress(i + 1, rows.length, '');
                    continue;
                }
                const before = countLoginOnBoard(row.login);
                step.beforeCount = before;
                step.attempts = [];
                let record = null;
                let error = '';
                for (let tryN = 1; tryN <= 4; tryN++) {
                    if (leavingStop) break;
                    if (record && (record.landed || record.leftBoard)) break;
                    await closeAllAssociateMenus();
                    const again = anchorOnMarkedStation(row.login, row.station);
                    if (!again) {
                        const watched = await watchUnassign(row.login, '');
                        if (!record) record = { login: row.login, tries: tryN };
                        noteUnassignWatch(record, watched);
                        step.attempts.push({
                            try: tryN,
                            clickMethod: record.clickMethod || '',
                            buttonGone: !!record.buttonGone,
                            afterCount: countLoginOnBoard(row.login),
                            samples: watched.samples,
                            leftBoard: watched.gone
                        });
                        break;
                    }
                    record = { login: row.login, station: '', tries: tryN };
                    error = '';
                    try { await unassignAnchor(again, record); } catch (e) {
                        error = e && e.message ? e.message : String(e || 'unassign failed');
                    }
                    const attempt = {
                        try: tryN,
                        clickMethod: record.clickMethod || '',
                        buttonGone: !!record.buttonGone,
                        afterCount: countLoginOnBoard(row.login),
                        samples: record.samples || '',
                        leftBoard: !!record.leftBoard
                    };
                    if (error) attempt.error = error;
                    step.attempts.push(attempt);
                    if (record.landed || record.leftBoard) break;
                    await sleep(300);
                }
                const click = slimEarlyClick(record, error);
                step.afterCount = countLoginOnBoard(row.login);
                step.leftBoard = !!(record && record.leftBoard);
                if (record && record.samples) step.samples = record.samples;
                step.clickedUnassign = click.clickedUnassign;
                step.clickMethod = click.clickMethod;
                step.buttonGone = click.buttonGone;
                step.tooltipButtons = click.tooltipButtons;
                step.tries = step.attempts.length;
                if (error) step.error = error;
                const gone = !!(record && (record.landed || record.leftBoard));
                step.leftBoard = gone;
                if (leavingStop && !gone) {
                    left.push(row.login);
                    for (let j = i + 1; j < rows.length; j++) left.push(rows[j].login);
                    step.result = 'stopped';
                    run.steps.push(step);
                    break;
                }
                if (gone) {
                    markTakenOff(row, stamp, 'unassigned');
                    step.result = 'unassigned';
                    recordActivity(doc, actor, 'unassigned ' + row.login, stamp, {
                        action: 'unassign', who: row.login, said: row.said
                    });
                    taken.push(row.login);
                    off += 1;
                } else {
                    step.result = 'could not take off';
                    left.push(row.login);
                    let closed = !!step.buttonGone;
                    for (let a = 0; a < step.attempts.length; a++) {
                        if (step.attempts[a].buttonGone) closed = true;
                    }
                    if (closed) step.note = 'Unassign closed but the login is still on the board.';
                    recordActivity(doc, actor, 'could not take ' + row.login + ' off', stamp, {
                        action: 'fail', who: row.login, said: row.said
                    });
                }
                run.steps.push(step);
                paintEarlyProgress(i + 1, rows.length, '');
            }
            const later = waiting.length - rows.length;
            run.summary = 'Through ' + throughLabel + '. Unassigned ' + off + '. ' + fellNames.length +
                ' fell off because they were not on the station. ' +
                (rows.length - off - fellNames.length) + ' could not be taken off. ' +
                later + ' are still waiting for their time.';
            if (taken.length) run.summary += ' Unassigned: ' + taken.join(', ') + '.';
            if (fellNames.length) run.summary += ' Fell off: ' + fellNames.join(', ') + '.';
            if (leavingStop) {
                run.stopped = true;
                run.summary = 'Stopped. Unassigned ' + taken.length +
                    (taken.length ? ': ' + taken.join(', ') : '') +
                    '. Still to unassign: ' + (left.length ? left.join(', ') : 'nobody') + '.';
                if (later) run.summary += ' ' + later + ' are still waiting for their time.';
            }
            run.off = off;
            run.missed = 0;
            run.fell = fellNames;
            run.failed = left.length;
            run.stillWaiting = later;
            run.taken = taken;
            run.left = left;
            recordActivity(doc, actor, run.summary, new Date(), { action: 'note' });
            pushEarlyRun(doc, run);
            saveLeaving(doc);
            finishEarlyProgress(run.summary);
        } catch (e) {
            run.summary = e && e.message ? e.message : 'Unassign failed.';
            run.error = run.summary;
            pushEarlyRun(doc, run);
            saveLeaving(doc);
            finishEarlyProgress(run.summary);
        } finally {
            holdLeaving(false);
            unassigning = false;
            leavingBusy = false;
            paintEarlyLog();
        }
    }

    let leftStationWatch = false;

    async function watchMarkedStations() {
        if (leftStationWatch || leavingBusy || unassigning || !isAssignmentsPage()) return;
        const now = new Date();
        const doc = loadLeaving();
        const open = markedLeaving(shiftRows(doc, now));
        const absent = [];
        for (let i = 0; i < open.length; i++) {
            if (missingFromMarkedStation(open[i].login, open[i].station)) absent.push(open[i]);
        }
        if (!absent.length) return;
        leftStationWatch = true;
        try {
            for (let i = 0; i < absent.length; i++) {
                if (leavingBusy || unassigning) return;
                const row = absent[i];
                const gone = await stayedOffStation(row.login, row.station);
                if (!gone || leavingBusy || unassigning) continue;
                const fresh = loadLeaving();
                const liveRows = shiftRows(fresh, new Date());
                let live = null;
                for (let r = 0; r < liveRows.length; r++) {
                    if (liveRows[r] && liveRows[r].id === row.id) live = liveRows[r];
                }
                if (!live || !leavingOpen(live)) continue;
                if (!missingFromMarkedStation(live.login, live.station)) continue;
                const stamp = new Date();
                if (!dropFromEarlyOut(fresh, live, stamp, 'board')) continue;
                saveLeaving(fresh);
                paintEarlyLog();
            }
        } finally {
            leftStationWatch = false;
        }
    }

    function startLeaving() {
        if (!isAssignmentsPage() || !document.body) return;
        paintEarlyLog();
        refreshLeaving();
        refreshNotes();
        refreshEngage();
        setInterval(function () { refreshLeaving(); refreshNotes(); refreshEngage(); }, LEAVING_POLL_MS);
    }

    const NOTES_ID = 'mem3-notes-panel';
    const NOTES_LIST_ID = 'mem3-notes-list';
    const NOTES_KEY = 'mem3-notes-v1';
    const NOTES_TOMB_MS = 12 * 60 * 60 * 1000;
    const NOTES_SHARE_URL = 'https://extendsclass.com/api/json-storage/bin/dcfefcf';
    let notesShareChain = Promise.resolve();
    let notesShareError = '';
    let noteSerial = 0;

    function emptyNotes() {
        return { notes: [], rev: 0 };
    }

    function loadNotes() {
        let raw = '';
        try {
            if (typeof GM_getValue === 'function') raw = GM_getValue(NOTES_KEY, '') || '';
        } catch (e) { raw = ''; }
        if (!raw) {
            try { raw = localStorage.getItem(NOTES_KEY) || ''; } catch (e2) { raw = ''; }
        }
        if (!raw) return emptyNotes();
        try {
            const doc = JSON.parse(raw);
            if (!doc || typeof doc !== 'object' || !Array.isArray(doc.notes)) return emptyNotes();
            return doc;
        } catch (e3) {
            return emptyNotes();
        }
    }

    function saveNotesLocal(doc) {
        const text = JSON.stringify(doc);
        try {
            if (typeof GM_setValue === 'function') GM_setValue(NOTES_KEY, text);
        } catch (e) { /* the page copy below still records it */ }
        try { localStorage.setItem(NOTES_KEY, text); } catch (e2) { /* storage can be blocked */ }
    }

    function noteStamp(note) {
        if (!note) return 0;
        let latest = 0;
        if (typeof note.atMs === 'number' && note.atMs > latest) latest = note.atMs;
        if (typeof note.clearedAtMs === 'number' && note.clearedAtMs > latest) latest = note.clearedAtMs;
        return latest;
    }

    function noteText(text) {
        return String(text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 240);
    }

    function noteKey(text) {
        return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    }

    function addNote(doc, about, by, text, now, kind) {
        const author = String(by || '').trim().toLowerCase();
        const body = noteText(text);
        const lineNote = kind === 'line';
        let target = String(about || '').trim();
        if (!lineNote) target = target.toLowerCase();
        if (!looksLikeLogin(author) || !body) return null;
        if (lineNote) {
            if (!target) return null;
        } else if (!looksLikeLogin(target)) return null;
        if (!doc.notes) doc.notes = [];
        noteSerial += 1;
        const note = {
            id: author + '-' + noteKey(target) + '-' + now.getTime() + '-' + noteSerial,
            about: target,
            by: author,
            kind: lineNote ? 'line' : 'person',
            text: body,
            at: clockText(now),
            atMs: now.getTime(),
            status: 'open'
        };
        doc.notes.push(note);
        return note;
    }

    function clearNote(doc, id, by, now) {
        const author = String(by || '').trim().toLowerCase();
        const list = doc.notes || [];
        for (let i = 0; i < list.length; i++) {
            const note = list[i];
            if (!note || note.id !== id) continue;
            if (note.by !== author) return null;
            if (note.status === 'cleared') return note;
            note.status = 'cleared';
            note.clearedAt = clockText(now);
            note.clearedAtMs = now.getTime();
            return note;
        }
        return null;
    }

    function openNotes(doc) {
        const list = (doc && doc.notes) || [];
        const out = [];
        for (let i = 0; i < list.length; i++) {
            if (list[i] && list[i].status === 'open' && list[i].text) out.push(list[i]);
        }
        out.sort(function (a, b) { return (b.atMs || 0) - (a.atMs || 0); });
        return out;
    }

    function pruneNotes(doc, now) {
        const cutoff = now.getTime() - NOTES_TOMB_MS;
        const keep = [];
        const list = doc.notes || [];
        for (let i = 0; i < list.length; i++) {
            const note = list[i];
            if (!note || !note.id) continue;
            if (note.status === 'cleared' && (note.clearedAtMs || 0) < cutoff) continue;
            keep.push(note);
        }
        doc.notes = keep;
        return doc;
    }

    function mergeNotes(local, remote) {
        const byId = Object.create(null);
        function take(note) {
            if (!note || !note.id) return;
            const prev = byId[note.id];
            const copy = JSON.parse(JSON.stringify(note));
            if (!prev) {
                byId[note.id] = copy;
                return;
            }
            if (copy.status === 'cleared' && prev.status !== 'cleared') {
                byId[note.id] = copy;
                return;
            }
            if (prev.status === 'cleared' && copy.status !== 'cleared') return;
            if (noteStamp(copy) >= noteStamp(prev)) byId[note.id] = copy;
        }
        const lists = [(local && local.notes) || [], (remote && remote.notes) || []];
        for (let n = 0; n < lists.length; n++) {
            for (let i = 0; i < lists[n].length; i++) take(lists[n][i]);
        }
        const out = emptyNotes();
        const ids = Object.keys(byId);
        for (let i = 0; i < ids.length; i++) out.notes.push(byId[ids[i]]);
        out.rev = Math.max((local && local.rev) || 0, (remote && remote.rev) || 0);
        return out;
    }

    function notesShareOn() {
        return !!(NOTES_SHARE_URL && typeof GM_xmlhttpRequest === 'function');
    }

    function notesBody(doc) {
        const copy = JSON.parse(JSON.stringify(doc || emptyNotes()));
        delete copy.rev;
        return JSON.stringify(copy);
    }

    function notesRequest(method, extra) {
        const headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
        };
        if (extra && extra.baseRev != null) headers['X-Notes-Base'] = String(extra.baseRev);
        let url = NOTES_SHARE_URL;
        if (method === 'GET') url += '?t=' + Date.now();
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                method: method,
                url: url,
                headers: headers,
                data: extra && extra.doc ? JSON.stringify(extra.doc) : undefined,
                timeout: 20000,
                onload: function (res) { resolve(res || {}); },
                onerror: function () { reject(new Error('shared notes')); },
                ontimeout: function () { reject(new Error('shared notes timeout')); }
            });
        });
    }

    function readSharedNotes() {
        return notesRequest('GET').then(function (res) {
            if (!res || res.status < 200 || res.status >= 300) throw new Error('shared notes read');
            const doc = parseSharedBody(res.responseText || '');
            if (!doc || !Array.isArray(doc.notes)) return emptyNotes();
            if (typeof doc.rev !== 'number') doc.rev = 0;
            return doc;
        });
    }

    function writeSharedNotes(doc, baseRev) {
        return notesRequest('PUT', { doc: doc, baseRev: baseRev }).then(function (res) {
            if (res && res.status === 409) return { conflict: true };
            if (!res || res.status < 200 || res.status >= 300) throw new Error('shared notes write');
            return { conflict: false };
        });
    }

    function publishNotesOnce(localDoc, attempt) {
        return readSharedNotes().then(function (remote) {
            const merged = pruneNotes(mergeNotes(localDoc, remote), new Date());
            const base = remote.rev || 0;
            if (notesBody(merged) === notesBody(remote)) {
                merged.rev = base;
                saveNotesLocal(merged);
                return merged;
            }
            merged.rev = base + 1;
            return writeSharedNotes(merged, base).then(function (result) {
                if (result.conflict) {
                    if (attempt >= 4) throw new Error('notes conflict');
                    return publishNotesOnce(localDoc, attempt + 1);
                }
                saveNotesLocal(merged);
                return merged;
            });
        });
    }

    function publishNotes(doc) {
        if (!notesShareOn()) return Promise.resolve(doc);
        const job = notesShareChain.then(function () {
            return publishNotesOnce(doc, 0);
        }).then(function (next) {
            notesShareError = '';
            try {
                const nodes = document.querySelectorAll('[data-notes-status]');
                for (let i = 0; i < nodes.length; i++) {
                    if (String(nodes[i].textContent || '').indexOf('shared notes did not load') !== -1) {
                        nodes[i].textContent = 'Other computers can see it.';
                    }
                }
            } catch (e) { /* the list is not open */ }
            return next;
        }, function (err) {
            notesShareError = err && err.message ? err.message : 'shared notes failed';
            throw err;
        });
        notesShareChain = job.then(function (next) { return next; }, function () { return null; });
        return job;
    }

    function saveNotes(doc) {
        pruneNotes(doc, new Date());
        saveNotesLocal(doc);
        if (notesShareOn()) return publishNotes(doc);
        return Promise.resolve(doc);
    }

    function pullNotes() {
        if (!notesShareOn()) return Promise.resolve(loadNotes());
        return publishNotes(loadNotes());
    }

    function whenNotesShared() {
        return notesShareChain;
    }

    function setNotesStatus(text) {
        try {
            const nodes = document.querySelectorAll('[data-notes-status]');
            for (let i = 0; i < nodes.length; i++) nodes[i].textContent = text || '';
        } catch (e) { /* the panel is not open */ }
    }

    function watchNotesShare(text, pending) {
        if (!pending || !pending.then) return;
        pending.then(function () {
            try {
                const nodes = document.querySelectorAll('[data-notes-status]');
                for (let i = 0; i < nodes.length; i++) {
                    if (nodes[i].textContent === text) nodes[i].textContent = text + ' Other computers can see it.';
                }
            } catch (e) { /* the panel is not open */ }
        }, function () {
            try {
                const nodes = document.querySelectorAll('[data-notes-status]');
                for (let i = 0; i < nodes.length; i++) {
                    if (nodes[i].textContent === text) nodes[i].textContent = text + ' Saved here. The other computers did not get it.';
                }
            } catch (e2) { /* the panel is not open */ }
        });
    }

    function refreshNotes() {
        if (!isAssignmentsPage()) return;
        pullNotes().then(function () {
            paintNotesList();
        }).catch(function () { /* the next pass tries again */ });
    }

    function noteLine(note) {
        return note.by + ' noted ' + note.about + ': ' + note.text;
    }

    function paintNotesList() {
        const card = document.getElementById(NOTES_LIST_ID);
        if (!card) return;
        const list = card.querySelector('[data-notes-list]');
        if (!list) return;
        while (list.firstChild) list.removeChild(list.firstChild);
        const actor = signedInLogin();
        const rows = openNotes(loadNotes());
        if (!rows.length) {
            const empty = document.createElement('div');
            empty.textContent = 'No notes.';
            empty.style.cssText = 'color:#8b949e; font-size:12px;';
            list.appendChild(empty);
            return;
        }
        for (let i = 0; i < rows.length; i++) {
            const note = rows[i];
            const line = document.createElement('div');
            line.style.cssText = 'display:flex; gap:8px; align-items:flex-start; ' +
                'padding:6px 0; border-top:1px solid #30363d;';
            if (actor && note.by === actor) {
                const clear = document.createElement('button');
                clear.type = 'button';
                clear.textContent = 'Clear';
                clear.style.cssText = 'flex:0 0 auto; padding:4px 8px; border-radius:6px; border:1px solid #8b949e; ' +
                    'background:#6e7681; color:#ffffff; font:800 11px Segoe UI,system-ui,sans-serif; cursor:pointer;';
                armClearButton(clear, function () {
                    const whoNow = signedInLogin();
                    if (!looksLikeLogin(whoNow)) {
                        setNotesStatus('Control Tower has not shown who is signed in.');
                        return;
                    }
                    const current = loadNotes();
                    const cleared = clearNote(current, note.id, whoNow, new Date());
                    if (!cleared) {
                        setNotesStatus('Only the person who wrote the note can clear it.');
                        return;
                    }
                    const shared = saveNotes(current);
                    const clearedText = 'Cleared the note on ' + personLabel(cleared.about) + '.';
                    setNotesStatus(clearedText);
                    watchNotesShare(clearedText, shared);
                    paintNotesList();
                });
                line.appendChild(clear);
            }
            if (note.kind !== 'line') line.appendChild(listPhoto(note.about));
            const label = document.createElement('div');
            const title = document.createElement('div');
            title.textContent = noteLine(note);
            title.style.cssText = 'font-size:12px; font-weight:650; white-space:pre-wrap;';
            label.appendChild(title);
            line.appendChild(label);
            list.appendChild(line);
        }
    }

    function openNotesList() {
        closeLeavingOverlay(NOTES_LIST_ID);
        const card = document.createElement('div');
        card.id = NOTES_LIST_ID;
        card.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%, -50%); z-index:2147483647; ' +
            'width:min(520px, calc(100vw - 24px)); max-height:min(70vh, 560px); overflow:hidden; padding:12px; ' +
            'display:flex; flex-direction:column; border-radius:10px; background:#161b22; color:#fff; border:1px solid #30363d; ' +
            'box-shadow:0 8px 24px rgba(0,0,0,.45); font-family:Segoe UI,system-ui,sans-serif;';
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px;';
        const title = document.createElement('div');
        title.textContent = 'View Notes';
        title.style.cssText = 'font:800 14px Segoe UI,system-ui,sans-serif;';
        const ask = document.createElement('div');
        ask.textContent = 'Notes from every computer running this script. A note can be cleared only by the person who wrote it.';
        ask.style.cssText = 'font-size:12px; color:#8b949e; margin-bottom:8px;';
        const list = document.createElement('div');
        list.setAttribute('data-notes-list', '');
        const status = document.createElement('div');
        status.setAttribute('data-notes-status', '');
        status.style.cssText = 'min-height:16px; margin-top:8px; font-size:12px; color:#c9d1d9;';
        const scroller = document.createElement('div');
        scroller.style.cssText = 'overflow:auto; min-height:0; flex:1 1 auto;';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.textContent = 'Copy';
        copy.style.cssText = 'flex:0 0 auto; padding:7px 10px; border-radius:6px; border:1px solid #58a6ff; ' +
            'background:#0d1117; color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        copy.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            copyText(notesCopyText(openNotes(loadNotes()))).then(function () {
                copy.textContent = 'Copied';
                setTimeout(function () { copy.textContent = 'Copy'; }, 1500);
            }).catch(function () {
                copy.textContent = 'Copy failed';
                setTimeout(function () { copy.textContent = 'Copy'; }, 2000);
            });
        });
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = 'flex:0 0 auto; padding:7px 10px; border-radius:6px; border:1px solid #8b949e; ' +
            'background:#0d1117; color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        close.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            closeLeavingOverlay(NOTES_LIST_ID);
        });
        const headerActions = document.createElement('div');
        headerActions.style.cssText = 'display:flex; gap:6px; flex:0 0 auto;';
        headerActions.appendChild(copy);
        headerActions.appendChild(close);
        header.appendChild(title);
        header.appendChild(headerActions);
        scroller.appendChild(list);
        scroller.appendChild(status);
        card.appendChild(header);
        card.appendChild(ask);
        card.appendChild(signedInNote());
        card.appendChild(scroller);
        document.body.appendChild(card);
        paintNotesList();
        pullNotes().then(function () {
            paintNotesList();
        }).catch(function () {
            setNotesStatus('Showing this computer. The shared notes did not load.');
        });
    }

    function openNotesPanel(prefill, kind) {
        const lineNote = kind === 'line';
        const name = lineNote ? String(prefill || '').trim() : String(prefill || '').trim().toLowerCase();
        if (lineNote) {
            if (!name) return;
        } else if (!looksLikeLogin(name)) return;
        closeLeavingOverlay(NOTES_ID);
        const card = document.createElement('div');
        card.id = NOTES_ID;
        card.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%, -50%); z-index:2147483647; width:min(440px, calc(100vw - 24px)); ' +
            'padding:12px; border-radius:10px; background:#161b22; color:#fff; border:1px solid #30363d; ' +
            'box-shadow:0 8px 24px rgba(0,0,0,.45); font-family:Segoe UI,system-ui,sans-serif;';
        const title = document.createElement('div');
        title.textContent = 'Enter Notes';
        title.style.cssText = 'font:800 14px Segoe UI,system-ui,sans-serif; margin-bottom:4px;';
        const ask = document.createElement('div');
        ask.textContent = 'Write a note for ' + (lineNote ? name : personLabel(name)) + '. Every computer running this script sees it.';
        ask.style.cssText = 'font-size:12px; color:#8b949e; margin-bottom:8px;';
        const area = document.createElement('textarea');
        area.setAttribute('data-note', '');
        area.setAttribute('maxlength', '240');
        area.placeholder = 'Note';
        area.style.cssText = 'display:block; width:100%; box-sizing:border-box; min-height:88px; resize:vertical; ' +
            'padding:7px 8px; border-radius:6px; border:1px solid #30363d; background:#0d1117; color:#fff; ' +
            'font:600 13px Segoe UI,system-ui,sans-serif;';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:6px; margin-top:8px;';
        const save = document.createElement('button');
        save.type = 'button';
        save.textContent = 'Save';
        save.style.cssText = 'flex:1 1 auto; padding:7px 10px; border-radius:6px; border:1px solid #8b949e; ' +
            'background:#6e7681; color:#ffffff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = 'flex:0 0 auto; padding:7px 10px; border-radius:6px; border:1px solid #8b949e; ' +
            'background:#0d1117; color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        const status = document.createElement('div');
        status.setAttribute('data-notes-status', '');
        status.style.cssText = 'min-height:16px; margin-top:8px; font-size:12px; color:#c9d1d9;';
        function submit() {
            const actor = signedInLogin();
            if (!looksLikeLogin(actor)) {
                setNotesStatus('Control Tower has not shown who is signed in.');
                return;
            }
            const doc = loadNotes();
            const note = addNote(doc, name, actor, area.value, new Date(), lineNote ? 'line' : 'person');
            if (!note) {
                setNotesStatus('Write a note first.');
                return;
            }
            const shared = saveNotes(doc);
            const savedText = 'Saved the note for ' + name + '.';
            setNotesStatus(savedText);
            watchNotesShare(savedText, shared);
            area.value = '';
        }
        save.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            submit();
        });
        close.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            closeLeavingOverlay(NOTES_ID);
        });
        row.appendChild(save);
        row.appendChild(close);
        card.appendChild(title);
        card.appendChild(ask);
        card.appendChild(signedInNote());
        card.appendChild(area);
        card.appendChild(row);
        card.appendChild(status);
        document.body.appendChild(card);
        area.focus();
    }

    function makePopupNotesButton(person) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Enter Notes';
        btn.setAttribute('data-mem3-enter-notes', '');
        btn.style.cssText = 'display:block; width:100%; box-sizing:border-box; margin-top:8px; padding:6px 8px; ' +
            'border-radius:6px; border:1px solid #8b949e; background:#6e7681; color:#ffffff; cursor:pointer; ' +
            'font:800 12px Segoe UI,system-ui,sans-serif; text-transform:none; letter-spacing:0;';
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const host = btn.closest('.' + POPUP_CLASS);
            const login = (person && person.login) || (host && host.dataset.login) || '';
            openNotesPanel(login);
        });
        return btn;
    }

    function refreshEngage() {
        if (!isAssignmentsPage()) return;
        pullEngage().then(function () {
            try { scheduleLivePaint(); } catch (e) { /* the next row paint retries */ }
            const node = document.getElementById(FLOOR_SUMMARY_ID);
            if (node && LAST_SUMMARY) paintSummaryMetrics(node, LAST_SUMMARY);
        }).catch(function () { /* the next pass tries again */ });
    }

    function breakName(id) {
        if (id === 'first') return '1st break';
        if (id === 'second') return '2nd break';
        return 'Break';
    }

    function breakLines(row) {
        const windows = (row && row.windows) || [];
        const lines = [];
        const used = Object.create(null);
        function push(item) {
            if (!item || !item.id || used[item.id]) return;
            used[item.id] = true;
            lines.push(breakName(item.id) + ': ' + formatBreakMinutes(item.idleMin) + ' min');
        }
        for (let i = 0; i < windows.length; i++) {
            if (windows[i] && windows[i].id === 'first') push(windows[i]);
        }
        for (let i = 0; i < windows.length; i++) {
            if (windows[i] && windows[i].id === 'second') push(windows[i]);
        }
        for (let i = 0; i < windows.length; i++) push(windows[i]);
        return lines;
    }

    function breakWhich(row) {
        const windows = (row && row.windows) || [];
        let first = false;
        let second = false;
        for (let i = 0; i < windows.length; i++) {
            if (!windows[i]) continue;
            if (windows[i].id === 'first') first = true;
            else if (windows[i].id === 'second') second = true;
        }
        if (first && second) return '1st and 2nd break';
        if (first) return '1st break';
        if (second) return '2nd break';
        return 'Extended break';
    }

    function appendBreakMinuteLines(parent, row) {
        const windows = (row && row.windows) || [];
        const used = Object.create(null);
        function push(item) {
            if (!item || !item.id || used[item.id]) return;
            used[item.id] = true;
            const line = document.createElement('div');
            const name = document.createElement('span');
            name.textContent = breakName(item.id) + ': ';
            name.style.color = '#ffffff';
            const mins = document.createElement('span');
            mins.setAttribute('data-break-minutes', item.id);
            mins.textContent = formatBreakMinutes(item.idleMin) + ' min';
            mins.style.cssText = 'color:#f85149; font-weight:800;';
            line.appendChild(name);
            line.appendChild(mins);
            parent.appendChild(line);
        }
        for (let i = 0; i < windows.length; i++) {
            if (windows[i] && windows[i].id === 'first') push(windows[i]);
        }
        for (let i = 0; i < windows.length; i++) {
            if (windows[i] && windows[i].id === 'second') push(windows[i]);
        }
        for (let i = 0; i < windows.length; i++) push(windows[i]);
    }

    function breakRowEmpId(row) {
        if (row && row.empId) return row.empId;
        const login = String((row && row.login) || '').trim().toLowerCase();
        if (!login) return '';
        const ids = Object.keys(BOARD_PEOPLE);
        for (let i = 0; i < ids.length; i++) {
            const person = BOARD_PEOPLE[ids[i]];
            if (person && String(person.login || '').toLowerCase() === login) return ids[i];
        }
        const ident = IDENTITY.byLogin[login];
        return ident ? (resolveEmpId(ident) || '') : '';
    }

    function breakRowStation(row) {
        const empId = breakRowEmpId(row);
        if (!empId) return '';
        return stationLabel(personForEmp(empId).station);
    }

    function extendedBreakCard(row) {
        const login = (row && row.login) || '';
        const empId = breakRowEmpId(row);
        const card = document.createElement('div');
        card.style.cssText = 'display:flex; align-items:center; gap:8px; background:#0d1117; ' +
            'border:1px solid #30363d; border-radius:8px; padding:8px;';
        card.appendChild(rosterPhoto(empId, login));
        const info = document.createElement('div');
        info.style.cssText = 'flex:1 1 auto; min-width:0;';
        const who = document.createElement('div');
        who.textContent = login || 'associate';
        who.style.cssText = 'font-size:14px; font-weight:800; margin-bottom:4px;';
        info.appendChild(who);
        const station = breakRowStation(row);
        const sub = document.createElement('div');
        const subBits = [];
        if (station) subBits.push(station);
        subBits.push(row && row.engagedAtMs ? 'engaged' : 'not engaged');
        sub.textContent = subBits.join(' \u00b7 ');
        sub.style.cssText = 'font-size:12px; font-weight:650; line-height:1.35;';
        info.appendChild(sub);
        const minutes = document.createElement('div');
        minutes.style.cssText = 'font-size:12px; font-weight:650; line-height:1.35;';
        appendBreakMinuteLines(minutes, row);
        info.appendChild(minutes);
        if (empId) info.appendChild(shiftDetailsLink(empId));
        if (row && row.engagedAtMs) {
            const view = document.createElement('button');
            view.type = 'button';
            view.textContent = 'Engagement';
            view.style.cssText = 'display:block; width:max-content; margin-top:6px; padding:4px 8px; border-radius:6px; ' +
                'border:1px solid #8b949e; background:#0d1117; color:#fff; cursor:pointer; ' +
                'font:800 11px Segoe UI,system-ui,sans-serif;';
            view.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                openEngagementDetail(row);
            });
            info.appendChild(view);
        }
        card.appendChild(info);
        return card;
    }

    function paintPopupBreak(box, empId, login) {
        if (!box) return;
        const row = flagFor(empId, login, new Date());
        let note = box.querySelector('[data-mem3-extended-note]');
        if (!row) {
            if (note) note.remove();
            return;
        }
        const sig = breakWhich(row) + '|' + breakLines(row).join('|') + '|' + (row.engagedAtMs ? '1' : '0');
        if (!note) {
            note = document.createElement('div');
            note.setAttribute('data-mem3-extended-note', '');
            note.style.cssText = 'margin-top:6px; font-size:12px; font-weight:700; color:#ffffff;';
            const head = box.querySelector('.mem3-popup-head');
            if (head && head.nextSibling) box.insertBefore(note, head.nextSibling);
            else box.appendChild(note);
        }
        if (note.getAttribute('data-sig') === sig) return;
        note.setAttribute('data-sig', sig);
        note.textContent = '';
        const title = document.createElement('div');
        title.textContent = 'Extended break: ' + breakWhich(row) + (row.engagedAtMs ? ' \u00b7 engaged' : '');
        note.appendChild(title);
        appendBreakMinuteLines(note, row);
    }

    function openEngagementDetail(row) {
        closeLeavingOverlay('mem3-engage-detail');
        const card = document.createElement('div');
        card.id = 'mem3-engage-detail';
        card.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%, -50%); z-index:2147483647; ' +
            'width:min(440px, calc(100vw - 24px)); padding:12px; border-radius:10px; background:#161b22; color:#fff; ' +
            'border:1px solid #30363d; box-shadow:0 8px 24px rgba(0,0,0,.45); font-family:Segoe UI,system-ui,sans-serif;';
        const title = document.createElement('div');
        title.textContent = personLabel(row && row.login) + ' engagement';
        title.style.cssText = 'font:800 14px Segoe UI,system-ui,sans-serif; margin-bottom:8px;';
        const who = document.createElement('div');
        who.textContent = row && row.engagedBy
            ? (personLabel(row.engagedBy) + ' engaged at ' + (row.engagedAt || ''))
            : 'Not engaged.';
        who.style.cssText = 'font-size:13px; font-weight:700; margin-bottom:8px;';
        const which = document.createElement('div');
        which.style.cssText = 'font-size:12px; font-weight:650; margin-bottom:8px;';
        const whichTitle = document.createElement('div');
        whichTitle.textContent = breakWhich(row);
        which.appendChild(whichTitle);
        appendBreakMinuteLines(which, row);
        const detail = document.createElement('div');
        detail.textContent = (row && row.detail) || '';
        detail.style.cssText = 'font-size:13px; white-space:pre-wrap;';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = 'margin-top:10px; padding:7px 10px; border-radius:6px; border:1px solid #8b949e; ' +
            'background:#0d1117; color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        close.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            closeLeavingOverlay('mem3-engage-detail');
        });
        card.appendChild(title);
        card.appendChild(who);
        card.appendChild(which);
        card.appendChild(detail);
        card.appendChild(close);
        document.body.appendChild(card);
    }

    function openExtendedList(scopeLabel, empIds) {
        closeLeavingOverlay('mem3-extended-list');
        const rows = empIds ? extendedRows(empIds, new Date()) : extendedRows(null, new Date());
        installPulseStyles();
        const overlay = document.createElement('div');
        overlay.id = 'mem3-extended-list';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:2147483646; background:rgba(0,0,0,0.55); ' +
            'display:flex; align-items:flex-start; justify-content:center; padding:32px 16px; ' +
            'font-family:Segoe UI,system-ui,sans-serif; color:#ffffff;';
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        const card = document.createElement('div');
        card.style.cssText = 'width:min(720px, 100%); max-height:calc(100vh - 64px); overflow:auto; ' +
            'background:#161b22; border:1px solid #30363d; border-radius:12px; padding:18px 18px 8px;';
        const top = document.createElement('div');
        top.style.cssText = 'display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:8px;';
        const headingWrap = document.createElement('div');
        const heading = document.createElement('div');
        heading.textContent = (scopeLabel || 'Extended Breaks') + ' \u00b7 Extended Breaks';
        heading.style.cssText = 'font-size:18px; font-weight:800;';
        const sub = document.createElement('div');
        sub.textContent = rows.length + (rows.length === 1 ? ' associate' : ' associates');
        sub.style.cssText = 'font-size:13px; font-weight:500; color:#c9d1d9; margin-top:4px;';
        headingWrap.appendChild(heading);
        headingWrap.appendChild(sub);
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex; gap:8px; flex:0 0 auto;';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = 'padding:6px 12px; border-radius:8px; cursor:pointer; color:#ffffff; ' +
            'background:#0d1117; border:1px solid #8b949e; font:800 12px Segoe UI,system-ui,sans-serif;';
        close.addEventListener('click', function () { overlay.remove(); });
        actions.appendChild(close);
        top.appendChild(headingWrap);
        top.appendChild(actions);
        card.appendChild(top);
        if (!rows.length) {
            const empty = document.createElement('div');
            empty.textContent = 'Nobody has an extended break.';
            empty.style.cssText = 'font-size:13px; font-weight:650; margin-bottom:12px;';
            card.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-bottom:12px;';
            for (let i = 0; i < rows.length; i++) list.appendChild(extendedBreakCard(rows[i]));
            card.appendChild(list);
        }
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    function openEngagePanel(login, empId) {
        const name = String(login || '').trim().toLowerCase();
        closeLeavingOverlay('mem3-engage-panel');
        const card = document.createElement('div');
        card.id = 'mem3-engage-panel';
        card.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%, -50%); z-index:2147483647; width:min(440px, calc(100vw - 24px)); ' +
            'padding:12px; border-radius:10px; background:#161b22; color:#fff; border:1px solid #30363d; ' +
            'box-shadow:0 8px 24px rgba(0,0,0,.45); font-family:Segoe UI,system-ui,sans-serif;';
        const title = document.createElement('div');
        title.textContent = 'Engage for Extended Break';
        title.style.cssText = 'font:800 14px Segoe UI,system-ui,sans-serif; margin-bottom:4px;';
        const ask = document.createElement('div');
        ask.textContent = 'Write what you did with ' + personLabel(name) + '. The extended-break sign stays until this is saved.';
        ask.style.cssText = 'font-size:12px; color:#8b949e; margin-bottom:8px;';
        const area = document.createElement('textarea');
        area.setAttribute('maxlength', '240');
        area.placeholder = 'Engagement';
        area.style.cssText = 'display:block; width:100%; box-sizing:border-box; min-height:88px; resize:vertical; ' +
            'padding:7px 8px; border-radius:6px; border:1px solid #30363d; background:#0d1117; color:#fff; ' +
            'font:600 13px Segoe UI,system-ui,sans-serif;';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:6px; margin-top:8px;';
        const save = document.createElement('button');
        save.type = 'button';
        save.textContent = 'Save';
        save.style.cssText = 'flex:1 1 auto; padding:7px 10px; border-radius:6px; border:1px solid #f85149; ' +
            'background:#f85149; color:#ffffff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = 'flex:0 0 auto; padding:7px 10px; border-radius:6px; border:1px solid #8b949e; ' +
            'background:#0d1117; color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        const status = document.createElement('div');
        status.style.cssText = 'min-height:16px; margin-top:8px; font-size:12px; color:#c9d1d9;';
        save.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const actor = signedInLogin();
            if (!looksLikeLogin(actor)) {
                status.textContent = 'Control Tower has not shown who is signed in.';
                return;
            }
            const saved = engageExtended(empId, name, actor, area.value, new Date());
            if (!saved) {
                status.textContent = 'Write the engagement first.';
                return;
            }
            closeLeavingOverlay('mem3-engage-panel');
            try { scheduleLivePaint(); } catch (e) { /* the row updates on the next pass */ }
            const node = document.getElementById(FLOOR_SUMMARY_ID);
            if (node && LAST_SUMMARY) paintSummaryMetrics(node, LAST_SUMMARY);
        });
        close.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            closeLeavingOverlay('mem3-engage-panel');
        });
        row.appendChild(save);
        row.appendChild(close);
        card.appendChild(title);
        card.appendChild(ask);
        card.appendChild(area);
        card.appendChild(row);
        card.appendChild(status);
        document.body.appendChild(card);
        area.focus();
    }

    function makePopupEngageButton(person, empId) {
        const login = person && person.login;
        if (!extendedBreakOpen(empId, login)) return null;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Engage for Extended Break';
        btn.setAttribute('data-mem3-engage', '');
        btn.className = 'mem3-engage-pulse';
        btn.style.cssText = 'display:block; width:100%; box-sizing:border-box; margin-top:8px; padding:6px 8px; ' +
            'border-radius:6px; border:1px solid #f85149; background:#f85149; color:#ffffff; cursor:pointer; ' +
            'font:800 12px Segoe UI,system-ui,sans-serif; text-transform:none; letter-spacing:0;';
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const host = btn.closest('.' + POPUP_CLASS);
            const who = login || (host && host.dataset.login) || '';
            const id = empId || (host && host.dataset.empId) || '';
            openEngagePanel(who, id);
        });
        return btn;
    }

    function syncPopupEngage(box, person, empId) {
        installPulseStyles();
        if (!box) return;
        const existing = box.querySelector('[data-mem3-engage]');
        const open = extendedBreakOpen(empId, person && person.login);
        if (open && !existing) {
            const btn = makePopupEngageButton(person, empId);
            if (btn) box.appendChild(btn);
        } else if (!open && existing) existing.remove();
    }

    function makeExtendedBreaksButton() {
        return panelChipButton('Extended Breaks', function () { openExtendedList('All', null); });
    }

    function makeRecalcBreaksButton() {
        return panelChipButton('Recalculate Extended Breaks', requestExtendedRecalc);
    }

    function makeViewNotesButton() {
        return panelChipButton('View Notes', openNotesList);
    }

    function panelChipButton(label, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.style.cssText = 'width:100%; box-sizing:border-box; padding:6px 10px; border-radius:8px; border:1px solid #30363d; ' +
            'background:#0d1117; color:#ffffff; cursor:pointer; text-align:center; ' +
            'font:800 12px Segoe UI,system-ui,sans-serif; letter-spacing:0; text-transform:none; white-space:nowrap;';
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        });
        return btn;
    }

    function makeLeavingEarlyButton() {
        return panelChipButton('Leaving Early', openLeavingPanel);
    }

    function makeShowLeavingButton() {
        return panelChipButton('View Early Outs', openLeavingList);
    }

    function makeEarlyUnassignButton() {
        return panelChipButton('Unassign Early Outs', openEarlyPass);
    }

    function clearMarkedLeave(doc, id, by, now) {
        const row = cancelLeaving(doc, id, now);
        if (!row || row.status !== 'cancelled') return null;
        row.clearedBy = String(by || '').trim().toLowerCase();
        recordActivity(doc, by, 'cleared ' + row.login + ' from leaving at ' + row.said, now, {
            action: 'clear', who: row.login, said: row.said
        });
        pushEarlyRun(doc, {
            at: clockText(now), by: by, kind: 'clear', shiftId: shiftId(now),
            login: row.login, said: row.said, summary: 'cleared'
        });
        return row;
    }

    function currentLeaving(doc, now) {
        const cutoff = now.getTime() - LEAVING_KEEP_MS;
        const rows = shiftRows(doc, now).slice().filter(function (row) {
            if (!row || !row.login) return false;
            if (row.status !== 'said' && row.status !== 'stuck') return false;
            const when = rowTime(row, now);
            return !when || when >= cutoff;
        });
        const best = Object.create(null);
        for (let i = 0; i < rows.length; i++) {
            const prev = best[rows[i].login];
            if (!prev || rowRevisionTime(rows[i], now) >= rowRevisionTime(prev, now)) best[rows[i].login] = rows[i];
        }
        const out = [];
        const names = Object.keys(best);
        for (let i = 0; i < names.length; i++) out.push(best[names[i]]);
        out.sort(function (a, b) {
            return shiftMinute(a.saidMin) - shiftMinute(b.saidMin);
        });
        return out;
    }

    function paintEarlyLog() {
        const card = document.getElementById('mem3-leaving-list');
        if (!card) return;
        const now = new Date();
        const doc = loadLeaving();
        if (restoreLatestMarks(doc, now)) saveLeaving(doc);
        const historyView = card.dataset.view === 'history';
        const title = card.querySelector('[data-leaving-title]');
        if (title) title.textContent = historyView ? 'Leaving History' : 'Early Outs';
        const ask = card.querySelector('[data-leaving-ask]');
        if (ask) {
            ask.textContent = historyView
                ? 'Activity from the past 12 hours.'
                : 'Who is leaving, at their latest time. The same list is on every computer running this script.';
        }
        const signed = card.querySelector('[data-signed-in]');
        if (signed) signed.style.display = historyView ? 'none' : '';
        const historyBtn = card.querySelector('[data-leaving-history]');
        if (historyBtn) historyBtn.textContent = historyView ? 'Show Early Outs' : 'Show History';
        const list = card.querySelector('[data-leaving-list]');
        const activity = card.querySelector('[data-leaving-activity]');
        if (list) list.style.display = historyView ? 'none' : '';
        if (activity) activity.style.display = historyView ? '' : 'none';
        if (list) {
            while (list.firstChild) list.removeChild(list.firstChild);
            const rows = currentLeaving(doc, now);
            const summary = document.createElement('div');
            summary.style.cssText = 'font-size:12px; font-weight:800; padding-bottom:6px;';
            const total = document.createElement('div');
            total.textContent = rows.length + ' leaving early';
            summary.appendChild(total);
            const quarters = leavingQuarterCounts(rows);
            for (let q = 0; q < quarters.length; q++) {
                const bucket = document.createElement('div');
                bucket.textContent = quarters[q].label + '  ' + quarters[q].count;
                bucket.style.cssText = 'font-weight:650; color:#c9d1d9;';
                summary.appendChild(bucket);
            }
            list.appendChild(summary);
            if (!rows.length) {
                const empty = document.createElement('div');
                empty.textContent = 'Nobody is leaving early.';
                empty.style.cssText = 'color:#8b949e; font-size:12px;';
                list.appendChild(empty);
            }
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const line = document.createElement('div');
                line.style.cssText = 'display:flex; gap:8px; align-items:flex-start; ' +
                    'padding:6px 0; border-top:1px solid #30363d;';
                const clear = document.createElement('button');
                clear.type = 'button';
                clear.textContent = 'Clear';
                clear.style.cssText = 'flex:0 0 auto; padding:4px 8px; border-radius:6px; border:1px solid #f85149; ' +
                    'background:#0d1117; color:#fff; font:800 11px Segoe UI,system-ui,sans-serif; cursor:pointer;';
                armClearButton(clear, function () {
                    const actor = requireActor();
                    if (!actor) return;
                    const current = loadLeaving();
                    const cleared = clearMarkedLeave(current, row.id, actor, new Date());
                    if (!cleared) return;
                    const shared = saveLeaving(current);
                    const clearedText = personLabel(cleared.clearedBy) + ' cleared ' +
                        personLabel(cleared.login) + ' at ' + cleared.clearedAt + '.';
                    setLeavingStatus(clearedText);
                    watchLeavingShare(clearedText, shared);
                    paintEarlyLog();
                });
                const label = document.createElement('div');
                label.textContent = leavingLine(row);
                label.style.cssText = 'font-size:12px; font-weight:650; white-space:pre-wrap;';
                line.appendChild(clear);
                line.appendChild(listPhoto(row.login));
                line.appendChild(label);
                list.appendChild(line);
            }
        }
        if (activity) {
            while (activity.firstChild) activity.removeChild(activity.firstChild);
            const events = recentActivity(doc, now);
            if (!events.length) {
                const empty = document.createElement('div');
                empty.textContent = 'No activity in the past 12 hours.';
                empty.style.cssText = 'color:#8b949e; font-size:12px;';
                activity.appendChild(empty);
            }
            for (let i = 0; i < events.length; i++) {
                const line = document.createElement('div');
                line.textContent = activityLine(events[i]);
                line.style.cssText = 'font-size:12px; padding:6px 0; border-top:1px solid #30363d;';
                activity.appendChild(line);
            }
        }
    }

    function openLeavingList() {
        closeLeavingOverlay('mem3-leaving-list');
        const card = document.createElement('div');
        card.id = 'mem3-leaving-list';
        card.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%, -50%); z-index:2147483647; ' +
            'width:min(520px, calc(100vw - 24px)); max-height:min(70vh, 560px); overflow:hidden; padding:12px; ' +
            'display:flex; flex-direction:column; border-radius:10px; background:#161b22; color:#fff; border:1px solid #30363d; ' +
            'box-shadow:0 8px 24px rgba(0,0,0,.45); font-family:Segoe UI,system-ui,sans-serif;';
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px;';
        const title = document.createElement('div');
        title.setAttribute('data-leaving-title', '');
        title.textContent = 'Early Outs';
        title.style.cssText = 'font:800 14px Segoe UI,system-ui,sans-serif;';
        const ask = document.createElement('div');
        ask.setAttribute('data-leaving-ask', '');
        ask.textContent = 'Who is leaving, at their latest time. The same list is on every computer running this script.';
        ask.style.cssText = 'font-size:12px; color:#8b949e; margin-bottom:8px;';
        const list = document.createElement('div');
        list.setAttribute('data-leaving-list', '');
        const activity = document.createElement('div');
        activity.setAttribute('data-leaving-activity', '');
        const status = document.createElement('div');
        status.setAttribute('data-leaving-status', '');
        status.style.cssText = 'min-height:16px; margin-top:8px; font-size:12px; color:#c9d1d9;';
        const scroller = document.createElement('div');
        scroller.style.cssText = 'overflow:auto; min-height:0; flex:1 1 auto;';
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex; gap:6px; margin-top:8px; flex:0 0 auto;';
        const debug = document.createElement('button');
        debug.type = 'button';
        debug.textContent = 'Copy early debug';
        debug.style.cssText = 'padding:7px 10px; border-radius:6px; border:1px solid #58a6ff; background:#0d1117; ' +
            'color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        debug.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            copyText(JSON.stringify(collectEarlyDebug(), null, 2)).then(function () {
                debug.textContent = 'Copied';
                setTimeout(function () { debug.textContent = 'Copy early debug'; }, 1500);
            }).catch(function () {
                debug.textContent = 'Copy failed';
                setTimeout(function () { debug.textContent = 'Copy early debug'; }, 2000);
            });
        });
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = 'flex:0 0 auto; padding:7px 10px; border-radius:6px; border:1px solid #8b949e; ' +
            'background:#0d1117; color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        close.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            closeLeavingOverlay('mem3-leaving-list');
        });
        const history = document.createElement('button');
        history.type = 'button';
        history.setAttribute('data-leaving-history', '');
        history.textContent = 'Show History';
        history.style.cssText = 'flex:1 1 auto; padding:7px 10px; border-radius:6px; border:1px solid #f5c518; ' +
            'background:#f5c518; color:#000000; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        history.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            card.dataset.view = card.dataset.view === 'history' ? 'list' : 'history';
            paintEarlyLog();
        });
        const copyList = document.createElement('button');
        copyList.type = 'button';
        copyList.textContent = 'Copy';
        copyList.style.cssText = 'padding:7px 10px; border-radius:6px; border:1px solid #58a6ff; background:#0d1117; ' +
            'color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        copyList.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const rows = currentLeaving(loadLeaving(), new Date());
            copyText(leavingCopyText(rows)).then(function () {
                copyList.textContent = 'Copied';
                setTimeout(function () { copyList.textContent = 'Copy'; }, 1500);
            }).catch(function () {
                copyList.textContent = 'Copy failed';
                setTimeout(function () { copyList.textContent = 'Copy'; }, 2000);
            });
        });
        actions.appendChild(history);
        actions.appendChild(copyList);
        actions.appendChild(debug);
        header.appendChild(title);
        header.appendChild(close);
        scroller.appendChild(list);
        scroller.appendChild(activity);
        scroller.appendChild(status);
        card.appendChild(header);
        card.appendChild(ask);
        card.appendChild(signedInNote());
        card.appendChild(scroller);
        card.appendChild(actions);
        document.body.appendChild(card);
        paintEarlyLog();
        pullLeaving().then(function () {
            paintEarlyLog();
        }).catch(function () {
            setLeavingStatus('Showing this computer. The shared list did not load.');
        });
    }

    function closeLeavingOverlay(id) {
        const old = document.getElementById(id);
        if (old) old.remove();
    }

    function leavingFieldStyle() {
        return 'flex:1 1 120px; min-width:0; padding:7px 8px; border-radius:6px; border:1px solid #30363d; ' +
            'background:#0d1117; color:#fff; font:600 13px Segoe UI,system-ui,sans-serif;';
    }

    function openLeavingFor(login) {
        const name = String(login || '').trim().toLowerCase();
        if (!name) return null;
        const rows = shiftRows(loadLeaving(), new Date());
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.login !== name) continue;
            if (row.status === 'said' || row.status === 'stuck') return row;
        }
        return null;
    }

    function compactName(text) {
        return String(text || '').toLowerCase().replace(/[^a-z,]/g, '');
    }

    function elementOwnText(el) {
        let text = '';
        const nodes = el.childNodes || [];
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType === 3) text += nodes[i].textContent || '';
        }
        return text.replace(/\s+/g, ' ').trim();
    }

    function findNameElement(host, person) {
        const want = compactName(person && person.name);
        if (!host || want.length < 3) return null;
        const nodes = host.querySelectorAll('div, span, p, h1, h2, h3, h4, strong, b');
        let exact = null;
        let exactLen = 100000;
        let loose = null;
        let looseLen = 100000;
        for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            if (el.closest && el.closest('.' + POPUP_CLASS)) continue;
            if (el.getAttribute && el.getAttribute('data-mem3-leaving-note') != null) continue;
            const own = compactName(elementOwnText(el));
            const fullText = (el.textContent || '').replace(/\s+/g, ' ').trim();
            const full = compactName(fullText);
            if (own === want && fullText.length < exactLen) {
                exact = el;
                exactLen = fullText.length;
            }
            if (full.indexOf(want) === 0 && fullText.length < looseLen && fullText.length < 80) {
                loose = el;
                looseLen = fullText.length;
            }
        }
        return exact || loose;
    }

    function placeNameLeaving(host, person) {
        if (!host) return;
        try {
            const login = (person && person.login) || '';
            const row = openLeavingFor(login);
            const notes = host.querySelectorAll('[data-mem3-leaving-note]');
            let note = notes[0] || null;
            for (let i = 1; i < notes.length; i++) notes[i].remove();
            if (!row) {
                if (note) note.remove();
                return;
            }
            if (!note) {
                note = document.createElement('div');
                note.setAttribute('data-mem3-leaving-note', '');
            }
            note.style.cssText = 'display:block; margin:2px 0 0; padding:0; background:none; border:0; ' +
                'color:#f85149; font:700 13px Segoe UI,system-ui,sans-serif; line-height:1.2;';
            note.textContent = 'Leaving at ' + row.said;
            const nameEl = findNameElement(host, person);
            const parent = nameEl && nameEl.parentElement ? nameEl.parentElement : host;
            const after = nameEl ? nameEl.nextSibling : host.firstChild;
            if (note.parentElement !== parent || note.previousSibling !== nameEl) {
                parent.insertBefore(note, after);
            }
        } catch (e) { /* the card still opens without the leave line */ }
    }

    function paintPopupLeaving(box, person) {
        if (!box) return;
        const button = box.querySelector('[data-mem3-leaving-early]');
        if (!button) return;
        button.style.background = '#f5c518';
        button.style.color = '#000000';
        button.style.borderColor = '#c9a20a';
    }

    function showLeaveCheck(card) {
        if (!card) return;
        let tick = card.querySelector('[data-leave-check]');
        if (!tick) {
            tick = document.createElement('div');
            tick.setAttribute('data-leave-check', '');
            tick.textContent = '✓';
            tick.style.cssText = 'position:absolute; left:50%; top:50%; transform:translate(-50%, -50%); ' +
                'font:900 84px Segoe UI,system-ui,sans-serif; color:#3fb950; pointer-events:none; ' +
                'text-shadow:0 0 18px rgba(63,185,80,.85); z-index:2; opacity:0;';
            card.appendChild(tick);
        }
        if (tick._fade) clearTimeout(tick._fade);
        tick.style.transition = 'none';
        tick.style.opacity = '1';
        tick._fade = setTimeout(function () {
            tick.style.transition = 'opacity .6s linear';
            tick.style.opacity = '0';
        }, 3000);
    }

    function mountEarlyProgress(card) {
        while (card.firstChild) card.removeChild(card.firstChild);
        const title = document.createElement('div');
        title.textContent = 'Unassign Early Outs';
        title.style.cssText = 'font:800 14px Segoe UI,system-ui,sans-serif; margin-bottom:8px;';
        const count = document.createElement('div');
        count.setAttribute('data-early-count', '');
        count.textContent = 'Starting';
        count.style.cssText = 'font:800 13px Segoe UI,system-ui,sans-serif; margin-bottom:6px;';
        const track = document.createElement('div');
        track.style.cssText = 'height:12px; border-radius:6px; background:#0d1117; border:1px solid #30363d; overflow:hidden;';
        const fill = document.createElement('div');
        fill.setAttribute('data-early-fill', '');
        fill.style.cssText = 'height:100%; width:0%; background:#3fb950;';
        track.appendChild(fill);
        const current = document.createElement('div');
        current.setAttribute('data-early-current', '');
        current.style.cssText = 'min-height:16px; margin-top:8px; font-size:12px; color:#c9d1d9;';
        const status = document.createElement('div');
        status.setAttribute('data-leaving-status', '');
        status.style.cssText = 'min-height:16px; margin-top:8px; font-size:12px; color:#c9d1d9;';
        const stop = document.createElement('button');
        stop.type = 'button';
        stop.setAttribute('data-early-stop', '');
        stop.textContent = 'Stop';
        stop.style.cssText = 'margin-top:10px; padding:7px 10px; border-radius:6px; border:1px solid #f85149; ' +
            'background:#0d1117; color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        stop.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            leavingStop = true;
            stop.disabled = true;
            stop.textContent = 'Stopping';
        });
        card.appendChild(title);
        card.appendChild(count);
        card.appendChild(track);
        card.appendChild(current);
        card.appendChild(status);
        card.appendChild(stop);
    }

    function paintEarlyProgress(done, total, login) {
        const card = document.getElementById('mem3-early-pass');
        if (!card) return;
        const fill = card.querySelector('[data-early-fill]');
        const count = card.querySelector('[data-early-count]');
        const current = card.querySelector('[data-early-current]');
        const width = total ? Math.round((done / total) * 100) : 0;
        if (fill) fill.style.width = width + '%';
        if (count) count.textContent = done + ' of ' + total;
        if (current) current.textContent = login ? 'Unassigning ' + login : '';
    }

    function finishEarlyProgress(text) {
        const card = document.getElementById('mem3-early-pass');
        setLeavingStatus(text);
        if (!card) return;
        const current = card.querySelector('[data-early-current]');
        if (current) current.textContent = '';
        const stop = card.querySelector('[data-early-stop]');
        if (!stop) return;
        const close = stop.cloneNode(true);
        close.disabled = false;
        close.textContent = 'Close';
        close.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            closeLeavingOverlay('mem3-early-pass');
        });
        stop.replaceWith(close);
    }

    function makePopupLeavingButton(person) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Leaving Early';
        btn.setAttribute('data-mem3-leaving-early', '');
        btn.style.cssText = 'display:block; width:100%; box-sizing:border-box; margin-top:8px; padding:6px 8px; ' +
            'border-radius:6px; border:1px solid #c9a20a; background:#f5c518; color:#000000; cursor:pointer; ' +
            'font:800 12px Segoe UI,system-ui,sans-serif; text-transform:none; letter-spacing:0;';
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const host = btn.closest('.' + POPUP_CLASS);
            const login = (person && person.login) || (host && host.dataset.login) || '';
            openLeavingPanel(login);
        });
        return btn;
    }

    function openLeavingPanel(prefill) {
        const who = String(prefill || '').trim().toLowerCase();
        closeLeavingOverlay(LEAVING_ID);
        const card = document.createElement('div');
        card.id = LEAVING_ID;
        card.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%, -50%); z-index:2147483647; width:min(440px, calc(100vw - 24px)); ' +
            'padding:12px; border-radius:10px; background:#161b22; color:#fff; border:1px solid #30363d; ' +
            'box-shadow:0 8px 24px rgba(0,0,0,.45); font-family:Segoe UI,system-ui,sans-serif;';
        const head = document.createElement('div');
        head.style.cssText = 'display:flex; gap:10px; align-items:flex-start; margin-bottom:12px;';
        head.appendChild(listPhoto(who));
        const info = document.createElement('div');
        info.style.cssText = 'min-width:0;';
        const nameText = personLabel(who);
        if (nameText && nameText.toLowerCase() !== who) {
            const name = document.createElement('div');
            name.textContent = nameText;
            name.style.cssText = 'font:800 15px Segoe UI,system-ui,sans-serif; line-height:1.25;';
            info.appendChild(name);
        }
        const loginLine = document.createElement('div');
        loginLine.textContent = who || 'No associate on this card.';
        loginLine.style.cssText = 'font-size:13px; font-weight:650; color:#c9d1d9; line-height:1.3;';
        info.appendChild(loginLine);
        const station = looksLikeLogin(who) ? stationForLogin(who) : '';
        const stationLines = leavingStationLines(station);
        const stationCopy = customerReturnsCopy(stationLines);
        const stationHost = stationCopy ? document.createElement('div') : info;
        if (stationCopy) {
            stationHost.setAttribute('data-copy', stationCopy);
            stationHost.style.cursor = 'pointer';
            armStationCopy(stationHost);
            info.appendChild(stationHost);
        }
        for (let i = 0; i < stationLines.length; i++) {
            const line = document.createElement('div');
            line.textContent = stationLines[i];
            line.style.cssText = 'font-size:12px; line-height:1.35; color:#ffffff;';
            stationHost.appendChild(line);
        }
        head.appendChild(info);
        const timeRow = document.createElement('div');
        timeRow.setAttribute('data-time-row', '');
        timeRow.style.cssText = 'display:flex; gap:6px; flex-wrap:nowrap; align-items:center;';
        const time = document.createElement('input');
        time.setAttribute('data-time', '');
        time.setAttribute('inputmode', 'numeric');
        time.setAttribute('maxlength', '5');
        time.setAttribute('autocomplete', 'off');
        time.placeholder = '00:00';
        time.style.cssText = leavingFieldStyle() + ' flex:0 0 76px; width:76px;';
        const half = document.createElement('select');
        half.setAttribute('data-half', '');
        half.style.cssText = leavingFieldStyle() + ' flex:0 0 72px; width:72px;';
        const am = document.createElement('option');
        am.value = 'AM';
        am.textContent = 'AM';
        const pm = document.createElement('option');
        pm.value = 'PM';
        pm.textContent = 'PM';
        half.appendChild(am);
        half.appendChild(pm);
        half.value = 'PM';
        const mark = document.createElement('button');
        mark.type = 'button';
        mark.textContent = 'Mark';
        mark.style.cssText = 'padding:7px 10px; border-radius:6px; border:1px solid #3fb950; background:#238636; ' +
            'color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = 'padding:7px 10px; border-radius:6px; border:1px solid #8b949e; background:#0d1117; ' +
            'color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        const status = document.createElement('div');
        status.setAttribute('data-leaving-status', '');
        status.style.cssText = 'min-height:16px; margin-top:8px; font-size:12px; color:#c9d1d9;';
        function submit() {
            const actor = requireActor();
            const typed = finishLeaveTime(time.value);
            time.value = typed;
            const saidMin = /^\d{2}:\d{2}$/.test(typed)
                ? parseLeaveTime(typed + ' ' + (half.value || 'PM'))
                : null;
            if (!actor) return;
            if (!looksLikeLogin(who)) {
                setLeavingStatus('No associate on this card.');
                return;
            }
            if (saidMin == null) {
                setLeavingStatus('Enter a time like 12:00.');
                return;
            }
            const now = new Date();
            const doc = loadLeaving();
            const markedStation = stationForLogin(who);
            const result = addLeaving(doc, who, saidMin, markedStation, now);
            if (result.updated) {
                recordActivity(doc, actor, 'updated ' + who + ' to leave at ' + result.row.said, now, {
                    action: 'update', who: who, said: result.row.said
                });
            } else if (result.added) {
                recordActivity(doc, actor, 'marked ' + who + ' leaving at ' + result.row.said +
                    (markedStation ? ' from ' + markedStation : ''), now, {
                    action: 'mark', who: who, said: result.row.said, detail: markedStation || ''
                });
            } else {
                recordActivity(doc, actor, who + ' already marked at ' + result.row.said, now, {
                    action: 'same', who: who, said: result.row.said
                });
            }
            pushEarlyRun(doc, {
                at: clockText(now), by: actor, kind: result.updated ? 'update' : (result.added ? 'mark' : 'same'),
                shiftId: shiftId(now), login: who, said: result.row.said,
                previous: result.previous || '', station: markedStation || '',
                summary: result.updated ? 'updated' : (result.added ? 'marked' : 'already marked')
            });
            const shared = saveLeaving(doc);
            paintEarlyLog();
            let markedText = who + ' is already marked at ' + result.row.said + '.';
            if (result.updated) {
                markedText = 'Updated ' + who + ' from ' + result.previous + ' to ' + result.row.said + '.';
            } else if (result.added) {
                markedText = 'Marked ' + who + ' at ' + result.row.said + (markedStation ? ' from ' + markedStation : '') + '.';
            }
            watchLeavingShare(markedText, shared);
            decoratePopups();
            closeLeavingOverlay(LEAVING_ID);
        }
        mark.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            submit();
        });
        time.addEventListener('input', function () {
            const next = maskLeaveTime(time.value);
            if (time.value !== next) time.value = next;
        });
        time.addEventListener('blur', function () {
            const next = finishLeaveTime(time.value);
            if (/^\d{2}:\d{2}$/.test(next)) time.value = next;
        });
        time.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') submit();
        });
        close.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            closeLeavingOverlay(LEAVING_ID);
        });
        timeRow.appendChild(time);
        timeRow.appendChild(half);
        timeRow.appendChild(mark);
        timeRow.appendChild(close);
        card.appendChild(head);
        card.appendChild(timeRow);
        card.appendChild(status);
        document.body.appendChild(card);
        time.focus();
    }

    function openEarlyPass() {
        if (leavingBusy || unassigning) return;
        closeLeavingOverlay('mem3-early-pass');
        const card = document.createElement('div');
        card.id = 'mem3-early-pass';
        card.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%, -50%); z-index:2147483647; ' +
            'width:min(440px, calc(100vw - 24px)); padding:12px; border-radius:10px; background:#161b22; color:#fff; ' +
            'border:1px solid #30363d; box-shadow:0 8px 24px rgba(0,0,0,.45); font-family:Segoe UI,system-ui,sans-serif;';
        const title = document.createElement('div');
        title.textContent = 'Unassign Early Outs';
        title.style.cssText = 'font:800 14px Segoe UI,system-ui,sans-serif; margin-bottom:8px;';
        const throughAsk = document.createElement('div');
        throughAsk.textContent = 'Through';
        throughAsk.style.cssText = 'font-size:12px; font-weight:800; margin-bottom:2px;';
        const throughHint = document.createElement('div');
        throughHint.textContent = 'Anyone leaving at this time or earlier.';
        throughHint.style.cssText = 'font-size:12px; color:#8b949e; margin-bottom:6px;';
        const throughRow = document.createElement('div');
        throughRow.style.cssText = 'display:flex; gap:6px; flex-wrap:nowrap; align-items:center; margin-bottom:8px;';
        const throughTime = document.createElement('input');
        throughTime.setAttribute('data-through', '');
        throughTime.setAttribute('inputmode', 'numeric');
        throughTime.setAttribute('maxlength', '5');
        throughTime.setAttribute('autocomplete', 'off');
        throughTime.placeholder = '00:00';
        throughTime.style.cssText = leavingFieldStyle() + ' flex:0 0 76px; width:76px;';
        const throughHalf = document.createElement('select');
        throughHalf.setAttribute('data-through-half', '');
        throughHalf.style.cssText = leavingFieldStyle() + ' flex:0 0 72px; width:72px;';
        const throughAm = document.createElement('option');
        throughAm.value = 'AM';
        throughAm.textContent = 'AM';
        const throughPm = document.createElement('option');
        throughPm.value = 'PM';
        throughPm.textContent = 'PM';
        throughHalf.appendChild(throughAm);
        throughHalf.appendChild(throughPm);
        const nowClock = formatLeaveTime(new Date().getHours() * 60 + new Date().getMinutes());
        throughTime.value = nowClock.slice(0, 5);
        throughHalf.value = nowClock.slice(-2);
        const pass = document.createElement('input');
        pass.type = 'password';
        pass.placeholder = 'Password';
        pass.setAttribute('autocomplete', 'off');
        pass.style.cssText = leavingFieldStyle() + ' width:100%; box-sizing:border-box;';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:6px; margin-top:8px;';
        const go = document.createElement('button');
        go.type = 'button';
        go.textContent = 'Run';
        go.style.cssText = 'padding:7px 10px; border-radius:6px; border:1px solid #f85149; background:#0d1117; ' +
            'color:#fff; font:800 12px Segoe UI,system-ui,sans-serif; cursor:pointer;';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.style.cssText = go.style.cssText;
        function submit() {
            const actor = requireActor();
            if (!actor) return;
            if (pass.value !== UNASSIGN_PASSWORD) {
                const doc = loadLeaving();
                pushEarlyRun(doc, {
                    at: clockText(new Date()), by: actor, kind: 'unassign',
                    shiftId: shiftId(new Date()), summary: 'Wrong password.', steps: []
                });
                saveLeaving(doc);
                setLeavingStatus('Wrong password.');
                return;
            }
            const typed = finishLeaveTime(throughTime.value);
            throughTime.value = typed;
            const through = /^\d{2}:\d{2}$/.test(typed)
                ? parseLeaveTime(typed + ' ' + (throughHalf.value || 'PM'))
                : null;
            if (through == null) {
                setLeavingStatus('Enter a time like 12:00.');
                return;
            }
            pass.value = '';
            mountEarlyProgress(card);
            unassignMarkedLeaves(actor, through);
        }
        go.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            submit();
        });
        throughTime.addEventListener('input', function () {
            const next = maskLeaveTime(throughTime.value);
            if (throughTime.value !== next) throughTime.value = next;
        });
        throughTime.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') submit();
        });
        pass.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') submit();
        });
        close.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            closeLeavingOverlay('mem3-early-pass');
        });
        row.appendChild(go);
        row.appendChild(close);
        const status = document.createElement('div');
        status.setAttribute('data-leaving-status', '');
        status.style.cssText = 'min-height:16px; margin-top:8px; font-size:12px; color:#c9d1d9;';
        throughRow.appendChild(throughTime);
        throughRow.appendChild(throughHalf);
        card.appendChild(title);
        card.appendChild(signedInNote());
        card.appendChild(throughAsk);
        card.appendChild(throughHint);
        card.appendChild(throughRow);
        card.appendChild(pass);
        card.appendChild(row);
        card.appendChild(status);
        document.body.appendChild(card);
        pass.focus();
    }

    function init() {
        const staleRun = document.getElementById('mem3-run-panel');
        if (staleRun) staleRun.remove();
        const staleSummary = document.getElementById(FLOOR_SUMMARY_ID);
        if (staleSummary && !staleSummary.firstChild) staleSummary.remove();
        placeCornerDebugButton();
        removeCornerPhotoDebugButton();
        loadPhotoCache();
        installNetworkSniffer();
        watchRoute();
        showAssignments();
        initLinePairs();
        setInterval(repairBoard, 1000);
        startLeaving();
    }

    const MENU_IDP_SELECTION_URL = 'https://d34wrqb3xn2znf.cloudfront.net/idp-selection?redirect_uri=https%3A%2F%2Fmenu.na.aft.amazonoperations.app%2Fdo%2Fmfa%2Flogin&nonce=5f50a80c5db87e9cc23b0bc2124a6b6de1e21c0b83cd318714aff390c61ec6fb&scope=openid+tenantId%3A1545ed74-d2cd-11ec-9d64-0242ac120002&client_id=fc-menu-prod-na&state&response_type=code&otp&user_code&authorize_url=https%3A%2F%2Fprod.us-east-1.federated-auth.aft.a2z.com%2F1545ed74-d2cd-11ec-9d64-0242ac120002%2Fauthorize&data=%5B%7B%22id%22%3A%22amazon-federate-prod%22%2C%22displayString%22%3A%22IT+Service+Login%22%7D%2C%7B%22id%22%3A%22maask-prod-na%22%2C%22displayString%22%3A%22Login+with+MAASK%22%7D%5D&code_challenge&code_challenge_method&referrer=https%3A%2F%2Fmenu.na.aft.amazonoperations.app%2Fmidway%2Flogin&ui_locales=en_US';
    const MENU_LOCATION_CODE = 'MEM3';
    const MENU_CHAR_DELAY_MS = 18;
    const MENU_ENTER_DELAY_MS = 250;
    const MENU_REDIRECT_GAP_MS = 15000;
    const MENU_WATCH_MS = 180000;
    const MENU_STAMP_KEY = 'aftMenu.maaskRedirectAt';
    const MENU_IDP_KEY = 'aftMenu.idpSelectionUrl';
    const MENU_IT_LABEL = 'IT Service Login';

    function menuParseUrl(href) {
        if (typeof URL !== 'function') return null;
        try {
            return new URL(href);
        } catch (e) {
            return null;
        }
    }

    function isMaaskAuthPage(href) {
        const value = String(href || '');
        if (value.indexOf('maask.amazonoperations.com') === -1) return false;
        const url = menuParseUrl(value);
        if (!url) return false;
        const host = url.hostname.toLowerCase();
        const maaskHost = host === 'maask.amazonoperations.com' || host.endsWith('.maask.amazonoperations.com');
        if (!maaskHost || host.indexOf('oidc.') !== 0) return false;
        return /\/authentication(?:\/|$)/i.test(url.pathname);
    }

    function isMenuIdpSelection(href) {
        const value = String(href || '');
        if (value.indexOf('cloudfront.net') === -1 || value.indexOf('idp-selection') === -1) return false;
        const url = menuParseUrl(value);
        if (!url) return false;
        const pageHost = url.hostname.toLowerCase();
        const cloudfront = pageHost === 'cloudfront.net' || pageHost.endsWith('.cloudfront.net');
        return cloudfront && /^\/idp-selection\/?$/i.test(url.pathname);
    }

    function isMenuLocationPage(href) {
        const value = String(href || '');
        if (value.indexOf('menu.na.aft.amazonoperations.app') === -1) return false;
        const url = menuParseUrl(value);
        if (!url) return false;
        return url.hostname.toLowerCase() === 'menu.na.aft.amazonoperations.app' && /^\/location\/?$/i.test(url.pathname);
    }

    function isMenuHost(href) {
        const value = String(href || '');
        if (value.indexOf('menu.na.aft.amazonoperations.app') === -1) return false;
        const url = menuParseUrl(value);
        return !!(url && url.hostname.toLowerCase() === 'menu.na.aft.amazonoperations.app');
    }

    function menuStorage() {
        return {
            getItem: function (key) {
                try {
                    if (typeof GM_getValue === 'function') {
                        const value = GM_getValue(key, null);
                        if (value == null || value === '') return null;
                        return String(value);
                    }
                } catch (e) {
                    /* Fall through to sessionStorage. */
                }
                try {
                    return sessionStorage.getItem(key);
                } catch (e2) {
                    return null;
                }
            },
            setItem: function (key, value) {
                try {
                    if (typeof GM_setValue === 'function') {
                        GM_setValue(key, String(value));
                        return;
                    }
                } catch (e) {
                    /* Fall through to sessionStorage. */
                }
                try {
                    sessionStorage.setItem(key, String(value));
                } catch (e2) {
                    /* Storage can be blocked. The sample chooser URL still works. */
                }
            }
        };
    }

    function menuShouldRedirect(href, storage, now) {
        if (!isMaaskAuthPage(href)) return false;
        const last = Number(storage.getItem(MENU_STAMP_KEY) || 0);
        if (!Number.isFinite(last)) return true;
        return now - last >= MENU_REDIRECT_GAP_MS;
    }

    function menuRememberIdp(href, storage) {
        if (!isMenuIdpSelection(href)) return;
        storage.setItem(MENU_IDP_KEY, href);
    }

    function menuIdpTarget(storage) {
        const saved = storage.getItem(MENU_IDP_KEY) || '';
        if (isMenuIdpSelection(saved)) return saved;
        return MENU_IDP_SELECTION_URL;
    }

    function menuLabelOf(el) {
        return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();
    }

    function clickItServiceLogin(root) {
        let clicked = false;
        function visit(el) {
            if (clicked || !el) return;
            if (menuLabelOf(el) !== MENU_IT_LABEL) return;
            const button = (typeof el.closest === 'function' && el.closest('alchemy-button, button, a, [role="button"]')) || el;
            const buttonLabel = menuLabelOf(button);
            if (buttonLabel !== MENU_IT_LABEL || /MAASK/i.test(buttonLabel)) return;
            if (button.dataset && (button.dataset.aftItLogin === '1' || button.dataset.plfItLogin === '1')) {
                clicked = true;
                return;
            }
            if (button.dataset) {
                button.dataset.aftItLogin = '1';
                button.dataset.plfItLogin = '1';
            }
            let target = button;
            if (button.shadowRoot && typeof button.shadowRoot.querySelector === 'function') {
                const inner = button.shadowRoot.querySelector('button, a, [role="button"]');
                if (inner) target = inner;
            }
            if (typeof target.click === 'function') target.click();
            clicked = true;
        }
        function walk(node) {
            if (clicked || !node || typeof node.querySelectorAll !== 'function') return;
            const nodes = node.querySelectorAll('alchemy-button, button, a, [role="button"], span.button__label');
            let i;
            for (i = 0; i < nodes.length; i++) {
                visit(nodes[i]);
                if (clicked) return;
                if (nodes[i].shadowRoot) walk(nodes[i].shadowRoot);
                if (clicked) return;
            }
        }
        walk(root);
        return clicked;
    }

    function watchItServiceLogin() {
        const tryClick = function () {
            try {
                if (!document.documentElement) return false;
                if (clickItServiceLogin(document)) {
                    console.log('[Productivity Panel] clicked IT Service Login');
                    return true;
                }
            } catch (e) {
                console.log('[Productivity Panel] IT Service Login click failed', e);
            }
            return false;
        };
        const arm = function () {
            if (tryClick()) return;
            if (!document.documentElement) return;
            const obs = new MutationObserver(function () {
                if (tryClick()) obs.disconnect();
            });
            obs.observe(document.documentElement, { childList: true, subtree: true });
            const timer = setInterval(function () {
                if (tryClick()) {
                    clearInterval(timer);
                    obs.disconnect();
                }
            }, 200);
            setTimeout(function () {
                clearInterval(timer);
                obs.disconnect();
            }, MENU_WATCH_MS);
        };
        if (document.documentElement) arm();
        else document.addEventListener('DOMContentLoaded', arm, { once: true });
    }

    function menuSleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function menuSetNativeValue(el, value) {
        const proto = el && Object.getPrototypeOf(el);
        const desc = (proto && Object.getOwnPropertyDescriptor(proto, 'value'))
            || (typeof HTMLInputElement !== 'undefined' && Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'));
        if (desc && desc.set) desc.set.call(el, value);
        else el.value = value;
        try {
            el.dispatchEvent(new InputEvent('input', { bubbles: true, data: String(value).slice(-1), inputType: 'insertText' }));
        } catch (e) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function menuTypeInto(el, text) {
        if (el && typeof el.focus === 'function') {
            try {
                el.focus();
            } catch (e) {
                /* The location box can reject focus while the modal is opening. */
            }
        }
        menuSetNativeValue(el, '');
        let i;
        for (i = 0; i < text.length; i++) {
            menuSetNativeValue(el, text.slice(0, i + 1));
            await menuSleep(MENU_CHAR_DELAY_MS);
        }
    }

    function menuPressEnter(el) {
        const types = ['keydown', 'keypress', 'keyup'];
        let i;
        for (i = 0; i < types.length; i++) {
            let ev;
            try {
                ev = new KeyboardEvent(types[i], {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
            } catch (e) {
                ev = new Event(types[i], { bubbles: true, cancelable: true });
            }
            try {
                el.dispatchEvent(ev);
            } catch (e2) {
                /* Ignore a dispatcher that rejects synthetic keys. */
            }
        }
    }

    async function menuTypeAndEnter(el) {
        console.log('[Productivity Panel] typing ' + MENU_LOCATION_CODE);
        await menuTypeInto(el, MENU_LOCATION_CODE);
        await menuSleep(MENU_ENTER_DELAY_MS);
        menuPressEnter(el);
    }

    function watchMenuLocation() {
        let typing = false;
        const tick = function () {
            if (typing || !isMenuLocationPage(location.href) || !document.querySelector) return false;
            const el = document.querySelector('#qlInput');
            if (!el) return false;
            if (el.dataset && el.dataset.aftMem3Typed === '1') return true;
            typing = true;
            if (el.dataset) el.dataset.aftMem3Typed = '1';
            menuTypeAndEnter(el).then(function () {
                typing = false;
            }).catch(function (err) {
                typing = false;
                if (el.dataset) delete el.dataset.aftMem3Typed;
                console.log('[Productivity Panel] location type failed', err);
            });
            return false;
        };
        const arm = function () {
            if (!document.documentElement) return;
            tick();
            const obs = new MutationObserver(function () {
                if (tick()) obs.disconnect();
            });
            obs.observe(document.documentElement, { childList: true, subtree: true });
            const timer = setInterval(function () {
                if (tick()) {
                    clearInterval(timer);
                    obs.disconnect();
                }
            }, 300);
            window.addEventListener('popstate', tick);
            setTimeout(function () {
                clearInterval(timer);
                obs.disconnect();
            }, MENU_WATCH_MS);
        };
        if (document.documentElement) arm();
        else document.addEventListener('DOMContentLoaded', arm, { once: true });
    }

    function runMenuLoginAssist() {
        try {
            const href = location.href;
            if (isMaaskAuthPage(href)) {
                const store = menuStorage();
                const now = Date.now();
                if (menuShouldRedirect(href, store, now)) {
                    store.setItem(MENU_STAMP_KEY, String(now));
                    console.log('[Productivity Panel] leaving MAASK for the IT login chooser');
                    location.replace(menuIdpTarget(store));
                }
                return true;
            }
            if (isMenuIdpSelection(href)) {
                menuRememberIdp(href, menuStorage());
                watchItServiceLogin();
                return true;
            }
            if (isMenuHost(href)) {
                watchMenuLocation();
                return true;
            }
        } catch (e) {
            console.log('[Productivity Panel] menu login assist failed', e);
        }
        return false;
    }

    if (runMenuLoginAssist()) return;
    applyTodayDateOnce();
    init();
    startSilentUpdates();
})();
