# GLADIUS Art Bible — v0.2 final: White Imperial, fully 2D

GLADIUS is a **2D** game with a **white/ivory** interface. Colour and personality come from arena illustrations, piece sets and boards; the UI stays bright, calm and readable.

## Identity
Official logo (original): a Roman gladius on a crimson roundel inside a gold laurel wreath, with the GLADIUS wordmark in Cinzel converted to vector outlines (`src/art/logo.ts`, `npm run build:brand`).
Deliverables in `public/brand/`: horizontal logo (+ tagline, + dark variant), stacked logo, compact crest, square app icon (1024/512/192/180/167/152/120), maskable PWA icons, favicon (SVG, 16–64 px PNG, `favicon.ico`), Windows `gladius.ico` (16–256). SVG masters are self-contained; rasters are transparent where appropriate. The favicon is a simplified sword-on-roundel so it reads at 16–32 px.

## Palette
| Token | Hex | Use |
|---|---|---|
| Warm white | `#FFFFFF` | cards, header, tab bar |
| Ivory | `#FAF8F3` | page background |
| Soft marble | `#F0EDE6` | segmented controls, wells |
| Imperial gold | `#C59A42` | hairlines, laurels, rewards (accent only) |
| Roman crimson | `#A92D3A` | primary action, active tab, Elo |
| Charcoal | `#242424` | text |
| Mediterranean blue | `#527EAA` | info, focus, links |

## Type
Cinzel (display: logo, arena names, ceremonies) · Inter (UI and all numbers, tabular) · Cormorant Garamond italic (mottos). All OFL, bundled.

## Components
White cards (16 px radius, soft two-layer shadow, no heavy borders); crimson primary button; white secondary; gold for rewards; ink-filled chips for selection; marble segmented control; sheets slide up on phones, centre on desktop. Icons: original 24 px stroke set. Minimal text: labels are short, numbers are large.

## Chess pieces (2D)
High-resolution transparent illustrations baked from the original sculpted "Legio" models (`npm run bake:sprites`): legionary-crested pawn, bastion rook, horse-head knight with gold mane (facing left), mitred bishop with laurel band, crowned queen, cross-and-laurel king. Three collections:
- **Classical** — ivory & polished bronze (default).
- **Imperial** — gold & crimson lacquer.
- **Marble** — Carrara white & Nero black with silver.
Every piece is identifiable by silhouette alone; contact sheets checked at 45 px and on light/dark squares.

## Boards (2D)
Twelve collections, one signature board per arena, painted once to canvas textures (veined marble, sandstone grain, mosaic tesserae, brushed bronze/gold, obsidian with gold flecks, laurel inlay), with a material frame, gold fillet and Cinzel coordinates: Colosseum Sandstone, Legion Bronze, Citadel Granite, Gladiator's Travertine, Ivory Marble, Praetorian Crimson, Senate Mosaic, Imperial Gold, Flavian Arena, Palatine Amethyst, Caesars' Verdigris, Caesar's Obsidian — plus Eternal Laurel (earned at the Eternal Throne). Square contrast is kept high; highlights: gold last-move, gold glow selection, charcoal legal dots, crimson capture rings, pulsing red check, blue keyboard cursor.

## Motion (2D)
Default **Majestic** (900 ms); Fast 200 · Balanced 480 · Custom 150–1200 ms; Reduce Motion = instant. Glide with ease-in-out, gentle lift (scale + shadow), knights arc; captures: approach → contact → gold impact ring → victim tumbles and fades → attacker settles; castling: rook hops in concert; promotion: pawn arrives as a pawn, shrinks into a golden flare, the new piece pops out; check pulse; mate/resignation: the king topples and greys. Skippable (double-tap; any new input finishes it). Drag-and-drop, tap-tap and keyboard input. Verified by frame sampling in Chromium (see STATUS).

## Arenas
Twelve original 2D illustrations (`src/art/arenaBackdrop.ts`) with crests (`src/art/arenaCrest.ts`), each its own place, palette and light; the board sits on a white stage in front of the arena.

## Trophies
Baked portraits of twelve sculpted trophy models in bronze/silver/gold/iron/wood/imperial finishes, one image per trophy definition (`public/trophies/`).

## Provenance
All art is original and produced in-repo by code. Three.js is used only offline to bake sprites; the shipped game contains no 3D runtime. Fonts: SIL OFL via @fontsource.
