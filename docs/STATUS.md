# Implementation status — GLADIUS v0.3 "The Imperial Ascension"

Only items verified in this repository are marked done. Baseline audit: [AUDIT_v0.3.md](AUDIT_v0.3.md). Screenshots: `docs/screenshots/` (desktop 1440×900 `desktop-*`, iPhone 13 emulation `phone-*`, 320 px and landscape phone, art sheets).

## How to run
`npm install && npm run dev` · production: `npm run build && npm run preview` · Windows: `npm run package:win` (bundles the full-strength engine) · iPhone PWA: see [DEPLOY.md](DEPLOY.md) · benchmarks: `npm run bench` · world soak: `npx tsx scripts/soak-world.ts 40 20260 25000` · career soak: `npm run soak`.

## Release gates
| Gate | State | Evidence |
|---|---|---|
| Classical chess rules | ✅ | perft and rules suites (castling, e.p., promotion, repetition, 50/75-move, insufficient material, PGN/FEN) |
| All player games untimed; save & resume | ✅ | `tests/untimed.test.ts` (game left 30 days, reloaded, finished); offline reload → RESUME restores the position |
| Five tabs only | ✅ | Arena · Empire · Academy · Spectate · Legacy; new depth lives in segments (Empire → Regions, Legacy → Hall of Fame) |
| White UI consistent, phones usable | ✅ | Every tab captured desktop + iPhone 13; 320×568, 375, 390, 430, tablet and landscape measured: 0 px horizontal overflow, PLAY and Draw/Resign/Pause above the tab bar at every size, landscape puts the board left |
| Pieces readable | ✅ | New hand-drawn vector "Legio" primary set + Senate Marble + Praetorian Guard; contact sheets on all 24 boards at 40 px and 90 px, grayscale and deuteranopia checks |
| Animations converge to the authoritative position | ✅ | Frame sampling (Majestic): normal moves arrive 730–880 ms; promotion (Q, N), capture-promotion, en passant, O-O-O, check, mate topple; 20 moves 40 ms apart → 28/28 pieces correct, 0 duplicates; reset mid-animation → correct; unmount mid-animation → no errors |
| 24 arenas, 72 ranks | ✅ | 12 new illustrated arenas + crests, 72 rank emblems; ranks = 24 titles × grades III–I in four families; transparent `rankProgress` |
| Save migration (12/36 → 24/72) | ✅ | `tests/migrate.v03.test.ts` uses a real v0.2 save: old arena i → 2i, Eternal Throne → 23, ranks, titles, reigns, awards, records, player history; a season then runs and the save round-trips |
| 25,000 persistent competitors | ✅ | Pyramid at creation: 28 above 2600, 4 above 2800, 0 above 3000; 50,000 unique names tested |
| Careers evolve coherently | ✅ (40-season soak) | Mean rating 1143–1154, rating−skill gap −5…+1, population exactly 25,000, ~221 retirements/season, no promotion loops, no double title holders (bug found & fixed) |
| Tournaments, trophies exactly once | ✅ | Format fuzz tests, deterministic award ids, soak invariants |
| Achievements from verified events | ✅ | 148 achievements; analysis-based ones need complete analysis |
| Hall of Fame persists | ✅ | Legends archive keeps retired competitors; ten lists with stated criteria |
| Engine strength represented accurately | ✅ | `activeEngineInfo` labels only big-net builds "full"; test: phone without pack never claims full strength |
| Full-strength distribution | ✅ (code + Node/HTTP verification) | 4 gzip chunks ≤ 20 MiB + 259 KB delta in git; SHA-256 verified install into Cache Storage; bundled in the Windows package. **Not run in a real browser on a phone.** |
| Offline | ✅ | Production build, SW controlling, offline reload → resume, all 32 pieces loaded |
| Automated tests | ✅ | **402 passing, 26 files** (`npx vitest run`); `tsc --noEmit` clean |
| Production build | ✅ | `vite build`, precache 199 entries / 5.7 MB (engine pack deployed but not precached) |

## Engine benchmarks (see ENGINE.md for configs, nps, depth, memory)
v0.3 top configuration vs v0.2 as shipped (Lite), 40 balanced openings, both colours, fixed movetime, loaded 4-vCPU box:

| Platform | Budget | Games | W/D/L | Elo [95% CI] |
|---|---|---|---|---|
| PWA, full-single vs lite-single | 100 ms | 160 | +70 =80 −10 | +137 [+101, +176] |
| PWA, same | 400 ms | 80 | +25 =50 −5 | +89 [+45, +136] |
| Windows, full-mt T3 vs lite-mt T3 | 200 ms | 60 | +18 =41 −1 | +101 [+56, +150] |

Relative engine-vs-engine numbers only; no Elo-vs-humans claim. Playing styles now measurably change move choice (e.g. attacker +5.6 ± 2.3 pp checks at 1600) with no measurable strength cost; technician and counterattacker remain weak in the middlegame.

## Performance (measured)
| Metric | Result |
|---|---|
| New world (25k, 8 burn-in seasons), browser onboarding → ready | 4.6–5.4 s (desktop Chromium, loaded box) |
| `createWorld` in Node | 5.2–7.6 s wall |
| One simulated season | ~0.75 s |
| Save size | 29 MB JSON in 957 parts (5.5 MB gzipped backup) |
| Commit during a game / after a game / season end | 1 ms / ~130 ms / ~320 ms |
| Load | ~580 ms |
| Analysis (MultiPV 3, depth 13, 100 plies) | ~30 s headless |
| Full engine start | 0.75–1.04 s (lite 0.16–0.19 s) |
Frame rate and battery on real phones were **not measured** (no device available).

## Known limitations (honest)
- No physical iPhone or Windows PC was available: Safari's handling of the 99 MB wasm, real frame rate, memory and battery are unverified.
- After each game ~4 MB of competitor chunks are rewritten (~130 ms on the main thread); a per-row journal or worker would cut it.
- Elite ratings drift slowly upward (max 3002 → ~3150 over 40 seasons; 0–2 players above 3000); one 34-defence dynasty appeared in the soak.
- Lite Stockfish at analysis depth 11–14 can mislabel deep sacrifices (reliability tag shown); strict puzzle margins yield few puzzles.
- Senate Marble queen/king are the closest pair at 32 px; the check highlight relies on its pulse for red-green colour-blind players.
- Trophy art: the 21 new non-signature trophy kinds reuse existing sprites.
- Regional balance for a human career has not been play-tested over many seasons.

## Next recommended milestone
Real-device pass (iPhone PWA + Windows) for frame rate, memory and the engine pack; move post-game commits to a worker; dedicated art for the 21 new trophy kinds; long human play-test of regional circuits.
