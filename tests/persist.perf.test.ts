import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeAll } from 'vitest';
import { wrap, persistSave, loadSave, resetPersistState, whenSaved, persistStats, exportAll } from '../src/persist/save';
import { idb, resetDbHandle } from '../src/persist/db';
import { splitSave, sizeOf } from '../src/persist/layout';
import { makeBackup } from '../src/persist/backup';
import { createWorld, advanceWorld } from '../src/world/world';
import { newSave, startGame, suggestOpponents, finishPlayerGame } from '../src/game/career';
import type { Save, GameRecord } from '../src/game/state';

/**
 * Measurements for docs/PERSISTENCE.md on a realistic world (8 burn-in
 * seasons + 3 more). fake-indexeddb is an in-memory JS implementation, so
 * "IDB ms" is only a rough proxy; "prep ms" (diff + serialisation on the main
 * thread) is the number that matters for jank.
 */
function freshDb() {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDbHandle();
  resetPersistState();
}
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const max = (xs: number[]) => Math.max(...xs);
const kb = (chars: number) => Math.round(chars / 1024);

let s: Save;
beforeAll(() => {
  const w = createWorld(4242);
  s = newSave(w, 'Bench', false);
  advanceWorld(s.world, 28 * 3, null);
}, 120_000);

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
    const total = JSON.stringify(s).length;
    log(`Save JSON: ${kb(total)} KB, competitors ${s.world.competitors.length}, tournaments ${s.world.tournaments.length}, history ${s.world.history.length}`);

    // Part sizes.
    const { parts } = splitSave(s, { verifyAll: true });
    const fam: Record<string, { n: number; chars: number }> = {};
    for (const [k, d] of parts) {
      const f = k.startsWith('tour/') && k !== 'tour/index' ? 'tour/<id>' : k.startsWith('wa/') ? k.replace(/\/[^/]+$/, k.endsWith('/index') ? '/index' : '/<n>') : k.split('/').slice(0, 2).join('/');
      fam[f] ??= { n: 0, chars: 0 };
      fam[f].n++;
      fam[f].chars += d.k === 'json' ? d.s.length : sizeOf(d);
    }
    log('Parts (count, KB):');
    for (const [k, v] of Object.entries(fam)) log(`  ${k.padEnd(12)} ${String(v.n).padStart(4)}  ${String(kb(v.chars)).padStart(6)}`);
    log(`  total parts ${parts.size}`);

    // Split cost.
    const splitMs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      splitSave(s, { verifyAll: true });
      splitMs.push(performance.now() - t);
    }
    log(`Full split (verify pass, all chunks): median ${med(splitMs).toFixed(1)} ms`);

    // v1 baseline: one document per save.
    const v1: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      await idb.put('kv', 'bench-v1', wrap(s));
      v1.push(performance.now() - t);
    }
    await idb.del('kv', 'bench-v1');
    log(`v1 baseline (wrap + put whole document): median ${med(v1).toFixed(1)} ms, ${kb(total)} KB per save`);

    // First commit (everything).
    let t = performance.now();
    await persistSave(s);
    log(`Initial full commit: ${(performance.now() - t).toFixed(1)} ms wall, prep ${persistStats.last!.prepMs.toFixed(1)} ms, ${kb(persistStats.last!.bytes / 2)} KB`);

    // Load.
    resetDbHandle();
    resetPersistState();
    t = performance.now();
    const r = await loadSave();
    log(`Load (read + verify + assemble): ${(performance.now() - t).toFixed(1)} ms`);
    expect(r.save).toEqual(s);
    s = r.save!;
    await persistSave(s); // first commit after load = verification pass
    log(`First commit after load: prep ${persistStats.last!.prepMs.toFixed(1)} ms, wrote ${persistStats.last!.written.join(',')}`);

    // In-game moves.
    const opp = suggestOpponents(s)[0].c;
    startGame(s, opp, { kind: 'ranked', tcId: 'rapid-10' });
    await persistSave(s);
    const movePrep: number[] = [];
    const moveWall: number[] = [];
    const moveBytes: number[] = [];
    const fullInGame: number[] = [];
    for (let i = 0; i < 40; i++) {
      s.active!.record.moves.push('e2e4');
      s.active!.record.san.push('e4');
      s.active!.lastTick = i;
      t = performance.now();
      await persistSave(s);
      if (persistStats.last!.mode !== 'light') {
        fullInGame.push(persistStats.last!.prepMs);
        continue;
      }
      moveWall.push(performance.now() - t);
      movePrep.push(persistStats.last!.prepMs);
      moveBytes.push(persistStats.last!.bytes);
    }
    log(`Move save (light): prep median ${med(movePrep).toFixed(2)} ms / max ${max(movePrep).toFixed(2)} ms, wall median ${med(moveWall).toFixed(2)} ms, ${kb(med(moveBytes) / 2)} KB written (meta+active+manifest record)`);
    if (fullInGame.length) log(`  in-game safety full commit (after 50 light commits or 30 s): prep ${fullInGame.map((x) => x.toFixed(1)).join(', ')} ms`);
    s.active = null;
    await persistSave(s);

    // Finished games (each advances the world a day).
    const gamePrep: number[] = [];
    const gameWall: number[] = [];
    const gameBytes: number[] = [];
    const gameCpu: number[] = [];
    let seasonBytes = 0;
    for (let g = 0; g < 30; g++) {
      const season = s.world.season;
      playGame(s, (['1-0', '0-1', '1/2-1/2'] as const)[g % 3]);
      const cpu0 = process.cpuUsage();
      t = performance.now();
      await persistSave(s);
      const wall = performance.now() - t;
      const cpu = process.cpuUsage(cpu0);
      gameCpu.push((cpu.user + cpu.system) / 1000);
      const L = persistStats.last!;
      if (s.world.season !== season) seasonBytes = L.bytes;
      if (s.world.season !== season) log(`  season-boundary commit: prep ${L.prepMs.toFixed(1)} ms`);
      gamePrep.push(L.prepMs);
      gameWall.push(wall);
      gameBytes.push(L.bytes);
    }
    log(`Post-game save: prep median ${med(gamePrep).toFixed(1)} ms / max ${max(gamePrep).toFixed(1)} ms, wall median ${med(gameWall).toFixed(1)} ms, process CPU median ${med(gameCpu).toFixed(1)} ms, written median ${kb(med(gameBytes) / 2)} KB (vs ${kb(JSON.stringify(s).length)} KB whole)`);
    if (seasonBytes) log(`  season-boundary commit wrote ${kb(seasonBytes / 2)} KB`);

    // Backup snapshot.
    t = performance.now();
    const b = await makeBackup(s);
    log(`Backup snapshot: ${(performance.now() - t).toFixed(0)} ms, ${kb(b.bytes)} KB JSON -> ${kb(typeof b.data === 'string' ? b.data.length : b.data.byteLength)} KB ${b.enc}`);
    const ex = await exportAll(s);
    log(`Export file: ${kb(ex.length)} KB`);

    // Migration from a schema-1 document.
    freshDb();
    await idb.put('kv', 'save', wrap(s));
    t = performance.now();
    const m = await loadSave();
    log(`Migration v1 -> split (incl. verification read-back): ${(performance.now() - t).toFixed(0)} ms`);
    expect(m.save).toEqual(s);
    await whenSaved();

    console.log('\n' + out.join('\n'));
    // Budgets (generous for CI variance; typical numbers are far lower — see the printout).
    expect(med(movePrep)).toBeLessThan(5);
    expect(med(gamePrep)).toBeLessThan(300); // v0.3 (25k competitors): ~80–140 ms on a loaded 4-vCPU box; see docs/PERSISTENCE.md
    expect(med(gameBytes)).toBeLessThan(0.25 * JSON.stringify(s).length * 2);
  }, 180_000);
});
