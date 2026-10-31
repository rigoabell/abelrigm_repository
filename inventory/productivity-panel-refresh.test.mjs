import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/mem3-productivity-panel.txt", import.meta.url), "utf8");

assert.match(src, /const REFRESH_MS = 5 \* 60 \* 1000;/);
assert.match(src, /@version\s+1\.8\.0/);
assert.equal(src.includes("TIME_PASS_GAP_MS"), false);
assert.equal(src.includes("TIME_PER_PASS"), false);
assert.equal(src.includes("scheduleTimeLoad"), false);
assert.equal(src.includes("setInterval(refreshData"), false);
assert.equal(/setTimeout\(\s*function\s*\(\)\s*\{[\s\S]{0,120}\},\s*8000\s*\)/.test(src), false);
assert.match(src, /if \(refreshBusy \|\| pagesHeld\(\)\)/);
assert.match(src, /html = '';/);

const catalog = JSON.parse(fs.readFileSync(new URL("../docs/data/tampermonkey.json", import.meta.url), "utf8"));
const entry = catalog.find((item) => item.id === "mem3-productivity-panel");
assert.equal(entry.version, "1.8.0");
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
        stop() {
            refreshGeneration++;
            timeGeneration++;
            refreshDue = false;
            refreshBusy = false;
            TIME_LOADING = false;
            if (refreshTimer) clearTimeout(refreshTimer);
            if (rollupRetryTimer) clearTimeout(rollupRetryTimer);
            refreshTimer = null;
            rollupRetryTimer = null;
        }
    };
})();`
);

vm.createContext(sandbox);
vm.runInContext(patched, sandbox, { filename: "mem3-productivity-panel.user.js" });
const api = sandbox.__mem3;
assert.ok(api, "refresh hooks did not load");

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
} finally {
    if (api) api.stop();
}
