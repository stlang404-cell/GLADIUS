import { describe, it, expect } from 'vitest';
import { Chess, type Move } from 'chess.js';
import { OPENINGS, identifyOpening, bookMoves, openingFamily } from '../src/chess/openings';
import { ENDGAME_DRILLS } from '../src/chess/endgames';
import { BUILTIN_PUZZLES } from '../src/chess/puzzles';
import { parseUci, moveToUci } from '../src/chess/rules';

function play(chess: Chess, uci: string): Move {
  return chess.move(parseUci(uci)); // throws on illegal move
}

function sanToUci(san: string): string[] {
  const c = new Chess();
  return san.split(/\s+/).map((m) => moveToUci(c.move(m)));
}

/** Side to move forces mate within n moves. */
function forcesMate(c: Chess, n: number): boolean {
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    let ok: boolean;
    if (c.isCheckmate()) ok = true;
    else if (n === 1 || c.isGameOver()) ok = false;
    else {
      ok = true;
      for (const r of c.moves({ verbose: true })) {
        c.move(r);
        const s = forcesMate(c, n - 1);
        c.undo();
        if (!s) {
          ok = false;
          break;
        }
      }
    }
    c.undo();
    if (ok) return true;
  }
  return false;
}

/** All first moves that force mate within n moves. */
function mateFirstMoves(fen: string, n: number): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    let ok: boolean;
    if (c.isCheckmate()) ok = true;
    else if (n === 1 || c.isGameOver()) ok = false;
    else {
      ok = true;
      for (const r of c.moves({ verbose: true })) {
        c.move(r);
        const s = forcesMate(c, n - 1);
        c.undo();
        if (!s) {
          ok = false;
          break;
        }
      }
    }
    c.undo();
    if (ok) out.push(moveToUci(m));
  }
  return out;
}

describe('opening book', () => {
  it('has at least 180 lines with sane metadata', () => {
    expect(OPENINGS.length).toBeGreaterThanOrEqual(180);
    for (const o of OPENINGS) {
      expect(o.eco).toMatch(/^[A-E]\d\d$/);
      expect(o.uci.length).toBeGreaterThanOrEqual(2);
      expect(o.uci.length).toBeLessThanOrEqual(14);
      expect(o.weight).toBeGreaterThanOrEqual(1);
      expect(o.weight).toBeLessThanOrEqual(10);
      expect(o.styles.length).toBeGreaterThan(0);
      expect(o.name).not.toMatch(/Defense/); // British spelling
    }
  });

  it('every line is legal', () => {
    for (const o of OPENINGS) {
      const c = new Chess();
      for (const m of o.uci) expect(() => play(c, m), `${o.name}: ${m}`).not.toThrow();
    }
  });

  it('has no duplicate (eco, name) pairs', () => {
    const seen = new Map<string, string>();
    for (const o of OPENINGS) {
      const k = `${o.eco}|${o.name}`;
      expect(seen.has(k), k).toBe(false);
      seen.set(k, o.uci.join(' '));
    }
  });

  it('identifies the Najdorf', () => {
    const r = identifyOpening(sanToUci('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'));
    expect(r?.eco).toBe('B90');
    expect(r?.name).toBe('Sicilian Defence: Najdorf Variation');
    expect(r?.ply).toBe(10);
  });

  it('keeps the deepest hit when the game leaves the book', () => {
    const r = identifyOpening(sanToUci('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3'));
    expect(r?.name).toBe('Sicilian Defence: Najdorf Variation, English Attack');
    expect(r?.ply).toBe(11);
  });

  it('recognises transpositions by position', () => {
    const r = identifyOpening(sanToUci('Nf3 d5 d4'));
    expect(r?.eco).toBe('D02');
    expect(openingFamily(r!.name)).toBe("Queen's Pawn Game");
    // French Rubinstein reached via the Tarrasch move order
    const fr = identifyOpening(sanToUci('e4 e6 d4 d5 Nd2 dxe4 Nxe4'));
    expect(fr?.name).toBe('French Defence: Rubinstein Variation');
    // QGD reached from 1.Nf3
    const q = identifyOpening(sanToUci('Nf3 Nf6 c4 e6 Nc3 d5 d4'));
    expect(q?.name).toBe("Queen's Gambit Declined: Three Knights Variation");
  });

  it('returns null for an empty or unknown game', () => {
    expect(identifyOpening([])).toBeNull();
    expect(identifyOpening(sanToUci('h4 h5'))).toBeNull();
  });

  it('bookMoves returns legal, merged, style-weighted moves', () => {
    const start = bookMoves([]);
    expect(start.length).toBeGreaterThan(5);
    const ucis = start.map((m) => m.uci);
    expect(new Set(ucis).size).toBe(ucis.length);
    expect(ucis).toContain('e2e4');
    expect(ucis).toContain('d2d4');

    const hist = sanToUci('e4 e5 Nf3 Nc6');
    const plain = bookMoves(hist);
    const gambit = bookMoves(hist, ['gambit']);
    for (const m of plain) {
      const c = new Chess();
      for (const h of hist) play(c, h);
      expect(() => play(c, m.uci)).not.toThrow();
      expect(m.weight).toBeGreaterThan(0);
      expect(m.name.length).toBeGreaterThan(0);
    }
    const w = (list: typeof plain, u: string) => list.find((m) => m.uci === u)?.weight ?? 0;
    expect(w(gambit, 'd2d4')).toBeGreaterThan(w(plain, 'd2d4')); // Scotch Gambit / Göring
    for (const m of plain) expect(w(gambit, m.uci)).toBeGreaterThanOrEqual(m.weight);
  });

  it('bookMoves works by position and handles illegal or out-of-book history', () => {
    const a = bookMoves(sanToUci('Nf3 d5 d4')).map((m) => m.uci).sort();
    const b = bookMoves(sanToUci('d4 d5 Nf3')).map((m) => m.uci).sort();
    expect(a).toEqual(b);
    expect(bookMoves(['e2e5'])).toEqual([]);
    expect(bookMoves(sanToUci('a3 h5 h3 a6'))).toEqual([]);
  });

  it('openingFamily strips the variation', () => {
    expect(openingFamily('Sicilian Defence: Najdorf Variation')).toBe('Sicilian Defence');
    expect(openingFamily('Ruy Lopez: Berlin Defence, Berlin Wall')).toBe('Ruy Lopez');
    expect(openingFamily('Scotch Game')).toBe('Scotch Game');
  });
});

describe('endgame drills', () => {
  it('has at least 24 valid drills', () => {
    expect(ENDGAME_DRILLS.length).toBeGreaterThanOrEqual(24);
    const ids = new Set<string>();
    for (const d of ENDGAME_DRILLS) {
      expect(ids.has(d.id)).toBe(false);
      ids.add(d.id);
      const c = new Chess(d.fen);
      expect(c.isGameOver(), d.id).toBe(false);
      expect(c.moves().length).toBeGreaterThan(0);
      expect(d.hint.length, d.id).toBeLessThanOrEqual(90);
      expect(['win', 'draw']).toContain(d.goal);
    }
  });
});

describe('puzzles', () => {
  it('has at least 40 puzzles with legal solutions', () => {
    expect(BUILTIN_PUZZLES.length).toBeGreaterThanOrEqual(40);
    const ids = new Set<string>();
    for (const p of BUILTIN_PUZZLES) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.solution.length % 2, p.id).toBe(1); // ends on a trainee move
      const c = new Chess(p.fen);
      expect(c.isGameOver()).toBe(false);
      for (const m of p.solution) expect(() => play(c, m), `${p.id}: ${m}`).not.toThrow();
    }
  });

  it('mate puzzles end in checkmate and have a unique first move', () => {
    let mates = 0;
    for (const p of BUILTIN_PUZZLES) {
      const c = new Chess(p.fen);
      for (const m of p.solution) play(c, m);
      if (!c.isCheckmate()) continue;
      mates++;
      const n = (p.solution.length + 1) / 2;
      expect(mateFirstMoves(p.fen, n), p.id).toEqual([p.solution[0]]);
      if (n > 1) expect(mateFirstMoves(p.fen, n - 1), p.id).toEqual([]);
    }
    expect(mates).toBeGreaterThanOrEqual(30);
  });
});
