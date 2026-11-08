import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { loadSave, persistSave, whenSaved, resetPersistState, listBackups, restoreBackup, parseImport, importAll, exportAll, getGame, type Manifest } from '../src/persist/save';
import { idb, resetDbHandle } from '../src/persist/db';
import { canonicalJson } from '../src/persist/layout';
import { LAYOUT_V4 } from '../src/persist/layout4';
import { advanceWorld } from '../src/world/world';
import { hooksFor } from '../src/game/career';
import type { Save } from '../src/game/state';

/**
 * Layout v3 (GLADIUS v0.3) → v4 (v0.4). tests/fixtures/v03-layout.json.gz is a
 * genuine IndexedDB dump written by the v0.3 persistence code (createWorld(303,
 * 2 seasons, 400 competitors) + 20 days + 14 player games + a game in progress):
 * every `parts` record (manifest with sizes.v = 3, JSON cold / rh / warm chunks,
 * binary h2h and positional hot columns), a v0.3 rolling backup (format 2, gzip
 * JSON), the game records and a v0.3 export file.
 */
type Dump = { parts: [string, unknown][]; backups: [string, unknown][]; games: [string, unknown][]; exportText: string };
const revive = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.$ab === 'string') {
      const b = Buffer.from(o.$ab, 'base64');
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, revive(x)]));
  }
  return v;
};
const dump: Dump = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v03-layout.json.gz', import.meta.url))).toString('utf8'));
/** The save exactly as v0.3 had it in memory when it wrote the fixture. */
const expected = (): Save => JSON.parse(dump.exportText).save;

async function installV03() {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDbHandle();
  resetPersistState();
  for (const [k, v] of dump.parts) await idb.put('parts', k, revive(v));
  for (const [k, v] of dump.backups) await idb.put('backups', k, revive(v));
  for (const [k, v] of dump.games) await idb.put('games', k, revive(v));
}
function reopen() {
  resetDbHandle();
  resetPersistState();
}
async function manifest(): Promise<Manifest> {
  return JSON.parse((await idb.get<{ s: string }>('parts', 'manifest'))!.s);
}

beforeEach(installV03);

describe('layout v3 (v0.3) → v4 (v0.4)', () => {
  it('the fixture really is a v0.3 layout', async () => {
    const m = await manifest();
    expect(m.sizes.v).toBe(3);
    expect(Object.keys(m.parts).some((n) => n.startsWith('pop/h2h/'))).toBe(true);
    expect(Object.keys(m.parts).some((n) => n.startsWith('jr/'))).toBe(false);
    expect(expected().world.competitors.length).toBeGreaterThan(400);
    expect(expected().active).not.toBeNull();
  });

  it('loads exactly, then the first commit rewrites it in layout v4 and old keys are collected', async () => {
    const r = await loadSave();
    expect(r.recovered).toBe(false);
    expect(canonicalJson(r.save)).toBe(canonicalJson(expected()));
    await persistSave(r.save!, { full: true });
    await whenSaved();
    const m = await manifest();
    expect(m.sizes.v).toBe(LAYOUT_V4);
    const keys = (await idb.keys('parts')) as string[];
    expect(keys.length).toBe(Object.keys(m.parts).length + 1); // no v0.3 orphans
    expect(keys.every((k) => k === 'manifest' || Object.values(m.parts).some((p) => p.key === k))).toBe(true);
    reopen();
    const r2 = await loadSave();
    expect(r2.recovered).toBe(false);
    expect(canonicalJson(r2.save)).toBe(canonicalJson(r.save));
    expect(r2.save).toEqual(r.save);
  });

  it('a crash during the first v4 commit leaves the v0.3 save loadable', async () => {
    const { dbFaults } = await import('../src/persist/db');
    const r = await loadSave();
    dbFaults.abortAfterPuts = 5;
    dbFaults.crash = true;
    const err = console.error;
    console.error = () => {};
    await persistSave(r.save!, { full: true });
    await whenSaved();
    console.error = err;
    dbFaults.crash = dbFaults.dead = false;
    expect((await manifest()).sizes.v).toBe(3);
    reopen();
    const r2 = await loadSave();
    expect(r2.recovered).toBe(false);
    expect(canonicalJson(r2.save)).toBe(canonicalJson(expected()));
  });

  it('the career continues in v4: days pass, journals are written and it reloads exactly', async () => {
    const s = (await loadSave()).save!;
    await persistSave(s, { full: true });
    await whenSaved();
    s.active = null;
    for (let d = 0; d < 5; d++) {
      advanceWorld(s.world, 1, hooksFor(s));
      await persistSave(s);
      await whenSaved();
    }
    const m = await manifest();
    expect(Object.keys(m.parts).filter((n) => n.startsWith('jr/')).length).toBeGreaterThan(0);
    reopen();
    expect(canonicalJson((await loadSave()).save)).toBe(canonicalJson(s));
  });

  it('the v0.3 rolling backup (format 2) is still listed, verified and restorable', async () => {
    const list = await listBackups();
    expect(list.length).toBe(1);
    expect(list[0].ok).toBe(true);
    const b = await restoreBackup(list[0].key);
    expect(b.player.name).toBe('Fixture');
    reopen();
    const r = await loadSave();
    expect((await manifest()).sizes.v).toBe(LAYOUT_V4);
    expect(canonicalJson(r.save)).toBe(canonicalJson(b));
  });

  it('a v0.3 export file still imports, and a v0.4 export of it imports back to the same save', async () => {
    const parsed = parseImport(dump.exportText);
    expect(canonicalJson(parsed.save)).toBe(canonicalJson(expected()));
    const s = await importAll(dump.exportText);
    expect(await getGame(dump.games[0][0])).toBeDefined();
    reopen();
    const r = await loadSave();
    expect(canonicalJson(r.save)).toBe(canonicalJson(expected()));
    const again = await exportAll(r.save!);
    expect(canonicalJson(parseImport(again).save)).toBe(canonicalJson(r.save));
    expect(parseImport(again).games.length).toBe(dump.games.length);
    expect(s.player.name).toBe('Fixture');
  });
});
