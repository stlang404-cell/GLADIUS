#!/usr/bin/env python3
"""Build THE-ELO-CHEAT-SHEETS.pdf — compact printable reference (US Letter, two columns)."""
from __future__ import annotations

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from book import BUILD, ROOT, Book, Diagrams, Renderer, esc  # noqa: E402
from build_pdf import font_faces  # noqa: E402
from chessfmt import parse_front  # noqa: E402

CSS = """
@page { size: letter; margin: 0.5in 0.5in 0.55in; background: #FFFFFF;
  @bottom-left { content: "The Elo Cheat Sheets"; font-family: Inter, sans-serif; font-size: 6.5pt; color: #8B8378;
                 letter-spacing: 0.14em; text-transform: uppercase; }
  @bottom-right { content: counter(page) " / " counter(pages); font-family: Inter, sans-serif; font-size: 6.5pt; color: #8B8378; } }
html { font-size: 8.6pt; }
body { margin: 0; line-height: 1.36; }
.head { border-bottom: 2px solid #B08D2E; margin-bottom: 0.12in; padding-bottom: 0.06in; }
.head .t { font-family: "Cormorant Garamond", serif; font-size: 25pt; font-weight: 700; margin: 0; line-height: 1; }
.head .s { font-family: Inter, sans-serif; font-size: 7.5pt; letter-spacing: 0.18em; text-transform: uppercase; color: #7E6219; margin: 0.04in 0 0; }
.page1 { break-after: page; }
.cs-sec { margin-bottom: 0.14in; }
.cs-sec > h2 { font-size: 15pt; margin: 0.04in 0 0.08in; border-bottom: 1px solid #E3D9C4; break-after: avoid;
               bookmark-level: 1; }
.cs-cols { columns: 2; column-gap: 0.28in; }
.cs-sec.newpage { break-before: page; }
.box { margin: 0 0 0.09in; padding: 0.06in 0.1in 0.03in; break-inside: avoid; }
.box-head { margin-bottom: 0.03in; }
.box ol, .box ul { margin: 0 0 0.03in; padding-left: 1.2em; }
.box li { margin-bottom: 0.02in; }
table { font-size: 7.6pt; margin: 0 0 0.1in; break-inside: avoid; }
th, td { padding: 0.025in 0.05in; }
figure.diagram { width: 1.9in; display: inline-block; vertical-align: top; margin: 0 0.12in 0.08in 0; break-inside: avoid; }
figure.diagram figcaption { font-size: 7pt; margin-top: 0.02in; }
p { margin-bottom: 0.06in; }
.master .box { font-size: 9pt; padding: 0.08in 0.14in 0.04in; margin-bottom: 0.1in; }
.master .box-coach { font-size: 8pt; }
.master h2 { font-size: 18pt; bookmark-level: 1; }
.master .box-cheat ol li { margin-bottom: 0.05in; }
"""


def build_html() -> str:
    book = Book()
    dg = Diagrams("pdf")
    r = Renderer(book, "pdf", dg)
    _, master = parse_front((ROOT / "cheatsheets" / "master-checklist.md").read_text())
    _, sheets = parse_front((ROOT / "cheatsheets" / "cheatsheets.md").read_text())
    css = font_faces() + (ROOT / "assets" / "css" / "book-base.css").read_text() + CSS
    head = ('<div class="head"><p class="t">The Elo Cheat Sheets</p><p class="s">The Elo Blueprint · '
            'practical reference · print double-sided and keep it next to your board</p></div>')
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>The Elo Cheat Sheets</title>'
            f'<meta name="author" content="{esc(book.meta["publisher"])}"/><style>{css}</style></head><body>'
            f'<section class="page1 master">{head}{r.render_body(master)}</section>'
            f'{sections(r.render_body(sheets))}</body></html>')


def sections(h: str) -> str:
    import re
    chunks = re.split(r"(?=<h2[ >])", h)
    out = []
    for i, c in enumerate(chunks):
        if not c.strip():
            continue
        m = re.match(r"(<h2[^>]*>.*?</h2>)(.*)", c, re.S)
        head, body = (m.group(1), m.group(2)) if m else ("", c)
        newpage = " newpage" if any(k in head for k in ("Endgame essentials",)) else ""
        out.append(f'<section class="cs-sec{newpage}">{head}<div class="cs-cols">{body}</div></section>')
    return "".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(BUILD / "dist" / "THE-ELO-CHEAT-SHEETS.pdf"))
    args = ap.parse_args()
    import weasyprint
    h = build_html()
    (BUILD / "pdf").mkdir(parents=True, exist_ok=True)
    (BUILD / "pdf" / "cheatsheets.html").write_text(h)
    doc = weasyprint.HTML(string=h, base_url=str(ROOT)).render()
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.write_pdf(str(out))
    print("cheatsheets:", out, len(doc.pages), "pages", out.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
