"use strict";
// Shared across all pages: injects identity into the header and highlights nav.
(function () {
  var S = window.SITE || {};

  function set(id, fn) {
    var el = document.getElementById(id);
    if (el) fn(el);
  }

  // Identity in the top-right of every page (and any avatar on the page).
  document.querySelectorAll("[data-avatar]").forEach(function (el) {
    if (S.avatar) { el.src = S.avatar; el.alt = S.name || S.login || ""; }
  });
  set("id-name", function (el) { el.textContent = S.name || S.login || ""; });
  set("id-login", function (el) {
    el.textContent = S.login ? "@" + S.login : "";
    if (S.loginUrl && el.tagName === "A") el.href = S.loginUrl;
  });

  // Any element that wants the profile/repo/pages URLs.
  document.querySelectorAll("[data-href='repo']").forEach(function (a) { a.href = S.repoUrl; });
  document.querySelectorAll("[data-href='profile']").forEach(function (a) { a.href = S.profileUrl; });
  document.querySelectorAll("[data-href='login']").forEach(function (a) { if (S.loginUrl) a.href = S.loginUrl; });
  document.querySelectorAll("[data-text='name']").forEach(function (e) { e.textContent = S.name || S.login || ""; });
  document.querySelectorAll("[data-text='login']").forEach(function (e) {
    var label = S.login ? "@" + S.login : "";
    e.textContent = label;
    if (!S.loginUrl || !label || e.closest("a")) return;
    var a = document.createElement("a");
    a.href = S.loginUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = label;
    e.replaceWith(a);
  });
  document.querySelectorAll("[data-text='role']").forEach(function (e) { e.textContent = S.role || ""; });

  // Active nav item based on <body data-page="...">.
  var page = document.body.getAttribute("data-page");
  if (page) {
    var link = document.querySelector('.topnav-links a[data-nav="' + page + '"]');
    if (link) link.classList.add("active");
  }

  // Footer year.
  set("year", function (el) { el.textContent = new Date().getFullYear(); });

  // Fill the tool count from the shared catalog wherever #stat-tools appears.
  if (document.getElementById("stat-tools")) {
    fetch("data/tools.json", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var el = document.getElementById("stat-tools");
        if (el && d && d.count) el.textContent = d.count;
      })
      .catch(function () {});
  }
})();
