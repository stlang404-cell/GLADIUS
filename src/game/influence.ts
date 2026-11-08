/**
 * Influence — competitive standing. Transparent rules:
 *   EARN   rated win: 2 + opponent arena index; upset (+100 Elo opponent): +3
 *          rated draw vs higher-rated: +1
 *          defeating your rival: +5
 *          tournament prizes (see prizeFor)
 *   DECAY  current Influence × 0.85 at each season boundary (28 days)
 *   SPEND  host an invitational: hostCost(arena); issue a formal challenge: 5
 *   NEVER  affects engine strength, opponents, rules, or rated evaluations.
 * Prestige = lifetime Influence earned; it never decays.
 */
import { legacyScale } from '../world/arenas';

export const SEASON_DECAY = 0.85;
/**
 * v0.3 (24 arenas): every arena-based amount uses the v0.2 scale
 * `legacyScale(arena) = arena / 2`, so the economy keeps its v0.2 balance
 * (e.g. the Eternal Throne, arena 23, pays like the old arena 11).
 */
const L = (arena: number) => legacyScale(arena);
export const CHALLENGE_COST = 5;

export function winInfluence(oppArena: number, oppRating: number, playerRating: number): number {
  return 2 + Math.round(L(oppArena)) + (oppRating >= playerRating + 100 ? 3 : 0);
}
export function drawInfluence(oppRating: number, playerRating: number): number {
  return oppRating > playerRating ? 1 : 0;
}
export function hostCost(arena: number): number {
  return Math.round(30 * (L(arena) + 1));
}
export function invitationalThreshold(arena: number): number {
  return Math.round(15 * (L(arena) + 1));
}
export function championshipThreshold(arena: number): number {
  return Math.round(25 * (L(arena) + 1));
}
export const PRIZE_MULT: Record<string, number> = {
  open: 6, cup: 8, gauntlet: 8, invitational: 10, league: 12, championship: 20, hosted: 6,
  // v0.3
  'local-open': 4, regional: 14, 'regional-defense': 14, qualifier: 5, elite: 16,
};
export function prizeFor(kind: string, arena: number): number {
  return Math.round((PRIZE_MULT[kind] ?? 6) * (L(arena) + 1));
}

/**
 * v0.2 trophy & achievement Influence (player only; modest; also adds to prestige):
 *   signature championship trophy: 10 + arena/2  Imperial Crown: +25
 *   v0.3: regional crown 12 · Imperial Masters 20 · regional defence 6 · Provincial Laurel 5
 *   title defence: 8      Season Laurel: 8       lifetime distinction: 15
 *   historical feat: 20   cups / medals: 0 (already paid through tournament prizes)
 *   achievements: common 2 · rare 5 · epic 10 · legendary 20 (see game/achievements.ts)
 */
export function trophyInfluence(defId: string, arena: number): number {
  if (defId.startsWith('sig-')) return 10 + Math.round(L(arena));
  if (defId === 'imperial-crown') return 25;
  // v0.3
  if (defId.startsWith('rcrown-')) return 12;
  if (defId === 'masters') return 20;
  if (defId === 'rdefense') return 6;
  if (defId === 'rlaurel') return 5;
  if (defId.startsWith('defense-')) return 8;
  if (defId.startsWith('laurel-')) return 8;
  if (defId.startsWith('dist-')) return 15;
  if (defId.startsWith('hist-')) return 20;
  return 0;
}
