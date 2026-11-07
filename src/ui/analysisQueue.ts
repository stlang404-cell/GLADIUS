import { getEngine } from '../engine/browserEngine';
import { analyseGame } from '../analysis/analyzer';
import { getGame, storeGame } from '../persist/save';
import { mutate, metaOf } from './store';
import type { GameRecord, TrainingPosition } from '../game/state';
import { Chess } from 'chess.js';
import { parseUci } from '../chess/rules';

type Listener = (id: string, done: number, total: number) => void;
const listeners = new Set<Listener>();
const queue: string[] = [];
let running: string | null = null;
export const progress = new Map<string, number>();

export function onAnalysisProgress(f: Listener) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

export function queueAnalysis(id: string, front = false) {
  if (running === id || queue.includes(id)) return;
  if (front) queue.unshift(id);
  else queue.push(id);
  void pump();
}

export function analysisDepth(): number {
  return /iPhone|iPad|Android/.test(navigator.userAgent) ? 11 : 13;
}

async function pump() {
  if (running) return;
  const id = queue.shift();
  if (!id) return;
  running = id;
  try {
    const g = await getGame(id);
    if (g && !g.analysis && g.moves.length > 0) {
      const a = await analyseGame(getEngine('analysis'), g.moves, g.startFen, {
        depth: analysisDepth(),
        onProgress: (d, t) => {
          progress.set(id, d / t);
          for (const f of listeners) f(id, d, t);
        },
      });
      if (a) {
        g.analysis = a;
        if (!g.opening && a.opening) g.opening = a.opening;
        await storeGame(g);
        mutate((s) => {
          s.libraryMeta[g.id] = metaOf(g);
          if (g.playerColor) addTrainingPositions(s.coach.positions, g);
        });
      }
    }
  } catch (e) {
    console.error('analysis failed', e);
  } finally {
    progress.delete(id);
    running = null;
    for (const f of listeners) f(id, 1, 1);
    void pump();
  }
}

/** Turn the player's real mistakes into personal training positions. */
export function addTrainingPositions(list: TrainingPosition[], g: GameRecord) {
  if (!g.analysis) return;
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
