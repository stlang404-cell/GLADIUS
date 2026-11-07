import { describe, it, expect, afterAll } from 'vitest';
import { nodeEngine } from './helpers/nodeEngine';
import { parseInfo, winPercent } from '../src/engine/uci';
import { ChessGame, START_FEN } from '../src/chess/rules';

const eng = nodeEngine();
afterAll(() => eng.terminate());

describe('UCI parsing', () => {
  it('parses info lines', () => {
    const l = parseInfo('info depth 12 seldepth 18 multipv 2 score cp -34 nodes 12000 nps 1 pv e7e5 g1f3');
    expect(l).toEqual({ depth: 12, multipv: 2, score: { cp: -34 }, pv: ['e7e5', 'g1f3'], nodes: 12000 });
    expect(parseInfo('info depth 5 score mate 3 pv a1a8')!.score.mate).toBe(3);
    expect(parseInfo('info string hello')).toBeNull();
  });
  it('win percent is monotone and symmetric', () => {
    expect(winPercent({ cp: 0 })).toBeCloseTo(50);
    expect(winPercent({ cp: 300 })).toBeGreaterThan(70);
    expect(winPercent({ cp: 300 }) + winPercent({ cp: -300 })).toBeCloseTo(100);
    expect(winPercent({ mate: 2 })).toBe(100);
  });
});

describe('Stockfish integration', () => {
  it('returns a legal best move', async () => {
    const r = await eng.search({ fen: START_FEN, depth: 10 });
    expect(r.bestmove).toBeTruthy();
    expect(new ChessGame().isLegal(r.bestmove!)).toBe(true);
  });
  it('finds mate in one', async () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    const r = await eng.search({ fen, depth: 8 });
    expect(r.bestmove).toBe('a1a8');
    expect(r.lines[0].score.mate).toBe(1);
  });
  it('multipv returns ranked lines', async () => {
    const r = await eng.search({ fen: START_FEN, depth: 8, multipv: 4 });
    expect(r.lines.length).toBe(4);
    expect(new Set(r.lines.map((l) => l.pv[0])).size).toBe(4);
  });
  it('search can be cancelled', async () => {
    const t0 = Date.now();
    const p = eng.search({ fen: START_FEN, movetime: 20000 });
    setTimeout(() => eng.stop(), 200);
    const r = await p;
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(r.bestmove).toBeTruthy();
  });
  it('handles game-over positions', async () => {
    const r = await eng.search({ fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', depth: 5 });
    expect(r.bestmove).toBeNull();
  });
});
