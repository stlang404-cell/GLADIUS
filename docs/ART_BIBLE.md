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

## Chess pieces (2D) — v0.3
Hand-authored **vector illustrations** (`src/render/vectorPieces.ts`): every piece is a stack of flat parts (body, gilded trim, crest, engraved ink) in a 100×100 viewBox, lit from the upper left by cylindrical gradients with a gloss stripe and a top-light/bottom-shade overlay, and closed by a firm outline (≈1 px at 40 px squares). Dark pieces carry a thin light halo so they read on dark squares. Designs (shapes) and materials (palettes) are independent. Baked by Chromium to 320 px WebP: `node scripts/bake-sprites.mjs pieces` → `public/pieces/<folder>/<w|b><p|n|b|r|q|k>.webp` (≈75–91 KB per set). Set metadata (id, name, description, unlock rule, folder) lives in `src/board2d/pieceSets.ts`; `Board.tsx` derives `PIECE_STYLES` / `pieceSrc` from it, and `normalizePieceStyle` maps stored/legacy ids.
- **Legio** (`classical`, primary, always) — ivory vs ebony, gold: legionary-galea pawn with red crest, crenellated tower rook with gate, horse with red legionary crest along the mane and gilded bridle, augur mitre bishop with slit and gold finial, five-point diadem queen with pearls and a garnet, laurel-banded king with orb and cross.
- **Senate Marble** (`marble`, arena 3) — Carrara vs Nero Marquina with veining, silver fittings; architectural forms: column-drum pawn with sphere, triumphal-arch rook (open passage), sculpted horse bust with carved mane locks, Vestal-flame brazier bishop, Ionic queen with pearl diadem, Corinthian king crowned by a laurel ring.
- **Praetorian Guard** (`imperial`, arena 6) — burnished steel vs oxblood lacquer, gilded: legionary behind his scutum (pawn), gate-tower rook with portcullis, armoured warhorse with chanfron, upright crest and peytral, flamen's apex bishop, radiate-crown queen, aquila king.
Rules: silhouettes differ by type at 32 px (pawn smallest; king tallest with a unique finial); light/dark sides differ in value (not just hue) and pass grayscale and deuteranopia checks; no Unicode glyphs. Gate contact sheets: every piece large, start position on all 13 boards at 40 px and 90 px squares, markers (last move, selection, dots, capture ring, check) on every board × set, grayscale and colour-blind sheets.

## Boards (2D)
Twenty-four signature boards — one per arena in the 24-arena empire — plus Eternal Laurel, painted once to canvas textures (veined marble, sandstone grain, travertine pores, granite speckle, mosaic tesserae, brushed bronze/gold, obsidian with gold flecks, laurel inlay, and since v0.3 wood planks, cross-laid papyrus and porphyry speckle) with a material frame, gold fillet and Cinzel coordinates. Original twelve (ids unchanged; arena = 2 × old index): Colosseum Sandstone 0, Legion Bronze 2, Citadel Granite 4, Gladiator's Travertine 6, Ivory Marble 8, Praetorian Crimson 10, Senate Mosaic 12, Imperial Gold 14, Flavian Arena 16, Palatine Amethyst 18, Caesars' Verdigris 20, Caesar's Obsidian 23. New: Ludus Oak 1, Frontier Pine 3, Ostia Harbour Blue 5, Aqueduct Travertine 7, Thermae Teal Marble 9, Circus Red Granite 11, Alexandria Papyrus 13, Capitoline Porphyry 15, Pantheon Grey Granite 17, Tibur Garden Green 19, Domus Aurea Gilded 21, Victoria Alabaster 22. Eternal Laurel (23) is earned at the Eternal Throne. Board ids are stored in saves and never change; `signatureTheme(0..23)` falls back to the nearest lower arena. Each theme names the piece set shown for "match each board" (`pieces`). Textures stay restrained (mosaic tesserae kept low-contrast) so pieces always lead. Markers are built to read on every board: last move = gold wash + thin gold inset edge (from-square lighter); selection = gold glow with a two-tone (gold + white) inset ring; legal dots = charcoal with a faint light rim; capture = crimson ring with white edges, inside the square; check = pulsing red glow with a red inset edge (the pulse is the non-colour cue); hint = blue; keyboard cursor = blue inset.

## Motion (2D)
Default **Majestic** (900 ms); Fast 200 · Balanced 480 · Custom 150–1200 ms; Reduce Motion = instant. Glide with ease-in-out, gentle lift (scale + shadow), knights arc; captures: approach → contact → gold impact ring → victim tumbles and fades → attacker settles; castling: rook hops in concert; promotion: pawn arrives as a pawn, shrinks into a golden flare, the new piece pops out; check pulse; mate/resignation: the king topples and greys. Skippable (double-tap; any new input finishes it). Drag-and-drop, tap-tap and keyboard input. Verified by frame sampling in Chromium (see STATUS).

## Arenas
Twelve original 2D illustrations (`src/art/arenaBackdrop.ts`) with crests (`src/art/arenaCrest.ts`), each its own place, palette and light; the board sits on a white stage in front of the arena.

## Trophies
v0.3 adds twelve signature trophies for the new arenas (`NEW_SIG` in `src/render/trophySculpt.ts`, baked as `public/trophies/sig-a<arena>.webp` so the original `sig-0…sig-11` files keep their names): gladiator helmet (Ludus), timber palisade fort (Rhine), anchor (Ostia), two-tier aqueduct (Aqueduct Heights), volute krater (Baths), chariot wheel with palm (Circus Maximus), scroll on lectern (Great Library), temple façade (Capitoline), domed rotunda with portico (Pantheon), garden pigna (Tibur), radiate sun crown (Golden House), winged Victory (Sanctum of Victory).
Baked portraits of twelve sculpted trophy models in bronze/silver/gold/iron/wood/imperial finishes, one image per trophy definition (`public/trophies/`).

## Provenance
All art is original and produced in-repo by code. Three.js is used only offline to bake sprites; the shipped game contains no 3D runtime. Fonts: SIL OFL via @fontsource.
