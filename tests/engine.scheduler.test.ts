import { describe, it, expect } from 'vitest';
import { UciEngine, isAbortError } from '../src/engine/uci';
import { EngineScheduler, PRIORITY } from '../src/engine/scheduler';
import { planEngines, detectDevice, type DeviceInfo } from '../src/engine/builds';
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

describe('device tiers', () => {
  const desk: DeviceInfo = { cores: 8, memoryGB: 8, mobile: false, ios: false, isolated: false };
  it('detects iPhone, iPadOS and Android as mobile', () => {
    expect(detectDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', hardwareConcurrency: 6 }, {}).ios).toBe(true);
    expect(detectDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }, {}).mobile).toBe(true);
    expect(detectDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }, {}).mobile).toBe(true);
    expect(detectDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', hardwareConcurrency: 12 }, { crossOriginIsolated: true, SharedArrayBuffer: ArrayBuffer }).isolated).toBe(true);
  });
  it('mobile: lite single-threaded, one search, idle termination, never the big net', () => {
    const p = planEngines({ cores: 6, memoryGB: null, mobile: true, ios: true, isolated: true }, { bigNetReady: true });
    expect([p.play.build, p.elite.build, p.analysis.build, p.spectate.build]).toEqual(['lite-single', 'lite-single', 'lite-single', 'lite-single']);
    expect(p.maxConcurrent).toBe(1);
    expect(p.idleTerminateMs).toBeGreaterThan(0);
    expect(p.bigNetAllowed).toBe(false);
  });
  it('desktop: big net only once downloaded; threads only when isolated', () => {
    expect(planEngines(desk, { bigNetReady: false }).elite.build).toBe('lite-single');
    expect(planEngines(desk, { bigNetReady: true }).elite.build).toBe('full-single');
    const iso = planEngines({ ...desk, isolated: true }, { bigNetReady: true });
    expect(iso.elite).toEqual({ build: 'full-mt', threads: 4, hashMB: 128 });
    expect(iso.play.build).toBe('lite-mt');
    expect(planEngines({ ...desk, isolated: true, cores: 4 }, { bigNetReady: false }).play.threads).toBe(3);
    expect(planEngines(desk, { bigNetReady: true, allowBigNet: false }).elite.build).toBe('lite-single');
    expect(planEngines({ ...desk, memoryGB: 4 }, { bigNetReady: true }).maxConcurrent).toBe(1);
  });
});
