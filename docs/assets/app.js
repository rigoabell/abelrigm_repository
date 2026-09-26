"use strict";

// Repo coordinates used for ZIP/source links. Update BRANCH after merging to main.
const REPO = "rigoabell/abelrigm_repository";
const BRANCH = "main";

const ESSENTIALS = new Set([
  "git", "curl", "wget", "python", "node", "build-essential", "ripgrep", "jq",
]);

const state = {
  data: null,
  os: "auto",
  resolvedOs: "linux",
  selected: new Set(),
  query: "",
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function detectOs() {
  const ua = (navigator.userAgent || "").toLowerCase();
  const plat = ((navigator.userAgentData && navigator.userAgentData.platform) ||
    navigator.platform || "").toLowerCase();
  const hay = plat + " " + ua;
  if (hay.includes("win")) return "windows";
  if (hay.includes("mac") || hay.includes("darwin") || hay.includes("iphone") || hay.includes("ipad")) return "macos";
  return "linux";
}

function resolvedOs() {
  return state.os === "auto" ? detectOs() : state.os;
}

// ---- Install-method resolution (mirrors the app's preference order) --------
const SYSTEM_PMS = new Set(["apt", "dnf", "pacman", "zypper", "choco"]);

function needsRoot(method, command) {
  if (command && command.includes("{{SUDO}}")) return true;
  return SYSTEM_PMS.has(method);
}

// Returns the list of {method, command} candidates for a tool on an OS family.
function methodsFor(tool, os) {
  const inst = tool.install || {};
  const out = [];
  if (os === "linux") {
    for (const pm of ["apt", "dnf", "pacman", "zypper"]) {
      if (inst[pm]) out.push({ method: pm, command: inst[pm] });
    }
    if (inst.unix_script) out.push({ method: "unix_script", command: inst.unix_script });
    if (inst.npm) out.push({ method: "npm", command: inst.npm });
  } else if (os === "macos") {
    if (inst.brew) out.push({ method: "brew", command: inst.brew });
    if (inst.unix_script) out.push({ method: "unix_script", command: inst.unix_script });
    if (inst.npm) out.push({ method: "npm", command: inst.npm });
  } else if (os === "windows") {
    if (inst.winget) out.push({ method: "winget", command: inst.winget });
    if (inst.choco) out.push({ method: "choco", command: inst.choco });
    if (inst.windows_script) out.push({ method: "windows_script", command: inst.windows_script });
    if (inst.npm) out.push({ method: "npm", command: inst.npm });
  }
  return out;
}

function isAvailable(tool, os) {
  return methodsFor(tool, os).length > 0;
}

// ---- Rendering -------------------------------------------------------------
function renderCatalog() {
  const os = resolvedOs();
  const tools = state.data.tools.filter((t) => {
    if (!state.query) return true;
    const q = state.query.toLowerCase();
    return `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q);
  });

  const byCat = {};
  for (const t of tools) (byCat[t.category] = byCat[t.category] || []).push(t);
  const cats = state.data.categories.filter((c) => byCat[c]);

  if (!cats.length) {
    $("#tool-catalog").innerHTML = `<div class="loading">No tools match your search.</div>`;
    return;
  }

  let html = "";
  for (const cat of cats) {
    html += `<div class="cat-block"><h4>${escapeHtml(cat)}</h4><div class="tool-grid">`;
    for (const t of byCat[cat]) {
      const avail = isAvailable(t, os);
      const sel = state.selected.has(t.id);
      html += `
        <label class="tool ${sel ? "selected" : ""} ${avail ? "" : "unavailable"}" data-id="${t.id}"
               title="${avail ? "" : "No install method for " + escapeHtml(os)}">
          <input type="checkbox" data-check="${t.id}" ${sel ? "checked" : ""} ${avail ? "" : "disabled"} />
          <span class="t-icon">${t.icon || "&#128295;"}</span>
          <span class="t-body">
            <span class="t-name">${escapeHtml(t.name)}</span>
            <span class="t-desc">${escapeHtml(t.description)}</span>
          </span>
        </label>`;
    }
    html += `</div></div>`;
  }
  $("#tool-catalog").innerHTML = html;

  $$("[data-check]").forEach((box) => {
    box.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-check");
      if (e.target.checked) state.selected.add(id);
      else state.selected.delete(id);
      const card = document.querySelector(`.tool[data-id="${id}"]`);
      if (card) card.classList.toggle("selected", e.target.checked);
      updateOutput();
    });
  });
}

function setOs(os) {
  state.os = os;
  $$(".os-btn").forEach((b) => b.classList.toggle("active", b.getAttribute("data-os") === os));
  const r = resolvedOs();
  state.resolvedOs = r;
  const auto = state.os === "auto" ? ` (detected: ${r})` : "";
  const names = { linux: "Linux", macos: "macOS", windows: "Windows" };
  $("#os-note").textContent =
    `Target: ${names[r]}${auto}. The installer above already includes every tool for this system.`;
  updateInstallerHint();
  // Drop selections that aren't installable on the new OS.
  for (const id of Array.from(state.selected)) {
    const tool = state.data.tools.find((t) => t.id === id);
    if (tool && !isAvailable(tool, r)) state.selected.delete(id);
  }
  renderCatalog();
  updateOutput();
}

// ---- Script generation -----------------------------------------------------
function chooseMethod(tool, os) {
  const cands = methodsFor(tool, os);
  return cands; // full list; the generated script decides at runtime for linux
}

function toolsFor(os, ids) {
  const chosen = ids || state.selected;
  return state.data.tools.filter((t) => chosen.has(t.id) && isAvailable(t, os));
}

function genBash(os, ids) {
  const selected = toolsFor(os, ids);
  const lines = [];
  lines.push("#!/usr/bin/env bash");
  lines.push("# Rig Setup \u2014 install with: bash rig-setup.sh");
  lines.push("# Generated by Dev Hub. Re-run any time; it skips tools you already have.");
  lines.push(`# Target: ${os}.`);
  lines.push("set -uo pipefail");
  lines.push("");
  lines.push('have() { command -v "$1" >/dev/null 2>&1; }');
  lines.push('info() { printf "\\n\\033[1;34m==>\\033[0m %s\\n" "$1"; }');
  lines.push('ok()   { printf "\\033[1;32m\\u2713\\033[0m %s already installed\\n" "$1"; }');
  lines.push('warn() { printf "\\033[1;33m!\\033[0m %s\\n" "$1"; }');
  lines.push("");
  lines.push("# --- privilege detection: never assume admin ---");
  lines.push('if [ "$(id -u)" -eq 0 ]; then SUDO=""; CAN_ELEVATE=1;');
  lines.push('elif have sudo; then SUDO="sudo "; CAN_ELEVATE=1;');
  lines.push('else SUDO=""; CAN_ELEVATE=0; fi');
  lines.push('need_root() { [ "$CAN_ELEVATE" -eq 1 ]; }');
  lines.push("");

  if (os === "linux") {
    lines.push("# --- detect package manager ---");
    lines.push('if have apt-get; then PM=apt;');
    lines.push('elif have dnf; then PM=dnf;');
    lines.push('elif have pacman; then PM=pacman;');
    lines.push('elif have zypper; then PM=zypper;');
    lines.push('else PM=none; fi');
    lines.push('info "Package manager: $PM"');
    lines.push('if [ "$PM" = apt ] && need_root; then ${SUDO}apt-get update || true; fi');
  } else {
    lines.push("# --- ensure Homebrew (user-space, no root) ---");
    lines.push('if ! have brew; then');
    lines.push('  info "Installing Homebrew..."');
    lines.push('  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
    lines.push('  if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; fi');
    lines.push('  if [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi');
    lines.push('fi');
    lines.push('PM=brew');
  }
  lines.push("");

  for (const tool of selected) {
    const cands = methodsFor(tool, os);
    lines.push(`# ${tool.name}`);
    lines.push(`if have ${tool.check}; then ok "${tool.name}"; else`);
    lines.push(`  info "Installing ${tool.name}..."`);
    lines.push(`  case "$PM" in`);
    const emitted = new Set();
    for (const c of cands) {
      if (["apt", "dnf", "pacman", "zypper", "brew"].includes(c.method) && !emitted.has(c.method)) {
        emitted.add(c.method);
        const cmd = c.command.replace(/\{\{SUDO\}\} /g, "${SUDO}");
        if (needsRoot(c.method, c.command)) {
          lines.push(`    ${c.method}) if need_root; then ${cmd}; else warn "${tool.name} needs admin rights; re-run with sudo"; fi ;;`);
        } else {
          lines.push(`    ${c.method}) ${cmd} ;;`);
        }
      }
    }
    // Fallback branch: prefer a user-space script, else npm.
    const fallback = cands.find((c) => c.method === "unix_script") || cands.find((c) => c.method === "npm");
    if (fallback) {
      const cmd = fallback.command.replace(/\{\{SUDO\}\} /g, "${SUDO}");
      if (fallback.method === "npm") {
        lines.push(`    *) if have npm; then ${cmd}; else warn "No method for ${tool.name} on $PM"; fi ;;`);
      } else if (needsRoot(fallback.method, fallback.command)) {
        lines.push(`    *) if need_root; then ${cmd}; else warn "${tool.name} needs admin rights; re-run with sudo"; fi ;;`);
      } else {
        lines.push(`    *) ${cmd} ;;`);
      }
    } else {
      lines.push(`    *) warn "No install method for ${tool.name} on $PM" ;;`);
    }
    lines.push(`  esac`);
    lines.push(`fi`);
    lines.push("");
  }
  lines.push('info "Done. Open a new terminal so freshly-installed tools are on your PATH."');
  return lines.join("\n") + "\n";
}

function genPowerShell(os, ids) {
  const selected = toolsFor(os, ids);
  const L = [];
  L.push("# Generated by Dev Hub - Machine Setup builder");
  L.push("# Target: Windows. Re-run any time; it skips tools you already have.");
  L.push("$ErrorActionPreference = 'Continue'");
  L.push("function Have($n) { return [bool](Get-Command $n -ErrorAction SilentlyContinue) }");
  L.push("$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)");
  L.push("if (Have winget) { $PM = 'winget' } elseif (Have choco) { $PM = 'choco' } else { $PM = 'none' }");
  L.push("Write-Host \"Package manager: $PM (admin: $IsAdmin)\" -ForegroundColor Cyan");
  L.push("");
  for (const tool of selected) {
    const cands = methodsFor(tool, os);
    L.push(`# ${tool.name}`);
    L.push(`if (Have '${tool.check}') { Write-Host "OK ${tool.name} already installed" -ForegroundColor Green }`);
    L.push(`else {`);
    L.push(`  Write-Host "==> Installing ${tool.name}..." -ForegroundColor Blue`);
    L.push(`  switch ($PM) {`);
    const winget = cands.find((c) => c.method === "winget");
    const choco = cands.find((c) => c.method === "choco");
    const npm = cands.find((c) => c.method === "npm");
    if (winget) L.push(`    'winget' { ${winget.command} }`);
    if (choco) {
      L.push(`    'choco' { if ($IsAdmin) { ${choco.command} } else { Write-Warning "${tool.name} needs an elevated (admin) PowerShell for Chocolatey" } }`);
    }
    if (npm) {
      L.push(`    default { if (Have npm) { ${npm.command} } else { Write-Warning "No install method for ${tool.name}" } }`);
    } else {
      L.push(`    default { Write-Warning "No install method for ${tool.name} on this system" }`);
    }
    L.push(`  }`);
    L.push(`}`);
    L.push("");
  }
  L.push("Write-Host 'Done. Open a new terminal so freshly-installed tools are on your PATH.' -ForegroundColor Cyan");
  return L.join("\n") + "\n";
}

function currentScript() {
  const os = resolvedOs();
  const body = os === "windows" ? genPowerShell(os) : genBash(os);
  return os === "windows" ? wrapWindowsBat(body) : body;
}

function fullIds(os) {
  return new Set(state.data.tools.filter((t) => isAvailable(t, os)).map((t) => t.id));
}

function installerName(os) {
  return os === "windows" ? "rig-setup.bat" : "rig-setup.sh";
}

function fullInstaller(os) {
  const ids = fullIds(os);
  return os === "windows" ? wrapWindowsBat(genPowerShell(os, ids)) : genBash(os, ids);
}

// A .bat the user can double-click. It runs the embedded PowerShell with
// ExecutionPolicy Bypass, so there is no policy setup step.
function wrapWindowsBat(ps1) {
  const launcher = [
    "@echo off",
    "setlocal EnableExtensions",
    "set \"SRC=%~f0\"",
    "set \"OUT=%TEMP%\\rig-setup.ps1\"",
    "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$c=Get-Content -LiteralPath $env:SRC -Raw; $k='#<RIGSETUP>'; $i=$c.LastIndexOf($k); if($i -lt 0){throw 'Rig Setup payload missing'}; $s=$c.Substring($i+$k.Length).TrimStart([char]13,[char]10); [IO.File]::WriteAllText($env:OUT,$s); & $env:OUT\"",
    "echo.",
    "echo Finished. Press any key to close.",
    "pause >nul",
    "#<RIGSETUP>",
  ].join("\r\n");
  return launcher + "\r\n" + ps1.replace(/\n/g, "\r\n");
}

function updateInstallerHint() {
  const steps = document.querySelectorAll(".run-step");
  const buttons = document.querySelectorAll("[data-download='all']");
  if (!steps.length && !buttons.length) return;
  if (!state.data) {
    steps.forEach((step) => { step.textContent = "Loading the installer\u2026"; });
    buttons.forEach((btn) => { btn.disabled = true; });
    return;
  }
  const os = resolvedOs();
  const n = fullIds(os).size;
  buttons.forEach((btn) => { btn.disabled = n === 0; });
  const label = os === "windows"
    ? "In Downloads, double-click this file"
    : "In Terminal, run this command";
  const command = os === "windows" ? "rig-setup.bat" : "bash ~/Downloads/rig-setup.sh";
  document.querySelectorAll(".run-label").forEach((el) => { el.textContent = label; });
  document.querySelectorAll("[data-tool-count]").forEach((el) => { el.textContent = String(n); });
  steps.forEach((step) => { step.textContent = command; });
}

function updateOutput() {
  const os = resolvedOs();
  const n = state.data.tools.filter((t) => state.selected.has(t.id) && isAvailable(t, os)).length;
  const preview = $("#script-preview");
  const dl = $("#download-script");
  const copy = $("#copy-script");
  const sub = $("#output-sub");

  if (n === 0) {
    preview.textContent = os === "windows"
      ? "# Choose some tools above to generate a PowerShell script."
      : "# Choose some tools above to generate a Bash script.";
    dl.disabled = true; copy.disabled = true;
    sub.textContent = "Select some tools to generate a script.";
    return;
  }
  preview.textContent = currentScript();
  dl.disabled = false; copy.disabled = false;
  const fname = os === "windows" ? "setup.bat" : "setup.sh";
  const how = os === "windows" ? "double-click it" : "run bash ~/Downloads/setup.sh";
  sub.textContent = `${n} tool${n === 1 ? "" : "s"} selected \u2192 ${fname}. ${how}.`;
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toast(msg) {
  let el = $(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

// ---- Wire up ---------------------------------------------------------------
function wire() {
  $$(".os-btn").forEach((b) => b.addEventListener("click", () => setOs(b.getAttribute("data-os"))));
  const search = $("#tool-search");
  if (search) search.addEventListener("input", (e) => { state.query = e.target.value; renderCatalog(); });

  const selectAll = $("#select-all");
  if (selectAll) {
    selectAll.addEventListener("click", () => {
      const os = resolvedOs();
      for (const t of state.data.tools) if (isAvailable(t, os)) state.selected.add(t.id);
      renderCatalog(); updateOutput();
    });
  }
  const selectNone = $("#select-none");
  if (selectNone) {
    selectNone.addEventListener("click", () => {
      state.selected.clear(); renderCatalog(); updateOutput();
    });
  }
  const selectEssential = $("#select-essential");
  if (selectEssential) {
    selectEssential.addEventListener("click", () => {
      const os = resolvedOs();
      state.selected.clear();
      for (const t of state.data.tools) if (ESSENTIALS.has(t.id) && isAvailable(t, os)) state.selected.add(t.id);
      renderCatalog(); updateOutput();
    });
  }

  $$("[data-download='all']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.data) return;
      const os = resolvedOs();
      const fname = installerName(os);
      download(fname, fullInstaller(os));
      toast(os === "windows"
        ? "Downloaded rig-setup.bat \u2014 double-click it"
        : "Downloaded rig-setup.sh \u2014 run: bash ~/Downloads/rig-setup.sh");
    });
  });

  const downloadSelected = $("#download-script");
  if (!downloadSelected) return;
  downloadSelected.addEventListener("click", () => {
    const os = resolvedOs();
    const fname = os === "windows" ? "setup.bat" : "setup.sh";
    download(fname, currentScript());
    toast(`Downloaded ${fname}`);
  });
  $("#copy-script").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentScript());
      toast("Script copied to clipboard");
    } catch {
      toast("Copy failed \u2014 select the text manually");
    }
  });

  const zip = $("#zip-link");
  if (zip) zip.href = `https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip`;
  const repoLink = $("#repo-link");
  if (repoLink) repoLink.href = `https://github.com/${REPO}`;
}

async function init() {
  const hasBuilder = !!document.getElementById("tool-catalog");
  const hasDownload = !!document.querySelector("[data-download='all']");
  if (!hasBuilder && !hasDownload) return;
  wire();
  try {
    const res = await fetch("data/tools.json", { cache: "no-store" });
    state.data = await res.json();
    const stat = $("#stat-tools");
    if (stat) stat.textContent = state.data.count;
    if (hasBuilder) setOs("auto");
    else updateInstallerHint();
  } catch (err) {
    const catalog = $("#tool-catalog");
    if (catalog) {
      catalog.innerHTML = `<div class="loading">Failed to load catalog: ${escapeHtml(err.message)}</div>`;
    }
    document.querySelectorAll(".run-step").forEach((el) => {
      el.textContent = "Could not load the installer.";
    });
  }
}

init();
