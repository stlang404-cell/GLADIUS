import { createRng, mixSeed, clamp, type Rng } from '../core/rng';
import { generateName } from './names';
import { naturalRank } from './arenas';
import { applyResult } from '../rating/elo';
import { TRAITS, DAYS_PER_YEAR, type Competitor, type Trait } from './types';
import { regionForOrigin } from './regions';
import { type PlayStyle, STYLE_TO_OPENINGS, PLAY_STYLES } from '../engine/styles';

/** v0.3: 25,000 persistent competitors (architected for 50,000+: indexes, no O(n²)). */
export const POPULATION_SIZE = 25000;
/** v0.2 population size (old saves; migration grows them to POPULATION_SIZE). */
export const POPULATION_SIZE_V2 = 5000;
export const MIN_SKILL = 250;
export const MAX_SKILL = 3150;

const STYLES: PlayStyle[] = PLAY_STYLES;

/**
 * Potential (career-peak strength), v0.3 competitive pyramid.
 *
 * A piecewise-linear transform of a standard normal draw: a broad base of
 * developing players, a thinner expert band and a very thin elite. The knots
 * are chosen for a 25,000-strong empire (≈ 1 in 740 can reach 2710, ≈ 1 in
 * 4,300 can reach 2900, ≈ 1 in 31,000 can reach 3040); a larger population
 * simply has proportionally more elite (no per-size tuning, no O(n) step).
 * The v0.2 sampler (`samplePotentialV2`) had a quadratic tail that produced
 * dozens of 3000+ players at 25k; it is kept for reference/tests only.
 */
const POT_KNOTS: [number, number][] = [[-4, 420], [-2, 560], [-1, 850], [0, 1250], [1, 1680], [2, 2150], [2.5, 2430], [3, 2710], [3.5, 2900], [4, 3040], [4.6, 3140]];
export function potentialFromZ(z: number): number {
  const k = POT_KNOTS;
  if (z <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (z <= k[i][0]) {
      const [z0, p0] = k[i - 1];
      const [z1, p1] = k[i];
      return p0 + ((z - z0) / (z1 - z0)) * (p1 - p0);
    }
  }
  return MAX_SKILL;
}
/** Inverse of `potentialFromZ` on the knot range (monotone piecewise-linear). */
export function potentialToZ(p: number): number {
  const k = POT_KNOTS;
  if (p <= k[0][1]) return k[0][0];
  for (let i = 1; i < k.length; i++) {
    if (p <= k[i][1]) {
      const [z0, p0] = k[i - 1];
      const [z1, p1] = k[i];
      return z0 + ((p - p0) / (p1 - p0)) * (z1 - z0);
    }
  }
  return k[k.length - 1][0];
}
/**
 * v0.4 breakthroughs & setbacks: an AR(1) step in the normal space of the
 * potential pyramid, z' = ρ·z + √(1 − ρ²)·ε. It keeps the marginal N(0, 1),
 * so the competitive pyramid is stationary (v0.3 added N(+10, 70) points per
 * event: zero mean-reversion and a positive mean fattened the elite tail over
 * the decades — 2 → 4 potentials above 3000 and 5 → 10 skills above 2800 in
 * 40 seasons). One event moves a mid-table potential by ≈ ±70 points, as before.
 */
export const BREAKTHROUGH_RHO = 0.985;
export function potentialStep(potential: number, rng: Rng): number {
  const z = potentialToZ(potential);
  const z2 = BREAKTHROUGH_RHO * z + Math.sqrt(1 - BREAKTHROUGH_RHO * BREAKTHROUGH_RHO) * rng.normal();
  return clamp(potentialFromZ(z2), 500, MAX_SKILL);
}
export function samplePotential(rng: Rng): number {
  return clamp(potentialFromZ(rng.normal()), 500, MAX_SKILL);
}
/** v0.2 sampler (quadratic upper tail). Not used by the simulation any more. */
export function samplePotentialV2(rng: Rng): number {
  const z = rng.normal();
  const tail = z > 1 ? 230 * (z - 1) * (z - 1) : 0;
  return clamp(1250 + 430 * z + tail, 500, MAX_SKILL);
}

/** Skill as a function of age for a given potential (deterministic curve). */
export function skillCurve(potential: number, ageYears: number, peakAge: number): number {
  const start = Math.min(potential, 350 + potential * 0.25);
  if (ageYears <= peakAge) {
    // Rapid early growth, decelerating towards the potential.
    const t = clamp((ageYears - 14) / Math.max(1, peakAge - 14), 0, 1);
    return start + (potential - start) * (1 - Math.pow(1 - t, 2.2));
  }
  const over = ageYears - peakAge;
  // Gentle decline: ~6 Elo/yr at first, accelerating slowly.
  return Math.max(start, potential - 6 * over - 0.35 * over * over);
}

function pickTraits(rng: Rng): { strengths: Trait[]; weaknesses: Trait[] } {
  const pool = [...TRAITS];
  const take = () => pool.splice(rng.int(0, pool.length), 1)[0];
  const strengths = [take(), ...(rng.chance(0.5) ? [take()] : [])];
  const weaknesses = [take(), ...(rng.chance(0.35) ? [take()] : [])];
  return { strengths, weaknesses };
}

export function makeId(serial: number): string {
  return 'c' + String(serial).padStart(6, '0');
}

export function createCompetitor(
  serial: number,
  worldSeed: number,
  day: number,
  taken: Set<string>,
  opts: { ageYears?: number; debutNow?: boolean } = {},
): Competitor {
  const rng = createRng(mixSeed(worldSeed, 'competitor', serial));
  const female = rng.chance(0.42);
  const { name, origin } = generateName(rng, female, taken);
  const potential = samplePotential(rng);
  const peakAge = clamp(Math.round(rng.normal(31, 4)), 22, 42);
  const age = opts.ageYears ?? clamp(rng.normal(32, 11), 16, 62);
  const careerYears = opts.debutNow ? 0 : clamp(age - 15 - rng.next() * 6, 0, 45);
  const skill = clamp(skillCurve(potential, age, peakAge) + rng.normal(0, 40), MIN_SKILL, MAX_SKILL);
  const style = rng.pick(STYLES);
  const rating = Math.round(clamp(skill + rng.normal(0, 35), 100, 3300));
  const traits = pickTraits(rng);
  const games = opts.debutNow ? 0 : Math.round(careerYears * (40 + rng.next() * 60));
  return {
    id: makeId(serial),
    name,
    female,
    origin,
    portraitSeed: mixSeed(worldSeed, 'portrait', serial),
    birthDay: Math.round(day - age * DAYS_PER_YEAR) || 0, // never -0 (JSON would not round-trip it)
    debutDay: Math.round(day - careerYears * DAYS_PER_YEAR) || 0,
    skill,
    potential,
    peakAge,
    rating,
    peak: rating,
    games,
    w: 0,
    d: 0,
    l: 0,
    rank: naturalRank(rating),
    peakRank: naturalRank(rating),
    style,
    openingStyles: STYLE_TO_OPENINGS[style],
    strengths: traits.strengths,
    weaknesses: traits.weaknesses,
    form: 0,
    streak: 0,
    tournamentsWon: 0,
    championships: 0,
    titles: [],
    honours: [],
    ratingHistory: [[day, rating]],
    h2h: [],
    retiredDay: null,
    region: regionForOrigin(origin, serial),
    tp: 0,
    last: 0,
  };
}

/**
 * Pre-history W/D/L consistent with the games count (games before the
 * simulation started are recorded in aggregate only — no move records).
 */
export function seedRecord(c: Competitor, rng: Rng) {
  const drawRate = clamp(0.08 + (c.skill - 600) / 5000, 0.06, 0.4);
  const d = Math.round(c.games * drawRate);
  const winShare = clamp(0.5 + rng.normal(0, 0.04), 0.35, 0.65);
  const w = Math.round((c.games - d) * winShare);
  c.w = w;
  c.d = d;
  c.l = c.games - w - d;
}

export function ageYears(c: Competitor, day: number): number {
  return (day - c.birthDay) / DAYS_PER_YEAR;
}

export function generatePopulation(worldSeed: number, size = POPULATION_SIZE, day = 0, firstSerial = 1, taken = new Set<string>()): Competitor[] {
  const out: Competitor[] = [];
  for (let i = firstSerial; i < firstSerial + size; i++) {
    const c = createCompetitor(i, worldSeed, day, taken);
    seedRecord(c, createRng(mixSeed(worldSeed, 'record', i)));
    out.push(c);
  }
  return out;
}

export { applyResult };
