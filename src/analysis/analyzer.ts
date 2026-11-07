import { Chess } from 'chess.js';
import type { UciEngine, Score } from '../engine/uci';
import { winPercent } from '../engine/uci';
import { ChessGame, START_FEN, parseUci } from '../chess/rules';
import { classifyMove, moveAccuracy, gameAccuracy, endgameLabel } from './classify';
import { identifyOpening } from '../chess/openings';
import type { GameAnalysis, MoveAnalysis, MoveClass } from '../game/state';

export type AnalysisOptions = { depth?: number; onProgress?: (done: number, total: number) => void; signal?: { cancelled: boolean } };

type PosEval = { score: Score; best: string | null; second: Score | null; pv: string[]; over: 'mate' | 'draw' | null };

function flip(s: Score): Score {
  return s.mate !== undefined ? { mate: -s.mate } : { cp: -(s.cp ?? 0) };
}

function sanLine(fen: string, uciLine: string[], max = 6): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of uciLine.slice(0, max)) {
    try {
      out.push(c.move(parseUci(u)).san);
    } catch {
      break;
    }
  }
  return out;
}

/**
 * Full post-game analysis. Each position is searched once at a fixed depth
 * with MultiPV 2, so results are reproducible for a given engine build and
 * depth (Stockfish is deterministic single-threaded at fixed depth after
 * `ucinewgame`).
 */
export async function analyseGame(
  engine: UciEngine,
  moves: string[],
  startFen: string = START_FEN,
  opts: AnalysisOptions = {},
): Promise<GameAnalysis | null> {
  const depth = opts.depth ?? 14;
  const g = new ChessGame(startFen);
  const fens: string[] = [g.fen()];
  const sans: string[] = [];
  const legalCounts: number[] = [];
  for (const u of moves) {
    legalCounts.push(g.legalMoves().length);
    const m = g.playUci(u);
    if (!m) break;
    sans.push(m.san);
    fens.push(g.fen());
  }
  await engine.newGame();
  const evals: PosEval[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (opts.signal?.cancelled) return null;
    const c = new Chess(fens[i]);
    if (c.isCheckmate()) evals.push({ score: { mate: 0 }, best: null, second: null, pv: [], over: 'mate' });
    else if (c.isStalemate() || c.isInsufficientMaterial()) evals.push({ score: { cp: 0 }, best: null, second: null, pv: [], over: 'draw' });
    else {
      const r = await engine.search({ fen: fens[i], depth, multipv: 2 });
      const l1 = r.lines.find((l) => l.multipv === 1);
      const l2 = r.lines.find((l) => l.multipv === 2);
      evals.push({ score: l1?.score ?? { cp: 0 }, best: r.bestmove, second: l2?.score ?? null, pv: l1?.pv ?? [], over: null });
    }
    opts.onProgress?.(i + 1, fens.length);
  }

  const opening = startFen === START_FEN ? identifyOpening(moves) : null;
  const bookPly = opening?.ply ?? 0;
  const out: MoveAnalysis[] = [];
  const winSeriesWhite: number[] = [];
  for (let i = 0; i < fens.length; i++) {
    const stmWhite = fens[i].split(' ')[1] === 'w';
    const e = evals[i];
    const w = e.over === 'mate' ? (stmWhite ? 0 : 100) : e.over === 'draw' ? 50 : stmWhite ? winPercent(e.score) : 100 - winPercent(e.score);
    winSeriesWhite.push(w);
  }
  const accs: { w: number[]; b: number[] } = { w: [], b: [] };
  const counts: GameAnalysis['counts'] = { w: {}, b: {} };
  for (let i = 0; i < sans.length; i++) {
    const moverWhite = fens[i].split(' ')[1] === 'w';
    const before = evals[i];
    const winBefore = moverWhite ? winSeriesWhite[i] : 100 - winSeriesWhite[i];
    const winAfter = moverWhite ? winSeriesWhite[i + 1] : 100 - winSeriesWhite[i + 1];
    const secondBestWin = before.second ? winPercent(before.second) : null;
    const after = evals[i + 1];
    const playedKeepsMate = after.over === 'mate' || (after.score.mate !== undefined && after.score.mate < 0);
    const cls: MoveClass = classifyMove({
      fenBefore: fens[i],
      uci: moves[i],
      bestUci: before.best ?? moves[i],
      winBefore,
      winAfter,
      secondBestWin,
      legalCount: legalCounts[i],
      inBook: i < bookPly,
      bestWasMate: before.score.mate !== undefined && before.score.mate > 0,
      playedKeepsMate,
    });
    const loss = Math.max(0, winBefore - winAfter);
    const acc = moveAccuracy(loss);
    (moverWhite ? accs.w : accs.b).push(acc);
    const side = moverWhite ? counts.w : counts.b;
    side[cls] = (side[cls] ?? 0) + 1;
    const evalBeforeWhite = before.over ? { cp: 0 } : moverWhite ? before.score : flip(before.score);
    const evalAfterWhite =
      after.over === 'mate' ? { mate: moverWhite ? 1 : -1 } : after.over === 'draw' ? { cp: 0 } : moverWhite ? flip(after.score) : after.score;
    out.push({
      ply: i,
      uci: moves[i],
      san: sans[i],
      evalBefore: evalBeforeWhite,
      evalAfter: evalAfterWhite,
      bestUci: before.best ?? moves[i],
      bestSan: before.best ? sanLine(fens[i], [before.best], 1)[0] ?? '' : sans[i],
      pv: sanLine(fens[i], before.pv, 6),
      winLoss: Math.round(loss * 10) / 10,
      accuracy: Math.round(acc * 10) / 10,
      cls,
    });
  }
  const swings = out
    .map((_m, i) => ({ i, d: Math.abs(winSeriesWhite[i + 1] - winSeriesWhite[i]) }))
    .filter((x) => x.d >= 12)
    .sort((a, b) => b.d - a.d)
    .slice(0, 4)
    .map((x) => x.i)
    .sort((a, b) => a - b);
  return {
    depth,
    engine: engine.name,
    moves: out,
    accuracy: {
      w: gameAccuracy(winSeriesWhite, accs.w),
      b: gameAccuracy(winSeriesWhite, accs.b),
    },
    counts,
    critical: swings,
    opening: opening ? { eco: opening.eco, name: opening.name } : null,
    endgame: endgameLabel(fens[fens.length - 1]),
  };
}

/** One-line explanation for a classified move (short by default). */
export function explainMove(m: MoveAnalysis): string {
  const fmt = (s: { cp?: number; mate?: number }) =>
    s.mate !== undefined ? `M${Math.abs(s.mate)}` : `${(s.cp ?? 0) >= 0 ? '+' : ''}${((s.cp ?? 0) / 100).toFixed(1)}`;
  switch (m.cls) {
    case 'brilliant':
      return `A sound sacrifice. ${m.san} keeps the advantage.`;
    case 'great':
      return `The only move that holds the position.`;
    case 'best':
      return `The engine's choice.`;
    case 'book':
      return `Opening theory.`;
    case 'forced':
      return `The only legal move.`;
    case 'miss':
      return m.evalBefore.mate !== undefined ? `Missed a forced mate: ${m.bestSan}.` : `Let the win slip. ${m.bestSan} was stronger.`;
    case 'blunder':
    case 'mistake':
    case 'inaccuracy':
      return `${m.bestSan} was better (${fmt(m.evalBefore)} → ${fmt(m.evalAfter)}).`;
    default:
      return `Fine. Best was ${m.bestSan}.`;
  }
}
