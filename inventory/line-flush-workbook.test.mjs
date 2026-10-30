import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../docs/downloads/peculiar-line-flush.txt", import.meta.url), "utf8");
const start = src.indexOf("// BEGIN workbook");
const end = src.indexOf("// END workbook");
assert.ok(start !== -1 && end > start, "workbook block missing");
const api = new Function(
  src.slice(start, end) +
    "\nreturn { workbookSheets, alignRows, buildXlsx, readXlsxSheets };"
)();

const headers = [
  "Timestamp",
  "Location",
  "Container ID",
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
];

const rows = [
  headers,
  ["2026-10-30 08:15:01", "EOL 1", "cs1", "abelrigm", "TOTE", "2", "3d", "", "", "", "3d", "B0001", "2", "INV", "SELLABLE", "OK", ""],
  ["2026-10-30 08:16:02", "L3 Even", "cs2", "abelrigm", "TOTE", "1", "1d", "", "", "", "1d", 'B00"2', "1", "INV", "SELLABLE", "OK", "say <hi>"],
  ["2026-10-30 08:17:03", "EOL 1", "cs3", "abelrigm", "TOTE", "4", "9d", "", "", "", "9d", "B0003", "4", "INV", "SELLABLE", "OK", ""],
  ["2026-10-30 08:18:04", "Unassigned", "cs4", "abelrigm", "", "", "", "", "", "", "", "", "", "", "", "NOT FOUND", "Lookup failed"],
];

const sheets = api.workbookSheets(rows);
assert.deepEqual(
  sheets.map((sheet) => sheet.name),
  ["Total", "EOL 1", "L3 Even", "Unassigned"]
);
assert.equal(sheets[0].rows.length, 5);
assert.equal(sheets.find((sheet) => sheet.name === "EOL 1").rows.length, 3);
assert.ok(sheets.find((sheet) => sheet.name === "EOL 1").rows.every((row, index) => index === 0 || row[1] === "EOL 1"));
assert.equal(sheets.find((sheet) => sheet.name === "L3 Even").rows.length, 2);
assert.equal(sheets.find((sheet) => sheet.name === "L3 Even").rows[1][0], "2026-10-30 08:16:02");

const bytes = api.buildXlsx(sheets);
const read = api.readXlsxSheets(bytes);
assert.deepEqual(
  read.map((sheet) => sheet.name),
  ["Total", "EOL 1", "L3 Even", "Unassigned"]
);
const total = read.find((sheet) => sheet.name === "Total");
assert.deepEqual(total.rows[0], headers);
assert.equal(total.rows.length, 5);
assert.equal(total.rows[2][1], "L3 Even");
assert.equal(total.rows[2][11], 'B00"2');
assert.equal(total.rows[2][16], "say <hi>");
const eol = read.find((sheet) => sheet.name === "EOL 1");
assert.deepEqual(
  eol.rows.slice(1).map((row) => row[2]),
  ["cs1", "cs3"]
);
assert.ok(eol.rows.slice(1).every((row) => row[1] === "EOL 1"));
assert.ok(read.find((sheet) => sheet.name === "L3 Even").rows.slice(1).every((row) => row[1] === "L3 Even"));

const legacy = [
  ["Container ID", "Scanned At", "Scanner", "Status", "Notes"],
  ["cs9", "2026-10-29 18:00:00", "abelrigm", "OK", "older file"],
];
const aligned = api.alignRows(legacy, headers);
assert.deepEqual(aligned[0], headers);
assert.equal(aligned[1][0], "2026-10-29 18:00:00");
assert.equal(aligned[1][1], "Unassigned");
assert.equal(aligned[1][2], "cs9");
assert.equal(aligned[1][3], "abelrigm");
assert.equal(aligned[1][15], "OK");
assert.equal(aligned[1][16], "older file");

console.log("line flush workbook tests passed");
