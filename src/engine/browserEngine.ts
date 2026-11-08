import { UciEngine, type UciTransport, type EngineEvent } from './uci';
import { BUILDS, ELITE_ELO, ENGINE_SOURCE, buildLabel, detectDevice, planEngines, type BuildId, type DeviceInfo, type EnginePlan, type EngineSlot } from './builds';
import { EngineScheduler, PRIORITY } from './scheduler';
import { PACK_CACHE, installPack, installedFiles, probeBundled, removeInstalled, verifyInstalled, type CacheLike } from './enginePack';

/**
 * Browser engine pool: capability-aware tiers + resource scheduler + engine pack.
 *
 * Roles: 'play' (opponent moves), 'elite' (personas ≥ ELITE_ELO, strongest
 * build on the device), 'analysis' (post-game, preemptible), 'spectate'
 * (AI-vs-AI broadcasts, preemptible). Every role is at most one Worker; all
 * searches pass through one EngineScheduler (≤ maxConcurrent searches), and at
 * most `maxWorkers` workers are alive (idle ones are suspended, LRU first).
 * See docs/ENGINE.md (v0.3).
 */

/** Kept for backwards compatibility (the always-available build). */
export const ENGINE_FILE = 'engine/stockfish-19-lite-single.js';

export type EngineRole = 'play' | 'elite' | 'analysis' | 'spectate';

export type EngineSettings = {
  /**
   * Full-strength engine pack. undefined = device default (desktop: allowed and
   * downloaded in the background the first time an elite opponent is met;
   * phones: off), true = explicit opt-in (persisted), false = off (persisted).
   */
  allowBigNet?: boolean;
  maxThreads?: number;
  analysisDepth?: number;
};

const ALLOW_KEY = 'gladius.engine.allowBigNet.v1';
/** Set while a big-net worker boots; still set at the next page load = the page was killed (OOM). */
const BOOT_GUARD = 'gladius.engine.bigboot.v1';
const CRASHED_KEY = 'gladius.engine.bignet.crashed.v1';

let device: DeviceInfo | null = null;
let settings: EngineSettings = {};
let plan: EnginePlan | null = null;
let scheduler: EngineScheduler | null = null;
const pool = new Map<EngineRole, UciEngine>();
const builtWith = new Map<EngineRole, BuildId>();
const lastUsed = new Map<EngineRole, number>();
const log: string[] = [];
const listeners = new Set<() => void>();

function note(s: string) {
  log.push(`${new Date().toISOString().slice(11, 19)} ${s}`);
  if (log.length > 50) log.shift();
}
function emit() {
  for (const f of listeners) {
    try {
      f();
    } catch {
      /* ignore */
    }
  }
}
/** Subscribe to engine status changes (pack download progress, build switches). */
export function onEngineStatus(f: () => void): () => void {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

function ls(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Engine pack state
// ---------------------------------------------------------------------------

export type PackStatus = {
  /**
   * absent      – nothing installed, host has no bundled file (install possible if allowed)
   * downloading – install in progress (loaded/total bytes)
   * installed   – in Cache Storage, SHA-256 verified at install
   * bundled     – served by the host (Windows package)
   * failed      – last install failed (error)
   * unavailable – not allowed on this device / by settings, or crashed here before
   */
  state: 'checking' | 'absent' | 'downloading' | 'installed' | 'bundled' | 'failed' | 'unavailable';
  loaded: number;
  total: number;
  phase?: string;
  error?: string;
  files: string[];
  /** Last full re-verification (Verify button): ok / bad file names. */
  verified?: { ok: string[]; bad: string[]; at: string };
};

const pack: PackStatus = { state: 'checking', loaded: 0, total: 0, files: [] };
const blobUrls = new Map<string, string>();
let bigNetBroken = false;
let packInit: Promise<void> | null = null;
let installAbort: AbortController | null = null;

function baseUrl(): string {
  return document.baseURI;
}
async function openCache(): Promise<CacheLike | null> {
  try {
    return 'caches' in globalThis ? await caches.open(PACK_CACHE) : null;
  } catch {
    return null;
  }
}

function bigNetReady(): boolean {
  return !bigNetBroken && (pack.state === 'installed' || pack.state === 'bundled');
}

function hasWasm(build: BuildId): boolean {
  if (BUILDS[build].delivery === 'app') return true;
  if (pack.state === 'bundled') return true;
  return blobUrls.has(BUILDS[build].wasm);
}

/** Find what is installed/bundled. Runs once, lazily; replans when done. */
function initPack(): Promise<void> {
  if (packInit) return packInit;
  packInit = (async () => {
    const g = ls();
    if (g?.getItem(BOOT_GUARD)) {
      // The page died while a big-net worker was starting/searching (iOS/Android OOM kill).
      g.removeItem(BOOT_GUARD);
      g.setItem(CRASHED_KEY, String(Date.now()));
      note('big net: previous page was killed while it ran — disabled on this device until re-enabled');
    }
    if (g?.getItem(CRASHED_KEY)) bigNetBroken = true;
    try {
      const cache = await openCache();
      const inst = cache ? await installedFiles(baseUrl(), cache) : { manifest: null, files: [] as string[] };
      if (cache && inst.files.length) {
        for (const name of inst.files) {
          const r = await cache.match(new URL('engine/' + name, baseUrl()).href);
          if (r) blobUrls.set(name, URL.createObjectURL(await r.blob()));
        }
        pack.files = inst.files;
        pack.state = 'installed';
      } else if (await probeBundled(baseUrl(), BUILDS['full-single'].wasm, BUILDS['full-single'].wasmBytes)) {
        pack.state = 'bundled';
        pack.files = [BUILDS['full-single'].wasm];
        if (await probeBundled(baseUrl(), BUILDS['full-mt'].wasm, BUILDS['full-mt'].wasmBytes)) pack.files.push(BUILDS['full-mt'].wasm);
      } else pack.state = currentPlan().bigNetAllowed ? 'absent' : 'unavailable';
    } catch (e) {
      pack.state = 'absent';
      note(`engine pack check failed: ${(e as Error).message}`);
    }
    note(`engine pack: ${pack.state}${pack.files.length ? ' (' + pack.files.join(', ') + ')' : ''}`);
    replan();
    emit();
  })();
  return packInit;
}

/** Builds the device can use from the pack: the threaded one only when cross-origin isolated. */
function packNamesForDevice(): string[] {
  const d = device ?? detectDevice();
  const names = [BUILDS['full-single'].wasm];
  if (d.isolated && d.cores > 2) names.push(BUILDS['full-mt'].wasm);
  return names;
}

/**
 * Install the full-strength engine pack (≈ 79 MB download, ≈ 99 MB stored per build)
 * into Cache Storage, verified with SHA-256. Never automatic on phones; on desktop
 * started in the background when an elite opponent is first met (unless metered
 * or switched off). `force` = user pressed the button (also re-enables after a crash).
 */
export function installEnginePack(opts: { force?: boolean } = {}): Promise<boolean> {
  return (async () => {
    if (opts.force) {
      ls()?.removeItem(CRASHED_KEY);
      bigNetBroken = false;
      if (!currentPlan().bigNetAllowed) configureEngines({ allowBigNet: true });
    }
    await initPack();
    if (pack.state === 'installed' || pack.state === 'bundled') {
      const missing = pack.state === 'installed' ? packNamesForDevice().filter((n) => !pack.files.includes(n)) : [];
      if (!missing.length) return bigNetReady();
    }
    if (pack.state === 'downloading') return false;
    const p = currentPlan();
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const metered = !!conn && (conn.saveData === true || /(^|-)2g|3g/.test(conn.effectiveType ?? ''));
    if (!p.bigNetAllowed || bigNetBroken || (!opts.force && (!p.bigNetAuto || metered))) return false;
    const cache = await openCache();
    if (!cache || typeof DecompressionStream === 'undefined' || !crypto?.subtle) {
      pack.state = 'failed';
      pack.error = 'This browser cannot store the engine pack (needs Cache Storage, DecompressionStream, WebCrypto).';
      emit();
      return false;
    }
    const names = packNamesForDevice();
    try {
      const est = await navigator.storage?.estimate?.();
      const need = names.length * 100e6 + 30e6;
      if (est?.quota && est.quota - (est.usage ?? 0) < need) throw new Error(`not enough browser storage (${Math.round((est.quota - (est.usage ?? 0)) / 1e6)} MB free, ${Math.round(need / 1e6)} MB needed)`);
      void navigator.storage?.persist?.().catch(() => false);
    } catch (e) {
      if ((e as Error).message.startsWith('not enough')) {
        pack.state = 'failed';
        pack.error = (e as Error).message;
        emit();
        return false;
      }
    }
    installAbort = new AbortController();
    pack.state = 'downloading';
    pack.loaded = 0;
    pack.error = undefined;
    emit();
    try {
      const done = await installPack({
        baseUrl: baseUrl(),
        names,
        cache,
        signal: installAbort.signal,
        onProgress: (pr) => {
          pack.loaded = pr.loaded;
          pack.total = pr.total;
          pack.phase = pr.phase;
          emit();
        },
      });
      for (const name of done) {
        const r = await cache.match(new URL('engine/' + name, baseUrl()).href);
        if (r) blobUrls.set(name, URL.createObjectURL(await r.blob()));
      }
      pack.files = [...new Set([...pack.files, ...done])];
      pack.state = 'installed';
      note(`engine pack installed: ${done.join(', ')}`);
      replan();
      return true;
    } catch (e) {
      pack.state = 'failed';
      pack.error = installAbort?.signal.aborted ? 'cancelled' : (e as Error).message;
      note(`engine pack install failed: ${pack.error}`);
      return false;
    } finally {
      installAbort = null;
      emit();
    }
  })();
}

/** Back-compat name (v0.2). */
export const prefetchBigNet = installEnginePack;

export function cancelEnginePack() {
  installAbort?.abort();
}

/** Re-hash the installed pack against its manifest (SHA-256). */
export async function verifyEnginePack(): Promise<PackStatus['verified']> {
  await initPack();
  const cache = await openCache();
  if (!cache) return undefined;
  const r = await verifyInstalled(baseUrl(), cache);
  pack.verified = { ...r, at: new Date().toISOString() };
  if (r.bad.length) {
    await removeInstalled(baseUrl(), cache, r.bad);
    for (const n of r.bad) {
      const u = blobUrls.get(n);
      if (u) URL.revokeObjectURL(u);
      blobUrls.delete(n);
    }
    pack.files = pack.files.filter((n) => !r.bad.includes(n));
    pack.state = pack.files.length ? 'installed' : 'absent';
    replan();
  }
  emit();
  return pack.verified;
}

/** Remove the installed pack (frees ~100–200 MB of browser storage). */
export async function removeEnginePack() {
  const cache = await openCache();
  if (cache) await removeInstalled(baseUrl(), cache, pack.files);
  for (const u of blobUrls.values()) URL.revokeObjectURL(u);
  blobUrls.clear();
  pack.files = [];
  pack.state = 'absent';
  replan();
  emit();
}

// ---------------------------------------------------------------------------
// Plan, scheduler, workers
// ---------------------------------------------------------------------------

function storedAllow(): boolean | undefined {
  const v = ls()?.getItem(ALLOW_KEY);
  return v === '1' ? true : v === '0' ? false : undefined;
}

function currentPlan(): EnginePlan {
  if (!device) device = detectDevice();
  if (!plan) {
    const p = planEngines(device, { allowBigNet: storedAllow(), ...settings, bigNetReady: bigNetReady() });
    // A big-net slot is only planned when that exact build's wasm is reachable.
    for (const r of ['elite', 'analysis'] as const) {
      if (!hasWasm(p[r].build)) {
        const alt: BuildId = BUILDS[p[r].build].threads && hasWasm('full-single') ? 'full-single' : p.play.build;
        p[r] = { ...p[r], build: alt, threads: BUILDS[alt].threads ? p[r].threads : 1 };
      }
    }
    plan = p;
  }
  return plan;
}

function getScheduler(): EngineScheduler {
  if (!scheduler) scheduler = new EngineScheduler({ maxConcurrent: currentPlan().maxConcurrent, exclusiveAbove: PRIORITY.play });
  return scheduler;
}

function engineUrl(file: string): string {
  return new URL('engine/' + file, document.baseURI).href;
}

/** Keep at most plan.maxWorkers workers alive: suspend idle ones, least recently used first. */
function makeRoom(forRole: EngineRole) {
  const max = currentPlan().maxWorkers;
  const alive = [...pool.entries()].filter(([r, e]) => r !== forRole && e.alive);
  if (alive.length < max) return;
  alive.sort((a, b) => (lastUsed.get(a[0]) ?? 0) - (lastUsed.get(b[0]) ?? 0));
  let n = alive.length + 1;
  for (const [r, e] of alive) {
    if (n <= max) break;
    if (e.suspend()) {
      n--;
      note(`${r}: worker suspended (limit ${max} workers)`);
    }
  }
}

/** Web Worker transport; worker errors are reported so the engine restarts. */
function workerTransport(build: BuildId, role: EngineRole): UciTransport {
  makeRoom(role);
  const info = BUILDS[build];
  let url = engineUrl(info.js);
  if (info.delivery === 'pack' && pack.state !== 'bundled') {
    const blob = blobUrls.get(info.wasm);
    if (!blob) throw new Error(`${info.wasm} is not installed`);
    // The glue reads the wasm location from the hash (nmrugg/stockfish.js).
    url += '#' + encodeURIComponent(blob);
  }
  if (info.net === 'big') ls()?.setItem(BOOT_GUARD, String(Date.now()));
  const w = new Worker(url);
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

function idleMsFor(role: EngineRole, build: BuildId): number {
  const p = currentPlan();
  const big = BUILDS[build].net === 'big';
  // Idle workers hold memory, not CPU: on mobile, background roles go after
  // `idleTerminateMs`, the opponent's worker after 3 min (cold start ≈0.2–0.5 s;
  // big net ≈1–2 s); on desktop only the big-net workers (~0.5 GB) are released after 5 idle minutes.
  if (p.idleTerminateMs) return role === 'play' || role === 'elite' ? Math.max(p.idleTerminateMs, 180000) : p.idleTerminateMs;
  return big ? 300000 : 0;
}

let guardTimer: ReturnType<typeof setTimeout> | null = null;

function create(role: EngineRole): UciEngine {
  const p = currentPlan();
  const slot = slotFor(role);
  builtWith.set(role, slot.build);
  const big = BUILDS[slot.build].net === 'big';
  const init: Record<string, number> = { Hash: slot.hashMB, Threads: slot.threads };
  const e = new UciEngine(() => workerTransport(slot.build, role), {
    role,
    gate: getScheduler(),
    priority: ROLE_PRIORITY[role],
    preemptible: role === 'analysis' || role === 'spectate',
    handshakeTimeoutMs: big ? 60000 : 20000,
    idleTerminateMs: idleMsFor(role, slot.build),
    initOptions: init,
    budget: p.budget,
    lazyStart: true,
    // If an optional build fails to start (not installed, memory, no
    // SharedArrayBuffer), fall back to the always-shipped lite single-threaded build.
    fallbackFactory: slot.build !== 'lite-single' ? () => workerTransport('lite-single', role) : undefined,
    onEvent: (ev: EngineEvent) => onEngineEvent(role, e, ev),
  });
  return e;
}

function onEngineEvent(role: EngineRole, e: UciEngine, ev: EngineEvent) {
  note(`${role}: ${ev.type}${'reason' in ev ? ' — ' + ev.reason : ''}${'name' in ev ? ' ' + ev.name + ' ' + ev.ms + 'ms' : ''}`);
  const build = builtWith.get(role) ?? 'lite-single';
  if (ev.type === 'started' && BUILDS[build].net === 'big' && !e.onFallback) {
    // Clear the OOM guard once the big net has run for a while.
    if (guardTimer) clearTimeout(guardTimer);
    guardTimer = setTimeout(() => ls()?.removeItem(BOOT_GUARD), 30000);
  }
  if (ev.type === 'fallback') {
    if (BUILDS[build].net === 'big') {
      bigNetBroken = true;
      ls()?.removeItem(BOOT_GUARD);
    }
    builtWith.set(role, 'lite-single');
    const slot = slotFor(role);
    void e.setOption('Hash', Math.min(slot.hashMB, 64));
    void e.setOption('Threads', 1);
  }
  emit();
}

/**
 * Engine for a role. Pass `{ elo }` for the opponent so personas ≥ ELITE_ELO
 * get the elite slot (the big net once installed, threads when isolated);
 * on desktop this also starts the one-time background engine-pack install.
 */
export function getEngine(role: EngineRole, opts: { elo?: number } = {}): UciEngine {
  void initPack();
  let r = role;
  if (role === 'play' && (opts.elo ?? 0) >= ELITE_ELO) {
    r = 'elite';
    void installEnginePack();
  }
  lastUsed.set(r, Date.now());
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
  builtWith.delete(role as EngineRole);
}

/** Stop every running search of these roles (navigation away). Searches resolve with their best move so far. */
export function stopEngines(roles: EngineRole[] = ['play', 'elite', 'analysis', 'spectate']) {
  for (const r of roles) pool.get(r)?.stop();
}

/** Free the workers of idle engines (they restart on demand). Returns how many were suspended. */
export function suspendIdleEngines(roles: EngineRole[] = ['play', 'elite', 'analysis', 'spectate']): number {
  let n = 0;
  for (const r of roles) if (pool.get(r)?.suspend()) n++;
  if (n) emit();
  return n;
}

let gameInProgress = false;
/**
 * The player's game is on screen (true) or over/left (false). While true,
 * post-game analysis of earlier games is held in the scheduler (queued, a
 * running analysis search is stopped and re-run later), so it never competes
 * with the opponent's engine; it resumes as soon as the game ends.
 */
export function setGameInProgress(active: boolean) {
  if (active === gameInProgress) return;
  gameInProgress = active;
  if (active) getScheduler().hold(PRIORITY.analysis);
  else scheduler?.release();
  note(active ? 'game in progress: analysis held' : 'game over: analysis resumed');
  emit();
}

/** Recommended fixed depth for post-game analysis on this device. */
export function recommendedAnalysisDepth(): number {
  return currentPlan().analysisDepth;
}

/** Apply user settings (e.g. from the Settings screen). Engines pick them up at their next idle moment. */
export function configureEngines(s: EngineSettings) {
  settings = { ...settings, ...s };
  if (s.allowBigNet !== undefined) ls()?.setItem(ALLOW_KEY, s.allowBigNet ? '1' : '0');
  replan();
  emit();
}

/** Recompute the plan; engines whose build changed switch at their next idle restart. */
function replan() {
  plan = null;
  const p = currentPlan();
  scheduler?.setMaxConcurrent(p.maxConcurrent);
  for (const [role, e] of pool) {
    const slot = p[role];
    if (builtWith.get(role) === slot.build && !e.onFallback) continue;
    if (e.onFallback && BUILDS[slot.build].net === 'big' && bigNetBroken) continue;
    builtWith.set(role, slot.build);
    void e.setOption('Hash', slot.hashMB);
    void e.setOption('Threads', slot.threads);
    const big = BUILDS[slot.build].net === 'big';
    e.setFactory(() => workerTransport(slot.build, role), {
      restartNow: true,
      fallbackFactory: slot.build !== 'lite-single' ? () => workerTransport('lite-single', role) : undefined,
      handshakeTimeoutMs: big ? 60000 : 20000,
    });
    note(`${role}: switching to ${slot.build}`);
  }
}

// Page lifecycle: free workers when the page is hidden for a while (phones) and
// on pagehide; a normal close also clears the OOM guard.
if (typeof document !== 'undefined' && typeof addEventListener === 'function') {
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  addEventListener('pagehide', () => {
    ls()?.removeItem(BOOT_GUARD);
    for (const e of pool.values()) e.suspend();
  });
  document.addEventListener('visibilitychange', () => {
    if (hiddenTimer) clearTimeout(hiddenTimer);
    hiddenTimer = null;
    if (document.visibilityState === 'hidden' && plan && plan.deviceClass !== 'desktop') {
      hiddenTimer = setTimeout(() => {
        stopEngines(['analysis', 'spectate']);
        suspendIdleEngines();
      }, 30000);
    }
  });
}

// ---------------------------------------------------------------------------
// Identification
// ---------------------------------------------------------------------------

export type ActiveEngineInfo = {
  role: EngineRole;
  /** Build actually running (or that will run at the next search). */
  build: BuildId;
  /** Build the plan wanted (differs after a fallback). */
  plannedBuild: BuildId;
  /** `id name` reported by the running worker, or the build's known name. */
  uciName: string;
  version: string;
  source: string;
  net: 'small' | 'big';
  netFile: string;
  threads: number;
  hashMB: number;
  /** Untimed search budget used by the top tier on this device (ms, MultiPV 1). */
  topMs: number;
  fullStrength: boolean;
  crossOriginIsolated: boolean;
  alive: boolean;
  onFallback: boolean;
  /** Where the big net comes from, if it is used. */
  delivery: 'app' | 'pack' | 'bundled';
  /** One line for the UI, e.g. "Stockfish 19 full net, 3 threads · 128 MB hash". */
  label: string;
};

/** Exactly which engine a role uses now (actual build after any fallback, options in force). */
export function activeEngineInfo(role: EngineRole = 'elite'): ActiveEngineInfo {
  const p = currentPlan();
  const slot = p[role];
  const e = pool.get(role);
  const build = (e ? builtWith.get(role) : undefined) ?? slot.build;
  const b = BUILDS[build];
  const threads = Number(e?.getOption('Threads') ?? slot.threads) || 1;
  const hashMB = Number(e?.getOption('Hash') ?? slot.hashMB) || slot.hashMB;
  const eff = b.threads ? threads : 1;
  return {
    role,
    build,
    plannedBuild: slot.build,
    uciName: e && e.name !== 'engine' ? e.name : b.uciName,
    version: 'Stockfish 19',
    source: ENGINE_SOURCE,
    net: b.net,
    netFile: e?.evalFile ?? b.netFile,
    threads: eff,
    hashMB,
    topMs: p.budget.topMs,
    fullStrength: b.net === 'big',
    crossOriginIsolated: !!device?.isolated,
    alive: !!e?.alive,
    onFallback: !!e?.onFallback,
    delivery: b.delivery === 'app' ? 'app' : pack.state === 'bundled' ? 'bundled' : 'pack',
    label: `${buildLabel(build, eff)} · ${hashMB} MB hash`,
  };
}

/** What an opponent of this Elo runs on, for persona cards ("Stockfish 19 Lite …" when the pack is missing). */
export function personaEngineLabel(elo: number): string {
  if (elo >= ELITE_ELO) {
    const i = activeEngineInfo('elite');
    return elo >= 3000 ? `${i.label} · single-PV ${i.topMs / 1000}s search` : `${i.label} · top-3 search`;
  }
  return `${buildLabel(slotFor('play').build)} · calibrated ${elo} model`;
}

/** Diagnostics for a settings/debug panel. */
export function engineStatus() {
  void initPack();
  const p = currentPlan();
  return {
    device,
    plan: p,
    pack: { ...pack, files: [...pack.files] },
    /** v0.2 shape, kept for old callers. */
    bigNet: { state: pack.state === 'installed' || pack.state === 'bundled' ? 'ready' : pack.state === 'downloading' ? 'downloading' : pack.state === 'failed' ? 'failed' : pack.state === 'unavailable' ? 'unavailable' : 'idle', loaded: pack.loaded, total: pack.total },
    bigNetBroken,
    gameInProgress,
    elite: activeEngineInfo('elite'),
    play: activeEngineInfo('play'),
    scheduler: scheduler?.stats ?? null,
    engines: [...pool.entries()].map(([role, e]) => ({ role, build: builtWith.get(role), name: e.name, alive: e.alive, restarts: e.restarts })),
    log: [...log],
  };
}
