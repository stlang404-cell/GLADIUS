/**
 * Deterministic animation timelines, independent of chess rules. The board
 * renderer turns a move description into tracks; the authoritative position
 * is never touched here. Timelines can be skipped at any moment (every track
 * jumps to k = 1 and runs its completion), which is how rapid input and
 * navigation are handled safely.
 */
export type AnimPreset = 'fast' | 'balanced' | 'majestic' | 'custom' | 'cinematic';

/** Total duration of a move, pre-highlight included (ms). */
export const PRESET_MS: Record<Exclude<AnimPreset, 'custom'>, number> = { fast: 200, balanced: 450, majestic: 950, cinematic: 950 };
export const CUSTOM_MS = { min: 150, max: 1200, default: 480 } as const;

/** The OS-level "reduce motion" preference (false outside a browser). */
export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function moveDuration(preset: AnimPreset, customMs?: number, reduceMotion = false): number {
  if (reduceMotion) return 0;
  if (preset === 'custom') return Math.max(CUSTOM_MS.min, Math.min(CUSTOM_MS.max, customMs ?? CUSTOM_MS.default));
  return PRESET_MS[preset] ?? PRESET_MS.majestic;
}

/**
 * Choreography of one move inside its total duration D:
 *   pre    — the moving piece and its origin glow (opponent / engine / spectated moves only)
 *   glide  — the piece travels (captures: approach → contact → push in)
 *   settle — a weighted landing; the destination highlight fades in at the start of it
 * The player's own moves skip the pre-highlight and feel immediate; a dropped
 * (dragged) piece only slides the last few pixels into its square.
 */
export type MovePlan = { pre: number; glide: number; settle: number; total: number };
export function planMove(D: number, kind: { remote: boolean; dragged?: boolean }): MovePlan {
  if (D <= 0) return { pre: 0, glide: 0, settle: 0, total: 0 };
  if (kind.dragged) {
    const glide = Math.round(Math.max(60, Math.min(140, D * 0.25)));
    return { pre: 0, glide, settle: 0, total: glide };
  }
  if (kind.remote) {
    const pre = Math.round(Math.max(60, Math.min(220, D * 0.2)));
    const settle = Math.round(Math.min(150, D * 0.14));
    return { pre, glide: D - pre - settle, settle, total: D };
  }
  const total = Math.round(D * 0.75);
  const settle = Math.round(Math.min(120, total * 0.14));
  return { pre: 0, glide: total - settle, settle, total };
}

export type Track = { start: number; dur: number; update: (k: number) => void; done?: () => void; started?: boolean; finished?: boolean };

export const ease = {
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outCubic: (k: number) => 1 - Math.pow(1 - k, 3),
  inCubic: (k: number) => k * k * k,
  inOutSine: (k: number) => -(Math.cos(Math.PI * k) - 1) / 2,
  outBack: (k: number) => {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  },
};

export class Timeline {
  private tracks: Track[] = [];
  private t0 = 0;
  constructor(private now: () => number = () => performance.now()) {}

  get active(): boolean {
    return this.tracks.some((t) => !t.finished);
  }
  get endsAt(): number {
    return this.tracks.reduce((m, t) => Math.max(m, t.start + t.dur), 0);
  }
  /** Milliseconds since begin(). */
  get elapsed(): number {
    return this.now() - this.t0;
  }

  /** Begin a new timeline. Any running one is completed first (no snapping mid-air). */
  begin() {
    this.skip();
    this.tracks = [];
    this.t0 = this.now();
  }

  add(start: number, dur: number, update: (k: number) => void, done?: () => void) {
    this.tracks.push({ start, dur: Math.max(0, dur), update, done });
  }

  /**
   * If nothing has been shown yet and the main thread was blocked since
   * begin() (e.g. a synchronous save right after a move), restart the clock so
   * the first painted frame is the first frame of the motion, not a jump.
   */
  rebase(maxLead = 16): number {
    if (this.tracks.some((t) => t.started)) return 0;
    const lead = this.now() - this.t0;
    if (lead <= maxLead) return 0;
    this.t0 = this.now() - maxLead;
    return lead - maxLead; // ms the motion was shifted
  }

  /** Advance to the current time. Returns true if anything changed. */
  tick(): boolean {
    if (!this.tracks.length) return false;
    const t = this.now() - this.t0;
    let changed = false;
    for (const tr of this.tracks) {
      if (tr.finished) continue;
      if (t < tr.start) continue;
      const k = tr.dur === 0 ? 1 : Math.min(1, (t - tr.start) / tr.dur);
      tr.started = true;
      tr.update(k);
      changed = true;
      if (k >= 1) {
        tr.finished = true;
        tr.done?.();
      }
    }
    if (this.tracks.every((x) => x.finished)) this.tracks = [];
    return changed;
  }

  /** Jump every track to its final state, in start order. */
  skip() {
    const pending = this.tracks.filter((t) => !t.finished).sort((a, b) => a.start - b.start);
    this.tracks = [];
    for (const tr of pending) {
      tr.update(1);
      tr.finished = true;
      tr.done?.();
    }
  }
}
