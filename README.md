# abelrigm repository

Central hub for my developments, plus tooling to set up a fresh machine.

## Contents

- **`docs/` — Dev Hub website** (static, GitHub Pages ready). A landing page for
  my projects with a **Machine Setup** builder: pick your OS and tools and
  download a ready-to-run `setup.sh` / `setup.ps1`. Everything runs in your
  browser; nothing is uploaded.
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
4. The site publishes at `https://rigoabell.github.io/abelrigm_respository/`.

## Run the Rig Setup app

```bash
cd dev-setup
./start.sh          # macOS / Linux   (sudo ./start.sh to also install admin-only tools)
# Windows: ./start.ps1  (or double-click start.bat)
```
