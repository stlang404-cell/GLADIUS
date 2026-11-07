import { getEngine, recommendedAnalysisDepth } from '../engine/browserEngine';
import { analyseGame } from '../analysis/analyzer';
import { getGame, storeGame } from '../persist/save';
import { mutate, metaOf, pushToast } from './store';
import { onGameAnalysed } from '../game/achievements';
import type { GameRecord, TrainingPosition } from '../game/state';
import { Chess } from 'chess.js';
import { parseUci } from '../chess/rules';
import { getSave } from './store';
import { analysisComplete, analysisNeeded } from '../analysis/integrity';
import type { AnalysisStatus } from '../analysis/report';
import { ANALYSIS_VERSION, type GameAnalysisX, type TrainingPositionX } from '../analysis/types';
import { puzzlesFromGame } from '../chess/puzzles';

type Listener = (id: string, done: number, total: number) => void;
const listeners = new Set<Listener>();
const queue: string[] = [];
const force = new Set<string>();
let running: string | null = null;
let runningSignal: { cancelled: boolean } | null = null;
export const progress = new Map<string, number>();

export function onAnalysisProgress(f: Listener) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

/**
 * Queue a FINISHED game for engine analysis. Games in progress are refused
 * (competitive integrity, see analysis/integrity.ts); `reanalyse` upgrades an
 * analysis made by an older analyser version.
 */
export function queueAnalysis(id: string, front = false, reanalyse = false) {
  if (running === id || queue.includes(id)) return;
  const act = getSave().active;
  if (act && act.record.id === id) return;
  if (reanalyse) force.add(id);
  if (front) queue.unshift(id);
  else queue.push(id);
  void pump();
}

/** Cancel a queued or running analysis (the running one stops before its next position; nothing is stored). */
export function cancelAnalysis(id: string) {
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
  if (running === id && runningSignal) runningSignal.cancelled = true;
  progress.delete(id);
  for (const f of listeners) f(id, 0, 1);
}

/** Queue status of a game (for the post-game screen and the library). */
export function analysisStatus(id: string): AnalysisStatus {
  const s = getSave();
  if (s.active?.record.id === id) return 'locked';
  if (running === id) return 'running';
  if (queue.includes(id)) return 'queued';
  const m = s.libraryMeta[id];
  return m?.analysed ? 'done' : 'none';
}

/**
 * After a reload the in-memory queue is empty: an interrupted analysis is
 * simply restarted from scratch (partial results are never stored). Queues the
 * player's most recent finished, unanalysed games.
 */
export function resumePendingAnalysis(max = 3) {
  const s = getSave();
  const ids = [...s.library].reverse().filter((id) => s.libraryMeta[id]?.playerColor && !s.libraryMeta[id].analysed && s.libraryMeta[id].result !== '*').slice(0, max);
  for (const id of ids.reverse()) queueAnalysis(id);
}

export function analysisDepth(): number {
  return recommendedAnalysisDepth();
}

async function pump() {
  if (running) return;
  const id = queue.shift();
  if (!id) return;
  running = id;
  try {
    const g = await getGame(id);
    // Cache + integrity: reuse stored analyses; never analyse the active game or an unfinished record (re-checked at run time).
    if (g && analysisNeeded(getSave(), g, ANALYSIS_VERSION, force.has(id))) {
      runningSignal = { cancelled: false };
      const a = await analyseGame(getEngine('analysis'), g.moves, g.startFen, {
        signal: runningSignal,
        depth: analysisDepth(),
        trainSide: g.playerColor,
        onProgress: (d, t) => {
          progress.set(id, d / t);
          for (const f of listeners) f(id, d, t);
        },
      });
      if (a) {
        g.analysis = a;
        if (!g.opening && a.opening) g.opening = a.opening;
        await storeGame(g);
        let unlocked: string[] = [];
        mutate((s) => {
          s.libraryMeta[g.id] = metaOf(g);
          if (g.playerColor) {
            addTrainingPositions(s.coach.positions, g);
            // Analysis-gated achievements unlock only here, from a complete analysis of a finished game.
            if (analysisComplete(g)) unlocked = onGameAnalysed(s, g);
          }
        });
        for (const a of unlocked) pushToast(a, 'achievement');
      }
    }
  } catch (e) {
    console.error('analysis failed', e);
  } finally {
    progress.delete(id);
    force.delete(id);
    running = null;
    runningSignal = null;
    for (const f of listeners) f(id, 1, 1);
    void pump();
  }
}

/** Turn the player's real mistakes into personal training positions. */
export function addTrainingPositions(list: TrainingPosition[], g: GameRecord) {
  if (!g.analysis) return;
  const ax = g.analysis as GameAnalysisX;
  if (ax.puzzles) {
    // v3: verified puzzles (unique solution, engine line). Replace older unsolved entries from this game.
    for (let i = list.length - 1; i >= 0; i--) if (list[i].fromGame === g.id && !(list[i] as TrainingPositionX).v && list[i].solved === 0) list.splice(i, 1);
    for (const p of puzzlesFromGame(g.id, ax.puzzles)) if (!list.some((q) => q.fen === p.fen)) list.push(p as TrainingPositionX);
    if (list.length > 300) list.splice(0, list.length - 300);
    return;
  }
  const c = new Chess(g.startFen);
  const mine = g.playerColor;
  g.analysis.moves.forEach((m, i) => {
    const fen = c.fen();
    const moverIsMe = (fen.split(' ')[1] as 'w' | 'b') === mine;
    if (moverIsMe && (m.cls === 'blunder' || m.cls === 'mistake' || m.cls === 'miss') && m.bestUci !== m.uci) {
      const theme: TrainingPosition['theme'] =
        m.evalBefore.mate !== undefined ? 'mate' : m.cls === 'miss' ? 'conversion' : i < 20 ? 'opening' : countPieces(fen) <= 8 ? 'endgame' : 'tactic';
      if (!list.some((p) => p.fen === fen)) list.push({ id: `${g.id}-${i}`, fen, bestUci: m.bestUci, playedUci: m.uci, theme, fromGame: g.id, ply: i, solved: 0, failed: 0 });
    }
    try {
      c.move(parseUci(m.uci));
    } catch {
      /* ignore */
    }
  });
  if (list.length > 300) list.splice(0, list.length - 300);
}

function countPieces(fen: string) {
  return fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
}
