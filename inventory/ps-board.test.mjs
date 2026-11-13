import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/mem3-control-tower-ps-board.txt", import.meta.url), "utf8");
const catalog = JSON.parse(fs.readFileSync(new URL("../docs/data/tampermonkey.json", import.meta.url), "utf8"));

const sandbox = { __PS_BOARD_EXPORT: true, console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox, { filename: "mem3-control-tower-ps-board.txt" });
const board = sandbox.__psBoard;

test("catalog entry matches the script", () => {
    const entry = catalog.find((item) => item.id === "mem3-control-tower-ps-board");
    assert.ok(entry);
    assert.equal(entry.version, "1.3.1");
    assert.equal(entry.category, "Control Tower");
    assert.equal(entry.file, "downloads/mem3-control-tower-ps-board.txt");
    assert.equal(entry.downloadName, "MEM3 Control Tower - PS Board (abelrigm).txt");
    assert.match(src, /@version\s+1\.3\.1/);
    assert.match(src, /data-mem3-ps-hold/);
    assert.match(src, /function noneAnchor/);
    assert.match(src, /function assignButtonFor/);
    assert.match(src, /Copy debug/);
    assert.match(src, /function formatDebug/);
    assert.match(src, /control-tower\.meta\.amazon\.dev\/\*/);
    assert.match(src, /beta\.control-tower\.meta\.amazon\.dev\/\*/);
    assert.equal(src.includes("@grant"), false);
    assert.equal(src.includes("heading.appendChild"), false);
    assert.match(src, /heading\.nextSibling/);
    assert.match(src, /mem3-uph-badge/);
});

function copy(value) {
    return JSON.parse(JSON.stringify(value));
}

test("sheet labels match the problem solve map", () => {
    const labels = board.lines.flat().map((slot) => slot.label);
    assert.deepEqual(copy(labels), [
        "1 Even B", "1 Odd", "1 Even A",
        "2 Odd B", "2 Odd A", "2 Even",
        "3 Even B", "3 Odd", "3 Even A",
        "4 Odd B", "4 Odd A", "4 Even"
    ]);
    assert.deepEqual(copy(board.support.map((slot) => slot.label)), [
        "Audit PS", "Grey Totes", "Gatekeeper", "",
        "Bigs PS", "Add-Ins", "Exceptions", ""
    ]);
    assert.equal(board.lines[0].find((slot) => slot.id === "1-even-b").row, 1);
    assert.equal(board.lines[0].find((slot) => slot.id === "1-even-b").col, 2);
    assert.equal(board.lines[1].find((slot) => slot.id === "2-odd-b").col, 1);
    assert.equal(board.lines[3].find((slot) => slot.id === "4-odd-b").row, 1);
});

test("line stations from the CRET Problem Solve table land on the sheet", () => {
    const rows = [
        ["CRETS Problem Solve CRET 1 Even B (PS) | See PS PA", "1-even-b"],
        ["CRET 1 Even A (PS)", "1-even-a"],
        ["CRET 1 Odd (PS)", "1-odd"],
        ["CRET 1 Odd A", "1-odd"],
        ["CRET 1 Even", "1-even-a"],
        ["CRET 2 Odd B (PS) | See PS PA", "2-odd-b"],
        ["CRET 2 Odd A (PS)", "2-odd-a"],
        ["CRET 2 Even (PS)", "2-even"],
        ["CRET 2 Even B", "2-even"],
        ["CRET 3 Even A (PS)", "3-even-a"],
        ["CRET 3 Even B (PS)", "3-even-b"],
        ["CRET 3 Odd", "3-odd"],
        ["4 Odd B", "4-odd-b"],
        ["4 Odd A", "4-odd-a"],
        ["4 Even", "4-even"]
    ];
    for (const [assignment, slot] of rows) {
        assert.equal(board.slotIdFromAssignment(assignment), slot, assignment);
    }
});

test("support roles and unknown stations", () => {
    assert.equal(board.slotIdFromAssignment("Audit PS"), "audit");
    assert.equal(board.slotIdFromAssignment("CRETS Audits"), "audit");
    assert.equal(board.slotIdFromAssignment("Grey Totes"), "grey");
    assert.equal(board.slotIdFromAssignment("Gray Tote"), "grey");
    assert.equal(board.slotIdFromAssignment("Gatekeeper"), "gate");
    assert.equal(board.slotIdFromAssignment("Gate Keeper"), "gate");
    assert.equal(board.slotIdFromAssignment("Bigs PS"), "bigs");
    assert.equal(board.slotIdFromAssignment("Add-Ins"), "addins");
    assert.equal(board.slotIdFromAssignment("Add Ins"), "addins");
    assert.equal(board.slotIdFromAssignment("Exceptions"), "exceptions");
    assert.equal(board.slotIdFromAssignment("CRETS Problem Solve"), "");
    assert.equal(board.slotIdFromAssignment("See PS PA"), "");
    assert.equal(board.slotIdFromAssignment("Water Spider"), "");
    assert.equal(board.slotIdFromAssignment("CRETS Problem SolveAudit PS"), "audit");
    assert.equal(board.slotIdFromAssignment("CRETS Problem SolveGrey Totes"), "grey");
    assert.equal(board.slotIdFromAssignment("CRETS Problem SolveGatekeeper"), "gate");
    assert.equal(board.slotIdFromAssignment("CRETS Problem SolveBigs PS"), "bigs");
    assert.equal(board.slotIdFromAssignment("CRETS Problem SolveAdd-Ins"), "addins");
    assert.equal(board.slotIdFromAssignment("CRETS Problem SolveExceptions"), "exceptions");
    assert.equal(board.slotIdFromAssignment("CRETS Problem SolveCRET 1 Even B (PS) | See PS PA"), "1-even-b");
    assert.equal(board.slotIdFromAssignment("CRETS Problem SolveWater Spider"), "");
    assert.equal(board.shortAssignment("CRETS Problem SolveWater Spider"), "Water Spider");
});

test("the screenshot roster is placed on the matching stations", () => {
    const placed = board.placePeople([
        { login: "jlatonje", assignment: "CRETS Problem Solve CRET 1 Even B (PS) | See PS PA" },
        { login: "irifelix", assignment: "CRETS Problem Solve CRET 1 Even A (PS) | See PS PA" },
        { login: "mobdulia", assignment: "CRETS Problem Solve CRET 2 Odd B (PS) | See PS PA" },
        { login: "hillarsi", assignment: "CRETS Problem Solve CRET 2 Odd A (PS) | See PS PA" },
        { login: "yrosenni", assignment: "CRETS Problem Solve CRET 3 Even A (PS) | See PS PA" },
        { login: "msalcdo", assignment: "CRETS Problem Solve CRET 3 Even B (PS) | See PS PA" },
        { login: "jlatonje", assignment: "CRETS Problem Solve CRET 1 Even B (PS) | See PS PA" },
        { login: "", assignment: "CRET 4 Even (PS)" },
        { login: "spiderlog", assignment: "Water Spider | See PS PA" }
    ]);
    assert.deepEqual(copy(placed.slots["1-even-b"]), ["jlatonje"]);
    assert.deepEqual(copy(placed.slots["1-even-a"]), ["irifelix"]);
    assert.deepEqual(copy(placed.slots["2-odd-b"]), ["mobdulia"]);
    assert.deepEqual(copy(placed.slots["2-odd-a"]), ["hillarsi"]);
    assert.deepEqual(copy(placed.slots["3-even-a"]), ["yrosenni"]);
    assert.deepEqual(copy(placed.slots["3-even-b"]), ["msalcdo"]);
    assert.equal(placed.slots["4-even"], undefined);
    assert.deepEqual(copy(placed.extra), [{ login: "spiderlog", assignment: "Water Spider · See PS PA" }]);
});

test("shift follows the 6:00 day and 18:00 night split", () => {
    assert.equal(board.sheetShift(new Date(2026, 10, 12, 6, 0)), "Days");
    assert.equal(board.sheetShift(new Date(2026, 10, 12, 17, 59)), "Days");
    assert.equal(board.sheetShift(new Date(2026, 10, 12, 18, 0)), "Nights");
    assert.equal(board.sheetShift(new Date(2026, 10, 12, 5, 59)), "Nights");
    assert.equal(board.sheetDate(new Date(2026, 10, 12, 15, 0)), "11/12/2026");
});

test("typing a login plans a Control Tower scan in or out", () => {
    assert.equal(board.normalizeLogin("  AbelRigm "), "abelrigm");
    const intoEmpty = board.scanPlan("1-even-a", [], "abelrigm", "in");
    assert.equal(intoEmpty.ok, true);
    assert.equal(intoEmpty.action, "in");
    assert.equal(intoEmpty.login, "abelrigm");
    assert.equal(intoEmpty.label, "1 Even A");

    const taken = board.scanPlan("1-even-a", ["irifelix"], "abelrigm", "in");
    assert.equal(taken.ok, false);
    assert.equal(taken.code, "occupied");

    const same = board.scanPlan("1-even-b", ["jlatonje"], "jlatonje", "in");
    assert.equal(same.action, "already");

    const out = board.scanPlan("1-even-b", ["jlatonje"], "abelrigm", "out");
    assert.equal(out.ok, false);
    assert.equal(out.code, "missing");

    const remove = board.scanPlan("1-even-b", ["jlatonje"], "", "out");
    assert.equal(remove.ok, true);
    assert.equal(remove.action, "out");
    assert.equal(remove.login, "jlatonje");

    const typedOut = board.scanPlan("2-odd-a", ["hillarsi"], "Hillarsi", "out");
    assert.equal(typedOut.ok, true);
    assert.equal(typedOut.login, "hillarsi");

    assert.equal(board.scanPlan("", [], "abelrigm", "in").code, "station");
    assert.equal(board.scanPlan("blank-1", [], "abelrigm", "in").code, "station");
    assert.equal(board.scanPlan("audit", [], "ab", "in").code, "login");
    assert.equal(board.stationOf({ slots: { "1-even-b": ["jlatonje"], audit: ["abelrigm"] } }, "Abelrigm"), "audit");
});

test("copy debug names the station, the None link, the search, and Assign", () => {
    const text = board.formatDebug({
        version: "1.3.0",
        href: "https://control-tower.meta.amazon.dev/MEM3/assignments",
        selected: "1-odd",
        label: "1 Odd",
        typed: "abelrigm",
        status: "Control Tower did not show Assign for abelrigm.",
        last: { action: "in", login: "abelrigm", ok: false, message: "Control Tower did not show Assign for abelrigm." },
        group: true,
        names: [],
        rows: [{
            login: "",
            none: '<a role="button">None</a>',
            person: "",
            cells: ["CRET 1 Odd (PS)", '<td><a role="button">None</a></td>']
        }],
        searches: [{ id: "search-field-1", placeholder: "Search for login", value: "" }],
        tooltips: [{
            id: "tooltip-852",
            inputs: [{ id: "search-field-853", placeholder: "Search for login, badge, etc...", value: "abelrigm" }],
            buttons: ["Assign"],
            html: '<div id="tooltip-852"><button>Assign</button></div>'
        }]
    });
    assert.match(text, /MEM3 PS Board debug v1\.3\.0/);
    assert.match(text, /station: 1 Odd \(1-odd\)/);
    assert.match(text, /typed: abelrigm/);
    assert.match(text, /<a role="button">None<\/a>/);
    assert.match(text, /search-field-853/);
    assert.match(text, /buttons: Assign/);
    assert.match(text, /page search #search-field-1/);
});
