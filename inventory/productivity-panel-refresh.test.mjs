import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/mem3-productivity-panel.txt", import.meta.url), "utf8");

assert.match(src, /const REFRESH_MS = 5 \* 60 \* 1000;/);
assert.match(src, /@version\s+1\.8\.3/);
assert.match(src, /const MAX_TIME_TRIES = 1;/);
assert.equal(src.includes("TIME_PASS_GAP_MS"), false);
assert.equal(src.includes("TIME_PER_PASS"), false);
assert.equal(src.includes("scheduleTimeLoad"), false);
assert.equal(src.includes("setInterval(refreshData"), false);
assert.equal(/setTimeout\(\s*function\s*\(\)\s*\{[\s\S]{0,120}\},\s*8000\s*\)/.test(src), false);
assert.match(src, /if \(refreshBusy \|\| pagesHeld\(\)\)/);
assert.match(src, /html = '';/);

const catalog = JSON.parse(fs.readFileSync(new URL("../docs/data/tampermonkey.json", import.meta.url), "utf8"));
const entry = catalog.find((item) => item.id === "mem3-productivity-panel");
assert.equal(entry.version, "1.8.3");
assert.equal(entry.file, "downloads/mem3-productivity-panel.txt");

function DOMParser() {}
DOMParser.prototype.parseFromString = function (html) {
    const text = String(html || "");
    const hasClock = text.includes("clock-seg");
    const title = /<title>([^<]*)<\/title>/.exec(text);
    const titleEl = title ? { textContent: title[1] } : null;
    const row = {
        getAttribute(name) { return name === "class" ? "clock-seg on-clock" : ""; },
        textContent: "1:00",
        querySelectorAll(sel) {
            if (sel === "td.rightAlign") return [{ textContent: "1:00" }];
            return [];
        },
        querySelector() { return { textContent: "work" }; }
    };
    return {
        getElementById() { return null; },
        querySelectorAll(sel) {
            if (sel === "tr.clock-seg" && hasClock) return [row];
            return [];
        },
        querySelector(sel) {
            if (sel === "title") return titleEl;
            return null;
        }
    };
};

const document = {
    body: null,
    documentElement: null,
    addEventListener() {},
    removeEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() {
        return {
            style: {},
            dataset: {},
            classList: { add() {}, remove() {} },
            appendChild() {},
            setAttribute() {},
            addEventListener() {},
            remove() {}
        };
    }
};

const delays = [];
const held = [];
let failDetails = false;
let detailsStarted = 0;
let overlap = false;
const realSetTimeout = setTimeout;
const realClearTimeout = clearTimeout;

const sandbox = {
    document,
    location: { pathname: "/other", href: "https://example.test/other", hostname: "example.test" },
    DOMParser,
    console,
    setTimeout(fn, ms, ...args) {
        delays.push(ms);
        return realSetTimeout(fn, ms, ...args);
    },
    clearTimeout: realClearTimeout,
    setInterval() { return 0; },
    clearInterval() {},
    fetch: async () => ({ ok: true, text: async () => "{}" }),
    MutationObserver: class {
        observe() {}
        disconnect() {}
    },
    GM_xmlhttpRequest(opts) {
        const details = String(opts.url).includes("timeDetails");
        if (details && sandbox.plainDetails) {
            detailsStarted += 1;
            opts.onload({ status: 200, responseText: "<html><title>Oops</title></html>", finalUrl: opts.url });
            return;
        }
        if (!details) {
            opts.onload({ status: 200, responseText: "<html></html>", finalUrl: opts.url });
            return;
        }
        if (held.length >= 2) {
            overlap = true;
            opts.onerror({ status: 0, finalUrl: opts.url, error: "overlap" });
            return;
        }
        detailsStarted += 1;
        if (failDetails) {
            opts.onerror({ status: 0, finalUrl: opts.url, error: "down" });
            return;
        }
        held.push(opts);
    },
    GM_setClipboard() {},
    GM_openInTab() {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.unsafeWindow = sandbox;

const patched = src.replace(
    "applyTodayDateOnce();\n    init();\n    startSilentUpdates();\n})();",
    `globalThis.__mem3 = {
        refreshData, forceWindow, loadBoardTimes, timeProgress,
        setBoard(ids) { BOARD_IDS = ids.slice(); },
        boardIds() { return BOARD_IDS.slice(); },
        bigsIds() { return BIGS_IDS.slice(); },
        decorateBigs() { decorateBigsStations(); },
        setPerson(rec) { storeIdentity(rec); },
        setTime(id, rec) { LAST_TIME[id] = rec; },
        setRollup(map) { LAST_ROLLUP = map; LAST_ROLLUP_AT = new Date(); },
        rollupKeys() { return Object.keys(LAST_ROLLUP); },
        time(id) { return LAST_TIME[id] || null; },
        state() {
            return {
                refreshBusy, refreshDue, loading: TIME_LOADING,
                inFlight: Object.keys(TIME_IN_FLIGHT).length,
                cycle: refreshCycle
            };
        },
        setDown(value) { FCLM_DOWN = value; },
        showUpdate(remote) { showUpdatePrompt(remote); },
        stop() {
            refreshGeneration++;
            timeGeneration++;
            refreshDue = false;
            refreshBusy = false;
            TIME_LOADING = false;
            if (refreshTimer) clearTimeout(refreshTimer);
            if (rollupRetryTimer) clearTimeout(rollupRetryTimer);
            if (livePaintTimer) clearTimeout(livePaintTimer);
            refreshTimer = null;
            rollupRetryTimer = null;
            livePaintTimer = null;
        }
    };
})();`
);

vm.createContext(sandbox);
vm.runInContext(patched, sandbox, { filename: "mem3-productivity-panel.user.js" });
const api = sandbox.__mem3;
assert.ok(api, "refresh hooks did not load");

function makeNode(tag) {
    const node = {
        tagName: String(tag || "div").toUpperCase(),
        textContent: "",
        className: "",
        style: {},
        dataset: {},
        attrs: {},
        children: [],
        parentElement: null,
        parentNode: null
    };
    node.classList = {
        add(cls) { node.className = (node.className + " " + cls).trim(); },
        remove(cls) {
            node.className = node.className.split(/\s+/).filter((part) => part && part !== cls).join(" ");
        }
    };
    node.setAttribute = function (name, value) {
        node.attrs[name] = String(value);
        if (name === "class") node.className = String(value);
    };
    node.getAttribute = function (name) { return Object.prototype.hasOwnProperty.call(node.attrs, name) ? node.attrs[name] : null; };
    node.appendChild = function (child) {
        child.parentElement = node;
        child.parentNode = node;
        node.children.push(child);
        return child;
    };
    node.remove = function () {
        const parent = node.parentElement;
        if (!parent) return;
        parent.children = parent.children.filter((child) => child !== node);
        node.parentElement = null;
        node.parentNode = null;
    };
    node.closest = function () { return null; };
    node.addEventListener = function () {};
    node.querySelectorAll = function (sel) {
        const out = [];
        const options = String(sel).split(",").map((part) => part.trim());
        function visit(current) {
            for (let i = 0; i < current.children.length; i++) {
                const child = current.children[i];
                if (options.some((opt) => nodeMatches(child, opt))) out.push(child);
                visit(child);
            }
        }
        visit(node);
        return out;
    };
    node.querySelector = function (sel) { return node.querySelectorAll(sel)[0] || null; };
    return node;
}

function nodeMatches(node, sel) {
    if (sel.charAt(0) === ".") return node.className.split(/\s+/).includes(sel.slice(1));
    if (sel === "table") return node.tagName === "TABLE";
    if (sel === "tbody tr") return node.tagName === "TR" && node.parentElement && node.parentElement.tagName === "TBODY";
    if (sel === "td") return node.tagName === "TD";
    if (sel === "span") return node.tagName === "SPAN";
    if (sel === "a") return node.tagName === "A";
    if (sel === "button") return node.tagName === "BUTTON";
    if (sel === "a[role=\"button\"]") return node.tagName === "A" && node.attrs.role === "button";
    if (sel === "a[mdn-link]") return node.tagName === "A" && Object.prototype.hasOwnProperty.call(node.attrs, "mdn-link");
    return false;
}

function stationTable(rows) {
    const table = makeNode("table");
    const body = makeNode("tbody");
    table.appendChild(body);
    for (let i = 0; i < rows.length; i++) {
        const tr = makeNode("tr");
        const job = makeNode("td");
        job.textContent = rows[i][0];
        const who = makeNode("td");
        const login = makeNode("span");
        login.textContent = rows[i][1];
        who.appendChild(login);
        tr.appendChild(job);
        tr.appendChild(who);
        tr.textContent = rows[i][0] + " " + rows[i][1];
        body.appendChild(tr);
    }
    return table;
}

function releaseAll() {
    const batch = held.splice(0, held.length);
    for (let i = 0; i < batch.length; i++) {
        batch[i].onload({
            status: 200,
            responseText: "<html><title>Time Details</title><tr class=\"clock-seg on-clock\"><td class=\"rightAlign\">1:00</td></tr></html>",
            finalUrl: batch[i].url
        });
    }
}

async function flush() {
    for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => realSetTimeout(resolve, 0));
    }
}

try {
    api.setRollup({ "99": { functions: {} } });
    api.setBoard(["a", "b", "c", "d"]);
    const first = api.refreshData();
    await flush();
    assert.equal(held.length, 2);
    assert.equal(detailsStarted, 2);
    const startedWhileHeld = detailsStarted;
    api.refreshData();
    api.forceWindow("q1");
    await flush();
    assert.equal(detailsStarted, startedWhileHeld);
    assert.equal(held.length, 2);
    assert.equal(api.state().refreshDue, true);
    assert.equal(delays.includes(8000), false);
    assert.equal(delays.includes(5 * 60 * 1000), true);

    for (let n = 0; n < 8; n++) {
        if (held.length) releaseAll();
        await flush();
        if (!held.length && !api.state().loading && !api.state().inFlight) break;
    }
    assert.equal(api.rollupKeys().includes("99"), true);
    assert.equal(api.state().loading, false);
    assert.equal(api.state().inFlight, 0);
    const kept = api.time("a") || api.time("b") || api.time("c") || api.time("d");
    assert.equal(kept && kept.hasTime, true);
    assert.equal(Object.prototype.hasOwnProperty.call(kept, "html"), false);

    const beforeFail = detailsStarted;
    failDetails = true;
    const failed = api.refreshData();
    await failed;
    await flush();
    assert.ok(detailsStarted > beforeFail);
    assert.equal(api.rollupKeys().includes("99"), true);
    const afterFail = api.time("a") || api.time("b");
    assert.equal(afterFail.hasTime, true);
    assert.equal(afterFail.gaveUp, true);

    api.stop();
    api.setDown(true);
    api.setBoard(["e1", "e2", "e3", "e4"]);
    await api.loadBoardTimes();
    const progress = api.timeProgress();
    assert.equal(progress.total, 4);
    assert.equal(progress.done, 4);
    await first.catch(() => {});
    assert.equal(overlap, false);

    api.stop();
    failDetails = false;
    api.setDown(false);
    held.splice(0, held.length);
    const beforeLive = detailsStarted;
    api.setBoard(["p1", "p2", "p3", "p4"]);
    const live = api.loadBoardTimes();
    await flush();
    assert.equal(detailsStarted - beforeLive, 2);
    assert.equal(held.length, 2);
    assert.equal(api.timeProgress().done, 0);
    const firstPerson = held.shift();
    firstPerson.onload({
        status: 200,
        responseText: "<html><title>Time Details</title><tr class=\"clock-seg on-clock\"><td class=\"rightAlign\">1:00</td></tr></html>",
        finalUrl: firstPerson.url
    });
    await flush();
    assert.equal(api.time("p1").hasTime, true);
    assert.equal(api.timeProgress().done, 1);
    assert.equal(api.timeProgress().total, 4);
    assert.equal(detailsStarted - beforeLive, 3);
    for (let n = 0; n < 8; n++) {
        if (held.length) releaseAll();
        await flush();
        if (!held.length && !api.state().loading && !api.state().inFlight) break;
    }
    await live;
    assert.equal(api.timeProgress().done, 4);
    assert.equal(detailsStarted - beforeLive, 4);

    api.stop();
    sandbox.plainDetails = true;
    api.setBoard(["j1", "j2"]);
    const beforeJunk = detailsStarted;
    await api.loadBoardTimes();
    assert.equal(detailsStarted - beforeJunk, 2);
    assert.equal(api.timeProgress().done, 2);
    assert.equal(api.time("j1").gaveUp, true);
    sandbox.plainDetails = false;

    const root = makeNode("div");
    const nonsort = stationTable([
        ["BIGS Problem Solve Station 8-04 | See PS PA", "aaabigs"],
        ["Exceptions Station 8-06 | See PS PA", "aaaplain"],
        ["BIGSHOT Station 8-07 | See PS PA", "aaashot"]
    ]);
    const other = stationTable([
        ["AR/ Refurb BIGS Station 8-10 | See PS PA", "aaarefur"]
    ]);
    root.appendChild(nonsort);
    root.appendChild(other);
    document.querySelectorAll = function (sel) { return root.querySelectorAll(sel); };
    document.createElement = function (tag) { return makeNode(tag); };
    api.setPerson({ login: "aaabigs", id: "501" });
    api.setPerson({ login: "aaarefur", id: "502" });
    api.setPerson({ login: "aaaplain", id: "503" });
    api.setPerson({ login: "aaashot", id: "504" });
    api.setTime("501", { hasTime: true, idleMin: 25, clockedMin: 100, totalMin: 100 });
    api.setTime("502", { hasTime: true, idleMin: 10, clockedMin: 80, totalMin: 80 });
    const boardBefore = api.boardIds();
    api.decorateBigs();
    api.decorateBigs();
    assert.equal(JSON.stringify([].map.call(api.bigsIds(), String)), JSON.stringify(["501", "502"]));
    assert.equal(JSON.stringify([].map.call(api.boardIds(), String)), JSON.stringify([].map.call(boardBefore, String)));
    const badges = root.querySelectorAll(".mem3-bigs-idle");
    assert.equal(badges.length, 2);
    const labels = badges.map((badge) => badge.children.map((child) => String(child.textContent)).join("")).sort();
    assert.deepEqual(labels, ["12.5% IDLE", "25.0% IDLE"]);
    assert.equal(labels.some((label) => label.includes("UPH")), false);

    document.body = makeNode("body");
    document.createTextNode = function (text) {
        const node = makeNode("#text");
        node.textContent = String(text);
        return node;
    };
    let opened = 0;
    sandbox.GM_openInTab = function () { opened += 1; };
    api.showUpdate("9.9.9");
    function allText(node) {
        let text = node.textContent || "";
        const children = node.children || [];
        for (let i = 0; i < children.length; i++) text += " " + allText(children[i]);
        return text;
    }
    const prompt = allText(document.body);
    assert.equal(opened, 1);
    assert.match(prompt, /A new tab just opened/);
    assert.match(prompt, /click Install/);
    assert.match(prompt, /Come back to this tab/);
    assert.match(prompt, /Refresh this screen/);
    assert.match(prompt, /F5/);
    assert.match(prompt, /If you do not refresh this screen/);
} finally {
    if (api) api.stop();
}
