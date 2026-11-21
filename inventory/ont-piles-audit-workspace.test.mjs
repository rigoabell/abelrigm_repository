import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const src = fs.readFileSync(new URL("docs/downloads/ont-piles-audit-workspace.user.js", root), "utf8");
const pasted = fs.readFileSync(new URL("docs/downloads/ont-piles-audit-workspace.txt", root), "utf8");
const catalog = JSON.parse(fs.readFileSync(new URL("docs/data/tampermonkey.json", root), "utf8"));
const index = fs.readFileSync(new URL("docs/index.html", root), "utf8");
const readme = fs.readFileSync(new URL("README.md", root), "utf8");

const sandbox = { __pilesExpose: true, __pilesNoBoot: true, console, URL };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox, { filename: "ont-piles-audit-workspace.user.js" });
const piles = sandbox.__piles;

function matches(node, selector) {
  if (selector === "[data-ont-input]") return node.attrs["data-ont-input"] != null;
  if (selector === "[data-ont-out]") return node.attrs["data-ont-out"] != null;
  if (selector === 'a[href*="audit_date="]') {
    return node.tag === "a" && typeof node.attrs.href === "string" && node.attrs.href.includes("audit_date=");
  }
  return false;
}

function makeEl(tag) {
  const node = {
    tag: tag,
    id: "",
    className: "",
    textContent: "",
    value: "",
    children: [],
    parentElement: null,
    attrs: {},
    listeners: {},
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    dispatch(type) {
      (this.listeners[type] || []).forEach((fn) => fn({ target: this }));
    },
    querySelectorAll(selector) {
      const found = [];
      this.children.forEach(function walk(child) {
        if (matches(child, selector)) found.push(child);
        child.children.forEach(walk);
      });
      return found;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    insertBefore(child, ref) {
      child.parentElement = this;
      const index = ref ? this.children.indexOf(ref) : -1;
      if (index < 0) this.children.push(child);
      else this.children.splice(index, 0, child);
      return child;
    }
  };
  Object.defineProperty(node, "nextSibling", {
    get() {
      if (!this.parentElement) return null;
      const kids = this.parentElement.children;
      const index = kids.indexOf(this);
      return index >= 0 && index < kids.length - 1 ? kids[index + 1] : null;
    }
  });
  return node;
}

function makeDoc() {
  const html = makeEl("html");
  const head = makeEl("head");
  const body = makeEl("body");
  html.appendChild(head);
  html.appendChild(body);

  const doc = {
    documentElement: html,
    head: head,
    body: body,
    createElement: makeEl,
    getElementById(id) {
      let found = null;
      (function walk(node) {
        if (node.id === id) found = node;
        node.children.forEach(walk);
      })(html);
      return found;
    }
  };
  return doc;
}

function auditPage() {
  const doc = makeDoc();
  const row = makeEl("div");
  row.className = "row";
  doc.body.appendChild(row);

  const header = makeEl("div");
  header.className = "col-sm-12";
  row.appendChild(header);

  const well = makeEl("div");
  well.className = "well";
  header.appendChild(well);

  const center = makeEl("div");
  center.className = "text-center";
  well.appendChild(center);

  const status = makeEl("h2");
  status.id = "audit-status-container";
  status.className = "form-check audit-incomplete";
  status.textContent = "Audit Is Complete?";
  center.appendChild(status);

  const problem = makeEl("div");
  problem.id = "problem-solve";
  problem.className = "col-sm-6";
  problem.textContent = "Bigs Problem Solve";
  row.appendChild(problem);

  const exceptions = makeEl("div");
  exceptions.id = "exceptions";
  exceptions.className = "col-sm-6";
  exceptions.textContent = "Bigs Exceptions";
  row.appendChild(exceptions);

  return { doc, row, header, well, problem, exceptions };
}

test("catalog entry matches the script", () => {
  assert.equal(src, pasted);
  assert.equal(src.includes("innerHTML"), false);
  assert.match(src, /@version\s+1\.5\.0/);
  assert.match(src, /@match\s+https:\/\/ont-base\.corp\.amazon\.com\/\*/);
  assert.match(src, /ont-piles-audit-workspace\.user\.js/);

  const entry = catalog.find((item) => item.id === "ont-piles-audit-workspace");
  assert.ok(entry);
  assert.equal(entry.version, "1.5.0");
  assert.equal(entry.category, "ONT Base");
  assert.equal(entry.file, "downloads/ont-piles-audit-workspace.txt");
  assert.equal(entry.downloadName, "ONT Base Piles Audit Workspace (abelrigm).txt");
  assert.equal(entry.runsOn, "ont-base.corp.amazon.com");
  assert.match(entry.summary, /EOS total/);
  assert.match(entry.detail, /Audit Is Complete/);
  assert.match(entry.detail, /Problem Solve/);
  assert.match(entry.detail, /pallet 20/);
  assert.match(entry.detail, /tote 5/);
  assert.equal(fs.existsSync(new URL("docs/" + entry.file, root)), true);
  assert.equal(piles.VERSION, "1.5.0");

  const projects = catalog.length + 1;
  assert.match(index, new RegExp(projects + "</span><span class=\"qn-label\">Portfolio projects"));
  assert.equal((index.match(new RegExp(catalog.length + " Tampermonkey scripts", "g")) || []).length, 2);
  assert.match(readme, new RegExp(catalog.length + " Tampermonkey scripts"));
});

test("the audit url is the piles audit page", () => {
  const audit = "https://ont-base.corp.amazon.com/en/MEM3/icqa/piles/audit?audit_shift=Days&audit_number=1";
  assert.equal(piles.isAuditPage(audit), true);
  assert.equal(piles.isAuditPage("https://ont-base.corp.amazon.com/en/DEN3/icqa/piles/audit/"), true);
  assert.equal(piles.isAuditPage("https://ont-base.corp.amazon.com/en/MEM3/icqa/piles"), false);
  assert.equal(piles.isAuditPage("https://ont-base.corp.amazon.com/en/MEM3/icqa/piles/report?audit_number=1"), false);
  assert.equal(piles.isAuditPage("https://example.com/en/MEM3/icqa/piles/audit"), false);
});

test("workspace sits between the header cell and the two pile cards", () => {
  const page = auditPage();
  const cell = piles.placeWorkspace(page.doc);

  assert.equal(cell.id, piles.CELL_ID);
  assert.deepEqual(page.row.children.map((node) => node.id || node.className), [
    "col-sm-12",
    "ont-piles-workspace-col",
    "problem-solve",
    "exceptions"
  ]);
  assert.equal(page.row.children[1], cell);
  assert.equal(cell.parentElement, page.header.parentElement);
  assert.equal(page.well.children.includes(cell), false);
  assert.equal(page.header.children.includes(cell), false);

  const card = cell.children[0];
  assert.equal(card.id, "ont-piles-workspace");
  assert.equal(card.attrs["data-ont-piles-workspace"], "1");
  assert.equal(card.children[0].textContent, "EOS piles");
  const surface = page.doc.getElementById(piles.BODY_ID);
  const flat = (function walk(node) {
    return node.textContent + node.children.map(walk).join("");
  })(surface);
  assert.match(flat, /Pallets × 20/);
  assert.match(flat, /Pallets × 150/);
  assert.match(flat, /Other BIGS/);
  assert.match(flat, /Add Ins/);
  const sheet = page.doc.getElementById("ont-piles-eos").children[0].children[0];
  const body = sheet.children.find((node) => node.tag === "tbody");
  const bodyRows = body.children;
  assert.equal(bodyRows.length, 4);
  assert.equal(bodyRows[0].children.length, 9);
  assert.equal(bodyRows[0].children[0].textContent, "Problem Solve");
  assert.equal(bodyRows[3].children[0].textContent, "Total");
  assert.equal(bodyRows[3].children.length, 9);
  assert.equal(surface.attrs["data-work-surface"], "1");
  assert.equal(surface.parentElement, card);
  assert.equal(page.doc.getElementById("ont-piles-eos").parentElement, surface);
  const styleText = page.doc.getElementById("ont-piles-workspace-style").textContent;
  assert.match(styleText, /ont-piles-bigs/);
  assert.match(styleText, /width: max-content/);
  assert.match(styleText, /min-width: calc\(13ch \+ 36px\)/);
  assert.match(styleText, /min-width: calc\(8ch \+ 36px\)/);
  assert.match(styleText, /min-width: calc\(6ch \+ 28px\)/);
  assert.match(styleText, /white-space: nowrap/);
  assert.match(styleText, /inner-spin-button/);
  assert.equal(styleText.includes("-webkit-appearance: none"), false);
});

test("a second pass does not add another cell", () => {
  const page = auditPage();
  const first = piles.placeWorkspace(page.doc);
  const second = piles.placeWorkspace(page.doc);
  assert.equal(first, second);
  assert.equal(page.row.children.filter((node) => node.id === piles.CELL_ID).length, 1);
  assert.equal(page.row.children[2].id, "problem-solve");
  assert.equal(page.row.children[3].id, "exceptions");
  assert.equal(page.doc.getElementById(piles.BODY_ID).children.filter((node) => node.id === "ont-piles-eos").length, 1);
});

test("the header column is the nearest full-width column", () => {
  const page = auditPage();
  const outer = makeEl("div");
  outer.className = "col-md-12";
  page.header.parentElement.insertBefore(outer, page.header);
  outer.appendChild(page.header);
  assert.equal(piles.headerColumn(page.doc), page.header);

  const cell = piles.placeWorkspace(page.doc);
  assert.equal(cell.parentElement, outer);
  assert.equal(outer.children[0], page.header);
  assert.equal(outer.children[1], cell);
});

test("no header means no cell", () => {
  const doc = makeDoc();
  assert.equal(piles.headerColumn(doc), null);
  assert.equal(piles.placeWorkspace(doc), null);
  assert.equal(doc.getElementById(piles.CELL_ID), null);
});

test("the screenshot counts become the EOS total", () => {
  assert.equal(piles.RATES.pallet, 20);
  assert.equal(piles.RATES.cage, 15);
  assert.equal(piles.RATES.shuttle, 100);
  assert.equal(piles.RATES.sortablePallet, 150);
  assert.equal(piles.RATES.tote, 5);
  const state = piles.blankState();
  state.bigs.problemSolve.cages = 1;
  state.sortable.addIns.totes = 15;
  const result = piles.compute(state);
  assert.equal(result.bigs.problemSolve.cageUnits, 15);
  assert.equal(result.bigs.problemSolve.units, 15);
  assert.equal(result.sortable.addIns.toteUnits, 75);
  assert.equal(result.sortable.addIns.units, 75);
  assert.equal(result.eos.addIns, 75);
  assert.equal(result.eos.ps, 15);
  assert.equal(result.eos.exceptions, 0);
  assert.equal(result.eos.total, 90);
});

test("shuttles count for Add Ins only, and the other BIGS rows stay out", () => {
  const state = piles.blankState();
  state.bigs.problemSolve.shuttles = 1;
  state.bigs.exceptions.shuttles = 2;
  state.bigs.addIns.shuttles = 1;
  state.bigs.addIns.pallets = 2;
  state.bigs.misships.pallets = 4;
  state.bigs.arBigs.cages = 6;
  state.sortable.problemSolve.pallets = 1;
  state.sortable.exceptions.totes = 2;
  state.sortable.addIns.pallets = 1;
  const result = piles.compute(state);
  assert.equal(result.bigs.problemSolve.units, 100);
  assert.equal(result.eos.ps, 150);
  assert.equal(result.bigs.exceptions.units, 200);
  assert.equal(result.eos.exceptions, 10);
  assert.equal(result.bigs.addIns.units, 40 + 100);
  assert.equal(result.sortable.addIns.units, 150);
  assert.equal(result.eos.addIns, 140 + 150);
  assert.equal(result.bigs.misships.units, 80);
  assert.equal(result.bigs.arBigs.units, 90);
  assert.equal(result.eos.total, 150 + 10 + 290);
  assert.equal(piles.compute({ bigs: { problemSolve: { pallets: "2", cages: -4, shuttles: "x" } } }).eos.ps, 40);
});

function memoryStorage() {
  const data = {};
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    }
  };
}

test("typing the screenshot counts updates the outputs and keeps them", () => {
  const storage = memoryStorage();
  const href = "https://ont-base.corp.amazon.com/en/MEM3/icqa/piles/audit?audit_shift=Days&audit_number=1";
  const page = auditPage();
  const report = makeEl("a");
  report.setAttribute("href", "/en/MEM3/icqa/piles/report?audit_date=2026-11-21&audit_number=1&audit_shift=Days");
  page.doc.body.appendChild(report);
  page.doc.querySelector = (selector) => page.doc.body.querySelector(selector);

  piles.placeWorkspace(page.doc, { href, storage });
  assert.equal(piles.auditKey(page.doc, href), "ont-piles-eos:2026-11-21:Days:1");
  page.doc.getElementById("ont-piles-in-bigs-problemSolve-cages").value = "1";
  page.doc.getElementById("ont-piles-in-sortable-addIns-totes").value = "15";
  page.doc.getElementById("ont-piles-in-sortable-addIns-totes").dispatch("input");

  assert.equal(page.doc.getElementById("ont-piles-out-bigs-problemSolve-units").textContent, "15");
  assert.equal(page.doc.getElementById("ont-piles-out-sortable-addIns-units").textContent, "75");
  assert.equal(page.doc.getElementById("ont-piles-out-eos-addIns").textContent, "75");
  assert.equal(page.doc.getElementById("ont-piles-out-eos-ps").textContent, "15");
  assert.equal(page.doc.getElementById("ont-piles-out-eos-exceptions").textContent, "0");
  assert.equal(page.doc.getElementById("ont-piles-out-eos-total").textContent, "90");

  const again = auditPage();
  const reportAgain = makeEl("a");
  reportAgain.setAttribute("href", report.getAttribute("href"));
  again.doc.body.appendChild(reportAgain);
  again.doc.querySelector = (selector) => again.doc.body.querySelector(selector);
  piles.placeWorkspace(again.doc, { href, storage });
  assert.equal(again.doc.getElementById("ont-piles-in-bigs-problemSolve-cages").value, "1");
  assert.equal(again.doc.getElementById("ont-piles-in-sortable-addIns-totes").value, "15");
  assert.equal(again.doc.getElementById("ont-piles-out-eos-total").textContent, "90");
});
