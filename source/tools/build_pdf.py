#!/usr/bin/env python3
"""Build THE-ELO-BLUEPRINT-COMPLETE.pdf with WeasyPrint."""
from __future__ import annotations

import argparse
import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from book import BUILD, ROOT, Book, Diagrams, Renderer, esc, md_block  # noqa: E402
from chessfmt import parse_front  # noqa: E402
from cover import COVER_CSS, cover_html  # noqa: E402

FONTS = ROOT / "assets" / "fonts"


def font_faces(ext="woff2", prefix=None) -> str:
    prefix = prefix or FONTS.as_uri() + "/"
    faces = [("Source Serif 4", "source-serif-4", [("400", "normal"), ("400", "italic"), ("600", "normal"),
                                                   ("600", "italic"), ("700", "normal")]),
             ("Cormorant Garamond", "cormorant-garamond", [("500", "normal"), ("500", "italic"), ("600", "normal"),
                                                           ("700", "normal")]),
             ("Inter", "inter", [("400", "normal"), ("500", "normal"), ("600", "normal"), ("700", "normal")])]
    css = []
    for fam, stem, variants in faces:
        for w, st in variants:
            css.append(f'@font-face {{ font-family: "{fam}"; font-weight: {w}; font-style: {st}; '
                       f'src: url("{prefix}{stem}-latin-{w}-{st}.{ext}"); }}')
    return "\n".join(css)


PRINT_CSS = """
@page { size: 7in 10in; margin: 0.85in 0.78in 0.9in 0.78in; background: #FCFAF5;
  @top-center { content: string(runhead); font-family: Inter, sans-serif; font-size: 7pt; letter-spacing: 0.16em;
                text-transform: uppercase; color: #8B8378; }
  @bottom-center { content: counter(page); font-family: Inter, sans-serif; font-size: 8pt; color: #57514A; } }
@page cover { margin: 0; background: #1E1C1A; @top-center { content: none; } @bottom-center { content: none; } }
@page plain { @top-center { content: none; } @bottom-center { content: none; } }
@page opener { @top-center { content: none; } }
html { font-size: 10.2pt; }
body { margin: 0; background: #FCFAF5; }
.cover { page: cover; break-after: page; }
.titlepage, .copyright { page: plain; break-after: page; }
.titlepage { text-align: center; padding-top: 2.2in; }
.titlepage .t { font-family: "Cormorant Garamond", serif; font-size: 34pt; font-weight: 600; margin: 0; letter-spacing: 0.06em; }
.titlepage .s { font-family: "Cormorant Garamond", serif; font-style: italic; font-size: 16pt; color: #57514A; margin: 0.12in 0 0; }
.titlepage .rule { width: 0.9in; height: 1.2pt; background: #B08D2E; margin: 0.35in auto; }
.titlepage .p { font-family: Inter, sans-serif; font-size: 8pt; letter-spacing: 0.3em; text-transform: uppercase; color: #7E6219; margin-top: 3.4in; }
.copyright { font-size: 8.4pt; color: #57514A; padding-top: 4.2in; line-height: 1.45; }
.copyright p { margin-bottom: 0.7em; }
.toc { break-after: page; }
.toc h1 { font-size: 2.4em; margin: 0 0 0.6em; string-set: runhead "Contents"; }
.toc ul { list-style: none; padding: 0; margin: 0; }
.toc li { margin: 0; }
.toc a { color: #2A2724; display: block; }
.toc a::after { content: leader(dotted) " " target-counter(attr(href), page); color: #57514A; }
.toc .toc-part { font-family: Inter, sans-serif; font-size: 7.6pt; letter-spacing: 0.18em; text-transform: uppercase;
                 color: #7E6219; font-weight: 600; margin-top: 1.05em; padding-bottom: 0.2em; }
.toc .toc-part a { color: #7E6219; }
.toc .toc-ch { font-size: 9.8pt; padding: 0.14em 0; }
.toc .toc-ch .n { display: inline-block; width: 2.1em; color: #7E6219; font-family: Inter, sans-serif; font-size: 8pt; }
.toc .toc-sub { font-size: 9.6pt; padding: 0.14em 0; }
.part-page { page: plain; break-before: page; break-after: page; padding-top: 1.7in; }
.part-title { bookmark-level: 1; bookmark-label: content(text); string-set: runhead content(text); }
.chapter { break-before: page; }
.chapter-opener { page: opener; padding-top: 0.5in; }
.chapter-title { bookmark-level: 2; string-set: runhead content(text); }
.chapter h2 { bookmark-level: 3; }
.chapter h3, .chapter h4, .doc h2, .doc h3, .box-head { bookmark-level: none; }
.doc { break-before: page; }
.doc-title { font-size: 2.5em; margin: 0.3in 0 0.6em; bookmark-level: 1; string-set: runhead content(text); }
.exercise-set { break-before: page; }
.exercise-set .ex-set-title { bookmark-level: 3; margin-top: 0; }
.test-set { break-before: page; }
.test-set > .exercise-set { break-before: auto; }
.test-set .ex-set-title { bookmark-level: 2; string-set: runhead content(text); font-size: 2.4em; }
.ex-table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; margin: 0; font-size: 10.2pt; }
.ex-table td.ex-cell { width: 50%; vertical-align: top; border: none; padding: 0 0.15in 0.14in 0; }
.ex-table td.ex-cell + td.ex-cell { padding: 0 0 0.14in 0.15in; }
.ex-table tr { break-inside: avoid; page-break-inside: avoid; }
.exercise .ex-diagram { width: 100%; }
figure.diagram { width: 3.35in; }
.exercise figure.diagram { width: 100%; }
.line figure.diagram { width: 3.1in; }
.hints { break-inside: avoid; }
.solutions-part .doc-title { bookmark-level: 1; }
.sol-set { columns: 2; column-gap: 0.32in; font-size: 8.9pt; }
.sol-set h2 { column-span: all; bookmark-level: 2; string-set: runhead content(text); font-size: 1.6em; margin-top: 1.1em; }
.sol-set:first-of-type h2 { margin-top: 0; }
.back-link::after { content: " (p. " target-counter(attr(href), page) ")"; }
.sol-link::after { content: " p. " target-counter(attr(href), page); }
.ex-q .sol-link { margin-left: 0.3em; }
.qr .box { break-inside: avoid; }
.qr h2 { bookmark-level: 2; }
.gloss h2 { bookmark-level: none; font-size: 1.4em; margin-top: 0.8em; }
.gloss { columns: 2; column-gap: 0.3in; font-size: 9.2pt; }
.gloss h2 { column-span: none; }
.box { break-inside: avoid; }
figure { break-inside: avoid; }
h2, h3 { break-after: avoid; }
p { orphans: 2; widows: 2; }
.box-cheat ol { margin-bottom: 0.2em; }
"""


def toc_html(book: Book, has_qr: bool) -> str:
    li = []
    for slug in book.meta.get("front", []):
        if slug in book.docs:
            li.append(f'<li class="toc-sub"><a href="#{slug}">{esc(book.docs[slug]["title"])}</a></li>')
    for part in book.meta["parts"]:
        li.append(f'<li class="toc-part"><a href="#part-{part["num"]}">{esc(part["name"])} · {esc(part["title"])} '
                  f'· {esc(part["stage"])}</a></li>')
        for n in part["chapters"]:
            if n in book.chapters:
                li.append(f'<li class="toc-ch"><a href="#ch-{n:02d}"><span class="n">{n}</span>'
                          f'{esc(book.chapters[n]["title"])}</a></li>')
        if part.get("test") and book.exercise_set(part["test"]):
            li.append(f'<li class="toc-ch"><a href="#ex-set-{part["test"]}-h"><span class="n">✓</span>'
                      f'Stage {part["num"]} Test</a></li>')
    li.append('<li class="toc-part"><a href="#solutions">Back matter</a></li>')
    li.append('<li class="toc-sub"><a href="#solutions">Solutions</a></li>')
    if has_qr:
        li.append('<li class="toc-sub"><a href="#quick-reference">Quick Reference: The Cheat Codes</a></li>')
    for slug in book.meta.get("back", []):
        if slug in book.docs:
            li.append(f'<li class="toc-sub"><a href="#{slug}">{esc(book.docs[slug]["title"])}</a></li>')
    return f'<nav class="toc"><h1>Contents</h1><ul>{"".join(li)}</ul></nav>'


def part_page(book: Book, part: dict) -> str:
    chs = "".join(f'<li>Chapter {n} · {esc(book.chapters[n]["title"])}</li>'
                  for n in part["chapters"] if n in book.chapters)
    return (f'<section class="part-page" id="part-{part["num"]}"><p class="part-name">{esc(part["name"])}</p>'
            f'<h1 class="part-title">{esc(part["title"])}</h1><p class="part-stage">Stage {part["num"]} · '
            f'{esc(part["stage"])}</p><p class="part-intro">{esc(part["intro"].strip())}</p>'
            f'<ul class="part-chapters">{chs}</ul></section>')


def quick_reference(r: Renderer) -> str:
    """Master checklist (from cheatsheets source) + every chapter's cheat code."""
    out = ['<section class="doc qr" id="doc-quick-reference"><h1 class="doc-title" id="quick-reference">'
           'Quick Reference: The Cheat Codes</h1>']
    cs = ROOT / "cheatsheets" / "master-checklist.md"
    if cs.exists():
        _, body = parse_front(cs.read_text())
        out.append(r.render_body(body))
    out.append('<h2 id="qr-chapters">Cheat codes by chapter</h2>')
    for ch, title, h in r.cheats:
        out.append(f'<aside class="box box-cheat"><p class="box-head"><span class="box-label">Chapter {ch}</span>'
                   f'<span class="box-title">{esc(title)}</span></p>{h}</aside>')
    out.append("</section>")
    return "".join(out)


def build_html(book: Book) -> str:
    dg = Diagrams("pdf")
    r = Renderer(book, "pdf", dg)
    meta = book.meta
    parts = [cover_html(meta)]
    parts.append(f'<section class="titlepage"><p class="t">{esc(meta["title"])}</p><p class="s">{esc(meta["subtitle"])}</p>'
                 f'<div class="rule"></div><p class="p">{esc(meta["publisher"])}</p></section>')
    n_ex = sum(1 for _ in book.all_exercises())
    parts.append(
        f'<section class="copyright"><p><strong>{esc(meta["title"])}</strong> — {esc(meta["subtitle"])}<br/>'
        f'{esc(meta["edition"])}, version {esc(meta["version"])} ({datetime.date.today().isoformat()}).</p>'
        f'<p>© {meta["year"]} {esc(meta["publisher"])}. All rights reserved. You may print this book for your own '
        f'personal study.</p>'
        f'<p><strong>How this book was made.</strong> The text was written with the assistance of an AI system (Claude, '
        f'by Anthropic) under a detailed editorial specification. Every diagram, move sequence and all {n_ex} exercises '
        f'were checked programmatically for legality with python-chess and analysed with the Stockfish 18 chess engine; '
        f'exercise solutions, listed wrong answers and recommended opening lines are engine-verified. Instructional '
        f'judgments that go beyond what an engine can verify are labelled as coaching judgment.</p>'
        f'<p>Typeset in Source Serif 4, Cormorant Garamond and Inter (SIL Open Font License). Chess pieces drawn from '
        f'the DejaVu Sans glyph outlines (DejaVu/Bitstream Vera licence).</p>'
        f'<p>Companion products: <em>The Elo Cheat Sheets</em>, <em>The 90-Day Chess Accelerator</em>, and '
        f'<em>The Elo Blueprint Interactive</em> trainer (offline web app).</p></section>')
    body = []
    for slug in meta.get("front", []):
        if slug in book.docs:
            body.append(r.doc_html(slug))
    for part in meta["parts"]:
        body.append(part_page(book, part))
        for n in part["chapters"]:
            if n in book.chapters:
                body.append(r.chapter_html(n))
        t = part.get("test")
        if t and book.exercise_set(t):
            body.append('<section class="test-set">' + r.exercises_html(
                t, heading=f'Stage {part["num"]} Test',
                intro=(f'Fifteen mixed positions covering Part {part["num"]}. Solve them without moving the pieces, '
                       f'write down your answers, then mark yourself. 12/15 or better: move on with confidence. '
                       f'9–11: review the chapters behind your misses. Below 9: repeat this part\'s exercises before '
                       f'continuing.')) + '</section>')
    sol = ['<section class="doc solutions-part" id="doc-solutions"><h1 class="doc-title" id="solutions">Solutions</h1>'
           '<p>Each solution gives the main line with best defence, the reasoning, engine-approved alternatives, and the '
           'tempting wrong answers with the reason they fail.</p>']
    for part in meta["parts"]:
        for n in part["chapters"]:
            if n in book.chapters:
                sol.append(r.solutions_section(n, f'Chapter {n} · {book.chapters[n]["title"]}'))
        if part.get("test"):
            sol.append(r.solutions_section(part["test"], f'Stage {part["num"]} Test'))
    sol.append("</section>")
    body.append("".join(sol))
    body.append(quick_reference(r))
    for slug in meta.get("back", []):
        if slug in book.docs:
            h = r.doc_html(slug)
            if slug == "glossary":
                h = h.replace('<section class="doc"', '<section class="doc gloss-doc"', 1)
                h = h.replace('</h1>', '</h1><div class="gloss">', 1)[: -len("</section>")] + "</div></section>"
            body.append(h)
    toc = toc_html(book, True)
    css = font_faces() + (ROOT / "assets" / "css" / "book-base.css").read_text() + PRINT_CSS + COVER_CSS
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>{esc(meta["title"])}</title>'
            f'<meta name="author" content="{esc(meta["publisher"])}"/>'
            f'<meta name="description" content="{esc(meta["subtitle"])}"/>'
            f'<meta name="keywords" content="chess, chess improvement, tactics, endgames, openings, training"/>'
            f'<style>{css}</style></head><body>{"".join(parts)}{toc}{"".join(body)}</body></html>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(BUILD / "dist" / "THE-ELO-BLUEPRINT-COMPLETE.pdf"))
    ap.add_argument("--html-only", action="store_true")
    args = ap.parse_args()
    book = Book()
    html_s = build_html(book)
    out_html = BUILD / "pdf" / "book.html"
    out_html.parent.mkdir(parents=True, exist_ok=True)
    out_html.write_text(html_s)
    print("html:", out_html, len(html_s) // 1024, "KB")
    if args.html_only:
        return
    import weasyprint
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    doc = weasyprint.HTML(string=html_s, base_url=str(ROOT)).render()
    print("pages:", len(doc.pages))
    doc.write_pdf(str(out), pdf_variant=None, optimize_images=True,
                  custom_metadata=True)
    print("pdf:", out, out.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
