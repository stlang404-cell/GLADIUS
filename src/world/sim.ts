import { createRng, mixSeed, clamp, type Rng } from '../core/rng';
import { applyResult, expectedScore, PROVISIONAL_GAMES } from '../rating/elo';
import { ARENAS, RANKS, decideRank } from './arenas';
import { ageYears, createCompetitor, skillCurve, MIN_SKILL, MAX_SKILL } from './population';
import { DAYS_PER_SEASON, type Competitor, type ChronicleEntry, type HallOfRecords } from './types';
import { archiveLegends, snapshotRivalries } from './records';

/**
 * Off-screen statistical simulation ("abstract results").
 *
 * Games between AI competitors that nobody watches are resolved from their
 * hidden true skills with a calibrated win/draw/loss model. They are recorded
 * as results only — never as move lists — and are flagged as simulated.
 * Featured, spectated and player games are played move-by-move by the engine.
 */

export type SimContext = {
  seed: number;
  day: number;
  competitors: Competitor[];
  nextSerial: number;
  chronicle: ChronicleEntry[];
  stats: { simGames: number; retirements: number; debuts: number; promotions: number; calibrations: number };
  /** v0.2 Hall of Records (optional): pruned competitors are archived here first. */
  hall?: HallOfRecords;
};

export const DAILY_ACTIVITY = 0.3;

/** Draw probability rises with playing strength and with closeness of the match. */
export function drawProbability(sa: number, sb: number): number {
  const avg = (sa + sb) / 2;
  const base = clamp(0.04 + (avg - 500) / 4200, 0.03, 0.55);
  const e = expectedScore(sa, sb);
  return Math.min(base, 2 * Math.min(e, 1 - e) * 0.95);
}

/** Returns A's score: 1, 0.5 or 0. Uses true skills (+ small form noise). */
export function simulateGame(a: Competitor, b: Competitor, rng: Rng): number {
  const noise = rng.normal(0, 30);
  const e = expectedScore(a.skill + noise, b.skill);
  const pd = drawProbability(a.skill, b.skill);
  const r = rng.next();
  if (r < e - pd / 2) return 1;
  if (r < e + pd / 2) return 0.5;
  return 0;
}

function bumpH2H(c: Competitor, opp: string, score: number) {
  let h = c.h2h.find((x) => x.id === opp);
  if (!h) {
    h = { id: opp, w: 0, d: 0, l: 0 };
    c.h2h.push(h);
  }
  if (score === 1) h.w++;
  else if (score === 0) h.l++;
  else h.d++;
  if (c.h2h.length > 8) {
    c.h2h.sort((x, y) => y.w + y.d + y.l - (x.w + x.d + x.l));
    c.h2h.length = 8;
  }
}

/** Apply a rated result to a competitor (shared by sim, engine games and player games). */
export function recordCompetitorResult(c: Competitor, oppId: string, oppRating: number, score: number) {
  const before = c.rating;
  const s = applyResult({ rating: c.rating, games: c.games, peak: c.peak }, oppRating, score);
  c.rating = s.rating;
  c.games = s.games;
  c.peak = s.peak;
  if (score === 1) c.w++;
  else if (score === 0) c.l++;
  else c.d++;
  const exp = expectedScore(before, oppRating);
  c.form = clamp(c.form * 0.85 + (score - exp) * 0.15 * 2, -1, 1);
  c.streak = score === 1 ? Math.max(1, c.streak + 1) : score === 0 ? Math.min(-1, c.streak - 1) : 0;
  bumpH2H(c, oppId, score);
}

export function findTrialOpponent(ctx: SimContext, targetArena: number, exclude: string, rng: Rng): Competitor | null {
  const lo = ARENAS[targetArena].floor;
  const cands = ctx.competitors.filter(
    (x) => x.retiredDay === null && x.id !== exclude && RANKS[x.rank].arena === targetArena && x.rating < lo + 160,
  );
  if (cands.length === 0) return null;
  return rng.pick(cands);
}

/** Rank movement for an AI competitor; promotion trials are resolved immediately. */
export function updateCompetitorRank(ctx: SimContext, c: Competitor, rng: Rng) {
  const arenaBefore = RANKS[c.rank].arena;
  rankChange(ctx, c, rng);
  const arenaAfter = RANKS[c.rank].arena;
  if (arenaAfter !== arenaBefore) careerArcEvents(ctx, c, arenaBefore, arenaAfter);
}

/**
 * Career-arc Chronicle entries from real rank changes (each arc once per
 * competitor): a prodigy (under 22) entering the Senate Hall or above, and a
 * fall from the elite (demoted out of the Imperial Palace tier).
 */
function careerArcEvents(ctx: SimContext, c: Competitor, before: number, after: number) {
  if (after > before && after >= 6 && ageYears(c, ctx.day) < 22 && !c.arc?.prodigy) {
    (c.arc ??= {}).prodigy = ctx.day;
    pushChronicle(ctx, {
      day: ctx.day, kind: 'promotion', tag: 'prodigy', arena: after, ids: [c.id],
      text: `Prodigy: ${c.name} of ${c.origin}, aged ${Math.floor(ageYears(c, ctx.day))}, reaches ${ARENAS[after].name}.`,
    });
  }
  if (before >= 9 && after < 9 && (!c.arc?.fell || ctx.day - c.arc.fell > DAYS_PER_SEASON * 8)) {
    (c.arc ??= {}).fell = ctx.day;
    pushChronicle(ctx, {
      day: ctx.day, kind: 'promotion', tag: 'fall-from-elite', arena: before, ids: [c.id],
      text: `${c.name} falls from the elite, leaving ${ARENAS[before].name} (rating ${c.rating}, peak ${c.peak}).`,
    });
  }
}

function rankChange(ctx: SimContext, c: Competitor, rng: Rng) {
  const dec = decideRank(c.rank, c.rating, c.games < PROVISIONAL_GAMES);
  switch (dec.kind) {
    case 'stay':
      return;
    case 'trial-available': {
      if (!rng.chance(0.25)) return; // trials are scheduled, not instant
      const opp = findTrialOpponent(ctx, RANKS[dec.to].arena, c.id, rng);
      if (!opp) {
        c.rank = dec.to;
        break;
      }
      const s = simulateGame(c, opp, rng);
      const cr = c.rating;
      recordCompetitorResult(c, opp.id, opp.rating, s);
      recordCompetitorResult(opp, c.id, cr, 1 - s);
      ctx.stats.simGames++;
      if (s === 1) {
        c.rank = dec.to;
        ctx.stats.promotions++;
        if (RANKS[dec.to].arena >= 8) {
          pushChronicle(ctx, {
            day: ctx.day, kind: 'promotion', arena: RANKS[dec.to].arena, ids: [c.id, opp.id],
            text: `${c.name} won the trial against ${opp.name} and enters ${ARENAS[RANKS[dec.to].arena].name}.`,
          });
        }
      }
      break;
    }
    default:
      c.rank = dec.to;
  }
  c.peakRank = Math.max(c.peakRank, c.rank);
}

export function pushChronicle(ctx: { chronicle: ChronicleEntry[] }, e: ChronicleEntry) {
  ctx.chronicle.push(e);
  if (ctx.chronicle.length > 600) ctx.chronicle.splice(0, ctx.chronicle.length - 600);
}

/** Daily skill development: mean-reverting walk around the age curve. */
export function developSkill(c: Competitor, day: number, rng: Rng) {
  const age = ageYears(c, day);
  if (rng.chance(0.0008)) c.potential = clamp(c.potential + rng.normal(10, 70), 500, MAX_SKILL); // breakthroughs & setbacks
  const target = skillCurve(c.potential, age, c.peakAge);
  c.skill = clamp(c.skill + (target - c.skill) * 0.02 + rng.normal(0, 3.5), MIN_SKILL, MAX_SKILL);
}

export function retirementHazard(age: number): number {
  if (age < 35) return 0.00012;
  if (age < 50) return 0.0004;
  if (age < 60) return 0.0012;
  return 0.004;
}

export type DayOptions = { busy?: Set<string>; activity?: number };

/** Simulate one world day of off-screen rated play, development and turnover. */
export function simulateDay(ctx: SimContext, opts: DayOptions = {}) {
  const rng = createRng(mixSeed(ctx.seed, 'day', ctx.day));
  const activity = opts.activity ?? DAILY_ACTIVITY;
  const active: Competitor[] = [];
  for (const c of ctx.competitors) {
    if (c.retiredDay !== null) continue;
    developSkill(c, ctx.day, rng);
    if (opts.busy?.has(c.id)) continue;
    if (rng.chance(activity)) active.push(c);
  }
  // Skill-based matchmaking: sort by noisy rating, pair neighbours.
  const keyed = active.map((c) => ({ c, k: c.rating + rng.normal(0, 70) }));
  keyed.sort((a, b) => a.k - b.k);
  for (let i = 0; i + 1 < keyed.length; i += 2) {
    const a = keyed[i].c;
    const b = keyed[i + 1].c;
    const s = rng.chance(0.5) ? simulateGame(a, b, rng) : 1 - simulateGame(b, a, rng);
    const ar = a.rating;
    recordCompetitorResult(a, b.id, b.rating, s);
    recordCompetitorResult(b, a.id, ar, 1 - s);
    ctx.stats.simGames++;
  }
  for (const c of active) updateCompetitorRank(ctx, c, rng);

  // Retirement and replacement keeps the population at constant size.
  const taken = new Set<string>();
  let namesLoaded = false;
  for (let i = 0; i < ctx.competitors.length; i++) {
    const c = ctx.competitors[i];
    if (c.retiredDay !== null) continue;
    // Young champions defend or lose their titles first; veterans (38+) may retire as champions
    // (the title is then vacated at the next championship, see calendar.startTournament).
    if (c.titles.length > 0 && ageYears(c, ctx.day) < 38) continue;
    if (!rng.chance(retirementHazard(ageYears(c, ctx.day)))) continue;
    c.retiredDay = ctx.day;
    ctx.stats.retirements++;
    if (c.peakRank >= 24 || c.championships > 0) {
      pushChronicle(ctx, {
        day: ctx.day, kind: 'retirement', tag: 'retirement', ids: [c.id], arena: RANKS[c.peakRank].arena,
        text: `${c.name} retires — peak ${c.peak}, ${c.championships} championship${c.championships === 1 ? '' : 's'}.`,
      });
    }
    if (!namesLoaded) {
      for (const x of ctx.competitors) taken.add(x.name);
      namesLoaded = true;
    }
    const n = createCompetitor(ctx.nextSerial++, ctx.seed, ctx.day, taken, {
      ageYears: clamp(rng.normal(18, 3), 14, 30),
      debutNow: true,
    });
    // Placement: a debutant's first rating is a placement estimate of their strength.
    n.rating = Math.round(clamp(n.skill + rng.normal(0, 60), 100, 3300));
    n.peak = n.rating;
    n.rank = 0;
    n.peakRank = 0;
    n.ratingHistory = [[ctx.day, n.rating]];
    ctx.competitors.push(n);
    ctx.stats.debuts++;
    // (v0.2) Debuts are no longer announced from hidden potential; prodigies
    // are chronicled when their results carry them into the elite arenas.
  }

  if ((ctx.day + 1) % DAYS_PER_SEASON === 0) seasonBoundary(ctx);
  ctx.day++;
}

/**
 * Season boundary: rating history sample, and the Imperial Census —
 * a transparent anti-drift calibration. Closed Elo pools drift (improving
 * juniors drain points; retirees remove points). Because AI ratings are
 * meant to measure engine-calibrated strength, the census shifts all active
 * AI ratings so the established-pool mean of (rating − skill) returns to 0.
 */
export function seasonBoundary(ctx: SimContext) {
  let sum = 0;
  let n = 0;
  for (const c of ctx.competitors) {
    if (c.retiredDay !== null || c.games < PROVISIONAL_GAMES) continue;
    sum += c.rating - c.skill;
    n++;
  }
  const bias = n ? sum / n : 0;
  if (Math.abs(bias) >= 5) {
    const shift = Math.round(-bias);
    for (const c of ctx.competitors) if (c.retiredDay === null) c.rating = Math.max(100, c.rating + shift);
    ctx.stats.calibrations++;
  }
  // Breakthroughs: the season's largest real rating jumps into the upper arenas.
  const jumps: { c: Competitor; d: number }[] = [];
  for (const c of ctx.competitors) {
    if (c.retiredDay !== null || c.games < 60 || c.rating < 1900) continue;
    const last = c.ratingHistory[c.ratingHistory.length - 1];
    if (!last || ctx.day - last[0] > DAYS_PER_SEASON + 1) continue;
    const d = c.rating - last[1];
    if (d >= 150 && (!c.arc?.breakthrough || ctx.day - c.arc.breakthrough > DAYS_PER_SEASON * 8)) jumps.push({ c, d });
  }
  jumps.sort((a, b) => b.d - a.d || (a.c.id < b.c.id ? -1 : 1));
  for (const { c, d } of jumps.slice(0, 2)) {
    (c.arc ??= {}).breakthrough = ctx.day;
    pushChronicle(ctx, { day: ctx.day, kind: 'record', tag: 'breakthrough', ids: [c.id], arena: RANKS[c.rank].arena, text: `Breakthrough: ${c.name} gains ${d} points this season to reach ${c.rating}.` });
  }
  if (ctx.hall) snapshotRivalries(ctx.hall, ctx.competitors, ctx.day);
  // Prune retired competitors beyond a generous archive to bound save size.
  const retired = ctx.competitors.filter((c) => c.retiredDay !== null);
  if (retired.length > 1500) {
    const keep = new Set(
      retired
        .sort((a, b) => b.championships * 10000 + b.peak - (a.championships * 10000 + a.peak))
        .slice(0, 1500)
        .map((c) => c.id),
    );
    const drop = (c: Competitor) => !(c.retiredDay === null || keep.has(c.id) || c.titles.length > 0);
    // Records must survive pruning: archive compact snapshots first.
    if (ctx.hall) archiveLegends(ctx.hall, ctx.competitors.filter(drop));
    ctx.competitors = ctx.competitors.filter((c) => !drop(c));
  }
  for (const c of ctx.competitors) {
    if (c.retiredDay !== null) continue;
    c.ratingHistory.push([ctx.day, c.rating]);
    if (c.ratingHistory.length > 48) c.ratingHistory.splice(0, c.ratingHistory.length - 48);
  }
}

export function activeCompetitors(ctx: { competitors: Competitor[] }): Competitor[] {
  return ctx.competitors.filter((c) => c.retiredDay === null);
}
