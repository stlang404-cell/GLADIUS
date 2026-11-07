import { createRng, mixSeed, clamp } from '../core/rng';
import { applyResult, isProvisional, previewStakes, DEFAULT_RATING, POOLS, type TimeControlPool, type RatingState } from '../rating/elo';
import { ARENAS, RANKS, decideRank, naturalRank } from '../world/arenas';
import { DAYS_PER_SEASON, type Competitor } from '../world/types';
import { recordCompetitorResult, pushChronicle } from '../world/sim';
import {
  PLAYER_ID, advanceDay, recordPlayerTournamentGame, playerPairing, withdrawPlayer, type PlayerHooks,
} from '../world/calendar';
import {
  DEFAULT_SETTINGS, SAVE_SCHEMA, TIME_CONTROLS,
  type Save, type PlayerState, type GameRecord, type GameKind, type Invitation, type WorldState, type WorldTournament, type Side,
} from './state';
import * as INF from './influence';
import { checkAchievements } from './achievements';
import type { ResultCode } from '../chess/rules';

export function newPlayer(name: string, female: boolean, day: number, startRating = DEFAULT_RATING): PlayerState {
  const ratings = {} as Record<TimeControlPool, RatingState>;
  for (const p of POOLS) ratings[p] = { rating: startRating, games: 0, peak: startRating };
  const rank = 0; // everyone enlists as Tiro; placement games lift you quickly
  return {
    name, female, portraitSeed: mixSeed(name, day), createdDay: day, ratings, rank, peakRank: rank,
    rankHistory: [{ day, rank, reason: 'Enlisted' }], trial: null, influence: 0, prestige: 0,
    w: 0, d: 0, l: 0, ratedGames: 0, tournamentsPlayed: 0, tournamentsWon: 0, championships: 0, titles: [],
    achievements: {}, unlockedSets: [0], h2h: {}, rivalId: null, ratingHistory: [{ day, pool: 'rapid', rating: startRating }],
    openingsPlayed: {}, streak: 0, bestWinRating: 0,
  };
}

export function newSave(world: WorldState, name: string, female: boolean, startRating = DEFAULT_RATING): Save {
  const now = new Date().toISOString();
  return {
    schema: SAVE_SCHEMA, createdAt: now, updatedAt: now, seed: world.seed,
    player: newPlayer(name, female, world.day, startRating), world, settings: { ...DEFAULT_SETTINGS },
    active: null, library: [], libraryMeta: {}, coach: { positions: [] },
  };
}

export function careerRating(s: Save): RatingState {
  return s.player.ratings[s.settings.careerPool];
}

export function playerArena(s: Save): number {
  return RANKS[s.player.rank].arena;
}

export function hooksFor(s: Save, events: string[] = []): PlayerHooks {
  return {
    playerRating: () => careerRating(s).rating,
    playerArena: () => playerArena(s),
    playerName: s.player.name,
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
      if (place === 1 && t.arena >= 0) unlockSet(s, t.arena, events);
    },
    onPlayerTitle: (titleId, gained) => {
      const p = s.player;
      if (gained) {
        p.titles.push(titleId);
        p.championships++;
        events.push(`👑 You are now ${s.world.titles.find((t) => t.id === titleId)?.name}!`);
      } else {
        p.titles = p.titles.filter((x) => x !== titleId);
        events.push(`Your title was lost: ${s.world.titles.find((t) => t.id === titleId)?.name}`);
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
  return new Map(s.world.competitors.filter((c) => c.retiredDay === null).map((c) => [c.id, c]));
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
  const act = s.world.competitors.filter((c) => c.retiredDay === null && !busy.has(c.id) && !recent.has(c.name));
  const near = (target: number, width: number) => {
    const cands = act.filter((c) => Math.abs(c.rating - target) <= width);
    return cands.length ? rng.pick(cands) : act.reduce((a, b) => (Math.abs(b.rating - target) < Math.abs(a.rating - target) ? b : a));
  };
  const out: Suggestion[] = [];
  const add = (c: Competitor, label: string) => {
    if (!out.some((o) => o.c.id === c.id)) out.push({ c, label, stakes: previewStakes(r, c.rating) });
  };
  add(near(r.rating, 60), 'Even match');
  add(near(r.rating + 160, 60), 'Stronger challenge');
  add(near(r.rating - 140, 60), 'Warm-up');
  const rival = s.player.rivalId ? act.find((c) => c.id === s.player.rivalId) : undefined;
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
  const tc = TIME_CONTROLS.find((t) => t.id === o.tcId) ?? TIME_CONTROLS[2];
  let color: 'w' | 'b';
  if (o.color === 'w' || o.color === 'b') color = o.color;
  else color = createRng(mixSeed(s.seed, 'color', s.player.ratedGames + s.library.length)).chance(0.5) ? 'w' : 'b';
  const rated = o.rated ?? (o.kind !== 'casual' && o.kind !== 'drill' && tc.pool !== 'untimed');
  const pool: TimeControlPool = rated && o.kind !== 'casual' ? (o.kind === 'tournament' || o.kind === 'trial' ? s.settings.careerPool : tc.pool) : tc.pool;
  const me = playerSide(s);
  me.rating = s.player.ratings[pool].rating;
  const them = sideFor(opp);
  const rec: GameRecord = {
    id: newGameId(s), kind: o.kind, rated, pool, tc: tc.id, day: s.world.day, date: new Date().toISOString(),
    white: color === 'w' ? me : them, black: color === 'w' ? them : me, playerColor: color,
    startFen: o.startFen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [], san: [], clocks: [], result: '*', termination: 'ongoing', arena: RANKS[opp.rank].arena,
    tournamentId: o.tournamentId, pairingId: o.pairingId, source: 'player',
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
};

export function playerScore(result: ResultCode, color: 'w' | 'b'): number {
  if (result === '1/2-1/2') return 0.5;
  if (result === '1-0') return color === 'w' ? 1 : 0;
  if (result === '0-1') return color === 'b' ? 1 : 0;
  return 0.5;
}

export function finishPlayerGame(s: Save, rec: GameRecord): PostGame {
  const p = s.player;
  const color = rec.playerColor!;
  const score = playerScore(rec.result, color);
  const opp = s.world.competitors.find((c) => c.id === (color === 'w' ? rec.black.id : rec.white.id));
  const events: string[] = [];
  const pool = rec.pool;
  const before = p.ratings[pool];
  const rankBefore = p.rank;
  let delta = 0;
  let infl = 0;
  const outcome = score === 1 ? 'win' : score === 0 ? 'loss' : 'draw';
  const oppRating = color === 'w' ? rec.black.rating : rec.white.rating;
  const oppArena = opp ? RANKS[opp.rank].arena : rec.arena;
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

  // Trials and rank movement (career pool only).
  let rankNote: string | null = null;
  if (rec.kind === 'trial' && p.trial) {
    if (score === 1) {
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
  if (rec.rated && pool === s.settings.careerPool) {
    const cr = p.ratings[pool];
    const dec = decideRank(p.rank, cr.rating, isProvisional(cr));
    switch (dec.kind) {
      case 'grade-up':
      case 'arena-up':
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
  const hooks = hooksFor(s, events);
  if (rec.kind === 'tournament' && rec.tournamentId && rec.pairingId) {
    recordPlayerTournamentGame(s.world, rec.tournamentId, rec.pairingId, playerScore(rec.result, 'w'), hooks);
  }
  // Every completed game moves the empire forward one day.
  const seasonBefore = Math.floor(s.world.day / DAYS_PER_SEASON);
  advanceDay(s.world, hooks);
  if (Math.floor(s.world.day / DAYS_PER_SEASON) !== seasonBefore) seasonRollover(s, events);
  refreshInvitations(s);
  const achievements = checkAchievements(s, rec);
  return {
    outcome, rated: rec.rated, pool, ratingBefore: before.rating, ratingAfter: p.ratings[pool].rating, delta,
    rankBefore, rankAfter: p.rank, rankNote, influence: infl, events, achievements, trialAvailable: !!p.trial,
  };
}

export function setRank(s: Save, to: number, reason: string) {
  const p = s.player;
  if (to === p.rank) return;
  p.rank = to;
  p.peakRank = Math.max(p.peakRank, to);
  p.rankHistory.push({ day: s.world.day, rank: to, reason });
  if (RANKS[to].arena >= 3 && reason !== 'Demotion') {
    pushChronicle(s.world, { day: s.world.day, kind: 'player', arena: RANKS[to].arena, text: `${p.name} rises to ${RANKS[to].name}.` });
  }
}

export function seasonRollover(s: Save, events: string[]) {
  s.player.influence = Math.floor(s.player.influence * INF.SEASON_DECAY);
  events.push(`A new season begins: Season ${s.world.season + 1}`);
}

function updateRival(s: Save, events: string[]) {
  const p = s.player;
  let best: string | null = null;
  let bestScore = 0;
  const act = activeById(s);
  for (const [id, h] of Object.entries(p.h2h)) {
    if (!act.has(id)) continue;
    const n = h.w + h.d + h.l;
    if (n < 3) continue;
    const closeness = 1 / (1 + Math.abs(h.w - h.l));
    const recency = 1 / (1 + (s.world.day - h.lastDay) / 20);
    const sc = n * closeness * recency + (h.l > h.w ? 1 : 0);
    if (sc > bestScore) {
      bestScore = sc;
      best = id;
    }
  }
  if (best && best !== p.rivalId) {
    p.rivalId = best;
    events.push(`New rival: ${act.get(best)!.name}`);
  }
}

// ---------------------------------------------------------------- invitations

export function refreshInvitations(s: Save) {
  const w = s.world;
  const day = w.day;
  w.invitations = w.invitations.filter((i) => i.expiresDay >= day);
  const rng = createRng(mixSeed(s.seed, 'inv', day));
  const arena = playerArena(s);
  const r = careerRating(s).rating;
  const has = (k: string, t?: string) => w.invitations.some((i) => i.kind === k && (!t || i.tournamentId === t));
  const act = s.world.competitors.filter((c) => c.retiredDay === null);
  const push = (i: Omit<Invitation, 'id' | 'createdDay'>) => {
    if (w.invitations.length >= 6) return;
    w.invitations.push({ ...i, id: `inv-${day}-${w.invitations.length}-${rng.int(0, 1e6)}`, createdDay: day });
  };
  // Promotion trial.
  const p = s.player;
  if (p.trial && p.ratedGames >= p.trial.cooldownUntilGames && !has('trial')) {
    const target = RANKS[p.trial.toRank].arena;
    const cands = act.filter((c) => RANKS[c.rank].arena === target && c.rating < ARENAS[target].floor + 160 && c.games >= 20);
    const opp = cands.length ? rng.pick(cands) : null;
    if (opp) push({ kind: 'trial', fromId: opp.id, title: `Promotion Trial`, detail: `Defeat ${opp.name} to enter ${ARENAS[target].name}.`, stakes: `Win → ${RANKS[p.trial.toRank].name}`, expiresDay: day + 30 });
  }
  // Tournament registrations and invitations for the player's arena.
  for (const t of w.tournaments) {
    if (t.status !== 'scheduled' || t.arena !== arena || t.playerEntered) continue;
    if (t.startDay - day > 4) continue;
    if (has('invitational', t.id) || has('wildcard', t.id) || has('championship', t.id) || has('exhibition', t.id)) continue;
    if (t.kind === 'open' || t.kind === 'league') {
      push({ kind: 'invitational', fromId: null, tournamentId: t.id, title: t.name, detail: t.kind === 'open' ? 'Open registration · Swiss' : 'Season league · double round-robin', stakes: `${t.prize} Influence to the winner`, expiresDay: t.startDay });
    } else if (t.kind === 'invitational' && p.influence >= INF.invitationalThreshold(arena)) {
      push({ kind: 'invitational', fromId: null, tournamentId: t.id, title: t.name, detail: 'Invitation by standing · round-robin', stakes: `${t.prize} Influence`, expiresDay: t.startDay });
    } else if (t.kind === 'cup' || t.kind === 'gauntlet') {
      const ranked = act.filter((c) => RANKS[c.rank].arena === arena).sort((a, b) => b.rating - a.rating);
      const cut = ranked[Math.min(ranked.length - 1, t.size - 1)]?.rating ?? 0;
      if (r >= cut || rng.chance(0.35)) push({ kind: r >= cut ? 'invitational' : 'wildcard', fromId: null, tournamentId: t.id, title: t.name, detail: r >= cut ? 'Seeded entry' : 'Wildcard entry', stakes: `${t.prize} Influence`, expiresDay: t.startDay });
    } else if (t.kind === 'championship') {
      const title = w.titles.find((x) => x.id === t.titleId);
      const isHolder = title?.holder === PLAYER_ID;
      const lastWin = [...w.history].reverse().find((h) => h.arena === arena && h.winner === PLAYER_ID && h.endDay > day - 28);
      if (!isHolder && lastWin && p.influence >= INF.championshipThreshold(arena)) {
        push({ kind: 'championship', fromId: title?.holder ?? null, tournamentId: t.id, title: `Challenge for ${title?.name}`, detail: `Your ${lastWin.name} victory earned a title shot.`, stakes: `The crown · ${t.prize} Influence`, expiresDay: t.startDay });
      }
    }
  }
  // Defend your title automatically.
  for (const t of w.tournaments) {
    if (t.kind === 'championship' && t.status === 'scheduled' && w.titles.find((x) => x.id === t.titleId)?.holder === PLAYER_ID) t.playerEntered = true;
  }
  // Direct challenges and rivalry rematches.
  if (rng.chance(0.25) && !has('challenge')) {
    const cands = act.filter((c) => Math.abs(c.rating - r) < 120 && c.form > 0.1);
    if (cands.length) {
      const c = rng.pick(cands);
      push({ kind: 'challenge', fromId: c.id, title: `${c.name} challenges you`, detail: `${RANKS[c.rank].name} · ${c.rating}`, stakes: 'Rated', expiresDay: day + 4 });
    }
  }
  if (p.rivalId && !has('rivalry') && rng.chance(0.3)) {
    const c = act.find((x) => x.id === p.rivalId);
    if (c) push({ kind: 'rivalry', fromId: c.id, title: `Rematch: ${c.name}`, detail: 'Your rival demands another game.', stakes: 'Rated · +5 Influence on victory', expiresDay: day + 5 });
  }
  if (p.prestige >= 150 && rng.chance(0.06) && !has('exhibition')) {
    const elite = act.filter((c) => RANKS[c.rank].arena >= Math.min(11, arena + 2)).sort((a, b) => b.rating - a.rating);
    if (elite.length) {
      const c = elite[rng.int(0, Math.min(10, elite.length))];
      push({ kind: 'exhibition', fromId: c.id, title: `Exhibition vs ${c.name}`, detail: `An elite ${RANKS[c.rank].name} accepts your request.`, stakes: 'Rated · prestige', expiresDay: day + 5 });
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
    return { t, pairingId: p.id, opp: s.world.competitors.find((c) => c.id === oppId) ?? null, color };
  }
  return null;
}

export function playerWithdraw(s: Save, tournamentId: string) {
  withdrawPlayer(s.world, tournamentId, hooksFor(s));
}

/** Let in-world time pass without playing (e.g. to reach a tournament start). */
export function restDays(s: Save, days: number): string[] {
  const events: string[] = [];
  for (let i = 0; i < days; i++) {
    if (playerTournamentGame(s)) break; // never skip your own scheduled game
    const seasonBefore = Math.floor(s.world.day / DAYS_PER_SEASON);
    advanceDay(s.world, hooksFor(s, events));
    if (Math.floor(s.world.day / DAYS_PER_SEASON) !== seasonBefore) seasonRollover(s, events);
  }
  refreshInvitations(s);
  return events;
}

/** Spend influence to host an invitational in your arena (top contenders invited). */
export function hostInvitational(s: Save): string | null {
  const arena = playerArena(s);
  const cost = INF.hostCost(arena);
  if (s.player.influence < cost) return null;
  s.player.influence -= cost;
  const w = s.world;
  const id = `t${String(++w.tournamentSerial).padStart(6, '0')}`;
  w.tournaments.push({
    id, name: `${s.player.name}'s Invitational`, arena, kind: 'hosted', format: 'round-robin', season: w.season,
    startDay: w.day, roundEveryDays: 1, nextRoundDay: w.day, status: 'scheduled', state: null, playerEntered: true,
    prize: INF.prizeFor('hosted', arena), featured: [], gameIds: {}, size: 6, hostId: PLAYER_ID,
  });
  advanceDay(w, hooksFor(s));
  return id;
}

export function opponentPersonaElo(c: Competitor): number {
  return clamp(Math.round(c.skill), 250, 3200);
}

export function bestRating(s: Save): number {
  return Math.max(...POOLS.map((p) => s.player.ratings[p].peak));
}
