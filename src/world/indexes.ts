/**
 * Derived, non-persisted indexes over the competitor population (v0.3).
 *
 * At 25,000–50,000 competitors, `competitors.filter(...)` / `.find(...)` per
 * tournament per day is the dominant cost (v0.2 rebuilt an id map for every
 * running tournament on every day). These indexes are rebuilt lazily:
 *  - `byId`: incremental (debutants are appended; pruning replaces the array,
 *    which triggers a rebuild).
 *  - pools (active by arena / region, established by arena, by rating): built
 *    on first use and invalidated at the start of every `advanceDay` and on
 *    any population change, so a pool always reflects the state at the moment
 *    of its first use in a day — the same moment with or without a reload,
 *    which keeps the simulation deterministic.
 *  - names: every live competitor's name plus archived legends (uniqueness of
 *    debutant names); invalidated by pruning.
 * Nothing here is saved; the WeakMap is keyed by the world object.
 */
import { RANKS, ARENA_COUNT } from './arenas';
import { PROVISIONAL_GAMES } from '../rating/elo';
import type { Competitor, HallOfRecords } from './types';
import { REGION_IDS, regionForOrigin, serialOf, type RegionId } from './regions';

type Ctx = { competitors: Competitor[]; day: number; hall?: HallOfRecords };

type Pools = {
  day: number;
  /** Active competitors per arena (array order). */
  active: Competitor[][];
  /** Active, non-provisional competitors per arena (array order) — the tournament pool. */
  established: Competitor[][];
  /** Active competitors per region (array order). */
  region: Map<RegionId, Competitor[]>;
  /** Active competitors sorted by rating, descending (lazy). */
  byRating: Competitor[] | null;
  /** Active established competitors per region per arena (lazy). */
  regionArena: Map<RegionId, Competitor[][]> | null;
};

type Idx = {
  arr: Competitor[];
  len: number;
  byId: Map<string, Competitor>;
  pools: Pools | null;
  names: Set<string> | null;
};

const IDX = new WeakMap<object, Idx>();
export const indexStats = { byIdBuilds: 0, poolBuilds: 0, nameBuilds: 0 };

function idx(ctx: Ctx): Idx {
  let ix = IDX.get(ctx);
  const arr = ctx.competitors;
  if (!ix || ix.arr !== arr || arr.length < ix.len) {
    ix = { arr, len: 0, byId: new Map(), pools: null, names: ix && ix.arr === arr ? ix.names : null };
    IDX.set(ctx, ix);
    indexStats.byIdBuilds++;
  }
  if (ix.len !== arr.length) {
    for (let i = ix.len; i < arr.length; i++) ix.byId.set(arr[i].id, arr[i]);
    ix.len = arr.length;
    ix.pools = null;
  }
  return ix;
}

/** Region of a competitor (stored from v0.3; derived from origin for older records). */
export function regionOf(c: Pick<Competitor, 'region' | 'origin' | 'id'>): RegionId {
  return c.region ?? regionForOrigin(c.origin, serialOf(c.id));
}

/** id → competitor (live and retired-but-not-pruned). O(1). */
export function competitorMap(ctx: Ctx): Map<string, Competitor> {
  return idx(ctx).byId;
}
export function getCompetitor(ctx: Ctx, id: string | null | undefined): Competitor | undefined {
  return id ? idx(ctx).byId.get(id) : undefined;
}

/** Forget the derived pools (call when ranks/retirements changed outside the daily cycle). */
export function invalidatePools(ctx: Ctx) {
  const ix = IDX.get(ctx);
  if (ix) ix.pools = null;
}
/** Forget everything (after replacing competitors / legends by hand, e.g. migration). */
export function invalidateIndexes(ctx: Ctx) {
  IDX.delete(ctx);
}

function pools(ctx: Ctx): Pools {
  const ix = idx(ctx);
  if (ix.pools && ix.pools.day === ctx.day) return ix.pools;
  indexStats.poolBuilds++;
  const active: Competitor[][] = Array.from({ length: ARENA_COUNT }, () => []);
  const established: Competitor[][] = Array.from({ length: ARENA_COUNT }, () => []);
  const region = new Map<RegionId, Competitor[]>(REGION_IDS.map((r) => [r, []]));
  for (const c of ctx.competitors) {
    if (c.retiredDay !== null) continue;
    const a = RANKS[c.rank].arena;
    active[a].push(c);
    if (c.games >= PROVISIONAL_GAMES) established[a].push(c);
    region.get(regionOf(c))!.push(c);
  }
  ix.pools = { day: ctx.day, active, established, region, byRating: null, regionArena: null };
  return ix.pools;
}

/** Active competitors whose rank is in `arena` (array order). Do not mutate. */
export function activeInArena(ctx: Ctx, arena: number): readonly Competitor[] {
  return pools(ctx).active[arena] ?? [];
}
/** Active, established (≥ provisional games) competitors of an arena — the tournament pool. */
export function establishedInArena(ctx: Ctx, arena: number): readonly Competitor[] {
  return pools(ctx).established[arena] ?? [];
}
/** Active competitors of a region (array order). */
export function activeInRegion(ctx: Ctx, region: RegionId): readonly Competitor[] {
  return pools(ctx).region.get(region) ?? [];
}
/** Active established competitors of a region within an arena band [lo, hi]. */
export function regionBand(ctx: Ctx, region: RegionId, lo: number, hi: number): Competitor[] {
  const p = pools(ctx);
  if (!p.regionArena) {
    p.regionArena = new Map(REGION_IDS.map((r) => [r, Array.from({ length: ARENA_COUNT }, () => [] as Competitor[])]));
    for (let a = 0; a < ARENA_COUNT; a++) for (const c of p.established[a]) p.regionArena.get(regionOf(c))![a].push(c);
  }
  const by = p.regionArena.get(region)!;
  const out: Competitor[] = [];
  for (let a = Math.max(0, lo); a <= Math.min(ARENA_COUNT - 1, hi); a++) for (const c of by[a]) out.push(c);
  return out;
}
/** All active competitors, rating descending (ties: id). Do not mutate. */
export function activeByRating(ctx: Ctx): readonly Competitor[] {
  const p = pools(ctx);
  if (!p.byRating) {
    const all: Competitor[] = [];
    for (const l of p.active) for (const c of l) all.push(c);
    all.sort((a, b) => b.rating - a.rating || (a.id < b.id ? -1 : 1));
    p.byRating = all;
  }
  return p.byRating;
}
/** Count of active competitors. */
export function activeCount(ctx: Ctx): number {
  return pools(ctx).active.reduce((a, l) => a + l.length, 0);
}

/**
 * Active competitors whose rating lies within [lo, hi] (binary search on the
 * rating-sorted pool). O(log n + k).
 */
export function activeInRatingRange(ctx: Ctx, lo: number, hi: number): Competitor[] {
  const a = activeByRating(ctx);
  // a is descending: find first index with rating <= hi.
  let l = 0;
  let r = a.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (a[m].rating > hi) l = m + 1;
    else r = m;
  }
  const out: Competitor[] = [];
  for (let i = l; i < a.length && a[i].rating >= lo; i++) out.push(a[i]);
  return out;
}

/** Names in use (live competitors + archived legends). Generators add to this set. */
export function nameSet(ctx: Ctx): Set<string> {
  const ix = idx(ctx);
  if (!ix.names) {
    indexStats.nameBuilds++;
    const s = new Set<string>();
    for (const c of ctx.competitors) s.add(c.name);
    for (const l of ctx.hall?.legends ?? []) s.add(l.name);
    ix.names = s;
  }
  return ix.names;
}
export function invalidateNames(ctx: Ctx) {
  const ix = IDX.get(ctx);
  if (ix) ix.names = null;
}
