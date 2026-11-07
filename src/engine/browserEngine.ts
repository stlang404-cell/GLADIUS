import { UciEngine, type UciTransport } from './uci';

export const ENGINE_FILE = 'engine/stockfish-19-lite-single.js';

function workerTransport(): UciTransport {
  const url = new URL(ENGINE_FILE, document.baseURI).href;
  const w = new Worker(url);
  let listener: (l: string) => void = () => {};
  w.onmessage = (e: MessageEvent) => {
    if (typeof e.data === 'string') listener(e.data);
  };
  return {
    send: (c) => w.postMessage(c),
    setListener: (cb) => (listener = cb),
    terminate: () => w.terminate(),
  };
}

const pool = new Map<string, UciEngine>();

/**
 * Named engine instances: 'play' (opponent moves), 'analysis' (post-game),
 * 'spectate' (AI vs AI broadcasts). Each runs in its own Worker so a long
 * analysis never stalls an opponent's move.
 */
export function getEngine(role: 'play' | 'analysis' | 'spectate'): UciEngine {
  let e = pool.get(role);
  if (!e) {
    e = new UciEngine(workerTransport());
    void e.whenReady().then(() => e!.setOption('Hash', role === 'analysis' ? 32 : 16));
    pool.set(role, e);
  }
  return e;
}

export function disposeEngine(role: string) {
  pool.get(role)?.terminate();
  pool.delete(role);
}
