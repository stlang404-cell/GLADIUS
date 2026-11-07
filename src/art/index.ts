/** Procedural Roman art: pure, deterministic SVG markup generators. */
export { arenaBackdropSvg, ARENA_ART_COUNT } from './arenaBackdrop';
export { arenaCrestSvg, ARENA_CREST_COUNT } from './arenaCrest';
export { rankEmblemSvg, legacyRankEmblemSvg, RANK_EMBLEM_COUNT, arenaTrophySvg } from './emblems';
export { portraitSvg, type PortraitOptions } from './portraits';
export { pieceSvg, pieceSetSvgs, type PieceType, type PieceColor } from './pieces2d';
export { svgDataUri } from './svgUtil';

/**
 * Map a v0.2 arena index (12 arenas) to its place in the 24-arena empire:
 * old i → 2i, except the Eternal Throne (old 11) which stays at the summit (23).
 * Out-of-range input is clamped.
 */
export function legacyArenaIndex(oldIndex: number): number {
  const i = Math.max(0, Math.min(11, Math.floor(Number.isFinite(oldIndex) ? oldIndex : 0)));
  return i === 11 ? 23 : i * 2;
}
