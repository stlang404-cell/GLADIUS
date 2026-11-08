import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { censusCorrection, ditherRound, drawProbability, DRAW_SHARE_CAP, recordCompetitorResult, seasonBoundary, type SimContext } from '../../src/world/sim';
import { potentialFromZ, potentialToZ, potentialStep, createCompetitor } from '../../src/world/population';
import { decideRank, RANKS, ARENAS, TRIAL_BYPASS_MARGIN } from '../../src/world/arenas';
import { expectedScore } from '../../src/rating/elo';
import { emptyWorld } from '../../src/world/world';
import { championshipChallenger, PLAYER_ID } from '../../src/world/calendar';
import type { Competitor } from '../../src/world/types';

/** v0.4 rating-stability rules (see docs/WORLD.md "v0.4"). */
describe('v0.4 rating stability', () => {
  const comp = (i: number, skill: number, gap: number): Competitor => {
    const c = createCompetitor(i, 1, 0, new Set());
    c.skill = skill;
    c.rating = Math.round(skill + gap);
    c.peak = c.rating;
    c.games = 100;
    return c;
  };

  it('the census calibrates each strength band separately and keeps the order within a band', () => {
    // Bottom bands underrated by 10, the elite overrated by 40: a uniform shift cannot fix both.
    const cs: Competitor[] = [];
    for (let i = 0; i < 300; i++) cs.push(comp(i + 1, 600 + (i % 100) * 10, -10));
    for (let i = 0; i < 60; i++) cs.push(comp(1000 + i, 2650 + i * 5, 40));
    const f = censusCorrection(cs)!;
    expect(f(700)).toBeCloseTo(10, 0);
    expect(f(2800)).toBeCloseTo(-40, 0);
    const ctx = { seed: 1, day: 27, competitors: cs, nextSerial: 9999, chronicle: [], stats: { simGames: 0, retirements: 0, debuts: 0, promotions: 0, calibrations: 0 } } as SimContext;
    const before = cs.filter((c) => c.skill >= 2650).map((c) => c.rating);
    seasonBoundary(ctx);
    const elite = cs.filter((c) => c.skill >= 2650);
    const low = cs.filter((c) => c.skill < 1600);
    const mean = (xs: Competitor[]) => xs.reduce((a, c) => a + c.rating - c.skill, 0) / xs.length;
    expect(Math.abs(mean(elite))).toBeLessThan(2);
    expect(Math.abs(mean(low))).toBeLessThan(2);
    // Same shift for everyone of similar strength: order preserved.
    const after = elite.map((c) => c.rating);
    for (let i = 1; i < after.length; i++) expect(Math.sign(after[i] - after[i - 1])).toBe(Math.sign(before[i] - before[i - 1]));
    for (const c of cs) expect(c.peak).toBeGreaterThanOrEqual(c.rating);
  });

  it('rating changes are rounded without bias (big favourites no longer gain on average)', () => {
    let sum = 0;
    for (let n = 0; n < 20000; n++) sum += ditherRound(0.5, 12345, n);
    expect(sum / 20000).toBeCloseTo(0.5, 1);
    // A 95% favourite at K = 10 playing to expectation: v0.3 gained ≈ +0.5 per game; now ≈ 0.
    const fav = comp(1, 2900, 0);
    fav.peak = 3000;
    const r0 = fav.rating;
    const rng = createRng(3);
    const opp = 2900 - 512; // expected 0.95
    const e = expectedScore(2900, opp);
    const pd = drawProbability(2900, opp);
    let drift = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const x = rng.next();
      const score = x < e - pd / 2 ? 1 : x < e + pd / 2 ? 0.5 : 0;
      recordCompetitorResult(fav, 'c999999', opp, score);
      drift += fav.rating - r0;
      fav.rating = r0; // measure the change per game at a fixed rating gap
    }
    expect(Math.abs(drift / N)).toBeLessThan(0.1); // v0.3 rounding: ≈ +0.5 per game
  });

  it('draws take at most DRAW_SHARE_CAP of the underdog\'s expected score; the expectation is unchanged', () => {
    const e = expectedScore(2825, 2975);
    const pd = drawProbability(2975, 2825);
    expect(pd).toBeLessThanOrEqual(2 * e * DRAW_SHARE_CAP + 1e-9);
    expect(e - pd / 2).toBeGreaterThan(0.08); // the underdog's win probability at a 150 gap, 2900 level
  });

  it('breakthroughs keep the potential pyramid stationary', () => {
    for (const z of [-3, -1, 0, 1.5, 2.7, 3.9]) expect(potentialToZ(potentialFromZ(z))).toBeCloseTo(z, 6);
    const rng = createRng(11);
    const pots: number[] = [];
    for (let i = 0; i < 4000; i++) pots.push(potentialFromZ(rng.normal()));
    const above = (xs: number[], t: number) => xs.filter((p) => p > t).length;
    const top0 = above(pots, 2430);
    // 30 breakthroughs each (far more than a career has): the elite tail does not grow.
    for (let k = 0; k < 30; k++) for (let i = 0; i < pots.length; i++) pots[i] = potentialStep(pots[i], rng);
    expect(Math.abs(above(pots, 2430) - top0)).toBeLessThan(top0 * 0.6 + 8);
    expect(Math.abs(pots.reduce((a, b) => a + b, 0) / pots.length - 1270)).toBeLessThan(40);
  });
});

describe('v0.4 rank and title rules', () => {
  it('a dominance promotion enters the next arena only', () => {
    const top = 8; // Miles I, top of arena 2
    const far = ARENAS[5].floor + 50; // natural rank three arenas higher
    const d = decideRank(top, far, false);
    expect(d.kind).toBe('arena-up');
    if (d.kind === 'arena-up') expect(RANKS[d.to].arena).toBe(3);
    expect(decideRank(top, ARENAS[3].floor + TRIAL_BYPASS_MARGIN, false).kind).toBe('arena-up');
  });

  it('the challenger is the strongest qualified contender; title holders of a higher arena are never drafted', () => {
    const w = emptyWorld(5, 3000);
    const arena = 6;
    const pool = w.competitors.filter((c) => RANKS[c.rank].arena === arena && c.games >= 20).sort((a, b) => b.rating - a.rating);
    expect(pool.length).toBeGreaterThan(4);
    const holder = pool[3];
    const ch = championshipChallenger(w, arena, holder.id);
    expect(ch).toBe(pool[0].id === holder.id ? pool[1].id : pool[0].id);
    // The strongest now holds a higher title: the next contender challenges.
    w.titles[arena + 1].holder = pool[0].id;
    pool[0].titles.push(w.titles[arena + 1].id);
    expect(championshipChallenger(w, arena, holder.id)).toBe(pool[1].id);
    // A player who won the arena's Open this season is a candidate only within one arena of it.
    w.history.push({ id: 'tX', name: 'Open', arena, kind: 'open', format: 'swiss', season: w.season, endDay: w.day, winner: PLAYER_ID, winnerName: 'P', runnerUp: null, runnerUpName: '', size: 16, region: 'imperial' });
    expect(championshipChallenger(w, arena, holder.id, { rating: 5000, arena })).toBe(PLAYER_ID);
    expect(championshipChallenger(w, arena, holder.id, { rating: 5000, arena: arena + 3 })).toBe(pool[1].id);
  });
});
