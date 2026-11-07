import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { wrap, unwrap, migrate, persistSave, loadSave, exportAll, parseImport, storeGame, getGame } from '../src/persist/save';
import { idb } from '../src/persist/db';
import { emptyWorld } from '../src/world/world';
import { newSave, startGame, suggestOpponents } from '../src/game/career';
import { SAVE_SCHEMA } from '../src/game/state';

function smallSave() {
  const w = emptyWorld(99);
  w.competitors = w.competitors.slice(0, 300);
  return newSave(w, 'Tester', false);
}

describe('persistence', () => {
  it('checksummed envelope round-trips and detects corruption', () => {
    const s = smallSave();
    const env = wrap(s);
    expect(unwrap(env).player.name).toBe('Tester');
    const bad = { ...env, data: env.data.replace('Tester', 'Hacker') };
    expect(() => unwrap(bad)).toThrow(/integrity/);
  });
  it('migrates schema 0 saves', () => {
    const s = smallSave() as unknown as Record<string, unknown>;
    const old = { ...s, schema: 0 } as Record<string, unknown>;
    delete old.settings;
    delete old.coach;
    const m = migrate(old);
    expect(m.schema).toBe(SAVE_SCHEMA);
    expect(m.settings.boardMode).toBe('2d');
    expect(m.settings.defaultTc).toBe('untimed');
    expect(m.coach.positions).toEqual([]);
    expect(() => migrate({ ...s, schema: 999 })).toThrow(/newer/);
  });
  it('saves, reloads, recovers from a damaged main save via backup', async () => {
    const s = smallSave();
    await persistSave(s, { backup: true });
    const r = await loadSave();
    expect(r.save?.player.name).toBe('Tester');
    expect(r.recovered).toBe(false);
    const env = await idb.get<{ data: string; checksum: number }>('kv', 'save');
    await idb.put('kv', 'save', { ...env!, checksum: 1 });
    const r2 = await loadSave();
    expect(r2.recovered).toBe(true);
    expect(r2.save?.player.name).toBe('Tester');
  });
  it('interrupted game is restored from the save', async () => {
    const s = smallSave();
    const opp = suggestOpponents(s)[0].c;
    const rec = startGame(s, opp, { kind: 'ranked', tcId: 'rapid-10' });
    rec.moves = ['e2e4', 'e7e5'];
    await persistSave(s);
    const r = await loadSave();
    expect(r.save?.active?.record.moves).toEqual(['e2e4', 'e7e5']);
    expect(r.save?.active?.opponentId).toBe(opp.id);
  });
  it('export/import includes games', async () => {
    const s = smallSave();
    await storeGame({ id: 'g1', moves: ['e2e4'] } as never);
    const text = await exportAll(s);
    const back = parseImport(text);
    expect(back.save.player.name).toBe('Tester');
    expect(back.games.some((g) => g.id === 'g1')).toBe(true);
    expect((await getGame('g1'))?.moves).toEqual(['e2e4']);
    expect(() => parseImport('{"format":"other"}')).toThrow();
  });
});
