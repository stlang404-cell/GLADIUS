/**
 * Long-run validation of the v0.3 living empire (world only, no player):
 *   npx tsx scripts/soak-world.ts [seasons=40] [seed=20260] [population=25000]
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
 * Measurements: mean rating and mean (rating − skill) drift, population,
 * arenas, elite counts, champion turnover, career jumps, arena ping-pong
 * (promotion loops), retirements (age), JSON / split save size growth.
 */
import { createWorld, advanceWorld } from '../src/world/world';
import { RANKS, ARENA_COUNT } from '../src/world/arenas';
import { isVictory, awardsFor } from '../src/world/trophies';
import { recordLeaders, type RecordKey } from '../src/world/records';
import { splitSave, sizeOf } from '../src/persist/layout';
import { ageYears } from '../src/world/population';
import { CHRONICLE_CAP, CHRONICLE_SLACK } from '../src/world/sim';
import { FEUD_CAP, UPSET_CAP } from '../src/world/rivalry';
import { populationPyramid } from '../src/world/hall';
import type { WorldState } from '../src/game/state';

const SEASONS = Number(process.argv[2] ?? 40);
const SEED = Number(process.argv[3] ?? 20260);
const POP = Number(process.argv[4] ?? 25000);

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
  const ts = performance.now();
  advanceWorld(w, 28, null);
  simMs += performance.now() - ts;
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
  let splitKb = -1;
  if (s % 10 === 9 || s === SEASONS - 1) {
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
    stages: py.byStage,
  };
  lastJson = json;
  lastReigns = w.reigns.length;
  lastRegionReigns = w.regionReigns!.length;
  lastRetire = w.stats.retirements;
  out.push(row);
  console.log(JSON.stringify(row));
}
const ages = retireAges.sort((a, b) => a - b);
const q = (p: number) => Math.round(ages[Math.floor(p * (ages.length - 1))] ?? 0);
console.log(JSON.stringify({
  summary: true, seasons: SEASONS, population: POP, burnInMs: Math.round(burnMs), simMsPerSeason: Math.round(simMs / SEASONS), totalMs: Math.round(performance.now() - t0),
  days: w.day - startDay, retirementAge: { p10: q(0.1), median: q(0.5), p90: q(0.9), n: ages.length },
  jsonStartMB: Math.round(startJson / 1e5) / 10, jsonEndMB: Math.round(JSON.stringify(w).length / 1e5) / 10, records: best,
}));
