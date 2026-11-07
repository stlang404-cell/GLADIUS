import type { GameAnalysis, MoveAnalysis, TrainingPosition } from '../game/state';

/**
 * v3 analysis extensions. These are OPTIONAL fields stored alongside the
 * v0.2 `GameAnalysis` / `MoveAnalysis` / `TrainingPosition` shapes declared
 * in game/state.ts (records are plain JSON, so extra fields persist as-is and
 * old analyses simply lack them). Readers must treat every field as optional.
 */
export const ANALYSIS_VERSION = 3;

export type Phase = 'opening' | 'middlegame' | 'endgame';
export const PHASES: Phase[] = ['opening', 'middlegame', 'endgame'];

/** One MultiPV candidate from the position BEFORE the move (analysis only). */
export type AltLine = { uci: string; san: string; eval: { cp?: number; mate?: number } /* white POV */; line: string[] /* SAN, ≤ 6 */ };

/** Motif tags computed at analysis time (used for explanations & weakness tracking). */
export type MoveTag =
  | 'sacrifice' // verified material sacrifice (see classify.ts)
  | 'onlyMove' // gap to the 2nd-best candidate ≥ GREAT_GAP
  | 'recapture'
  | 'hangs' // the engine's best reply wins material (SEE ≥ 2)
  | 'allowsMate' // the opponent now has a forced mate
  | 'missedMate' // a forced mate was available and not kept
  | 'missedWin' // best move was a capture/check winning ≥ 2 pawns of material along the engine line
  | 'bookExit'; // first non-book move of the game by this side

export type MoveAnalysisX = MoveAnalysis & {
  phase?: Phase;
  alts?: AltLine[];
  tags?: MoveTag[];
  /** Hanging piece after the move, e.g. { piece: 'n', square: 'f5' } (tag 'hangs'). */
  hangs?: { piece: string; square: string };
  /** Material sacrificed, in pawns (tag 'sacrifice'). */
  sacrificed?: number;
  /** Mate distance for tags allowsMate / missedMate. */
  mateIn?: number;
};

export type PhaseStat = { acc: number | null; moves: number; errors: number /* mistakes + blunders + misses */; inaccuracies: number };

/** Puzzle candidate from a real mistake: the position before the move, solution = verified engine line. */
export type PuzzleCandidate = {
  ply: number;
  fen: string;
  line: string[]; // UCI; trainee moves at even indices
  margin: number; // win% gap between the solution and the 2nd-best move at the root
  theme: TrainingPosition['theme'];
  playedUci: string;
  cls: MoveAnalysis['cls'];
};

export type EndgameReview = {
  ply: number; // first endgame ply
  type: string; // e.g. "Rook endgame", "Rook vs minor piece"
  winAtEntry: { w: number; b: number }; // win% at entry for each side
};

export type GameAnalysisX = Omit<GameAnalysis, 'moves'> & {
  moves: MoveAnalysisX[];
  version?: number;
  multipv?: number;
  phases?: Record<Phase, { w: PhaseStat; b: PhaseStat }>;
  endgameReview?: EndgameReview | null;
  puzzles?: PuzzleCandidate[];
  /** Ply index at which each side first left the opening book (or null). */
  bookExit?: { w: number | null; b: number | null };
};

export type Attempt = { t: number; ok: boolean };

export type TrainingPositionX = TrainingPosition & {
  line?: string[];
  margin?: number;
  cls?: MoveAnalysis['cls'];
  v?: number;
  /** Last ≤ 10 attempts. `ok` only for a clean solve (no wrong move, no reveal). */
  attempts?: Attempt[];
};

/** Optional extra on Save.coach: progress on built-in puzzles and drills, keyed by id. */
export type CoachPractice = Record<string, { a: number; ok: number; last: number }>;
export type CoachStateX = { practice?: CoachPractice };

/** Record one attempt (pure helper; mutates `p`). Only clean solves count as solved. */
export function recordAttempt(p: TrainingPositionX, ok: boolean, now = Date.now()) {
  if (ok) p.solved++;
  else p.failed++;
  p.attempts = [...(p.attempts ?? []).slice(-9), { t: now, ok }];
}

export function asX(a: GameAnalysis | undefined | null): GameAnalysisX | null {
  return (a as GameAnalysisX | undefined) ?? null;
}
