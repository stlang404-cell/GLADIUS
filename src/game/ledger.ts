/**
 * Player ledger: authoritative counters for achievements, written as games
 * finish (finishPlayerGame) and as stored analyses arrive (onGameAnalysed).
 *
 * Eligibility (anti-farming), applied to every *skill* counter:
 *   - the game is rated and is not casual / drill / spectated / abandoned;
 *   - the opponent's rating at game start is ≥ the player's rating − 200.
 * Analysis-dependent counters (accuracy, brilliant moves, comebacks,
 * endgames) are only ever incremented from a stored GameAnalysis.
 */
import type { Save, GameRecord, PlayerLedger, PlayerState } from './state';

export const ELIGIBLE_GAP = 200;
export const LONG_GAME_PLIES = 60; // "30 moves"

export function newLedger(day: number): PlayerLedger {
  return { v: 1, since: day, c: {}, sets: {}, analysed: {}, recentIds: [], recent: [], peakEstablished: 0 };
}

export function ensureLedger(p: PlayerState, day: number): PlayerLedger {
  const L = (p.ledger ??= newLedger(day));
  L.c ??= {};
  L.sets ??= {};
  L.analysed ??= {};
  L.recentIds ??= [];
  L.recent ??= [];
  L.peakEstablished ??= 0;
  return L;
}

export function inc(L: PlayerLedger, key: string, n = 1) {
  L.c[key] = (L.c[key] ?? 0) + n;
}
export function maxTo(L: PlayerLedger, key: string, v: number) {
  if (v > (L.c[key] ?? 0)) L.c[key] = v;
}
export function addToSet(L: PlayerLedger, key: string, v: string) {
  const s = (L.sets[key] ??= []);
  if (!s.includes(v)) s.push(v);
}
export function cnt(L: PlayerLedger | undefined, key: string): number {
  return L?.c[key] ?? 0;
}
export function setSize(L: PlayerLedger | undefined, key: string): number {
  return L?.sets[key]?.length ?? 0;
}

export function playerSideOf(g: GameRecord) {
  const me = g.playerColor === 'w' ? g.white : g.black;
  const opp = g.playerColor === 'w' ? g.black : g.white;
  return { me, opp };
}

/** Player score of a finished game (1 / 0.5 / 0), null if not a player game. */
export function scoreOf(g: GameRecord): number | null {
  if (!g.playerColor || g.result === '*') return null;
  if (g.result === '1/2-1/2') return 0.5;
  return (g.result === '1-0') === (g.playerColor === 'w') ? 1 : 0;
}

/** Anti-farming eligibility for skill achievements. */
export function isEligible(g: GameRecord): boolean {
  if (!g.playerColor || !g.rated) return false;
  if (g.kind === 'casual' || g.kind === 'drill' || g.kind === 'spectated') return false;
  if (g.termination === 'abandoned') return false;
  const { me, opp } = playerSideOf(g);
  return opp.rating >= me.rating - ELIGIBLE_GAP;
}

export type GameContext = {
  score: number;
  oppId: string | null;
  /** The player's result in the previous game against this opponent, if any. */
  lastVsOpp?: 'w' | 'd' | 'l';
  /** Opponent's wins over the player before this game. */
  oppWinsBefore: number;
  playerWinsBefore: number;
  isRival: boolean;
  oppHoldsTitle: boolean;
  oppHoldsImperial: boolean;
  oppChampionships: number;
  tournamentKind?: string;
};

/** Record a finished player game (idempotent per game id). */
export function ledgerRecordGame(s: Save, g: GameRecord, x: GameContext) {
  const L = ensureLedger(s.player, s.world.day);
  if (L.recentIds.includes(g.id)) return;
  L.recentIds.push(g.id);
  if (L.recentIds.length > 50) L.recentIds.splice(0, L.recentIds.length - 50);
  inc(L, 'games');
  const { me, opp } = playerSideOf(g);
  const win = x.score === 1;
  const gap = opp.rating - me.rating;
  if (g.opening?.name) addToSet(L, 'openingsPlayed', g.opening.name);
  if (g.rated) {
    inc(L, 'rated');
    L.recent.push(x.score);
    if (L.recent.length > 10) L.recent.splice(0, L.recent.length - 10);
  }
  if (g.kind === 'tournament') {
    inc(L, 'tournamentGames');
    if (x.tournamentKind === 'championship') inc(L, 'championshipGames');
  }
  const eligible = isEligible(g);
  if (eligible) {
    if (x.score === 0) {
      L.c.eligibleStreak = 0;
      L.c.unbeaten = 0;
    } else {
      inc(L, 'unbeaten');
      maxTo(L, 'bestUnbeaten', L.c.unbeaten);
      if (win) {
        inc(L, 'eligibleStreak');
        maxTo(L, 'bestEligibleStreak', L.c.eligibleStreak);
      } else L.c.eligibleStreak = 0;
    }
  }
  if (g.rated && x.score === 0.5 && gap >= 100 && g.kind !== 'casual') inc(L, 'drawsHigher');
  if (!win || !eligible) return;
  inc(L, 'eligibleWins');
  if (g.playerColor === 'b') inc(L, 'eligibleWinsBlack');
  addToSet(L, 'poolsWon', g.pool);
  if (g.opening?.name) addToSet(L, 'openingsWon', g.opening.name);
  const plies = g.moves.length;
  if (g.termination === 'checkmate') {
    inc(L, 'mates');
    if (plies < 40) inc(L, 'quickMates');
    if (plies <= 30) inc(L, 'miniatures');
  }
  if (g.termination === 'timeout') inc(L, 'timeoutWins');
  if (plies >= 120) inc(L, 'longWins60');
  if (plies >= 160) inc(L, 'longWins80');
  const myParity = g.playerColor === 'w' ? 0 : 1;
  if (g.moves.some((m, i) => m.length === 5 && m[4] !== 'q' && i % 2 === myParity)) inc(L, 'underpromoWins');
  if (gap >= 100) inc(L, 'upset100');
  if (gap >= 200) inc(L, 'upset200');
  if (gap >= 300) inc(L, 'upset300');
  if (gap >= 400) inc(L, 'upset400');
  if (g.kind === 'tournament') inc(L, 'tournamentGameWins');
  if (x.isRival) {
    inc(L, 'rivalWins');
    if (g.kind === 'tournament') inc(L, 'rivalTournamentWins');
  }
  if (x.lastVsOpp === 'l') inc(L, 'revengeWins');
  if (x.oppWinsBefore >= 3 && x.oppWinsBefore > x.playerWinsBefore) inc(L, 'nemesisWins');
  if (x.oppHoldsTitle) inc(L, 'beatChampion');
  if (x.oppHoldsImperial) inc(L, 'beatEmperor');
  if (x.oppChampionships >= 3) inc(L, 'beatLegend');
}

/** Lichess win% model (same as engine/uci.ts), from the mover-neutral White-perspective score. */
function whiteWinPct(e: { cp?: number; mate?: number }): number {
  if (e.mate !== undefined) return e.mate > 0 ? 100 : 0;
  const cp = Math.max(-1000, Math.min(1000, e.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export type AnalysisFacts = {
  eligible: boolean;
  score: number;
  accuracy: number;
  plies: number;
  brilliant: number;
  great: number;
  errors: number; // mistakes + blunders + misses
  minWinPct: number; // player's lowest win% after ply 10
  endgame: string | null;
};

export function analysisFacts(g: GameRecord): AnalysisFacts | null {
  const a = g.analysis;
  const color = g.playerColor;
  const score = scoreOf(g);
  if (!a || !color || score === null) return null;
  const cnts = a.counts[color] ?? {};
  let minWin = 100;
  a.moves.forEach((m, i) => {
    if (i < 10) return;
    const wp = whiteWinPct(m.evalAfter);
    const mine = color === 'w' ? wp : 100 - wp;
    if (mine < minWin) minWin = mine;
  });
  return {
    eligible: isEligible(g), score, accuracy: a.accuracy[color] ?? 0, plies: g.moves.length,
    brilliant: cnts.brilliant ?? 0, great: cnts.great ?? 0,
    errors: (cnts.mistake ?? 0) + (cnts.blunder ?? 0) + (cnts.miss ?? 0),
    minWinPct: minWin, endgame: a.endgame,
  };
}

/** Apply a stored analysis to the ledger once per game. Returns false if already processed / not applicable. */
export function ledgerRecordAnalysis(s: Save, g: GameRecord): boolean {
  const f = analysisFacts(g);
  if (!f) return false;
  const L = ensureLedger(s.player, s.world.day);
  if (L.analysed[g.id]) return false;
  L.analysed[g.id] = 1;
  inc(L, 'analysed');
  if (!f.eligible) return true;
  const win = f.score === 1;
  inc(L, 'brilliant', f.brilliant);
  inc(L, 'great', f.great);
  if (f.brilliant >= 2) inc(L, 'doubleBrilliant');
  if (f.accuracy >= 85) inc(L, 'acc85Games');
  if (win) {
    if (f.brilliant > 0) inc(L, 'brilliantWins');
    if (f.accuracy >= 90) inc(L, 'acc90Wins');
    if (f.accuracy >= 92 && f.plies >= LONG_GAME_PLIES) inc(L, 'acc92Wins');
    if (f.errors === 0 && f.plies >= LONG_GAME_PLIES) inc(L, 'flawlessWins');
    if (f.minWinPct <= 25) inc(L, 'comebacks');
    if (f.endgame) {
      inc(L, 'endgameWins');
      if (f.endgame === 'Rook endgame') inc(L, 'egRook');
      else if (f.endgame === 'Queen endgame') inc(L, 'egQueen');
      else if (f.endgame === 'King and pawn endgame') inc(L, 'egPawn');
      else if (/Bishop|Knight|Minor/.test(f.endgame)) inc(L, 'egMinor');
    }
  } else if (f.score === 0.5 && f.minWinPct <= 25) inc(L, 'saves');
  return true;
}
