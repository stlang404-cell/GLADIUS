import type { Move } from 'chess.js';
import { ChessGame, START_FEN } from '../chess/rules';
import { getEngine } from '../engine/browserEngine';
import { chooseMove, type Persona } from '../engine/persona';
import { mixSeed, hashString } from '../core/rng';
import { identifyOpening } from '../chess/openings';
import { getSave, mutate, archiveGame } from './store';
import { recordEngineTournamentGame } from '../world/calendar';
import { hooksFor, opponentPersonaElo, sideFor, newGameId } from '../game/career';
import type { Competitor } from '../world/types';
import type { GameRecord } from '../game/state';
import type { Score } from '../engine/uci';

/**
 * One live broadcast at a time, independent of the UI: leaving the Spectate
 * view does not discard it — the game continues in the background (paused
 * while the player has a game of their own) and, when finished, its real
 * result is recorded into the tournament and the library.
 */
export type Feature = { id: string; label: string; white: Competitor; black: Competitor; tournamentId?: string; pairingId?: string; arena: number; weight: number };

export type BroadcastState = {
  feature: Feature;
  fen: string;
  last: Move | null;
  san: string[];
  evalScore?: Score;
  paused: boolean;
  speed: number;
  doneGameId: string | null;
  result: string | null;
};

let state: BroadcastState | null = null;
let alive = false;
const subs = new Set<() => void>();
let ver = 0;
const emit = () => {
  ver++;
  for (const f of subs) f();
};
export const broadcastStore = {
  subscribe: (cb: () => void) => (subs.add(cb), () => subs.delete(cb)),
  version: () => ver,
  get: () => state,
};

export function setPaused(p: boolean) {
  if (state) state.paused = p;
  emit();
}
export function setSpeed(x: number) {
  if (state) state.speed = x;
  emit();
}
export function stopBroadcast() {
  alive = false;
  getEngine('spectate').stop();
  state = null;
  emit();
}

export function startBroadcast(f: Feature) {
  if (state && state.feature.id === f.id) return; // resume viewing
  if (state && !state.doneGameId) stopBroadcast();
  const g = new ChessGame();
  state = { feature: f, fen: START_FEN, last: null, san: [], paused: false, speed: 1, doneGameId: null, result: null };
  alive = true;
  emit();
  const myAlive = () => alive && state?.feature.id === f.id;
  const eng = getEngine('spectate');
  const seed = hashString(f.id + getSave().world.day);
  const persona = (c: Competitor): Persona => ({ elo: opponentPersonaElo(c), style: c.style, openingStyles: c.openingStyles, seed: mixSeed(seed, c.portraitSeed) });
  const pw = persona(f.white);
  const pb = persona(f.black);
  void (async () => {
    await eng.newGame();
    while (myAlive() && !g.status().over && g.ply() < 400) {
      // Yield to the player's own game and to pauses.
      while (myAlive() && (state!.paused || getSave().active)) await new Promise((r) => setTimeout(r, 300));
      if (!myAlive()) return;
      const t0 = Date.now();
      const mv = await chooseMove(eng, g.fen(), g.uciHistory, g.turn() === 'w' ? pw : pb, { pace: 'instant', thinkMs: 800 });
      if (!myAlive()) return;
      const m = g.playUci(mv.uci);
      if (!m) break;
      state!.fen = g.fen();
      state!.last = m;
      state!.san = g.sanHistory();
      emit();
      // Live evaluation of the CURRENT position only — never future moves.
      const ev = await eng.search({ fen: g.fen(), depth: 9 });
      const sc = ev.lines[0]?.score;
      if (sc && state) state.evalScore = g.turn() === 'w' ? sc : sc.mate !== undefined ? { mate: -sc.mate } : { cp: -(sc.cp ?? 0) };
      emit();
      const wait = 1400 / (state?.speed ?? 1) - (Date.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
    if (!myAlive()) return;
    if (!g.status().over) g.agreeDraw(); // adjudicated after 200 moves
    const st = g.status();
    const sv = getSave();
    const rec: GameRecord = {
      id: newGameId(sv), kind: 'spectated', rated: !!f.tournamentId, pool: 'rapid', tc: 'rapid-10', day: sv.world.day, date: new Date().toISOString(),
      white: sideFor(f.white), black: sideFor(f.black), playerColor: null, startFen: START_FEN, moves: [...g.uciHistory], san: g.sanHistory(),
      result: st.result, termination: st.termination, arena: f.arena, tournamentId: f.tournamentId, pairingId: f.pairingId, source: 'engine',
      opening: identifyOpening(g.uciHistory),
    };
    await archiveGame(rec);
    if (f.tournamentId && f.pairingId) {
      mutate((x) => recordEngineTournamentGame(x.world, f.tournamentId!, f.pairingId!, st.result === '1-0' ? 1 : st.result === '0-1' ? 0 : 0.5, rec.id, hooksFor(x)));
    }
    if (state) {
      state.doneGameId = rec.id;
      state.result = st.result;
    }
    emit();
  })();
}
