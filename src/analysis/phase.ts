import { Chess } from 'chess.js';
import type { Phase } from './types';
import { majorsAndMinors } from './material';

/**
 * Game-phase detection (per position, then made monotone over the game):
 *  - endgame:    at most 6 queens/rooks/bishops/knights left in total (both sides)
 *                (the Lichess "Divider" endgame threshold);
 *  - opening:    still inside the identified book line, or before ply 20 (move 10) with more
 *                than 10 majors/minors on the board;
 *  - middlegame: otherwise.
 * Phases never go backwards: once the middlegame starts the opening is over,
 * and once the endgame starts it stays.
 */
export function phaseOf(fen: string, ply: number, bookPly = 0): Phase {
  const n = majorsAndMinors(new Chess(fen));
  if (n <= 6) return 'endgame';
  if (ply < bookPly || (ply < 20 && n > 10)) return 'opening';
  return 'middlegame';
}

const RANK: Record<Phase, number> = { opening: 0, middlegame: 1, endgame: 2 };

/** Phase of each position in `fens` (index = ply), monotone. */
export function phaseSeries(fens: string[], bookPly = 0): Phase[] {
  const out: Phase[] = [];
  let cur: Phase = 'opening';
  fens.forEach((f, i) => {
    const p = phaseOf(f, i, bookPly);
    if (RANK[p] > RANK[cur]) cur = p;
    out.push(cur);
  });
  return out;
}
