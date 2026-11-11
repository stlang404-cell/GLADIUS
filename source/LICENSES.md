# Dependencies and licences

| Component | Used for | Licence |
|---|---|---|
| Manuscript, exercises, plan, cheat sheets, code in `tools/` and `web/` | The book and trainer | © 2026 Elo Blueprint Editions. All rights reserved (personal-use printing permitted). |
| Stockfish 18 (via `stockfish` npm package 18.0.8, Stockfish.js by Nathan Rugg / Chess.com) | Validation (Node) and in-browser engine (trainer) | GPL-3.0. Source: https://github.com/official-stockfish/Stockfish and https://github.com/nmrugg/stockfish.js. The unmodified engine files are distributed as separate files in the trainer's `vendor/stockfish/`; the GPL licence text is included there. |
| chess.js 1.4.0 | Move legality and PGN in the trainer | BSD-2-Clause |
| python-chess 1.10.0 | Validation and diagram generation (build time only) | GPL-3.0 (not distributed in the products) |
| WeasyPrint 70 | PDF rendering (build time only) | BSD-3-Clause |
| Source Serif 4 | Body text | SIL Open Font License 1.1 (`assets/fonts/LICENSE-source-serif-4.txt`) |
| Cormorant Garamond | Headings | SIL Open Font License 1.1 (`assets/fonts/LICENSE-cormorant-garamond.txt`) |
| Inter | Labels and UI | SIL Open Font License 1.1 (`assets/fonts/LICENSE-inter.txt`) |
| DejaVu Sans glyph outlines | Chess piece artwork (`tools/pieces.py`) | Bitstream Vera / DejaVu licence (free to modify and redistribute) |
| EPUBCheck 5.1.0 | EPUB validation (build time only) | BSD-3-Clause |
| Playwright / Chromium | Cover rasterising and UI tests (build time only) | Apache-2.0 / BSD |

Fonts embedded in the PDFs are subsets, as permitted by the OFL. The EPUB embeds the original
WOFF files unmodified.
