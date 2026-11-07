# GLADIUS — Design & Architecture

## Core loop
CHALLENGE → PLAY → RESULT → ANALYZE → IMPROVE → ADVANCE. The Arena tab always shows: your objective, a skill-matched opponent with stakes (+win/draw/−loss Elo), invitations, your rival. Post-game is one screen: result, Elo change, accuracy (filled in when background analysis finishes), rank/trial/tournament news, and REMATCH | ANALYZE | CONTINUE.

## Decisions (research → choice)
| Topic | Decision | Why |
|---|---|---|
| Rules | chess.js 1.4 + own FIDE layer (`src/chess/rules.ts`) | chess.js auto-ends on threefold/50-move; FIDE makes those *claims*, and fivefold/75-move automatic. Flag-fall vs lone king = draw. Perft-verified. |
| Engine | Stockfish 19 **lite, single-threaded** WASM (1.8 MB) in Web Workers | Runs on any static host and iOS Safari without COOP/COEP headers; full-net build is 99 MB. GPL-3.0 → project is GPL-3.0-or-later. |
| Weak play | Own sampler: MultiPV candidates, softmax over win%-loss with an Elo-dependent temperature, "oversight" picks (any legal move below 1600), style bias, opening book | Depth-limiting alone plays inhumanly. We **benchmarked** Stockfish `UCI_LimitStrength` at sub-second budgets: its error rate was not monotone across our ladder, so it is not used. ≥3000 = unrestricted Stockfish. |
| Ratings | Elo, K=40 provisional (<20 games) / 20 / 10 (≥2400), floor 100, four pools (blitz/rapid/classical/untimed) | FIDE-style, transparent. Career rank follows the chosen career pool. |
| Population | 5,000 competitors, hidden *skill* (what the engine plays at) + public *rating* (moves only with results) | Ratings must be earned; skill evolves by an age curve with noise, breakthroughs and decline. |
| Simulation tiers | Off-screen AI games: statistical W/D/L from skills (draw rate rises with strength). Player games, spectated broadcasts: real engine games with full move lists. | Never invents a PGN. Off-screen results are flagged and stored as results only. |
| Anti-drift | Seasonal "Imperial Census" re-centres mean(rating − skill) of established AI to 0 | Closed Elo pools deflate as improving juniors drain points. AI ratings are anchored to engine-calibrated strength, so the human's Elo stays meaningful. Verified over 20 in-world years. |
| Rank movement | Within an arena: follows Elo (50-pt demotion buffer). Into the next arena: win a Promotion Trial, or be ≥150 above its floor (no artificial blocking). Demotion: 100 below arena floor. Placement: first 20 games move ≤2 grades/game. Cosmetic unlocks are permanent. | Skill-based but with stakes every few games. |
| Influence | Earn: wins (2+arena, +3 upset), rival wins +5, tournament prizes. Decay ×0.85 per season. Spend: host an invitational, formal rival challenges. Prestige = lifetime, never decays. Never affects chess. | One currency, transparent. |
| Calendar | Every finished game = 1 day. Season = 28 days. Each arena, each season: League (double RR), Open (Swiss), Cup (single-elim) / Gauntlet (double-elim), Invitational (RR), Championship match. Your rounds wait for you (postponement); "Rest" advances time. | No real-world waiting; living world. |
| Elimination draws | Tiebreak game with colours reversed, then Armageddon (draw = Black advances). Match series: tied → rapid pair → Armageddon. | Explicit, documented. |
| Analysis | Fixed-depth MultiPV-2 per position; Lichess win% model; Lichess accuracy formula; documented thresholds (`src/analysis/classify.ts`) | Reproducible; Brilliant requires a real sacrifice that keeps ≥50% and wasn't made from a won (≥92%) position. |
| Rendering | three.js, procedural lathe/extruded pieces, shadow-mapped, render-on-demand; DOM/SVG 2D board | Interactive, original, tiny to ship, battery-friendly. |
| Art | Procedural SVG: 12 arena backdrops, 36 rank emblems, 12 trophies, seeded portraits, 12 piece sets | Original, offline, deterministic. Honest: flat-vector quality, not illustrated production art. |
| Persistence | IndexedDB, checksummed envelope, rolling backups, versioned migrations, JSON export/import, active game saved every move | Survives crashes/reloads; per-device by design. |
| Platforms | Static PWA (Workbox precache incl. engine). Windows: PowerShell `HttpListener` one-click launcher (no install). iPhone: HTTPS static host + Add to Home Screen. | No accounts, no servers. |

## Rank ladder audit
Changes to the proposed 36 names: removed *Legionarius* (synonym of Miles, read as a regression after Veteranus); moved *Decanus* below *Optio*; grouped *Praefectus* with the Forum and *Legatus* with the Praetorian tier; added *Pater Patriae* (a real imperial honorific). Full list and Elo floors: `src/world/arenas.ts`.

## Modules (no monolith)
`chess/` rules, openings (433 lines), endgames, puzzles · `engine/` UCI client, personas · `rating/` Elo · `world/` population, sim, calendar, names, arenas · `tournament/` six formats · `analysis/` classification, analyzer, coach · `game/` career, influence, achievements, state types · `persist/` IndexedDB saves · `render/` three.js board · `art/` procedural SVG · `ui/` React (five tabs).

## Strength ladder benchmark (tests/bench/calibration.test.ts)
Average win% lost per move vs a depth-12 reference, 12 middlegame/endgame positions × 4 samples. Targets approximate Lichess accuracy-by-rating.

| Persona Elo | Target | Measured |
|---|---|---|
| 500 | 13 | 11.4 |
| 900 | 9 | 8.1 |
| 1300 | 6.5 | 5.4 |
| 1700 | 4.5 | 5.2 |
| 2100 | 3.2 | 3.3 |
| 2600 | 2.0 | 1.6 |

Persona Elo is an *estimate* of human-equivalent strength; no claim is made about results against any specific human. The ≥3000 configuration is unrestricted Stockfish 19 lite at 1.5 s/move — far beyond human level in engine-rating terms, but not benchmarked against humans here.
