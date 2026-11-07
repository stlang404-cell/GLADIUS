/**
 * Elo rating mathematics (FIDE-style logistic variant with 400-point scale).
 *
 * K-factor policy (modelled on FIDE 2014+ rules, adapted for a game where a
 * human plays many quick games against a persistent simulated pool):
 *   - provisional (< PROVISIONAL_GAMES rated games): K = 40
 *   - established, rating < 2400:                    K = 20
 *   - established, rating ≥ 2400 (or ever peaked ≥ 2400): K = 10
 * Ratings are floored at RATING_FLOOR so they never become meaningless.
 */
export const PROVISIONAL_GAMES = 20;
export const RATING_FLOOR = 100;
export const DEFAULT_RATING = 800;

export type TimeControlPool = 'blitz' | 'rapid' | 'classical' | 'untimed';
export const POOLS: TimeControlPool[] = ['blitz', 'rapid', 'classical', 'untimed'];

export type RatingState = {
  rating: number;
  games: number;
  peak: number;
};

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

export function kFactor(s: RatingState): number {
  if (s.games < PROVISIONAL_GAMES) return 40;
  if (s.rating >= 2400 || s.peak >= 2400) return 10;
  return 20;
}

export function isProvisional(s: RatingState): boolean {
  return s.games < PROVISIONAL_GAMES;
}

/** Rating delta for A after scoring `score` (1, 0.5, 0) against B. */
export function ratingDelta(a: RatingState, opponentRating: number, score: number): number {
  const e = expectedScore(a.rating, opponentRating);
  return Math.round(kFactor(a) * (score - e));
}

export function applyResult(a: RatingState, opponentRating: number, score: number): RatingState {
  const d = ratingDelta(a, opponentRating, score);
  const rating = Math.max(RATING_FLOOR, a.rating + d);
  return { rating, games: a.games + 1, peak: Math.max(a.peak, rating) };
}

/** Score expectation including draws, from a rating gap, used by matchmaking previews. */
export function previewStakes(a: RatingState, opponentRating: number) {
  return {
    win: ratingDelta(a, opponentRating, 1),
    draw: ratingDelta(a, opponentRating, 0.5),
    loss: ratingDelta(a, opponentRating, 0),
    expected: expectedScore(a.rating, opponentRating),
  };
}

/** Tournament performance rating (linear approximation used by FIDE for TPR tables). */
export function performanceRating(opponentRatings: number[], score: number): number {
  if (opponentRatings.length === 0) return 0;
  const avg = opponentRatings.reduce((a, b) => a + b, 0) / opponentRatings.length;
  const p = score / opponentRatings.length;
  const clamped = Math.min(0.99, Math.max(0.01, p));
  return Math.round(avg + 400 * Math.log10(clamped / (1 - clamped)));
}
