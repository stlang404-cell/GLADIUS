import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { CONF, moveConfidence, spread, confidentCounts, isConfidentBrilliant, isTrusted, isUnclear } from '../src/analysis/confidence';
import { buildMoves, criticalMoments, gameContext, explainMove, provenanceText, type PosEval } from '../src/analysis/analyzer';
import { displayClass, UNCLEAR_META } from '../src/analysis/classify';
import { annotatedPgn, nagFor, gameRecommendations, biggestMistakes, reliability, openingReview, endgameSummary, displayCounts } from '../src/analysis/report';
import { gameStat } from '../src/analysis/weakness';
import { computeSkillProfile } from '../src/analysis/skills';
import { deepenBlockReason } from '../src/analysis/integrity';
import { START_FEN } from '../src/chess/rules';
import type { GameRecord, Save } from '../src/game/state';
import type { GameAnalysisX, MoveAnalysisX } from '../src/analysis/types';

function mv(ply: number, o: Partial<MoveAnalysisX>): MoveAnalysisX {
  return { ply, uci: 'a2a3', san: 'a3', evalBefore: { cp: 20 }, evalAfter: { cp: 20 }, bestUci: 'a2a3', bestSan: 'a3', pv: [], winLoss: 0, accuracy: 95, cls: 'best', phase: 'middlegame', tags: [], depth: 14, conf: 'high', instab: 1, ...o };
}
const MOVES = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'];
const SANS = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'];
function game(moves: MoveAnalysisX[], o: Partial<GameAnalysisX> = {}): GameRecord {
  return {
    id: 'g', kind: 'ranked', rated: true, pool: 'untimed', tc: 'untimed', day: 3, date: '2026-05-01T10:00:00Z', arena: 0, source: 'player',
    white: { id: 'p', name: 'Me', rating: 1200, rank: 0 }, black: { id: 'o', name: 'Opp', rating: 1300, rank: 0 },
    playerColor: 'w', startFen: START_FEN, moves: MOVES, san: SANS, result: '1-0', termination: 'resignation',
    analysis: { depth: 12, engine: 'sf', moves, accuracy: { w: 88.2, b: 71.5 }, counts: { w: {}, b: {} }, critical: [], opening: null, endgame: null, version: 4, verification: { moves: 1, positions: 2, maxDepth: 18, unclear: 0 }, ...o } as GameAnalysisX,
  };
}
const base = () => MOVES.map((u, i) => mv(i, { uci: u, san: SANS[i], bestUci: u, bestSan: SANS[i] }));

describe('confidence model', () => {
  it('spread of the last three iterations', () => {
    expect(spread([{ d: 8, w: 50 }, { d: 9, w: 70 }, { d: 10, w: 52 }, { d: 11, w: 55 }])).toBe(18);
    expect(spread([{ d: 11, w: 55 }])).toBe(0);
    expect(spread(undefined)).toBe(0);
  });
  it('rules: forced/book, unstable, error near noise, unverified claim, solid', () => {
    const c = (o: Partial<Parameters<typeof moveConfidence>[0]>) => moveConfidence({ cls: 'blunder', loss: 30, vol: 1, inc: 1, depth: 14, verified: true, ...o });
    expect(c({})).toBe('high');
    expect(c({ cls: 'forced', vol: 40 })).toBe('high');
    expect(c({ vol: CONF.unstable + 1 })).toBe('low');
    expect(c({ inc: CONF.inconsistent + 1 })).toBe('low');
    expect(c({ cls: 'mistake', loss: 11, vol: 7 })).toBe('low'); // 11 − 7 < 5: noise could erase the error
    expect(c({ verified: false })).toBe('medium');
    expect(c({ depth: 9 })).toBe('medium');
    expect(c({ cls: 'best', loss: 0, verified: false })).toBe('high'); // non-claims need no verification
    expect(c({ vol: 7 })).toBe('medium');
  });
  it('low-confidence claims are shown as Unclear, never as certain', () => {
    expect(displayClass({ cls: 'blunder', conf: 'low' })).toMatchObject({ label: 'Unclear', glyph: UNCLEAR_META.glyph, unclear: true });
    expect(displayClass({ cls: 'blunder', conf: 'high' }).label).toBe('Blunder');
    expect(displayClass({ cls: 'best', conf: 'low' }).label).toBe('Best');
    expect(explainMove(mv(0, { cls: 'blunder', conf: 'low', depth: 11, bestSan: 'Nf3', bestUci: 'g1f3' }))).toMatch(/^Unclear: .*depth 11/);
    expect(isUnclear(mv(0, { cls: 'mistake', conf: 'low' }))).toBe(true);
    const shown = displayCounts({ startFen: START_FEN }, { moves: [mv(0, { cls: 'blunder', conf: 'low' }), mv(1, { cls: 'blunder' }), mv(2, {})] });
    expect(shown.w).toEqual({ counts: { best: 1 }, unclear: 1 });
    expect(shown.b).toEqual({ counts: { blunder: 1 }, unclear: 0 });
  });
  it('provenance line: depth, nodes, verification and confidence', () => {
    const t = provenanceText(mv(0, { cls: 'best', depth: 11, nodes: 2_885_751, verified: { by: 'auto', depth: 19, nodes: 2_885_751, from: 'blunder' } }), (c) => c.toUpperCase());
    expect(t).toBe('depth 19 · 2.9M nodes · verified (was BLUNDER) · high confidence');
    expect(provenanceText({ ...mv(0, {}), depth: undefined, conf: undefined })).toBeNull();
  });
});

describe('demotion: an unstable brilliancy is not stored as one', () => {
  // Qg8+!! Rxg8 Nf7# — the smothered mate (a real, verified sacrifice).
  const SMOTHER = '3r3k/6pp/7N/8/2Q5/8/6PP/6K1 w - - 0 1';
  const ctx = gameContext(['c4g8'], SMOTHER);
  const after = new Chess(SMOTHER);
  after.move('Qg8+');
  const pos = (o: Partial<PosEval>): PosEval => ({ score: { mate: 2 }, best: 'c4g8', lines: [], pv: [], over: null, depth: 14, nodes: 1000, trace: [], ...o });
  const evalsWith = (trace: PosEval['trace']) => [
    pos({ lines: [{ uci: 'c4g8', score: { mate: 2 }, pv: ['c4g8', 'd8g8', 'h6f7'] }, { uci: 'c4c8', score: { cp: 20 }, pv: ['c4c8'] }], pv: ['c4g8', 'd8g8', 'h6f7'], trace }),
    pos({ score: { mate: -1 }, best: 'd8g8', lines: [{ uci: 'd8g8', score: { mate: -1 }, pv: ['d8g8', 'h6f7'] }], pv: ['d8g8', 'h6f7'] }),
  ];
  it('stable and verified → brilliant, high confidence', () => {
    const m = buildMoves(ctx, evalsWith([{ d: 12, w: 100 }, { d: 13, w: 100 }, { d: 14, w: 100 }]), new Map([[0, { by: 'auto', depth: 18, nodes: 5 }]]))[0];
    expect(m.cls).toBe('brilliant');
    expect(m.conf).toBe('high');
    expect(isConfidentBrilliant(m)).toBe(true);
  });
  it('unstable → demoted to best, claim kept, not counted for achievements', () => {
    const m = buildMoves(ctx, evalsWith([{ d: 12, w: 40 }, { d: 13, w: 100 }, { d: 14, w: 100 }]), new Map([[0, { by: 'auto', depth: 18, nodes: 5 }]]))[0];
    expect(m.cls).toBe('best');
    expect(m.claim).toBe('brilliant');
    expect(m.conf).toBe('low');
    expect(isConfidentBrilliant(m)).toBe(false);
    expect(explainMove(m)).toMatch(/could not confirm/);
  });
  it('unverified (no deep search) → at most medium, so never counted', () => {
    const m = buildMoves(ctx, evalsWith([{ d: 12, w: 100 }, { d: 13, w: 100 }, { d: 14, w: 100 }]))[0];
    expect(m.cls).toBe('brilliant');
    expect(m.conf).toBe('medium');
    expect(isConfidentBrilliant(m)).toBe(false);
    expect(confidentCounts({ moves: [m], counts: { w: { brilliant: 1 }, b: {} } }, SMOTHER).w.brilliant).toBeUndefined();
  });
});

describe('confident counts for achievements', () => {
  it('positive classes only when high; errors always (an unclear error still blocks Flawless)', () => {
    const ms = [mv(0, { cls: 'brilliant', conf: 'high' }), mv(1, {}), mv(2, { cls: 'great', conf: 'medium' }), mv(3, {}), mv(4, { cls: 'blunder', conf: 'low' })];
    const c = confidentCounts({ moves: ms, counts: { w: {}, b: {} } });
    expect(c.w).toEqual({ brilliant: 1, blunder: 1 });
    expect(c.b).toEqual({ best: 2 });
    // pre-v0.4 analyses (no confidence) keep their stored counts
    const legacy = { moves: [{ ...mv(0, { cls: 'brilliant' }), conf: undefined }], counts: { w: { brilliant: 1 }, b: {} } };
    expect(confidentCounts(legacy)).toBe(legacy.counts);
  });
});

describe('PGN NAG rules', () => {
  const pgnOf = (o: Partial<MoveAnalysisX>) => {
    const ms = base();
    ms[2] = { ...ms[2], cls: 'blunder', winLoss: 30, bestSan: 'd4', bestUci: 'd2d4', pv: ['d4', 'exd4'], depth: 11, ...o };
    return annotatedPgn(game(ms));
  };
  it('high: ??; medium: softened to ?; low: no NAG and the word Unclear', () => {
    expect(nagFor({ cls: 'blunder', conf: 'high' })).toBe('$4');
    expect(nagFor({ cls: 'blunder', conf: 'medium' })).toBe('$2');
    expect(nagFor({ cls: 'brilliant', conf: 'medium' })).toBe('$1');
    expect(nagFor({ cls: 'blunder', conf: 'low' })).toBeNull();
    expect(nagFor({ cls: 'brilliant', conf: 'low' })).toBeNull();
    expect(nagFor({ cls: 'blunder' })).toBe('$4'); // pre-v0.4
    const hi = pgnOf({ conf: 'high', verified: { by: 'auto', depth: 18, nodes: 1 } });
    expect(hi).toMatch(/Nf3 \$4\s+\{\[%eval 0\.20\] Blunder\..*\(depth 18, verified,\s+high confidence\)\}/s);
    const lo = pgnOf({ conf: 'low' });
    expect(lo).not.toContain('$4');
    expect(lo).not.toContain('$2');
    expect(lo).toMatch(/Nf3\s+\{\[%eval 0\.20\] Unclear: .*low\s+confidence/s);
    expect(lo).toContain('claims verified to depth 18');
    for (const pgn of [hi, lo]) {
      const c = new Chess();
      c.loadPgn(pgn);
      expect(c.history()).toEqual(SANS);
    }
  });
});

describe('critical moments ignore engine noise', () => {
  // White's win% series built from evalAfter; cp → win% via the logistic model.
  const ms = (): MoveAnalysisX[] => base().map((m) => ({ ...m, cls: 'best' }));
  it('a real, stable swing is critical', () => {
    const x = ms();
    x[2] = { ...x[2], cls: 'blunder', winLoss: 30, evalAfter: { cp: -300 } };
    x[3] = { ...x[3], evalBefore: { cp: -300 }, evalAfter: { cp: -300 } };
    x[4] = { ...x[4], evalBefore: { cp: -300 }, evalAfter: { cp: -300 } };
    x[5] = { ...x[5], evalBefore: { cp: -300 }, evalAfter: { cp: -300 } };
    expect(criticalMoments(x)).toEqual([2]);
  });
  it('the same swing with unstable evaluations (or low confidence) is not', () => {
    const x = ms();
    x[2] = { ...x[2], cls: 'blunder', winLoss: 30, evalAfter: { cp: -300 }, instab: 14 };
    expect(criticalMoments(x)).toEqual([]);
    x[2] = { ...x[2], instab: 2, conf: 'low' };
    expect(criticalMoments(x)).toEqual([]);
  });
  it('a loss the position evaluations do not show (two views disagree) is not', () => {
    const x = ms();
    x[2] = { ...x[2], cls: 'blunder', winLoss: 30, evalAfter: { cp: 10 } }; // root says −30%, the position after says ≈ equal
    expect(criticalMoments(x)).toEqual([]);
  });
  it('a zig-zag of small swings is not', () => {
    const x = ms().map((m, i) => ({ ...m, winLoss: 8, evalAfter: { cp: i % 2 ? 150 : -150 }, evalBefore: { cp: i % 2 ? -150 : 150 } }));
    expect(criticalMoments(x)).toEqual([]);
  });
});

describe('personal findings use high-confidence moves only', () => {
  const blunder = (conf: MoveAnalysisX['conf']) => {
    const ms = base();
    ms[2] = { ...ms[2], cls: 'blunder', winLoss: 25, tags: ['hangs'], hangs: { piece: 'n', square: 'f3' }, conf };
    return game(ms);
  };
  it('recommendations, biggest mistakes, weakness and skill statistics', () => {
    expect(gameRecommendations(blunder('high'))[0]).toMatch(/Blunder check/);
    expect(gameRecommendations(blunder('low')).join(' ')).not.toMatch(/Blunder check/);
    expect(gameRecommendations(blunder('low'))[0]).toMatch(/unclear.*Analyse deeper/);
    expect(biggestMistakes(blunder('high'))).toHaveLength(1);
    expect(biggestMistakes(blunder('low'))).toHaveLength(0);
    expect(gameStat(blunder('high'))!.cat.safety).toBe(1);
    expect(gameStat(blunder('low'))!.cat.safety).toBe(0);
    expect(gameStat(blunder('low'))!.blunders).toBe(0);
    const prof = (c: MoveAnalysisX['conf']) => computeSkillProfile([blunder(c)]).dims.find((d) => d.key === 'blunders')!.measured.value;
    expect(prof('high')).toBeGreaterThan(0);
    expect(prof('low')).toBe(0);
    expect(isTrusted({ conf: undefined })).toBe(true); // pre-v0.4 analyses as before
  });
  it('reliability reports verification and unclear moves', () => {
    const ms = Array.from({ length: 64 }, (_, i) => mv(i, {}));
    const g0 = game(ms);
    expect(reliability(g0.analysis as GameAnalysisX)).toMatchObject({ level: 'high', maxDepth: 18, unclear: 0 });
    for (const k of [3, 7, 9, 11]) ms[k] = { ...ms[k], cls: 'mistake', conf: 'low' };
    const r = reliability(game(ms).analysis as GameAnalysisX);
    expect(r.unclear).toBe(4);
    expect(r.level).toBe('low');
    expect(r.note).toMatch(/4 unclear/);
  });
});

describe('opening and endgame review', () => {
  it('real book exit (first move outside the book continuations) with the theory move', () => {
    const moves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'a2a3', 'g8f6'];
    const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'a3', 'Nf6'];
    const ms = moves.map((u, i) => mv(i, { uci: u, san: sans[i], bestUci: u, bestSan: sans[i], cls: i < 4 ? 'book' : i === 4 ? 'inaccuracy' : 'best', winLoss: i === 4 ? 6 : 0 }));
    const g = { ...game(ms, { opening: { eco: 'C44', name: "King's Knight Opening" } }), moves, san: sans };
    const r = openingReview(g)!;
    expect(r.exit).toMatchObject({ ply: 4, san: 'a3' });
    expect(r.leftBy).toBe('player');
    expect(r.theory.length).toBeGreaterThan(0);
    expect(r.theory).not.toContain('a3');
    expect(r.theory).toContain('Bb5'); // the Ruy Lopez is the main continuation
    expect(r.costly).toBe(true);
    ms[4] = { ...ms[4], conf: 'low' };
    expect(openingReview({ ...g, analysis: { ...g.analysis!, moves: ms } })!).toMatchObject({ costly: false, exit: { unclear: true } });
    // as Black: White left the book first
    expect(openingReview(g, 'b')!).toMatchObject({ exit: null, leftBy: 'opponent' });
    // all-book game: no exit at all
    expect(openingReview(game(base()))!.exit).toBeNull();
  });
  it('endgame errors count only when confident', () => {
    const ms = base();
    ms[4] = { ...ms[4], cls: 'mistake', winLoss: 12, phase: 'endgame', conf: 'low' };
    const g = game(ms, { endgameReview: { ply: 3, type: 'Rook endgame', winAtEntry: { w: 80, b: 20 } } });
    expect(endgameSummary(g)).toMatchObject({ type: 'Rook endgame', errors: 0, unclear: 1, verdict: 'converted' });
    ms[4] = { ...ms[4], conf: 'high' };
    expect(endgameSummary(g)!.errors).toBe(1);
  });
});

describe('deeper analysis integrity', () => {
  const live = { active: { record: { id: 'live', result: '*', rated: false, startFen: START_FEN, moves: [] } } } as unknown as Pick<Save, 'active'>;
  const done = { id: 'old', result: '1-0' as const, analysis: { depth: 12 } as never };
  it('never during a game in progress; only for finished, analysed games', () => {
    expect(deepenBlockReason({ active: null }, done)).toBeNull();
    expect(deepenBlockReason(live, done)).toMatch(/in progress/);
    expect(deepenBlockReason({ active: null }, { ...done, analysis: undefined })).toMatch(/Analyse the game first/);
    expect(deepenBlockReason({ active: null }, { id: 'x', result: '*', analysis: undefined })).toBeTruthy();
    expect(deepenBlockReason(live, { id: 'live', result: '*' })).toBeTruthy();
  });
});
