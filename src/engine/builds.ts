/**
 * Stockfish 19 builds (npm `stockfish@19.0.1`, nmrugg/stockfish.js) and the
 * capability-aware tier planner. Pure functions: device facts in, plan out,
 * so the rules are unit-tested (tests/engine.scheduler.test.ts) and documented
 * in docs/ENGINE.md.
 */

export type BuildId = 'lite-single' | 'lite-mt' | 'full-single' | 'full-mt';

export type BuildInfo = {
  id: BuildId;
  js: string;
  wasm: string;
  /** Size of the .wasm in bytes (js glue is ~30 KB). */
  wasmBytes: number;
  /** SHA-256 of the .wasm (npm stockfish@19.0.1, package/bin). */
  sha256: string;
  threads: boolean;
  net: 'small' | 'big';
  /** NNUE network embedded in the build (EvalFile default reported by `uci`). */
  netFile: string;
  /** `id name` reported by the build. */
  uciName: string;
  /** How the build reaches the device: precached with the app, or the optional engine pack. */
  delivery: 'app' | 'pack';
};

export const ENGINE_VERSION = 'Stockfish 19';
export const ENGINE_SOURCE = 'npm stockfish@19.0.1 (nmrugg/stockfish.js, GPL-3.0)';

export const BUILDS: Record<BuildId, BuildInfo> = {
  'lite-single': { id: 'lite-single', js: 'stockfish-19-lite-single.js', wasm: 'stockfish-19-lite-single.wasm', wasmBytes: 1845971, sha256: 'ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de', threads: false, net: 'small', netFile: 'nn-61e7af4bb97d.nnue', uciName: 'Stockfish 19 Lite WASM', delivery: 'app' },
  'lite-mt': { id: 'lite-mt', js: 'stockfish-19-lite.js', wasm: 'stockfish-19-lite.wasm', wasmBytes: 1697617, sha256: 'ddf06cdaf0b8e35c11b40530e44db96c2a99c9029c8d621dd9fca97e4872770c', threads: true, net: 'small', netFile: 'nn-61e7af4bb97d.nnue', uciName: 'Stockfish 19 Lite WASM Multithreaded', delivery: 'app' },
  'full-single': { id: 'full-single', js: 'stockfish-19-single.js', wasm: 'stockfish-19-single.wasm', wasmBytes: 99169054, sha256: '991bede2f253ebb08ff01fcc48270f4b9c8e66b12d5bd5f8d6f52eb3e3b3a740', threads: false, net: 'big', netFile: 'nn-1a298aa575a0.nnue', uciName: 'Stockfish 19 WASM', delivery: 'pack' },
  'full-mt': { id: 'full-mt', js: 'stockfish-19.js', wasm: 'stockfish-19.wasm', wasmBytes: 99076105, sha256: 'a599d78d72e0722d8895be84aca8b492d12e8bba3cdfcbcbc4a64017888c6667', threads: true, net: 'big', netFile: 'nn-1a298aa575a0.nnue', uciName: 'Stockfish 19 WASM Multithreaded', delivery: 'pack' },
};

/** User-facing build name. Only big-net builds may be called "full strength". */
export function buildLabel(id: BuildId, threads = 1): string {
  const b = BUILDS[id];
  const t = threads > 1 ? `, ${threads} threads` : ', 1 thread';
  return b.net === 'big' ? `${ENGINE_VERSION} full net${t}` : `${ENGINE_VERSION} Lite (small net${t})`;
}

export type DeviceInfo = {
  cores: number;
  /** navigator.deviceMemory (GB, Chromium only; capped at 8 by the browser). */
  memoryGB: number | null;
  mobile: boolean;
  ios: boolean;
  /** crossOriginIsolated && SharedArrayBuffer — required by threaded builds. */
  isolated: boolean;
};

type NavLike = { hardwareConcurrency?: number; deviceMemory?: number; userAgent?: string; maxTouchPoints?: number; platform?: string };

export function detectDevice(nav: NavLike | undefined = globalThis.navigator as NavLike | undefined, g: { crossOriginIsolated?: boolean; SharedArrayBuffer?: unknown } = globalThis as never): DeviceInfo {
  const ua = nav?.userAgent ?? '';
  // iPadOS 13+ reports a desktop Mac UA; touch points give it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1);
  const android = /Android/.test(ua);
  const mobile = ios || android || /Mobile|Silk|Kindle/.test(ua);
  return {
    cores: Math.max(1, nav?.hardwareConcurrency ?? 2),
    memoryGB: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null,
    mobile,
    ios,
    isolated: !!g.crossOriginIsolated && typeof g.SharedArrayBuffer === 'function',
  };
}

export type EngineSlot = { build: BuildId; threads: number; hashMB: number };

export type EnginePlan = {
  deviceClass: 'mobile' | 'low-desktop' | 'desktop';
  play: EngineSlot;
  /** Used for personas ≥ ELITE_ELO and for the top tier. */
  elite: EngineSlot;
  analysis: EngineSlot;
  spectate: EngineSlot;
  /** Upper bound of simultaneous searches across all engines. */
  maxConcurrent: number;
  /** Upper bound of live engine workers (idle ones are suspended, least recently used first). */
  maxWorkers: number;
  /** Terminate idle workers after this long (0 = keep warm). */
  idleTerminateMs: number;
  /** Recommended fixed analysis depth (MultiPV 2). */
  analysisDepth: number;
  /** May the big-net engine pack be installed/used on this device (explicit opt-in on phones)? */
  bigNetAllowed: boolean;
  /** May it be downloaded automatically in the background (desktop only, never phones)? */
  bigNetAuto: boolean;
  /** Persona compute budgets (internal; players are untimed). */
  budget: { eliteMs: [number, number]; topMs: number };
};

export type PlanInputs = {
  /** The big-net build is installed (engine pack) or bundled, and not known to crash here. */
  bigNetReady: boolean;
  /**
   * User setting. undefined = device default (desktop: allowed + background download;
   * phones: off), true = explicit opt-in (phones: allowed, never automatic), false = off.
   */
  allowBigNet?: boolean;
  maxThreads?: number;
  analysisDepth?: number;
};

/** Persona Elo from which the elite engine slot is used. */
export const ELITE_ELO = 2700;

/**
 * Transposition-table size (MB) by device and role. Rules (docs/ENGINE.md v0.3):
 *  - phones: 16 MB everywhere (8 for spectate); iOS never more than 16 MB per
 *    worker (Safari kills pages that grow wasm memory aggressively), Android
 *    elite 32 MB with ≥ 4 GB RAM and the small net;
 *  - low-memory desktops (≤ 4 GB): 16 MB, elite 32 MB;
 *  - desktops: play 64, analysis 64 (big net) / 32, spectate 16, elite 128,
 *    or 256 with ≥ 8 GB and ≥ 8 cores. navigator.deviceMemory is capped at 8
 *    by Chromium and missing elsewhere (unknown = 8 on desktop, 4 on phones).
 * A 2 s search at ~1–3 Mnps visits 2–6 M nodes; 128 MB holds ~8 M entries.
 */
export function hashFor(d: DeviceInfo, role: 'play' | 'elite' | 'analysis' | 'spectate', big: boolean): number {
  const mobile = d.mobile || d.cores <= 2;
  const mem = d.memoryGB ?? (mobile ? 4 : 8);
  if (role === 'spectate') return mobile ? 8 : 16;
  if (mobile) {
    if (role !== 'elite' || d.ios || big) return 16;
    return mem >= 4 ? 32 : 16;
  }
  if (mem <= 4) return role === 'elite' ? 32 : 16;
  if (role === 'play') return 64;
  if (role === 'analysis') return big ? 64 : 32;
  return mem >= 8 && d.cores >= 8 ? 256 : 128;
}

/**
 * Tier rules (documented in docs/ENGINE.md):
 *  - mobile (iOS/Android UA, or ≤ 2 cores) and ≤ 4 GB desktops: lite
 *    single-threaded, one search at a time, at most 2 live workers, idle
 *    workers terminated (45 s phones / 2 min), analysis depth 11. The big net
 *    is never downloaded automatically there; with an explicit opt-in (engine
 *    pack installed by the user) the elite slot uses full-single, Hash 16.
 *  - desktop: play = lite (threaded if cross-origin isolated); elite = big net
 *    once installed/bundled (else lite), threaded if isolated; analysis = big
 *    net if installed and ≥ 8 GB, else lite; two concurrent searches (three
 *    with ≥ 8 cores), up to 4 workers; analysis depth 13 (14 with ≥ 8 cores).
 *  - threads are only used when isolated (SharedArrayBuffer) and never exceed
 *    cores−1 (one core is left for the UI/render thread), capped at 4.
 */
export function planEngines(d: DeviceInfo, inp: PlanInputs): EnginePlan {
  const lowMem = d.memoryGB !== null && d.memoryGB <= 4;
  const mobile = d.mobile || d.cores <= 2;
  const userMaxT = inp.maxThreads ?? 4;
  const threads = d.isolated ? Math.max(1, Math.min(4, d.cores - 1, userMaxT)) : 1;
  const lite: BuildId = d.isolated && threads > 1 ? 'lite-mt' : 'lite-single';
  const full: BuildId = d.isolated && threads > 1 ? 'full-mt' : 'full-single';
  const slot = (build: BuildId, role: 'play' | 'elite' | 'analysis' | 'spectate', t = 1): EngineSlot => ({ build, threads: BUILDS[build].threads ? t : 1, hashMB: hashFor(d, role, BUILDS[build].net === 'big') });
  if (mobile || lowMem) {
    // Opt-in only, and not on devices that report < 4 GB.
    const bigNetAllowed = inp.allowBigNet === true && !(d.memoryGB !== null && d.memoryGB < 4);
    const big = bigNetAllowed && inp.bigNetReady;
    return {
      deviceClass: mobile ? 'mobile' : 'low-desktop',
      play: slot('lite-single', 'play'),
      elite: big ? slot('full-single', 'elite') : slot('lite-single', 'elite'),
      analysis: slot('lite-single', 'analysis'),
      spectate: slot('lite-single', 'spectate'),
      maxConcurrent: 1,
      maxWorkers: 2,
      idleTerminateMs: mobile ? 45000 : 120000,
      analysisDepth: inp.analysisDepth ?? 11,
      bigNetAllowed,
      bigNetAuto: false,
      // Phones are 2–5× slower than a desktop: more time for the same depth.
      budget: { eliteMs: [1200, 1800], topMs: 2500 },
    };
  }
  const bigNetAllowed = inp.allowBigNet !== false && !d.ios;
  const big = bigNetAllowed && inp.bigNetReady;
  const bigMem = d.memoryGB === null || d.memoryGB >= 8;
  return {
    deviceClass: 'desktop',
    play: slot(lite, 'play', threads),
    elite: big ? slot(full, 'elite', threads) : slot(lite, 'elite', threads),
    analysis: big && bigMem ? slot('full-single', 'analysis') : slot('lite-single', 'analysis'),
    spectate: slot('lite-single', 'spectate'),
    maxConcurrent: d.cores >= 8 ? 3 : 2,
    maxWorkers: 4,
    idleTerminateMs: 0,
    analysisDepth: inp.analysisDepth ?? (d.cores >= 8 ? 14 : 13),
    bigNetAllowed,
    bigNetAuto: bigNetAllowed && inp.allowBigNet !== false,
    budget: { eliteMs: [900, 1500], topMs: 2000 },
  };
}
