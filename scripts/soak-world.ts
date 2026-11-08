/**
 * Long-run validation of the living empire (world only, no player):
 *   npx tsx scripts/soak-world.ts [seasons=40] [seed=20260] [population=25000] [--split] [--quiet]
 *
 * Deterministic (seeded). Every season it checks invariants and prints one
 * JSON line of measurements; it exits with code 1 on the first violated
 * invariant. Measured numbers are reported in docs/WORLD.md ("v0.3 Golden Age").
 *
 * Invariants: unique ids / names, W+D+L = games, finite ratings ≥ 100, one
 * open reign per title and crown, holders alive (and of the crown's region),
 * no competitor holding two arena titles, award ids unique, exactly one
 * victory award per completed event with a winner, tournamentsWon = registry
 * victories (competitors born in the simulated era), records monotone, the
 * Chronicle / feuds / upsets bounded, no running tournament stuck.
 * v0.4 additions: bracket validity of every tournament (entrants unique, pairings
 * reference entrants, nobody paired twice in a round, a completed event has a
 * winner among its entrants), every grade of the 72 populated, rating points by
 * mechanism (`ratingProbe`), rating − skill gap by strength band, top-1 / top-10
 * rating vs skill, title-match skill gaps and defence streaks, challenger choice.
 * Measurements: mean rating and mean (rating − skill) drift, population,
 * arenas, elite counts, champion turnover, career jumps, arena ping-pong
 * (promotion loops), retirements (age), JSON / split save size growth.
 */
import { createWorld, advanceWorld } from '../src/world/world';
import { RANKS, ARENA_COUNT, naturalRank } from '../src/world/arenas';
import { isVictory, awardsFor } from '../src/world/trophies';
import { recordLeaders, type RecordKey } from '../src/world/records';
import { splitSave, sizeOf } from '../src/persist/layout';
import { ageYears } from '../src/world/population';
import { CHRONICLE_CAP, CHRONICLE_SLACK } from '../src/world/sim';
import { FEUD_CAP, UPSET_CAP } from '../src/world/rivalry';
import { populationPyramid } from '../src/world/hall';
import { setRatingProbe, newRatingProbe } from '../src/world/sim';
import { getCompetitor } from '../src/world/indexes';
import { PROVISIONAL_GAMES } from '../src/rating/elo';
import type { WorldState } from '../src/game/state';
import type { TournamentState } from '../src/tournament/formats';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SEASONS = Number(args[0] ?? 40);
const SEED = Number(args[1] ?? 20260);
const POP = Number(args[2] ?? 25000);
const SPLIT = process.argv.includes('--split');
const QUIET = process.argv.includes('--quiet');
const GAP_BANDS = [0, 1000, 1500, 2000, 2400, 2600, 2800];

/** Structural validity of a tournament state (brackets, schedules, matches). */
function bracketProblem(st: TournamentState): string | null {
  const ent = new Set(st.entrants);
  if (ent.size !== st.entrants.length) return 'duplicate entrants';
  for (const round of st.rounds) {
    const seen = new Set<string>();
    for (const p of round) {
      if (!ent.has(p.white) || (p.black !== null && !ent.has(p.black))) return `pairing ${p.id} with a non-entrant`;
      if (p.white === p.black) return `self-pairing ${p.id}`;
      if (p.tiebreakOf || p.armageddon || st.format === 'match-series') continue;
      for (const id of [p.white, p.black]) {
        if (id === null) continue;
        if (seen.has(id)) return `${id} paired twice in round ${p.round}`;
        seen.add(id);
      }
    }
  }
  if (st.complete && st.winner !== null && !ent.has(st.winner)) return 'winner not an entrant';
  if (st.complete && st.winner !== null && st.winner === st.runnerUp) return 'winner = runner-up';
  return null;
}
type TitleMatch = { id: string; title: string; holder: string; arena: number; regional: boolean; holderSkill: number; chSkill: number; bestSkill: number; chIsBest: boolean; chPlace: number; defenses: number };
const titleMatches: TitleMatch[] = [];
const seenMatch = new Set<string>();
let swissRepeats = 0;
const seenSwiss = new Set<string>();
const probeTotal = newRatingProbe();
/** Grades occupied by at least one active competitor at some season end (every grade must be reachable). */
const everPopulated = new Set<number>();

function fail(msg: string): never {
  console.error('INVARIANT VIOLATED:', msg);
  process.exit(1);
}
const check = (ok: boolean, msg: () => string) => { if (!ok) fail(msg()); };

const t0 = performance.now();
const w: WorldState = createWorld(SEED, 8, undefined, POP);
const burnMs = performance.now() - t0;
const firstSerial = w.nextSerial; // competitors created after the burn-in start with clean counters
const startDay = w.day;
const tracked: RecordKey[] = ['championships', 'tournament-wins', 'longest-reign', 'consecutive-defenses', 'peak-elo'];
const best: Record<string, number> = {};
const seenHistory = new Set<string>();
let lastReigns = w.reigns.length;
let lastRegionReigns = w.regionReigns!.length;
const arenaTrail = new Map<string, number[]>(); // id -> arena per season (last 6)
const rating0 = new Map(w.competitors.map((c) => [c.id, c.rating]));
let lastRetire = w.stats.retirements;
const retireAges: number[] = [];
const out: unknown[] = [];
let lastJson = 0;
const startJson = JSON.stringify(w).length;
let simMs = 0;

for (let s = 0; s < SEASONS; s++) {
  const probe = newRatingProbe();
  setRatingProbe(probe);
  for (let d = 0; d < 28; d++) {
    const ts = performance.now();
    advanceWorld(w, 1, null);
    simMs += performance.now() - ts;
    // Title matches as they start: holder vs challenger strength, and the strongest eligible contender.
    for (const t of w.tournaments) {
      if ((t.kind !== 'championship' && t.kind !== 'regional-defense') || !t.state || seenMatch.has(t.id)) continue;
      seenMatch.add(t.id);
      const [h, c] = t.state.entrants.map((id) => getCompetitor(w, id));
      if (!h || !c) continue;
      const title = t.kind === 'championship' ? w.titles.find((x) => x.id === t.titleId) : w.regionTitles!.find((x) => x.region === t.region);
      // Contenders: established competitors of the title's arena (crowns: of the region), holder excluded.
      const pool = t.kind === 'championship'
        ? w.competitors.filter((x) => x.retiredDay === null && x.id !== h.id && x.games >= PROVISIONAL_GAMES && RANKS[x.rank].arena === t.arena)
        : w.competitors.filter((x) => x.retiredDay === null && x.id !== h.id && x.games >= PROVISIONAL_GAMES && x.region === t.region);
      const best = pool.reduce((a, b) => (b.skill > a.skill ? b : a), c);
      const chPlace = pool.filter((x) => x.skill > c.skill).length + 1;
      titleMatches.push({ id: t.id, title: t.titleId ?? '', holder: h.id, arena: t.arena, regional: t.kind === 'regional-defense', holderSkill: h.skill, chSkill: c.skill, bestSkill: best.skill, chIsBest: best.id === c.id, chPlace, defenses: title?.holder === h.id ? title.defenses : 0 });
    }
  }
  setRatingProbe(null);
  for (const k of Object.keys(probe) as (keyof typeof probe)[]) probeTotal[k] += probe[k];
  const act = w.competitors.filter((c) => c.retiredDay === null);
  // --- identity & records
  check(new Set(w.competitors.map((c) => c.id)).size === w.competitors.length, () => 'duplicate ids');
  check(new Set(w.competitors.map((c) => c.name)).size === w.competitors.length, () => 'duplicate names');
  for (const c of w.competitors) {
    check(c.w + c.d + c.l === c.games, () => `W+D+L != games for ${c.id}`);
    check(Number.isFinite(c.rating) && c.rating >= 100, () => `bad rating ${c.id} ${c.rating}`);
    check(c.peak >= c.rating, () => `peak below rating ${c.id}`);
    check(c.h2h.length <= 8, () => `h2h overflow ${c.id}`);
  }
  check(act.length === POP, () => `population ${act.length} != ${POP}`);
  // --- titles
  const holders = new Map<string, number>();
  for (const t of w.titles) {
    check(w.reigns.filter((r) => r.titleId === t.id && r.to === null).length <= 1, () => `two open reigns ${t.id}`);
    if (!t.holder) continue;
    const c = w.competitors.find((x) => x.id === t.holder);
    check(!!c && c.retiredDay === null, () => `retired / missing holder of ${t.id}`);
    check(c!.titles.includes(t.id), () => `holder ${t.holder} does not list ${t.id}`);
    holders.set(t.holder, (holders.get(t.holder) ?? 0) + 1);
  }
  for (const [id, n] of holders) check(n <= 1, () => `${id} holds ${n} arena titles`);
  for (const c of w.competitors) for (const tid of c.titles) check(w.titles.find((t) => t.id === tid)?.holder === c.id, () => `${c.id} lists ${tid} it does not hold`);
  for (const t of w.regionTitles!) {
    check(w.regionReigns!.filter((r) => r.titleId === t.id && r.to === null).length <= 1, () => `two open reigns ${t.id}`);
    if (!t.holder) continue;
    const c = w.competitors.find((x) => x.id === t.holder);
    check(!!c && c.retiredDay === null && c.region === t.region, () => `bad crown holder ${t.id}`);
  }
  // --- awards
  const ids = new Set<string>();
  for (const a of w.awards!) {
    check(!ids.has(a.awardId), () => `duplicate award ${a.awardId}`);
    ids.add(a.awardId);
    check(a.arena >= 0 && a.arena < ARENA_COUNT, () => `award arena out of range ${a.awardId}`);
  }
  for (const h of w.history) {
    if (seenHistory.has(h.id)) continue;
    seenHistory.add(h.id);
    const v = w.awards!.filter((a) => a.tournamentId === h.id && isVictory(a));
    check(v.length === (h.winner ? 1 : 0), () => `victory awards for ${h.id}: ${v.length}`);
  }
  for (const c of w.competitors) {
    if (Number(c.id.slice(1)) < firstSerial) continue;
    check(awardsFor(w, c.id).filter(isVictory).length === c.tournamentsWon, () => `tournamentsWon mismatch ${c.id}`);
  }
  for (const k of tracked) {
    const v = recordLeaders(w, k, 1)[0]?.value ?? 0;
    check(v >= (best[k] ?? 0), () => `record ${k} decreased ${best[k]} -> ${v}`);
    best[k] = v;
  }
  check(w.chronicle.length <= CHRONICLE_CAP + CHRONICLE_SLACK, () => 'chronicle unbounded');
  check((w.feuds?.length ?? 0) <= FEUD_CAP + 400, () => `feuds ${w.feuds?.length}`);
  check((w.upsets?.length ?? 0) <= UPSET_CAP, () => 'upsets unbounded');
  for (const t of w.tournaments) if (t.status === 'running') check(t.nextRoundDay <= w.day + 3, () => `stuck tournament ${t.id}`);
  for (const t of w.tournaments) {
    if (!t.state) continue;
    const bp = bracketProblem(t.state);
    check(!bp, () => `bracket ${t.id} (${t.format}): ${bp}`);
    if (t.format === 'swiss' && t.state.complete && !seenSwiss.has(t.id)) {
      seenSwiss.add(t.id);
      const pairs = new Set<string>();
      for (const p of t.state.rounds.flat()) {
        if (!p.black || p.tiebreakOf) continue;
        const k = p.white < p.black ? `${p.white}|${p.black}` : `${p.black}|${p.white}`;
        if (pairs.has(k)) swissRepeats++;
        pairs.add(k);
      }
    }
  }
  // --- ranks: every grade populated; rank within one arena of the rating's natural arena (established)
  const perGrade = new Array(RANKS.length).fill(0);
  let rankFar = 0;
  for (const c of act) {
    perGrade[c.rank]++;
    if (c.games >= PROVISIONAL_GAMES && Math.abs(RANKS[c.rank].arena - RANKS[naturalRank(c.rating)].arena) > 1) rankFar++;
  }
  const emptyGrades = perGrade.map((n, i) => (n === 0 ? i : -1)).filter((i) => i >= 0);
  // --- measurements
  const mean = act.reduce((a, c) => a + c.rating, 0) / act.length;
  const bias = act.reduce((a, c) => a + (c.rating - c.skill), 0) / act.length;
  let maxJump = 0;
  for (const c of act) {
    const prev = rating0.get(c.id);
    if (prev !== undefined && c.games > 60) maxJump = Math.max(maxJump, Math.abs(c.rating - prev));
  }
  for (const c of act) rating0.set(c.id, c.rating);
  let pingPong = 0;
  for (const c of act) {
    const trail = arenaTrail.get(c.id) ?? [];
    trail.push(RANKS[c.rank].arena);
    if (trail.length > 6) trail.shift();
    arenaTrail.set(c.id, trail);
    let changes = 0;
    for (let i = 1; i < trail.length; i++) if (Math.sign(trail[i] - trail[i - 1]) !== 0 && i > 1 && Math.sign(trail[i] - trail[i - 1]) === -Math.sign(trail[i - 1] - trail[i - 2])) changes++;
    if (changes >= 3) pingPong++;
  }
  const newRetirees = w.competitors.filter((c) => c.retiredDay !== null && c.retiredDay >= w.day - 28);
  for (const c of newRetirees) retireAges.push(ageYears(c, c.retiredDay!));
  const py = populationPyramid(w);
  const est = act.filter((c) => c.games >= PROVISIONAL_GAMES);
  const gapByBand: Record<string, number> = {};
  for (let i = 0; i < GAP_BANDS.length; i++) {
    const xs = est.filter((c) => c.skill >= GAP_BANDS[i] && c.skill < (GAP_BANDS[i + 1] ?? Infinity));
    gapByBand[`${GAP_BANDS[i]}+`] = xs.length ? Math.round(xs.reduce((a, c) => a + c.rating - c.skill, 0) / xs.length) : NaN;
  }
  const byRating = [...act].sort((a, b) => b.rating - a.rating);
  const bySkill = [...act].sort((a, b) => b.skill - a.skill);
  const avg = (xs: { rating: number; skill: number }[], f: 'rating' | 'skill') => Math.round(xs.reduce((a, c) => a + c[f], 0) / Math.max(1, xs.length));
  const elite = {
    top1: byRating[0].rating, top1Skill: Math.round(byRating[0].skill), top10: avg(byRating.slice(0, 10), 'rating'), top10Skill: avg(byRating.slice(0, 10), 'skill'),
    maxSkill: Math.round(bySkill[0].skill), skillTop10: avg(bySkill.slice(0, 10), 'skill'),
    skillGt2800: act.filter((c) => c.skill > 2800).length, skillGt3000: act.filter((c) => c.skill > 3000).length,
  };
  const probeRow = { exchange: probe.exchange, debut: Math.round(probe.debut), retire: Math.round(probe.retire), census: probe.census, skillDev: Math.round(probe.skillDev) };
  let splitKb = -1;
  if (SPLIT && (s % 10 === 9 || s === SEASONS - 1)) {
    const r = splitSave({ world: w } as object, { verifyAll: true });
    splitKb = Math.round([...r.parts.values()].reduce((a, d) => a + sizeOf(d), 0) / 1024);
  }
  const json = JSON.stringify(w).length;
  const row = {
    season: w.season, day: w.day, simS: Math.round(simMs / 100) / 10, mean: Math.round(mean), bias: Math.round(bias), maxJump,
    gt2600: py.ratingAbove['2600'], gt2800: py.ratingAbove['2800'], gt3000: py.ratingAbove['3000'], max: py.maxRating,
    top3: py.byArena.slice(21).join('/'), arenaTitleChanges: w.reigns.length - lastReigns, crownChanges: w.regionReigns!.length - lastRegionReigns,
    vacantTitles: w.titles.filter((t) => !t.holder).length, vacantCrowns: w.regionTitles!.filter((t) => !t.holder).length,
    retirements: w.stats.retirements - lastRetire, pingPong, awards: w.awards!.length, feuds: w.feuds!.length, upsets: w.upsets!.length,
    chronicle: w.chronicle.length, archived: w.chronicleArchived ?? 0, legends: w.hall!.legends.length, kept: w.competitors.length,
    jsonMB: Math.round(json / 1e5) / 10, jsonGrowthKB: lastJson ? Math.round((json - lastJson) / 1024) : 0, ...(splitKb >= 0 ? { splitKB: splitKb } : {}),
    stages: py.byStage, byArena: py.byArena.join('/'), ...elite, gapByBand, points: probeRow, minGrade: Math.min(...perGrade), emptyGrades: emptyGrades.length, emptyGradeList: emptyGrades.join(','), rankFar,
  };
  for (let g = 0; g < perGrade.length; g++) if (perGrade[g] > 0) everPopulated.add(g);
  lastJson = json;
  lastReigns = w.reigns.length;
  lastRegionReigns = w.regionReigns!.length;
  lastRetire = w.stats.retirements;
  out.push(row);
  if (!QUIET) console.log(JSON.stringify(row));
}
check(everPopulated.size === RANKS.length, () => `grades never occupied: ${RANKS.map((r) => r.index).filter((i) => !everPopulated.has(i)).join(',')}`);
// Title-match analysis: skill gaps, challenger choice, defence streaks.
const arenaTM = titleMatches.filter((m) => !m.regional);
const mm = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const streakMatches = (min: number) => arenaTM.filter((m) => m.defenses >= min);
const titleAnalysis = {
  arenaMatches: arenaTM.length, regionalDefences: titleMatches.length - arenaTM.length,
  challengerIsStrongestPct: Math.round((100 * arenaTM.filter((m) => m.chIsBest).length) / Math.max(1, arenaTM.length)),
  challengerInTop3Pct: Math.round((100 * arenaTM.filter((m) => m.chPlace <= 3).length) / Math.max(1, arenaTM.length)),
  challengerMedianPlace: [...arenaTM.map((m) => m.chPlace)].sort((a, b) => a - b)[Math.floor(arenaTM.length / 2)] ?? 0,
  regionalChallengerTop3Pct: Math.round((100 * titleMatches.filter((m) => m.regional && m.chPlace <= 3).length) / Math.max(1, titleMatches.length - arenaTM.length)),
  meanGapHolderMinusChallenger: mm(arenaTM.map((m) => m.holderSkill - m.chSkill)),
  meanGapChallengerToStrongest: mm(arenaTM.map((m) => m.bestSkill - m.chSkill)),
  maxArenaDefencesSeen: Math.max(0, ...arenaTM.map((m) => m.defenses)),
  maxCrownDefencesSeen: Math.max(0, ...titleMatches.filter((m) => m.regional).map((m) => m.defenses)),
  matchesByHolderOn5PlusDefences: streakMatches(5).length,
  gapWhenHolderOn5Plus: mm(streakMatches(5).map((m) => m.holderSkill - m.chSkill)),
  top23Gap: mm(arenaTM.filter((m) => m.arena === ARENA_COUNT - 1).map((m) => m.holderSkill - m.chSkill)),
};
// The longest defence streak seen: was it a genuine skill gap or weak challengers?
const longest = arenaTM.reduce((a, b) => (b.defenses > a.defenses ? b : a), arenaTM[0]);
const streak = longest ? arenaTM.filter((m) => m.title === longest.title && m.holder === longest.holder && m.defenses <= longest.defenses) : [];
const longestStreak = longest ? {
  title: longest.title, defences: longest.defenses, matches: streak.length,
  meanGapToChallenger: mm(streak.map((m) => m.holderSkill - m.chSkill)), meanGapToStrongestContender: mm(streak.map((m) => m.holderSkill - m.bestSkill)),
  challengerWasStrongestPct: Math.round((100 * streak.filter((m) => m.chIsBest).length) / Math.max(1, streak.length)),
} : null;
const lastRows = out.slice(-1)[0] as Record<string, unknown>;
const ages = retireAges.sort((a, b) => a - b);
const q = (p: number) => Math.round(ages[Math.floor(p * (ages.length - 1))] ?? 0);
console.log(JSON.stringify({
  summary: true, seasons: SEASONS, population: POP, burnInMs: Math.round(burnMs), simMsPerSeason: Math.round(simMs / SEASONS), totalMs: Math.round(performance.now() - t0),
  days: w.day - startDay, retirementAge: { p10: q(0.1), median: q(0.5), p90: q(0.9), n: ages.length },
  jsonStartMB: Math.round(startJson / 1e5) / 10, jsonEndMB: Math.round(JSON.stringify(w).length / 1e5) / 10, records: best,
  titleAnalysis, longestStreak, swissRepeats,
  pointsTotal: { exchange: probeTotal.exchange, debut: Math.round(probeTotal.debut), retire: Math.round(probeTotal.retire), census: probeTotal.census, skillDev: Math.round(probeTotal.skillDev), games: probeTotal.games },
  end: { byArena: lastRows.byArena, mean: lastRows.mean, top1: lastRows.top1, top1Skill: lastRows.top1Skill, top10: lastRows.top10, top10Skill: lastRows.top10Skill, gt2800: lastRows.gt2800, gt3000: lastRows.gt3000, gapByBand: lastRows.gapByBand, minGrade: lastRows.minGrade },
  maxOver: {
    top1: Math.max(...out.map((r) => (r as { top1: number }).top1)), gt2800: Math.max(...out.map((r) => (r as { gt2800: number }).gt2800)), gt3000: Math.max(...out.map((r) => (r as { gt3000: number }).gt3000)),
    pingPong: Math.max(...out.map((r) => (r as { pingPong: number }).pingPong)), emptyGrades: Math.max(...out.map((r) => (r as { emptyGrades: number }).emptyGrades)), rankFar: Math.max(...out.map((r) => (r as { rankFar: number }).rankFar)),
  },
  turnover: { arenaTitleChangesPerSeason: Math.round((10 * out.reduce((a: number, r) => a + (r as { arenaTitleChanges: number }).arenaTitleChanges, 0)) / out.length) / 10, crownChangesPerSeason: Math.round((10 * out.reduce((a: number, r) => a + (r as { crownChanges: number }).crownChanges, 0)) / out.length) / 10 },
}));
