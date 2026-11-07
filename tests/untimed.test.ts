import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { emptyWorld } from '../src/world/world';
import { newSave, startGame, suggestOpponents, finishPlayerGame } from '../src/game/career';
import { CLOCKS_ENABLED, TIME_CONTROLS, DEFAULT_SETTINGS } from '../src/game/state';
import { persistSave, loadSave } from '../src/persist/save';
import { ChessGame } from '../src/chess/rules';

function save() {
  const w = emptyWorld(7);
  w.competitors = w.competitors.slice(0, 400);
  return newSave(w, 'Patient', false);
}

describe('untimed chess (default for every mode)', () => {
  it('clocks are disabled and the default control is untimed', () => {
    expect(CLOCKS_ENABLED).toBe(false);
    expect(DEFAULT_SETTINGS.defaultTc).toBe('untimed');
    expect(DEFAULT_SETTINGS.animSpeed).toBe('majestic');
  });
  it('every game kind starts untimed, even if a timed control is requested', () => {
    const s = save();
    const opp = suggestOpponents(s)[0].c;
    for (const kind of ['ranked', 'challenge', 'rivalry', 'trial', 'tournament', 'casual'] as const) {
      for (const tc of TIME_CONTROLS) {
        const rec = startGame(s, opp, { kind, tcId: tc.id });
        expect(rec.tc).toBe('untimed');
        expect(s.active!.clockMs).toEqual({ w: 0, b: 0 });
        if (kind !== 'casual') expect(rec.rated).toBe(true);
      }
    }
  });
  it('a position left untouched indefinitely is saved and resumed without any time forfeit', async () => {
    const s = save();
    const opp = suggestOpponents(s)[0].c;
    const rec = startGame(s, opp, { kind: 'ranked', tcId: 'blitz-5' });
    rec.moves = ['e2e4', 'e7e5', 'g1f3'];
    await persistSave(s, { full: true } as never);
    // A month passes on the wall clock.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 30 * 24 * 3600 * 1000);
    const r = await loadSave();
    vi.useRealTimers();
    expect(r.save?.active?.record.moves).toEqual(['e2e4', 'e7e5', 'g1f3']);
    expect(r.save?.active?.record.result).toBe('*');
    const g = ChessGame.fromUci(r.save!.active!.record.moves);
    expect(g.status().over).toBe(false); // still the player's game to continue — no forfeit
    // Finishing later is scored normally.
    const done = { ...r.save!.active!.record, result: '1/2-1/2' as const, termination: 'agreement' as const };
    r.save!.active = null;
    const pg = finishPlayerGame(r.save!, done);
    expect(pg.outcome).toBe('draw');
  });
});
