/**
 * Deterministic animation timelines, independent of chess rules. The board
 * renderer turns a move description into tracks; the authoritative position
 * is never touched here. Timelines can be skipped at any moment (every track
 * jumps to k = 1 and runs its completion), which is how rapid input and
 * navigation are handled safely.
 */
export type AnimPreset = 'fast' | 'balanced' | 'majestic' | 'custom' | 'cinematic';

export const PRESET_MS: Record<Exclude<AnimPreset, 'custom'>, number> = { fast: 200, balanced: 480, majestic: 900, cinematic: 900 };

export function moveDuration(preset: AnimPreset, customMs?: number, reduceMotion = false): number {
  if (reduceMotion) return 0;
  if (preset === 'custom') return Math.max(150, Math.min(1200, customMs ?? 480));
  return PRESET_MS[preset];
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

  /** Begin a new timeline. Any running one is completed first (no snapping mid-air). */
  begin() {
    this.skip();
    this.tracks = [];
    this.t0 = this.now();
  }

  add(start: number, dur: number, update: (k: number) => void, done?: () => void) {
    this.tracks.push({ start, dur: Math.max(0, dur), update, done });
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
    for (const tr of pending) {
      tr.update(1);
      tr.finished = true;
      tr.done?.();
    }
    this.tracks = [];
  }
}
