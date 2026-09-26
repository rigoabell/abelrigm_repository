"use strict";
// Client-side "soft gate" for the Admin page on a PUBLIC static site.
// This is obfuscation, not security: everything here is visible in page source.
// Keep nothing sensitive on this page.
(function () {
  var S = window.SITE || {};
  var form = document.getElementById("admin-form");
  if (!form) return;
  var input = document.getElementById("admin-pass");
  var errEl = document.getElementById("admin-error");
  var gate = document.getElementById("admin-gate");
  var panel = document.getElementById("admin-panel");

  async function sha256hex(str) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function initPanel() {
    document.querySelectorAll("[data-admin-link]").forEach(function (a) {
      var kind = a.getAttribute("data-admin-link");
      var base = S.repoUrl || "";
      var map = {
        repo: base,
        actions: base + "/actions",
        pages: base + "/settings/pages",
        readme: base + "/edit/main/README.md",
        newissue: base + "/issues/new",
        deployments: base + "/deployments",
        pageslive: S.pagesUrl,
      };
      if (map[kind]) a.href = map[kind];
    });
    var notes = document.getElementById("admin-notes");
    if (notes) {
      notes.value = localStorage.getItem("admin_notes") || "";
      notes.addEventListener("input", function () {
        localStorage.setItem("admin_notes", notes.value);
        var s = document.getElementById("notes-status");
        if (s) { s.textContent = "Saved locally"; setTimeout(function () { s.textContent = ""; }, 1200); }
      });
    }
  }

  function unlock() {
    if (gate) gate.classList.add("hidden");
    if (panel) panel.classList.remove("hidden");
    initPanel();
  }

  if (sessionStorage.getItem("admin_ok") === "1") unlock();

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (errEl) errEl.textContent = "";
    try {
      var h = await sha256hex(input.value);
      if (h === S.adminHash) {
        sessionStorage.setItem("admin_ok", "1");
        input.value = "";
        unlock();
      } else if (errEl) {
        errEl.textContent = "Incorrect passphrase.";
        input.select();
      }
    } catch (err) {
      if (errEl) errEl.textContent = "This browser blocked the check (needs HTTPS / crypto).";
    }
  });

  var lock = document.getElementById("admin-lock");
  if (lock) lock.addEventListener("click", function () {
    sessionStorage.removeItem("admin_ok");
    location.reload();
  });
})();
