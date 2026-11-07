import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { PIECE_VALUES, parseUci } from '../chess/rules';

/** Pawn-unit value; the king is "infinite" for attacker ordering only. */
export function pieceValue(t: PieceSymbol): number {
  return PIECE_VALUES[t];
}

export const PIECE_NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/** Material balance (pawn units) from `color`'s point of view. */
export function materialFor(c: Chess, color: Color): number {
  let s = 0;
  for (const row of c.board()) for (const sq of row) if (sq) s += (sq.color === color ? 1 : -1) * PIECE_VALUES[sq.type];
  return s;
}

/** Non-pawn, non-king pieces on the board (both sides). */
export function majorsAndMinors(c: Chess): number {
  let n = 0;
  for (const row of c.board()) for (const sq of row) if (sq && sq.type !== 'p' && sq.type !== 'k') n++;
  return n;
}

/**
 * Static exchange evaluation: the best net material (pawn units, ≥ 0) the
 * side to move can win by starting a capture sequence on `sq`, where each
 * side always recaptures with its least valuable piece and may stop at any
 * time. Uses chess.js legal moves, so pins, x-rays (a piece behind a
 * capturer joins once the front piece has moved) and king safety are exact.
 */
export function seeGain(c: Chess, sq: Square): number {
  const target = c.get(sq);
  if (!target) return 0;
  const caps = c.moves({ verbose: true }).filter((m) => m.to === sq && m.captured && !m.isEnPassant() && (!m.promotion || m.promotion === 'q'));
  if (caps.length === 0) return 0;
  const order = (m: Move) => (m.piece === 'k' ? 100 : PIECE_VALUES[m.piece]);
  caps.sort((a, b) => order(a) - order(b));
  const m = caps[0];
  c.move(m);
  const promo = m.promotion ? PIECE_VALUES[m.promotion] - 1 : 0;
  const v = PIECE_VALUES[target.type] + promo - seeGain(c, sq);
  c.undo();
  return Math.max(0, v);
}

/** Largest SEE gain available to the side to move against any enemy piece. */
export function maxHanging(c: Chess, exclude?: Square): { gain: number; square: Square | null; piece: PieceSymbol | null } {
  const seen = new Set<string>();
  let best = { gain: 0, square: null as Square | null, piece: null as PieceSymbol | null };
  for (const m of c.moves({ verbose: true })) {
    if (!m.captured || seen.has(m.to) || m.to === exclude) continue;
    seen.add(m.to);
    const g = seeGain(c, m.to);
    if (g > best.gain) best = { gain: g, square: m.to, piece: m.captured };
  }
  return best;
}

/** FEN with the side to move flipped (null-move), or null if that would be illegal (side to move in check). */
export function nullMoveFen(fen: string): string | null {
  const c = new Chess(fen);
  if (c.inCheck()) return null;
  const p = fen.split(' ');
  p[1] = p[1] === 'w' ? 'b' : 'w';
  p[3] = '-';
  const f = p.join(' ');
  try {
    const n = new Chess(f);
    return n.inCheck() ? null : f; // the other side would be "in check" with the mover to move: illegal
  } catch {
    return null;
  }
}

/**
 * Material offered by a move (static): the larger of
 *  (a) the SEE loss of the moved piece on its destination, net of anything it captured, and
 *  (b) material newly left en prise elsewhere (opponent's best SEE capture after the move minus
 *      the best capture the opponent already had before it, measured with a null move).
 * Returns 0 for illegal moves.
 */
export function materialOffered(fen: string, uci: string): { offered: number; move: Move | null } {
  const c = new Chess(fen);
  let m: Move;
  try {
    m = c.move(parseUci(uci));
  } catch {
    return { offered: 0, move: null };
  }
  const gained = m.captured ? PIECE_VALUES[m.captured] : 0;
  const onTo = seeGain(c, m.to) - gained - (m.promotion ? PIECE_VALUES[m.promotion] - 1 : 0);
  const after = maxHanging(c, m.to).gain;
  const nf = nullMoveFen(fen);
  const before = nf ? maxHanging(new Chess(nf)).gain : 0;
  const elsewhere = nf ? after - before : 0;
  return { offered: Math.max(onTo, elsewhere, 0), move: m };
}

/**
 * Material balance along an engine line (UCI, starting with the mover's
 * move) relative to the starting position, from the mover's point of view.
 * `deficitAfterReply` = worst deficit measured after the opponent's replies
 * within the first 6 plies; `endDeficit` = the smaller deficit of the last two
 * plies (≤ 8), so a line cut mid-exchange is not counted as a loss;
 * `mates` = the line ends in checkmate delivered by the mover.
 */
export function lineMaterial(fen: string, line: string[]): { deficitAfterReply: number; endDeficit: number; mates: boolean; plies: number } {
  const c = new Chess(fen);
  const me = c.turn();
  const b0 = materialFor(c, me);
  const defs: number[] = [];
  let worstReply = 0;
  let plies = 0;
  for (const u of line.slice(0, 8)) {
    try {
      c.move(parseUci(u));
    } catch {
      break;
    }
    plies++;
    const d = b0 - materialFor(c, me);
    defs.push(d);
    if (plies % 2 === 0 && plies <= 6) worstReply = Math.max(worstReply, d);
    if (c.isGameOver()) break;
  }
  const mates = c.isCheckmate() && c.turn() !== me;
  const endDeficit = defs.length === 0 ? 0 : defs.length === 1 ? defs[0] : Math.min(defs[defs.length - 1], defs[defs.length - 2]);
  return { deficitAfterReply: worstReply, endDeficit, mates, plies };
}
