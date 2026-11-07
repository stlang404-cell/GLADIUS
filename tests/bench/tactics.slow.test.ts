import { describe, it, expect } from 'vitest';
import { solveSuite, type SolveConfig } from './lib/suite';
import { TACTICS } from './lib/positions';
import { nodeEngine, findBuild } from '../helpers/nodeEngine';
import { saveResult, envInt } from './lib/report';

/**
 * Tactical suite: verified WAC / Bratko-Kopec positions (tests/bench/lib/positions.ts),
 * solve rate at fixed time per configuration, and per persona level.
 * BENCH_TACTICS_MS: comma list of movetimes (default 100,500).
 */
describe('tactical suite', () => {
  it('solve rate per configuration', async () => {
    const times = (process.env.BENCH_TACTICS_MS ?? '100,500').split(',').map(Number);
    const cfgs: SolveConfig[] = [];
    for (const t of times) {
      cfgs.push({ kind: 'engine', name: `lite-single ${t}ms`, engine: () => nodeEngine('lite-single', { initOptions: { Hash: 64 } }), movetime: t });
      if (findBuild('full-single')) cfgs.push({ kind: 'engine', name: `full-single ${t}ms`, engine: () => nodeEngine('full-single', { initOptions: { Hash: 64 } }), movetime: t });
      if (findBuild('lite-mt')) cfgs.push({ kind: 'engine', name: `lite-mt T3 ${t}ms`, engine: () => nodeEngine('lite-mt', { initOptions: { Hash: 64, Threads: 3 } }), movetime: t });
      if (findBuild('full-mt')) cfgs.push({ kind: 'engine', name: `full-mt T3 ${t}ms`, engine: () => nodeEngine('full-mt', { initOptions: { Hash: 128, Threads: 3 } }), movetime: t });
    }
    const personaMs = envInt('BENCH_PERSONA_MS', 500);
    for (const elo of process.env.BENCH_TACTICS_PERSONAS === '0' ? [] : [1000, 1600, 2200, 2600, 2800, 3000]) {
      cfgs.push({ kind: 'persona', name: `persona ${elo} (lite)`, engine: () => nodeEngine('lite-single', { initOptions: { Hash: 16 } }), persona: { elo, style: 'universal', openingStyles: [], seed: 3 }, thinkMs: personaMs });
    }
    if (findBuild('full-single') && process.env.BENCH_TACTICS_PERSONAS !== '0') cfgs.push({ kind: 'persona', name: `persona 3000 (full, H128)`, engine: () => nodeEngine('full-single', { initOptions: { Hash: 128 } }), persona: { elo: 3000, style: 'universal', openingStyles: [], seed: 3 }, thinkMs: personaMs });
    const rows = [];
    for (const c of cfgs) {
      const r = await solveSuite(c);
      rows.push({ config: r.name, solved: `${r.solved}/${r.total}`, rate: Math.round(r.rate * 1000) / 10, failed: r.failed.join(' ') });
      console.log(r.name, `${r.solved}/${r.total}`);
    }
    console.table(rows);
    saveResult(process.env.BENCH_TAG ? `tactics-${process.env.BENCH_TAG}` : 'tactics', { positions: TACTICS.length, personaThinkMs: personaMs, rows });
    expect(TACTICS.length).toBeGreaterThanOrEqual(40);
  }, 6 * 3600 * 1000);
});
