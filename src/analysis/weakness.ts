import { Chess } from 'chess.js';
import type { GameRecord, MoveClass } from '../game/state';
import { winPercent } from '../engine/uci';
import { parseUci } from '../chess/rules';
import { openingFamily } from '../chess/openings';
import { phaseSeries } from './phase';
import { PHASES, type GameAnalysisX, type MoveAnalysisX, type Phase } from './types';
import { endgameVerdict } from '../chess/endgames';

/**
 * Personal weakness tracking and improvement history, derived ONLY from the
 * saved game library (full GameRecords with stored analysis) — nothing new is
 * persisted. Works with v0.2 analyses too (phases are recomputed; motif tags
 * fall back to simpler rules).
 *
 * Categories (counted on the player's own moves):
 *   tactics     missed tactics: an error where the engine's move was a forcing
 *               capture/check that wins material or mates (tags missedWin / missedMate;
 *               legacy: best move contained 'x' or '+')
 *   safety      hanging pieces / allowed mates: an error after which the opponent's best
 *               reply wins ≥ 2 pawns by static exchange or mates (tags hangs / allowsMate)
 *   opening     inaccuracies or worse in the opening phase
 *   endgame     mistakes or worse in the endgame phase, per game that reached an endgame
 *   conversion  games where the player reached ≥ 80 win% after move 5 but did not win,
 *               per game that reached such a position
 *   defence     mistakes or worse played while already worse (< 40 win%)
 * Rates are per relevant game; `severity` divides by a reference rate (what a
 * solid club player typically shows) so categories are comparable.
 */

export type WeaknessKey = 'tactics' | 'safety' | 'opening' | 'endgame' | 'conversion' | 'defence';

export const WEAKNESS_META: Record<WeaknessKey, { label: string; ref: number; unit: string; train: 'mistakes' | 'tactics' | 'endgames' | 'openings'; theme?: string }> = {
  tactics: { label: 'Missed tactics', ref: 0.6, unit: 'per game', train: 'mistakes', theme: 'tactic' },
  safety: { label: 'Hanging pieces', ref: 0.5, unit: 'per game', train: 'tactics' },
  opening: { label: 'Opening accuracy', ref: 1.0, unit: 'errors per game', train: 'openings', theme: 'opening' },
  endgame: { label: 'Endgame technique', ref: 0.6, unit: 'errors per endgame', train: 'endgames', theme: 'endgame' },
  conversion: { label: 'Converting wins', ref: 0.25, unit: 'of winning games not won', train: 'mistakes', theme: 'conversion' },
  defence: { label: 'Defence', ref: 0.6, unit: 'errors per game', train: 'mistakes', theme: 'defence' },
};

export type GameStat = {
  id: string;
  date: string;
  day: number;
  arena: number;
  opponent: string;
  color: 'w' | 'b';
  score: number; // 1 / 0.5 / 0
  accuracy: number;
  blunders: number; // blunders + missed wins
  mistakes: number;
  inaccuracies: number;
  brilliant: number;
  great: number;
  plies: number;
  opening: string | null;
  phaseAcc: Record<Phase, number | null>;
  phaseErrors: Record<Phase, number>;
  reachedEndgame: boolean;
  reachedWinning: boolean;
  cat: Record<WeaknessKey, number>;
};

const isErr = (c: MoveClass) => c === 'mistake' || c === 'blunder' || c === 'miss';

function fensOf(g: GameRecord): string[] {
  const c = new Chess(g.startFen);
  const out = [c.fen()];
  for (const u of g.moves) {
    try {
      c.move(parseUci(u));
    } catch {
      break;
    }
    out.push(c.fen());
  }
  return out;
}

export function scoreOf(g: GameRecord): number | null {
  if (!g.playerColor || g.result === '*') return null;
  if (g.result === '1/2-1/2') return 0.5;
  return (g.result === '1-0') === (g.playerColor === 'w') ? 1 : 0;
}

/** Per-game statistics for the player's side, or null if not an analysed player game. */
export function gameStat(g: GameRecord): GameStat | null {
  const a = g.analysis as GameAnalysisX | undefined;
  const color = g.playerColor;
  const score = scoreOf(g);
  if (!a || !color || score === null || a.moves.length === 0) return null;
  const firstMover = g.startFen.split(' ')[1] === 'b' ? 'b' : 'w';
  let phases: Phase[] | null = null;
  const phaseAt = (m: MoveAnalysisX, i: number): Phase => {
    if (m.phase) return m.phase;
    phases ??= phaseSeries(fensOf(g), 0);
    return phases[i] ?? 'middlegame';
  };
  const mine = a.moves
    .map((m, i) => ({ m, i, phase: phaseAt(m, i) }))
    .filter(({ i }) => ((i % 2 === 0) === (firstMover === color)));
  const cat: Record<WeaknessKey, number> = { tactics: 0, safety: 0, opening: 0, endgame: 0, conversion: 0, defence: 0 };
  const phaseAcc = {} as Record<Phase, number | null>;
  const phaseErrors = {} as Record<Phase, number>;
  for (const p of PHASES) {
    const ms = mine.filter((x) => x.phase === p);
    phaseAcc[p] = ms.length ? Math.round((ms.reduce((s, x) => s + x.m.accuracy, 0) / ms.length) * 10) / 10 : null;
    phaseErrors[p] = ms.filter((x) => isErr(x.m.cls)).length;
  }
  let reachedWinning = false;
  for (const { m, phase, i } of mine) {
    const tags = new Set(m.tags ?? []);
    const legacy = !m.tags;
    const winBefore = color === 'w' ? winPercent(m.evalBefore) : 100 - winPercent(m.evalBefore);
    if (i >= 10 && winBefore >= 80) reachedWinning = true;
    const err = isErr(m.cls);
    if (err && (tags.has('missedWin') || tags.has('missedMate') || (legacy && /[x+#]/.test(m.bestSan)))) cat.tactics++;
    if (err && (tags.has('hangs') || tags.has('allowsMate'))) cat.safety++;
    if (phase === 'opening' && (err || m.cls === 'inaccuracy')) cat.opening++;
    if (phase === 'endgame' && err) cat.endgame++;
    if (err && winBefore < 40) cat.defence++;
  }
  const reachedEndgame = mine.some((x) => x.phase === 'endgame');
  if (reachedWinning && score < 1) cat.conversion = 1;
  if (a.endgameReview && reachedEndgame) {
    const v = endgameVerdict(a.endgameReview.winAtEntry[color], score);
    if (v === 'spoiled' && a.endgameReview.winAtEntry[color] >= 70) cat.endgame++;
  }
  const cnt = a.counts[color] ?? {};
  return {
    id: g.id,
    date: g.date,
    day: g.day,
    arena: g.arena,
    opponent: color === 'w' ? g.black.name : g.white.name,
    color,
    score,
    accuracy: a.accuracy[color],
    blunders: (cnt.blunder ?? 0) + (cnt.miss ?? 0),
    mistakes: cnt.mistake ?? 0,
    inaccuracies: cnt.inaccuracy ?? 0,
    brilliant: cnt.brilliant ?? 0,
    great: cnt.great ?? 0,
    plies: g.moves.length,
    opening: g.opening?.name ?? a.opening?.name ?? null,
    phaseAcc,
    phaseErrors,
    reachedEndgame,
    reachedWinning,
    cat,
  };
}

export type Weakness = {
  key: WeaknessKey;
  label: string;
  rate: number; // per relevant game
  games: number; // relevant games
  severity: number; // rate / reference (1 = typical)
  trend: number | null; // recent rate − earlier rate (negative = improving)
  unit: string;
};

export type WeaknessReport = {
  games: number;
  weaknesses: Weakness[]; // sorted, most severe first
  avgAccuracy: number | null;
  avgBlunders: number | null;
  recommendation: string;
};

const RECENT = 5;

/** Weakness report over analysed player games (any order; sorted by date inside). */
export function weaknessReport(stats: GameStat[]): WeaknessReport {
  const st = [...stats].sort(byTime);
  const denom = (k: WeaknessKey, xs: GameStat[]) => (k === 'endgame' ? xs.filter((x) => x.reachedEndgame).length : k === 'conversion' ? xs.filter((x) => x.reachedWinning).length : xs.length);
  const rateOf = (k: WeaknessKey, xs: GameStat[]) => {
    const d = denom(k, xs);
    return d ? xs.reduce((s, x) => s + x.cat[k], 0) / d : null;
  };
  const weaknesses: Weakness[] = (Object.keys(WEAKNESS_META) as WeaknessKey[]).map((k) => {
    const rate = rateOf(k, st) ?? 0;
    let trend: number | null = null;
    if (st.length >= RECENT + 3) {
      const r = rateOf(k, st.slice(-RECENT));
      const e = rateOf(k, st.slice(0, -RECENT));
      if (r !== null && e !== null) trend = Math.round((r - e) * 100) / 100;
    }
    return { key: k, label: WEAKNESS_META[k].label, rate: Math.round(rate * 100) / 100, games: denom(k, st), severity: Math.round((rate / WEAKNESS_META[k].ref) * 100) / 100, trend, unit: WEAKNESS_META[k].unit };
  });
  weaknesses.sort((a, b) => (b.games ? b.severity : -1) - (a.games ? a.severity : -1));
  const avg = (f: (x: GameStat) => number) => (st.length ? Math.round((st.reduce((s, x) => s + f(x), 0) / st.length) * 10) / 10 : null);
  const top = weaknesses.find((w) => w.games > 0 && w.severity >= 1);
  const recommendation =
    st.length < 3
      ? 'Analyse three games to unlock your personal profile.'
      : top
        ? `Focus: ${top.label.toLowerCase()}.`
        : 'No clear weakness. Raise the stakes in the Arena.';
  return { games: st.length, weaknesses, avgAccuracy: avg((x) => x.accuracy), avgBlunders: avg((x) => x.blunders), recommendation };
}

function byTime(a: GameStat, b: GameStat) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.day - b.day;
}

/** Chronological series for the improvement charts. */
export function progressSeries(stats: GameStat[]) {
  const st = [...stats].sort(byTime);
  return {
    accuracy: st.map((x) => x.accuracy),
    rolling: rolling(st.map((x) => x.accuracy), 5),
    blunders: st.map((x) => x.blunders),
    phase: Object.fromEntries(PHASES.map((p) => [p, st.map((x) => x.phaseAcc[p])])) as Record<Phase, (number | null)[]>,
    labels: st.map((x) => x.opponent),
    dates: st.map((x) => x.date),
    ids: st.map((x) => x.id),
  };
}

export function rolling(xs: number[], w: number): number[] {
  return xs.map((_, i) => {
    const s = xs.slice(Math.max(0, i - w + 1), i + 1);
    return Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10;
  });
}

/** Repertoire results by opening family, from analysed or unanalysed player games. */
export function repertoire(games: GameRecord[]): { family: string; color: 'w' | 'b'; w: number; d: number; l: number; acc: number | null }[] {
  const map = new Map<string, { family: string; color: 'w' | 'b'; w: number; d: number; l: number; accs: number[] }>();
  for (const g of games) {
    const sc = scoreOf(g);
    const name = g.opening?.name ?? (g.analysis as GameAnalysisX | undefined)?.opening?.name;
    if (sc === null || !name || !g.playerColor) continue;
    const fam = openingFamily(name);
    const k = fam + g.playerColor;
    const e = map.get(k) ?? { family: fam, color: g.playerColor, w: 0, d: 0, l: 0, accs: [] };
    if (sc === 1) e.w++;
    else if (sc === 0) e.l++;
    else e.d++;
    const st = g.analysis ? gameStat(g) : null;
    if (st?.phaseAcc.opening != null) e.accs.push(st.phaseAcc.opening);
    map.set(k, e);
  }
  return [...map.values()]
    .map((e) => ({ family: e.family, color: e.color, w: e.w, d: e.d, l: e.l, acc: e.accs.length ? Math.round((e.accs.reduce((a, b) => a + b, 0) / e.accs.length) * 10) / 10 : null }))
    .sort((a, b) => b.w + b.d + b.l - (a.w + a.d + a.l));
}
