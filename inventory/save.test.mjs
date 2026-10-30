import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PART_BYTES,
  MAX_BYTES,
  buildTreeEntries,
  bytesToBase64,
  partSlices,
  planParts,
  refUpdateFailure,
  safeFileName,
} from "../docs/inventory/github-save.js";

assert.deepEqual(planParts(0), ["latest.csv"]);
assert.deepEqual(planParts(PART_BYTES), ["latest.csv"]);
assert.deepEqual(planParts(PART_BYTES + 1), ["part-000", "part-001"]);
assert.deepEqual(planParts(MAX_BYTES), ["part-000", "part-001", "part-002"]);
assert.throws(() => planParts(MAX_BYTES + 1), /90 MB/);

const slices = partSlices(PART_BYTES + 10);
assert.deepEqual(slices, [
  { name: "part-000", start: 0, end: PART_BYTES },
  { name: "part-001", start: PART_BYTES, end: PART_BYTES + 10 },
]);
assert.equal(slices[0].end, slices[1].start);

assert.equal(bytesToBase64(new TextEncoder().encode("hello")), btoa("hello"));
const big = new Uint8Array(100000);
for (let i = 0; i < big.length; i++) big[i] = i & 255;
assert.equal(bytesToBase64(big), Buffer.from(big).toString("base64"));

assert.equal(safeFileName("C:\\Users\\x\\report.csv"), "report.csv");
assert.equal(safeFileName("folder/a.csv"), "a.csv");
assert.equal(safeFileName(""), "inventory.csv");

const tree = buildTreeEntries(
  ["part-000", "part-001"],
  ["aaa", "bbb"],
  "mmm",
  ["latest.csv", "part-000", "notes.txt"]
);
assert.deepEqual(
  tree.map((entry) => [entry.path, entry.sha]),
  [
    ["docs/inventory/data/part-000", "aaa"],
    ["docs/inventory/data/part-001", "bbb"],
    ["docs/inventory/data/manifest.json", "mmm"],
    ["docs/inventory/data/latest.csv", null],
  ]
);

assert.equal(refUpdateFailure(401, "Bad credentials"), "token");
assert.equal(refUpdateFailure(422, "Update is not a fast forward"), "retry-forward");
assert.equal(refUpdateFailure(422, "Required status checks are expected."), "branch");
assert.equal(refUpdateFailure(403, "Cannot update this protected ref."), "branch");
assert.equal(refUpdateFailure(500, "oops"), "error");

const manifest = JSON.parse(fs.readFileSync(new URL("../docs/inventory/data/manifest.json", import.meta.url), "utf8"));
const saved = fs.statSync(new URL("../docs/inventory/data/" + manifest.parts[0], import.meta.url));
assert.equal(manifest.fileName, "Current_Inventory_De_1793288358912.csv");
assert.deepEqual(manifest.parts, ["latest.csv"]);
assert.equal(saved.size, manifest.bytes);
assert.equal(saved.size, 25340258);

console.log("save tests passed");
