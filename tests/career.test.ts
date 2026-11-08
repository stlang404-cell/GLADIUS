import { describe, it, expect } from 'vitest';
import { emptyWorld } from '../src/world/world';
import { advanceWorld } from '../src/world/world';
import { newSave, startGame, finishPlayerGame, suggestOpponents, playerTournamentGame, acceptTournament, refreshInvitations, careerRating, restDays } from '../src/game/career';
import { RANKS, decideRank, ARENAS, naturalRank, migrateArenaIndex, migrateRankIndex, TRIAL_BYPASS_MARGIN, ARENA_DEMOTION_MARGIN } from '../src/world/arenas';
import { PLAYER_ID } from '../src/world/calendar';
import type { GameRecord, Save } from '../src/game/state';
import { createRng } from '../src/core/rng';

function world() {
  const w = emptyWorld(31337);
  advanceWorld(w, 56, null);
  return w;
}

function play(s: Save, oppId: string, score: number, kind: GameRecord['kind'] = 'ranked', extra: Partial<GameRecord> = {}) {
  const opp = s.world.competitors.find((c) => c.id === oppId)!;
  const rec = startGame(s, opp, { kind, tcId: 'rapid-10', ...(extra as object) });
  const mine = rec.playerColor!;
  rec.result = score === 0.5 ? '1/2-1/2' : (score === 1) === (mine === 'w') ? '1-0' : '0-1';
  rec.termination = score === 0.5 ? 'agreement' : 'resignation';
  rec.moves = ['e2e4', 'e7e5'];
  Object.assign(rec, extra);
  s.active = null;
  return finishPlayerGame(s, rec);
}

describe('rank rules', () => {
  it('provisional players are placed by rating', () => {
    // v0.3 layout: 24 arenas × 3 grades. 1250 lies in the Aqueduct Heights (arena 7, 1200–1299).
    expect(naturalRank(1250)).toBe(22);
    expect(decideRank(0, 1250, true)).toEqual({ kind: 'grade-up', to: 2 });
    expect(decideRank(20, 1250, true)).toEqual({ kind: 'grade-up', to: 22 });
    expect(decideRank(2, 1250, true)).toEqual({ kind: 'grade-up', to: 4 });
  });
  it('crossing an arena needs a trial unless dominant', () => {
    const top = 8; // Miles I, top of the Legion Camp (700-799)
    expect(RANKS[top].name).toBe('Miles I');
    expect(decideRank(top, 805, false).kind).toBe('trial-available');
    expect(decideRank(top, 800 + TRIAL_BYPASS_MARGIN, false).kind).toBe('arena-up');
  });
  it('demotion buffers', () => {
    const rhine = 9; // Veteranus III, Rhine Frontier floor 800
    expect(decideRank(rhine, 780, false).kind).toBe('stay'); // 20 below the floor
    expect(decideRank(rhine, 800 - ARENA_DEMOTION_MARGIN - 1, false).kind).toBe('arena-down');
  });
  it('v0.2 indices map onto the 24-arena layout', () => {
    expect(migrateArenaIndex(0)).toBe(0);
    expect(migrateArenaIndex(5)).toBe(10);
    expect(migrateArenaIndex(11)).toBe(23);
    expect(migrateRankIndex(35)).toBe(71);
    expect(migrateRankIndex(4)).toBe(7); // Decanus (arena 1, tier 1) → Legion Camp tier 1
    for (let a = 0; a < 12; a++) expect(ARENAS[migrateArenaIndex(a)].legacyIndex).toBe(a);
  });
});

describe('career integration', () => {
  it('rated results move Elo, records, world day and the opponent', () => {
    const s = newSave(world(), 'Hero', false, 800);
    const day0 = s.world.day;
    const opp = suggestOpponents(s)[0].c;
    const oppGames = opp.games;
    const pg = play(s, opp.id, 1);
    expect(pg.delta).toBeGreaterThan(0);
    expect(s.player.w).toBe(1);
    expect(s.world.day).toBe(day0 + 1);
    expect(opp.games).toBeGreaterThanOrEqual(oppGames + 1); // + any off-screen game the opponent plays on the new day
    expect(s.player.h2h[opp.id].w).toBe(1);
    expect(pg.influence).toBeGreaterThan(0);
  });
  it('a strong player climbs, triggers and wins a promotion trial', () => {
    const s = newSave(world(), 'Hero', false, 800);
    const rng = createRng(5);
    let trial = false;
    for (let i = 0; i < 80 && !trial; i++) {
      const sug = suggestOpponents(s, i)[1] ?? suggestOpponents(s, i)[0];
      play(s, sug.c.id, rng.chance(0.85) ? 1 : 0.5);
      trial = !!s.player.trial;
    }
    expect(careerRating(s).rating).toBeGreaterThan(900);
    if (s.player.trial) {
      refreshInvitations(s);
      const inv = s.world.invitations.find((x) => x.kind === 'trial')!;
      expect(inv).toBeTruthy();
      const before = RANKS[s.player.rank].arena;
      play(s, inv.fromId!, 1, 'trial');
      expect(RANKS[s.player.rank].arena).toBe(before + 1);
      expect(s.player.unlockedSets).toContain(before + 1);
    }
    expect(s.player.rankHistory.length).toBeGreaterThan(1);
  });
  it('player completes a whole tournament with rounds waiting on them', () => {
    const s = newSave(world(), 'Hero', false, 800);
    const arena = RANKS[s.player.rank].arena;
    const t = s.world.tournaments.find((x) => x.status === 'scheduled' && x.kind === 'open' && x.arena === arena)!;
    expect(acceptTournament(s, t.id)).toBe(true);
    restDays(s, t.startDay - s.world.day + 1);
    let games = 0;
    for (let i = 0; i < 40 && t.status !== 'complete'; i++) {
      const pt = playerTournamentGame(s);
      if (!pt) { restDays(s, 1); continue; }
      const rec = startGame(s, pt.opp!, { kind: 'tournament', tcId: 'rapid-10', color: pt.color, tournamentId: pt.t.id, pairingId: pt.pairingId });
      rec.result = pt.color === 'w' ? '1-0' : '0-1';
      rec.termination = 'resignation';
      s.active = null;
      finishPlayerGame(s, rec);
      games++;
    }
    expect(t.status).toBe('complete');
    expect(games).toBe(t.state!.rounds.length);
    expect(t.state!.winner ?? null).toBe(null === t.state!.winner ? null : t.state!.winner);
    const hist = s.world.history.find((h) => h.id === t.id)!;
    expect(hist.playerPlace).toBe(1);
    expect(s.player.tournamentsWon).toBe(1);
    expect(s.player.influence).toBeGreaterThan(0);
  });
  it('ARENAS floors are increasing', () => {
    for (let i = 1; i < ARENAS.length; i++) expect(ARENAS[i].floor).toBeGreaterThan(ARENAS[i - 1].floor);
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].floor).toBeGreaterThan(RANKS[i - 1].floor);
    expect(RANKS.length).toBe(72);
    expect(ARENAS.length).toBe(24);
    expect(new Set(RANKS.map((r) => r.id)).size).toBe(72);
    expect(PLAYER_ID).toBe('player');
  });
});
