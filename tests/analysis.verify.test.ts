import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import { Chess } from 'chess.js';
import { nodeEngine } from './helpers/nodeEngine';
import { analyseGame, deepenMove } from '../src/analysis/analyzer';
import { importPgn, START_FEN } from '../src/chess/rules';
import { annotatedPgn } from '../src/analysis/report';
import { CONF } from '../src/analysis/confidence';
import type { GameAnalysisX } from '../src/analysis/types';
import type { UciEngine } from '../src/engine/uci';
import type { GameRecord } from '../src/game/state';

// The queue asks browserEngine for the analysis engine: hand it the real lite engine.
const h = vi.hoisted(() => ({ eng: null as unknown as UciEngine }));
vi.mock('../src/engine/browserEngine', () => ({
  getEngine: () => h.eng,
  recommendedAnalysisDepth: () => 11,
  activeEngineInfo: () => ({ label: 'Stockfish 19 Lite (test)', fullStrength: false }),
}));

const eng = nodeEngine('lite-single', { process: true });
h.eng = eng;
afterAll(() => eng.terminate());

// Morphy – Duke of Brunswick & Count Isouard, Paris 1858. 15.Bxd7+ (ply 28) wins: 15...Nxd7 16.Qb8+!! Nxb8 17.Rd8#.
const OPERA = '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';
const SHILLING = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3# 0-1';
const BXD7 = 28;
const g = importPgn(OPERA);
let shallow: GameAnalysisX;

beforeAll(async () => {
  shallow = (await analyseGame(eng, g.moves, g.startFen, { depth: 11, verify: false }))!;
}, 120000);

describe('verification pass (lite engine, depth 11)', () => {
  it('without verification the horizon makes 15.Bxd7+ a "blunder" (the v0.3 bug)', () => {
    const m = shallow.moves[BXD7];
    expect(m.san).toBe('Bxd7+');
    expect(m.cls).toBe('blunder');
    expect(m.conf).not.toBe('high'); // even unverified it is not presented as certain
    expect(m.verified).toBeUndefined();
  });

  it('with verification 15.Bxd7+ is the best move, high confidence, decided deeper', async () => {
    const t0 = Date.now();
    const a = (await analyseGame(eng, g.moves, g.startFen, { depth: 11, engineLabel: 'test engine' }))!;
    const m = a.moves[BXD7];
    expect(['best', 'great', 'brilliant', 'excellent']).toContain(m.cls);
    expect(m.conf).toBe('high');
    expect(m.verified).toMatchObject({ by: 'auto', from: 'blunder', engine: 'test engine' });
    expect(m.verified!.depth).toBeGreaterThan(11);
    expect(m.depth).toBe(m.verified!.depth);
    expect(m.nodes).toBeGreaterThan(shallow.moves[BXD7].nodes!);
    expect(a.moves[30]).toMatchObject({ san: 'Qb8+', cls: 'brilliant', conf: 'high' });
    expect(a.critical).not.toContain(BXD7);
    expect(a.accuracy.w).toBeGreaterThan(shallow.accuracy.w);
    expect(a.verification!.maxDepth).toBeLessThanOrEqual(Math.min(11 + 12, CONF.maxVerifyDepth));
    // every claim is either verified or flagged; nothing unverified is presented as certain
    for (const x of a.moves) if (['brilliant', 'great', 'mistake', 'blunder', 'miss'].includes(x.cls)) expect(!!x.verified || x.conf !== 'high').toBe(true);
    const pgn = annotatedPgn({ ...fakeRecord(), analysis: a });
    expect(pgn).toMatch(/15\. Bxd7\+\s+\{\[%eval [\d.]+\] Best\. A shallower search had called it blunder\. \(depth \d+, verified,/);
    expect(pgn).not.toMatch(/Bxd7\+ \$4/);
    expect(Date.now() - t0).toBeLessThan(120000);
  }, 180000);

  it('is reproducible (verification included)', async () => {
    const s = importPgn(SHILLING);
    const a1 = (await analyseGame(eng, s.moves, s.startFen, { depth: 9 }))!;
    const a2 = (await analyseGame(eng, s.moves, s.startFen, { depth: 9 }))!;
    expect(a2.accuracy).toEqual(a1.accuracy);
    const key = (a: GameAnalysisX) => a.moves.map((m) => [m.cls, m.conf, m.depth, m.verified?.depth ?? null, m.winLoss]);
    expect(key(a2)).toEqual(key(a1));
    expect(a1.verification!.moves).toBeGreaterThan(0);
  }, 120000);
});

describe('player-requested deeper analysis', () => {
  it('re-searches one move, updates the class with provenance, refreshes the summary', async () => {
    const a = await deepenMove(eng, { startFen: g.startFen, moves: g.moves, analysis: shallow }, BXD7, { now: 1234, engineLabel: 'test engine' });
    const m = a.moves[BXD7];
    expect(['best', 'great', 'brilliant', 'excellent']).toContain(m.cls);
    expect(m.verified).toMatchObject({ by: 'user', from: 'blunder', at: 1234, engine: 'test engine' });
    expect(m.verified!.depth).toBeGreaterThanOrEqual(19);
    expect(a.accuracy.w).toBeGreaterThan(shallow.accuracy.w);
    expect(a.counts.w.blunder ?? 0).toBeLessThan(shallow.counts.w.blunder ?? 0);
    // moves that do not depend on the re-searched positions are untouched
    for (let k = 0; k < BXD7 - 1; k++) expect(a.moves[k]).toEqual(shallow.moves[k]);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a); // plain JSON: persists as-is
  }, 120000);

  it('can be cancelled (the search is stopped, the promise rejects)', async () => {
    const ctl = new AbortController();
    const p = deepenMove(eng, { startFen: g.startFen, moves: g.moves, analysis: shallow }, BXD7, { signal: ctl.signal, depth: 26 });
    setTimeout(() => ctl.abort(), 50);
    await expect(p).rejects.toThrow();
  }, 60000);

  it('queue: stored with the game, refused while a game is in progress', async () => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    const { resetDbHandle } = await import('../src/persist/db');
    const { resetPersistState, getGame, storeGame } = await import('../src/persist/save');
    resetDbHandle();
    resetPersistState();
    const { setSave, getSave } = await import('../src/ui/store');
    const { emptyWorld } = await import('../src/world/world');
    const { newSave } = await import('../src/game/career');
    const q = await import('../src/ui/analysisQueue');
    setSave(newSave(emptyWorld(3), 'Tester', false));
    const rec: GameRecord = { ...fakeRecord(), analysis: shallow };
    await storeGame(rec);

    // integrity: refused while any game is in progress
    getSave().active = { record: { id: 'live', result: '*', rated: false, startFen: START_FEN, moves: [] } } as never;
    expect(await q.requestDeeperAnalysis(rec.id, BXD7)).toMatch(/in progress/);
    getSave().active = null;

    const states: string[] = [];
    const done = new Promise<GameRecord>((res, rej) =>
      q.onDeeperAnalysis((id, ply, st, info) => {
        if (id !== rec.id || ply !== BXD7) return;
        states.push(st);
        if (st === 'done') res(info!.record!);
        if (st === 'failed') rej(new Error(info?.error));
      }),
    );
    expect(await q.requestDeeperAnalysis(rec.id, BXD7)).toBeNull();
    expect(q.deepStatus(rec.id, BXD7)).not.toBeNull();
    await done;
    expect(states).toEqual(['queued', 'running', 'done']);
    resetDbHandle(); // reopen: read back from storage
    const back = (await getGame(rec.id))!;
    const m = (back.analysis as GameAnalysisX).moves[BXD7];
    expect(m.verified).toMatchObject({ by: 'user', from: 'blunder', engine: 'Stockfish 19 Lite (test)' });
    expect(m.cls).not.toBe('blunder');
    expect(getSave().libraryMeta[rec.id]?.accuracy).toBe(back.analysis!.accuracy.w);
  }, 120000);
});

function sans(): string[] {
  const c = new Chess();
  return g.moves.map((u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4) }).san);
}
function fakeRecord(): GameRecord {
  return {
    id: 'opera', kind: 'casual', rated: false, pool: 'untimed', tc: 'untimed', day: 1, date: '2026-05-01T10:00:00Z', arena: 0, source: 'player',
    white: { id: 'p', name: 'Morphy', rating: 2600, rank: 0 }, black: { id: 'o', name: 'Allies', rating: 1800, rank: 0 },
    playerColor: 'w', startFen: g.startFen, moves: g.moves, san: sans(), result: '1-0', termination: 'checkmate',
  };
}
