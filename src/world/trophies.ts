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
import { ARENAS } from './arenas';
import { standings, gameScores, type TournamentState, type Pairing } from '../tournament/formats';
import type { AwardRecord, TrophyCategory, TrophyTier, HallOfRecords } from './types';
import type { WorldState, WorldTournament, TournamentKind } from '../game/state';

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
};

export const ARENA_TIER_NAMES = ['Provincial', 'Legionary', 'Senatorial', 'Imperial'];
export function arenaTier(arena: number): number {
  return Math.max(0, Math.min(3, Math.floor(arena / 3)));
}
const TIER_RARITY: TrophyTier[] = ['common', 'common', 'rare', 'epic'];

function buildDefs(): TrophyDef[] {
  const d: TrophyDef[] = [];
  for (const a of ARENAS) {
    d.push({
      id: `sig-${a.index}`, name: a.trophy, desc: `Signature trophy of ${a.name}: won the arena championship match.`,
      category: 'signature', tier: a.index >= 9 ? 'legendary' : a.index >= 6 ? 'epic' : 'rare', prestige: 10 + 3 * a.index, arena: a.index,
    });
  }
  d.push({ id: 'imperial-crown', name: 'The Imperial Crown', desc: 'Won the championship of the Eternal Throne.', category: 'crown', tier: 'legendary', prestige: 40, arena: 11 });
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
  return d;
}

export const TROPHY_DEFS: TrophyDef[] = buildDefs();
export const TROPHY_BY_ID: Record<string, TrophyDef> = Object.fromEntries(TROPHY_DEFS.map((t) => [t.id, t]));

/** Categories that count as an event *victory* (one per completed event with a winner). */
export const WINNER_CATEGORIES: TrophyCategory[] = ['signature', 'cup', 'regional', 'elite'];
export function isVictory(a: AwardRecord): boolean {
  const def = TROPHY_BY_ID[a.defId];
  return !!def && WINNER_CATEGORIES.includes(def.category);
}

export function winnerDefFor(kind: TournamentKind, arena: number): string {
  const k = arenaTier(arena);
  switch (kind) {
    case 'championship': return `sig-${arena}`;
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
  if (w.worldVersion === WORLD_VERSION && w.awards && w.hall && w.seasonTally) return w;
  w.hall ??= emptyHall();
  w.hall.legends ??= [];
  w.hall.rivalries ??= [];
  w.hall.best ??= {};
  w.seasonTally ??= {};
  if (!w.awards) {
    w.awards = [];
    const hist = [...w.history].sort((a, b) => a.endDay - b.endDay);
    for (const h of hist) {
      if (!h.winner) continue;
      const base = { tournamentId: h.id, season: h.season, day: h.endDay, arena: h.arena, format: h.format, result: '', gameIds: [] as string[], backfilled: true };
      appendAward(w, {
        ...base, awardId: `${h.id}:${winnerDefFor(h.kind, h.arena)}:${h.winner}`, defId: winnerDefFor(h.kind, h.arena),
        holder: h.winner, holderName: h.winnerName, finalOpponent: h.runnerUp, finalOpponentName: h.runnerUpName, current: true,
        series: h.kind === 'championship' ? `title-${h.arena}` : `${h.kind}-${h.arena}`,
      }, h.kind === 'championship' ? 'title' : 'edition');
      if (h.kind === 'championship' && h.arena === 11) {
        appendAward(w, {
          ...base, awardId: `${h.id}:imperial-crown:${h.winner}`, defId: 'imperial-crown', holder: h.winner, holderName: h.winnerName,
          finalOpponent: h.runnerUp, finalOpponentName: h.runnerUpName, current: true, series: 'title-11',
        }, 'title');
      }
      if (h.runnerUp && hasFinal(h.kind)) {
        const md = `medal-t${arenaTier(h.arena)}`;
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
  w.worldVersion = WORLD_VERSION;
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
  const ix = index(w);
  const series = `title-${arena}`;
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
export function hasFinal(kind: string): boolean {
  return kind === 'cup' || kind === 'gauntlet' || kind === 'championship';
}

/** Placement points for the Season Laurel tally. */
export const PLACE_POINTS = [10, 6, 4, 4, 2, 2, 2, 2];
export const KIND_WEIGHT: Record<string, number> = { championship: 1.5, league: 1.25, invitational: 1.25, cup: 1, gauntlet: 1, open: 1, hosted: 0.5 };
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

  // Season Laurel tally (real placements of real events).
  const key = `${t.season}:${t.arena}`;
  const tally = (w.seasonTally![key] ??= {});
  rows.forEach((r, i) => {
    const place = r.id === winner ? 1 : r.id === runnerUp ? 2 : Math.max(3, r.place || i + 1);
    tally[r.id] = (tally[r.id] ?? 0) + placementPoints(t.kind, place);
  });

  if (!winner) return out;
  const gameIdsFor = (id: string) => {
    const ps = new Map(st.rounds.flat().map((p) => [p.id, p]));
    return Object.entries(t.gameIds).filter(([pid]) => {
      const p = ps.get(pid);
      return p && (p.white === id || p.black === id);
    }).map(([, g]) => g);
  };
  const wRow = rows.find((r) => r.id === winner);
  const base = (holder: string, defId: string, opp: string | null): AwardRecord => ({
    awardId: `${t.id}:${defId}:${holder}`, defId, holder, holderName: ctx.nameOf(holder), tournamentId: t.id, season: t.season, day: w.day,
    arena: t.arena, format: t.format, finalOpponent: opp, finalOpponentName: opp ? ctx.nameOf(opp) : undefined,
    result: '', gameIds: gameIdsFor(holder), current: false,
    ...(t.kind === 'championship' ? { holderRating: st.ratings[holder], opponentRating: opp ? st.ratings[opp] : undefined } : {}),
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

  const wd = winnerDefFor(t.kind, t.arena);
  const isChamp = t.kind === 'championship';
  const series = isChamp ? `title-${t.arena}` : `${t.kind}-${t.arena}`;
  const defense = isChamp && ctx.prevHolder === winner;
  add({ ...base(winner, wd, runnerUp), result, current: true, series, ...flags, ...(defense ? { defenseNumber: (ctx.prevDefenses ?? 0) + 1 } : {}) }, isChamp ? 'title' : 'edition');
  if (isChamp && t.arena === 11) add({ ...base(winner, 'imperial-crown', runnerUp), result, current: true, series, ...flags }, 'title');
  if (defense) {
    const n = (ctx.prevDefenses ?? 0) + 1;
    add({ ...base(winner, `defense-t${arenaTier(t.arena)}`, runnerUp), result, current: true, series, defenseNumber: n }, 'title');
    if (n === 3) add({ ...base(winner, 'hist-dynasty', runnerUp), result, defenseNumber: n }, 'none');
  }
  if (runnerUp && hasFinal(t.kind)) {
    add({ ...base(runnerUp, `medal-t${arenaTier(t.arena)}`, winner), result: eventResult(st, runnerUp, winner), current: true, series: `medal-${t.kind}-${t.arena}` }, 'edition');
  }
  // Historical feats.
  if (perfect) add({ ...base(winner, 'hist-perfect', runnerUp), result, perfect: true }, 'none');
  if (!isChamp && st.entrants.length >= 8 && st.entrants[st.entrants.length - 1] === winner) add({ ...base(winner, 'hist-underdog', runnerUp), result }, 'none');
  if (isChamp && ctx.prevHolder && ctx.prevHolder !== winner && runnerUp === ctx.prevHolder) {
    if ((st.ratings[runnerUp] ?? 0) - (st.ratings[winner] ?? 0) >= 150) add({ ...base(winner, 'hist-upset-crown', runnerUp), result }, 'none');
  }
  if (isChamp && ctx.prevHolder !== winner && w.reigns.some((r) => r.titleId === t.titleId && r.holder === winner && r.to !== null)) {
    add({ ...base(winner, 'hist-comeback', runnerUp), result }, 'none');
  }
  const ix = index(w);
  const mine = ix.byHolder.get(winner) ?? [];
  const victories = mine.filter(isVictory);
  if (victories.filter((a) => a.season === t.season && a.arena === t.arena).length === 3) add({ ...base(winner, 'hist-sweep', runnerUp), result }, 'none');
  // Lifetime distinctions (once per holder).
  const life = (defId: string, cond: boolean) => {
    if (!cond) return;
    add({ ...base(winner, defId, null), awardId: `life:${defId}:${winner}`, finalOpponent: null, finalOpponentName: undefined, opponentRating: undefined, result: '' }, 'none');
  };
  life('dist-decorated', victories.length >= 10);
  life('dist-laureate', victories.length >= 25);
  life('dist-triple-crown', new Set(mine.filter((a) => a.defId.startsWith('sig-')).map((a) => a.arena)).size >= 3);
  life('dist-polymath', new Set(victories.map((a) => a.defId.replace(/-t\d$/, '').replace(/^sig-\d+$/, 'sig'))).size >= 5);
  life('dist-iron-champion', mine.filter((a) => a.defId.startsWith('defense-')).length >= 10);
  return out;
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
    const pending = w.tournaments.some((t) => t.season === season && t.arena === arena && t.status !== 'complete');
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
      result: `${pts} pts`, gameIds: [], current: true, series: `laurel-${arena}`,
    }, 'edition');
    if (a) {
      out.push(a);
      onAward?.(a);
    }
  }
  return out;
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
