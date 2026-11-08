import { Chess } from 'chess.js';
import type { GameRecord, Save } from '../game/state';
import { parseUci, positionKey } from '../chess/rules';

/**
 * Competitive integrity: engine analysis and study aids are separated from
 * play. Rules (enforced by the analysis queue, the review view and the
 * Academy import / explorer):
 *  1. A game is analysed only after it has finished (result ≠ '*') and is no
 *     longer the active game. The queue re-checks this before every run.
 *  2. While ANY game is in progress, an imported PGN/FEN that reaches the
 *     active game's current position is refused, and FEN play-outs are
 *     disabled (they would replace the active game).
 *  3. While a RATED game is in progress, the opening explorer (book moves) is
 *     locked.
 * The engine itself is never asked about the active game's position by any
 * Academy feature; MultiPV is used only by post-game analysis.
 */
export function analysisBlockReason(s: Pick<Save, 'active'>, g: Pick<GameRecord, 'id' | 'result'> | null | undefined): string | null {
  if (!g) return null;
  if (s.active && s.active.record.id === g.id) return 'Analysis unlocks when this game ends.';
  if (g.result === '*') return 'Analysis unlocks when this game ends.';
  return null;
}

export function canAnalyse(s: Pick<Save, 'active'>, g: Pick<GameRecord, 'id' | 'result'> | null | undefined): boolean {
  return !!g && analysisBlockReason(s, g) === null;
}

/** Is the opening explorer locked (a rated game is in progress)? */
export function explorerLocked(s: Pick<Save, 'active'>): boolean {
  return !!s.active && s.active.record.rated && s.active.record.result === '*';
}

/** Reason to refuse an import while a game is in progress, or null. */
export function importBlockReason(s: Pick<Save, 'active'>, imp: { startFen: string; moves: string[] } | { fen: string }): string | null {
  const act = s.active;
  if (!act) return null;
  if ('fen' in imp) return 'Finish your current game before playing out a position.';
  const cur = new Chess(act.record.startFen);
  for (const u of act.record.moves) {
    try {
      cur.move(parseUci(u));
    } catch {
      break;
    }
  }
  const target = positionKey(cur.fen());
  const c = new Chess(imp.startFen);
  if (positionKey(c.fen()) === target) return 'This position is from your game in progress. Finish it first.';
  for (const u of imp.moves) {
    try {
      c.move(parseUci(u));
    } catch {
      break;
    }
    if (positionKey(c.fen()) === target) return 'This position is from your game in progress. Finish it first.';
  }
  return null;
}

/**
 * Deeper analysis of one move (player request, v0.4): only for a finished,
 * already analysed game, and never while ANY game is in progress (the
 * engine must not run study searches during play). Re-checked when the job
 * starts.
 */
export function deepenBlockReason(s: Pick<Save, 'active'>, g: Pick<GameRecord, 'id' | 'result' | 'analysis'> | null | undefined): string | null {
  if (!g) return 'Game not found.';
  const r = analysisBlockReason(s, g);
  if (r) return r;
  if (s.active && s.active.record.result === '*') return 'Deeper analysis is paused while a game is in progress.';
  if (!g.analysis) return 'Analyse the game first.';
  return null;
}

/**
 * Analysis-gated achievements may only use a COMPLETE analysis of a finished
 * game: every move analysed, at the recorded depth.
 */
export function analysisComplete(g: Pick<GameRecord, 'moves' | 'result' | 'analysis'>): boolean {
  return !!g.analysis && g.result !== '*' && g.analysis.moves.length === g.moves.length && g.analysis.depth > 0;
}

/**
 * Analysis caching: a stored analysis is reused (never recomputed) unless it
 * was made by an older analyser version AND a re-analysis was asked for.
 * Unfinished / active games are never analysed.
 */
export function analysisNeeded(s: Pick<Save, 'active'>, g: Pick<GameRecord, 'id' | 'result' | 'moves' | 'analysis'> | null | undefined, version: number, force = false): boolean {
  if (!g || g.moves.length === 0 || analysisBlockReason(s, g) !== null) return false;
  if (!g.analysis) return true;
  return force && ((g.analysis as { version?: number }).version ?? 0) < version;
}
