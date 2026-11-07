import { Board3D } from './board3d';
import { ARENAS } from '../world/arenas';

/**
 * Renders arena "portraits" (the 3D environment with its board) for UI cards
 * and banners, using ONE hidden Board3D so only one extra WebGL context exists.
 * Results are cached as JPEG data URLs.
 */
let host: HTMLDivElement | null = null;
let board: Board3D | null = null;
let ready: Promise<void> | null = null;
const cache = new Map<number, string>();
let chain: Promise<unknown> = Promise.resolve();

function ensure(): Promise<void> {
  if (ready) return ready;
  host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:960px;height:540px;pointer-events:none;';
  document.body.appendChild(host);
  board = new Board3D(host, ARENAS[0].palette, { quality: 'low' });
  board.setTilt(0.62);
  board.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  ready = new Promise((res) => {
    board!.onReady = () => res();
    setTimeout(res, 4000);
  });
  return ready;
}

export function arenaPortrait(index: number): Promise<string> {
  const hit = cache.get(index);
  if (hit) return Promise.resolve(hit);
  const p = (chain = chain.then(async () => {
    const again = cache.get(index);
    if (again) return again;
    await ensure();
    board!.setPalette(ARENAS[index].palette);
    board!.setArena(index);
    await new Promise((r) => setTimeout(r, 350)); // async statues / textures
    const url = board!.snapshot('image/jpeg', 0.84);
    cache.set(index, url);
    return url;
  })) as Promise<string>;
  return p;
}
