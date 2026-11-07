import { Chess, type Move } from 'chess.js';
import { parseUci } from '../chess/rules';
import type { UciEngine, Score } from '../engine/uci';

/**
 * Exploring alternative lines on the analysis board (finished games only —
 * the Review view refuses games in progress, see integrity.ts).
 */
export type VarStep = { uci: string; san: string; fen: string; move: Move };

/** Replay a variation from `fen`; stops at the first illegal move (returns the legal prefix). */
export function playVariation(fen: string, ucis: string[]): VarStep[] {
  const c = new Chess(fen);
  const out: VarStep[] = [];
  for (const u of ucis) {
    let m: Move;
    try {
      m = c.move(parseUci(u));
    } catch {
      break;
    }
    out.push({ uci: u, san: m.san, fen: c.fen(), move: m });
  }
  return out;
}

export type PositionEval = { eval: Score /* White POV */; best: string | null; line: string[] /* SAN */; depth: number; over: 'mate' | 'draw' | null };

/** Evaluate one position with the analysis engine (White's point of view). */
export async function evaluatePosition(engine: UciEngine, fen: string, depth = 14, signal?: AbortSignal): Promise<PositionEval> {
  const c = new Chess(fen);
  const whiteToMove = c.turn() === 'w';
  if (c.isCheckmate()) return { eval: { mate: whiteToMove ? -1 : 1 }, best: null, line: [], depth: 0, over: 'mate' };
  if (c.isDraw() || c.isStalemate()) return { eval: { cp: 0 }, best: null, line: [], depth: 0, over: 'draw' };
  const r = await engine.search({ fen, depth, multipv: 1, signal });
  const l = r.lines.find((x) => x.multipv === 1) ?? r.lines[0];
  const s = l?.score ?? { cp: 0 };
  const white: Score = whiteToMove ? s : s.mate !== undefined ? { mate: -s.mate } : { cp: -(s.cp ?? 0) };
  const line = playVariation(fen, l?.pv?.slice(0, 8) ?? []).map((x) => x.san);
  return { eval: white, best: r.bestmove, line, depth: l?.depth ?? depth, over: null };
}
