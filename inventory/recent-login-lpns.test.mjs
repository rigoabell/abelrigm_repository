import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../docs/downloads/recent-login-lpns.txt", import.meta.url), "utf8");

function loadCore() {
  const start = source.indexOf("/* core:start */");
  const end = source.indexOf("/* core:end */");
  assert.ok(start >= 0 && end > start, "core markers");
  const body = source.slice(start + "/* core:start */".length, end);
  return new Function(`${body}
    return {
      textFromHtml,
      isLpnHeader,
      uniqueRecentLpns,
      recentLpnDetails,
      parseHistoryTableHtml,
      shouldFollowRendered,
      buildResultsUrl,
      formatDateLike,
      looksLikeAuth,
      htmlTitle,
      snippetAround,
      discoverHistoryUrls,
    };
  `)();
}

const core = loadCore();

const headers = ["Date (CST)", "OP", "RS", "ASIN", "FNSku", "FCSku", "LPN", "Person"];

function row(date, lpn) {
  return [date, "R", "", "B0F8QP292C", "B0F8QP292C", "ZZPQSVPH4J", lpn, "williejf"];
}

test("keeps the first three unique inventory-history LPNs in table order", () => {
  const rows = [
    row("2026-11-05 15:29:26", "LPNNJ6XPTRZJX"),
    row("2026-11-05 15:29:26", "LPNNJ6XPTRZJX"),
    row("2026-11-05 15:10:39", "LPNNJ6BR39P8R"),
    row("2026-11-05 15:10:39", "lpnnj6br39p8r"),
    row("2026-10-29 09:32:05", "LPNNH6Q93ZCSL"),
    row("2026-10-29 08:23:55", "LPNGSAD183918"),
  ];
  assert.deepEqual(core.uniqueRecentLpns(headers, rows, 3), [
    "LPNNJ6XPTRZJX",
    "LPNNJ6BR39P8R",
    "LPNNH6Q93ZCSL",
  ]);
  assert.deepEqual(core.recentLpnDetails(headers, rows, 3), [
    { lpn: "LPNNJ6XPTRZJX", date: "2026-11-05 15:29:26" },
    { lpn: "LPNNJ6BR39P8R", date: "2026-11-05 15:10:39" },
    { lpn: "LPNNH6Q93ZCSL", date: "2026-10-29 09:32:05" },
  ]);
});

test("finds the LPN column from a DataTables sort label and ignores non-LPNs", () => {
  const labeled = ["Date (CST)", "OP", "LPN: activate to sort column ascending", "Person"];
  const rows = [
    ["2026-11-05 15:29:26", "R", "<a href=\"/MEM3/results?s=LPNNJ6XPTRZJX\">LPNNJ6XPTRZJX</a>", "williejf"],
    ["2026-11-05 15:29:26", "D", "B0F8QP292C", "williejf"],
    ["2026-11-05 15:10:39", "A", "LPNNJ6BR39P8R", "williejf"],
  ];
  assert.deepEqual(core.uniqueRecentLpns(labeled, rows, 3), ["LPNNJ6XPTRZJX", "LPNNJ6BR39P8R"]);
});

test("falls back to the seventh column when the header is missing", () => {
  const plain = ["Date", "OP", "RS", "ASIN", "FNSku", "FCSku", "Not labeled", "Person"];
  const rows = [row("2026-11-05 15:29:26", "LPNNJ6XPTRZJX")];
  assert.deepEqual(core.uniqueRecentLpns(plain, rows, 3), ["LPNNJ6XPTRZJX"]);
});

test("parses the inventory history table out of results HTML", () => {
  const html = `
    <html><head><title>MEM3 results</title></head><body>
      <div data-section-type="inventory-history">
        <table id="table-inventory-history">
          <thead>
            <tr>
              <th>Date (CST)</th><th>OP</th><th>RS</th><th>ASIN</th><th>FNSku</th><th>FCSku</th>
              <th>LPN</th><th>Person</th>
            </tr>
          </thead>
          <tbody>
            <tr class="odd">
              <td>2026-11-05 15:29:26</td><td>R</td><td></td><td>B0F8QP292C</td><td>B0F8QP292C</td><td>ZZPQSVPH4J</td>
              <td><a href="/MEM3/results?s=LPNNJ6XPTRZJX">LPNNJ6XPTRZJX</a></td><td>williejf</td>
            </tr>
            <tr class="even">
              <td>2026-11-05 15:29:26</td><td>D</td><td>4</td><td>B0F8QP292C</td><td>B0F8QP292C</td><td>ZZPQSVPH4J</td>
              <td><a href="/MEM3/results?s=LPNNJ6XPTRZJX">LPNNJ6XPTRZJX</a></td><td>williejf</td>
            </tr>
            <tr class="odd">
              <td>2026-11-05 15:10:39</td><td>R</td><td></td><td>B0002N6BA</td><td>X003UKZRGP</td><td>ZZPQTAGVKN</td>
              <td><a href="/MEM3/results?s=LPNNJ6BR39P8R">LPNNJ6BR39P8R</a></td><td>williejf</td>
            </tr>
            <tr class="even">
              <td>2026-10-29 09:32:05</td><td>R</td><td></td><td>B000RUO5Y0</td><td>X0045N4V5B</td><td>ZZPRJ12M6X</td>
              <td><a href="/MEM3/results?s=LPNNH6Q93ZCSL">LPNNH6Q93ZCSL</a></td><td>williejf</td>
            </tr>
            <tr class="odd">
              <td>2026-10-29 08:23:55</td><td>R</td><td></td><td>B08T78BCZB</td><td>X004NNLOW9</td><td>ZZPRIZ2JPJ</td>
              <td><a href="/MEM3/results?s=LPNGSAD183918">LPNGSAD183918</a></td><td>williejf</td>
            </tr>
          </tbody>
        </table>
        <div id="table-inventory-history_info">Showing 1 to 5 of 5 entries</div>
      </div>
    </body></html>
  `;
  const parsed = core.parseHistoryTableHtml(html);
  assert.equal(parsed.found, true);
  assert.equal(parsed.rowCount, 5);
  assert.equal(parsed.infoText, "Showing 1 to 5 of 5 entries");
  assert.equal(core.htmlTitle(html), "MEM3 results");
  assert.deepEqual(core.recentLpnDetails(parsed.headers, parsed.rows, 3), [
    { lpn: "LPNNJ6XPTRZJX", date: "2026-11-05 15:29:26" },
    { lpn: "LPNNJ6BR39P8R", date: "2026-11-05 15:10:39" },
    { lpn: "LPNNH6Q93ZCSL", date: "2026-10-29 09:32:05" },
  ]);
  assert.equal(core.shouldFollowRendered(parsed, 3), false);
});

test("treats a full DataTables page with fewer than three LPNs as incomplete", () => {
  const short = { found: true, uniqueCount: 2, rowCount: 4 };
  const paged = { found: true, uniqueCount: 2, rowCount: 10 };
  const missing = { found: false, uniqueCount: 0, rowCount: 0 };
  const enough = { found: true, uniqueCount: 3, rowCount: 10 };
  assert.equal(core.shouldFollowRendered(short, 3), false);
  assert.equal(core.shouldFollowRendered(paged, 3), true);
  assert.equal(core.shouldFollowRendered(missing, 3), true);
  assert.equal(core.shouldFollowRendered(enough, 3), false);
});

test("skips the empty-history row", () => {
  const html = `
    <table id="table-inventory-history">
      <thead><tr><th>Date (CST)</th><th>LPN</th></tr></thead>
      <tbody><tr><td class="dataTables_empty" colspan="2">No matching records found</td></tr></tbody>
    </table>
  `;
  const parsed = core.parseHistoryTableHtml(html);
  assert.equal(parsed.found, true);
  assert.equal(parsed.rowCount, 0);
  assert.match(parsed.emptyMessage, /No matching records found/);
  assert.deepEqual(core.recentLpnDetails(parsed.headers, parsed.rows, 3), []);
});

test("builds the results URL and date text", () => {
  assert.equal(
    core.buildResultsUrl("https://qifcr.na.aftx.amazonoperations.app/", "mem3", "williejf"),
    "https://qifcr.na.aftx.amazonoperations.app/MEM3/results?s=williejf"
  );
  assert.equal(core.formatDateLike("10/29/2026", new Date(2026, 4, 9)), "05/09/2026");
  assert.equal(core.formatDateLike("2026-10-29", new Date(2026, 4, 9)), "2026-05-09");
});

test("detects a sign-in page and a history section URL", () => {
  assert.equal(core.looksLikeAuth("https://midway.amazon.com/login", "<html></html>", false), true);
  assert.equal(core.looksLikeAuth("https://qifcr.example/MEM3/results?s=williejf", "<table id='table-inventory-history'>", true), false);
  const html = `<div data-url="/MEM3/sections/inventory-history?s=williejf"></div>`;
  assert.deepEqual(
    core.discoverHistoryUrls(html, "https://qifcr.na.aftx.amazonoperations.app/MEM3/results?s=williejf"),
    ["https://qifcr.na.aftx.amazonoperations.app/MEM3/sections/inventory-history?s=williejf"]
  );
  assert.match(core.snippetAround(html, "inventory-history", 80), /inventory-history/);
});

test("userscript header runs on any page and exposes copy debug", () => {
  assert.match(source, /@match\s+\*:\/\/\*\/\*/);
  assert.match(source, /@grant\s+GM_xmlhttpRequest/);
  assert.match(source, /@grant\s+GM_openInTab/);
  assert.match(source, /@connect\s+qifcr\.na\.aftx\.amazonoperations\.app/);
  assert.match(source, /Copy debug/);
  assert.match(source, /table-inventory-history/);
  assert.equal(core.isLpnHeader("LPN"), true);
  assert.equal(core.textFromHtml("LPN&amp;X <b>nope</b>"), "LPN&X nope");
});
