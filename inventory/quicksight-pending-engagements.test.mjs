import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../docs/downloads/quicksight-pending-engagements.txt", import.meta.url),
  "utf8",
);

function loadCore() {
  const start = source.indexOf("/* core:start */");
  const end = source.indexOf("/* core:end */");
  assert.ok(start >= 0 && end > start, "core markers");
  const body = source.slice(start + "/* core:start */".length, end);
  return new Function(`${body}\nreturn { clockedInSelection };`)();
}

const core = loadCore();

test("clocked-in check selects who is in and leaves everyone else unselected", () => {
  const status = new Map([
    ["williejf", "in"],
    ["kalyreio", "out"],
    ["rickmuru", "out"],
  ]);
  assert.deepEqual(core.clockedInSelection(["kalyreio", "rickmuru", "williejf", "missing"], status), {
    selected: ["williejf"],
    leftOut: ["kalyreio", "rickmuru", "missing"],
  });
});

test("keep clocked in no longer drops rows and the panel can copy a selection", () => {
  assert.match(source, /@version\s+2\.5\.3/);
  assert.match(source, /Copy selected/);
  assert.match(source, /data-qstd-select-all/);
  assert.doesNotMatch(source, /attrByLogin\.delete/);
});
