import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const src = fs.readFileSync(new URL("docs/downloads/fclm-highlighter.user.js", root), "utf8");
const published = fs.readFileSync(new URL("docs/downloads/fclm-highlighter.txt", root), "utf8");
assert.equal(published, src);
assert.match(src, /@version\s+2\.1/);
assert.match(src, /fclm-highlighter-copy-debug/);
assert.match(src, /Copy debug/);
assert.match(src, /raw\.githubusercontent\.com\/rigoabell\/abelrigm_repository\/main\/docs\/downloads\/fclm-highlighter\.user\.js/);

const catalog = JSON.parse(fs.readFileSync(new URL("docs/data/tampermonkey.json", root), "utf8"));
const entry = catalog.find((item) => item.id === "fclm-highlighter");
assert.equal(entry.version, "2.1");
assert.equal(entry.file, "downloads/fclm-highlighter.txt");
assert.match(entry.detail, /Copy debug/);
assert.equal(entry.runsOn, "fclm-portal.amazon.com");

function createElement(tag) {
    const node = {
        tagName: String(tag).toUpperCase(),
        id: "",
        className: "",
        type: "",
        checked: false,
        title: "",
        value: "",
        innerText: "",
        textContent: "",
        innerHTML: "",
        style: {},
        parentNode: null,
        attributes: {},
        childNodes: [],
        children: [],
        listeners: {},
    };
    node.classList = {
        add() {
            const set = node.className.split(/\s+/).filter(Boolean);
            for (let i = 0; i < arguments.length; i++) {
                if (!set.includes(arguments[i])) set.push(arguments[i]);
            }
            node.className = set.join(" ");
        },
        remove() {
            const drop = new Set(arguments);
            node.className = node.className.split(/\s+/).filter((name) => name && !drop.has(name)).join(" ");
        },
        contains(name) {
            return node.className.split(/\s+/).includes(name);
        },
    };
    node.appendChild = (child) => {
        child.parentNode = node;
        node.childNodes.push(child);
        node.children.push(child);
        return child;
    };
    node.append = function () {
        for (let i = 0; i < arguments.length; i++) node.appendChild(arguments[i]);
    };
    node.removeChild = (child) => {
        node.childNodes = node.childNodes.filter((item) => item !== child);
        node.children = node.children.filter((item) => item !== child);
        if (child) child.parentNode = null;
        return child;
    };
    node.setAttribute = (key, value) => {
        node.attributes[key] = String(value);
        if (key === "id") node.id = String(value);
        if (key === "class") node.className = String(value);
    };
    node.addEventListener = (type, fn) => {
        (node.listeners[type] || (node.listeners[type] = [])).push(fn);
    };
    node.remove = () => {
        if (node.parentNode) node.parentNode.removeChild(node);
    };
    node.select = () => {};
    Object.defineProperty(node, "lastElementChild", {
        get() { return node.children[node.children.length - 1] || null; },
    });
    Object.defineProperty(node, "lastChild", {
        get() { return node.childNodes[node.childNodes.length - 1] || null; },
    });
    node.querySelector = (sel) => queryAll(node, sel)[0] || null;
    node.querySelectorAll = (sel) => queryAll(node, sel);
    return node;
}

function descendants(root) {
    const out = [];
    const kids = root.childNodes || [];
    for (const kid of kids) {
        if (!kid || !kid.tagName) continue;
        out.push(kid);
        out.push(...descendants(kid));
    }
    return out;
}

function matchCompound(el, compound) {
    const parts = compound.match(/([.#][\w-]+|\[[^\]]+\]|[A-Za-z][\w-]*)/g);
    if (!parts || parts.join("") !== compound) return false;
    for (const part of parts) {
        if (part[0] === ".") {
            if (!el.classList.contains(part.slice(1))) return false;
        } else if (part[0] === "#") {
            if (el.id !== part.slice(1)) return false;
        } else if (part[0] === "[") {
            const attr = /^\[([\w-]+)(?:=(["']?)([^"'\]]*)\2)?\]$/.exec(part);
            if (!attr) return false;
            const actual = attr[1] === "type" ? el.type : el.attributes[attr[1]];
            if (String(actual == null ? "" : actual) !== String(attr[3] == null ? "" : attr[3])) return false;
        } else if (String(el.tagName || "").toLowerCase() !== part.toLowerCase()) {
            return false;
        }
    }
    return true;
}

function queryAll(root, selector) {
    const unions = String(selector).split(",").map((item) => item.trim()).filter(Boolean);
    const seen = new Set();
    const results = [];
    for (const union of unions) {
        let current = [root];
        for (const step of union.split(/\s+/)) {
            const pool = [];
            for (const node of current) pool.push(...descendants(node));
            current = pool.filter((el) => matchCompound(el, step));
        }
        for (const el of current) {
            if (seen.has(el)) continue;
            seen.add(el);
            results.push(el);
        }
    }
    return results;
}

function byId(root, id) {
    for (const el of descendants(root)) if (el.id === id) return el;
    return null;
}

function fire(el, type) {
    for (const fn of el.listeners[type] || []) fn.call(el, { preventDefault() {}, stopPropagation() {} });
}

function boot(url, prepare) {
    const body = createElement("body");
    const store = new Map();
    const copied = [];
    const commands = [];
    const styles = [];
    const waits = [];
    const document = {
        URL: url,
        body,
        documentElement: body,
        childNodes: [body],
        children: [body],
        readyState: "complete",
        createElement,
        getElementById(id) { return byId(document, id); },
        querySelector(sel) { return queryAll(document, sel)[0] || null; },
        querySelectorAll(sel) { return queryAll(document, sel); },
        getElementsByTagName(tag) { return queryAll(document, tag); },
        execCommand() { return false; },
    };
    body.parentNode = document;
    const sandbox = {
        document,
        location: new URL(url),
        localStorage: {
            get length() { return store.size; },
            key(index) { return Array.from(store.keys())[index] || null; },
            getItem(key) { return store.has(String(key)) ? store.get(String(key)) : null; },
            setItem(key, value) { store.set(String(key), String(value)); },
            removeItem(key) { store.delete(String(key)); },
        },
        navigator: { clipboard: { writeText() { return Promise.reject(new Error("unused")); } } },
        console: { log() {}, error() {} },
        setTimeout() { return 0; },
        GM_addStyle(css) { styles.push(css); },
        GM_setClipboard(text) { copied.push(String(text)); },
        GM_registerMenuCommand(name, fn) { commands.push({ name, fn }); },
        GM_info: { script: { version: "2.1" } },
        waitForKeyElements(selector, fn) { waits.push({ selector, fn }); },
        copied,
        commands,
        styles,
        waits,
    };
    if (prepare) prepare(sandbox);
    vm.runInNewContext(src, sandbox, { filename: "fclm-highlighter.user.js" });
    return sandbox;
}

function cell(className, text) {
    const node = createElement("td");
    node.className = className;
    node.innerText = text;
    node.textContent = text;
    return node;
}

function rollupPage() {
    const ratioA = cell("numeric ratioToPlan ratio", "110");
    const ratioB = cell("numeric ratioToPlan ratio", "90");
    const rowA = createElement("tr");
    rowA.id = "row-a";
    rowA.className = "lineItem";
    rowA.appendChild(cell("", "Pick"));
    rowA.appendChild(ratioA);
    const rowB = createElement("tr");
    rowB.id = "row-b";
    rowB.className = "lineItem";
    rowB.appendChild(cell("", "Pack"));
    rowB.appendChild(ratioB);
    const headTop = createElement("tr");
    headTop.appendChild(cell("", "group"));
    const headLabels = createElement("tr");
    const ratioHead = createElement("th");
    ratioHead.innerText = "Ratio";
    ratioHead.textContent = "Ratio";
    headLabels.appendChild(ratioHead);
    const thead = createElement("thead");
    thead.appendChild(headTop);
    thead.appendChild(headLabels);
    const tbody = createElement("tbody");
    tbody.appendChild(rowA);
    tbody.appendChild(rowB);
    const table = createElement("table");
    table.className = "result-table";
    table.appendChild(thead);
    table.appendChild(tbody);
    const header = createElement("div");
    header.id = "fcpn-header";
    return { header, table, rowA, rowB, ratioA, ratioB };
}

const rollupUrl = "https://fclm-portal.amazon.com/reports/processPathRollup?reportFormat=HTML&warehouseId=MEM3";

const happy = boot(rollupUrl, (sandbox) => {
    const page = rollupPage();
    sandbox.document.body.appendChild(page.header);
    sandbox.document.body.appendChild(page.table);
    sandbox.page = page;
});

assert.equal(happy.copied.length, 0);
const button = happy.document.getElementById("fclm-highlighter-copy-debug");
assert.ok(button);
assert.equal(button.parentNode, happy.document.body);
assert.equal(happy.commands.length, 1);
assert.equal(happy.commands[0].name, "Copy debug");
assert.equal(happy.page.rowA.className.includes("highlight"), false);
assert.ok(happy.document.getElementById("visibility"));
assert.ok(happy.styles[0].includes(".highlight"));
assert.equal(happy.page.header.style.position, "sticky");

happy.page.rowA.lastElementChild.lastChild.checked = true;
fire(happy.page.rowA.lastElementChild.lastChild, "change");
assert.equal(happy.page.rowA.lastElementChild.lastChild.checked, true);
assert.ok(happy.page.rowA.classList.contains("highlight"));
assert.ok(happy.page.ratioA.classList.contains("over100"));
assert.equal(happy.localStorage.getItem("highlights_processPathRollup"), JSON.stringify(["row-a"]));

const visibility = happy.document.getElementById("visibility");
visibility.checked = true;
fire(visibility, "click");
assert.equal(happy.page.rowA.classList.contains("hideMe"), false);
assert.ok(happy.page.rowB.classList.contains("hideMe"));

happy.page.rowB.lastElementChild.lastChild.checked = true;
fire(happy.page.rowB.lastElementChild.lastChild, "change");
assert.ok(happy.page.ratioB.classList.contains("under100"));

fire(button, "click");
const payload = JSON.parse(happy.copied.at(-1));
assert.equal(payload.script, "FCLM Highlighter");
assert.equal(payload.version, "2.1");
assert.equal(payload.initStage, "ready");
assert.equal(payload.bootError, null);
assert.equal(payload.page.branch, "processPathRollup");
assert.equal(payload.page.warehouse, "MEM3");
assert.deepEqual(payload.page.regexMatch, { page: "processPathRollup", warehouse: "MEM3" });
assert.deepEqual(payload.highlights.saved, ["row-a", "row-b"]);
assert.deepEqual(payload.highlights.missingFromDom, []);
assert.equal(payload.rows.targeted, 2);
assert.equal(payload.rows.withoutId, 0);
assert.equal(payload.ratios.exactClassCount, 2);
assert.equal(payload.mount.visibilityToggle, true);
assert.equal(payload.mount.stickyHead, true);
assert.equal(payload.census.lineItem, 2);
assert.ok(payload.rows.samples.some((sample) => sample.cells.some((item) => item.text === "110")));

happy.commands[0].fn();
assert.equal(JSON.parse(happy.copied.at(-1)).version, "2.1");

const unmatched = boot("https://fclm-portal.amazon.com/reports/processPathRollup?warehouseId=MEM3", (sandbox) => {
    const page = rollupPage();
    sandbox.document.body.appendChild(page.header);
    sandbox.document.body.appendChild(page.table);
});
assert.ok(unmatched.document.getElementById("fclm-highlighter-copy-debug"));
fire(unmatched.document.getElementById("fclm-highlighter-copy-debug"), "click");
const failed = JSON.parse(unmatched.copied.at(-1));
assert.equal(failed.initStage, "match-url");
assert.equal(failed.page.regexMatch, null);
assert.equal(failed.page.params.warehouseId, "MEM3");
assert.equal(failed.page.pathTail, "processPathRollup");
assert.match(failed.bootError.message, /null/);
assert.equal(unmatched.document.getElementById("visibility"), null);

const stale = boot(rollupUrl, (sandbox) => {
    const page = rollupPage();
    sandbox.document.body.appendChild(page.header);
    sandbox.document.body.appendChild(page.table);
    sandbox.localStorage.setItem("highlights_processPathRollup", JSON.stringify(["missing-row"]));
});
fire(stale.document.getElementById("fclm-highlighter-copy-debug"), "click");
const stalePayload = JSON.parse(stale.copied.at(-1));
assert.equal(stalePayload.initStage, "highlight");
assert.match(stalePayload.bootError.message, /null/);
assert.deepEqual(stalePayload.highlights.saved, ["missing-row"]);
assert.deepEqual(stalePayload.highlights.missingFromDom, ["missing-row"]);

const nodePage = boot("https://fclm-portal.amazon.com/reports/node?span=Intraday&warehouseId=MEM3", (sandbox) => {
    const page = rollupPage();
    sandbox.document.body.appendChild(page.header);
    sandbox.document.body.appendChild(page.table);
    sandbox.page = page;
});
assert.equal(nodePage.page.rowA.id, "ppa.0");
assert.equal(nodePage.page.rowB.id, "ppa.1");
fire(nodePage.document.getElementById("fclm-highlighter-copy-debug"), "click");
const nodePayload = JSON.parse(nodePage.copied.at(-1));
assert.equal(nodePayload.page.branch, "node");
assert.equal(nodePayload.initStage, "ready");
assert.equal(nodePayload.rows.targeted, 2);
