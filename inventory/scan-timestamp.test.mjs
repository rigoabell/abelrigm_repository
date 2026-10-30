import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/peculiar-line-flush.txt", import.meta.url), "utf8");
const patched = src.replace(
  /\n\}\)\(\);\s*$/,
  "\n  globalThis.__plf = { scanRecord, historyRecord, dashboardSheetRows, recordsFromBook, recordsFromLegacy, mergeRecords, fileRecordsWithScanTimes };\n})();\n"
);

const window = { addEventListener() {}, top: null, self: null };
window.top = window;
window.self = window;
const sandbox = {
  location: { hostname: "example.test", href: "https://example.test/" },
  document: { addEventListener() {}, documentElement: null },
  window,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(patched, sandbox, { filename: "peculiar-line-flush.user.js" });
const api = sandbox.__plf;

const scannedAt = "2026-10-30 11:38:05";
const record = api.scanRecord(
  "csX1234",
  { ok: true, oldestAge: "1d", totalUnits: "2", parentContainer: "p1", containerId: "csX1234" },
  "EOL 1",
  scannedAt
);
assert.equal(record.scannedAt, scannedAt);
assert.equal(record.container, "csX1234");
assert.equal(record.status, "Good");

const sheet = api.dashboardSheetRows([record]);
const header = sheet.find((row) => row[0] === "Location" && row[1] === "Parent" && row[2] === "Container");
assert.deepEqual([...header], ["Location", "Parent", "Container", "Age", "Status", "Units", "Scanned At"]);
const detail = sheet[sheet.length - 1];
assert.equal(detail[2], "csX1234");
assert.equal(detail[6], scannedAt);

const roundTrip = api.recordsFromBook({ sheets: [{ name: "Dashboard", rows: sheet }] });
assert.equal(roundTrip.length, 1);
assert.equal(roundTrip[0].scannedAt, scannedAt);
assert.equal(roundTrip[0].container, "csX1234");

const olderFile = {
  sheets: [
    {
      name: "Dashboard",
      rows: [
        ["Location", "Parent", "Container", "Age", "Status", "Units"],
        ["EOL 1", "p1", "csX1234", "1d", "Good", "2"],
      ],
    },
  ],
};
assert.equal(api.recordsFromBook(olderFile)[0].scannedAt, "");

const legacy = {
  sheets: [
    {
      name: "EOL 1",
      rows: [
        [
          "Container ID",
          "Scanned At",
          "Scanner",
          "Container Type",
          "Total Units",
          "Oldest Units Age",
          "Parent Container",
          "Parent Type",
          "Grandparent Container",
          "Line Age",
          "FcSku",
          "Quantity",
          "Owner",
          "Disposition",
          "Status",
          "Notes",
        ],
        ["csX1234", "2026-10-30 08:15:01", "abelrigm", "TOTE", "2", "1d", "p1", "TOTE", "", "1d", "B1", "2", "INV", "SELLABLE", "OK", ""],
      ],
    },
  ],
};
const fromLegacy = api.recordsFromBook(legacy);
assert.equal(fromLegacy[0].scannedAt, "2026-10-30 08:15:01");
assert.equal(fromLegacy[0].location, "EOL 1");

const remembered = api.historyRecord({
  t: "2026-10-30 08:00:00",
  record: { container: "csX1234", location: "EOL 1", parent: "p1", age: "1d", status: "Good", units: "2" },
});
assert.equal(remembered.scannedAt, "2026-10-30 08:00:00");

const body = { location: "EOL 1", parent: "p1", container: "csX1234", age: "1d", status: "Good", units: "2", scannedAt: "" };
const other = { ...body, container: "csX5678" };
const file = [{ ...body }, { ...other }];
const older = { ...body, scannedAt: "2026-10-30 08:00:00" };
const otherScan = { ...other, scannedAt: "2026-10-30 08:05:00" };
const pending = { ...body, scannedAt: "2026-10-30 08:10:00" };
const merged = api.mergeRecords(file, [older, otherScan, pending]);
assert.equal(merged.length, 3);
assert.equal(merged[0].scannedAt, "2026-10-30 08:00:00");
assert.equal(merged[1].scannedAt, "2026-10-30 08:05:00");
assert.equal(merged[2].scannedAt, "2026-10-30 08:10:00");

const filled = api.fileRecordsWithScanTimes(file, [older, otherScan, pending], pending);
assert.equal(filled.length, 2);
assert.equal(filled[0].scannedAt, "2026-10-30 08:00:00");
assert.equal(filled[1].scannedAt, "2026-10-30 08:05:00");

const untouched = api.fileRecordsWithScanTimes([{ ...body }], [pending], pending);
assert.equal(untouched.length, 1);
assert.equal(untouched[0].scannedAt, "");

console.log("scan timestamp tests passed");
