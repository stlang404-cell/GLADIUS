import { describe, it, expect } from 'vitest';
import { UciEngine, isAbortError } from '../src/engine/uci';
import { EngineScheduler, PRIORITY } from '../src/engine/scheduler';
import { planEngines, detectDevice, hashFor, type DeviceInfo } from '../src/engine/builds';
import { untimedThink } from '../src/engine/persona';
import { fakeFactory } from './helpers/fakeEngine';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('scheduler', () => {
  it('never exceeds the concurrency limit', async () => {
    const sch = new EngineScheduler({ maxConcurrent: 2, exclusiveAbove: 99 });
    const { make, stats } = fakeFactory({ searchMs: 25 });
    const engines = Array.from({ length: 5 }, (_, i) => new UciEngine(make, { role: 'e' + i, gate: sch, priority: 1 }));
    await Promise.all(engines.flatMap((e) => [e.search({ fen: START, movetime: 25 }), e.search({ fen: START, movetime: 25 })]));
    expect(stats.gos).toBe(10);
    expect(stats.maxActive).toBe(2);
    engines.forEach((e) => e.terminate());
  });

  it('grants by priority, FIFO within a priority', async () => {
    const sch = new EngineScheduler({ maxConcurrent: 1, exclusiveAbove: 99 });
    const { make } = fakeFactory({ searchMs: 15 });
    const lo = new UciEngine(make, { role: 'analysis', gate: sch, priority: PRIORITY.analysis });
    const mid = new UciEngine(make, { role: 'spectate', gate: sch, priority: PRIORITY.spectate });
    const hi = new UciEngine(make, { role: 'play', gate: sch, priority: PRIORITY.play });
    await Promise.all([lo.whenReady(), mid.whenReady(), hi.whenReady()]);
    const blocker = new UciEngine(make, { role: 'blocker', gate: sch, priority: 5 });
    const b = blocker.search({ fen: START, movetime: 40 });
    await sleep(5);
    const ps = [lo.search({ fen: START, movetime: 10 }), mid.search({ fen: START, movetime: 10 }), hi.search({ fen: START, movetime: 10 })];
    await Promise.all([b, ...ps]);
    expect(sch.history.slice(-4)).toEqual(['blocker', 'play', 'spectate', 'analysis']);
    [lo, mid, hi, blocker].forEach((e) => e.terminate());
  });

  it('pauses (preempts) analysis while the opponent thinks, then resumes it', async () => {
    const sch = new EngineScheduler({ maxConcurrent: 2 });
    const { make, stats } = fakeFactory();
    const analysis = new UciEngine(make, { role: 'analysis', gate: sch, priority: PRIORITY.analysis, preemptible: true });
    const play = new UciEngine(make, { role: 'play', gate: sch, priority: PRIORITY.play });
    await Promise.all([analysis.whenReady(), play.whenReady()]);
    let preempted = 0;
    const a = analysis.search({ fen: START, movetime: 300 });
    await sleep(20);
    const t0 = Date.now();
    const p = play.search({ fen: START, movetime: 60 });
    // while play runs, analysis must not be searching
    await sleep(30);
    expect(sch.stats.running).toEqual(['play']);
    await p;
    expect(Date.now() - t0).toBeLessThan(250);
    const r = await a; // re-run after play finished
    expect(r.bestmove).toBe('e2e4');
    expect(stats.stops).toBeGreaterThanOrEqual(1);
    preempted = sch.history.filter((x) => x === 'analysis').length;
    expect(preempted).toBe(2); // first attempt + re-run
    analysis.terminate();
    play.terminate();
  });

  it('an aborted waiting request leaves the queue', async () => {
    const sch = new EngineScheduler({ maxConcurrent: 1, exclusiveAbove: 99 });
    const { make } = fakeFactory();
    const e1 = new UciEngine(make, { role: 'a', gate: sch });
    const e2 = new UciEngine(make, { role: 'b', gate: sch });
    const busy = e1.search({ fen: START, movetime: 80 });
    await sleep(10);
    const ac = new AbortController();
    const waiting = e2.search({ fen: START, movetime: 10, signal: ac.signal });
    ac.abort();
    await expect(waiting).rejects.toSatisfy(isAbortError);
    await busy;
    expect(sch.stats.waiting).toEqual([]);
    expect(sch.stats.running).toEqual([]);
    e1.terminate();
    e2.terminate();
  });
});

describe('robust UCI client', () => {
  it('restarts a crashed worker transparently and retries the search', async () => {
    const { make, stats } = fakeFactory({ failOnGo: 1 });
    const events: string[] = [];
    const e = new UciEngine(make, { onEvent: (ev) => events.push(ev.type) });
    await e.setOption('Hash', 32);
    const r = await e.search({ fen: START, movetime: 20 });
    expect(r.bestmove).toBe('e2e4');
    expect(stats.instances).toBe(2);
    expect(e.restarts).toBe(1);
    expect(events).toContain('restart');
    // options are re-applied on the new worker
    expect(stats.log.filter((l) => l === 'setoption name Hash value 32').length).toBe(2);
    e.terminate();
  });

  it('a hung search is stopped, then the worker is replaced (no hung promise)', async () => {
    const { make, stats } = fakeFactory({ hangOnGo: 1 });
    const e = new UciEngine(make, { searchGraceMs: 50 });
    const t0 = Date.now();
    const r = await e.search({ fen: START, movetime: 30 });
    expect(r.bestmove).toBe('e2e4');
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(stats.instances).toBe(2);
    e.terminate();
  });

  it('handshake timeout falls back to the fallback build', async () => {
    const primary = fakeFactory({ bootFails: 99 });
    const fb = fakeFactory({ bestmove: 'd2d4' });
    const events: string[] = [];
    const e = new UciEngine(primary.make, { handshakeTimeoutMs: 50, fallbackFactory: fb.make, onEvent: (ev) => events.push(ev.type) });
    const r = await e.search({ fen: START, movetime: 10 });
    expect(r.bestmove).toBe('d2d4');
    expect(events).toContain('fallback');
    e.terminate();
  });

  it('a transport without a factory rejects instead of hanging when it dies', async () => {
    const { make } = fakeFactory({ failOnGo: 5 });
    const e = new UciEngine(make()); // plain transport: cannot restart
    await expect(e.search({ fen: START, movetime: 10 })).rejects.toThrow(/crash|transport/);
    e.terminate();
  });

  it('stop() is safe when idle and ends a running search', async () => {
    const { make } = fakeFactory();
    const e = new UciEngine(make);
    e.stop(); // idle: no-op
    const p = e.search({ fen: START, movetime: 5000 });
    await sleep(20);
    e.stop();
    const r = await p;
    expect(r.bestmove).toBe('e2e4');
    e.terminate();
  });

  it('abort rejects at once; the next search still works', async () => {
    const { make } = fakeFactory();
    const e = new UciEngine(make);
    const ac = new AbortController();
    const p = e.search({ fen: START, movetime: 5000, signal: ac.signal });
    await sleep(20);
    const t0 = Date.now();
    ac.abort();
    await expect(p).rejects.toSatisfy(isAbortError);
    expect(Date.now() - t0).toBeLessThan(200);
    const r = await e.search({ fen: START, movetime: 10 });
    expect(r.bestmove).toBe('e2e4');
    e.terminate();
  });

  it('terminate() rejects queued searches', async () => {
    const { make } = fakeFactory();
    const e = new UciEngine(make);
    const a = e.search({ fen: START, movetime: 200 });
    const b = e.search({ fen: START, movetime: 200 });
    await sleep(10);
    e.terminate();
    await expect(a).rejects.toThrow(/terminated/);
    await expect(b).rejects.toThrow(/terminated/);
  });

  it('idle workers are terminated and restarted lazily', async () => {
    const { make, stats } = fakeFactory();
    const e = new UciEngine(make, { idleTerminateMs: 30 });
    await e.search({ fen: START, movetime: 5 });
    await sleep(80);
    expect(e.alive).toBe(false);
    const r = await e.search({ fen: START, movetime: 5 });
    expect(r.bestmove).toBe('e2e4');
    expect(stats.instances).toBe(2);
    e.terminate();
  });
});

describe('worker lifecycle (v0.3)', () => {
  it('suspend() frees an idle worker, refuses while searching, restarts lazily with options', async () => {
    const { make, stats } = fakeFactory({ searchMs: 60 });
    const e = new UciEngine(make, { initOptions: { Hash: 32 } });
    await e.search({ fen: START, movetime: 10 });
    expect(e.alive).toBe(true);
    const p = e.search({ fen: START, movetime: 60 });
    await sleep(15);
    expect(e.suspend()).toBe(false); // searching
    await p;
    expect(e.suspend()).toBe(true);
    expect(e.alive).toBe(false);
    await e.search({ fen: START, movetime: 10 });
    expect(stats.instances).toBe(2);
    expect(stats.log.filter((l) => l === 'setoption name Hash value 32').length).toBe(2);
    e.terminate();
  });
  it('lazyStart: with a gate, the worker is created only once the search holds a lease', async () => {
    const sch = new EngineScheduler({ maxConcurrent: 1, exclusiveAbove: 99 });
    const { make, stats } = fakeFactory({ searchMs: 40 });
    const a = new UciEngine(make, { gate: sch, lazyStart: true, role: 'a' });
    const b = new UciEngine(make, { gate: sch, lazyStart: true, role: 'b' });
    expect(stats.instances).toBe(0);
    const pa = a.search({ fen: START, movetime: 40 });
    const pb = b.search({ fen: START, movetime: 40 });
    await sleep(15);
    expect(stats.instances).toBe(1); // b waits for the lease without a worker
    expect(b.suspend()).toBe(false); // nothing to free yet
    await Promise.all([pa, pb]);
    expect(stats.instances).toBe(2);
    // An engine with a worker that waits for a lease may be suspended (memory), and still completes.
    const pa2 = a.search({ fen: START, movetime: 40 });
    const pb2 = b.search({ fen: START, movetime: 40 });
    await sleep(10);
    expect(b.suspend()).toBe(true);
    const r = await pb2;
    await pa2;
    expect(r.bestmove).toBe('e2e4');
    a.terminate();
    b.terminate();
  });
  it('a crashed worker during a gated search is recovered without leaking the lease', async () => {
    const sch = new EngineScheduler({ maxConcurrent: 1, exclusiveAbove: 99 });
    const { make } = fakeFactory({ failOnGo: 1 });
    const e = new UciEngine(make, { gate: sch, lazyStart: true });
    const r = await e.search({ fen: START, movetime: 20 });
    expect(r.bestmove).toBe('e2e4');
    expect(e.restarts).toBe(1);
    expect(sch.stats.running).toEqual([]);
    e.terminate();
  });
});

describe('interruptions and reply speed (v0.3)', () => {
  it('interrupted search: abort mid-search, "navigate away", next game gets its own answer', async () => {
    const { make, stats } = fakeFactory({ countMoves: true });
    const sch = new EngineScheduler({ maxConcurrent: 1 });
    const e = new UciEngine(make, { gate: sch, priority: PRIORITY.play, lazyStart: true });
    const ac = new AbortController();
    const p1 = e.search({ fen: START, movetime: 5000, signal: ac.signal });
    await sleep(30);
    ac.abort(); // user leaves the game screen
    await expect(p1).rejects.toSatisfy(isAbortError);
    expect(stats.stops).toBe(1);
    // The stopped search's late bestmove must not be taken as the next answer.
    const r = await e.search({ fen: START, movetime: 20 });
    expect(r.bestmove).toBe('c2c3'); // answer of the 2nd go (the 1st, stopped one said b2b3)
    expect(sch.stats.running).toEqual([]);
    e.terminate();
  });
  it('reload while searching: terminate() rejects everything, a fresh engine starts clean', async () => {
    const { make, stats } = fakeFactory({ searchMs: 1000, ignoreMovetime: true });
    const e = new UciEngine(make);
    const p = e.search({ fen: START, movetime: 1000 });
    const q = e.search({ fen: START, movetime: 1000 });
    await sleep(20);
    e.terminate(); // page unload
    await expect(p).rejects.toThrow(/terminated/);
    await expect(q).rejects.toThrow();
    expect(stats.active).toBe(0);
    const e2 = new UciEngine(fakeFactory({ searchMs: 5 }).make);
    expect((await e2.search({ fen: START, movetime: 5 })).bestmove).toBe('e2e4');
    e2.terminate();
  });
  it('fast replies: 50 back-to-back searches with instant bestmove resolve in order', async () => {
    const { make, stats } = fakeFactory({ searchMs: 0, ignoreMovetime: true, countMoves: true });
    const e = new UciEngine(make);
    const rs = await Promise.all(Array.from({ length: 50 }, () => e.search({ fen: START, movetime: 1 })));
    expect(stats.gos).toBe(50);
    rs.forEach((r, i) => expect(r.bestmove).toBe(['a2a3', 'b2b3', 'c2c3', 'd2d3', 'e2e3', 'f2f3', 'g2g3', 'h2h3'][(i + 1) % 8]));
    e.terminate();
  });
  it('slow replies: an engine that overruns its movetime is stopped by the watchdog and still answers', async () => {
    const { make, stats } = fakeFactory({ searchMs: 5000, ignoreMovetime: true });
    const e = new UciEngine(make, { searchGraceMs: 100 });
    const t0 = Date.now();
    const r = await e.search({ fen: START, movetime: 50 });
    expect(r.bestmove).toBe('e2e4');
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(stats.stops).toBe(1);
    e.terminate();
  });
});

describe('analysis held during a game (v0.3)', () => {
  it('hold() keeps analysis queued and stops a running one; release() resumes it', async () => {
    const sch = new EngineScheduler({ maxConcurrent: 2 });
    const { make } = fakeFactory();
    const analysis = new UciEngine(make, { role: 'analysis', gate: sch, priority: PRIORITY.analysis, preemptible: true, lazyStart: true });
    const a1 = analysis.search({ fen: START, movetime: 300 });
    await sleep(30);
    expect(sch.stats.running).toEqual(['analysis']);
    sch.hold(PRIORITY.analysis); // next game starts
    await sleep(30);
    expect(sch.stats.running).toEqual([]);
    expect(sch.stats.waiting).toEqual(['analysis']);
    const play = new UciEngine(make, { role: 'play', gate: sch, priority: PRIORITY.play, lazyStart: true });
    await play.search({ fen: START, movetime: 20 }); // play unaffected
    let done = false;
    void a1.then(() => (done = true));
    await sleep(50);
    expect(done).toBe(false);
    sch.release(); // game over
    expect((await a1).bestmove).toBe('e2e4');
    analysis.terminate();
    play.terminate();
  });
});

describe('device tiers', () => {
  const desk: DeviceInfo = { cores: 8, memoryGB: 8, mobile: false, ios: false, isolated: false };
  it('detects iPhone, iPadOS and Android as mobile', () => {
    expect(detectDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', hardwareConcurrency: 6 }, {}).ios).toBe(true);
    expect(detectDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }, {}).mobile).toBe(true);
    expect(detectDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }, {}).mobile).toBe(true);
    expect(detectDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', hardwareConcurrency: 12 }, { crossOriginIsolated: true, SharedArrayBuffer: ArrayBuffer }).isolated).toBe(true);
  });
  it('mobile: lite single-threaded, one search, idle termination, no big net by default', () => {
    const p = planEngines({ cores: 6, memoryGB: null, mobile: true, ios: true, isolated: true }, { bigNetReady: true });
    expect([p.play.build, p.elite.build, p.analysis.build, p.spectate.build]).toEqual(['lite-single', 'lite-single', 'lite-single', 'lite-single']);
    expect(p.maxConcurrent).toBe(1);
    expect(p.idleTerminateMs).toBeGreaterThan(0);
    expect(p.bigNetAllowed).toBe(false);
    expect(p.bigNetAuto).toBe(false);
    expect(p.maxWorkers).toBe(2);
  });
  it('mobile: the engine pack only with an explicit opt-in, never automatic, single-threaded, Hash 16', () => {
    const phone: DeviceInfo = { cores: 6, memoryGB: null, mobile: true, ios: true, isolated: false };
    const p = planEngines(phone, { bigNetReady: true, allowBigNet: true });
    expect(p.bigNetAllowed).toBe(true);
    expect(p.bigNetAuto).toBe(false);
    expect(p.elite).toEqual({ build: 'full-single', threads: 1, hashMB: 16 });
    expect(p.play.build).toBe('lite-single');
    // Android reporting < 4 GB: never.
    expect(planEngines({ ...phone, ios: false, memoryGB: 2 }, { bigNetReady: true, allowBigNet: true }).elite.build).toBe('lite-single');
  });
  it('hash sizing follows device memory and iOS caps', () => {
    const iphone: DeviceInfo = { cores: 6, memoryGB: null, mobile: true, ios: true, isolated: false };
    const android: DeviceInfo = { cores: 8, memoryGB: 8, mobile: true, ios: false, isolated: false };
    expect(hashFor(iphone, 'elite', false)).toBe(16);
    expect(hashFor(android, 'elite', false)).toBe(32);
    expect(hashFor(android, 'elite', true)).toBe(16);
    expect(hashFor(android, 'spectate', false)).toBe(8);
    expect(hashFor({ cores: 4, memoryGB: 4, mobile: false, ios: false, isolated: false }, 'elite', true)).toBe(32);
    expect(hashFor({ cores: 4, memoryGB: null, mobile: false, ios: false, isolated: false }, 'elite', true)).toBe(128);
    expect(hashFor({ cores: 16, memoryGB: 8, mobile: false, ios: false, isolated: false }, 'elite', true)).toBe(256);
    expect(hashFor({ cores: 16, memoryGB: 8, mobile: false, ios: false, isolated: false }, 'play', false)).toBe(64);
  });
  it('compute budgets: phones think longer for the same strength; desktop top tier 2 s', () => {
    expect(planEngines({ cores: 6, memoryGB: null, mobile: true, ios: true, isolated: false }, { bigNetReady: false }).budget.topMs).toBe(2500);
    expect(planEngines(desk, { bigNetReady: false }).budget.topMs).toBe(2000);
    expect(untimedThink(3100, undefined, { topMs: 2500 })).toBe(2500);
    expect(untimedThink(2700, undefined, { eliteMs: [1200, 1800] })).toBe(1200);
    expect(untimedThink(3100)).toBe(2000);
    expect(untimedThink(3100, 700, { topMs: 2500 })).toBe(700);
  });
  it('desktop: big net only once downloaded; threads only when isolated', () => {
    expect(planEngines(desk, { bigNetReady: false }).elite.build).toBe('lite-single');
    expect(planEngines(desk, { bigNetReady: true }).elite.build).toBe('full-single');
    const iso = planEngines({ ...desk, isolated: true }, { bigNetReady: true });
    expect(iso.elite).toEqual({ build: 'full-mt', threads: 4, hashMB: 256 }); // ≥ 8 GB and ≥ 8 cores
    expect(planEngines({ ...desk, isolated: true, cores: 4 }, { bigNetReady: true }).elite).toEqual({ build: 'full-mt', threads: 3, hashMB: 128 });
    expect(iso.play.build).toBe('lite-mt');
    expect(planEngines({ ...desk, isolated: true, cores: 4 }, { bigNetReady: false }).play.threads).toBe(3);
    expect(planEngines(desk, { bigNetReady: true, allowBigNet: false }).elite.build).toBe('lite-single');
    expect(planEngines({ ...desk, memoryGB: 4 }, { bigNetReady: true }).maxConcurrent).toBe(1);
  });
});
