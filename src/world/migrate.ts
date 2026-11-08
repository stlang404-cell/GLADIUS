/**
 * v0.3 world migration ("Golden Age"). Idempotent; safe to call on every load
 * and before every mutation (`advanceDay` calls it; `ensureSaveV2` calls it).
 *
 * Upgrades a v0.2 world in place, adding only optional fields:
 *  - competitors: `region` (derived deterministically from origin + serial,
 *    never guessed), `tp` (tournaments entered, starts at tournamentsWon — the
 *    only lower bound v0.2 kept), `last` (recent results, starts empty);
 *  - awards: `region = 'imperial'` (every v0.2 event belonged to the arena circuit);
 *  - world: `regionTitles` (vacant crowns), `regionReigns`, `regionTally`,
 *    `feuds`, `upsets`, `chronicleArchived`, `worldVersion = 3`.
 * Ids, tournament history, trophies, titles and reigns are left untouched.
 *
 * `growPopulation` (called once for v0.2 worlds, which have no
 * `populationTarget`) registers new competitors with fresh serials
 * (`nextSerial` onward — existing ids are never renumbered) until the active
 * population reaches POPULATION_SIZE. Like the original population, they arrive
 * with an aggregate pre-history record (games / W-D-L, no move lists, no
 * invented tournament results).
 */
import type { WorldState } from '../game/state';
import { ensureWorldV2 } from './trophies';
import { REGIONS, regionForOrigin, regionTitleId, serialOf, IMPERIAL } from './regions';
import { createCompetitor, seedRecord, POPULATION_SIZE } from './population';
import { createRng, mixSeed } from '../core/rng';
import { naturalRank, ARENAS, migrateArenaIndex, migrateRankIndex } from './arenas';
import { invalidateAwardIndex } from './trophies';
import { nameSet, invalidateIndexes } from './indexes';
import { pushChronicle } from './sim';

export const WORLD_VERSION_V3 = 3;
/** Arena layout of v0.3 (24 arenas, 72 ranks). Worlds without `arenaLayout` use the v0.2 layout (12 / 36). */
export const ARENA_LAYOUT = 24;

const SERIES_ARENA = /^(title|laurel|open|cup|gauntlet|invitational|league|hosted|championship)-(\d+)$/;
const SERIES_MEDAL = /^medal-([a-z-]+)-(\d+)$/;
/** Remap the arena number inside a v0.2 award / tournament series key. */
export function migrateSeries(series: string | undefined): string | undefined {
  if (!series) return series;
  let m = SERIES_ARENA.exec(series);
  if (m) return `${m[1]}-${migrateArenaIndex(Number(m[2]))}`;
  m = SERIES_MEDAL.exec(series);
  if (m) return `medal-${m[1]}-${migrateArenaIndex(Number(m[2]))}`;
  return series;
}
const migrateTitleId = (id: string) => {
  const m = /^title-(\d+)$/.exec(id);
  return m ? `title-${migrateArenaIndex(Number(m[1]))}` : id;
};

/**
 * v0.2 (12 arenas / 36 ranks) → v0.3 (24 / 72) world remap. Old arena i → 2·i
 * (the Eternal Throne, 11 → 23); rank 3·a + t → 3·newArena(a) + t. Applies to
 * competitors (rank, peakRank, titles), arena titles (ids `title-N`), reigns,
 * live tournaments, history, the award registry (arena + series; defIds are
 * unchanged — `sig-i` keeps naming old arena i's trophy), legends, chronicle
 * arena fields and pending Season Laurel tallies. The 12 new arenas get vacant
 * titles. Idempotent via `w.arenaLayout`.
 */
export function migrateWorldArenas(w: WorldState): boolean {
  if (w.arenaLayout === ARENA_LAYOUT) return false;
  for (const c of w.competitors) {
    c.rank = migrateRankIndex(c.rank);
    c.peakRank = migrateRankIndex(c.peakRank);
    c.titles = c.titles.map(migrateTitleId);
  }
  const old = new Map(w.titles.map((t) => [migrateArenaIndex(t.arena), t]));
  w.titles = ARENAS.map((a) => {
    const t = old.get(a.index);
    if (t) return { ...t, id: `title-${a.index}`, arena: a.index };
    return { id: `title-${a.index}`, arena: a.index, name: `Champion of ${a.name.replace(/^The /, '')}`, holder: null, since: w.day, defenses: 0 };
  });
  for (const r of w.reigns) r.titleId = migrateTitleId(r.titleId);
  for (const t of w.tournaments) {
    t.arena = migrateArenaIndex(t.arena);
    if (t.titleId) t.titleId = migrateTitleId(t.titleId);
    if (t.series) t.series = migrateSeries(t.series);
  }
  for (const h of w.history) {
    h.arena = migrateArenaIndex(h.arena);
    if (h.series) h.series = migrateSeries(h.series);
  }
  for (const a of w.awards ?? []) {
    a.arena = migrateArenaIndex(a.arena);
    a.series = migrateSeries(a.series);
  }
  invalidateAwardIndex(w);
  for (const l of w.hall?.legends ?? []) l.peakRank = migrateRankIndex(l.peakRank);
  for (const e of w.chronicle) if (e.arena !== undefined) e.arena = migrateArenaIndex(e.arena);
  if (w.seasonTally) {
    const next: Record<string, Record<string, number>> = {};
    for (const [k, v] of Object.entries(w.seasonTally)) {
      const [season, arena] = k.split(':').map(Number);
      next[`${season}:${migrateArenaIndex(arena)}`] = v;
    }
    w.seasonTally = next;
  }
  w.arenaLayout = ARENA_LAYOUT;
  return true;
}

export function initRegionTitles(w: WorldState) {
  w.regionTitles = REGIONS.map((r) => ({ id: regionTitleId(r.id), arena: -1, region: r.id, name: r.crown, holder: null, since: w.day, defenses: 0 }));
  w.regionReigns = [];
}

export function ensureWorldV3(w: WorldState): WorldState {
  if ((w.worldVersion ?? 0) >= WORLD_VERSION_V3 && w.arenaLayout === ARENA_LAYOUT && w.regionTitles && w.regionReigns && w.regionTally && w.feuds && w.upsets) return w;
  ensureWorldV2(w);
  migrateWorldArenas(w);
  for (const c of w.competitors) {
    c.region ??= regionForOrigin(c.origin, serialOf(c.id));
    c.tp ??= c.tournamentsWon;
    c.last ??= 0;
  }
  for (const a of w.awards ?? []) a.region ??= IMPERIAL;
  if (!w.regionTitles) initRegionTitles(w);
  w.regionReigns ??= [];
  // Crowns added later (a future region) start vacant.
  for (const r of REGIONS) if (!w.regionTitles!.some((t) => t.region === r.id)) w.regionTitles!.push({ id: regionTitleId(r.id), arena: -1, region: r.id, name: r.crown, holder: null, since: w.day, defenses: 0 });
  w.regionTally ??= {};
  w.feuds ??= [];
  w.upsets ??= [];
  w.chronicleArchived ??= 0;
  w.worldVersion = Math.max(w.worldVersion ?? 0, WORLD_VERSION_V3);
  invalidateIndexes(w);
  return w;
}

/**
 * Grow a v0.2 world (5,000 competitors) to `target` active competitors.
 * Returns the number of competitors added. Runs once (sets populationTarget).
 */
export function growPopulation(w: WorldState, target = POPULATION_SIZE): number {
  if (w.populationTarget !== undefined) return 0;
  ensureWorldV3(w);
  const active = w.competitors.reduce((n, c) => n + (c.retiredDay === null ? 1 : 0), 0);
  const add = Math.max(0, target - active);
  const taken = nameSet(w);
  for (let i = 0; i < add; i++) {
    const serial = w.nextSerial++;
    const c = createCompetitor(serial, w.seed, w.day, taken);
    seedRecord(c, createRng(mixSeed(w.seed, 'record', serial)));
    c.rank = naturalRank(c.rating);
    c.peakRank = c.rank;
    w.competitors.push(c);
  }
  w.populationTarget = target;
  if (add > 0) {
    pushChronicle(w, { day: w.day, kind: 'season', text: `The Imperial Census of the Golden Age registers ${add.toLocaleString('en-US')} competitors from the eight regions. The empire now counts ${(active + add).toLocaleString('en-US')} active gladiators of the board.` });
  }
  invalidateIndexes(w);
  return add;
}
