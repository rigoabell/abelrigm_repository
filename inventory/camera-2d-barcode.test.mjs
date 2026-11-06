import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const src = fs.readFileSync(new URL("docs/downloads/camera-2d-barcode-scanner.txt", root), "utf8");
const catalog = JSON.parse(fs.readFileSync(new URL("docs/data/tampermonkey.json", root), "utf8"));
const index = fs.readFileSync(new URL("docs/index.html", root), "utf8");
const readme = fs.readFileSync(new URL("README.md", root), "utf8");

assert.match(src, /@name\s+Camera 2D Barcode Scanner \(abelrigm\)/);
assert.match(src, /@version\s+1\.1\.0/);
assert.equal(src.includes("scaleX(-1)"), false);
assert.match(src, />Capture</);
assert.match(src, />Copy debug</);
assert.match(src, /@match\s+https:\/\/\*\/\*/);
assert.match(src, /@match\s+http:\/\/\*\/\*/);
assert.match(src, /@grant\s+none/);
assert.match(src, /@noframes/);
assert.match(src, /@require\s+https:\/\/cdn\.jsdelivr\.net\/npm\/@zxing\/library@0\.21\.3\/umd\/index\.min\.js/);
assert.match(src, /BarcodeDetector/);
assert.equal(src.includes("innerHTML"), true);
assert.equal(src.includes("eval("), false);

const entry = catalog.find((item) => item.id === "camera-2d-barcode-scanner");
assert.ok(entry);
assert.equal(entry.version, "1.1.0");
assert.equal(entry.category, "Labels");
assert.equal(entry.file, "downloads/camera-2d-barcode-scanner.txt");
assert.equal(entry.downloadName, "Camera 2D Barcode Scanner (abelrigm).txt");
assert.equal(entry.runsOn, "Any page");
assert.match(entry.summary, /force a capture/);
assert.match(entry.detail, /Copy debug/);
assert.match(entry.detail, /not mirrored/);
assert.equal(fs.existsSync(new URL("docs/" + entry.file, root)), true);

const projects = catalog.length + 1;
assert.match(index, new RegExp(projects + "</span><span class=\"qn-label\">Portfolio projects"));
assert.equal((index.match(new RegExp(catalog.length + " Tampermonkey scripts", "g")) || []).length, 2);
assert.match(readme, new RegExp(catalog.length + " Tampermonkey scripts"));

const sandbox = {
  __c2dExpose: true,
  __c2dNoBoot: true,
  console,
  Map,
  Set,
  Symbol,
  Date,
  JSON,
  Math,
  Number,
  String,
  Object,
  Array,
  Error,
  TypeError,
  Event,
  KeyboardEvent: globalThis.KeyboardEvent || class KeyboardEvent {
    constructor(type, init) {
      this.type = type;
      this.key = init && init.key || "";
      this.code = init && init.code || "";
    }
  },
  parseInt,
  Uint8ClampedArray,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "camera-2d-barcode-scanner.txt" });
const api = sandbox.__c2d;

const fromVm = (value) => JSON.parse(JSON.stringify(value));
assert.deepEqual(fromVm(api.nativeFormats(false)), ["qr_code", "data_matrix", "pdf417", "aztec"]);
assert.equal(api.nativeFormats(true).includes("code_128"), true);
assert.equal(api.nativeFormats(false).includes("code_128"), false);

const fakeLib = {
  BarcodeFormat: {
    QR_CODE: 1,
    DATA_MATRIX: 2,
    PDF_417: 3,
    AZTEC: 4,
    CODE_128: 5,
    CODE_39: 6,
    CODE_93: 7,
    CODABAR: 8,
    EAN_13: 9,
    EAN_8: 10,
    ITF: 11,
    UPC_A: 12,
    UPC_E: 13,
  },
};
assert.deepEqual(fromVm(api.zxingFormats(fakeLib, false)), [1, 2, 3, 4]);
assert.equal(api.zxingFormats(fakeLib, true).includes(5), true);
assert.deepEqual(fromVm(api.zxingFormats({ BarcodeFormat: { QR_CODE: 9 } }, false)), [9]);

assert.equal(api.labelFor("qr_code"), "QR Code");
assert.equal(api.labelFor("PDF_417"), "PDF417");
assert.equal(api.labelFor("DATA_MATRIX"), "Data Matrix");
assert.equal(api.canonicalFormat("CODE_128"), "code_128");
assert.equal(api.allowsFormat("qr_code", false), true);
assert.equal(api.allowsFormat("code_128", false), false);
assert.equal(api.allowsFormat("CODE_128", true), true);
assert.equal(api.displayText("A\u001dB\nC"), "A␝B⏎C");

assert.equal(api.cameraUnavailableReason({ isSecureContext: false, mediaDevices: { getUserMedia() {} } }), "The camera needs a secure page. Open this site with https://.");
assert.match(api.cameraUnavailableReason({ isSecureContext: true, mediaDevices: null }), /cannot open a camera/);
assert.equal(api.cameraUnavailableReason({ isSecureContext: true, mediaDevices: { getUserMedia() {} } }), "");
assert.match(api.cameraErrorMessage({ name: "NotAllowedError" }), /Allow the camera/);
assert.match(api.cameraErrorMessage({ name: "NotFoundError" }), /No camera/);
assert.match(api.cameraErrorMessage({ name: "NotReadableError" }), /busy/);
assert.match(api.cameraErrorMessage({ name: "SecurityError" }), /https/);
assert.match(api.cameraErrorMessage({ name: "Weird" }), /did not start/);

const storage = {
  items: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.items, key) ? this.items[key] : null; },
  setItem(key, value) { this.items[key] = String(value); },
};
const defaults = api.loadSettings(storage);
assert.equal(defaults.beep, true);
assert.equal(defaults.include1d, true);
assert.equal(api.SCRIPT_VERSION, "1.1.0");
storage.setItem(api.PREVIOUS_SETTINGS_KEY, JSON.stringify({ include1d: false, beep: false, deviceId: "old-cam" }));
const migrated = api.loadSettings(storage);
assert.equal(migrated.include1d, true);
assert.equal(migrated.beep, false);
assert.equal(migrated.deviceId, "old-cam");
storage.items = {};
assert.equal(defaults.typeIntoField, true);
assert.deepEqual(fromVm(defaults.history), []);
storage.setItem(api.SETTINGS_KEY, "{");
assert.equal(api.loadSettings(storage).pressEnter, true);
const saved = {
  beep: false,
  typeIntoField: false,
  pressEnter: false,
  include1d: true,
  deviceId: "cam-1",
  left: 12,
  top: 40,
  history: [{ text: "QR-1", format: "QR_CODE", at: 5 }, { text: "", format: "qr_code" }, null],
};
api.saveSettings(storage, saved);
const loaded = api.loadSettings(storage);
assert.equal(loaded.beep, false);
assert.equal(loaded.include1d, true);
assert.equal(loaded.deviceId, "cam-1");
assert.equal(loaded.left, 12);
assert.equal(loaded.history.length, 1);
assert.equal(loaded.history[0].format, "qr_code");

const history = api.nextHistory([], { text: "QR-1", format: "qr_code", at: 1 }, 2);
const again = api.nextHistory(history, { text: "DM-1", format: "data_matrix", at: 2 }, 2);
const moved = api.nextHistory(again, { text: "QR-1", format: "QR_CODE", at: 3 }, 2);
assert.equal(moved.length, 2);
assert.equal(moved[0].text, "QR-1");
assert.equal(moved[0].at, 3);
assert.equal(moved[0].format, "qr_code");
assert.equal(moved[1].text, "DM-1");

let state = { hold: null, clearAt: 0 };
let step = api.reduceScan(state, { type: "hit", text: "A", format: "qr_code" }, 0, 1000);
assert.equal(step.emit.text, "A");
step = api.reduceScan(step.state, { type: "hit", text: "A", format: "QR_CODE" }, 100, 1000);
assert.equal(step.emit, null);
step = api.reduceScan(step.state, { type: "miss" }, 200, 1000);
assert.equal(step.emit, null);
assert.equal(step.state.hold.text, "A");
step = api.reduceScan(step.state, { type: "hit", text: "A", format: "qr_code" }, 300, 1000);
assert.equal(step.emit, null);
step = api.reduceScan(step.state, { type: "miss" }, 400, 1000);
step = api.reduceScan(step.state, { type: "miss" }, 1400, 1000);
assert.equal(step.state.hold, null);
step = api.reduceScan(step.state, { type: "hit", text: "A", format: "qr_code" }, 1500, 1000);
assert.equal(step.emit.text, "A");
step = api.reduceScan(step.state, { type: "hit", text: "B", format: "pdf417" }, 1600, 1000);
assert.equal(step.emit.format, "pdf417");

assert.equal(api.canWrite(null), false);
assert.equal(api.canWrite({ nodeType: 1, tagName: "INPUT", type: "password" }), false);
assert.equal(api.canWrite({ nodeType: 1, tagName: "INPUT", type: "checkbox" }), false);
assert.equal(api.canWrite({ nodeType: 1, tagName: "INPUT", type: "text", disabled: true }), false);
assert.equal(api.canWrite({ nodeType: 1, tagName: "TEXTAREA" }), true);
assert.equal(api.canWrite({ nodeType: 1, isContentEditable: true }), true);

const events = [];
const field = {
  nodeType: 1,
  tagName: "INPUT",
  type: "text",
  disabled: false,
  readOnly: false,
  isContentEditable: false,
  value: "",
  focus() { events.push("focus"); },
  dispatchEvent(event) { events.push(event.type + ":" + (event.key || "")); return true; },
};
assert.equal(api.writeScan(field, "LPN1", true), true);
assert.equal(field.value, "LPN1");
assert.equal(events.includes("focus"), true);
assert.equal(events.includes("input:"), true);
assert.equal(events.includes("change:"), true);
assert.equal(events.includes("keydown:Enter"), true);
assert.equal(api.writeScan({ nodeType: 1, tagName: "INPUT", type: "password" }, "nope", false), false);

const nativeHit = api.resultFromNative({ rawValue: "BOX-9", format: "data_matrix" });
assert.deepEqual(fromVm(nativeHit), { text: "BOX-9", format: "data_matrix" });
assert.equal(api.resultFromNative({ rawValue: "", format: "qr_code" }), null);

const engine = await api.chooseEngine(false);
assert.equal(engine.kind, "none");

const center = fromVm(api.regionRect(1280, 720, api.CENTER_REGION));
assert.equal(center.name, "center");
assert.ok(center.sx > 0 && center.sy > 0);
assert.ok(center.sw < 1280 && center.sh < 720);
assert.equal(center.width, center.sw);
assert.equal(center.height, center.sh);

const report = api.debugReport({
  version: "1.1.0",
  time: "2026-11-06T15:00:00.000Z",
  page: "https://example.test/scan",
  engine: "Reading with ZXing",
  camera: "Angetube Live camera",
  video: "1280x720",
  linear: true,
  zxing: true,
  detector: false,
  status: "No code yet.",
  value: "",
  misses: 4,
  capture: "center 900x500 miss",
  attempts: [{ mode: "capture", detail: "center 900x500 miss", result: "miss" }],
});
assert.match(report, /Copy Debug v1\.1\.0/);
assert.match(report, /preview mirrored: no/);
assert.match(report, /linear barcodes: on/);
assert.match(report, /Angetube Live camera/);
assert.match(report, /center 900x500 miss/);
