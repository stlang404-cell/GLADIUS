import { Chess, type Square } from 'chess.js';
import { PIECE_VALUES } from '../chess/rules';
import type { MoveClass } from '../game/state';

/**
 * Move classification & accuracy — documented thresholds (docs/ANALYSIS.md).
 *
 * Win% uses the Lichess logistic model (see engine/uci.ts winPercent).
 * Per-move accuracy (Lichess formula):
 *     acc = 103.1668 · e^(−0.04354 · Δwin%) − 3.1669   (+1 uncertainty bonus, clamped 0..100)
 * Classification by mover's win% lost (Δ):
 *     best        played the engine's top move
 *     excellent   Δ < 2
 *     good        Δ < 5
 *     inaccuracy  5 ≤ Δ < 10
 *     mistake     10 ≤ Δ < 15
 *     blunder     Δ ≥ 15
 *     miss        a winning position (≥ 75%) dropped to ≤ 55%, or a forced mate missed
 *     great       the top move when every alternative loses ≥ 15 points, in a position
 *                 that was not already decided (20% ≤ win% ≤ 92%)
 *     brilliant   a top (or within 1 point) piece sacrifice that keeps win% ≥ 50, played
 *                 from a position below 92% — sacrifices that merely trade, or that are
 *                 made when already completely winning, are NOT brilliant
 *     book        within the identified opening line and Δ < 5
 *     forced      the only legal move
 */

export const THRESHOLDS = { excellent: 2, good: 5, inaccuracy: 10, mistake: 15, greatGap: 15, missFrom: 75, missTo: 55 };

export function moveAccuracy(winLoss: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * Math.max(0, winLoss)) - 3.1669 + 1;
  return Math.max(0, Math.min(100, a));
}

export type ClassifyInput = {
  fenBefore: string;
  uci: string;
  bestUci: string;
  winBefore: number; // mover perspective, best play
  winAfter: number; // mover perspective after the played move
  secondBestWin: number | null; // mover perspective; null if only one candidate
  legalCount: number;
  inBook: boolean;
  bestWasMate: boolean;
  playedKeepsMate: boolean;
};

export function classifyMove(i: ClassifyInput): MoveClass {
  const loss = Math.max(0, i.winBefore - i.winAfter);
  if (i.legalCount === 1) return 'forced';
  if (i.inBook && loss < THRESHOLDS.good) return 'book';
  const isBest = i.uci === i.bestUci;
  if ((isBest || loss < 1) && i.winAfter >= 50 && i.winBefore < 92 && isSacrifice(i.fenBefore, i.uci)) return 'brilliant';
  if (isBest) {
    if (
      i.secondBestWin !== null &&
      i.winBefore - i.secondBestWin >= THRESHOLDS.greatGap &&
      i.winBefore >= 20 &&
      i.winBefore <= 92
    )
      return 'great';
    return 'best';
  }
  if ((i.bestWasMate && !i.playedKeepsMate && loss >= 5) || (i.winBefore >= THRESHOLDS.missFrom && i.winAfter <= THRESHOLDS.missTo))
    return 'miss';
  if (loss < THRESHOLDS.excellent) return 'excellent';
  if (loss < THRESHOLDS.good) return 'good';
  if (loss < THRESHOLDS.inaccuracy) return 'inaccuracy';
  if (loss < THRESHOLDS.mistake) return 'mistake';
  return 'blunder';
}

/**
 * Sacrifice detection: after the move, the moved piece (not a pawn or king)
 * can be captured by the opponent and the exchange loses material for the
 * mover — i.e. it lands on an attacked square that is either undefended or
 * attacked by a cheaper piece, net of anything it captured.
 */
export function isSacrifice(fen: string, uci: string): boolean {
  const c = new Chess(fen);
  let m;
  try {
    m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return false;
  }
  if (m.piece === 'p' || m.piece === 'k') return false;
  const piece = (m.promotion ?? m.piece) as keyof typeof PIECE_VALUES;
  const value = PIECE_VALUES[piece];
  const gained = m.captured ? PIECE_VALUES[m.captured] : 0;
  if (gained >= value) return false;
  const to = m.to as Square;
  const opp = c.turn();
  const attackers = c.attackers(to, opp);
  if (attackers.length === 0) return false;
  const defenders = c.attackers(to, opp === 'w' ? 'b' : 'w');
  const cheapest = Math.min(
    ...attackers.map((sq) => {
      const p = c.get(sq);
      return p ? (p.type === 'k' ? 100 : PIECE_VALUES[p.type]) : 100;
    }),
  );
  if (cheapest === 100 && defenders.length > 0) return false; // only the king attacks a defended piece
  const netLoss = defenders.length === 0 ? value - gained : Math.max(0, value - cheapest) - gained;
  return netLoss >= 2;
}

/** Lichess-style game accuracy: mean of volatility-weighted mean and harmonic mean. */
export function gameAccuracy(winSeries: number[], moveAccs: number[]): number {
  if (moveAccs.length === 0) return 100;
  const n = winSeries.length;
  const win = Math.max(2, Math.min(8, Math.floor(n / 10)));
  const weights: number[] = [];
  for (let i = 0; i < moveAccs.length; i++) {
    const lo = Math.max(0, Math.min(i, n - win));
    const slice = winSeries.slice(lo, lo + win);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
    weights.push(Math.max(0.5, Math.min(12, sd)));
  }
  const wsum = weights.reduce((a, b) => a + b, 0);
  const weighted = moveAccs.reduce((a, acc, i) => a + acc * weights[i], 0) / wsum;
  const harmonic = moveAccs.length / moveAccs.reduce((a, acc) => a + 1 / Math.max(acc, 1), 0);
  return Math.round(((weighted + harmonic) / 2) * 10) / 10;
}

export function endgameLabel(fen: string): string | null {
  const c = new Chess(fen);
  const count: Record<string, number> = { q: 0, r: 0, b: 0, n: 0, p: 0 };
  let pieces = 0;
  for (const row of c.board())
    for (const sq of row)
      if (sq && sq.type !== 'k') {
        count[sq.type]++;
        if (sq.type !== 'p') pieces++;
      }
  if (pieces > 4) return null;
  if (pieces === 0) return count.p ? 'King and pawn endgame' : 'Bare kings';
  if (count.q && !count.r && !count.b && !count.n) return 'Queen endgame';
  if (count.r && !count.q && !count.b && !count.n) return 'Rook endgame';
  if (!count.q && !count.r) return count.b && count.n ? 'Minor-piece endgame' : count.b ? 'Bishop endgame' : 'Knight endgame';
  return 'Mixed endgame';
}

export const CLASS_META: Record<MoveClass, { label: string; color: string; glyph: string }> = {
  brilliant: { label: 'Brilliant', color: '#1fb5a8', glyph: '!!' },
  great: { label: 'Great', color: '#3d7fd9', glyph: '!' },
  best: { label: 'Best', color: '#6aa84f', glyph: '★' },
  excellent: { label: 'Excellent', color: '#8bbf4a', glyph: '✓' },
  good: { label: 'Good', color: '#a8b56b', glyph: '·' },
  book: { label: 'Book', color: '#b08d57', glyph: '📖' },
  forced: { label: 'Forced', color: '#9a9a9a', glyph: '□' },
  inaccuracy: { label: 'Inaccuracy', color: '#e6b422', glyph: '?!' },
  mistake: { label: 'Mistake', color: '#e07b24', glyph: '?' },
  blunder: { label: 'Blunder', color: '#d0312d', glyph: '??' },
  miss: { label: 'Missed win', color: '#c2417a', glyph: '✗' },
};
