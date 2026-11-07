# GLADIUS v0.3 "The Golden Age" — baseline audit & plan

Audited on the v0.2 final commit (`f651004`) before any v0.3 change. Every item below was checked against the code or a measurement, not taken from earlier reports.

## Verified baseline
| Check | Result |
|---|---|
| `npx vitest run` | 304 passing, 18 files |
| `npx tsc --noEmit -p .` | clean |
| `npx vite build` | OK, precache 185 entries / 5.3 MB |
| Runtime 3D | none (three.js is a devDependency used only to bake sprites) |
| Human clocks | `CLOCKS_ENABLED = false`; every kind starts untimed (`tests/untimed.test.ts`) |
| Tabs | exactly five: Arena · Empire · Academy · Spectate · Legacy |
| Offline | SW-controlled reload offline → resume, 0 failed requests |

## Reported issues, verified
| Issue | Verdict | Evidence |
|---|---|---|
| Mobile controls fall below the screen | **Confirmed** | iPhone 13 (390×844): the Arena home PLAY bar sits at the fold under the board, partly behind the tab bar. |
| Some art still looks procedural | **Partly** | Arenas and portraits were redrawn late in v0.2; pieces are SDF bakes whose silhouettes are fine but read as renders, not illustration. |
| Pieces/portraits need refinement | **Confirmed for pieces** | Primary set lacks distinctive Roman detail at 40 px. |
| Full-strength engine not distributed | **Confirmed** | `public/engine/.gitignore` excludes the 99 MB `stockfish-19-single.wasm`; `stockfish-19.wasm` (full, threaded) is absent. A fresh clone runs Lite only. |
| Competitor identity / career depth | **Confirmed** | 5,000 competitors; no region, career stage or ambition fields. |
| Tournament prestige & history presentation | **Partly** | Trophies/records exist (v0.2); no regional circuits, no Hall of Fame view. |

## Scale measurements (Node, before changes)
- `generatePopulation`: 5,000 → 63 ms; 25,000 → 269 ms; JSON 2.7 MB → 13.5 MB.
- `createWorld` (5,000, 8 burn-in seasons): 5.0 s; world JSON 5.5 MB.
- Linear scaling would put a 25k world at ~25 s and ~27 MB JSON — needs indexing, compact storage and incremental saves.

## Save-migration risks
- Competitor ids are serials (`c000001`…); growing the population must append serials, never renumber.
- Award ids are deterministic; new trophy defs must be additive.
- Settings: old `pieceStyle` ids (`classical`/`imperial`/`marble`) must map to the new sets.
- Columnar split save layout must accept the new competitor fields as optional columns.

## Plan (executed in parallel workstreams)
1. **Phase A — visual & mobile:** primary piece collection with a quality gate, then alternate sets; board marker readability; mobile layouts at 320/375/390/430/tablet/landscape with primary actions above the fold.
2. **Phase B — engine:** chunked full-net distribution + optional offline engine pack, accurate engine labelling, scheduler limits, style influence measured, benchmarks.
3. **Phase C — living empire:** 25,000 competitors, regions, career stages/ambitions, generations, rivalries, indexed simulation, compact saves, migration.
4. **Phase D — competition & honours:** regional circuits and new event kinds, region-aware trophies, Hall of Fame, Chronicle filters.
5. **Phase E — Academy & release:** defensible classifications, puzzles from real mistakes, weakness tracking, improvement charts, integrity separation; performance report; docs.

## Outcome
All five plan items were implemented; the gates and measurements are in [STATUS.md](STATUS.md). The 24-arena / 72-rank expansion was added mid-release and is included (old arena *i* → 2*i*, Eternal Throne → 23).
