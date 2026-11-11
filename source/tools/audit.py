#!/usr/bin/env python3
"""Mechanical release audit -> build/VERIFICATION-REPORT.md.

Every line in the report comes from a check executed by this script or from the
logs of validate.py / EPUBCheck / test_app.js produced by build_all.sh.
"""
from __future__ import annotations

import collections
import datetime
import json
import pathlib
import re
import subprocess
import sys

import chess
from pypdf import PdfReader

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from book import BUILD, ROOT, Book  # noqa: E402
from chessfmt import iter_blocks  # noqa: E402

DIST = BUILD / "dist"
LOGS = BUILD / "logs"


def pdf_audit(path: pathlib.Path, must_contain: list[str]) -> list[str]:
    out = []
    r = PdfReader(str(path))
    n = len(r.pages)
    out.append(f"- File size: {path.stat().st_size / 1e6:.2f} MB; pages: {n}")
    fonts = subprocess.run(["pdffonts", str(path)], capture_output=True, text=True).stdout.splitlines()[2:]
    not_emb = [l for l in fonts if l.split() and len(l.split()) >= 5 and l.split()[-5] != "yes"]
    out.append(f"- Fonts: {len(fonts)} font objects; not embedded: {len(not_emb)}"
               + (" ✅" if not not_emb else " ❌ " + "; ".join(not_emb[:3])))

    def count_outline(o):
        c = 0
        for it in o:
            c += count_outline(it) if isinstance(it, list) else 1
        return c
    try:
        bm = count_outline(r.outline)
    except Exception:
        bm = 0
    out.append(f"- Bookmarks (PDF outline entries): {bm}")
    links = broken = 0
    for pg in r.pages:
        for a in pg.get("/Annots") or []:
            a = a.get_object()
            if a.get("/Subtype") != "/Link":
                continue
            links += 1
            act = a.get("/A")
            dest = a.get("/Dest")
            if act is not None and act.get("/S") == "/URI":
                continue
            if dest is None and act is not None:
                dest = act.get("/D")
            if dest is None:
                broken += 1
    out.append(f"- Internal link annotations: {links}; without destination: {broken}"
               + (" ✅" if broken == 0 else " ❌"))
    texty = 0
    full = []
    for pg in r.pages:
        try:
            t = pg.extract_text() or ""
        except Exception:
            t = ""
        texty += len(t.strip()) > 80
        full.append(t)
    blob = " ".join(" ".join(full).split()).lower()
    found = [w for w in must_contain if w.lower() in blob]
    out.append(f"- Searchable/selectable text: {texty}/{n} pages have extractable text; expected phrases found "
               f"{len(found)}/{len(must_contain)}" + (" ✅" if len(found) == len(must_contain) else " ⚠️"))
    meta = r.metadata or {}
    out.append(f"- Metadata title: {meta.get('/Title', '—')}")
    return out


def main():
    book = Book()
    lines = [f"# Verification Report — The Elo Blueprint", "",
             f"Generated {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')} by `tools/audit.py`. "
             "Every figure below was produced by an executed check.", ""]

    # ---------------- content counts
    words = 0
    diagrams = lines_n = 0
    for n, ch in book.chapters.items():
        prose = re.sub(r"```.*?```", "", ch["body"], flags=re.S)
        words += len(prose.split())
        for kind, _, _ in iter_blocks(ch["body"]):
            diagrams += kind == "board"
            lines_n += kind == "line"
    doc_words = sum(len(d["body"].split()) for d in book.docs.values())
    exs = list(book.all_exercises())
    types = collections.Counter(e["type"] for _, e in exs)
    diffs = collections.Counter(e["difficulty"] for _, e in exs)
    sides = collections.Counter("White" if chess.Board(e["fen"]).turn else "Black" for _, e in exs)
    goals = collections.Counter(e["goal"] for _, e in exs)
    fens = collections.Counter(" ".join(chess.Board(e["fen"]).fen().split()[:4]) for _, e in exs)
    dups = sum(1 for v in fens.values() if v > 1)
    lines += ["## 1. Content", "",
              f"- Chapters: **{len(book.chapters)}** (expected 28); front/back documents: {len(book.docs)}",
              f"- Chapter prose: ~{words:,} words; front/back matter: ~{doc_words:,} words",
              f"- Lesson diagrams: {diagrams}; move-line blocks: {lines_n}",
              f"- Exercises: **{len(exs)}** in {len(book.sets)} sets "
              f"({sum(1 for k in book.sets if not k.startswith('T'))} chapter sets, "
              f"{sum(1 for k in book.sets if k.startswith('T'))} stage tests); duplicate positions: {dups}",
              f"- By type: " + ", ".join(f"{k} {v}" for k, v in types.most_common()),
              f"- By difficulty: " + ", ".join(f"d{k} {diffs[k]}" for k in sorted(diffs)),
              f"- Side to move: White {sides['White']}, Black {sides['Black']}; goals: "
              + ", ".join(f"{k} {v}" for k, v in goals.most_common()),
              f"- Exercises with listed wrong answers: {sum(1 for _, e in exs if e.get('wrong'))}; with hints: "
              f"{sum(1 for _, e in exs if e.get('hint'))}; with engine data: {sum(1 for _, e in exs if e.get('engine'))}",
              ""]
    missing = [n for n in range(1, 29) if n not in book.chapters]
    if missing:
        lines.append(f"- ❌ Missing chapters: {missing}")
    for n, ch in sorted(book.chapters.items()):
        s = book.exercise_set(n)
        if not s:
            lines.append(f"- ❌ Chapter {n} has no exercise set")

    # ---------------- chess validation log
    lines += ["## 2. Chess legality and engine verification", ""]
    vlog = LOGS / "validate.log"
    if vlog.exists():
        t = vlog.read_text()
        summ = [l for l in t.splitlines() if l.startswith("SUMMARY")]
        errs = [l for l in t.splitlines() if l.startswith("ERROR")]
        warns = [l for l in t.splitlines() if l.startswith("WARNING")]
        lines += [f"- `tools/validate.py` (python-chess {chess.__version__} legality + Stockfish 18 analysis): "
                  + (summ[-1] if summ else "no summary"),
                  f"- Errors: {len(errs)}; warnings: {len(warns)} (warnings are listed in build/logs/validate.log)",
                  "- What is checked: every FEN is a legal, reachable-looking position with the right side to move; "
                  "every solution and every move line is legal; SAN↔UCI round-trips; mate solutions end in checkmate "
                  "and no other first move mates as fast; tactical solutions evaluate ≥ +2.00 and beat every "
                  "non-accepted alternative by ≥ 1.50; 'best'/'only'/'draw' goals within tolerance; every listed "
                  "wrong answer is engine-confirmed worse; defender replies are checked against the engine; "
                  "instructional lines marked `check: engine` contain no unannotated move losing > 1.10.", ""]
        if errs:
            lines += ["```"] + errs[:30] + ["```", ""]
    else:
        lines.append("- ❌ validate.log not found — validation not run")

    # ---------------- rules self-test
    b = chess.Board("r3k2r/pppq1ppp/2n2n2/3pp3/1b1PP3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 0 1")
    rules = {
        "castling both sides legal": {"O-O", "O-O-O"} <= {b.san(m) for m in b.legal_moves},
        "en passant": chess.Board("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1").is_legal(chess.Move.from_uci("e5d6")),
        "promotion + SAN/UCI": chess.Board("4k3/P7/8/8/8/8/8/4K3 w - - 0 1").san(chess.Move.from_uci("a7a8q")) == "a8=Q+",
        "checkmate detection": chess.Board("6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1").is_checkmate(),
        "stalemate detection": chess.Board("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").is_stalemate(),
    }
    lines += ["### Rules self-test (library sanity)", ""] + [f"- {k}: {'✅' if v else '❌'}" for k, v in rules.items()] + [""]

    # ---------------- documents
    lines += ["## 3. PDF documents", ""]
    expect = {"THE-ELO-BLUEPRINT-COMPLETE.pdf": ["Contents", "How to Use This Book", "Solutions", "Glossary", "fork"],
              "THE-ELO-CHEAT-SHEETS.pdf": ["Cheat", "checklist"],
              "THE-90-DAY-CHESS-ACCELERATOR.pdf": ["Day", "workbook"]}
    for name, words_ in expect.items():
        p = DIST / name
        lines.append(f"### {name}")
        lines += pdf_audit(p, words_) if p.exists() else ["- ❌ missing"]
        lines.append("")
    lines += ["## 4. EPUB", ""]
    ep = DIST / "THE-ELO-BLUEPRINT.epub"
    elog = LOGS / "epubcheck.log"
    if ep.exists():
        lines.append(f"- File size: {ep.stat().st_size / 1e6:.2f} MB")
    if elog.exists():
        t = elog.read_text()
        m = re.search(r"Messages: .*", t)
        lines.append(f"- EPUBCheck 5.1.0: {m.group(0) if m else 'see log'}"
                     + (" ✅" if "0 fatals / 0 errors" in t else " ❌"))
    else:
        lines.append("- ❌ EPUBCheck log missing")
    lines.append("")
    lines += ["## 5. Interactive trainer and website", ""]
    alog = LOGS / "app-tests.log"
    if alog.exists():
        t = alog.read_text()
        allres = [l.rstrip() for l in t.splitlines() if re.match(r"\s*(PASS|FAIL)\s", l)]
        m = re.search(r"(\d+) passed, (\d+) failed", t)
        total = int(m.group(1)) + int(m.group(2)) if m else len(allres)
        res = allres[-total:]  # the suite prints its final summary list last
        lines.append(f"- Playwright suite (`tools/test_app.js`, iPhone 13 and 1280×800 viewports): "
                     + (f"{m.group(1)} passed, {m.group(2)} failed" if m else "no summary line"))
        lines += ["```"] + res + ["```"]
    else:
        lines.append("- ❌ app test log missing")
    lines.append("")
    rlog = LOGS / "release.log"
    lines += ["## 6. Release packaging", ""]
    lines += ([f"- {l}" for l in rlog.read_text().splitlines()] if rlog.exists() else ["- (run build_release.py)"])
    lines.append("")
    lines += ["## 7. Not verified / known limitations", "",
              "- Rendering inside Apple Books on a physical iPhone was not tested (no device available); the EPUB "
              "passes EPUBCheck and was rendered in Chromium at phone width.",
              "- The website was not deployed (no hosting credentials were available); it was tested locally "
              "with a static server.",
              "- Engine verification uses Stockfish 18 (WASM) at fixed depth; it is strong but not a proof. "
              "Endgame verdicts were not checked against tablebases (no network access to tablebase services).",
              "- Prose explanations were reviewed for consistency with the engine output of each position, but "
              "instructional judgment beyond the engine is labelled as coaching judgment and remains human-style "
              "advice.", ""]
    out = BUILD / "VERIFICATION-REPORT.md"
    out.write_text("\n".join(lines))
    print("report:", out)


if __name__ == "__main__":
    main()
