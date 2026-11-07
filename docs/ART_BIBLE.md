# GLADIUS Art Bible — "Imperial Reforging" (v0.2)

Stylized Roman grandeur: colourful, charming, dramatic, readable. Not photoreal, not generic medieval, not a dashboard.

## Palette
| Role | Colour | Use |
|---|---|---|
| Ivory / parchment | `#fbf5e8` → `#f3e7cf` | panels, cards, sheets |
| Ink | `#2b1a12`, `#5b4433` | text |
| Crimson | `#9c1f1a`, `#c0392b`, deep `#5e100d` | header banner, primary actions, active tab |
| Gold | `#d9a63e`, light `#f2cf6e`, deep `#9a6a1c` | trim, numbers on crimson, medallions |
| Mediterranean blue | `#2c6aa8` | information, focus rings, badges |
| Terracotta / bronze | `#c8643c`, `#b0743a` | secondary warmth |
| Obsidian | `#1d1512` | restrained accents only (clocks, eval bar) |
Arena palettes (12) live in `src/world/arenas.ts` and tint boards, environments and art.

## Typography (bundled, OFL)
- **Cinzel** 500/700/900 — headings, rank names, tab labels, ceremonies (Roman capitals).
- **Cormorant Garamond** italic — flavour lines (arena names, mottos, objectives).
- **Inter Variable** — UI text and all numbers (tabular figures).

## Shapes & UI
Rounded parchment cards (14 px radius) with a gold hairline, soft warm shadow and a gold rule under titles. Crimson pill for primary/active. Meander (Greek key) and dentil bands as ornament. Icons: original 24 px stroke set (`src/ui/components/icons.tsx`) — crossed gladii, temple, scroll, eye, eagle, crown, trophy, laurel. No emoji.

## Chess pieces — "Legio" set
Authored as signed-distance fields (`src/render/pieceSculpt.ts`), baked by surface nets + meshoptimizer (`npm run bake:pieces`, 420 KB). Staunton proportions for instant recognition, Roman motifs:
- Pawn — legionary with a gold galea crest. Rook — crenellated bastion with door and window.
- Knight — sculpted horse head, gold cavalry mane (shown in profile toward the opponent).
- Bishop — augur's mitre with slit, laurel band, gold tip. Queen — corona of nine pearled points. King — laurel crown, gold orb and cross.
Materials: ivory (clearcoat, warm sheen) vs. ebony-crimson lacquer, polished gold accents; PBR lit by a studio environment + warm key + cool rim. Checked: silhouettes distinct in profile; both colours readable on light and dark squares at iPhone size.

## Board
Two-tier plinth with gold trim; frame painted with a gold meander band and Cinzel coordinates; veined marble squares (values pushed apart for piece contrast). Highlights are soft glow decals: gold for last move/selection, ivory dots for legal moves, red rings for captures, pulsing red for check, blue ring for keyboard cursor.

## Motion
Presets Fast 200 ms · Balanced 480 ms (default) · Majestic 900 ms · Custom 150–1200 ms. Ease-in-out cubic glide with a slight lean; knights hop. Capture: approach → contact → victim tips, slides and fades → attacker settles. Castling: king glides, rook hops over. Promotion: golden flare, pawn shrinks, new piece rises (out-back). Mate/resignation: king topples. A small landing settle gives weight. All skippable (double-tap) and disabled by Reduce Motion. Verified by deterministic timeline sampling (no regressions, exact landing, ≤0.6 square/frame).

## Arenas
Each arena = painted far backdrop + 3D near architecture (`src/render/arenaScene.ts`), own ground material, light colour/intensity, fog and props:
Dust Pits (sand, palisade, training posts, braziers, sunset) · Legion Camp (tents, standards, grass, blue sky) · Iron Citadel (grey walls, towers) · Gladiator's Court (two-storey arcade, palms) · Forum of Triumph (marble colonnade, triumphal arch, colossal statues, cypresses) · Praetorian Bastion (dusk, dark walls, torches) · Senate Hall (green marble, columns, crimson benches) · Consular Palace (crimson & gold, fasces) · Grand Colosseum (three tiers of arches, seating, sand) · Imperial Palace (night, golden domes) · Hall of Caesars (teal hall of colossal marble chess statues) · Eternal Throne (celestial platform, golden throne, light shaft).
Scenic framing places the board low with the arena rising behind; "Board only" framing for small screens.

## Trophies
Twelve SDF-sculpted trophy models (`src/render/trophySculpt.ts`, `npm run bake:trophies`): cup, amphora, shield, medal, standing laurel, crown, torque, eagle standard, sword, vexillum, fasces, curule seat — rendered as portraits in bronze, silver, gold, iron, wood or imperial gold with enamel accents. Each arena's signature trophy has its own model + material.

## Provenance
All art is original and generated in-repo by code (SDF sculpts, canvas textures, SVG). Fonts: Cinzel, Cormorant Garamond, Inter — SIL Open Font License, bundled via @fontsource. No remote assets at runtime.
