import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/mem3-assign-roundtrip.txt", import.meta.url), "utf8");
const published = fs.readFileSync(new URL("../docs/downloads/mem3-assign-roundtrip.user.js", import.meta.url), "utf8");
const catalog = JSON.parse(fs.readFileSync(new URL("../docs/data/tampermonkey.json", import.meta.url), "utf8"));

const sandbox = { __ASSIGN_TEST_EXPORT: true, console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox, { filename: "mem3-assign-roundtrip.txt" });
const tool = sandbox.__assignRoundTrip;

function bits(text) {
    return text.split("").map((ch) => ch === "1");
}

test("catalog entry matches the script", () => {
    const entry = catalog.find((item) => item.id === "mem3-assign-roundtrip");
    assert.ok(entry);
    assert.equal(entry.version, "1.2.0");
    assert.equal(entry.category, "Control Tower");
    assert.equal(entry.file, "downloads/mem3-assign-roundtrip.txt");
    assert.equal(entry.downloadName, "Assign Round Trip (abelrigm).txt");
    assert.match(src, /@version\s+1\.2\.0/);
    assert.equal(tool.lineLabel, "CRET Line 1 (O) + Line Support");
    assert.equal(src, published);
    assert.deepEqual(JSON.parse(JSON.stringify(tool.methods)), ["fiber", "fiber-all", "native"]);
    assert.equal(tool.watchMs, 12000);
    assert.match(src, /Search for login/);
    assert.match(src, /function noneAnchor/);
    assert.match(src, /function assignButtonFor/);
    assert.match(src, /data-mem3-ps-hold/);
    assert.equal(src.includes("mem3-floor-summary"), false);
    assert.match(src, /control-tower\.meta\.amazon\.dev\/\*/);
});

test("a flicker does not count as leaving or arriving", () => {
    assert.equal(tool.outcome(bits("111111111111"), "gone"), "stayed");
    assert.equal(tool.outcome(bits("000000000000"), "gone"), "left");
    assert.equal(tool.outcome(bits("111111000000"), "gone"), "left");
    assert.equal(tool.outcome(bits("000000111111"), "gone"), "blinked");
    assert.equal(tool.outcome(bits("111000111111"), "gone"), "blinked");
    assert.equal(tool.outcome(bits("000000111111"), "here"), "arrived");
    assert.equal(tool.outcome(bits("111111111111"), "here"), "assigned");
    assert.equal(tool.outcome(bits("000000000000"), "here"), "missing");
    assert.equal(tool.outcome(bits("111111000000"), "here"), "blinked");
    assert.equal(tool.outcome(bits("1010"), "gone"), "short");
    assert.equal(tool.outcome(bits("101010101010"), "gone"), "blinked");
});

test("the station mark ignores the login cell", () => {
    assert.equal(
        tool.rowMarkFromTexts(["Customer Returns 1st Half: Station 3-62", "abelrigm"], 1),
        "Customer Returns 1st Half: Station 3-62"
    );
    assert.equal(tool.looksLikeLogin("abelrigm"), true);
    assert.equal(tool.looksLikeLogin("3-62"), false);
    assert.equal(tool.isNoneLabel("None"), true);
    assert.equal(tool.isSearchHint("Search for login, badge, etc...", "search-field-845"), true);
    assert.equal(tool.isSearchHint("Find a station", "station-filter"), false);
    assert.equal(tool.sampleText([true, false, true]), "101");
});

test("line 1 odd plus support is the only group this button walks", () => {
    assert.equal(tool.isTargetHeading("CRET Line 1 (O) + Line Support"), true);
    assert.equal(tool.isTargetHeading("CRET Line 1 (O) + Line Support 22.4 UPH avg"), true);
    assert.equal(tool.isTargetHeading("CRET Line 1 (E)"), false);
    assert.equal(tool.isTargetHeading("CRET Line 1 (O)"), false);
    assert.equal(tool.isTargetHeading("CRET Line 2 (O) + Line Support"), false);
    assert.equal(tool.isTargetHeading("BIGS Line + Line Support"), false);
    assert.equal(tool.isOtherLine("CRET Line 1 (E)"), true);
    assert.equal(tool.isOtherLine("Line Support"), false);
    assert.equal(tool.isOtherLine("CRET Line 1 (O) + Line Support"), false);
});

test("the roster table keeps the station and who was on it", () => {
    const who = (anchor, cell) => JSON.parse(JSON.stringify(tool.classifyEmployee(anchor, cell)));
    assert.deepEqual(who("None", "None"), { employee: "None", login: "" });
    assert.deepEqual(who("", "DISABLED"), { employee: "DISABLED", login: "" });
    assert.deepEqual(who("pmakaela", "pmakaela Override"), { employee: "pmakaela", login: "pmakaela" });
    assert.deepEqual(who("", "anyisim Override"), { employee: "anyisim", login: "anyisim" });
    const table = tool.rosterTable("CRET Line 1 (O) + Line Support", [
        { assignment: "Customer Returns 1st Half: Station 1-01 | 2nd Half: Station 1-39", employee: "None" },
        { assignment: "Customer Returns 1st Half: Station 1-03 | 2nd Half: Station 1-37", employee: "DISABLED" },
        { assignment: "Customer Returns 1st Half: Station 1-05 | 2nd Half: Station 1-35", employee: "pmakaela" }
    ]);
    assert.equal(table, [
        "CRET Line 1 (O) + Line Support",
        "Assignment\tEmployee",
        "Customer Returns 1st Half: Station 1-01 | 2nd Half: Station 1-39\tNone",
        "Customer Returns 1st Half: Station 1-03 | 2nd Half: Station 1-37\tDISABLED",
        "Customer Returns 1st Half: Station 1-05 | 2nd Half: Station 1-35\tpmakaela"
    ].join("\n"));
});
