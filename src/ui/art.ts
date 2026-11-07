import { portraitSvg } from '../art/portraits';
import { rankEmblemSvg, arenaTrophySvg } from '../art/emblems';
import { pieceSvg } from '../art/pieces2d';
import { svgDataUri } from '../art/svgUtil';
import { arenaBackdropSvg } from '../art/arenaBackdrop';

const cache = new Map<string, string>();
function memo(key: string, f: () => string): string {
  let v = cache.get(key);
  if (!v) {
    v = svgDataUri(f());
    if (cache.size > 3000) cache.clear();
    cache.set(key, v);
  }
  return v;
}

export const portraitUri = (seed: number, female: boolean, age: number, arena: number) =>
  memo(`p${seed}|${female}|${Math.round(age / 5)}|${arena}`, () => portraitSvg(seed, { female, age, arenaIndex: arena }));
export const emblemUri = (rank: number) => memo(`e${rank}`, () => rankEmblemSvg(rank));
export const trophyUri = (arena: number) => memo(`t${arena}`, () => arenaTrophySvg(arena));
export const pieceUri = (type: string, color: 'w' | 'b', set: number) => memo(`pc${type}${color}${set}`, () => pieceSvg(type as 'p', color, set));
export const backdropUri = (arena: number) => memo(`b${arena}`, () => arenaBackdropSvg(arena));
