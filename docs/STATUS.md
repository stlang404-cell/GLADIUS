# Implementation status

_Last updated with the commit that added this file. Only verified items are marked done._

## Playable entry point
`npm install && npm run dev` (or `npm run build && npm run preview`). Windows: `npm run package:win`. iPhone: see DEPLOY.md.

## Milestones
| Milestone | State |
|---|---|
| **M0 Foundation** | ✅ Done. Legal chess, local engine, persistent games, five-tab shell, Windows launcher, PWA. Gate verified in browser (Playwright): play → finish → save → reload → analyse. |
| **M1 Beautiful chess** | ✅ Functional. 2.5D three.js board with sculpted procedural pieces, shadows, animated moves/captures/castling/promotion/check pulse/mate topple; three animation speeds, skippable (double-tap); camera tilt + view rotation; classical 2D board; 12 board/piece collections; iPhone portrait verified. Art is procedural vector — see limitations. |
| **M2 Chess intelligence** | ✅ Done. Calibrated strength ladder (benchmarked), styles, opening book, Elo with four pools, matchmaking with stakes preview, full analysis (eval bar/graph, 11 classes, accuracy, best lines, critical moments, opening/endgame labels, PGN/FEN export), permanent library. |
| **M3 Living empire** | ✅ Done. 5,000 persistent competitors with careers, ageing, retirement/replacement, rivalries, preparation against your openings, 12 arenas × 3 grades, trials, Influence. 20-year stability test passes. |
| **M4 Tournament civilization** | ✅ Done. Six formats with tie-breaks, a seasonal calendar across all arenas, invitations/wildcards/championship challenges, hosting, title lineages, live engine broadcasts that decide real tournament games, Imperial Chronicle, Hall of Champions. |
| **M5 Eternal dynasty** | 🟡 Partial. Seasons, title defences, generations, coach, achievements (20), collections, career records exist. Missing: dedicated Hall of *your* legacy timeline, season-end ceremonies, personal-best challenges as explicit objectives. |
| **M6 Release polish** | 🟡 Partial. Audio is procedural (move/capture/check/fanfares + per-arena ambient drone). Not done: commissioned art, accessibility audit (keyboard play on the 3D board), real-device iPhone test, Windows test on real hardware. |

## Tests actually executed (`npm test`, 226 passing)
- **Chess (22):** perft (start d3, Kiwipete d3, positions 3/4/5), castling incl. through-check, en passant, under-promotion, mate, stalemate, insufficient material, threefold claim, fivefold auto, 50-move claim, 75-move auto, mate-on-75th precedence, flag vs lone king, resignation, PGN/FEN round-trips.
- **Engine (7):** UCI parsing, win% model, Stockfish legal best move, mate-in-one, MultiPV, search cancellation, game-over positions.
- **Strength ladder (1):** monotone error ladder (table in DESIGN.md).
- **Elo (5)**, **Tournaments (154)** incl. fuzzing all six formats at 2–32 entrants, **Openings/endgames/puzzles (13)**, **Art (9)**.
- **Persistence (5):** checksum corruption detection, recovery from backup, schema migration, interrupted game restore, export/import.
- **Career (7):** rank rules, rated result effects on both careers, trial unlock/win/arena unlock, player completing a full Swiss Open (rounds waiting on the player).
- **Simulation (3):** 5,000 unique IDs/names, 20-year rating stability (mean 1154→1158, rating−skill bias ≤5, pyramid preserved, 7.6 ms/day), 8+8-season world with all formats completing, one open reign per exclusive title, records consistent.
- **Manual/E2E (Playwright, Chromium, SwiftShader WebGL):** desktop and iPhone 13 emulation; onboarding + world creation (~3 s); 3D tap input; 2D play vs engine; resign; post-game with analysis; all tabs; live spectate; reload persistence; **offline reload via service worker**. No console errors.

## Known limitations (honest)
- Art is original procedural SVG/geometry: consistent and colourful but not illustrator-grade. Portraits share one face template. Some dark piece sets are low-contrast on dark squares.
- Persona Elo below ~1300 and above ~2600 is approximately calibrated (single benchmark, 48 samples per level); not validated against humans.
- Clocks: the opponent's thinking time (engine search + "natural" delay) runs on its clock, but the persona does not yet budget its time against the clock, it drops its human-like delay below one minute but searches are not otherwise scaled to the clock.
- AI ratings are discipline-neutral (one rating shown in every pool).
- Off-screen AI games are statistical (by design); only broadcasts and your games have move lists.
- World save ≈ 6 MB after a few seasons; autosave of the whole document after each game. Fine on desktop; on low-end phones a split store would be better.
- Leaving a broadcast early discards it (the game is then simulated).
- Not tested on a physical iPhone or Windows PC in this environment.

## Next recommended milestone
M5 completion: a player legacy timeline, season-end ceremony, explicit personal-best objectives; then M6: art pass on portraits/backdrops, keyboard input for accessibility, physical-device testing, save splitting.
