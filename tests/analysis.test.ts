import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { classifyDetailed, classifyMove, isObvious, isSacrifice, moveAccuracy, verifiedSacrifice, gameAccuracy, type ClassifyInput } from '../src/analysis/classify';
import { seeGain, materialOffered, lineMaterial } from '../src/analysis/material';
import { phaseOf, phaseSeries } from '../src/analysis/phase';
import { uniqueMargin, explainMove, phaseStats } from '../src/analysis/analyzer';
import { analysisBlockReason, explorerLocked, importBlockReason, analysisComplete } from '../src/analysis/integrity';
import { gameStat, weaknessReport, progressSeries, rolling } from '../src/analysis/weakness';
import { acceptsMove, validSolution, puzzlesFromGame } from '../src/chess/puzzles';
import { endgameType, endgameVerdict, endgameFeedback, ENDGAME_GUIDE, ENDGAME_DRILLS } from '../src/chess/endgames';
import { START_FEN } from '../src/chess/rules';
import type { GameRecord, Save } from '../src/game/state';
import type { MoveAnalysisX } from '../src/analysis/types';

const base = (o: Partial<ClassifyInput>): ClassifyInput => ({
  fenBefore: START_FEN, uci: 'e2e4', bestUci: 'e2e4', winBefore: 55, winAfter: 55, secondBestWin: 53,
  legalCount: 20, inBook: false, bestWasMate: false, playedKeepsMate: false, ...o,
});

// Qg8+!! Rxg8 Nf7# — the smothered mate.
const SMOTHER = '3r3k/6pp/7N/8/2Q5/8/6PP/6K1 w - - 0 1';
const SMOTHER_LINE = ['c4g8', 'd8g8', 'h6f7'];
// Rxf7 Qxf7?? no — Rxf7 Kxf7 Ne5+ and Nxd7: the "sacrifice" is regained at once (a fork, not a sacrifice).
const FORK_REGAIN = '6k1/3q1p2/8/8/6N1/8/6PP/5RK1 w - - 0 1';
const FORK_LINE = ['f1f7', 'g8f7', 'g4e5', 'f7e7', 'e5d7'];

describe('static exchange & material', () => {
  it('SEE: undefended piece, defended piece, x-ray recapture', () => {
    // black knight on e5 undefended, attacked by white pawn d4
    expect(seeGain(new Chess('4k3/8/8/4n3/3P4/8/8/4K3 w - - 0 1'), 'e5')).toBe(3);
    // pawn takes pawn defended by pawn: +1 −1 = 0
    expect(seeGain(new Chess('4k3/8/5p2/4p3/3P4/8/8/4K3 w - - 0 1'), 'e5')).toBe(0);
    // rook takes a pawn defended by a pawn: losing, so 0 (do not capture)
    expect(seeGain(new Chess('4k3/8/5p2/4p3/8/8/8/4RK2 w - - 0 1'), 'e5')).toBe(0);
    // doubled rooks (x-ray): Rxe5 dxe5? no defender other than rook e8 -> R x R x R: white gains 1 (pawn) net with battery
    expect(seeGain(new Chess('4r1k1/8/8/4p3/8/8/4R3/4RK2 w - - 0 1'), 'e5')).toBe(1);
  });
  it('material offered: queen sacrifice vs plain capture', () => {
    expect(materialOffered(SMOTHER, 'c4g8').offered).toBeGreaterThanOrEqual(4);
    expect(isSacrifice(SMOTHER, 'c4g8')).toBe(true);
    // a quiet developing move offers nothing
    expect(materialOffered(START_FEN, 'g1f3').offered).toBe(0);
    // trading a knight for a knight is not a sacrifice
    expect(isSacrifice('4k3/8/2n5/8/3N4/8/8/4K3 w - - 0 1', 'd4c6')).toBe(false);
  });
  it('line material tracks deficits and mates', () => {
    const lm = lineMaterial(SMOTHER, SMOTHER_LINE);
    expect(lm.mates).toBe(true);
    expect(lm.deficitAfterReply).toBe(9);
    const fr = lineMaterial(FORK_REGAIN, FORK_LINE);
    expect(fr.deficitAfterReply).toBe(4);
    expect(fr.endDeficit).toBeLessThan(0);
  });
});

describe('classification thresholds (win% lost, Lichess-equivalent)', () => {
  it('maps losses to classes', () => {
    const cls = (loss: number) => classifyMove(base({ uci: 'd2d4', winBefore: 60, winAfter: 60 - loss }));
    expect(cls(1)).toBe('excellent');
    expect(cls(3)).toBe('good');
    expect(cls(7)).toBe('inaccuracy');
    expect(cls(12)).toBe('mistake');
    expect(cls(25)).toBe('blunder');
  });
  it('best, forced, book, miss', () => {
    expect(classifyMove(base({}))).toBe('best');
    expect(classifyMove(base({ legalCount: 1, uci: 'd2d4', winAfter: 10 }))).toBe('forced');
    expect(classifyMove(base({ inBook: true, uci: 'd2d4', winAfter: 52 }))).toBe('book');
    expect(classifyMove(base({ inBook: true, uci: 'd2d4', winAfter: 44 }))).toBe('mistake'); // out of tolerance: not book
    expect(classifyMove(base({ uci: 'd2d4', winBefore: 85, winAfter: 50 }))).toBe('miss');
    expect(classifyMove(base({ uci: 'd2d4', winBefore: 100, winAfter: 92, bestWasMate: true, playedKeepsMate: false }))).toBe('miss');
    // mate kept, just slower: not a miss
    expect(classifyMove(base({ uci: 'd2d4', winBefore: 100, winAfter: 100, bestWasMate: true, playedKeepsMate: true }))).toBe('excellent');
  });
  it('a MultiPV candidate within 1 win% of the top move counts as best', () => {
    expect(classifyMove(base({ uci: 'd2d4', winBefore: 55, winAfter: 54.5, playedIsTop: true }))).toBe('best');
  });
  it('accuracy formula', () => {
    expect(moveAccuracy(0)).toBe(100);
    expect(moveAccuracy(10)).toBeCloseTo(103.1668 * Math.exp(-0.4354) - 2.1669, 3);
    expect(moveAccuracy(100)).toBe(0);
    expect(gameAccuracy([50, 50, 50], [100, 100])).toBe(100);
    expect(gameAccuracy([50, 40, 60, 20], [100, 20, 100])).toBeLessThan(75);
  });
});

describe('Brilliant: only verified, needed sacrifices', () => {
  const smother = (o: Partial<ClassifyInput> = {}) =>
    classifyDetailed(base({ fenBefore: SMOTHER, uci: 'c4g8', bestUci: 'c4g8', winBefore: 100, winAfter: 100, secondBestWin: 50, bestWasMate: true, playedKeepsMate: true, line: SMOTHER_LINE, legalCount: 40, ...o }));
  it('Qg8+!! (smothered mate) is brilliant', () => {
    const d = smother();
    expect(d.cls).toBe('brilliant');
    expect(d.sacrificed).toBeGreaterThanOrEqual(4);
  });
  it('not brilliant when another move also wins completely', () => {
    expect(smother({ secondBestWin: 97 }).cls).toBe('best');
  });
  it('not brilliant without the engine line (unverified)', () => {
    expect(smother({ line: undefined }).cls).not.toBe('brilliant');
  });
  it('a sacrifice regained at once (fork) is not brilliant', () => {
    expect(isSacrifice(FORK_REGAIN, 'f1f7')).toBe(true); // statically it looks like one...
    expect(verifiedSacrifice(FORK_REGAIN, 'f1f7', FORK_LINE)).toBe(0); // ...but the line wins the queen back
    expect(classifyMove(base({ fenBefore: FORK_REGAIN, uci: 'f1f7', bestUci: 'f1f7', winBefore: 90, winAfter: 90, secondBestWin: 55, line: FORK_LINE }))).not.toBe('brilliant');
  });
  it('a declined offer is not brilliant', () => {
    // Qg8+ is answered by ...Kxg8?? impossible; use a line where Black ignores the knight on e5
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    const line = ['f3g5', 'd7d5', 'e4d5', 'f6d5'];
    expect(verifiedSacrifice(fen, 'f3g5', line)).toBe(0);
  });
  it('a losing sacrifice is not brilliant; a near-best one can be', () => {
    expect(smother({ uci: 'c4g8', bestUci: 'h6f7', winAfter: 30, winBefore: 60 }).cls).not.toBe('brilliant');
    expect(smother({ bestUci: 'h6f7', winBefore: 70, winAfter: 69 }).cls).toBe('brilliant');
  });
  it('a recapture is never brilliant', () => {
    expect(smother({ prevCaptureTo: 'g8' }).cls).not.toBe('brilliant');
  });
});

describe('Great: the only good move, not an obvious one', () => {
  it('only move with a large gap is great', () => {
    expect(classifyMove(base({ uci: 'g1f3', bestUci: 'g1f3', winBefore: 60, winAfter: 60, secondBestWin: 40 }))).toBe('great');
  });
  it('small gap: best', () => {
    expect(classifyMove(base({ uci: 'g1f3', bestUci: 'g1f3', winBefore: 60, winAfter: 60, secondBestWin: 50 }))).toBe('best');
  });
  it('already lost: best, not great', () => {
    expect(classifyMove(base({ uci: 'g1f3', bestUci: 'g1f3', winBefore: 20, winAfter: 20, secondBestWin: 2 }))).toBe('best');
  });
  it('recapture is not great', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2'; // 1.e4 d5 2.exd5
    expect(classifyMove(base({ fenBefore: fen, uci: 'd8d5', bestUci: 'd8d5', winBefore: 45, winAfter: 45, secondBestWin: 25, prevCaptureTo: 'd5' }))).toBe('best');
  });
  it('mate in one is the obvious finish, not great', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    expect(classifyMove(base({ fenBefore: fen, uci: 'a1a8', bestUci: 'a1a8', winBefore: 100, winAfter: 100, secondBestWin: 60 }))).toBe('best');
  });
  it('taking a hanging queen is obvious, not great', () => {
    const fen = 'rnb1kbnr/pppp1ppp/8/4p1q1/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1';
    expect(isObvious(fen, 'f3g5', 30)).toBe(true);
    expect(classifyMove(base({ fenBefore: fen, uci: 'f3g5', bestUci: 'f3g5', winBefore: 95, winAfter: 95, secondBestWin: 40 }))).toBe('best');
  });
});

describe('phases', () => {
  it('detects opening, middlegame and endgame', () => {
    expect(phaseOf(START_FEN, 0)).toBe('opening');
    expect(phaseOf('r1bq1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 10', 30)).toBe('middlegame');
    expect(phaseOf('8/5pk1/8/8/8/8/r4PPP/3R2K1 w - - 0 40', 80)).toBe('endgame');
    // monotone: never back to the opening
    expect(phaseSeries([START_FEN, '8/5pk1/8/8/8/8/r4PPP/3R2K1 w - - 0 40', START_FEN])).toEqual(['opening', 'endgame', 'endgame']);
  });
  it('endgame types and feedback', () => {
    expect(endgameType('8/5pk1/8/8/8/8/r4PPP/3R2K1 w - - 0 40')).toBe('Rook endgame');
    expect(endgameType('8/5pk1/8/8/8/8/5PPP/6K1 w - - 0 40')).toBe('King and pawn endgame');
    expect(endgameType('8/5pk1/8/4b3/8/8/r4PPP/6K1 w - - 0 40')).toBe('Piece vs pawns');
    expect(endgameType('8/5pk1/8/4b3/8/8/5PPP/3R2K1 w - - 0 40')).toBe('Rook vs minor piece');
    expect(endgameVerdict(85, 0.5)).toBe('spoiled');
    expect(endgameVerdict(85, 1)).toBe('converted');
    expect(endgameVerdict(20, 0.5)).toBe('saved');
    expect(endgameFeedback('Rook endgame', 85, 0.5, 2)).toMatch(/slipped/);
    const ids = new Set(ENDGAME_DRILLS.map((d) => d.id));
    for (const g of Object.values(ENDGAME_GUIDE)) for (const d of g.drills) expect(ids.has(d)).toBe(true);
  });
});

describe('puzzles from real mistakes', () => {
  it('uniqueness margin', () => {
    expect(uniqueMargin({ cp: 300 }, { cp: 0 })).toBeGreaterThan(10);
    expect(uniqueMargin({ cp: 40 }, { cp: 20 })).toBeNull(); // two equally good moves
    expect(uniqueMargin({ mate: 2 }, { cp: 500 })).toBeGreaterThanOrEqual(10);
    expect(uniqueMargin({ mate: 2 }, { mate: 3 })).toBeNull(); // two mates
    expect(uniqueMargin({ cp: 200 }, null)).toBe(100);
  });
  it('solution validation and acceptance', () => {
    expect(validSolution(SMOTHER, SMOTHER_LINE)).toBe(true);
    expect(validSolution(SMOTHER, ['c4g8', 'd8g8'])).toBe(false); // must end on the trainee's move
    expect(validSolution(SMOTHER, ['a1a8'])).toBe(false);
    expect(acceptsMove(SMOTHER, SMOTHER_LINE, 0, 'c4g8')).toBe(true);
    expect(acceptsMove(SMOTHER, SMOTHER_LINE, 0, 'c4c8')).toBe(false);
    // any mating move is accepted even if the stored line differs
    expect(acceptsMove('6k1/5ppp/8/8/8/8/5PPP/RR4K1 w - - 0 1', ['a1a8'], 0, 'b1b8')).toBe(true);
    const ps = puzzlesFromGame('g1', [
      { ply: 10, fen: SMOTHER, line: SMOTHER_LINE, margin: 50, theme: 'mate', playedUci: 'h6f7', cls: 'blunder' },
      { ply: 12, fen: SMOTHER, line: ['a1a8'], margin: 50, theme: 'mate', playedUci: 'h6f7', cls: 'blunder' },
    ]);
    expect(ps).toHaveLength(1);
    expect(ps[0]).toMatchObject({ id: 'g1-10', bestUci: 'c4g8', line: SMOTHER_LINE, v: 3 });
  });
});

describe('competitive integrity', () => {
  const active = (rated: boolean, moves: string[] = ['e2e4', 'e7e5', 'g1f3']) =>
    ({ active: { record: { id: 'live', result: '*', rated, startFen: START_FEN, moves } } }) as unknown as Pick<Save, 'active'>;
  it('the active / unfinished game cannot be analysed', () => {
    expect(analysisBlockReason(active(true), { id: 'live', result: '*' })).toBeTruthy();
    expect(analysisBlockReason(active(false), { id: 'live', result: '1-0' })).toBeTruthy();
    expect(analysisBlockReason({ active: null }, { id: 'x', result: '*' })).toBeTruthy();
    expect(analysisBlockReason(active(true), { id: 'old', result: '0-1' })).toBeNull();
  });
  it('import of the live position is refused; explorer locked in rated play', () => {
    expect(importBlockReason(active(true), { startFen: START_FEN, moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'] })).toBeTruthy();
    expect(importBlockReason(active(true), { startFen: START_FEN, moves: ['d2d4', 'd7d5'] })).toBeNull();
    expect(importBlockReason(active(false), { fen: START_FEN })).toBeTruthy();
    expect(importBlockReason({ active: null }, { fen: START_FEN })).toBeNull();
    expect(explorerLocked(active(true))).toBe(true);
    expect(explorerLocked(active(false))).toBe(false);
  });
  it('achievements need a complete analysis', () => {
    const g = { moves: ['e2e4', 'e7e5'], result: '1-0', analysis: { moves: [{}], depth: 12 } } as unknown as GameRecord;
    expect(analysisComplete(g)).toBe(false);
    (g.analysis!.moves as unknown[]).push({});
    expect(analysisComplete(g)).toBe(true);
  });
});

function mv(ply: number, o: Partial<MoveAnalysisX>): MoveAnalysisX {
  return { ply, uci: 'a2a3', san: 'a3', evalBefore: { cp: 0 }, evalAfter: { cp: 0 }, bestUci: 'a2a3', bestSan: 'a3', pv: [], winLoss: 0, accuracy: 100, cls: 'best', phase: 'opening', tags: [], ...o };
}
function rec(id: string, date: string, moves: MoveAnalysisX[], result: GameRecord['result'] = '1-0'): GameRecord {
  return {
    id, kind: 'ranked', rated: true, pool: 'untimed', tc: 'untimed', day: 1, date, arena: 0, source: 'player',
    white: { id: 'p', name: 'Me', rating: 1200, rank: 0 }, black: { id: 'o', name: 'Opp', rating: 1200, rank: 0 },
    playerColor: 'w', startFen: START_FEN, moves: moves.map(() => 'a2a3'), san: [], result, termination: 'checkmate',
    analysis: { depth: 10, engine: 't', moves, accuracy: { w: 80, b: 70 }, counts: { w: { blunder: 1 }, b: {} }, critical: [], opening: null, endgame: null },
  };
}

describe('weakness tracking and progress', () => {
  it('derives categories from tags and phases', () => {
    const g = rec('a', '2026-01-01', [
      mv(0, { cls: 'inaccuracy', phase: 'opening' }),
      mv(1, {}),
      mv(2, { cls: 'blunder', phase: 'middlegame', tags: ['hangs'] }),
      mv(3, {}),
      mv(4, { cls: 'mistake', phase: 'middlegame', tags: ['missedWin'] }),
      mv(5, {}),
      mv(6, { cls: 'mistake', phase: 'endgame', evalBefore: { cp: -400 } }),
    ]);
    const st = gameStat(g)!;
    expect(st.cat).toMatchObject({ opening: 1, safety: 1, tactics: 1, endgame: 1, defence: 1 });
    expect(st.phaseErrors.middlegame).toBe(2);
    expect(st.reachedEndgame).toBe(true);
  });
  it('report ranks by severity and computes trends', () => {
    const games = Array.from({ length: 10 }, (_, i) =>
      gameStat(rec('g' + i, `2026-01-${String(i + 1).padStart(2, '0')}`, [mv(0, {}), mv(1, {}), mv(2, i < 5 ? { cls: 'blunder', phase: 'middlegame', tags: ['hangs'] } : {})]))!,
    );
    const r = weaknessReport(games);
    expect(r.games).toBe(10);
    expect(r.weaknesses[0].key).toBe('safety');
    expect(r.weaknesses[0].trend).toBeLessThan(0); // improving: no hanging pieces in the last five
    const ps = progressSeries(games);
    expect(ps.accuracy).toHaveLength(10);
    expect(ps.ids[0]).toBe('g0');
    expect(rolling([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5]);
  });
  it('phaseStats splits by side and phase', () => {
    const ms = [mv(0, { accuracy: 90 }), mv(1, { accuracy: 50 }), mv(2, { accuracy: 70, phase: 'endgame', cls: 'mistake' })];
    const p = phaseStats(ms);
    expect(p.opening.w.acc).toBe(90);
    expect(p.opening.b.acc).toBe(50);
    expect(p.endgame.w).toMatchObject({ acc: 70, errors: 1 });
  });
  it('explanations are concise and specific', () => {
    expect(explainMove(mv(0, { cls: 'blunder', bestSan: 'Nf3', tags: ['hangs'], hangs: { piece: 'n', square: 'f5' } }))).toMatch(/knight on f5/);
    expect(explainMove(mv(0, { cls: 'mistake', bestSan: 'Qh7#', tags: ['missedMate'], mateIn: 1 }))).toMatch(/Missed mate in 1/);
    expect(explainMove(mv(0, { cls: 'brilliant', sacrificed: 9 }))).toMatch(/queen/);
  });
});
