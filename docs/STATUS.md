# Implementation status — GLADIUS v0.2 "Imperial Reforging"

Only items verified in this repository are marked done. Screenshots: `docs/screenshots/`.

## How to run
`npm install && npm run dev` · production: `npm run build && npm run preview` · Windows: `npm run package:win` · iPhone: see DEPLOY.md · re-bake art: `npm run bake:pieces`, `npm run bake:trophies` · benchmarks: `npm run bench` · long world soak: `npm run soak`.

## Phase gates
| Phase | State | Evidence |
|---|---|---|
| **A — Visual vertical slice** | ✅ | New SDF-sculpted "Legio" set (close-ups, both colours on both square colours, iPhone size); new board renderer; new UI language; new header, opponent card, post-game ceremony. Screenshots desktop + iPhone 13. |
| **A — Animation** | ✅ | Timeline system with Fast/Balanced/Majestic/Custom; capture contact, castling, e.p., promotion flare, mate/resign topple, landing settle, skip, reduce motion. Deterministic sampling of 19 moves (captures, both castles, e.p., promotion): 0 regressions, exact landing, max 0.6 square/16 ms. |
| **B — Chess intelligence** | ✅ (desktop evidence) | Full-net vs lite-net at equal time: **+89 Elo [95% CI +59, +120], 160 games**; v0.2 top tier vs v0.1 top tier: **+57 [+24, +91], 80 games**; 62-position verified tactical suite; monotone persona ladder; capability tiers, scheduler (play > spectate > analysis), crash/hang restart, clock-aware allocation, eight styles, rival opening preparation. Threads match, persona-ladder matches and endgame suite implemented but not run. No Elo-vs-humans claim. See ENGINE.md. |
| **C — Living empire** | ✅ | Trophy registry (60 defs), 139 achievements with eligibility & analysis gating, hall of records, rivalry model, objectives, season reports, prestige-driven invitations; 50-season soak with invariants (WORLD.md). |
| **D — Twelve arenas** | ✅ (stylized, see limits) | 12 distinct 3D environments + scenic framing; arena portraits used across the UI; arena reveal ceremony. |
| **E — Career & polish** | ✅ mostly | Legacy timeline, season ceremony, objectives, Hall of Honors with 2.5D trophies, achievements UI, split persistence with migration, background broadcasts, keyboard play, text scaling, reduced motion, contrast; offline verified. |

## Tests actually executed
- `npm test`: **296 passing, 17 files** (chess rules & perft, engine integration, strength ladder, Elo, tournaments fuzz, openings/puzzles, art, persistence incl. split-format migration/crash/corruption, career, trophies/achievements/legacy, population & world sims).
- Engine benches & soak: see ENGINE.md and WORLD.md for commands, sample sizes and results.
- Browser E2E (Playwright, Chromium + SwiftShader WebGL, no real GPU):
  - Desktop 1440×900 and iPhone 13 emulation: onboarding → world creation → Arena → 2.5D game (scenic and focused) → 2D game → Empire (arena cards, tournament sheet, records, competitor profile) → Legacy (Hall of Honors, achievements) → ceremonies. **No console errors.**
  - Keyboard/3D tap input previously verified; deterministic animation sampling on the real renderer.
  - **Offline**: production build, service worker controlling, network disabled, reload → game auto-resumes with sculpted pieces and fonts; **0 failed requests** after adding `.bin`/`.woff2` to the precache (4.9 MB).
  - Broadcast survival: left a live broadcast at move 6, returned at move 13 to the same game.

## Fixed during v0.2 verification
- WebGL probe leaked a context on every React render → phone board went blank ("Too many active WebGL contexts").
- Game screen inherited the Arena scroll position on phones.
- Offline precache missed baked models and fonts.
- Smooth-subtraction sign error in the SDF kit (broke knight/rook/bishop meshes).

## Known limitations (honest)
- **Art is code-generated.** Pieces, trophies and arenas are original SDF/three.js work and look coherent and premium-stylized, but arenas are low-poly kits with flat lighting (no baked GI or hand-painted textures); portraits remain the v0.1 procedural SVG family (one face template).
- **Performance on real devices is unmeasured.** All rendering checks ran on software WebGL (SwiftShader), where frames take ~0.2–2 s; render-on-demand keeps idle cost at zero, but frame rate, battery and memory on a real iPhone/Windows GPU were not measured.
- Scenic framing makes the board smaller; it is auto-disabled under 700 px width (setting: Arena scenery).
- Achievements that existed before v0.2 counters (ledger) cannot be back-dated; trophies before v0.2 are back-filled from tournament history without match scores.
- Persistence light commits during a game skip unseen changes until the next full commit (see PERSISTENCE.md).
- Not tested on a physical iPhone or Windows PC.
- The 99 MB big-net engine is git-ignored (GitHub file limit); fresh clones/hosts run the lite net until it is copied in (ENGINE.md §8). It is never used on phones.

## Next recommended milestone
Real-device pass (iPhone Safari PWA + Windows Edge): frame-time and memory budgets, big-net download UX; hand-painted texture/lighting pass for the twelve arenas; 3D portrait busts to replace SVG portraits; larger engine match samples on desktop hardware.
