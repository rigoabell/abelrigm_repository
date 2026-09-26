# abelrigm repository

### 🌐 Live site → **https://rigoabell.github.io/abelrigm_repository/**

[![Deploy Dev Hub to GitHub Pages](https://github.com/rigoabell/abelrigm_repository/actions/workflows/pages.yml/badge.svg)](https://github.com/rigoabell/abelrigm_repository/actions/workflows/pages.yml)

Central hub for the work: portfolio, tools built, and notes.
👉 **[Open the Dev Hub website](https://rigoabell.github.io/abelrigm_repository/)**

## Contents

- **`docs/` — Dev Hub website** (static, GitHub Pages ready).
  - **Portfolio** is the work: Amazon, tools developed, and other projects.
  - **Toolkit** lists tools built and ready to download.
  - **Rig Setup** is a project on the Portfolio page, not its own site page.
    That project installs Python, Node, and the other machine dependencies, and
    it shows how to run the downloaded file (`bash ~/Downloads/rig-setup.sh` on
    Mac/Linux, double-click `rig-setup.bat` on Windows).
  Everything in the browser stays on your machine; nothing is uploaded.
- **`dev-setup/` — Rig Setup app.** A dependency-free (Python standard library)
  local web app that detects your OS and installs the developer tools you need,
  with a live UI and install log. It never assumes you're an administrator. See
  [`dev-setup/README.md`](dev-setup/README.md).

Both share one tool catalog (30 tools). The website's catalog is generated from
the app via `python3 dev-setup/build_catalog.py`.

## Run the Dev Hub site locally

```bash
python3 -m http.server 8080 --directory docs
# open http://127.0.0.1:8080
```

## Publish the site on GitHub Pages

1. Merge this to `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
   deploys `docs/` on every push to `main` (and via **Run workflow**).
4. The site publishes at `https://rigoabell.github.io/abelrigm_repository/`.

## Run the Rig Setup app

```bash
cd dev-setup
./start.sh          # macOS / Linux   (sudo ./start.sh to also install admin-only tools)
# Windows: ./start.ps1  (or double-click start.bat)
```
