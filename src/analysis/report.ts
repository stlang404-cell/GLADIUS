import { Chess } from 'chess.js';
import type { GameRecord, MoveClass } from '../game/state';
import { winPercent } from '../engine/uci';
import { CLASS_META, displayClass } from './classify';
import { explainMove } from './analyzer';
import { asX, ANALYSIS_VERSION, type GameAnalysisX, type MoveAnalysisX } from './types';
import { ENDGAME_GUIDE, endgameFeedback, endgameVerdict } from '../chess/endgames';
import { isTrusted, isUnclear } from './confidence';
import { bookMoves } from '../chess/openings';
import { parseUci, START_FEN } from '../chess/rules';

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

export type Reliability = {
  depth: number;
  multipv: number;
  plies: number;
  level: 'low' | 'medium' | 'high';
  note: string;
  /** v4: moves re-searched deeper, deepest search, low-confidence claims shown as "Unclear". */
  verified: number;
  maxDepth: number;
  unclear: number;
  engine: string | null;
};

/**
 * How much to trust the numbers.
 *   base: depth ≥ 14 and ≥ 30 analysed moves per side is "high"; depth ≥ 11
 *         and ≥ 15 moves "medium"; otherwise "low" (short games swing a lot
 *         on one move; shallow searches misjudge deep tactics).
 *   v0.4: a game whose claims were all verified (no "Unclear" move) and that
 *         has ≥ 30 moves per side is "high" from depth 11; every two Unclear
 *         moves lower the level by one step.
 */
export function reliability(a: GameAnalysisX): Reliability {
  const perSide = Math.floor(a.moves.length / 2);
  let level: Reliability['level'] = a.depth >= 14 && perSide >= 30 ? 'high' : a.depth >= 11 && perSide >= 15 ? 'medium' : 'low';
  const v = a.verification;
  const unclear = v ? a.moves.filter((m) => isUnclear(m)).length : 0;
  if (v && unclear === 0 && a.depth >= 11 && perSide >= 30) level = 'high';
  const order: Reliability['level'][] = ['low', 'medium', 'high'];
  if (unclear >= 2) level = order[Math.max(0, order.indexOf(level) - Math.floor(unclear / 2))];
  const verified = v ? a.moves.filter((m) => m.verified).length : 0;
  const maxDepth = Math.max(a.depth, v?.maxDepth ?? 0, ...a.moves.map((m) => m.verified?.depth ?? 0));
  const note =
    `Stockfish depth ${a.depth}${a.multipv ? ` · ${a.multipv} lines` : ''} · ${a.moves.length} plies` +
    (v ? ` · ${verified} ${verified === 1 ? 'move' : 'moves'} verified${maxDepth > a.depth ? ` to depth ${maxDepth}` : ''}` : '') +
    (unclear ? ` · ${unclear} unclear` : '');
  return { depth: a.depth, multipv: a.multipv ?? 2, plies: a.moves.length, level, note, verified, maxDepth, unclear, engine: v?.engine ?? a.engine ?? null };
}

/** Class counts per side as SHOWN: low-confidence claims are counted as `unclear`, not under the class they were not confirmed as. */
export function displayCounts(g: Pick<GameRecord, 'startFen'>, a: Pick<GameAnalysisX, 'moves'>): Record<'w' | 'b', { counts: Partial<Record<MoveClass, number>>; unclear: number }> {
  const out = { w: { counts: {} as Partial<Record<MoveClass, number>>, unclear: 0 }, b: { counts: {} as Partial<Record<MoveClass, number>>, unclear: 0 } };
  for (const m of a.moves) {
    const sd = out[sideOf(g, m.ply)];
    if (isUnclear(m)) sd.unclear++;
    else sd.counts[m.cls] = (sd.counts[m.cls] ?? 0) + 1;
  }
  return out;
}

/** The player's (or White's) biggest errors, largest win% loss first. */
export function biggestMistakes(g: GameRecord, side?: 'w' | 'b', n = 3): MoveAnalysisX[] {
  const a = asX(g.analysis);
  if (!a) return [];
  const me = side ?? g.playerColor ?? 'w';
  return a.moves.filter((m) => sideOf(g, m.ply) === me && (isErr(m.cls) || m.cls === 'inaccuracy') && isTrusted(m)).sort((x, y) => y.winLoss - x.winLoss).slice(0, n);
}

/** Tactical opportunities: forcing wins or mates the side had and missed (high-confidence only). */
export function missedTactics(g: GameRecord, side?: 'w' | 'b'): MoveAnalysisX[] {
  const a = asX(g.analysis);
  if (!a) return [];
  const me = side ?? g.playerColor ?? 'w';
  return a.moves.filter((m) => sideOf(g, m.ply) === me && isErr(m.cls) && isTrusted(m) && (m.tags?.includes('missedWin') || m.tags?.includes('missedMate') || m.cls === 'miss'));
}

/** Short improvement recommendations for this game (≤ 3), most important first — from high-confidence moves only. */
export function gameRecommendations(g: GameRecord, side?: 'w' | 'b'): string[] {
  const a = asX(g.analysis);
  if (!a) return [];
  const me = side ?? g.playerColor ?? 'w';
  const all = a.moves.filter((m) => sideOf(g, m.ply) === me);
  const mine = all.filter(isTrusted);
  const out: { w: number; t: string }[] = [];
  const hangs = mine.filter((m) => isErr(m.cls) && (m.tags?.includes('hangs') || m.tags?.includes('allowsMate'))).length;
  if (hangs) out.push({ w: 3 + hangs, t: 'Blunder check: before each move, list every capture and check your opponent gets.' });
  const missed = missedTactics(g, me).length;
  if (missed) out.push({ w: 3 + missed, t: 'Look for forcing moves first — checks, captures, threats. A win was on the board.' });
  const phaseErr = (p: string, inacc: boolean) => mine.filter((m) => (m.phase ?? 'middlegame') === p && (isErr(m.cls) || (inacc && m.cls === 'inaccuracy'))).length;
  const oe = phaseErr('opening', true);
  if (oe >= 2) out.push({ w: 2 + phaseErr('opening', false), t: 'Opening: review the line you played in the explorer and follow the main ideas.' });
  const ee = phaseErr('endgame', false);
  if (ee > 0 && a.endgameReview) out.push({ w: 2 + ee, t: `${a.endgameReview.type}: ${ENDGAME_GUIDE[a.endgameReview.type]?.tip ?? 'activate the king.'}` });
  const score = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (me === 'w') ? 1 : 0;
  const peak = Math.max(...mine.filter((m) => (m.instab ?? 0) <= 10).map((m) => (me === 'w' ? winPercent(m.evalBefore) : 100 - winPercent(m.evalBefore))), 0);
  if (peak >= 80 && score < 1) out.push({ w: 4, t: 'You were winning. When ahead, trade pieces, keep pawns, and remove counterplay before attacking.' });
  if (a.endgameReview && endgameVerdict(a.endgameReview.winAtEntry[me], score) === 'saved') out.push({ w: 1, t: 'Good defence in the endgame. Keep it up.' });
  const unclear = all.filter((m) => isUnclear(m)).length;
  if (out.length === 0 && unclear) out.push({ w: 0, t: `${unclear} ${unclear === 1 ? 'move is' : 'moves are'} unclear to the engine. Use "Analyse deeper" on ${unclear === 1 ? 'it' : 'them'} before drawing conclusions.` });
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
  const star = a.moves.find((m) => sideOf(g, m.ply) === me && (m.cls === 'brilliant' || m.cls === 'great') && isTrusted(m));
  const pick = worst && worst.winLoss >= 5 ? worst : star ?? worst ?? null;
  return {
    status: status === 'done' && (a.version ?? 0) < ANALYSIS_VERSION ? 'stale' : status,
    accuracy: { player: a.accuracy[me], opponent: a.accuracy[me === 'w' ? 'b' : 'w'] },
    critical: pick ? { ply: pick.ply, san: pick.san, cls: pick.cls, label: displayClass(pick).label, text: explainMove(pick) } : null,
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

/**
 * NAG for a move, by confidence (v0.4):
 *   high (or a pre-v0.4 analysis)  the class's NAG;
 *   medium (claim not verified)    one step softer: !! → !, ?? → ?;
 *   low ("Unclear")                no NAG at all — never "??" or "!!" on an unstable evaluation.
 */
export function nagFor(m: Pick<MoveAnalysisX, 'cls' | 'conf'>): string | null {
  if (m.conf === 'low') return null;
  if (m.conf === 'medium') {
    if (m.cls === 'brilliant') return '$1';
    if (m.cls === 'blunder') return '$2';
  }
  return NAG[m.cls] ?? null;
}

/** "depth 19 · verified · high confidence" for PGN comments (null for pre-v0.4 analyses). */
function pgnProvenance(m: MoveAnalysisX): string | null {
  if (!m.conf) return null;
  const d = m.verified?.depth ?? m.depth;
  return [d ? `depth ${d}` : null, m.verified ? (m.verified.by === 'user' ? 'deeper on request' : 'verified') : null, `${m.conf} confidence`].filter(Boolean).join(', ');
}

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
    ...(a
      ? {
          Annotator: `GLADIUS analysis (${a.engine}, depth ${a.depth}${a.verification ? `, claims verified to depth ${reliability(a).maxDepth}` : ''})`,
          WhiteAccuracy: a.accuracy.w.toFixed(1),
          BlackAccuracy: a.accuracy.b.toFixed(1),
        }
      : {}),
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
    const nag = nagFor(m);
    if (nag) toks.push(nag);
    const claim = ERR.includes(m.cls) || m.cls === 'inaccuracy' || m.cls === 'brilliant' || m.cls === 'great' || !!m.claim;
    const unclear = isUnclear(m);
    const changed = m.verified?.from && m.verified.from !== m.cls ? ` A shallower search had called it ${CLASS_META[m.verified.from].label.toLowerCase()}.` : '';
    const prov = claim || unclear || changed ? pgnProvenance(m) : null;
    const text = unclear ? explainMove(m) : claim ? `${CLASS_META[m.cls].label}. ${explainMove(m)}` : changed ? `${CLASS_META[m.cls].label}.` : '';
    const words = text ? ` ${text}${changed}${prov ? ` (${prov})` : ''}` : '';
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

// ------------------------------------------------------------------ opening & endgame review

export type OpeningReview = {
  name: string | null;
  eco: string | null;
  /** The side's first move out of book while theory still had moves (null otherwise). */
  exit: { ply: number; san: string; cls: MoveClass; label: string; loss: number; unclear: boolean } | null;
  /** Who left the book first: this side ('player'), the opponent, the book simply ended ('end'), or null (still in book). */
  leftBy: 'player' | 'opponent' | 'end' | null;
  /** Book continuations (SAN) the theory offered at that point, most played first (≤ 3). */
  theory: string[];
  /** Was the book exit itself a trusted error (inaccuracy or worse)? */
  costly: boolean;
};

/**
 * Opening review for `side` (default: the player, else White): the side's
 * real book exit — its first move that is not among the opening book's
 * continuations from that position (the stored `bookExit` only marks the end
 * of the deepest NAMED line, so a later move can still be theory) — the
 * theory move(s) there, and whether leaving the book cost anything.
 */
export function openingReview(g: GameRecord, side?: 'w' | 'b'): OpeningReview | null {
  const a = asX(g.analysis);
  if (!a || g.startFen !== START_FEN) return null;
  const op = a.opening ?? g.opening ?? null;
  const me = side ?? g.playerColor ?? 'w';
  const c = new Chess();
  let exit: number | null = null;
  let leftBy: OpeningReview['leftBy'] = null;
  let theory: string[] = [];
  for (let k = 0; k < Math.min(g.moves.length, a.moves.length); k++) {
    const book = bookMoves(g.moves.slice(0, k));
    const mine = sideOf(g, k) === me;
    if (!book.some((b) => b.uci === g.moves[k])) {
      leftBy = book.length === 0 ? 'end' : mine ? 'player' : 'opponent';
      if (mine && book.length) {
        exit = k;
        theory = book
          .slice(0, 3)
          .map((b) => {
            try {
              return new Chess(c.fen()).move(parseUci(b.uci)).san;
            } catch {
              return null;
            }
          })
          .filter((x): x is string => !!x);
      }
      break;
    }
    try {
      c.move(parseUci(g.moves[k]));
    } catch {
      break;
    }
  }
  const m = exit !== null ? a.moves[exit] : null;
  const dc = m ? displayClass(m) : null;
  return {
    name: op?.name ?? null,
    eco: op?.eco ?? null,
    exit: m && dc ? { ply: m.ply, san: m.san, cls: m.cls, label: dc.label, loss: m.winLoss, unclear: dc.unclear } : null,
    leftBy,
    theory,
    costly: !!m && isTrusted(m) && (isErr(m.cls) || m.cls === 'inaccuracy'),
  };
}

export type EndgameSummary = {
  type: string;
  ply: number;
  winAtEntry: number;
  verdict: ReturnType<typeof endgameVerdict>;
  /** Trusted mistakes/blunders/misses in the endgame, and unclear ones (not counted). */
  errors: number;
  unclear: number;
  text: string;
};

/** Endgame review for `side`: entry, verdict and feedback, counting only high-confidence errors. */
export function endgameSummary(g: GameRecord, side?: 'w' | 'b'): EndgameSummary | null {
  const a = asX(g.analysis);
  const r = a?.endgameReview;
  if (!a || !r) return null;
  const me = side ?? g.playerColor ?? 'w';
  const score = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (me === 'w') ? 1 : 0;
  const mine = a.moves.filter((m) => m.ply >= r.ply && sideOf(g, m.ply) === me);
  const errors = mine.filter((m) => isErr(m.cls) && isTrusted(m)).length;
  const unclear = mine.filter((m) => isUnclear(m)).length;
  const text = endgameFeedback(r.type, r.winAtEntry[me], score, errors) + (unclear ? ` ${unclear} endgame ${unclear === 1 ? 'move is' : 'moves are'} unclear to the engine.` : '');
  return { type: r.type, ply: r.ply, winAtEntry: r.winAtEntry[me], verdict: endgameVerdict(r.winAtEntry[me], score), errors, unclear, text };
}
