/**
 * Imperial Trophy System — a permanent, append-only registry of every honour
 * actually won in the simulated empire (by AI competitors and the player).
 *
 * Rules (see docs/WORLD.md):
 *  - Trophies are presented only from completed tournaments (or a completed
 *    season of tournaments for Season Laurels). Nothing is invented.
 *  - awardId is deterministic (`${tournamentId}:${defId}:${holder}`; lifetime
 *    distinctions use `life:${defId}:${holder}`), so reprocessing a tournament
 *    can never duplicate an award. `WorldTournament.awarded` is a second guard.
 *  - Repeat wins create separate award instances.
 *  - `current` follows the award's `series`: edition series (an event in an
 *    arena) keep only the latest edition current; title series ("title-N")
 *    stay current for the holder until the title changes hands.
 */
import { ARENAS, ARENAS_PER_TIER, TOP_ARENA, migrateArenaIndex } from './arenas';
import { standings, gameScores, type TournamentState, type Pairing } from '../tournament/formats';
import type { AwardRecord, TrophyCategory, TrophyTier, HallOfRecords } from './types';
import type { WorldState, WorldTournament, TournamentKind } from '../game/state';
import { REGIONS, IMPERIAL } from './regions';
import type { Format } from '../tournament/formats';

export const PLAYER = 'player';
export const WORLD_VERSION = 2;

export type TrophyDef = {
  id: string;
  name: string;
  desc: string;
  category: TrophyCategory;
  tier: TrophyTier;
  /** Prestige points this honour contributes to a competitor's standing. */
  prestige: number;
  arena?: number;
  arenaTier?: number;
  /** v0.3: regional trophies. */
  region?: string;
};

export const ARENA_TIER_NAMES = ['Provincial', 'Legionary', 'Senatorial', 'Imperial'];
/** Trophy tier of an arena (v0.3: six arenas per tier). */
export function arenaTier(arena: number): number {
  return Math.max(0, Math.min(3, Math.floor(arena / ARENAS_PER_TIER)));
}
/**
 * Signature trophy definition of an arena. The 12 v0.2 arenas keep their
 * ids (`sig-<old index>`, e.g. the Eternal Throne = sig-11); the 12 arenas
 * added in v0.3 use `sig-a<index>` (baked art: public/trophies/sig-a<index>.webp).
 */
export function sigDefFor(arena: number): string {
  const a = ARENAS[arena];
  return a?.legacyIndex !== undefined ? `sig-${a.legacyIndex}` : `sig-a${arena}`;
}
const sigTier = (arena: number): TrophyTier => (arena >= 18 ? 'legendary' : arena >= 12 ? 'epic' : 'rare');
const TIER_RARITY: TrophyTier[] = ['common', 'common', 'rare', 'epic'];

function buildDefs(): TrophyDef[] {
  const d: TrophyDef[] = [];
  for (const a of ARENAS) {
    if (a.legacyIndex === undefined) continue; // v0.3 arenas: appended below (sig-a<index>)
    d.push({
      id: sigDefFor(a.index), name: a.trophy, desc: `Signature trophy of ${a.name}: won the arena championship match.`,
      category: 'signature', tier: sigTier(a.index), prestige: Math.round(10 + 1.5 * a.index), arena: a.index,
    });
  }
  d.push({ id: 'imperial-crown', name: 'The Imperial Crown', desc: 'Won the championship of the Eternal Throne.', category: 'crown', tier: 'legendary', prestige: 40, arena: TOP_ARENA });
  for (let k = 0; k < 4; k++) {
    const T = ARENA_TIER_NAMES[k];
    const tier = TIER_RARITY[k];
    d.push({ id: `cup-open-t${k}`, name: `${T} Open Cup`, desc: `Won a Swiss Open in a ${T.toLowerCase()} arena.`, category: 'cup', tier, prestige: 2 + 2 * k, arenaTier: k });
    d.push({ id: `cup-cup-t${k}`, name: `${T} Knockout Cup`, desc: `Won a single-elimination Cup in a ${T.toLowerCase()} arena.`, category: 'cup', tier, prestige: 3 + 2 * k, arenaTier: k });
    d.push({ id: `cup-gauntlet-t${k}`, name: `${T} Gauntlet Trophy`, desc: `Survived and won a double-elimination Gauntlet in a ${T.toLowerCase()} arena.`, category: 'cup', tier, prestige: 3 + 2 * k, arenaTier: k });
    d.push({ id: `league-t${k}`, name: `${T} League Shield`, desc: `Regional champion: won a season League in a ${T.toLowerCase()} arena.`, category: 'regional', tier: k >= 2 ? 'epic' : 'rare', prestige: 4 + 3 * k, arenaTier: k });
    d.push({ id: `invit-t${k}`, name: k >= 2 ? `${T} Elite Invitational Trophy` : `${T} Invitational Trophy`, desc: `Won an invitation-only round robin in a ${T.toLowerCase()} arena.`, category: 'elite', tier: k >= 2 ? 'epic' : 'rare', prestige: 4 + 3 * k, arenaTier: k });
    d.push({ id: `hosted-t${k}`, name: `${T} Patron's Cup`, desc: `Won a privately hosted invitational in a ${T.toLowerCase()} arena.`, category: 'cup', tier: 'common', prestige: 1 + k, arenaTier: k });
    d.push({ id: `medal-t${k}`, name: `${T} Finalist's Medal`, desc: `Runner-up of a ${T.toLowerCase()} Cup, Gauntlet or championship match.`, category: 'medal', tier: 'common', prestige: 1 + k, arenaTier: k });
    d.push({ id: `defense-t${k}`, name: `${T} Defender's Torque`, desc: `Successfully defended an arena title in a ${T.toLowerCase()} arena.`, category: 'defense', tier: k >= 2 ? 'epic' : 'rare', prestige: 5 + 3 * k, arenaTier: k });
    d.push({ id: `laurel-t${k}`, name: `${T} Season Laurel`, desc: `Top performer of a season in a ${T.toLowerCase()} arena by tournament points.`, category: 'seasonal', tier: k >= 2 ? 'epic' : 'rare', prestige: 4 + 3 * k, arenaTier: k });
  }
  d.push({ id: 'dist-decorated', name: 'Corona Civica', desc: 'Lifetime distinction: 10 event victories.', category: 'distinction', tier: 'epic', prestige: 12 });
  d.push({ id: 'dist-laureate', name: 'Corona Aurea', desc: 'Lifetime distinction: 25 event victories.', category: 'distinction', tier: 'legendary', prestige: 25 });
  d.push({ id: 'dist-triple-crown', name: 'Triple Crown', desc: 'Lifetime distinction: signature championships in 3 different arenas.', category: 'distinction', tier: 'legendary', prestige: 25 });
  d.push({ id: 'dist-polymath', name: 'Laurel of Many Fields', desc: 'Lifetime distinction: won 5 different kinds of event.', category: 'distinction', tier: 'epic', prestige: 15 });
  d.push({ id: 'dist-iron-champion', name: 'The Iron Champion', desc: 'Lifetime distinction: 10 successful title defences.', category: 'distinction', tier: 'legendary', prestige: 25 });
  d.push({ id: 'hist-perfect', name: 'The Perfect Campaign', desc: 'Won a Swiss, round-robin, league or knockout event (5+ games) with a perfect score.', category: 'historical', tier: 'epic', prestige: 15 });
  d.push({ id: 'hist-underdog', name: 'Last Seed, First Place', desc: 'Won an event of 8+ entrants as its lowest seed.', category: 'historical', tier: 'legendary', prestige: 20 });
  d.push({ id: 'hist-upset-crown', name: 'Fall of a Giant', desc: 'Took a title from a champion rated 150+ higher.', category: 'historical', tier: 'legendary', prestige: 20 });
  d.push({ id: 'hist-dynasty', name: 'Dynasty', desc: 'Held an arena title through four consecutive championships.', category: 'historical', tier: 'legendary', prestige: 25 });
  d.push({ id: 'hist-sweep', name: 'Master of the Season', desc: 'Won three events in the same arena in one season.', category: 'historical', tier: 'legendary', prestige: 20 });
  d.push({ id: 'hist-comeback', name: 'The Return', desc: 'Regained an arena title previously lost.', category: 'historical', tier: 'epic', prestige: 15 });
  // ---- v0.3 "Golden Age": regional circuit, imperial events, records (21 new defs; old ids unchanged) ----
  d.push({ id: 'lopen-lower', name: 'Provincial Open Plate', desc: 'Won a regional Lower Division Open (arenas 0–7).', category: 'cup', tier: 'common', prestige: 3, arenaTier: 0 });
  d.push({ id: 'lopen-upper', name: 'Provincial Open Cup', desc: 'Won a regional Upper Division Open (arenas 8–15).', category: 'cup', tier: 'rare', prestige: 6, arenaTier: 1 });
  for (const r of REGIONS) {
    d.push({ id: `rcrown-${r.id}`, name: r.trophy, desc: `Signature trophy of ${r.name}: won the ${r.signature.name} or a defence of the ${r.crown}.`, category: 'regional', tier: 'epic', prestige: 18, region: r.id });
  }
  d.push({ id: 'rdefense', name: "Provincial Defender's Torque", desc: 'Successfully defended a regional crown.', category: 'defense', tier: 'rare', prestige: 8 });
  d.push({ id: 'rmedal', name: "Provincial Finalist's Medal", desc: 'Runner-up of a regional championship final or a regional title defence.', category: 'medal', tier: 'common', prestige: 2 });
  for (let k = 0; k < 4; k++) {
    const T = ARENA_TIER_NAMES[k];
    d.push({ id: `qual-t${k}`, name: `${T} Qualifier's Token`, desc: `Won an arena qualifier in a ${T.toLowerCase()} arena, earning a place in its Invitational.`, category: 'cup', tier: 'common', prestige: 2 + k, arenaTier: k });
  }
  d.push({ id: 'masters', name: 'The Imperial Masters Trophy', desc: "Won the Imperial Masters, the invitation-only round robin of the empire's top eight.", category: 'elite', tier: 'legendary', prestige: 35, arena: 20 });
  d.push({ id: 'rlaurel', name: 'Laurel of the Province', desc: "Top performer of a season in a region's circuit (local opens, regional championship, title defence) by placement points.", category: 'seasonal', tier: 'rare', prestige: 6 });
  d.push({ id: 'hist-record', name: 'Breaker of Records', desc: 'Set a new all-time record of the empire (Hall of Records).', category: 'historical', tier: 'legendary', prestige: 20 });
  d.push({ id: 'hist-regional-dynasty', name: 'Provincial Dynasty', desc: 'Held a regional crown through four consecutive title contests.', category: 'historical', tier: 'epic', prestige: 15 });
  d.push({ id: 'hist-giant-slayer', name: 'Giant Slayer', desc: 'Won a final or title match against an opponent rated 250+ higher.', category: 'historical', tier: 'epic', prestige: 15 });
  // v0.3: signature trophies of the 12 new arenas.
  for (const a of ARENAS) {
    if (a.legacyIndex !== undefined) continue;
    d.push({
      id: sigDefFor(a.index), name: a.trophy, desc: `Signature trophy of ${a.name}: won the arena championship match.`,
      category: 'signature', tier: sigTier(a.index), prestige: Math.round(10 + 1.5 * a.index), arena: a.index,
    });
  }
  return d;
}

/** Trophy definitions introduced in v0.3 (their art reuses baked sprites, see `trophyArt`). */
export const V3_TROPHY_IDS: string[] = [
  'lopen-lower', 'lopen-upper', ...REGIONS.map((r) => `rcrown-${r.id}`), 'rdefense', 'rmedal', 'qual-t0', 'qual-t1', 'qual-t2', 'qual-t3',
  'masters', 'rlaurel', 'hist-record', 'hist-regional-dynasty', 'hist-giant-slayer',
  ...ARENAS.filter((a) => a.legacyIndex === undefined).map((a) => sigDefFor(a.index)),
];

/**
 * Baked trophy sprite for a definition (public/trophies/<id>.webp). The 60
 * v0.2 definitions have their own sprite; v0.3 definitions reuse the closest
 * existing sculpt (model + metal) until dedicated art is baked. The UI should
 * load `trophies/${trophyArt(defId)}.webp`.
 */
/** Every trophy def has its own baked art since v0.4; kept as an override hook. */
export const TROPHY_ART: Record<string, string> = {};
export function trophyArt(defId: string): string {
  return TROPHY_ART[defId] ?? defId;
}

export const TROPHY_DEFS: TrophyDef[] = buildDefs();
export const TROPHY_BY_ID: Record<string, TrophyDef> = Object.fromEntries(TROPHY_DEFS.map((t) => [t.id, t]));

/** Categories that count as an event *victory* (one per completed event with a winner). */
export const WINNER_CATEGORIES: TrophyCategory[] = ['signature', 'cup', 'regional', 'elite'];
export function isVictory(a: AwardRecord): boolean {
  const def = TROPHY_BY_ID[a.defId];
  return !!def && WINNER_CATEGORIES.includes(def.category);
}

export function winnerDefFor(kind: TournamentKind, arena: number, t?: { region?: string; band?: [number, number] }): string {
  const k = arenaTier(arena);
  switch (kind) {
    case 'local-open': return (t?.band?.[0] ?? 0) >= 8 ? 'lopen-upper' : 'lopen-lower';
    case 'regional':
    case 'regional-defense': return `rcrown-${t?.region ?? 'latium'}`;
    case 'qualifier': return `qual-t${k}`;
    case 'elite': return 'masters';
    case 'championship': return sigDefFor(arena);
    case 'league': return `league-t${k}`;
    case 'invitational': return `invit-t${k}`;
    case 'hosted': return `hosted-t${k}`;
    case 'cup': return `cup-cup-t${k}`;
    case 'gauntlet': return `cup-gauntlet-t${k}`;
    default: return `cup-open-t${k}`;
  }
}

// ---------------------------------------------------------------- index (derived, not persisted)

type Index = {
  arr: AwardRecord[];
  len: number;
  ids: Set<string>;
  byHolder: Map<string, AwardRecord[]>;
  byDef: Map<string, AwardRecord[]>;
  byArena: Map<number, AwardRecord[]>;
  bySeriesCurrent: Map<string, AwardRecord[]>;
  prestige: Map<string, number>;
};
const INDEX = new WeakMap<AwardRecord[], Index>();

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const l = m.get(k);
  if (l) l.push(v);
  else m.set(k, [v]);
}

function indexAdd(ix: Index, a: AwardRecord) {
  ix.ids.add(a.awardId);
  push(ix.byHolder, a.holder, a);
  push(ix.byDef, a.defId, a);
  push(ix.byArena, a.arena, a);
  if (a.series && a.current) push(ix.bySeriesCurrent, a.series, a);
  ix.prestige.set(a.holder, (ix.prestige.get(a.holder) ?? 0) + (TROPHY_BY_ID[a.defId]?.prestige ?? 0));
}

function index(w: WorldState): Index {
  const arr = (w.awards ??= []);
  let ix = INDEX.get(arr);
  if (!ix) {
    ix = { arr, len: 0, ids: new Set(), byHolder: new Map(), byDef: new Map(), byArena: new Map(), bySeriesCurrent: new Map(), prestige: new Map() };
    INDEX.set(arr, ix);
  }
  if (ix.len !== arr.length) {
    if (arr.length < ix.len) {
      INDEX.delete(arr);
      return index(w);
    }
    for (let i = ix.len; i < arr.length; i++) indexAdd(ix, arr[i]);
    ix.len = arr.length;
  }
  return ix;
}

/** Drop the derived index (call after replacing or editing `w.awards` by hand). */
export function invalidateAwardIndex(w: WorldState) {
  if (w.awards) INDEX.delete(w.awards);
}

// ---------------------------------------------------------------- migration

export function emptyHall(): HallOfRecords {
  return { legends: [], rivalries: [], best: {} };
}

/**
 * v0.2 world migration. Idempotent: initialises the trophy registry, Hall of
 * Records and season tallies when missing. On first run it backfills awards
 * from the persisted tournament history (real results; marked `backfilled`,
 * no match scores) so existing worlds keep their past champions.
 */
export function ensureWorldV2(w: WorldState): WorldState {
  if ((w.worldVersion ?? 0) >= WORLD_VERSION && w.awards && w.hall && w.seasonTally) return w;
  w.hall ??= emptyHall();
  w.hall.legends ??= [];
  w.hall.rivalries ??= [];
  w.hall.best ??= {};
  w.seasonTally ??= {};
  if (!w.awards) {
    w.awards = [];
    const hist = [...w.history].sort((a, b) => a.endDay - b.endDay);
    // Worlds older than v0.3 still use the 12-arena numbering here (remapped later by migrateWorldArenas).
    const a24 = (a: number) => (w.arenaLayout === 24 ? a : migrateArenaIndex(a));
    for (const h of hist) {
      if (!h.winner) continue;
      const base = { tournamentId: h.id, season: h.season, day: h.endDay, arena: h.arena, format: h.format, result: '', gameIds: [] as string[], backfilled: true };
      const wdef = winnerDefFor(h.kind, a24(h.arena));
      appendAward(w, {
        ...base, awardId: `${h.id}:${wdef}:${h.winner}`, defId: wdef,
        holder: h.winner, holderName: h.winnerName, finalOpponent: h.runnerUp, finalOpponentName: h.runnerUpName, current: true,
        series: h.kind === 'championship' ? `title-${h.arena}` : `${h.kind}-${h.arena}`,
      }, h.kind === 'championship' ? 'title' : 'edition');
      if (h.kind === 'championship' && a24(h.arena) === TOP_ARENA) {
        appendAward(w, {
          ...base, awardId: `${h.id}:imperial-crown:${h.winner}`, defId: 'imperial-crown', holder: h.winner, holderName: h.winnerName,
          finalOpponent: h.runnerUp, finalOpponentName: h.runnerUpName, current: true, series: `title-${h.arena}`,
        }, 'title');
      }
      if (h.runnerUp && hasFinal(h.kind)) {
        const md = `medal-t${arenaTier(a24(h.arena))}`;
        appendAward(w, {
          ...base, awardId: `${h.id}:${md}:${h.runnerUp}`, defId: md, holder: h.runnerUp, holderName: h.runnerUpName,
          finalOpponent: h.winner, finalOpponentName: h.winnerName, current: true, series: `medal-${h.kind}-${h.arena}`,
        }, 'edition');
      }
    }
    // Title series reflect the titles as they stand now.
    for (const a of w.awards) {
      if (a.series?.startsWith('title-')) a.current = w.titles.find((t) => `title-${t.arena}` === a.series)?.holder === a.holder && a.current;
    }
    invalidateAwardIndex(w);
    for (const t of w.tournaments) if (t.status === 'complete') t.awarded = true;
  }
  w.worldVersion = Math.max(w.worldVersion ?? 0, WORLD_VERSION);
  return w;
}

// ---------------------------------------------------------------- appending

/** Append an award if its id is new. Returns the record if added. */
export function appendAward(w: WorldState, a: AwardRecord, mode: 'edition' | 'title' | 'none' = 'none'): AwardRecord | null {
  const ix = index(w);
  if (ix.ids.has(a.awardId)) return null;
  if (a.series && mode !== 'none') {
    const cur = ix.bySeriesCurrent.get(a.series) ?? [];
    const keep: AwardRecord[] = [];
    for (const x of cur) {
      if (mode === 'edition' || x.holder !== a.holder) x.current = false;
      else keep.push(x);
    }
    ix.bySeriesCurrent.set(a.series, keep);
  }
  w.awards!.push(a);
  index(w);
  return a;
}

/** A title changed hands (or was vacated): every current award of its series held by others becomes historical. */
export function titleSeriesChanged(w: WorldState, arena: number, newHolder: string | null) {
  seriesChanged(w, `title-${arena}`, newHolder);
}
/** A title series (arena "title-N" or regional "crown-<region>") changed hands. */
export function seriesChanged(w: WorldState, series: string, newHolder: string | null) {
  const ix = index(w);
  const cur = ix.bySeriesCurrent.get(series) ?? [];
  const keep: AwardRecord[] = [];
  for (const x of cur) {
    if (x.holder !== newHolder) x.current = false;
    else keep.push(x);
  }
  ix.bySeriesCurrent.set(series, keep);
}

const half = (x: number) => {
  const i = Math.floor(x);
  const h = x - i >= 0.5;
  return i === 0 && h ? '½' : `${i}${h ? '½' : ''}`;
};

function between(p: Pairing, a: string, b: string) {
  return (p.white === a && p.black === b) || (p.white === b && p.black === a);
}
function scoreFor(p: Pairing, id: string): number {
  const [ws, bs] = gameScores(p);
  return p.white === id ? ws : bs;
}

/** Human-readable result of the event from the winner's perspective. */
export function eventResult(st: TournamentState, winner: string, runnerUp: string | null): string {
  if (st.format === 'match-series' || st.format === 'single-elim' || st.format === 'double-elim') {
    if (!runnerUp) return '';
    const all = st.rounds.flat().filter((p) => p.result !== null && p.black !== null && !p.forfeit && between(p, winner, runnerUp));
    let games = all;
    if (st.format === 'double-elim') games = all.filter((p) => p.bracket === 'GF' || p.bracket === 'GF2');
    else if (st.format === 'single-elim') {
      const last = Math.max(-1, ...all.map((p) => p.round));
      games = all.filter((p) => p.round === last);
    }
    if (!games.length) games = all;
    const main = games.filter((p) => !p.tiebreakOf);
    const ws = main.reduce((s, p) => s + scoreFor(p, winner), 0);
    const ls = main.reduce((s, p) => s + scoreFor(p, runnerUp), 0);
    const tb = games.length > main.length ? ' (tiebreak)' : '';
    return main.length ? `${half(ws)}–${half(ls)}${tb}` : 'walkover';
  }
  const row = standings(st).find((r) => r.id === winner);
  if (!row) return '';
  return `${half(row.points)}/${row.wins + row.draws + row.losses + row.byes}`;
}

export type AwardContext = {
  nameOf: (id: string | null) => string;
  /** Championship only: the title holder before this match was decided. */
  prevHolder?: string | null;
  /** Championship only: the title's defence count before this match. */
  prevDefenses?: number;
  onAward?: (a: AwardRecord) => void;
};

/** Finalist medals are presented where there is a real final: Cups, Gauntlets and championship matches. */
export function hasFinal(kind: string, format?: Format | string): boolean {
  if (kind === 'regional') return format === 'single-elim' || format === 'double-elim';
  return kind === 'cup' || kind === 'gauntlet' || kind === 'championship' || kind === 'regional-defense';
}
/** Medal definition for the runner-up of an event with a real final. */
export function medalDefFor(kind: string, arena: number): string {
  return kind === 'regional' || kind === 'regional-defense' ? 'rmedal' : `medal-t${arenaTier(arena)}`;
}
/** Regional circuit events (as opposed to the arena circuit / imperial events). */
export function isRegionalKind(kind: string): boolean {
  return kind === 'local-open' || kind === 'regional' || kind === 'regional-defense';
}

/** Placement points for the Season Laurel tally. */
export const PLACE_POINTS = [10, 6, 4, 4, 2, 2, 2, 2];
export const KIND_WEIGHT: Record<string, number> = {
  championship: 1.5, league: 1.25, invitational: 1.25, cup: 1, gauntlet: 1, open: 1, hosted: 0.5,
  // v0.3: qualifiers / Masters count toward the arena Season Laurel; regional events toward the Provincial Laurel.
  qualifier: 0.5, elite: 1.5, 'local-open': 1, regional: 1.5, 'regional-defense': 1.5,
};
export function placementPoints(kind: string, place: number): number {
  return Math.round((PLACE_POINTS[place - 1] ?? 1) * (KIND_WEIGHT[kind] ?? 1));
}

/**
 * Present all trophies for a completed tournament. Idempotent (guarded by
 * `t.awarded` and by deterministic award ids). Must be called BEFORE the
 * title state is mutated, with prevHolder/prevDefenses for championships.
 */
export function processTournamentAwards(w: WorldState, t: WorldTournament, ctx: AwardContext): AwardRecord[] {
  ensureWorldV2(w);
  const st = t.state;
  if (t.awarded || !st || !st.complete) return [];
  t.awarded = true;
  const out: AwardRecord[] = [];
  const rows = standings(st);
  const winner = st.winner ?? rows[0]?.id ?? null;
  const runnerUp = st.runnerUp ?? rows[1]?.id ?? null;
  const regional = isRegionalKind(t.kind);
  const region = t.region ?? IMPERIAL;

  // Season tally (real placements of real events): arena Season Laurel, or the Provincial Laurel for regional events.
  const key = `${t.season}:${regional ? region : t.arena}`;
  const tally = regional ? ((w.regionTally ??= {})[key] ??= {}) : (w.seasonTally![key] ??= {});
  rows.forEach((r, i) => {
    const place = r.id === winner ? 1 : r.id === runnerUp ? 2 : Math.max(3, r.place || i + 1);
    tally[r.id] = (tally[r.id] ?? 0) + placementPoints(t.kind, place);
  });

  if (!winner) return out;
  const pairs = new Map(st.rounds.flat().map((p) => [p.id, p]));
  const gameIdsFor = (id: string) => Object.entries(t.gameIds).filter(([pid]) => {
    const p = pairs.get(pid);
    return p && (p.white === id || p.black === id);
  }).map(([, g]) => g);
  const wRow = rows.find((r) => r.id === winner);
  const isTitle = t.kind === 'championship' || t.kind === 'regional' || t.kind === 'regional-defense';
  const base = (holder: string, defId: string, opp: string | null): AwardRecord => ({
    awardId: `${t.id}:${defId}:${holder}`, defId, holder, holderName: ctx.nameOf(holder), tournamentId: t.id, season: t.season, day: w.day,
    arena: t.arena, format: t.format, finalOpponent: opp, finalOpponentName: opp ? ctx.nameOf(opp) : undefined,
    result: '', gameIds: gameIdsFor(holder), current: false, region,
    ...(isTitle || hasFinal(t.kind, t.format) ? { holderRating: st.ratings[holder], opponentRating: opp ? st.ratings[opp] : undefined } : {}),
  });
  const add = (a: AwardRecord, mode: 'edition' | 'title' | 'none') => {
    const r = appendAward(w, a, mode);
    if (r) {
      out.push(r);
      ctx.onAward?.(r);
    }
    return r;
  };
  const result = eventResult(st, winner, runnerUp);
  const unbeaten = !!wRow && wRow.losses === 0;
  const perfect = !!wRow && st.format !== 'match-series' && wRow.losses === 0 && wRow.draws === 0 && wRow.wins >= 5;
  const flags = { ...(unbeaten ? { unbeaten: true } : {}), ...(perfect ? { perfect: true } : {}) };

  const wd = t.trophy ?? winnerDefFor(t.kind, t.arena, t);
  const isChamp = t.kind === 'championship';
  const isCrown = t.kind === 'regional' || t.kind === 'regional-defense';
  const series = isChamp ? `title-${t.arena}` : isCrown ? `crown-${region}` : (t.series ?? `${t.kind}-${t.arena}`);
  const defense = isTitle && !!ctx.prevHolder && ctx.prevHolder === winner;
  add({ ...base(winner, wd, runnerUp), result, current: true, series, ...flags, ...(defense ? { defenseNumber: (ctx.prevDefenses ?? 0) + 1 } : {}) }, isTitle ? 'title' : 'edition');
  if (isChamp && t.arena === TOP_ARENA) add({ ...base(winner, 'imperial-crown', runnerUp), result, current: true, series, ...flags }, 'title');
  if (defense) {
    const n = (ctx.prevDefenses ?? 0) + 1;
    add({ ...base(winner, isCrown ? 'rdefense' : `defense-t${arenaTier(t.arena)}`, runnerUp), result, current: true, series, defenseNumber: n }, 'title');
    if (n === 3) add({ ...base(winner, isCrown ? 'hist-regional-dynasty' : 'hist-dynasty', runnerUp), result, defenseNumber: n }, 'none');
  }
  if (runnerUp && hasFinal(t.kind, t.format)) {
    add({ ...base(runnerUp, medalDefFor(t.kind, t.arena), winner), result: eventResult(st, runnerUp, winner), current: true, series: `medal-${isCrown ? region : t.kind}-${isCrown ? 'crown' : t.arena}` }, 'edition');
  }
  // Historical feats.
  if (perfect) add({ ...base(winner, 'hist-perfect', runnerUp), result, perfect: true }, 'none');
  if (!isTitle && st.entrants.length >= 8 && st.entrants[st.entrants.length - 1] === winner) add({ ...base(winner, 'hist-underdog', runnerUp), result }, 'none');
  let upsetCrown = false;
  if (isChamp && ctx.prevHolder && ctx.prevHolder !== winner && runnerUp === ctx.prevHolder) {
    if ((st.ratings[runnerUp] ?? 0) - (st.ratings[winner] ?? 0) >= 150) upsetCrown = !!add({ ...base(winner, 'hist-upset-crown', runnerUp), result }, 'none');
  }
  if (!upsetCrown && runnerUp && (hasFinal(t.kind, t.format) || isTitle && st.format === 'match-series') && (st.ratings[runnerUp] ?? 0) - (st.ratings[winner] ?? 0) >= 250) {
    add({ ...base(winner, 'hist-giant-slayer', runnerUp), result }, 'none');
  }
  if (isChamp && ctx.prevHolder !== winner && w.reigns.some((r) => r.titleId === t.titleId && r.holder === winner && r.to !== null)) {
    add({ ...base(winner, 'hist-comeback', runnerUp), result }, 'none');
  }
  const ix = index(w);
  const mine = ix.byHolder.get(winner) ?? [];
  const victories = mine.filter(isVictory);
  if (!regional && t.kind !== 'elite' && victories.filter((a) => a.season === t.season && a.arena === t.arena && (a.region ?? IMPERIAL) === IMPERIAL && a.defId !== 'masters').length === 3) {
    add({ ...base(winner, 'hist-sweep', runnerUp), result }, 'none');
  }
  // Lifetime distinctions (once per holder).
  const life = (defId: string, cond: boolean) => {
    if (!cond) return;
    add({ ...base(winner, defId, null), awardId: `life:${defId}:${winner}`, finalOpponent: null, finalOpponentName: undefined, opponentRating: undefined, holderRating: undefined, result: '' }, 'none');
  };
  life('dist-decorated', victories.length >= 10);
  life('dist-laureate', victories.length >= 25);
  life('dist-triple-crown', new Set(mine.filter((a) => a.defId.startsWith('sig-')).map((a) => a.arena)).size >= 3);
  life('dist-polymath', new Set(victories.map(victoryKind)).size >= 5);
  life('dist-iron-champion', mine.filter((a) => a.defId.startsWith('defense-')).length >= 10);
  return out;
}

/** Kind of event victory, for the "Laurel of Many Fields" distinction. */
export function victoryKind(a: AwardRecord): string {
  return a.defId.replace(/-t\d$/, '').replace(/^sig-\d+$/, 'sig').replace(/^rcrown-.*$/, 'rcrown').replace(/^lopen-.*$/, 'lopen');
}

/**
 * Present Season Laurels for every season/arena tally whose tournaments are
 * all complete (or, at the latest, two seasons after). Deterministic:
 * highest points, then more event wins that season, then lower id.
 */
export function presentSeasonLaurels(w: WorldState, nameOf: (id: string) => string, onAward?: (a: AwardRecord) => void): AwardRecord[] {
  ensureWorldV2(w);
  const out: AwardRecord[] = [];
  const tallies = w.seasonTally!;
  for (const key of Object.keys(tallies)) {
    const [season, arena] = key.split(':').map(Number);
    const pending = w.tournaments.some((t) => t.season === season && t.arena === arena && t.status !== 'complete' && !isRegionalKind(t.kind));
    if (season >= w.season) continue; // the season is still being played
    if (pending && w.season < season + 2) continue; // late events (e.g. waiting on the player) get one extra season
    const tally = tallies[key];
    delete tallies[key];
    const ix = index(w);
    const wins = (id: string) => (ix.byHolder.get(id) ?? []).filter((a) => isVictory(a) && a.season === season && a.arena === arena).length;
    const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1] || wins(b[0]) - wins(a[0]) || (a[0] < b[0] ? -1 : 1));
    if (!ranked.length) continue;
    const [holder, pts] = ranked[0];
    const second = ranked[1];
    const defId = `laurel-t${arenaTier(arena)}`;
    const tid = `S${season}-A${arena}`;
    const a = appendAward(w, {
      awardId: `${tid}:${defId}:${holder}`, defId, holder, holderName: nameOf(holder), tournamentId: tid, season, day: w.day, arena,
      format: 'season', finalOpponent: second?.[0] ?? null, finalOpponentName: second ? nameOf(second[0]) : undefined,
      result: `${pts} pts`, gameIds: [], current: true, series: `laurel-${arena}`, region: IMPERIAL,
    }, 'edition');
    if (a) {
      out.push(a);
      onAward?.(a);
    }
  }
  return out;
}

/**
 * Provincial Laurels (v0.3): the top performer of each region's circuit in a
 * season (local opens, regional championship / title defence), once all of
 * that season's regional events in the region are complete (at the latest two
 * seasons later). Same tie-break rules as the Season Laurel.
 */
export function presentRegionLaurels(w: WorldState, nameOf: (id: string) => string, onAward?: (a: AwardRecord) => void, arenaOf: (id: string) => number = () => 5): AwardRecord[] {
  const out: AwardRecord[] = [];
  const tallies = (w.regionTally ??= {});
  for (const key of Object.keys(tallies)) {
    const [ss, region] = key.split(':');
    const season = Number(ss);
    if (season >= w.season) continue;
    const pending = w.tournaments.some((t) => t.season === season && t.region === region && t.status !== 'complete' && isRegionalKind(t.kind));
    if (pending && w.season < season + 2) continue;
    const tally = tallies[key];
    delete tallies[key];
    const ix = index(w);
    const wins = (id: string) => (ix.byHolder.get(id) ?? []).filter((a) => isVictory(a) && a.season === season && a.region === region).length;
    const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1] || wins(b[0]) - wins(a[0]) || (a[0] < b[0] ? -1 : 1));
    if (!ranked.length) continue;
    const [holder, pts] = ranked[0];
    const second = ranked[1];
    const tid = `S${season}-R${region}`;
    const a = appendAward(w, {
      awardId: `${tid}:rlaurel:${holder}`, defId: 'rlaurel', holder, holderName: nameOf(holder), tournamentId: tid, season, day: w.day, arena: Math.max(0, Math.min(TOP_ARENA, arenaOf(holder))),
      format: 'season', finalOpponent: second?.[0] ?? null, finalOpponentName: second ? nameOf(second[0]) : undefined,
      result: `${pts} pts`, gameIds: [], current: true, series: `rlaurel-${region}`, region,
    }, 'edition');
    if (a) {
      out.push(a);
      onAward?.(a);
    }
  }
  return out;
}

/** Awards of a regional circuit, oldest first. */
export function awardsByRegion(w: WorldState, region: string): AwardRecord[] {
  return allAwards(w).filter((a) => (a.region ?? IMPERIAL) === region);
}

// ---------------------------------------------------------------- selectors

export function allAwards(w: WorldState): AwardRecord[] {
  return w.awards ?? [];
}

/** All awards of a holder (competitor id or 'player'), oldest first. */
export function awardsFor(w: WorldState, holder: string): AwardRecord[] {
  if (!w.awards) return [];
  return index(w).byHolder.get(holder) ?? [];
}

/** Awards presented in an arena, oldest first. */
export function awardsByArena(w: WorldState, arena: number): AwardRecord[] {
  if (!w.awards) return [];
  return index(w).byArena.get(arena) ?? [];
}

/** Every instance of one trophy definition, oldest first. */
export function awardsByDef(w: WorldState, defId: string): AwardRecord[] {
  if (!w.awards) return [];
  return index(w).byDef.get(defId) ?? [];
}

/** Current holder(s) of a series, e.g. "title-11" or "open-4". */
export function currentOfSeries(w: WorldState, series: string): AwardRecord[] {
  if (!w.awards) return [];
  return (index(w).bySeriesCurrent.get(series) ?? []).filter((a) => a.current);
}

/** Sum of trophy prestige points of a holder. */
export function trophyPrestige(w: WorldState, holder: string): number {
  if (!w.awards) return 0;
  return index(w).prestige.get(holder) ?? 0;
}

export type Rarity = { def: TrophyDef; tier: TrophyTier; count: number; holders: number; share: number; label: string };

/**
 * Rarity = the explicit tier of the definition plus how often it has really
 * been presented. A def awarded to < 0.5% of all awarded holders reads as
 * "Unique"/"Very rare" regardless of tier.
 */
export function rarityOf(w: WorldState, defId: string): Rarity | null {
  const def = TROPHY_BY_ID[defId];
  if (!def) return null;
  const list = awardsByDef(w, defId);
  const ix = w.awards ? index(w) : null;
  const holders = new Set(list.map((a) => a.holder)).size;
  const total = ix ? ix.byHolder.size : 0;
  const share = total ? holders / total : 0;
  const label = list.length === 0 ? 'Never awarded' : holders === 1 ? 'Unique' : share < 0.005 ? 'Very rare' : share < 0.03 ? 'Rare' : 'Established';
  return { def, tier: def.tier, count: list.length, holders, share, label };
}

export type TrophyCabinetEntry = { def: TrophyDef; count: number; current: number; latest: AwardRecord };
/** Grouped trophy cabinet for a profile (real awards only). */
export function trophyCabinet(w: WorldState, holder: string): TrophyCabinetEntry[] {
  const groups = new Map<string, TrophyCabinetEntry>();
  for (const a of awardsFor(w, holder)) {
    const def = TROPHY_BY_ID[a.defId];
    if (!def) continue;
    const g = groups.get(a.defId);
    if (g) {
      g.count++;
      if (a.current) g.current++;
      g.latest = a;
    } else groups.set(a.defId, { def, count: 1, current: a.current ? 1 : 0, latest: a });
  }
  const order: TrophyCategory[] = ['crown', 'signature', 'historical', 'distinction', 'defense', 'elite', 'regional', 'seasonal', 'cup', 'medal'];
  return [...groups.values()].sort((a, b) => order.indexOf(a.def.category) - order.indexOf(b.def.category) || b.def.prestige - a.def.prestige);
}
