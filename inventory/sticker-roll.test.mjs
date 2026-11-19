import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const src = fs.readFileSync(new URL("docs/downloads/sticker-roll.user.js", root), "utf8");
const pasted = fs.readFileSync(new URL("docs/downloads/sticker-roll.txt", root), "utf8");
const catalog = JSON.parse(fs.readFileSync(new URL("docs/data/tampermonkey.json", root), "utf8"));
const index = fs.readFileSync(new URL("docs/index.html", root), "utf8");
const readme = fs.readFileSync(new URL("README.md", root), "utf8");

assert.equal(src, pasted);
assert.match(src, /@name\s+Sticker Roll \(abelrigm\)/);
assert.match(src, /@version\s+1\.1\.1/);
assert.match(src, /id = 'sr-launch'/);
assert.match(src, /🏷️/);
assert.match(src, /@match\s+https:\/\/\*\/\*/);
assert.match(src, /@match\s+http:\/\/\*\/\*/);
assert.match(src, /@noframes/);
assert.match(src, /@grant\s+GM_getValue/);
assert.match(src, /@grant\s+GM_setValue/);
assert.match(src, /el\('button', '', 'Print'\)/);
assert.match(src, /qrcode-generator@1\.4\.4/);
assert.equal(src.includes("eval("), false);
assert.equal(src.includes("innerHTML"), false);

const entry = catalog.find((item) => item.id === "sticker-roll");
assert.ok(entry);
assert.equal(entry.version, "1.1.1");
assert.match(entry.detail, /sticker button/);
assert.match(entry.detail, /close button/);
assert.equal(entry.category, "Labels");
assert.equal(entry.file, "downloads/sticker-roll.txt");
assert.equal(entry.downloadName, "Sticker Roll (abelrigm).txt");
assert.equal(entry.runsOn, "Any page");
assert.match(entry.summary, /QR code/);
assert.match(entry.detail, /third click/);
assert.match(entry.detail, /History/);
assert.equal(fs.existsSync(new URL("docs/" + entry.file, root)), true);

const projects = catalog.length + 1;
assert.match(index, new RegExp(projects + "</span><span class=\"qn-label\">Portfolio projects"));
assert.equal((index.match(new RegExp(catalog.length + " Tampermonkey scripts", "g")) || []).length, 2);
assert.match(readme, new RegExp(catalog.length + " Tampermonkey scripts"));

const sandbox = {
  __srExpose: true,
  __srNoBoot: true,
  console,
  Map,
  Set,
  JSON,
  Math,
  Number,
  String,
  Object,
  Array,
  Error,
  TypeError,
  Date,
  parseInt,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "sticker-roll.user.js" });
const api = sandbox.__sr;
const fromVm = (value) => JSON.parse(JSON.stringify(value));

assert.equal(api.VERSION, "1.1.1");
assert.deepEqual(fromVm(api.parseList("a\nb\n\n c ")), ["a", "b", "c"]);
assert.deepEqual(fromVm(api.parseList("a, b; c\td")), ["a", "b", "c", "d"]);
assert.deepEqual(fromVm(api.parseList("keep, this\nnext")), ["keep, this", "next"]);
assert.deepEqual(fromVm(api.parseList("row\tcell\nstay")), ["row", "cell", "stay"]);
assert.deepEqual(fromVm(api.parseList("   ")), []);

assert.equal(api.applyClick(0, "cycle"), 1);
assert.equal(api.applyClick(1, "cycle"), 2);
assert.equal(api.applyClick(2, "cycle"), 0);
assert.equal(api.applyClick(9, "cycle"), 1);
assert.equal(api.applyClick(0, 2), 2);
assert.equal(api.applyClick(1, 1), 1);
assert.equal(api.applyClick(2, 0), 0);

assert.equal(api.stickerFill(0, "#f6c945", "#8ec5ff"), "#ffffff");
assert.equal(api.stickerFill(1, "#f6c945", "#8ec5ff"), "#f6c945");
assert.equal(api.stickerFill(2, "#f6c945", "#8ec5ff"), "#8ec5ff");
assert.equal(api.stickerTextColor(0, "#111111", "#8ec5ff"), "#1a1a1a");
assert.equal(api.stickerTextColor(1, "#111111", "#8ec5ff"), "#ffffff");
assert.equal(api.stickerTextColor(2, "#111111", "#8ec5ff"), "#1a1a1a");
assert.equal(api.isDark("#ffffff"), false);
assert.equal(api.isDark("#000000"), true);
assert.equal(api.normalizeHex("#ABC", "#ffffff"), "#aabbcc");
assert.equal(api.normalizeHex("nope", "#ffffff"), "#ffffff");

assert.equal(api.dockSide("left"), "right");
assert.equal(api.dockSide("right"), "left");
assert.equal(api.dockSide("nope"), "right");

const printed = fromVm(api.printModel({ values: ["a", "b"], marks: [1, 2] }, "a\nb"));
assert.deepEqual(printed.marks, [1, 2]);
assert.equal(printed.rollVisible, true);
const reset = fromVm(api.printModel({ values: ["a", "b"], marks: [1, 2] }, "a\nc"));
assert.deepEqual(reset.values, ["a", "c"]);
assert.deepEqual(reset.marks, [0, 0]);
assert.deepEqual(fromVm(api.printModel({ values: [], marks: [] }, "  ")), { error: "Add a value" });

const many = Array.from({ length: api.MAX_STICKERS + 3 }, (_, index) => "v" + index).join("\n");
const capped = fromVm(api.printModel({ values: [], marks: [] }, many));
assert.equal(capped.values.length, api.MAX_STICKERS);
assert.match(capped.status, new RegExp(api.MAX_STICKERS + " of " + (api.MAX_STICKERS + 3)));

const saved = fromVm(api.upsertList([], {
  id: "one",
  name: "Morning",
  values: ["lpn1", "lpn2"],
  marks: [1, 0],
  savedAt: 10,
}));
assert.equal(saved.entry.id, "one");
const renamed = fromVm(api.upsertList(saved.lists, {
  id: "two",
  name: "morning",
  values: ["lpn1"],
  marks: [2],
  savedAt: 11,
}));
assert.equal(renamed.lists.length, 1);
assert.equal(renamed.entry.id, "one");
assert.equal(renamed.entry.name, "morning");
assert.deepEqual(renamed.entry.marks, [2]);
assert.equal(api.fallbackName(["alpha", "beta", "gamma"]), "alpha +2");
assert.equal(api.exportBody(["a", "b"]), "a\nb\n");
assert.equal(api.exportFileName("Line 1 / odd"), "Line-1-odd.txt");
assert.equal(api.exportFileName(""), "sticker-roll.txt");

const restored = fromVm(api.readStored(JSON.stringify({
  side: "right",
  color1: "#abc",
  color2: "bad",
  mode: "2",
  name: "Morning",
  draft: "lpn1",
  values: ["lpn1", " "],
  marks: [2, 1],
  rollVisible: true,
  hidden: false,
  lists: [{ id: "one", name: "Morning", values: ["lpn1"], marks: [2], savedAt: 10 }, { name: "", values: ["x"] }],
})));
assert.equal(restored.side, "right");
assert.equal(restored.color1, "#aabbcc");
assert.equal(restored.color2, api.DEFAULT_COLOR_2);
assert.equal(restored.mode, 2);
assert.deepEqual(restored.values, ["lpn1"]);
assert.deepEqual(restored.marks, [2]);
assert.equal(restored.lists.length, 1);
assert.equal(api.sanitizeState(null).side, "left");
assert.equal(api.sanitizeState(null).mode, "cycle");
assert.equal(api.sanitizeState(null).panelOpen, false);
assert.equal(api.sanitizeState({ panelOpen: true }).panelOpen, true);
assert.equal(api.sanitizeState({ hidden: true }).hidden, false);

const calls = [];
sandbox.qrcode = Object.assign(function (type, level) {
  calls.push(["make", type, level]);
  return {
    addData(text) { calls.push(["data", text]); },
    make() { calls.push(["built"]); },
    createDataURL(cell, margin) {
      calls.push(["url", cell, margin]);
      return "data:image/gif;base64,abc";
    },
  };
}, {
  stringToBytesFuncs: { "UTF-8": function () { return []; } },
});
assert.equal(api.qrDataUrl("LPN1"), "data:image/gif;base64,abc");
assert.deepEqual(calls[0], ["make", 0, "M"]);
assert.deepEqual(calls[1], ["data", "LPN1"]);
assert.equal(api.qrDataUrl(""), "");
sandbox.qrcode = function () { throw new Error("too big"); };
assert.equal(api.qrDataUrl("LPN1"), "");
