#!/usr/bin/env python3
"""Assemble The Elo Blueprint Interactive (PWA) and the static website.

    python3 tools/build_app.py [--allow-missing]

Outputs
  build/app/   the installable, offline-capable trainer (deliverable folder
               THE-ELO-BLUEPRINT-INTERACTIVE/): web/ sources, vendor files,
               data/book.js, sw.js (precache manifest), manifest.webmanifest, README.txt
  build/site/  Cloudflare-Pages-ready static website: landing page, app/, downloads/,
               _headers, 404.html, favicon

The landing page links four downloads from build/dist/. A missing download is an
error unless --allow-missing is given (the link is then shown as "not yet available").
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import pathlib
import shutil
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
WEB = ROOT / "web"
APP = BUILD / "app"
SITE = BUILD / "site"
DIST = BUILD / "dist"
NM = ROOT / "node_modules"

DOWNLOADS = [
    ("THE-ELO-BLUEPRINT-COMPLETE.pdf", "The complete book (PDF)",
     "All 28 chapters, exercises, solutions and the 90-day plan, typeset for print and tablets."),
    ("THE-ELO-BLUEPRINT.epub", "The book (EPUB)",
     "Reflowable e-book for Apple Books, Kobo, Calibre and most e-readers."),
    ("THE-ELO-CHEAT-SHEETS.pdf", "The Elo Cheat Sheets (PDF)",
     "Every cheat code and the master decision checklist on a few printable pages."),
    ("THE-90-DAY-CHESS-ACCELERATOR.pdf", "The 90-Day Chess Accelerator (PDF)",
     "The day-by-day training plan with 15/30/60/90-minute options and benchmarks."),
]

VENDOR = [
    (NM / "chess.js" / "dist" / "esm" / "chess.js", "vendor/chess.js"),
    (NM / "chess.js" / "LICENSE", "vendor/chess.js-LICENSE.txt"),
    (NM / "stockfish" / "bin" / "stockfish-18-lite-single.js", "vendor/stockfish/stockfish-18-lite-single.js"),
    (NM / "stockfish" / "bin" / "stockfish-18-lite-single.wasm", "vendor/stockfish/stockfish-18-lite-single.wasm"),
    (NM / "stockfish" / "Copying.txt", "vendor/stockfish/Copying.txt"),
]

MIME_NOTE = {".wasm": "application/wasm", ".webmanifest": "application/manifest+json"}


def fail(msg: str):
    print("build_app: ERROR:", msg, file=sys.stderr)
    sys.exit(1)


def human_size(n: int) -> str:
    if n >= 1024 * 1024:
        return f"{n / (1024 * 1024):.1f} MB"
    return f"{max(1, round(n / 1024))} KB"


def copy(src: pathlib.Path, dst: pathlib.Path):
    if not src.exists():
        fail(f"missing input {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


# ----------------------------------------------------------------------------- app
def build_icons(out: pathlib.Path):
    cov = BUILD / "cover"
    icons = out / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    for s in (512, 192, 180, 32):
        copy(cov / f"icon-{s}.png", icons / f"icon-{s}.png")
    copy(cov / "icon.svg", icons / "icon.svg")
    try:
        from PIL import Image
        src = Image.open(cov / "icon-512.png").convert("RGB")
        for s in (512, 192):
            bg = Image.new("RGB", (s, s), (0x1E, 0x1C, 0x1A))
            inner = src.resize((int(s * 0.76), int(s * 0.76)), Image.LANCZOS)
            off = (s - inner.size[0]) // 2
            bg.paste(inner, (off, off))
            bg.save(icons / f"maskable-{s}.png", optimize=True)
    except Exception as e:  # pragma: no cover - PIL is part of the toolchain
        print("build_app: warning: maskable icon not generated:", e)
        shutil.copy2(icons / "icon-512.png", icons / "maskable-512.png")
        shutil.copy2(icons / "icon-192.png", icons / "maskable-192.png")


def build_app():
    data_p = BUILD / "web" / "data" / "book.json"
    if not data_p.exists():
        fail(f"{data_p} not found - run python3 tools/plan.py && python3 tools/build_webdata.py first")
    if not WEB.exists():
        fail("web/ source folder missing")
    if APP.exists():
        shutil.rmtree(APP)
    shutil.copytree(WEB, APP, ignore=shutil.ignore_patterns(".*", "*~", "__pycache__"))
    copy(ROOT / "assets" / "css" / "book-base.css", APP / "css" / "book-base.css")
    for f in sorted((ROOT / "assets" / "fonts").glob("*.woff2")):
        copy(f, APP / "fonts" / f.name)
    for f in sorted((ROOT / "assets" / "fonts").glob("LICENSE-*.txt")):
        copy(f, APP / "fonts" / f.name)
    for src, rel in VENDOR:
        copy(src, APP / rel)
    copy(ROOT / "assets" / "pieces" / "pieces.json", APP / "data" / "pieces.json")
    pieces = json.loads((ROOT / "assets" / "pieces" / "pieces.json").read_text())
    (APP / "data" / "pieces.js").write_text("window.ELO_PIECES=" + json.dumps(pieces, separators=(",", ":")) + ";\n")
    build_icons(APP)

    book = json.loads(data_p.read_text())
    book_js = json.dumps(book, ensure_ascii=False, separators=(",", ":"))
    # content hash over everything that ships (book data included)
    h = hashlib.sha256()
    for p in sorted(APP.rglob("*")):
        if p.is_file():
            h.update(str(p.relative_to(APP)).encode())
            h.update(p.read_bytes())
    h.update(book_js.encode())
    version = h.hexdigest()[:12]
    build_info = {"version": version, "book_version": book.get("meta", {}).get("version", ""),
                  "built": time.strftime("%Y-%m-%d")}
    (APP / "data" / "book.js").write_text(
        "window.ELO_BUILD=" + json.dumps(build_info) + ";\nwindow.ELO_BOOK=" + book_js + ";\n", encoding="utf-8")

    manifest = {
        "name": "The Elo Blueprint", "short_name": "Elo Blueprint",
        "description": "Interactive chess trainer for The Elo Blueprint: read, solve, play, analyse, fix, repeat.",
        "id": "./", "start_url": "./", "scope": "./", "display": "standalone", "orientation": "any",
        "theme_color": "#1E1C1A", "background_color": "#FBF8F1", "lang": "en",
        "categories": ["education", "games"],
        "icons": [
            {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "icons/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
            {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    (APP / "manifest.webmanifest").write_text(json.dumps(manifest, indent=1))
    (APP / "README.txt").write_text(README.format(version=version))

    files = sorted(str(p.relative_to(APP)).replace("\\", "/") for p in APP.rglob("*")
                   if p.is_file() and p.name not in ("sw.js", "sw.template.js", "README.txt") and p.suffix != ".map")
    precache = ["./"] + files
    sw_src = (WEB / "sw.template.js")
    if not sw_src.exists():
        fail("web/sw.template.js missing")
    sw = sw_src.read_text().replace("__VERSION__", version).replace("__PRECACHE__", json.dumps(precache, indent=0))
    (APP / "sw.js").write_text(sw)
    (APP / "sw.template.js").unlink()
    size = sum(p.stat().st_size for p in APP.rglob("*") if p.is_file())
    print(f"app: {APP} version {version}; {len(precache)} precached files, {human_size(size)}; "
          f"{len(book.get('chapters', []))} chapters, {len(book.get('exercises', {}))} exercises")
    return book, version


README = """THE ELO BLUEPRINT INTERACTIVE  (build {version})
===============================================

An offline-capable chess trainer that accompanies the book: read the chapters,
solve the exercises with spaced repetition, play against a built-in engine,
analyse your games and turn your mistakes into personal review exercises.

RUN IT LOCALLY
--------------
Browsers do not run apps like this from a double-clicked file, so serve the folder:

  1. Open a terminal in this folder (THE-ELO-BLUEPRINT-INTERACTIVE).
  2. Run:   python3 -m http.server 8000
     (Windows: py -m http.server 8000)
  3. Open   http://localhost:8000/   in Chrome, Edge, Safari or Firefox.

Any static web server works; the folder can also be hosted under a sub-path
(for example https://example.com/app/). Make sure .wasm is served as
application/wasm (python's http.server does this).

INSTALL AS AN APP (works offline afterwards)
--------------------------------------------
  * iPhone/iPad (Safari): Share -> Add to Home Screen.
  * Android (Chrome): menu -> Install app / Add to Home screen.
  * Desktop Chrome/Edge: the install icon at the right of the address bar.
After the first visit everything (book, exercises, engine) is cached on the
device and the app works without a connection.

YOUR DATA
---------
Progress is stored only in this browser (localStorage). Nothing is uploaded.
Use More -> Settings & data -> Export progress to back it up or move it to
another device, and Import to restore it.

LICENCES
--------
Stockfish (stockfish.js 18, lite single-threaded build) is free software under
the GNU GPL v3; see vendor/stockfish/Copying.txt. Source code:
https://github.com/nmrugg/stockfish.js and https://github.com/official-stockfish/Stockfish
chess.js is BSD-2-Clause licensed (vendor/chess.js-LICENSE.txt).
Fonts (Source Serif 4, Cormorant Garamond, Inter) are under the SIL Open Font
Licence 1.1 (fonts/LICENSE-*.txt). Piece artwork is derived from DejaVu Sans
glyphs (Bitstream Vera / DejaVu licence).
"""


# ----------------------------------------------------------------------------- site
def esc(s) -> str:
    return html.escape(str(s), quote=True)


def check_downloads(allow_missing: bool):
    missing = [n for n, _, _ in DOWNLOADS if not (DIST / n).exists()]
    if missing and not allow_missing:
        fail(f"download(s) missing from {DIST}: " + ", ".join(missing)
             + "  (build them first, or pass --allow-missing)")


def build_site(book: dict, version: str, allow_missing: bool):
    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir(parents=True)
    shutil.copytree(APP, SITE / "app")
    (SITE / "downloads").mkdir()
    dl_items = []
    missing = []
    for name, title, desc in DOWNLOADS:
        src = DIST / name
        if src.exists():
            shutil.copy2(src, SITE / "downloads" / name)
            size = human_size(src.stat().st_size)
            kind = name.rsplit(".", 1)[1].upper()
            dl_items.append(f'<li class="dl"><a class="dl-btn" href="downloads/{esc(name)}" download>'
                            f'<span class="dl-title">{esc(title)}</span><span class="dl-meta">{kind} · {size}</span>'
                            f'</a><p>{esc(desc)}</p></li>')
        else:
            missing.append(name)
            dl_items.append(f'<li class="dl missing"><span class="dl-btn" aria-disabled="true">'
                            f'<span class="dl-title">{esc(title)}</span><span class="dl-meta">not yet available</span>'
                            f'</span><p>{esc(desc)}</p></li>')
    if missing and not allow_missing:
        fail(f"download(s) missing from {DIST}: " + ", ".join(missing)
             + "  (build them first, or pass --allow-missing)")
    cover = BUILD / "cover" / "cover.jpg"
    if cover.exists():
        copy(cover, SITE / "cover.jpg")
    small = BUILD / "cover" / "cover-small.jpg"
    if small.exists():
        copy(small, SITE / "cover-small.jpg")
    for s in (32, 180, 192, 512):
        copy(BUILD / "cover" / f"icon-{s}.png", SITE / f"icon-{s}.png")
    copy(BUILD / "cover" / "icon.svg", SITE / "favicon.svg")
    try:
        from PIL import Image
        Image.open(BUILD / "cover" / "icon-32.png").save(SITE / "favicon.ico", sizes=[(32, 32)])
    except Exception:
        copy(BUILD / "cover" / "icon-32.png", SITE / "favicon.ico")
    for f in ("source-serif-4-latin-400-normal.woff2", "source-serif-4-latin-400-italic.woff2",
              "source-serif-4-latin-600-normal.woff2", "cormorant-garamond-latin-600-normal.woff2",
              "cormorant-garamond-latin-500-italic.woff2", "inter-latin-400-normal.woff2",
              "inter-latin-600-normal.woff2"):
        copy(ROOT / "assets" / "fonts" / f, SITE / "fonts" / f)

    meta = book.get("meta", {})
    chapters = {c["n"]: c for c in book.get("chapters", [])}
    parts_html = []
    for part in book.get("parts", []):
        lis = []
        for n in part["chapters"]:
            c = chapters.get(n)
            if c:
                lis.append(f'<li><span class="cn">{n}</span> <a href="app/#/read/ch/{n}">{esc(c["title"])}</a></li>')
            else:
                lis.append(f'<li class="soon"><span class="cn">{n}</span> Chapter {n}</li>')
        parts_html.append(
            f'<section class="part"><p class="part-k">{esc(part["name"])} · Stage {esc(part["stage"])}</p>'
            f'<h3>{esc(part["title"])}</h3><p class="part-intro">{esc(part.get("intro", "").strip())}</p>'
            f'<ol class="chs">{"".join(lis)}</ol></section>')
    page = LANDING.format(title=esc(meta.get("title", "The Elo Blueprint")),
                          subtitle=esc(meta.get("subtitle", "")), year=esc(meta.get("year", "")),
                          publisher=esc(meta.get("publisher", "")), edition=esc(meta.get("edition", "")),
                          parts="".join(parts_html), downloads="".join(dl_items),
                          n_ex=len(book.get("exercises", {})), version=esc(version), css=LANDING_CSS)
    (SITE / "index.html").write_text(page)
    (SITE / "404.html").write_text(NOT_FOUND.format(css=LANDING_CSS))
    (SITE / "_headers").write_text(HEADERS)
    (SITE / "robots.txt").write_text("User-agent: *\nAllow: /\n")
    size = sum(p.stat().st_size for p in SITE.rglob("*") if p.is_file())
    print(f"site: {SITE} ({human_size(size)}); downloads present: {len(DOWNLOADS) - len(missing)}/{len(DOWNLOADS)}"
          + (f"; MISSING (allowed): {', '.join(missing)}" if missing else ""))


HEADERS = """# Cloudflare Pages headers for The Elo Blueprint website
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/app/sw.js
  Cache-Control: no-cache
  Content-Type: text/javascript; charset=utf-8
  Service-Worker-Allowed: /app/

/app/index.html
  Cache-Control: no-cache

/app/
  Cache-Control: no-cache

/app/manifest.webmanifest
  Content-Type: application/manifest+json
  Cache-Control: no-cache

/app/data/*
  Cache-Control: no-cache

/app/vendor/stockfish/stockfish-18-lite-single.wasm
  Content-Type: application/wasm
  Cache-Control: public, max-age=604800

/app/vendor/*
  Cache-Control: public, max-age=604800

/app/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/downloads/*
  Cache-Control: public, max-age=3600
  X-Robots-Tag: noindex

/index.html
  Cache-Control: no-cache
"""

LANDING_CSS = """
@font-face{font-family:"Source Serif 4";src:url(fonts/source-serif-4-latin-400-normal.woff2) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Source Serif 4";src:url(fonts/source-serif-4-latin-400-italic.woff2) format("woff2");font-weight:400;font-style:italic;font-display:swap}
@font-face{font-family:"Source Serif 4";src:url(fonts/source-serif-4-latin-600-normal.woff2) format("woff2");font-weight:600;font-display:swap}
@font-face{font-family:"Cormorant Garamond";src:url(fonts/cormorant-garamond-latin-600-normal.woff2) format("woff2");font-weight:600;font-display:swap}
@font-face{font-family:"Cormorant Garamond";src:url(fonts/cormorant-garamond-latin-500-italic.woff2) format("woff2");font-weight:500;font-style:italic;font-display:swap}
@font-face{font-family:Inter;src:url(fonts/inter-latin-400-normal.woff2) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:Inter;src:url(fonts/inter-latin-600-normal.woff2) format("woff2");font-weight:600;font-display:swap}
:root{--ink:#2A2724;--soft:#57514A;--gold:#B08D2E;--gold-t:#7E6219;--paper:#FBF8F1;--rule:#E3D9C4;--tint:#F5EFE2;--dark:#1E1C1A}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.6 "Source Serif 4",Georgia,serif}
a{color:var(--gold-t)}
a:focus-visible,.btn:focus-visible,.dl-btn:focus-visible{outline:3px solid #2E5E8C;outline-offset:3px}
h1,h2,h3{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;line-height:1.1;margin:0 0 .4em}
.wrap{max-width:1080px;margin:0 auto;padding:0 22px}
header.hero{background:var(--dark);color:#FBF8F1;padding:56px 0 64px}
.hero .wrap{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:48px;align-items:center}
.kicker{font:600 13px/1.4 Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#E2C46A;margin:0 0 14px}
.hero h1{font-size:clamp(44px,7vw,76px);color:#FBF8F1}
.hero .sub{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:500;font-size:clamp(22px,3vw,30px);color:#E9E1D0;margin:0 0 22px}
.hero p.lead{color:#E3DCCD;max-width:36em}
.cover{width:100%;max-width:360px;justify-self:center;border-radius:4px;box-shadow:0 18px 50px rgba(0,0,0,.45)}
.ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
.btn{display:inline-block;font:600 16px/1 Inter,sans-serif;padding:15px 22px;border-radius:8px;text-decoration:none}
.btn.primary{background:#C9A227;color:#1E1C1A}
.btn.ghost{border:1.5px solid #C9A227;color:#F3E6BE}
main section.block{padding:56px 0;border-bottom:1px solid var(--rule)}
h2{font-size:clamp(32px,4.5vw,44px)}
.loop{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;list-style:none;padding:0;margin:24px 0 0}
.loop li{background:var(--tint);border-top:3px solid var(--gold);padding:14px 12px;border-radius:0 0 6px 6px;font-size:16px;line-height:1.4}
.loop b{display:block;font:700 13px/1.2 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-t);margin-bottom:6px}
.parts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px;margin-top:20px}
.part{background:#fff;border:1px solid var(--rule);border-radius:8px;padding:20px 22px}
.part-k{font:600 12px/1.3 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-t);margin:0 0 6px}
.part h3{font-size:28px}
.part-intro{font-size:16px;color:var(--soft)}
.chs{list-style:none;padding:0;margin:10px 0 0;font-size:16px}
.chs li{border-top:1px solid var(--rule);padding:6px 0}
.chs .cn{display:inline-block;min-width:1.8em;font:600 13px Inter,sans-serif;color:var(--gold-t)}
.chs .soon{color:#6B655C}
.dls{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;margin:20px 0 0}
.dl p{font-size:15px;color:var(--soft);margin:8px 2px 0}
.dl-btn{display:flex;flex-direction:column;gap:6px;background:var(--dark);color:#FBF8F1;padding:16px 18px;border-radius:8px;text-decoration:none}
.dl-title{font:600 16px/1.3 Inter,sans-serif}
.dl-meta{font:400 13px Inter,sans-serif;color:#E2C46A}
.dl.missing .dl-btn{background:#E9E3D6;color:#57514A}
.dl.missing .dl-meta{color:#6B655C}
.feat{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px 30px;margin-top:16px}
.feat h3{font-size:24px;margin-bottom:.2em}
.feat p{margin:0;font-size:16.5px;color:#3d3833}
footer{padding:34px 0 50px;font:14px/1.6 Inter,sans-serif;color:#57514A}
@media (max-width:760px){
 .hero .wrap{grid-template-columns:1fr;gap:28px}
 .cover{max-width:250px;order:-1}
 header.hero{padding:34px 0 44px}
 .loop{grid-template-columns:repeat(2,1fr)}
 body{font-size:17px}
}
"""

LANDING = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} — {subtitle}</title>
<meta name="description" content="{title}: a complete 400 to 1500 chess improvement system. Book, interactive trainer, cheat sheets and a 90-day plan.">
<meta name="theme-color" content="#1E1C1A">
<link rel="icon" href="favicon.ico" sizes="32x32">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-180.png">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{subtitle}">
<meta property="og:image" content="cover.jpg">
<style>{css}</style>
</head>
<body>
<header class="hero">
 <div class="wrap">
  <div>
   <p class="kicker">{edition} · {year}</p>
   <h1>{title}</h1>
   <p class="sub">{subtitle}</p>
   <p class="lead">A complete, honest training system for adult improvers: from your first rated games to a confident 1500.
   Twenty-eight chapters in five stages, {n_ex} interactive exercises with spaced repetition, a 90-day plan,
   a built-in engine to play and analyse with, and a mistake journal that turns every lost game into training.</p>
   <div class="ctas">
    <a class="btn primary" href="app/">Open the interactive trainer</a>
    <a class="btn ghost" href="app/#/read">Read online</a>
    <a class="btn ghost" href="#downloads">Downloads</a>
   </div>
  </div>
  <img class="cover" src="cover.jpg" alt="Cover of {title}" width="672" height="960">
 </div>
</header>
<main>
 <section class="block"><div class="wrap">
  <h2>One loop, repeated every day</h2>
  <p>Improvement at this level does not come from memorising openings. It comes from a simple loop done consistently.</p>
  <ol class="loop">
   <li><b>Learn</b>One short section of a chapter.</li>
   <li><b>Solve</b>Exercises on that skill, checked move by move.</li>
   <li><b>Play</b>A slow game, against people or the engine.</li>
   <li><b>Analyse</b>Yourself first, then with the engine.</li>
   <li><b>Fix</b>Every real mistake becomes a review exercise.</li>
   <li><b>Repeat</b>Spaced review brings misses back at 1, 3, 7, 21, 60 days.</li>
  </ol>
 </div></section>
 <section class="block"><div class="wrap">
  <h2>The interactive trainer</h2>
  <div class="feat">
   <div><h3>Works offline</h3><p>Install it on your phone or computer. The book, every exercise and the chess engine are stored on your device.</p></div>
   <div><h3>Honest progress</h3><p>Puzzle accuracy, engine accuracy of your games and chapter mastery are shown separately. No invented rating numbers.</p></div>
   <div><h3>Your data stays yours</h3><p>No account, no tracking, no uploads. Export your progress to a file whenever you like.</p></div>
  </div>
 </div></section>
 <section class="block"><div class="wrap">
  <h2>The curriculum</h2>
  <div class="parts">{parts}</div>
 </div></section>
 <section class="block" id="downloads"><div class="wrap">
  <h2>Downloads</h2>
  <ul class="dls">{downloads}</ul>
 </div></section>
</main>
<footer><div class="wrap">
 <p>{title} · {publisher} · {year}. Trainer build {version}.</p>
 <p>The trainer includes Stockfish (GPL v3, source at github.com/official-stockfish/Stockfish and github.com/nmrugg/stockfish.js),
 chess.js (BSD-2-Clause) and fonts under the SIL Open Font Licence.</p>
</div></footer>
</body>
</html>
"""

NOT_FOUND = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found — The Elo Blueprint</title><link rel="icon" href="/favicon.ico"><style>{css}</style></head>
<body><main class="wrap" style="padding:80px 22px;text-align:center">
<h1 style="font-size:56px">Page not found</h1>
<p>That page does not exist. Perhaps it moved.</p>
<p><a class="btn primary" style="background:#C9A227;color:#1E1C1A" href="/">Home</a>
&nbsp; <a href="/app/">Open the trainer</a></p></main></body></html>
"""


def main():
    global DIST
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--allow-missing", action="store_true", help="build the site even if downloads are missing")
    ap.add_argument("--dist", default=str(BUILD / "dist"), help="folder with the downloadable files (default build/dist)")
    a = ap.parse_args()
    DIST = pathlib.Path(a.dist)
    check_downloads(a.allow_missing)
    book, version = build_app()
    build_site(book, version, a.allow_missing)


if __name__ == "__main__":
    main()
