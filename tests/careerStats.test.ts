import { describe, it, expect } from 'vitest';
import { computeCareerStats, playerResult } from '../src/game/careerStats';
import type { GameRecord } from '../src/game/state';

function g(i: number, color: 'w' | 'b', result: GameRecord['result'], me: number, opp: number, plies = 60, analysed?: { acc: number; blunder?: number; endgame?: string }): GameRecord {
  const side = (rating: number, id: string) => ({ id, name: id, rating, rank: 0 });
  return {
    id: 'g' + i, kind: 'ranked', rated: true, pool: 'untimed', tc: 'untimed', day: i, date: `2026-01-${String(i).padStart(2, '0')}`,
    white: color === 'w' ? side(me, 'player') : side(opp, 'c1'), black: color === 'b' ? side(me, 'player') : side(opp, 'c1'),
    playerColor: color, startFen: '', moves: [], san: Array(plies).fill('e4'), result, termination: 'checkmate', arena: 0, source: 'player',
    analysis: analysed ? { depth: 12, engine: 'x', moves: [{} as never], accuracy: { w: analysed.acc, b: analysed.acc }, counts: { w: { blunder: analysed.blunder ?? 0 }, b: { blunder: analysed.blunder ?? 0 } }, critical: [], opening: null, endgame: analysed.endgame ?? null } : undefined,
  };
}

describe('career stats', () => {
  it('derives results from colour and result', () => {
    expect(playerResult(g(1, 'w', '1-0', 1200, 1200))).toBe('W');
    expect(playerResult(g(1, 'b', '1-0', 1200, 1200))).toBe('L');
    expect(playerResult(g(1, 'b', '1/2-1/2', 1200, 1200))).toBe('D');
    expect(playerResult(g(1, 'w', '*', 1200, 1200))).toBeNull();
  });
  it('splits colours, bands, streaks and analysis from real records only', () => {
    const recs = [
      g(1, 'w', '1-0', 1200, 1450, 40, { acc: 80, blunder: 1 }),
      g(2, 'b', '0-1', 1210, 1200, 70, { acc: 90, endgame: 'rook' }),
      g(3, 'w', '1-0', 1220, 1000, 20),
      g(4, 'b', '1-0', 1230, 1230, 50),
      g(5, 'w', '1/2-1/2', 1225, 1240, 100),
    ];
    const s = computeCareerStats(recs);
    expect(s.games).toBe(5);
    expect(s.overall).toMatchObject({ w: 3, d: 1, l: 1 });
    expect(s.asWhite).toMatchObject({ w: 2, d: 1, l: 0 });
    expect(s.asBlack).toMatchObject({ w: 1, d: 0, l: 1 });
    expect(s.vsBands[0].wdl.w).toBe(1); // +250 band
    expect(s.vsBands[4].wdl.w).toBe(1); // −220 band
    expect(s.streaks.bestWin).toBe(3);
    expect(s.streaks.unbeaten).toBe(3);
    expect(s.length.shortestWin).toBe(10);
    expect(s.analysed).toBe(2);
    expect(s.accuracy.avg).toBe(85);
    expect(s.quality.blundersPerGame).toBe(0.5);
    expect(s.endgames.games).toBe(1);
  });
  it('is empty without games', () => {
    const s = computeCareerStats([]);
    expect(s.overall.score).toBeNull();
    expect(s.accuracy.avg).toBeNull();
  });
});
