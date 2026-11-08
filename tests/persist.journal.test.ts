import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  persistSave, loadSave, resetPersistState, whenSaved, persistStats, persistTuning, noteMutation, listBackups, restoreBackup, persistIdle,
  exportAll, parseImport, type Manifest,
} from '../src/persist/save';
import { idb, dbFaults, resetDbHandle } from '../src/persist/db';
import { canonicalJson, HOT_KEYS } from '../src/persist/layout';
import { tjEncode, tjDecode } from '../src/persist/tj';
import { emptyWorld, advanceWorld } from '../src/world/world';
import { newSave, hooksFor } from '../src/game/career';
import { createRng, type Rng } from '../src/core/rng';
import type { Save } from '../src/game/state';

/** v0.4 journal / compaction / sliced preparation (layout v4). */
function freshDb() {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDbHandle();
  resetPersistState();
}
function reopen() {
  resetDbHandle();
  resetPersistState();
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
async function manifest(): Promise<Manifest> {
  return JSON.parse((await idb.get<{ s: string }>('parts', 'manifest'))!.s);
}
const quiet = async <T>(f: () => Promise<T>) => {
  const e = console.error;
  const w = console.warn;
  console.error = console.warn = () => {};
  try {
    return await f();
  } finally {
    console.error = e;
    console.warn = w;
  }
};

let small: Save | null = null;
function smallSave(): Save {
  if (!small) {
    const s = newSave(emptyWorld(11, 600), 'Journal', false);
    advanceWorld(s.world, 20, hooksFor(s));
    small = s;
  }
  return clone(small);
}
const tuning = { ...persistTuning };
/** First differing paths between two JSON values (readable failures). */
function diffPaths(a: unknown, b: unknown, path = '', out: string[] = []): string[] {
  if (out.length >= 5) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const k of keys) diffPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path + '/' + k, out);
    if (!out.length) out.push(path + ' (order)');
  } else out.push(`${path}: ${JSON.stringify(a)?.slice(0, 120)} != ${JSON.stringify(b)?.slice(0, 120)}`);
  return out;
}
beforeEach(freshDb);
afterEach(() => Object.assign(persistTuning, tuning));

type C = Record<string, unknown> & { id: string; h2h: { id: string; w: number; d: number; l: number }[]; ratingHistory: [number, number][]; honours: string[] };

/** Random edits of every kind the layout has to carry. */
function mutate(s: Save, rng: Rng, round: number) {
  const cs = s.world.competitors as unknown as C[];
  const pick = () => cs[rng.int(0, cs.length)];
  // Rounds < 30: edits the simulation copes with, interleaved with simulated days.
  // Rounds >= 30: anything goes (the world is no longer advanced).
  const valid = round < 30;
  const k = valid ? [0, 1, 2, 4, 6, 8, 9, 10, 13][rng.int(0, 9)] : rng.int(3, 14);
  if (k <= 2) advanceWorld(s.world, 1, hooksFor(s));
  else if (k === 3) {
    const c = pick();
    const key = HOT_KEYS[rng.int(0, HOT_KEYS.length)];
    c[key] = [null, -0, 0.1 + round, 7, 'weird', Number.NaN, undefined][rng.int(0, 7)];
    if (c[key] === undefined) delete c[key];
  } else if (k === 4) {
    const c = pick();
    if (!Array.isArray(c.h2h) || (!valid && rng.next() < 0.2)) c.h2h = [{ id: 'player', w: 1, d: 1, l: 1 }];
    else if (rng.next() < 0.5) c.h2h.push({ id: pick().id, w: rng.int(0, 4), d: 0, l: 1 });
    else if (c.h2h.length) c.h2h[0].w += 1;
  } else if (k === 5) {
    const c = pick();
    if (rng.next() < 0.3) c.h2h = [{ id: 'nonstandard-id', w: 1, d: 0, l: 0 }]; // not encodable -> warm
    else if (rng.next() < 0.5) delete (c as Record<string, unknown>).h2h;
    else c.h2h = [];
  } else if (k === 6) {
    const c = pick();
    if (!Array.isArray(c.ratingHistory)) c.ratingHistory = [];
    c.ratingHistory.push([s.world.day, 1500 + round]);
    if (c.ratingHistory.length > 3) c.ratingHistory.splice(1, 1);
  } else if (k === 7) {
    const c = pick();
    c.ratingHistory = rng.next() < 0.5 ? [[1, 1.5]] : ([[2, 3, 4]] as never); // not encodable -> warm
  } else if (k === 8) {
    const c = pick();
    (c.honours ??= []).push('Honour ' + round);
  }
  else if (k === 9) {
    const c = pick() as Record<string, unknown>;
    if (c.mood === undefined) c.mood = { round, tag: 'x' }; // a new unknown field (in-place value edits: see the verification test)
    else delete c.mood;
  }
  else if (k === 10) {
    // debut
    const c = clone(pick());
    c.id = 'c' + String(900000 + round).padStart(6, '0');
    cs.push(c);
  } else if (k === 11) {
    // prune a few
    for (let i = 0; i < 3; i++) cs.splice(rng.int(0, cs.length), 1);
  } else if (k === 12) {
    // a non-standard id competitor
    const c = clone(pick());
    c.id = 'legend-' + round;
    cs.splice(rng.int(0, cs.length), 0, c);
  } else {
    const c = pick();
    (c as Record<string, unknown>).style = 'attacker';
    (c as Record<string, unknown>).openingStyles = ['gambit', 'sharp'];
    (c as Record<string, unknown>).styleDay = s.world.day;
  }
}

describe('v0.4 journal persistence', () => {
  it('tabular JSON round-trips arrays of objects exactly (key order, dropped undefined, nested values)', () => {
    const a = [
      { a: 1, b: 'x', c: [1, 2], d: { e: null } }, { a: 2, b: 'x', c: [], d: { e: 1 } }, { b: 'y', a: 3, u: undefined }, { a: -0, b: 'x' },
      { a: 4, b: 'x', z: 'k' }, { a: 5, b: 'x', z: 'k' }, { a: 6, b: 'x', z: 'k' }, { a: 7, b: 'x', z: 'k' }, { a: 8, b: 'x', z: 'k' },
    ];
    const enc = tjEncode(a);
    expect(Array.isArray(enc)).toBe(false);
    const back = tjDecode(JSON.parse(JSON.stringify(enc)));
    expect(JSON.stringify(back)).toBe(JSON.stringify(a));
    expect(back.map((o) => Object.keys(o as object))).toEqual(JSON.parse(JSON.stringify(a)).map((o: object) => Object.keys(o)));
    // Not tabular: non-objects, __proto__ keys.
    expect(tjEncode([1, 2, 3])).toEqual([1, 2, 3]);
    const proto = [JSON.parse('{"__proto__":1}'), { a: 1 }];
    expect(tjEncode(proto)).toBe(proto);
  });

  it('random edits of every kind survive journals, compactions and reloads exactly', async () => {
    persistTuning.journalLimitBytes = 64 * 1024; // compact every few commits
    persistTuning.sliceMs = 1; // and yield a lot
    const s = smallSave();
    await persistSave(s);
    const rng = createRng(4242);
    let compactions = 0;
    let journals = 0;
    for (let round = 0; round < 60; round++) {
      for (let e = rng.int(1, 5); e > 0; e--) mutate(s, rng, round);
      await persistSave(s);
      await whenSaved();
      if (persistStats.last!.compacted) compactions++;
      if (persistStats.last!.journalBytes > 0) journals++;
      if (round % 6 === 5) {
        const want = canonicalJson(s);
        reopen();
        const r = await loadSave();
        expect(r.recovered).toBe(false);
        expect(diffPaths(JSON.parse(canonicalJson(r.save)), JSON.parse(want))).toEqual([]);
        // keep going on the loaded save (diff state rebuilt from what was read)
        Object.assign(s, r.save);
      }
    }
    expect(compactions).toBeGreaterThan(2);
    expect(journals).toBeGreaterThan(10);
    const m = await manifest();
    const keys = (await idb.keys('parts')) as string[];
    expect(keys.length).toBe(Object.keys(m.parts).length + 1); // no orphans
  }, 120_000);

  it('edits the cheap signatures cannot see are saved by the rolling verification within 64 full commits', async () => {
    const s = smallSave();
    (s.world.competitors[3] as unknown as Record<string, unknown>).mood = { v: 1 };
    await persistSave(s);
    reopen();
    const x = (await loadSave()).save!;
    await persistIdle(); // verification baselines are completed in the background after a load
    const c = x.world.competitors[3] as unknown as Record<string, unknown>;
    (c.mood as { v: number }).v = 2; // in place, same keys
    x.world.competitors[200].name = 'Renamed In Place'; // a "never changes" cold field
    for (let i = 0; i < 64; i++) {
      x.player.influence += 1;
      await persistSave(x);
    }
    reopen();
    const y = (await loadSave()).save!;
    expect((y.world.competitors[3] as unknown as Record<string, unknown>).mood).toEqual({ v: 2 });
    expect(y.world.competitors[200].name).toBe('Renamed In Place');
  }, 60_000);

  it('a crash during a journal commit or a compaction leaves the previous generation intact', async () => {
    const s = smallSave();
    await persistSave(s);
    for (const compact of [false, true]) {
      advanceWorld(s.world, 1, hooksFor(s));
      await persistSave(s);
      const good = canonicalJson(s);
      const gen = (await manifest()).gen;
      advanceWorld(s.world, 2, hooksFor(s));
      s.player.name = 'Crash ' + compact;
      if (compact) persistTuning.journalLimitBytes = 0;
      dbFaults.abortAfterPuts = compact ? 6 : 1;
      dbFaults.crash = true;
      await quiet(async () => {
        await persistSave(s);
        await whenSaved();
      });
      dbFaults.crash = dbFaults.dead = false;
      persistTuning.journalLimitBytes = tuning.journalLimitBytes;
      reopen();
      expect((await manifest()).gen).toBe(gen);
      const r = await loadSave();
      expect(r.recovered).toBe(false);
      expect(canonicalJson(r.save)).toBe(good);
      Object.assign(s, r.save);
      // and the app carries on from there
      s.player.name = 'After ' + compact;
      await persistSave(s);
      reopen();
      expect((await loadSave()).save!.player.name).toBe('After ' + compact);
      Object.assign(s, (await loadSave()).save);
    }
  }, 60_000);

  it('a damaged journal restores the newest backup; without a backup the other records are kept and the loss is reported', async () => {
    const s = smallSave();
    await persistSave(s, { backup: true });
    await whenSaved();
    advanceWorld(s.world, 1, hooksFor(s));
    s.player.name = 'Later';
    await persistSave(s);
    let m = await manifest();
    let jr = Object.keys(m.parts).find((n) => n.startsWith('jr/'))!;
    expect(jr).toBeDefined();
    const rec = await idb.get<{ b: ArrayBuffer[] }>('parts', m.parts[jr].key);
    new Uint8Array(rec!.b[0])[0] ^= 0xff;
    await idb.put('parts', m.parts[jr].key, rec);
    reopen();
    const r = await quiet(loadSave);
    expect(r.recovered).toBe(true);
    expect(r.error).toMatch(/Restored the backup/);
    expect(r.save!.player.name).toBe('Journal');
    // No backup: the damaged journal is dropped, the career (player record) is current.
    await idb.clear('backups');
    advanceWorld(r.save!.world, 1, hooksFor(r.save!));
    r.save!.player.name = 'NoBackup';
    await persistSave(r.save!);
    m = await manifest();
    jr = Object.keys(m.parts).find((n) => n.startsWith('jr/'))!;
    await idb.put('parts', m.parts[jr].key, { k: 'jr', h: '{"v":4,"hot":[', b: [], sum: m.parts[jr].sum });
    reopen();
    const r2 = await quiet(loadSave);
    expect(r2.recovered).toBe(true);
    expect(r2.save!.player.name).toBe('NoBackup');
    expect(r2.error).toMatch(/could not be read/);
    reopen();
    expect((await loadSave()).recovered).toBe(false); // healed
  }, 60_000);

  it('a damaged base chunk under live journals is repaired from the backup', async () => {
    const s = smallSave();
    await persistSave(s, { backup: true });
    await whenSaved();
    const atBackup = clone(s);
    advanceWorld(s.world, 1, hooksFor(s));
    await persistSave(s);
    const m = await manifest();
    expect(Object.keys(m.parts).some((n) => n.startsWith('jr/'))).toBe(true);
    const h2h = Object.keys(m.parts).find((n) => n.startsWith('pop/h2h/'))!;
    const rec = await idb.get<{ v: ArrayBuffer }>('parts', m.parts[h2h].key);
    new Int32Array(rec!.v)[3] += 1;
    await idb.put('parts', m.parts[h2h].key, rec);
    reopen();
    const r = await quiet(loadSave);
    expect(r.recovered).toBe(true);
    expect(r.error).toMatch(/Repaired 1 damaged competitor record/);
    const lo = Number(h2h.split('/')[2]) * 1024;
    for (const c of r.save!.world.competitors) {
      const n = Number(c.id.slice(1));
      const want = n >= lo && n < lo + 1024 ? atBackup.world.competitors.find((x) => x.id === c.id)?.h2h : s.world.competitors.find((x) => x.id === c.id)!.h2h;
      if (want) expect(c.h2h).toEqual(want);
    }
    expect(r.save!.world.day).toBe(s.world.day);
  }, 60_000);

  it('a mutation during a sliced preparation restarts it, so the commit is one consistent moment', async () => {
    persistTuning.sliceMs = 0.01; // yield after every step
    const s = smallSave();
    await persistSave(s);
    advanceWorld(s.world, 1, hooksFor(s));
    const r0 = persistStats.restarts;
    const p = persistSave(s);
    // While it is preparing: a UI mutation (noted) ...
    await new Promise((r) => setTimeout(r, 0));
    s.player.name = 'Mid-commit';
    noteMutation();
    await new Promise((r) => setTimeout(r, 0));
    // ... and an unnoted world change, caught by the probe.
    advanceWorld(s.world, 1, hooksFor(s));
    await p;
    await whenSaved();
    expect(persistStats.restarts).toBeGreaterThan(r0);
    const want = canonicalJson(s);
    reopen();
    expect(canonicalJson((await loadSave()).save)).toBe(want);
  }, 60_000);

  it('v3 backups are parts snapshots: verified, restorable, and damage is detected', async () => {
    const s = smallSave();
    await persistSave(s, { backup: true });
    await whenSaved();
    const b = await idb.get<{ v: number; data: ArrayBuffer; enc: string; season: number; games: number }>('backups', 'slot0');
    expect(b!.v).toBe(3);
    expect(b!.enc).toBe('gzip');
    expect(b!.season).toBe(s.world.season);
    expect((await listBackups())[0].ok).toBe(true);
    const want = canonicalJson(s);
    s.player.name = 'Changed';
    await persistSave(s);
    const restored = await restoreBackup('slot0');
    expect(canonicalJson(restored)).toBe(want);
    reopen();
    expect(canonicalJson((await loadSave()).save)).toBe(want);
    // Damage
    const bad = { ...b!, data: b!.data.slice(0) };
    new Uint8Array(bad.data)[40] ^= 0xff;
    await idb.put('backups', 'slot1', { ...bad, savedAt: new Date(Date.now() + 1000).toISOString() });
    const list = await listBackups();
    expect(list.find((x) => x.key === 'slot1')!.ok).toBe(false);
    expect(list.find((x) => x.key === 'slot0')!.ok).toBe(true);
  }, 60_000);

  it('export is built from the committed parts and equals the live save', async () => {
    const s = smallSave();
    advanceWorld(s.world, 3, hooksFor(s));
    const text = await exportAll(s);
    const f = JSON.parse(text);
    expect(f.format).toBe('gladius-backup');
    expect(f.version).toBe(2);
    expect(canonicalJson(parseImport(text).save)).toBe(canonicalJson(s));
  }, 60_000);
});
