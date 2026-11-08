# GLADIUS — Design & Architecture (v0.3 "Imperial Ascension")

Companion documents: [ART_BIBLE.md](ART_BIBLE.md) (visual language) · [ENGINE.md](ENGINE.md) (chess intelligence & benchmarks) · [WORLD.md](WORLD.md) (trophies, achievements, records, rivalries, invitations, objectives) · [PERSISTENCE.md](PERSISTENCE.md) (save format) · [STATUS.md](STATUS.md) (what is verified).

## Core loop
CHALLENGE → PLAY → RESULT → ANALYZE → IMPROVE → ADVANCE. The Arena tab always shows one primary objective (from `objectives()`), a skill-matched opponent with Elo stakes, invitations, your rival and tournament rounds that wait for you. The game ends with a short ceremony (victory/defeat, Elo delta, accuracy when analysis finishes, one concrete insight) and **REMATCH | ANALYZE | NEXT CHALLENGE**. Promotions, arena entries, trophies and season closes play brief skippable ceremonies.

## Five tabs (unchanged)
Arena · Empire · Academy · Spectate · Legacy. New depth lives in segments and sheets inside them (e.g. Legacy → Hall of Honors / Achievements / Timeline), never as new tabs.

## v0.3 decisions
| Area | Decision | Evidence |
|---|---|---|
| Scale | 24 arenas × 3 grades = 72 ranks (24 titles in gladiatorial / legion / civic / imperial families); 25,000 competitors; 8 regional circuits | WORLD.md v0.3, migration test |
| Pieces | Hand-drawn layered-SVG piece sets baked to WebP (Legio primary, Senate Marble, Praetorian Guard) | ART_BIBLE, contact sheets |
| Mobile | Board sized by width *and* height; game controls inside the stage on phones; landscape two-column stage | STATUS mobile gate |
| Engine | Full-net engine as a chunked, SHA-verified pack; accurate labels; worker cap; analysis held during games | ENGINE.md v0.3 |
| Analysis | MultiPV-3 post-game analysis, documented accuracy & classes, skill profile, puzzles from real mistakes | ANALYSIS.md |
| Legacy | Hall of Fame and full career statistics computed from stored games (`game/careerStats.ts`) | tests/careerStats.test.ts |

## v0.2 decisions (final overrides applied)
| Area | Decision | Evidence |
|---|---|---|
| Time | **Untimed chess everywhere.** `CLOCKS_ENABLED = false`; every game (career, tournament, trial, challenge, casual) starts untimed and rated games use the career pool. Positions persist on every move; pause/leave/resume never forfeits. Engine thinking is bounded by its own node/time budget and cancellable via `AbortController`. | `tests/untimed.test.ts` (game left 30 days, reloaded, finished) |
| Board | **Fully 2D.** DOM sprite layer over a canvas-painted top-down board (`src/board2d/themes.ts`, 12 boards + Eternal Laurel); drag, tap and keyboard input | Desktop/iPhone screenshots |
| Pieces | Three original 2D sets (Ivory & Bronze, Imperial Gold & Crimson, Carrara & Nero Marble) baked offline from SDF sculpts to WebP sprites (`npm run bake:sprites`, 36 sprites ≈ 290 KB) | Close-up and phone-size reviews |
| Animation | Frame-driven `Timeline` (`src/board2d/animation.ts`): glide with lift/shadow, knight arc, capture approach→contact→tumble + gold burst, castling rook hop, promotion pop + flare, landing settle, mate/resign topple. Presets Fast 200 / Balanced 480 / **Majestic 900 (default)** / Custom; skip on input; reduced motion | Frame sampling in a production build: 0 teleports/regressions, arrival 730–870 ms |
| Arenas | 12 illustrated SVG scenes (`src/art/arenaBackdrop.ts`, 21–67 KB, no filters) + 12 crests (`arenaCrestSvg`), each with its signature board, trophy, tournament and champion | Contact sheets `docs/screenshots/arenas-*.png`, `arena-crests.png` |
| UI | White Imperial palette (#FFFFFF/#FAF8F3/#F0EDE6, gold #C59A42, crimson #A92D3A, charcoal #242424, blue #527EAA); board-centred stage layout; minimal text | Screenshots of every tab, desktop + iPhone 13 |
| Identity | Official GLADIUS logo (gladius + laurel, outlined Cinzel wordmark), crest, app/maskable/Apple icons, favicon, ICO (`npm run build:brand` → `public/brand/`) | Readable at 16–32 px |
| Portraits | Procedural SVG portraits v2: identity fixed by seed, ageing and arena-tier headgear/clothing | `docs/screenshots/portraits.png` |
| Trophies | SDF-sculpted trophies baked to WebP (60) | Hall of Honors screenshots |
| Persistence | Columnar split IndexedDB records with generation-tagged atomic commits; v1 saves migrate (old `3d`/timed settings are ignored) | PERSISTENCE.md |
| World | Trophy registry, 139 achievements, hall of records, rivalries, objectives, season reports | 50-season soak (WORLD.md) |
| Three.js | Removed from the runtime; kept only as a devDependency for the offline bake | `grep` shows no runtime import; bundle ≈ 678 KB (210 KB gz) |

## Rank, Influence, fairness
Unchanged rules from v0.1 (see WORLD.md for audited details): grades follow Elo inside an arena; entering a new arena needs a Promotion Trial win or +150 dominance; 100-point demotion buffer; placement over the first 20 games moves ≤2 grades per game. Influence is earned from results and honours, decays 15 %/season, buys hosting and formal challenges, never affects chess. Opponent strength never scales with the player's results; rival preparation only changes opening choices.

## Module map
`chess/` rules, openings (433 lines), endgames, puzzles · `engine/` UCI client, scheduler, builds, personas · `rating/` Elo · `world/` population, sim, calendar, trophies, records · `tournament/` six formats · `analysis/` · `game/` career, legacy, ledger, achievements, influence · `persist/` split saves, backups · `board2d/` animation timeline, board themes, piece sets · `render/` bake-only SDF sculpts (dev) · `art/` logo, arena backdrops & crests, portraits, emblems · `ui/` React.
