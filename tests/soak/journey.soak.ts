/**
 * Zero-to-emperor soak (`npm run soak`, not part of `npm test`): the
 * tests/journey.test.ts scenario in the full 25,000-competitor empire after the
 * standard 8-season burn-in, for two seeds, holding the Eternal Throne through
 * three defences. Same driver (tests/helpers/journey.ts): real career API, the
 * world's own outcome model, a player whose strength rises from ≈ 450 to 3,300.
 */
import { describe, it, expect } from 'vitest';
import { makeJourneySave, runJourney, risingSkill } from '../helpers/journey';
import { RANKS, RANK_COUNT, ARENA_COUNT, TOP_ARENA } from '../../src/world/arenas';
import { PLAYER_ID } from '../../src/world/calendar';
import { awardsFor, isVictory } from '../../src/world/trophies';
import { computeCareerStats } from '../../src/game/careerStats';
import { BURN_IN_SEASONS } from '../../src/world/world';
import { POPULATION_SIZE } from '../../src/world/population';

describe('soak: zero to emperor in the full empire', () => {
  for (const seed of [777, 20260]) {
    it(`seed ${seed}: every arena and grade in order, the Eternal Throne won and defended three times`, () => {
      const opts = { seed, population: POPULATION_SIZE, burnInSeasons: BURN_IN_SEASONS, skill: risingSkill(900), maxGames: 3000, emperorDefences: 3 };
      const t0 = performance.now();
      const s = makeJourneySave(opts);
      const worldMs = performance.now() - t0;
      const log = runJourney(s, opts);
      const p = s.player;
      console.log(JSON.stringify({
        seed, worldMs: Math.round(worldMs), journeyMs: Math.round(log.ms), games: log.records.length, days: s.world.day - p.createdDay, emperorDay: log.emperorDay,
        placement: p.placement?.done, events: log.entries.length, won: p.tournamentsWon, championships: p.championships, achievements: Object.keys(p.achievements).length,
        awards: awardsFor(s.world, PLAYER_ID).length, rating: p.ratings[s.settings.careerPool].rating,
      }));
      const arenas: number[] = [];
      for (const r of log.firstVisits) if (!arenas.includes(RANKS[r].arena)) arenas.push(RANKS[r].arena);
      expect(arenas).toEqual(Array.from({ length: ARENA_COUNT }, (_, i) => i));
      // Above the placement grade every grade is held, in order; below it the verdict may skip grades (held by AI: reachable).
      const placed = p.placement!.done!.rank;
      expect(log.firstVisits.filter((r) => r > placed)).toEqual(Array.from({ length: RANK_COUNT - 1 - placed }, (_, i) => placed + 1 + i));
      for (let g = 0; g < placed; g++) expect(s.world.competitors.some((c) => c.retiredDay === null && c.rank === g)).toBe(true);
      const reign = s.world.reigns.find((r) => r.titleId === `title-${TOP_ARENA}` && r.holder === PLAYER_ID && r.to === null)!;
      expect(reign.defenses).toBeGreaterThanOrEqual(3);
      const aw = awardsFor(s.world, PLAYER_ID);
      expect(new Set(aw.map((a) => a.awardId)).size).toBe(aw.length);
      expect(aw.filter(isVictory).length).toBe(p.tournamentsWon);
      const st = computeCareerStats(log.records);
      expect([st.overall.w, st.overall.d, st.overall.l]).toEqual([p.w, p.d, p.l]);
    }, 30 * 60 * 1000);
  }
});
