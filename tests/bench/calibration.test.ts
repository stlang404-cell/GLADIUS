import { describe, it, expect, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { nodeEngine } from '../helpers/nodeEngine';
import { chooseMove } from '../../src/engine/persona';
import { winPercent } from '../../src/engine/uci';
import { parseUci } from '../../src/chess/rules';
import { saveResult } from './lib/report';

/**
 * Strength-ladder benchmark: for each persona Elo, measure the average
 * win-percentage loss per move (a rating-independent ACPL analogue) against a
 * depth-12 reference on a fixed set of middlegame positions. Weaker personas
 * must lose more; the ladder must be monotone. Results are printed and
 * recorded in docs/ENGINE.md.
 */
const POSITIONS = [
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7',
  'rnbqkb1r/pp3ppp/4pn2/2pp4/3P1B2/2P1PN2/PP3PPP/RN1QKB1R b KQkq - 0 5',
  'r2q1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R2Q1RK1 w - - 0 10',
  'r1b2rk1/pp1nqppp/2p1pn2/3p4/2PP4/2N1PN2/PPQ1BPPP/R3K2R w KQ - 0 9',
  '2r2rk1/pp1bqppp/2n1pn2/3p4/3P4/P1NBPN2/1P3PPP/R2Q1RK1 w - - 1 13',
  'r4rk1/1pp1qppp/p1np1n2/4p3/2B1P1b1/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 10',
  'r1bqr1k1/pp3ppp/2pb1n2/3p4/3P4/2NBP3/PPQ2PPP/R3K1NR w KQ - 0 11',
  '3r1rk1/p4ppp/1pq1pn2/2p5/2P5/1P2PN2/P3QPPP/3R1RK1 w - - 0 18',
  '6k1/pp3ppp/2p5/3r4/8/1P3P2/P5PP/3R2K1 w - - 0 30',
  '8/5pk1/6p1/3P3p/4P2P/5PK1/8/8 w - - 0 45',
  'r1bq1rk1/pp1n1ppp/4pn2/2bp4/8/2NBPN2/PPQ2PPP/R1B2RK1 w - - 0 9',
];

const eng = nodeEngine();
afterAll(() => eng.terminate());

async function evalWin(fen: string): Promise<number> {
  const c = new Chess(fen);
  if (c.isCheckmate()) return 0;
  if (c.isDraw()) return 50;
  const r = await eng.search({ fen, depth: 12 });
  return winPercent(r.lines[0]?.score ?? { cp: 0 });
}

describe('strength ladder', () => {
  it('weaker personas lose more win% per move', async () => {
    // BENCH_LADDER_REPS (default 4) samples per position; BENCH_LADDER_ELITE=1 adds the
    // 2800/3000 rows (time-based search, 300 ms) — used for the docs/ENGINE.md table.
    const reps = Number(process.env.BENCH_LADDER_REPS ?? 4);
    const elite = !!process.env.BENCH_LADDER_ELITE;
    const elos = [500, 900, 1300, 1700, 2100, 2600, ...(elite ? [2800, 3000] : [])];
    const TARGET: Record<number, number> = { 500: 13, 900: 9, 1300: 6.5, 1700: 4.5, 2100: 3.2, 2600: 2, 2800: 1.2, 3000: 0.6 };
    const table: { elo: number; target: number; avgWinLoss: number; worstLoss: number; topMoveRate: number }[] = [];
    const ref = new Map<string, { best: number; move: string }>();
    for (const f of POSITIONS) {
      const r = await eng.search({ fen: f, depth: 12 });
      ref.set(f, { best: winPercent(r.lines[0].score), move: r.bestmove! });
    }
    for (const elo of elos) {
      let loss = 0;
      let worst = 0;
      let top = 0;
      let n = 0;
      for (const [i, fen] of POSITIONS.entries()) {
        for (let rep = 0; rep < reps; rep++) {
          const mv = await chooseMove(eng, fen, [], { elo, style: 'universal', openingStyles: [], seed: 1000 * rep + i * 7 + elo }, { pace: 'instant', startFen: fen, thinkMs: 300 });
          const c = new Chess(fen);
          c.move(parseUci(mv.uci));
          const after = 100 - (await evalWin(c.fen()));
          const l = Math.max(0, ref.get(fen)!.best - after);
          loss += l;
          worst = Math.max(worst, l);
          if (mv.uci === ref.get(fen)!.move) top++;
          n++;
        }
      }
      table.push({ elo, target: TARGET[elo], avgWinLoss: Math.round((loss / n) * 10) / 10, worstLoss: Math.round(worst), topMoveRate: Math.round((top / n) * 100) });
    }
    console.table(table);
    if (reps !== 4 || elite) saveResult(`ladder-${reps}reps`, table);
    for (let i = 1; i < table.length; i++) expect(table[i].avgWinLoss).toBeLessThanOrEqual(table[i - 1].avgWinLoss + 1.5);
    expect(table[0].avgWinLoss).toBeGreaterThan(table[table.length - 1].avgWinLoss + 4);
  }, 600000);
});
