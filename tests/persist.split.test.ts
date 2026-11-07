import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  wrap, persistSave, loadSave, exportAll, parseImport, importAll, listBackups, restoreBackup, storeGame, getGame,
  resetPersistState, whenSaved, persistStats, wipeAll, type Manifest,
} from '../src/persist/save';
import { idb, dbStats, dbFaults, resetDbHandle } from '../src/persist/db';
import { canonicalJson, WARM, COLD, H2H, HOT_KEYS } from '../src/persist/layout';
import { emptyWorld, advanceWorld } from '../src/world/world';
import { newSave, startGame, suggestOpponents, finishPlayerGame, hooksFor } from '../src/game/career';
import type { Save } from '../src/game/state';

function freshDb() {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDbHandle();
  resetPersistState();
}
/** Simulates closing and reopening the app (no in-memory persistence state). */
function reopen() {
  resetDbHandle();
  resetPersistState();
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

let base: Save | null = null;
function bigSave(): Save {
  if (!base) {
    const w = emptyWorld(7);
    const s = newSave(w, 'Tester', false);
    advanceWorld(s.world, 30, hooksFor(s)); // running tournaments, h2h, a season boundary
    base = s;
  }
  return clone(base);
}

async function manifest(): Promise<Manifest> {
  const r = await idb.get<{ s: string }>('parts', 'manifest');
  return JSON.parse(r!.s);
}
function written(): string[] {
  return persistStats.last!.written;
}

beforeEach(freshDb);

describe('split persistence', () => {
  it('round-trips the full Save exactly (including an active game)', async () => {
    const s = bigSave();
    const opp = suggestOpponents(s)[0].c;
    const rec = startGame(s, opp, { kind: 'ranked', tcId: 'rapid-10' });
    rec.moves = ['e2e4', 'e7e5'];
    await persistSave(s);
    reopen();
    const r = await loadSave();
    expect(r.recovered).toBe(false);
    expect(r.save).toEqual(s);
    expect(canonicalJson(r.save)).toBe(canonicalJson(s));
    const m = await manifest();
    const names = Object.keys(m.parts);
    expect(names).toContain('active');
    expect(names.filter((n) => n.startsWith('pop/cold/')).length).toBeGreaterThan(5);
    expect(names.filter((n) => n.startsWith('pop/hot/')).length).toBe(HOT_KEYS.length);
  });

  it('migrates a schema-1 single-document save and keeps it as a backup', async () => {
    const s = bigSave();
    const env = wrap(s);
    await idb.put('kv', 'save', env);
    await idb.put('backups', 'slot1', env); // an old rolling backup
    const r = await loadSave();
    expect(r.recovered).toBe(false);
    expect(r.save).toEqual(s);
    expect(await idb.get('kv', 'save')).toBeUndefined();
    expect(await idb.get('backups', 'pre-split')).toEqual(env);
    expect((await manifest()).migratedFrom).toBe(env.checksum);
    reopen();
    const r2 = await loadSave();
    expect(r2.save).toEqual(s);
    const bl = await listBackups();
    expect(bl.map((b) => b.key).sort()).toEqual(['pre-split', 'slot1']);
    expect(bl.every((b) => b.ok)).toBe(true);
  });

  it('migration of a damaged schema-1 save falls back to its backup', async () => {
    const s = bigSave();
    const env = wrap(s);
    await idb.put('backups', 'slot0', env);
    await idb.put('kv', 'save', { ...env, checksum: 1 });
    const r = await loadSave();
    expect(r.recovered).toBe(true);
    expect(r.save?.player.name).toBe('Tester');
    expect(await idb.get('parts', 'manifest')).toBeDefined();
  });

  it('writes only the chunks that changed', async () => {
    const s = bigSave();
    await persistSave(s);
    const total = Object.keys((await manifest()).parts).length;
    reopen();
    const { save } = await loadSave();
    const x = save!;
    // First commit after load re-verifies everything but writes nothing that did not change.
    await persistSave(x);
    expect(written()).toEqual(['meta']);
    // One competitor's head-to-head record (v0.3: binary h2h family) -> one h2h chunk.
    const c = x.world.competitors[1234];
    c.h2h.push({ id: 'c000001', w: 1, d: 0, l: 0 });
    dbStats.putKeys.length = 0;
    await persistSave(x);
    const serial = Number(c.id.slice(1));
    expect(written().sort()).toEqual(['meta', `pop/h2h/${Math.floor(serial / H2H.size)}`]);
    expect(dbStats.putKeys.length).toBe(3); // meta, chunk, manifest
    // A new honour (warm family) -> one warm chunk.
    c.honours.push('Test Cup (S1)');
    await persistSave(x);
    expect(written().sort()).toEqual(['meta', `pop/warm/${Math.floor(serial / WARM.size)}`]);
    // One rating -> one hot column.
    x.world.competitors[10].rating += 7;
    await persistSave(x);
    expect(written().sort()).toEqual(['meta', 'pop/hot/rating']);
    // A world day: hot columns, a few warm chunks, world core, tournaments; cold chunks only where membership changed.
    advanceWorld(x.world, 1, hooksFor(x));
    await persistSave(x);
    const w = written();
    expect(w.length).toBeLessThan(total);
    expect(w.filter((n) => n.startsWith('pop/rh/')).length).toBeLessThanOrEqual(2);
    const coldWritten = w.filter((n) => n.startsWith('pop/cold/'));
    expect(coldWritten.length).toBeLessThanOrEqual(2);
    expect(persistStats.last!.bytes).toBeLessThan(0.5 * JSON.stringify(x).length * 2); // young world: h2h lists still filling (mature worlds: see perf test)
    reopen();
    expect((await loadSave()).save).toEqual(x);
  });

  it('cold chunk is rewritten when a new competitor debuts in it, and removed chunks are deleted', async () => {
    const s = bigSave();
    await persistSave(s);
    const extra = clone(s.world.competitors[0]);
    extra.id = 'c099999';
    s.world.competitors.push(extra);
    await persistSave(s);
    expect(written()).toContain(`pop/cold/${Math.floor(99999 / COLD.size)}`);
    s.world.competitors.pop();
    await persistSave(s);
    const m = await manifest();
    expect(m.parts[`pop/cold/${Math.floor(99999 / COLD.size)}`]).toBeUndefined();
    const keys = (await idb.keys('parts')) as string[];
    expect(keys.length).toBe(Object.keys(m.parts).length + 1); // no orphans
    reopen();
    expect((await loadSave()).save).toEqual(s);
  });

  it('an in-game move writes only the tiny active record', async () => {
    const s = bigSave();
    const opp = suggestOpponents(s)[0].c;
    startGame(s, opp, { kind: 'ranked', tcId: 'rapid-10' });
    await persistSave(s);
    const before = dbStats.puts;
    for (const mv of ['e2e4', 'e7e5', 'g1f3', 'b8c6']) {
      s.active!.record.moves.push(mv);
      s.active!.record.san.push(mv);
      await persistSave(s);
      expect(persistStats.last!.mode).toBe('light');
      expect(written()).toContain('active');
      expect(written().every((n) => n === 'active' || n === 'meta')).toBe(true);
      expect(persistStats.last!.bytes).toBeLessThan(8 * 1024);
      expect(persistStats.last!.prepMs).toBeLessThan(5);
    }
    expect(dbStats.puts - before).toBeLessThanOrEqual(4 * 3);
    reopen();
    expect((await loadSave()).save?.active?.record.moves).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  });

  it('finishing a game is a full commit (the game result is never split from the world)', async () => {
    const s = bigSave();
    const opp = suggestOpponents(s)[0].c;
    const rec = startGame(s, opp, { kind: 'ranked', tcId: 'rapid-10' });
    await persistSave(s);
    s.active!.record.moves.push('e2e4');
    await persistSave(s);
    finishPlayerGame(s, { ...rec, moves: ['e2e4'], san: ['e4'], result: '1-0', termination: 'resignation' } as never);
    s.active = null;
    await persistSave(s);
    expect(persistStats.last!.mode).toBe('full');
    expect(written()).toContain('player');
    reopen();
    expect((await loadSave()).save).toEqual(s);
  });

  it('a crash mid-commit leaves the previous generation loadable', async () => {
    const s = bigSave();
    await persistSave(s);
    const good = clone(s);
    const genBefore = (await manifest()).gen;
    s.player.name = 'Changed';
    advanceWorld(s.world, 1, hooksFor(s));
    dbFaults.abortAfterPuts = 3; // the transaction dies after three chunk writes...
    dbFaults.crash = true; // ...and so does the app (no retry gets through)
    const err = console.error;
    console.error = () => {};
    await persistSave(s);
    await whenSaved();
    console.error = err;
    expect(dbFaults.abortAfterPuts).toBeNull();
    dbFaults.crash = dbFaults.dead = false;
    reopen();
    const keysAfterCrash = (await idb.keys('parts')) as string[];
    const m = await manifest();
    expect(m.gen).toBe(genBefore);
    expect(keysAfterCrash.every((k) => k === 'manifest' || Object.values(m.parts).some((p) => p.key === k))).toBe(true);
    const r = await loadSave();
    expect(r.recovered).toBe(false);
    expect(r.save).toEqual(good);
  });

  it('a stray next-generation record without a manifest flip is ignored', async () => {
    const s = bigSave();
    await persistSave(s);
    const m = await manifest();
    await idb.put('parts', `player@${m.gen + 1}`, { k: 'json', s: '{"player":{"name":"Ghost"}}', sum: 1 });
    reopen();
    const r = await loadSave();
    expect(r.save?.player.name).toBe('Tester');
    // and the next full commit garbage-collects it
    await persistSave(r.save!, { full: true });
    await whenSaved();
  });

  it('after a failed commit the next commit rewrites everything', async () => {
    const s = bigSave();
    await persistSave(s);
    s.player.name = 'Second';
    dbFaults.abortAfterPuts = 1;
    const err = console.error;
    console.error = () => {};
    await persistSave(s);
    await whenSaved(); // automatic full retry
    console.error = err;
    reopen();
    expect((await loadSave()).save).toEqual(s);
  });

  it('a commit racing another tab is detected and rewritten whole (last writer wins)', async () => {
    const s = bigSave();
    await persistSave(s);
    // Another window commits in between (its manifest generation moves on).
    const rec = await idb.get<{ s: string; sum: number; gen: number }>('parts', 'manifest');
    await idb.put('parts', 'manifest', { ...rec, gen: rec!.gen + 5 });
    s.player.name = 'ThisTab';
    const warn = console.warn;
    const err = console.error;
    console.warn = console.error = () => {};
    await persistSave(s);
    await whenSaved();
    console.warn = warn;
    console.error = err;
    reopen();
    expect((await loadSave()).save).toEqual(s);
  });

  it('repairs a damaged competitor chunk from the newest backup and keeps the career', async () => {
    const s = bigSave();
    await persistSave(s, { backup: true }); // first backup is always taken
    await whenSaved();
    const atBackup = clone(s);
    s.player.name = 'Newer';
    s.player.w += 3;
    await persistSave(s);
    const m = await manifest();
    const chunk = Object.keys(m.parts).find((n) => n.startsWith('pop/cold/'))!;
    const rec = await idb.get<{ s: string }>('parts', m.parts[chunk].key);
    await idb.put('parts', m.parts[chunk].key, { ...rec, s: rec!.s.replace(/"name":"[^"]+"/, '"name":"Corrupted"') });
    reopen();
    const err = console.error;
    const r = await loadSave();
    console.error = err;
    expect(r.recovered).toBe(true);
    expect(r.error).toMatch(/Repaired 1 damaged competitor record/);
    expect(r.save!.player.name).toBe('Newer');
    expect(r.save!.world.competitors.map((c) => c.name)).toEqual(atBackup.world.competitors.map((c) => c.name));
    expect(r.save!.world.competitors.some((c) => c.name === 'Corrupted')).toBe(false);
    // healed: the next load is clean
    reopen();
    const r2 = await loadSave();
    expect(r2.recovered).toBe(false);
    expect(r2.save).toEqual(r.save);
  });

  it('damaged hot column without backup is regenerated; damaged chunk is read as-is', async () => {
    const s = bigSave();
    await persistSave(s);
    const m = await manifest();
    const col = await idb.get<{ v: ArrayBuffer }>('parts', m.parts['pop/hot/skill'].key);
    new Float64Array(col!.v)[0] += 1;
    await idb.put('parts', m.parts['pop/hot/skill'].key, col);
    const warm = Object.keys(m.parts).find((n) => n.startsWith('pop/warm/'))!;
    const wr = await idb.get<{ s: string; sum: number }>('parts', m.parts[warm].key);
    await idb.put('parts', m.parts[warm].key, { ...wr, sum: wr!.sum ^ 1 });
    reopen();
    const r = await loadSave();
    expect(r.recovered).toBe(true);
    expect(r.save!.player.name).toBe('Tester');
    expect(r.save!.world.competitors.length).toBe(s.world.competitors.length);
    expect(r.save!.world.competitors.every((c) => typeof c.skill === 'number')).toBe(true);
    const ids = new Set(Object.keys(JSON.parse(wr!.s)));
    for (const c of r.save!.world.competitors) if (ids.has(c.id)) expect(c.h2h).toEqual(s.world.competitors.find((x) => x.id === c.id)!.h2h);
  });

  it('damaged career record: restores the whole backup; with no backup, quarantines instead of wiping', async () => {
    const s = bigSave();
    await persistSave(s, { backup: true });
    await whenSaved();
    s.player.name = 'After';
    await persistSave(s);
    let m = await manifest();
    await idb.put('parts', m.parts.player.key, { k: 'json', s: '{"player":', sum: m.parts.player.sum });
    reopen();
    const r = await loadSave();
    expect(r.recovered).toBe(true);
    expect(r.save!.player.name).toBe('Tester');
    expect(r.error).toMatch(/Restored the backup/);
    // Now with no backups at all.
    await idb.clear('backups');
    m = await manifest();
    await idb.put('parts', m.parts.player.key, { k: 'json', s: '{"player":', sum: m.parts.player.sum });
    reopen();
    const r2 = await loadSave();
    expect(r2.save).toBeNull();
    expect(r2.error).toMatch(/no backup/);
    const keys = (await idb.keys('backups')) as string[];
    expect(keys.some((k) => k.startsWith('damaged-'))).toBe(true);
    expect((await listBackups()).find((b) => b.key.startsWith('damaged-'))!.ok).toBe(false);
  });

  it('rolling backups: compressed, throttled, at most three slots, restorable', async () => {
    const s = bigSave();
    await persistSave(s, { backup: true });
    await whenSaved();
    expect(persistStats.backups).toBeGreaterThan(0);
    const n0 = persistStats.backups;
    const b0 = await idb.get<{ enc: string; v: number; data: ArrayBuffer; bytes: number }>('backups', 'slot0');
    expect(b0!.v).toBe(2);
    expect(b0!.enc).toBe('gzip');
    expect(b0!.data.byteLength).toBeLessThan(b0!.bytes / 3);
    // Not due yet: same season, fewer than 10 games.
    s.player.w += 1;
    await persistSave(s, { backup: true });
    await whenSaved();
    expect(persistStats.backups).toBe(n0);
    for (let i = 0; i < 4; i++) {
      s.player.w += 10;
      s.player.name = 'Gen' + i;
      await persistSave(s, { backup: true });
      await whenSaved();
    }
    expect(persistStats.backups).toBe(n0 + 4);
    const list = await listBackups();
    expect(list.length).toBe(3);
    expect(list.every((b) => b.ok)).toBe(true);
    const restored = await restoreBackup(list[2].key);
    expect(restored.player.name).toBe('Gen1');
    reopen();
    expect((await loadSave()).save!.player.name).toBe('Gen1');
  });

  it('export is version 2; imports version 1 and version 2 files', async () => {
    const s = bigSave();
    await storeGame({ id: 'g1', moves: ['e2e4'] } as never);
    const text = await exportAll(s);
    const f = JSON.parse(text);
    expect(f.version).toBe(2);
    expect(typeof f.save).toBe('object');
    const back = parseImport(text);
    expect(back.save).toEqual(s);
    expect(back.games.map((g) => g.id)).toEqual(['g1']);
    expect(() => parseImport(text.replace('"Tester"', '"Hacker"'))).toThrow(/integrity/);
    const v1 = JSON.stringify({ format: 'gladius-backup', version: 1, exportedAt: 'x', save: wrap(s), games: [{ id: 'g2', moves: [] }] });
    expect(parseImport(v1).save).toEqual(s);
    await wipeAll();
    const imported = await importAll(v1);
    expect(imported.player.name).toBe('Tester');
    expect(await getGame('g1')).toBeUndefined();
    expect(await getGame('g2')).toBeDefined();
    reopen();
    expect((await loadSave()).save).toEqual(s);
    expect((await listBackups()).length).toBe(1);
  });

  it('coalesces bursts of saves into few commits', async () => {
    const s = bigSave();
    await persistSave(s);
    const c0 = persistStats.commits;
    const ps = [];
    for (let i = 0; i < 10; i++) {
      s.player.influence = i;
      ps.push(persistSave(s));
    }
    await Promise.all(ps);
    expect(persistStats.commits - c0).toBeLessThanOrEqual(2);
    reopen();
    expect((await loadSave()).save!.player.influence).toBe(9);
  });

  it('carries unknown fields added by future code', async () => {
    const s = bigSave() as Save & Record<string, unknown>;
    s.newTopLevel = { a: 1 };
    (s.world as unknown as Record<string, unknown>).newWorldField = [1, 2, 3];
    (s.player as unknown as Record<string, unknown>).newPlayerField = 'x';
    const c = s.world.competitors[5] as unknown as Record<string, unknown>;
    c.mood = 0.25;
    c.rating = 'weird' as never; // a hot key holding a non-number goes to the warm family
    delete c.form;
    await persistSave(s);
    reopen();
    expect((await loadSave()).save).toEqual(s);
  });
});
