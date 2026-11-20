import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/mem3-productivity-panel.txt", import.meta.url), "utf8");
const patched = src.replace(
    "applyTodayDateOnce();\n    init();\n    startSilentUpdates();\n})();",
    `globalThis.__mem3 = {
        addLeaving, saveLeaving, loadLeaving, clearMarkedLeave, shiftId, currentLeaving,
        mergeLeaving, enableLeavingShare, publishLeaving, pullLeaving, whenLeavingShared,
        activityLine, leavingLine, leavingQuarterCounts, loginFromWelcome, restoreLatestMarks,
        addNote, clearNote, saveNotes, loadNotes, pullNotes, whenNotesShared, mergeNotes, openNotes, noteLine
    };
})();`
);

const gist = { rev: 0, text: "" };
const notesGist = { rev: 0, text: "" };
const waiting = [];
let failNext = 0;

function handle(opts) {
    const notes = opts.url && opts.url.indexOf("https://extendsclass.com/api/json-storage/bin/dcfefcf") === 0;
    const leaving = opts.url && opts.url.indexOf("https://extendsclass.com/api/json-storage/bin/edfeccc") === 0;
    const store = notes ? notesGist : gist;
    const baseName = notes ? "X-Notes-Base" : "X-Leaving-Base";
    const base = Number((opts.headers && (opts.headers[baseName] || opts.headers[baseName.toLowerCase()])) || 0);
    if (!notes && !leaving) {
        opts.onload({ status: 404, responseText: "" });
        return;
    }
    if (opts.method === "GET") {
        const content = store.text || (notes
            ? JSON.stringify({ notes: [], rev: 0 })
            : JSON.stringify({ shifts: {}, rev: 0 }));
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
    if (base !== store.rev || doc.rev !== store.rev + 1) {
        opts.onload({ status: 409, responseText: "" });
        return;
    }
    store.rev = doc.rev;
    store.text = content;
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
assert.equal(b.leavingLine({ login: "brndbo", said: "03:00 PM", station: "Station 3-01" }), "brndbo leaving at 03:00 PM\nStation 3-01");
assert.equal(
    b.leavingLine({
        login: "justiwla",
        said: "03:00 PM",
        station: "Customer Returns 1st Half: Station 3-21 2nd Half: Station 3-19 Customer Returns 1st Half: Station 3-21 | 2nd Half: Station 3-19"
    }),
    "justiwla leaving at 03:00 PM\nCustomer Returns\n1st Half: Station 3-21\n2nd Half: Station 3-19"
);
assert.equal(
    JSON.stringify(b.leavingQuarterCounts([
        { saidMin: 720, said: "12:00 PM" },
        { saidMin: 721, said: "12:01 PM" },
        { saidMin: 930, said: "03:30 PM" },
        { saidMin: 1331, said: "10:11 PM" }
    ]).map((item) => item.label + " " + item.count)),
    JSON.stringify(["12:00 PM 2", "03:30 PM 1", "10:00 PM 1"])
);
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

const staleDoc = JSON.parse(JSON.stringify(b.loadLeaving()));
const thirdDoc = a.loadLeaving();
a.addLeaving(thirdDoc, "thirdlog", 15 * 60, "Station 3-09", now);
await finish(a.publishLeaving(thirdDoc));
await finish(b.publishLeaving(staleDoc));
const kept = JSON.parse(gist.text);
const keptNames = kept.shifts[a.shiftId(now)].map((item) => item.login);
assert.ok(keptNames.indexOf("thirdlog") !== -1);
assert.ok(keptNames.indexOf("wyoungmy") !== -1);
assert.equal(
    a.currentLeaving({
        shifts: {
            "1999-01-01-nights": [{ id: "nightone-01:00 AM", login: "nightone", said: "01:00 AM", status: "said", markedAtMs: now.getTime() }]
        }
    }, now).some((row) => row.login === "nightone"),
    true
);
assert.equal(a.currentLeaving({
    shifts: {
        "1999-01-01-days": [{ id: "oldone-01:00 AM", login: "oldone", said: "01:00 AM", status: "said", markedAtMs: now.getTime() - (13 * 60 * 60 * 1000) }]
    }
}, now).length, 0);

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

const notesA = a.loadNotes();
const written = a.addNote(notesA, "brndbo", "abelrigm", "coaching on large", now);
assert.ok(written);
assert.equal(written.about, "brndbo");
assert.equal(written.by, "abelrigm");
assert.equal(a.noteLine(written), "abelrigm noted brndbo: coaching on large");
const lineDoc = { notes: [] };
const lineNote = a.addNote(lineDoc, "CRET Line 3 (O)", "abelrigm", "short staffed", now, "line");
assert.equal(a.noteLine(lineNote), "abelrigm noted CRET Line 3 (O): short staffed");
assert.equal(a.addNote({ notes: [] }, "CRET Line 3 (O)", "abelrigm", "no", now), null);
assert.equal(a.addNote({ notes: [] }, "brndbo", "otherpa", "   ", now), null);
a.saveNotes(notesA);
await finish(a.whenNotesShared());
const seenNotes = await finish(b.pullNotes());
const open = b.openNotes(seenNotes);
assert.equal(open.length, 1);
assert.equal(open[0].text, "coaching on large");
const blocked = b.clearNote(b.loadNotes(), open[0].id, "otherpa", now);
assert.equal(blocked, null);
assert.equal(b.loadNotes().notes.find((item) => item.id === open[0].id).status, "open");
const docClear = a.loadNotes();
const clearedNote = a.clearNote(docClear, open[0].id, "abelrigm", now);
assert.equal(clearedNote.status, "cleared");
a.saveNotes(docClear);
await finish(a.whenNotesShared());
const afterNotes = await finish(b.pullNotes());
assert.equal(b.openNotes(afterNotes).length, 0);
const keptNote = a.mergeNotes(
    { notes: [{ id: "n1", about: "brndbo", by: "abelrigm", text: "keep", status: "open", atMs: now.getTime() }], rev: 1 },
    { notes: [{ id: "n1", about: "brndbo", by: "abelrigm", text: "keep", status: "cleared", atMs: now.getTime(), clearedAtMs: now.getTime() + 1 }], rev: 1 }
);
assert.equal(keptNote.notes[0].status, "cleared");
