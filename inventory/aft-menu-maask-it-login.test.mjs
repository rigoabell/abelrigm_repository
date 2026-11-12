import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const src = fs.readFileSync(new URL("docs/downloads/aft-menu-maask-it-login.txt", root), "utf8");
const catalog = JSON.parse(fs.readFileSync(new URL("docs/data/tampermonkey.json", root), "utf8"));

const MAASK_URL = "https://oidc.prod.na.maask.amazonoperations.com/authentication/index.html?next=%2Fauthorization%3Fclient_id%3Dfit%26redirect_uri%3Dhttps%253A%252F%252Fprod.us-east-1.federated-auth.aft.a2z.com%252F1545ed74-d2cd-11ec-9d64-0242ac120002%252Fcallback%26response_type%3Dcode%26scope%3Dopenid%26nonce%3Dnonce%26state%3Df90b888b-250d-4bb2-8f56-c5de7e2a14b4%26ui_locales%3Den-US%26relying_party%3Dfc-menu-prod-na";
const LOCATION_URL = "https://menu.na.aft.amazonoperations.app/location";

const sandbox = {
  __aftMenuNoBoot: true,
  console,
  URL,
  Date,
  Number,
  String,
  Object,
  Array,
  Error,
  TypeError,
  Promise,
  RegExp,
  JSON,
  setTimeout,
  KeyboardEvent: class KeyboardEvent {
    constructor(type, init) {
      this.type = type;
      this.key = init && init.key || "";
      this.code = init && init.code || "";
      this.keyCode = init && init.keyCode;
      this.bubbles = !!(init && init.bubbles);
    }
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "aft-menu-maask-it-login.txt" });
const api = sandbox.__aftMenu;

function memoryStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
  };
}

function makeEl(tag, opts) {
  const el = {
    tagName: String(tag).toUpperCase(),
    className: (opts && opts.className) || "",
    role: (opts && opts.role) || "",
    textContent: (opts && opts.text) || "",
    children: [],
    parent: null,
    dataset: {},
    shadowRoot: null,
    clicked: 0,
  };
  Object.defineProperty(el, "innerText", {
    get() {
      if (el.children.length) return el.children.map((child) => child.innerText).join("");
      return el.textContent;
    },
  });
  el.click = function () {
    el.clicked += 1;
  };
  el.matches = function (selector) {
    return selector.split(",").some((part) => {
      const sel = part.trim();
      if (sel === el.tagName.toLowerCase()) return true;
      if (sel.charAt(0) === "." && el.className.split(/\s+/).includes(sel.slice(1))) return true;
      if (sel === '[role="button"]' || sel === "[role='button']") return el.role === "button";
      return false;
    });
  };
  el.closest = function (selector) {
    let node = el;
    while (node) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parent;
    }
    return null;
  };
  el.querySelector = function (selector) {
    const all = el.querySelectorAll(selector);
    return all.length ? all[0] : null;
  };
  el.querySelectorAll = function (selector) {
    const out = [];
    function walk(node) {
      node.children.forEach((child) => {
        if (child.matches(selector)) out.push(child);
        walk(child);
      });
    }
    walk(el);
    return out;
  };
  ((opts && opts.children) || []).forEach((child) => {
    child.parent = el;
    el.children.push(child);
  });
  if (opts && opts.shadowRoot) el.shadowRoot = opts.shadowRoot;
  return el;
}

assert.match(src, /@name\s+AFT Menu MAASK bypass \(abelrigm\)/);
assert.match(src, /@version\s+1\.0\.0/);
assert.match(src, /@match\s+https:\/\/oidc\.prod\.na\.maask\.amazonoperations\.com\/authentication\*/);
assert.match(src, /@match\s+https:\/\/\*\.cloudfront\.net\/idp-selection\*/);
assert.match(src, /@match\s+https:\/\/menu\.na\.aft\.amazonoperations\.app\/\*/);
assert.equal(src.includes("location.replace('https://menu"), false);
assert.match(src, /location\.replace\(target\)/);

const entry = catalog.find((item) => item.id === "aft-menu-maask-it-login");
assert.ok(entry);
assert.equal(entry.version, "1.0.0");
assert.equal(entry.category, "FC Menu");
assert.equal(entry.name, "AFT Menu MAASK bypass (abelrigm)");
assert.equal(entry.file, "downloads/aft-menu-maask-it-login.txt");
assert.equal(entry.downloadName, "AFT Menu MAASK bypass (abelrigm).txt");
assert.match(entry.summary, /MEM3/);
assert.match(entry.detail, /IT Service Login/);
assert.match(entry.detail, /presses Enter/);
assert.equal(fs.existsSync(new URL("docs/" + entry.file, root)), true);

assert.equal(api.isMaaskAuth(MAASK_URL), true);
assert.equal(api.isMaaskAuth("https://oidc.prod.eu.maask.amazonoperations.com/authentication/index.html"), true);
assert.equal(api.isMaaskAuth("https://oidc.prod.na.maask.amazonoperations.com/other"), false);
assert.equal(api.isMaaskAuth("https://menu.na.aft.amazonoperations.app/authentication/index.html"), false);
assert.equal(api.isIdpSelection(api.IDP_SELECTION_URL), true);
assert.equal(api.isIdpSelection(MAASK_URL), false);
assert.equal(api.isLocationPage(LOCATION_URL), true);
assert.equal(api.isLocationPage(LOCATION_URL + "/"), true);
assert.equal(api.isLocationPage(LOCATION_URL + "?ready=1"), true);
assert.equal(api.isLocationPage("https://menu.na.aft.amazonoperations.app/midway/login"), false);

const chooser = new URL(api.IDP_SELECTION_URL);
const data = JSON.parse(chooser.searchParams.get("data"));
assert.equal(chooser.hostname, "d34wrqb3xn2znf.cloudfront.net");
assert.equal(chooser.pathname, "/idp-selection");
assert.equal(data[0].id, "amazon-federate-prod");
assert.equal(data[0].displayString, "IT Service Login");
assert.equal(data[1].id, "maask-prod-na");
assert.equal(data[1].displayString, "Login with MAASK");
assert.equal(chooser.searchParams.get("client_id"), "fc-menu-prod-na");
assert.equal(api.LOCATION_CODE, "MEM3");

const emptyStore = memoryStorage();
assert.equal(api.idpTarget(emptyStore), api.IDP_SELECTION_URL);
api.rememberIdp(MAASK_URL, emptyStore);
assert.equal(api.idpTarget(emptyStore), api.IDP_SELECTION_URL);
const fresh = "https://abc.cloudfront.net/idp-selection?nonce=fresh";
api.rememberIdp(fresh, emptyStore);
assert.equal(api.idpTarget(emptyStore), fresh);

const stampStore = memoryStorage();
assert.equal(api.shouldRedirect(MAASK_URL, stampStore, 100000), true);
assert.equal(api.shouldRedirect(LOCATION_URL, stampStore, 100000), false);
api.markRedirect(stampStore, 100000);
assert.equal(api.shouldRedirect(MAASK_URL, stampStore, 100000 + api.REDIRECT_GAP_MS - 1), false);
assert.equal(api.shouldRedirect(MAASK_URL, stampStore, 100000 + api.REDIRECT_GAP_MS), true);

const itSpan = makeEl("span", { className: "button__label", text: "IT Service Login" });
const itBtn = makeEl("alchemy-button", { children: [itSpan] });
const maaskSpan = makeEl("span", { className: "button__label", text: "Login with MAASK" });
const maaskBtn = makeEl("alchemy-button", { children: [maaskSpan] });
const chooserDom = makeEl("div", { children: [maaskBtn, itBtn] });
assert.equal(api.clickItServiceLogin(chooserDom), true);
assert.equal(itBtn.clicked, 1);
assert.equal(itSpan.clicked, 0);
assert.equal(maaskBtn.clicked, 0);
assert.equal(maaskSpan.clicked, 0);
assert.equal(api.clickItServiceLogin(chooserDom), true);
assert.equal(itBtn.clicked, 1);

const onlyMaask = makeEl("div", {
  children: [makeEl("alchemy-button", { children: [makeEl("span", { className: "button__label", text: "Login with MAASK" })] })],
});
assert.equal(api.clickItServiceLogin(onlyMaask), false);

const inner = makeEl("button", { text: "IT Service Login" });
const shadow = makeEl("div", { children: [inner] });
const host = makeEl("alchemy-button", { shadowRoot: shadow });
const shadowRoot = makeEl("div", { children: [host] });
assert.equal(api.clickItServiceLogin(shadowRoot), true);
assert.equal(inner.clicked, 1);
assert.equal(host.clicked, 0);

const values = [];
const input = {
  value: "old",
  dataset: {},
  focus() {
    this.focused = true;
  },
  dispatchEvent(ev) {
    this.events = this.events || [];
    this.events.push(ev);
    return true;
  },
};
await api.typeInto(input, "MEM3", {
  sleep() {
    return Promise.resolve();
  },
  setValue(el, value) {
    el.value = value;
    values.push(value);
  },
});
assert.deepEqual(values, ["", "M", "ME", "MEM", "MEM3"]);
assert.equal(input.focused, true);
api.pressEnter(input);
assert.equal(input.events.some((ev) => ev.type === "keydown" && ev.key === "Enter"), true);
assert.equal(input.events.some((ev) => ev.type === "keyup" && ev.key === "Enter"), true);

const redirects = [];
const saved = {};
const bootSandbox = {
  console,
  URL,
  Date,
  Number,
  String,
  Object,
  Array,
  Promise,
  RegExp,
  JSON,
  setTimeout() {
    return 0;
  },
  location: {
    href: MAASK_URL,
    replace(url) {
      redirects.push(url);
    },
  },
  sessionStorage: {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] : null;
    },
    setItem(key, value) {
      saved[key] = String(value);
    },
  },
};
bootSandbox.globalThis = bootSandbox;
vm.createContext(bootSandbox);
vm.runInContext(src, bootSandbox, { filename: "aft-menu-maask-it-login.txt" });
assert.deepEqual(redirects, [api.IDP_SELECTION_URL]);

const locationRedirects = [];
let locationWatching = false;
const locationSandbox = {
  console,
  URL,
  Date,
  Number,
  String,
  Object,
  Array,
  Promise,
  RegExp,
  JSON,
  setTimeout() {
    return 0;
  },
  setInterval() {
    return 0;
  },
  clearInterval() {},
  MutationObserver: class {
    observe() {
      locationWatching = true;
    }
    disconnect() {}
  },
  window: { addEventListener() {} },
  document: {
    documentElement: {},
    addEventListener() {},
    querySelector() {
      return null;
    },
  },
  sessionStorage: {
    getItem() {
      return null;
    },
    setItem() {},
  },
  location: {
    href: LOCATION_URL,
    replace(url) {
      locationRedirects.push(url);
    },
  },
};
locationSandbox.globalThis = locationSandbox;
vm.createContext(locationSandbox);
vm.runInContext(src, locationSandbox, { filename: "aft-menu-maask-it-login.txt" });
assert.deepEqual(locationRedirects, []);
assert.equal(locationWatching, true);
