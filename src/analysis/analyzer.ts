import { Chess, type Move } from 'chess.js';
import type { UciEngine, Score } from '../engine/uci';
import { winPercent } from '../engine/uci';
import { ChessGame, START_FEN, parseUci } from '../chess/rules';
import { classifyDetailed, moveAccuracy, gameAccuracy, endgameLabel, THRESHOLDS } from './classify';
import { identifyOpening } from '../chess/openings';
import { endgameType } from '../chess/endgames';
import type { MoveClass, TrainingPosition } from '../game/state';
import { ANALYSIS_VERSION, PHASES, type AltLine, type GameAnalysisX, type MoveAnalysisX, type MoveTag, type Phase, type PhaseStat, type PuzzleCandidate, type Verification } from './types';
import { lineMaterial, seeGain, materialOffered, PIECE_NAME } from './material';
import { CONF, isConfident, isUnclear, moveConfidence, spread } from './confidence';
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
  /** v4 verification pass (default on): claims are re-searched deeper; see confidence.ts. */
  verify?: boolean;
  /** Engine for the verification pass (default: `engine`). */
  verifyEngine?: UciEngine;
  /** Moves verified per game (default CONF.maxVerify). */
  maxVerify?: number;
  /** Extra depth of the first verification search (default CONF.verifyExtra). */
  verifyExtra?: number;
  /** Deepest verification search (default min(depth + CONF.maxVerifyExtra, CONF.maxVerifyDepth)). */
  maxVerifyDepth?: number;
  /** Node cap per verification search / for the whole pass (defaults CONF.verifyNodes / CONF.verifyBudgetNodes). */
  verifyNodes?: number;
  verifyBudgetNodes?: number;
  /** Engine label stored with the verification (e.g. activeEngineInfo('analysis').label). */
  engineLabel?: string;
  fullNet?: boolean;
};

type Cand = { uci: string; score: Score; pv: string[] };
/**
 * One searched position (scores from the side to move's point of view).
 * `trace` = win% of the principal line at each of the last completed
 * iterations (for depth volatility); `vol` replaces it for positions rebuilt
 * from a stored analysis; `exact` marks finished positions (mate / draw).
 */
export type PosEval = {
  score: Score;
  best: string | null;
  lines: Cand[];
  pv: string[];
  over: 'mate' | 'draw' | null;
  depth: number;
  nodes: number;
  trace: { d: number; w: number }[];
  vol?: number;
  exact?: boolean;
};

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

function uciLine(fen: string, sans: string[]): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const san of sans) {
    try {
      const m = c.move(san);
      out.push(m.from + m.to + (m.promotion ?? ''));
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

/** Depth volatility of a position (win% spread of the last three iterations). */
export function volOf(e: PosEval): number {
  if (e.exact) return 0;
  return e.trace.length ? spread(e.trace) : (e.vol ?? 0);
}

/**
 * Search one position with MultiPV, recording the principal line's win% at
 * each completed depth (`trace`) and the nodes searched. Finished positions
 * (mate, stalemate, insufficient material) are exact and not searched.
 */
export type SearchLimits = { signal?: AbortSignal; nodes?: number; timeoutMs?: number };

export async function searchPosition(engine: UciEngine, fen: string, depth: number, multipv: number, lim: SearchLimits = {}): Promise<PosEval> {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { score: { mate: 0 }, best: null, lines: [], pv: [], over: 'mate', depth, nodes: 0, trace: [], exact: true };
  if (c.isStalemate() || c.isInsufficientMaterial()) return { score: { cp: 0 }, best: null, lines: [], pv: [], over: 'draw', depth, nodes: 0, trace: [], exact: true };
  const per = new Map<number, number>();
  const r = await engine.search({ fen, depth, multipv, signal: lim.signal, ...(lim.nodes ? { nodes: lim.nodes } : {}), ...(lim.timeoutMs ? { timeoutMs: lim.timeoutMs } : {}) }, (l) => {
    if (l.multipv === 1 && l.pv.length) per.set(l.depth, winPercent(l.score));
  });
  const lines = [...r.lines]
    .filter((l) => l.pv.length > 0)
    .sort((a, b) => a.multipv - b.multipv)
    .map((l) => ({ uci: l.pv[0], score: l.score, pv: l.pv }));
  const l1 = lines[0];
  const top = r.lines.find((l) => l.multipv === 1);
  const trace = [...per.entries()].map(([d, w]) => ({ d, w })).sort((a, b) => a.d - b.d).slice(-4);
  return {
    score: l1?.score ?? { cp: 0 },
    best: r.bestmove ?? l1?.uci ?? null,
    lines,
    pv: l1?.pv ?? [],
    over: null,
    depth: top?.depth || depth,
    nodes: top?.nodes ?? 0,
    trace,
  };
}

/** Replayed game: positions, SAN, legal-move counts, book and phases. */
export type GameCtx = {
  startFen: string;
  moves: string[];
  fens: string[];
  sans: string[];
  legalCounts: number[];
  moveObjs: Move[];
  n: number;
  bookPly: number;
  opening: { eco: string; name: string; ply: number } | null;
  phases: Phase[];
  multipv: number;
};

export function gameContext(moves: string[], startFen: string = START_FEN, multipv = 3): GameCtx {
  const fens: string[] = [new ChessGame(startFen).fen()];
  const sans: string[] = [];
  const legalCounts: number[] = [];
  const moveObjs: Move[] = [];
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
  const n = sans.length;
  const opening = startFen === START_FEN ? identifyOpening(moves.slice(0, n)) : null;
  const bookPly = opening?.ply ?? 0;
  return { startFen, moves, fens, sans, legalCounts, moveObjs, n, bookPly, opening, phases: phaseSeries(fens, bookPly), multipv };
}

/** Win% of each position for White (index = ply), from the searched positions. */
function whiteSeries(ctx: GameCtx, evals: PosEval[]): number[] {
  return ctx.fens.map((f, i) => {
    const stmWhite = f.split(' ')[1] === 'w';
    const e = evals[i];
    return e.over === 'mate' ? (stmWhite ? 0 : 100) : e.over === 'draw' ? 50 : stmWhite ? winPercent(e.score) : 100 - winPercent(e.score);
  });
}

/**
 * Classify every move from the searched positions (pure). `verified` marks
 * moves whose positions were re-searched deeper (their provenance is stored
 * on the move); confidence follows confidence.ts.
 */
/** With `only`, just those plies are built (the others are left as holes). */
export function buildMoves(ctx: GameCtx, evals: PosEval[], verified: Map<number, Verification> = new Map(), only?: Set<number>): MoveAnalysisX[] {
  const { fens, moves, sans, legalCounts, moveObjs, n, bookPly, phases, startFen, multipv } = ctx;
  const winSeriesWhite = whiteSeries(ctx, evals);
  const out: MoveAnalysisX[] = [];
  const bookSeen = { w: false, b: false };
  for (let i = 0; i < n; i++) {
    const moverWhite = fens[i].split(' ')[1] === 'w';
    const side = moverWhite ? 'w' : 'b';
    const inBook = i < bookPly;
    const exit = !inBook && !bookSeen[side] && i >= bookPly && startFen === START_FEN;
    if (exit) bookSeen[side] = true;
    if (only && !only.has(i)) {
      out.push(undefined as unknown as MoveAnalysisX);
      continue;
    }
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
    let cls: MoveClass = d.cls;
    const acc = moveAccuracy(d.loss);

    // ---- confidence (confidence.ts)
    const vol = Math.max(volOf(before), volOf(after));
    const inc = played && !after.over ? Math.abs(winPercent(played.score) - winFromNext) : 0;
    const depths = [before, after].filter((e) => !e.exact).map((e) => e.depth);
    const depthUsed = depths.length ? Math.min(...depths) : before.depth;
    const ver = verified.get(i);
    const conf = moveConfidence({ cls, loss: d.loss, vol, inc, depth: depthUsed, verified: !!ver });
    let claim: MoveClass | undefined;
    if (conf === 'low' && (cls === 'brilliant' || cls === 'great')) {
      claim = cls; // an unconfirmed brilliancy is never stored as one
      cls = d.isBest ? 'best' : d.loss < THRESHOLDS.excellent ? 'excellent' : 'good';
    }

    // ---- motif tags
    const tags: MoveTag[] = [];
    let hangs: MoveAnalysisX['hangs'];
    let mateIn: number | undefined;
    if (cls === 'brilliant') tags.push('sacrifice');
    if (d.onlyMove) tags.push('onlyMove');
    if (d.recapture) tags.push('recapture');
    if (exit) tags.push('bookExit');
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
      depth: depthUsed,
      nodes: before.nodes + (after.exact ? 0 : after.nodes),
      instab: Math.round(Math.max(vol, inc) * 10) / 10,
      conf,
    };
    if (hangs) ma.hangs = hangs;
    if (mateIn !== undefined) ma.mateIn = Math.abs(mateIn);
    if (d.sacrificed) ma.sacrificed = d.sacrificed;
    if (claim) ma.claim = claim;
    if (ver) ma.verified = { ...ver };
    out.push(ma);
  }
  return out;
}

/** White's win% of each position, read back from the moves (index = ply; mates pinned to 0/100). */
export function winSeriesOf(moves: Pick<MoveAnalysisX, 'evalBefore' | 'evalAfter'>[]): number[] {
  if (!moves.length) return [50];
  const w = (e: Score) => (e.mate !== undefined ? (e.mate > 0 ? 100 : e.mate < 0 ? 0 : 50) : winPercent(e));
  return [w(moves[0].evalBefore), ...moves.map((m) => w(m.evalAfter))];
}

/**
 * Critical moments (v0.4): the largest REAL swings. A move qualifies when
 *   · the mover lost ≥ 12 win% within one search (best vs played move of the
 *     same MultiPV search, so not a depth-parity artefact), AND the position
 *     evaluations before and after the move agree that at least half of that
 *     was lost (two independent views of the swing);
 *   · its confidence is not low and its instability ≤ CONF.unstable.
 * Book and forced moves never qualify. At most four, in game order.
 */
export function criticalMoments(moves: MoveAnalysisX[], max = 4, startFen: string = START_FEN): number[] {
  const series = winSeriesOf(moves);
  const firstBlack = startFen.split(' ')[1] === 'b';
  return moves
    .map((m, i) => {
      if (m.cls === 'book' || m.cls === 'forced' || m.winLoss < 12 || m.conf === 'low' || (m.instab ?? 0) > CONF.unstable) return null;
      const white = (i % 2 === 0) !== firstBlack;
      const drop = white ? series[i] - series[i + 1] : series[i + 1] - series[i];
      return drop >= m.winLoss / 2 ? { i, d: m.winLoss } : null;
    })
    .filter((x): x is { i: number; d: number } => !!x)
    .sort((a, b) => b.d - a.d || a.i - b.i)
    .slice(0, max)
    .map((x) => x.i)
    .sort((a, b) => a - b);
}

/** Per-game summary from classified moves (pure; shared by the full analysis and deeper re-searches). */
export function summarise(fens: string[], moves: MoveAnalysisX[], startFen: string) {
  const series = winSeriesOf(moves);
  const firstBlack = startFen.split(' ')[1] === 'b';
  const sideOf = (i: number) => ((i % 2 === 0) !== firstBlack ? 'w' : 'b');
  const accs: { w: number[]; b: number[] } = { w: [], b: [] };
  const counts: GameAnalysisX['counts'] = { w: {}, b: {} };
  const bookExit: { w: number | null; b: number | null } = { w: null, b: null };
  moves.forEach((m, i) => {
    const sd = sideOf(i);
    accs[sd].push(moveAccuracy(m.winLoss));
    counts[sd][m.cls] = (counts[sd][m.cls] ?? 0) + 1;
    if (m.tags?.includes('bookExit') && bookExit[sd] === null) bookExit[sd] = i;
  });
  const egPly = phaseSeries(fens, 0).indexOf('endgame'); // the endgame threshold does not depend on the book
  const endgameReview =
    egPly >= 0 && egPly < fens.length ? { ply: egPly, type: endgameType(fens[egPly]), winAtEntry: { w: Math.round(series[egPly]), b: Math.round(100 - series[egPly]) } } : null;
  return {
    accuracy: { w: gameAccuracy(series, accs.w), b: gameAccuracy(series, accs.b) },
    counts,
    critical: criticalMoments(moves, 4, startFen),
    phases: phaseStats(moves, firstBlack ? 'b' : 'w'),
    endgameReview,
    bookExit,
    endgame: endgameLabel(fens[fens.length - 1]),
  };
}

const VERIFY_PRIORITY: Partial<Record<MoveClass, number>> = { brilliant: 400, great: 350, blunder: 200, miss: 200, mistake: 150 };

/**
 * Moves to verify, most important first: Brilliant/Great claims, played
 * sacrifices (≥ 2 pawns offered) that are near-best, every Mistake/Blunder/
 * Missed win, then any other move whose evaluation is unstable (low confidence).
 */
export function verifyCandidates(ctx: GameCtx, moves: MoveAnalysisX[]): number[] {
  const out: { i: number; p: number }[] = [];
  moves.forEach((m, i) => {
    if (m.cls === 'book' || m.cls === 'forced') return;
    let p = VERIFY_PRIORITY[m.claim ?? m.cls] ?? 0;
    if (!p && m.winLoss <= THRESHOLDS.brilliantNear && materialOffered(ctx.fens[i], m.uci).offered >= THRESHOLDS.brilliantMinOffer) p = 300;
    if (!p && m.conf === 'low') p = 100; // unstable evaluation (e.g. root and after-move searches disagree)
    if (p) out.push({ i, p: p + m.winLoss });
  });
  return out.sort((a, b) => b.p - a.p || a.i - b.i).map((x) => x.i);
}

/**
 * Re-search move `i` deeper: the position before it (MultiPV, best and
 * alternatives) and the position after the played move (its refutation),
 * first at `d0`, then deeper by CONF.verifyStep while the result is unstable
 * (spread > CONF.stable on either position, or the root's value of the
 * played move and the after-position value disagree by > CONF.consistent),
 * up to `maxD`. Every search is also capped at `nodes` (it then stops at the
 * depth it reached — still deterministic). Results go into `deep` (keyed by
 * ply); returns the depth and nodes behind the final verdict and the nodes spent.
 */
async function deepen(
  engine: UciEngine,
  ctx: GameCtx,
  shallow: PosEval[],
  deep: Map<number, PosEval>,
  i: number,
  d0: number,
  maxD: number,
  steps: number,
  lim: SearchLimits = {},
): Promise<{ depth: number; nodes: number; spent: number }> {
  const at = (p: number) => deep.get(p) ?? shallow[p];
  let spent = 0;
  const tried = new Map<number, number>(); // ply → deepest depth asked for
  const ensure = async (p: number, d: number) => {
    if (p > ctx.n || shallow[p].exact) return;
    const cur = deep.get(p);
    if ((cur && cur.depth >= d) || (tried.get(p) ?? 0) >= d) return;
    tried.set(p, d);
    const e = await searchPosition(engine, ctx.fens[p], d, ctx.multipv, lim);
    spent += e.nodes;
    if (!cur || e.depth >= cur.depth) deep.set(p, e);
  };
  const unstable = () => {
    const b = at(i);
    const a = at(i + 1);
    const played = b.lines.find((l) => l.uci === ctx.moves[i]);
    const afterWin = a.over === 'mate' ? 100 : a.over === 'draw' ? 50 : 100 - winPercent(a.score); // mover's view
    const inc = played && !a.over ? Math.abs(winPercent(played.score) - afterWin) : 0;
    return volOf(b) > CONF.stable || volOf(a) > CONF.stable || inc > CONF.consistent;
  };
  let d = Math.min(maxD, d0);
  await ensure(i, d);
  await ensure(i + 1, d);
  for (let s = 0; s < steps && unstable() && d < maxD; s++) {
    d = Math.min(maxD, d + CONF.verifyStep);
    await ensure(i, d);
    await ensure(i + 1, d);
  }
  const used = [at(i), at(i + 1)].filter((e) => e && !e.exact);
  return { depth: used.length ? Math.min(...used.map((e) => e.depth)) : d, nodes: used.reduce((s, e) => s + e.nodes, 0), spent };
}

/**
 * Full post-game analysis.
 *  1. Every position is searched once at a fixed depth with MultiPV 3.
 *  2. Verification (v0.4, on by default): Brilliant/Great claims, played
 *     sacrifices and every Mistake/Blunder/Miss (plus unstable inaccuracies)
 *     are re-searched deeper — before and after the played move — with up
 *     to CONF.verifySteps escalations while unstable (see `deepen`). The deep
 *     result replaces the shallow one, all moves are re-classified (a second
 *     round verifies claims that only appear after the first), and each move
 *     gets its depth, nodes, instability and confidence (confidence.ts).
 *  3. Puzzles are made only from high-confidence mistakes of `trainSide`.
 * Results are reproducible for a given engine build and depth (fixed-depth
 * searches in a fixed order after `ucinewgame`).
 */
export async function analyseGame(
  engine: UciEngine,
  moves: string[],
  startFen: string = START_FEN,
  opts: AnalysisOptions = {},
): Promise<GameAnalysisX | null> {
  const depth = opts.depth ?? 14;
  const multipv = Math.max(1, opts.multipv ?? 3);
  const ctx = gameContext(moves, startFen, multipv);
  const { fens } = ctx;
  const verify = opts.verify ?? true;
  const maxVerify = verify ? (opts.maxVerify ?? CONF.maxVerify) : 0;
  await engine.newGame();
  const evals: PosEval[] = [];
  const total = fens.length + maxVerify + 1;
  for (let i = 0; i < fens.length; i++) {
    if (opts.signal?.cancelled) return null;
    evals.push(await searchPosition(engine, fens[i], depth, multipv));
    opts.onProgress?.(i + 1, total);
  }

  // ---- verification pass
  const verified = new Map<number, Verification>();
  const deep = new Map<number, PosEval>();
  let cur = evals;
  let out = buildMoves(ctx, cur, verified);
  const shallowCls = out.map((m) => m.claim ?? m.cls);
  if (maxVerify > 0) {
    const veng = opts.verifyEngine ?? engine;
    const maxD = Math.max(depth, opts.maxVerifyDepth ?? Math.min(depth + CONF.maxVerifyExtra, CONF.maxVerifyDepth));
    const d0 = Math.min(maxD, depth + (opts.verifyExtra ?? CONF.verifyExtra));
    const capNodes = opts.verifyNodes ?? CONF.verifyNodes;
    let nodeBudget = opts.verifyBudgetNodes ?? CONF.verifyBudgetNodes;
    let budget = maxVerify;
    let done = 0;
    for (let round = 0; round < 2 && budget > 0 && nodeBudget > 0; round++) {
      const cands = verifyCandidates(ctx, out).filter((i) => !verified.has(i)).slice(0, budget);
      if (!cands.length) break;
      for (const i of cands) {
        if (opts.signal?.cancelled) return null;
        if (nodeBudget <= 0) break;
        const r = await deepen(veng, ctx, evals, deep, i, d0, maxD, CONF.verifySteps, { nodes: capNodes, timeoutMs: 180000 });
        nodeBudget -= r.spent;
        verified.set(i, { by: 'auto', depth: r.depth, nodes: r.nodes, ...(opts.engineLabel ? { engine: opts.engineLabel } : {}) });
        budget--;
        opts.onProgress?.(fens.length + ++done, total);
      }
      cur = evals.map((e, p) => deep.get(p) ?? e);
      out = buildMoves(ctx, cur, verified);
    }
    out.forEach((m, i) => {
      const was = shallowCls[i];
      if (m.verified && was !== m.cls) m.verified.from = was;
    });
  }

  // ---- verified puzzles from the trainee's real, high-confidence mistakes
  const puzzles: PuzzleCandidate[] = [];
  if (opts.trainSide) {
    const cands = out
      .filter((m, i) => (fens[i].split(' ')[1] as 'w' | 'b') === opts.trainSide && isPuzzleSource(m))
      .sort((a, b) => b.winLoss - a.winLoss)
      .slice(0, opts.maxPuzzles ?? 6);
    for (const m of cands) {
      if (opts.signal?.cancelled) return null;
      const p = await puzzleFor(engine, fens[m.ply], cur[m.ply], m, Math.max(depth, cur[m.ply].depth));
      if (p) puzzles.push(p);
    }
    puzzles.sort((a, b) => a.ply - b.ply);
  }
  opts.onProgress?.(total, total);

  const sum = summarise(fens, out, startFen);
  const unclear = out.filter((m) => isUnclear(m)).length;
  return {
    depth,
    engine: engine.name,
    version: ANALYSIS_VERSION,
    multipv,
    moves: out,
    accuracy: sum.accuracy,
    counts: sum.counts,
    critical: sum.critical,
    opening: ctx.opening ? { eco: ctx.opening.eco, name: ctx.opening.name } : null,
    endgame: sum.endgame,
    phases: sum.phases,
    endgameReview: sum.endgameReview,
    puzzles,
    bookExit: sum.bookExit,
    verification: {
      moves: verified.size,
      positions: deep.size,
      maxDepth: Math.max(depth, ...[...deep.values()].map((e) => e.depth)),
      unclear,
      ...(opts.engineLabel ? { engine: opts.engineLabel } : {}),
      ...(opts.fullNet !== undefined ? { fullNet: opts.fullNet } : {}),
    },
  };
}

/** Only real, high-confidence mistakes become puzzles. */
function isPuzzleSource(m: MoveAnalysisX): boolean {
  return (m.cls === 'mistake' || m.cls === 'blunder' || m.cls === 'miss') && m.bestUci !== m.uci && isConfident(m);
}

async function puzzleFor(engine: UciEngine, fen: string, e: PosEval, m: MoveAnalysisX, depth: number, signal?: AbortSignal): Promise<PuzzleCandidate | null> {
  const l1 = e.lines[0];
  if (!l1) return null;
  const margin = uniqueMargin(l1.score, e.lines[1]?.score ?? null);
  if (margin === null || winPercent(l1.score) < PUZZLE_MIN_WIN) return null;
  const line = await extendSolution(engine, fen, l1, depth, signal);
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
  return { ply: m.ply, fen, line, margin: Math.round(margin * 10) / 10, theme, playedUci: m.uci, cls: m.cls };
}

/** A position rebuilt from a stored analysis (lines from the stored alternatives; volatility from `instab`). */
function storedEval(a: GameAnalysisX, ctx: GameCtx, p: number): PosEval {
  const fen = ctx.fens[p];
  const c = new Chess(fen);
  if (c.isCheckmate()) return { score: { mate: 0 }, best: null, lines: [], pv: [], over: 'mate', depth: a.depth, nodes: 0, trace: [], exact: true };
  if (c.isStalemate() || c.isInsufficientMaterial()) return { score: { cp: 0 }, best: null, lines: [], pv: [], over: 'draw', depth: a.depth, nodes: 0, trace: [], exact: true };
  const stmWhite = fen.split(' ')[1] === 'w';
  const toStm = (e: Score): Score => (stmWhite ? e : flip(e));
  if (p < a.moves.length) {
    const m = a.moves[p];
    let lines: Cand[] = (m.alts ?? []).map((alt) => ({ uci: alt.uci, score: toStm(alt.eval), pv: uciLine(fen, alt.line) }));
    if (!lines.length) lines = [{ uci: m.bestUci, score: toStm(m.evalBefore), pv: uciLine(fen, m.pv) }];
    return { score: toStm(m.evalBefore), best: m.bestUci, lines, pv: lines[0].pv, over: null, depth: m.verified?.depth ?? m.depth ?? a.depth, nodes: 0, trace: [], vol: m.instab ?? 0 };
  }
  const last = a.moves[p - 1];
  return { score: toStm(last.evalAfter), best: null, lines: [], pv: [], over: null, depth: last.depth ?? a.depth, nodes: 0, trace: [], vol: last.instab ?? 0 };
}

export type DeepenOptions = {
  /** Target depth (default: max(analysis depth + 8, this move's depth + 6), ≤ 30). */
  depth?: number;
  /** Node cap per search (default 25M; the search then stops at the depth it reached). */
  nodes?: number;
  signal?: AbortSignal;
  engineLabel?: string;
  now?: number;
  /** Side whose puzzles are kept in sync with the new verdict. */
  trainSide?: 'w' | 'b' | null;
};

/**
 * Player-requested deeper analysis of one move (finished games only — the
 * queue enforces integrity). Searches the position before the move and the
 * position after the played move at the target depth (one escalation of
 * CONF.verifyStep if still unstable), re-classifies the move and its
 * neighbours that depend on those positions, records provenance
 * (`verified.by = 'user'`, depth, nodes, previous class, time) and refreshes
 * the game summary and puzzles. Returns the new analysis; aborts reject.
 */
export async function deepenMove(engine: UciEngine, g: { startFen: string; moves: string[]; analysis?: GameAnalysisX | null }, ply: number, opts: DeepenOptions = {}): Promise<GameAnalysisX> {
  const a = g.analysis;
  if (!a || ply < 0 || ply >= a.moves.length) throw new Error('nothing to deepen');
  const ctx = gameContext(g.moves, g.startFen, a.multipv ?? 3);
  const m0 = a.moves[ply];
  const base = Math.max(m0.verified?.depth ?? 0, m0.depth ?? a.depth);
  const target = Math.min(30, opts.depth ?? Math.max(a.depth + 8, base + 6));
  const stored = ctx.fens.map((_, p) => storedEval(a, ctx, p));
  const deep = new Map<number, PosEval>();
  await engine.newGame();
  const r = await deepen(engine, ctx, stored, deep, ply, target, Math.min(30, target + CONF.verifyStep), 1, { signal: opts.signal, nodes: opts.nodes ?? 25_000_000, timeoutMs: 600000 });
  const evals = stored.map((e, p) => deep.get(p) ?? e);
  const ver = new Map<number, Verification>();
  a.moves.forEach((m, k) => m.verified && ver.set(k, m.verified));
  ver.set(ply, { by: 'user', depth: r.depth, nodes: r.nodes, at: opts.now ?? Date.now(), ...(opts.engineLabel ? { engine: opts.engineLabel } : {}) });
  // Re-classify the moves that depend on the re-searched positions: this move, the next one (its root
  // was re-searched) and the previous one only if its played move was not among its stored candidates.
  const affected = new Set([ply, ply + 1].filter((k) => k < a.moves.length));
  const prev = a.moves[ply - 1];
  if (prev && !(prev.alts ?? []).some((x) => x.uci === prev.uci)) affected.add(ply - 1);
  const rebuilt = buildMoves(ctx, evals, ver, affected);
  const moves = a.moves.map((m, k) => (affected.has(k) && rebuilt[k] ? rebuilt[k] : m));
  const was = m0.claim ?? m0.cls;
  if (moves[ply].verified && was !== moves[ply].cls) moves[ply].verified!.from = was;
  const sum = summarise(ctx.fens, moves, g.startFen);
  // Puzzles follow the new verdicts.
  let puzzles = (a.puzzles ?? []).filter((p) => !affected.has(p.ply) || isPuzzleSource(moves[p.ply]));
  if (opts.trainSide) {
    for (const k of affected) {
      const m = moves[k];
      if ((ctx.fens[k].split(' ')[1] as 'w' | 'b') !== opts.trainSide || !isPuzzleSource(m) || puzzles.some((p) => p.ply === k)) continue;
      const p = await puzzleFor(engine, ctx.fens[k], evals[k], m, Math.max(a.depth, evals[k].depth), opts.signal);
      if (p) puzzles = [...puzzles, p].sort((x, y) => x.ply - y.ply);
    }
  }
  const v = a.verification;
  return {
    ...a,
    moves,
    accuracy: sum.accuracy,
    counts: sum.counts,
    critical: sum.critical,
    phases: sum.phases,
    endgameReview: sum.endgameReview,
    bookExit: sum.bookExit,
    puzzles,
    verification: {
      moves: moves.filter((m) => m.verified).length,
      positions: (v?.positions ?? 0) + deep.size,
      maxDepth: Math.max(v?.maxDepth ?? a.depth, ...[...deep.values()].map((e) => e.depth)),
      unclear: moves.filter((m) => isUnclear(m)).length,
      ...(v?.engine ? { engine: v.engine } : {}),
      ...(v?.fullNet !== undefined ? { fullNet: v.fullNet } : {}),
    },
  };
}

/**
 * Extend a puzzle solution along the engine line while each further trainee
 * move is itself unique (verified with a MultiPV-2 search): at most three
 * trainee moves; the line always ends on a trainee move.
 */
async function extendSolution(engine: UciEngine, fen: string, l1: Cand, depth: number, signal?: AbortSignal): Promise<string[]> {
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
    const r = await engine.search({ fen: c.fen(), depth, multipv: 2, signal });
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

/** Per-phase accuracy (arithmetic mean of move accuracies) and error counts ("Unclear" moves are not counted as errors). */
export function phaseStats(moves: MoveAnalysisX[], firstMover: 'w' | 'b' = 'w'): Record<Phase, { w: PhaseStat; b: PhaseStat }> {
  const res = {} as Record<Phase, { w: PhaseStat; b: PhaseStat }>;
  const off = firstMover === 'w' ? 0 : 1;
  for (const p of PHASES) {
    const mk = (side: 0 | 1): PhaseStat => {
      const ms = moves.filter((m) => m.phase === p && (m.ply + off) % 2 === side);
      return {
        acc: ms.length ? Math.round((ms.reduce((a, m) => a + m.accuracy, 0) / ms.length) * 10) / 10 : null,
        moves: ms.length,
        errors: ms.filter((m) => (m.cls === 'mistake' || m.cls === 'blunder' || m.cls === 'miss') && m.conf !== 'low').length,
        inaccuracies: ms.filter((m) => m.cls === 'inaccuracy' && m.conf !== 'low').length,
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
 * (no tags), falling back to the engine's preferred move. Low-confidence
 * claims are worded as uncertain (confidence.ts); a demoted brilliancy says so.
 */
export function explainMove(m: MoveAnalysisX): string {
  const t = new Set(m.tags ?? []);
  const swing = `${fmtEval(m.evalBefore)} → ${fmtEval(m.evalAfter)}`;
  const d = m.verified?.depth ?? m.depth;
  if (isUnclear(m)) {
    const what = m.cls === 'brilliant' || m.cls === 'great' ? 'strong' : m.cls === 'inaccuracy' ? 'imprecise' : 'an error';
    return `Unclear: the engine's evaluation was unstable${d ? ` at depth ${d}` : ''}, so it cannot say whether this was ${what}. ${m.bestSan && m.bestUci !== m.uci ? `Its top choice was ${m.bestSan}. ` : ''}Try "Analyse deeper".`;
  }
  if (m.claim === 'brilliant' || m.claim === 'great')
    return `${m.cls === 'best' ? "The engine's choice" : 'Nearly best'}${m.claim === 'brilliant' ? ` — a possible ${sacName(m.sacrificed ?? 3).replace(/^(the|a) /, '')} sacrifice` : ' — possibly the only good move'} the engine could not confirm${d ? ` at depth ${d}` : ''}.`;
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

const CONF_WORD = { high: 'high', medium: 'medium', low: 'low' } as const;

/** One line about how a move was judged, e.g. "depth 19 · 2.9M nodes · verified (was Blunder) · high confidence". */
export function provenanceText(m: MoveAnalysisX, label: (c: MoveClass) => string = (c) => c): string | null {
  if (m.depth === undefined && !m.verified) return null;
  const parts: string[] = [];
  const d = m.verified?.depth ?? m.depth;
  if (d) parts.push(`depth ${d}`);
  if (m.nodes) parts.push(`${fmtNodes(m.nodes)} nodes`);
  if (m.verified) parts.push(`${m.verified.by === 'user' ? 'deeper on request' : 'verified'}${m.verified.from ? ` (was ${label(m.verified.from)})` : ''}`);
  if (m.conf) parts.push(`${CONF_WORD[m.conf]} confidence`);
  return parts.join(' · ');
}

export function fmtNodes(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
}
