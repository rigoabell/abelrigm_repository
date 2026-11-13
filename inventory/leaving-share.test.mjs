import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/mem3-productivity-panel.txt", import.meta.url), "utf8");
const patched = src.replace(
    "applyTodayDateOnce();\n    init();\n    startSilentUpdates();\n})();",
    `globalThis.__mem3 = {
        addLeaving, saveLeaving, loadLeaving, clearMarkedLeave, shiftId,
        mergeLeaving, enableLeavingShare, publishLeaving, pullLeaving, whenLeavingShared
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

const now = new Date(2026, 10, 13, 14, 5);
const a = boot({});
const b = boot({});

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
