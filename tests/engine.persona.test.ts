import { describe, it, expect, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { nodeEngine } from './helpers/nodeEngine';
import {
  allocateTime,
  humanDelay,
  chooseMove,
  styleBonus,
  styleShift,
  sampleCandidate,
  weightedBook,
  bookDepth,
  searchPosition,
  MOVE_OVERHEAD_MS,
  type Persona,
} from '../src/engine/persona';
import { PLAY_STYLES, LEGACY_STYLES, ALL_STYLES, STYLE_LABEL, STYLE_TO_OPENINGS, normalizeStyle } from '../src/engine/styles';
import { createRng } from '../src/core/rng';
import { START_FEN } from '../src/chess/rules';

const eng = nodeEngine();
afterAll(() => eng.terminate());

describe('clock allocation', () => {
  it('untimed uses the persona budget', () => {
    expect(allocateTime(undefined, 1500)).toEqual({ searchMs: 1500, totalMs: Infinity, panic: false });
  });
  it('normal: remaining/movesToGo + 0.8·inc − overhead', () => {
    const a = allocateTime({ myMs: 300000, incMs: 0, moveNumber: 1 }, 2000);
    expect(a.totalMs).toBeCloseTo(300000 / 35 - MOVE_OVERHEAD_MS, 0);
    const b = allocateTime({ myMs: 180000, incMs: 2000, moveNumber: 30 }, 2000);
    expect(b.totalMs).toBeCloseTo(180000 / 30 + 1600 - MOVE_OVERHEAD_MS, 0);
    expect(b.panic).toBe(false);
  });
  it('caps a single move at 20% of the clock and keeps a reserve', () => {
    const a = allocateTime({ myMs: 12000, incMs: 10000, moveNumber: 10 }, 2000);
    expect(a.totalMs).toBeLessThanOrEqual(12000 * 0.2);
  });
  it('panic mode below 10 s (5 s with ≥2 s increment)', () => {
    const a = allocateTime({ myMs: 8000, incMs: 0, moveNumber: 50 }, 2000);
    expect(a.panic).toBe(true);
    expect(a.totalMs).toBeCloseTo(200, 0);
    expect(allocateTime({ myMs: 8000, incMs: 2000 }, 2000).panic).toBe(false);
    expect(allocateTime({ myMs: 4000, incMs: 2000 }, 2000).panic).toBe(true);
    expect(allocateTime({ myMs: 100, incMs: 0 }, 2000).totalMs).toBe(30);
  });
  it('never flags in the game’s controls (simulated 160-move games)', () => {
    for (const [base, inc] of [[300, 0], [180, 2], [600, 0], [900, 10], [1800, 0]]) {
      let clock = base * 1000;
      let min = clock;
      for (let mv = 1; mv <= 160; mv++) {
        const plan = allocateTime({ myMs: clock, incMs: inc * 1000, moveNumber: mv }, 2000);
        clock -= plan.totalMs + 60; // full budget + real-world latency per move
        min = Math.min(min, clock);
        clock += inc * 1000;
      }
      expect(min, `${base}+${inc}`).toBeGreaterThan(0);
    }
  });
  it('humanDelay respects the budget and vanishes in panic', () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i++) {
      const clock = { myMs: 20000 + i * 1000, incMs: 0, moveNumber: 30 };
      expect(humanDelay(2000, 40, rng, 'natural', clock)).toBeLessThanOrEqual(allocateTime(clock, 1500).totalMs);
    }
    expect(humanDelay(2000, 40, rng, 'natural', { myMs: 5000 })).toBe(0);
    expect(humanDelay(2000, 40, rng, 'instant', { myMs: 5000 })).toBe(0);
    expect(humanDelay(2000, 40, createRng(1), 'natural')).toBeGreaterThan(0); // untimed unchanged
  });
});

describe('styles (v0.2 ids + backwards compatibility)', () => {
  it('has the eight product styles with labels and repertoires', () => {
    expect(PLAY_STYLES).toHaveLength(8);
    for (const s of ALL_STYLES) {
      expect(STYLE_LABEL[s]).toBeTruthy();
      expect(STYLE_TO_OPENINGS[s].length).toBeGreaterThan(0);
    }
    expect(STYLE_LABEL.attacker).toBe('Tactical attacker');
    expect(STYLE_LABEL.universal).toBe('Universal master');
  });
  it('maps v0.1 ids (old saves) to v0.2 styles', () => {
    for (const s of LEGACY_STYLES) expect(PLAY_STYLES).toContain(normalizeStyle(s));
    expect(normalizeStyle('tactical')).toBe('attacker');
    expect(normalizeStyle('aggressive')).toBe('gambiteer');
    expect(normalizeStyle('nonsense')).toBe('universal');
    expect(normalizeStyle(undefined)).toBe('universal');
  });
  it('style bonuses follow their heuristics', () => {
    // Attack: a check near the king beats a quiet move for the attacker.
    const fen = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P3/2NP1N2/PPP2PPP/R2QK2R w KQ - 0 7';
    expect(styleBonus('attacker', fen, 'c4f7')).toBeGreaterThan(styleBonus('attacker', fen, 'a2a3'));
    // Technician: equal trade when ahead > when behind.
    const tfen = 'r3k2r/ppp2ppp/2n5/3q4/3Q4/2N5/PPP2PPP/R3K2R w KQkq - 0 12';
    expect(styleBonus('technician', tfen, 'd4d5', { bestWin: 85, ply: 30 })).toBeGreaterThan(styleBonus('technician', tfen, 'd4d5', { bestWin: 20, ply: 30 }));
    // Universal never biases.
    expect(styleBonus('universal', fen, 'c4f7')).toBe(0);
  });
  it('style bonuses are finite and bounded on random positions', () => {
    const rng = createRng(99);
    for (let g = 0; g < 12; g++) {
      const c = new Chess();
      for (let i = 0; i < 10 + g * 4 && !c.isGameOver(); i++) c.move(rng.pick(c.moves()));
      if (c.isGameOver()) continue;
      for (const m of c.moves({ verbose: true }).slice(0, 8)) {
        for (const s of ALL_STYLES) {
          const b = styleBonus(s, c.fen(), m.from + m.to + (m.promotion ?? ''), { bestWin: 50, ply: c.history().length });
          expect(Number.isFinite(b)).toBe(true);
          expect(Math.abs(b)).toBeLessThan(8);
        }
      }
    }
  });
  it('theoreticians book deeper; gambiteers prefer gambits', () => {
    expect(bookDepth(1500, 'theoretician')).toBe(bookDepth(1500, 'universal') + 8);
    const p = (style: Persona['style']): Persona => ({ elo: 1800, style, openingStyles: STYLE_TO_OPENINGS[style] as Persona['openingStyles'], seed: 1 });
    const share = (style: Persona['style'], move: string, hist: string[]) => {
      const b = weightedBook(hist, p(style));
      const tot = b.reduce((a, x) => a + x.weight, 0);
      return (b.find((x) => x.uci === move)?.weight ?? 0) / tot;
    };
    // 1.e4 e5 2.f4 (King's Gambit) / 1.e4 c5 2.d4 (Smith-Morra)
    expect(share('gambiteer', 'f2f4', ['e2e4', 'e7e5'])).toBeGreaterThan(share('strategist', 'f2f4', ['e2e4', 'e7e5']));
  });
});

describe('preparation hook', () => {
  const persona: Persona = { elo: 2000, style: 'universal', openingStyles: ['classical'], seed: 5 };
  const share = (prep: Parameters<typeof weightedBook>[2], move: string, hist: string[]) => {
    const b = weightedBook(hist, persona, prep);
    return (b.find((x) => x.uci === move)?.weight ?? 0) / b.reduce((a, x) => a + x.weight, 0);
  };
  it('avoidLines steers away from the player’s favourite (by family or full name)', () => {
    const base = share(undefined, 'c7c5', ['e2e4']);
    expect(share({ avoidLines: ['Sicilian Defence'] }, 'c7c5', ['e2e4'])).toBeLessThan(base * 0.2);
    // As White vs 1...c5, avoiding the Najdorf lowers 2.Nf3 relative to 2.c3.
    const nf3 = share({ avoidLines: ['Sicilian Defence: Najdorf Variation'] }, 'g1f3', ['e2e4', 'c7c5']);
    expect(nf3).toBeLessThan(share(undefined, 'g1f3', ['e2e4', 'c7c5']));
  });
  it('preferLines steers into a prepared line', () => {
    expect(share({ preferLines: ['French Defence'] }, 'e7e6', ['e2e4'])).toBeGreaterThan(share(undefined, 'e7e6', ['e2e4']) * 2);
  });
  it('book choice stays deterministic for a given seed', async () => {
    const a = await chooseMove(eng, START_FEN, [], persona, { prep: { avoidLines: ['Sicilian Defence'] } });
    const b = await chooseMove(eng, START_FEN, [], persona, { prep: { avoidLines: ['Sicilian Defence'] } });
    expect(a.uci).toBe(b.uci);
    expect(a.source).toBe('book');
  });
});

describe('persona legality', () => {
  it('searches with the move history when it matches the FEN', () => {
    const c = new Chess();
    c.move('e4');
    c.move('e5');
    expect(searchPosition(c.fen(), ['e2e4', 'e7e5'])).toEqual({ fen: START_FEN, moves: ['e2e4', 'e7e5'] });
    expect(searchPosition(c.fen(), ['d2d4'])).toEqual({ fen: c.fen() });
  });
  it('always returns a legal move across random positions, all bands and styles', async () => {
    const rng = createRng(2026);
    const elos = [450, 1400, 2300, 2800, 3100];
    let checked = 0;
    for (let g = 0; g < 14; g++) {
      const c = new Chess();
      const hist: string[] = [];
      const len = 6 + Math.floor(rng.next() * 70);
      for (let i = 0; i < len && !c.isGameOver(); i++) {
        const m = c.move(rng.pick(c.moves()));
        hist.push(m.from + m.to + (m.promotion ?? ''));
      }
      if (c.isGameOver()) continue;
      const elo = elos[g % elos.length];
      const style = ALL_STYLES[g % ALL_STYLES.length];
      const mv = await chooseMove(eng, c.fen(), hist, { elo, style, openingStyles: STYLE_TO_OPENINGS[style] as Persona['openingStyles'], seed: g }, { thinkMs: 40, clock: g % 2 ? { myMs: 30000, incMs: 0, moveNumber: 30 } : undefined });
      const legal = c.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
      expect(legal, `elo ${elo} ${style} ${c.fen()}`).toContain(mv.uci);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  }, 60000);
  it('respects the clock budget', async () => {
    const fen = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';
    for (const elo of [1500, 2800, 3200]) {
      const clock = { myMs: 9000, incMs: 0, moveNumber: 40 }; // panic: ~225 ms
      const t0 = Date.now();
      const mv = await chooseMove(eng, fen, [], { elo, style: 'universal', openingStyles: [], seed: 1 }, { clock, startFen: fen });
      expect(Date.now() - t0, `elo ${elo}`).toBeLessThan(allocateTime(clock, 2000).totalMs + 400);
      expect(mv.uci).toMatch(/^[a-h][1-8][a-h][1-8]/);
    }
  });
});

describe('style influence (v0.3 model)', () => {
  const fen = '4k3/8/8/8/8/8/8/R3K3 w - - 0 1';
  const lines = [
    { multipv: 1, depth: 8, score: { cp: 20 }, pv: ['a1a2'] },
    { multipv: 2, depth: 8, score: { cp: 5 }, pv: ['a1a8'] }, // check, 1.4 win% worse: within tolerance
    { multipv: 3, depth: 8, score: { cp: -400 }, pv: ['e1d1'] },
  ];
  const rate = (style: 'attacker' | 'universal', elo: number) => {
    let n = 0;
    for (let k = 0; k < 4000; k++) if (sampleCandidate(lines, { elo, style, openingStyles: [], seed: k }, fen, createRng(k * 7919 + 1), 30) === 'a1a8') n++;
    return n / 4000;
  };
  it('a style measurably prefers its moves among playable candidates', () => {
    expect(rate('attacker', 1800) - rate('universal', 1800)).toBeGreaterThan(0.05);
  });
  it('never boosts the best line or moves outside the tolerance (cannot make a persona stronger)', () => {
    const ctx = { bestWin: 52, ply: 30 };
    const p = { elo: 1800, style: 'attacker' as const, openingStyles: [], seed: 1 };
    expect(styleShift(p, fen, 'a1a8', 0, ctx, 0)).toBe(0);
    expect(styleShift(p, fen, 'a1a8', 30, ctx, 0)).toBe(0);
    expect(styleShift(p, fen, 'a1a8', 1, ctx, 0)).toBeGreaterThan(0);
    expect(styleShift({ ...p, style: 'universal' }, fen, 'a1a8', 1, ctx, 0)).toBe(0);
  });
});
