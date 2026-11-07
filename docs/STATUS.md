# Implementation status — GLADIUS v0.2 (final: 2D White Imperial, untimed)

Only items verified in this repository are marked done. Screenshots: `docs/screenshots/` (desktop 1440×900 `desktop-*`, iPhone 13 emulation `phone-*`, art sheets).

## How to run
`npm install && npm run dev` · production: `npm run build && npm run preview` · Windows: `npm run package:win` · iPhone: see DEPLOY.md · re-bake art (dev only, uses three.js + Playwright): `npm run bake:sprites` · brand kit: `npm run build:brand` · benchmarks: `npm run bench` · world soak: `npm run soak`.

## Final override acceptance
| Requirement | State | Evidence |
|---|---|---|
| No human time limit anywhere | ✅ | `CLOCKS_ENABLED = false`; every game kind starts untimed with no clock; clock UI never shown. `tests/untimed.test.ts`. |
| Pause / save / resume without forfeit | ✅ | Test leaves a game 30 days (fake clock), reloads the save, game is not over, finishes normally. Browser: offline reload → RESUME restores the position. |
| Engine bounded & cancellable | ✅ | Own node/time budget; `AbortController` cancels on leave. |
| Fully 2D, no 3D board in gameplay | ✅ | `src/board2d/` + DOM sprites; 3D renderer files deleted. |
| Three.js removed from runtime | ✅ | No runtime import (grep); `three` is a devDependency for the offline bake only; bundle 1.34 MB → ≈678 KB (210 KB gz). |
| Original 2D piece sets | ✅ | Ivory & Bronze (default), Imperial Gold & Crimson, Carrara & Nero Marble; unlocked by arena. |
| Boards | ✅ | 12 signature boards (incl. Ivory Marble, Imperial Gold, Legion Bronze, Colosseum Sandstone, Senate Mosaic, Praetorian Crimson, Caesar's Obsidian) + Eternal Laurel; "Arena signature" option. |
| Majestic 2D animation default | ✅ | Frame sampling (production build): glides 46–53 moving frames, 0 teleports/regressions, arrival 730–870 ms; captures keep the victim visible ≈67 frames; castling rook hop verified. Fast/Balanced/Custom + skip + reduced motion. |
| White Imperial UI, exactly 5 tabs | ✅ | Arena · Empire · Academy · Spectate · Legacy, every tab captured desktop + iPhone; no console errors. |
| Official logo & icons | ✅ | `public/brand/` SVG masters + PNG rasters, maskable/Apple icons, favicon, `gladius.ico`; used in header, splash, onboarding, manifest, Windows package. |
| 12 illustrated arenas + crests | ✅ | `arenas-1-6.png`, `arenas-7-12.png`, `arena-crests.png`; backdrops on the Arena stage, game stage, Spectate, Empire cards, arena reveal. |
| Empire systems preserved | ✅ | All 304 tests pass (rules/perft, engine, Elo, tournaments, persistence & migration, career, trophies/achievements, world sims). |
| Offline after build | ✅ | SW controlling → offline reload → resume: 32/32 piece sprites loaded, 0 failed requests. |

## Tests actually executed
- `npm test`: **304 passing, 18 files**. `tsc --noEmit` clean. `vite build` OK (precache 185 entries, 5.3 MB).
- Browser E2E (Playwright Chromium, desktop 1440×900 and iPhone 13 emulation): onboarding → Arena → game → Empire (arena cards, arena sheet, tournaments, champions, competitor) → Academy → Spectate (live broadcast) → Legacy (profile, Hall of Honors, achievements, timeline, collection, settings) → promotion and arena-reveal ceremonies. No console errors.
- Engine benchmarks (unchanged from v0.2, see ENGINE.md): full net vs lite net **+89 Elo [95% CI +59, +120], 160 games**; v0.2 top tier vs v0.1 top tier **+57 [+24, +91], 80 games**. No Elo-vs-humans claim.

## Known limitations (honest)
- 2D promotion and mate/resign topple animations are implemented but were not frame-sampled in the 2D renderer (the old 3D versions were).
- Art is code-generated (SVG illustrations, SDF sculpts baked to sprites): polished stylized vector, not painterly. Portrait nose types differ little at 48 px.
- On an iPhone-sized screen the PLAY button on the Arena home sits at the fold under the board and may need a short scroll.
- Not tested on a physical iPhone or Windows PC; frame rate and battery are unmeasured.
- Old saves keep their history; their stored timed/3D settings are ignored.
- The 99 MB big-net engine is git-ignored (GitHub file limit); fresh clones run the lite net until it is copied in (ENGINE.md §8).

## Next recommended milestone
Real-device pass (iPhone Safari PWA + Windows Edge), frame-sample 2D promotion/topple, phone Arena layout tuning so PLAY is above the fold, hand-painted arena variants.
