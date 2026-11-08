# Implementation status — GLADIUS v0.4 "Rise of the Legion"

Only items verified in this repository are marked done. Every result below was produced in **emulation** (headless Chromium desktop/iPhone 13 profiles, Node); **nothing was tested on physical hardware** (no iPhone, no Windows PC available). Screenshots: `docs/screenshots/`.

## How to run / where to play
- Public site (after the one-time Pages setup in [DEPLOY.md](DEPLOY.md)): **https://stlang404-cell.github.io/GLADIUS/**
- Local: `npm install && npm run dev` · production: `npm run build && npm run preview` · Windows: `npm run package:win` · tests: `npm test` · animation suite: `npm run test:anim` · world soak: `npx tsx scripts/soak-world.ts 40 20260 25000` · career + journey soak: `npm run soak`.

## v0.4 release gates
| Gate | State | Evidence |
|---|---|---|
| Zero-progress new career | ✅ | Browser: new career shows Tiro III, Arena I, 0–0–0, 0 Influence, 0 trophies, 0/148 achievements, no peak, provisional rating with "placement 0/10". Journey test asserts no honours/history/peak at start |
| Placement & early progression | ✅ | 10 placement games set rating to the performance rating and grade up to Decanus I (a strong newcomer was lifted 7+ grades in the test); afterwards ≤ 1 grade per game; career milestones guide the first steps |
| New Career / Continue Career | ✅ | Legacy → Saves → Career: snapshot + optional backup download first; onboarding offers "Continue <name>'s career" (browser-tested) |
| Zero-to-emperor journey | ✅ | `tests/journey.test.ts` (8k competitors, real rules, outcomes from the world's own game model): all 24 arenas entered in order, all 72 grades held, Eternal Throne won and defended, awards exactly once, achievements match metrics, profile stats equal stored records, save survives reload and v0.2 migration, no clock. 25k soak variant: 898 / 1006 games |
| Pieces | ✅ | Legio, Senate Marble, Praetorian Guard refined; king (closed crown + spire) vs queen (open coronet) checked at 32 px on 25 boards, grayscale and deuteranopia |
| Followable animations | ✅ | Majestic 950 ms for opponent moves (190 ms pre-highlight, glide, landing highlight); player taps 713 ms, drags 60–140 ms; any input skips instantly. `npm run test:anim`: 36/36 board-lab + 13/13 production scenarios (promotions Q/R/B/N, both castles, e.p., mate, resign, rapid moves, undo/unmount/reload mid-animation, speed change, touch) |
| Trustworthy analysis | ✅ | Deep verification of claims/sacrifices/errors; confidence levels with "Unclear"; Opera Game 15.Bxd7+ fixed (Blunder → Best, verified at depth 19); Analyse deeper on any move; confidence-aware PGN, puzzles, achievements ([ANALYSIS.md](ANALYSIS.md)) |
| Player profile | ✅ | Provisional status, Elo/peak, rank, W/D/L, score, move-class counts, accuracy trend, skill estimates with sample sizes, opening results, colour split, results vs rating bands, strongest wins, tournament results, reigns, upsets, all-time standing, searchable game history |
| Save performance | ✅ | See table below; integrity tests incl. crash during commit/compaction, damaged journal/base, v0.3 layout fixture |
| Rating stability | ✅ (3 seeds × 40 seasons) | See table below |
| Unique trophy art | ✅ | All 93 trophy definitions have their own baked image (21 new); old files checksum-identical |
| Art refinement | ✅ | 7 arenas reworked, legible crest numerals and rank pips, portrait refinements |
| No human clocks | ✅ | `CLOCKS_ENABLED = false`; journey asserts every game untimed even when a clock is requested |
| Automated tests | ✅ | **461 passing, 32 files**; `tsc --noEmit` clean |
| GitHub Pages build | ✅ | `.github/workflows/deploy.yml`; `/GLADIUS/` build passes `scripts/check-pages-dist.mjs` (83 MB, largest file 20 MB, 221 precached files) |
| Offline + engine verification (Pages layout, emulated) | ✅ | Service worker scoped to `/GLADIUS/`; game vs engine, reload → resume, offline reload with all pieces; engine pack (79 MB) installs with SHA-256 verification and runs **full-strength offline** ("Stockfish 19 full net") |
| Live public URL | ⏳ | Waiting for Pages to be enabled and the branch merged into `main` (DEPLOY.md) |

## Measured improvements
**Saves** (25k world, headless Chromium with real IndexedDB; shared 4-vCPU box — rough):
| | v0.3 | v0.4 |
|---|---|---|
| Post-game commit, longest main-thread task | 108–113 ms | no task ≥ 50 ms (longest slice ~12 ms) |
| Written per game | 4.7 MB | ~1.1 MB median |
| Season-end commit | longest task ~680 ms | no long task |
| Backup | 1.3 s on main thread | 0.8 s in a worker |
| Stored size | 37.6 MB | 21.2 MB |
| Cold load | 0.43–0.50 s (one long task) | 0.32–0.44 s, no long task |
| First opponent reply | ~300 ms task (opening-book index) | none (index built in idle slices at start-up) |

**Ratings** (25k, 8-season burn-in + 40 seasons, seeds 20260 / 4242 / 777):
| | v0.3 | v0.4 |
|---|---|---|
| Top-1 rating at end | 3150 / 3154 / 2970 | 3028 / 3045 / 2943 |
| Rating − skill gap, 2400+ band | +46 / +17 / +37 | −8 / −5 / −10 |
| Record consecutive defences | 34 / 39 / 14 | 21 / 16 / 21 (holders 120–150 stronger than the best contender) |
| Mean rating | 1150–1159 | 1146–1152 |
Causes fixed: uniform census shift piled points onto the elite (now per skill band), biased rating rounding, unbounded potential drift, weak challenger selection and a 0.95 draw cap that hid upsets; plus three rule bugs found by the journey test.

**Analysis**: Opera Game accuracy W 89.5 → 97.4 after verification (false blunder removed); verification costs ~1–2.5× analysis time on sharp games.

**Engine** (unchanged from v0.3; see ENGINE.md): full net vs Lite +137 [+101, +176] (160 games, 100 ms), +89 [+45, +136] (80 games, 400 ms).

## Tested in emulation vs on hardware
- **Emulation (done):** desktop 1440×900 and iPhone 13 / 320 / 375 / 390 / 430 / tablet / landscape viewports in headless Chromium; touch input via Playwright; offline mode; Cache Storage engine pack; Node unit/integration/soak tests.
- **Physical hardware (not done):** iPhone Safari PWA install, real frame rate, memory with the 99 MB full engine, battery; Windows launcher on a real PC.

## Known limitations
- Total commit work is still ~60–90 ms per game (spread over ~10 slices); compactions write 4.5–15 MB about every 10 games.
- Analysis verification is budgeted (12 moves per game); hidden deep ideas in stable "Best" moves are not re-searched; confidence thresholds are judgement calls.
- Dark Praetorian pieces on the darkest boards rely on their halo; undo has no reverse animation.
- Portrait byte budget leaves little headroom; qualifier tokens share one shape.
- Swiss events produced 26–50 repeat pairings over 40 seasons.
- GitHub Pages cannot send COOP/COEP headers: engines run single-threaded on the website (threads only in the Windows package).
