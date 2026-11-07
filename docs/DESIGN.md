# GLADIUS — Design & Architecture (v0.2 "Imperial Reforging")

Companion documents: [ART_BIBLE.md](ART_BIBLE.md) (visual language) · [ENGINE.md](ENGINE.md) (chess intelligence & benchmarks) · [WORLD.md](WORLD.md) (trophies, achievements, records, rivalries, invitations, objectives) · [PERSISTENCE.md](PERSISTENCE.md) (save format) · [STATUS.md](STATUS.md) (what is verified).

## Core loop
CHALLENGE → PLAY → RESULT → ANALYZE → IMPROVE → ADVANCE. The Arena tab always shows one primary objective (from `objectives()`), a skill-matched opponent with Elo stakes, invitations, your rival and tournament rounds that wait for you. The game ends with a short ceremony (victory/defeat, Elo delta, accuracy when analysis finishes, one concrete insight) and **REMATCH | ANALYZE | NEXT CHALLENGE**. Promotions, arena entries, trophies and season closes play brief skippable ceremonies.

## Five tabs (unchanged)
Arena · Empire · Academy · Spectate · Legacy. New depth lives in segments and sheets inside them (e.g. Legacy → Hall of Honors / Achievements / Timeline), never as new tabs.

## v0.2 decisions
| Area | Decision | Evidence |
|---|---|---|
| Pieces | Replaced lathe stacks with an SDF-sculpted "Legio" set baked offline (surface nets → meshoptimizer → meshopt codecs, 420 KB) | Close-up renders reviewed per piece; profile & contrast checks (ART_BIBLE) |
| Board | New renderer: marble/meander textures, PBR + studio environment, camera fitted by projecting board corners | Desktop/iPhone screenshots |
| Animation | `Timeline` module separate from rules; capture contact choreography, castling, e.p., promotion flare, mate/resign topple; presets 200/480/900 ms + custom; skip & reduce-motion | Deterministic timeline sampling: 19 moves, 0 regressions, exact landing |
| Arenas | 12 environments from an architecture kit + painted far backdrop; scenic vs focused framing (auto by screen width) | 12-arena render sheet |
| UI | Bright parchment/crimson/gold language, bundled OFL fonts, original icon set; desktop two-column game layout | Screenshots desktop + phone |
| Trophies | SDF-sculpted trophy models rendered to portraits by a single shared WebGL context | Render sheet |
| Persistence | Columnar split IndexedDB records with generation-tagged atomic commits; v1 saves migrate | PERSISTENCE.md measurements |
| World | Trophy registry, 139 achievements, hall of records, rivalry model, objectives, season reports — all from simulation events, idempotent | 50-season soak (WORLD.md) |
| Broadcasts | Background manager: leaving the view keeps the game running; paused during the player's own game; real result recorded | Code path + manual check |
| WebGL hygiene | Probe context released and cached (v0.1 leaked a context per render → board blanked on phones) | Phone E2E |

## Rank, Influence, fairness
Unchanged rules from v0.1 (see WORLD.md for audited details): grades follow Elo inside an arena; entering a new arena needs a Promotion Trial win or +150 dominance; 100-point demotion buffer; placement over the first 20 games moves ≤2 grades per game. Influence is earned from results and honours, decays 15 %/season, buys hosting and formal challenges, never affects chess. Opponent strength never scales with the player's results; rival preparation only changes opening choices.

## Module map
`chess/` rules, openings (433 lines), endgames, puzzles · `engine/` UCI client, scheduler, builds, personas · `rating/` Elo · `world/` population, sim, calendar, trophies, records · `tournament/` six formats · `analysis/` · `game/` career, legacy, ledger, achievements, influence · `persist/` split saves, backups · `render/` sdf, pieceSculpt, trophySculpt, board3d, animation, materials, boardTextures, arenaScene, arenaPortrait, trophyRenderer · `art/` 2D SVG art · `ui/` React.
