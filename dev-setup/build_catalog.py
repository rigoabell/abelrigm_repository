#!/usr/bin/env python3
"""Export the Rig Setup tool catalog to the website as static JSON.

The website (GitHub Pages) is static and cannot import app.py at runtime, so we
snapshot the catalog into docs/data/tools.json. Run this whenever CATALOG in
app.py changes:

    python3 dev-setup/build_catalog.py
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, "docs", "data", "tools.json")

sys.path.insert(0, HERE)
import app  # noqa: E402  (import after sys.path tweak)


def main():
    tools = []
    for tool in app.CATALOG:
        tools.append({
            "id": tool["id"],
            "name": tool["name"],
            "category": tool["category"],
            "icon": tool.get("icon", ""),
            "description": tool["description"],
            "check": tool["check"],
            "install": tool.get("install", {}),
        })
    payload = {
        "generatedBy": "dev-setup/build_catalog.py",
        "count": len(tools),
        "categories": list(dict.fromkeys(t["category"] for t in tools)),
        "tools": tools,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"Wrote {len(tools)} tools to {OUT}")


if __name__ == "__main__":
    main()
