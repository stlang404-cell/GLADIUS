/**
 * Zero-to-emperor journey driver (v0.4): plays a fresh career through the real
 * career API (startGame / finishPlayerGame / acceptTournament / trials /
 * championships / restDays) with a deterministic player whose strength rises
 * over time. Every result comes from the world's own calibrated outcome model
 * (`simulateGame`, the function that resolves AI games): the player is
 * represented only by a skill number, never by forced wins.
 *
 * Shared by tests/journey.test.ts (reduced population) and the soak variant
 * tests/soak/journey.soak.ts (25,000 competitors).
 */
import { createRng, mixSeed } from '../../src/core/rng';
import { createWorld } from '../../src/world/world';
import { simulateGame } from '../../src/world/sim';
import { RANKS } from '../../src/world/arenas';
import { PLAYER_ID } from '../../src/world/calendar';
import { getCompetitor } from '../../src/world/indexes';
import {
  newSave, startGame, finishPlayerGame, suggestOpponents, playerTournamentGame, acceptTournament, dismissInvitation, restDays, playerArena, playerRegion,
} from '../../src/game/career';
import type { Competitor } from '../../src/world/types';
import type { GameRecord, Save, WorldTournament, InvitationContext } from '../../src/game/state';

export type JourneyOptions = {
  seed: number;
  population: number;
  burnInSeasons: number;
  /** Player strength after `g` games (deterministic curve). */
  skill: (games: number) => number;
  maxGames: number;
  /** Stop once the player holds the Eternal Throne and has defended it this many times. */
  emperorDefences: number;
  /** Self-assessed level passed to newSave (only a provisional matchmaking seed). */
  startRating?: number;
  /** Called after every game (for invariant checks). */
  onGame?: (s: Save, rec: GameRecord, before: Snapshot) => void;
};

export type Snapshot = { w: number; d: number; l: number; ratedGames: number; rating: number; rank: number; day: number; histLen: number };
export type Entry = { tournamentId: string; kind: string; arena: number; region: string; context: InvitationContext | 'auto' | 'qualified'; playerArena: number; playerRegion: string; day: number };

export type Finished = { id: string; kind: string; arena: number; season: number; endDay: number; winner: string | null; runnerUp: string | null; place: number | undefined };
export type JourneyLog = {
  save: Save;
  /** Every event the player took part in, captured from the history as it completed. */
  finished: Finished[];
  records: GameRecord[];
  /** Rank after every game (and the start). */
  rankTrail: number[];
  /** Grades in the order they were first held. */
  firstVisits: number[];
  entries: Entry[];
  /** Achievement id → { day, games } of unlock. */
  unlocks: Record<string, { day: number; games: number }>;
  emperorDay: number | null;
  steps: number;
  ms: number;
};

export function snapshot(s: Save): Snapshot {
  const p = s.player;
  return { w: p.w, d: p.d, l: p.l, ratedGames: p.ratedGames, rating: p.ratings[s.settings.careerPool].rating, rank: p.rank, day: s.world.day, histLen: p.ratingHistory.length };
}

/** Accepted invitation contexts (everything except hosted / exhibitions, which are not needed for the journey). */
const ACCEPT = new Set<InvitationContext>([
  'open-registration', 'regional-championship', 'invitational', 'elite-invitational', 'seeded', 'wildcard', 'title-challenge',
  'local-open', 'regional-crown', 'regional-defense', 'qualifier', 'imperial-masters',
]);

export function makeJourneySave(o: Pick<JourneyOptions, 'seed' | 'population' | 'burnInSeasons' | 'startRating'>): Save {
  const w = createWorld(o.seed, o.burnInSeasons, undefined, o.population);
  return newSave(w, 'Marcus Novus', false, o.startRating ?? 800);
}

export function runJourney(s: Save, o: JourneyOptions): JourneyLog {
  const t0 = performance.now();
  const records: GameRecord[] = [];
  const rankTrail = [s.player.rank];
  const firstVisits = [s.player.rank];
  const entries: Entry[] = [];
  const unlocks: Record<string, { day: number; games: number }> = {};
  const seenEntry = new Set<string>();
  const finished: Finished[] = [];
  const seenFinished = new Set<string>();
  const captureFinished = () => {
    const h = s.world.history;
    for (let i = Math.max(0, h.length - 400); i < h.length; i++) {
      const x = h[i];
      if (x.playerPlace === undefined || seenFinished.has(x.id)) continue;
      seenFinished.add(x.id);
      finished.push({ id: x.id, kind: x.kind, arena: x.arena, season: x.season, endDay: x.endDay, winner: x.winner, runnerUp: x.runnerUp, place: x.playerPlace });
    }
  };
  let emperorDay: number | null = null;
  let steps = 0;
  const me = (): Competitor => ({ skill: o.skill(records.length) }) as Competitor;
  const top = `title-${RANKS[RANKS.length - 1].arena}`;

  const recordEntries = (ctxOf: Map<string, InvitationContext>) => {
    for (const t of s.world.tournaments) {
      if (!t.playerEntered || seenEntry.has(t.id)) continue;
      seenEntry.add(t.id);
      entries.push({
        tournamentId: t.id, kind: t.kind, arena: t.arena, region: t.region ?? 'imperial', context: ctxOf.get(t.id) ?? (t.qualified?.includes(PLAYER_ID) ? 'qualified' : 'auto'),
        playerArena: playerArena(s), playerRegion: playerRegion(s), day: s.world.day,
      });
    }
  };

  const play = (opp: Competitor, kind: GameRecord['kind'], extra: { tournamentId?: string; pairingId?: string; color?: 'w' | 'b' } = {}) => {
    const before = snapshot(s);
    const rec = startGame(s, opp, { kind, tcId: 'blitz-5', ...extra }); // a clock is requested: it must be ignored (untimed)
    const rng = createRng(mixSeed(o.seed, 'journey-game', records.length));
    const mine = rec.playerColor!;
    // The world's calibrated outcome model, the player represented by their current skill.
    const score = rng.chance(0.5) ? simulateGame(me(), opp, rng) : 1 - simulateGame(opp, me(), rng);
    rec.result = score === 0.5 ? '1/2-1/2' : (score === 1) === (mine === 'w') ? '1-0' : '0-1';
    rec.termination = score === 0.5 ? 'agreement' : 'resignation';
    rec.moves = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];
    rec.san = ['e4', 'e5', 'Nf3', 'Nc6'];
    s.active = null;
    finishPlayerGame(s, rec);
    records.push(rec);
    for (const [id, day] of Object.entries(s.player.achievements)) if (!unlocks[id]) unlocks[id] = { day, games: records.length };
    rankTrail.push(s.player.rank);
    if (!firstVisits.includes(s.player.rank)) firstVisits.push(s.player.rank);
    if (emperorDay === null && s.player.titles.includes(top)) emperorDay = s.world.day;
    captureFinished();
    o.onGame?.(s, rec, before);
  };

  const ctxOf = new Map<string, InvitationContext>();
  for (; steps < o.maxGames * 3 && records.length < o.maxGames; steps++) {
    const reign = s.world.reigns.find((r) => r.titleId === top && r.holder === PLAYER_ID && r.to === null);
    if (reign && reign.defenses >= o.emperorDefences) break;
    // 1. A tournament round waiting on the player.
    const pt = playerTournamentGame(s);
    if (pt) {
      if (pt.opp) play(pt.opp, 'tournament', { tournamentId: pt.t.id, pairingId: pt.pairingId, color: pt.color });
      else restDays(s, 1);
      captureFinished();
      continue;
    }
    // 2. A pending Promotion Trial.
    const trial = s.world.invitations.find((i) => i.kind === 'trial');
    if (s.player.trial && trial && s.player.ratedGames >= s.player.trial.cooldownUntilGames) {
      const opp = getCompetitor(s.world, trial.fromId);
      dismissInvitation(s, trial.id);
      if (opp) {
        play(opp, 'trial');
        continue;
      }
    }
    // 3. Tournament invitations (registration follows the invitation rules).
    for (const inv of [...s.world.invitations]) {
      if (!inv.tournamentId || !inv.context || !ACCEPT.has(inv.context)) continue;
      const t = s.world.tournaments.find((x) => x.id === inv.tournamentId) as WorldTournament | undefined;
      if (!t || t.status !== 'scheduled') continue;
      ctxOf.set(t.id, inv.context);
      acceptTournament(s, t.id);
    }
    recordEntries(ctxOf);
    // 4. Otherwise a rated game against a suggested opponent (even match, sometimes the stronger challenge).
    const sug = suggestOpponents(s, steps);
    const pick = sug[steps % 3 === 2 && sug[1] ? 1 : 0];
    play(pick.c, 'ranked');
    recordEntries(ctxOf);
  }
  recordEntries(ctxOf);
  captureFinished();
  return { save: s, finished, records, rankTrail, firstVisits, entries, unlocks, emperorDay, steps, ms: performance.now() - t0 };
}

/** Default skill curve: a beginner (≈ 450) improving steadily to a dominant 3,300 by game `games`. */
export function risingSkill(games: number, start = 450, end = 3300) {
  return (g: number) => Math.min(end, start + ((end - start) * g) / games);
}
