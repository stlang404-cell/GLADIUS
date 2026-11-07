import { createRng, mixSeed, type Rng } from '../core/rng';
import {
  createTournament, pendingPairings, recordResult, standings, withdraw, matchOutcome,
  type Format, type Pairing, type TournamentState, type TournamentConfig,
} from '../tournament/formats';
import { ARENAS, RANKS, ARENA_COUNT, TOP_ARENA, legacyScale } from './arenas';
import { DAYS_PER_SEASON, type Competitor, type AwardRecord, type ChronicleEntry, type TitleState } from './types';
import {
  processTournamentAwards, presentSeasonLaurels, presentRegionLaurels, seriesChanged, winnerDefFor, isRegionalKind, awardsByDef, allAwards,
} from './trophies';
import { competitorPrestige, checkRecordsBroken } from './records';
import { simulateGame, recordCompetitorResult, pushChronicle, simulateDay } from './sim';
import type { WorldState, WorldTournament, TournamentKind, TournamentSummary } from '../game/state';
import { prizeFor } from '../game/influence';
import { competitorMap, getCompetitor, establishedInArena, regionBand, invalidatePools, regionOf } from './indexes';
import { REGIONS, REGION_BY_ID, LOCAL_BANDS, IMPERIAL, regionTitleId, isRegionId, type RegionId } from './regions';
import { recordEncounters, pruneFeuds, feudsOf, MAJOR_UPSET_GAP } from './rivalry';
import { ensureWorldV3 } from './migrate';

export const PLAYER_ID = 'player';

type Slot = { kind: TournamentKind; format: Format; offset: number; size: number; every: number; name: (a: number, season: number) => string; matchGames?: number };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
export function roman(n: number): string {
  if (n <= 20) return ROMAN[n - 1] ?? String(n);
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
  return s;
}
const short = (a: number) => ARENAS[a].name.replace(/^The /, '');

/** History cap (summaries). Winners by series never expire: they live in the award registry. */
export const HISTORY_CAP = 2000;
/** Competitors may be entered in at most this many running events at once (regional / imperial events). Arena-circuit events keep the v0.2 rule (one at a time). */
export const MAX_CONCURRENT = 2;
/**
 * v0.3: arenas are 100 points wide, so a champion often moves one arena up or
 * down between two title matches. A holder keeps (and defends) the title while
 * competing within one arena of it; further away, or on winning another arena
 * title, it is relinquished. (v0.2: any arena change relinquished the title.)
 */
export const TITLE_ARENA_TOLERANCE = 1;

/** One season (28 days) of competition in every arena. */
export function seasonSlots(season: number): Slot[] {
  const evenSeason = season % 2 === 0;
  return [
    { kind: 'league', format: 'league', offset: 0, size: 8, every: 2, name: (a, s) => `${short(a)} League · Season ${roman(s + 1)}` },
    { kind: 'open', format: 'swiss', offset: 1, size: 16, every: 1, name: (a) => `${short(a)} Open` },
    evenSeason
      ? { kind: 'cup', format: 'single-elim', offset: 8, size: 16, every: 1, name: (a) => `${short(a)} Cup` }
      : { kind: 'gauntlet', format: 'double-elim', offset: 8, size: 8, every: 1, name: (a) => `${short(a)} Gauntlet` },
    { kind: 'invitational', format: 'round-robin', offset: 14, size: 6, every: 1, name: (a) => `${ARENAS[a].trophy} Invitational` },
    { kind: 'championship', format: 'match-series', offset: 21, size: 2, every: 1, matchGames: 4, name: (a, s) => `${short(a)} Championship ${roman(s + 1)}` },
  ];
}

/**
 * v0.3 calendar additions (per season, see docs/WORLD.md "v0.3 Golden Age"):
 *   day 3   Local Opens: every region, Lower (arenas 0–7) and Upper (8–15) division, Swiss 16
 *   day 5   Imperial Masters: round robin of the empire's top 8 (arenas 16–23)
 *   day 9   Arena Qualifiers: Swiss 12 in every arena; the winner joins the arena Invitational (day 14)
 *   day 15  Regional Championship (even seasons): each region's signature event and format; crowns its champion
 *   day 17  Regional Title Defence (odd seasons): match of 4 games, crown holder vs the leading contender
 */
export const REGIONAL_OFFSETS = { localOpen: 3, elite: 5, qualifier: 9, regional: 15, defense: 17 } as const;
/** Arenas whose competitors are invited to the Imperial Masters. */
export const ELITE_ARENA_MIN = ARENA_COUNT - 8;
/** Arena hosting the Imperial Masters (Hall of Caesars). */
export const MASTERS_ARENA = 20;
/** Default (scheduled) arena of a regional championship; set to the entrants' median arena at the start. */
const REGIONAL_DEFAULT_ARENA = 14;

export function titleIdFor(arena: number) {
  return `title-${arena}`;
}

export function initTitles(w: WorldState) {
  w.titles = ARENAS.map((a) => ({ id: titleIdFor(a.index), arena: a.index, name: `Champion of ${short(a.index)}`, holder: null, since: 0, defenses: 0 }));
  w.reigns = [];
}

/** Regional crown state of a region (v0.3). */
export function regionTitle(w: WorldState, region: RegionId): TitleState | undefined {
  return w.regionTitles?.find((t) => t.region === region);
}

function arenaPool(w: WorldState, arena: number): readonly Competitor[] {
  return establishedInArena(w, arena);
}

/** Running-tournament count per entrant. */
function busyCounts(w: WorldState): Map<string, number> {
  const s = new Map<string, number>();
  for (const t of w.tournaments) if (t.status === 'running' && t.state) for (const id of t.state.entrants) s.set(id, (s.get(id) ?? 0) + 1);
  return s;
}
const free = (busy: Map<string, number>, max: number) => (c: Competitor) => (busy.get(c.id) ?? 0) < max;

function pickEntrants(w: WorldState, arena: number, size: number, kind: TournamentKind, rng: Rng, busy: Map<string, number>, guaranteed: string[] = []): string[] {
  const ok = free(busy, 1);
  let pool = arenaPool(w, arena).filter(ok);
  // Thin elite arenas draw qualifiers from the arenas below (strongest first, up to four arenas down).
  for (let b = arena - 1; pool.length < size && b >= Math.max(0, arena - 4); b--) {
    const below = arenaPool(w, b).filter(ok).sort((x, y) => y.rating - x.rating || (x.id < y.id ? -1 : 1));
    pool = pool.concat(below.slice(0, size - pool.length));
  }
  if (pool.length < 2) return [];
  if (kind === 'invitational' || kind === 'league' || kind === 'cup') {
    // Invitations by standing: rating + recent form + prestige (real honours, titles, peak).
    const top = topByStanding(w, pool, Math.max(size, Math.ceil(size * 1.5)));
    const chosen: Competitor[] = [];
    while (chosen.length < size && top.length) chosen.push(top.splice(rng.int(0, Math.min(top.length, size)), 1)[0]);
    // Championship privilege: the arena's reigning champion is always invited.
    const holder = w.titles.find((t) => t.arena === arena)?.holder;
    if (holder && holder !== PLAYER_ID && !chosen.some((c) => c.id === holder)) {
      const hc = pool.find((c) => c.id === holder);
      if (hc && chosen.length) chosen[chosen.length - 1] = hc;
    }
    // v0.3: qualifier winners are guaranteed a place (they replace the last invitees).
    const ids = chosen.map((c) => c.id);
    const g = guaranteed.filter((id) => id !== PLAYER_ID && getCompetitor(w, id)?.retiredDay === null && !ids.includes(id));
    for (let i = 0; i < g.length && ids.length; i++) {
      // never drop the reigning champion
      let j = ids.length - 1 - i;
      while (j >= 0 && ids[j] === holder) j--;
      if (j >= 0) ids[j] = g[i];
    }
    return ids;
  }
  // Opens: anyone may register; random draw from the arena.
  const out: string[] = [];
  const copy = [...pool];
  while (out.length < size && copy.length) out.push(copy.splice(rng.int(0, copy.length), 1)[0].id);
  return out;
}

/** Seeding / invitation standing: rating + form + capped prestige (see docs/WORLD.md). */
export function standingKey(w: WorldState, c: Competitor): number {
  return c.rating + c.form * 80 + Math.min(300, competitorPrestige(w, c)) * 0.4;
}
/** Largest possible standing bonus over rating (form ≤ +80, prestige ≤ 300 × 0.4) and penalty (form ≥ −80). */
const STANDING_UP = 80 + 120;
const STANDING_DOWN = 80;

/**
 * The best `m` of `pool` by standing (descending; ties by id), computing
 * standings only for competitors whose rating could reach the top m
 * (rating ≥ m-th best rating − 280). Exact; O(n log n) on ratings only.
 */
export function topByStanding(w: WorldState, pool: readonly Competitor[], m: number): Competitor[] {
  if (m <= 0 || !pool.length) return [];
  // m-th best rating via a small sorted buffer (O(n·m) worst case, m ≤ 24).
  const k = Math.min(m, pool.length);
  const best: number[] = [];
  for (const c of pool) {
    const r = c.rating;
    if (best.length < k) {
      let i = best.length;
      best.push(r);
      while (i > 0 && best[i - 1] < r) { best[i] = best[i - 1]; i--; }
      best[i] = r;
    } else if (r > best[k - 1]) {
      let i = k - 1;
      while (i > 0 && best[i - 1] < r) { best[i] = best[i - 1]; i--; }
      best[i] = r;
    }
  }
  const cut = best[k - 1] - STANDING_DOWN - STANDING_UP;
  const cands: { c: Competitor; s: number }[] = [];
  for (const c of pool) if (c.rating >= cut) cands.push({ c, s: standingKey(w, c) });
  cands.sort((a, b) => b.s - a.s || (a.c.id < b.c.id ? -1 : 1));
  return cands.slice(0, m).map((x) => x.c);
}

/** Prestige value of an event (v0.3; documented in docs/WORLD.md). */
export function tournamentPrestige(kind: TournamentKind, arena: number): number {
  const a = legacyScale(arena);
  switch (kind) {
    case 'championship': return Math.round(40 + 8 * a);
    case 'invitational': return Math.round(18 + 4 * a);
    case 'league': return Math.round(20 + 4 * a);
    case 'cup':
    case 'gauntlet': return Math.round(14 + 3 * a);
    case 'open': return Math.round(10 + 2 * a);
    case 'hosted': return Math.round(5 + a);
    case 'qualifier': return Math.round(8 + 2 * a);
    case 'local-open': return arena >= 8 ? 16 : 8;
    case 'regional': return 60;
    case 'regional-defense': return 55;
    case 'elite': return 130;
  }
}

/** Qualification rule of an event, in words (v0.3). */
export function qualificationText(w: WorldState, t: Pick<WorldTournament, 'kind' | 'arena' | 'region' | 'size' | 'band' | 'feeds'>): string {
  const A = ARENAS[t.arena]?.name ?? 'the arena';
  const R = isRegionId(t.region) ? REGION_BY_ID[t.region] : null;
  switch (t.kind) {
    case 'open': return `Open registration: ${t.size} established competitors of ${A} are drawn.`;
    case 'league': return `The top ${t.size} of ${A} by standing (rating, form, prestige); the reigning champion is always invited.`;
    case 'cup': return `The top ${t.size} of ${A} by standing; the reigning champion is always invited and seeded first.`;
    case 'gauntlet': return `Open draw: ${t.size} established competitors of ${A}.`;
    case 'invitational': return `By standing: the top ${t.size} of ${A}; the reigning champion and the winner of the ${short(t.arena)} Qualifier are guaranteed places.`;
    case 'championship': return `Title match: the Champion of ${short(t.arena)} against the challenger (the latest League winner of the arena, else the latest Open / Cup / Gauntlet winner, else the top contender).`;
    case 'hosted': return `Hosted invitational: competitors of ${A} drawn by the host.`;
    case 'local-open': return `Open registration for competitors of ${R?.name ?? 'the region'} in arenas ${t.band?.[0] ?? 0}–${t.band?.[1] ?? TOP_ARENA}; ${t.size} are drawn.`;
    case 'regional': return `The top ${t.size} of ${R?.name ?? 'the region'} by standing; the reigning ${R?.crown ?? 'crown holder'} and the last two Upper Division Open winners of the region are guaranteed places.`;
    case 'regional-defense': return `Title defence: the ${R?.crown ?? 'crown'} holder against the leading contender of ${R?.name ?? 'the region'} (a rival of the champion in the region's top four takes precedence).`;
    case 'qualifier': {
      const target = t.feeds ? w.tournaments.find((x) => x.id === t.feeds) : undefined;
      return `Established competitors of ${A} outside its top six by standing; the winner earns a place in the ${target?.name ?? 'arena Invitational'}.`;
    }
    case 'elite': return `By invitation: the top 8 competitors of the empire by standing (arenas ${ELITE_ARENA_MIN}–${TOP_ARENA}); the Champion of the Eternal Throne is always invited.`;
  }
}

type NewTournament = {
  name: string; arena: number; kind: TournamentKind; format: Format; season: number; startDay: number; every: number; size: number;
  region?: string; series?: string; titleId?: string; band?: [number, number]; feeds?: string; matchGames?: number;
};
function addTournament(w: WorldState, o: NewTournament): WorldTournament {
  const id = `t${String(++w.tournamentSerial).padStart(6, '0')}`;
  const t: WorldTournament = {
    id, name: o.name, arena: o.arena, kind: o.kind, format: o.format, season: o.season,
    startDay: o.startDay, roundEveryDays: o.every, nextRoundDay: o.startDay,
    status: 'scheduled', state: null, playerEntered: false, prize: prizeFor(o.kind, o.arena),
    titleId: o.titleId, featured: [], gameIds: {}, size: o.size,
    region: o.region ?? IMPERIAL, prestige: tournamentPrestige(o.kind, o.arena), series: o.series ?? `${o.kind}-${o.arena}`,
    ...(o.band ? { band: o.band } : {}), ...(o.feeds ? { feeds: o.feeds } : {}), ...(o.matchGames ? { matchGames: o.matchGames } : {}),
  };
  t.trophy = winnerDefFor(t.kind, t.arena, t);
  t.qualification = qualificationText(w, t);
  w.tournaments.push(t);
  return t;
}

export function scheduleSeason(w: WorldState, season: number) {
  const startDay = season * DAYS_PER_SEASON;
  const invitational = new Map<number, string>();
  for (const slot of seasonSlots(season)) {
    for (let a = 0; a < ARENAS.length; a++) {
      const t = addTournament(w, {
        name: slot.name(a, season), arena: a, kind: slot.kind, format: slot.format, season, startDay: startDay + slot.offset, every: slot.every, size: slot.size,
        titleId: slot.kind === 'championship' ? titleIdFor(a) : undefined, series: slot.kind === 'championship' ? `title-${a}` : undefined,
      });
      if (slot.kind === 'invitational') invitational.set(a, t.id);
    }
  }
  if (!w.regionTitles) return; // pre-v0.3 world (ensureWorldV3 not yet run): arena circuit only
  // v0.3: imperial events.
  addTournament(w, { name: `Imperial Masters ${roman(season + 1)}`, arena: MASTERS_ARENA, kind: 'elite', format: 'round-robin', season, startDay: startDay + REGIONAL_OFFSETS.elite, every: 1, size: 8, series: 'masters' });
  for (let a = 0; a < ARENAS.length; a++) {
    addTournament(w, { name: `${short(a)} Qualifier`, arena: a, kind: 'qualifier', format: 'swiss', season, startDay: startDay + REGIONAL_OFFSETS.qualifier, every: 1, size: 12, feeds: invitational.get(a), series: `qual-${a}` });
  }
  // v0.3: regional circuits.
  for (const r of REGIONS) {
    for (const b of LOCAL_BANDS) {
      addTournament(w, {
        name: `${r.openName} · ${b.label}`, arena: b.arena, kind: 'local-open', format: 'swiss', season, startDay: startDay + REGIONAL_OFFSETS.localOpen, every: 1, size: 16,
        region: r.id, band: [b.lo, b.hi], series: `lopen-${r.id}-${b.id}`,
      });
    }
    if (season % 2 === 0) {
      addTournament(w, {
        name: `${r.signature.name} ${roman(season / 2 + 1)}`, arena: REGIONAL_DEFAULT_ARENA, kind: 'regional', format: r.signature.format, season, startDay: startDay + REGIONAL_OFFSETS.regional, every: 1,
        size: r.signature.size, region: r.id, titleId: regionTitleId(r.id), series: `crown-${r.id}`, matchGames: r.signature.matchGames,
      });
    } else {
      addTournament(w, {
        name: `Defence of the ${r.crown} ${roman((season + 1) / 2)}`, arena: REGIONAL_DEFAULT_ARENA, kind: 'regional-defense', format: 'match-series', season, startDay: startDay + REGIONAL_OFFSETS.defense, every: 1,
        size: 2, region: r.id, titleId: regionTitleId(r.id), series: `crown-${r.id}`, matchGames: 4,
      });
    }
  }
}

export type PlayerHooks = {
  playerRating: () => number;
  playerArena: () => number;
  playerName: string;
  onPlayerTournamentEnd?: (t: WorldTournament, place: number) => void;
  onPlayerTitle?: (titleId: string, gained: boolean) => void;
  /** v0.2: a trophy was presented to the player (called once per new award). */
  onPlayerAward?: (a: AwardRecord) => void;
  /** v0.3: the player's home region (default 'latium'). */
  playerRegion?: () => RegionId;
  /** v0.3: the player gained / lost a regional crown. */
  onPlayerRegionalTitle?: (titleId: string, gained: boolean) => void;
  /** v0.3: the player qualified for an event through a qualifier. */
  onPlayerQualified?: (target: WorldTournament, via: WorldTournament) => void;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Upper Division Open winners of a region in the last `seasons` seasons, newest first. */
function recentUpperOpenWinners(w: WorldState, region: RegionId, season: number, seasons = 2): string[] {
  const out: string[] = [];
  const list = awardsByDef(w, 'lopen-upper');
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    if (a.season < season - seasons) break;
    if (a.region === region && !out.includes(a.holder)) out.push(a.holder);
  }
  return out;
}

function regionalEntrants(w: WorldState, t: WorldTournament, size: number, busy: Map<string, number>): string[] {
  const region = t.region as RegionId;
  const pool = topByStanding(w, regionBand(w, region, 0, TOP_ARENA).filter(free(busy, MAX_CONCURRENT)), size);
  const guaranteed: string[] = [];
  const holder = regionTitle(w, region)?.holder;
  if (holder && holder !== PLAYER_ID && getCompetitor(w, holder)?.retiredDay === null) guaranteed.push(holder);
  for (const id of recentUpperOpenWinners(w, region, t.season)) {
    if (guaranteed.length >= 3) break;
    if (id !== PLAYER_ID && !guaranteed.includes(id) && getCompetitor(w, id)?.retiredDay === null) guaranteed.push(id);
  }
  const out = guaranteed.slice(0, size);
  for (const c of pool) {
    if (out.length >= size) break;
    if (!out.includes(c.id)) out.push(c.id);
  }
  t.qualified = guaranteed.filter((id) => out.includes(id));
  return out;
}

/**
 * The challenger for a regional title defence: the highest-standing
 * contender of the region; a rival of the champion (feud intensity ≥ 4) among
 * the region's top four takes precedence. Pure.
 */
export function regionalChallenger(w: WorldState, region: RegionId, holder: string | null, exclude: string[] = []): string | null {
  const pool = topByStanding(w, regionBand(w, region, 0, TOP_ARENA).filter((c) => c.id !== holder && !exclude.includes(c.id)), 4);
  const top4 = new Set(pool.slice(0, 4).map((c) => c.id));
  if (holder) {
    const rival = feudsOf(w, holder, 10).find((f) => top4.has(f.other) && f.intensity >= 4);
    if (rival) return rival.other;
  }
  return pool[0]?.id ?? null;
}

function startTournament(w: WorldState, t: WorldTournament, hooks: PlayerHooks | null) {
  const rng = createRng(mixSeed(w.seed, 'tstart', t.id));
  const busy = busyCounts(w);
  let entrants: string[];
  if (t.kind === 'championship') {
    const title = w.titles.find((x) => x.id === t.titleId)!;
    // A champion who retired or left the arena relinquishes the title before the match.
    if (title.holder && title.holder !== PLAYER_ID) {
      const hc = getCompetitor(w, title.holder);
      if (!hc || hc.retiredDay !== null) vacateTitle(w, title, hc ? `${hc.name} retires as champion; the title ${title.name} is vacated.` : `The title ${title.name} is vacated.`, hooks);
      else if (Math.abs(RANKS[hc.rank].arena - t.arena) > TITLE_ARENA_TOLERANCE) vacateTitle(w, title, `${hc.name} now competes in ${ARENAS[RANKS[hc.rank].arena].name} and relinquishes the title ${title.name}.`, hooks);
    } else if (title.holder === PLAYER_ID && hooks && Math.abs(hooks.playerArena() - t.arena) > TITLE_ARENA_TOLERANCE) {
      vacateTitle(w, title, `${hooks.playerName} now competes in ${ARENAS[hooks.playerArena()].name} and relinquishes the title ${title.name}.`, hooks);
    }
    const challenger = championshipChallenger(w, t.arena, title.holder);
    let holder = title.holder;
    if (!holder) {
      // Vacant title: the two top contenders contest it.
      const pool = arenaPool(w, t.arena).filter((c) => c.id !== challenger).sort((a, b) => b.rating - a.rating || (a.id < b.id ? -1 : 1));
      holder = pool[0]?.id ?? null;
    }
    const ch = t.playerEntered && holder !== PLAYER_ID ? PLAYER_ID : challenger && challenger !== holder ? challenger : null;
    if (!holder || !ch) {
      t.status = 'complete';
      return;
    }
    entrants = [holder, ch];
  } else if (t.kind === 'regional-defense') {
    const region = t.region as RegionId;
    const title = regionTitle(w, region)!;
    if (title.holder && title.holder !== PLAYER_ID && getCompetitor(w, title.holder)?.retiredDay !== null) vacateTitle(w, title, `The ${title.name} is vacated.`, hooks);
    let holder = title.holder;
    if (holder === PLAYER_ID && !hooks) holder = null; // no player session: cannot defend (never happens in a career)
    let ch = t.playerEntered && holder !== PLAYER_ID ? PLAYER_ID : regionalChallenger(w, region, holder);
    if (!holder) {
      // Vacant crown: the two top contenders contest it.
      holder = regionalChallenger(w, region, null, ch ? [ch] : []);
      if (holder === ch) ch = null;
    }
    if (!holder || !ch || holder === ch) {
      t.status = 'complete';
      return;
    }
    entrants = [holder, ch];
  } else if (t.kind === 'regional') {
    entrants = regionalEntrants(w, t, t.size - (t.playerEntered ? 1 : 0), busy);
    if (t.playerEntered) entrants.push(PLAYER_ID);
    const arenas = entrants.filter((id) => id !== PLAYER_ID).map((id) => RANKS[getCompetitor(w, id)!.rank].arena);
    if (arenas.length) t.arena = median(arenas);
  } else if (t.kind === 'local-open') {
    const [lo, hi] = t.band ?? [0, TOP_ARENA];
    const pool = regionBand(w, t.region as RegionId, lo, hi).filter(free(busy, MAX_CONCURRENT));
    entrants = [];
    const want = t.size - (t.playerEntered ? 1 : 0);
    while (entrants.length < want && pool.length) entrants.push(pool.splice(rng.int(0, pool.length), 1)[0].id);
    if (t.playerEntered) entrants.push(PLAYER_ID);
  } else if (t.kind === 'qualifier') {
    const pool = arenaPool(w, t.arena).filter(free(busy, MAX_CONCURRENT));
    const holder = w.titles.find((x) => x.arena === t.arena)?.holder;
    const top = new Set(topByStanding(w, arenaPool(w, t.arena), 6).map((c) => c.id));
    const cands = pool.filter((c) => !top.has(c.id) && c.id !== holder);
    entrants = [];
    const want = t.size - (t.playerEntered ? 1 : 0);
    while (entrants.length < want && cands.length) entrants.push(cands.splice(rng.int(0, cands.length), 1)[0].id);
    if (t.playerEntered) entrants.push(PLAYER_ID);
  } else if (t.kind === 'elite') {
    const pool: Competitor[] = [];
    for (let a = ELITE_ARENA_MIN; a <= TOP_ARENA; a++) for (const c of arenaPool(w, a)) if (free(busy, MAX_CONCURRENT)(c)) pool.push(c);
    const want = t.size - (t.playerEntered ? 1 : 0);
    entrants = topByStanding(w, pool, want).map((c) => c.id);
    const emperor = w.titles.find((x) => x.arena === TOP_ARENA)?.holder;
    if (emperor && emperor !== PLAYER_ID && !entrants.includes(emperor) && getCompetitor(w, emperor)?.retiredDay === null && entrants.length) entrants[entrants.length - 1] = emperor;
    if (t.playerEntered) entrants.push(PLAYER_ID);
  } else {
    const target = t.kind === 'invitational' ? (t.qualified ?? []) : [];
    entrants = pickEntrants(w, t.arena, t.size - (t.playerEntered ? 1 : 0), t.kind, rng, busy, target);
    if (t.playerEntered) entrants.push(PLAYER_ID);
  }
  entrants = [...new Set(entrants)];
  if (entrants.length < 2) {
    t.status = 'complete';
    return;
  }
  const byId = competitorMap(w);
  const ratings: Record<string, number> = {};
  for (const id of entrants) {
    ratings[id] = id === PLAYER_ID ? (hooks?.playerRating() ?? 1000) : (byId.get(id)?.rating ?? 1000);
    const c = byId.get(id);
    if (c) c.tp = (c.tp ?? 0) + 1;
  }
  const arenaGames = t.arena >= 16 ? 6 : 4;
  // Championship privilege: reigning title holders are seeded first (own arena's champion on top);
  // regional crown holders are seeded first in their region's events.
  const holders = w.titles.filter((x) => x.holder && entrants.includes(x.holder)).sort((a, b) => Number(b.arena === t.arena) - Number(a.arena === t.arena) || b.arena - a.arena).map((x) => x.holder!);
  const crown = isRegionId(t.region) ? regionTitle(w, t.region)?.holder : null;
  if (crown && entrants.includes(crown) && isRegionalKind(t.kind)) holders.unshift(crown);
  let cfg: TournamentConfig | undefined;
  if (t.format === 'match-series') {
    // Title matches: the reigning holder keeps the title on a drawn match (champion's draw odds).
    const keeper = t.kind === 'championship' ? w.titles.find((x) => x.id === t.titleId)?.holder
      : t.kind === 'regional-defense' && isRegionId(t.region) ? regionTitle(w, t.region)?.holder : null;
    cfg = { matchGames: t.matchGames ?? arenaGames, ...(keeper && entrants.includes(keeper) ? { retainOnTie: keeper } : {}) };
  }
  else if (holders.length) cfg = { topSeeds: [...new Set(holders)] };
  t.state = createTournament(t.format, entrants, ratings, cfg);
  t.status = 'running';
  t.nextRoundDay = w.day;
  // Feature the most prestigious pairings for live engine broadcast in Spectate.
  markFeatured(t);
}

/** Vacate a title (holder retired or left the arena). Reign closed, awards become historical. Works for arena titles and regional crowns. */
export function vacateTitle(w: WorldState, title: TitleState, text: string, hooks: PlayerHooks | null) {
  const prev = title.holder;
  if (!prev) return;
  const regional = !!title.region;
  const reigns = regional ? (w.regionReigns ??= []) : w.reigns;
  const reign = reigns.find((r) => r.titleId === title.id && r.to === null);
  if (reign) reign.to = w.day;
  if (prev === PLAYER_ID) (regional ? hooks?.onPlayerRegionalTitle : hooks?.onPlayerTitle)?.(title.id, false);
  else if (!regional) {
    const pc = getCompetitor(w, prev);
    if (pc) pc.titles = pc.titles.filter((x) => x !== title.id);
  }
  title.holder = null;
  title.since = w.day;
  title.defenses = 0;
  seriesChanged(w, regional ? `crown-${title.region}` : `title-${title.arena}`, null);
  pushChronicle(w, { day: w.day, kind: 'title', ...(regional ? { region: title.region } : { arena: title.arena }), ids: [prev], text });
}

export function markFeatured(t: WorldTournament) {
  if (!t.state) return;
  const pend = pendingPairings(t.state).filter((p) => p.white !== PLAYER_ID && p.black !== PLAYER_ID);
  const sum = (p: Pairing) => (t.state!.ratings[p.white] ?? 0) + (t.state!.ratings[p.black ?? ''] ?? 0);
  pend.sort((a, b) => sum(b) - sum(a));
  const n = t.kind === 'championship' || t.kind === 'regional-defense' ? 1 : t.kind === 'local-open' || t.kind === 'qualifier' ? 0 : 2;
  t.featured = pend.slice(0, n).map((p) => p.id);
}

const ARENA_CHALLENGE_KINDS = new Set(['league', 'open', 'cup', 'gauntlet']);
export function championshipChallenger(w: WorldState, arena: number, holder: string | null): string | null {
  // Most recent League winner of this arena, else most recent Open/Cup winner, else top-rated contender.
  let league: TournamentSummary | undefined;
  let other: TournamentSummary | undefined;
  for (let i = w.history.length - 1; i >= 0 && !league; i--) {
    const h = w.history[i];
    if (h.arena !== arena || !h.winner || h.winner === holder || !ARENA_CHALLENGE_KINDS.has(h.kind)) continue;
    if (h.kind === 'league') league = h;
    else other ??= h;
  }
  const cand = league ?? other;
  if (cand?.winner) {
    if (cand.winner === PLAYER_ID) return PLAYER_ID;
    const c = getCompetitor(w, cand.winner);
    if (c && c.retiredDay === null && Math.abs(RANKS[c.rank].arena - arena) <= 2) return c.id;
  }
  const pool = arenaPool(w, arena).filter((c) => c.id !== holder);
  const key = new Map(pool.map((c) => [c.id, c.rating + Math.min(300, competitorPrestige(w, c)) * 0.3]));
  pool.sort((a, b) => key.get(b.id)! - key.get(a.id)! || (a.id < b.id ? -1 : 1));
  return pool[0]?.id ?? null;
}

/** Resolve a pairing statistically (AI vs AI). */
function simPairing(w: WorldState, t: WorldTournament, p: Pairing, rng: Rng, byId: Map<string, Competitor>) {
  const a = byId.get(p.white);
  const b = p.black ? byId.get(p.black) : undefined;
  if (!a || !b) {
    recordResult(t.state!, p.id, a ? 1 : 0);
    return;
  }
  const s = simulateGame(a, b, rng); // matchOutcome applies the armageddon rule
  applyRatedTournamentResult(w, p, s, byId);
  recordResult(t.state!, p.id, s);
}

export function applyRatedTournamentResult(w: WorldState, p: Pairing, whiteScore: number, byId = competitorMap(w)) {
  const a = byId.get(p.white);
  const b = p.black ? byId.get(p.black) : undefined;
  if (a && b) {
    const ar = a.rating;
    recordCompetitorResult(a, b.id, b.rating, whiteScore);
    recordCompetitorResult(b, a.id, ar, 1 - whiteScore);
    w.stats.simGames++;
  }
}

/** Is the player's game blocking this tournament's current round? */
export function playerPairing(t: WorldTournament): Pairing | null {
  if (!t.state || t.status !== 'running') return null;
  return pendingPairings(t.state).find((p) => p.white === PLAYER_ID || p.black === PLAYER_ID) ?? null;
}

const HISTORIC_DEFENSES = new Set([3, 5, 7, 10, 15, 20]);

function finishTournament(w: WorldState, t: WorldTournament, hooks: PlayerHooks | null) {
  const st = t.state!;
  t.status = 'complete';
  const byId = competitorMap(w);
  const nameOf = (id: string | null) => (id === PLAYER_ID ? (hooks?.playerName ?? 'You') : id ? (byId.get(id)?.name ?? 'Unknown') : '—');
  const rows = standings(st);
  const winner = st.winner ?? rows[0]?.id ?? null;
  const runnerUp = st.runnerUp ?? rows[1]?.id ?? null;
  const region = t.region ?? IMPERIAL;
  const regionKind = isRegionalKind(t.kind);
  const summary: TournamentSummary = {
    id: t.id, name: t.name, arena: t.arena, kind: t.kind, format: t.format, season: t.season, endDay: w.day,
    winner, winnerName: nameOf(winner), runnerUp, runnerUpName: nameOf(runnerUp), size: st.entrants.length,
    region, series: t.series, prestige: t.prestige,
  };
  if (t.playerEntered) {
    const row = rows.find((r) => r.id === PLAYER_ID);
    summary.playerPlace = winner === PLAYER_ID ? 1 : runnerUp === PLAYER_ID ? 2 : row?.place;
    hooks?.onPlayerTournamentEnd?.(t, summary.playerPlace ?? rows.length);
  }
  w.history.push(summary);
  if (w.history.length > HISTORY_CAP) w.history.splice(0, w.history.length - HISTORY_CAP);
  // Trophies (before the title changes hands, so defences are recognised).
  const titleBefore = t.kind === 'championship' && t.titleId ? w.titles.find((x) => x.id === t.titleId)
    : (t.kind === 'regional' || t.kind === 'regional-defense') && isRegionId(t.region) ? regionTitle(w, t.region) : undefined;
  processTournamentAwards(w, t, {
    nameOf: (id) => nameOf(id),
    prevHolder: titleBefore?.holder ?? null,
    prevDefenses: titleBefore?.defenses ?? 0,
    onAward: (a) => { if (a.holder === PLAYER_ID) hooks?.onPlayerAward?.(a); },
  });
  const wc = winner ? byId.get(winner) : undefined;
  if (wc) {
    wc.tournamentsWon++;
    if ((t.kind !== 'open' && t.kind !== 'local-open' && t.kind !== 'qualifier') || legacyScale(t.arena) >= 6) wc.honours.push(`${t.name} (S${t.season + 1})`);
    if (wc.honours.length > 30) wc.honours.splice(0, wc.honours.length - 30);
  }
  // v0.3: rivalries and upsets from the important encounters of this event.
  const isLegend = (id: string) => (byId.get(id)?.championships ?? 0) >= 3;
  const enc = recordEncounters(w, t, (id) => nameOf(id), isLegend, region);
  const cregion = isRegionId(region) ? region : undefined;
  const loc = { arena: t.arena, ...(cregion ? { region: cregion } : {}) };
  if (t.kind === 'championship' && t.titleId && winner) {
    const title = w.titles.find((x) => x.id === t.titleId)!;
    const prev = title.holder;
    if (prev === winner) {
      title.defenses++;
      const reign = w.reigns.find((r) => r.titleId === title.id && r.to === null);
      if (reign) reign.defenses++;
      const record = w.hall?.best['consecutive-defenses'];
      const historic = HISTORIC_DEFENSES.has(title.defenses) || (!!record && title.defenses > record.value && record.holder !== winner);
      pushChronicle(w, historic
        ? { day: w.day, kind: 'title', tag: 'historic-defense', arena: t.arena, ids: [winner], text: `Historic defence: ${nameOf(winner)} retains the ${short(t.arena)} crown for the ${ordinal(title.defenses)} consecutive time, against ${nameOf(runnerUp)}.` }
        : { day: w.day, kind: 'title', arena: t.arena, ids: [winner], text: `${nameOf(winner)} defends the ${short(t.arena)} crown against ${nameOf(runnerUp)}.` });
    } else {
      const comeback = w.reigns.some((r) => r.titleId === title.id && r.holder === winner && r.to !== null);
      const gap = (st.ratings[runnerUp ?? ''] ?? 0) - (st.ratings[winner] ?? 0);
      const tag: ChronicleEntry['tag'] = prev && runnerUp === prev && gap >= 150 ? 'elite-upset' : comeback ? 'comeback' : 'new-champion';
      const old = w.reigns.find((r) => r.titleId === title.id && r.to === null);
      if (old) old.to = w.day;
      if (prev && prev !== PLAYER_ID) {
        const pc = byId.get(prev);
        if (pc) pc.titles = pc.titles.filter((x) => x !== title.id);
      }
      if (prev === PLAYER_ID) hooks?.onPlayerTitle?.(title.id, false);
      title.holder = winner;
      title.since = w.day;
      title.defenses = 0;
      seriesChanged(w, `title-${t.arena}`, winner);
      w.reigns.push({ titleId: title.id, holder: winner, holderName: nameOf(winner), from: w.day, to: null, defenses: 0 });
      if (winner === PLAYER_ID) hooks?.onPlayerTitle?.(title.id, true);
      else if (wc) {
        wc.titles.push(title.id);
        wc.championships++;
      }
      // One arena title at a time: a new champion relinquishes any other arena title.
      for (const other of w.titles) {
        if (other.id === title.id || other.holder !== winner) continue;
        vacateTitle(w, other, `${nameOf(winner)}, now ${title.name}, relinquishes the title ${other.name}.`, hooks);
      }
      const text = tag === 'comeback'
        ? `${nameOf(winner)} regains the crown: ${title.name} once more, defeating ${nameOf(runnerUp)}.`
        : tag === 'elite-upset'
          ? `Upset! ${nameOf(winner)} (${st.ratings[winner]}) dethrones ${nameOf(prev)} (${st.ratings[prev!]}) to become ${title.name}.`
          : prev ? `${nameOf(winner)} dethrones ${nameOf(prev)} to become ${title.name}.` : `${nameOf(winner)} claims the vacant title ${title.name}.`;
      pushChronicle(w, { day: w.day, kind: 'title', tag, arena: t.arena, ids: prev ? [winner, prev] : [winner], text });
      if (prev && prev === runnerUp && isLegend(prev) && !isLegend(winner)) {
        pushChronicle(w, { day: w.day, kind: 'title', tag: 'legend-defeated', arena: t.arena, ids: [winner, prev], text: `The legend ${nameOf(prev)} (${byId.get(prev)?.championships ?? 0} championships) falls to ${nameOf(winner)}.` });
      }
    }
  } else if ((t.kind === 'regional' || t.kind === 'regional-defense') && cregion && winner) {
    crownResult(w, t, cregion, winner, runnerUp, nameOf, hooks);
  } else if (winner) {
    const seed = st.entrants.indexOf(winner);
    const gap = (st.ratings[st.entrants[0]] ?? 0) - (st.ratings[winner] ?? 0);
    const upset = st.entrants.length >= 6 && seed >= st.entrants.length / 2 && gap >= 150;
    if (t.kind === 'elite') {
      pushChronicle(w, { day: w.day, kind: 'tournament', ...loc, ids: [winner], text: `${nameOf(winner)} wins the ${t.name}, the gathering of the empire's elite (${summaryResult(st, winner)}).` });
    } else if (regionKind || t.kind === 'qualifier') {
      if (winner === PLAYER_ID) pushChronicle(w, { day: w.day, kind: 'tournament', ...loc, ids: [winner], text: `${nameOf(winner)} wins the ${t.name}.` });
    } else if (upset && (legacyScale(t.arena) >= 3 || winner === PLAYER_ID)) {
      pushChronicle(w, { day: w.day, kind: 'tournament', tag: 'tournament-upset', arena: t.arena, ids: [winner], text: `Upset: ${nameOf(winner)}, seeded ${seed + 1} of ${st.entrants.length}, wins the ${t.name}.` });
    } else if (legacyScale(t.arena) >= 6 || t.kind === 'league' || winner === PLAYER_ID) {
      pushChronicle(w, { day: w.day, kind: 'tournament', arena: t.arena, ids: [winner], text: `${nameOf(winner)} wins the ${t.name}.` });
    }
  }
  // Qualifier → the arena Invitational.
  if (t.kind === 'qualifier' && winner && t.feeds) {
    const target = w.tournaments.find((x) => x.id === t.feeds);
    if (target && target.status === 'scheduled') {
      target.qualified = [...new Set([...(target.qualified ?? []), winner])];
      if (winner === PLAYER_ID) {
        target.playerEntered = true;
        target.invitedPlayer = true;
        hooks?.onPlayerQualified?.(target, t);
      }
    }
  }
  // Event-driven highlights.
  if (enc.upset && enc.upset.gap >= MAJOR_UPSET_GAP && (legacyScale(t.arena) >= 3 || regionKind || enc.upset.winner === PLAYER_ID || enc.upset.loser === PLAYER_ID)) {
    const u = enc.upset;
    const stage = u.stage === 'title' ? 'title match' : u.stage === 'final' ? 'final' : 'knockout';
    pushChronicle(w, { day: w.day, kind: 'tournament', tag: 'major-upset', ...loc, ids: [u.winner, u.loser], text: `Major upset in the ${t.name} ${stage}: ${u.winnerName} (${u.winnerRating}) defeats ${u.loserName} (${u.loserRating}).` });
  }
  if (enc.legendFall && t.kind !== 'championship') {
    const { legend, by } = enc.legendFall;
    pushChronicle(w, { day: w.day, kind: 'tournament', tag: 'legend-defeated', ...loc, ids: [by, legend], text: `The legend ${nameOf(legend)} (${byId.get(legend)?.championships ?? 0} championships) is knocked out of the ${t.name} by ${nameOf(by)}.` });
  }
  // A late event may complete a past season: present its Season Laurel now.
  if (t.season < w.season) {
    presentSeasonLaurels(w, (id) => nameOf(id), (a) => { if (a.holder === PLAYER_ID) hooks?.onPlayerAward?.(a); });
    presentRegionLaurels(w, (id) => nameOf(id), (a) => { if (a.holder === PLAYER_ID) hooks?.onPlayerAward?.(a); }, (id) => arenaOfId(w, id, hooks));
  }
}

function arenaOfId(w: WorldState, id: string, hooks: PlayerHooks | null): number {
  if (id === PLAYER_ID) return hooks?.playerArena() ?? 5;
  const c = getCompetitor(w, id);
  return c ? RANKS[c.rank].arena : 5;
}

function summaryResult(st: TournamentState, id: string): string {
  const r = standings(st).find((x) => x.id === id);
  return r ? `${r.points}/${r.wins + r.draws + r.losses + r.byes}` : '';
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Regional crown changes hands / is retained (regional championship or title defence). */
function crownResult(w: WorldState, t: WorldTournament, region: RegionId, winner: string, runnerUp: string | null, nameOf: (id: string | null) => string, hooks: PlayerHooks | null) {
  const title = regionTitle(w, region)!;
  const reigns = (w.regionReigns ??= []);
  const prev = title.holder;
  const R = REGION_BY_ID[region];
  if (prev === winner) {
    title.defenses++;
    const reign = reigns.find((r) => r.titleId === title.id && r.to === null);
    if (reign) reign.defenses++;
    const historic = HISTORIC_DEFENSES.has(title.defenses);
    pushChronicle(w, {
      day: w.day, kind: 'title', ...(historic ? { tag: 'historic-defense' as const } : {}), arena: t.arena, region, ids: [winner],
      text: historic
        ? `Historic defence: ${nameOf(winner)} keeps the ${R.crown} for the ${ordinal(title.defenses)} consecutive time (${t.name}).`
        : `${nameOf(winner)} retains the ${R.crown} in the ${t.name}${runnerUp ? `, defeating ${nameOf(runnerUp)}` : ''}.`,
    });
    return;
  }
  const old = reigns.find((r) => r.titleId === title.id && r.to === null);
  if (old) old.to = w.day;
  if (prev === PLAYER_ID) hooks?.onPlayerRegionalTitle?.(title.id, false);
  title.holder = winner;
  title.since = w.day;
  title.defenses = 0;
  seriesChanged(w, `crown-${region}`, winner);
  reigns.push({ titleId: title.id, holder: winner, holderName: nameOf(winner), from: w.day, to: null, defenses: 0 });
  if (winner === PLAYER_ID) hooks?.onPlayerRegionalTitle?.(title.id, true);
  const comeback = reigns.some((r) => r.titleId === title.id && r.holder === winner && r.to !== null);
  pushChronicle(w, {
    day: w.day, kind: 'title', tag: 'regional-champion', arena: t.arena, region, ids: prev ? [winner, prev] : [winner],
    text: prev
      ? `${nameOf(winner)} ${comeback ? 'regains' : 'takes'} the ${R.crown} from ${nameOf(prev)} (${t.name}).`
      : `${nameOf(winner)} is crowned: ${R.crown} (${t.name}).`,
  });
}

/** Advance tournaments for the current day. Rounds wait for the player's own game. */
export function tickTournaments(w: WorldState, hooks: PlayerHooks | null) {
  const rng = createRng(mixSeed(w.seed, 'tourn', w.day));
  const byId = competitorMap(w);
  for (const t of w.tournaments) {
    if (t.status === 'scheduled' && t.startDay <= w.day) startTournament(w, t, hooks);
    if (t.status !== 'running' || !t.state) continue;
    if (t.nextRoundDay > w.day) continue;
    const roundBefore = t.state.rounds.length;
    // Resolve every AI pairing in the current round (including spawned tiebreaks).
    for (let guard = 0; guard < 20 && t.state && !t.state.complete; guard++) {
      const pend = pendingPairings(t.state).filter((p) => p.white !== PLAYER_ID && p.black !== PLAYER_ID);
      if (pend.length === 0) break;
      for (const p of pend) simPairing(w, t, p, rng, byId);
      if (t.state.rounds.length !== roundBefore) break;
    }
    if (t.state.complete) finishTournament(w, t, hooks);
    else if (t.state.rounds.length !== roundBefore) {
      t.nextRoundDay = w.day + t.roundEveryDays;
      markFeatured(t);
    }
  }
}

/** Record the player's tournament game. */
export function recordPlayerTournamentGame(w: WorldState, tournamentId: string, pairingId: string, whiteScore: number, hooks: PlayerHooks, gameId?: string) {
  const t = w.tournaments.find((x) => x.id === tournamentId);
  if (!t?.state) return;
  const p = t.state.rounds.flat().find((x) => x.id === pairingId);
  if (!p || p.result !== null) return;
  if (gameId) t.gameIds[pairingId] = gameId;
  // Rate the AI side (the player's own rating is handled by the career module).
  const oppId = p.white === PLAYER_ID ? p.black : p.white;
  const opp = getCompetitor(w, oppId);
  if (opp) recordCompetitorResult(opp, PLAYER_ID, hooks.playerRating(), p.white === PLAYER_ID ? 1 - whiteScore : whiteScore);
  const roundBefore = t.state.rounds.length;
  recordResult(t.state, pairingId, whiteScore);
  if (t.state.complete) finishTournament(w, t, hooks);
  else if (t.state.rounds.length !== roundBefore) {
    t.nextRoundDay = w.day + t.roundEveryDays;
    markFeatured(t);
  }
}

/** Record an engine-played (spectated) AI tournament game. */
export function recordEngineTournamentGame(w: WorldState, tournamentId: string, pairingId: string, whiteScore: number, gameId: string, hooks: PlayerHooks | null) {
  const t = w.tournaments.find((x) => x.id === tournamentId);
  if (!t?.state) return;
  const p = t.state.rounds.flat().find((x) => x.id === pairingId);
  if (!p || p.result !== null) return;
  applyRatedTournamentResult(w, p, whiteScore);
  t.gameIds[pairingId] = gameId;
  w.stats.simGames--; // counted as engine game instead
  const roundBefore = t.state.rounds.length;
  recordResult(t.state, pairingId, whiteScore);
  if (t.state.complete) finishTournament(w, t, hooks);
  else if (t.state.rounds.length !== roundBefore) {
    t.nextRoundDay = w.day + t.roundEveryDays;
    markFeatured(t);
  }
}

export function withdrawPlayer(w: WorldState, tournamentId: string, hooks: PlayerHooks) {
  const t = w.tournaments.find((x) => x.id === tournamentId);
  if (!t) return;
  if (t.status === 'scheduled') {
    t.playerEntered = false;
    return;
  }
  if (t.state && !t.state.complete) {
    withdraw(t.state, PLAYER_ID);
    t.playerWithdrawn = true;
    if (t.state.complete) finishTournament(w, t, hooks);
  }
}

/** Titles (arena and regional) whose AI holder has retired are vacated the same day. */
function vacateRetiredHolders(w: WorldState, hooks: PlayerHooks | null) {
  for (const title of [...w.titles, ...(w.regionTitles ?? [])]) {
    if (!title.holder || title.holder === PLAYER_ID) continue;
    const c = getCompetitor(w, title.holder);
    if (c && c.retiredDay === null) continue;
    vacateTitle(w, title, c ? `${c.name} retires as ${title.name}; the title is vacated.` : `The title ${title.name} is vacated.`, hooks);
  }
}

/** Advance the world one day: off-screen games, tournaments, season rollover. */
export function advanceDay(w: WorldState, hooks: PlayerHooks | null) {
  ensureWorldV3(w);
  invalidatePools(w);
  tickTournaments(w, hooks);
  const busy = new Set<string>();
  for (const t of w.tournaments) if (t.status === 'running' && t.state) for (const id of t.state.entrants) busy.add(id);
  const seasonBefore = Math.floor(w.day / DAYS_PER_SEASON);
  simulateDay(w, { busy });
  vacateRetiredHolders(w, hooks);
  const seasonAfter = Math.floor(w.day / DAYS_PER_SEASON);
  if (seasonAfter !== seasonBefore) {
    w.season = seasonAfter;
    scheduleSeason(w, seasonAfter);
    const byId = competitorMap(w);
    const nameOf = (id: string) => (id === PLAYER_ID ? (hooks?.playerName ?? 'You') : byId.get(id)?.name ?? w.hall?.legends.find((l) => l.id === id)?.name ?? id);
    const onAward = (a: AwardRecord) => { if (a.holder === PLAYER_ID) hooks?.onPlayerAward?.(a); };
    presentSeasonLaurels(w, nameOf, onAward);
    presentRegionLaurels(w, nameOf, onAward, (id) => arenaOfId(w, id, hooks));
    checkRecordsBroken(w, (e) => pushChronicle(w, e));
    pruneFeuds(w);
    // Keep only live and recent tournaments in the save; summaries persist in history.
    w.tournaments = w.tournaments.filter((t) => t.status !== 'complete' || t.season >= seasonAfter - 1 || t.playerEntered && t.season >= seasonAfter - 4);
  }
}

export function tournamentLabel(t: WorldTournament): string {
  return t.name;
}

// ---------------------------------------------------------------- data API (v0.3)

export type TournamentInfo = {
  id: string; name: string; kind: TournamentKind; arena: number; region: string; format: Format; prestige: number;
  qualification: string; series: string; trophy: string; status: WorldTournament['status'];
  startDay: number; season: number; size: number;
  participants: string[]; champion: string | null; runnerUp: string | null;
  /** Qualified / guaranteed entrants (qualifier winners, local-open winners, crown holder). */
  qualified: string[];
  /** Earlier winners of the same series, newest first, from the permanent award registry. */
  historicalWinners: { season: number; day: number; holder: string; holderName: string; tournamentId: string; result: string }[];
};

/** Everything the UI needs about one event (live, scheduled or a recent completed one). Pure. */
export function tournamentInfo(w: WorldState, t: WorldTournament, historyLimit = 10): TournamentInfo {
  const region = t.region ?? IMPERIAL;
  const series = t.series ?? (t.kind === 'championship' ? `title-${t.arena}` : `${t.kind}-${t.arena}`);
  const trophy = t.trophy ?? winnerDefFor(t.kind, t.arena, t);
  const hist = seriesWinners(w, series, trophy, historyLimit);
  return {
    id: t.id, name: t.name, kind: t.kind, arena: t.arena, region, format: t.format,
    prestige: t.prestige ?? tournamentPrestige(t.kind, t.arena), qualification: t.qualification ?? qualificationText(w, t),
    series, trophy, status: t.status, startDay: t.startDay, season: t.season, size: t.size,
    participants: t.state?.entrants ?? [], champion: t.state?.complete ? (t.state.winner ?? null) : null,
    runnerUp: t.state?.complete ? (t.state.runnerUp ?? null) : null, qualified: t.qualified ?? [], historicalWinners: hist,
  };
}

/** Winners of an event series (e.g. "open-4", "crown-latium", "masters"), newest first. */
export function seriesWinners(w: WorldState, series: string, trophyDef?: string, limit = 20): TournamentInfo['historicalWinners'] {
  const out: TournamentInfo['historicalWinners'] = [];
  const list = trophyDef ? awardsByDef(w, trophyDef) : allAwards(w);
  for (let i = list.length - 1; i >= 0 && out.length < limit; i--) {
    const a = list[i];
    if (a.series !== series || a.defId.startsWith('medal-') || a.defId === 'rmedal' || a.defId.startsWith('defense-') || a.defId === 'rdefense' || a.defId === 'imperial-crown') continue;
    out.push({ season: a.season, day: a.day, holder: a.holder, holderName: a.holderName, tournamentId: a.tournamentId, result: a.result });
  }
  return out;
}

export { matchOutcome, regionOf };
export type { TournamentState };
