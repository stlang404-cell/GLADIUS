#!/usr/bin/env python3
"""Export everything the interactive trainer needs to build/web/data/book.json."""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from book import BUILD, ROOT, Book, Diagrams, Renderer, ex_label, md_inline  # noqa: E402
from chessfmt import parse_front  # noqa: E402

KEEP = ["id", "type", "difficulty", "fen", "question", "solution", "goal", "mate_in", "accept", "accept_by_ply",
        "explanation", "wrong", "hint", "objective", "tags", "side"]


def main():
    book = Book()
    r = Renderer(book, "web", Diagrams("web"))
    meta = {k: book.meta[k] for k in ("title", "subtitle", "edition", "version", "year", "publisher")}
    chapters, exercises, sets = [], {}, {}
    part_of = {}
    for part in book.meta["parts"]:
        for n in part["chapters"]:
            part_of[n] = part["num"]
    for n in sorted(book.chapters):
        ch = book.chapters[n]
        r_html = r.render_body(ch["body"], n)
        r_html = r.number_headings(r_html, f"ch-{n:02d}")
        s = book.exercise_set(n)
        chapters.append({"n": n, "slug": ch["slug"], "title": ch["title"], "subtitle": ch.get("subtitle", ""),
                         "stage": str(ch.get("stage", "")), "part": part_of.get(n), "skills": ch.get("skills", []),
                         "objectives": [md_inline(o) for o in ch.get("objectives", [])],
                         "next_game": md_inline(ch.get("next_game", "")), "html": r_html,
                         "exercises": [e["id"] for e in s["exercises"]] if s else []})
    for key, s in book.sets.items():
        sets[key] = {"title": s["title"], "ids": [e["id"] for e in s["exercises"]],
                     "is_test": str(key).startswith("T")}
        for e in s["exercises"]:
            d = {k: e[k] for k in KEEP if k in e}
            d["set"] = key
            d["label"] = ex_label(e["id"])
            d["question_html"] = md_inline(e["question"])
            d["explanation_html"] = md_inline(e["explanation"])
            exercises[e["id"]] = d
    docs = []
    for slug, d in book.docs.items():
        docs.append({"slug": slug, "title": d["title"], "kind": d.get("kind", ""),
                     "html": r.number_headings(r.render_body(d["body"]), f"doc-{slug}")})
    for name in ("master-checklist", "cheatsheets"):
        p = ROOT / "cheatsheets" / f"{name}.md"
        if p.exists():
            f, body = parse_front(p.read_text())
            docs.append({"slug": f.get("slug", name), "title": f.get("title", name), "kind": "reference",
                         "html": r.render_body(body)})
    plan_p = BUILD / "plan" / "plan.json"
    plan = json.loads(plan_p.read_text()) if plan_p.exists() else None
    data = {"meta": meta, "parts": book.meta["parts"], "chapters": chapters, "exercises": exercises,
            "sets": sets, "docs": docs, "plan": plan}
    out = BUILD / "web" / "data" / "book.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print("webdata:", out, out.stat().st_size // 1024, "KB;", len(chapters), "chapters,", len(exercises), "exercises")


if __name__ == "__main__":
    main()
