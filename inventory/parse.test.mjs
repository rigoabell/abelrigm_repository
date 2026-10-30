import assert from "node:assert/strict";
import fs from "node:fs";
import { asinCsv, containerTypeCsv, containerTypeName, detailCsv, letterPrefix, locationStatusCsv, normalizeGroupings, parseCsvText, query, rollupCsv, thresholdStatus, valueAt } from "../docs/inventory/engine.js";

const fixture = [
  "\uFEFF\"Region\",\"Warehouse\",\"Outer Location\",\"Bin\",\"ASIN\",\"Owner\",\"Disposition\",\"Amazon Device Flag\",\"Quantity\",\"Average Age\",\"Average Threshold\",\"Note\"",
  "\"US Relo - East\",\"MEM3\",\"Dock A\",\"bin-1\",\"B000000001\",\"TRANSSHPMNT\",\"SELLABLE\",,1,3.5,5,\"plain\"",
  "\"US Relo - East\",\"MEM3\",\"Dock A\",\"bin-1\",\"B000000001\",\"TRANSSHPMNT\",\"SELLABLE\",\"Amazon Devices\",2,0,30,\"say \"\"hi\"\"\"",
  "\"US Relo - East\",\"MEM3\",\"dz-P-VR-Liquidate\",\"bin,2\",\"B000000002\",\"LIQN_SHPMNT\",\"CUST_DAMAGED\",,1,29,5,\"café\"",
  "\"West\",\"PHX1\",\"Dock B\",\"bin-3\",\"B000000003\",\"INVENTORY\",\"DEFECTIVE\",,4,180,8,",
].join("\r\n") + "\r\n";

function parsed(chunkSize) {
  return parseCsvText(fixture, chunkSize);
}

function sameShape(a, b) {
  assert.equal(a.rowCount, b.rowCount);
  assert.deepEqual(a.header, b.header);
  for (let row = 0; row < a.rowCount; row++) {
    for (const column of a.columns) {
      const other = b.byName[column.name];
      assert.equal(valueAt(column, row), valueAt(other, row), column.name + " row " + row);
    }
  }
}

const whole = parsed();
assert.equal(whole.rowCount, 4);
assert.equal(whole.header.at(-1), "Note");
assert.equal(valueAt(whole.byName.ASIN, 0), "B000000001");
assert.equal(valueAt(whole.byName["Amazon Device Flag"], 0), "");
assert.equal(valueAt(whole.byName["Amazon Device Flag"], 1), "Amazon Devices");
assert.equal(valueAt(whole.byName.Note, 1), 'say "hi"');
assert.equal(valueAt(whole.byName.Bin, 2), "bin,2");
assert.equal(valueAt(whole.byName.Note, 2), "café");
assert.equal(valueAt(whole.byName["Average Age"], 0), "3.5");
assert.ok(Math.abs(whole.byName["Average Age"].values[0] - 3.5) < 1e-9);

for (const size of [1, 2, 3, 5, 7, 16, 64]) sameShape(whole, parsed(size));

assert.equal(letterPrefix("tsX27482942"), "tsX");
assert.equal(letterPrefix("tsTDST34394839"), "tsTDST");
assert.equal(letterPrefix(""), "(blank)");
assert.equal(containerTypeName("tsX27482942", []), "tsX");
const rules = normalizeGroupings([
  { name: "ts", prefix: "ts" },
  { name: "Transfer station", prefix: "tsTDST" },
  { name: "Scan X", prefix: "tsX" },
]);
assert.equal(rules[0].prefix, "tsTDST");
assert.equal(containerTypeName("tsTDST34394839", rules), "Transfer station");
assert.equal(containerTypeName("tsX27482942", rules), "Scan X");
assert.equal(containerTypeName("tsAUD040818", rules), "ts");
const grouped = query(whole, { groupings: [{ name: "Bin dash", prefix: "bin-" }] });
assert.equal(grouped.containerTypes.find((row) => row.name === "Bin dash").containers, 3);
assert.equal(grouped.containerTypes.find((row) => row.name === "bin,").containers, 1);
const typedOnly = query(whole, { containerType: "Bin dash", groupings: [{ name: "Bin dash", prefix: "bin-" }] });
assert.equal(typedOnly.lines, 3);

assert.equal(thresholdStatus(3, 5), "approaching");
assert.equal(thresholdStatus(4, 5), "approaching");
assert.equal(thresholdStatus(4.2, 5), "at");
assert.equal(thresholdStatus(5, 5), "at");
assert.equal(thresholdStatus(5.01, 5), "diot");
assert.equal(thresholdStatus(0, 5), "early");

const summary = query(whole, {});
assert.equal(summary.lines, 4);
assert.equal(summary.units, 8);
assert.equal(summary.uniqueAsins, 3);
assert.equal(summary.uniqueBins, 3);
assert.equal(summary.disposition.find((row) => row.name === "SELLABLE").units, 3);

const filtered = query(whole, { allow: { Disposition: new Set([summary.disposition.find((row) => row.name === "SELLABLE").id]) } });
assert.equal(filtered.lines, 2);
assert.equal(filtered.units, 3);
assert.equal(filtered.uniqueAsins, 1);

const aged = query(whole, { ageMin: 180 });
assert.equal(aged.lines, 1);
assert.equal(valueAt(whole.byName.Warehouse, aged.matchIndex[0]), "PHX1");

const hot = query(whole, { statuses: new Set(["approaching", "at", "diot"]) });
assert.equal(hot.lines, 3);
assert.equal(hot.status.approaching.lines, 1);
assert.equal(hot.status.diot.lines, 2);
assert.equal(hot.status.early.lines, 1);
assert.ok(hot.locations.some((row) => row.name === "Dock A" && row.approaching === 1));
const soonOnly = query(whole, { statuses: new Set(["approaching", "at"]) });
assert.equal(soonOnly.lines, 1);
assert.equal(soonOnly.locations.length, 1);
assert.equal(soonOnly.locations[0].name, "Dock A");
assert.equal(soonOnly.locations[0].containers, 1);
assert.equal(soonOnly.locations[0].units, 1);
assert.equal(soonOnly.locations[0].approaching, 1);
assert.equal(soonOnly.locations[0].early, 0);
assert.equal(soonOnly.status.diot.lines, 2);
const soonFile = locationStatusCsv(soonOnly.locations).join("");
assert.equal(soonFile.split("\n")[0], "Outer Location,Containers,Units");
assert.ok(soonFile.includes("Dock A,1,1"));

const detail = detailCsv(whole, filtered.matchIndex).join("");
assert.ok(detail.includes("Status,Days before threshold"));
assert.ok(detail.startsWith("Region,Warehouse"));
assert.equal(detail.trim().split("\n").length, 3);
assert.ok(detail.includes('say ""hi""') || detail.includes('"say ""hi"""'));

const rollup = rollupCsv(whole, summary.matchIndex).join("");
assert.ok(rollup.includes("Dock A,TRANSSHPMNT,SELLABLE,2,3,1"));
assert.ok(rollup.includes('"bin,2"') === false);
assert.ok(rollup.includes("dz-P-VR-Liquidate,LIQN_SHPMNT,CUST_DAMAGED,1,1,1"));

const byAsin = asinCsv(whole, summary.matchIndex).join("");
assert.ok(byAsin.includes("B000000001,2,3"));
assert.ok(byAsin.includes("MIXED") === false || byAsin.includes("TRANSSHPMNT"));

assert.throws(() => parseCsvText("Region,Warehouse\nA,B\n"), /Missing columns/);
assert.throws(() => parseCsvText(fixture + '"only-one"\n'), /columns/);

const realPath = "/tmp/inventory/Current_Inventory_De_1793288358912.csv";
if (fs.existsSync(realPath)) {
  const text = fs.readFileSync(realPath, "utf8");
  const started = Date.now();
  const real = parseCsvText(text, 64 * 1024);
  const parsedMs = Date.now() - started;
  assert.equal(real.rowCount, 243775);
  assert.equal(real.byName.ASIN.bytes.length, 243775 * 10);
  const summarized = Date.now();
  const view = query(real, {});
  const queryMs = Date.now() - summarized;
  assert.equal(view.lines, 243775);
  assert.equal(view.units, 249616);
  assert.equal(view.uniqueAsins, 229158);
  assert.equal(view.uniqueBins, 33574);
  assert.equal(view.warehouse.length, 1);
  assert.equal(view.warehouse[0].name, "MEM3");
  assert.equal(view.disposition.find((row) => row.name === "SELLABLE").lines, 142315);
  assert.equal(view.disposition.find((row) => row.name === "SELLABLE").units, 145639);
  const tsx = view.containerTypes.find((row) => row.name === "tsX");
  const station = view.containerTypes.find((row) => row.name === "tsTDST");
  assert.equal(view.containerTypes[0].name, "tsX");
  assert.ok(tsx.containers > 100000);
  assert.ok(station.containers > 2000);
  const renamed = query(real, { groupings: [{ name: "Scan X", prefix: "tsX" }] });
  const scanX = renamed.containerTypes.find((row) => row.name === "Scan X");
  assert.ok(scanX.containers >= tsx.containers);
  assert.equal(renamed.containerTypes.find((row) => row.name === "tsX"), undefined);
  const watched = query(real, { statuses: new Set(["approaching", "at", "diot"]) });
  assert.equal(watched.status.diot.lines, 1668);
  assert.equal(watched.status.at.lines, 329);
  assert.equal(watched.status.approaching.lines, 395);
  assert.equal(watched.lines, 2392);
  const busiest = watched.locations.find((row) => row.name === "dz-P-SortedReloInv");
  assert.equal(busiest.diot, 785);
  assert.equal(busiest.at, 177);
  assert.equal(busiest.approaching, 142);
  assert.equal(busiest.containers, 1104);
  assert.equal(busiest.units, busiest.approachingUnits + busiest.atUnits + busiest.diotUnits);
  assert.equal(watched.locations[0].containers, Math.max(...watched.locations.map((row) => row.containers)));
  const locationFile = locationStatusCsv(watched.locations).join("");
  assert.ok(locationFile.startsWith("Outer Location,Containers,Units"));
  assert.ok(locationFile.includes("dz-P-SortedReloInv,1104," + busiest.units));
  const approachingAt = query(real, { statuses: new Set(["approaching", "at"]) });
  assert.equal(approachingAt.lines, 724);
  assert.equal(approachingAt.status.diot.lines, 1668);
  assert.ok(approachingAt.locations.every((row) => row.containers === row.at + row.approaching && row.diot === 0 && row.early === 0));
  assert.equal(approachingAt.locations[0].containers, Math.max(...approachingAt.locations.map((row) => row.containers)));
  assert.equal(valueAt(real.byName.ASIN, 0), "B08BR9HBZ3");
  assert.equal(valueAt(real.byName.ASIN, real.rowCount - 1), "ZZPROU6OYF");
  const sellable = view.disposition.find((row) => row.name === "SELLABLE");
  const narrowed = query(real, { allow: { Disposition: new Set([sellable.id]) } });
  assert.equal(narrowed.lines, 142315);
  console.log("real file parse " + parsedMs + "ms, query " + queryMs + "ms");
}

console.log("inventory parser tests passed");
