import { describe, it, expect } from 'vitest';
import { generatePopulation, POPULATION_SIZE } from '../../src/world/population';
import { simulateDay, activeCompetitors, type SimContext } from '../../src/world/sim';
import { RANKS, ARENAS } from '../../src/world/arenas';
import { DAYS_PER_YEAR } from '../../src/world/types';

function arenaCounts(ctx: SimContext) {
  const counts = new Array(12).fill(0);
  for (const c of activeCompetitors(ctx)) counts[RANKS[c.rank].arena]++;
  return counts;
}
function stats(ctx: SimContext) {
  const act = activeCompetitors(ctx);
  const r = act.map((c) => c.rating);
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length);
  const bias = act.reduce((a, c) => a + (c.rating - c.skill), 0) / act.length;
  const absErr = act.filter((c) => c.games > 50).reduce((a, c) => a + Math.abs(c.rating - c.skill), 0) / act.filter((c) => c.games > 50).length;
  return { n: act.length, mean: Math.round(mean), sd: Math.round(sd), max: Math.max(...r), bias: Math.round(bias), absErr: Math.round(absErr) };
}

describe('population simulation', () => {
  it('generates 5000 unique competitors', () => {
    const pop = generatePopulation(12345);
    expect(pop.length).toBe(POPULATION_SIZE);
    expect(new Set(pop.map((c) => c.id)).size).toBe(POPULATION_SIZE);
    expect(new Set(pop.map((c) => c.name)).size).toBe(POPULATION_SIZE);
    for (const c of pop) expect(c.w + c.d + c.l).toBe(c.games);
    // deterministic
    expect(generatePopulation(12345, 50).map((c) => c.name)).toEqual(pop.slice(0, 50).map((c) => c.name));
  });

  it('stays stable over 20 in-world years', () => {
    const ctx: SimContext = {
      seed: 777, day: 0, competitors: generatePopulation(777), nextSerial: POPULATION_SIZE + 1, chronicle: [],
      stats: { simGames: 0, retirements: 0, debuts: 0, promotions: 0, calibrations: 0 },
    };
    const snapshots: unknown[] = [];
    const t0 = performance.now();
    const start = stats(ctx);
    snapshots.push({ year: 0, ...start, arenas: arenaCounts(ctx).join(',') });
    for (let y = 1; y <= 20; y++) {
      for (let d = 0; d < DAYS_PER_YEAR; d++) simulateDay(ctx);
      if (y % 2 === 0) snapshots.push({ year: y, ...stats(ctx), arenas: arenaCounts(ctx).join(',') });
    }
    const ms = performance.now() - t0;
    console.table(snapshots);
    console.log('sim stats', ctx.stats, 'ms/day', (ms / (20 * DAYS_PER_YEAR)).toFixed(2));
    const end = stats(ctx);
    expect(end.n).toBe(POPULATION_SIZE);
    expect(Math.abs(end.mean - start.mean)).toBeLessThan(120);
    expect(Math.abs(end.sd - start.sd)).toBeLessThan(120);
    expect(Math.abs(end.bias)).toBeLessThan(40);
    expect(end.absErr).toBeLessThan(140);
    const arenas = arenaCounts(ctx);
    expect(arenas[11]).toBeGreaterThan(0);
    expect(arenas[0] + arenas[1]).toBeGreaterThan(800);
    for (const c of activeCompetitors(ctx)) {
      expect(c.w + c.d + c.l).toBe(c.games);
      expect(Number.isFinite(c.rating)).toBe(true);
      expect(c.rating).toBeGreaterThanOrEqual(100);
    }
    expect(ARENAS.length).toBe(12);
  }, 300000);
});
