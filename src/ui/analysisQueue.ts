import { activeEngineInfo, getEngine, recommendedAnalysisDepth } from '../engine/browserEngine';
import { analyseGame, deepenMove } from '../analysis/analyzer';
import { getGame, storeGame } from '../persist/save';
import { mutate, metaOf, pushToast } from './store';
import { onGameAnalysed } from '../game/achievements';
import type { GameRecord, TrainingPosition } from '../game/state';
import { Chess } from 'chess.js';
import { parseUci } from '../chess/rules';
import { getSave } from './store';
import { analysisComplete, analysisNeeded, deepenBlockReason } from '../analysis/integrity';
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

/** The analysis role's engine as it runs now (label + whether it is the full net), or nulls outside a browser. */
function engineMeta(): { label?: string; full?: boolean } {
  try {
    const i = activeEngineInfo('analysis');
    return { label: i.label, full: i.fullStrength };
  } catch {
    return {};
  }
}

// ------------------------------------------------------------------ deeper analysis of one move (v0.4)

export type DeepState = 'queued' | 'running' | 'done' | 'cancelled' | 'failed';
type DeepJob = { id: string; ply: number; ctl: AbortController };
type DeepListener = (id: string, ply: number, state: DeepState, info?: { record?: GameRecord; error?: string }) => void;
const deepQueue: DeepJob[] = [];
let deepRunning: DeepJob | null = null;
const deepListeners = new Set<DeepListener>();

export function onDeeperAnalysis(f: DeepListener) {
  deepListeners.add(f);
  return () => {
    deepListeners.delete(f);
  };
}
function deepEmit(id: string, ply: number, state: DeepState, info?: { record?: GameRecord; error?: string }) {
  for (const f of deepListeners) f(id, ply, state, info);
}

/**
 * Queue a deeper search of one move of a FINISHED, analysed game (position
 * before the move + the played move's line). Refused (returns the reason)
 * while any game is in progress — integrity rules, see analysis/integrity.ts.
 * The result is stored with the game and the move's class is updated with
 * its provenance. Deeper jobs run before queued full analyses.
 */
export async function requestDeeperAnalysis(id: string, ply: number): Promise<string | null> {
  if (deepStatus(id, ply)) return null;
  const g = await getGame(id);
  const why = deepenBlockReason(getSave(), g);
  if (why) return why;
  if (!g!.analysis || ply < 0 || ply >= g!.analysis.moves.length) return 'Nothing to analyse.';
  deepQueue.push({ id, ply, ctl: new AbortController() });
  deepEmit(id, ply, 'queued');
  void pump();
  return null;
}

/** Cancel a queued or running deeper search (the running search is stopped at once; nothing is stored). */
export function cancelDeeperAnalysis(id: string, ply: number) {
  const k = deepQueue.findIndex((j) => j.id === id && j.ply === ply);
  if (k >= 0) {
    deepQueue.splice(k, 1);
    deepEmit(id, ply, 'cancelled');
  }
  if (deepRunning && deepRunning.id === id && deepRunning.ply === ply) deepRunning.ctl.abort();
}

export function deepStatus(id: string, ply: number): 'queued' | 'running' | null {
  if (deepRunning && deepRunning.id === id && deepRunning.ply === ply) return 'running';
  return deepQueue.some((j) => j.id === id && j.ply === ply) ? 'queued' : null;
}

async function runDeep(job: DeepJob) {
  deepRunning = job;
  deepEmit(job.id, job.ply, 'running');
  try {
    const g = await getGame(job.id);
    const why = deepenBlockReason(getSave(), g); // re-checked at run time
    if (why || !g) {
      deepEmit(job.id, job.ply, 'failed', { error: why ?? 'Game not found.' });
      return;
    }
    const meta = engineMeta();
    const a = await deepenMove(getEngine('analysis'), { startFen: g.startFen, moves: g.moves, analysis: g.analysis as GameAnalysisX }, job.ply, {
      signal: job.ctl.signal,
      engineLabel: meta.label,
      trainSide: g.playerColor,
    });
    if (job.ctl.signal.aborted) {
      deepEmit(job.id, job.ply, 'cancelled');
      return;
    }
    // A game may have started while searching: store nothing then.
    if (deepenBlockReason(getSave(), g)) {
      deepEmit(job.id, job.ply, 'failed', { error: 'A game started; nothing was stored.' });
      return;
    }
    g.analysis = a;
    await storeGame(g);
    mutate((s) => {
      s.libraryMeta[g.id] = metaOf(g);
      if (g.playerColor) syncTrainingPositions(s.coach.positions, g);
    });
    deepEmit(job.id, job.ply, 'done', { record: g });
  } catch (e) {
    if (job.ctl.signal.aborted) deepEmit(job.id, job.ply, 'cancelled');
    else {
      console.error('deeper analysis failed', e);
      deepEmit(job.id, job.ply, 'failed', { error: 'The engine could not finish.' });
    }
  } finally {
    deepRunning = null;
  }
}

/**
 * Keep the player's training positions in line with the game's puzzles after
 * a deeper search: unsolved, never-attempted positions from this game whose
 * puzzle is gone (the mistake was not confirmed) are removed; new ones added.
 */
export function syncTrainingPositions(list: TrainingPosition[], g: GameRecord) {
  const ax = g.analysis as GameAnalysisX | undefined;
  if (!ax?.puzzles) return;
  const keep = new Set(ax.puzzles.map((p) => p.ply));
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (p.fromGame === g.id && !keep.has(p.ply) && p.solved === 0 && p.failed === 0) list.splice(i, 1);
  }
  addTrainingPositions(list, g);
}

async function pump() {
  if (running || deepRunning) return;
  const dj = deepQueue.shift();
  if (dj) {
    try {
      await runDeep(dj);
    } finally {
      void pump();
    }
    return;
  }
  const id = queue.shift();
  if (!id) return;
  running = id;
  try {
    const g = await getGame(id);
    // Cache + integrity: reuse stored analyses; never analyse the active game or an unfinished record (re-checked at run time).
    if (g && analysisNeeded(getSave(), g, ANALYSIS_VERSION, force.has(id))) {
      runningSignal = { cancelled: false };
      const meta = engineMeta();
      const depth = analysisDepth();
      const a = await analyseGame(getEngine('analysis'), g.moves, g.startFen, {
        signal: runningSignal,
        depth,
        // Phones / low-memory devices (depth 11) verify fewer moves; see analysis/confidence.ts.
        maxVerify: depth <= 11 ? 8 : 12,
        trainSide: g.playerColor,
        engineLabel: meta.label,
        fullNet: meta.full,
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
