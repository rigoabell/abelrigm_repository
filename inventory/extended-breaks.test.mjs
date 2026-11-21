import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/mem3-productivity-panel.txt", import.meta.url), "utf8");
const patched = src.replace(
    "applyTodayDateOnce();\n    init();\n    startSilentUpdates();\n})();",
    `globalThis.__mem3 = {
        breakWindows, idleInWindow, isExtendedIdle, extendedHits, engagedColor,
        readFunctionSegment, rememberExtendedBreak, engageExtended,
        extendedBreakStats, extendedBreakOpen, breakWhich, shiftId,
        extendedChecked, breakCalcFinished, clearBreakChecked, reloadBreakChecked,
        noteExtendedChecked, markBreakCalcFinished
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

const bothSegments = [
    { bucket: "indirect", startMin: live[0].startMin, endMin: live[0].startMin + 20 },
    { bucket: "indirect", startMin: live[1].startMin, endMin: live[1].startMin + 22 }
];
api.rememberExtendedBreak("77", { segments: bothSegments }, when);
const both = api.extendedBreakStats(["77", "77"], when);
assert.equal(both.count, 1);
assert.equal(both.rows[0].windows.length, 2);
assert.equal(api.breakWhich(both.rows[0]), "1st and 2nd break");
assert.equal(api.breakWhich(after.rows[0]), "1st break");

api.noteExtendedChecked("99", when);
api.markBreakCalcFinished(when);
api.reloadBreakChecked();
assert.equal(api.extendedChecked("99", when), true);
assert.equal(api.breakCalcFinished(when), true);
api.clearBreakChecked(when);
api.reloadBreakChecked();
assert.equal(api.breakCalcFinished(when), false);
assert.equal(api.extendedChecked("99", when), false);
assert.equal(src.includes("try { rememberExtendedBreak(empId, record)"), false);
assert.equal(src.includes("if (!force && breakCalcFinished(when)) return"), false);
assert.equal(src.includes("min idle"), false);
assert.match(src, /function pendingBreakIds/);
assert.match(src, /function queueMissingBreaks/);
assert.match(src, /box-shadow:0 0 0 ' \+ ringPx \+ 'px ' \+ clock\.color/);
assert.match(src, /function extendedBreakCard/);
assert.match(src, /function rosterPhoto/);
assert.match(src, /labelAbove: true/);
assert.match(src, /Open FCLM details/);
const breakCard = src.slice(src.indexOf("function extendedBreakCard"), src.indexOf("function paintPopupBreak"));
assert.ok(breakCard.indexOf("shiftDetailsLink(empId)") < breakCard.indexOf("view.textContent = 'Engagement'"));
assert.match(breakCard, /view\.style\.cssText = 'display:block; width:max-content;/);
assert.match(src, /fclmEmpUrl\(empId, 'all'\)/);
assert.match(src, /data-break-minutes/);
assert.match(src, /color:#f85149; font-weight:800;/);
assert.match(src, /Calculating Idle Time Percent/);
assert.match(src, /Calculating Extended Breaks/);
assert.match(src, /Recalculate Extended Breaks/);
assert.match(src, /background:#d29922;/);
assert.match(src, /BREAK_RUNNING && !idleGoing/);
assert.match(src, /Took Extended Break/);
assert.match(src, /Currently Idle/);
assert.match(src, /id = 'mem3-cursor-tip'/);
assert.match(src, /let left = x - rect\.width \/ 2;/);
assert.match(src, /let top = y - rect\.height - gap;/);
assert.match(src, /data-mem3-name-tip/);
assert.match(src, /poly\.style\.pointerEvents = 'fill'/);
assert.match(src, /pointer-events:none;/);

const daysScale = { shiftName: "days", originMin: 6 * 60, pxPerMin: 1 };
const nightScale = { shiftName: "nights", originMin: 18 * 60, pxPerMin: 1 };

function clockRow(text) {
    return {
        getAttribute(name) { return name === "title" ? text : ""; },
        querySelectorAll(sel) {
            if (sel === "[title]") return [{ getAttribute() { return text; } }];
            if (sel === "td") return [{ className: "", textContent: text }, { className: "rightAlign", textContent: "0:25" }];
            return [];
        }
    };
}

const dayText = api.readFunctionSegment(clockRow("08:50 - 09:15"), "indirect", 25, "Break", daysScale);
assert.equal(dayText.startMin, 8 * 60 + 50);
assert.equal(dayText.endMin, 9 * 60 + 15);
assert.equal(api.extendedHits([dayText], noon)[0].id, "first");

const afternoon = api.readFunctionSegment(clockRow("2:20 - 2:45"), "indirect", 25, "Break", daysScale);
assert.equal(afternoon.startMin, 14 * 60 + 20);
assert.equal(afternoon.endMin, 14 * 60 + 45);
assert.equal(api.extendedHits([afternoon], noon)[0].id, "second");

const nightText = api.readFunctionSegment(clockRow("08:50 - 09:15"), "indirect", 25, "Break", nightScale);
assert.equal(nightText.startMin, 20 * 60 + 50);
assert.equal(nightText.endMin, 21 * 60 + 15);
assert.equal(api.extendedHits([nightText], night)[0].id, "first");

const nightMorning = api.readFunctionSegment(clockRow("2:20 - 2:40"), "indirect", 20, "Break", nightScale);
assert.equal(nightMorning.startMin, 2 * 60 + 20);
assert.equal(api.idleInWindow([nightMorning], nights[1]), 20);

const iso = api.readFunctionSegment(clockRow("2026-11-21T14:20:00 - 2026-11-21T14:45:00"), "indirect", 25, "Break", daysScale);
assert.equal(iso.startMin, 14 * 60 + 20);
assert.equal(iso.endMin, 14 * 60 + 45);

const dotted = api.readFunctionSegment(clockRow("8:50 a.m. - 9:15 a.m."), "indirect", 25, "Break", daysScale);
assert.equal(dotted.startMin, 8 * 60 + 50);
assert.equal(dotted.endMin, 9 * 60 + 15);

function barRow(style) {
    return {
        getAttribute() { return ""; },
        querySelectorAll(sel) {
            if (sel === "[style]") return [{ getAttribute(name) { return name === "style" ? style : ""; } }];
            if (sel === "td") return [{ className: "", textContent: "Break" }, { className: "rightAlign", textContent: "0:25" }];
            return [];
        }
    };
}

const morningBar = api.readFunctionSegment(barRow("margin-left:170px;width:25px"), "indirect", 25, "Break", daysScale);
assert.equal(morningBar.startMin, 6 * 60 + 170);
assert.equal(morningBar.endMin, 6 * 60 + 195);
assert.equal(api.extendedHits([morningBar], noon)[0].id, "first");

const shortBar = api.readFunctionSegment(barRow("margin-left:180px;width:15px"), "indirect", 15, "Break", daysScale);
assert.equal(api.extendedHits([shortBar], noon).length, 0);

const pctBar = api.readFunctionSegment(barRow("left:23.611111%;width:3.472222%"), "indirect", 25, "Break", daysScale);
assert.ok(Math.abs(pctBar.startMin - (8 * 60 + 50)) < 0.2);
assert.ok(Math.abs((pctBar.endMin - pctBar.startMin) - 25) < 0.2);

const nightBar = api.readFunctionSegment(barRow("margin-left:500px;width:20px"), "indirect", 20, "Break", nightScale);
assert.equal(nightBar.startMin, 18 * 60 + 500);
assert.equal(api.idleInWindow([nightBar], nights[1]), 20);

function imageRow() {
    const imgs = [
        { getAttribute(name) { return name === "width" ? "170" : name === "height" ? "1" : ""; } },
        { getAttribute(name) { return name === "width" ? "25" : name === "height" ? "10" : name === "title" ? "Break" : ""; } }
    ];
    return {
        getAttribute() { return ""; },
        querySelectorAll(sel) {
            if (sel === "img") return imgs;
            if (sel === "td") return [{ className: "", textContent: "Break" }];
            return [];
        }
    };
}
const imageBar = api.readFunctionSegment(imageRow(), "indirect", 25, "Break", daysScale);
assert.equal(imageBar.startMin, 6 * 60 + 170);
assert.equal(api.extendedHits([imageBar], noon)[0].id, "first");

function trackRow() {
    return {
        getAttribute() { return ""; },
        querySelectorAll(sel) {
            if (sel === "[style]") return [
                { getAttribute(name) { return name === "style" ? "left:0%;width:100%" : ""; } },
                { getAttribute(name) { return name === "style" ? "margin-left:170px;width:25px" : ""; } }
            ];
            if (sel === "td") return [{ className: "", textContent: "Break" }];
            return [];
        }
    };
}
const tracked = api.readFunctionSegment(trackRow(), "indirect", 25, "Break", daysScale);
assert.equal(tracked.startMin, 6 * 60 + 170);
assert.equal(tracked.endMin, 6 * 60 + 195);
