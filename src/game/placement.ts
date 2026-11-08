/**
 * v0.4 "zero to emperor" opening of a career: placement and early-career
 * milestones. Everything here is read from real records (rated games, rank
 * history, tournament history, the award registry); nothing is granted.
 *
 * Placement (careers created from v0.4; older saves keep the v0.3 rule): the
 * first PLACEMENT_GAMES rated games are placement games. The rank stays at
 * Tiro III (grade 1 of 72) while they are played; the rating moves by the
 * usual provisional Elo (K 40) from the provisional seed. The verdict after
 * the last one sets the rating to the placement performance (FIDE-style
 * initial rating: average opponent + 400·log10(p / (1 − p)), p clamped to
 * [1/(2n), 1 − 1/(2n)]) and places the rank at the grade that rating
 * corresponds to, at most PLACEMENT_MAX_RANK (Decanus I, the top of the
 * gladiatorial school) — several grades at once for a strong newcomer. After
 * placement the standard rules apply (at most one grade up per rated game,
 * Promotion Trial or dominance to cross into the next arena).
 */
import { clamp } from '../core/rng';
import { DEFAULT_RATING } from '../rating/elo';
import { RANKS, ARENAS } from '../world/arenas';
import { PLAYER_ID } from '../world/calendar';
import { awardsFor, isVictory } from '../world/trophies';
import type { Save } from './state';

export const PLACEMENT_GAMES = 10;
/** Highest grade a placement verdict can give: Decanus I (arena 5, top of the gladiatorial school). */
export const PLACEMENT_MAX_RANK = 17;

/** Placement performance: average opponent + 400·log10(p / (1 − p)), p clamped to [1/(2n), 1 − 1/(2n)]. */
export function placementPerformance(opp: number[], score: number): number {
  const n = opp.length;
  if (!n) return DEFAULT_RATING;
  const avg = opp.reduce((a, b) => a + b, 0) / n;
  const p = clamp(score / n, 1 / (2 * n), 1 - 1 / (2 * n));
  return Math.round(avg + 400 * Math.log10(p / (1 - p)));
}

/** Placement in progress (v0.4 careers); null for older saves or once the verdict is in. */
export function placementStatus(s: Save): { games: number; of: number; score: number; performance: number | null } | null {
  const pl = s.player.placement;
  if (!pl || pl.done) return null;
  return { games: pl.games, of: PLACEMENT_GAMES, score: pl.score, performance: pl.games ? placementPerformance(pl.opp, pl.score) : null };
}

export type MilestoneId = 'placement' | 'first-win' | 'first-promotion' | 'first-tournament' | 'first-regional' | 'first-trial' | 'first-trophy' | 'first-arena';
export type CareerMilestone = {
  id: MilestoneId;
  title: string;
  /** How to achieve it, in words (the rule, not a reward). */
  detail: string;
  done: boolean;
  /** Day it was achieved, when known from the records. */
  day?: number;
};

const regionalKind = (k: string) => k === 'local-open' || k === 'regional' || k === 'regional-defense';

/**
 * Early-career milestones, in the order they teach the system: placement →
 * first win → first promotion → first tournament → first regional event →
 * first Promotion Trial → first trophy → a new arena. Derived from the
 * records only (pure). `objectives()` offers the first one not yet done.
 */
export function careerMilestones(s: Save): CareerMilestone[] {
  const p = s.player;
  const w = s.world;
  const pl = p.placement;
  const entered = (pred: (kind: string) => boolean) =>
    w.history.some((h) => h.playerPlace !== undefined && pred(h.kind)) || w.tournaments.some((t) => t.playerEntered && !t.playerWithdrawn && t.status !== 'scheduled' && pred(t.kind));
  const promo = p.rankHistory.find((r) => r.rank > 0 && r.reason !== 'Enlisted' && r.reason !== 'Demotion');
  const victories = awardsFor(w, PLAYER_ID).filter(isVictory);
  const firstArena = p.rankHistory.find((r) => RANKS[r.rank].arena > 0);
  const trials = p.ledger?.c.trialsWon ?? 0;
  const placed = pl ? !!pl.done : p.ratings[s.settings.careerPool].games >= 20;
  return [
    { id: 'placement', title: 'Complete your placement', detail: pl ? `Play ${pl.done ? 0 : PLACEMENT_GAMES - pl.games} more rated game(s): your placement performance sets your rating and may lift you several grades at once (up to ${RANKS[PLACEMENT_MAX_RANK].name}).` : 'Establish your rating with 20 rated games.', done: placed, day: pl?.done?.day },
    { id: 'first-win', title: 'Win your first rated game', detail: 'Beat an opponent in a rated game.', done: p.w > 0 },
    { id: 'first-promotion', title: 'Earn your first promotion', detail: `Raise your rating to the next grade floor (${RANKS[Math.min(RANKS.length - 1, p.rank + 1)].floor}) or earn it in placement.`, done: !!promo, day: promo?.day },
    { id: 'first-tournament', title: 'Play your first tournament', detail: `Register for an Open or League of ${ARENAS[RANKS[p.rank].arena].name} (offered in your invitations).`, done: p.tournamentsPlayed > 0 || entered(() => true) },
    { id: 'first-regional', title: 'Enter your region\'s Local Open', detail: 'Every season (day 3) your region holds a Local Open for arenas 0–7 and 8–15: register when it is offered.', done: entered(regionalKind) },
    { id: 'first-trial', title: 'Win a Promotion Trial', detail: 'At the top grade of an arena, reaching the next arena floor earns a trial: win it to enter the next arena.', done: trials > 0 },
    { id: 'first-trophy', title: 'Win your first trophy', detail: 'Win any tournament.', done: victories.length > 0, day: victories[0]?.day },
    { id: 'first-arena', title: `Leave the ${ARENAS[0].name}`, detail: `Reach ${ARENAS[1].name} (${ARENAS[1].floor}) by a trial or by dominance.`, done: !!firstArena, day: firstArena?.day },
  ];
}
