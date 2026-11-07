/**
 * Player chess-performance statistics, computed only from stored game records
 * (and their completed analyses). Pure: records in, numbers out. Nothing is
 * estimated here — every value carries the sample it came from.
 */
import type { GameRecord, MoveClass } from './state';

export type WDL = { w: number; d: number; l: number; games: number; score: number | null };
export type CareerStats = {
  games: number;
  overall: WDL;
  asWhite: WDL;
  asBlack: WDL;
  /** Results by opponent rating relative to yours at the time of the game. */
  vsBands: { label: string; lo: number; hi: number; wdl: WDL }[];
  length: { avgMoves: number | null; shortestWin: number | null; longestGame: number | null; decisiveShare: number | null };
  streaks: { bestWin: number; worstLoss: number; unbeaten: number; current: { kind: 'W' | 'D' | 'L' | null; n: number } };
  terminations: Record<string, number>;
  analysed: number;
  accuracy: { avg: number | null; recent: number | null; series: { id: string; day: number; acc: number }[] };
  quality: { perGame: Partial<Record<MoveClass, number>>; total: Partial<Record<MoveClass, number>>; blundersPerGame: number | null; mistakesPerGame: number | null };
  endgames: WDL;
};

const empty = (): WDL => ({ w: 0, d: 0, l: 0, games: 0, score: null });
function add(x: WDL, r: 'W' | 'D' | 'L') {
  if (r === 'W') x.w++; else if (r === 'D') x.d++; else x.l++;
  x.games++;
  x.score = (x.w + x.d / 2) / x.games;
}

export function playerResult(g: GameRecord): 'W' | 'D' | 'L' | null {
  if (!g.playerColor || g.result === '*') return null;
  if (g.result === '1/2-1/2') return 'D';
  return (g.result === '1-0') === (g.playerColor === 'w') ? 'W' : 'L';
}

const BANDS: [string, number, number][] = [['Much stronger (+200)', 200, 9999], ['Stronger (+50…200)', 50, 200], ['Even (±50)', -50, 50], ['Weaker (−50…200)', -200, -50], ['Much weaker (−200)', -9999, -200]];

export function computeCareerStats(records: GameRecord[]): CareerStats {
  const games = records.filter((g) => playerResult(g) !== null).sort((a, b) => a.day - b.day || (a.date < b.date ? -1 : 1));
  const st: CareerStats = {
    games: games.length, overall: empty(), asWhite: empty(), asBlack: empty(),
    vsBands: BANDS.map(([label, lo, hi]) => ({ label, lo, hi, wdl: empty() })),
    length: { avgMoves: null, shortestWin: null, longestGame: null, decisiveShare: null },
    streaks: { bestWin: 0, worstLoss: 0, unbeaten: 0, current: { kind: null, n: 0 } },
    terminations: {}, analysed: 0, accuracy: { avg: null, recent: null, series: [] },
    quality: { perGame: {}, total: {}, blundersPerGame: null, mistakesPerGame: null }, endgames: empty(),
  };
  let moves = 0, decisive = 0, run: 'W' | 'D' | 'L' | null = null, n = 0, unbeaten = 0;
  for (const g of games) {
    const r = playerResult(g)!;
    const me = g.playerColor!;
    add(st.overall, r);
    add(me === 'w' ? st.asWhite : st.asBlack, r);
    const mine = me === 'w' ? g.white : g.black, opp = me === 'w' ? g.black : g.white;
    const diff = (opp.rating ?? 0) - (mine.rating ?? 0);
    const band = st.vsBands.find((b) => diff >= b.lo && diff < b.hi);
    if (band) add(band.wdl, r);
    const full = Math.ceil(g.san.length / 2);
    moves += full;
    if (r !== 'D') decisive++;
    if (r === 'W' && (st.length.shortestWin === null || full < st.length.shortestWin)) st.length.shortestWin = full;
    st.length.longestGame = Math.max(st.length.longestGame ?? 0, full);
    st.terminations[g.termination] = (st.terminations[g.termination] ?? 0) + 1;
    // streaks
    if (r === run) n++; else { run = r; n = 1; }
    if (r === 'W') st.streaks.bestWin = Math.max(st.streaks.bestWin, n);
    if (r === 'L') st.streaks.worstLoss = Math.max(st.streaks.worstLoss, n);
    unbeaten = r === 'L' ? 0 : unbeaten + 1;
    st.streaks.unbeaten = Math.max(st.streaks.unbeaten, unbeaten);
    // analysis
    const a = g.analysis;
    if (a && a.moves.length > 0) {
      st.analysed++;
      st.accuracy.series.push({ id: g.id, day: g.day, acc: a.accuracy[me] });
      for (const [k, v] of Object.entries(a.counts[me] ?? {})) st.quality.total[k as MoveClass] = (st.quality.total[k as MoveClass] ?? 0) + (v ?? 0);
      if (a.endgame) add(st.endgames, r);
    }
  }
  st.streaks.current = { kind: run, n };
  if (games.length) {
    st.length.avgMoves = moves / games.length;
    st.length.decisiveShare = decisive / games.length;
  }
  const accs = st.accuracy.series.map((x) => x.acc);
  if (accs.length) {
    st.accuracy.avg = accs.reduce((a, b) => a + b, 0) / accs.length;
    const last = accs.slice(-5);
    st.accuracy.recent = last.reduce((a, b) => a + b, 0) / last.length;
    for (const [k, v] of Object.entries(st.quality.total)) st.quality.perGame[k as MoveClass] = (v ?? 0) / st.analysed;
    st.quality.blundersPerGame = (st.quality.total.blunder ?? 0) / st.analysed;
    st.quality.mistakesPerGame = (st.quality.total.mistake ?? 0) / st.analysed;
  }
  return st;
}
