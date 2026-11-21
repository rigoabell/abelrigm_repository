import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const src = fs.readFileSync(new URL("docs/downloads/dropzone-batch.user.js", root), "utf8");
const pasted = fs.readFileSync(new URL("docs/downloads/dropzone-batch.txt", root), "utf8");
const catalog = JSON.parse(fs.readFileSync(new URL("docs/data/tampermonkey.json", root), "utf8"));

assert.equal(src, pasted);
assert.match(src, /@name\s+Dropzone Batch \(abelrigm\)/);
assert.match(src, /@version\s+0\.2\.4/);
assert.match(src, /@updateURL\s+https:\/\/raw\.githubusercontent\.com\/rigoabell\/abelrigm_repository\/main\/docs\/downloads\/dropzone-batch\.user\.js/);
assert.match(src, /@downloadURL\s+https:\/\/raw\.githubusercontent\.com\/rigoabell\/abelrigm_repository\/main\/docs\/downloads\/dropzone-batch\.user\.js/);
assert.match(src, /top:\s*50vh/);
assert.doesNotMatch(src, /id="dz-strategy"|id="dz-suffix"|id="dz-gap"|id="dz-pause"/);
assert.match(src, /SCAN_STRATEGY = 'focus'/);
assert.match(src, /SCAN_SUFFIX = 'Enter'/);
assert.match(src, /SCAN_GAP_MS = 0/);
assert.match(src, /SCAN_PAUSE_MS = 200/);
assert.match(src, /@match\s+https:\/\/aft-moveapp\.na\.aftx\.amazonoperations\.app\/\*/);
assert.match(src, /Copy debug/);
assert.match(src, /id="dz-debug"/);
assert.match(src, /id="dz-skip"/);

const entry = catalog.find((item) => item.id === "dropzone-batch");
assert.ok(entry);
assert.equal(entry.name, "Dropzone Batch (abelrigm)");
assert.equal(entry.category, "AFT");
assert.equal(entry.version, "0.2.4");
assert.equal(entry.file, "downloads/dropzone-batch.txt");
assert.equal(entry.downloadName, "Dropzone Batch (abelrigm).txt");
assert.match(entry.summary, /dropzone/);
assert.match(entry.detail, /bottom half/);
assert.match(entry.runsOn, /aft-moveapp\.na\.aftx\.amazonoperations\.app/);

const patched = src.replace(
  /\n\}\)\(\);\s*$/,
  "\n  globalThis.__dz = { cleanToken, parseContainers, remainingContainers, stableText, newBadPhrase, dropzoneAccepted };\n})();\n"
);

const window = {
  addEventListener() {},
  top: null,
};
window.top = window;
const document = {
  addEventListener() {},
  body: null,
};
const sandbox = { window, document, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(patched, sandbox, { filename: "dropzone-batch.user.js" });

const { cleanToken, parseContainers, remainingContainers, stableText, newBadPhrase, dropzoneAccepted } = sandbox.__dz;

const list = (value) => Array.from(parseContainers(value));

assert.equal(cleanToken('  "csX1"  '), "csX1");
assert.equal(cleanToken("'DZ-01'"), "DZ-01");
assert.deepEqual(list("csX1\ncsX2\r\n\n\"csX3\""), ["csX1", "csX2", "csX3"]);
assert.deepEqual(list("csX1,csX2\tcsX3;csX4"), ["csX1", "csX2", "csX3", "csX4"]);
assert.deepEqual(list(""), []);
const left = (lines, done, skipped, dropzone) => Array.from(remainingContainers(lines, done, skipped, dropzone));
assert.deepEqual(left("csX1\ncsX2\ncsX1\ncsX3", ["csX1"], ["csX3"]), ["csX2"]);
assert.deepEqual(left("csX2", [], []), ["csX2"]);
assert.deepEqual(left("dz-P-CR-EOL\ncsX2\nDZ-P-CR-EOL", [], [], "dz-P-CR-EOL"), ["csX2"]);
assert.deepEqual(
  left("rcCRetStations\nrcCRetStations\n(no parent)\nrcCRetStations", [], ["rcCRetStations"]),
  ["rcCRetStations", "(no parent)", "rcCRetStations"]
);
assert.deepEqual(left("rcCRetStations\nrcCRetStations", [], ["rcCRetStations", "rcCRetStations"]), []);
assert.deepEqual(left("csX1\ncsX1\ncsX2", ["csX1"], []), ["csX2"]);
assert.doesNotMatch(src, /skippedIds\.has\(container\)/);
assert.match(src, /if \(doneIds\.has\(container\)\) continue;/);

assert.equal(stableText("Scan container  12:05:09 PM"), "Scan container #");
assert.equal(stableText("Scan container 12:05 PM"), "Scan container #");
assert.equal(stableText("csX123"), "csX123");

assert.equal(newBadPhrase("Scan container", "Scan container"), "");
assert.equal(newBadPhrase("Scan container", "Container not found"), "not found");
assert.equal(newBadPhrase("error stays on the page", "error stays on the page"), "");
assert.equal(newBadPhrase("error stays on the page", "error stays and Invalid barcode"), "invalid");
assert.equal(
  newBadPhrase(
    "Scan destination container",
    "dz-P-CR-EOLInvalid MoveScanned container can not be moved. Scan valid container."
  ),
  "invalid"
);
assert.equal(
  newBadPhrase("Scan destination container", "Move was unsuccessfulThe move container action failed."),
  "unsuccessful"
);
assert.equal(dropzoneAccepted("tsLIQ945365 movedMove Successful: Scan another container"), true);
assert.equal(dropzoneAccepted("dz-P-CR-EOLInvalid MoveScanned container can not be moved."), false);
assert.equal(
  newBadPhrase(
    "Scan destination container",
    "Try a different containerThis container was already scanned as the container to move."
  ),
  "already scanned"
);
