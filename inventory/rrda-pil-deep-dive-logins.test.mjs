import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../docs/downloads/rrda-pil-deep-dive-logins.txt", import.meta.url),
  "utf8",
);

function loadCore() {
  const start = source.indexOf("/* core:start */");
  const end = source.indexOf("/* core:end */");
  assert.ok(start >= 0 && end > start, "core markers");
  const body = source.slice(start + "/* core:start */".length, end);
  return new Function(
    `${body}\nreturn { isLogin, isLoginHeader, parseMatrix, chooseMatrix, matrixFromLabels, matrixFromHtmlTable, matrixFromHeaderRow, isHeaderRowElement, formatDebugReport };`,
  )();
}

const core = loadCore();

const HEADERS = [
  "Login",
  "Manager",
  "Region",
  "Site",
  "Week",
  "PIL Units",
  "Total Units",
  "PIL Usage %",
  "Engaged?",
];

function row(login, manager, week, engaged) {
  return [login, manager, "EAST", "MEM3", week, "1,107", "1,107", "100.0%", engaged];
}

const PIL_MATRIX = [
  ["Associate PIL Usage % Detail"],
  HEADERS,
  row("slauremp", "turpchri", "W45 (2026-11-01–2026-11-07)", "Engaged"),
  row("chursnat", "cturnerh", "W45 (2026-11-01–2026-11-07)", "Engaged"),
  row("chursnat", "cturnerh", "W46", "Not Engaged"),
  row("somalini", "turpchri", "W46", "Engaged"),
  row("somalini", "turpchri", "WTD", "Pending"),
  row("kutiobkh", "heamayde", "W46", "Not Engaged"),
  row("chursnat", "cturnerh", "WTD", "Pending"),
];

test("login check keeps aliases and drops regions, weeks, and percents", () => {
  assert.equal(core.isLogin("slauremp"), true);
  assert.equal(core.isLogin("kutiobkh"), true);
  assert.equal(core.isLogin("Login"), false);
  assert.equal(core.isLogin("EAST"), false);
  assert.equal(core.isLogin("MEM3"), false);
  assert.equal(core.isLogin("WTD"), false);
  assert.equal(core.isLogin("W45"), false);
  assert.equal(core.isLogin("100.0%"), false);
  assert.equal(core.isLogin("1,107"), false);
  assert.equal(core.isLoginHeader("Login"), true);
  assert.equal(core.isLoginHeader("Login ↑"), true);
  assert.equal(core.isLoginHeader("Manager"), false);
});

test("the Login column is copied, managers and repeated weeks are not", () => {
  const parsed = core.parseMatrix(PIL_MATRIX);
  assert.equal(parsed.column, 0);
  assert.deepEqual(parsed.unique, ["slauremp", "chursnat", "somalini", "kutiobkh"]);
  assert.equal(parsed.rawCount, 7);
  assert.equal(parsed.rejected.includes("EAST"), false);
});

test("a flat cell list and a div row use the same Login column", () => {
  const flat = core.matrixFromLabels(PIL_MATRIX.slice(1).flat());
  assert.deepEqual(core.parseMatrix(flat).unique, ["slauremp", "chursnat", "somalini", "kutiobkh"]);

  function cell(text) {
    return { textContent: text, children: [], childElementCount: 0 };
  }
  function line(values) {
    const children = values.map(cell);
    const node = {
      textContent: values.join(" "),
      children,
      childElementCount: children.length,
      closest: () => null,
      parentElement: null,
    };
    children.forEach((child) => {
      child.parentElement = node;
    });
    return node;
  }
  const header = line(HEADERS.map((header, index) => (index === 0 ? "Login ↑" : header)));
  const body = [
    line(row("slauremp", "turpchri", "W45", "Engaged")),
    line(row("somalini", "turpchri", "WTD", "Pending")),
  ];
  const parent = {
    children: [header, ...body],
    childElementCount: 3,
  };
  [header, ...body].forEach((node) => {
    node.parentElement = parent;
  });

  assert.equal(core.isHeaderRowElement(header), true);
  assert.deepEqual(core.parseMatrix(core.matrixFromHeaderRow(header)).unique, ["slauremp", "somalini"]);
});

test("an html table skips the manager column", () => {
  const table = {
    rows: PIL_MATRIX.slice(1).map((values) => ({
      cells: values.map((value) => ({ textContent: value })),
    })),
  };
  assert.deepEqual(core.parseMatrix(core.matrixFromHtmlTable(table)).unique, [
    "slauremp",
    "chursnat",
    "somalini",
    "kutiobkh",
  ]);
});

test("the PIL table wins over a shorter login table", () => {
  const noise = [
    ["Login", "Name"],
    ["otheralias", "Region Office"],
  ];
  const choice = core.chooseMatrix([noise, PIL_MATRIX]);
  assert.deepEqual(choice.chosen.unique, ["slauremp", "chursnat", "somalini", "kutiobkh"]);
  assert.equal(choice.others.length, 1);
});

test("copy debug names the iframe gap and the visible logins", () => {
  const parsed = core.parseMatrix(PIL_MATRIX);
  const report = core.formatDebugReport({
    version: "0.1.0",
    page: {
      url: "https://rrda.harmony.a2z.com/view-agent-reports/relo-quality-reports/possible-item-list-deep-dive",
      title: "PIL Usage % Dashboard",
      inIframe: true,
      topUrl: "https://rrda.harmony.a2z.com/view-agent-reports/relo-quality-reports/possible-item-list-deep-dive",
    },
    rightClicks: 0,
    contextMenus: 0,
    logins: parsed.unique,
    rawCount: parsed.rawCount,
    rejected: parsed.rejected,
    chosen: { kind: "table", score: parsed.score, column: parsed.column, headers: parsed.headers, sampleRows: parsed.sampleRows },
    frames: [{ readable: false, width: 900, height: 600, id: "dash", className: "embed", src: "https://example.invalid/dash" }],
    view: "Associate PIL Usage % Detail",
  });
  assert.match(report, /Copy Debug v0\.1\.0/);
  assert.match(report, /does not run inside iframes/);
  assert.match(report, /slauremp, chursnat, somalini, kutiobkh/);
  assert.match(report, /readable=no/);
  assert.match(report, /https:\/\/example\.invalid\/dash/);
  assert.match(report, /In iframe: yes/);
});

test("the script stays off the hub and listens inside frames", () => {
  assert.match(source, /@version\s+0\.1\.0/);
  assert.match(source, /@match\s+https:\/\/rrda\.harmony\.a2z\.com\/\*/);
  assert.match(source, /Copy Debug/);
  assert.match(source, /composedPath/);
  assert.match(source, /shadowRoot/);
  assert.match(source, /contentDocument/);
  assert.match(source, /AA Deep Dive/);
  assert.match(source, /window\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(source, /if \(window\.top !== window\.self\) return;/);
  const catalog = fs.readFileSync(new URL("../docs/data/tampermonkey.json", import.meta.url), "utf8");
  assert.equal(catalog.includes("rrda-pil-deep-dive-logins"), false);
  assert.equal(catalog.includes("RRDA PIL Deep Dive"), false);
});
