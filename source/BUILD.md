# Building The Elo Blueprint

Everything — book PDF, EPUB, cheat sheets, 90-day workbook, interactive trainer, website
and release ZIP — is generated from the sources in this folder.

## Layout

| Path | Contents |
|---|---|
| `manuscript/book.yaml` | Book metadata and part/chapter order |
| `manuscript/front/`, `manuscript/chapters/`, `manuscript/back/` | Editable manuscript (Markdown + chess blocks) |
| `exercises/*.json` | Exercise database (one file per chapter, `T1`–`T5` stage tests) |
| `cheatsheets/` | Cheat-sheet and master-checklist sources |
| `plan/accelerator-intro.md` | 90-Day Accelerator instructions (`tools/plan.py` generates the schedule) |
| `assets/` | Fonts (OFL), CSS, piece artwork (`assets/pieces/pieces.json` = diagram source data) |
| `web/` | Interactive trainer source (vanilla JS PWA) |
| `tools/` | Validation, build and test scripts |
| `CONTENT-GUIDE.md` | Authoring specification for chapters and exercises |

Diagram source data are the `board`/`line` blocks inside the manuscript (FEN + arrows/highlights)
and the FENs in `exercises/*.json`; `tools/diagram.py` renders them to SVG.

## Requirements

* Python 3.11+ with `pip install -r requirements.txt`
  (python-chess 1.10, WeasyPrint 70, Markdown, PyYAML, fontTools, brotli, Pillow, pypdf)
* Node.js 20+ and `npm install` (chess.js, Stockfish 18 WASM, Fontsource fonts)
* Playwright with Chromium (for cover rasterising and app tests)
* Java 11+ and EPUBCheck 5.1.0 (`org.w3c:epubcheck:5.1.0` from Maven Central) — set `EPUBCHECK_CP`
  to its classpath, e.g. `EPUBCHECK_CP="/path/to/epubcheck/lib/*"`

## Build

```bash
npm install
pip install -r requirements.txt
./build_all.sh            # DEPTH=20 ./build_all.sh for a deeper engine pass
```

Outputs: `build/dist/` (PDFs, EPUB), `build/app/` (trainer), `build/site/` (website),
`build/release/THE-ELO-BLUEPRINT-COMPLETE-RELEASE.zip`, `build/VERIFICATION-REPORT.md`, `build/logs/`.

Individual steps:

```bash
python3 tools/validate.py --depth 18                 # all chess content
python3 tools/probe.py "FEN" [SAN moves] --depth 18  # inspect a position while writing
python3 tools/build_pdf.py | build_epub.py | build_cheatsheets.py | build_workbook.py
python3 tools/build_webdata.py && python3 tools/build_app.py && node tools/test_app.js
```

## Editing content

1. Edit Markdown in `manuscript/` or JSON in `exercises/` following `CONTENT-GUIDE.md`.
2. Run `python3 tools/validate.py <changed files>` until it reports 0 errors.
3. Rebuild with `./build_all.sh`.

## Deploying the website (Cloudflare Pages)

`build/site/` is a plain static site (no server code, no accounts, no paid APIs).
Cloudflare dashboard → Workers & Pages → Create → Pages → *Upload assets* → upload the
contents of `build/site/` (or `THE-ELO-BLUEPRINT-WEBSITE.zip` from the release).
Or with Wrangler: `npx wrangler pages deploy build/site --project-name elo-blueprint`.
Any static host works (Netlify, GitHub Pages, S3); the `_headers` file is Cloudflare/Netlify syntax.
