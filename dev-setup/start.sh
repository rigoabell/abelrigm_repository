#!/usr/bin/env bash
# Rig Setup launcher for macOS and Linux.
# Finds a Python 3 interpreter and starts the local web app.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

find_python() {
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info[0] >= 3 else 1)' >/dev/null 2>&1; then
        echo "$candidate"
        return 0
      fi
    fi
  done
  return 1
}

PY="$(find_python || true)"

if [ -z "${PY:-}" ]; then
  echo "Python 3 was not found on this machine."
  echo
  case "$(uname -s)" in
    Darwin)
      echo "Install it, then re-run ./start.sh :"
      echo "  - Xcode tools:  xcode-select --install"
      echo "  - or Homebrew:  brew install python"
      ;;
    *)
      echo "Install it, then re-run ./start.sh :"
      echo "  - Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y python3"
      echo "  - Fedora:        sudo dnf install -y python3"
      echo "  - Arch:          sudo pacman -S python"
      ;;
  esac
  exit 1
fi

echo "Using $("$PY" --version 2>&1) at $(command -v "$PY")"
exec "$PY" "$SCRIPT_DIR/app.py" "$@"
