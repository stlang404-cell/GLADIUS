#!/usr/bin/env python3
"""Validate the whole book in parallel (one engine per file) and write build/logs/validate.log.

Runs tools/validate.py on every exercise file and manuscript file at the given depth,
then a whole-book legality/duplicate pass without the engine, and aggregates the result.
"""
import argparse, concurrent.futures as cf, pathlib, re, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--depth", type=int, default=18); ap.add_argument("-j", type=int, default=4)
a = ap.parse_args()
files = sorted((ROOT / "exercises").glob("*.json")) + sorted((ROOT / "manuscript").glob("*/*.md")) + \
        sorted((ROOT / "cheatsheets").glob("*.md"))
def run(f):
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "validate.py"), "--depth", str(a.depth), "--quiet", str(f)],
                       capture_output=True, text=True, cwd=ROOT)
    return f, r.stdout + r.stderr
tot = {"ex": 0, "dg": 0, "ln": 0, "err": 0, "warn": 0}
lines = []
with cf.ThreadPoolExecutor(a.j) as ex:
    for f, out in ex.map(run, files):
        m = re.search(r"SUMMARY: (\d+) exercises, (\d+) diagrams, (\d+) move lines checked; (\d+) errors, (\d+) warnings", out)
        if not m:
            lines.append(f"ERROR   {f.name}: validator crashed\n{out[-2000:]}"); tot["err"] += 1; continue
        for k, v in zip(("ex", "dg", "ln", "err", "warn"), map(int, m.groups())): tot[k] += v
        lines += [l for l in out.splitlines() if l.startswith(("ERROR", "WARNING"))]
        print(f"{f.relative_to(ROOT)}: {m.group(0)[9:]}", flush=True)
r = subprocess.run([sys.executable, str(ROOT / "tools" / "validate.py"), "--no-engine", "--quiet"], capture_output=True, text=True, cwd=ROOT)
dup = [l for l in r.stdout.splitlines() if l.startswith("ERROR")]
tot["err"] += len(dup); lines += dup
summary = (f"SUMMARY: {tot['ex']} exercises, {tot['dg']} diagrams, {tot['ln']} move lines checked at depth {a.depth} "
           f"(+ whole-book legality/duplicate pass: {len(dup)} problems); {tot['err']} errors, {tot['warn']} warnings")
log = ROOT / "build" / "logs" / "validate.log"; log.parent.mkdir(parents=True, exist_ok=True)
log.write_text("\n".join(lines + ["", summary]) + "\n")
print("\n".join(lines)); print(summary)
sys.exit(1 if tot["err"] else 0)
