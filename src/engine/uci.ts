/**
 * Minimal UCI client that works over any line-based transport: a browser
 * Web Worker running Stockfish WASM, or the Node build used in tests.
 * The engine runs entirely off the UI thread.
 */

export interface UciTransport {
  send(cmd: string): void;
  setListener(cb: (line: string) => void): void;
  terminate(): void;
}

export type Score = { cp?: number; mate?: number };

export type PvLine = {
  multipv: number;
  depth: number;
  score: Score; // from the side to move's perspective
  pv: string[];
  nodes?: number;
};

export type SearchParams = {
  fen: string;
  moves?: string[];
  depth?: number;
  movetime?: number;
  nodes?: number;
  multipv?: number;
  searchmoves?: string[];
};

export type SearchResult = { bestmove: string | null; ponder?: string; lines: PvLine[] };

export function parseInfo(line: string): PvLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return null;
  const tok = line.split(/\s+/);
  let depth = 0;
  let multipv = 1;
  const score: Score = {};
  let nodes: number | undefined;
  let pv: string[] = [];
  for (let i = 1; i < tok.length; i++) {
    const t = tok[i];
    if (t === 'depth') depth = Number(tok[++i]);
    else if (t === 'multipv') multipv = Number(tok[++i]);
    else if (t === 'nodes') nodes = Number(tok[++i]);
    else if (t === 'score') {
      const kind = tok[++i];
      const v = Number(tok[++i]);
      if (kind === 'cp') score.cp = v;
      else if (kind === 'mate') score.mate = v;
      if (tok[i + 1] === 'lowerbound' || tok[i + 1] === 'upperbound') return null; // ignore bound-only lines
    } else if (t === 'pv') {
      pv = tok.slice(i + 1);
      break;
    }
  }
  if (score.cp === undefined && score.mate === undefined) return null;
  return { multipv, depth, score, pv, nodes };
}

export class UciEngine {
  private listeners = new Set<(l: string) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;
  private current: { stop: () => void } | null = null;
  private options = new Map<string, string>();
  name = 'engine';

  constructor(private transport: UciTransport) {
    transport.setListener((l) => {
      for (const cb of [...this.listeners]) cb(l);
    });
    this.ready = this.handshake();
  }

  private waitFor(pred: (l: string) => boolean, onLine?: (l: string) => void): Promise<string> {
    return new Promise((resolve) => {
      const cb = (l: string) => {
        onLine?.(l);
        if (pred(l)) {
          this.listeners.delete(cb);
          resolve(l);
        }
      };
      this.listeners.add(cb);
    });
  }

  private async handshake() {
    const ok = this.waitFor((l) => l === 'uciok', (l) => {
      if (l.startsWith('id name ')) this.name = l.slice(8);
    });
    this.transport.send('uci');
    await ok;
    await this.isReady();
  }

  async isReady() {
    const p = this.waitFor((l) => l === 'readyok');
    this.transport.send('isready');
    await p;
  }

  whenReady() {
    return this.ready;
  }

  /** Set an option (cached so repeated identical calls are free). */
  async setOption(name: string, value: string | number | boolean) {
    const v = String(value);
    if (this.options.get(name) === v) return;
    this.options.set(name, v);
    this.transport.send(`setoption name ${name} value ${v}`);
  }

  async newGame() {
    await this.ready;
    this.transport.send('ucinewgame');
    await this.isReady();
  }

  /** Searches are serialized; calling stop() ends the active one early. */
  search(p: SearchParams, onInfo?: (l: PvLine) => void): Promise<SearchResult> {
    const run = async (): Promise<SearchResult> => {
      await this.ready;
      await this.setOption('MultiPV', p.multipv ?? 1);
      await this.isReady();
      const lines = new Map<number, PvLine>();
      const done = this.waitFor(
        (l) => l.startsWith('bestmove'),
        (l) => {
          const info = parseInfo(l);
          if (info) {
            lines.set(info.multipv, info);
            onInfo?.(info);
          }
        },
      );
      const pos = `position fen ${p.fen}` + (p.moves && p.moves.length ? ` moves ${p.moves.join(' ')}` : '');
      this.transport.send(pos);
      let go = 'go';
      if (p.depth) go += ` depth ${p.depth}`;
      if (p.movetime) go += ` movetime ${p.movetime}`;
      if (p.nodes) go += ` nodes ${p.nodes}`;
      if (!p.depth && !p.movetime && !p.nodes) go += ' depth 12';
      if (p.searchmoves?.length) go += ` searchmoves ${p.searchmoves.join(' ')}`;
      this.current = { stop: () => this.transport.send('stop') };
      this.transport.send(go);
      const best = await done;
      this.current = null;
      const tok = best.split(/\s+/);
      const bm = tok[1] && tok[1] !== '(none)' ? tok[1] : null;
      const ponder = tok[2] === 'ponder' ? tok[3] : undefined;
      return {
        bestmove: bm,
        ponder,
        lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv),
      };
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  stop() {
    this.current?.stop();
  }

  terminate() {
    this.transport.terminate();
  }
}

/** Convert a score to centipawns (mates mapped to large values), side-to-move perspective. */
export function scoreToCp(s: Score): number {
  if (s.mate !== undefined) {
    if (s.mate === 0) return -100000; // side to move is mated
    return s.mate > 0 ? 100000 - s.mate * 100 : -100000 - s.mate * 100;
  }
  return s.cp ?? 0;
}

/**
 * Win probability (0..100) for the side to move from a centipawn score.
 * Uses the logistic model published by Lichess (fitted on rated games):
 *   Win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
 */
export function winPercent(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 ? 100 : s.mate < 0 ? 0 : 0;
  const cp = Math.max(-1000, Math.min(1000, s.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
