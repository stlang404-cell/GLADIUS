import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fakeFactory } from './helpers/fakeEngine';

/**
 * Browser engine pool (src/engine/browserEngine.ts) with a fake Worker: worker
 * limits per device class, identification, labels that never claim full
 * strength while Lite runs, and cancellation.
 */
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const { make, stats } = fakeFactory({ searchMs: 20 });
let liveWorkers = 0;
let maxLive = 0;
const urls: string[] = [];

class FakeWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  private t = make();
  private dead = false;
  constructor(url: string) {
    urls.push(url);
    liveWorkers++;
    maxLive = Math.max(maxLive, liveWorkers);
    this.t.setListener((l) => this.onmessage?.({ data: l }));
  }
  postMessage(c: string) {
    this.t.send(c);
  }
  terminate() {
    if (!this.dead) liveWorkers--;
    this.dead = true;
    this.t.terminate();
  }
}

type BE = typeof import('../src/engine/browserEngine');
let be: BE;

beforeAll(async () => {
  vi.stubGlobal('navigator', { hardwareConcurrency: 6, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148', maxTouchPoints: 5 });
  vi.stubGlobal('document', { baseURI: 'http://gladius.test/', visibilityState: 'visible', addEventListener: () => undefined });
  vi.stubGlobal('Worker', FakeWorker);
  // Reload after the page was killed while a big-net worker ran (OOM guard still set).
  const store = new Map<string, string>([['gladius.engine.bigboot.v1', String(Date.now())]]);
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
  // Host without the engine pack: HEAD probes answer the SPA fallback.
  vi.stubGlobal('fetch', async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }));
  be = await import('../src/engine/browserEngine');
});

describe('browser engine pool (phone)', () => {
  it('keeps at most maxWorkers (2 on phones) workers alive and one search at a time', async () => {
    const roles = ['play', 'analysis', 'spectate', 'elite'] as const;
    for (let round = 0; round < 2; round++) {
      await Promise.all(roles.map((r) => be.getEngine(r).search({ fen: START, movetime: 15 })));
    }
    expect(be.engineStatus().plan.maxWorkers).toBe(2);
    expect(maxLive).toBeLessThanOrEqual(2);
    expect(stats.maxActive).toBe(1);
    expect(stats.gos).toBe(8);
  });

  it('identifies the Lite engine exactly and never labels it full strength', async () => {
    const info = be.activeEngineInfo('elite');
    expect(info.build).toBe('lite-single');
    expect(info.fullStrength).toBe(false);
    expect(info.net).toBe('small');
    expect(info.threads).toBe(1);
    expect(info.hashMB).toBe(16); // iOS cap
    expect(info.label).toMatch(/Lite/);
    expect(info.label).not.toMatch(/full/);
    expect(be.personaEngineLabel(3100)).toMatch(/Lite/);
    expect(be.personaEngineLabel(2800)).toMatch(/Lite/);
    const st = be.engineStatus();
    expect(st.pack.state).toBe('unavailable'); // phones: opt-in only, never automatic
    expect(st.plan.bigNetAuto).toBe(false);
    expect(urls.every((u) => u.includes('stockfish-19-lite-single.js'))).toBe(true);
  });

  it('after a reload that followed an OOM kill of the big net, the big net stays disabled', () => {
    const st = be.engineStatus();
    expect(st.bigNetBroken).toBe(true);
    expect(st.log.some((l) => l.includes('was killed'))).toBe(true);
  });

  it('a game in progress holds analysis; it resumes when the game ends', async () => {
    be.setGameInProgress(true);
    let done = false;
    const a = be.getEngine('analysis').search({ fen: START, movetime: 10 }).then((r) => ((done = true), r));
    await be.getEngine('play').search({ fen: START, movetime: 10 });
    await new Promise((r) => setTimeout(r, 60));
    expect(done).toBe(false);
    be.setGameInProgress(false);
    expect((await a).bestmove).toBe('e2e4');
  });

  it('elite personas get the device budget (phones: 2.5 s top tier) through engine.budget', () => {
    expect(be.getEngine('play', { elo: 3100 }).budget?.topMs).toBe(2500);
  });

  it('an aborted opponent search rejects at once and frees the slot; suspendIdleEngines frees workers', async () => {
    const e = be.getEngine('play');
    const ac = new AbortController();
    const p = e.search({ fen: START, movetime: 5000, signal: ac.signal });
    setTimeout(() => ac.abort(), 30);
    const t0 = Date.now();
    await expect(p).rejects.toThrow(/aborted/);
    expect(Date.now() - t0).toBeLessThan(1000);
    const r = await be.getEngine('analysis').search({ fen: START, movetime: 10 });
    expect(r.bestmove).toBe('e2e4');
    be.suspendIdleEngines();
    expect(liveWorkers).toBe(0);
    // Restarts lazily, options re-applied.
    await be.getEngine('play').search({ fen: START, movetime: 10 });
    expect(liveWorkers).toBe(1);
  });
});
