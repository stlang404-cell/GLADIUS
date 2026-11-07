# Bake-time art pipeline (not shipped)

GLADIUS is a 2D game. These files run only at build time to produce static art:

- `sdf.ts`, `pieceSculpt.ts`, `trophySculpt.ts` — signed-distance sculpts of the chess set and trophies.
- `scripts/bake-pieces.ts` → `public/models/*.bin` (meshes), then `scripts/bake-sprites.mjs` renders
  them with three.js (`lab.ts`, `materials.ts`, `pieceAssets.ts`, `trophyRenderer.ts`) into the 2D
  sprites in `public/pieces/<set>/` and `public/trophies/`.

No application module imports from this folder; three.js is a devDependency.
