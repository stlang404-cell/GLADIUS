import { createRng, mixSeed, clamp, type Rng } from '../core/rng';
import { expectedScore, PROVISIONAL_GAMES, RATING_FLOOR } from '../rating/elo';
import { ARENAS, RANKS, decideRank } from './arenas';
import { ageYears, createCompetitor, skillCurve, MIN_SKILL, MAX_SKILL } from './population';
import { DAYS_PER_SEASON, type Competitor, type ChronicleEntry, type HallOfRecords, type H2H } from './types';
import { archiveLegends, snapshotRivalries } from './records';
import { activeInArena, nameSet, invalidateNames, regionOf } from './indexes';
import { REGION_BY_ID } from './regions';
import { STYLE_TO_OPENINGS, normalizeStyle, type PlayStyle } from '../engine/styles';

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
  /** v0.3: Chronicle entries dropped by the cap (the chronicle stays bounded). */
  chronicleArchived?: number;
};

/** Chronicle cap (v0.3): at most CHRONICLE_CAP + CHRONICLE_SLACK entries in memory; trimmed in batches so the persisted chunks shift rarely. */
export const CHRONICLE_CAP = 1000;
export const CHRONICLE_SLACK = 200;
/** Skill development and the retirement check run for each competitor every DEV_EVERY / RETIRE_EVERY days (bucketed by portrait seed), with equivalent multi-day steps. */
export const DEV_EVERY = 4;
export const RETIRE_EVERY = 7;
/** Retired competitors kept as full records before the archive pruning (compact legends survive pruning). */
export const RETIRED_ARCHIVE = 1500;
export const RETIRED_PRUNE_SLACK = 500;

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

/**
 * Head-to-head list (capped at H2H_CAP). v0.3 fix: v0.2 sorted and truncated
 * after appending, which always dropped the newcomer, so a full list froze on
 * the first eight opponents ever met. Now a newcomer replaces the least-played
 * entry (earliest on ties), so the list holds the most-played and the recent
 * opponents. O(cap).
 */
export const H2H_CAP = 8;
function bumpH2H(c: Competitor, opp: string, score: number) {
  const list = c.h2h;
  let h: H2H | undefined;
  for (let i = 0; i < list.length; i++) if (list[i].id === opp) { h = list[i]; break; }
  if (!h) {
    h = { id: opp, w: 0, d: 0, l: 0 };
    if (list.length < H2H_CAP) list.push(h);
    else {
      let min = 0;
      let minG = Infinity;
      for (let i = 0; i < list.length; i++) {
        const g = list[i].w + list[i].d + list[i].l;
        if (g < minG) { minG = g; min = i; }
      }
      list[min] = h;
    }
  }
  if (score === 1) h.w++;
  else if (score === 0) h.l++;
  else h.d++;
}

/** Apply a rated result to a competitor (shared by sim, engine games and player games). Same rules as rating/elo.applyResult, inlined (hot path). */
const EXP_RANGE = 4000;
const EXP_TABLE = (() => {
  const t = new Float64Array(2 * EXP_RANGE + 1);
  for (let d = -EXP_RANGE; d <= EXP_RANGE; d++) t[d + EXP_RANGE] = 1 / (1 + Math.pow(10, d / 400));
  return t;
})();
/** Elo expectation for a rating difference (opp − own); table lookup for integer gaps. Identical values to expectedScore. */
function expGap(d: number): number {
  return (d | 0) === d && d >= -EXP_RANGE && d <= EXP_RANGE ? EXP_TABLE[d + EXP_RANGE] : 1 / (1 + Math.pow(10, d / 400));
}
export function recordCompetitorResult(c: Competitor, oppId: string, oppRating: number, score: number) {
  const exp = expGap(oppRating - c.rating);
  const k = c.games < PROVISIONAL_GAMES ? 40 : c.rating >= 2400 || c.peak >= 2400 ? 10 : 20;
  const rating = Math.max(RATING_FLOOR, c.rating + Math.round(k * (score - exp)));
  c.rating = rating;
  c.games++;
  if (rating > c.peak) c.peak = rating;
  if (score === 1) c.w++;
  else if (score === 0) c.l++;
  else c.d++;
  c.form = clamp(c.form * 0.85 + (score - exp) * 0.15 * 2, -1, 1);
  c.streak = score === 1 ? Math.max(1, c.streak + 1) : score === 0 ? Math.min(-1, c.streak - 1) : 0;
  c.last = (((c.last ?? 0) << 2) | (score === 1 ? 3 : score === 0 ? 1 : 2)) & 0xfffff;
  bumpH2H(c, oppId, score);
}

/** Recent results, newest first ('W' | 'D' | 'L'), from the packed `last` field (up to 10). */
export function recentResults(c: Pick<Competitor, 'last'>, n = 10): ('W' | 'D' | 'L')[] {
  const out: ('W' | 'D' | 'L')[] = [];
  let x = c.last ?? 0;
  for (let i = 0; i < Math.min(10, n); i++) {
    const v = x & 3;
    if (!v) break;
    out.push(v === 3 ? 'W' : v === 2 ? 'D' : 'L');
    x >>>= 2;
  }
  return out;
}

export function findTrialOpponent(ctx: SimContext, targetArena: number, exclude: string, rng: Rng): Competitor | null {
  const lo = ARENAS[targetArena].floor;
  const pool = activeInArena(ctx, targetArena);
  const ok = (x: Competitor) => x.retiredDay === null && x.id !== exclude && RANKS[x.rank].arena === targetArena && x.rating < lo + 160;
  if (pool.length === 0) return null;
  // Uniform choice among eligible opponents: rejection sampling, then an exact scan.
  for (let i = 0; i < 24; i++) {
    const x = pool[rng.int(0, pool.length)];
    if (ok(x)) return x;
  }
  const cands = pool.filter(ok);
  return cands.length ? rng.pick(cands) : null;
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
 * competitor): a prodigy (under 22) entering the Senate Hall (arena 12) or above, and a
 * fall from the elite (demoted out of arena 18+, the Imperial Palace tier).
 */
function careerArcEvents(ctx: SimContext, c: Competitor, before: number, after: number) {
  if (after > before && after >= 12 && ageYears(c, ctx.day) < 22 && !c.arc?.prodigy) {
    (c.arc ??= {}).prodigy = ctx.day;
    pushChronicle(ctx, {
      day: ctx.day, kind: 'promotion', tag: 'prodigy', arena: after, ids: [c.id],
      text: `Prodigy: ${c.name} of ${c.origin}, aged ${Math.floor(ageYears(c, ctx.day))}, reaches ${ARENAS[after].name}.`,
    });
  }
  if (before >= 18 && after < 18 && (!c.arc?.fell || ctx.day - c.arc.fell > DAYS_PER_SEASON * 8)) {
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
        if (RANKS[dec.to].arena >= 16) {
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

export function pushChronicle(ctx: { chronicle: ChronicleEntry[]; chronicleArchived?: number }, e: ChronicleEntry) {
  ctx.chronicle.push(e);
  if (ctx.chronicle.length > CHRONICLE_CAP + CHRONICLE_SLACK) {
    const drop = ctx.chronicle.length - CHRONICLE_CAP;
    ctx.chronicle.splice(0, drop);
    ctx.chronicleArchived = (ctx.chronicleArchived ?? 0) + drop;
  }
}

/** Daily skill development: mean-reverting walk around the age curve. */
export function developSkill(c: Competitor, day: number, rng: Rng, steps = 1) {
  const age = ageYears(c, day);
  if (rng.chance(0.0008 * steps)) c.potential = clamp(c.potential + rng.normal(10, 70), 500, MAX_SKILL); // breakthroughs & setbacks
  const target = skillCurve(c.potential, age, c.peakAge);
  // `steps` days at once: same mean reversion (1 − 0.98^steps) and variance (σ√steps) as daily steps.
  const k = steps === 1 ? 0.02 : 1 - Math.pow(0.98, steps);
  c.skill = clamp(c.skill + (target - c.skill) * k + rng.normal(0, 3.5 * Math.sqrt(steps)), MIN_SKILL, MAX_SKILL);
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
  const dev = ctx.day % DEV_EVERY;
  const ret = ctx.day % RETIRE_EVERY;
  const retireCheck: Competitor[] = [];
  for (const c of ctx.competitors) {
    if (c.retiredDay !== null) continue;
    // Bucketed by portrait seed: each competitor develops every DEV_EVERY days (multi-day step).
    if (((c.portraitSeed >>> 0) % DEV_EVERY) === dev) developSkill(c, ctx.day, rng, DEV_EVERY);
    if (((c.portraitSeed >>> 3) % RETIRE_EVERY) === ret) retireCheck.push(c);
    if (opts.busy?.has(c.id)) continue;
    if (rng.chance(activity)) active.push(c);
  }
  // Skill-based matchmaking: sort by noisy rating, pair neighbours.
  // Packed native sort: (noisy rating, quantised to 1/16, offset to stay positive) · 2^20 + index.
  const n = active.length;
  const packed = new Float64Array(n);
  for (let i = 0; i < n; i++) packed[i] = Math.floor((active[i].rating + rng.normal(0, 70) + 2000) * 16) * 1048576 + i;
  packed.sort();
  for (let i = 0; i + 1 < n; i += 2) {
    const a = active[packed[i] % 1048576];
    const b = active[packed[i + 1] % 1048576];
    const s = rng.chance(0.5) ? simulateGame(a, b, rng) : 1 - simulateGame(b, a, rng);
    const ar = a.rating;
    recordCompetitorResult(a, b.id, b.rating, s);
    recordCompetitorResult(b, a.id, ar, 1 - s);
    ctx.stats.simGames++;
  }
  for (const c of active) updateCompetitorRank(ctx, c, rng);

  // Retirement and replacement keeps the population at constant size.
  // Each competitor is checked every RETIRE_EVERY days with the equivalent multi-day hazard.
  for (const c of retireCheck) {
    if (c.retiredDay !== null) continue;
    // Young champions defend or lose their titles first; veterans (38+) may retire as champions
    // (the title is then vacated at once, see calendar.advanceDay).
    const age = ageYears(c, ctx.day);
    if (c.titles.length > 0 && age < 38) continue;
    const h = retirementHazard(age);
    if (!rng.chance(1 - Math.pow(1 - h, RETIRE_EVERY))) continue;
    c.retiredDay = ctx.day;
    ctx.stats.retirements++;
    retirementChronicle(ctx, c, age);
    const n = createCompetitor(ctx.nextSerial++, ctx.seed, ctx.day, nameSet(ctx), {
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
 * Retirement Chronicle entries (event-driven): champions and the elite
 * ('retirement'), and long-serving veterans of the senatorial arenas
 * ('veteran-retirement': 20+ career years or 2,500+ games, peak in arena 10+).
 */
function retirementChronicle(ctx: SimContext, c: Competitor, age: number) {
  const region = REGION_BY_ID[regionOf(c)].name;
  if (RANKS[c.peakRank].arena >= 16 || c.championships > 0) {
    pushChronicle(ctx, {
      day: ctx.day, kind: 'retirement', tag: 'retirement', ids: [c.id], arena: RANKS[c.peakRank].arena, region: regionOf(c),
      text: `${c.name} retires — peak ${c.peak}, ${c.championships} championship${c.championships === 1 ? '' : 's'}.`,
    });
    return;
  }
  const years = (ctx.day - c.debutDay) / (DAYS_PER_SEASON * 4);
  if (RANKS[c.peakRank].arena >= 10 && (years >= 20 || c.games >= 2500)) {
    pushChronicle(ctx, {
      day: ctx.day, kind: 'retirement', tag: 'veteran-retirement', ids: [c.id], arena: RANKS[c.peakRank].arena, region: regionOf(c),
      text: `Veteran ${c.name} of ${region} retires at ${Math.floor(age)} after ${Math.round(years)} years and ${c.games.toLocaleString('en-US')} games (peak ${c.peak}).`,
    });
  }
}

/**
 * Rule-based style drift (season boundary, at most once per 8 seasons per
 * competitor, deterministic): veterans (35+) who played sharp attacking chess
 * drift towards positional / endgame play; the oldest (42+) become
 * technicians; a long slump (150+ below peak, under 35) makes a player
 * adaptable ('universal'). Opening repertoires follow the style.
 */
export function styleDrift(ctx: SimContext, rng: Rng): number {
  let changed = 0;
  for (const c of ctx.competitors) {
    if (c.retiredDay !== null) continue;
    if (c.styleDay !== undefined && ctx.day - c.styleDay < DAYS_PER_SEASON * 8) continue;
    const age = ageYears(c, ctx.day);
    const st = normalizeStyle(c.style);
    let to: PlayStyle | null = null;
    if (age >= 42 && st !== 'technician' && st !== 'defender') {
      if (rng.chance(0.04)) to = 'technician';
    } else if (age >= 35 && (st === 'attacker' || st === 'gambiteer' || st === 'counterattacker')) {
      if (rng.chance(0.06)) to = rng.chance(0.5) ? 'strategist' : 'technician';
    } else if (age < 35 && c.games >= 200 && c.peak - c.rating >= 150 && st !== 'universal') {
      if (rng.chance(0.03)) to = 'universal';
    }
    if (!to || to === c.style) continue;
    c.style = to;
    c.openingStyles = STYLE_TO_OPENINGS[to];
    c.styleDay = ctx.day;
    changed++;
  }
  return changed;
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
    for (const c of ctx.competitors) {
      if (c.retiredDay !== null) continue;
      c.rating = Math.max(100, c.rating + shift);
      if (c.rating > c.peak) c.peak = c.rating; // v0.3 fix: a peak is never below the current rating
    }
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
  styleDrift(ctx, createRng(mixSeed(ctx.seed, 'style', ctx.day)));
  if (ctx.hall) snapshotRivalries(ctx.hall, ctx.competitors, ctx.day);
  // Prune retired competitors beyond a generous archive to bound save size.
  const retired = ctx.competitors.filter((c) => c.retiredDay !== null);
  // Hysteresis: prune only once the archive is a third over its size, so the cold chunks
  // (whose membership pruning changes) are rewritten every few seasons, not every season.
  if (retired.length > RETIRED_ARCHIVE + RETIRED_PRUNE_SLACK) {
    const keep = new Set(
      retired
        .sort((a, b) => b.championships * 10000 + b.peak - (a.championships * 10000 + a.peak) || (a.id < b.id ? -1 : 1))
        .slice(0, RETIRED_ARCHIVE)
        .map((c) => c.id),
    );
    const drop = (c: Competitor) => !(c.retiredDay === null || keep.has(c.id) || c.titles.length > 0);
    // Records must survive pruning: archive compact snapshots first.
    if (ctx.hall) archiveLegends(ctx.hall, ctx.competitors.filter(drop));
    ctx.competitors = ctx.competitors.filter((c) => !drop(c));
    invalidateNames(ctx);
  }
  for (const c of ctx.competitors) {
    if (c.retiredDay !== null) continue;
    c.ratingHistory.push([ctx.day, c.rating]);
    if (c.ratingHistory.length > RATING_HISTORY_CAP) thinHistory(c.ratingHistory);
  }
}

/**
 * Rating history cap (v0.3, was 48 samples): the latest RATING_HISTORY_RECENT
 * seasonal samples are kept as they are; older ones are thinned (the sample
 * whose removal leaves the smallest gap goes first), so a long career keeps its
 * whole shape — debut sample included — in RATING_HISTORY_CAP points. Peaks are
 * tracked separately (`peak`), never from this list.
 */
export const RATING_HISTORY_CAP = 24;
export const RATING_HISTORY_RECENT = 12;
export function thinHistory(h: [number, number][]) {
  while (h.length > RATING_HISTORY_CAP) {
    let best = 1;
    let gap = Infinity;
    for (let i = 1; i < h.length - RATING_HISTORY_RECENT; i++) {
      const g = h[i + 1][0] - h[i - 1][0];
      if (g < gap) { gap = g; best = i; }
    }
    h.splice(best, 1);
  }
}

export function activeCompetitors(ctx: { competitors: Competitor[] }): Competitor[] {
  return ctx.competitors.filter((c) => c.retiredDay === null);
}
