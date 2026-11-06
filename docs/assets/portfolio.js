(function () {
  var rowsEl = document.getElementById("project-rows");
  var search = document.getElementById("project-search");
  var countEl = document.getElementById("project-count");
  var emptyEl = document.getElementById("project-empty");
  var catalogById = {};
  var openId = "";

  function text(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  }

  function setOpen(id, fromHash) {
    var next = id || "";
    document.querySelectorAll(".project-item").forEach(function (item) {
      var on = !!next && item.getAttribute("data-project") === next;
      item.classList.toggle("is-open", on);
      var button = item.querySelector(".project-row");
      if (button) button.setAttribute("aria-expanded", on ? "true" : "false");
    });
    openId = next;
    if (!fromHash) {
      var wanted = next ? "#" + next : "";
      if (wanted !== location.hash) {
        history.replaceState(null, "", next ? wanted : location.pathname + location.search);
      }
    }
    if (next) {
      var item = document.getElementById(next);
      if (item) item.scrollIntoView({ block: "start" });
    }
  }

  function toggle(id) {
    setOpen(openId === id ? "" : id, false);
  }

  function metaRow(label, value) {
    var row = document.createElement("div");
    row.appendChild(text("dt", "", label));
    row.appendChild(text("dd", "", value || "—"));
    return row;
  }

  function scriptItem(entry) {
    var item = document.createElement("div");
    item.className = "project-item";
    item.id = entry.id;
    item.setAttribute("data-project", entry.id);
    item.setAttribute("role", "listitem");

    var button = document.createElement("button");
    button.type = "button";
    button.className = "project-row";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "detail-" + entry.id);
    var body = document.createElement("span");
    body.className = "project-row-body";
    body.appendChild(text("span", "project-cat", entry.category));
    body.appendChild(text("span", "project-row-name", entry.name));
    body.appendChild(text("span", "project-row-desc", entry.summary));
    button.appendChild(body);
    button.appendChild(text("span", "status status-live", "Script"));
    var chevron = document.createElement("span");
    chevron.className = "project-row-go";
    chevron.setAttribute("aria-hidden", "true");
    button.appendChild(chevron);

    var panel = document.createElement("div");
    panel.className = "project-detail";
    panel.id = "detail-" + entry.id;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", entry.name);

    var head = document.createElement("header");
    head.className = "project-doc-head";
    var copy = document.createElement("div");
    copy.appendChild(text("p", "project-cat", entry.category));
    copy.appendChild(text("h2", "", entry.name));
    copy.appendChild(text("p", "", entry.detail));
    head.appendChild(copy);
    var link = document.createElement("a");
    link.className = "btn btn-primary";
    link.href = entry.file + "?v=" + encodeURIComponent(entry.version || "");
    link.setAttribute("download", entry.downloadName);
    link.textContent = "Download .txt";
    head.appendChild(link);

    var note = text("p", "script-download-note", "The download is the Tampermonkey script saved as a .txt file.");
    var meta = document.createElement("dl");
    meta.className = "script-meta";
    meta.appendChild(metaRow("Version", entry.version));
    meta.appendChild(metaRow("Runs on", entry.runsOn));

    panel.appendChild(head);
    panel.appendChild(note);
    panel.appendChild(meta);
    item.appendChild(button);
    item.appendChild(panel);
    return item;
  }

  function applyFilter() {
    var q = (search && search.value || "").trim().toLowerCase();
    var shown = 0;
    document.querySelectorAll(".project-item").forEach(function (item) {
      var ok = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
      item.classList.toggle("is-filtered", !ok);
      if (ok) shown += 1;
    });
    if (emptyEl) emptyEl.classList.toggle("hidden", shown !== 0);
    if (countEl) {
      var total = document.querySelectorAll(".project-item").length;
      countEl.textContent = q ? (shown + " of " + total + " projects") : (total + " projects");
    }
  }

  function openFromHash() {
    var hash = location.hash.replace(/^#/, "");
    if (!hash) {
      if (openId) setOpen("", true);
      return;
    }
    if (hash === "rig-setup" || catalogById[hash]) setOpen(hash, true);
  }

  function bind() {
    if (rowsEl) {
      rowsEl.addEventListener("click", function (event) {
        var row = event.target.closest(".project-row");
        if (!row || !rowsEl.contains(row)) return;
        var item = row.closest(".project-item");
        if (!item) return;
        toggle(item.getAttribute("data-project"));
      });
    }
    if (search) search.addEventListener("input", applyFilter);
  }

  bind();
  if (location.hash === "#rig-setup") setOpen("rig-setup", true);

  fetch("data/tampermonkey.json", { cache: "no-store" })
    .then(function (response) { return response.json(); })
    .then(function (projects) {
      projects.forEach(function (entry) {
        catalogById[entry.id] = entry;
        if (!entry.file || !/\.txt($|\?)/.test(entry.file) || !/\.txt$/.test(entry.downloadName)) return;
        rowsEl.appendChild(scriptItem(entry));
      });
      applyFilter();
      openFromHash();
    })
    .catch(function () {
      if (countEl) countEl.textContent = "Could not load the script list.";
    });

  window.addEventListener("hashchange", openFromHash);
})();
