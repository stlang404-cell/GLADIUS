# The Elo Blueprint

**The Complete 400 → 1500 Chess Improvement System** — a fully written, engine-verified chess
course built around one loop: **Learn → Solve → Play → Analyze → Fix → Repeat**.

## Download

| Product | File |
|---|---|
| The complete illustrated book (PDF) | [`release/THE-ELO-BLUEPRINT-COMPLETE.pdf`](release/THE-ELO-BLUEPRINT-COMPLETE.pdf) |
| EPUB 3 edition (Apple Books, Kobo, …) | [`release/THE-ELO-BLUEPRINT.epub`](release/THE-ELO-BLUEPRINT.epub) |
| Printable cheat sheets | [`release/THE-ELO-CHEAT-SHEETS.pdf`](release/THE-ELO-CHEAT-SHEETS.pdf) |
| 90-day training workbook | [`release/THE-90-DAY-CHESS-ACCELERATOR.pdf`](release/THE-90-DAY-CHESS-ACCELERATOR.pdf) |
| Everything in one archive (incl. interactive trainer, website, sources) | [`release/THE-ELO-BLUEPRINT-COMPLETE-RELEASE.zip`](release/THE-ELO-BLUEPRINT-COMPLETE-RELEASE.zip) |
| What was tested | [`release/VERIFICATION-REPORT.md`](release/VERIFICATION-REPORT.md) |

## What's inside

* 28 chapters in five stages (400–600, 600–800, 800–1000, 1000–1200, 1200–1500), a front-matter
  guide, glossary, references, quick-reference cheat codes and full solutions.
* 383 exercises with valid FENs, verified solutions, explanations, hints, difficulty, common wrong
  answers and learning objectives, plus five stage tests — every one checked with python-chess and
  Stockfish 18.
* A practical opening repertoire for White and Black with engine-checked lines.
* The Elo Blueprint Interactive: an offline-capable PWA with interactive exercises, spaced review,
  play against Stockfish, PGN import with self-analysis-first engine review, mistake journal,
  weakness tracking and a 90-day dashboard.

## Building from source

Sources live in [`source/`](source/). See [`source/BUILD.md`](source/BUILD.md); in short:

```bash
cd source && npm install && pip install -r requirements.txt && ./build_all.sh
```
