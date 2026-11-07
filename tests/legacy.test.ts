import { describe, it, expect } from 'vitest';
import { emptyWorld, advanceWorld } from '../src/world/world';
import { newSave, startGame, finishPlayerGame, restDays, careerRating, acceptTournament, playerTournamentGame, refreshInvitations } from '../src/game/career';
import { ACHIEVEMENTS, achievementProgress, onGameAnalysed, achievementCounts, checkAchievements } from '../src/game/achievements';
import { ensureSaveV2, objectives, legacyTimeline, rivalPrep, rivalries, championshipPrivileges, hostCostFor, playerTrophies } from '../src/game/legacy';
import { awardsFor } from '../src/world/trophies';
import { RANKS } from '../src/world/arenas';
import type { GameRecord, Save, MoveAnalysis, GameAnalysis } from '../src/game/state';
import type { Competitor } from '../src/world/types';

let base: string | null = null;
function world() {
  if (!base) {
    const w = emptyWorld(31337);
    advanceWorld(w, 56, null);
    base = JSON.stringify(w);
  }
  return JSON.parse(base);
}

function opponentNear(s: Save, rating: number, exclude: string[] = []): Competitor {
  const act = s.world.competitors.filter((c) => c.retiredDay === null && !exclude.includes(c.id) && c.games >= 20);
  return act.reduce((a, b) => (Math.abs(b.rating - rating) < Math.abs(a.rating - rating) ? b : a));
}

function play(s: Save, opp: Competitor, score: number, extra: Partial<GameRecord> = {}, plies = 70) {
  const rec = startGame(s, opp, { kind: 'ranked', tcId: 'rapid-10' });
  const mine = rec.playerColor!;
  rec.result = score === 0.5 ? '1/2-1/2' : (score === 1) === (mine === 'w') ? '1-0' : '0-1';
  rec.termination = score === 0.5 ? 'agreement' : 'resignation';
  rec.moves = Array.from({ length: plies }, (_, i) => (i % 2 ? 'e7e5' : 'e2e4'));
  Object.assign(rec, extra);
  s.active = null;
  const pg = finishPlayerGame(s, rec);
  return { rec, pg };
}

function analysis(rec: GameRecord, acc: number, evals: number[] = [], extra: Partial<GameAnalysis> = {}): GameAnalysis {
  const color = rec.playerColor!;
  const moves: MoveAnalysis[] = rec.moves.map((uci, i) => {
    const cp = evals[i] ?? 50;
    const white = color === 'w' ? cp : -cp; // evals given from the player's perspective
    return { ply: i, uci, san: uci, evalBefore: { cp: white }, evalAfter: { cp: white }, bestUci: uci, bestSan: uci, pv: [], winLoss: 0, accuracy: acc, cls: 'best' };
  });
  return {
    depth: 12, engine: 'test', moves, accuracy: { w: color === 'w' ? acc : 60, b: color === 'b' ? acc : 60 },
    counts: { w: {}, b: {} }, critical: [], opening: null, endgame: null, ...extra,
  };
}

describe('achievements', () => {
  it('has 110–140 achievements in 10 categories with stable unique ids incl. all legacy ids', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(110);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(150);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(Object.keys(achievementCounts()).length).toBe(10);
    const legacy = ['first-blood', 'centurion', 'legion', 'streak-5', 'giant-slayer', 'mate-quick', 'underpromote', 'arena-3', 'arena-6', 'arena-9', 'arena-11', 'first-trophy', 'five-trophies', 'champion', 'emperor', 'student', 'precise', 'rival', 'influence-100', 'prestige-1000'];
    for (const id of legacy) expect(ACHIEVEMENTS.find((a) => a.id === id), id).toBeTruthy();
    for (const a of ACHIEVEMENTS) expect((a.reward ?? 0) <= 25).toBe(true);
  });

  it('farming weak opponents does not count towards skill achievements', () => {
    const s = newSave(world(), 'Hero', false, 1500);
    const weak = opponentNear(s, 900);
    for (let i = 0; i < 12; i++) play(s, weak, 1);
    expect(s.player.w).toBe(12);
    expect(s.player.achievements['first-blood']).toBeDefined(); // plain participation milestone
    expect(s.player.ledger!.c.eligibleWins ?? 0).toBe(0);
    expect(s.player.achievements['proven-blade']).toBeUndefined();
    expect(s.player.achievements['streak-5']).toBeUndefined();
    const prog = achievementProgress(s).find((p) => p.def.id === 'proven-blade')!;
    expect(prog.current).toBe(0);
    // Eligible opponents (≥ rating − 200) count, with honest progress.
    const used: string[] = [];
    for (let i = 0; i < 4; i++) {
      const o = opponentNear(s, careerRating(s).rating - 50, used);
      used.push(o.id);
      play(s, o, 1);
    }
    expect(s.player.ledger!.c.eligibleWins).toBe(4);
    expect(achievementProgress(s).find((p) => p.def.id === 'proven-blade')!.current).toBe(4);
  });

  it('analysis-gated achievements unlock only from stored analysis, once, vs eligible opponents', () => {
    const s = newSave(world(), 'Hero', false, 1500);
    const even = opponentNear(s, 1550);
    const { rec } = play(s, even, 1, {}, 70);
    expect(s.player.achievements['master-of-calculation']).toBeUndefined();
    expect(onGameAnalysed(s, rec)).toEqual([]); // no analysis stored yet
    rec.analysis = analysis(rec, 95);
    const got = onGameAnalysed(s, rec);
    expect(got).toContain('Master of Calculation');
    expect(s.player.achievements['precise']).toBeDefined();
    expect(onGameAnalysed(s, rec)).toEqual([]); // idempotent
    expect(s.player.ledger!.c.acc92Wins).toBe(1);

    // Short games do not qualify for Master of Calculation's 30-move rule.
    const s2 = newSave(world(), 'Hero', false, 1500);
    const g2 = play(s2, opponentNear(s2, 1550), 1, {}, 40).rec;
    g2.analysis = analysis(g2, 97);
    onGameAnalysed(s2, g2);
    expect(s2.player.achievements['master-of-calculation']).toBeUndefined();
    // Weak opponents never qualify.
    const g3 = play(s2, opponentNear(s2, 800), 1, {}, 80).rec;
    g3.analysis = analysis(g3, 99);
    onGameAnalysed(s2, g3);
    expect(s2.player.achievements['master-of-calculation']).toBeUndefined();
  });

  it('The Comeback requires a real ≤25% position in the analysis', () => {
    const s = newSave(world(), 'Hero', false, 1500);
    const { rec } = play(s, opponentNear(s, 1550), 1, {}, 60);
    rec.analysis = analysis(rec, 70, Array.from({ length: 60 }, (_, i) => (i > 20 && i < 30 ? -600 : 80)));
    expect(onGameAnalysed(s, rec)).toContain('The Comeback');
    const s2 = newSave(world(), 'Hero', false, 1500);
    const g2 = play(s2, opponentNear(s2, 1550), 1, {}, 60).rec;
    g2.analysis = analysis(g2, 70, Array.from({ length: 60 }, () => -100)); // ~41%: not a comeback
    onGameAnalysed(s2, g2);
    expect(s2.player.achievements['the-comeback']).toBeUndefined();
  });
});

describe('legacy, rivalry, objectives, season report', () => {
  it('season rollover appends a SeasonReport from real data; timeline is ordered', () => {
    const s = newSave(world(), 'Hero', false, 1200);
    const before = s.world.season;
    const opp = opponentNear(s, 1200);
    play(s, opp, 1);
    play(s, opp, 0.5);
    const days = 28 - (s.world.day % 28);
    restDays(s, days + 1);
    expect(s.world.season).toBeGreaterThan(before);
    const reps = s.player.seasonReports!;
    expect(reps.length).toBe(1);
    expect(reps[0].season).toBe(before);
    expect(reps[0].games).toBe(2);
    expect([reps[0].w, reps[0].d, reps[0].l]).toEqual([1, 1, 0]);
    expect(reps[0].bestWin?.oppId).toBe(opp.id);
    expect(reps[0].ratingEnd).toBe(careerRating(s).rating);
    const tl = legacyTimeline(s);
    expect(tl[0].kind).toBe('enlisted');
    for (let i = 1; i < tl.length; i++) expect(tl[i].day).toBeGreaterThanOrEqual(tl[i - 1].day);
    expect(tl.some((e) => e.kind === 'season')).toBe(true);
    expect(tl.some((e) => e.kind === 'achievement')).toBe(true);
  });

  it('objectives are never empty and have exactly one primary', () => {
    const s = newSave(world(), 'Hero', false, 800);
    for (let i = 0; i < 6; i++) {
      const o = objectives(s);
      expect(o.length).toBeGreaterThan(0);
      expect(o.filter((x) => x.primary).length).toBe(1);
      expect(o[0].primary).toBe(true);
      play(s, opponentNear(s, careerRating(s).rating), i % 2);
    }
  });

  it('rivalry model and rival preparation against the player\'s tendencies', () => {
    const s = newSave(world(), 'Hero', false, 1400);
    const opp = opponentNear(s, 1400);
    play(s, opp, 1, { opening: { eco: 'C50', name: 'Italian Game' } });
    expect(rivalPrep(s, opp.id).avoidLines ?? []).toEqual(opp.rank >= 48 ? ['Italian Game'] : []);
    play(s, opp, 1, { opening: { eco: 'C50', name: 'Italian Game' } });
    play(s, opp, 0, { opening: { eco: 'B20', name: 'Sicilian Defence' } });
    play(s, opp, 0, { opening: { eco: 'B20', name: 'Sicilian Defence' } });
    const r = s.player.rivals![opp.id];
    expect([r.w, r.d, r.l]).toEqual([2, 0, 2]);
    expect(r.games.length).toBe(4);
    expect(r.lastOpening).toBe('Sicilian Defence');
    const prep = rivalPrep(s, opp.id);
    expect(prep.avoidLines).toContain('Italian Game');
    expect(prep.preferLines).toContain('Sicilian Defence');
    expect(s.player.rivalId).toBe(opp.id);
    expect(rivalries(s)[0].id).toBe(opp.id);
    expect(rivalPrep(s, 'nobody')).toEqual({});
  });

  it('save JSON round-trip and v0.1 save migration', () => {
    const s = newSave(world(), 'Hero', false, 1200);
    for (let i = 0; i < 3; i++) play(s, opponentNear(s, 1200), 1);
    const json = JSON.stringify(s);
    const back = JSON.parse(json) as Save;
    ensureSaveV2(back);
    expect(JSON.stringify(back)).toBe(json);
    expect(objectives(back).length).toBeGreaterThan(0);
    // Simulate a v0.1 save: none of the v0.2 fields.
    const old = JSON.parse(json) as Save;
    delete old.player.ledger;
    delete old.player.rivals;
    delete old.player.timeline;
    delete old.player.seasonReports;
    delete old.world.awards;
    delete old.world.hall;
    delete old.world.seasonTally;
    delete old.world.worldVersion;
    ensureSaveV2(old);
    expect(old.player.rivals![Object.keys(old.player.h2h)[0]]).toBeTruthy();
    expect(old.player.timeline![0].kind).toBe('enlisted');
    expect(Object.keys(old.player.achievements)).toEqual(Object.keys(s.player.achievements));
    play(old, opponentNear(old, 1200), 1); // keeps working
    expect(checkAchievements(old, null)).toEqual(checkAchievements(old, null));
  });

  it('winning a tournament presents a trophy, influence and timeline entry exactly once', () => {
    const s = newSave(world(), 'Hero', false, 800);
    const arena = RANKS[s.player.rank].arena;
    const t = s.world.tournaments.find((x) => x.status === 'scheduled' && x.kind === 'open' && x.arena === arena)!;
    expect(acceptTournament(s, t.id)).toBe(true);
    restDays(s, t.startDay - s.world.day + 1);
    for (let i = 0; i < 40 && t.status !== 'complete'; i++) {
      const pt = playerTournamentGame(s);
      if (!pt) { restDays(s, 1); continue; }
      const rec = startGame(s, pt.opp!, { kind: 'tournament', tcId: 'rapid-10', color: pt.color, tournamentId: pt.t.id, pairingId: pt.pairingId });
      rec.result = pt.color === 'w' ? '1-0' : '0-1';
      rec.termination = 'resignation';
      s.active = null;
      finishPlayerGame(s, rec);
    }
    const mine = awardsFor(s.world, 'player').filter((a) => a.tournamentId === t.id);
    expect(mine.length).toBeGreaterThanOrEqual(1);
    expect(mine[0].defId).toBe('cup-open-t0');
    expect(mine[0].gameIds.length).toBe(t.state!.rounds.length);
    expect(mine[0].unbeaten).toBe(true);
    expect(s.player.achievements['open-champion']).toBeDefined();
    expect(s.player.achievements['unbroken-laurel']).toBeDefined();
    expect(legacyTimeline(s).filter((e) => e.kind === 'trophy' && e.ref === mine[0].awardId).length).toBe(1);
    expect(playerTrophies(s)[0].awardId).toBe(mine[mine.length - 1].awardId);
    expect(championshipPrivileges(s).autoSeeded).toBe(false);
    expect(hostCostFor(s)).toBeGreaterThan(0);
  });

  it('always offers a meaningful competition when the player has no entry this season', () => {
    const s = newSave(world(), 'Hero', false, 800);
    for (let i = 0; i < 5; i++) {
      s.world.invitations = [];
      refreshInvitations(s);
      const entered = s.world.tournaments.some((t) => t.playerEntered && t.season === s.world.season);
      const upcoming = s.world.tournaments.some((t) => t.status === 'scheduled' && t.arena === RANKS[s.player.rank].arena && t.kind !== 'championship' && t.startDay >= s.world.day);
      if (!entered && upcoming) expect(s.world.invitations.some((x) => x.tournamentId)).toBe(true);
      for (const inv of s.world.invitations) expect(inv.context).toBeTruthy();
      restDays(s, 3);
    }
  });
});
