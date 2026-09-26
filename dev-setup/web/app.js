"use strict";

const state = {
  system: null,
  tools: [],
  selected: new Set(),
  job: null,
  offset: 0,
  poll: null,
  filter: "all",
  query: "",
};

const $ = (sel) => document.querySelector(sel);

async function getJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function statusBadge(tool) {
  if (state.job && state.job.statuses[tool.id]) {
    const s = state.job.statuses[tool.id];
    if (s === "installing") return `<span class="badge installing">Installing&hellip;</span>`;
    if (s === "installed") return `<span class="badge installed">Installed</span>`;
    if (s === "failed") return `<span class="badge failed">Failed</span>`;
    if (s === "unsupported") return `<span class="badge unsupported">Unsupported</span>`;
    if (s === "queued") return `<span class="badge installing">Queued</span>`;
  }
  if (tool.installed) return `<span class="badge installed">Installed</span>`;
  if (!tool.installable) return `<span class="badge unsupported">No installer</span>`;
  return `<span class="badge missing">Not installed</span>`;
}

function renderSystem() {
  const s = state.system;
  if (!s) return;
  const pms = s.package_managers_available.length
    ? s.package_managers_available.join(", ")
    : "none";
  $("#system").innerHTML = `
    <div class="kv"><span class="k">OS</span><span class="v">${escapeHtml(s.os_pretty)}</span></div>
    <div class="kv"><span class="k">Arch</span><span class="v">${escapeHtml(s.arch)}</span></div>
    <div class="kv"><span class="k">Package mgr</span><span class="v">${escapeHtml(s.package_manager || "none")}</span></div>
    <div class="kv"><span class="k">Available</span><span class="v">${escapeHtml(pms)}</span></div>
    <div class="kv"><span class="k">Python</span><span class="v">${escapeHtml(s.python)}</span></div>
  `;
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function visibleTools() {
  return state.tools.filter((t) => {
    if (state.filter === "missing" && t.installed) return false;
    if (state.filter === "installed" && !t.installed) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      if (!(`${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

function renderCatalog() {
  const tools = visibleTools();
  const byCat = {};
  for (const t of tools) (byCat[t.category] = byCat[t.category] || []).push(t);

  const cats = Object.keys(byCat);
  if (!cats.length) {
    $("#catalog").innerHTML = `<div class="loading">No tools match your filter.</div>`;
    return;
  }

  let html = "";
  for (const cat of cats) {
    html += `<div class="category"><h2>${escapeHtml(cat)}</h2><div class="grid">`;
    for (const t of byCat[cat]) {
      const checked = state.selected.has(t.id) ? "checked" : "";
      const selectedCls = state.selected.has(t.id) ? "selected" : "";
      const canInstall = t.installable && !t.installed;
      const versionLine = t.version ? `<div class="version">${escapeHtml(t.version)}</div>` : "";
      const disableBox = (!canInstall) ? "disabled" : "";
      html += `
        <div class="card ${selectedCls}" data-id="${t.id}">
          <div class="icon">${t.icon || "&#128295;"}</div>
          <div class="body">
            <div class="name-row">
              <span class="name">${escapeHtml(t.name)}</span>
              ${statusBadge(t)}
            </div>
            <div class="desc">${escapeHtml(t.description)}</div>
            ${versionLine}
          </div>
          <div class="actions">
            <input type="checkbox" data-check="${t.id}" ${checked} ${disableBox} title="Select for batch install" />
            ${canInstall ? `<button class="btn install-one" data-install="${t.id}">Install</button>` : ""}
          </div>
        </div>`;
    }
    html += `</div></div>`;
  }
  $("#catalog").innerHTML = html;

  document.querySelectorAll("[data-check]").forEach((box) => {
    box.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-check");
      if (e.target.checked) state.selected.add(id);
      else state.selected.delete(id);
      updateInstallButton();
      const card = document.querySelector(`.card[data-id="${id}"]`);
      if (card) card.classList.toggle("selected", e.target.checked);
    });
  });
  document.querySelectorAll("[data-install]").forEach((btn) => {
    btn.addEventListener("click", () => startInstall([btn.getAttribute("data-install")]));
  });
}

function updateInstallButton() {
  const btn = $("#install");
  const n = state.selected.size;
  btn.textContent = `Install selected (${n})`;
  btn.disabled = n === 0 || (state.job && !state.job.done);
}

async function loadAll() {
  try {
    state.system = await getJSON("/api/system");
    renderSystem();
    const data = await getJSON("/api/tools");
    state.tools = data.tools;
    renderCatalog();
    updateInstallButton();
  } catch (err) {
    $("#catalog").innerHTML = `<div class="loading">Failed to load: ${escapeHtml(err.message)}</div>`;
  }
}

async function startInstall(ids) {
  if (!ids || !ids.length) return;
  showConsole();
  appendLog([{ text: `Requesting install of ${ids.length} tool(s)...`, level: "step" }]);
  try {
    const res = await getJSON("/api/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    state.job = { id: res.job_id, statuses: {}, done: false };
    state.offset = 0;
    ids.forEach((id) => (state.job.statuses[id] = "queued"));
    renderCatalog();
    updateInstallButton();
    pollJob();
  } catch (err) {
    appendLog([{ text: `Error: ${err.message}`, level: "error" }]);
  }
}

function pollJob() {
  if (state.poll) clearInterval(state.poll);
  state.poll = setInterval(async () => {
    if (!state.job) return;
    try {
      const snap = await getJSON(`/api/job?id=${state.job.id}&offset=${state.offset}`);
      if (snap.lines && snap.lines.length) {
        appendLog(snap.lines);
        state.offset = snap.next_offset;
      }
      state.job.statuses = snap.statuses;
      renderCatalog();
      if (snap.done) {
        clearInterval(state.poll);
        state.poll = null;
        state.job.done = true;
        appendLog([{ text: "Refreshing tool status...", level: "step" }]);
        const data = await getJSON("/api/tools");
        state.tools = data.tools;
        state.selected.clear();
        renderCatalog();
        updateInstallButton();
      }
    } catch (err) {
      appendLog([{ text: `Poll error: ${err.message}`, level: "error" }]);
    }
  }, 1000);
}

function showConsole() {
  $("#console").classList.remove("hidden");
}

function appendLog(lines) {
  const body = $("#console-body");
  for (const line of lines) {
    const span = document.createElement("span");
    span.className = `l-${line.level || "info"}`;
    span.textContent = line.text + "\n";
    body.appendChild(span);
  }
  body.scrollTop = body.scrollHeight;
}

function wireControls() {
  $("#search").addEventListener("input", (e) => { state.query = e.target.value; renderCatalog(); });
  $("#filter").addEventListener("change", (e) => { state.filter = e.target.value; renderCatalog(); });
  $("#refresh").addEventListener("click", loadAll);
  $("#console-close").addEventListener("click", () => $("#console").classList.add("hidden"));
  $("#select-missing").addEventListener("click", () => {
    state.selected.clear();
    for (const t of state.tools) if (!t.installed && t.installable) state.selected.add(t.id);
    renderCatalog();
    updateInstallButton();
  });
  $("#install").addEventListener("click", () => startInstall([...state.selected]));
}

wireControls();
loadAll();
