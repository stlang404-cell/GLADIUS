import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeAll } from 'vitest';
import { wrap, persistSave, loadSave, resetPersistState, whenSaved, persistStats, exportAll, type Manifest } from '../src/persist/save';
import { idb, resetDbHandle } from '../src/persist/db';
import { buildBackupFromDb } from '../src/persist/offload';
import { createWorld, advanceWorld } from '../src/world/world';
import { newSave, startGame, suggestOpponents, finishPlayerGame } from '../src/game/career';
import type { Save, GameRecord } from '../src/game/state';

/**
 * Measurements for docs/PERSISTENCE.md ("v0.4") on a realistic world
 * (createWorld(4242): 8 burn-in seasons + 3 more, ~26,700 competitors).
 * fake-indexeddb is an in-memory JS implementation, so wall times are only a
 * rough proxy; "prep" (main-thread work: diff, serialisation, journal) and
 * "max slice" (the longest uninterrupted piece of it) are what matter for jank.
 * The browser numbers in the docs come from headless Chromium with real
 * IndexedDB (see the doc for the method). Thresholds are deliberately generous
 * so a loaded CI box does not make this flaky.
 */
function freshDb() {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDbHandle();
  resetPersistState();
}
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const max = (xs: number[]) => Math.max(...xs);
const kb = (bytes: number) => Math.round(bytes / 1024);

let s: Save;
beforeAll(() => {
  const w = createWorld(4242);
  s = newSave(w, 'Bench', false);
  advanceWorld(s.world, 28 * 3, null);
}, 180_000);

function playGame(save: Save, result: '1-0' | '0-1' | '1/2-1/2', moves = 40) {
  const opp = suggestOpponents(save)[0].c;
  const rec = startGame(save, opp, { kind: 'ranked', tcId: 'rapid-10' });
  const done: GameRecord = { ...rec, moves: Array(moves).fill('e2e4'), san: Array(moves).fill('e4'), result, termination: 'resignation' as never };
  finishPlayerGame(save, done);
  save.active = null;
}

describe('persistence performance', () => {
  it('measures sizes and timings', async () => {
    freshDb();
    const out: string[] = [];
    const log = (x: string) => out.push(x);
    const whole = JSON.stringify(s).length;
    log(`Save JSON: ${kb(whole)} K chars, competitors ${s.world.competitors.length}, tournaments ${s.world.tournaments.length}, history ${s.world.history.length}`);

    let t = performance.now();
    await persistSave(s);
    await whenSaved();
    log(`Initial full commit: ${(performance.now() - t).toFixed(0)} ms wall, prep ${persistStats.last!.prepMs.toFixed(0)} ms (max slice ${persistStats.last!.maxSliceMs.toFixed(1)}), ${kb(persistStats.last!.bytes)} KB`);
    const family = async () => {
      const m = JSON.parse((await idb.get<{ s: string }>('parts', 'manifest'))!.s) as Manifest;
      const fam: Record<string, { n: number; bytes: number }> = {};
      for (const [k, p] of Object.entries(m.parts)) {
        const f = k.startsWith('tour/') ? 'tour' : k.startsWith('wa/') ? 'wa/' + k.split('/')[1] : k.startsWith('jr/') ? 'jr' : k.split('/').slice(0, 2).join('/');
        fam[f] ??= { n: 0, bytes: 0 };
        fam[f].n++;
        fam[f].bytes += p.n;
      }
      return { parts: Object.keys(m.parts).length, bytes: Object.values(m.parts).reduce((a, p) => a + p.n, 0), fam };
    };
    const f0 = await family();
    log(`Stored: ${f0.parts} parts, ${kb(f0.bytes)} KB (JSON counted as UTF-16, binary as bytes)`);
    for (const [k, v] of Object.entries(f0.fam).sort((a, b) => b[1].bytes - a[1].bytes)) log(`  ${k.padEnd(16)} ${String(v.n).padStart(4)}  ${String(kb(v.bytes)).padStart(6)} KB`);

    // Cold load.
    resetDbHandle();
    resetPersistState();
    t = performance.now();
    const r = await loadSave();
    log(`Load (read + verify + assemble + mirror): ${(performance.now() - t).toFixed(0)} ms`);
    expect(r.save).toEqual(s);
    s = r.save!;
    await persistSave(s);
    log(`First commit after load: prep ${persistStats.last!.prepMs.toFixed(1)} ms, wrote ${persistStats.last!.written.join(',')}`);

    // In-game moves.
    const opp = suggestOpponents(s)[0].c;
    startGame(s, opp, { kind: 'ranked', tcId: 'rapid-10' });
    await persistSave(s);
    const movePrep: number[] = [];
    for (let i = 0; i < 40; i++) {
      s.active!.record.moves.push('e2e4');
      s.active!.record.san.push('e4');
      s.active!.lastTick = i;
      await persistSave(s);
      if (persistStats.last!.mode === 'light') movePrep.push(persistStats.last!.prepMs);
    }
    log(`Move save (light): prep median ${med(movePrep).toFixed(2)} ms / max ${max(movePrep).toFixed(2)} ms`);
    s.active = null;
    await persistSave(s);

    // Finished games (each advances the world a day); one crosses a season boundary.
    const g: { prep: number; slice: number; bytes: number; season: boolean; compacted: boolean }[] = [];
    for (let i = 0; i < 30; i++) {
      const season = s.world.season;
      playGame(s, (['1-0', '0-1', '1/2-1/2'] as const)[i % 3]);
      await persistSave(s);
      await whenSaved();
      const L = persistStats.last!;
      g.push({ prep: L.prepMs, slice: L.maxSliceMs, bytes: L.bytes, season: s.world.season !== season, compacted: L.compacted });
    }
    const normal = g.filter((x) => !x.season);
    log(
      `Post-game commit: prep median ${med(normal.map((x) => x.prep)).toFixed(1)} ms (max ${max(normal.map((x) => x.prep)).toFixed(0)}), ` +
        `longest slice median ${med(normal.map((x) => x.slice)).toFixed(1)} ms (max ${max(normal.map((x) => x.slice)).toFixed(1)}), ` +
        `written median ${kb(med(normal.map((x) => x.bytes)))} KB, mean ${kb(normal.reduce((a, x) => a + x.bytes, 0) / normal.length)} KB, compactions ${normal.filter((x) => x.compacted).length}/${normal.length}`,
    );
    for (const x of g.filter((y) => y.season)) log(`  season-boundary commit: prep ${x.prep.toFixed(0)} ms, longest slice ${x.slice.toFixed(1)} ms, ${kb(x.bytes)} KB${x.compacted ? ' (compaction)' : ''}`);
    const f1 = await family();
    log(`Stored after 30 games: ${f1.parts} parts, ${kb(f1.bytes)} KB`);

    // Backup snapshot (built from the committed parts; in the browser this runs in the persistence worker).
    t = performance.now();
    const b = (await buildBackupFromDb())!;
    log(`Backup snapshot (parts container + gzip): ${(performance.now() - t).toFixed(0)} ms, ${kb(b.bytes)} KB -> ${kb(b.data.byteLength)} KB ${b.enc}`);
    t = performance.now();
    const ex = await exportAll(s);
    log(`Export file (from the committed parts): ${(performance.now() - t).toFixed(0)} ms, ${kb(ex.length)} K chars`);

    // Migration from a schema-1 document.
    freshDb();
    await idb.put('kv', 'save', wrap(s));
    t = performance.now();
    const m = await loadSave();
    log(`Migration v1 -> split (incl. verification read-back): ${(performance.now() - t).toFixed(0)} ms`);
    expect(m.save).toEqual(s);
    await whenSaved();

    console.log('\n' + out.join('\n'));
    // Budgets (generous for CI variance; typical numbers are far lower — see the printout and docs/PERSISTENCE.md).
    expect(med(movePrep)).toBeLessThan(10);
    expect(med(normal.map((x) => x.slice))).toBeLessThan(60); // v0.4: ~10–20 ms; v0.3 had one ~130 ms task
    expect(med(normal.map((x) => x.prep))).toBeLessThan(400);
    expect(med(normal.map((x) => x.bytes))).toBeLessThan(0.08 * whole * 2); // v0.4: ~2% of the save; v0.3: ~8%
  }, 300_000);
});
