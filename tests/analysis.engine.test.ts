import { describe, it, expect, afterAll } from 'vitest';
import { nodeEngine } from './helpers/nodeEngine';
import { analyseGame } from '../src/analysis/analyzer';
import { importPgn } from '../src/chess/rules';
import { validSolution } from '../src/chess/puzzles';
import { ANALYSIS_VERSION } from '../src/analysis/types';
import { Chess } from 'chess.js';
import { evaluatePosition } from '../src/analysis/explore';

const eng = nodeEngine('lite-single', { process: true });
afterAll(() => eng.terminate());

// Blackburne Shilling trap: White's 4.Nxe5? and 5.Nxf7?? are real, punishable mistakes.
const SHILLING = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3# 0-1';
// Morphy – Duke of Brunswick & Count Isouard, Paris 1858 (the Opera Game).
const OPERA = '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';

describe('analyser with Stockfish (MultiPV 3)', () => {
  it('analyses a trap game: classes, alternatives, phases, verified puzzles', async () => {
    const g = importPgn(SHILLING);
    const a = (await analyseGame(eng, g.moves, g.startFen, { depth: 10, trainSide: 'w' }))!;
    expect(a.version).toBe(ANALYSIS_VERSION);
    expect(a.moves).toHaveLength(g.moves.length);
    expect(a.moves.every((m) => (m.alts?.length ?? 0) >= 1 && (m.alts?.length ?? 0) <= 3)).toBe(true);
    expect(a.moves.every((m) => !!m.phase)).toBe(true);
    const white = a.moves.filter((_, i) => i % 2 === 0);
    expect(white.some((m) => m.cls === 'mistake' || m.cls === 'blunder' || m.cls === 'miss')).toBe(true);
    expect(a.accuracy.b).toBeGreaterThan(a.accuracy.w);
    for (const p of a.puzzles ?? []) {
      expect(validSolution(p.fen, p.line)).toBe(true);
      expect(p.margin).toBeGreaterThanOrEqual(10);
      expect(p.fen.split(' ')[1]).toBe('w');
    }
    expect((a.puzzles ?? []).length).toBeGreaterThan(0);
  }, 120000);

  it('Opera Game: few brilliancies, decisive finish recognised', async () => {
    const g = importPgn(OPERA);
    const a = (await analyseGame(eng, g.moves, g.startFen, { depth: 10 }))!;
    const qb8 = a.moves[30];
    expect(qb8.san).toBe('Qb8+');
    expect(['brilliant', 'best', 'great']).toContain(qb8.cls);
    const brill = a.moves.filter((m) => m.cls === 'brilliant').length;
    expect(brill).toBeLessThanOrEqual(3);
    expect(a.accuracy.w).toBeGreaterThan(a.accuracy.b);
    expect(a.opening?.name).toMatch(/Philidor/);
  }, 120000);

  it('eval signs are White POV; mates carry the right sign', async () => {
    const g = importPgn(SHILLING);
    const a = (await analyseGame(eng, g.moves, g.startFen, { depth: 8 }))!;
    const last = a.moves[a.moves.length - 1]; // ...Nf3# by Black
    expect(last.evalAfter.mate).toBeLessThan(0);
    expect(a.moves[a.moves.length - 2].evalAfter.mate).toBeLessThan(0); // Be2 allows mate: negative for White
    const e = await evaluatePosition(eng, '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 8);
    expect(e.eval.mate).toBe(1);
    const e2 = await evaluatePosition(eng, '6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1', 8);
    expect((e2.eval.cp ?? 0) > 0 || (e2.eval.mate ?? 0) > 0).toBe(true); // White still better with Black to move
  }, 120000);

  it('is reproducible at a fixed depth', async () => {
    const g = importPgn(OPERA);
    const a1 = (await analyseGame(eng, g.moves.slice(0, 20), g.startFen, { depth: 9 }))!;
    const a2 = (await analyseGame(eng, g.moves.slice(0, 20), g.startFen, { depth: 9 }))!;
    expect(a2.accuracy).toEqual(a1.accuracy);
    expect(a2.moves.map((m) => m.cls)).toEqual(a1.moves.map((m) => m.cls));
  }, 120000);

  it('alternative lines are legal from the position before each move', async () => {
    const g = importPgn(OPERA);
    const a = (await analyseGame(eng, g.moves.slice(0, 16), g.startFen, { depth: 8 }))!;
    const c = new Chess();
    a.moves.forEach((m, i) => {
      for (const alt of m.alts ?? []) {
        const t = new Chess(c.fen());
        for (const san of alt.line) expect(() => t.move(san)).not.toThrow();
      }
      c.move({ from: g.moves[i].slice(0, 2), to: g.moves[i].slice(2, 4) });
    });
  }, 120000);

  it('can be cancelled mid-game (nothing returned)', async () => {
    const g = importPgn(OPERA);
    const sig = { cancelled: false };
    const r = await analyseGame(eng, g.moves, g.startFen, { depth: 8, signal: sig, onProgress: (d) => { if (d === 5) sig.cancelled = true; } });
    expect(r).toBeNull();
  }, 120000);
});
