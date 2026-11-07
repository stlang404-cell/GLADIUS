import { UciEngine, type UciTransport, type EngineEvent } from './uci';
import { BUILDS, ELITE_ELO, detectDevice, planEngines, type BuildId, type DeviceInfo, type EnginePlan, type EngineSlot } from './builds';
import { EngineScheduler, PRIORITY } from './scheduler';

/**
 * Browser engine pool: capability-aware tiers + resource scheduler.
 *
 * Roles: 'play' (opponent moves), 'elite' (personas ≥ ELITE_ELO, strongest
 * build on the device), 'analysis' (post-game, preemptible), 'spectate'
 * (AI-vs-AI broadcasts, preemptible). Every role is one Worker; all searches
 * pass through one EngineScheduler. See docs/ENGINE.md.
 */

/** Kept for backwards compatibility (the always-available build). */
export const ENGINE_FILE = 'engine/stockfish-19-lite-single.js';

export type EngineRole = 'play' | 'elite' | 'analysis' | 'spectate';

export type EngineSettings = {
  /** Allow the on-demand ~99 MB big-net download (desktop only). Default true. */
  allowBigNet?: boolean;
  maxThreads?: number;
  analysisDepth?: number;
};

const BIG_NET_FLAG = 'gladius.engine.bignet.v1';
const BIG_NET_CACHE = 'gladius-engine-bignet';

let device: DeviceInfo | null = null;
let settings: EngineSettings = {};
let plan: EnginePlan | null = null;
let scheduler: EngineScheduler | null = null;
const pool = new Map<EngineRole, UciEngine>();
const builtWith = new Map<EngineRole, BuildId>();
const log: string[] = [];

function note(s: string) {
  log.push(`${new Date().toISOString().slice(11, 19)} ${s}`);
  if (log.length > 50) log.shift();
}

function bigNetReadyFlag(): boolean {
  try {
    return localStorage.getItem(BIG_NET_FLAG) === '1';
  } catch {
    return false;
  }
}

function currentPlan(): EnginePlan {
  if (!device) device = detectDevice();
  if (!plan) plan = planEngines(device, { bigNetReady: bigNetReadyFlag() && !bigNetBroken, ...settings });
  return plan;
}

function getScheduler(): EngineScheduler {
  if (!scheduler) scheduler = new EngineScheduler({ maxConcurrent: currentPlan().maxConcurrent, exclusiveAbove: PRIORITY.play });
  return scheduler;
}

function engineUrl(file: string): string {
  return new URL('engine/' + file, document.baseURI).href;
}

/** Web Worker transport; worker errors are reported so the engine restarts. */
function workerTransport(build: BuildId): UciTransport {
  const w = new Worker(engineUrl(BUILDS[build].js));
  let listener: (l: string) => void = () => {};
  let onErr: (e: Error) => void = () => {};
  w.onmessage = (e: MessageEvent) => {
    if (typeof e.data === 'string') listener(e.data);
  };
  w.onerror = (e: ErrorEvent) => {
    e.preventDefault?.();
    onErr(new Error(e.message || 'worker error'));
  };
  w.onmessageerror = () => onErr(new Error('worker message error'));
  return {
    send: (c) => w.postMessage(c),
    setListener: (cb) => (listener = cb),
    setErrorListener: (cb) => (onErr = cb),
    terminate: () => w.terminate(),
  };
}

const ROLE_PRIORITY: Record<EngineRole, number> = { play: PRIORITY.play, elite: PRIORITY.play, spectate: PRIORITY.spectate, analysis: PRIORITY.analysis };

function slotFor(role: EngineRole): EngineSlot {
  return currentPlan()[role];
}

function create(role: EngineRole): UciEngine {
  const p = currentPlan();
  const slot = slotFor(role);
  builtWith.set(role, slot.build);
  const big = BUILDS[slot.build].net === 'big';
  const init: Record<string, number> = { Hash: slot.hashMB, Threads: slot.threads };
  const e = new UciEngine(() => workerTransport(slot.build), {
    role,
    gate: getScheduler(),
    priority: ROLE_PRIORITY[role],
    preemptible: role === 'analysis' || role === 'spectate',
    handshakeTimeoutMs: big ? 60000 : 20000,
    // Idle workers hold memory, not CPU: on mobile, background roles go after
    // `idleTerminateMs`, the opponent's worker after 3 min (cold start ≈0.2–0.5 s);
    // on desktop only the big-net worker (~0.5 GB) is released after 5 idle minutes.
    idleTerminateMs: p.idleTerminateMs ? (role === 'play' || role === 'elite' ? Math.max(p.idleTerminateMs, 180000) : p.idleTerminateMs) : role === 'elite' && big ? 300000 : 0,
    initOptions: init,
    // If an optional build fails to start (not deployed, download/memory, no
    // SharedArrayBuffer), fall back to the always-shipped lite single-threaded build.
    fallbackFactory: slot.build !== 'lite-single' ? () => workerTransport('lite-single') : undefined,
    onEvent: (ev: EngineEvent) => {
      note(`${role}: ${ev.type}${'reason' in ev ? ' — ' + ev.reason : ''}${'name' in ev ? ' ' + ev.name + ' ' + ev.ms + 'ms' : ''}`);
      if (ev.type === 'fallback') {
        if (BUILDS[builtWith.get(role) ?? 'lite-single'].net === 'big') bigNetBroken = true;
        builtWith.set(role, 'lite-single');
        e.setOption('Hash', Math.min(slot.hashMB, 64));
        e.setOption('Threads', 1);
      }
    },
  });
  return e;
}

/**
 * Engine for a role. Pass `{ elo }` for the opponent so personas ≥ ELITE_ELO
 * get the elite slot (the big net once downloaded, threads when isolated);
 * this also triggers the one-time background big-net download on desktop.
 * Omitting `elo` keeps the v0.1 behaviour.
 */
export function getEngine(role: EngineRole, opts: { elo?: number } = {}): UciEngine {
  let r = role;
  if (role === 'play' && (opts.elo ?? 0) >= ELITE_ELO) {
    r = 'elite';
    void prefetchBigNet();
  }
  let e = pool.get(r);
  if (!e) {
    e = create(r);
    pool.set(r, e);
  }
  return e;
}

export function disposeEngine(role: string) {
  pool.get(role as EngineRole)?.terminate();
  pool.delete(role as EngineRole);
}

/** Recommended fixed depth for post-game analysis on this device. */
export function recommendedAnalysisDepth(): number {
  return currentPlan().analysisDepth;
}

/** Apply user settings (e.g. from the Settings screen). Engines pick them up at their next start. */
export function configureEngines(s: EngineSettings) {
  settings = { ...settings, ...s };
  replan();
}

let bigNetBroken = false;
let bigNetPromise: Promise<boolean> | null = null;
export type BigNetState = { state: 'unavailable' | 'idle' | 'downloading' | 'ready' | 'failed'; loaded: number; total: number };
const bigNet: BigNetState = { state: 'idle', loaded: 0, total: 0 };

function bigBuild(): BuildId {
  return currentPlan().elite.build === 'full-mt' || (device?.isolated && (settings.maxThreads ?? 4) > 1) ? 'full-mt' : 'full-single';
}

/**
 * One-time background download of the big-net build (≈99 MB). Never blocks
 * play: until it completes the elite slot uses the lite build. The service
 * worker caches it with a CacheFirst runtime route (not precache), so it is
 * downloaded once and works offline afterwards. Returns true when ready.
 */
export function prefetchBigNet(): Promise<boolean> {
  if (bigNetPromise) return bigNetPromise;
  const p0 = currentPlan();
  if (!p0.bigNetAllowed || bigNetBroken) {
    bigNet.state = 'unavailable';
    return Promise.resolve(false);
  }
  bigNetPromise = (async () => {
    const build = bigBuild();
    const info = BUILDS[build];
    const url = engineUrl(info.wasm);
    try {
      if (bigNetReadyFlag() && (await isCached(url))) {
        bigNet.state = 'ready';
        return true;
      }
      // Probe: is the big build deployed on this host? (SPA fallbacks answer 200 with HTML.)
      const head = await fetch(url, { method: 'HEAD' });
      const type = head.headers.get('content-type') ?? '';
      const len = Number(head.headers.get('content-length') ?? 0);
      if (!head.ok || type.includes('html') || (len && len < info.wasmBytes * 0.9)) {
        bigNet.state = 'unavailable';
        note(`big net not deployed (${head.status} ${type})`);
        return false;
      }
      bigNet.state = 'downloading';
      bigNet.total = len || info.wasmBytes;
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        bigNet.loaded += value.length;
      }
      if (bigNet.loaded < info.wasmBytes * 0.9) throw new Error('truncated download');
      // Make sure it is in Cache Storage even without the service worker route.
      if ('caches' in globalThis && !(await isCached(url))) {
        const blob = new Blob(chunks as BlobPart[], { type: 'application/wasm' });
        const c = await caches.open(BIG_NET_CACHE);
        await c.put(url, new Response(blob, { headers: { 'content-type': 'application/wasm', 'content-length': String(blob.size) } }));
      }
      try {
        localStorage.setItem(BIG_NET_FLAG, '1');
      } catch {
        /* private mode */
      }
      bigNet.state = 'ready';
      note(`big net ready (${build}, ${Math.round(bigNet.loaded / 1048576)} MB)`);
      replan();
      return true;
    } catch (e) {
      bigNet.state = 'failed';
      note(`big net download failed: ${(e as Error).message}`);
      bigNetPromise = null; // allow a later retry
      return false;
    }
  })();
  return bigNetPromise;
}

async function isCached(url: string): Promise<boolean> {
  try {
    return 'caches' in globalThis && !!(await caches.match(url));
  } catch {
    return false;
  }
}

/** Recompute the plan; engines whose build changed switch at their next idle restart. */
function replan() {
  plan = null;
  const p = currentPlan();
  scheduler?.setMaxConcurrent(p.maxConcurrent);
  for (const [role, e] of pool) {
    const slot = p[role];
    if (builtWith.get(role) === slot.build) continue;
    builtWith.set(role, slot.build);
    e.setOption('Hash', slot.hashMB);
    e.setOption('Threads', slot.threads);
    const big = BUILDS[slot.build].net === 'big';
    e.setFactory(() => workerTransport(slot.build), {
      restartNow: true,
      fallbackFactory: slot.build !== 'lite-single' ? () => workerTransport('lite-single') : undefined,
      handshakeTimeoutMs: big ? 60000 : 20000,
    });
    note(`${role}: switching to ${slot.build}`);
  }
}

/** Diagnostics for a settings/debug panel. */
export function engineStatus() {
  const p = currentPlan();
  return {
    device,
    plan: p,
    bigNet: { ...bigNet },
    scheduler: scheduler?.stats ?? null,
    engines: [...pool.entries()].map(([role, e]) => ({ role, build: builtWith.get(role), name: e.name, alive: e.alive, restarts: e.restarts })),
    log: [...log],
  };
}
