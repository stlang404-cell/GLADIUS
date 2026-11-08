import { generatePopulation, POPULATION_SIZE } from './population';
import { initTitles, scheduleSeason, advanceDay, type PlayerHooks } from './calendar';
import type { WorldState } from '../game/state';
import { ensureWorldV2 } from './trophies';
import { ensureWorldV3, initRegionTitles, ARENA_LAYOUT } from './migrate';

/**
 * Burn-in seasons before the player arrives (v0.3: 8 seasons = two in-world
 * years at 25,000 competitors; see docs/WORLD.md for the measured cost).
 */
export const BURN_IN_SEASONS = 8;

export function emptyWorld(seed: number, size = POPULATION_SIZE): WorldState {
  const w: WorldState = {
    seed, day: 0, competitors: generatePopulation(seed, size), nextSerial: size + 1, chronicle: [],
    stats: { simGames: 0, retirements: 0, debuts: 0, promotions: 0, calibrations: 0 },
    titles: [], reigns: [], tournaments: [], invitations: [], season: 0, tournamentSerial: 0, history: [],
    arenaLayout: ARENA_LAYOUT, populationTarget: size,
  };
  ensureWorldV2(w);
  initTitles(w);
  initRegionTitles(w);
  ensureWorldV3(w);
  scheduleSeason(w, 0);
  return w;
}

/**
 * Create the empire and let it live through a few seasons before the player
 * arrives, so every champion, record and rivalry in the history was actually
 * contested in simulation (not invented).
 */
export function createWorld(seed: number, seasons = BURN_IN_SEASONS, onProgress?: (f: number) => void, size = POPULATION_SIZE): WorldState {
  const w = emptyWorld(seed, size);
  const days = seasons * 28;
  for (let d = 0; d < days; d++) {
    advanceDay(w, null);
    if (onProgress && d % 14 === 0) onProgress(d / days);
  }
  w.chronicle.push({ day: w.day, kind: 'season', text: 'A new competitor arrives in the Dust Pits.' });
  return w;
}

export function advanceWorld(w: WorldState, days: number, hooks: PlayerHooks | null) {
  for (let i = 0; i < days; i++) advanceDay(w, hooks);
}
