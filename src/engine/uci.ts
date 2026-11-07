/**
 * UCI client that works over any line-based transport: a browser Web Worker
 * running Stockfish WASM, the in-process Node build, or a child process.
 * The engine runs entirely off the UI thread.
 *
 * Robustness guarantees (see docs/ENGINE.md, "UCI client"):
 *  - every wait has a timeout, so no promise returned here can hang forever;
 *  - a transport that errors/dies (worker crash, wasm abort, process exit) or a
 *    search that never answers is torn down and, when the engine was built from
 *    a transport *factory*, restarted transparently; the in-flight search is
 *    retried once on the fresh engine and options are re-applied;
 *  - stop() is always safe (no-op when idle); an AbortSignal cancels a queued
 *    or running search: the promise rejects at once with an AbortError, the
 *    engine is sent `stop`, and the next queued search only starts after the
 *    stopped one has returned its `bestmove` (clean protocol state);
 *  - searches can pass through a {@link SearchGate} (the resource scheduler):
 *    a lease is held only while this engine actually searches, and a
 *    preemptible search that is preempted is stopped, discarded and re-run.
 */

export interface UciTransport {
  send(cmd: string): void;
  setListener(cb: (line: string) => void): void;
  terminate(): void;
  /** Optional: report that the worker/process failed or exited. */
  setErrorListener?(cb: (err: Error) => void): void;
}

export type TransportFactory = () => UciTransport;

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
  /** Clock-based search: Stockfish's own time manager decides (ms). */
  wtime?: number;
  btime?: number;
  winc?: number;
  binc?: number;
  movestogo?: number;
  /** Hard watchdog for this search (ms). Default derived from the limits. */
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type SearchResult = { bestmove: string | null; ponder?: string; lines: PvLine[] };

/** Minimal interface of the resource scheduler (src/engine/scheduler.ts). */
export interface SearchGate {
  acquire(req: GateRequest): Promise<GateLease>;
}
export type GateRequest = {
  role: string;
  priority: number;
  preemptible: boolean;
  /** Called by the gate when a higher-priority search needs this slot. */
  onPreempt: () => void;
  signal?: AbortSignal;
};
export type GateLease = { release(): void };

export type EngineOptions = {
  role?: string;
  gate?: SearchGate;
  /** Scheduler priority (higher wins). Default 1. */
  priority?: number;
  /** May the gate stop and re-run this engine's searches? Default false. */
  preemptible?: boolean;
  /** Timeout for uci/uciok + first readyok (big nets need a few seconds). */
  handshakeTimeoutMs?: number;
  /** Timeout for isready/readyok. */
  readyTimeoutMs?: number;
  /** Extra time after the nominal search limit before `stop` is forced. */
  searchGraceMs?: number;
  /** Terminate the transport after this long idle (0 = never). Restarts lazily. */
  idleTerminateMs?: number;
  /** Used when the primary factory fails to start (e.g. big-net download failed). */
  fallbackFactory?: TransportFactory;
  /** Options applied after every (re)start, before caller-set options. */
  initOptions?: Record<string, string | number | boolean>;
  onEvent?: (e: EngineEvent) => void;
};

export type EngineEvent =
  | { type: 'started'; name: string; ms: number }
  | { type: 'restart'; reason: string }
  | { type: 'fallback'; reason: string }
  | { type: 'idle-terminate' }
  | { type: 'preempted' };

export class EngineError extends Error {
  constructor(
    message: string,
    public code: 'timeout' | 'crashed' | 'terminated' | 'aborted',
  ) {
    super(message);
    this.name = code === 'aborted' ? 'AbortError' : 'EngineError';
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

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

type Waiter = { cb: (l: string) => void; fail: (e: Error) => void };

export class UciEngine {
  private waiters = new Set<Waiter>();
  private queue: Promise<unknown> = Promise.resolve();
  private transport: UciTransport | null = null;
  private factory: TransportFactory | null;
  private ready: Promise<void> | null = null;
  private gen = 0;
  private searching = false;
  private disposed = false;
  private usingFallback = false;
  /** Options the caller wants (re-applied after restarts). */
  private desired = new Map<string, string>();
  /** Options actually sent to the current transport. */
  private applied = new Map<string, string>();
  private busy = 0;
  private pendingRestart = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private o: Required<Omit<EngineOptions, 'gate' | 'fallbackFactory' | 'initOptions' | 'onEvent'>> & EngineOptions;
  name = 'engine';
  /** Number of transparent restarts performed (crash, hang, fallback). */
  restarts = 0;

  constructor(transport: UciTransport | TransportFactory, opts: EngineOptions = {}) {
    this.o = {
      role: 'engine',
      priority: 1,
      preemptible: false,
      handshakeTimeoutMs: 30000,
      readyTimeoutMs: 10000,
      searchGraceMs: 4000,
      idleTerminateMs: 0,
      ...opts,
    };
    if (typeof transport === 'function') {
      this.factory = transport;
    } else {
      this.factory = null;
      this.attach(transport);
    }
    for (const [k, v] of Object.entries(opts.initOptions ?? {})) this.desired.set(k, String(v));
    // Eager start keeps the old behaviour (constructing an engine boots it).
    this.ready = this.boot();
    this.ready.catch(() => undefined);
  }

  get role() {
    return this.o.role;
  }

  /** Swap the transport factory (e.g. big net became available). Takes effect at the next idle restart. */
  setFactory(f: TransportFactory, opts: { restartNow?: boolean; fallbackFactory?: TransportFactory; handshakeTimeoutMs?: number } = {}) {
    this.factory = f;
    this.usingFallback = false;
    this.o.fallbackFactory = opts.fallbackFactory;
    if (opts.handshakeTimeoutMs) this.o.handshakeTimeoutMs = opts.handshakeTimeoutMs;
    if (!opts.restartNow) return;
    if (this.busy === 0) this.teardown('factory changed');
    else this.pendingRestart = true; // after the running operation
  }

  private attach(t: UciTransport) {
    const gen = ++this.gen;
    this.transport = t;
    this.applied.clear();
    t.setListener((l) => {
      if (gen !== this.gen) return;
      for (const w of [...this.waiters]) w.cb(l);
    });
    t.setErrorListener?.((err) => {
      if (gen !== this.gen) return;
      this.crash(new EngineError(`engine transport failed: ${err.message}`, 'crashed'));
    });
  }

  /** Reject everything waiting on the current transport and drop it. */
  private crash(err: Error) {
    const ws = [...this.waiters];
    this.waiters.clear();
    this.teardown(err.message);
    for (const w of ws) w.fail(err);
  }

  private teardown(_reason: string) {
    this.gen++;
    this.searching = false;
    const t = this.transport;
    this.transport = null;
    this.ready = null;
    this.applied.clear();
    try {
      t?.terminate();
    } catch {
      /* ignore */
    }
  }

  private async boot(): Promise<void> {
    const t0 = Date.now();
    if (!this.transport) {
      if (this.disposed) throw new EngineError('engine terminated', 'terminated');
      const f = this.usingFallback ? this.o.fallbackFactory! : this.factory;
      if (!f) throw new EngineError('engine transport is gone and no factory was given', 'crashed');
      this.attach(f());
    }
    const ok = this.waitFor(
      (l) => l === 'uciok',
      this.o.handshakeTimeoutMs,
      (l) => {
        if (l.startsWith('id name ')) this.name = l.slice(8);
      },
    );
    this.send('uci');
    await ok;
    await this.isReadyRaw();
    this.o.onEvent?.({ type: 'started', name: this.name, ms: Date.now() - t0 });
  }

  /** Make sure a live, handshaken transport exists (restarting if needed). */
  private async ensure(): Promise<void> {
    if (this.disposed) throw new EngineError('engine terminated', 'terminated');
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    for (let attempt = 0; ; attempt++) {
      if (!this.ready) this.ready = this.boot();
      try {
        await this.ready;
        return;
      } catch (e) {
        if (this.disposed) throw e;
        this.crashQuiet();
        if (!this.factory) throw e;
        if (attempt === 0 && this.o.fallbackFactory && !this.usingFallback) {
          this.usingFallback = true;
          this.restarts++;
          this.o.onEvent?.({ type: 'fallback', reason: (e as Error).message });
          continue;
        }
        if (attempt < 1) {
          this.restarts++;
          this.o.onEvent?.({ type: 'restart', reason: (e as Error).message });
          continue;
        }
        throw e;
      }
    }
  }

  private crashQuiet() {
    this.waiters.clear();
    this.teardown('boot failed');
  }

  private send(cmd: string) {
    try {
      this.transport?.send(cmd);
    } catch (e) {
      this.crash(new EngineError(`send failed: ${(e as Error).message}`, 'crashed'));
    }
  }

  private waitFor(pred: (l: string) => boolean, timeoutMs: number, onLine?: (l: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const w: Waiter = {
        cb: (l: string) => {
          onLine?.(l);
          if (pred(l)) {
            this.waiters.delete(w);
            if (timer) clearTimeout(timer);
            resolve(l);
          }
        },
        fail: (e) => {
          if (timer) clearTimeout(timer);
          reject(e);
        },
      };
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timer = setTimeout(() => {
          this.waiters.delete(w);
          reject(new EngineError(`engine did not answer within ${timeoutMs} ms`, 'timeout'));
        }, timeoutMs);
      }
      this.waiters.add(w);
    });
  }

  private async isReadyRaw() {
    const p = this.waitFor((l) => l === 'readyok', this.o.readyTimeoutMs);
    this.send('isready');
    await p;
  }

  async isReady() {
    await this.ensure();
    try {
      await this.isReadyRaw();
    } catch (e) {
      if ((e as EngineError).code === 'timeout') this.crash(e as Error);
      throw e;
    }
  }

  whenReady(): Promise<void> {
    return this.ensure();
  }

  /** Set an option. Cached; applied before the next search (and after restarts). */
  async setOption(name: string, value: string | number | boolean) {
    this.desired.set(name, String(value));
    if (this.transport && !this.searching && this.busy === 0 && this.ready) {
      await this.ready.catch(() => undefined);
      if (this.transport && !this.searching) this.syncOptions();
    }
  }

  getOption(name: string): string | undefined {
    return this.desired.get(name);
  }

  private syncOptions() {
    for (const [k, v] of this.desired) {
      if (this.applied.get(k) === v) continue;
      this.applied.set(k, v);
      this.send(`setoption name ${k} value ${v}`);
    }
  }

  /** Serialize an operation on this engine. */
  private enqueue<T>(op: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const run = async () => {
      if (signal?.aborted) throw new EngineError('search aborted', 'aborted');
      this.busy++;
      try {
        return await op();
      } finally {
        this.busy--;
        if (this.busy === 0 && this.pendingRestart) {
          this.pendingRestart = false;
          this.teardown('factory changed');
        }
        this.armIdle();
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    if (!signal) return next;
    // A queued search rejects as soon as it is aborted (no waiting behind others).
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(new EngineError('search aborted', 'aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
      next.then(
        (v) => {
          signal.removeEventListener('abort', onAbort);
          resolve(v);
        },
        (e) => {
          signal.removeEventListener('abort', onAbort);
          reject(e);
        },
      );
    });
  }

  private armIdle() {
    if (this.busy > 0 || !this.o.idleTerminateMs || !this.factory || this.disposed) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.busy === 0 && this.transport) {
        this.teardown('idle');
        this.o.onEvent?.({ type: 'idle-terminate' });
      }
    }, this.o.idleTerminateMs);
  }

  /** True while a worker/process is alive (false after idle termination). */
  get alive() {
    return !!this.transport;
  }

  async newGame() {
    return this.enqueue(async () => {
      await this.ensure();
      this.syncOptions();
      this.send('ucinewgame');
      await this.isReadyRaw();
    });
  }

  /** Searches are serialized; calling stop() ends the active one early. */
  search(p: SearchParams, onInfo?: (l: PvLine) => void): Promise<SearchResult> {
    return this.enqueue(() => this.runSearch(p, onInfo), p.signal);
  }

  private async runSearch(p: SearchParams, onInfo?: (l: PvLine) => void): Promise<SearchResult> {
    let failures = 0;
    for (;;) {
      if (p.signal?.aborted) throw new EngineError('search aborted', 'aborted');
      let preempted = false;
      const lease = this.o.gate
        ? await this.o.gate.acquire({
            role: this.o.role,
            priority: this.o.priority,
            preemptible: this.o.preemptible,
            signal: p.signal,
            onPreempt: () => {
              preempted = true;
              this.stop();
            },
          })
        : null;
      try {
        const r = await this.searchOnce(p, onInfo);
        if (p.signal?.aborted) throw new EngineError('search aborted', 'aborted');
        if (preempted) {
          this.o.onEvent?.({ type: 'preempted' });
          continue; // re-run after the higher-priority search (lease released in finally)
        }
        return r;
      } catch (e) {
        const err = e as EngineError;
        if (isAbortError(e) || err.code === 'aborted' || err.code === 'terminated' || this.disposed) throw e;
        // A timed-out isready/handshake leaves an unresponsive worker: drop it.
        if (err.code === 'timeout' && this.transport) this.crash(err);
        failures++;
        if (this.factory && failures === 1) {
          this.restarts++;
          this.o.onEvent?.({ type: 'restart', reason: err.message });
          continue;
        }
        if (this.factory && failures === 2 && this.o.fallbackFactory && !this.usingFallback) {
          // The primary build keeps failing (e.g. big net out of memory): use the fallback.
          this.usingFallback = true;
          this.teardown('fallback');
          this.restarts++;
          this.o.onEvent?.({ type: 'fallback', reason: err.message });
          continue;
        }
        throw e;
      } finally {
        lease?.release();
      }
    }
  }

  private nominalLimitMs(p: SearchParams): number {
    if (p.timeoutMs) return p.timeoutMs;
    if (p.movetime) return p.movetime;
    if (p.wtime !== undefined || p.btime !== undefined) return Math.max(p.wtime ?? 0, p.btime ?? 0);
    if (p.nodes) return 60000;
    return 120000; // depth searches: generous but finite
  }

  private async searchOnce(p: SearchParams, onInfo?: (l: PvLine) => void): Promise<SearchResult> {
    await this.ensure();
    this.desired.set('MultiPV', String(p.multipv ?? 1));
    this.syncOptions();
    await this.isReadyRaw();
    const lines = new Map<number, PvLine>();
    const done = this.waitFor(
      (l) => l.startsWith('bestmove'),
      Infinity,
      (l) => {
        const info = parseInfo(l);
        if (info) {
          lines.set(info.multipv, info);
          onInfo?.(info);
        }
      },
    );
    const pos = `position fen ${p.fen}` + (p.moves && p.moves.length ? ` moves ${p.moves.join(' ')}` : '');
    this.send(pos);
    let go = 'go';
    if (p.depth) go += ` depth ${p.depth}`;
    if (p.movetime) go += ` movetime ${Math.max(1, Math.round(p.movetime))}`;
    if (p.nodes) go += ` nodes ${p.nodes}`;
    const clocked = p.wtime !== undefined || p.btime !== undefined;
    if (clocked) {
      go += ` wtime ${Math.max(1, Math.round(p.wtime ?? 1))} btime ${Math.max(1, Math.round(p.btime ?? 1))}`;
      if (p.winc) go += ` winc ${Math.round(p.winc)}`;
      if (p.binc) go += ` binc ${Math.round(p.binc)}`;
      if (p.movestogo) go += ` movestogo ${p.movestogo}`;
    }
    if (!p.depth && !p.movetime && !p.nodes && !clocked) go += ' depth 12';
    if (p.searchmoves?.length) go += ` searchmoves ${p.searchmoves.join(' ')}`;
    const onAbort = () => this.stop();
    p.signal?.addEventListener('abort', onAbort, { once: true });
    this.searching = true;
    const gen = this.gen;
    // Watchdog: force `stop` after the limit + grace, then declare the engine hung.
    let watchdog2: ReturnType<typeof setTimeout> | null = null;
    const limit = this.nominalLimitMs(p) + this.o.searchGraceMs;
    const watchdog = setTimeout(() => {
      if (gen !== this.gen || !this.searching) return;
      this.send('stop');
      watchdog2 = setTimeout(() => {
        if (gen !== this.gen || !this.searching) return;
        this.crash(new EngineError(`search did not finish (${limit} ms + grace)`, 'timeout'));
      }, Math.max(1000, this.o.searchGraceMs));
    }, limit);
    this.send(go);
    let best: string;
    try {
      best = await done;
    } finally {
      clearTimeout(watchdog);
      if (watchdog2) clearTimeout(watchdog2);
      p.signal?.removeEventListener('abort', onAbort);
      if (gen === this.gen) this.searching = false;
    }
    const tok = best.split(/\s+/);
    const bm = tok[1] && tok[1] !== '(none)' ? tok[1] : null;
    const ponder = tok[2] === 'ponder' ? tok[3] : undefined;
    return {
      bestmove: bm,
      ponder,
      lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv),
    };
  }

  /** End the active search early (it resolves with the best move so far). Safe when idle. */
  stop() {
    if (this.searching && this.transport) this.send('stop');
  }

  /** Permanently shut down: pending/queued operations reject, the worker is killed. */
  terminate() {
    this.disposed = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.crash(new EngineError('engine terminated', 'terminated'));
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
