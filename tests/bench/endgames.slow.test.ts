import { describe, it, expect } from 'vitest';
import { endgameSuite } from './lib/suite';
import { engineAgent, personaAgent } from './lib/match';
import { findBuild } from '../helpers/nodeEngine';
import { saveResult, envInt } from './lib/report';
import type { BuildId } from '../../src/engine/builds';

/**
 * Endgame conversion vs a strong defender (full net if available, else lite,
 * 300 ms/move). Games are played out (no adjudication, 50-move rule applies).
 */
describe('endgame suite', () => {
  it('converts / holds theoretical results', async () => {
    const strong: BuildId = findBuild('full-single') ? 'full-single' : 'lite-single';
    const opp = engineAgent(`${strong} 300ms`, { build: strong, movetime: envInt('BENCH_EG_OPP_MS', 300), hash: 64 });
    const P = (elo: number) => ({ elo, style: 'technician' as const, openingStyles: [], seed: 5 });
    const tested = [
      { name: 'lite-single 100ms', f: engineAgent('lite-single 100ms', { build: 'lite-single', movetime: 100, hash: 16 }) },
      ...(findBuild('full-single') ? [{ name: 'full-single 100ms', f: engineAgent('full-single 100ms', { build: 'full-single', movetime: 100, hash: 64 }) }] : []),
      ...[1000, 1600, 2200, 2600, 2800, 3000].map((elo) => ({ name: `persona ${elo}`, f: personaAgent(`persona ${elo}`, { persona: P(elo), opts: { thinkMs: 300 } }) })),
    ];
    const rows = [];
    for (const t of tested) {
      const r = await endgameSuite(t.name, t.f, opp);
      rows.push({ config: t.name, score: `${r.score}/${r.total}`, detail: r.results.map((x) => `${x.id}:${x.got}${x.got === 'win' ? '@' + x.plies : ''}`).join(' ') });
      console.log(rows[rows.length - 1]);
    }
    console.table(rows);
    saveResult('endgames', { opponent: strong, rows });
    expect(rows.length).toBeGreaterThan(0);
  }, 6 * 3600 * 1000);
});
