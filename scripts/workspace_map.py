#!/usr/bin/env python3
"""Quick workspace map for starknet-agentic.

Prints each workspace package and internal dependency edges.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACES = [ROOT / "packages", ROOT / "examples", ROOT / "website"]


def load_pkg_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def iter_package_jsons():
    for ws in WORKSPACES:
        if not ws.exists():
            continue
        if ws.is_file() and ws.name == "package.json":
            yield ws
            continue
        if ws.name == "website":
            pkg = ws / "package.json"
            if pkg.exists():
                yield pkg
            continue
        for pkg in ws.glob("*/package.json"):
            yield pkg


def main() -> None:
    packages = []
    for pkg_file in iter_package_jsons():
        data = load_pkg_json(pkg_file)
        name = data.get("name")
        if not name:
            continue
        deps = {}
        for key in ("dependencies", "devDependencies", "peerDependencies"):
            deps.update(data.get(key, {}))
        packages.append({"name": name, "path": str(pkg_file.relative_to(ROOT)), "deps": deps})

    names = {p["name"] for p in packages}
    print("# Workspace packages")
    for p in sorted(packages, key=lambda x: x["name"]):
        print(f"- {p['name']} ({p['path']})")

    print("\n# Internal dependency edges")
    edges = []
    for p in packages:
        for dep in p["deps"]:
            if dep in names:
                edges.append((p["name"], dep))

    if not edges:
        print("- none")
        return

    for src, dst in sorted(edges):
        print(f"- {src} -> {dst}")


if __name__ == "__main__":
    main()
