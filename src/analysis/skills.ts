import type { GameRecord, Save } from '../game/state';
import { winPercent } from '../engine/uci';
import { asX, type MoveAnalysisX } from './types';
import { gameStat, scoreOf, type GameStat } from './weakness';
import { sideOf } from './report';

/**
 * Personal skill profile from REAL analysed games only (pure; no engine).
 *
 *   computeSkillProfile(games, opts?) → SkillProfile
 *   computeSkillProfileFromSave(save, records) → same, using save.player for the rating
 *
 * `games` are full GameRecords (load them with persist/save getGame); only
 * finished player games with a stored analysis are used.
 *
 * Every dimension reports BOTH:
 *   measured  — the raw statistic with its unit and sample size (what happened);
 *   estimate  — a 0..100 skill estimate derived from it by a fixed, documented
 *               mapping, shrunk toward 50 when the sample is small:
 *                 estimate = 50 + (raw − 50) · n / (n + K)        (K = shrinkage sample)
 *               so three games cannot produce an extreme rating;
 *   confidence — 'low' (< 5 relevant games or < K/2 samples), 'medium', 'high' (≥ 15 games
 *               and ≥ 2K samples);
 *   trend     — last 5 games' raw value minus the earlier games' (null if < 8 games).
 *
 * Dimensions (all from the player's own moves):
 *   opening      mean move accuracy in the opening phase                         (K = 60 moves)
 *   tactics      % of tactical chances taken: positions where only one move kept the
 *                advantage (gap ≥ 15 win%) or a forcing win/mate existed; found = the
 *                engine move was played                                          (K = 12 chances)
 *   positional   mean accuracy on quiet middlegame moves (no capture/check, no tactic)  (K = 80)
 *   endgame      mean move accuracy in the endgame phase                         (K = 40 moves)
 *   defence      mean accuracy while worse (< 40 win% before the move)           (K = 40 moves)
 *   conversion   % of games won after reaching ≥ 80 win% (after move 5)          (K = 4 games)
 *   recovery     % of games not lost after dropping to ≤ 30 win% (after move 5)  (K = 4 games)
 *   blunders     raw = 100 · e^(−blunders per 40 moves / 0.9)                    (K = 120 moves)
 *   consistency  raw = 100 − 2.5 · stdev(move accuracy), non-book moves          (K = 80 moves)
 * Accuracy is also broken down by opponent Elo band (200-point bands).
 */

export type SkillKey = 'opening' | 'tactics' | 'positional' | 'endgame' | 'defence' | 'conversion' | 'recovery' | 'blunders' | 'consistency';

export type SkillDim = {
  key: SkillKey;
  label: string;
  measured: { value: number | null; unit: string; sample: number; sampleUnit: string; games: number };
  estimate: number | null; // 0..100, shrunk toward 50 for small samples
  confidence: 'none' | 'low' | 'medium' | 'high';
  trend: number | null; // change in measured value, recent vs earlier (positive = better)
  evidence: string; // one line, e.g. "12 of 19 chances found in 14 games"
};

export type EloBand = { band: string; lo: number; games: number; accuracy: number; score: number };

export type SkillProfile = {
  games: number;
  moves: number;
  dims: SkillDim[];
  strongest: SkillKey | null;
  weakest: SkillKey | null;
  eloBands: EloBand[];
  /** Personalised next steps (≤ 3), each pointing at a training area. */
  recommendations: { text: string; train: 'mistakes' | 'tactics' | 'endgames' | 'openings'; theme?: string }[];
};

const META: Record<SkillKey, { label: string; K: number; unit: string; sampleUnit: string }> = {
  opening: { label: 'Opening knowledge', K: 60, unit: '% accuracy', sampleUnit: 'moves' },
  tactics: { label: 'Tactical calculation', K: 12, unit: '% found', sampleUnit: 'chances' },
  positional: { label: 'Positional play', K: 80, unit: '% accuracy', sampleUnit: 'quiet moves' },
  endgame: { label: 'Endgame technique', K: 40, unit: '% accuracy', sampleUnit: 'moves' },
  defence: { label: 'Defensive resilience', K: 40, unit: '% accuracy', sampleUnit: 'moves' },
  conversion: { label: 'Converting advantages', K: 4, unit: '% won', sampleUnit: 'winning games' },
  recovery: { label: 'Recovery from worse', K: 4, unit: '% saved', sampleUnit: 'bad positions' },
  blunders: { label: 'Blunder avoidance', K: 120, unit: 'per 40 moves', sampleUnit: 'moves' },
  consistency: { label: 'Move consistency', K: 80, unit: 'σ accuracy', sampleUnit: 'moves' },
};

const TRAIN: Record<SkillKey, SkillProfile['recommendations'][number]> = {
  opening: { text: 'Review your main openings in the explorer.', train: 'openings' },
  tactics: { text: 'Solve the positions where you missed a tactic.', train: 'mistakes', theme: 'tactic' },
  positional: { text: 'Replay your games and compare quiet moves with the engine’s.', train: 'mistakes' },
  endgame: { text: 'Drill the endgames you reach most often.', train: 'endgames' },
  defence: { text: 'Practise defensive positions from your games.', train: 'mistakes', theme: 'defence' },
  conversion: { text: 'Train converting won positions: simplify, then push.', train: 'mistakes', theme: 'conversion' },
  recovery: { text: 'When worse, set problems: keep pieces and create threats.', train: 'mistakes', theme: 'defence' },
  blunders: { text: 'Before each move, check every capture and check for your opponent.', train: 'tactics' },
  consistency: { text: 'Slow down on routine moves; most points are lost there.', train: 'mistakes' },
};

type Acc = { sum: number; n: number; xs: number[] };
const acc0 = (): Acc => ({ sum: 0, n: 0, xs: [] });
const push = (a: Acc, v: number) => {
  a.sum += v;
  a.n++;
  a.xs.push(v);
};
const mean = (a: Acc) => (a.n ? a.sum / a.n : null);

type PerGame = {
  stat: GameStat;
  opening: Acc; positional: Acc; endgame: Acc; defence: Acc; all: Acc;
  tacticChances: number; tacticFound: number;
  winning: boolean; won: boolean; worse: boolean; notLost: boolean;
  blunders: number; moves: number;
};

function perGame(g: GameRecord): PerGame | null {
  const stat = gameStat(g);
  const a = asX(g.analysis);
  if (!stat || !a || !g.playerColor) return null;
  const me = g.playerColor;
  const score = scoreOf(g) ?? 0;
  const r: PerGame = {
    stat, opening: acc0(), positional: acc0(), endgame: acc0(), defence: acc0(), all: acc0(),
    tacticChances: 0, tacticFound: 0, winning: false, won: score === 1, worse: false, notLost: score >= 0.5, blunders: 0, moves: 0,
  };
  const phaseOf = (m: MoveAnalysisX, i: number) => m.phase ?? (i < 20 ? 'opening' : 'middlegame');
  a.moves.forEach((m, i) => {
    if (sideOf(g, i) !== me) return;
    r.moves++;
    const wb = me === 'w' ? winPercent(m.evalBefore) : 100 - winPercent(m.evalBefore);
    const ph = phaseOf(m, i);
    if (i >= 10 && wb >= 80) r.winning = true;
    if (i >= 10 && wb <= 30) r.worse = true;
    if (m.cls === 'blunder' || m.cls === 'miss') r.blunders++;
    if (m.cls !== 'book' && m.cls !== 'forced') push(r.all, m.accuracy);
    if (ph === 'opening') push(r.opening, m.accuracy);
    if (ph === 'endgame') push(r.endgame, m.accuracy);
    if (wb < 40 && m.cls !== 'forced') push(r.defence, m.accuracy);
    const tags = new Set(m.tags ?? []);
    const tactical = tags.has('onlyMove') || tags.has('missedWin') || tags.has('missedMate') || m.cls === 'brilliant' || m.cls === 'great';
    if (tactical && m.cls !== 'forced' && !tags.has('recapture')) {
      r.tacticChances++;
      if (m.cls === 'brilliant' || m.cls === 'great' || m.cls === 'best') r.tacticFound++;
    }
    if (ph === 'middlegame' && !tactical && !/[x+#]/.test(m.san) && m.cls !== 'forced') push(r.positional, m.accuracy);
  });
  return r;
}

function shrink(raw: number, n: number, K: number) {
  return Math.round((50 + (raw - 50) * (n / (n + K))) * 10) / 10;
}

function confidence(games: number, n: number, K: number): SkillDim['confidence'] {
  if (n === 0) return 'none';
  if (games < 5 || n < K / 2) return 'low';
  if (games >= 15 && n >= 2 * K) return 'high';
  return 'medium';
}

function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

type Measure = { value: number | null; raw: number | null; n: number; games: number; evidence: string };

function measure(key: SkillKey, ps: PerGame[]): Measure {
  const merged = (f: (p: PerGame) => Acc) => {
    const a = acc0();
    for (const p of ps) for (const x of f(p).xs) push(a, x);
    return a;
  };
  const games = (f: (p: PerGame) => boolean) => ps.filter(f).length;
  switch (key) {
    case 'opening':
    case 'positional':
    case 'endgame':
    case 'defence': {
      const a = merged((p) => p[key]);
      const v = mean(a);
      const gs = games((p) => p[key].n > 0);
      return { value: v === null ? null : Math.round(v * 10) / 10, raw: v, n: a.n, games: gs, evidence: `${a.n} ${META[key].sampleUnit} in ${gs} games` };
    }
    case 'tactics': {
      const ch = ps.reduce((s, p) => s + p.tacticChances, 0);
      const f = ps.reduce((s, p) => s + p.tacticFound, 0);
      const v = ch ? (f / ch) * 100 : null;
      return { value: v === null ? null : Math.round(v), raw: v, n: ch, games: games((p) => p.tacticChances > 0), evidence: `${f} of ${ch} chances found` };
    }
    case 'conversion': {
      const w = ps.filter((p) => p.winning);
      const v = w.length ? (w.filter((p) => p.won).length / w.length) * 100 : null;
      return { value: v === null ? null : Math.round(v), raw: v, n: w.length, games: w.length, evidence: `${w.filter((p) => p.won).length} of ${w.length} winning games won` };
    }
    case 'recovery': {
      const w = ps.filter((p) => p.worse);
      const v = w.length ? (w.filter((p) => p.notLost).length / w.length) * 100 : null;
      return { value: v === null ? null : Math.round(v), raw: v, n: w.length, games: w.length, evidence: `${w.filter((p) => p.notLost).length} of ${w.length} bad positions saved` };
    }
    case 'blunders': {
      const mv = ps.reduce((s, p) => s + p.moves, 0);
      const b = ps.reduce((s, p) => s + p.blunders, 0);
      const per40 = mv ? (b / mv) * 40 : null;
      return { value: per40 === null ? null : Math.round(per40 * 100) / 100, raw: per40 === null ? null : 100 * Math.exp(-per40 / 0.9), n: mv, games: ps.length, evidence: `${b} blunders in ${mv} moves` };
    }
    case 'consistency': {
      const a = merged((p) => p.all);
      const sd = a.n >= 2 ? stdev(a.xs) : null;
      return { value: sd === null ? null : Math.round(sd * 10) / 10, raw: sd === null ? null : Math.max(0, Math.min(100, 100 - 2.5 * sd)), n: a.n, games: ps.length, evidence: `σ of ${a.n} move accuracies` };
    }
  }
}

const RECENT = 5;

export function computeSkillProfile(games: GameRecord[], opts: { rating?: number } = {}): SkillProfile {
  const ps = games
    .map(perGame)
    .filter((p): p is PerGame => !!p)
    .sort((a, b) => (a.stat.date < b.stat.date ? -1 : a.stat.date > b.stat.date ? 1 : a.stat.day - b.stat.day));
  const keys = Object.keys(META) as SkillKey[];
  const dims: SkillDim[] = keys.map((k) => {
    const m = measure(k, ps);
    let trend: number | null = null;
    if (ps.length >= RECENT + 3) {
      const r = measure(k, ps.slice(-RECENT)).raw;
      const e = measure(k, ps.slice(0, -RECENT)).raw;
      if (r !== null && e !== null) trend = Math.round((r - e) * 10) / 10; // on the raw (higher = better) scale
    }
    const est = m.raw === null ? null : shrink(Math.max(0, Math.min(100, m.raw)), m.n, META[k].K);
    return {
      key: k,
      label: META[k].label,
      measured: { value: m.value, unit: META[k].unit, sample: m.n, sampleUnit: META[k].sampleUnit, games: m.games },
      estimate: est,
      confidence: confidence(m.games, m.n, META[k].K),
      trend,
      evidence: m.evidence,
    };
  });
  const rated = dims.filter((d) => d.estimate !== null && d.confidence !== 'none' && d.confidence !== 'low');
  const sorted = [...rated].sort((a, b) => a.estimate! - b.estimate!);
  const bands = new Map<number, { g: number; acc: number; sc: number }>();
  for (const p of ps) {
    const g = games.find((x) => x.id === p.stat.id)!;
    const opp = g.playerColor === 'w' ? g.black.rating : g.white.rating;
    if (!opp) continue;
    const lo = Math.floor(opp / 200) * 200;
    const b = bands.get(lo) ?? { g: 0, acc: 0, sc: 0 };
    b.g++;
    b.acc += p.stat.accuracy;
    b.sc += p.stat.score;
    bands.set(lo, b);
  }
  const eloBands = [...bands.entries()].sort((a, b) => a[0] - b[0]).map(([lo, b]) => ({ band: `${lo}–${lo + 199}`, lo, games: b.g, accuracy: Math.round((b.acc / b.g) * 10) / 10, score: Math.round((b.sc / b.g) * 100) }));
  void opts;
  const recommendations = sorted.slice(0, 3).filter((d) => d.estimate! < 60).map((d) => TRAIN[d.key]);
  if (recommendations.length === 0 && ps.length >= 3) recommendations.push({ text: 'No clear weakness yet. Keep analysing games to sharpen the picture.', train: 'mistakes' });
  return {
    games: ps.length,
    moves: ps.reduce((s, p) => s + p.moves, 0),
    dims,
    strongest: sorted.length ? sorted[sorted.length - 1].key : null,
    weakest: sorted.length ? sorted[0].key : null,
    eloBands,
    recommendations,
  };
}

/** Convenience for callers holding the save and the loaded records. */
export function computeSkillProfileFromSave(s: Pick<Save, 'player'>, records: GameRecord[]): SkillProfile {
  return computeSkillProfile(records, { rating: (s.player as unknown as { rating?: number }).rating });
}
