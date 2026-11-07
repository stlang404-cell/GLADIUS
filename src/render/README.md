# Bake-time art pipeline (not shipped)

GLADIUS is a 2D game. These files run only at build time to produce static art:

- `sdf.ts`, `pieceSculpt.ts`, `trophySculpt.ts` — signed-distance sculpts of the chess set and trophies.
- `vectorPieces.ts` — the v0.3 chess pieces: hand-authored vector illustrations (designs × materials),
  rasterised by `node scripts/bake-sprites.mjs pieces` into `public/pieces/<set>/` (sets: `src/board2d/pieceSets.ts`).
- `boardLab.tsx` — dev-only contact-sheet page (`lab.html?mode=boards&sets=…&themes=all&sq=40[&gray|&cb]`).
- (legacy) `scripts/bake-pieces.ts` → `public/models/*.bin` (meshes), then `scripts/bake-sprites.mjs` renders
  them with three.js (`lab.ts`, `materials.ts`, `pieceAssets.ts`, `trophyRenderer.ts`) into the 2D
  sprites in `public/pieces/<set>/` and `public/trophies/`.

Trophies are still sculpted/rendered with three.js. No application module imports from this folder; three.js is a devDependency.
