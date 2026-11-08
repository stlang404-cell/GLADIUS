import type { GateLease, GateRequest, SearchGate } from './uci';

/**
 * Resource scheduler for engine searches across workers (play / analysis /
 * spectate / elite). Each UciEngine asks the scheduler for a lease right
 * before it sends `go` and releases it when `bestmove` arrives, so the limit
 * is on *simultaneous searches* (CPU), not on workers.
 *
 * Rules (docs/ENGINE.md, "Scheduler"):
 *  1. At most `maxConcurrent` searches run at once.
 *  2. Requests are granted by priority, FIFO within a priority.
 *  3. `exclusiveAbove`: while a search at or above this priority (the
 *     opponent's move) is running or waiting, nothing below it starts, so
 *     analysis and broadcasts pause while the player's opponent thinks.
 *  4. Preemption: when a request cannot be granted, running *preemptible*
 *     lower-priority searches are asked to stop (the engine discards the
 *     partial result and re-runs that search later). Play is never preempted.
 *  5. An aborted waiting request leaves the queue immediately (no leaks).
 *  6. hold(p): requests at or below priority p wait (running preemptible ones
 *     are stopped and re-run later) until release() — the browser pool holds
 *     analysis while a game is in progress so it never competes with play.
 */
export const PRIORITY = { analysis: 1, spectate: 2, play: 3 } as const;

export type SchedulerOptions = {
  maxConcurrent: number;
  /** Priority at/above which a search runs exclusively. Default PRIORITY.play. */
  exclusiveAbove?: number;
};

type Waiting = { req: GateRequest; grant: (l: GateLease) => void; fail: (e: Error) => void; seq: number };
type Running = { req: GateRequest; id: number; preemptAsked: boolean };

export class EngineScheduler implements SearchGate {
  private waiting: Waiting[] = [];
  private running = new Map<number, Running>();
  private seq = 0;
  private opts: Required<SchedulerOptions>;
  /** Log of grants (role names) — handy for tests and the debug overlay. */
  readonly history: string[] = [];

  constructor(opts: SchedulerOptions) {
    this.opts = { exclusiveAbove: PRIORITY.play, ...opts };
  }

  /** Searches with priority ≤ this value are held (not started; running preemptible ones are stopped). */
  private holdAtOrBelow = -Infinity;

  /**
   * Hold background work while a game is in progress (v0.3): e.g.
   * hold(PRIORITY.analysis) keeps post-game analysis queued until release().
   */
  hold(priority: number) {
    this.holdAtOrBelow = priority;
    this.pump();
  }
  release() {
    this.holdAtOrBelow = -Infinity;
    this.pump();
  }
  get held() {
    return this.holdAtOrBelow;
  }

  setMaxConcurrent(n: number) {
    this.opts.maxConcurrent = Math.max(1, n);
    this.pump();
  }

  get stats() {
    return {
      running: [...this.running.values()].map((r) => r.req.role),
      held: this.holdAtOrBelow > -Infinity ? this.holdAtOrBelow : null,
      waiting: this.waiting.map((w) => w.req.role),
      maxConcurrent: this.opts.maxConcurrent,
    };
  }

  acquire(req: GateRequest): Promise<GateLease> {
    return new Promise<GateLease>((resolve, reject) => {
      if (req.signal?.aborted) {
        reject(abortError());
        return;
      }
      const w: Waiting = { req, grant: resolve, fail: reject, seq: this.seq++ };
      this.waiting.push(w);
      req.signal?.addEventListener(
        'abort',
        () => {
          const i = this.waiting.indexOf(w);
          if (i >= 0) {
            this.waiting.splice(i, 1);
            reject(abortError());
            this.pump();
          }
        },
        { once: true },
      );
      this.pump();
    });
  }

  private exclusiveActive(): number {
    let p = -Infinity;
    for (const r of this.running.values()) if (r.req.priority >= this.opts.exclusiveAbove) p = Math.max(p, r.req.priority);
    for (const w of this.waiting) if (w.req.priority >= this.opts.exclusiveAbove) p = Math.max(p, w.req.priority);
    return p;
  }

  private canRun(w: Waiting): boolean {
    if (this.running.size >= this.opts.maxConcurrent) return false;
    const ex = this.exclusiveActive();
    if (w.req.priority < ex) return false;
    if (w.req.priority <= this.holdAtOrBelow) return false;
    return true;
  }

  private pump() {
    // Highest priority first, FIFO within a priority.
    this.waiting.sort((a, b) => b.req.priority - a.req.priority || a.seq - b.seq);
    let progressed = true;
    while (progressed) {
      progressed = false;
      const head = this.waiting[0];
      if (!head) break;
      if (this.canRun(head)) {
        this.waiting.shift();
        this.grant(head);
        progressed = true;
      }
    }
    // Ask preemptible holders to yield when they run below an exclusive (play)
    // search, or when a higher-priority request is still waiting for a slot.
    // Highest-priority request that could run if a slot were free.
    const head = this.waiting.find((w) => w.req.priority > this.holdAtOrBelow);
    const ex = this.exclusiveActive();
    if (head || ex > -Infinity || this.holdAtOrBelow > -Infinity) {
      for (const r of this.running.values()) {
        if (r.preemptAsked || !r.req.preemptible) continue;
        const blocks = (head !== undefined && r.req.priority < head.req.priority) || r.req.priority < ex || r.req.priority <= this.holdAtOrBelow;
        if (blocks) {
          r.preemptAsked = true;
          try {
            r.req.onPreempt();
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  private grant(w: Waiting) {
    const id = this.seq++;
    this.running.set(id, { req: w.req, id, preemptAsked: false });
    this.history.push(w.req.role);
    if (this.history.length > 200) this.history.splice(0, this.history.length - 200);
    let released = false;
    w.grant({
      release: () => {
        if (released) return;
        released = true;
        this.running.delete(id);
        this.pump();
      },
    });
  }
}

function abortError(): Error {
  const e = new Error('search aborted');
  e.name = 'AbortError';
  return e;
}
