/**
 * v0.3 data API for the UI: Hall of Fame, competitor profiles (career stage,
 * ambition, form), regional circuits, arenas and the population pyramid.
 *
 * Everything here is a pure function of the world (and optionally the
 * player's save): derived from the award registry, reigns, feuds, upsets,
 * live competitors and the compact legends archive. Nothing is invented and
 * nothing is stored, so stages and ambitions always agree with the current
 * state. Documented in docs/WORLD_API.md.
 */
import type { Competitor, AwardRecord, TitleReign, LegendEntry, Feud, UpsetEntry } from './types';
import type { WorldState, Save, WorldTournament } from '../game/state';
import { DAYS_PER_YEAR, DAYS_PER_SEASON } from './types';
import { ARENAS, RANKS, ARENA_COUNT, TOP_ARENA, rankProgress, type RankProgress } from './arenas';
import { REGIONS, REGION_BY_ID, IMPERIAL, type RegionId, type RegionDef } from './regions';
import { allAwards, awardsFor, isVictory, TROPHY_BY_ID, sigDefFor, trophyArt, PLAYER } from './trophies';
import { recordLeaders, competitorPrestige, type RecordRow } from './records';
import { feudsOf, topFeuds, feudIntensity } from './rivalry';
import { getCompetitor, regionOf, activeInRegion, activeInArena, activeByRating, regionBand } from './indexes';
import { recentResults } from './sim';
import { ageYears } from './population';
import { tournamentInfo, regionTitle, type TournamentInfo } from './calendar';
import { normalizeStyle, STYLE_LABEL } from '../engine/styles';

// ---------------------------------------------------------------- career stage & ambition

export type CareerStage = 'prospect' | 'rising' | 'prime' | 'veteran' | 'declining' | 'retired';

/** Rating change over the last ~4 seasons from the rating history (observable only). */
function trendOf(c: Competitor, day: number): number {
  const h = c.ratingHistory;
  if (!h?.length) return 0;
  let ref = h[0];
  for (const x of h) if (x[0] <= day - 4 * DAYS_PER_SEASON) ref = x;
  return c.rating - ref[1];
}

/**
 * Career stage, derived from observable facts only (age, years since debut,
 * rating trend over ~4 seasons, distance from peak) — never from the hidden
 * potential:
 *   retired   — retiredDay set
 *   prospect  — under 1.5 career years, or under 21 with fewer than 300 games
 *   declining — 120+ below peak and falling (trend ≤ −20)
 *   rising    — trend ≥ +40, within 40 of peak, under 32
 *   veteran   — 36+ years old or 18+ career years
 *   prime     — otherwise
 */
export function careerStage(c: Competitor, day: number): CareerStage {
  if (c.retiredDay !== null) return 'retired';
  const age = ageYears(c, day);
  const years = (day - c.debutDay) / DAYS_PER_YEAR;
  const trend = trendOf(c, day);
  if (years < 1.5 || (age < 21 && c.games < 300)) return 'prospect';
  if (c.peak - c.rating >= 120 && trend <= -20) return 'declining';
  if (trend >= 40 && c.rating >= c.peak - 40 && age < 32) return 'rising';
  if (age >= 36 || years >= 18) return 'veteran';
  return 'prime';
}

export type AmbitionKind = 'defend-title' | 'defend-crown' | 'break-record' | 'win-arena-title' | 'win-regional-crown' | 'reach-arena' | 'break-peak' | 'last-campaign' | 'retired';
export type Ambition = { kind: AmbitionKind; text: string; target?: string | number; progress?: { current: number; target: number } };

/**
 * A competitor's current career ambition, derived from real state (titles,
 * standings, records, rank and stage), first match wins:
 *   defend-title / defend-crown — holds an arena title / regional crown
 *   break-record       — rising/prime and within 60 of the all-time peak record
 *   win-arena-title    — top 6 of the arena by rating
 *   win-regional-crown — top 16 of the region by rating
 *   reach-arena        — within 150 of the next arena floor and not declining
 *   last-campaign      — veteran/declining (one more title run)
 *   break-peak         — otherwise: beat the personal peak
 */
export function careerAmbition(w: WorldState, c: Competitor): Ambition {
  if (c.retiredDay !== null) return { kind: 'retired', text: `Retired on day ${c.retiredDay} — peak ${c.peak}, ${c.championships} championship${c.championships === 1 ? '' : 's'}.` };
  const stage = careerStage(c, w.day);
  const title = w.titles.find((t) => t.holder === c.id);
  if (title) return { kind: 'defend-title', text: `Defend the title ${title.name} (${title.defenses} defence${title.defenses === 1 ? '' : 's'} so far).`, target: title.id, progress: { current: title.defenses, target: title.defenses + 1 } };
  const region = regionOf(c);
  const crown = regionTitle(w, region);
  if (crown?.holder === c.id) return { kind: 'defend-crown', text: `Defend the ${crown.name} (${crown.defenses} defence${crown.defenses === 1 ? '' : 's'}).`, target: crown.id, progress: { current: crown.defenses, target: crown.defenses + 1 } };
  const record = w.hall?.best['peak-elo'];
  if (record && record.holder !== c.id && (stage === 'rising' || stage === 'prime') && c.rating >= record.value - 60) {
    return { kind: 'break-record', text: `Break the all-time rating record of ${record.value} (${record.name}).`, target: record.value, progress: { current: c.rating, target: record.value + 1 } };
  }
  const arena = RANKS[c.rank].arena;
  const arenaRank = activeInArena(w, arena).filter((x) => x.rating > c.rating).length + 1;
  if (arenaRank <= 6 && stage !== 'declining') {
    const t = w.titles.find((x) => x.arena === arena);
    return { kind: 'win-arena-title', text: `Win the title ${t?.name ?? ARENAS[arena].name} (rated #${arenaRank} in the arena).`, target: t?.id ?? arena };
  }
  const regionRank = regionBand(w, region, 0, TOP_ARENA).filter((x) => x.rating > c.rating).length + 1;
  if (regionRank <= 16 && stage !== 'prospect') {
    return { kind: 'win-regional-crown', text: `Win the ${REGION_BY_ID[region].crown} (rated #${regionRank} in ${REGION_BY_ID[region].name}).`, target: regionTitleIdOf(region) };
  }
  const next = arena < TOP_ARENA ? ARENAS[arena + 1] : null;
  if (next && c.rating >= next.floor - 150 && stage !== 'declining' && stage !== 'veteran') {
    return { kind: 'reach-arena', text: `Reach ${next.name} (${next.floor}).`, target: next.index, progress: { current: Math.max(0, c.rating - ARENAS[arena].floor), target: Math.max(1, next.floor - ARENAS[arena].floor) } };
  }
  if (stage === 'veteran' || stage === 'declining') return { kind: 'last-campaign', text: `One last campaign: a final run for honours in ${ARENAS[arena].name}.` };
  return { kind: 'break-peak', text: `Beat the personal best of ${c.peak}.`, target: c.peak, progress: { current: c.rating, target: c.peak + 1 } };
}
const regionTitleIdOf = (r: RegionId) => `crown-${r}`;

// ---------------------------------------------------------------- profiles

export type CompetitorProfile = {
  id: string; name: string; female: boolean; portraitSeed: number; origin: string; region: RegionId; regionName: string;
  age: number; careerYears: number; stage: CareerStage; ambition: Ambition;
  style: string; styleLabel: string;
  rating: number; peak: number; rank: number; rankName: string; peakRank: number; arena: number; arenaName: string; rankProgress: RankProgress;
  record: { games: number; w: number; d: number; l: number };
  form: number; streak: number; recent: ('W' | 'D' | 'L')[];
  tournamentsPlayed: number; tournamentsWon: number; championships: number; prestige: number;
  titles: string[]; regionalCrown: string | null;
  /** Arena championship / regional crown / Masters awards (newest first). */
  championshipHistory: AwardRecord[];
  rivalries: (Feud & { intensity: number; other: string; otherName: string })[];
  h2h: Competitor['h2h'];
  retiredDay: number | null;
  ratingHistory: [number, number][];
};

const CHAMP = (a: AwardRecord) => a.defId.startsWith('sig-') || a.defId.startsWith('rcrown-') || a.defId === 'masters' || a.defId === 'imperial-crown';

/** Everything a competitor profile needs. Null for unknown / pruned ids (see `legendOf` in hallOfFame for pruned legends). */
export function competitorProfile(w: WorldState, id: string): CompetitorProfile | null {
  const c = getCompetitor(w, id);
  if (!c) return null;
  const region = regionOf(c);
  const crown = regionTitle(w, region);
  const st = normalizeStyle(c.style);
  return {
    id: c.id, name: c.name, female: c.female, portraitSeed: c.portraitSeed, origin: c.origin, region, regionName: REGION_BY_ID[region].name,
    age: Math.floor(ageYears(c, w.day)), careerYears: Math.max(0, Math.round(((w.day - c.debutDay) / DAYS_PER_YEAR) * 10) / 10),
    stage: careerStage(c, w.day), ambition: careerAmbition(w, c), style: st, styleLabel: STYLE_LABEL[st],
    rating: c.rating, peak: c.peak, rank: c.rank, rankName: RANKS[c.rank].name, peakRank: c.peakRank, arena: RANKS[c.rank].arena, arenaName: ARENAS[RANKS[c.rank].arena].name,
    rankProgress: rankProgress(c.rank, c.rating),
    record: { games: c.games, w: c.w, d: c.d, l: c.l }, form: c.form, streak: c.streak, recent: recentResults(c),
    tournamentsPlayed: c.tp ?? c.tournamentsWon, tournamentsWon: c.tournamentsWon, championships: c.championships, prestige: competitorPrestige(w, c),
    titles: [...c.titles], regionalCrown: crown?.holder === c.id ? crown.id : null,
    championshipHistory: [...awardsFor(w, c.id)].filter(CHAMP).reverse(),
    rivalries: feudsOf(w, c.id, 8), h2h: c.h2h, retiredDay: c.retiredDay, ratingHistory: c.ratingHistory,
  };
}

// ---------------------------------------------------------------- Hall of Fame

export type HallRow = { holder: string; name: string; value: number; detail?: string; retired?: boolean; region?: string };
export type HallList = { key: string; label: string; criteria: string; rows: HallRow[] };

type Person = { id: string; name: string; peak: number; peakRank: number; championships: number; tournamentsWon: number; games: number; w: number; d: number; l: number; retiredDay: number | null; region?: string };
function persons(w: WorldState): Map<string, Person> {
  const m = new Map<string, Person>();
  for (const l of w.hall?.legends ?? []) m.set(l.id, { ...l, region: l.region });
  for (const c of w.competitors) m.set(c.id, { id: c.id, name: c.name, peak: c.peak, peakRank: c.peakRank, championships: c.championships, tournamentsWon: c.tournamentsWon, games: c.games, w: c.w, d: c.d, l: c.l, retiredDay: c.retiredDay, region: regionOf(c) });
  return m;
}
const fromRecord = (rows: RecordRow[]): HallRow[] => rows.map((r) => ({ holder: r.holder, name: r.name, value: r.value, detail: r.detail, retired: r.retired }));
const top = (rows: HallRow[], n: number) => rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value || (a.holder < b.holder ? -1 : 1)).slice(0, n);

/**
 * Greatest champions: legacy score = 10 per arena championship (+5 more per
 * Imperial Crown), 3 per title defence, 4 per regional crown, 6 per Imperial
 * Masters, + (peak − 2000)/20. Eligibility: at least one arena championship.
 */
export function greatestChampions(w: WorldState, n = 10, playerName?: string): HallRow[] {
  const score = new Map<string, { name: string; s: number; ch: number }>();
  for (const a of allAwards(w)) {
    const d = a.defId;
    let pts = 0;
    if (d.startsWith('sig-')) pts = 10;
    else if (d === 'imperial-crown') pts = 5;
    else if (d.startsWith('defense-')) pts = 3;
    else if (d.startsWith('rcrown-')) pts = 4;
    else if (d === 'masters') pts = 6;
    if (!pts) continue;
    const e = score.get(a.holder) ?? { name: a.holder === PLAYER && playerName ? playerName : a.holderName, s: 0, ch: 0 };
    e.s += pts;
    if (d.startsWith('sig-')) e.ch++;
    score.set(a.holder, e);
  }
  const ps = persons(w);
  const rows: HallRow[] = [];
  for (const [id, e] of score) {
    if (e.ch < 1) continue;
    const p = ps.get(id);
    rows.push({ holder: id, name: e.name, value: Math.round(e.s + Math.max(0, (p?.peak ?? 0) - 2000) / 20), detail: `${e.ch} championship${e.ch === 1 ? '' : 's'}`, retired: p ? p.retiredDay !== null : false, region: p?.region });
  }
  return top(rows, n);
}

/** Longest reigns (one row per reign), arena titles and optionally regional crowns. */
export function longestReigns(w: WorldState, n = 10, opts: { regional?: boolean } = {}): (HallRow & { titleId: string; from: number; to: number | null; defenses: number })[] {
  const reigns: TitleReign[] = [...w.reigns, ...(opts.regional ? (w.regionReigns ?? []) : [])];
  return reigns
    .map((r) => ({ holder: r.holder, name: r.holderName, value: (r.to ?? w.day) - r.from, detail: r.titleId + (r.to === null ? ' (reigning)' : ''), titleId: r.titleId, from: r.from, to: r.to, defenses: r.defenses }))
    .sort((a, b) => b.value - a.value || (a.holder < b.holder ? -1 : 1))
    .slice(0, n);
}

/** Most successful title defences in total (all reigns of all arena titles; optionally regional crowns). */
export function mostDefenses(w: WorldState, n = 10, opts: { regional?: boolean } = {}): HallRow[] {
  const m = new Map<string, HallRow>();
  for (const r of [...w.reigns, ...(opts.regional ? (w.regionReigns ?? []) : [])]) {
    const e = m.get(r.holder) ?? { holder: r.holder, name: r.holderName, value: 0 };
    e.value += r.defenses;
    m.set(r.holder, e);
  }
  return top([...m.values()], n);
}

/** Greatest rivalries: feud intensity (finals, eliminations, title clashes, upsets), all time. */
export function greatestRivalries(w: WorldState, n = 10): (HallRow & { feud: Feud })[] {
  return topFeuds(w, n, { allTime: true }).map((f) => ({ holder: `${f.a}|${f.b}`, name: `${f.aName} vs ${f.bName}`, value: f.intensity, detail: `${f.aWins}-${f.bWins} · ${f.finals} finals · ${f.titleClashes} title clashes · ${f.eliminations} eliminations`, feud: f }));
}

/** Notable upsets (rating gap, largest first). */
export function notableUpsets(w: WorldState, n = 10): UpsetEntry[] {
  return [...(w.upsets ?? [])].sort((a, b) => b.gap - a.gap || a.day - b.day).slice(0, n);
}

/**
 * Legendary retired competitors. Eligibility: retired and (≥ 1 arena
 * championship, or peak rank in arena 18+, or ≥ 10 event victories).
 * Ordered by legacy score (championships × 10 + victories + (peak − 2000)/20).
 * Includes pruned competitors through the legends archive.
 */
export function legendaryRetired(w: WorldState, n = 20): (HallRow & { legend: Person })[] {
  const out: (HallRow & { legend: Person })[] = [];
  for (const p of persons(w).values()) {
    if (p.retiredDay === null) continue;
    if (!(p.championships >= 1 || RANKS[Math.min(p.peakRank, RANKS.length - 1)].arena >= 18 || p.tournamentsWon >= 10)) continue;
    out.push({ holder: p.id, name: p.name, value: Math.round(p.championships * 10 + p.tournamentsWon + Math.max(0, p.peak - 2000) / 20), detail: `peak ${p.peak} · ${p.championships} championships · ${p.tournamentsWon} victories`, retired: true, region: p.region, legend: p });
  }
  return out.sort((a, b) => b.value - a.value || (a.holder < b.holder ? -1 : 1)).slice(0, n);
}

/** The whole Hall of Fame with eligibility criteria (pure; pass the save to include the player). */
export function hallOfFame(w: WorldState, n = 10, s?: Save): HallList[] {
  const player = s?.player;
  return [
    { key: 'greatest-champions', label: 'Greatest champions', criteria: 'At least one arena championship. Score: 10 per championship (+5 per Imperial Crown), 3 per defence, 4 per regional crown, 6 per Imperial Masters, + (peak − 2000)/20.', rows: greatestChampions(w, n, player?.name) },
    { key: 'peak-elo', label: 'Highest peak Elo', criteria: 'Highest rating ever reached (the player: established pools, 20+ games).', rows: fromRecord(recordLeaders(w, 'peak-elo', n, player)) },
    { key: 'championships', label: 'Most championships', criteria: 'Arena championship matches won (signature trophies).', rows: fromRecord(recordLeaders(w, 'championships', n, player)) },
    { key: 'longest-reign', label: 'Longest title reign', criteria: 'Days between winning and losing (or vacating) an arena title; open reigns count to today.', rows: longestReigns(w, n) },
    { key: 'most-defenses', label: 'Most title defences', criteria: 'Successful arena title defences over a whole career.', rows: mostDefenses(w, n) },
    { key: 'consecutive-defenses', label: 'Most consecutive defences', criteria: 'Defences within a single reign.', rows: fromRecord(recordLeaders(w, 'consecutive-defenses', n, player)) },
    { key: 'tournament-wins', label: 'Most tournament wins', criteria: 'Every completed event won (arena, regional and imperial circuits).', rows: fromRecord(recordLeaders(w, 'tournament-wins', n, player)) },
    { key: 'greatest-rivalries', label: 'Greatest rivalries', criteria: 'Intensity of important encounters: meetings + 3·finals + 2·eliminations + 5·title clashes + 2·upsets, × closeness.', rows: greatestRivalries(w, n) },
    { key: 'notable-upsets', label: 'Notable upsets', criteria: 'Knockout, final or title match won against an opponent rated 200+ higher (pre-event ratings).', rows: notableUpsets(w, n).map((u) => ({ holder: u.winner, name: `${u.winnerName} over ${u.loserName}`, value: u.gap, detail: `${u.tournamentName} · ${u.stage} · ${u.winnerRating} vs ${u.loserRating}` })) },
    { key: 'legends', label: 'Legends of the past', criteria: 'Retired, with an arena championship, a peak rank in arena 18+ or 10+ event victories.', rows: legendaryRetired(w, n) },
  ];
}

export type PlayerCareerRecords = {
  peak: number; championships: number; regionalCrowns: number; tournamentsWon: number; tournamentsPlayed: number;
  longestReign: number; mostDefenses: number; bestWinRating: number; bestStreak: number; games: number; w: number; d: number; l: number;
  /** The player's position in each all-time list (null when not listed in the top 100). */
  allTimeRank: Record<'peak-elo' | 'championships' | 'tournament-wins' | 'longest-reign' | 'consecutive-defenses', number | null>;
};
/** The player's own career records and where they stand all-time. Pure. */
export function playerCareerRecords(s: Save): PlayerCareerRecords {
  const w = s.world;
  const p = s.player;
  const mine = awardsFor(w, PLAYER);
  const reigns = w.reigns.filter((r) => r.holder === PLAYER);
  const pos = (k: 'peak-elo' | 'championships' | 'tournament-wins' | 'longest-reign' | 'consecutive-defenses') => {
    const i = recordLeaders(w, k, 100, p).findIndex((r) => r.holder === PLAYER);
    return i >= 0 ? i + 1 : null;
  };
  const est = Object.values(p.ratings).filter((r) => r.games >= 20).map((r) => r.peak);
  return {
    peak: Math.max(0, ...est), championships: mine.filter((a) => a.defId.startsWith('sig-')).length, regionalCrowns: mine.filter((a) => a.defId.startsWith('rcrown-')).length,
    tournamentsWon: mine.filter(isVictory).length, tournamentsPlayed: p.tournamentsPlayed,
    longestReign: Math.max(0, ...reigns.map((r) => (r.to ?? w.day) - r.from)), mostDefenses: Math.max(0, ...reigns.map((r) => r.defenses)),
    bestWinRating: p.bestWinRating, bestStreak: p.ledger?.c?.bestEligibleStreak ?? 0, games: p.w + p.d + p.l, w: p.w, d: p.d, l: p.l,
    allTimeRank: { 'peak-elo': pos('peak-elo'), championships: pos('championships'), 'tournament-wins': pos('tournament-wins'), 'longest-reign': pos('longest-reign'), 'consecutive-defenses': pos('consecutive-defenses') },
  };
}

// ---------------------------------------------------------------- regions

export type RegionalLeader = { id: string; name: string; rating: number; arena: number; rank: number; stage: CareerStage; crown: boolean };
/** Regional leaderboard: active competitors of a region by rating. */
export function regionalLeaderboard(w: WorldState, region: RegionId, n = 20): RegionalLeader[] {
  const holder = regionTitle(w, region)?.holder;
  return [...activeInRegion(w, region)].sort((a, b) => b.rating - a.rating || (a.id < b.id ? -1 : 1)).slice(0, n)
    .map((c) => ({ id: c.id, name: c.name, rating: c.rating, arena: RANKS[c.rank].arena, rank: c.rank, stage: careerStage(c, w.day), crown: c.id === holder }));
}

export type RegionInfo = {
  def: RegionDef;
  population: number;
  /** Active competitors per arena. */
  byArena: number[];
  share: number;
  crown: { id: string; name: string; holder: string | null; holderName: string | null; since: number; defenses: number };
  reigns: TitleReign[];
  records: { mostCrowns: HallRow[]; longestReign: HallRow[]; mostDefenses: HallRow[]; highestPeak: HallRow[]; mostEventWins: HallRow[] };
  signatureEvent: { name: string; format: string; size: number; trophy: string; trophyDef: string; trophyArt: string };
  /** Live / scheduled / recent events of the region. */
  events: TournamentInfo[];
  /** Winners of the regional championship / title defences, newest first. */
  champions: { season: number; day: number; holder: string; holderName: string; tournamentId: string; result: string }[];
};

/** Everything about one regional circuit. Pure. */
export function regionInfo(w: WorldState, region: RegionId): RegionInfo {
  const def = REGION_BY_ID[region];
  const pool = activeInRegion(w, region);
  const byArena = new Array(ARENA_COUNT).fill(0);
  for (const c of pool) byArena[RANKS[c.rank].arena]++;
  const total = REGIONS.reduce((n, r) => n + activeInRegion(w, r.id).length, 0);
  const crown = regionTitle(w, region);
  const reigns = (w.regionReigns ?? []).filter((r) => r.titleId === `crown-${region}`);
  const awards = allAwards(w).filter((a) => a.region === region);
  const count = (pred: (a: AwardRecord) => boolean) => {
    const m = new Map<string, HallRow>();
    for (const a of awards) {
      if (!pred(a)) continue;
      const e = m.get(a.holder) ?? { holder: a.holder, name: a.holderName, value: 0 };
      e.value++;
      m.set(a.holder, e);
    }
    return top([...m.values()], 5);
  };
  const ps = persons(w);
  const regionPeople = [...ps.values()].filter((p) => p.region === region);
  const trophyDef = `rcrown-${region}`;
  const champions = awards.filter((a) => a.defId === trophyDef).reverse().slice(0, 20).map((a) => ({ season: a.season, day: a.day, holder: a.holder, holderName: a.holderName, tournamentId: a.tournamentId, result: a.result }));
  return {
    def, population: pool.length, byArena, share: total ? pool.length / total : 0,
    crown: { id: crown?.id ?? `crown-${region}`, name: def.crown, holder: crown?.holder ?? null, holderName: crown?.holder ? (crown.holder === PLAYER ? 'You' : getCompetitor(w, crown.holder)?.name ?? null) : null, since: crown?.since ?? 0, defenses: crown?.defenses ?? 0 },
    reigns,
    records: {
      mostCrowns: count((a) => a.defId === trophyDef && !a.defenseNumber),
      longestReign: top(reigns.map((r) => ({ holder: r.holder, name: r.holderName, value: (r.to ?? w.day) - r.from, detail: r.to === null ? 'reigning' : undefined })), 5),
      mostDefenses: top(reigns.map((r) => ({ holder: r.holder, name: r.holderName, value: r.defenses })), 5),
      highestPeak: top(regionPeople.map((p) => ({ holder: p.id, name: p.name, value: p.peak, retired: p.retiredDay !== null })), 5),
      mostEventWins: count(isVictory),
    },
    signatureEvent: { name: def.signature.name, format: def.signature.format, size: def.signature.size, trophy: def.trophy, trophyDef, trophyArt: trophyArt(trophyDef) },
    events: w.tournaments.filter((t) => t.region === region).map((t) => tournamentInfo(w, t, 5)),
    champions,
  };
}

/** All regions at once (population shares, crown holders). */
export function regionsOverview(w: WorldState): { id: RegionId; name: string; population: number; share: number; crownHolder: string | null; crownHolderName: string | null }[] {
  return REGIONS.map((r) => {
    const i = regionInfo(w, r.id);
    return { id: r.id, name: r.name, population: i.population, share: i.share, crownHolder: i.crown.holder, crownHolderName: i.crown.holderName };
  });
}

// ---------------------------------------------------------------- arenas

export type ArenaInfo = {
  index: number; name: string; motto: string; floor: number;
  population: number;
  champion: { titleId: string; name: string; holder: string | null; holderName: string | null; since: number; defenses: number };
  /** Every reign of this arena's title, newest first. */
  championHistory: TitleReign[];
  signatureTrophy: { defId: string; name: string; art: string };
  /** The three grades with their floors and the promotion rule into the next arena. */
  grades: { rank: number; id: string; name: string; floor: number }[];
  promotion: string;
  /** Live / scheduled / recent events held in this arena. */
  events: TournamentInfo[];
};
/** Everything about one arena (current champion, historical champions, signature trophy, promotion requirements, events). Pure. */
export function arenaInfo(w: WorldState, arena: number): ArenaInfo {
  const a = ARENAS[Math.max(0, Math.min(TOP_ARENA, arena))];
  const title = w.titles.find((t) => t.arena === a.index);
  const def = sigDefFor(a.index);
  const grades = RANKS.filter((r) => r.arena === a.index).map((r) => ({ rank: r.index, id: r.id, name: r.name, floor: r.floor }));
  const prog = rankProgress(grades[grades.length - 1].rank, grades[grades.length - 1].floor);
  return {
    index: a.index, name: a.name, motto: a.motto, floor: a.floor, population: activeInArena(w, a.index).length,
    champion: { titleId: title?.id ?? `title-${a.index}`, name: title?.name ?? a.name, holder: title?.holder ?? null, holderName: title?.holder ? (title.holder === PLAYER ? 'You' : getCompetitor(w, title.holder)?.name ?? null) : null, since: title?.since ?? 0, defenses: title?.defenses ?? 0 },
    championHistory: w.reigns.filter((r) => r.titleId === `title-${a.index}`).slice().reverse(),
    signatureTrophy: { defId: def, name: TROPHY_BY_ID[def]?.name ?? a.trophy, art: trophyArt(def) },
    grades, promotion: prog.requirement,
    events: w.tournaments.filter((t) => t.arena === a.index && (t.region ?? IMPERIAL) === IMPERIAL).map((t) => tournamentInfo(w, t, 5)),
  };
}

// ---------------------------------------------------------------- population

export type PopulationPyramid = {
  active: number; retiredKept: number; legends: number;
  byArena: number[]; byStage: Record<CareerStage, number>; byRegion: Record<RegionId, number>;
  ratingAbove: Record<'2300' | '2500' | '2600' | '2700' | '2800' | '3000', number>;
  meanRating: number; maxRating: number;
};
/** Population statistics (O(n); call on demand, e.g. once per screen open). */
export function populationPyramid(w: WorldState): PopulationPyramid {
  const byArena = new Array(ARENA_COUNT).fill(0);
  const byStage: Record<CareerStage, number> = { prospect: 0, rising: 0, prime: 0, veteran: 0, declining: 0, retired: 0 };
  const byRegion = Object.fromEntries(REGIONS.map((r) => [r.id, 0])) as Record<RegionId, number>;
  const above = { '2300': 0, '2500': 0, '2600': 0, '2700': 0, '2800': 0, '3000': 0 };
  let sum = 0;
  let max = 0;
  let retired = 0;
  for (const c of w.competitors) {
    if (c.retiredDay !== null) { retired++; continue; }
    byArena[RANKS[c.rank].arena]++;
    byStage[careerStage(c, w.day)]++;
    byRegion[regionOf(c)]++;
    sum += c.rating;
    if (c.rating > max) max = c.rating;
    for (const k of Object.keys(above) as (keyof typeof above)[]) if (c.rating > Number(k)) above[k]++;
  }
  const active = activeByRating(w).length;
  byStage.retired = retired;
  return { active, retiredKept: retired, legends: w.hall?.legends.length ?? 0, byArena, byStage, byRegion, ratingAbove: above, meanRating: active ? Math.round(sum / active) : 0, maxRating: max };
}

/** Event list for a calendar view: every live / scheduled / recently completed event with its full identity. */
export function eventCalendar(w: WorldState, opts: { region?: string; arena?: number; status?: WorldTournament['status'] } = {}): TournamentInfo[] {
  return w.tournaments
    .filter((t) => (opts.region === undefined || (t.region ?? IMPERIAL) === opts.region) && (opts.arena === undefined || t.arena === opts.arena) && (!opts.status || t.status === opts.status))
    .map((t) => tournamentInfo(w, t, 3));
}

export type { LegendEntry, Feud, UpsetEntry };
export { feudIntensity };
