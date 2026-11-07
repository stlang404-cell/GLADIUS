import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { ensureSaveV2 } from '../src/game/legacy';
import { restDays, refreshInvitations, playerWithdraw, playerTournamentGame } from '../src/game/career';
import { migrateArenaIndex, migrateRankIndex, ARENAS, RANKS } from '../src/world/arenas';
import { regionForOrigin, serialOf, REGIONS } from '../src/world/regions';
import { POPULATION_SIZE } from '../src/world/population';
import { canonicalJson } from '../src/persist/layout';
import { persistSave, loadSave, resetPersistState, whenSaved, storeGame, getGame } from '../src/persist/save';
import { resetDbHandle } from '../src/persist/db';
import { awardsFor, isVictory, currentOfSeries } from '../src/world/trophies';
import type { Save, GameRecord } from '../src/game/state';

/**
 * v0.2 → v0.3 migration on a genuine v0.2 save: tests/fixtures/v02-save.json.gz was
 * produced by the v0.2 code (git HEAD before v0.3: 12 arenas / 36 ranks, 400
 * competitors + debutants, 6 seasons, a player career of 160 games at rank 20).
 */
const load = (): Save => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v02-save.json.gz', import.meta.url))).toString('utf8'));

let old: Save;
let s: Save;
beforeAll(() => {
  old = load();
  s = load();
  ensureSaveV2(s);
}, 60_000);

describe('v0.2 → v0.3 save migration', () => {
  it('the fixture really is a v0.2 save', () => {
    expect(old.world.worldVersion).toBe(2);
    expect(old.world.titles.length).toBe(12);
    expect(old.world.arenaLayout).toBeUndefined();
    expect((old.world.competitors[0] as { region?: string }).region).toBeUndefined();
    expect(old.player.rank).toBe(20);
  });

  it('keeps every competitor id, name and record; assigns regions deterministically; grows the population with fresh serials', () => {
    const w = s.world;
    expect(w.arenaLayout).toBe(24);
    expect(w.worldVersion).toBe(3);
    expect(w.populationTarget).toBe(POPULATION_SIZE);
    expect(w.competitors.filter((c) => c.retiredDay === null).length).toBe(POPULATION_SIZE);
    const byId = new Map(w.competitors.map((c) => [c.id, c]));
    expect(byId.size).toBe(w.competitors.length);
    expect(new Set(w.competitors.map((c) => c.name)).size).toBe(w.competitors.length);
    for (const o of old.world.competitors) {
      const c = byId.get(o.id)!;
      expect(c.name).toBe(o.name);
      expect(c.games).toBe(o.games);
      expect(c.w + c.d + c.l).toBe(c.games);
      expect(c.rating).toBe(o.rating);
      expect(c.rank).toBe(migrateRankIndex(o.rank));
      expect(c.peakRank).toBe(migrateRankIndex(o.peakRank));
      expect(c.region).toBe(regionForOrigin(o.origin, serialOf(o.id)));
      expect(c.tp).toBe(o.tournamentsWon);
      expect(c.titles).toEqual(o.titles.map((t) => `title-${migrateArenaIndex(Number(t.slice(6)))}`));
    }
    const maxOld = Math.max(...old.world.competitors.map((c) => serialOf(c.id)));
    const added = w.competitors.filter((c) => !old.world.competitors.some((o) => o.id === c.id));
    expect(added.length).toBe(POPULATION_SIZE - old.world.competitors.filter((c) => c.retiredDay === null).length);
    for (const c of added) expect(serialOf(c.id)).toBeGreaterThan(maxOld);
    expect(w.nextSerial).toBeGreaterThan(maxOld + added.length);
  });

  it('remaps titles, reigns, history, awards and the player to the 24-arena layout', () => {
    const w = s.world;
    expect(w.titles.length).toBe(ARENAS.length);
    for (const t of old.world.titles) {
      const n = w.titles.find((x) => x.id === `title-${migrateArenaIndex(t.arena)}`)!;
      expect(n.holder).toBe(t.holder);
      expect(n.defenses).toBe(t.defenses);
      expect(n.arena).toBe(migrateArenaIndex(t.arena));
    }
    // New arenas start vacant.
    for (const a of ARENAS) if (a.legacyIndex === undefined) expect(w.titles.find((t) => t.arena === a.index)!.holder).toBe(null);
    expect(w.reigns.length).toBe(old.world.reigns.length);
    w.reigns.forEach((r, i) => expect(r.titleId).toBe(`title-${migrateArenaIndex(Number(old.world.reigns[i].titleId.slice(6)))}`));
    expect(w.history.map((h) => h.id)).toEqual(old.world.history.map((h) => h.id));
    w.history.forEach((h, i) => expect(h.arena).toBe(migrateArenaIndex(old.world.history[i].arena)));
    // Awards: same ids, same defIds (saves reference them), arenas remapped, title series follow the titles.
    expect(w.awards!.map((a) => a.awardId)).toEqual(old.world.awards!.map((a) => a.awardId));
    w.awards!.forEach((a, i) => {
      expect(a.defId).toBe(old.world.awards![i].defId);
      expect(a.arena).toBe(migrateArenaIndex(old.world.awards![i].arena));
      expect(a.region).toBe('imperial');
    });
    for (const t of w.titles) if (t.holder) expect(new Set(currentOfSeries(w, `title-${t.arena}`).map((a) => a.holder))).toEqual(new Set([t.holder]));
    expect(currentOfSeries(w, 'title-11').length).toBe(0); // old numbering is gone
    for (const c of w.competitors) expect(awardsFor(w, c.id).filter(isVictory).length).toBeLessThanOrEqual(c.tournamentsWon);
    // Player.
    const p = s.player;
    expect(p.rankLayout).toBe(24);
    expect(p.rank).toBe(migrateRankIndex(old.player.rank));
    expect(RANKS[p.rank].arena).toBe(12); // the Senate Hall (v0.2 arena 6)
    expect(p.peakRank).toBe(migrateRankIndex(old.player.peakRank));
    expect(p.rankHistory.map((r) => r.rank)).toEqual(old.player.rankHistory.map((r) => migrateRankIndex(r.rank)));
    expect(p.unlockedSets).toEqual(old.player.unlockedSets.map(migrateArenaIndex));
    expect(awardsFor(w, 'player').length).toBe(old.world.awards!.filter((a) => a.holder === 'player').length);
    expect(p.achievements).toEqual(old.player.achievements);
    // Regions: eight vacant crowns.
    expect(w.regionTitles!.length).toBe(REGIONS.length);
    expect(w.regionTitles!.every((t) => t.holder === null)).toBe(true);
  });

  it('is idempotent', () => {
    const before = canonicalJson(s);
    ensureSaveV2(s);
    expect(canonicalJson(s)).toBe(before);
  });

  it('the migrated career keeps running: a season passes with regional events, and the save round-trips', async () => {
    const x = load();
    ensureSaveV2(x);
    const season = x.world.season;
    // The v0.2 career has a tournament round waiting; withdraw so time can pass without playing.
    for (let d = 0; d < 40; d++) {
      for (const t of x.world.tournaments) if (t.playerEntered && t.status !== 'complete' && !t.playerWithdrawn) playerWithdraw(x, t.id);
      for (let g = playerTournamentGame(x); g; g = playerTournamentGame(x)) playerWithdraw(x, g.t.id); // e.g. named challenger as League winner
      restDays(x, 1);
    }
    refreshInvitations(x);
    expect(x.world.season).toBeGreaterThan(season);
    expect(x.world.tournaments.some((t) => t.kind === 'local-open')).toBe(true);
    for (const t of [...x.world.titles, ...x.world.regionTitles!]) {
      if (!t.holder || t.holder === 'player') continue;
      expect(x.world.competitors.find((c) => c.id === t.holder)!.retiredDay).toBe(null);
    }
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetDbHandle();
    resetPersistState();
    await persistSave(x);
    await whenSaved();
    resetDbHandle();
    resetPersistState();
    const r = await loadSave();
    expect(r.recovered).toBe(false);
    expect(canonicalJson(r.save)).toBe(canonicalJson(x));
  }, 120_000);

  it('old game records are remapped on read', async () => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetDbHandle();
    const g = { id: 'g-old', arena: 11, white: { id: 'player', name: 'P', rating: 2700, rank: 35 }, black: { id: 'c000001', name: 'X', rating: 2710, rank: 34 } } as unknown as GameRecord;
    const { idb } = await import('../src/persist/db');
    await idb.put('games', g.id, g);
    const r = (await getGame('g-old'))!;
    expect(r.arena).toBe(23);
    expect(r.white.rank).toBe(71);
    expect(r.black.rank).toBe(70);
    expect(r.arenaLayout).toBe(24);
    await storeGame(r);
    expect((await getGame('g-old'))!.arena).toBe(23); // not remapped twice
  });
});
