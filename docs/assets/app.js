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
    `Target: ${names[r]}${auto}. The installer above installs into your user account and does not ask for an administrator password.`;
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
// Installers unpack into the user profile. They never call sudo, winget without
// a user scope, Chocolatey, or "Run as administrator".
function toolsFor(os, ids) {
  const chosen = ids || state.selected;
  return state.data.tools.filter((t) => chosen.has(t.id) && isAvailable(t, os));
}

function bashPrelude(os) {
  const lines = [
    "#!/usr/bin/env bash",
    "# Rig Setup installs into your home directory.",
    "# It does not ask for an administrator password.",
    "# Generated by Dev Hub. Re-run any time; it skips tools you already have.",
    `# Target: ${os}.`,
    "set -uo pipefail",
    "",
    'have() { command -v "$1" >/dev/null 2>&1; }',
    'info() { printf "\\n\\033[1;34m==>\\033[0m %s\\n" "$1"; }',
    'ok()   { printf "\\033[1;32m\\u2713\\033[0m %s already installed\\n" "$1"; }',
    'warn() { printf "\\033[1;33m!\\033[0m %s\\n" "$1"; }',
    "",
    'BIN="$HOME/.local/bin"',
    'mkdir -p "$BIN" "$HOME/.npm-global"',
    'export PATH="$BIN:$HOME/.npm-global/bin:$HOME/.cargo/bin:$HOME/.deno/bin:$HOME/.bun/bin:$PATH"',
    'case "$(uname -m)" in',
    "  aarch64|arm64) ARCH=arm64; GOARCH=arm64; NODEARCH=arm64; RGARCH=aarch64; CMAKEARCH=aarch64 ;;",
    "  *) ARCH=amd64; GOARCH=amd64; NODEARCH=x64; RGARCH=x86_64; CMAKEARCH=x86_64 ;;",
    "esac",
    'touch "$HOME/.profile"',
    "grep -q 'Rig Setup PATH' \"$HOME/.profile\" 2>/dev/null || cat >> \"$HOME/.profile\" <<'EOF'",
    "",
    "# Rig Setup PATH",
    'export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.cargo/bin:$HOME/.deno/bin:$HOME/.bun/bin:$PATH"',
    "EOF",
    "github_url() {",
    "  curl -fsSL -H 'User-Agent: RigSetup' -H 'Accept: application/vnd.github+json' \\",
    '    "https://api.github.com/repos/$1/releases/latest" | grep -oE "$2" | head -1',
    "}",
    "unpack_zip() {",
    "  python3 - \"$1\" \"$2\" <<'PY'",
    "import sys, zipfile",
    "zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
    "PY",
    "}",
    "",
  ];
  if (os === "macos") {
    lines.push("if ! have brew; then");
    lines.push('  info "Installing Homebrew into your home folder"');
    lines.push('  mkdir -p "$HOME/.homebrew"');
    lines.push('  curl -fsSL https://github.com/Homebrew/brew/tarball/master | tar xz --strip 1 -C "$HOME/.homebrew"');
    lines.push("fi");
    lines.push('if [ -x "$HOME/.homebrew/bin/brew" ]; then eval "$("$HOME/.homebrew/bin/brew" shellenv)"; fi');
    lines.push("");
  } else {
    lines.push("if ! have curl; then");
    lines.push('  warn "curl is missing. Installing it needs an administrator, so this file stopped."');
    lines.push("  exit 1");
    lines.push("fi");
    lines.push("");
  }
  return lines;
}

// Per-user commands. Anything that would call sudo is omitted on purpose.
const BASH_INSTALL = {
  jq: {
    linux: [
      'curl -fsSL -o "$BIN/jq" "https://github.com/jqlang/jq/releases/latest/download/jq-linux-${ARCH}"',
      'chmod +x "$BIN/jq"',
    ],
  },
  gh: {
    linux: [
      "url=$(github_url cli/cli 'https://[^ \"]*linux_'\"$ARCH\"'\\.tar\\.gz')",
      'test -n "$url"',
      "tmp=$(mktemp -d)",
      'curl -fsSL "$url" | tar -xz -C "$tmp"',
      'cp "$(find "$tmp" -type f -name gh | head -1)" "$BIN/gh"',
      'chmod +x "$BIN/gh"',
      'rm -rf "$tmp"',
    ],
  },
  ripgrep: {
    linux: [
      'url=$(github_url BurntSushi/ripgrep \'https://[^"]*\'"$RGARCH"\'-unknown-linux-musl\\.tar\\.gz\')',
      'test -n "$url"',
      "tmp=$(mktemp -d)",
      'curl -fsSL "$url" | tar -xz -C "$tmp"',
      'cp "$(find "$tmp" -type f -name rg | head -1)" "$BIN/rg"',
      'chmod +x "$BIN/rg"',
      'rm -rf "$tmp"',
    ],
  },
  cmake: {
    linux: [
      'url=$(github_url Kitware/CMake \'https://[^"]*linux-\'"$CMAKEARCH"\'\\.tar\\.gz\')',
      'test -n "$url"',
      'rm -rf "$HOME/.local/cmake"',
      'mkdir -p "$HOME/.local/cmake"',
      'curl -fsSL "$url" | tar -xz -C "$HOME/.local/cmake" --strip-components=1',
      'ln -sfn "$HOME/.local/cmake/bin/cmake" "$BIN/cmake"',
      'ln -sfn "$HOME/.local/cmake/bin/cpack" "$BIN/cpack"',
      'ln -sfn "$HOME/.local/cmake/bin/ctest" "$BIN/ctest"',
    ],
  },
  python: {
    any: [
      "curl -LsSf https://astral.sh/uv/install.sh | sh",
      'export PATH="$HOME/.local/bin:$PATH"',
      "uv python install 3.12",
      'target=$(uv python find 3.12)',
      'ln -sfn "$target" "$BIN/python3"',
      'ln -sfn "$target" "$BIN/python"',
    ],
  },
  node: {
    any: [
      "ver=$(curl -fsSL https://nodejs.org/dist/index.json | tr '{' '\\n' | sed -n 's/.*\"version\":\"\\(v[^\"]*\\)\".*\"lts\":\"[^\"]*\".*/\\1/p' | head -1)",
      'case "$(uname -s)" in Darwin) nos=darwin ;; *) nos=linux ;; esac',
      'rm -rf "$HOME/.local/node"',
      'mkdir -p "$HOME/.local/node"',
      'curl -fsSL "https://nodejs.org/dist/${ver}/node-${ver}-${nos}-${NODEARCH}.tar.gz" | tar -xz -C "$HOME/.local/node" --strip-components=1',
      'ln -sfn "$HOME/.local/node/bin/node" "$BIN/node"',
      'ln -sfn "$HOME/.local/node/bin/npm" "$BIN/npm"',
      'ln -sfn "$HOME/.local/node/bin/npx" "$BIN/npx"',
    ],
  },
  go: {
    any: [
      'case "$(uname -s)" in Darwin) goos=darwin ;; *) goos=linux ;; esac',
      'filename=$(curl -fsSL \'https://go.dev/dl/?mode=json\' | grep -oE "go[0-9.]+[.]${goos}-${GOARCH}[.]tar[.]gz" | head -1)',
      'test -n "$filename"',
      'rm -rf "$HOME/.local/sdk-go"',
      'mkdir -p "$HOME/.local/sdk-go"',
      'curl -fsSL "https://go.dev/dl/${filename}" | tar -xz -C "$HOME/.local/sdk-go"',
      'ln -sfn "$HOME/.local/sdk-go/go/bin/go" "$BIN/go"',
      'ln -sfn "$HOME/.local/sdk-go/go/bin/gofmt" "$BIN/gofmt"',
    ],
  },
  java: {
    linux: [
      'archq=x64; [ "$ARCH" = arm64 ] && archq=aarch64',
      "url=$(curl -fsSL \"https://api.adoptium.net/v3/assets/latest/21/hotspot?os=linux&architecture=${archq}&image_type=jdk&vendor=eclipse\" | grep -oE 'https://[^ \"]+\\.tar\\.gz' | head -1)",
      'test -n "$url"',
      'rm -rf "$HOME/.local/jdk"',
      'mkdir -p "$HOME/.local/jdk"',
      'curl -fsSL "$url" | tar -xz -C "$HOME/.local/jdk" --strip-components=1',
      'ln -sfn "$HOME/.local/jdk/bin/java" "$BIN/java"',
      'ln -sfn "$HOME/.local/jdk/bin/javac" "$BIN/javac"',
    ],
  },
  dotnet: {
    any: [
      "curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/rig-dotnet-install.sh",
      'bash /tmp/rig-dotnet-install.sh --channel 8.0 --install-dir "$HOME/.local/dotnet"',
      'ln -sfn "$HOME/.local/dotnet/dotnet" "$BIN/dotnet"',
    ],
  },
  kubectl: {
    linux: [
      "ver=$(curl -fsSL https://dl.k8s.io/release/stable.txt | tr -d '[:space:]')",
      'karch=amd64; [ "$ARCH" = arm64 ] && karch=arm64',
      'curl -fsSL -o "$BIN/kubectl" "https://dl.k8s.io/release/${ver}/bin/linux/${karch}/kubectl"',
      'chmod +x "$BIN/kubectl"',
    ],
  },
  terraform: {
    linux: [
      "url=$(curl -fsSL https://api.releases.hashicorp.com/v1/releases/terraform/latest | grep -oE 'https://[^ \"]*linux_'\"$ARCH\"'\\.zip' | head -1)",
      'test -n "$url"',
      "tmp=$(mktemp -d)",
      'curl -fsSL -o "$tmp/tf.zip" "$url"',
      'unpack_zip "$tmp/tf.zip" "$tmp"',
      'cp "$tmp/terraform" "$BIN/terraform"',
      'chmod +x "$BIN/terraform"',
      'rm -rf "$tmp"',
    ],
  },
  awscli: {
    linux: [
      'aarch=x86_64; [ "$ARCH" = arm64 ] && aarch=aarch64',
      "tmp=$(mktemp -d)",
      'curl -fsSL -o "$tmp/aws.zip" "https://awscli.amazonaws.com/awscli-exe-linux-${aarch}.zip"',
      'mkdir -p "$tmp/out"',
      'unpack_zip "$tmp/aws.zip" "$tmp/out"',
      '"$tmp/out/aws/install" -i "$HOME/.local/aws-cli" -b "$BIN"',
      'rm -rf "$tmp"',
    ],
  },
  vscode: {
    linux: [
      'rm -rf "$HOME/.local/vscode"',
      'mkdir -p "$HOME/.local/vscode"',
      'curl -fsSL "https://code.visualstudio.com/sha/download?build=stable&os=linux-${NODEARCH}" | tar -xz -C "$HOME/.local/vscode" --strip-components=1',
      'ln -sfn "$HOME/.local/vscode/bin/code" "$BIN/code"',
    ],
    macos: [
      'mkdir -p "$HOME/Applications"',
      "tmp=$(mktemp -d)",
      'curl -fsSL "https://code.visualstudio.com/sha/download?build=stable&os=darwin-universal" -o "$tmp/vscode.zip"',
      'tar -xf "$tmp/vscode.zip" -C "$tmp"',
      'rm -rf "$HOME/Applications/Visual Studio Code.app"',
      'mv "$tmp/"*.app "$HOME/Applications/"',
      'ln -sfn "$HOME/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" "$BIN/code"',
      'rm -rf "$tmp"',
    ],
  },
};

function bashBody(tool, os) {
  const custom = BASH_INSTALL[tool.id];
  if (custom && custom[os]) return custom[os];
  if (custom && custom.any) return custom.any;
  const cands = methodsFor(tool, os).filter((c) => !needsRoot(c.method, c.command));
  if (os === "macos") {
    const brew = cands.find((c) => c.method === "brew" && !c.command.includes("--cask") && !c.command.includes("xcode-select"));
    if (brew) {
      if (tool.id === "postgres-client") return [brew.command, "brew link --force libpq || true"];
      return [brew.command];
    }
  }
  const script = cands.find((c) => c.method === "unix_script" && !c.command.includes("{{SUDO}}"));
  if (script) return [script.command];
  const npm = cands.find((c) => c.method === "npm");
  if (npm) return ['npm config set prefix "$HOME/.npm-global"', npm.command];
  return null;
}

function genBash(os, ids) {
  const selected = toolsFor(os, ids);
  const lines = bashPrelude(os);
  for (const tool of selected) {
    lines.push(`# ${tool.name}`);
    lines.push(`if have ${tool.check}; then ok "${tool.name}"; else`);
    const body = bashBody(tool, os);
    if (!body) {
      lines.push(`  warn "${tool.name} needs an administrator account, so it was skipped"`);
    } else {
      lines.push(`  info "Installing ${tool.name}"`);
      for (const line of body) lines.push(`  ${line}`);
    }
    lines.push("fi");
    lines.push("");
  }
  lines.push('info "Done. Open a new terminal so freshly-installed tools are on your PATH."');
  return lines.join("\n") + "\n";
}

function psPrelude() {
  return [
    "# Rig Setup installs into your user account.",
    "# It does not ask you to sign in as an administrator.",
    "# Generated by Dev Hub. Re-run any time; it skips tools you already have.",
    "# Target: Windows.",
    "$ErrorActionPreference = 'Continue'",
    "$ProgressPreference = 'SilentlyContinue'",
    "$Root = Join-Path $env:LOCALAPPDATA 'RigSetup'",
    "$UserBin = Join-Path $Root 'bin'",
    "New-Item -ItemType Directory -Force -Path $UserBin | Out-Null",
    "function Add-UserPath([string]$dir) {",
    "  if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { return }",
    "  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')",
    "  if (-not $userPath) { $userPath = '' }",
    "  $parts = @($userPath -split ';' | Where-Object { $_ -and ($_ -ne $dir) })",
    "  [Environment]::SetEnvironmentVariable('Path', ((@($dir) + $parts) -join ';'), 'User')",
    "  if (($env:Path -split ';') -notcontains $dir) { $env:Path = $dir + ';' + $env:Path }",
    "}",
    "function Refresh-Path {",
    "  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')",
    "  $user = [Environment]::GetEnvironmentVariable('Path', 'User')",
    "  $env:Path = (@($user, $machine) | Where-Object { $_ }) -join ';'",
    "}",
    "function Have([string]$n) {",
    "  Refresh-Path",
    "  $cmd = Get-Command $n -ErrorAction SilentlyContinue",
    "  if (-not $cmd) { return $false }",
    "  if ($cmd.Source -like '*\\WindowsApps\\*') { return $false }",
    "  return $true",
    "}",
    "function Get-File([string]$url, [string]$dest) {",
    "  $parent = Split-Path -Parent $dest",
    "  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }",
    "  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing",
    "}",
    "function Expand-UrlZip([string]$url, [string]$dest) {",
    "  $zip = Join-Path $env:TEMP ([IO.Path]::GetRandomFileName() + '.zip')",
    "  Get-File $url $zip",
    "  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }",
    "  New-Item -ItemType Directory -Force -Path $dest | Out-Null",
    "  Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force",
    "  Remove-Item -LiteralPath $zip -Force",
    "}",
    "function Get-GitHubAssetUrl([string]$repo, [string]$pattern) {",
    "  $headers = @{ 'User-Agent' = 'RigSetup'; 'Accept' = 'application/vnd.github+json' }",
    "  $rel = Invoke-RestMethod -Uri \"https://api.github.com/repos/$repo/releases/latest\" -Headers $headers",
    "  $asset = $rel.assets | Where-Object { $_.name -match $pattern } | Select-Object -First 1",
    "  if (-not $asset) { throw \"No release file matching $pattern in $repo\" }",
    "  return $asset.browser_download_url",
    "}",
    "function Copy-MatchingFile([string]$root, [string]$leaf, [string]$dest) {",
    "  $found = Get-ChildItem -LiteralPath $root -Recurse -Filter $leaf -File | Select-Object -First 1",
    "  if (-not $found) { throw \"Could not find $leaf\" }",
    "  Copy-Item -LiteralPath $found.FullName -Destination $dest -Force",
    "}",
    "function Add-BinFromExe([string]$root, [string]$exeName) {",
    "  $found = Get-ChildItem -LiteralPath $root -Recurse -Filter $exeName -File | Select-Object -First 1",
    "  if (-not $found) { throw \"Could not find $exeName\" }",
    "  Add-UserPath $found.DirectoryName",
    "}",
    "function Install-NpmGlobal([string]$pkg) {",
    "  if (-not (Have 'npm')) { throw 'Node.js has to be installed first' }",
    "  $prefix = Join-Path $Root 'npm-global'",
    "  New-Item -ItemType Directory -Force -Path $prefix | Out-Null",
    "  npm config set prefix $prefix",
    "  Add-UserPath $prefix",
    "  npm install -g $pkg",
    "}",
    "Add-UserPath $UserBin",
    "Add-UserPath (Join-Path $env:USERPROFILE '.local\\bin')",
    "Add-UserPath (Join-Path $env:USERPROFILE '.cargo\\bin')",
    "Add-UserPath (Join-Path $env:USERPROFILE '.deno\\bin')",
    "Add-UserPath (Join-Path $env:USERPROFILE '.bun\\bin')",
    "Add-UserPath (Join-Path $env:LOCALAPPDATA 'pnpm')",
    "",
  ].join("\n");
}

function winBody(id) {
  const zip = {
    git: [
      "$url = Get-GitHubAssetUrl 'git-for-windows/git' '^MinGit-(?!.*busybox).*-64-bit\\.zip$'",
      "Expand-UrlZip $url (Join-Path $Root 'git')",
      "Add-UserPath (Join-Path (Join-Path $Root 'git') 'cmd')",
    ],
    curl: [
      "Expand-UrlZip 'https://curl.se/windows/latest.cgi?p=win64-mingw.zip' (Join-Path $Root 'curl')",
      "Copy-MatchingFile (Join-Path $Root 'curl') 'curl.exe' (Join-Path $UserBin 'curl.exe')",
    ],
    wget: [
      "Get-File 'https://eternallybored.org/misc/wget/1.21.4/64/wget.exe' (Join-Path $UserBin 'wget.exe')",
    ],
    jq: [
      "Get-File 'https://github.com/jqlang/jq/releases/latest/download/jq-windows-amd64.exe' (Join-Path $UserBin 'jq.exe')",
    ],
    gh: [
      "$url = Get-GitHubAssetUrl 'cli/cli' '_windows_amd64\\.zip$'",
      "Expand-UrlZip $url (Join-Path $Root 'gh')",
      "Copy-MatchingFile (Join-Path $Root 'gh') 'gh.exe' (Join-Path $UserBin 'gh.exe')",
    ],
    "build-essential": [
      "$url = Get-GitHubAssetUrl 'brechtsanders/winlibs_mingw' '^winlibs-x86_64-posix-seh-gcc-.*ucrt.*\\.zip$'",
      "Expand-UrlZip $url (Join-Path $Root 'mingw')",
      "Add-BinFromExe (Join-Path $Root 'mingw') 'gcc.exe'",
    ],
    ripgrep: [
      "$url = Get-GitHubAssetUrl 'BurntSushi/ripgrep' 'x86_64-pc-windows-msvc\\.zip$'",
      "Expand-UrlZip $url (Join-Path $Root 'ripgrep')",
      "Copy-MatchingFile (Join-Path $Root 'ripgrep') 'rg.exe' (Join-Path $UserBin 'rg.exe')",
    ],
    cmake: [
      "$url = Get-GitHubAssetUrl 'Kitware/CMake' '^cmake-.*-windows-x86_64\\.zip$'",
      "Expand-UrlZip $url (Join-Path $Root 'cmake')",
      "Add-BinFromExe (Join-Path $Root 'cmake') 'cmake.exe'",
    ],
    python: [
      "$uvInstaller = Join-Path $env:TEMP 'uv-install.ps1'",
      "Get-File 'https://astral.sh/uv/install.ps1' $uvInstaller",
      "& $uvInstaller",
      "$uv = Join-Path $env:USERPROFILE '.local\\bin\\uv.exe'",
      "Add-UserPath (Join-Path $env:USERPROFILE '.local\\bin')",
      "& $uv python install 3.12",
      "$py = @(& $uv python find 3.12 | Where-Object { $_ }) | Select-Object -Last 1",
      "$py = \"$py\".Trim()",
      "Add-UserPath (Split-Path -Parent $py)",
      'Set-Content -LiteralPath (Join-Path $UserBin \'python3.cmd\') -Value "@echo off`r`n`"$py`" %*" -Encoding ascii',
    ],
    node: [
      "$idx = Invoke-RestMethod 'https://nodejs.org/dist/index.json'",
      "$lts = $idx | Where-Object { $_.lts -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1",
      "if (-not $lts) { throw 'Could not resolve a Node.js build' }",
      "Expand-UrlZip (\"https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-win-x64.zip\") (Join-Path $Root 'node')",
      "Add-BinFromExe (Join-Path $Root 'node') 'node.exe'",
    ],
    go: [
      "$rels = Invoke-RestMethod 'https://go.dev/dl/?mode=json'",
      "$stable = $rels | Where-Object { $_.stable } | Select-Object -First 1",
      "$file = $stable.files | Where-Object { $_.os -eq 'windows' -and $_.arch -eq 'amd64' -and $_.kind -eq 'archive' } | Select-Object -First 1",
      "Expand-UrlZip (\"https://go.dev/dl/$($file.filename)\") (Join-Path $Root 'go-sdk')",
      "Add-UserPath (Join-Path (Join-Path (Join-Path $Root 'go-sdk') 'go') 'bin')",
    ],
    rust: [
      "$exe = Join-Path $env:TEMP 'rustup-init.exe'",
      "Get-File 'https://win.rustup.rs/x86_64' $exe",
      "& $exe -y --default-toolchain stable",
      "Add-UserPath (Join-Path $env:USERPROFILE '.cargo\\bin')",
    ],
    java: [
      "$rel = Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/21/hotspot?os=windows&architecture=x64&image_type=jdk&vendor=eclipse'",
      "Expand-UrlZip $rel[0].binary.package.link (Join-Path $Root 'java')",
      "Add-BinFromExe (Join-Path $Root 'java') 'java.exe'",
    ],
    ruby: [
      "$seven = Join-Path $Root '7zr.exe'",
      "if (-not (Test-Path -LiteralPath $seven)) { Get-File 'https://www.7-zip.org/a/7zr.exe' $seven }",
      "$url = Get-GitHubAssetUrl 'oneclick/rubyinstaller2' '^rubyinstaller-\\d.*-x64\\.7z$'",
      "$archive = Join-Path $env:TEMP 'ruby.7z'",
      "Get-File $url $archive",
      "$dest = Join-Path $Root 'ruby'",
      "New-Item -ItemType Directory -Force -Path $dest | Out-Null",
      "& $seven x $archive \"-o$dest\" -y | Out-Null",
      "Add-BinFromExe $dest 'ruby.exe'",
    ],
    php: [
      "Expand-UrlZip 'https://windows.php.net/downloads/releases/latest/php-8.4-nts-Win32-vs17-x64-latest.zip' (Join-Path $Root 'php')",
      "Add-BinFromExe (Join-Path $Root 'php') 'php.exe'",
    ],
    dotnet: [
      "$script = Join-Path $env:TEMP 'dotnet-install.ps1'",
      "Get-File 'https://dot.net/v1/dotnet-install.ps1' $script",
      "& $script -Channel 8.0 -InstallDir (Join-Path $Root 'dotnet')",
      "Add-UserPath (Join-Path $Root 'dotnet')",
    ],
    deno: [
      "Invoke-Expression (Invoke-RestMethod 'https://deno.land/install.ps1')",
      "Add-UserPath (Join-Path $env:USERPROFILE '.deno\\bin')",
    ],
    bun: [
      "Invoke-Expression (Invoke-RestMethod 'https://bun.sh/install.ps1')",
      "Add-UserPath (Join-Path $env:USERPROFILE '.bun\\bin')",
    ],
    yarn: ["Install-NpmGlobal 'yarn'"],
    pnpm: [
      "Invoke-Expression (Invoke-RestMethod 'https://get.pnpm.io/install.ps1')",
      "Add-UserPath (Join-Path $env:LOCALAPPDATA 'pnpm')",
    ],
    typescript: ["Install-NpmGlobal 'typescript'"],
    vercel: ["Install-NpmGlobal 'vercel'"],
    kubectl: [
      "$ver = (Invoke-RestMethod 'https://dl.k8s.io/release/stable.txt').Trim()",
      "Get-File \"https://dl.k8s.io/release/$ver/bin/windows/amd64/kubectl.exe\" (Join-Path $UserBin 'kubectl.exe')",
    ],
    terraform: [
      "$rel = Invoke-RestMethod 'https://api.releases.hashicorp.com/v1/releases/terraform/latest'",
      "$build = $rel.builds | Where-Object { $_.os -eq 'windows' -and $_.arch -eq 'amd64' } | Select-Object -First 1",
      "Expand-UrlZip $build.url (Join-Path $Root 'terraform')",
      "Copy-MatchingFile (Join-Path $Root 'terraform') 'terraform.exe' (Join-Path $UserBin 'terraform.exe')",
    ],
    awscli: [
      "if (-not (Have 'python')) { throw 'Python is required before the AWS CLI' }",
      "python -m pip install --user --upgrade awscli",
      "$scripts = & python -c \"import os, site; print(os.path.join(site.USER_BASE, 'Scripts'))\"",
      "Add-UserPath $scripts",
    ],
    gcloud: [
      "$dest = Join-Path $Root 'gcloud'",
      "Expand-UrlZip 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-windows-x86_64.zip' $dest",
      "$installer = Get-ChildItem -LiteralPath $dest -Recurse -Filter 'install.bat' | Select-Object -First 1",
      "if (-not $installer) { throw 'Google Cloud SDK archive had no installer' }",
      "& $installer.FullName --quiet --usage-reporting=false --path-update=true --command-completion=false",
      "Add-BinFromExe $dest 'gcloud.cmd'",
    ],
    sqlite: [
      "$html = (Invoke-WebRequest 'https://www.sqlite.org/download.html' -UseBasicParsing).Content",
      "if ($html -notmatch 'sqlite-tools-win-x64-\\d+\\.zip') { throw 'Could not find the SQLite tools archive' }",
      "$name = $Matches[0]",
      "$year = (Get-Date).Year",
      "$done = $false",
      "foreach ($y in @($year, ($year - 1))) {",
      "  try {",
      "    Expand-UrlZip \"https://www.sqlite.org/$y/$name\" (Join-Path $Root 'sqlite')",
      "    $done = $true",
      "    break",
      "  } catch { }",
      "}",
      "if (-not $done) { throw 'Could not download SQLite tools' }",
      "Copy-MatchingFile (Join-Path $Root 'sqlite') 'sqlite3.exe' (Join-Path $UserBin 'sqlite3.exe')",
    ],
    vscode: [
      "$dest = Join-Path $Root 'vscode'",
      "Expand-UrlZip 'https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-archive' $dest",
      "Add-BinFromExe $dest 'code.cmd'",
    ],
  };
  return zip[id] || null;
}

const WIN_SKIP = {
  docker: "Docker Desktop can only be installed by an administrator, so it was skipped.",
  "postgres-client": "The PostgreSQL Windows installer asks for an administrator, so it was skipped.",
};

function genPowerShell(os, ids) {
  const selected = toolsFor(os, ids);
  const L = [psPrelude()];
  for (const tool of selected) {
    const body = winBody(tool.id);
    L.push(`# ${tool.name}`);
    L.push(`if (Have '${tool.check}') { Write-Host "OK ${tool.name} already installed" -ForegroundColor Green }`);
    L.push("else {");
    if (!body) {
      const why = WIN_SKIP[tool.id] || (tool.name + " has no per-user installer, so it was skipped.");
      L.push(`  Write-Warning "${why}"`);
    } else {
      L.push(`  Write-Host "==> Installing ${tool.name}..." -ForegroundColor Blue`);
      L.push("  try {");
      for (const line of body) L.push("    " + line);
      L.push("  } catch {");
      L.push(`    Write-Warning "${tool.name} did not install. $($_.Exception.Message)"`);
      L.push("  }");
    }
    L.push("}");
    L.push("");
  }
  L.push("Write-Host 'Done. Open a new terminal so the new tools are on your PATH.' -ForegroundColor Cyan");
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
    "REM Installs for the current user. Does not ask for an administrator password.",
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
