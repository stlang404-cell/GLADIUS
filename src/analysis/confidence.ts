import type { MoveClass } from '../game/state';
import type { GameAnalysisX, MoveAnalysisX } from './types';

/**
 * Confidence model (v0.4). A classification is only as good as the search
 * behind it, so every analysed move carries:
 *
 *   depth    depth of the searches that judged it (the shallower of the
 *            position before and after the move; finished positions are exact);
 *   nodes    nodes searched for those two positions;
 *   instab   instability in win% (mover's point of view), the larger of
 *              · depth volatility: the spread (max − min) of the principal
 *                line's win% over the last three completed iterations, for
 *                the position before and the position after the move, and
 *              · inconsistency: |value of the played move in the root
 *                MultiPV search − value from the search after the move| (two
 *                views of the same position that should agree);
 *   conf     'high' | 'medium' | 'low', from the rules in moveConfidence().
 *
 * Claims (Brilliant, Great, Mistake, Blunder, Missed win) are re-searched
 * deeper by the verification pass (analyzer.ts). A claim is 'high' only when
 * it was verified and the deep evaluation is stable; an unverified claim is
 * at most 'medium'; an unstable one is 'low' and is shown as "Unclear".
 * Low-confidence Brilliant/Great moves are demoted to Best/Excellent (the
 * original claim is kept in `claim`), so no stored count ever credits an
 * unconfirmed brilliancy.
 */
export const CONF = {
  /** Win% spread at or below which an evaluation counts as stable. */
  stable: 5,
  /** Above this spread (or inconsistency above `inconsistent`) the move is low confidence. */
  unstable: 10,
  /** Root-vs-after disagreement (win%) tolerated for 'high'. */
  consistent: 8,
  inconsistent: 15,
  /** Minimum search depth for a 'high' rating (11 = the lowest depth any device plan uses). */
  minDepth: 11,
  /** Verification: first deep search at depth + verifyExtra, escalating by verifyStep while unstable. */
  verifyExtra: 4,
  verifyStep: 4,
  verifySteps: 2,
  /** Deepest verification search: base depth + maxVerifyExtra, never beyond maxVerifyDepth. */
  maxVerifyExtra: 8,
  maxVerifyDepth: 22,
  /** Node cap of each verification search (deterministic single-threaded; bounds the cost of a deep search). */
  verifyNodes: 3_000_000,
  /** Node budget of the whole verification pass; moves left over stay unverified (at most 'medium'). */
  verifyBudgetNodes: 40_000_000,
  /** Moves verified per game (priority order: sacrifices/Brilliant/Great, then errors by size, then unstable moves). */
  maxVerify: 12,
};

export type Confidence = 'high' | 'medium' | 'low';

/** Classes that make a claim about the move and therefore need verification. */
export const CLAIMS: MoveClass[] = ['brilliant', 'great', 'mistake', 'blunder', 'miss'];
const ERRORS: MoveClass[] = ['mistake', 'blunder', 'miss'];
/** Classes shown as "Unclear" when their confidence is low. */
export const SHOWN_UNCLEAR: MoveClass[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder', 'miss'];

export type ConfInput = {
  cls: MoveClass;
  loss: number;
  vol: number; // depth volatility (win%)
  inc: number; // root-vs-after inconsistency (win%)
  depth: number;
  verified: boolean;
};

/** Win% spread of the last `k` completed iterations (0 for fewer than two). */
export function spread(trace: { d: number; w: number }[] | undefined, k = 3): number {
  if (!trace || trace.length < 2) return 0;
  const last = [...trace].sort((a, b) => a.d - b.d).slice(-k).map((t) => t.w);
  return Math.max(...last) - Math.min(...last);
}

/**
 * Rules (checked in order):
 *   forced / book                                         → high
 *   volatility > unstable or inconsistency > inconsistent → low
 *   Mistake/Blunder/Miss whose loss minus the instability
 *   would fall below the inaccuracy threshold (5)         → low  (noise could erase the error)
 *   claim not verified                                    → medium at most
 *   volatility ≤ stable, inconsistency ≤ consistent, depth ≥ minDepth → high
 *   otherwise                                             → medium
 */
export function moveConfidence(i: ConfInput): Confidence {
  if (i.cls === 'forced' || i.cls === 'book') return 'high';
  if (i.vol > CONF.unstable || i.inc > CONF.inconsistent) return 'low';
  const u = Math.max(i.vol, i.inc);
  if (ERRORS.includes(i.cls) && i.loss - u < 5) return 'low';
  const claim = CLAIMS.includes(i.cls);
  const solid = i.vol <= CONF.stable && i.inc <= CONF.consistent && i.depth >= CONF.minDepth;
  if (claim && !i.verified) return 'medium';
  return solid ? 'high' : 'medium';
}

/** Confidence of a stored move. Analyses made before v0.4 have none and are treated as 'medium' (shown as before, never used for puzzles). */
export function confOf(m: Pick<MoveAnalysisX, 'conf'>): Confidence {
  return m.conf ?? 'medium';
}

/** Is this move shown as "Unclear" (a low-confidence claim)? */
export function isUnclear(m: Pick<MoveAnalysisX, 'conf' | 'cls'>): boolean {
  return m.conf === 'low' && SHOWN_UNCLEAR.includes(m.cls);
}

/** A move whose classification may be used for training, puzzles and personal findings. */
export function isConfident(m: Pick<MoveAnalysisX, 'conf'>): boolean {
  return m.conf === 'high';
}

/**
 * May this move feed personal findings (recommendations, weakness and skill
 * statistics, "biggest moments")? Only high-confidence moves; analyses made
 * before v0.4 have no confidence and are used as before (they are marked
 * stale and can be re-analysed).
 */
export function isTrusted(m: Pick<MoveAnalysisX, 'conf'>): boolean {
  return m.conf === undefined || m.conf === 'high';
}

/** A trusted Mistake/Blunder/Miss (personal statistics count only these). */
export function isCountedError(m: Pick<MoveAnalysisX, 'conf' | 'cls'>): boolean {
  return ERRORS.includes(m.cls) && isTrusted(m);
}

/** For achievements: a brilliant move confirmed by a stable deep search. */
export function isConfidentBrilliant(m: Pick<MoveAnalysisX, 'conf' | 'cls'>): boolean {
  return m.cls === 'brilliant' && m.conf === 'high';
}

/**
 * Per-side class counts for analysis-gated achievements. Positive classes
 * (brilliant, great, best, excellent, good) are counted only when high
 * confidence; error classes are counted whatever their confidence, so an
 * unclear error still blocks "Flawless" (conservative in both directions).
 * Pre-v0.4 analyses (no confidence) fall back to their stored counts.
 */
export function confidentCounts(a: Pick<GameAnalysisX, 'moves' | 'counts'>, startFen = ''): GameAnalysisX['counts'] {
  if (!a.moves.some((m) => m.conf !== undefined)) return a.counts;
  const firstBlack = startFen.split(' ')[1] === 'b';
  const out: GameAnalysisX['counts'] = { w: {}, b: {} };
  const positive: MoveClass[] = ['brilliant', 'great', 'best', 'excellent', 'good'];
  for (const m of a.moves) {
    if (positive.includes(m.cls) && m.conf !== 'high') continue;
    const side = (m.ply % 2 === 0) !== firstBlack ? out.w : out.b;
    side[m.cls] = (side[m.cls] ?? 0) + 1;
  }
  return out;
}
