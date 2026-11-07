import { describe, it, expect } from 'vitest';
import { playGame, personaAgent } from './lib/match';
import { BENCH_OPENINGS } from './lib/openings';
import { saveResult, envInt } from './lib/report';

/**
 * Clock stress: personas play real games on a simulated clock (wall-clock search
 * time + the human-like delay they would wait in the UI) at controls *faster*
 * than the game offers. Nobody may lose on time.
 */
describe('clock-aware thinking', () => {
  it('no persona flags at 60+0 and 30+1', async () => {
    const controls = [
      { baseMs: 60000, incMs: 0 },
      { baseMs: 30000, incMs: 1000 },
    ];
    const elos = [1200, 2000, 2650, 2850, 3100];
    const n = envInt('BENCH_CLOCK_GAMES', 1);
    const jobs: (() => Promise<Record<string, unknown>>)[] = [];
    for (const tc of controls) {
      for (let i = 0; i < elos.length; i++) {
        for (let k = 0; k < n; k++) {
          jobs.push(async () => {
          const w = personaAgent(`p${elos[i]}`, { persona: { elo: elos[i], style: 'universal', openingStyles: ['classical'], seed: k } })();
          const b = personaAgent(`p${elos[(i + 1) % elos.length]}`, { persona: { elo: elos[(i + 1) % elos.length], style: 'attacker', openingStyles: ['aggressive'], seed: k + 9 } })();
          return playGame(w, b, BENCH_OPENINGS[(i * n + k) % BENCH_OPENINGS.length].san.split(' '), { clock: tc, adjudicate: false, maxPlies: 240 }).then((g) => {
              w.close();
              b.close();
              return { tc: `${tc.baseMs / 1000}+${tc.incMs / 1000}`, white: w.name, black: b.name, result: g.result, reason: g.reason, plies: g.plies, flagged: g.flagged ?? null, minW: g.minClockMs?.w, minB: g.minClockMs?.b };
            });
          });
        }
      }
    }
    // Run in batches of 4 to keep timing realistic on a 4-core machine.
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < jobs.length; i += 4) rows.push(...(await Promise.all(jobs.slice(i, i + 4).map((j) => j()))));
    console.table(rows);
    saveResult('clock', rows);
    expect(rows.filter((r) => r.flagged)).toEqual([]);
  }, 3 * 3600 * 1000);
});
