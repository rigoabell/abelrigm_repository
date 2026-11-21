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

function makeEl(tag) {
  const node = {
    tag: tag,
    id: "",
    className: "",
    textContent: "",
    children: [],
    parentElement: null,
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = String(value);
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
  assert.match(src, /@version\s+1\.0\.0/);
  assert.match(src, /@match\s+https:\/\/ont-base\.corp\.amazon\.com\/\*/);
  assert.match(src, /ont-piles-audit-workspace\.user\.js/);

  const entry = catalog.find((item) => item.id === "ont-piles-audit-workspace");
  assert.ok(entry);
  assert.equal(entry.version, "1.0.0");
  assert.equal(entry.category, "ONT Base");
  assert.equal(entry.file, "downloads/ont-piles-audit-workspace.txt");
  assert.equal(entry.downloadName, "ONT Base Piles Audit Workspace (abelrigm).txt");
  assert.equal(entry.runsOn, "ont-base.corp.amazon.com");
  assert.match(entry.summary, /workspace cell/);
  assert.match(entry.detail, /Audit Is Complete/);
  assert.match(entry.detail, /Problem Solve/);
  assert.equal(fs.existsSync(new URL("docs/" + entry.file, root)), true);
  assert.equal(piles.VERSION, "1.0.0");

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
  assert.equal(card.children[0].textContent, "Workspace");
  const surface = page.doc.getElementById(piles.BODY_ID);
  assert.equal(surface.textContent, "");
  assert.equal(surface.attrs["data-work-surface"], "1");
  assert.equal(surface.parentElement, card);
  assert.match(page.doc.getElementById("ont-piles-workspace-style").textContent, /min-height: 180px/);
});

test("a second pass does not add another cell", () => {
  const page = auditPage();
  const first = piles.placeWorkspace(page.doc);
  const second = piles.placeWorkspace(page.doc);
  assert.equal(first, second);
  assert.equal(page.row.children.filter((node) => node.id === piles.CELL_ID).length, 1);
  assert.equal(page.row.children[2].id, "problem-solve");
  assert.equal(page.row.children[3].id, "exceptions");
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
