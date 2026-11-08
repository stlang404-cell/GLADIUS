import { Chess, type Color, type Square, type PieceSymbol } from 'chess.js';
import type { UciEngine, PvLine, Score, SearchParams, SearchBudget } from './uci';
import { winPercent } from './uci';
import { bookMoves, OPENINGS, openingFamily, type OpeningStyle } from '../chess/openings';
import { createRng, clamp, type Rng } from '../core/rng';
import { START_FEN } from '../chess/rules';
import { type PlayStyle, type ProductStyle, STYLE_TO_OPENINGS, normalizeStyle } from './styles';

export type { PlayStyle };
export { STYLE_TO_OPENINGS };

/**
 * Opponent strength model (docs/ENGINE.md, "Personas").
 *
 *  elo < 2700   GLADIUS sampler: MultiPV candidates at an Elo-dependent depth,
 *               softmax over win%-loss with an Elo-dependent temperature,
 *               "oversight" picks, style bonuses (scaled down with strength).
 *               Calibrated by tests/bench/calibration.test.ts.
 *  2700–2999    Elite: time-based MultiPV-3 search on the elite engine slot,
 *               low temperature, a blunder guard, style only as a tie-break
 *               among near-equal moves.
 *  ≥ 3000       Top tier: single-PV search (MultiPV costs strength) with the
 *               full budget on the strongest engine slot of the device; on a
 *               clock, Stockfish's own time manager decides.
 *
 * FAIRNESS GUARANTEE — no hidden difficulty adjustment:
 *   The strength of a move choice is a pure function of (persona.elo,
 *   persona.style, the position/history, the persona seed, the clock, the
 *   engine build the device can run). Nothing here reads game results, the
 *   player's rating, win streaks or the score of the current match, and no
 *   caller may scale `elo` after a player win: persona Elo comes from the
 *   competitor's hidden skill (world simulation), never from the player's
 *   results. `prep` only chooses *which book line* to play (legitimate
 *   opening preparation, visible to the player in the Empire tab); it never
 *   changes search depth, time or temperature.
 */

export type Persona = {
  elo: number;
  style: PlayStyle;
  openingStyles: OpeningStyle[];
  seed: number;
};

export type MoveChoice = {
  uci: string;
  source: 'book' | 'sampler' | 'limited' | 'elite' | 'full';
  thinkMs: number;
  /** Total time this move was allowed to take (search + human delay), ms. */
  budgetMs?: number;
  /** Engine score of the chosen move, side-to-move perspective (absent for book moves). */
  score?: Score;
  /** Book line name, for book moves. */
  opening?: string;
};

/** Clock state of the side to move, when the game is timed. */
export type ClockInfo = { myMs: number; oppMs?: number; incMs?: number; moveNumber?: number };

/** Legitimate preparation vs a specific player: opening names (full "Family: Variation" or a family). */
export type PrepHints = { avoidLines?: string[]; preferLines?: string[] };

export type ChooseOptions = {
  pace?: 'instant' | 'natural';
  startFen?: string;
  clock?: ClockInfo;
  prep?: PrepHints;
  /** Untimed think time for elite/top personas (ms). Defaults: 900–1500 elite, 2000 top. */
  thinkMs?: number;
  signal?: AbortSignal;
};

/** Piecewise-linear interpolation over Elo knots. */
function interp(knots: [number, number][], elo: number): number {
  if (elo <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    const [x1, y1] = knots[i];
    const [x0, y0] = knots[i - 1];
    if (elo <= x1) return y0 + ((y1 - y0) * (elo - x0)) / (x1 - x0);
  }
  return knots[knots.length - 1][1];
}

// Calibrated by tests/bench/calibration.test.ts (see docs/ENGINE.md).
export const TEMPERATURE_KNOTS: [number, number][] = [[400, 45], [800, 30], [1200, 18], [1600, 10], [2000, 8], [2400, 5], [2800, 1.8], [3000, 0.5]];
export const OVERSIGHT_KNOTS: [number, number][] = [[400, 0.26], [800, 0.15], [1200, 0.07], [1600, 0.03], [2000, 0.012], [2400, 0.004], [2800, 0]];
/** Elite band (2700–2999) temperature, win% points. */
export const ELITE_TEMPERATURE_KNOTS: [number, number][] = [[2700, 1.2], [2850, 0.7], [3000, 0.25]];
export const ELITE_FROM = 2700;
export const TOP_FROM = 3000;

export function samplerDepth(elo: number): number {
  return elo < 1000 ? 4 : elo < 1600 ? 6 : elo < 2200 ? 8 : elo < 2700 ? 10 : 12;
}
export function samplerMultiPv(elo: number): number {
  return elo < 1200 ? 40 : elo < 2000 ? 16 : elo < 2600 ? 10 : 6;
}
/** Softmax temperature in win-percentage points. Higher = more mistakes. */
export function samplerTemperature(elo: number): number {
  return interp(TEMPERATURE_KNOTS, elo);
}
/** Probability of an "oversight": choosing uniformly among candidates. */
export function oversightChance(elo: number): number {
  return interp(OVERSIGHT_KNOTS, elo);
}

export function bookDepth(elo: number, style?: PlayStyle): number {
  const extra = style && normalizeStyle(style) === 'theoretician' ? 8 : 0;
  return clamp(Math.round(2 + elo / 180) + extra, 2, 26);
}

// ---------------------------------------------------------------------------
// Time management
// ---------------------------------------------------------------------------

export type TimePlan = {
  /** Upper bound for the engine search (ms). */
  searchMs: number;
  /** Upper bound for the whole turn: search + human-like delay (ms). Infinity when untimed. */
  totalMs: number;
  panic: boolean;
};

/** Assumed latency per move outside the search (worker messaging, React, animation start). */
export const MOVE_OVERHEAD_MS = 150;

/**
 * Clock-aware time allocation (pure; unit-tested in tests/engine.persona.test.ts).
 *   normal : remaining / movesToGo + 0.8 × increment, movesToGo 35 → 25 as the game goes on
 *   cap    : never more than 20 % of the remaining time on one move, and always keep
 *            a safety reserve (≥ 1 s, or 10 % of the clock when below 10 s)
 *   panic  : below 10 s (5 s with ≥ 2 s increment) spend ~1/40 of the clock + half the
 *            increment, at most 1 s, with no artificial delay
 *   floor  : 30 ms search so the engine still returns a sound move
 * Time per move shrinks geometrically with the clock, so with any increment, and in
 * sudden-death controls ≥ 3 min for games under ~150 moves, the persona does not flag
 * (simulated in tests/bench/clock.slow.test.ts).
 */
export function allocateTime(clock: ClockInfo | undefined, untimedSearchMs: number): TimePlan {
  if (!clock || !Number.isFinite(clock.myMs)) return { searchMs: untimedSearchMs, totalMs: Infinity, panic: false };
  const my = Math.max(0, clock.myMs);
  const inc = Math.max(0, clock.incMs ?? 0);
  const mn = clock.moveNumber ?? 20;
  const usable = Math.max(0, my - MOVE_OVERHEAD_MS);
  const panicBelow = inc >= 2000 ? 5000 : 10000;
  if (my < panicBelow) {
    const t = Math.min(1000, my / 40 + inc * 0.5, usable * 0.25);
    const total = Math.max(30, t);
    return { searchMs: total, totalMs: total, panic: true };
  }
  const mtg = mn < 20 ? 35 : mn < 40 ? 30 : 25;
  let t = my / mtg + inc * 0.8 - MOVE_OVERHEAD_MS;
  const reserve = Math.max(1000, my * 0.1);
  t = Math.min(t, my * 0.2, my - reserve);
  const total = Math.max(30, t);
  return { searchMs: Math.min(total, untimedSearchMs * 4), totalMs: total, panic: false };
}

// ---------------------------------------------------------------------------
// Style heuristics
// ---------------------------------------------------------------------------

const VAL: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const FILES = 'abcdefgh';

function sq(f: number, r: number): Square {
  return (FILES[f] + (r + 1)) as Square;
}
function coords(s: string): [number, number] {
  return [s.charCodeAt(0) - 97, Number(s[1]) - 1];
}
function kingSquare(c: Chess, color: Color): Square | null {
  return c.findPiece({ type: 'k', color })[0] ?? null;
}
function zone(k: Square): Square[] {
  const [f, r] = coords(k);
  const out: Square[] = [];
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    const x = f + df;
    const y = r + dr;
    if (x >= 0 && x < 8 && y >= 0 && y < 8) out.push(sq(x, y));
  }
  return out;
}
function zonePressure(c: Chess, attacker: Color): number {
  const k = kingSquare(c, attacker === 'w' ? 'b' : 'w');
  if (!k) return 0;
  let n = 0;
  for (const s of zone(k)) n += c.attackers(s, attacker).length;
  return n;
}
function nonPawnMaterial(c: Chess, color: Color): number {
  let m = 0;
  for (const row of c.board()) for (const p of row) if (p && p.color === color && p.type !== 'p' && p.type !== 'k') m += VAL[p.type];
  return m;
}
/** Pieces of `victim` that `attacker` threatens (undefended, or attacked by a cheaper piece). */
function threats(c: Chess, attacker: Color): number {
  const victim: Color = attacker === 'w' ? 'b' : 'w';
  let n = 0;
  for (const row of c.board()) {
    for (const p of row) {
      if (!p || p.color !== victim || p.type === 'k') continue;
      const atk = c.attackers(p.square, attacker);
      if (!atk.length) continue;
      const def = c.attackers(p.square, victim).length;
      const cheapest = Math.min(...atk.map((s) => VAL[c.get(s)!.type] || 100));
      if (def === 0 || cheapest < VAL[p.type]) n += p.type === 'p' ? 0.5 : 1;
    }
  }
  return n;
}
function mobilityOf(fen: string, color: Color): number {
  const parts = fen.split(' ');
  parts[1] = color;
  parts[3] = '-';
  try {
    return new Chess(parts.join(' ')).moves().length;
  } catch {
    return 0;
  }
}
function isPassed(c: Chess, s: Square, color: Color): boolean {
  const [f, r] = coords(s);
  const dir = color === 'w' ? 1 : -1;
  for (let y = r + dir; y >= 0 && y < 8; y += dir) {
    for (let x = f - 1; x <= f + 1; x++) {
      if (x < 0 || x > 7) continue;
      const p = c.get(sq(x, y));
      if (p && p.type === 'p' && p.color !== color) return false;
    }
  }
  return true;
}
function centreDistance(s: string): number {
  const [f, r] = coords(s);
  return Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5));
}

export type StyleContext = {
  /** Win% of the best candidate (side to move). */
  bestWin: number;
  ply: number;
};

/**
 * Style preference for one candidate move, in win-percentage points (before the
 * strength scaling applied by the caller). Sound, cheap chess heuristics only;
 * the engine evaluation still dominates because the sampler subtracts real
 * win% loss.
 */
export function styleBonus(style: PlayStyle, fen: string, uci: string, ctx: StyleContext = { bestWin: 50, ply: 20 }): number {
  const s: ProductStyle = normalizeStyle(style);
  if (s === 'universal') return 0;
  const before = new Chess(fen);
  const us = before.turn();
  const them: Color = us === 'w' ? 'b' : 'w';
  const after = new Chess(fen);
  let m;
  try {
    m = after.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return 0;
  }
  const check = after.isCheck();
  const capture = !!m.captured;
  const castle = m.isKingsideCastle() || m.isQueensideCastle();
  const opening = ctx.ply < 20;
  const endgame = nonPawnMaterial(before, us) + nonPawnMaterial(before, them) <= 26;
  const ahead = ctx.bestWin >= 62;
  const behind = ctx.bestWin <= 38;
  const ek = kingSquare(after, them);
  const ok = kingSquare(after, us);
  const near = ek ? Math.max(Math.abs(coords(m.to)[0] - coords(ek)[0]), Math.abs(coords(m.to)[1] - coords(ek)[1])) : 8;
  const develops = opening && (m.piece === 'n' || m.piece === 'b') && m.from[1] === (us === 'w' ? '1' : '8');
  const shieldPawn = m.piece === 'p' && ok && !endgame && Math.abs(coords(m.from)[0] - coords(ok)[0]) <= 1 && (us === 'w' ? ok[1] === '1' : ok[1] === '8');
  switch (s) {
    case 'attacker': {
      const dz = zonePressure(after, us) - zonePressure(before, us);
      const storm = m.piece === 'p' && ek && !endgame && Math.abs(coords(m.to)[0] - coords(ek)[0]) <= 1;
      return (check ? 1.5 : 0) + clamp(dz * 0.6, -0.6, 2) + (capture ? 0.4 : 0) + (near <= 2 && m.piece !== 'k' ? 0.6 : 0) + (storm ? 0.5 : 0);
    }
    case 'strategist': {
      const mob = mobilityOf(after.fen(), us) - mobilityOf(fen, us);
      const centre = (m.piece === 'n' || m.piece === 'b') && centreDistance(m.to) <= 1.5 ? 0.6 : 0;
      const [, r] = coords(m.to);
      const rel = us === 'w' ? r : 7 - r;
      const outpost = m.piece === 'n' && rel >= 3 && rel <= 5 && !after.attackers(m.to, them).some((x) => after.get(x)?.type === 'p') ? 0.8 : 0;
      const earlyQueen = opening && m.piece === 'q' ? -0.8 : 0;
      return clamp(mob * 0.08, -1, 1.2) + centre + outpost + (castle ? 1 : 0) + earlyQueen + (shieldPawn ? -0.6 : 0) + (develops ? 0.5 : 0);
    }
    case 'defender': {
      const tb = threats(before, them);
      const ta = threats(after, them);
      const restrict = mobilityOf(fen, them) - after.moves().length; // fewer replies for the opponent
      const tradeAttacker = capture && near > 2 && behind ? 0.5 : 0;
      return (castle ? 1.5 : 0) + clamp((tb - ta) * 0.8, -1, 2) + clamp(restrict * 0.05, -0.5, 1) + (shieldPawn ? -0.8 : 0) + tradeAttacker + (m.piece === 'k' && !endgame && !castle ? -0.5 : 0);
    }
    case 'technician': {
      let b = 0;
      if (ahead) {
        if (capture && m.captured !== 'p' && Math.abs(VAL[m.captured!] - VAL[m.piece]) <= 1) b += 1.2;
        else if (capture) b += 0.4;
        if (check && !capture) b -= 0.2; // no needless adventures
      } else if (behind && capture && m.captured !== 'p') b -= 0.6;
      if (endgame) {
        if (m.piece === 'k' && !castle && centreDistance(m.to) < centreDistance(m.from)) b += 0.8;
        if (m.piece === 'p' && isPassed(after, m.to, us)) b += 0.8;
      }
      return b + (castle ? 0.6 : 0);
    }
    case 'theoretician': {
      // Out of book it plays like a classical strategist, half-weighted.
      return 0.5 * styleBonus('strategist', fen, uci, ctx);
    }
    case 'counterattacker': {
      const pressed = before.isCheck() || threats(before, them) >= 1 || ctx.bestWin < 45;
      const t = threats(after, us);
      return pressed ? clamp(t * 0.9, 0, 2) + (check ? 0.8 : 0) : clamp(t * 0.3, 0, 0.6);
    }
    case 'gambiteer': {
      const t = threats(after, us);
      const restrict = mobilityOf(fen, them) - after.moves().length;
      const open = m.piece === 'p' && 'cdef'.includes(m.from[0]) && !endgame ? 0.3 : 0;
      return (develops ? 0.8 : 0) + (check ? 0.8 : 0) + clamp(t * 0.5, 0, 1.5) + clamp(restrict * 0.04, -0.4, 0.8) + (castle ? 0.6 : 0) + open;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Opening book with style and preparation
// ---------------------------------------------------------------------------

function nameMatches(lineName: string, want: string): boolean {
  if (lineName === want) return true;
  if (!want.includes(':')) return openingFamily(lineName) === want;
  return lineName.startsWith(want + ',') || lineName.startsWith(want + ':');
}

/** Lines (by prefix) that the sequence `seq` leads into. */
function linesFrom(seq: string[]) {
  return OPENINGS.filter((l) => l.uci.length >= seq.length && seq.every((u, i) => l.uci[i] === u));
}

export type BookPick = { uci: string; name: string; weight: number };

/** Book candidates with persona style and preparation applied (exported for tests). */
export function weightedBook(history: string[], persona: Persona, prep?: PrepHints): BookPick[] {
  const style = normalizeStyle(persona.style);
  const book = bookMoves(history, persona.openingStyles);
  if (!book.length) return [];
  const avoid = prep?.avoidLines?.filter(Boolean) ?? [];
  const prefer = prep?.preferLines?.filter(Boolean) ?? [];
  return book.map((b) => {
    let w = b.weight;
    if (style === 'theoretician') w = Math.pow(w, 1.6); // main lines
    const reach = linesFrom([...history, b.uci]);
    if (reach.length) {
      const total = reach.reduce((a, l) => a + l.weight, 0);
      if (style === 'gambiteer') {
        const g = reach.filter((l) => l.styles.includes('gambit')).reduce((a, l) => a + l.weight, 0);
        w *= 1 + 3 * (g / total);
      }
      if (avoid.length) {
        const a = reach.filter((l) => avoid.some((x) => nameMatches(l.name, x))).reduce((s, l) => s + l.weight, 0);
        w *= 1 - 0.95 * (a / total);
      }
      if (prefer.length) {
        const p = reach.filter((l) => prefer.some((x) => nameMatches(l.name, x))).reduce((s, l) => s + l.weight, 0);
        w *= 1 + 5 * (p / total);
      }
    }
    return { uci: b.uci, name: b.name, weight: Math.max(w, 1e-6) };
  });
}

function pickWeighted<T extends { weight: number }>(xs: T[], rng: Rng): T {
  const total = xs.reduce((a, b) => a + b.weight, 0);
  let r = rng.next() * total;
  for (const x of xs) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return xs[0];
}

// ---------------------------------------------------------------------------
// Sampler (< 2700)
// ---------------------------------------------------------------------------

/**
 * Style model (v0.3, measured in tests/bench/styles.slow.test.ts, docs/ENGINE.md).
 * v0.2 added `bonus × scale` to the win% loss *before* dividing by the
 * temperature, so the effect shrank with T and was measured as nil (≤ 0.4
 * percentage points on any move feature at 1600). Now a style shifts the
 * log-weight of a candidate by `gain × bonus`, independent of the temperature,
 * but only for candidates within `tolerance` win% of the best line: the style
 * chooses among moves the persona's strength already considers playable, so
 * strength (expected win% loss) moves by a bounded, measured amount.
 */
export const STYLE_GAIN_KNOTS: [number, number][] = [[800, 1.4], [1600, 1.2], [2200, 0.9], [2700, 0.7], [3000, 0.5]];
/** Win% from the best line within which the style may act. */
export const STYLE_TOLERANCE_KNOTS: [number, number][] = [[800, 8], [1600, 5], [2200, 3], [2600, 2], [2700, 1], [3000, 0.5]];
export function styleGain(elo: number): number {
  return interp(STYLE_GAIN_KNOTS, elo);
}
export function styleTolerance(elo: number): number {
  return interp(STYLE_TOLERANCE_KNOTS, elo);
}

const bonusMemo = new Map<string, number>();
function styleBonusMemo(style: PlayStyle, fen: string, uci: string, ctx: StyleContext): number {
  if (normalizeStyle(style) === 'universal') return 0;
  const k = `${style}|${fen}|${uci}|${ctx.bestWin.toFixed(1)}|${ctx.ply < 20 ? 'o' : 'm'}`;
  let v = bonusMemo.get(k);
  if (v === undefined) {
    v = styleBonus(style, fen, uci, ctx);
    if (bonusMemo.size > 4000) bonusMemo.clear();
    bonusMemo.set(k, v);
  }
  return v;
}

/**
 * Log-weight shift a style gives one candidate: only candidates within the
 * tolerance, and only by how much MORE the style likes them than the best line
 * (never negative). So a style can move probability from the best move to a
 * playable alternative it prefers, but can never make a persona *stronger* than
 * its calibrated `universal` self (a v0.3 prototype that also boosted the best
 * line when it was stylish lowered the win% loss by up to 0.9 points at 1600).
 */
export function styleShift(persona: Persona, fen: string, uci: string, loss: number, ctx: StyleContext, bestBonus: number, cap = 3): number {
  if (loss <= 0 || loss > styleTolerance(persona.elo)) return 0;
  const b = clamp(styleBonusMemo(persona.style, fen, uci, ctx), -2, cap);
  return styleGain(persona.elo) * Math.max(0, b - bestBonus);
}
function bestBonusOf(persona: Persona, fen: string, cands: PvLine[], wins: number[], best: number, ctx: StyleContext, cap = 3): number {
  const i = wins.indexOf(best);
  return i < 0 ? 0 : clamp(styleBonusMemo(persona.style, fen, cands[i].pv[0], ctx), -2, cap);
}

/** Pure selection step of the sampler, separated for testing. */
export function sampleCandidate(lines: PvLine[], persona: Persona, fen: string, rng: Rng, ply = 20): string | null {
  const cands = lines.filter((l) => l.pv.length > 0);
  if (cands.length === 0) return null;
  const wins = cands.map((l) => winPercent(l.score));
  const best = Math.max(...wins);
  const T = samplerTemperature(persona.elo);
  if (rng.chance(oversightChance(persona.elo))) {
    // Weaker players' oversights can be any legal move (hung pieces, missed threats).
    if (persona.elo < 1600) {
      const legal = new Chess(fen).moves({ verbose: true });
      if (legal.length) {
        const m = rng.pick(legal);
        return m.from + m.to + (m.promotion ?? '');
      }
    }
    return rng.pick(cands).pv[0];
  }
  const ctx: StyleContext = { bestWin: best, ply };
  const bb = bestBonusOf(persona, fen, cands, wins, best, ctx);
  const weights = cands.map((l, i) => {
    const loss = best - wins[i];
    return Math.exp(-loss / T + styleShift(persona, fen, l.pv[0], loss, ctx, bb));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i];
    if (r <= 0) return cands[i].pv[0];
  }
  return cands[0].pv[0];
}

/**
 * Elite selection (2700–2999): low-temperature softmax over the top lines with a
 * blunder guard (never more than 3 win% below best); the style acts only among
 * lines within 1 → 0.5 win% of the best (genuine strength is kept).
 */
export function eliteSelect(lines: PvLine[], persona: Persona, fen: string, rng: Rng, ply = 20): PvLine | null {
  const cands = lines.filter((l) => l.pv.length > 0);
  if (!cands.length) return null;
  const wins = cands.map((l) => winPercent(l.score));
  const best = Math.max(...wins);
  const T = interp(ELITE_TEMPERATURE_KNOTS, persona.elo);
  const ctx: StyleContext = { bestWin: best, ply };
  const ok = cands.map((l, i) => ({ l, loss: best - wins[i] })).filter((x) => x.loss <= 3);
  const bb = bestBonusOf(persona, fen, cands, wins, best, ctx, 2);
  const weights = ok.map((x) => ({ l: x.l, weight: Math.exp(-x.loss / T + styleShift(persona, fen, x.l.pv[0], x.loss, ctx, bb, 2)) }));
  return pickWeighted(weights, rng).l;
}

// ---------------------------------------------------------------------------
// Human-like delay
// ---------------------------------------------------------------------------

/**
 * Natural "thinking" delay so opponents feel human; never blocks input.
 * With `clock`, the delay never exceeds the move's time budget (and is ~0 in panic),
 * so the human touch can never cost the persona the game on time.
 */
export function humanDelay(elo: number, ply: number, rng: Rng, pace: 'instant' | 'natural', clock?: ClockInfo): number {
  const plan = clock ? allocateTime(clock, 1500) : null;
  if (pace === 'instant') return plan?.panic ? 0 : Math.min(150, plan?.totalMs ?? 150);
  const base = ply < 10 ? 350 : 700 + Math.min(1400, elo / 2);
  const d = Math.round(base * (0.6 + rng.next() * 0.9));
  if (!plan) return d;
  if (plan.panic) return 0;
  return Math.max(0, Math.min(d, Math.floor(plan.totalMs)));
}

// ---------------------------------------------------------------------------
// chooseMove
// ---------------------------------------------------------------------------

/**
 * Untimed think time (internal compute budget; the player has no clock).
 * Elite 900→1500 ms across 2700–2999, top tier 2000 ms by default; the browser
 * pool passes device budgets via `engine.budget` (phones get more time, since
 * they search 2–5× fewer nodes per second).
 */
export function untimedThink(elo: number, override?: number, budget?: SearchBudget): number {
  if (override) return override;
  if (elo >= TOP_FROM) return budget?.topMs ?? 2000;
  const [lo, hi] = budget?.eliteMs ?? [900, 1500];
  return Math.round(interp([[ELITE_FROM, lo], [TOP_FROM, hi]], elo));
}

/**
 * Search from the game's start position + moves when the history is consistent
 * with `fen`, so the engine sees repetitions (avoids walking into a threefold
 * draw when winning, or finds one when losing). Falls back to the bare FEN.
 */
export function searchPosition(fen: string, history: string[], startFen?: string): Pick<SearchParams, 'fen' | 'moves'> {
  if (!history.length || history.length > 600) return { fen };
  try {
    const c = new Chess(startFen ?? START_FEN);
    for (const u of history) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    const key = (f: string) => f.split(' ').slice(0, 4).join(' ');
    if (key(c.fen()) === key(fen)) return { fen: startFen ?? START_FEN, moves: history };
  } catch {
    /* inconsistent history */
  }
  return { fen };
}

function lineFor(lines: PvLine[], uci: string): PvLine | undefined {
  return lines.find((l) => l.pv[0] === uci);
}

export async function chooseMove(
  engine: UciEngine,
  fen: string,
  history: string[],
  persona: Persona,
  opts: ChooseOptions = {},
): Promise<MoveChoice> {
  const rng = createRng((persona.seed ^ (history.length * 2654435761)) >>> 0);
  const t0 = Date.now();
  const elapsed = () => Date.now() - t0;
  const ply = history.length;
  const plan = allocateTime(opts.clock, untimedThink(persona.elo, opts.thinkMs, engine.budget));
  const budgetMs = Number.isFinite(plan.totalMs) ? Math.round(plan.totalMs) : undefined;

  // 1) Opening preparation from the book (style/prep-weighted). Only from the standard start.
  if (!opts.startFen && ply < bookDepth(persona.elo, persona.style)) {
    const book = weightedBook(history, persona, opts.prep);
    if (book.length) {
      const b = pickWeighted(book, rng);
      return { uci: b.uci, source: 'book', thinkMs: elapsed(), budgetMs, opening: b.name };
    }
  }

  const base: Pick<SearchParams, 'fen' | 'moves' | 'signal'> = { ...searchPosition(fen, history, opts.startFen), signal: opts.signal };

  // 2) Sampler band.
  if (persona.elo < ELITE_FROM) {
    const p: SearchParams = { ...base, depth: samplerDepth(persona.elo), multipv: samplerMultiPv(persona.elo) };
    if (opts.clock) p.movetime = Math.max(30, Math.round(plan.searchMs * 0.8)); // depth OR time, whichever first
    const res = await engine.search(p);
    const pick = sampleCandidate(res.lines, persona, fen, rng, ply) ?? res.bestmove;
    return { uci: pick!, source: 'sampler', thinkMs: elapsed(), budgetMs, score: pick ? lineFor(res.lines, pick)?.score : undefined };
  }

  // 3) Elite band.
  if (persona.elo < TOP_FROM) {
    const res = await engine.search({ ...base, movetime: Math.max(30, Math.round(plan.searchMs)), multipv: 3 });
    const l = eliteSelect(res.lines, persona, fen, rng, ply);
    const uci = l?.pv[0] ?? res.bestmove!;
    return { uci, source: 'elite', thinkMs: elapsed(), budgetMs, score: l?.score };
  }

  // 4) Top tier: strongest practical configuration.
  let p: SearchParams;
  if (opts.clock && !plan.panic) {
    // Stockfish's own time manager (it knows when a position is critical).
    // Clocks are reduced by our overhead so the GUI round-trip is accounted for.
    const white = fen.split(' ')[1] === 'w';
    const my = Math.max(50, opts.clock.myMs - 2 * 150);
    const opp = Math.max(50, (opts.clock.oppMs ?? opts.clock.myMs) - 2 * 150);
    const inc = opts.clock.incMs ?? 0;
    // Watchdog: SF never needs more than ~2× our own allocation; `stop` is graceful.
    p = { ...base, wtime: white ? my : opp, btime: white ? opp : my, winc: inc, binc: inc, timeoutMs: plan.totalMs * 2 + 1000 };
  } else {
    p = { ...base, movetime: Math.max(30, Math.round(plan.searchMs)), multipv: 1 };
  }
  const res = await engine.search(p);
  return { uci: res.bestmove!, source: 'full', thinkMs: elapsed(), budgetMs, score: res.lines[0]?.score };
}
