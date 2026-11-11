#!/usr/bin/env python3
"""Build THE-ELO-BLUEPRINT.epub (EPUB 3, reflowable, SVG diagrams, embedded WOFF fonts)."""
from __future__ import annotations

import argparse
import datetime
import html as htmlmod
import html.entities
import pathlib
import re
import shutil
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from book import BUILD, ROOT, Book, Diagrams, Renderer, esc  # noqa: E402
from build_pdf import part_page, quick_reference  # noqa: E402

FONTS = [("Source Serif 4", "source-serif-4-latin-400-normal", 400, "normal"),
         ("Source Serif 4", "source-serif-4-latin-400-italic", 400, "italic"),
         ("Source Serif 4", "source-serif-4-latin-600-normal", 600, "normal"),
         ("Cormorant Garamond", "cormorant-garamond-latin-600-normal", 600, "normal"),
         ("Inter", "inter-latin-600-normal", 600, "normal")]

EPUB_CSS = """
body { margin: 0 4%; line-height: 1.55; background: transparent; }
h1, h2, h3 { page-break-after: avoid; }
.chapter-title, .doc-title, .part-title, .ex-set-title { margin-top: 1.2em; }
.chapter-title { font-size: 2.3em; }
.doc-title { font-size: 2.1em; }
.part-page { text-align: center; padding-top: 2em; }
.part-title { font-size: 2.4em; }
figure.diagram { width: 100%; max-width: 24em; margin-left: auto; margin-right: auto; }
.board-img { width: 100%; height: auto; }
.exercise { margin: 1.2em auto 1.6em; max-width: 24em; page-break-inside: avoid; }
.exercise figure.diagram { max-width: 24em; }
.toc-list { list-style: none; padding-left: 0; }
.toc-list li { margin: 0.3em 0; }
.cover-page { text-align: center; margin: 0; padding: 0; }
.cover-page img { max-width: 100%; max-height: 100vh; }
.titlepage { text-align: center; padding-top: 3em; }
.titlepage .t { font-family: "Cormorant Garamond", Georgia, serif; font-size: 2.4em; font-weight: 600; margin: 0; }
.titlepage .s { font-style: italic; color: #57514A; }
.copyright { font-size: 0.85em; color: #57514A; }
.solution { page-break-inside: avoid; }
.gloss p { margin-bottom: 0.5em; }
"""

KEEP_ENTITIES = {"amp", "lt", "gt", "quot", "apos"}


def xhtmlify(s: str) -> str:
    def ent(m):
        name = m.group(1)
        if name in KEEP_ENTITIES:
            return m.group(0)
        cp = html.entities.name2codepoint.get(name)
        return chr(cp) if cp else m.group(0)
    s = re.sub(r"&([a-zA-Z][a-zA-Z0-9]*);", ent, s)
    s = re.sub(r"<(br|hr|img|col|input|meta|link)([^>]*?)(?<!/)>", r"<\1\2/>", s)
    return s


def page(title: str, body: str, cls: str = "") -> str:
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n'
            '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" '
            f'xml:lang="en"><head><meta charset="UTF-8"/><title>{esc(title)}</title>'
            f'<link rel="stylesheet" type="text/css" href="css/book.css"/></head>'
            f'<body{f" class=" + chr(34) + cls + chr(34) if cls else ""}>{xhtmlify(body)}</body></html>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(BUILD / "dist" / "THE-ELO-BLUEPRINT.epub"))
    args = ap.parse_args()
    book = Book()
    meta = book.meta
    work = BUILD / "epub"
    if work.exists():
        shutil.rmtree(work)
    oebps = work / "OEBPS"
    for d in ("images", "css", "fonts"):
        (oebps / d).mkdir(parents=True)
    dg = Diagrams("epub", img_dir=oebps / "images", img_prefix="images/")
    r = Renderer(book, "epub", dg)

    files = []  # (filename, title, body, in_toc_level)

    cover = BUILD / "cover" / "cover.jpg"
    if not cover.exists():
        raise SystemExit("run tools/render_cover.py first")
    shutil.copy(cover, oebps / "images" / "cover.jpg")
    files.append(("cover.xhtml", "Cover", '<section epub:type="cover" class="cover-page">'
                  f'<img src="images/cover.jpg" alt="{esc(meta["title"])} — {esc(meta["subtitle"])}"/></section>', None))
    files.append(("title.xhtml", meta["title"],
                  f'<section epub:type="titlepage" class="titlepage"><p class="t">{esc(meta["title"])}</p>'
                  f'<p class="s">{esc(meta["subtitle"])}</p><p>{esc(meta["publisher"])}</p></section>', None))
    n_ex = sum(1 for _ in book.all_exercises())
    files.append(("copyright.xhtml", "Copyright",
                  f'<section epub:type="copyright-page" class="copyright"><p><strong>{esc(meta["title"])}</strong>, '
                  f'{esc(meta["edition"])}, version {esc(meta["version"])}.</p><p>© {meta["year"]} {esc(meta["publisher"])}. '
                  f'All rights reserved.</p><p>The text was written with the assistance of an AI system (Claude, by '
                  f'Anthropic) under a detailed editorial specification. Every diagram, move sequence and all {n_ex} '
                  f'exercises were checked for legality with python-chess and analysed with the Stockfish 18 engine. '
                  f'Judgments beyond what an engine can verify are labelled as coaching judgment.</p>'
                  f'<p>Fonts: Source Serif 4, Cormorant Garamond, Inter (SIL Open Font License 1.1). Chess pieces drawn '
                  f'from DejaVu Sans glyph outlines.</p><p>Diagrams show the side to move with a small dot at the '
                  f'right edge of the board; exercise diagrams are drawn from the solver\'s side.</p></section>', None))
    toc_index = len(files)
    files.append(("toc.xhtml", "Contents", "", None))  # filled later (visible contents page)
    for slug in meta.get("front", []):
        if slug in book.docs:
            files.append((f"{slug}.xhtml", book.docs[slug]["title"], r.doc_html(slug), 1))
    for part in meta["parts"]:
        files.append((f"part-{part['num']}.xhtml", f'{part["name"]}: {part["title"]}', part_page(book, part), 1))
        for n in part["chapters"]:
            if n in book.chapters:
                files.append((f"ch-{n:02d}.xhtml", f'{n}. {book.chapters[n]["title"]}', r.chapter_html(n), 2))
        t = part.get("test")
        if t and book.exercise_set(t):
            files.append((f"test-{t}.xhtml", f'Stage {part["num"]} Test', r.exercises_html(
                t, heading=f'Stage {part["num"]} Test',
                intro="Fifteen mixed positions covering this part. 12/15 or better: move on. 9–11: review the "
                      "chapters behind your misses. Below 9: repeat this part's exercises first."), 2))
    sol = ['<section class="doc"><h1 class="doc-title" id="solutions">Solutions</h1>']
    for part in meta["parts"]:
        for n in part["chapters"]:
            if n in book.chapters:
                sol.append(r.solutions_section(n, f'Chapter {n} · {book.chapters[n]["title"]}'))
        if part.get("test"):
            sol.append(r.solutions_section(part["test"], f'Stage {part["num"]} Test'))
    sol.append("</section>")
    files.append(("solutions.xhtml", "Solutions", "".join(sol), 1))
    files.append(("quick-reference.xhtml", "Quick Reference", quick_reference(r), 1))
    for slug in meta.get("back", []):
        if slug in book.docs:
            h = r.doc_html(slug)
            if slug == "glossary":
                h = h.replace("</h1>", '</h1><div class="gloss">', 1)[: -len("</section>")] + "</div></section>"
            files.append((f"{slug}.xhtml", book.docs[slug]["title"], h, 1))

    # anchor map and visible TOC
    toc_items = []
    for fn, title, body, lvl in files:
        if lvl:
            toc_items.append(f'<li class="lvl{lvl}"><a href="{fn}">{esc(title)}</a></li>')
    files[toc_index] = ("toc.xhtml", "Contents", f'<section class="doc"><h1 class="doc-title">Contents</h1>'
                        f'<ul class="toc-list">{"".join(toc_items)}</ul></section>', None)
    where = {}
    for fn, _, body, _ in files:
        for m in re.finditer(r'\sid="([^"]+)"', body):
            where.setdefault(m.group(1), fn)

    def fix_links(fn, body):
        def rep(m):
            aid = m.group(1)
            target = where.get(aid)
            if target is None:
                print(f"  warning: dangling link #{aid} in {fn}")
                return 'href="#"'
            return f'href="{"" if target == fn else target}#{aid}"'
        return re.sub(r'href="#([^"]+)"', rep, body)

    manifest, spine = [], []
    for i, (fn, title, body, lvl) in enumerate(files):
        body = fix_links(fn, body)
        (oebps / fn).write_text(page(title, body))
        props = []
        if fn == "cover.xhtml":
            pass
        manifest.append(f'<item id="x{i}" href="{fn}" media-type="application/xhtml+xml"'
                        f'{" properties=" + chr(34) + " ".join(props) + chr(34) if props else ""}/>')
        spine.append(f'<itemref idref="x{i}"{" linear=" + chr(34) + "yes" + chr(34)}/>')

    # nav
    nav_li, cur_part = [], None
    for fn, title, body, lvl in files:
        if lvl == 1:
            if cur_part is not None:
                nav_li.append("</ol></li>" if cur_part else "</li>")
            nav_li.append(f'<li><a href="{fn}">{esc(title)}</a>')
            cur_part = False
        elif lvl == 2:
            if not cur_part:
                nav_li.append("<ol>")
                cur_part = True
            nav_li.append(f'<li><a href="{fn}">{esc(title)}</a></li>')
    nav_li.append("</ol></li>" if cur_part else "</li>")
    landmarks = ('<nav epub:type="landmarks" hidden=""><h2>Landmarks</h2><ol>'
                 '<li><a epub:type="cover" href="cover.xhtml">Cover</a></li>'
                 '<li><a epub:type="toc" href="toc.xhtml">Contents</a></li>'
                 f'<li><a epub:type="bodymatter" href="{files[toc_index + 1][0]}">Start reading</a></li></ol></nav>')
    nav = ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" '
           'xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en"><head><meta charset="UTF-8"/>'
           '<title>Contents</title><link rel="stylesheet" type="text/css" href="css/book.css"/></head><body>'
           f'<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>{"".join(nav_li)}</ol></nav>{landmarks}</body></html>')
    (oebps / "nav.xhtml").write_text(nav)
    manifest.append('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')

    # css + fonts
    faces = []
    for fam, stem, w, st in FONTS:
        shutil.copy(ROOT / "assets" / "fonts" / f"{stem}.woff", oebps / "fonts" / f"{stem}.woff")
        faces.append(f'@font-face {{ font-family: "{fam}"; font-weight: {w}; font-style: {st}; '
                     f'src: url("../fonts/{stem}.woff") format("woff"); }}')
        manifest.append(f'<item id="f-{stem}" href="fonts/{stem}.woff" media-type="font/woff"/>')
    css = "\n".join(faces) + "\n" + (ROOT / "assets" / "css" / "book-base.css").read_text() + EPUB_CSS
    css = re.sub(r":root\s*\{[^}]*\}", "", css)
    (oebps / "css" / "book.css").write_text(css)
    manifest.append('<item id="css" href="css/book.css" media-type="text/css"/>')
    manifest.append('<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>')
    for i, name in enumerate(dg.files):
        manifest.append(f'<item id="img{i}" href="images/{name}" media-type="image/svg+xml"/>')

    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    opf = f'''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">{meta["identifier"]}</dc:identifier>
<dc:title>{esc(meta["title"])}</dc:title>
<dc:language>en</dc:language>
<dc:creator>{esc(meta["publisher"])}</dc:creator>
<dc:publisher>{esc(meta["publisher"])}</dc:publisher>
<dc:description>{esc(meta["subtitle"])}</dc:description>
<dc:subject>Chess</dc:subject>
<dc:date>{datetime.date.today().isoformat()}</dc:date>
<meta property="dcterms:modified">{now}</meta>
<meta name="cover" content="cover-image"/>
<meta property="schema:accessMode">textual</meta>
<meta property="schema:accessMode">visual</meta>
<meta property="schema:accessModeSufficient">textual,visual</meta>
<meta property="schema:accessibilityFeature">alternativeText</meta>
<meta property="schema:accessibilityFeature">tableOfContents</meta>
<meta property="schema:accessibilityFeature">readingOrder</meta>
<meta property="schema:accessibilityHazard">none</meta>
<meta property="schema:accessibilitySummary">Chess diagrams include text descriptions listing every piece and the side to move; all moves are also given in text notation.</meta>
</metadata>
<manifest>
{chr(10).join(manifest)}
</manifest>
<spine>
{chr(10).join(spine)}
</spine>
</package>'''
    (oebps / "content.opf").write_text(opf)
    (work / "META-INF").mkdir()
    (work / "META-INF" / "container.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" '
        'xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile '
        'full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        for p in sorted(work.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(work).as_posix(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    print("epub:", out, out.stat().st_size // 1024, "KB;", len(files), "documents,", len(dg.files), "diagrams")


if __name__ == "__main__":
    main()
