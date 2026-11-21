import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/mem3-productivity-panel.txt", import.meta.url), "utf8");
const patched = src.replace(
    "applyTodayDateOnce();\n    init();\n    startSilentUpdates();\n})();",
    `globalThis.__mem3 = {
        breakWindows, idleInWindow, isExtendedIdle, extendedHits, engagedColor,
        readFunctionSegment, rememberExtendedBreak, engageExtended,
        extendedBreakStats, extendedBreakOpen, shiftId
    };
})();`
);

function boot() {
    const store = {};
    const sandbox = {
        console,
        document: { readyState: "complete", getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } },
        location: { href: "http://local/MEM3/assignments", pathname: "/MEM3/assignments" },
        localStorage: {
            getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
            setItem(key, value) { store[key] = String(value); }
        },
        GM_getValue(key, fallback) {
            return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : fallback;
        },
        GM_setValue(key, value) { store[key] = String(value); },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Promise
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.unsafeWindow = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(patched, sandbox, { filename: "mem3-productivity-panel.user.js" });
    return sandbox.__mem3;
}

const api = boot();
const noon = new Date(2026, 10, 20, 12, 0, 0);
const night = new Date(2026, 10, 20, 21, 0, 0);
const days = api.breakWindows(noon);
const nights = api.breakWindows(night);
assert.equal(days[0].label, "8:50–9:25 AM");
assert.equal(days[0].endMin - days[0].startMin, 35);
assert.equal(days[1].label, "2:20–2:55 PM");
assert.equal(nights[0].label, "8:50–9:25 PM");
assert.equal(nights[1].label, "2:20–2:55 AM");

const normal = [{ bucket: "indirect", startMin: 9 * 60, endMin: 9 * 60 + 15 }];
assert.equal(api.idleInWindow(normal, days[0]), 15);
assert.equal(api.isExtendedIdle(15), false);
assert.equal(api.extendedHits(normal, noon).length, 0);
assert.ok(Math.abs((15 / 35) * 100 - 42.857) < 0.01);

const extended = [{ bucket: "indirect", startMin: 8 * 60 + 50, endMin: 8 * 60 + 50 + 19.6 }];
assert.equal(api.isExtendedIdle(19.6), true);
assert.equal(api.isExtendedIdle(19.59), false);
assert.equal(api.extendedHits(extended, noon)[0].id, "first");

const direct = [{ bucket: "direct", startMin: 8 * 60 + 50, endMin: 9 * 60 + 25 }];
assert.equal(api.idleInWindow(direct, days[0]), 0);
const tot = [{ bucket: "tot", startMin: 14 * 60 + 20, endMin: 14 * 60 + 40 }];
assert.equal(api.extendedHits(tot, noon)[0].id, "second");

const nightIdle = [{ bucket: "indirect", startMin: 20 * 60 + 50, endMin: 21 * 60 + 15 }];
assert.equal(api.extendedHits(nightIdle, night)[0].id, "first");

assert.equal(api.engagedColor(95), "#f85149");
assert.equal(api.engagedColor(96), "#d29922");
assert.equal(api.engagedColor(100), "#3fb950");
assert.equal(api.engagedColor(0), "#f85149");
assert.equal(api.extendedBreakStats([], noon).pct, 100);

const row = {
    getAttribute(name) { return name === "title" ? "8:50 AM - 9:15 AM" : ""; },
    querySelectorAll(sel) {
        if (sel === "[title]") return [{ getAttribute() { return "8:50 AM - 9:15 AM"; } }];
        if (sel === "td") return [{ className: "", textContent: "Break" }, { className: "rightAlign", textContent: "0:25" }];
        return [];
    }
};
const segment = api.readFunctionSegment(row, "indirect", 25, "Break");
assert.equal(segment.startMin, 8 * 60 + 50);
assert.equal(segment.endMin, 9 * 60 + 15);

const when = new Date();
const live = api.breakWindows(when);
const liveHit = [{ bucket: "indirect", startMin: live[0].startMin, endMin: live[0].startMin + 20 }];
api.rememberExtendedBreak("99", { segments: liveHit }, when);
assert.ok(api.extendedBreakOpen("99", "", when));
assert.equal(api.extendedBreakStats(["99"], when).count, 1);
assert.equal(api.extendedBreakStats(["99"], when).pct, 0);
const saved = api.engageExtended("99", "", "abelrigm", "Walked them back from break", when);
assert.ok(saved);
assert.equal(api.extendedBreakOpen("99", "", when), null);
const after = api.extendedBreakStats(["99"], when);
assert.equal(after.count, 1);
assert.equal(after.pct, 100);
assert.equal(after.rows[0].detail, "Walked them back from break");
assert.equal(api.engageExtended("99", "", "abelrigm", "again", when), null);
