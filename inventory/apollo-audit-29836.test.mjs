import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../docs/downloads/apollo-audit-login-helper-29836.txt", import.meta.url),
  "utf8",
);

function loadCore() {
  const start = source.indexOf("/* core:start */");
  const end = source.indexOf("/* core:end */");
  assert.ok(start >= 0 && end > start, "core markers");
  const body = source.slice(start + "/* core:start */".length, end);
  return new Function(`${body}
    return { headerLabel, isLpnHeader, lpnColumn, uniqueRecentLpns, recentLpnDetails };
  `)();
}

const core = loadCore();
const headers = ["Date (CST)", "OP", "RS", "ASIN", "FNSku", "FCSku", "LPN", "Person"];

function row(date, lpn) {
  return [date, "R", "", "B0F8QP292C", "B0F8QP292C", "ZZPQSVPH4J", lpn, "williejf"];
}

test("keeps the first three unique inventory-history LPNs and their dates", () => {
  const rows = [
    row("2026-11-05 15:29:26", "LPNNJ6XPTRZJX"),
    row("2026-11-05 15:29:26", "LPNNJ6XPTRZJX"),
    row("2026-11-05 15:10:39", "LPNNJ6BR39P8R"),
    row("2026-10-29 09:32:05", "LPNNH6Q93ZCSL"),
    row("2026-10-29 08:23:55", "LPNGSAD183918"),
  ];
  assert.deepEqual(core.recentLpnDetails(headers, rows, 3), [
    { lpn: "LPNNJ6XPTRZJX", date: "2026-11-05 15:29:26" },
    { lpn: "LPNNJ6BR39P8R", date: "2026-11-05 15:10:39" },
    { lpn: "LPNNH6Q93ZCSL", date: "2026-10-29 09:32:05" },
  ]);
});

test("reads dates when DataTables headers are blank and the LPN label is an aria sort string", () => {
  const labeled = ["", "", "", "", "", "", "LPN: activate to sort column ascending", ""];
  const blank = ["", "", "", "", "", "", "", ""];
  const rows = [
    row("2026-11-05 15:29:26", "LPNNJ6XPTRZJX"),
    row("2026-11-05 15:10:39", "LPNNJ6BR39P8R"),
  ];
  assert.equal(core.headerLabel(labeled[6]), "LPN");
  assert.equal(core.lpnColumn(labeled), 6);
  assert.equal(core.lpnColumn(blank), 6);
  assert.deepEqual(core.recentLpnDetails(blank, rows, 3), [
    { lpn: "LPNNJ6XPTRZJX", date: "2026-11-05 15:29:26" },
    { lpn: "LPNNJ6BR39P8R", date: "2026-11-05 15:10:39" },
  ]);
});

test("userscript loads history LPNs instead of generating them", () => {
  assert.match(source, /@version\s+1\.3\.0/);
  assert.match(source, /apollo29836-lpn/);
  assert.match(source, /function fillHistoryLpns/);
  assert.doesNotMatch(source, /function fillRandomLpns|function generateRandomLpn|LPNN\$\{/);
  assert.match(source, /attachShadow/);
  assert.match(source, /Run next audit/);
});
