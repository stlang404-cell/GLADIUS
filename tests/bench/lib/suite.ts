import { Chess } from 'chess.js';
import type { UciEngine } from '../../../src/engine/uci';
import { chooseMove, type Persona } from '../../../src/engine/persona';
import { TACTICS, ENDGAMES, type TestPosition } from './positions';
import { playGame, type Agent, type AgentFactory } from './match';

export type SolveConfig =
  | { kind: 'engine'; name: string; engine: () => UciEngine; movetime: number }
  | { kind: 'persona'; name: string; engine: () => UciEngine; persona: Persona; thinkMs?: number };

export type SolveReport = { name: string; solved: number; total: number; rate: number; failed: string[]; ms: number };

/** Fixed-time solve rate on the verified tactical suite. */
export async function solveSuite(cfg: SolveConfig, positions: TestPosition[] = TACTICS): Promise<SolveReport> {
  const e = cfg.engine();
  const t0 = Date.now();
  let solved = 0;
  const failed: string[] = [];
  try {
    for (const p of positions) {
      await e.newGame();
      let mv: string | null;
      if (cfg.kind === 'engine') {
        mv = (await e.search({ fen: p.fen, movetime: cfg.movetime })).bestmove;
      } else {
        mv = (await chooseMove(e, p.fen, [], { ...cfg.persona, seed: cfg.persona.seed + positions.indexOf(p) }, { startFen: p.fen, thinkMs: cfg.thinkMs })).uci;
      }
      if (mv && p.best.includes(mv)) solved++;
      else failed.push(p.id);
    }
  } finally {
    e.terminate();
  }
  return { name: cfg.name, solved, total: positions.length, rate: solved / positions.length, failed, ms: Date.now() - t0 };
}

export type EndgameReport = { name: string; results: { id: string; expect: string; got: string; plies: number; reason: string }[]; score: number; total: number };

/**
 * Endgame conversion: the tested agent plays the side to move ("strong" side for
 * wins, the defender for draws) against a strong opponent from each position.
 * Success = the theoretical result is reached (win within the 50-move rule /
 * 200 plies, or a draw held). No adjudication: games are played out.
 */
export async function endgameSuite(name: string, tested: AgentFactory, opponent: AgentFactory): Promise<EndgameReport> {
  const a = tested();
  const b = opponent();
  const results: EndgameReport['results'] = [];
  let score = 0;
  try {
    for (const p of ENDGAMES) {
      const c = new Chess(p.fen);
      const testedIsWhite = c.turn() === 'w';
      const g = await playGameFrom(p.fen, testedIsWhite ? a : b, testedIsWhite ? b : a);
      const testedWon = (g.result === '1-0' && testedIsWhite) || (g.result === '0-1' && !testedIsWhite);
      const got = g.result === '1/2-1/2' ? 'draw' : testedWon ? 'win' : 'loss';
      if (got === p.expect || (p.expect === 'draw' && got === 'win')) score++;
      results.push({ id: p.id, expect: p.expect, got, plies: g.plies, reason: g.reason });
    }
  } finally {
    a.close();
    b.close();
  }
  return { name, results, score, total: ENDGAMES.length };
}

function playGameFrom(fen: string, white: Agent, black: Agent) {
  return playGame(white, black, [], { adjudicate: false, maxPlies: 200, startFen: fen });
}
