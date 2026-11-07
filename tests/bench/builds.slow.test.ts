import { describe, it, expect } from 'vitest';
import { BUILDS, type BuildId } from '../../src/engine/builds';
import { UciEngine } from '../../src/engine/uci';
import { findBuild, processTransport, processRssMB } from '../helpers/nodeEngine';
import { saveResult, envInt } from './lib/report';

/**
 * Build comparison: startup (spawn → readyok), nps and depth at fixed time,
 * peak RSS of the engine process. Every build runs as a child process so RSS is
 * per engine. Builds not found (see findBuild) are skipped and reported.
 */
const FENS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7',
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  '6k1/pp3ppp/2p5/3r4/8/1P3P2/P5PP/3R2K1 w - - 0 30',
];

describe('engine builds', () => {
  it('measures startup, nps, depth and memory', async () => {
    const movetime = envInt('BENCH_MOVETIME', 2000);
    const configs: { build: BuildId; threads: number; hash: number }[] = [
      { build: 'lite-single', threads: 1, hash: 16 },
      { build: 'lite-single', threads: 1, hash: 64 },
      { build: 'full-single', threads: 1, hash: 64 },
      { build: 'lite-mt', threads: 1, hash: 64 },
      { build: 'lite-mt', threads: 2, hash: 64 },
      { build: 'lite-mt', threads: 4, hash: 64 },
      { build: 'full-mt', threads: 2, hash: 64 },
      { build: 'full-mt', threads: 4, hash: 64 },
    ];
    const rows: Record<string, unknown>[] = [];
    for (const c of configs) {
      const p = findBuild(c.build);
      if (!p) {
        rows.push({ build: c.build, threads: c.threads, skipped: 'not found' });
        continue;
      }
      const t0 = Date.now();
      let pid: number | undefined;
      const e = new UciEngine(() => {
        const t = processTransport(p);
        pid = t.pid;
        return t;
      }, { initOptions: { Threads: c.threads, Hash: c.hash } });
      await e.isReady();
      const startupMs = Date.now() - t0;
      let peak = processRssMB(pid);
      const depth: number[] = [];
      const nps: number[] = [];
      for (const fen of FENS) {
        await e.newGame();
        const t1 = Date.now();
        const r = await e.search({ fen, movetime });
        const l = r.lines[0];
        depth.push(l.depth);
        nps.push(Math.round((l.nodes ?? 0) / ((Date.now() - t1) / 1000)));
        peak = Math.max(peak, processRssMB(pid));
      }
      e.terminate();
      rows.push({ build: c.build, file: BUILDS[c.build].wasm, wasmMB: +(BUILDS[c.build].wasmBytes / 1048576).toFixed(1), threads: c.threads, hash: c.hash, startupMs, knps: Math.round(nps.reduce((a, b) => a + b, 0) / nps.length / 1000), depth: depth.join('/'), peakRssMB: peak });
    }
    console.table(rows);
    saveResult('builds', { movetime, rows });
    expect(rows.some((r) => !r.skipped)).toBe(true);
  }, 900000);
});
