import { generatePopulation, POPULATION_SIZE } from './population';
import { initTitles, scheduleSeason, advanceDay, type PlayerHooks } from './calendar';
import type { WorldState } from '../game/state';
import { ensureWorldV2 } from './trophies';

export const BURN_IN_SEASONS = 8;

export function emptyWorld(seed: number): WorldState {
  const w: WorldState = {
    seed, day: 0, competitors: generatePopulation(seed), nextSerial: POPULATION_SIZE + 1, chronicle: [],
    stats: { simGames: 0, retirements: 0, debuts: 0, promotions: 0, calibrations: 0 },
    titles: [], reigns: [], tournaments: [], invitations: [], season: 0, tournamentSerial: 0, history: [],
  };
  ensureWorldV2(w);
  initTitles(w);
  scheduleSeason(w, 0);
  return w;
}

/**
 * Create the empire and let it live through a few seasons before the player
 * arrives, so every champion, record and rivalry in the history was actually
 * contested in simulation (not invented).
 */
export function createWorld(seed: number, seasons = BURN_IN_SEASONS, onProgress?: (f: number) => void): WorldState {
  const w = emptyWorld(seed);
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
