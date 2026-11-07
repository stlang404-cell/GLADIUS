import { describe, it, expect } from 'vitest';
import { generatePopulation, POPULATION_SIZE } from '../../src/world/population';
import { nameCapacity } from '../../src/world/names';
import { regionOf } from '../../src/world/indexes';
import { REGION_IDS } from '../../src/world/regions';
import { simulateDay, activeCompetitors, type SimContext } from '../../src/world/sim';
import { RANKS, ARENAS } from '../../src/world/arenas';
import { DAYS_PER_YEAR } from '../../src/world/types';

function arenaCounts(ctx: SimContext) {
  const counts = new Array(ARENAS.length).fill(0);
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
  it('generates 25,000 unique competitors in a realistic pyramid', () => {
    expect(POPULATION_SIZE).toBe(25000);
    const pop = generatePopulation(12345);
    expect(pop.length).toBe(POPULATION_SIZE);
    expect(new Set(pop.map((c) => c.id)).size).toBe(POPULATION_SIZE);
    expect(new Set(pop.map((c) => c.name)).size).toBe(POPULATION_SIZE);
    expect(pop.filter((c) => c.name.startsWith('Ignotus')).length).toBe(0);
    for (const c of pop) expect(c.w + c.d + c.l).toBe(c.games);
    // deterministic
    expect(generatePopulation(12345, 50).map((c) => c.name)).toEqual(pop.slice(0, 50).map((c) => c.name));
    // Elite stays rare: a handful above 2800, none above 3000; a broad developing base.
    const above = (x: number) => pop.filter((c) => c.rating > x).length;
    expect(above(3000)).toBeLessThanOrEqual(2);
    expect(above(2800)).toBeLessThanOrEqual(12);
    expect(above(2600)).toBeLessThanOrEqual(60);
    expect(above(2600)).toBeGreaterThanOrEqual(8);
    const arenas = new Array(ARENAS.length).fill(0);
    for (const c of pop) arenas[RANKS[c.rank].arena]++;
    expect(arenas[23]).toBeGreaterThan(0);
    expect(arenas[23]).toBeLessThan(60);
    expect(arenas.slice(0, 8).reduce((a, b) => a + b, 0)).toBeGreaterThan(POPULATION_SIZE * 0.5);
    for (let a = 12; a < 22; a++) expect(arenas[a]).toBeGreaterThanOrEqual(arenas[a + 1] * 0.6); // thins out towards the top (23 is open-ended)
    // Every region is populated.
    const regions = new Map<string, number>();
    for (const c of pop) regions.set(regionOf(c), (regions.get(regionOf(c)) ?? 0) + 1);
    for (const r of REGION_IDS) expect(regions.get(r) ?? 0).toBeGreaterThan(POPULATION_SIZE * 0.04);
  });

  it('keeps names unique at 50,000 competitors', () => {
    const pop = generatePopulation(777, 50000);
    expect(new Set(pop.map((c) => c.name)).size).toBe(50000);
    expect(pop.filter((c) => c.name.startsWith('Ignotus')).length).toBe(0);
    expect(nameCapacity().female).toBeGreaterThan(1_000_000);
  }, 60000);

  it('stays stable over 20 in-world years', () => {
    const ctx: SimContext = {
      // 5,000 competitors keep this 20-year test fast; the 25k burn-in is measured in tests/sim/world.test.ts and the soak.
      seed: 777, day: 0, competitors: generatePopulation(777, 5000), nextSerial: 5001, chronicle: [],
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
    expect(end.n).toBe(5000);
    expect(Math.abs(end.mean - start.mean)).toBeLessThan(120);
    expect(Math.abs(end.sd - start.sd)).toBeLessThan(120);
    expect(Math.abs(end.bias)).toBeLessThan(40);
    expect(end.absErr).toBeLessThan(140);
    const arenas = arenaCounts(ctx);
    expect(arenas.slice(20).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(arenas.slice(0, 4).reduce((a, b) => a + b, 0)).toBeGreaterThan(800);
    for (const c of activeCompetitors(ctx)) {
      expect(c.w + c.d + c.l).toBe(c.games);
      expect(Number.isFinite(c.rating)).toBe(true);
      expect(c.rating).toBeGreaterThanOrEqual(100);
    }
    expect(ARENAS.length).toBe(24);
  }, 300000);
});
