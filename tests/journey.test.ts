import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { makeJourneySave, runJourney, risingSkill, type JourneyLog } from './helpers/journey';
import { RANKS, ARENAS, RANK_COUNT, ARENA_COUNT, naturalRank, TOP_ARENA } from '../src/world/arenas';
import { PLAYER_ID, ELITE_ARENA_MIN } from '../src/world/calendar';
import { awardsFor, isVictory, TROPHY_BY_ID } from '../src/world/trophies';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, achievementProgress } from '../src/game/achievements';
import { computeCareerStats } from '../src/game/careerStats';
import { ensureSaveV2, objectives } from '../src/game/legacy';
import {
  syncCareer, careerRating, PLACEMENT_GAMES, PLACEMENT_MAX_RANK, placementPerformance, careerMilestones, startGame, finishPlayerGame, suggestOpponents, bestRating,
} from '../src/game/career';
import { CLOCKS_ENABLED, UNTIMED_TC, type Save, type GameRecord } from '../src/game/state';
import { persistSave, loadSave, resetPersistState, whenSaved } from '../src/persist/save';
import { resetDbHandle } from '../src/persist/db';
import { canonicalJson } from '../src/persist/layout';
import { activeInArena } from '../src/world/indexes';
import { simulateGame } from '../src/world/sim';
import { createRng, mixSeed } from '../src/core/rng';
import type { Competitor } from '../src/world/types';

/**
 * v0.4 zero-to-emperor acceptance scenario (GLADIUS v0.4 §1/§6/§8).
 *
 * A fresh career is driven through the real career API with a deterministic
 * player whose strength rises from a beginner's ≈ 450 to 3,300 over ~900 games;
 * every result comes from the world's calibrated outcome model (`simulateGame`),
 * never forced. The world is reduced to 8,000 competitors to keep the run
 * under a minute; tests/soak/journey.soak.ts runs the same scenario in the full
 * 25,000-competitor empire (`npm run soak`).
 */
const SEED = 777;
const POP = 8000;
const BURN_IN = 4;
const opts = { seed: SEED, population: POP, burnInSeasons: BURN_IN, skill: risingSkill(900), maxGames: 1600, emperorDefences: 1 };

let fresh: Save;
let freshCopy: string;
let log: JourneyLog;
const perGame: string[] = [];

beforeAll(() => {
  fresh = makeJourneySave(opts);
  freshCopy = JSON.stringify({ player: fresh.player, active: fresh.active, library: fresh.library });
  const s = makeJourneySave(opts);
  log = runJourney(s, {
    ...opts,
    onGame: (x, rec, before) => {
      // Records update exactly once per game; the empire moves on one day.
      const p = x.player;
      const bad: string[] = [];
      if (p.w + p.d + p.l !== before.w + before.d + before.l + 1) bad.push('W/D/L');
      if (p.ratedGames !== before.ratedGames + 1) bad.push('ratedGames');
      if (p.ratingHistory.length !== Math.min(2000, before.histLen + 1)) bad.push('ratingHistory');
      if (rec.eloDelta !== careerRating(x).rating - before.rating) bad.push('eloDelta');
      if (x.world.day < before.day + 1) bad.push('day');
      // After placement, at most one grade up per rated game.
      if (p.placement?.done && p.placement.done.day !== x.world.day - 1 && p.rank > before.rank + 1) bad.push(`rank jump ${before.rank}->${p.rank}`);
      if (rec.tc !== UNTIMED_TC || (rec.clocks ?? []).length) bad.push('clock');
      if (bad.length) perGame.push(`game ${p.ratedGames}: ${bad.join(', ')}`);
    },
  });
}, 300_000);

describe('a fresh career starts from zero', () => {
  it('has no earned honours, records, history or fabricated peak', () => {
    const p = fresh.player;
    expect(p.rank).toBe(0);
    expect(RANKS[p.rank].arena).toBe(0);
    expect(RANKS[p.rank].name).toBe('Tiro III');
    expect([p.w, p.d, p.l, p.ratedGames]).toEqual([0, 0, 0, 0]);
    expect(p.influence).toBe(0);
    expect(p.prestige).toBe(0);
    expect(p.tournamentsPlayed + p.tournamentsWon + p.championships).toBe(0);
    expect(p.titles).toEqual([]);
    expect(p.achievements).toEqual({});
    expect(p.rivalId).toBe(null);
    expect(p.rivals).toEqual({});
    expect(p.h2h).toEqual({});
    expect(p.openingsPlayed).toEqual({});
    expect(fresh.library).toEqual([]);
    expect(p.seasonReports).toEqual([]);
    // Unrated: a provisional seed only — no rating history and no peak before a rated game.
    expect(p.ratingHistory).toEqual([]);
    for (const r of Object.values(p.ratings)) expect([r.games, r.peak]).toEqual([0, 0]);
    expect(bestRating(fresh)).toBe(0);
    expect(p.placement).toEqual({ games: 0, score: 0, opp: [] });
    expect(p.timeline!.map((e) => e.kind)).toEqual(['enlisted']);
    expect(p.rankHistory).toEqual([{ day: fresh.world.day, rank: 0, reason: 'Enlisted' }]);
    // Only the recruit's own board & pieces (the Dust Pits collection).
    expect(p.unlockedSets).toEqual([0]);
    // The empire holds nothing of the player's.
    const w = fresh.world;
    expect(awardsFor(w, PLAYER_ID)).toEqual([]);
    expect(w.titles.some((t) => t.holder === PLAYER_ID)).toBe(false);
    expect(w.regionTitles!.some((t) => t.holder === PLAYER_ID)).toBe(false);
    expect(w.reigns.some((r) => r.holder === PLAYER_ID)).toBe(false);
    expect((w.feuds ?? []).some((f) => f.a === PLAYER_ID || f.b === PLAYER_ID)).toBe(false);
    expect(w.history.some((h) => h.playerPlace !== undefined)).toBe(false);
    expect(w.chronicle.some((e) => e.ids?.includes(PLAYER_ID))).toBe(false);
    // Existing is not an achievement; the season tracker has no peak either.
    expect(syncCareer(fresh)).toEqual([]);
    expect(fresh.player.achievements).toEqual({});
    expect(fresh.player.ledger!.season!.peak).toBe(0);
    expect(achievementProgress(fresh).filter((a) => a.unlockedDay !== null)).toEqual([]);
    // The first goal is the placement; milestones are all open.
    expect(objectives(fresh)[0].id).toBe('placement');
    expect(careerMilestones(fresh).every((m) => !m.done)).toBe(true);
    expect(JSON.stringify({ player: fresh.player, active: fresh.active, library: fresh.library })).toBe(freshCopy);
  });
  it('no human clock exists: every game is untimed', () => {
    expect(CLOCKS_ENABLED).toBe(false);
    for (const g of log.records) {
      expect(g.tc).toBe(UNTIMED_TC);
      expect(g.rated).toBe(true);
    }
  });
});

describe('zero to emperor through the real rules', () => {
  it('reaches the Eternal Throne, wins it and defends it', () => {
    const p = log.save.player;
    console.log(`journey: ${log.records.length} games, ${log.steps} steps, ${Math.round(log.ms)} ms, emperor on day ${log.emperorDay}, ${log.entries.length} events entered, ${p.tournamentsWon} won, ${p.championships} championships, ${Object.keys(p.achievements).length} achievements`);
    expect(perGame).toEqual([]);
    expect(p.titles).toContain(`title-${TOP_ARENA}`);
    const reign = log.save.world.reigns.find((r) => r.titleId === `title-${TOP_ARENA}` && r.holder === PLAYER_ID && r.to === null)!;
    expect(reign.defenses).toBeGreaterThanOrEqual(1);
    const aw = awardsFor(log.save.world, PLAYER_ID);
    expect(aw.some((a) => a.defId.startsWith('defense-') && a.arena === TOP_ARENA)).toBe(true);
    expect(aw.some((a) => a.series === `title-${TOP_ARENA}` && isVictory(a))).toBe(true);
    expect(p.championships).toBe(log.save.world.reigns.filter((r) => r.holder === PLAYER_ID).length);
    expect(p.peakRank).toBe(RANK_COUNT - 1);
  });

  it('placement establishes the rating and the first grade', () => {
    const pl = log.save.player.placement!;
    expect(pl.done).toBeTruthy();
    expect(pl.games).toBe(PLACEMENT_GAMES);
    expect(pl.opp.length).toBe(PLACEMENT_GAMES);
    const perf = placementPerformance(pl.opp, pl.score);
    expect(pl.done!.performance).toBe(perf);
    expect(pl.done!.rank).toBe(Math.min(naturalRank(Math.max(100, perf)), PLACEMENT_MAX_RANK));
    // The rank waited for the verdict: grade 1 during the placement games.
    expect(log.rankTrail.slice(0, PLACEMENT_GAMES).every((r) => r === 0)).toBe(true);
    expect(log.rankTrail[PLACEMENT_GAMES]).toBe(pl.done!.rank);
    // The verdict's rating is the rating after game 10.
    expect(log.records[PLACEMENT_GAMES - 1].eloDelta).toBeDefined();
  });

  it('visits all 24 arenas in order and all 72 grades', () => {
    const arenas: number[] = [];
    for (const r of log.firstVisits) if (!arenas.includes(RANKS[r].arena)) arenas.push(RANKS[r].arena);
    expect(arenas).toEqual(Array.from({ length: ARENA_COUNT }, (_, i) => i));
    expect(new Set(log.firstVisits).size).toBe(RANK_COUNT);
    // Above the placement grade, grades are first reached strictly in order (one grade per game at most).
    const placed = log.save.player.placement!.done!.rank;
    const after = log.firstVisits.filter((r) => r > placed);
    expect(after).toEqual(Array.from({ length: RANK_COUNT - 1 - placed }, (_, i) => placed + 1 + i));
    // Grades below the placement verdict (skippable by placement) are reachable: held by AI competitors.
    for (let g = 0; g < placed; g++) expect(log.save.world.competitors.some((c) => c.retiredDay === null && c.rank === g)).toBe(true);
    // Every arena was entered by a real promotion: a won trial, a dominance promotion or the placement verdict.
    const entries = log.save.player.rankHistory.filter((h, i, a) => i > 0 && RANKS[h.rank].arena > RANKS[a[i - 1].rank].arena);
    for (const e of entries) expect(['Won promotion trial', 'Dominance promotion', 'Placement', 'Promotion']).toContain(e.reason);
    expect(log.save.player.ledger!.c.trialsWon ?? 0).toBeGreaterThan(0);
  });

  it('tournament entries follow the qualification rules', () => {
    const s = log.save;
    expect(log.entries.length).toBeGreaterThan(20);
    const kinds = new Set(log.entries.map((e) => e.kind));
    for (const k of ['open', 'local-open', 'championship']) expect(kinds.has(k)).toBe(true);
    for (const e of log.entries) {
      const where = `${e.kind} ${e.tournamentId} (${e.context}) arena ${e.arena}, player arena ${e.playerArena}`;
      if (['open', 'league', 'cup', 'gauntlet', 'invitational', 'qualifier'].includes(e.kind) && e.context !== 'qualified') expect(e.arena, where).toBe(e.playerArena);
      if (e.kind === 'championship' && e.context === 'title-challenge') expect(e.arena, where).toBe(e.playerArena);
      if (e.kind === 'local-open') {
        expect(e.region, where).toBe(e.playerRegion);
        expect(e.playerArena <= 7 ? 'lower' : 'upper', where).toBe(e.arena <= 7 ? 'lower' : 'upper');
        expect(e.playerArena, where).toBeLessThanOrEqual(15);
      }
      if (e.kind === 'regional' || e.kind === 'regional-defense') expect(e.region, where).toBe(e.playerRegion);
      if (e.kind === 'elite') expect(e.playerArena >= ELITE_ARENA_MIN || s.world.titles.some((t) => t.holder === PLAYER_ID && t.arena >= 20), where).toBe(true);
      if (e.kind === 'qualifier') expect(['qualifier'], where).toContain(e.context);
    }
  });

  it('trophies are awarded exactly once and only for real wins', () => {
    const s = log.save;
    const aw = awardsFor(s.world, PLAYER_ID);
    expect(new Set(aw.map((a) => a.awardId)).size).toBe(aw.length);
    const fin = new Map(log.finished.map((f) => [f.id, f]));
    const victories = aw.filter(isVictory);
    expect(victories.length).toBe(s.player.tournamentsWon);
    expect(s.player.tournamentsWon).toBe(log.finished.filter((f) => f.place === 1).length);
    expect(s.player.tournamentsPlayed).toBe(log.finished.length);
    for (const a of victories) {
      const f = fin.get(a.tournamentId);
      expect(f, a.awardId).toBeDefined();
      expect(f!.winner).toBe(PLAYER_ID);
      expect(a.gameIds.every((id) => log.records.some((r) => r.id === id))).toBe(true);
    }
    // One victory award per won event.
    const perEvent = new Map<string, number>();
    for (const a of victories) perEvent.set(a.tournamentId, (perEvent.get(a.tournamentId) ?? 0) + 1);
    for (const n of perEvent.values()) expect(n).toBe(1);
    // Finalist medals only for real runners-up; defences only for won title matches.
    for (const a of aw) {
      const def = TROPHY_BY_ID[a.defId];
      const f = fin.get(a.tournamentId);
      if (def?.category === 'medal') expect(f?.runnerUp).toBe(PLAYER_ID);
      if (def?.category === 'defense') expect(f?.winner).toBe(PLAYER_ID);
    }
  });

  it('achievements come only from real events and agree with the state', () => {
    const s = log.save;
    const p = s.player;
    expect(Object.keys(p.achievements).length).toBeGreaterThan(30);
    // Nothing needs analysis here: no analysis-gated achievement may unlock.
    for (const id of Object.keys(p.achievements)) expect(ACHIEVEMENT_BY_ID[id].analysis ?? false, id).toBe(false);
    // Unlocked ⇔ metric ≥ target (for the metrics that can only grow).
    const volatile = new Set(['influence-100', 'chronicled', 'hall-of-records', 'immortal-peak', 'blood-feud', 'rival']);
    const prog = new Map(achievementProgress(s).map((a) => [a.def.id, a]));
    for (const a of ACHIEVEMENTS) {
      if (volatile.has(a.id) || a.analysis) continue;
      const x = prog.get(a.id)!;
      const metric = a.metric({ s, L: p.ledger!, aw: awardsFor(s.world, PLAYER_ID) });
      expect(p.achievements[a.id] !== undefined, `${a.id}: metric ${metric} / ${a.target}`).toBe(metric >= a.target);
      expect(x.unlockedDay !== null).toBe(p.achievements[a.id] !== undefined);
    }
    // Unlock moments match the events that earned them.
    const firstWin = log.records.findIndex((g) => g.result === (g.playerColor === 'w' ? '1-0' : '0-1')) + 1;
    expect(log.unlocks['first-blood'].games).toBe(firstWin);
    // (Achievements are evaluated after the game's day has passed: unlock day = event day or the next.)
    const firstTrophy = log.finished.filter((f) => f.place === 1).sort((a, b) => a.endDay - b.endDay)[0];
    expect(log.unlocks['first-trophy'].day - firstTrophy.endDay).toBeGreaterThanOrEqual(0);
    expect(log.unlocks['first-trophy'].day - firstTrophy.endDay).toBeLessThanOrEqual(1);
    const reached = (arena: number) => log.rankTrail.findIndex((r) => RANKS[r].arena >= arena);
    expect(log.unlocks['arena-1'].games).toBe(reached(2));
    expect(log.unlocks['arena-11'].games).toBe(reached(TOP_ARENA));
    expect(log.unlocks['proven-in-trial'].games).toBe(log.records.findIndex((g) => g.kind === 'trial' && g.result === (g.playerColor === 'w' ? '1-0' : '0-1')) + 1);
    for (const [id, u] of Object.entries(log.unlocks)) expect(p.timeline!.some((e) => e.kind === 'achievement' && e.ref === id && e.day === u.day), id).toBe(true);
  });

  it('profile statistics derived from the stored game records match the career record', () => {
    const p = log.save.player;
    const st = computeCareerStats(log.records);
    expect(st.games).toBe(log.records.length);
    expect([st.overall.w, st.overall.d, st.overall.l]).toEqual([p.w, p.d, p.l]);
    expect(st.asWhite.games + st.asBlack.games).toBe(p.w + p.d + p.l);
    expect(p.ratedGames).toBe(log.records.length);
    // Peak and history reflect rated games only.
    const pool = log.save.player.ratings[log.save.settings.careerPool];
    // (the peak starts at the placement verdict: provisional ratings before it depend on the seed)
    expect(pool.peak).toBe(Math.max(...p.ratingHistory.slice(PLACEMENT_GAMES - 1).map((h) => h.rating)));
    expect(p.ratingHistory.length).toBe(Math.min(2000, log.records.length));
  });

  it('early-career milestones are all completed by real events', () => {
    const ms = careerMilestones(log.save);
    expect(ms.map((m) => m.id)).toEqual(['placement', 'first-win', 'first-promotion', 'first-tournament', 'first-regional', 'first-trial', 'first-trophy', 'first-arena']);
    expect(ms.filter((m) => !m.done)).toEqual([]);
  });

  it('the save survives persist / reload', async () => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetDbHandle();
    resetPersistState();
    await persistSave(log.save);
    await whenSaved();
    resetDbHandle();
    resetPersistState();
    const r = await loadSave();
    expect(r.recovered).toBe(false);
    expect(canonicalJson(r.save)).toBe(canonicalJson(log.save));
    expect(r.save!.player.placement).toEqual(log.save.player.placement);
  }, 120_000);
});

describe('a strong newcomer is placed, not ground down', () => {
  it('placement lifts several grades at once; then one grade per game', () => {
    const s = makeJourneySave({ seed: 4242, population: 3000, burnInSeasons: 1, startRating: 1500 });
    const me = { skill: 1600 } as Competitor;
    const trail: number[] = [];
    for (let i = 0; i < 40; i++) {
      const opp = suggestOpponents(s, i)[0].c;
      const rec = startGame(s, opp, { kind: 'ranked', tcId: UNTIMED_TC });
      const rng = createRng(mixSeed(4242, 'strong', i));
      const score = simulateGame(me, opp, rng);
      rec.result = score === 0.5 ? '1/2-1/2' : (score === 1) === (rec.playerColor === 'w') ? '1-0' : '0-1';
      rec.termination = score === 0.5 ? 'agreement' : 'resignation';
      s.active = null;
      finishPlayerGame(s, rec as GameRecord);
      trail.push(s.player.rank);
    }
    const done = s.player.placement!.done!;
    expect(trail.slice(0, PLACEMENT_GAMES - 1).every((r) => r === 0)).toBe(true);
    expect(done.rank).toBeGreaterThan(6); // several grades at once
    expect(done.rank).toBeLessThanOrEqual(PLACEMENT_MAX_RANK);
    for (let i = PLACEMENT_GAMES; i < trail.length; i++) expect(trail[i] - trail[i - 1]).toBeLessThanOrEqual(1);
    expect(trail[trail.length - 1]).toBeGreaterThan(done.rank); // keeps climbing after placement
    // The grades the verdict skipped are reachable (held by AI competitors).
    for (let g = 1; g < done.rank; g++) expect(s.world.competitors.some((c) => c.retiredDay === null && c.rank === g), `grade ${g}`).toBe(true);
    expect(activeInArena(s.world, 0).length).toBeGreaterThan(0);
    expect(ARENAS[RANKS[done.rank].arena].floor).toBeLessThanOrEqual(careerRating(s).rating + 200);
  }, 120_000);
});

describe('older saves keep their rules', () => {
  it('a v0.2 save migrates untouched (no placement, peaks and history kept) and plays on', () => {
    const load = (): Save => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v02-save.json.gz', import.meta.url))).toString('utf8'));
    const old = load();
    const s = ensureSaveV2(load());
    expect(s.player.placement).toBeUndefined();
    expect(s.player.ratingHistory.length).toBe(old.player.ratingHistory.length);
    for (const k of Object.keys(old.player.ratings) as (keyof typeof old.player.ratings)[]) expect(s.player.ratings[k]).toEqual(old.player.ratings[k]);
    expect(s.player.achievements).toEqual(old.player.achievements);
    const before = s.player.w + s.player.d + s.player.l;
    for (let i = 0; i < 3; i++) {
      const opp = suggestOpponents(s, i)[0].c;
      const rec = startGame(s, opp, { kind: 'ranked', tcId: UNTIMED_TC });
      rec.result = '1/2-1/2';
      rec.termination = 'agreement';
      s.active = null;
      finishPlayerGame(s, rec);
    }
    expect(s.player.w + s.player.d + s.player.l).toBe(before + 3);
    expect(s.player.placement).toBeUndefined();
    expect(s.world.arenaLayout).toBe(24);
  }, 120_000);
});
