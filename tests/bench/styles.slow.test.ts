import { describe, it, expect, afterAll } from 'vitest';
import { Chess, type PieceSymbol } from 'chess.js';
import { nodeEngine } from '../helpers/nodeEngine';
import { sampleCandidate, eliteSelect, weightedBook, bookDepth, samplerDepth, samplerMultiPv, styleBonus, samplerTemperature, oversightChance, ELITE_TEMPERATURE_KNOTS, type Persona } from '../../src/engine/persona';
import { clamp, type Rng } from '../../src/core/rng';
import { winPercent, type PvLine } from '../../src/engine/uci';
import { PLAY_STYLES, STYLE_TO_OPENINGS } from '../../src/engine/styles';
import { createRng } from '../../src/core/rng';

// v0.2 selection (verbatim formulas, for the before/after comparison; memoised bonus).
const memo = new Map<string, number>();
function sb(style: Persona['style'], fen: string, uci: string, ctx: { bestWin: number; ply: number }) {
  const k = style + fen + uci + ctx.bestWin + ctx.ply;
  let v = memo.get(k);
  if (v === undefined) memo.set(k, (v = styleBonus(style, fen, uci, ctx)));
  return v;
}
function interp(k: [number, number][], x: number) {
  if (x <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (x <= k[i][0]) return k[i - 1][1] + ((k[i][1] - k[i - 1][1]) * (x - k[i - 1][0])) / (k[i][0] - k[i - 1][0]);
  return k[k.length - 1][1];
}
function pickW<T>(xs: { v: T; w: number }[], rng: Rng): T {
  const tot = xs.reduce((a, b) => a + b.w, 0);
  let r = rng.next() * tot;
  for (const x of xs) if ((r -= x.w) <= 0) return x.v;
  return xs[0].v;
}
function sampleV02(lines: PvLine[], persona: Persona, fen: string, rng: Rng, ply: number): string | null {
  const wins = lines.map((l) => winPercent(l.score));
  const best = Math.max(...wins);
  const T = samplerTemperature(persona.elo);
  const scale = clamp(1.2 - persona.elo / 2200, 0.15, 1);
  if (rng.chance(oversightChance(persona.elo))) {
    if (persona.elo < 1600) {
      const legal = new Chess(fen).moves({ verbose: true });
      const m = rng.pick(legal);
      return m.from + m.to + (m.promotion ?? '');
    }
    return rng.pick(lines).pv[0];
  }
  return pickW(lines.map((l, i) => ({ v: l.pv[0], w: Math.exp(-(best - wins[i] - sb(persona.style, fen, l.pv[0], { bestWin: best, ply }) * scale) / T) })), rng);
}
function eliteV02(lines: PvLine[], persona: Persona, fen: string, rng: Rng, ply: number): string | null {
  const wins = lines.map((l) => winPercent(l.score));
  const best = Math.max(...wins);
  const T = interp(ELITE_TEMPERATURE_KNOTS, persona.elo);
  const ok = lines.map((l, i) => ({ l, loss: best - wins[i] })).filter((x) => x.loss <= 3);
  return pickW(ok.map((x) => ({ v: x.l.pv[0], w: Math.exp(-(x.loss - clamp(sb(persona.style, fen, x.l.pv[0], { bestWin: best, ply }), -2, 2) * 0.2) / T) })), rng);
}
import { BENCH_OPENINGS } from './lib/openings';
import { TACTICS, ENDGAMES } from './lib/positions';
import { saveResult, envInt } from './lib/report';

/**
 * Do playing styles change move choice? (docs/ENGINE.md, v0.3 "Styles, measured")
 *
 * Fixed position set: the 40 bench openings (final positions), the 62 verified
 * tactics, the same 62 after the winning move (the defender to move = "pressed"),
 * and the 8 endgames → 172 positions. For each Elo band the engine's candidate
 * lines are computed ONCE per position (lite-single, the band's own depth and
 * MultiPV; elite: depth 12, MultiPV 3), then each style's selection step
 * (sampleCandidate / eliteSelect, the code the game runs) is sampled
 * BENCH_STYLE_SAMPLES times per position with different seeds. Reported per
 * style: rates of move features and the mean win% given up vs the best line;
 * the difference to `universal` with a 95 % CI from the per-position paired
 * differences (n = 172 positions). Opening choice is measured separately by
 * simulating book play (weightedBook, the game's code) from the start.
 */
const SAMPLES = envInt('BENCH_STYLE_SAMPLES', 60);
const BANDS = (process.env.BENCH_STYLE_ELOS ?? '1600,2200,2800').split(',').map(Number);
const VAL: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function positions(): { id: string; fen: string; kind: string }[] {
  const out: { id: string; fen: string; kind: string }[] = [];
  for (const o of BENCH_OPENINGS) {
    const c = new Chess();
    for (const m of o.san.split(' ')) c.move(m);
    out.push({ id: o.name, fen: c.fen(), kind: 'opening' });
  }
  for (const t of TACTICS) {
    out.push({ id: t.id, fen: t.fen, kind: 'tactic' });
    const c = new Chess(t.fen);
    try {
      c.move({ from: t.best[0].slice(0, 2), to: t.best[0].slice(2, 4), promotion: t.best[0][4] });
      if (!c.isGameOver()) out.push({ id: t.id + '-def', fen: c.fen(), kind: 'pressed' });
    } catch {
      /* skip */
    }
  }
  for (const e of ENDGAMES) out.push({ id: e.id, fen: e.fen, kind: 'endgame' });
  return out;
}

const FEATURES = ['capture', 'check', 'castle', 'pawn', 'king', 'nearKing', 'trade', 'advance', 'agreeBest'] as const;
type Feat = (typeof FEATURES)[number];

function features(fen: string, uci: string, best: string): Record<Feat, number> {
  const c = new Chess(fen);
  const us = c.turn();
  const ek = c.findPiece({ type: 'k', color: us === 'w' ? 'b' : 'w' })[0];
  const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  const d = (a: string, b: string) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));
  const rank = Number(m.to[1]);
  return {
    capture: m.captured ? 1 : 0,
    check: c.isCheck() ? 1 : 0,
    castle: m.isKingsideCastle() || m.isQueensideCastle() ? 1 : 0,
    pawn: m.piece === 'p' ? 1 : 0,
    king: m.piece === 'k' && !(m.isKingsideCastle() || m.isQueensideCastle()) ? 1 : 0,
    nearKing: ek && m.piece !== 'k' && d(m.to, ek) <= 2 ? 1 : 0,
    trade: m.captured && m.captured !== 'p' && Math.abs(VAL[m.captured] - VAL[m.piece]) <= 1 ? 1 : 0,
    advance: (us === 'w' ? rank >= 5 : rank <= 4) && m.piece !== 'k' ? 1 : 0,
    agreeBest: uci === best ? 1 : 0,
  };
}

type Row = Record<string, number | string>;
const eng = nodeEngine('lite-single', { initOptions: { Hash: 32 } });
afterAll(() => eng.terminate());

describe('style influence', () => {
  it('move features by style and band (paired vs universal)', async () => {
    const pos = positions();
    const report: Record<string, unknown> = { samples: SAMPLES, positions: pos.length, bands: {} };
    const lineCache = new Map<number, PvLine[][]>();
    const MODELS = (process.env.BENCH_STYLE_MODELS ?? 'v0.3,v0.2').split(',');
    for (const elo of BANDS) for (const model of MODELS) {
      const elite = elo >= 2700;
      // Candidate lines once per position.
      const lines: PvLine[][] = lineCache.get(elo) ?? [];
      if (!lineCache.has(elo)) for (const p of pos) {
        await eng.newGame();
        const r = await eng.search(elite ? { fen: p.fen, depth: 12, multipv: 3 } : { fen: p.fen, depth: samplerDepth(elo), multipv: samplerMultiPv(elo) });
        lines.push(r.lines.filter((l) => l.pv.length));
      }
      lineCache.set(elo, lines);
      const per: Record<string, { feat: Record<Feat, number[]>; loss: number[] }> = {};
      for (const style of PLAY_STYLES) {
        const feat = Object.fromEntries(FEATURES.map((f) => [f, [] as number[]])) as Record<Feat, number[]>;
        const loss: number[] = [];
        pos.forEach((p, i) => {
          const ls = lines[i];
          if (!ls.length) {
            for (const f of FEATURES) feat[f].push(NaN);
            loss.push(NaN);
            return;
          }
          const wins = new Map(ls.map((l) => [l.pv[0], winPercent(l.score)]));
          const best = Math.max(...wins.values());
          const bestMove = ls[0].pv[0];
          const acc = Object.fromEntries(FEATURES.map((f) => [f, 0])) as Record<Feat, number>;
          let lsum = 0;
          let n = 0;
          for (let k = 0; k < SAMPLES; k++) {
            const persona: Persona = { elo, style, openingStyles: [], seed: 1000 + k * 7919 + i };
            const rng = createRng((persona.seed * 2654435761) >>> 0);
            const ply = p.kind === 'opening' ? 12 : 30;
            const mv = model === 'v0.2' ? (elite ? eliteV02(ls, persona, p.fen, rng, ply) : sampleV02(ls, persona, p.fen, rng, ply)) : elite ? eliteSelect(ls, persona, p.fen, rng, ply)?.pv[0] : sampleCandidate(ls, persona, p.fen, rng, ply);
            if (!mv) continue;
            const fs = features(p.fen, mv, bestMove);
            for (const f of FEATURES) acc[f] += fs[f];
            // Oversight picks (legal moves outside the candidate list, < 1600) count as a 30-point loss.
            lsum += wins.has(mv) ? best - wins.get(mv)! : 30;
            n++;
          }
          for (const f of FEATURES) feat[f].push(acc[f] / n);
          loss.push(lsum / n);
        });
        per[style] = { feat, loss };
      }
      // Paired differences vs universal.
      const rows: Row[] = [];
      const u = per.universal;
      for (const style of PLAY_STYLES) {
        const row: Row = { style };
        for (const f of [...FEATURES, 'loss'] as const) {
          const a = f === 'loss' ? per[style].loss : per[style].feat[f];
          const b = f === 'loss' ? u.loss : u.feat[f];
          const diffs = a.map((x, i) => x - b[i]).filter((x) => Number.isFinite(x));
          const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
          const md = mean(diffs);
          const sd = Math.sqrt(diffs.reduce((s, x) => s + (x - md) ** 2, 0) / Math.max(1, diffs.length - 1));
          const ci = 1.96 * (sd / Math.sqrt(diffs.length));
          const scale = f === 'loss' ? 1 : 100;
          row[f] = +(mean(a.filter(Number.isFinite)) * scale).toFixed(1);
          if (style !== 'universal') row[f + 'Δ'] = `${md * scale >= 0 ? '+' : ''}${(md * scale).toFixed(1)}±${(ci * scale).toFixed(1)}`;
        }
        rows.push(row);
      }
      console.log(`\n=== ${model} band ${elo} (${elite ? 'elite: depth 12, MultiPV 3' : `sampler: depth ${samplerDepth(elo)}, MultiPV ${samplerMultiPv(elo)}`}), ${pos.length} positions × ${SAMPLES} samples; rates in %, loss in win% points`);
      console.table(rows.map((r) => ({ style: r.style, capture: r.capture, check: r.check, castle: r.castle, pawn: r.pawn, nearKing: r.nearKing, trade: r.trade, advance: r.advance, agreeBest: r.agreeBest, loss: r.loss })));
      console.table(rows.filter((r) => r.style !== 'universal').map((r) => ({ style: r.style, 'captureΔ': r['captureΔ'], 'checkΔ': r['checkΔ'], 'castleΔ': r['castleΔ'], 'pawnΔ': r['pawnΔ'], 'nearKingΔ': r['nearKingΔ'], 'tradeΔ': r['tradeΔ'], 'agreeBestΔ': r['agreeBestΔ'], 'lossΔ': r['lossΔ'] })));
      (report.bands as Record<string, unknown>)[`${model}@${elo}`] = rows;
    }
    // Opening choice: simulated book play from the start position.
    const games = envInt('BENCH_STYLE_BOOK_GAMES', 2000);
    const book: Row[] = [];
    for (const style of PLAY_STYLES) {
      const persona: Persona = { elo: 2000, style, openingStyles: STYLE_TO_OPENINGS[style], seed: 1 };
      let plies = 0;
      let gambit = 0;
      const first: Record<string, number> = {};
      const reply: Record<string, number> = {};
      for (let g = 0; g < games; g++) {
        const rng = createRng(77 + g * 31);
        const h: string[] = [];
        let lastName = '';
        while (h.length < bookDepth(2000, style)) {
          const cands = weightedBook(h, { ...persona, seed: g });
          if (!cands.length) break;
          const tot = cands.reduce((a, c) => a + c.weight, 0);
          let r = rng.next() * tot;
          let pick = cands[0];
          for (const c of cands) {
            r -= c.weight;
            if (r <= 0) {
              pick = c;
              break;
            }
          }
          h.push(pick.uci);
          lastName = pick.name;
        }
        plies += h.length;
        if (/Gambit/i.test(lastName)) gambit++;
        if (h[0]) first[h[0]] = (first[h[0]] ?? 0) + 1;
        if (h[0] === 'e2e4' && h[1]) reply[h[1]] = (reply[h[1]] ?? 0) + 1;
      }
      const pctOf = (o: Record<string, number>, k: string, n: number) => +((100 * (o[k] ?? 0)) / Math.max(1, n)).toFixed(1);
      const e4n = first.e2e4 ?? 0;
      book.push({ style, bookPlies: +(plies / games).toFixed(1), gambitLine: +((100 * gambit) / games).toFixed(1), e4: pctOf(first, 'e2e4', games), d4: pctOf(first, 'd2d4', games), c4: pctOf(first, 'c2c4', games), Nf3: pctOf(first, 'g1f3', games), vsE4_c5: pctOf(reply, 'c7c5', e4n), vsE4_e5: pctOf(reply, 'e7e5', e4n) });
    }
    console.log(`\n=== opening book (persona 2000, ${games} simulated games per style; % of games)`);
    console.table(book);
    report.book = { games, rows: book };
    saveResult('styles', report);
    expect(Object.keys(report.bands as object).length).toBe(BANDS.length * MODELS.length);
  }, 3 * 3600 * 1000);
});
