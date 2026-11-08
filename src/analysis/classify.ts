import { Chess } from 'chess.js';
import { PIECE_VALUES, parseUci } from '../chess/rules';
import type { MoveClass } from '../game/state';
import { lineMaterial, materialOffered, seeGain } from './material';
import { majorsAndMinors } from './material';

/**
 * Move classification & accuracy (the full model is documented here and in phase.ts, analyzer.ts, report.ts).
 *
 * All numbers are WIN PERCENTAGES from the mover's point of view, using the
 * Lichess logistic model on Stockfish centipawns (engine/uci.ts winPercent):
 *     win% = 50 + 50 · (2 / (1 + e^(−0.00368208 · cp)) − 1),   mate = 0 / 100.
 * Δ ("win% lost") = win% of the engine's best move − win% of the played move,
 * both taken from the SAME MultiPV search when the played move is one of the
 * candidates (so they are directly comparable), otherwise from the search of
 * the position after the move.
 *
 * Per-move accuracy (Lichess):  acc = 103.1668 · e^(−0.04354 · Δ) − 3.1669 + 1, clamped 0..100.
 * Game accuracy: mean of the volatility-weighted mean and the harmonic mean of
 * the move accuracies (Lichess); see gameAccuracy().
 *
 * Classes, checked in this order:
 *   forced      the only legal move.
 *   book        the position after the move is still in the identified opening line and Δ < 5.
 *   brilliant   ALL of:
 *                 · the best move, or Δ ≤ 2 (near-best);
 *                 · a real sacrifice: the move offers ≥ 2 pawns of material by static
 *                   exchange (the moved piece, or a piece newly left en prise), AND the
 *                   engine's main line confirms it: after the opponent's reply the mover is
 *                   ≥ 2 pawns down within 6 plies and still ≥ 1 pawn down at the end of the
 *                   line (≤ 8 plies) — or the line mates. Offers that are declined, or
 *                   regained at once, are not brilliant;
 *                 · not a recapture on the square the opponent just captured on;
 *                 · not already decided: NOT (win% before ≥ 90 and the 2nd-best move also ≥ 90),
 *                   and win% after the move ≥ 40 (the sacrifice must not lose).
 *   great       the best move AND the 2nd-best candidate is ≥ 15 win% worse (every
 *               alternative is a blunder), with win% before ≥ 25 (not already lost), not a
 *               recapture, not simply taking free material (a capture that wins ≥ 2 pawns
 *               by static exchange), not mate in one, and not a check evasion with ≤ 3
 *               legal moves.
 *   best        the engine's top move, or a MultiPV candidate within 1 win% of it.
 *   miss        a forced mate was available and the played move no longer mates (Δ ≥ 5),
 *               or a winning position (≥ 75%) dropped to ≤ 55%.
 *   excellent   Δ < 2
 *   good        Δ < 5
 *   inaccuracy  5 ≤ Δ < 10    (Lichess: 0.1 on the −1..1 scale)
 *   mistake     10 ≤ Δ < 15   (Lichess: 0.2)
 *   blunder     Δ ≥ 15        (Lichess: 0.3)
 */
export const THRESHOLDS = {
  best: 1,
  excellent: 2,
  good: 5,
  inaccuracy: 10,
  mistake: 15,
  greatGap: 15,
  greatMinWin: 25,
  missFrom: 75,
  missTo: 55,
  brilliantNear: 2,
  brilliantMinOffer: 2,
  brilliantDecided: 90,
  brilliantMinAfter: 40,
};

export function moveAccuracy(winLoss: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * Math.max(0, winLoss)) - 3.1669 + 1;
  return Math.max(0, Math.min(100, a));
}

export type ClassifyInput = {
  fenBefore: string;
  uci: string;
  bestUci: string;
  winBefore: number; // mover POV, value of the best move
  winAfter: number; // mover POV, value of the played move
  secondBestWin: number | null; // mover POV; null if there was no second candidate
  legalCount: number;
  inBook: boolean;
  bestWasMate: boolean;
  playedKeepsMate: boolean;
  /** True if the played move is one of the MultiPV candidates within THRESHOLDS.best of the top move. */
  playedIsTop?: boolean;
  /** Engine line starting with the played move (UCI) — required to verify sacrifices. */
  line?: string[];
  /** Destination square of the opponent's previous move if it was a capture (for recapture detection). */
  prevCaptureTo?: string | null;
};

export type Classified = { cls: MoveClass; loss: number; sacrificed: number; recapture: boolean; onlyMove: boolean; isBest: boolean };

export function classifyMove(i: ClassifyInput): MoveClass {
  return classifyDetailed(i).cls;
}

export function classifyDetailed(i: ClassifyInput): Classified {
  const loss = Math.max(0, i.winBefore - i.winAfter);
  const isBest = i.uci === i.bestUci || !!i.playedIsTop;
  const out = (cls: MoveClass, extra: Partial<Classified> = {}): Classified => ({ cls, loss, sacrificed: 0, recapture, onlyMove: false, isBest, ...extra });
  const recapture = !!i.prevCaptureTo && i.uci.slice(2, 4) === i.prevCaptureTo;
  if (i.legalCount === 1) return out('forced');
  if (i.inBook && loss < THRESHOLDS.good) return out('book');
  const sac = isBest || loss <= THRESHOLDS.brilliantNear ? verifiedSacrifice(i.fenBefore, i.uci, i.line) : 0;
  if (
    sac >= THRESHOLDS.brilliantMinOffer &&
    !recapture &&
    i.winAfter >= THRESHOLDS.brilliantMinAfter &&
    !(i.winBefore >= THRESHOLDS.brilliantDecided && (i.secondBestWin ?? 0) >= THRESHOLDS.brilliantDecided)
  )
    return out('brilliant', { sacrificed: sac });
  if (isBest) {
    const gap = i.secondBestWin === null ? 0 : i.winBefore - i.secondBestWin;
    if (gap >= THRESHOLDS.greatGap && i.winBefore >= THRESHOLDS.greatMinWin && !recapture && !isObvious(i.fenBefore, i.uci, i.legalCount))
      return out('great', { onlyMove: true });
    return out('best', { onlyMove: gap >= THRESHOLDS.greatGap });
  }
  if ((i.bestWasMate && !i.playedKeepsMate && loss >= 5) || (i.winBefore >= THRESHOLDS.missFrom && i.winAfter <= THRESHOLDS.missTo)) return out('miss');
  if (loss < THRESHOLDS.excellent) return out('excellent');
  if (loss < THRESHOLDS.good) return out('good');
  if (loss < THRESHOLDS.inaccuracy) return out('inaccuracy');
  if (loss < THRESHOLDS.mistake) return out('mistake');
  return out('blunder');
}

/**
 * "Obvious" only-moves that should not be called Great: taking free material
 * (a capture that nets ≥ 2 pawns by static exchange), mate in one, and check
 * evasions with at most three legal replies.
 */
export function isObvious(fen: string, uci: string, legalCount: number): boolean {
  const c = new Chess(fen);
  if (c.inCheck() && legalCount <= 3) return true;
  let m;
  try {
    m = c.move(parseUci(uci));
  } catch {
    return false;
  }
  if (c.isCheckmate()) return true; // mate in one is the obvious finish
  if (!m.captured) return false;
  const net = PIECE_VALUES[m.captured] - seeGain(c, m.to);
  return net >= 2;
}

/**
 * Static sacrifice detection (gate): ≥ 2 pawns of material offered by the
 * move (see material.ts materialOffered). Pawn moves count only through
 * pieces they leave en prise.
 */
export function isSacrifice(fen: string, uci: string): boolean {
  return materialOffered(fen, uci).offered >= THRESHOLDS.brilliantMinOffer;
}

/**
 * Sacrificed material in pawns (0 if not a verified sacrifice): static offer
 * ≥ 2 AND the engine line shows the deficit is real (≥ 2 after the reply
 * within 6 plies, ≥ 1 at the end of the line, or the line mates).
 */
export function verifiedSacrifice(fen: string, uci: string, line?: string[]): number {
  if (!line || line.length < 2 || line[0] !== uci) return 0;
  const { offered } = materialOffered(fen, uci);
  if (offered < THRESHOLDS.brilliantMinOffer) return 0;
  const lm = lineMaterial(fen, line);
  if (lm.deficitAfterReply < THRESHOLDS.brilliantMinOffer) return 0;
  if (lm.endDeficit < 1 && !lm.mates) return 0;
  return Math.max(offered, lm.deficitAfterReply);
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

/**
 * Final-position endgame label (≤ 4 non-pawn pieces). Kept for the ledger's
 * endgame achievements (game/ledger.ts reads these exact strings).
 */
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

export { majorsAndMinors };

/** Colours follow the White Imperial palette; glyphs are standard annotation symbols. */
export const CLASS_META: Record<MoveClass, { label: string; color: string; glyph: string }> = {
  brilliant: { label: 'Brilliant', color: '#1F9E93', glyph: '!!' },
  great: { label: 'Great', color: '#527EAA', glyph: '!' },
  best: { label: 'Best', color: '#5E9A48', glyph: '★' },
  excellent: { label: 'Excellent', color: '#7FAE4E', glyph: '✓' },
  good: { label: 'Good', color: '#9AA66A', glyph: '·' },
  book: { label: 'Book', color: '#B08A4E', glyph: '≡' },
  forced: { label: 'Forced', color: '#8E8E8E', glyph: '□' },
  inaccuracy: { label: 'Inaccuracy', color: '#D9A520', glyph: '?!' },
  mistake: { label: 'Mistake', color: '#DD7A2A', glyph: '?' },
  blunder: { label: 'Blunder', color: '#C0392B', glyph: '??' },
  miss: { label: 'Missed win', color: '#A92D3A', glyph: '✗' },
};

/** Shown instead of the class when a claim is low confidence (see confidence.ts). ∞ is the standard "unclear" symbol. */
export const UNCLEAR_META = { label: 'Unclear', color: '#8A8478', glyph: '∞' };

/** Label/colour/glyph to SHOW for a move: low-confidence claims are "Unclear", never presented as certain. */
export function displayClass(m: { cls: MoveClass; conf?: 'high' | 'medium' | 'low' }): { label: string; color: string; glyph: string; unclear: boolean } {
  const unclear = m.conf === 'low' && UNCLEAR_CLASSES.includes(m.cls);
  return unclear ? { ...UNCLEAR_META, unclear } : { ...CLASS_META[m.cls], unclear };
}
const UNCLEAR_CLASSES: MoveClass[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder', 'miss'];

/** Display order for summaries. */
export const CLASS_ORDER: MoveClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'forced', 'inaccuracy', 'mistake', 'blunder', 'miss'];
