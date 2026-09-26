(function () {
  var projectsPanel = document.getElementById("panel-projects");
  var rowsEl = document.getElementById("project-rows");
  var sheet = document.querySelector(".project-sheet");
  var search = document.getElementById("project-search");
  var countEl = document.getElementById("project-count");
  var emptyEl = document.getElementById("project-empty");
  var rigTab = document.getElementById("rig-setup");
  var scriptTab = document.getElementById("script-tab");
  var catalogById = {};

  function showTab(id) {
    var entry = catalogById[id];
    var project = id && id !== "projects";
    if (entry) fillScript(entry);
    if (projectsPanel) projectsPanel.classList.toggle("hidden", !!project);
    document.querySelectorAll(".project-detail").forEach(function (panel) {
      var show = false;
      if (id === "rig-setup") show = panel.id === "project-rig-setup";
      else if (entry) show = panel.id === "project-script";
      panel.classList.toggle("hidden", !show);
    });
    if (id === "rig-setup" && rigTab) {
      rigTab.classList.remove("hidden");
      if (scriptTab) scriptTab.classList.add("hidden");
    } else if (entry && scriptTab) {
      scriptTab.classList.remove("hidden");
      scriptTab.setAttribute("data-tab", id);
      scriptTab.textContent = entry.name;
      if (rigTab) rigTab.classList.add("hidden");
    }
    document.querySelectorAll(".project-tab").forEach(function (tab) {
      var on = tab.getAttribute("data-tab") === (project ? id : "projects");
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll(".project-row").forEach(function (row) {
      row.classList.toggle("selected", row.getAttribute("data-project") === id);
    });
    if (project) {
      if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    } else if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    if (project && sheet) sheet.scrollIntoView({ block: "start" });
  }

  function fillScript(entry) {
    document.getElementById("script-category").textContent = entry.category;
    document.getElementById("script-name").textContent = entry.name;
    document.getElementById("script-detail").textContent = entry.detail;
    document.getElementById("script-version").textContent = entry.version || "—";
    document.getElementById("script-runs").textContent = entry.runsOn || "—";
    var link = document.getElementById("script-download");
    link.href = entry.file;
    link.setAttribute("download", entry.downloadName);
  }

  function rowButton(entry) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "project-row";
    button.setAttribute("data-project", entry.id);
    button.setAttribute("role", "listitem");
    button.innerHTML =
      '<span class="project-row-body">' +
        '<span class="project-cat"></span>' +
        '<span class="project-row-name"></span>' +
        '<span class="project-row-desc"></span>' +
      '</span>' +
      '<span class="status status-live">Script</span>' +
      '<span class="project-row-go" aria-hidden="true">&rarr;</span>';
    button.querySelector(".project-cat").textContent = entry.category;
    button.querySelector(".project-row-name").textContent = entry.name;
    button.querySelector(".project-row-desc").textContent = entry.summary;
    return button;
  }

  function applyFilter() {
    var q = (search && search.value || "").trim().toLowerCase();
    var shown = 0;
    document.querySelectorAll(".project-row").forEach(function (row) {
      var ok = !q || row.textContent.toLowerCase().indexOf(q) !== -1;
      row.classList.toggle("is-filtered", !ok);
      if (ok) shown += 1;
    });
    if (emptyEl) emptyEl.classList.toggle("hidden", shown !== 0);
    if (countEl) {
      var total = document.querySelectorAll(".project-row").length;
      countEl.textContent = q ? (shown + " of " + total + " projects") : (total + " projects");
    }
  }

  function bind() {
    if (rowsEl) {
      rowsEl.addEventListener("click", function (event) {
        var row = event.target.closest(".project-row");
        if (!row) return;
        showTab(row.getAttribute("data-project"));
      });
    }
    document.querySelectorAll(".project-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        showTab(tab.getAttribute("data-tab") || "projects");
      });
    });
    if (search) search.addEventListener("input", applyFilter);
  }

  bind();

  fetch("data/tampermonkey.json")
    .then(function (response) { return response.json(); })
    .then(function (projects) {
      projects.forEach(function (entry) {
        catalogById[entry.id] = entry;
        if (!entry.file || !/\.txt($|\?)/.test(entry.file) || !/\.txt$/.test(entry.downloadName)) return;
        rowsEl.appendChild(rowButton(entry));
      });
      applyFilter();
      var hash = location.hash.replace("#", "");
      if (hash && catalogById[hash]) showTab(hash);
      else if (hash === "rig-setup") showTab(hash);
    })
    .catch(function () {
      if (countEl) countEl.textContent = "Could not load the script list.";
    });

  if (location.hash === "#rig-setup") showTab("rig-setup");

  window.addEventListener("hashchange", function () {
    var hash = location.hash.replace("#", "");
    if (!hash) showTab("projects");
    else if (hash === "rig-setup" || catalogById[hash]) showTab(hash);
  });
})();
