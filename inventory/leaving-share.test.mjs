import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/mem3-productivity-panel.txt", import.meta.url), "utf8");
const patched = src.replace(
    "applyTodayDateOnce();\n    init();\n    startSilentUpdates();\n})();",
    `globalThis.__mem3 = {
        addLeaving, saveLeaving, loadLeaving, clearMarkedLeave, shiftId,
        mergeLeaving, enableLeavingShare, publishLeaving, pullLeaving, whenLeavingShared,
        activityLine, leavingLine, loginFromWelcome, restoreLatestMarks
    };
})();`
);

const gist = { rev: 0, text: "" };
const waiting = [];
let failNext = 0;

function handle(opts) {
    const base = Number((opts.headers && (opts.headers["X-Leaving-Base"] || opts.headers["x-leaving-base"])) || 0);
    if (!opts.url || opts.url.indexOf("https://extendsclass.com/api/json-storage/bin/edfeccc") !== 0) {
        opts.onload({ status: 404, responseText: "" });
        return;
    }
    if (opts.method === "GET") {
        const content = gist.text || JSON.stringify({ shifts: {}, rev: 0 });
        opts.onload({
            status: 200,
            responseText: content + "<!doctype html><html></html>"
        });
        return;
    }
    if (opts.method !== "PUT") {
        opts.onload({ status: 405, responseText: "" });
        return;
    }
    if (failNext > 0) {
        failNext -= 1;
        opts.onload({ status: 409, responseText: "" });
        return;
    }
    const doc = JSON.parse(opts.data);
    const content = opts.data;
    if (base !== gist.rev || doc.rev !== gist.rev + 1) {
        opts.onload({ status: 409, responseText: "" });
        return;
    }
    gist.rev = doc.rev;
    gist.text = content;
    opts.onload({ status: 200, responseText: "{}" });
}

function xhr(opts) {
    waiting.push(opts);
}

async function settle() {
    for (let i = 0; i < 8; i++) await Promise.resolve();
}

async function finish(promise) {
    let settled = false;
    let value;
    let error;
    promise.then(function (next) { settled = true; value = next; }, function (err) { settled = true; error = err; });
    for (let i = 0; i < 8 && !settled; i++) {
        await settle();
        if (waiting.length) handle(waiting.shift());
        await settle();
    }
    if (!settled) throw new Error("shared list did not finish");
    if (error) throw error;
    return value;
}

function boot(store) {
    const sandbox = {
        console,
        document: { readyState: "complete" },
        location: { href: "http://local/MEM3/assignments", pathname: "/MEM3/assignments" },
        localStorage: {
            getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
            setItem(key, value) { store[key] = String(value); }
        },
        GM_getValue(key, fallback) {
            return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : fallback;
        },
        GM_setValue(key, value) { store[key] = String(value); },
        GM_xmlhttpRequest: xhr,
        GM_setClipboard() {},
        GM_openInTab() {},
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
    sandbox.__mem3.enableLeavingShare("shared-leaving", "test-token");
    return sandbox.__mem3;
}

const now = new Date();
const a = boot({});
const b = boot({});
assert.equal(a.loginFromWelcome("Welcome abelrigm"), "abelrigm");
assert.equal(a.loginFromWelcome("Welcome  Abelrigm "), "abelrigm");
assert.equal(a.loginFromWelcome("Welcome back"), "");

const docA = a.loadLeaving();
const marked = a.addLeaving(docA, "brndbo", 14 * 60, "Station 3-01", now);
a.saveLeaving(docA);
await finish(a.whenLeavingShared());
assert.equal(waiting.length, 0);
assert.equal(marked.row.said, "02:00 PM");

const seen = await finish(b.pullLeaving());
const shift = seen.shifts[b.shiftId(now)];
assert.equal(shift.length, 1);
assert.equal(shift[0].login, "brndbo");
assert.equal(shift[0].status, "said");
assert.equal(shift[0].said, "02:00 PM");

const docB = b.loadLeaving();
const cleared = b.clearMarkedLeave(docB, shift[0].id, "otherpa", now);
assert.ok(cleared);
const clearEvents = docB.activity[b.shiftId(now)];
assert.match(
    b.activityLine(clearEvents[clearEvents.length - 1]),
    /^otherpa cleared brndbo from leaving at 02:00 PM at \d{2}:\d{2} [AP]M$/
);
assert.equal(
    b.activityLine({
        action: "update",
        by: "otherpa",
        who: "brndbo",
        said: "03:00 PM",
        at: "02:10 PM",
        text: "updated brndbo from 02:00 PM to 03:00 PM"
    }),
    "otherpa updated brndbo to leave at 03:00 PM at 02:10 PM"
);
assert.equal(b.leavingLine({ login: "brndbo", said: "03:00 PM", station: "Station 3-01" }), "brndbo leaving at 03:00 PM from Station 3-01");
b.saveLeaving(docB);
await finish(b.whenLeavingShared());

const after = await finish(a.pullLeaving());
const row = after.shifts[a.shiftId(now)].find((item) => item.login === "brndbo");
assert.equal(row.status, "cancelled");

const other = b.loadLeaving();
b.addLeaving(other, "wyoungmy", 14 * 60 + 30, "Station 3-07", now);
failNext = 1;
await finish(b.publishLeaving(other));
const both = JSON.parse(gist.text);
const names = both.shifts[a.shiftId(now)].map((item) => item.login).sort();
assert.deepEqual(names, ["brndbo", "wyoungmy"]);
assert.equal(both.shifts[a.shiftId(now)].find((item) => item.login === "brndbo").status, "cancelled");

const shiftKey = a.shiftId(now);
const remarked = a.mergeLeaving(
    {
        shifts: { [shiftKey]: [{ id: "brndbo-02:00 PM", login: "brndbo", said: "02:00 PM", status: "cancelled", markedAtMs: now.getTime() - 10000, clearedAtMs: now.getTime() - 5000 }] },
        activity: {}, runs: {}, rev: 1
    },
    {
        shifts: { [shiftKey]: [{ id: "brndbo-02:00 PM", login: "brndbo", said: "02:00 PM", status: "said", markedAtMs: now.getTime() }] },
        activity: {}, runs: {}, rev: 1
    }
);
assert.equal(remarked.shifts[shiftKey][0].status, "said");
const keptClear = a.mergeLeaving(
    {
        shifts: { [shiftKey]: [{ id: "brndbo-02:00 PM", login: "brndbo", said: "02:00 PM", status: "said", markedAtMs: now.getTime() - 10000 }] },
        activity: {}, runs: {}, rev: 1
    },
    {
        shifts: { [shiftKey]: [{ id: "brndbo-02:00 PM", login: "brndbo", said: "02:00 PM", status: "cancelled", markedAtMs: now.getTime() - 10000, clearedAtMs: now.getTime() }] },
        activity: {}, runs: {}, rev: 1
    }
);
assert.equal(keptClear.shifts[shiftKey][0].status, "cancelled");
const healed = {
    shifts: {
        [shiftKey]: [{ id: "brndbo-01:00 PM", login: "brndbo", said: "01:00 PM", saidMin: 780, status: "cancelled", markedAt: "02:52 PM" }]
    },
    activity: {
        [shiftKey]: [{ at: "03:56 PM", atMs: Date.now(), by: "abelrigm", text: "marked brndbo leaving at 01:00 PM", action: "mark", who: "brndbo", said: "01:00 PM" }]
    },
    runs: {},
    rev: 1
};
assert.equal(a.restoreLatestMarks(healed, new Date()), true);
assert.equal(healed.shifts[shiftKey][0].status, "said");
const local = a.loadLeaving();
a.clearMarkedLeave(local, "brndbo-02:00 PM", "abelrigm", now);
const second = a.addLeaving(local, "brndbo", 14 * 60, "Station 3-01", new Date());
assert.equal(second.row.status, "said");
assert.equal(local.shifts[a.shiftId(now)].filter((item) => item.id === "brndbo-02:00 PM").length, 1);
const doubled = a.mergeLeaving(
    {
        shifts: {
            [shiftKey]: [
                { id: "brndbo-01:00 PM", login: "brndbo", said: "01:00 PM", saidMin: 780, status: "said", markedAtMs: now.getTime() - 5000 },
                { id: "brndbo-01:01 PM", login: "brndbo", said: "01:01 PM", saidMin: 781, status: "said", markedAtMs: now.getTime() }
            ]
        },
        activity: {}, runs: {}, rev: 1
    },
    { shifts: {}, activity: {}, runs: {}, rev: 1 }
);
const stillOpen = doubled.shifts[shiftKey].filter((item) => item.status === "said");
assert.equal(stillOpen.length, 1);
assert.equal(stillOpen[0].said, "01:01 PM");
