import { describe, it, expect } from 'vitest';
import { expectedScore, applyResult, kFactor, ratingDelta, performanceRating } from '../src/rating/elo';

describe('Elo', () => {
  it('expected score symmetric and correct', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
    expect(expectedScore(1900, 1500)).toBeCloseTo(0.909, 2);
    expect(expectedScore(1500, 1900) + expectedScore(1900, 1500)).toBeCloseTo(1);
  });
  it('K-factor tiers', () => {
    expect(kFactor({ rating: 800, games: 0, peak: 800 })).toBe(40);
    expect(kFactor({ rating: 1800, games: 50, peak: 1800 })).toBe(20);
    expect(kFactor({ rating: 2300, games: 50, peak: 2450 })).toBe(10);
  });
  it('win vs equal established player gives +10', () => {
    expect(ratingDelta({ rating: 1500, games: 100, peak: 1500 }, 1500, 1)).toBe(10);
    expect(ratingDelta({ rating: 1500, games: 100, peak: 1500 }, 1500, 0.5)).toBe(0);
  });
  it('applyResult tracks peak and games', () => {
    const s = applyResult({ rating: 1000, games: 0, peak: 1000 }, 1000, 1);
    expect(s).toEqual({ rating: 1020, games: 1, peak: 1020 });
    const t = applyResult(s, 1000, 0);
    expect(t.peak).toBe(1020);
    expect(t.rating).toBeLessThan(1020);
  });
  it('performance rating', () => {
    expect(performanceRating([1500, 1500], 1)).toBe(1500);
    expect(performanceRating([1500, 1500, 1500, 1500], 3)).toBeGreaterThan(1650);
  });
});
