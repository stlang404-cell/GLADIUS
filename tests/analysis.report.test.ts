import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { annotatedPgn, plyAtGraphX, graphValue, postGameReport, reliability, numbered, biggestMistakes, gameRecommendations } from '../src/analysis/report';
import { playVariation } from '../src/analysis/explore';
import { analysisNeeded } from '../src/analysis/integrity';
import { computeSkillProfile } from '../src/analysis/skills';
import { recordAttempt, ANALYSIS_VERSION, type MoveAnalysisX, type TrainingPositionX } from '../src/analysis/types';
import { evalText } from '../src/ui/AnalysisView';
import { START_FEN } from '../src/chess/rules';
import type { GameRecord } from '../src/game/state';

function mv(ply: number, o: Partial<MoveAnalysisX>): MoveAnalysisX {
  return { ply, uci: 'a2a3', san: 'a3', evalBefore: { cp: 20 }, evalAfter: { cp: 20 }, bestUci: 'a2a3', bestSan: 'a3', pv: [], winLoss: 0, accuracy: 95, cls: 'best', phase: 'middlegame', tags: [], ...o };
}
const MOVES = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'];
function game(o: Partial<GameRecord> = {}, moves?: MoveAnalysisX[]): GameRecord {
  const c = new Chess();
  const san = MOVES.map((u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4) }).san);
  const ms = moves ?? MOVES.map((u, i) => mv(i, { uci: u, san: san[i] }));
  return {
    id: 'g', kind: 'ranked', rated: true, pool: 'untimed', tc: 'untimed', day: 3, date: '2026-05-01T10:00:00Z', arena: 0, source: 'player',
    white: { id: 'p', name: 'Me', rating: 1200, rank: 0 }, black: { id: 'o', name: 'Opp', rating: 1300, rank: 0 },
    playerColor: 'w', startFen: START_FEN, moves: MOVES, san, result: '1-0', termination: 'resignation',
    analysis: { depth: 12, engine: 'sf', moves: ms, accuracy: { w: 88.2, b: 71.5 }, counts: { w: {}, b: {} }, critical: [], opening: { eco: 'C55', name: 'Italian Game: Two Knights Defence' }, endgame: null },
    ...o,
  };
}

describe('evaluation signs & mate scores', () => {
  it('formats signs and mates from White’s point of view', () => {
    expect(evalText({ cp: 35 })).toBe('+0.3');
    expect(evalText({ cp: -120 })).toBe('−1.2');
    expect(evalText({ cp: -3 })).toBe('0.0'); // no '−0.0'
    expect(evalText({ mate: 3 })).toBe('+M3');
    expect(evalText({ mate: -2 })).toBe('−M2');
  });
  it('graph clamps and pins mates to the edges', () => {
    expect(graphValue({ mate: 1 })).toBe(100);
    expect(graphValue({ mate: -4 })).toBe(0);
    expect(graphValue({ cp: 5000 })).toBeLessThanOrEqual(100);
    expect(graphValue({ cp: -5000 })).toBeGreaterThanOrEqual(0);
    expect(graphValue({ cp: 0 })).toBeCloseTo(50);
    expect(graphValue({ cp: 200 })).toBeGreaterThan(graphValue({ cp: 100 }));
  });
  it('graph point → ply mapping', () => {
    expect(plyAtGraphX(0, 40)).toBe(0);
    expect(plyAtGraphX(1, 40)).toBe(40);
    expect(plyAtGraphX(0.5, 40)).toBe(20);
    expect(plyAtGraphX(0.512, 40)).toBe(20);
    expect(plyAtGraphX(-0.2, 40)).toBe(0);
    expect(plyAtGraphX(1.3, 40)).toBe(40);
    expect(plyAtGraphX(NaN, 40)).toBe(0);
    expect(plyAtGraphX(0.5, 0)).toBe(0);
  });
});

describe('variations', () => {
  it('replays legal moves and stops at the first illegal one', () => {
    const v = playVariation(START_FEN, ['e2e4', 'e7e5', 'e1e3', 'g1f3']);
    expect(v.map((x) => x.san)).toEqual(['e4', 'e5']);
    expect(new Chess(v[1].fen).turn()).toBe('w');
  });
  it('numbers lines from either side', () => {
    expect(numbered(['e4', 'e5', 'Nf3'], 0)).toBe('1. e4 e5 2. Nf3');
    expect(numbered(['Nf6', 'Bc4'], 3)).toBe('2... Nf6 3. Bc4');
  });
});

describe('annotated PGN', () => {
  it('has NAGs, %eval comments and variations, and parses back', () => {
    const g = game({}, MOVES.map((u, i) => mv(i, { uci: u, san: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'][i], ...(i === 5 ? { cls: 'mistake', bestSan: 'Bc5', pv: ['Bc5', 'c3', 'Nf6'], evalAfter: { cp: 90 }, winLoss: 11 } : {}) })));
    const pgn = annotatedPgn(g);
    expect(pgn).toContain('[WhiteAccuracy "88.2"]');
    expect(pgn).toContain('$2');
    expect(pgn).toContain('[%eval 0.90]');
    expect(pgn).toContain('(3... Bc5 4. c3 Nf6)');
    const c = new Chess();
    c.loadPgn(pgn);
    expect(c.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6']);
  });
});

describe('analysis caching', () => {
  const s = { active: null };
  it('reuses stored analyses; re-analyses only stale ones on request', () => {
    expect(analysisNeeded(s, { id: 'a', result: '1-0', moves: ['e2e4'] }, ANALYSIS_VERSION)).toBe(true);
    const done = { id: 'a', result: '1-0' as const, moves: ['e2e4'], analysis: { version: ANALYSIS_VERSION } as never };
    expect(analysisNeeded(s, done, ANALYSIS_VERSION)).toBe(false);
    expect(analysisNeeded(s, done, ANALYSIS_VERSION, true)).toBe(false);
    const old = { ...done, analysis: {} as never };
    expect(analysisNeeded(s, old, ANALYSIS_VERSION)).toBe(false);
    expect(analysisNeeded(s, old, ANALYSIS_VERSION, true)).toBe(true);
    expect(analysisNeeded(s, { id: 'b', result: '*', moves: ['e2e4'] }, ANALYSIS_VERSION)).toBe(false);
    expect(analysisNeeded(s, { id: 'b', result: '1-0', moves: [] }, ANALYSIS_VERSION)).toBe(false);
  });
});

describe('post-game report', () => {
  it('exposes accuracy, the critical move, a recommendation and reliability', () => {
    const g = game({}, MOVES.map((u, i) => mv(i, { uci: u, ...(i === 2 ? { cls: 'blunder', winLoss: 25, san: 'Nf3', bestSan: 'd4', tags: ['hangs'], hangs: { piece: 'n', square: 'f3' } } : {}) })));
    const r = postGameReport(g);
    expect(r.accuracy).toEqual({ player: 88.2, opponent: 71.5 });
    expect(r.critical).toMatchObject({ ply: 2, cls: 'blunder' });
    expect(r.recommendation).toMatch(/Blunder check/);
    expect(r.status).toBe('stale'); // no version field: made by an older analyser
    expect(reliability(g.analysis as never).level).toBe('low');
    expect(biggestMistakes(g)[0].ply).toBe(2);
    expect(gameRecommendations(g).length).toBeGreaterThan(0);
    expect(postGameReport({ ...g, analysis: undefined }).accuracy).toBeNull();
  });
});

describe('skill profile', () => {
  it('reports measured values with samples, shrinks small-sample estimates', () => {
    const gs = Array.from({ length: 3 }, (_, k) => ({ ...game(), id: 'g' + k, date: `2026-05-0${k + 1}` }));
    const p = computeSkillProfile(gs);
    expect(p.games).toBe(3);
    const pos = p.dims.find((d) => d.key === 'positional')!;
    expect(pos.measured.value).toBeCloseTo(95, 0);
    expect(pos.estimate!).toBeLessThan(95); // shrunk toward 50
    expect(pos.estimate!).toBeGreaterThan(50);
    expect(pos.confidence).toBe('low');
    expect(p.dims.find((d) => d.key === 'conversion')!.confidence).toBe('none');
    expect(p.eloBands).toEqual([{ band: '1200–1399', lo: 1200, games: 3, accuracy: 88.2, score: 100 }]);
    expect(computeSkillProfile([]).games).toBe(0);
  });
});

describe('training attempts', () => {
  it('only clean solves count; attempts are capped at 10', () => {
    const p = { id: 'x', fen: START_FEN, bestUci: 'e2e4', playedUci: 'a2a3', theme: 'tactic', fromGame: 'g', ply: 0, solved: 0, failed: 0 } as TrainingPositionX;
    for (let i = 0; i < 12; i++) recordAttempt(p, i % 3 === 0, i);
    expect(p.solved).toBe(4);
    expect(p.failed).toBe(8);
    expect(p.attempts).toHaveLength(10);
    expect(p.attempts![9].t).toBe(11);
  });
});
