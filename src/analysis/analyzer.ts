import { Chess, type Move } from 'chess.js';
import type { UciEngine, Score } from '../engine/uci';
import { winPercent } from '../engine/uci';
import { ChessGame, START_FEN, parseUci } from '../chess/rules';
import { classifyDetailed, moveAccuracy, gameAccuracy, endgameLabel } from './classify';
import { identifyOpening } from '../chess/openings';
import { endgameType } from '../chess/endgames';
import type { MoveClass, TrainingPosition } from '../game/state';
import { ANALYSIS_VERSION, PHASES, type AltLine, type GameAnalysisX, type MoveAnalysisX, type MoveTag, type Phase, type PhaseStat, type PuzzleCandidate } from './types';
import { lineMaterial, seeGain, PIECE_NAME } from './material';
import { phaseSeries } from './phase';

export type AnalysisOptions = {
  depth?: number;
  /** Candidate lines per position (analysis only — never used in rated play). Default 3. */
  multipv?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: { cancelled: boolean };
  /** Side whose real mistakes become verified training puzzles (null/undefined: none). */
  trainSide?: 'w' | 'b' | null;
  maxPuzzles?: number;
};

type Cand = { uci: string; score: Score; pv: string[] };
type PosEval = { score: Score; best: string | null; lines: Cand[]; pv: string[]; over: 'mate' | 'draw' | null };

/** Puzzle uniqueness: the solution must beat the 2nd-best move by ≥ 10 win% (or be the only mate). */
export const PUZZLE_MARGIN = 10;
/** The solution must leave the trainee at ≥ 35 win% (no "find the least bad move" puzzles). */
export const PUZZLE_MIN_WIN = 35;

function flip(s: Score): Score {
  return s.mate !== undefined ? { mate: -s.mate } : { cp: -(s.cp ?? 0) };
}

export function sanLine(fen: string, uciLine: string[], max = 6): string[] {
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

const isMateFor = (s: Score | undefined) => !!s && s.mate !== undefined && s.mate > 0;

/** Is `a` uniquely best compared with `b` (both side-to-move scores)? Returns the margin or null. */
export function uniqueMargin(a: Score, b: Score | null): number | null {
  if (!b) return 100;
  const m = winPercent(a) - winPercent(b);
  if (isMateFor(a) && !isMateFor(b)) return Math.max(m, PUZZLE_MARGIN);
  if (isMateFor(a) && isMateFor(b)) return null; // two mates: not unique enough
  return m >= PUZZLE_MARGIN ? m : null;
}

/**
 * Full post-game analysis. Each position is searched once at a fixed depth
 * with MultiPV 3 (top three candidates), so results are reproducible for a
 * given engine build and depth (Stockfish is deterministic single-threaded at
 * fixed depth after `ucinewgame`). Puzzle candidates from `trainSide`'s
 * mistakes get up to two extra MultiPV-2 searches each to verify that every
 * trainee move in the solution is unique.
 */
export async function analyseGame(
  engine: UciEngine,
  moves: string[],
  startFen: string = START_FEN,
  opts: AnalysisOptions = {},
): Promise<GameAnalysisX | null> {
  const depth = opts.depth ?? 14;
  const multipv = Math.max(1, opts.multipv ?? 3);
  const g = new ChessGame(startFen);
  const fens: string[] = [g.fen()];
  const sans: string[] = [];
  const legalCounts: number[] = [];
  const moveObjs: Move[] = [];
  {
    const c = new Chess(startFen);
    for (const u of moves) {
      legalCounts.push(c.moves().length);
      let m: Move;
      try {
        m = c.move(parseUci(u));
      } catch {
        break;
      }
      moveObjs.push(m);
      sans.push(m.san);
      fens.push(c.fen());
    }
  }
  const n = sans.length;
  await engine.newGame();
  const evals: PosEval[] = [];
  const total = fens.length + 1;
  for (let i = 0; i < fens.length; i++) {
    if (opts.signal?.cancelled) return null;
    const c = new Chess(fens[i]);
    if (c.isCheckmate()) evals.push({ score: { mate: 0 }, best: null, lines: [], pv: [], over: 'mate' });
    else if (c.isStalemate() || c.isInsufficientMaterial()) evals.push({ score: { cp: 0 }, best: null, lines: [], pv: [], over: 'draw' });
    else {
      const r = await engine.search({ fen: fens[i], depth, multipv });
      const lines = [...r.lines]
        .filter((l) => l.pv.length > 0)
        .sort((a, b) => a.multipv - b.multipv)
        .map((l) => ({ uci: l.pv[0], score: l.score, pv: l.pv }));
      const l1 = lines[0];
      evals.push({ score: l1?.score ?? { cp: 0 }, best: r.bestmove ?? l1?.uci ?? null, lines, pv: l1?.pv ?? [], over: null });
    }
    opts.onProgress?.(i + 1, total);
  }

  const opening = startFen === START_FEN ? identifyOpening(moves.slice(0, n)) : null;
  const bookPly = opening?.ply ?? 0;
  const phases = phaseSeries(fens, bookPly);
  const winSeriesWhite: number[] = fens.map((f, i) => {
    const stmWhite = f.split(' ')[1] === 'w';
    const e = evals[i];
    return e.over === 'mate' ? (stmWhite ? 0 : 100) : e.over === 'draw' ? 50 : stmWhite ? winPercent(e.score) : 100 - winPercent(e.score);
  });
  const out: MoveAnalysisX[] = [];
  const accs: { w: number[]; b: number[] } = { w: [], b: [] };
  const counts: GameAnalysisX['counts'] = { w: {}, b: {} };
  const bookExit: { w: number | null; b: number | null } = { w: null, b: null };
  for (let i = 0; i < n; i++) {
    const moverWhite = fens[i].split(' ')[1] === 'w';
    const side = moverWhite ? 'w' : 'b';
    const before = evals[i];
    const after = evals[i + 1];
    const played = before.lines.find((l) => l.uci === moves[i]);
    const winBest = moverWhite ? winSeriesWhite[i] : 100 - winSeriesWhite[i];
    const winFromNext = moverWhite ? winSeriesWhite[i + 1] : 100 - winSeriesWhite[i + 1];
    const winPlayed = after.over ? winFromNext : played ? winPercent(played.score) : winFromNext;
    const second = before.lines[1] ?? null;
    const secondBestWin = second ? winPercent(second.score) : null;
    const playedKeepsMate = after.over === 'mate' || (after.score.mate !== undefined && after.score.mate < 0) || isMateFor(played?.score);
    const line = played ? played.pv : [moves[i], ...after.pv];
    const prev = moveObjs[i - 1];
    const inBook = i < bookPly;
    const d = classifyDetailed({
      fenBefore: fens[i],
      uci: moves[i],
      bestUci: before.best ?? moves[i],
      winBefore: winBest,
      winAfter: winPlayed,
      secondBestWin,
      legalCount: legalCounts[i],
      inBook,
      bestWasMate: isMateFor(before.score),
      playedKeepsMate,
      playedIsTop: !!played && winBest - winPercent(played.score) <= 1,
      line,
      prevCaptureTo: prev?.captured ? prev.to : null,
    });
    const cls: MoveClass = d.cls;
    const acc = moveAccuracy(d.loss);
    (moverWhite ? accs.w : accs.b).push(acc);
    const sideCounts = moverWhite ? counts.w : counts.b;
    sideCounts[cls] = (sideCounts[cls] ?? 0) + 1;

    // ---- motif tags
    const tags: MoveTag[] = [];
    let hangs: MoveAnalysisX['hangs'];
    let mateIn: number | undefined;
    if (cls === 'brilliant') tags.push('sacrifice');
    if (d.onlyMove) tags.push('onlyMove');
    if (d.recapture) tags.push('recapture');
    if (!inBook && bookExit[side] === null && i >= bookPly && startFen === START_FEN) {
      bookExit[side] = i;
      tags.push('bookExit');
    }
    const isError = cls === 'inaccuracy' || cls === 'mistake' || cls === 'blunder' || cls === 'miss';
    if (isError) {
      if (after.score.mate !== undefined && after.score.mate > 0 && !after.over && !(before.score.mate !== undefined && before.score.mate < 0)) {
        tags.push('allowsMate');
        mateIn = after.score.mate;
      }
      if (isMateFor(before.score) && !playedKeepsMate) {
        tags.push('missedMate');
        mateIn = before.score.mate;
      }
      const reply = after.best;
      if (reply && !after.over) {
        const c = new Chess(fens[i + 1]);
        try {
          const rm = c.move(parseUci(reply));
          if (rm.captured) {
            c.undo();
            const gain = seeGain(c, rm.to);
            if (gain >= 2) {
              tags.push('hangs');
              hangs = { piece: rm.captured, square: rm.to };
            }
          }
        } catch {
          /* ignore */
        }
      }
      const bm = before.best ? new Chess(fens[i]).moves({ verbose: true }).find((x) => x.from + x.to + (x.promotion ?? '') === before.best) : undefined;
      if (bm && (bm.captured || bm.san.includes('+')) && !tags.includes('missedMate')) {
        const lm = lineMaterial(fens[i], before.pv);
        if (lm.endDeficit <= -2 || lm.mates) tags.push('missedWin');
      }
    }
    const alts: AltLine[] = before.lines.slice(0, multipv).map((l) => ({
      uci: l.uci,
      san: sanLine(fens[i], [l.uci], 1)[0] ?? l.uci,
      eval: moverWhite ? l.score : flip(l.score),
      line: sanLine(fens[i], l.pv, 6),
    }));
    const evalBeforeWhite = before.over ? { cp: 0 } : moverWhite ? before.score : flip(before.score);
    const evalAfterWhite =
      after.over === 'mate' ? { mate: moverWhite ? 1 : -1 } : after.over === 'draw' ? { cp: 0 } : moverWhite ? flip(after.score) : after.score;
    const ma: MoveAnalysisX = {
      ply: i,
      uci: moves[i],
      san: sans[i],
      evalBefore: evalBeforeWhite,
      evalAfter: evalAfterWhite,
      bestUci: before.best ?? moves[i],
      bestSan: before.best ? (sanLine(fens[i], [before.best], 1)[0] ?? '') : sans[i],
      pv: sanLine(fens[i], before.pv, 6),
      winLoss: Math.round(d.loss * 10) / 10,
      accuracy: Math.round(acc * 10) / 10,
      cls,
      phase: phases[i],
      alts,
      tags,
    };
    if (hangs) ma.hangs = hangs;
    if (mateIn !== undefined) ma.mateIn = Math.abs(mateIn);
    if (d.sacrificed) ma.sacrificed = d.sacrificed;
    out.push(ma);
  }
  const swings = out
    .map((_m, i) => ({ i, d: Math.abs(winSeriesWhite[i + 1] - winSeriesWhite[i]) }))
    .filter((x) => x.d >= 12)
    .sort((a, b) => b.d - a.d)
    .slice(0, 4)
    .map((x) => x.i)
    .sort((a, b) => a - b);

  // ---- endgame review
  const egPly = phases.indexOf('endgame');
  const endgameReview =
    egPly >= 0 && egPly < fens.length
      ? { ply: egPly, type: endgameType(fens[egPly]), winAtEntry: { w: Math.round(winSeriesWhite[egPly]), b: Math.round(100 - winSeriesWhite[egPly]) } }
      : null;

  // ---- verified puzzles from the trainee's real mistakes
  const puzzles: PuzzleCandidate[] = [];
  if (opts.trainSide) {
    const cands = out
      .filter((m, i) => (fens[i].split(' ')[1] as 'w' | 'b') === opts.trainSide && (m.cls === 'mistake' || m.cls === 'blunder' || m.cls === 'miss') && m.bestUci !== m.uci)
      .sort((a, b) => b.winLoss - a.winLoss)
      .slice(0, opts.maxPuzzles ?? 6);
    for (const m of cands) {
      if (opts.signal?.cancelled) return null;
      const i = m.ply;
      const e = evals[i];
      const l1 = e.lines[0];
      if (!l1) continue;
      const margin = uniqueMargin(l1.score, e.lines[1]?.score ?? null);
      if (margin === null || winPercent(l1.score) < PUZZLE_MIN_WIN) continue;
      const line = await extendSolution(engine, fens[i], l1, depth);
      const theme: TrainingPosition['theme'] = isMateFor(l1.score)
        ? 'mate'
        : m.cls === 'miss'
          ? 'conversion'
          : winPercent(l1.score) < 45
            ? 'defence'
            : m.phase === 'opening'
              ? 'opening'
              : m.phase === 'endgame'
                ? 'endgame'
                : 'tactic';
      puzzles.push({ ply: i, fen: fens[i], line, margin: Math.round(margin * 10) / 10, theme, playedUci: m.uci, cls: m.cls });
    }
    puzzles.sort((a, b) => a.ply - b.ply);
  }
  opts.onProgress?.(total, total);

  return {
    depth,
    engine: engine.name,
    version: ANALYSIS_VERSION,
    multipv,
    moves: out,
    accuracy: {
      w: gameAccuracy(winSeriesWhite, accs.w),
      b: gameAccuracy(winSeriesWhite, accs.b),
    },
    counts,
    critical: swings,
    opening: opening ? { eco: opening.eco, name: opening.name } : null,
    endgame: endgameLabel(fens[fens.length - 1]),
    phases: phaseStats(out, startFen.split(' ')[1] === 'b' ? 'b' : 'w'),
    endgameReview,
    puzzles,
    bookExit,
  };
}

/**
 * Extend a puzzle solution along the engine line while each further trainee
 * move is itself unique (verified with a MultiPV-2 search): at most three
 * trainee moves; the line always ends on a trainee move.
 */
async function extendSolution(engine: UciEngine, fen: string, l1: Cand, depth: number): Promise<string[]> {
  const line = [l1.uci];
  let pv = l1.pv;
  const c = new Chess(fen);
  try {
    c.move(parseUci(l1.uci));
  } catch {
    return line;
  }
  for (let step = 0; step < 2; step++) {
    if (c.isGameOver() || pv.length < line.length + 2) break;
    const reply = pv[line.length];
    try {
      c.move(parseUci(reply));
    } catch {
      break;
    }
    if (c.isGameOver()) {
      c.undo();
      break;
    }
    const r = await engine.search({ fen: c.fen(), depth, multipv: 2 });
    const ls = [...r.lines].filter((l) => l.pv.length).sort((a, b) => a.multipv - b.multipv);
    if (!ls[0] || uniqueMargin(ls[0].score, ls[1]?.score ?? null) === null) {
      c.undo();
      break;
    }
    try {
      c.move(parseUci(ls[0].pv[0]));
    } catch {
      break;
    }
    line.push(reply, ls[0].pv[0]);
    pv = [...line, ...ls[0].pv.slice(1)];
  }
  return line;
}

/** Per-phase accuracy (arithmetic mean of move accuracies) and error counts. */
export function phaseStats(moves: MoveAnalysisX[], firstMover: 'w' | 'b' = 'w'): Record<Phase, { w: PhaseStat; b: PhaseStat }> {
  const res = {} as Record<Phase, { w: PhaseStat; b: PhaseStat }>;
  const off = firstMover === 'w' ? 0 : 1;
  for (const p of PHASES) {
    const mk = (side: 0 | 1): PhaseStat => {
      const ms = moves.filter((m) => m.phase === p && (m.ply + off) % 2 === side);
      return {
        acc: ms.length ? Math.round((ms.reduce((a, m) => a + m.accuracy, 0) / ms.length) * 10) / 10 : null,
        moves: ms.length,
        errors: ms.filter((m) => m.cls === 'mistake' || m.cls === 'blunder' || m.cls === 'miss').length,
        inaccuracies: ms.filter((m) => m.cls === 'inaccuracy').length,
      };
    };
    res[p] = { w: mk(0), b: mk(1) };
  }
  return res;
}

function fmtEval(s: { cp?: number; mate?: number }) {
  return s.mate !== undefined ? `${s.mate >= 0 ? '+' : '−'}M${Math.abs(s.mate)}` : `${(s.cp ?? 0) >= 0 ? '+' : '−'}${Math.abs((s.cp ?? 0) / 100).toFixed(1)}`;
}

function sacName(p: number) {
  return p >= 8 ? 'the queen' : p >= 4 ? 'a rook' : p >= 3 ? 'a piece' : 'the exchange';
}

/**
 * One-line explanation for a classified move. Works for v0.2 analyses too
 * (no tags), falling back to the engine's preferred move.
 */
export function explainMove(m: MoveAnalysisX): string {
  const t = new Set(m.tags ?? []);
  const swing = `${fmtEval(m.evalBefore)} → ${fmtEval(m.evalAfter)}`;
  switch (m.cls) {
    case 'brilliant':
      return `Sacrifices ${sacName(m.sacrificed ?? 3)} — and the engine confirms it works.`;
    case 'great':
      return 'The only good move. Every alternative loses ground.';
    case 'best':
      return t.has('onlyMove') ? 'The only good move.' : t.has('recapture') ? 'The natural recapture.' : "The engine's choice.";
    case 'book':
      return 'Opening theory.';
    case 'forced':
      return 'The only legal move.';
    case 'excellent':
      return `Nearly best. ${m.bestSan} was a touch stronger.`;
    case 'good':
      return `Playable. ${m.bestSan} was more precise.`;
  }
  if (t.has('missedMate')) return `Missed mate in ${m.mateIn ?? '?'} with ${m.bestSan}.`;
  if (t.has('allowsMate')) return `Allows mate in ${m.mateIn ?? '?'}. ${m.bestSan} was needed.`;
  if (t.has('hangs') && m.hangs) return `Leaves the ${PIECE_NAME[m.hangs.piece] ?? 'piece'} on ${m.hangs.square} hanging. ${m.bestSan} was better (${swing}).`;
  if (t.has('missedWin')) return `Misses ${m.bestSan}, which wins material (${swing}).`;
  if (m.cls === 'miss') return `Lets the win slip. ${m.bestSan} kept control (${swing}).`;
  return `${m.bestSan} was better (${swing}).`;
}
