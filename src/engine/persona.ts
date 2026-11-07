import { Chess } from 'chess.js';
import type { UciEngine, PvLine } from './uci';
import { winPercent } from './uci';
import { bookMoves, type OpeningStyle } from '../chess/openings';
import { createRng, clamp, type Rng } from '../core/rng';

/**
 * Opponent strength model.
 *
 * Research notes (see docs/RESEARCH.md):
 *  - Simply limiting search depth makes an engine play "inhumanly" — perfect
 *    tactics two plies deep, then absurd strategic moves. Skill-Level style
 *    weakening (sampling among MultiPV candidates by a temperature) produces
 *    more human error distributions; Stockfish's own Skill Level works this way.
 *  - Human average centipawn loss falls roughly exponentially with rating
 *    (~120+ ACPL for novices, ~60 at 1400, ~30 at 2000, ~15 at 2500).
 *  - Stockfish's UCI_LimitStrength/UCI_Elo (1320–3190) is calibrated against
 *    engine rating lists at a 120s+1s control, not FIDE; we use it only in the
 *    expert band and treat the mapping as approximate.
 *
 * Bands:
 *   elo < 3000  : GLADIUS sampler (MultiPV candidates, win%-loss softmax,
 *                 occasional "oversight" picks, style bias, depth by Elo),
 *                 calibrated to accuracy targets per rating band.
 *   ≥ 3000      : unrestricted Stockfish with a longer search budget.
 *  We benchmarked UCI_LimitStrength (lite net, sub-second budgets) and found
 *  its error rate non-monotone against our ladder, so it is not used.
 */

import { type PlayStyle, STYLE_TO_OPENINGS } from './styles';
export type { PlayStyle };
export { STYLE_TO_OPENINGS };

export type Persona = {
  elo: number;
  style: PlayStyle;
  openingStyles: OpeningStyle[];
  seed: number;
};

export type MoveChoice = { uci: string; source: 'book' | 'sampler' | 'limited' | 'full'; thinkMs: number };


/** Piecewise-linear interpolation over Elo knots. */
function interp(knots: [number, number][], elo: number): number {
  if (elo <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    const [x1, y1] = knots[i];
    const [x0, y0] = knots[i - 1];
    if (elo <= x1) return y0 + ((y1 - y0) * (elo - x0)) / (x1 - x0);
  }
  return knots[knots.length - 1][1];
}

// Calibrated by tests/bench/calibration.test.ts (see docs/ENGINE.md).
export const TEMPERATURE_KNOTS: [number, number][] = [[400, 45], [800, 30], [1200, 18], [1600, 10], [2000, 8], [2400, 5], [2800, 1.8], [3000, 0.5]];
export const OVERSIGHT_KNOTS: [number, number][] = [[400, 0.26], [800, 0.15], [1200, 0.07], [1600, 0.03], [2000, 0.012], [2400, 0.004], [2800, 0]];

export function samplerDepth(elo: number): number {
  return elo < 1000 ? 4 : elo < 1600 ? 6 : elo < 2200 ? 8 : elo < 2700 ? 10 : 12;
}
export function samplerMultiPv(elo: number): number {
  return elo < 1200 ? 40 : elo < 2000 ? 16 : elo < 2600 ? 10 : 6;
}
/** Softmax temperature in win-percentage points. Higher = more mistakes. */
export function samplerTemperature(elo: number): number {
  return interp(TEMPERATURE_KNOTS, elo);
}
/** Probability of an "oversight": choosing uniformly among candidates. */
export function oversightChance(elo: number): number {
  return interp(OVERSIGHT_KNOTS, elo);
}

export function bookDepth(elo: number): number {
  return clamp(Math.round(2 + elo / 180), 2, 18);
}

function styleBonus(style: PlayStyle, fen: string, uci: string): number {
  const c = new Chess(fen);
  let m;
  try {
    m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return 0;
  }
  const check = c.isCheck();
  const capture = !!m.captured;
  const castle = m.isKingsideCastle() || m.isQueensideCastle();
  const pawnPush = m.piece === 'p' && !capture;
  switch (style) {
    case 'aggressive':
      return (check ? 2 : 0) + (capture ? 1 : 0) + (pawnPush && 'fgh'.includes(m.from[0]) ? 0.8 : 0);
    case 'tactical':
      return (check ? 1.5 : 0) + (capture ? 1.5 : 0);
    case 'positional':
      return (castle ? 1.5 : 0) + (!capture && !check && m.piece !== 'q' ? 0.6 : 0);
    case 'solid':
      return (castle ? 2 : 0) + (capture && m.captured === m.piece ? 1 : 0);
    case 'defensive':
      return (castle ? 2 : 0) + (m.piece === 'k' ? -0.5 : 0) + (!capture ? 0.3 : 0);
    default:
      return 0;
  }
}

/** Pure selection step of the sampler, separated for testing. */
export function sampleCandidate(
  lines: PvLine[],
  persona: Persona,
  fen: string,
  rng: Rng,
): string | null {
  const cands = lines.filter((l) => l.pv.length > 0);
  if (cands.length === 0) return null;
  const wins = cands.map((l) => winPercent(l.score));
  const best = Math.max(...wins);
  const T = samplerTemperature(persona.elo);
  // Style matters more for weaker players; strong players play the position.
  const styleScale = clamp(1.2 - persona.elo / 2200, 0.15, 1);
  if (rng.chance(oversightChance(persona.elo))) {
    // Weaker players' oversights can be any legal move (hung pieces, missed threats).
    if (persona.elo < 1600) {
      const legal = new Chess(fen).moves({ verbose: true });
      if (legal.length) {
        const m = rng.pick(legal);
        return m.from + m.to + (m.promotion ?? '');
      }
    }
    return rng.pick(cands).pv[0];
  }
  const weights = cands.map((l, i) => {
    const loss = best - wins[i];
    const bonus = styleBonus(persona.style, fen, l.pv[0]) * styleScale;
    return Math.exp(-(loss - bonus) / T);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i];
    if (r <= 0) return cands[i].pv[0];
  }
  return cands[0].pv[0];
}

/** Natural "thinking" delay so opponents feel human; never blocks input. */
export function humanDelay(elo: number, ply: number, rng: Rng, pace: 'instant' | 'natural'): number {
  if (pace === 'instant') return 150;
  const base = ply < 10 ? 350 : 700 + Math.min(1400, elo / 2);
  return Math.round(base * (0.6 + rng.next() * 0.9));
}

export async function chooseMove(
  engine: UciEngine,
  fen: string,
  history: string[],
  persona: Persona,
  opts: { pace?: 'instant' | 'natural'; startFen?: string } = {},
): Promise<MoveChoice> {
  const rng = createRng((persona.seed ^ (history.length * 2654435761)) >>> 0);
  const t0 = Date.now();
  const elapsed = () => Date.now() - t0;
  const ply = history.length;

  // 1) Opening preparation from the book (style-weighted). Only from the standard start.
  if (!opts.startFen && ply < bookDepth(persona.elo)) {
    const book = bookMoves(history, persona.openingStyles);
    if (book.length) {
      const total = book.reduce((a, b) => a + b.weight, 0);
      let r = rng.next() * total;
      for (const b of book) {
        r -= b.weight;
        if (r <= 0) return { uci: b.uci, source: 'book', thinkMs: elapsed() };
      }
      return { uci: book[0].uci, source: 'book', thinkMs: elapsed() };
    }
  }

  if (persona.elo < 3000) {
    const res = await engine.search({ fen, depth: samplerDepth(persona.elo), multipv: samplerMultiPv(persona.elo) });
    const pick = sampleCandidate(res.lines, persona, fen, rng) ?? res.bestmove;
    return { uci: pick!, source: 'sampler', thinkMs: elapsed() };
  }
  const res = await engine.search({ fen, movetime: 1500 });
  return { uci: res.bestmove!, source: 'full', thinkMs: elapsed() };
}
