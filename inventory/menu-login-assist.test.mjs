import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const panel = fs.readFileSync(new URL("docs/downloads/mem3-productivity-panel.txt", root), "utf8");
const lineFlush = fs.readFileSync(new URL("docs/downloads/peculiar-line-flush.txt", root), "utf8");

const MAASK_URL = "https://oidc.prod.na.maask.amazonoperations.com/authentication/index.html?next=%2Fauthorization";
const LOCATION_URL = "https://menu.na.aft.amazonoperations.app/location";

function boot(src, href) {
  const redirects = [];
  const sandbox = {
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
    setTimeout() { return 0; },
    setInterval() { return 0; },
    clearTimeout() {},
    clearInterval() {},
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    document: {
      documentElement: {},
      addEventListener() {},
      removeEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() {
        return { style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {} };
      },
    },
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
    },
    location: {
      href,
      hostname: new URL(href).hostname,
      pathname: new URL(href).pathname,
      replace(url) { redirects.push(url); },
    },
  };
  sandbox.window = sandbox;
  sandbox.top = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.unsafeWindow = sandbox;
  sandbox.addEventListener = function () {};
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "menu-login-assist.js" });
  return redirects;
}

for (const src of [panel, lineFlush]) {
  const redirects = boot(src, MAASK_URL);
  assert.equal(redirects.length, 1, "MAASK page should open the IT login chooser");
  assert.match(redirects[0], /^https:\/\/d34wrqb3xn2znf\.cloudfront\.net\/idp-selection\?/);
  const stayed = boot(src, LOCATION_URL);
  assert.deepEqual(stayed, [], "the location page is not redirected by the script");
}
