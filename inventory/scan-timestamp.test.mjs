import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../docs/downloads/peculiar-line-flush.txt", import.meta.url), "utf8");
const patched = src.replace(
  /\n\}\)\(\);\s*$/,
  "\n  globalThis.__plf = { scanRecord, historyRecord, dashboardSheetRows, dashboardBook, recordsFromBook, recordsFromLegacy, mergeRecords, fileRecordsWithScanTimes, workbookBytes, workbookFromXlsx, eolWorkbook, shiftKey, parseDetailsText, outerLocationLabel, priorOuterLabel, fileDate, mergeShiftRecords, backgroundDropzone, scanBurstKeys, moveBadPhrase, moveScanAccepted, moveDropAccepted, moveBatchContainerAccepted, moveCheckDue, moveTabStillOpen, halfHourSlot, moveCheckDone, markMoveCheck, continueSessionPrompt, continueSessionYes, continueSessionTarget, moveIsScanPage, movePageReady, moveWorkflowScore, moveWorkflowPick, stationsDropPrompt, normalizeSavedDropzones, dropzoneDebugView };\n})();\n"
);

const window = { addEventListener() {}, top: null, self: null };
window.top = window;
window.self = window;
const sandbox = {
  location: { hostname: "example.test", href: "https://example.test/" },
  document: { addEventListener() {}, documentElement: null },
  window,
  TextEncoder,
  TextDecoder,
  Blob,
  CompressionStream,
  DecompressionStream,
  Response,
  Uint8Array,
  DataView,
  URL,
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

const bands = [
  ["0d", "Good"],
  ["2d", "Good"],
  ["2d 23h", "Good"],
  ["3d", "Caution"],
  ["4d", "Caution"],
  ["4d 23h", "Caution"],
  ["5d", "Alert"],
  ["5d 1h", "Alert"],
  ["12d", "Alert"],
];
for (const [age, status] of bands) {
  const banded = api.scanRecord(
    "csX1",
    { ok: true, oldestAge: age, totalUnits: "1", parentContainer: "p", containerId: "csX1" },
    "EOL 1",
    scannedAt
  );
  assert.equal(banded.status, status, age);
}

const marked = api.scanRecord(
  "csX&1",
  { ok: true, oldestAge: "3d", totalUnits: "4", parentContainer: 'p&"1', containerId: "csX&1" },
  "EOL 1",
  scannedAt
);
const markedBook = await api.workbookFromXlsx(await api.workbookBytes(api.dashboardBook([marked])));
const markedBack = api.recordsFromBook(markedBook);
assert.equal(markedBack.length, 1);
assert.equal(markedBack[0].container, "csX&1");
assert.equal(markedBack[0].parent, 'p&"1');
assert.equal(markedBack[0].status, "Caution");
assert.equal(markedBack[0].age, "3d");

const sheet = api.dashboardSheetRows([record]);
const header = sheet.find((row) => row[0] === "Location" && row[1] === "Parent" && row[2] === "Container");
assert.deepEqual([...header], ["Location", "Parent", "Container", "Age", "Status", "Units", "Scanned At", "Dropped"]);
const detail = sheet[sheet.length - 1];
assert.equal(detail[2], "csX1234");
assert.equal(detail[6], scannedAt);
assert.equal(detail[7], "");

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

const eol = { ...body, scannedAt: "2026-10-30 09:00:00" };
const eolLater = { ...body, container: "csX9999", scannedAt: "2026-10-30 09:05:00" };
const line = { ...body, location: "L3 Even", container: "csX5678", scannedAt: "2026-10-30 09:10:00" };
const book = api.dashboardBook([eol, line, eolLater]);
assert.deepEqual(
  [...book.sheets.map((sheet) => sheet.name)],
  ["Dashboard", "EOL 1", "L3 Even"]
);
const eolSheet = book.sheets.find((sheet) => sheet.name === "EOL 1");
assert.deepEqual(
  [...eolSheet.rows.slice(1).map((row) => row[2])],
  ["csX1234", "csX9999"]
);
assert.ok(eolSheet.rows.slice(1).every((row) => row[0] === "EOL 1" && row[6]));
const lineSheet = book.sheets.find((sheet) => sheet.name === "L3 Even");
assert.deepEqual(
  [...lineSheet.rows.slice(1).map((row) => row[2])],
  ["csX5678"]
);
const loaded = api.recordsFromBook(book);
assert.equal(loaded.length, 3);
assert.deepEqual(
  [...loaded.map((rec) => rec.container)],
  ["csX1234", "csX5678", "csX9999"]
);

const locationOnly = api.recordsFromBook({ sheets: book.sheets.filter((sheet) => sheet.name !== "Dashboard") });
assert.equal(locationOnly.length, 3);

assert.match(src, /OUTER LOCATION/);
assert.equal(src.includes('id="dashboard"'), false);
assert.equal(src.includes("function dashboardHtml"), false);
assert.match(src, /@version\s+2\.10\.15/);
assert.equal(api.continueSessionPrompt("Do you want to continue your Lead/PA - QA session while using this app?"), true);
assert.equal(api.continueSessionPrompt("Do you want to continue your Outbound session while using this app?"), true);
assert.equal(api.continueSessionPrompt("What are you working on today at MEM3?"), false);
assert.equal(api.continueSessionYes([
  { text: "No", href: "/end/MEM3/entry/200" },
  { text: "Yes", href: "/continue/MEM3/entry/200" },
]).href, "/continue/MEM3/entry/200");
assert.equal(api.continueSessionYes([{ text: "Yes", href: "/somewhere-else" }]), null);
assert.equal(
  api.continueSessionTarget("/continue/MEM3/entry/200", "https://menu.na.aft.amazonoperations.app/confirmSessionKill/job/1029099/MEM3/entry/200"),
  "https://menu.na.aft.amazonoperations.app/continue/MEM3/entry/200"
);
assert.equal(api.continueSessionTarget("/end/MEM3/entry/200", "https://menu.na.aft.amazonoperations.app/"), "");
assert.match(src, /confirmSessionKill/);
assert.match(src, /location\.assign\(next\)/);
assert.match(src, /continue-session/);
assert.match(src, /placeholder="Scan Container - Do Not Type Here"/);
assert.equal(api.moveTabStillOpen(1_000, 0, 5_000, 12_000), true);
assert.equal(api.moveTabStillOpen(1_000, 1_000, 5_000, 12_000), false);
assert.equal(api.moveTabStillOpen(1_000, 0, 13_000, 12_000), false);
assert.match(src, /plf\.moveTabHidden/);
assert.match(src, /step: "check-click"/);
assert.equal(src.includes('id="dropOpen"'), false);
const tenFourteen = new Date(2026, 10, 21, 10, 14, 0).getTime();
const tenThirty = new Date(2026, 10, 21, 10, 30, 0).getTime();
assert.equal(api.halfHourSlot(tenFourteen), "2026-11-21T10:00");
assert.equal(api.halfHourSlot(tenThirty), "2026-11-21T10:30");
assert.equal(api.halfHourSlot(new Date(2026, 10, 21, 0, 0, 0).getTime()), "2026-11-21T00:00");
assert.equal(api.halfHourSlot(new Date(2026, 10, 21, 23, 59, 0).getTime()), "2026-11-21T23:30");
assert.equal(api.moveCheckDone({}, tenFourteen), false);
assert.equal(api.moveCheckDone({ "2026-11-21T10:00": 1 }, tenFourteen), true);
assert.equal(api.moveCheckDone({ "2026-11-21T10:00": 1 }, tenThirty), false);
const checkedSlots = api.markMoveCheck({ "2026-11-20T10:00": 5, "2026-11-21T09:30": 6 }, "2026-11-21T10:00", tenFourteen);
assert.equal(checkedSlots["2026-11-21T10:00"], tenFourteen);
assert.equal(checkedSlots["2026-11-21T09:30"], 6);
assert.equal(checkedSlots["2026-11-20T10:00"], undefined);
assert.match(src, /plf\.checkSlot/);
assert.match(src, /@grant\s+window\.close/);
assert.match(src, /span\.success-step-value/);
assert.match(src, /\}, 6000\);/);
assert.match(src, /getElementById\("qlInput"\)/);
assert.match(src, /function typeMenuCode/);
assert.match(src, /plf\.menuShot/);
assert.match(src, /menu-field/);
assert.match(src, /https:\/\/menu\.na\.aft\.amazonoperations\.app\/MEM3/);
assert.match(src, /menu-entry-text-2/);
assert.match(src, /"1", "4", "7"/);
assert.match(src, /Container was not scanned/);
assert.match(src, /function blockFcMenuOpen/);
assert.match(src, /function moveDropAccepted/);
assert.match(src, /class="idcell"/);
assert.equal(src.includes('id="dzAdd"'), false);
assert.equal(api.priorOuterLabel("dz-P-CR-EOL", "rcCRetStations"), "rcCRetStations");
assert.equal(api.priorOuterLabel("rcCRetStations [RECEIVE_LANE]", ""), "rcCRetStations");
assert.match(src, /#dz-batch-panel\{display:none !important;\}/);
assert.match(src, /dz-batch-panel/);
assert.match(src, /move-container\?jobId=200/);
assert.equal(src.includes("jobId=400"), false);
assert.match(src, /@include\s+\/\^https:\\\/\\\/fcmenu-\[a-z0-9-\]\+\\\.corp\\\.amazon\\\.com/);
assert.match(src, /@match\s+https:\/\/fcmenu-iad-regionalized\.corp\.amazon\.com\/\*/);
assert.match(src, /function movePageFocus/);
assert.equal(api.backgroundDropzone(false, "dzA", "ts1"), null);
assert.equal(api.backgroundDropzone(true, "", "ts1"), null);
const zoneJob = api.backgroundDropzone(true, " dzA ", " ts1 ");
assert.deepEqual({ container: zoneJob.container, dropzone: zoneJob.dropzone }, { container: "ts1", dropzone: "dzA" });
assert.equal(api.stationsDropPrompt(false, "rcCRetStations", "ts1"), null);
assert.equal(api.stationsDropPrompt(true, "rcCRetLane2", "ts1"), null);
const stationOffer = api.stationsDropPrompt(true, "rcCRetStations [RECEIVE_LANE]", " ts1 ");
assert.deepEqual(
  { container: stationOffer.container, dropzone: stationOffer.dropzone },
  { container: "ts1", dropzone: "dz-P-CR-EOL" }
);
assert.deepEqual([...api.normalizeSavedDropzones(null)], ["dz-P-CR-EOL"]);
assert.deepEqual([...api.normalizeSavedDropzones([" dz-P-CR-EOL ", "dz-P-CR-EOL", "dz-other"])], ["dz-P-CR-EOL", "dz-other"]);
const dropView = api.dropzoneDebugView({
  ask: true,
  saved: ["dz-P-CR-EOL"],
  trace: { events: [{ t: "2026-11-20 11:21:39", container: "tsAUD184397", outer: "rcCRetStations", step: "asked" }] },
  queue: { n: 1, jobs: [{ n: 1, container: "tsAUD184397", dropzone: "dz-P-CR-EOL" }] },
  cursor: 1,
  status: { container: "tsAUD184397", dropzone: "dz-P-CR-EOL", ok: false, error: "Page did not take the container", t: 5 },
  heartbeat: 1000,
  now: 20000,
});
assert.equal(dropView.ask, true);
assert.deepEqual([...dropView.saved], ["dz-P-CR-EOL"]);
assert.equal(dropView.events[0].step, "asked");
assert.equal(dropView.pending.length, 0);
assert.equal(dropView.status.ok, false);
assert.equal(dropView.status.error, "Page did not take the container");
assert.equal(dropView.moveOpen, false);
assert.equal(api.moveIsScanPage("https://aft-moveapp.na.aftx.amazonoperations.app/", "HTTP Status 404 – Not Found"), false);
assert.equal(api.moveIsScanPage("https://aft-moveapp.na.aftx.amazonoperations.app/move-container", "AFT Move Between Pallets"), false);
assert.equal(api.moveIsScanPage("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=400", "AFT Move Between Pallets"), true);
assert.equal(api.movePageReady("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=400", "AFT Move Between Pallets", "Scan source pallet", "complete"), true);
assert.equal(api.movePageReady("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=200", "AFT Move Individual Container", "Scan container to move", "complete"), true);
assert.equal(api.movePageReady("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=200", "AFT Move Individual Container", "abelrigm MenumScan container to move", "interactive"), true);
assert.equal(api.movePageReady("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=12", "Move container", "Scan source container", "complete"), true);
assert.equal(api.movePageReady("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=12", "Move container", "Waiting for scan", "complete"), true);
assert.equal(api.movePageReady("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=400", "AFT Move Between Pallets", "Scan source pallet Waiting for scan", "complete"), true);
assert.equal(api.movePageReady("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=12", "Move container", "Scan destination container", "complete"), false);
assert.equal(api.movePageReady("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=12", "Move container", "Scan source container Scan destination container", "complete"), true);
assert.equal(api.moveWorkflowScore("Move Between Pallets"), -1);
assert.equal(api.moveWorkflowScore("Dropzone"), 5);
assert.equal(api.moveWorkflowScore("Move Between Containers"), 3);
assert.equal(api.moveWorkflowScore("Dropzone waiting for the scan screen"), -1);
assert.equal(api.moveWorkflowPick(["Dropzone waiting for the scan screen", "Select workflow", "Menu"]), "");
assert.equal(api.moveWorkflowPick(["Move Between Pallets", "Dropzone"]), "Dropzone");
assert.equal(api.moveWorkflowPick(["Move Between Pallets", "Move Between Containers"]), "Move Between Containers");
assert.equal(api.moveWorkflowPick(["Menu", "Sign out", "Only One Workflow"]), "Only One Workflow");
assert.equal(api.moveWorkflowPick(["Alpha Move", "Beta Move"]), "");
assert.equal(api.movePageReady("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=400", "AFT Move Between Pallets", "Scan source pallet", "loading"), false);
assert.equal(api.movePageReady("https://aft-moveapp.na.aftx.amazonoperations.app/move-container?jobId=400", "AFT Move Between Pallets", "Scan source pallet Scan was unsuccessful", "complete"), false);
assert.equal(api.moveIsScanPage("https://aft-moveapp.na.aftx.amazonoperations.app/move-container", "HTTP Status 404 – Not Found"), false);
const landing = api.dropzoneDebugView({
  target: "https://aft-moveapp.na.aftx.amazonoperations.app/move-container",
  tried: { href: "https://aft-moveapp.na.aftx.amazonoperations.app/move-container" },
  landed: { href: "https://aft-moveapp.na.aftx.amazonoperations.app/", title: "HTTP Status 404 – Not Found" },
});
assert.equal(landing.tried, "https://aft-moveapp.na.aftx.amazonoperations.app/move-container");
assert.equal(landing.landed, "https://aft-moveapp.na.aftx.amazonoperations.app/");
assert.equal(landing.landedTitle, "HTTP Status 404 – Not Found");
assert.match(src, /dropzone: dropzoneDebugView/);
assert.deepEqual([...api.scanBurstKeys("ab1")], ["a", "b", "1", "Enter"]);
assert.equal(api.moveBadPhrase("ready", "Invalid container"), "invalid");
assert.equal(api.moveScanAccepted("ready", "clock 1:02 PM updated", "tsTEK940449").ok, false);
assert.equal(api.moveScanAccepted("ready", "Scanned tsTEK940449", "tsTEK940449").ok, true);
assert.equal(api.moveScanAccepted("already tsTEK940449", "already tsTEK940449 clock", "tsTEK940449").ok, false);
assert.equal(api.moveScanAccepted("ready", "tsTEK940449 invalid container", "tsTEK940449").ok, false);
assert.equal(api.moveScanAccepted("ready", "dz-P-CR-EOL The container scanned was not of appropriate type. Scan a pallet.", "dz-P-CR-EOL").ok, false);
const moved = "abelrigm MenumScan container to movetsAUD145501 movedMove Successful: Scan another container";
assert.equal(api.moveScanAccepted("Scan container to move tsAUD145501", moved, "dz-P-CR-EOL").ok, false);
assert.equal(api.moveDropAccepted("Scan container to move tsAUD145501", moved, "dz-P-CR-EOL", "tsAUD145501").ok, true);
assert.equal(api.moveDropAccepted(moved, moved + " 2:22 PM", "dz-P-CR-EOL", "tsAUD145501").ok, false);
assert.equal(api.moveDropAccepted("Scan container to move tsAUD145501", moved + " https://fcmenu-iad-regionalized.corp.amazon.com/", "dz-P-CR-EOL", "tsAUD145501").ok, false);
assert.equal(api.moveDropAccepted("Scan container to move", "milesele MenumContainertsX0mx1jvvmdz-P-CR-EOL", "dz-P-CR-EOL", "tsX0mx1jvvm").ok, false);
assert.equal(api.moveDropAccepted("Scan container to move", "Move Successful: Scan another container", "dz-P-CR-EOL", "tsX0mx1jvvm").ok, true);
assert.equal(api.moveBatchContainerAccepted("Scan container to move", "Scan container to move tsX0mx1jvvm").ok, true);
assert.equal(api.moveBatchContainerAccepted("Scan container to move", "Scan container to move").ok, false);
assert.equal(api.moveBatchContainerAccepted("ready", "ready invalid container").ok, false);
assert.equal(api.moveCheckDue(0, 60 * 60 * 1000), true);
assert.equal(api.moveCheckDue(1_000, 1_000 + 59 * 60 * 1000), false);
assert.equal(api.moveCheckDue(1_000, 1_000 + 60 * 60 * 1000), true);
assert.match(src, /There cannot be another tab open with the move tool/);
assert.match(src, /id="dzCheckBtn"/);
assert.match(src, /id="moveCheck"/);
assert.match(src, /\.move-check \{[^}]*background: #ffe14a/);
assert.match(src, /#dzCheckBtn \{[^}]*background: #ffe14a/);
assert.match(src, /The drop did not finish/);
assert.match(src, /aft-moveapp\.na\.aftx\.amazonoperations\.app/);
assert.match(src, /id="dzAsk"/);
assert.equal(api.fileDate("2026-11-07 22:00:00"), "2026-11-07");
assert.equal(api.fileDate("2026-11-08 00:01:00"), "2026-11-07");
assert.equal(api.fileDate("2026-11-08 05:59:00"), "2026-11-07");
assert.equal(api.fileDate("2026-11-08 06:00:00"), "2026-11-08");
const nightScan = {
  location: "EOL 1",
  parent: "rcCRetStations",
  container: "tsNight",
  age: "1d",
  status: "Good",
  units: "1",
  scannedAt: "2026-11-07 22:00:00",
};
const afterMidnight = { ...nightScan, container: "tsAfter", scannedAt: "2026-11-08 00:01:00" };
const mergedNight = api.mergeShiftRecords(
  [nightScan, afterMidnight],
  [nightScan, afterMidnight],
  "2026-11-08",
  "Night",
  "2026-11-07"
);
assert.deepEqual(
  [...mergedNight.map((rec) => rec.container)],
  ["tsNight", "tsAfter"]
);
assert.match(src, /\.x \{[^}]*background: #b42318/);

const bulk = [];
for (let i = 0; i < 3000; i++) {
  const location = i % 2 === 0 ? "L3 Even" : "EOS Assignment";
  bulk.push({
    location,
    parent: "rcCRetStations",
    container: `tsWHD${String(i).padStart(8, "0")}`,
    age: "1d 2h 3m",
    status: i % 5 === 0 ? "Alert" : "Good",
    units: "2",
    scannedAt: `2026-10-30 17:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`,
  });
}
const packed = await api.workbookBytes(api.dashboardBook(bulk));
assert.ok(packed.length < 400000, `packed ${packed.length} is still near the old 3 MB workbook`);
const reread = api.recordsFromBook(await api.workbookFromXlsx(packed));
assert.equal(reread.length, 3000);
assert.equal(reread[0].container, "tsWHD00000000");
assert.equal(reread[0].scannedAt, "2026-10-30 17:00:00");
assert.equal(reread[2999].location, "EOS Assignment");
assert.equal(reread[1].status, "Good");
assert.equal(reread[5].status, "Alert");

function eolRec(location, parent, container, units, scannedAt) {
  return { location, parent, container, age: "1d", status: "Good", units, scannedAt };
}
function shiftOf(scannedAt) {
  const key = api.shiftKey(scannedAt);
  return { shift: key.shift, date: key.date };
}
assert.deepEqual(shiftOf("2026-11-07 08:00:00"), { shift: "Day", date: "2026-11-07" });
assert.deepEqual(shiftOf("2026-11-07 17:59:00"), { shift: "Day", date: "2026-11-07" });
assert.deepEqual(shiftOf("2026-11-07 18:00:00"), { shift: "Night", date: "2026-11-07" });
assert.deepEqual(shiftOf("2026-11-07 22:00:00"), { shift: "Night", date: "2026-11-07" });
assert.deepEqual(shiftOf("2026-11-08 04:00:00"), { shift: "Night", date: "2026-11-07" });
assert.deepEqual(shiftOf("2026-11-08 05:59:00"), { shift: "Night", date: "2026-11-07" });
assert.deepEqual(shiftOf("2026-11-08 06:00:00"), { shift: "Day", date: "2026-11-08" });
assert.deepEqual(shiftOf("2026-01-01 04:00:00"), { shift: "Night", date: "2025-12-31" });

const people = [
  {
    alias: "milesele",
    records: [
      eolRec("EOL 1", "rcCRetStations", "tsA", "4", "2026-11-05 11:14:04"),
      eolRec("EOL 1", "rcCRetLane2", "tsB", "1", "2026-11-05 12:30:00"),
      eolRec("L3 Even", "rcCRetStations", "tsLine", "9", "2026-11-05 11:00:00"),
      eolRec("EOL 1", "rcCRetStations", "tsNight", "5", "2026-11-05 22:10:00"),
    ],
  },
  {
    alias: "jkiearr",
    records: [
      eolRec("EOL 1", "rcCRetStations", "tsC", "2", "2026-11-05 09:00:00"),
      eolRec("EOL 2", "rcCRetStations", "tsD", "6", "2026-11-05 13:05:00"),
      eolRec("AR EOL", "rcCRetStations", "tsE", "3", "2026-11-05 12:29:59"),
      eolRec("EOL 3", "rcCRetStations", "tsEarly", "2", "2026-11-06 04:15:00"),
    ],
  },
];
const eolBook = api.eolWorkbook(people, "Day");
assert.equal(eolBook.sheets[0].name, "Summary");
assert.deepEqual([...eolBook.sheets.map((sheet) => sheet.name)], ["Summary", "jkiearr", "milesele"]);
const summary = eolBook.sheets[0];
assert.equal(summary.rows[0][0], "All Day  ·  6:00 AM–5:59 PM");
assert.equal(summary.rows[0][6], "1st Half  ·  6:00 AM–12:29 PM");
assert.equal(summary.kinds[0][0], "title");
assert.equal(summary.kinds[0][6], "title");
assert.ok(summary.merges.includes("A1:E1"));
assert.ok(summary.merges.includes("G1:K1"));
assert.deepEqual([...summary.rows[1].slice(0, 5)], ["EOL", "Dropzone", "Containers", "Units", "Percent"]);

function windowRows(sheet, title) {
  let col = -1;
  let row = -1;
  for (let r = 0; r < sheet.rows.length && col < 0; r++) {
    const line = sheet.rows[r] || [];
    for (let c = 0; c < line.length; c++) {
      if (line[c] === title) {
        col = c;
        row = r;
        break;
      }
    }
  }
  assert.ok(col >= 0, title);
  const out = [];
  for (let r = row + 2; r < sheet.rows.length; r++) {
    const value = String(sheet.rows[r]?.[col] || "");
    if (!value) continue;
    if (value.includes("·") || (/^\d/.test(value) && value.includes("–"))) break;
    out.push([...sheet.rows[r].slice(col, col + 5)]);
  }
  return out;
}
assert.deepEqual(
  [...windowRows(summary, "All Day  ·  6:00 AM–5:59 PM").filter((row) => row[0] === "EOL 1")],
  [
    ["EOL 1", "rcCRetLane2", "1", "1", "33%"],
    ["EOL 1", "rcCRetStations", "2", "6", "67%"],
  ]
);
assert.deepEqual(
  [...windowRows(summary, "1st Half  ·  6:00 AM–12:29 PM").filter((row) => row[0] === "EOL 1")],
  [["EOL 1", "rcCRetStations", "2", "6", "100%"]]
);
assert.deepEqual(
  [...windowRows(summary, "2nd Half  ·  12:30 PM–5:59 PM").filter((row) => row[0] === "EOL 1")],
  [["EOL 1", "rcCRetLane2", "1", "1", "100%"]]
);
assert.deepEqual(
  [...windowRows(summary, "12:01 PM–1:00 PM").map((row) => [...row])],
  [
    ["EOL 1", "rcCRetLane2", "1", "1", "100%"],
    ["AR EOL", "rcCRetStations", "1", "3", "100%"],
  ]
);
assert.equal(summary.rows.some((row) => [...row].join(" ").includes("jkiearr")), false);
assert.equal(summary.rows.some((row) => [...row].join(" ").includes("tsLine")), false);
assert.equal(summary.rows.some((row) => [...row].join(" ").includes("tsNight")), false);
const jkiearr = eolBook.sheets.find((sheet) => sheet.name === "jkiearr");
assert.deepEqual([...jkiearr.rows.slice(1).map((row) => row[2])], ["tsC", "tsD", "tsE"]);
const packedEol = await api.workbookBytes(eolBook);
const rereadEol = await api.workbookFromXlsx(packedEol);
const rereadSummary = rereadEol.sheets.find((sheet) => sheet.name === "Summary");
assert.ok([...rereadSummary.rows].some((row) => [...row].some((cell) => String(cell).startsWith("All Day"))));
assert.ok([...rereadSummary.rows].some((row) => [...row].includes("12:01 PM–1:00 PM")));
assert.equal(api.recordsFromBook(rereadEol).length, 5);

const nightBook = api.eolWorkbook(people, "Night");
assert.equal(nightBook.sheets[0].rows[0][0], "All Night  ·  6:00 PM–5:59 AM");
assert.equal(nightBook.sheets[0].rows[0][6], "1st Half  ·  6:00 PM–12:29 AM");
const nightContainers = [...nightBook.sheets.find((sheet) => sheet.name === "milesele").rows.slice(1).map((row) => row[2])];
const earlyContainers = [...nightBook.sheets.find((sheet) => sheet.name === "jkiearr").rows.slice(1).map((row) => row[2])];
assert.deepEqual(nightContainers, ["tsNight"]);
assert.deepEqual(earlyContainers, ["tsEarly"]);
assert.equal(nightBook.sheets.some((sheet) => [...sheet.rows].some((row) => [...row].includes("tsA"))), false);

const withOuter = api.parseDetailsText(
  "tsREF922111 [TOTE]\nTotal units\n6\nOldest Units Age\n0d 23h 32m\nOuter Location\npaA100 [STORAGE] [PICK]\nParent Container\nrcCRetStations [RECEIVE_LANE]\n"
);
assert.equal(withOuter.outerLocation, "paA100");
assert.equal(api.outerLocationLabel(withOuter), "paA100");
const parentOnly = api.parseDetailsText(
  "tsREF922111 [TOTE]\nTotal units\n6\nOldest Units Age\n0d 23h 32m\nParent Container\nrcCRetStations [RECEIVE_LANE]\n"
);
assert.equal(parentOnly.outerLocation, "rcCRetStations");
assert.equal(parentOnly.parentContainer, "rcCRetStations");
assert.match(src, /<div class="brand-by">developed by abelrigm<\/div>/);

console.log("scan timestamp tests passed");
