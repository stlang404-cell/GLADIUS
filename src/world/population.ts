import { createRng, mixSeed, clamp, type Rng } from '../core/rng';
import { generateName } from './names';
import { naturalRank } from './arenas';
import { applyResult } from '../rating/elo';
import { TRAITS, DAYS_PER_YEAR, type Competitor, type Trait } from './types';
import { type PlayStyle, STYLE_TO_OPENINGS, PLAY_STYLES } from '../engine/styles';

export const POPULATION_SIZE = 5000;
export const MIN_SKILL = 250;
export const MAX_SKILL = 3150;

const STYLES: PlayStyle[] = PLAY_STYLES;

/**
 * Potential (career-peak strength). A normal core with a stretched upper tail
 * so the empire has a broad base and a thin, contested elite.
 */
export function samplePotential(rng: Rng): number {
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
    birthDay: Math.round(day - age * DAYS_PER_YEAR),
    debutDay: Math.round(day - careerYears * DAYS_PER_YEAR),
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

export function generatePopulation(worldSeed: number, size = POPULATION_SIZE, day = 0): Competitor[] {
  const taken = new Set<string>();
  const out: Competitor[] = [];
  for (let i = 1; i <= size; i++) {
    const c = createCompetitor(i, worldSeed, day, taken);
    seedRecord(c, createRng(mixSeed(worldSeed, 'record', i)));
    out.push(c);
  }
  return out;
}

export { applyResult };
