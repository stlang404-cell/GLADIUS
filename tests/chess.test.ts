import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { ChessGame, perft, importPgn, positionKey, START_FEN, validateFen } from '../src/chess/rules';

describe('perft regression', () => {
  it('start position depth 1-3', () => {
    const c = new Chess();
    expect(perft(c, 1)).toBe(20);
    expect(perft(c, 2)).toBe(400);
    expect(perft(c, 3)).toBe(8902);
  });
  it('kiwipete depth 1-3', () => {
    const c = new Chess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect(perft(c, 1)).toBe(48);
    expect(perft(c, 2)).toBe(2039);
    expect(perft(c, 3)).toBe(97862);
  });
  it('position 3 (en passant / pins) depth 4', () => {
    const c = new Chess('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect(perft(c, 4)).toBe(43238);
  });
  it('position 4 (promotions / castling) depth 3', () => {
    const c = new Chess('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect(perft(c, 3)).toBe(9467);
  });
  it('position 5 depth 3', () => {
    const c = new Chess('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8');
    expect(perft(c, 3)).toBe(62379);
  });
});

describe('special moves', () => {
  it('castling both sides', () => {
    const g = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(g.playUci('e1g1')).not.toBeNull();
    expect(g.fen().startsWith('r3k2r/8/8/8/8/8/8/R4RK1 b kq')).toBe(true);
    expect(g.playUci('e8c8')).not.toBeNull();
    expect(g.fen().startsWith('2kr3r/')).toBe(true);
  });
  it('cannot castle through check', () => {
    const g = new ChessGame('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
    expect(g.isLegal('e1g1')).toBe(false);
  });
  it('en passant', () => {
    const g = ChessGame.fromUci(['e2e4', 'a7a6', 'e4e5', 'd7d5']);
    expect(g.isLegal('e5d6')).toBe(true);
    g.playUci('e5d6');
    expect(g.fen().split(' ')[0]).toBe('rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR');
  });
  it('promotion and underpromotion', () => {
    const g = new ChessGame('8/P7/8/8/8/8/8/k6K w - - 0 1');
    expect(g.isLegal('a7a8n')).toBe(true);
    const m = g.playUci('a7a8n');
    expect(m?.promotion).toBe('n');
    expect(g.fen().startsWith('N7/')).toBe(true);
  });
});

describe('game endings', () => {
  it("fool's mate is checkmate", () => {
    const g = ChessGame.fromUci(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    const s = g.status();
    expect(s.over).toBe(true);
    expect(s.result).toBe('0-1');
    expect(s.termination).toBe('checkmate');
    expect(g.playUci('a2a3')).toBeNull();
  });
  it('stalemate', () => {
    const g = new ChessGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(g.status().termination).toBe('stalemate');
  });
  it('insufficient material', () => {
    expect(new ChessGame('8/8/8/4k3/8/8/2B5/4K3 w - - 0 1').status().termination).toBe('insufficient-material');
    expect(new ChessGame('8/8/8/4k3/8/8/2R5/4K3 w - - 0 1').status().over).toBe(false);
  });
  it('threefold repetition is claimable, fivefold automatic', () => {
    const g = new ChessGame();
    const cycle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    for (const m of cycle) g.playUci(m);
    for (const m of cycle) g.playUci(m);
    expect(g.repetitionCount()).toBe(3);
    expect(g.status().over).toBe(false);
    expect(g.status().claimable).toContain('threefold');
    for (const m of cycle) g.playUci(m);
    for (const m of cycle) g.playUci(m);
    expect(g.repetitionCount()).toBe(5);
    expect(g.status().termination).toBe('fivefold-repetition');
  });
  it('threefold claim ends game', () => {
    const g = new ChessGame();
    for (let i = 0; i < 2; i++) for (const m of ['g1f3', 'g8f6', 'f3g1', 'f6g8']) g.playUci(m);
    expect(g.claimDraw('threefold')).toBe(true);
    expect(g.status()).toMatchObject({ over: true, result: '1/2-1/2', termination: 'threefold-claim' });
  });
  it('fifty-move claim and seventy-five-move automatic', () => {
    const g50 = new ChessGame('8/8/8/4k3/8/8/2R5/4K3 w - - 100 80');
    expect(g50.status().claimable).toContain('fifty');
    expect(g50.status().over).toBe(false);
    const g75 = new ChessGame('8/8/8/4k3/8/8/2R5/4K3 w - - 150 100');
    expect(g75.status().termination).toBe('seventy-five-move');
  });
  it('checkmate on the 75th move takes precedence', () => {
    const g = new ChessGame('7k/8/6K1/8/8/8/8/R7 w - - 149 100');
    g.playUci('a1a8');
    expect(g.status().termination).toBe('checkmate');
  });
  it('flag fall vs lone king is a draw', () => {
    const g = new ChessGame('8/8/8/4k3/8/8/2Q5/4K3 b - - 0 1');
    g.flag('w');
    expect(g.status().termination).toBe('timeout-insufficient');
    const g2 = new ChessGame('8/8/8/4k3/8/8/2Q5/4K3 b - - 0 1');
    g2.flag('b');
    expect(g2.status()).toMatchObject({ result: '1-0', termination: 'timeout' });
  });
  it('resignation', () => {
    const g = new ChessGame();
    g.resign('w');
    expect(g.status().result).toBe('0-1');
  });
});

describe('PGN / FEN', () => {
  it('round-trips PGN', () => {
    const g = ChessGame.fromUci(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5']);
    const pgn = g.pgn({ White: 'A', Black: 'B' });
    const imp = importPgn(pgn);
    expect(imp.moves).toEqual(g.uciHistory);
    expect(imp.headers.White).toBe('A');
  });
  it('PGN from custom FEN', () => {
    const fen = '8/P7/8/8/8/8/8/k6K w - - 0 1';
    const g = new ChessGame(fen);
    g.playUci('a7a8q');
    const imp = importPgn(g.pgn());
    expect(imp.startFen).toBe(fen);
    expect(imp.moves).toEqual(['a7a8q']);
  });
  it('validates FEN', () => {
    expect(validateFen(START_FEN)).toBeNull();
    expect(validateFen('not a fen')).not.toBeNull();
  });
  it('position key ignores move clocks', () => {
    expect(positionKey('8/8/8/8/8/8/8/K6k w - - 3 9')).toBe(positionKey('8/8/8/8/8/8/8/K6k w - - 0 1'));
  });
});
