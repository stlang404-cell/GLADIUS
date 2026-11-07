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
  threads: boolean;
  net: 'small' | 'big';
};

export const BUILDS: Record<BuildId, BuildInfo> = {
  'lite-single': { id: 'lite-single', js: 'stockfish-19-lite-single.js', wasm: 'stockfish-19-lite-single.wasm', wasmBytes: 1845971, threads: false, net: 'small' },
  'lite-mt': { id: 'lite-mt', js: 'stockfish-19-lite.js', wasm: 'stockfish-19-lite.wasm', wasmBytes: 1697617, threads: true, net: 'small' },
  'full-single': { id: 'full-single', js: 'stockfish-19-single.js', wasm: 'stockfish-19-single.wasm', wasmBytes: 99169054, threads: false, net: 'big' },
  'full-mt': { id: 'full-mt', js: 'stockfish-19.js', wasm: 'stockfish-19.wasm', wasmBytes: 99076105, threads: true, net: 'big' },
};

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
  /** Terminate idle workers after this long (0 = keep warm). */
  idleTerminateMs: number;
  /** Recommended fixed analysis depth (MultiPV 2). */
  analysisDepth: number;
  /** May the big-net build be downloaded on demand on this device? */
  bigNetAllowed: boolean;
};

export type PlanInputs = {
  /** The big-net build is fully downloaded/cached and passed a start test. */
  bigNetReady: boolean;
  /** User settings. */
  allowBigNet?: boolean;
  maxThreads?: number;
  analysisDepth?: number;
};

/** Persona Elo from which the elite engine slot is used. */
export const ELITE_ELO = 2700;

/**
 * Tier rules (documented in docs/ENGINE.md):
 *  - mobile (iOS/Android UA) or ≤4 GB RAM or ≤2 cores: lite single-threaded
 *    everywhere, 16 MB hash, one search at a time, idle workers terminated
 *    after 45 s (battery/memory), analysis depth 11. iOS never downloads the
 *    big net (Safari's wasm memory limits make a 99 MB module risky).
 *  - desktop: play = lite (threaded if cross-origin isolated); elite = big net
 *    once downloaded (else lite), threaded if isolated; analysis = big net if
 *    downloaded and ≥8 GB, else lite; two concurrent searches (three with ≥8
 *    cores); analysis depth 13 (14 with ≥8 cores).
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
  if (mobile || lowMem) {
    return {
      deviceClass: mobile ? 'mobile' : 'low-desktop',
      play: { build: 'lite-single', threads: 1, hashMB: 16 },
      elite: { build: 'lite-single', threads: 1, hashMB: lowMem && !mobile ? 32 : 16 },
      analysis: { build: 'lite-single', threads: 1, hashMB: 16 },
      spectate: { build: 'lite-single', threads: 1, hashMB: 8 },
      maxConcurrent: 1,
      idleTerminateMs: mobile ? 45000 : 120000,
      analysisDepth: inp.analysisDepth ?? 11,
      bigNetAllowed: false,
    };
  }
  const bigNetAllowed = (inp.allowBigNet ?? true) && !d.ios;
  const big = bigNetAllowed && inp.bigNetReady;
  const bigMem = d.memoryGB === null || d.memoryGB >= 8;
  return {
    deviceClass: 'desktop',
    play: { build: lite, threads: lite === 'lite-mt' ? threads : 1, hashMB: 64 },
    elite: big ? { build: full, threads: full === 'full-mt' ? threads : 1, hashMB: 128 } : { build: lite, threads: lite === 'lite-mt' ? threads : 1, hashMB: 128 },
    analysis: big && bigMem ? { build: 'full-single', threads: 1, hashMB: 64 } : { build: 'lite-single', threads: 1, hashMB: 32 },
    spectate: { build: 'lite-single', threads: 1, hashMB: 16 },
    maxConcurrent: d.cores >= 8 ? 3 : 2,
    idleTerminateMs: 0,
    analysisDepth: inp.analysisDepth ?? (d.cores >= 8 ? 14 : 13),
    bigNetAllowed,
  };
}
