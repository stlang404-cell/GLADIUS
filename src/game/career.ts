import { createRng, mixSeed, clamp } from '../core/rng';
import { applyResult, isProvisional, previewStakes, DEFAULT_RATING, RATING_FLOOR, POOLS, type TimeControlPool, type RatingState } from '../rating/elo';
import { ARENAS, RANKS, decideRank, naturalRank, TOP_ARENA } from '../world/arenas';
import { DAYS_PER_SEASON, type Competitor } from '../world/types';
import { recordCompetitorResult, pushChronicle } from '../world/sim';
import {
  PLAYER_ID, advanceDay, recordPlayerTournamentGame, playerPairing, withdrawPlayer, regionTitle, topByStanding, standingKey,
  ELITE_ARENA_MIN, type PlayerHooks,
} from '../world/calendar';
import { activeInArena, activeInRatingRange, activeByRating, getCompetitor, regionBand } from '../world/indexes';
import { REGION_BY_ID, isRegionId, type RegionId } from '../world/regions';
import { feudsOf } from '../world/rivalry';
import {
  DEFAULT_SETTINGS, SAVE_SCHEMA, TIME_CONTROLS, CLOCKS_ENABLED, UNTIMED_TC,
  type Save, type PlayerState, type GameRecord, type GameKind, type Invitation, type WorldState, type WorldTournament, type Side,
} from './state';
import * as INF from './influence';
import { checkAchievements } from './achievements';
import { PLACEMENT_GAMES, PLACEMENT_MAX_RANK, placementPerformance } from './placement';
import type { ResultCode } from '../chess/rules';
import type { AwardRecord } from '../world/types';
import { TROPHY_BY_ID, awardsFor, trophyPrestige } from '../world/trophies';
import { competitorPrestige } from '../world/records';
import { ensureLedger, ledgerRecordGame, inc, isEligible, newLedger } from './ledger';
import {
  ensureSaveV2, pushTimeline, updateRivalry, rivalSignificance, trackSeasonGame, closeSeason, hostCostFor, championshipPrivileges,
} from './legacy';
import type { SeasonReport } from './state';

export { PLACEMENT_GAMES, PLACEMENT_MAX_RANK, placementPerformance, placementStatus, careerMilestones } from './placement';

export function newPlayer(name: string, female: boolean, day: number, startRating = DEFAULT_RATING): PlayerState {
  const ratings = {} as Record<TimeControlPool, RatingState>;
  // Unrated: the start rating is only a provisional seed for matchmaking; no peak before a rated game (v0.4).
  for (const p of POOLS) ratings[p] = { rating: startRating, games: 0, peak: 0 };
  const rank = 0; // everyone enlists as Tiro III; the placement verdict may lift you several grades at once
  return {
    name, female, portraitSeed: mixSeed(name, day), createdDay: day, ratings, rank, peakRank: rank,
    rankHistory: [{ day, rank, reason: 'Enlisted' }], trial: null, influence: 0, prestige: 0,
    w: 0, d: 0, l: 0, ratedGames: 0, tournamentsPlayed: 0, tournamentsWon: 0, championships: 0, titles: [],
    // unlockedSets [0]: the Dust Pits' own board and pieces are the equipment every recruit plays with (not an honour).
    achievements: {}, unlockedSets: [0], h2h: {}, rivalId: null, ratingHistory: [],
    openingsPlayed: {}, streak: 0, bestWinRating: 0,
    ledger: newLedger(day), rivals: {}, seasonReports: [], rankLayout: 24,
    timeline: [{ day, kind: 'enlisted', text: `Enlisted as ${RANKS[rank].name} in ${ARENAS[0].name}.` }],
    placement: { games: 0, score: 0, opp: [] },
  };
}

export function newSave(world: WorldState, name: string, female: boolean, startRating = DEFAULT_RATING): Save {
  const now = new Date().toISOString();
  const s: Save = {
    schema: SAVE_SCHEMA, createdAt: now, updatedAt: now, seed: world.seed,
    player: newPlayer(name, female, world.day, startRating), world, settings: { ...DEFAULT_SETTINGS, pieceStyle: 'classical' }, // new careers start on the primary Legio set; older saves keep their choice
    active: null, library: [], libraryMeta: {}, coach: { positions: [] },
  };
  return ensureSaveV2(s);
}

export function careerRating(s: Save): RatingState {
  return s.player.ratings[s.settings.careerPool];
}

export function playerArena(s: Save): number {
  return RANKS[s.player.rank].arena;
}

/** The player's home region (v0.3; default Latium). */
export function playerRegion(s: Save): RegionId {
  return isRegionId(s.player.region) ? s.player.region : 'latium';
}
/**
 * Choose the player's home region. Allowed until the player has entered a
 * regional event or holds a regional crown (a career belongs to one region).
 * Returns false when not allowed.
 */
export function setPlayerRegion(s: Save, region: RegionId): boolean {
  if (!isRegionId(region)) return false;
  const w = s.world;
  const committed = w.tournaments.some((t) => t.playerEntered && (t.kind === 'local-open' || t.kind === 'regional' || t.kind === 'regional-defense'))
    || w.history.some((h) => h.playerPlace !== undefined && (h.kind === 'local-open' || h.kind === 'regional' || h.kind === 'regional-defense'))
    || (w.regionTitles ?? []).some((t) => t.holder === PLAYER_ID);
  if (committed && region !== playerRegion(s)) return false;
  s.player.region = region;
  return true;
}

export function hooksFor(s: Save, events: string[] = [], awards?: AwardRecord[]): PlayerHooks {
  return {
    playerRating: () => careerRating(s).rating,
    playerArena: () => playerArena(s),
    playerRegion: () => playerRegion(s),
    playerName: s.player.name,
    onPlayerRegionalTitle: (titleId, gained) => {
      const title = s.world.regionTitles?.find((t) => t.id === titleId);
      if (gained) {
        events.push(`👑 You are crowned: ${title?.name}!`);
        pushTimeline(s, { day: s.world.day, kind: 'title-won', text: `Won the ${title?.name}`, ref: titleId });
      } else {
        events.push(`Your regional crown was lost: ${title?.name}`);
        pushTimeline(s, { day: s.world.day, kind: 'title-lost', text: `Lost the ${title?.name}`, ref: titleId });
      }
    },
    onPlayerQualified: (target, via) => {
      events.push(`Qualified: your ${via.name} victory earns a place in the ${target.name}.`);
    },
    onPlayerTournamentEnd: (t, place) => {
      const p = s.player;
      p.tournamentsPlayed++;
      let gain = 0;
      if (place === 1) {
        p.tournamentsWon++;
        gain = t.prize;
        events.push(`🏆 You won the ${t.name}!`);
      } else if (place === 2) gain = Math.round(t.prize / 2);
      else if (place <= 4) gain = Math.round(t.prize / 4);
      if (gain) gainInfluence(s, gain);
      if (place > 1) events.push(`${t.name}: finished #${place}`);
      if (place <= 3) inc(ensureLedger(p, s.world.day), 'podiums');
      // Collections unlock with arena-circuit victories (regional / imperial events have no arena collection of their own).
      if (place === 1 && (!t.region || t.region === 'imperial') && t.kind !== 'elite' && t.kind !== 'qualifier') unlockSet(s, t.arena, events);
    },
    onPlayerAward: (a) => {
      const def = TROPHY_BY_ID[a.defId];
      const gain = INF.trophyInfluence(a.defId, a.arena);
      if (gain) gainInfluence(s, gain);
      awards?.push(a);
      if (def && def.category !== 'medal' && def.category !== 'cup' && def.category !== 'regional' && def.category !== 'elite') events.push(`🏅 ${def.name}${gain ? ` (+${gain} Influence)` : ''}`);
      pushTimeline(s, { day: a.day, kind: 'trophy', text: `${def?.name ?? a.defId}${a.result ? ` · ${a.result}` : ''}${a.finalOpponentName && def?.category !== 'distinction' ? ` vs ${a.finalOpponentName}` : ''}`, ref: a.awardId, arena: a.arena });
    },
    onPlayerTitle: (titleId, gained) => {
      const p = s.player;
      const title = s.world.titles.find((t) => t.id === titleId);
      if (gained) {
        p.titles.push(titleId);
        p.championships++;
        events.push(`👑 You are now ${title?.name}!`);
        pushTimeline(s, { day: s.world.day, kind: 'title-won', text: `Became ${title?.name}`, ref: titleId, arena: title?.arena });
      } else {
        p.titles = p.titles.filter((x) => x !== titleId);
        events.push(`Your title was lost: ${title?.name}`);
        pushTimeline(s, { day: s.world.day, kind: 'title-lost', text: `Lost the title ${title?.name}`, ref: titleId, arena: title?.arena });
      }
    },
  };
}

export function gainInfluence(s: Save, n: number) {
  s.player.influence += n;
  s.player.prestige += n;
}

function unlockSet(s: Save, arena: number, events: string[]) {
  if (!s.player.unlockedSets.includes(arena)) {
    s.player.unlockedSets.push(arena);
    s.player.unlockedSets.sort((a, b) => a - b);
    events.push(`New board & pieces unlocked: ${ARENAS[arena].name}`);
  }
}

// ---------------------------------------------------------------- matchmaking

export function activeById(s: Save): Map<string, Competitor> {
  const out = new Map<string, Competitor>();
  for (const c of activeByRating(s.world)) out.set(c.id, c);
  return out;
}

export type Suggestion = { c: Competitor; label: string; stakes: ReturnType<typeof previewStakes> };

/**
 * Skill-based matchmaking: choose from active competitors near the player's
 * career rating, avoiding very recent opponents, preferring the player's arena.
 */
export function suggestOpponents(s: Save, seedSalt = 0): Suggestion[] {
  const r = careerRating(s);
  const rng = createRng(mixSeed(s.seed, 'mm', s.world.day, s.player.ratedGames, seedSalt));
  const recent = new Set(s.library.slice(-3).map((id) => s.libraryMeta[id]).filter(Boolean).map((m) => (m.playerColor === 'w' ? m.black : m.white)));
  const busy = new Set<string>();
  for (const t of s.world.tournaments) if (t.status === 'running' && t.state) for (const id of t.state.entrants) busy.add(id);
  const ok = (c: Competitor) => c.retiredDay === null && !busy.has(c.id) && !recent.has(c.name);
  // v0.3: rating-range lookups on the sorted index (O(log n + k)) instead of scanning 25,000 competitors.
  const near = (target: number, width: number) => {
    const cands = activeInRatingRange(s.world, target - width, target + width).filter(ok);
    if (cands.length) return rng.pick(cands);
    for (let wdt = width * 2; wdt <= 3200; wdt *= 2) {
      const wider = activeInRatingRange(s.world, target - wdt, target + wdt).filter(ok);
      if (wider.length) return wider.reduce((a, b) => (Math.abs(b.rating - target) < Math.abs(a.rating - target) ? b : a));
    }
    return activeByRating(s.world)[0];
  };
  const out: Suggestion[] = [];
  const add = (c: Competitor, label: string) => {
    if (!out.some((o) => o.c.id === c.id)) out.push({ c, label, stakes: previewStakes(r, c.rating) });
  };
  add(near(r.rating, 60), 'Even match');
  add(near(r.rating + 160, 60), 'Stronger challenge');
  add(near(r.rating - 140, 60), 'Warm-up');
  const rc = getCompetitor(s.world, s.player.rivalId);
  const rival = rc && ok(rc) ? rc : undefined;
  if (rival) add(rival, 'Your rival');
  return out;
}

export function sideFor(c: Competitor): Side {
  return { id: c.id, name: c.name, rating: c.rating, rank: c.rank, portraitSeed: c.portraitSeed, female: c.female };
}
export function playerSide(s: Save): Side {
  return { id: PLAYER_ID, name: s.player.name, rating: careerRating(s).rating, rank: s.player.rank, portraitSeed: s.player.portraitSeed, female: s.player.female };
}

let serial = 0;
export function newGameId(s: Save): string {
  return `g${s.world.day}-${Date.now().toString(36)}-${(serial++).toString(36)}`;
}

export type StartOpts = { kind: GameKind; tcId: string; color?: 'w' | 'b' | 'random'; rated?: boolean; tournamentId?: string; pairingId?: string; startFen?: string };

export function startGame(s: Save, opp: Competitor, o: StartOpts): GameRecord {
  // Untimed by default: unless clocks are explicitly enabled, every game has unlimited thinking time.
  const tc = CLOCKS_ENABLED ? (TIME_CONTROLS.find((t) => t.id === o.tcId) ?? TIME_CONTROLS[2]) : TIME_CONTROLS.find((t) => t.id === UNTIMED_TC)!;
  let color: 'w' | 'b';
  if (o.color === 'w' || o.color === 'b') color = o.color;
  else color = createRng(mixSeed(s.seed, 'color', s.player.ratedGames + s.library.length)).chance(0.5) ? 'w' : 'b';
  const rated = o.rated ?? (o.kind !== 'casual' && o.kind !== 'drill' && (CLOCKS_ENABLED ? tc.pool !== 'untimed' : true));
  // All rated games count toward the single career rating.
  const pool: TimeControlPool = rated ? (CLOCKS_ENABLED && o.kind !== 'tournament' && o.kind !== 'trial' ? tc.pool : s.settings.careerPool) : 'untimed';
  const me = playerSide(s);
  me.rating = s.player.ratings[pool].rating;
  const them = sideFor(opp);
  const rec: GameRecord = {
    id: newGameId(s), kind: o.kind, rated, pool, tc: tc.id, day: s.world.day, date: new Date().toISOString(),
    white: color === 'w' ? me : them, black: color === 'w' ? them : me, playerColor: color,
    startFen: o.startFen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [], san: [], clocks: [], result: '*', termination: 'ongoing', arena: RANKS[opp.rank].arena,
    tournamentId: o.tournamentId, pairingId: o.pairingId, source: 'player', arenaLayout: 24,
  };
  s.active = { record: rec, opponentId: opp.id, clockMs: { w: tc.baseSec * 1000, b: tc.baseSec * 1000 }, lastTick: Date.now() };
  return rec;
}

// ---------------------------------------------------------------- results

export type PostGame = {
  outcome: 'win' | 'draw' | 'loss';
  rated: boolean;
  pool: TimeControlPool;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  rankBefore: number;
  rankAfter: number;
  rankNote: string | null;
  influence: number;
  events: string[];
  achievements: string[];
  trialAvailable: boolean;
  /** v0.2: trophies presented to the player during this game's day. */
  trophies?: AwardRecord[];
  /** v0.2: set when this game closed a season (show the season-end ceremony). */
  seasonReport?: SeasonReport;
};

export function playerScore(result: ResultCode, color: 'w' | 'b'): number {
  if (result === '1/2-1/2') return 0.5;
  if (result === '1-0') return color === 'w' ? 1 : 0;
  if (result === '0-1') return color === 'b' ? 1 : 0;
  return 0.5;
}

export function finishPlayerGame(s: Save, rec: GameRecord): PostGame {
  ensureSaveV2(s);
  const p = s.player;
  const color = rec.playerColor!;
  const score = playerScore(rec.result, color);
  const opp = getCompetitor(s.world, color === 'w' ? rec.black.id : rec.white.id);
  const events: string[] = [];
  const pool = rec.pool;
  const before = p.ratings[pool];
  const rankBefore = p.rank;
  let delta = 0;
  let infl = 0;
  const outcome = score === 1 ? 'win' : score === 0 ? 'loss' : 'draw';
  const oppRating = color === 'w' ? rec.black.rating : rec.white.rating;
  const oppArena = opp ? RANKS[opp.rank].arena : rec.arena;
  // Context captured before this game changes anything (ledger / rivalry).
  const tKind = rec.tournamentId ? s.world.tournaments.find((t) => t.id === rec.tournamentId)?.kind : undefined;
  const prevRival = opp ? p.rivals?.[opp.id] : undefined;
  const h0 = opp ? p.h2h[opp.id] : undefined;
  const gctx = {
    score, oppId: opp?.id ?? null, lastVsOpp: prevRival?.games[prevRival.games.length - 1]?.result,
    oppWinsBefore: h0?.l ?? 0, playerWinsBefore: h0?.w ?? 0, isRival: !!opp && p.rivalId === opp.id,
    oppHoldsTitle: !!opp && opp.titles.length > 0, oppHoldsImperial: !!opp && opp.titles.includes(`title-${TOP_ARENA}`),
    oppChampionships: opp ? Math.max(opp.championships, awardsFor(s.world, opp.id).filter((a) => a.defId.startsWith('sig-')).length) : 0,
    tournamentKind: tKind,
  };
  if (rec.rated) {
    const after = applyResult(before, oppRating, score);
    delta = after.rating - before.rating;
    p.ratings[pool] = after;
    rec.eloDelta = delta;
    p.ratedGames++;
    p.ratingHistory.push({ day: s.world.day, pool, rating: after.rating });
    if (p.ratingHistory.length > 2000) p.ratingHistory.splice(0, p.ratingHistory.length - 2000);
    if (score === 1) infl += INF.winInfluence(oppArena, oppRating, before.rating);
    if (score === 0.5) infl += INF.drawInfluence(oppRating, before.rating);
    if (score === 1 && opp && p.rivalId === opp.id) {
      infl += 5;
      events.push(`Rivalry: you beat ${opp.name}.`);
    }
    if (score === 1) p.bestWinRating = Math.max(p.bestWinRating, oppRating);
    // The opponent's career is affected too (tournament games are rated via the calendar).
    if (opp && rec.kind !== 'tournament') recordCompetitorResult(opp, PLAYER_ID, before.rating, 1 - score);
  }
  if (score === 1) p.w++;
  else if (score === 0) p.l++;
  else p.d++;
  p.streak = score === 1 ? Math.max(1, p.streak + 1) : score === 0 ? Math.min(-1, p.streak - 1) : 0;
  if (opp) {
    const h = (p.h2h[opp.id] ??= { w: 0, d: 0, l: 0, lastDay: 0 });
    if (score === 1) h.w++;
    else if (score === 0) h.l++;
    else h.d++;
    h.lastDay = s.world.day;
    updateRivalry(s, rec, opp, score, tKind);
    updateRival(s, events);
    // Legitimate preparation: opponents remember the openings you play against them.
    if (rec.opening?.name) {
      opp.prep ??= { vsPlayerOpenings: [] };
      opp.prep.vsPlayerOpenings = [rec.opening.name, ...opp.prep.vsPlayerOpenings.filter((x) => x !== rec.opening!.name)].slice(0, 3);
    }
  }
  if (rec.opening?.name) {
    const o = (p.openingsPlayed[rec.opening.name] ??= { w: 0, d: 0, l: 0, color });
    if (score === 1) o.w++;
    else if (score === 0) o.l++;
    else o.d++;
  }
  if (infl) gainInfluence(s, infl);
  ledgerRecordGame(s, rec, gctx);
  trackSeasonGame(s, rec, score, opp?.id ?? null, opp?.name ?? '', oppRating);
  const L = ensureLedger(p, s.world.day);
  if (score === 1 && isEligible(rec) && (oppRating - before.rating >= 200 || gctx.oppHoldsTitle)) {
    pushTimeline(s, { day: s.world.day, kind: 'notable-win', text: `Defeated ${opp?.name ?? 'an opponent'} (${oppRating})${gctx.oppHoldsTitle ? ', a reigning champion' : ''}`, ref: rec.id });
  }
  {
    const est = Object.values(p.ratings).filter((r) => r.games >= 20).map((r) => r.peak);
    const peak = Math.max(0, ...est);
    const prev = L.peakEstablished;
    if (peak > prev) {
      L.peakEstablished = peak;
      const m = Math.floor(peak / 100) * 100;
      if (m >= 1000 && m > Math.floor(prev / 100) * 100) pushTimeline(s, { day: s.world.day, kind: 'rating-milestone', text: `Reached an established rating of ${m}`, ref: String(m) });
    }
  }

  // Trials and rank movement (career pool only).
  let rankNote: string | null = null;
  if (rec.kind === 'trial' && p.trial) {
    if (score === 1) {
      inc(L, 'trialsWon');
      setRank(s, p.trial.toRank, 'Won promotion trial');
      rankNote = `Promoted to ${RANKS[p.trial.toRank].name} — welcome to ${ARENAS[RANKS[p.trial.toRank].arena].name}!`;
      unlockSet(s, RANKS[p.trial.toRank].arena, events);
      p.trial = null;
    } else {
      p.trial.attempts++;
      p.trial.cooldownUntilGames = p.ratedGames + 2;
      rankNote = 'Trial failed. Two more rated games until you may try again.';
    }
  }
  const pl = p.placement;
  if (rec.rated && pool === s.settings.careerPool && pl && !pl.done) {
    // v0.4 placement: the rank waits for the verdict.
    pl.games++;
    pl.score += score;
    pl.opp.push(oppRating);
    if (pl.games < PLACEMENT_GAMES) {
      rankNote = `Placement game ${pl.games} of ${PLACEMENT_GAMES}`;
    } else {
      const perf = placementPerformance(pl.opp, pl.score);
      const cr = p.ratings[pool];
      const placed = Math.max(RATING_FLOOR, perf);
      // The peak starts at the verdict: provisional ratings during placement depend on the seed, not on results.
      p.ratings[pool] = { ...cr, rating: placed, peak: placed };
      if (L.season) L.season.peak = Math.max(L.season.peak, placed);
      delta = placed - before.rating;
      rec.eloDelta = delta;
      const last = p.ratingHistory[p.ratingHistory.length - 1];
      if (last && last.day === s.world.day) last.rating = placed;
      const to = Math.min(naturalRank(placed), PLACEMENT_MAX_RANK);
      pl.done = { day: s.world.day, rating: placed, performance: perf, rank: to };
      if (to !== p.rank) {
        const fromArena = RANKS[p.rank].arena;
        setRank(s, to, 'Placement');
        for (let a = fromArena + 1; a <= RANKS[to].arena; a++) unlockSet(s, a, events);
      }
      rankNote = `Placement complete: ${pl.score}/${pl.games}, performance ${perf} — ${RANKS[to].name} (${ARENAS[RANKS[to].arena].name})`;
      events.push(rankNote);
      // (setRank already writes a timeline entry when the verdict changes arena.)
      if (RANKS[to].arena === RANKS[rankBefore].arena) pushTimeline(s, { day: s.world.day, kind: 'promotion', text: `Placement complete (${pl.score}/${pl.games}, performance ${perf}): ${RANKS[to].name}`, ref: 'placement', arena: RANKS[to].arena });
    }
  } else if (rec.rated && pool === s.settings.careerPool && pl?.done) {
    // v0.4: after placement, the standard rules; at most one grade up per rated game
    // (a game that already moved the rank — a won Promotion Trial — makes no second move).
    const cr = p.ratings[pool];
    const dec = p.rank === rankBefore ? decideRank(p.rank, cr.rating, false) : ({ kind: 'stay' } as const);
    switch (dec.kind) {
      case 'grade-up':
      case 'arena-up': {
        const to = Math.min(dec.to, p.rank + 1);
        if (dec.kind === 'arena-up' && RANKS[to].arena > RANKS[p.rank].arena) inc(L, 'dominancePromotions');
        const reason = dec.kind === 'arena-up' && RANKS[to].arena > RANKS[p.rank].arena ? 'Dominance promotion' : 'Promotion';
        setRank(s, to, reason);
        rankNote = `Promoted to ${RANKS[to].name}`;
        if (RANKS[to].arena > RANKS[rankBefore].arena) unlockSet(s, RANKS[to].arena, events);
        p.trial = null;
        break;
      }
      case 'grade-down':
      case 'arena-down':
        setRank(s, dec.to, 'Demotion');
        rankNote = `Demoted to ${RANKS[dec.to].name}`;
        p.trial = null;
        break;
      case 'trial-available':
        if (!p.trial) {
          p.trial = { toRank: dec.to, availableSinceGames: p.ratedGames, attempts: 0, cooldownUntilGames: p.ratedGames };
          events.push(`Promotion trial unlocked: ${ARENAS[RANKS[dec.to].arena].name}`);
        }
        break;
      default:
        if (p.trial && naturalRank(cr.rating) <= p.rank) p.trial = null;
    }
  } else if (rec.rated && pool === s.settings.careerPool) {
    const cr = p.ratings[pool];
    const dec = decideRank(p.rank, cr.rating, isProvisional(cr));
    switch (dec.kind) {
      case 'grade-up':
      case 'arena-up':
        if (dec.kind === 'arena-up' && !isProvisional(cr)) inc(L, 'dominancePromotions');
        setRank(s, dec.to, isProvisional(cr) ? 'Placement' : dec.kind === 'arena-up' ? 'Dominance promotion' : 'Promotion');
        rankNote = isProvisional(cr) ? `Placement: ${RANKS[dec.to].name}` : `Promoted to ${RANKS[dec.to].name}`;
        if (RANKS[dec.to].arena > RANKS[rankBefore].arena) unlockSet(s, RANKS[dec.to].arena, events);
        p.trial = null;
        break;
      case 'grade-down':
      case 'arena-down':
        setRank(s, dec.to, isProvisional(cr) ? 'Placement' : 'Demotion');
        rankNote = isProvisional(cr) ? `Placement: ${RANKS[dec.to].name}` : `Demoted to ${RANKS[dec.to].name}`;
        p.trial = null;
        break;
      case 'trial-available':
        if (!p.trial) {
          p.trial = { toRank: dec.to, availableSinceGames: p.ratedGames, attempts: 0, cooldownUntilGames: p.ratedGames };
          events.push(`Promotion trial unlocked: ${ARENAS[RANKS[dec.to].arena].name}`);
        }
        break;
      default:
        if (p.trial && naturalRank(cr.rating) <= p.rank) p.trial = null;
    }
  }

  // Tournament bookkeeping.
  const trophies: AwardRecord[] = [];
  const hooks = hooksFor(s, events, trophies);
  if (rec.kind === 'tournament' && rec.tournamentId && rec.pairingId) {
    recordPlayerTournamentGame(s.world, rec.tournamentId, rec.pairingId, playerScore(rec.result, 'w'), hooks, rec.id);
  }
  // Every completed game moves the empire forward one day.
  const seasonReport = advancePlayerDay(s, events, trophies) ?? undefined;
  refreshInvitations(s);
  const achievements = checkAchievements(s, rec);
  return {
    outcome, rated: rec.rated, pool, ratingBefore: before.rating, ratingAfter: p.ratings[pool].rating, delta,
    rankBefore, rankAfter: p.rank, rankNote, influence: infl, events, achievements, trialAvailable: !!p.trial,
    trophies, seasonReport,
  };
}

/**
 * Advance the empire one day on the player's behalf: tournaments, off-screen
 * play, season rollover (Influence decay + season-end report) and the
 * "rival promoted" Chronicle entry. Returns the SeasonReport if a season ended.
 */
export function advancePlayerDay(s: Save, events: string[], trophies?: AwardRecord[]): SeasonReport | null {
  const rc = getCompetitor(s.world, s.player.rivalId);
  const rival = rc && rc.retiredDay === null ? rc : undefined;
  const rivalArena = rival ? RANKS[rival.rank].arena : -1;
  const seasonBefore = Math.floor(s.world.day / DAYS_PER_SEASON);
  advanceDay(s.world, hooksFor(s, events, trophies));
  let report: SeasonReport | null = null;
  if (Math.floor(s.world.day / DAYS_PER_SEASON) !== seasonBefore) report = seasonRollover(s, events);
  if (rival && RANKS[rival.rank].arena > rivalArena) {
    pushChronicle(s.world, { day: s.world.day, kind: 'promotion', tag: 'rival-promoted', arena: RANKS[rival.rank].arena, ids: [rival.id, PLAYER_ID], text: `${s.player.name}'s rival ${rival.name} is promoted to ${ARENAS[RANKS[rival.rank].arena].name}.` });
    events.push(`Your rival ${rival.name} has been promoted to ${ARENAS[RANKS[rival.rank].arena].name}.`);
  }
  return report;
}

export function setRank(s: Save, to: number, reason: string) {
  const p = s.player;
  if (to === p.rank) return;
  p.rank = to;
  p.peakRank = Math.max(p.peakRank, to);
  const from = p.rankHistory[p.rankHistory.length - 1]?.rank ?? 0;
  p.rankHistory.push({ day: s.world.day, rank: to, reason });
  // Timeline: every real promotion/demotion; provisional placement only when it changes arena.
  if (reason !== 'Placement' || RANKS[to].arena !== RANKS[from].arena) {
    const down = reason === 'Demotion' || to < from;
    pushTimeline(s, { day: s.world.day, kind: down ? 'demotion' : 'promotion', text: `${reason}: ${RANKS[to].name} (${ARENAS[RANKS[to].arena].name})`, ref: String(to), arena: RANKS[to].arena });
  }
  if (RANKS[to].arena >= 6 && reason !== 'Demotion') {
    pushChronicle(s.world, { day: s.world.day, kind: 'player', arena: RANKS[to].arena, text: `${p.name} rises to ${RANKS[to].name}.` });
  }
}

export function seasonRollover(s: Save, events: string[]): SeasonReport {
  s.player.influence = Math.floor(s.player.influence * INF.SEASON_DECAY);
  const report = closeSeason(s);
  events.push(`A new season begins: Season ${s.world.season + 1}`);
  return report;
}

/** Rival = the most significant active rivalry (≥ 3 games), see legacy.rivalSignificance. */
function updateRival(s: Save, events: string[]) {
  const p = s.player;
  let best: string | null = null;
  let bestScore = 0;
  const act = activeById(s);
  for (const r of Object.values(p.rivals ?? {})) {
    if (!act.has(r.id) || r.w + r.d + r.l < 3) continue;
    const sc = rivalSignificance(r, s.world.day);
    if (sc > bestScore || (sc === bestScore && best !== null && r.id < best)) {
      bestScore = sc;
      best = r.id;
    }
  }
  if (best && best !== p.rivalId) {
    p.rivalId = best;
    events.push(`New rival: ${act.get(best)!.name}`);
    pushTimeline(s, { day: s.world.day, kind: 'rival', text: `New rival: ${act.get(best)!.name}`, ref: best });
  }
}

// ---------------------------------------------------------------- invitations

/**
 * Invitations, strictly derived from eligibility (see docs/WORLD.md):
 *  trial              — a promotion trial is pending and off cooldown
 *  regional-championship / open-registration — the arena League / Open starts within 4 days
 *  invitational / elite-invitational — Influence ≥ threshold, OR top-6 rating in the arena,
 *                       OR a reigning title holder (privilege), OR prestige ≥ 40 × (arena/2+1)
 *  seeded / wildcard  — Cup/Gauntlet: seeded if your rating is within the arena's top `size`;
 *                       wildcard if recent form (last 5 rated ≥ 3.5) or prestige qualifies
 *  title-challenge    — won an event in this arena within 28 days and Influence ≥ threshold
 *  rival-rematch      — your rival exists, you met ≥ 3 days ago or they lost the last game
 *  exhibition         — prestige ≥ 150 and a title / Season Laurel / top-3 standing
 *  challenge          — an in-form competitor within 120 points (seeded daily draw)
 * v0.3 regional circuit and imperial events (all within 4 days of the start):
 *  local-open         — your region's Local Open whose arena band contains your arena
 *  regional-crown     — your region's championship: you hold its crown, OR your rating is within
 *                       the region's top `size`, OR you won its Upper Division Open in the last 2 seasons
 *  regional-defense   — your region's title defence: holders are auto-entered; you are invited as
 *                       challenger if your standing tops the region's contenders, or you are the
 *                       champion's rival (intensity ≥ 4) and in the region's top four
 *  qualifier          — your arena's Qualifier when you are outside the arena's top 6 (20+ rated games)
 *  imperial-masters   — the Imperial Masters: your rating is within the top 8 of arenas 16–23,
 *                       or you hold an arena title of arena 20+
 *  rival-challenge    — a competitor whose rivalry with you (intensity ≥ 6) is the most intense,
 *                       who won your last important encounter, challenges you to a rated game
 * Guarantee: if you have no entry in the current season, the next open-entry event of
 * your arena is offered regardless of the 4-day window (open registration / wildcard).
 * Significant invitations (regional crown / defence, Masters, title challenge, elite
 * invitational) are written to the Chronicle (tag 'invitation') when issued.
 */
const ARENA_EVENT_KINDS = new Set(['open', 'league', 'cup', 'gauntlet', 'invitational', 'qualifier', 'championship']);
export function refreshInvitations(s: Save) {
  const w = s.world;
  const day = w.day;
  const arena = playerArena(s);
  // v0.4: invitations follow the player's current standing — a trial invitation lives only while its trial is
  // pending, and an arena event's invitation lapses when the player changes arena (or leaves a Local Open's band).
  const stillEligible = (i: Invitation): boolean => {
    if (i.kind === 'trial') return !!s.player.trial;
    if (!i.tournamentId) return true;
    const t = w.tournaments.find((x) => x.id === i.tournamentId);
    if (!t || t.status !== 'scheduled' || t.playerEntered) return false;
    if (t.kind === 'local-open') return arena >= (t.band?.[0] ?? 0) && arena <= (t.band?.[1] ?? TOP_ARENA);
    if ((!t.region || t.region === 'imperial') && ARENA_EVENT_KINDS.has(t.kind)) return t.arena === arena;
    return true;
  };
  w.invitations = w.invitations.filter((i) => i.expiresDay >= day && stillEligible(i));
  const rng = createRng(mixSeed(s.seed, 'inv', day));
  const region = playerRegion(s);
  const r = careerRating(s).rating;
  const has = (k: string, t?: string) => w.invitations.some((i) => i.kind === k && (!t || i.tournamentId === t));
  const hasT = (t: string) => w.invitations.some((i) => i.tournamentId === t);
  const priv = championshipPrivileges(s);
  const p = s.player;
  const L = ensureLedger(p, day);
  const recent5 = L.recent.slice(-5);
  const inForm = recent5.length >= 5 && recent5.reduce((a, b) => a + b, 0) >= 3.5;
  const arenaPool = activeInArena(w, arena);
  const ratingRank = arenaPool.filter((c) => c.rating > r).length + 1; // your standing in the arena
  const NOTABLE = new Set(['regional-crown', 'regional-defense', 'imperial-masters', 'title-challenge', 'elite-invitational']);
  const push = (i: Omit<Invitation, 'id' | 'createdDay'>, priority = false) => {
    if (w.invitations.length >= (priority ? 8 : 6)) return;
    w.invitations.push({ ...i, id: `inv-${day}-${w.invitations.length}-${rng.int(0, 1e6)}`, createdDay: day });
    if (i.context && NOTABLE.has(i.context)) {
      pushChronicle(w, { day, kind: 'player', tag: 'invitation', ids: [PLAYER_ID, ...(i.fromId ? [i.fromId] : [])], arena, ...(i.context.startsWith('regional') ? { region } : {}), text: `${p.name} receives an invitation: ${i.title} (${i.reason ?? i.detail}).` });
    }
  };
  // Promotion trial.
  if (p.trial && p.ratedGames >= p.trial.cooldownUntilGames && !has('trial')) {
    const target = RANKS[p.trial.toRank].arena;
    const cands = activeInArena(w, target).filter((c) => c.rating < ARENAS[target].floor + 160 && c.games >= 20);
    const opp = cands.length ? rng.pick(cands) : null;
    if (opp) push({ kind: 'trial', context: 'trial', reason: 'Your rating reached the next arena floor.', fromId: opp.id, title: `Promotion Trial`, detail: `Defeat ${opp.name} to enter ${ARENAS[target].name}.`, stakes: `Win → ${RANKS[p.trial.toRank].name}`, expiresDay: day + 30 }, true);
  }
  const imperialEvent = (t: WorldTournament) => !t.region || t.region === 'imperial';
  const enteredThisSeason = w.tournaments.some((t) => t.playerEntered && !t.playerWithdrawn && t.season === w.season && t.hostId === undefined);
  const invThreshold = INF.invitationalThreshold(arena);
  const prestigeOk = p.prestige >= Math.round(40 * (arena / 2 + 1));
  const myAwards = awardsFor(w, PLAYER_ID);
  // Tournament registrations and invitations.
  for (const t of w.tournaments) {
    if (t.status !== 'scheduled' || t.playerEntered) continue;
    if (t.startDay - day > 4) continue;
    if (hasT(t.id)) continue;
    // ---- v0.3 regional circuit ----
    if (t.kind === 'local-open' && t.region === region) {
      const [lo, hi] = t.band ?? [0, TOP_ARENA];
      if (arena >= lo && arena <= hi) {
        push({ kind: 'invitational', context: 'local-open', fromId: null, tournamentId: t.id, title: t.name, detail: `Local Open of ${REGION_BY_ID[region].name} · Swiss`, reason: `Open to competitors of ${REGION_BY_ID[region].name} in arenas ${lo}–${hi}.`, stakes: `${t.prize} Influence to the winner`, expiresDay: t.startDay }, true);
      }
      continue;
    }
    if (t.kind === 'regional' && t.region === region) {
      const crown = regionTitle(w, region);
      const ranked = regionBand(w, region, 0, TOP_ARENA).filter((c) => c.rating > r).length + 1;
      const openWin = myAwards.some((a) => a.defId === 'lopen-upper' && a.region === region && a.season >= t.season - 2);
      const why = crown?.holder === PLAYER_ID ? `Reigning ${crown.name}` : ranked <= t.size ? `Rated #${ranked} in ${REGION_BY_ID[region].name}` : openWin ? 'Winner of the Upper Division Open' : null;
      if (why) push({ kind: 'invitational', context: 'regional-crown', reason: why, fromId: null, tournamentId: t.id, title: t.name, detail: `Regional championship of ${REGION_BY_ID[region].name} · the ${REGION_BY_ID[region].crown} is at stake`, stakes: `The crown · ${t.prize} Influence`, expiresDay: t.startDay }, true);
      continue;
    }
    if (t.kind === 'regional-defense' && t.region === region) {
      const crown = regionTitle(w, region);
      if (crown?.holder === PLAYER_ID) { t.playerEntered = true; continue; }
      const holder = crown?.holder ?? null;
      const pStand = r + 0.4 * Math.min(300, trophyPrestige(w, PLAYER_ID));
      const top4 = topByStanding(w, regionBand(w, region, 0, TOP_ARENA).filter((c) => c.id !== holder), 4);
      const best = top4[0] ? standingKey(w, top4[0]) : -Infinity;
      const fourth = top4[top4.length - 1] ? standingKey(w, top4[top4.length - 1]) : -Infinity;
      const rivalOfHolder = holder ? feudsOf(w, holder, 6).find((f) => f.other === PLAYER_ID && f.intensity >= 4) : undefined;
      const why = pStand >= best ? `Leading contender of ${REGION_BY_ID[region].name}` : rivalOfHolder && pStand >= fourth ? `The champion's rival (rivalry ${rivalOfHolder.intensity})` : null;
      if (why) push({ kind: 'championship', context: 'regional-defense', reason: why, fromId: holder, tournamentId: t.id, title: `Challenge for the ${crown?.name ?? 'crown'}`, detail: holder ? `${getCompetitor(w, holder)?.name ?? 'The champion'} defends the crown · match of ${t.matchGames ?? 4}` : 'The crown is vacant', stakes: `The crown · ${t.prize} Influence`, expiresDay: t.startDay }, true);
      continue;
    }
    if (t.kind === 'qualifier' && t.arena === arena) {
      const holder = w.titles.find((x) => x.arena === arena)?.holder;
      if (ratingRank > 6 && holder !== PLAYER_ID && p.ratedGames >= 20) {
        const target = w.tournaments.find((x) => x.id === t.feeds);
        push({ kind: 'invitational', context: 'qualifier', reason: `Outside the top six of ${ARENAS[arena].name} (#${ratingRank}).`, fromId: null, tournamentId: t.id, title: t.name, detail: `Qualifier · Swiss · the winner joins the ${target?.name ?? 'Invitational'}`, stakes: `A place in the ${target?.name ?? 'Invitational'}`, expiresDay: t.startDay }, true);
      }
      continue;
    }
    if (t.kind === 'elite') {
      const eliteRank = activeByRating(w).filter((c) => RANKS[c.rank].arena >= ELITE_ARENA_MIN && c.rating > r).length + 1;
      const highTitle = w.titles.some((x) => x.holder === PLAYER_ID && x.arena >= 20);
      const why = highTitle ? 'Reigning champion of an imperial arena' : arena >= ELITE_ARENA_MIN && eliteRank <= t.size ? `Rated #${eliteRank} among the elite` : null;
      if (why) push({ kind: 'invitational', context: 'imperial-masters', reason: why, fromId: null, tournamentId: t.id, title: t.name, detail: "Invitation-only round robin of the empire's top eight", stakes: `${t.prize} Influence · the Imperial Masters Trophy`, expiresDay: t.startDay }, true);
      continue;
    }
    if (!imperialEvent(t) || t.arena !== arena) continue;
    if (t.kind === 'open' || t.kind === 'league') {
      push({
        kind: 'invitational', context: t.kind === 'open' ? 'open-registration' : 'regional-championship', fromId: null, tournamentId: t.id, title: t.name,
        detail: t.kind === 'open' ? 'Open registration · Swiss' : 'Season league of the arena · double round-robin',
        reason: t.kind === 'open' ? 'Every competitor of the arena may register.' : 'Season league of your arena.',
        stakes: `${t.prize} Influence to the winner`, expiresDay: t.startDay,
      }, true);
    } else if (t.kind === 'invitational') {
      const why = priv.autoSeeded ? 'Reigning champion' : p.influence >= invThreshold ? `Influence ≥ ${invThreshold}` : ratingRank <= 6 ? `Rated #${ratingRank} in the arena` : prestigeOk ? 'Prestige' : null;
      if (why) push({ kind: 'invitational', context: arena >= 12 ? 'elite-invitational' : 'invitational', reason: why, fromId: null, tournamentId: t.id, title: t.name, detail: `${arena >= 12 ? 'Elite invitation' : 'Invitation by standing'} · round-robin`, stakes: `${t.prize} Influence`, expiresDay: t.startDay }, true);
    } else if (t.kind === 'cup' || t.kind === 'gauntlet') {
      const seeded = ratingRank <= t.size || priv.autoSeeded;
      const wild = !seeded && (inForm || prestigeOk || p.influence >= Math.ceil(invThreshold / 2));
      if (seeded || wild) push({ kind: seeded ? 'invitational' : 'wildcard', context: seeded ? 'seeded' : 'wildcard', reason: seeded ? (priv.autoSeeded ? 'Reigning champion' : `Rated #${ratingRank} in the arena`) : inForm ? 'Recent form' : 'Standing', fromId: null, tournamentId: t.id, title: t.name, detail: seeded ? 'Seeded entry' : 'Wildcard entry', stakes: `${t.prize} Influence`, expiresDay: t.startDay }, true);
    } else if (t.kind === 'championship') {
      const title = w.titles.find((x) => x.id === t.titleId);
      const isHolder = title?.holder === PLAYER_ID;
      const lastWin = [...w.history].reverse().find((h) => h.arena === arena && h.winner === PLAYER_ID && h.endDay > day - 28 && (!h.region || h.region === 'imperial'));
      if (!isHolder && lastWin && p.influence >= INF.championshipThreshold(arena)) {
        push({ kind: 'championship', context: 'title-challenge', reason: `Won the ${lastWin.name}`, fromId: title?.holder ?? null, tournamentId: t.id, title: `Challenge for ${title?.name}`, detail: `Your ${lastWin.name} victory earned a title shot.`, stakes: `The crown · ${t.prize} Influence`, expiresDay: t.startDay }, true);
      }
    }
  }
  // Seasonal guarantee: at least one meaningful competition per season.
  if (!enteredThisSeason && !w.invitations.some((i) => i.tournamentId)) {
    const next = w.tournaments
      .filter((t) => t.status === 'scheduled' && imperialEvent(t) && t.arena === arena && !t.playerEntered && (t.kind === 'open' || t.kind === 'league' || t.kind === 'cup' || t.kind === 'gauntlet' || t.kind === 'invitational') && t.startDay >= day)
      .sort((a, b) => a.startDay - b.startDay || (a.id < b.id ? -1 : 1))[0];
    if (next) push({ kind: next.kind === 'open' || next.kind === 'league' ? 'invitational' : 'wildcard', context: next.kind === 'open' ? 'open-registration' : next.kind === 'league' ? 'regional-championship' : 'wildcard', reason: 'Seasonal entry: you have no event this season.', fromId: null, tournamentId: next.id, title: next.name, detail: `Seasonal entry · starts day ${next.startDay}`, stakes: `${next.prize} Influence`, expiresDay: next.startDay }, true);
  }
  // Defend your titles automatically (champions are auto-entered and auto-seeded).
  for (const t of w.tournaments) {
    if (t.status !== 'scheduled') continue;
    if (t.kind === 'championship' && w.titles.find((x) => x.id === t.titleId)?.holder === PLAYER_ID) t.playerEntered = true;
    if ((t.kind === 'regional-defense' || t.kind === 'regional') && isRegionId(t.region) && regionTitle(w, t.region)?.holder === PLAYER_ID) t.playerEntered = true;
  }
  // Direct challenges and rivalry rematches.
  if (rng.chance(0.25) && !has('challenge')) {
    const cands = activeInRatingRange(w, r - 119, r + 119).filter((c) => c.form > 0.1);
    if (cands.length) {
      const c = rng.pick(cands);
      push({ kind: 'challenge', context: 'challenge', reason: 'An in-form competitor near your rating.', fromId: c.id, title: `${c.name} challenges you`, detail: `${RANKS[c.rank].name} · ${c.rating}`, stakes: 'Rated', expiresDay: day + 4 });
    }
  }
  if (p.rivalId && !has('rivalry')) {
    const c = getCompetitor(w, p.rivalId);
    const rv = p.rivals?.[p.rivalId];
    const last = rv?.games[rv.games.length - 1];
    const due = !!c && c.retiredDay === null && !!rv && (rv.lastDay <= day - 3 || last?.result === 'w');
    if (c && due) push({ kind: 'rivalry', context: 'rival-rematch', reason: last?.result === 'w' ? 'Your rival lost the last meeting and demands revenge.' : 'Your rivalry is waiting.', fromId: c.id, title: `Rematch: ${c.name}`, detail: `Your rival demands another game · ${rv!.w}-${rv!.d}-${rv!.l}`, stakes: 'Rated · +5 Influence on victory', expiresDay: day + 5 });
  }
  // v0.3: a tournament rival (finals, eliminations, title clashes) who beat you last time wants to prove it again.
  if (!w.invitations.some((i) => i.context === 'rival-challenge')) {
    const f = feudsOf(w, PLAYER_ID, 3).find((x) => x.intensity >= 6 && x.other !== p.rivalId && (x.a === PLAYER_ID ? x.lastWinner === 'b' : x.lastWinner === 'a'));
    const c = f ? getCompetitor(w, f.other) : undefined;
    if (f && c && c.retiredDay === null && day - f.lastDay >= 2) {
      push({ kind: 'rivalry', context: 'rival-challenge', reason: `Your tournament rivalry (intensity ${f.intensity}: ${f.finals} finals, ${f.eliminations} eliminations, ${f.titleClashes} title clashes).`, fromId: c.id, title: `${c.name} challenges you`, detail: `They won your last important encounter · ${RANKS[c.rank].name} · ${c.rating}`, stakes: 'Rated', expiresDay: day + 5 });
    }
  }
  const standingOk = priv.autoSeeded || myAwards.some((a) => a.defId.startsWith('laurel-')) || ratingRank <= 3;
  if (p.prestige >= 150 && standingOk && rng.chance(0.06) && !has('exhibition')) {
    const elite = activeByRating(w).filter((c) => RANKS[c.rank].arena >= Math.min(TOP_ARENA, arena + 4)).slice(0, 60).sort((a, b) => competitorPrestige(w, b) - competitorPrestige(w, a) || b.rating - a.rating);
    if (elite.length) {
      const c = elite[rng.int(0, Math.min(10, elite.length))];
      push({ kind: 'exhibition', context: 'exhibition', reason: 'Your prestige and standing', fromId: c.id, title: `Exhibition vs ${c.name}`, detail: `An elite ${RANKS[c.rank].name} accepts your request.`, stakes: 'Rated · prestige', expiresDay: day + 5 });
    }
  }
}

export function acceptTournament(s: Save, tournamentId: string) {
  const t = s.world.tournaments.find((x) => x.id === tournamentId);
  if (!t || t.status !== 'scheduled') return false;
  t.playerEntered = true;
  t.invitedPlayer = true;
  s.world.invitations = s.world.invitations.filter((i) => i.tournamentId !== tournamentId);
  return true;
}

export function dismissInvitation(s: Save, id: string) {
  s.world.invitations = s.world.invitations.filter((i) => i.id !== id);
}

/** Pending tournament game for the player (the tournament round is waiting on it). */
export function playerTournamentGame(s: Save): { t: WorldTournament; pairingId: string; opp: Competitor | null; color: 'w' | 'b' } | null {
  for (const t of s.world.tournaments) {
    const p = playerPairing(t);
    if (!p) continue;
    const color = p.white === PLAYER_ID ? 'w' : 'b';
    const oppId = color === 'w' ? p.black : p.white;
    return { t, pairingId: p.id, opp: getCompetitor(s.world, oppId) ?? null, color };
  }
  return null;
}

export function playerWithdraw(s: Save, tournamentId: string) {
  withdrawPlayer(s.world, tournamentId, hooksFor(s));
}

/** Let in-world time pass without playing (e.g. to reach a tournament start). */
export function restDays(s: Save, days: number): string[] {
  const events: string[] = [];
  ensureSaveV2(s);
  for (let i = 0; i < days; i++) {
    if (playerTournamentGame(s)) break; // never skip your own scheduled game
    advancePlayerDay(s, events);
  }
  refreshInvitations(s);
  checkAchievements(s, null);
  return events;
}

/** Spend influence to host an invitational in your arena (top contenders invited). */
export function hostInvitational(s: Save): string | null {
  ensureSaveV2(s);
  const arena = playerArena(s);
  const cost = hostCostFor(s); // title holders host at a 25% discount
  if (s.player.influence < cost) return null;
  s.player.influence -= cost;
  const w = s.world;
  const id = `t${String(++w.tournamentSerial).padStart(6, '0')}`;
  w.tournaments.push({
    id, name: `${s.player.name}'s Invitational`, arena, kind: 'hosted', format: 'round-robin', season: w.season,
    startDay: w.day, roundEveryDays: 1, nextRoundDay: w.day, status: 'scheduled', state: null, playerEntered: true,
    prize: INF.prizeFor('hosted', arena), featured: [], gameIds: {}, size: 6, hostId: PLAYER_ID,
  });
  inc(ensureLedger(s.player, w.day), 'hosted');
  advancePlayerDay(s, []);
  return id;
}

export function opponentPersonaElo(c: Competitor): number {
  return clamp(Math.round(c.skill), 250, 3200);
}

export function bestRating(s: Save): number {
  return Math.max(...POOLS.map((p) => s.player.ratings[p].peak));
}

/**
 * Re-evaluate achievements and invitations without playing (e.g. after a
 * spectated broadcast decided a tournament, or on load). Idempotent.
 */
export function syncCareer(s: Save): string[] {
  ensureSaveV2(s);
  return checkAchievements(s, null);
}
