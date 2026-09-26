# Rig Setup — new machine developer bootstrapper

A tiny, **dependency-free** app that turns a fresh computer into a ready-to-code
machine. It opens a small web UI, detects your operating system and package
manager, shows which developer tools are already installed, and installs the
missing ones using the correct command for your platform.

It is written entirely against the **Python 3 standard library** — no `pip
install` required — so it can run as the very first thing on a new machine.

## Quick start

### macOS / Linux
```bash
cd dev-setup
./start.sh
```

### Windows
```powershell
cd dev-setup
./start.ps1        # PowerShell
# or double-click start.bat
```

The launcher finds Python 3, starts a local server on
<http://127.0.0.1:8765>, and opens your browser. If Python 3 is missing, the
launcher prints the one command needed to install it, then you re-run.

You can also run it directly:
```bash
python3 app.py            # add --no-browser to skip auto-opening the browser
```

## What it does

1. **Detects your system** — OS, architecture, and the best available package
   manager (`apt`, `dnf`, `pacman`, `zypper`, Homebrew, `winget`, or `choco`).
2. **Scans for tools** — shows Installed / Not installed plus the detected
   version for each tool in the catalog.
3. **Installs on demand** — select individual tools or "all missing", click
   **Install**, and watch a live log. Each install uses the right method for
   your OS (package manager, official install script, or `npm -g`).
4. **Re-verifies** — after each install it re-detects the tool to confirm it
   actually landed.

Nothing is installed until you explicitly click Install.

## It never assumes you're an administrator

The app detects your actual privilege level at runtime — root, a standard user
with passwordless `sudo`, a user who *has* `sudo` but would need a password, or a
plain user with no elevation at all — and adapts:

- **Prefers no-admin installs.** When you can't elevate, it automatically picks
  user-space install methods (rustup, Deno, Bun, pnpm scripts, `npm -g`,
  Homebrew, `winget`) that drop binaries under your home directory
  (`~/.cargo/bin`, `~/.deno/bin`, `~/.bun/bin`, `~/.local/bin`, …) — no `sudo`
  required. Detection also searches those directories so the tool is recognized
  afterward.
- **Elevates only when it truly can.** `sudo` is added to a command *only* when
  you're root or have passwordless `sudo`. It is never assumed.
- **Flags admin-only tools.** Tools that can only be installed with a system
  package manager show an amber **Admin** tag. If you can't elevate, clicking
  Install does **not** blindly run `sudo` (which would fail or hang without a
  terminal) — it marks the tool **Needs admin** and prints the exact command an
  administrator would run, so you can hand it off or re-run elevated.

To install admin-only tools yourself, run the launcher with elevation, e.g.
`sudo ./start.sh` on Linux, or run it from an elevated PowerShell on Windows.

## Tool catalog (30 tools)

| Category | Tools |
| --- | --- |
| Core CLI | Git, curl, wget, jq, GitHub CLI, ripgrep, C/C++ build tools, CMake |
| Languages & Runtimes | Python 3, Node.js, Go, Rust, Java (OpenJDK), Ruby, PHP, .NET SDK, Deno, Bun |
| JS Tooling | Yarn, pnpm, TypeScript, Vercel CLI |
| Containers & Cloud | Docker, kubectl, Terraform, AWS CLI, Google Cloud CLI |
| Databases | PostgreSQL client, SQLite |
| Editors | Visual Studio Code |

That is **30** tools — well above the 20-tool minimum — covering essentially
everything you'd bootstrap to build web, backend, systems, mobile, data, cloud,
and infrastructure projects with Cursor.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `RIG_SETUP_HOST` | `127.0.0.1` | Interface to bind. |
| `RIG_SETUP_PORT` | `8765` | Port for the local UI. |

## How it's structured

```
dev-setup/
├── app.py            # stdlib web server + tool catalog + install engine
├── web/
│   ├── index.html    # UI markup
│   ├── style.css     # UI styling
│   └── app.js        # UI logic (vanilla JS, no build step)
├── start.sh          # macOS / Linux launcher
├── start.ps1         # Windows PowerShell launcher
├── start.bat         # Windows cmd launcher
└── README.md
```

## Adding a tool

Append an entry to `CATALOG` in `app.py`:

```python
{
    "id": "fzf", "name": "fzf", "category": "Core CLI", "icon": "\U0001F50E",
    "description": "Command-line fuzzy finder.",
    "check": "fzf", "version": ["fzf", "--version"],
    "install": {
        "apt": "sudo apt-get install -y fzf",
        "brew": "brew install fzf",
        "winget": "winget install --id junegunn.fzf -e",
        "choco": "choco install fzf -y",
    },
},
```

`check` is the binary used for detection; `install` maps each supported package
manager (or `unix_script` / `npm`) to the command to run.
