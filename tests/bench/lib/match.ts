import { Chess } from 'chess.js';
import type { Score } from '../../../src/engine/uci';
import { chooseMove, humanDelay, type Persona, type ClockInfo, type ChooseOptions } from '../../../src/engine/persona';
import { createRng, mixSeed } from '../../../src/core/rng';
import { START_FEN } from '../../../src/chess/rules';
import { nodeEngine, findBuild, processTransport, processRssMB } from '../../helpers/nodeEngine';
import { UciEngine } from '../../../src/engine/uci';
import type { BuildId } from '../../../src/engine/builds';
import { matchStats, type Wdl } from './stats';

/**
 * Engine-vs-engine / persona-vs-persona match runner for the strength bench.
 *
 * Adjudication (documented in docs/ENGINE.md):
 *   - win:  both engines agree |eval| ≥ 700 cp for the same side over 6 consecutive plies
 *           (persona agents report their own engine score);
 *   - draw: after ply 80, |eval| ≤ 10 cp for 12 consecutive plies; or ply 300;
 *   - rules: mate, stalemate, insufficient material, threefold (chess.js), 50-move.
 */
export type MoveOut = { uci: string; score?: Score; delayMs?: number };
export type Agent = {
  name: string;
  newGame(): Promise<void>;
  move(fen: string, history: string[], clock?: ClockInfo, startFen?: string): Promise<MoveOut>;
  close(): void;
  /** Search statistics (engine agents): per-move depth, nodes, time; engine id; peak RSS. */
  stats?: AgentStats;
};
export type AgentStats = { engine: string; moves: number; depthSum: number; nodesSum: number; msSum: number; peakRssMB: number };
export type AgentFactory = () => Agent;

export type EngineAgentCfg = { build: BuildId; movetime?: number; nodes?: number; depth?: number; hash?: number; threads?: number; process?: boolean };

export function engineAgent(name: string, cfg: EngineAgentCfg): AgentFactory {
  return () => {
    let pid: number | undefined;
    const e = cfg.process
      ? new UciEngine(() => {
          const t = processTransport(findBuild(cfg.build)!);
          pid = t.pid;
          return t;
        }, { initOptions: { Hash: cfg.hash ?? 16, Threads: cfg.threads ?? 1 } })
      : nodeEngine(cfg.build, { initOptions: { Hash: cfg.hash ?? 16, Threads: cfg.threads ?? 1 } });
    const stats: AgentStats = { engine: '', moves: 0, depthSum: 0, nodesSum: 0, msSum: 0, peakRssMB: -1 };
    return {
      name,
      stats,
      newGame: () => e.newGame(),
      async move(_fen, history, _clock, startFen) {
        const t0 = performance.now();
        const r = await e.search({ fen: startFen ?? START_FEN, moves: history, movetime: cfg.movetime, nodes: cfg.nodes, depth: cfg.depth });
        stats.msSum += performance.now() - t0;
        stats.moves++;
        stats.depthSum += r.lines[0]?.depth ?? 0;
        stats.nodesSum += r.lines[0]?.nodes ?? 0;
        stats.engine = e.name;
        if (stats.moves % 20 === 1) stats.peakRssMB = Math.max(stats.peakRssMB, processRssMB(pid));
        return { uci: r.bestmove!, score: r.lines[0]?.score };
      },
      close: () => e.terminate(),
    };
  };
}

export type PersonaAgentCfg = { persona: Persona; build?: BuildId; hash?: number; threads?: number; opts?: ChooseOptions; process?: boolean };

export function personaAgent(name: string, cfg: PersonaAgentCfg): AgentFactory {
  return () => {
    const e: UciEngine = nodeEngine(cfg.build ?? 'lite-single', { process: cfg.process, initOptions: { Hash: cfg.hash ?? 16, Threads: cfg.threads ?? 1 } });
    let game = 0;
    return {
      name,
      newGame: async () => {
        game++;
        await e.newGame();
      },
      async move(fen, history, clock, startFen) {
        const persona = { ...cfg.persona, seed: mixSeed(cfg.persona.seed, game) };
        const mv = await chooseMove(e, fen, history, persona, { ...cfg.opts, pace: 'natural', clock, startFen });
        const delay = clock ? humanDelay(persona.elo, history.length, createRng(mixSeed(persona.seed, history.length)), 'natural', clock) : 0;
        return { uci: mv.uci, score: mv.score, delayMs: Math.max(0, delay - mv.thinkMs) };
      },
      close: () => e.terminate(),
    };
  };
}

export type GameResult = { result: '1-0' | '0-1' | '1/2-1/2'; reason: string; plies: number; moves: string[]; flagged?: 'w' | 'b'; minClockMs?: { w: number; b: number } };

export type GameOpts = { maxPlies?: number; adjudicate?: boolean; clock?: { baseMs: number; incMs: number }; startFen?: string };

function toWhite(s: Score | undefined, whiteToMove: boolean): number | null {
  if (!s) return null;
  const cp = s.mate !== undefined ? (s.mate > 0 ? 10000 : -10000) : (s.cp ?? 0);
  return whiteToMove ? cp : -cp;
}

export async function playGame(white: Agent, black: Agent, opening: string[], o: GameOpts = {}): Promise<GameResult> {
  const c = new Chess(o.startFen);
  const moves: string[] = [];
  for (const san of opening) {
    const m = c.move(san);
    moves.push(m.from + m.to + (m.promotion ?? ''));
  }
  await white.newGame();
  await black.newGame();
  const maxPlies = o.maxPlies ?? 300;
  const evals: number[] = [];
  const clock = o.clock ? { w: o.clock.baseMs, b: o.clock.baseMs } : null;
  const minClock = clock ? { ...clock } : undefined;
  while (!c.isGameOver() && moves.length < maxPlies) {
    const side = c.turn();
    const agent = side === 'w' ? white : black;
    const t0 = Date.now();
    const ci: ClockInfo | undefined = clock ? { myMs: clock[side], oppMs: clock[side === 'w' ? 'b' : 'w'], incMs: o.clock!.incMs, moveNumber: Math.floor(moves.length / 2) + 1 } : undefined;
    const out = await agent.move(c.fen(), [...moves], ci, o.startFen);
    if (clock) {
      const used = Date.now() - t0 + (out.delayMs ?? 0);
      clock[side] -= used;
      minClock![side] = Math.min(minClock![side], clock[side]);
      if (clock[side] <= 0) {
        return { result: side === 'w' ? '0-1' : '1-0', reason: 'time', plies: moves.length, moves, flagged: side, minClockMs: minClock };
      }
      clock[side] += o.clock!.incMs;
    }
    let m;
    try {
      m = c.move({ from: out.uci.slice(0, 2), to: out.uci.slice(2, 4), promotion: out.uci[4] });
    } catch {
      return { result: side === 'w' ? '0-1' : '1-0', reason: `illegal move ${out.uci} by ${agent.name}`, plies: moves.length, moves };
    }
    moves.push(m.from + m.to + (m.promotion ?? ''));
    if (o.adjudicate !== false) {
      const e = toWhite(out.score, side === 'w');
      evals.push(e ?? NaN);
      const last = evals.slice(-6);
      if (last.length === 6 && last.every((x) => x >= 700)) return { result: '1-0', reason: 'adjudicated', plies: moves.length, moves, minClockMs: minClock };
      if (last.length === 6 && last.every((x) => x <= -700)) return { result: '0-1', reason: 'adjudicated', plies: moves.length, moves, minClockMs: minClock };
      const lastD = evals.slice(-12);
      if (moves.length >= 80 && lastD.length === 12 && lastD.every((x) => Math.abs(x) <= 10)) return { result: '1/2-1/2', reason: 'adjudicated draw', plies: moves.length, moves, minClockMs: minClock };
    }
  }
  let result: GameResult['result'] = '1/2-1/2';
  let reason = 'max plies';
  if (c.isCheckmate()) {
    result = c.turn() === 'w' ? '0-1' : '1-0';
    reason = 'mate';
  } else if (c.isGameOver()) reason = c.isStalemate() ? 'stalemate' : c.isThreefoldRepetition() ? 'repetition' : c.isInsufficientMaterial() ? 'material' : '50-move';
  return { result, reason, plies: moves.length, moves, minClockMs: minClock };
}

export type MatchReport = Wdl & {
  a: string;
  b: string;
  games: { opening: string; aWhite: boolean; result: string; reason: string; plies: number }[];
  wallMs: number;
  stats: ReturnType<typeof matchStats>;
  /** Aggregated search statistics per agent name (engine agents only). */
  search?: Record<string, { engine: string; moves: number; avgDepth: number; knps: number; avgMoveMs: number; peakRssMB: number }>;
};

/**
 * Play each opening twice (colours reversed) between A and B, `concurrency`
 * games at a time (each concurrent slot has its own pair of engines).
 * W/D/L are from A's point of view.
 */
export async function runMatch(
  A: AgentFactory,
  B: AgentFactory,
  openings: { name: string; san: string }[],
  o: GameOpts & { concurrency?: number; rounds?: number; onGame?: (r: MatchReport) => void } = {},
): Promise<MatchReport> {
  const jobs: { opening: { name: string; san: string }; aWhite: boolean }[] = [];
  for (let r = 0; r < (o.rounds ?? 1); r++) for (const op of openings) jobs.push({ opening: op, aWhite: true }, { opening: op, aWhite: false });
  const rep: MatchReport = { a: '', b: '', w: 0, d: 0, l: 0, games: [], wallMs: 0, stats: matchStats({ w: 0, d: 0, l: 0 }) };
  const t0 = Date.now();
  let next = 0;
  const worker = async () => {
    const a = A();
    const b = B();
    rep.a = a.name;
    rep.b = b.name;
    try {
      while (next < jobs.length) {
        const j = jobs[next++];
        const g = await playGame(j.aWhite ? a : b, j.aWhite ? b : a, j.opening.san.split(' '), o);
        const aScore = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === j.aWhite ? 1 : 0;
        if (aScore === 1) rep.w++;
        else if (aScore === 0) rep.l++;
        else rep.d++;
        rep.games.push({ opening: j.opening.name, aWhite: j.aWhite, result: g.result, reason: g.reason, plies: g.plies });
        rep.stats = matchStats(rep);
        o.onGame?.(rep);
      }
    } finally {
      for (const ag of [a, b]) {
        const st = ag.stats;
        if (!st) continue;
        const acc = (agg[ag.name] ??= { engine: st.engine, moves: 0, depthSum: 0, nodesSum: 0, msSum: 0, peakRssMB: -1 });
        acc.moves += st.moves;
        acc.depthSum += st.depthSum;
        acc.nodesSum += st.nodesSum;
        acc.msSum += st.msSum;
        acc.peakRssMB = Math.max(acc.peakRssMB, st.peakRssMB);
      }
      a.close();
      b.close();
    }
  };
  const agg: Record<string, AgentStats> = {};
  await Promise.all(Array.from({ length: o.concurrency ?? 1 }, worker));
  rep.wallMs = Date.now() - t0;
  rep.stats = matchStats(rep);
  rep.search = Object.fromEntries(
    Object.entries(agg).map(([k, v]) => [k, { engine: v.engine, moves: v.moves, avgDepth: +(v.depthSum / Math.max(1, v.moves)).toFixed(1), knps: Math.round(v.nodesSum / Math.max(1, v.msSum)), avgMoveMs: Math.round(v.msSum / Math.max(1, v.moves)), peakRssMB: v.peakRssMB }]),
  );
  return rep;
}
