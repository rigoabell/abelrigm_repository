import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/mem3-station-roster.txt", import.meta.url), "utf8");
const published = fs.readFileSync(new URL("../docs/downloads/mem3-station-roster.user.js", import.meta.url), "utf8");
const catalog = JSON.parse(fs.readFileSync(new URL("../docs/data/tampermonkey.json", import.meta.url), "utf8"));

const sandbox = { __STATION_ROSTER_EXPORT: true, console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox, { filename: "mem3-station-roster.txt" });
const roster = sandbox.__stationRoster;

test("catalog entry matches the script", () => {
    assert.equal(published, src);
    const entry = catalog.find((item) => item.id === "mem3-station-roster");
    assert.ok(entry);
    assert.equal(entry.version, "1.0.0");
    assert.equal(entry.category, "Control Tower");
    assert.equal(entry.file, "downloads/mem3-station-roster.txt");
    assert.equal(roster.version, "1.0.0");
    assert.match(src, /@version\s+1\.0\.0/);
    assert.match(src, /mem3-station-roster\.user\.js/);
    assert.equal(src.includes("heading.appendChild"), false);
    assert.equal(src.includes("@grant"), false);
});

test("each station is a login, empty, or disabled", () => {
    assert.equal(roster.employeeValue("None"), "empty");
    assert.equal(roster.employeeValue(""), "empty");
    assert.equal(roster.employeeValue("DISABLED"), "disabled");
    assert.equal(roster.employeeValue("disabled"), "disabled");
    assert.equal(roster.employeeValue("wilrayni"), "wilrayni");
    assert.equal(roster.employeeValue("Wilrayni"), "wilrayni");
    assert.equal(roster.employeeValue("wilrayni abelrigm"), "wilrayni; abelrigm");
    assert.equal(roster.employeeValue("Station is disabled"), "disabled");
});

test("the station name drops the department line and the side note", () => {
    assert.equal(
        roster.stationLabel("CRETS Problem Solve\nCRET 2 Even (PS) | See PS PA", "CRET Problem Solve"),
        "CRET 2 Even (PS)"
    );
    assert.equal(roster.stationLabel("CRET 4 Even (PS)", "CRET Problem Solve"), "CRET 4 Even (PS)");
    assert.equal(
        roster.stationLabel("Customer Returns\n1st Half: Station 3-06 | 2nd Half: Station 3-70", "Customer Returns"),
        "1st Half: Station 3-06 | 2nd Half: Station 3-70"
    );
});

test("the export lists every station and marks disabled stations", () => {
    const rows = JSON.parse(JSON.stringify(roster.buildRoster([
        {
            department: "CRETS Indirects",
            group: "CRET Problem Solve",
            assignment: "CRETS Problem Solve\nCRET 2 Even (PS) | See PS PA",
            employee: "wilrayni"
        },
        {
            department: "CRETS Indirects",
            group: "CRET Problem Solve",
            assignment: "CRET 4 Even (PS)",
            employee: "DISABLED"
        },
        {
            department: "",
            group: "CRET Line 1 (E)",
            assignment: "Station 1-02",
            employee: "None"
        }
    ])));
    assert.deepEqual(rows, [
        { department: "CRETS Indirects", group: "CRET Problem Solve", station: "CRET 2 Even (PS)", value: "wilrayni" },
        { department: "CRETS Indirects", group: "CRET Problem Solve", station: "CRET 4 Even (PS)", value: "disabled" },
        { department: "CRET Line 1 (E)", group: "CRET Line 1 (E)", station: "Station 1-02", value: "empty" }
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(roster.countValues(rows))), { empty: 1, disabled: 1 });
    const csv = roster.toCsv(rows);
    assert.match(csv, /^department,group,station,value\n/);
    assert.match(csv, /CRETS Indirects,CRET Problem Solve,CRET 4 Even \(PS\),disabled/);
    assert.match(csv, /CRET Line 1 \(E\),CRET Line 1 \(E\),Station 1-02,empty/);
    assert.match(roster.toCsv([{ department: "A, B", group: "G", station: 'Say "hi"', value: "empty" }]), /"A, B",G,"Say ""hi""",empty/);
});
