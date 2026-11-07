import { describe, it, expect } from 'vitest';
import { runMatch, engineAgent, personaAgent, type AgentFactory } from './lib/match';
import { BENCH_OPENINGS } from './lib/openings';
import { fmtStats } from './lib/stats';
import { saveResult, envInt, engineIds } from './lib/report';
import { findBuild } from '../helpers/nodeEngine';
import type { Persona } from '../../src/engine/persona';

/**
 * Engine-vs-engine matches. Select with BENCH_MATCH=<name>[,<name>…] (default: a
 * short lite-vs-full smoke). Size: BENCH_OPENINGS (≤40, each played with both
 * colours), BENCH_ROUNDS, BENCH_MOVETIME (ms per move), BENCH_CONC (parallel games).
 * Results: tests/bench/results/match-<name>.json and docs/ENGINE.md.
 */
const MT = envInt('BENCH_MOVETIME', 200);
const P = (elo: number, seed = 11): Persona => ({ elo, style: 'universal', openingStyles: [], seed });

type Def = { a: AgentFactory; b: AgentFactory; conc?: number; needs: string[]; note: string };
const MATCHES: Record<string, () => Def> = {
  // Same budget, same hash, 1 thread: does the big net beat the lite net?
  'full-vs-lite': () => ({
    a: engineAgent(`full-single ${MT}ms`, { build: 'full-single', movetime: MT, hash: 64 }),
    b: engineAgent(`lite-single ${MT}ms`, { build: 'lite-single', movetime: MT, hash: 64, process: true }),
    needs: ['full-single'],
    note: 'Stockfish 19 full net vs lite net, both single-threaded, Hash 64, MultiPV 1, fixed movetime',
  }),
  // Threads: lite multi-threaded (3 threads) vs lite single, one game at a time.
  'mt3-vs-single': () => ({
    a: engineAgent(`lite-mt T3 ${MT}ms`, { build: 'lite-mt', threads: 3, movetime: MT, hash: 64 }),
    b: engineAgent(`lite-single ${MT}ms`, { build: 'lite-single', movetime: MT, hash: 64, process: true }),
    conc: 1,
    needs: ['lite-mt'],
    note: 'Threads 3 vs 1 (lite net), Hash 64, one game at a time so threads have free cores',
  }),
  // New desktop top tier vs the v0.1 top tier, same think time per move.
  'top-new-vs-old': () => ({
    a: personaAgent(`top v0.2 (full-single, H128, ${MT}ms)`, { persona: P(3200), build: 'full-single', hash: 128, opts: { thinkMs: MT } }),
    b: personaAgent(`top v0.1 (lite-single, H16, ${MT}ms)`, { persona: P(3200, 12), build: 'lite-single', hash: 16, opts: { thinkMs: MT } }),
    needs: ['full-single'],
    note: 'Persona ≥3000 path (book + single-PV search) on the desktop elite slot vs the v0.1 configuration',
  }),
  // v0.3 Phase B: top configuration vs the v0.2 top configuration *as it actually ran*
  // (v0.2 never shipped the big net to a fresh clone/host, so its top tier ran on Lite).
  // Static PWA host (not cross-origin isolated): single-threaded builds.
  'v03-pwa-vs-v02': () => ({
    a: engineAgent(`v0.3 PWA top: full-single H128 ${MT}ms`, { build: 'full-single', movetime: MT, hash: 128, process: true }),
    b: engineAgent(`v0.2 PWA top: lite-single H128 ${MT}ms`, { build: 'lite-single', movetime: MT, hash: 128, process: true }),
    needs: ['full-single'],
    note: 'v0.3 top tier on a static HTTPS host with the engine pack installed vs v0.2 (lite only), MultiPV 1, fixed movetime',
  }),
  // Windows package (launcher sends COOP/COEP → threads): v0.3 bundles full-mt; v0.2 had lite-mt.
  'v03-win-vs-v02': () => ({
    a: engineAgent(`v0.3 Windows top: full-mt T3 H128 ${MT}ms`, { build: 'full-mt', threads: 3, movetime: MT, hash: 128, process: true }),
    b: engineAgent(`v0.2 Windows top: lite-mt T3 H128 ${MT}ms`, { build: 'lite-mt', threads: 3, movetime: MT, hash: 128, process: true }),
    conc: 1,
    needs: ['full-mt', 'lite-mt'],
    note: 'Threads 3 each, one game at a time (4 cores), MultiPV 1, fixed movetime',
  }),
  // Threads with the big net: full-mt T3 vs full-single.
  'full-mt3-vs-single': () => ({
    a: engineAgent(`full-mt T3 H128 ${MT}ms`, { build: 'full-mt', threads: 3, movetime: MT, hash: 128, process: true }),
    b: engineAgent(`full-single H128 ${MT}ms`, { build: 'full-single', movetime: MT, hash: 128, process: true }),
    conc: 1,
    needs: ['full-mt', 'full-single'],
    note: 'Threads 3 vs 1 (big net), one game at a time',
  }),
  'ladder-2200-2600': () => ({ a: personaAgent('persona 2600', { persona: P(2600) }), b: personaAgent('persona 2200', { persona: P(2200, 12) }), needs: [], note: 'sampler vs sampler, lite-single' }),
  'ladder-2600-2800': () => ({ a: personaAgent('persona 2800', { persona: P(2800), opts: { thinkMs: MT } }), b: personaAgent('persona 2600', { persona: P(2600, 12) }), needs: [], note: 'elite (MultiPV 3, low T) vs sampler, lite-single' }),
  'ladder-2800-3000': () => ({ a: personaAgent('persona 3000', { persona: P(3000), opts: { thinkMs: MT } }), b: personaAgent('persona 2800', { persona: P(2800, 12), opts: { thinkMs: MT } }), needs: [], note: 'top (single PV) vs elite, same think time, lite-single' }),
  'ladder-1400-1800': () => ({ a: personaAgent('persona 1800', { persona: P(1800) }), b: personaAgent('persona 1400', { persona: P(1400, 12) }), needs: [], note: 'sampler vs sampler, lite-single' }),
  'ladder-1800-2200': () => ({ a: personaAgent('persona 2200', { persona: P(2200) }), b: personaAgent('persona 1800', { persona: P(1800, 12) }), needs: [], note: 'sampler vs sampler, lite-single' }),
};

describe('engine matches', () => {
  const names = (process.env.BENCH_MATCH ?? 'full-vs-lite').split(',');
  for (const name of names) {
    it(name, async () => {
      const def = MATCHES[name]?.();
      if (!def) throw new Error(`unknown match ${name}; known: ${Object.keys(MATCHES).join(', ')}`);
      const missing = def.needs.filter((b) => !findBuild(b as never));
      if (missing.length) {
        console.warn(`skipping ${name}: builds not found: ${missing.join(', ')} (set GLADIUS_SF_DIR)`);
        return;
      }
      const openings = BENCH_OPENINGS.slice(0, envInt('BENCH_OPENINGS', process.env.BENCH_MATCH ? 40 : 6));
      const rep = await runMatch(def.a, def.b, openings, {
        concurrency: def.conc ?? envInt('BENCH_CONC', 4),
        rounds: envInt('BENCH_ROUNDS', 1),
        onGame: (r) => {
          if ((r.w + r.d + r.l) % 10 === 0) console.log(fmtStats(`${name} [${r.w + r.d + r.l}]`, r));
        },
      });
      const line = fmtStats(`${rep.a} vs ${rep.b}`, rep);
      console.log(line, `(${Math.round(rep.wallMs / 1000)} s)`);
      saveResult(`match-${process.env.BENCH_TAG ? name + '-' + process.env.BENCH_TAG : name}`, { name, note: def.note, movetimeMs: MT, line, engines: engineIds(), ...rep });
      expect(rep.w + rep.d + rep.l).toBe(openings.length * 2 * envInt('BENCH_ROUNDS', 1));
      expect(rep.games.every((g) => !g.reason.startsWith('illegal'))).toBe(true);
    }, 24 * 3600 * 1000);
  }
});
