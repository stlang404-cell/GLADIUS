#!/usr/bin/env python3
"""Assemble the final release folder and THE-ELO-BLUEPRINT-COMPLETE-RELEASE.zip.

Expects the products to be built already (see BUILD.md / build_all.sh).
Fails if anything required is missing; verifies ZIP integrity afterwards.
"""
from __future__ import annotations

import hashlib
import pathlib
import shutil
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
DIST = BUILD / "dist"
REL_NAME = "THE-ELO-BLUEPRINT-COMPLETE-RELEASE"
REL = BUILD / "release" / REL_NAME

DOCS = ["THE-ELO-BLUEPRINT-COMPLETE.pdf", "THE-ELO-BLUEPRINT.epub", "THE-ELO-CHEAT-SHEETS.pdf",
        "THE-90-DAY-CHESS-ACCELERATOR.pdf"]
SOURCE_EXCLUDE = {"node_modules", "build", "__pycache__", ".git"}
TEMP_PATTERNS = (".tmp", ".pyc", ".DS_Store", "~")


def sha256(p: pathlib.Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def copy_source(dst: pathlib.Path):
    def ignore(d, names):
        return [n for n in names if n in SOURCE_EXCLUDE or n.endswith(TEMP_PATTERNS)]
    shutil.copytree(ROOT, dst, ignore=ignore)


def zipdir(src: pathlib.Path, out: pathlib.Path, root_name: str | None = None):
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in sorted(src.rglob("*")):
            if p.is_file():
                arc = p.relative_to(src).as_posix()
                if root_name:
                    arc = f"{root_name}/{arc}"
                z.write(p, arc)
    with zipfile.ZipFile(out) as z:
        bad = z.testzip()
        if bad:
            raise SystemExit(f"ZIP integrity failure in {out}: {bad}")
    return out


def main():
    missing = [d for d in DOCS if not (DIST / d).exists()]
    for d in ("app", "site"):
        if not (BUILD / d / "index.html").exists():
            missing.append(f"build/{d}/index.html")
    if missing:
        raise SystemExit(f"missing build products: {missing}")
    if REL.parent.exists():
        shutil.rmtree(REL.parent)
    REL.mkdir(parents=True)
    for d in DOCS:
        shutil.copy2(DIST / d, REL / d)
    shutil.copytree(BUILD / "app", REL / "THE-ELO-BLUEPRINT-INTERACTIVE")
    copy_source(REL / "THE-ELO-BLUEPRINT-SOURCE")
    zipdir(BUILD / "site", REL / "THE-ELO-BLUEPRINT-WEBSITE.zip")
    report = BUILD / "VERIFICATION-REPORT.md"
    if report.exists():
        shutil.copy2(report, REL / "VERIFICATION-REPORT.md")
    readme = ROOT / "release-README.txt"
    if readme.exists():
        shutil.copy2(readme, REL / "README.txt")
    # no temporary artefacts
    junk = [p for p in REL.rglob("*") if p.name.endswith(TEMP_PATTERNS) or p.name == "__pycache__"]
    if junk:
        raise SystemExit(f"temporary files in release: {junk[:5]}")
    # checksums
    lines = []
    for p in sorted(REL.rglob("*")):
        if p.is_file() and p.name != "SHA256SUMS.txt":
            lines.append(f"{sha256(p)}  {p.relative_to(REL).as_posix()}")
    (REL / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n")
    out = zipdir(REL, BUILD / "release" / f"{REL_NAME}.zip", root_name=REL_NAME)
    # verify the zip contains every required top-level item
    with zipfile.ZipFile(out) as z:
        names = set(z.namelist())
    for need in DOCS + ["THE-ELO-BLUEPRINT-WEBSITE.zip", "THE-ELO-BLUEPRINT-INTERACTIVE/index.html",
                        "THE-ELO-BLUEPRINT-SOURCE/BUILD.md", "SHA256SUMS.txt"]:
        if f"{REL_NAME}/{need}" not in names:
            raise SystemExit(f"release zip lacks {need}")
    print(f"release: {out} ({out.stat().st_size / 1e6:.1f} MB, {len(names)} entries) — integrity OK")
    for d in DOCS:
        print(f"  {d}: {(REL / d).stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    sys.exit(main())
