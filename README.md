# abelrigm repository

### 🌐 Live site → **https://rigoabell.github.io/abelrigm_repository/**

[![Deploy Dev Hub to GitHub Pages](https://github.com/rigoabell/abelrigm_repository/actions/workflows/pages.yml/badge.svg)](https://github.com/rigoabell/abelrigm_repository/actions/workflows/pages.yml)

Central hub for the work: portfolio, tools built, and notes.
👉 **[Open the Dev Hub website](https://rigoabell.github.io/abelrigm_repository/)**

## Contents

- **`docs/` — Dev Hub website** (static, GitHub Pages ready).
  - **Portfolio** lists Rig Setup (abelrigm) and 49 Tampermonkey scripts. Each script downloads as a `.txt` file.
  - **Toolkit** lists tools built and ready to download.
  - **Inventory** opens a large inventory CSV in the browser. Average Age and
    Average Threshold are the ASIN’s age and threshold. The desk groups containers
    as Approaching (1–2 days before), At (less than 1 day before), or DIOT (past
    the threshold), and lists them by outer location. The shared copy lives in
    `docs/inventory/data/` (see `manifest.json`; one `latest.csv`, or `part-000`
    and following parts in order). Dropping a CSV publishes that copy through
    the inventory upload service, which replaces the previous file. The next
    open of the desk reads that commit. The page reads the service address from
    `remote.json` on `main`. The service in `worker/` is what writes the file.
    Downloads you generate stay on the machine.
    Open it at
    `https://rigoabell.github.io/abelrigm_repository/inventory/`.
  - **Rig Setup** is a project on the Portfolio page, not its own site page.
    That project installs Python, Node, and the other machine dependencies into
    the current user account (it does not ask for an administrator password), and
    it shows how to run the downloaded file (`bash ~/Downloads/rig-setup.sh` on
    Mac/Linux, double-click `rig-setup.bat` on Windows).
  The saved inventory file is public in this repository. Other pages stay in the browser.
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
# inventory desk: http://127.0.0.1:8080/inventory/
```

## Connect the shared inventory file

A dropped CSV stays on that machine until the upload service is connected. The
page then says the shared save is not connected yet.

1. Create a fine-grained personal access token for this repository with
   **Contents: Read and write**.
2. Add repository secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit),
   `CLOUDFLARE_ACCOUNT_ID`, and `INVENTORY_GITHUB_TOKEN` (the token from step 1).
3. Run **Actions → Deploy inventory upload**. It publishes `worker/`, stores
   the GitHub token on the worker, and writes the worker address into
   `docs/inventory/remote.json`.

The page does not receive either token. After that, a drop replaces
`docs/inventory/data/` and the next open of the desk reads that commit.

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
