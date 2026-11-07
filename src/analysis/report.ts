import type { GameRecord, MoveClass } from '../game/state';
import { winPercent } from '../engine/uci';
import { CLASS_META } from './classify';
import { explainMove } from './analyzer';
import { asX, ANALYSIS_VERSION, type GameAnalysisX, type MoveAnalysisX } from './types';
import { ENDGAME_GUIDE, endgameVerdict } from '../chess/endgames';

/**
 * Per-game report helpers shared by the Review view, the post-game screen
 * (owned by the lead: import from here) and the PGN export.
 *
 * Accuracy is an ESTIMATE from a documented, reproducible model (Lichess-style
 * win% loss → move accuracy, Stockfish at a fixed depth); it is not claimed to
 * match any proprietary system's numbers.
 */

const ERR: MoveClass[] = ['mistake', 'blunder', 'miss'];
const isErr = (c: MoveClass) => ERR.includes(c);

/** Which moves in `a.moves` belong to `side` (handles games starting with Black to move). */
export function sideOf(g: Pick<GameRecord, 'startFen'>, ply: number): 'w' | 'b' {
  const firstBlack = g.startFen.split(' ')[1] === 'b';
  return (ply % 2 === 0) !== firstBlack ? 'w' : 'b';
}

export type Reliability = { depth: number; multipv: number; plies: number; level: 'low' | 'medium' | 'high'; note: string };

/**
 * How much to trust the numbers: depth ≥ 14 and ≥ 30 analysed moves per side
 * is "high"; depth ≥ 11 and ≥ 15 moves "medium"; otherwise "low" (short games
 * swing a lot on one move; shallow searches misjudge deep tactics).
 */
export function reliability(a: GameAnalysisX): Reliability {
  const perSide = Math.floor(a.moves.length / 2);
  const level = a.depth >= 14 && perSide >= 30 ? 'high' : a.depth >= 11 && perSide >= 15 ? 'medium' : 'low';
  const note = `Stockfish depth ${a.depth}${a.multipv ? ` · ${a.multipv} lines` : ''} · ${a.moves.length} plies`;
  return { depth: a.depth, multipv: a.multipv ?? 2, plies: a.moves.length, level, note };
}

/** The player's (or White's) biggest errors, largest win% loss first. */
export function biggestMistakes(g: GameRecord, side?: 'w' | 'b', n = 3): MoveAnalysisX[] {
  const a = asX(g.analysis);
  if (!a) return [];
  const me = side ?? g.playerColor ?? 'w';
  return a.moves.filter((m) => sideOf(g, m.ply) === me && (isErr(m.cls) || m.cls === 'inaccuracy')).sort((x, y) => y.winLoss - x.winLoss).slice(0, n);
}

/** Tactical opportunities: forcing wins or mates the side had and missed. */
export function missedTactics(g: GameRecord, side?: 'w' | 'b'): MoveAnalysisX[] {
  const a = asX(g.analysis);
  if (!a) return [];
  const me = side ?? g.playerColor ?? 'w';
  return a.moves.filter((m) => sideOf(g, m.ply) === me && isErr(m.cls) && (m.tags?.includes('missedWin') || m.tags?.includes('missedMate') || m.cls === 'miss'));
}

/** Short improvement recommendations for this game (≤ 3), most important first. */
export function gameRecommendations(g: GameRecord, side?: 'w' | 'b'): string[] {
  const a = asX(g.analysis);
  if (!a) return [];
  const me = side ?? g.playerColor ?? 'w';
  const mine = a.moves.filter((m) => sideOf(g, m.ply) === me);
  const out: { w: number; t: string }[] = [];
  const hangs = mine.filter((m) => isErr(m.cls) && (m.tags?.includes('hangs') || m.tags?.includes('allowsMate'))).length;
  if (hangs) out.push({ w: 3 + hangs, t: 'Blunder check: before each move, list every capture and check your opponent gets.' });
  const missed = missedTactics(g, me).length;
  if (missed) out.push({ w: 3 + missed, t: 'Look for forcing moves first — checks, captures, threats. A win was on the board.' });
  const ph = a.phases;
  if (ph) {
    const o = ph.opening[me];
    if (o.errors + o.inaccuracies >= 2) out.push({ w: 2 + o.errors, t: 'Opening: review the line you played in the explorer and follow the main ideas.' });
    const e = ph.endgame[me];
    if (e.moves > 0 && e.errors > 0 && a.endgameReview) out.push({ w: 2 + e.errors, t: `${a.endgameReview.type}: ${ENDGAME_GUIDE[a.endgameReview.type]?.tip ?? 'activate the king.'}` });
  }
  const score = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (me === 'w') ? 1 : 0;
  const peak = Math.max(...mine.map((m) => (me === 'w' ? winPercent(m.evalBefore) : 100 - winPercent(m.evalBefore))), 0);
  if (peak >= 80 && score < 1) out.push({ w: 4, t: 'You were winning. When ahead, trade pieces, keep pawns, and remove counterplay before attacking.' });
  if (a.endgameReview && endgameVerdict(a.endgameReview.winAtEntry[me], score) === 'saved') out.push({ w: 1, t: 'Good defence in the endgame. Keep it up.' });
  if (out.length === 0) out.push({ w: 0, t: (a.accuracy[me] ?? 0) >= 85 ? 'Clean game. Try a stronger opponent.' : 'Few clear errors. Look at the inaccuracies for quieter improvements.' });
  return out.sort((x, y) => y.w - x.w).slice(0, 3).map((x) => x.t);
}

export type AnalysisStatus = 'none' | 'queued' | 'running' | 'done' | 'stale' | 'locked';

export type PostGameReport = {
  status: AnalysisStatus;
  accuracy: { player: number; opponent: number } | null;
  /** The single most important moment for the player (largest error, else the best find). */
  critical: { ply: number; san: string; cls: MoveClass; label: string; text: string } | null;
  recommendation: string | null;
  reliability: Reliability | null;
};

/**
 * Everything the post-game screen needs from an analysed game (pure). Pass the
 * queue status from `analysisStatus(id)` in ui/analysisQueue.ts.
 */
export function postGameReport(g: GameRecord, status: AnalysisStatus = g.analysis ? 'done' : 'none'): PostGameReport {
  const a = asX(g.analysis);
  if (!a || !g.playerColor) return { status, accuracy: null, critical: null, recommendation: null, reliability: null };
  const me = g.playerColor;
  const worst = biggestMistakes(g, me, 1)[0];
  const star = a.moves.find((m) => sideOf(g, m.ply) === me && (m.cls === 'brilliant' || m.cls === 'great'));
  const pick = worst && worst.winLoss >= 5 ? worst : star ?? worst ?? null;
  return {
    status: status === 'done' && (a.version ?? 0) < ANALYSIS_VERSION ? 'stale' : status,
    accuracy: { player: a.accuracy[me], opponent: a.accuracy[me === 'w' ? 'b' : 'w'] },
    critical: pick ? { ply: pick.ply, san: pick.san, cls: pick.cls, label: CLASS_META[pick.cls].label, text: explainMove(pick) } : null,
    recommendation: gameRecommendations(g, me)[0] ?? null,
    reliability: reliability(a),
  };
}

// ------------------------------------------------------------------ annotated PGN

/** SAN line with move numbers, starting at half-move index `p` (0 = White's first move). */
export function numbered(sans: string[], p: number, fullStart = 1): string {
  return sans
    .map((san, k) => {
      const q = p + k;
      const no = fullStart + Math.floor(q / 2);
      return q % 2 === 0 ? `${no}. ${san}` : k === 0 ? `${no}... ${san}` : san;
    })
    .join(' ');
}

/** Standard NAGs: $1 good (!), $2 mistake (?), $3 brilliant (!!), $4 blunder (??), $6 dubious (?!). */
export const NAG: Partial<Record<MoveClass, string>> = { brilliant: '$3', great: '$1', inaccuracy: '$6', mistake: '$2', blunder: '$4', miss: '$2' };

function pgnEval(e: { cp?: number; mate?: number }) {
  return e.mate !== undefined ? `#${e.mate}` : ((e.cp ?? 0) / 100).toFixed(2);
}

/**
 * PGN with NAGs and comments: `{[%eval 0.35] Mistake. Nf3 was better …}` after
 * each analysed move (evals are White's point of view, the lichess/ChessBase
 * `%eval` convention), plus the engine's best line as a variation after errors.
 */
export function annotatedPgn(g: GameRecord, headers: Record<string, string> = {}): string {
  const a = asX(g.analysis);
  const hs: Record<string, string> = {
    Event: g.kind === 'spectated' ? 'GLADIUS broadcast' : 'GLADIUS',
    Date: (g.date ?? '').slice(0, 10).replace(/-/g, '.') || '????.??.??',
    White: g.white.name,
    Black: g.black.name,
    Result: g.result,
    WhiteElo: String(g.white.rating),
    BlackElo: String(g.black.rating),
    ...(g.opening ? { ECO: g.opening.eco, Opening: g.opening.name } : {}),
    ...(g.startFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq') ? {} : { SetUp: '1', FEN: g.startFen }),
    ...(a ? { Annotator: `GLADIUS analysis (${a.engine}, depth ${a.depth})`, WhiteAccuracy: a.accuracy.w.toFixed(1), BlackAccuracy: a.accuracy.b.toFixed(1) } : {}),
    ...headers,
  };
  const head = Object.entries(hs).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n');
  const firstBlack = g.startFen.split(' ')[1] === 'b';
  const fullStart = Number(g.startFen.split(' ')[5] ?? 1) || 1;
  const toks: string[] = [];
  g.san.forEach((san, i) => {
    const p = i + (firstBlack ? 1 : 0);
    const no = fullStart + Math.floor(p / 2);
    if (p % 2 === 0) toks.push(`${no}.`);
    else if (i === 0 || toks[toks.length - 1]?.endsWith('}') || toks[toks.length - 1]?.endsWith(')')) toks.push(`${no}...`);
    toks.push(san);
    const m = a?.moves[i];
    if (!m) return;
    if (NAG[m.cls]) toks.push(NAG[m.cls]!);
    const words = ERR.includes(m.cls) || m.cls === 'inaccuracy' || m.cls === 'brilliant' || m.cls === 'great' ? ` ${CLASS_META[m.cls].label}. ${explainMove(m)}` : '';
    toks.push(`{[%eval ${pgnEval(m.evalAfter)}]${words.replace(/[{}]/g, '')}}`);
    if ((ERR.includes(m.cls) || m.cls === 'inaccuracy') && m.pv.length) {
      toks.push(`(${numbered(m.pv.slice(0, 6), p, fullStart)})`);
    }
  });
  toks.push(g.result);
  const lines: string[] = [];
  let cur = '';
  for (const t of toks) {
    if ((cur + ' ' + t).length > 79 && cur) {
      lines.push(cur);
      cur = t;
    } else cur = cur ? cur + ' ' + t : t;
  }
  if (cur) lines.push(cur);
  return `${head}\n\n${lines.join('\n')}\n`;
}

/** Evaluation-graph hit testing: horizontal fraction (0..1) of the graph → ply (0..nMoves). */
export function plyAtGraphX(frac: number, nMoves: number): number {
  if (!isFinite(frac) || nMoves <= 0) return 0;
  return Math.max(0, Math.min(nMoves, Math.round(frac * nMoves)));
}

/** Graph y for an evaluation (White POV): win% clamped to 0..100, mates pinned to the edges. */
export function graphValue(e: { cp?: number; mate?: number } | undefined): number {
  if (!e) return 50;
  if (e.mate !== undefined) return e.mate > 0 ? 100 : e.mate < 0 ? 0 : 50;
  return Math.max(0, Math.min(100, winPercent(e)));
}
