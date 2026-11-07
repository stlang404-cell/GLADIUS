import { createRng, mixSeed, type Rng } from '../core/rng';
import {
  createTournament, pendingPairings, recordResult, standings, withdraw, matchOutcome,
  type Format, type Pairing, type TournamentState,
} from '../tournament/formats';
import { ARENAS, RANKS } from './arenas';
import { DAYS_PER_SEASON, type Competitor, type AwardRecord, type ChronicleEntry } from './types';
import { processTournamentAwards, presentSeasonLaurels, titleSeriesChanged, ensureWorldV2 } from './trophies';
import { competitorPrestige, checkRecordsBroken } from './records';
import { simulateGame, recordCompetitorResult, pushChronicle, simulateDay } from './sim';
import type { WorldState, WorldTournament, TournamentKind, TournamentSummary } from '../game/state';
import { prizeFor } from '../game/influence';
import { PROVISIONAL_GAMES } from '../rating/elo';

export const PLAYER_ID = 'player';

type Slot = { kind: TournamentKind; format: Format; offset: number; size: number; every: number; name: (a: number, season: number) => string; matchGames?: number };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
export function roman(n: number): string {
  if (n <= 20) return ROMAN[n - 1] ?? String(n);
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
  return s;
}
const short = (a: number) => ARENAS[a].name.replace(/^The /, '');

/** One season (28 days) of competition in every arena. */
export function seasonSlots(season: number): Slot[] {
  const evenSeason = season % 2 === 0;
  return [
    { kind: 'league', format: 'league', offset: 0, size: 8, every: 2, name: (a, s) => `${short(a)} League · Season ${roman(s + 1)}` },
    { kind: 'open', format: 'swiss', offset: 1, size: 16, every: 1, name: (a) => `${short(a)} Open` },
    evenSeason
      ? { kind: 'cup', format: 'single-elim', offset: 8, size: 16, every: 1, name: (a) => `${short(a)} Cup` }
      : { kind: 'gauntlet', format: 'double-elim', offset: 8, size: 8, every: 1, name: (a) => `${short(a)} Gauntlet` },
    { kind: 'invitational', format: 'round-robin', offset: 14, size: 6, every: 1, name: (a) => `${ARENAS[a].trophy} Invitational` },
    { kind: 'championship', format: 'match-series', offset: 21, size: 2, every: 1, matchGames: 4, name: (a, s) => `${short(a)} Championship ${roman(s + 1)}` },
  ];
}

export function titleIdFor(arena: number) {
  return `title-${arena}`;
}

export function initTitles(w: WorldState) {
  w.titles = ARENAS.map((a) => ({ id: titleIdFor(a.index), arena: a.index, name: `Champion of ${short(a.index)}`, holder: null, since: 0, defenses: 0 }));
  w.reigns = [];
}

function arenaPool(w: WorldState, arena: number): Competitor[] {
  return w.competitors.filter((c) => c.retiredDay === null && RANKS[c.rank].arena === arena && c.games >= PROVISIONAL_GAMES);
}

function busyIds(w: WorldState): Set<string> {
  const s = new Set<string>();
  for (const t of w.tournaments) if (t.status === 'running' && t.state) for (const id of t.state.entrants) s.add(id);
  return s;
}

function pickEntrants(w: WorldState, arena: number, size: number, kind: TournamentKind, rng: Rng, exclude: Set<string>): string[] {
  let pool = arenaPool(w, arena).filter((c) => !exclude.has(c.id));
  if (pool.length < size) {
    // Thin elite arenas draw qualifiers from the arena below.
    const below = arena > 0 ? arenaPool(w, arena - 1).filter((c) => !exclude.has(c.id)).sort((a, b) => b.rating - a.rating) : [];
    pool = pool.concat(below.slice(0, size - pool.length));
  }
  if (pool.length < 2) return [];
  if (kind === 'invitational' || kind === 'league' || kind === 'cup') {
    // Invitations by standing: rating + recent form + prestige (real honours, titles, peak).
    const key = new Map(pool.map((c) => [c.id, standingKey(w, c)]));
    pool.sort((a, b) => key.get(b.id)! - key.get(a.id)! || (a.id < b.id ? -1 : 1));
    const top = pool.slice(0, Math.max(size, Math.ceil(size * 1.5)));
    const chosen: Competitor[] = [];
    while (chosen.length < size && top.length) chosen.push(top.splice(rng.int(0, Math.min(top.length, size)), 1)[0]);
    // Championship privilege: the arena's reigning champion is always invited.
    const holder = w.titles.find((t) => t.arena === arena)?.holder;
    if (holder && holder !== PLAYER_ID && !chosen.some((c) => c.id === holder)) {
      const hc = pool.find((c) => c.id === holder);
      if (hc && chosen.length) chosen[chosen.length - 1] = hc;
    }
    return chosen.map((c) => c.id);
  }
  // Opens: anyone may register; random draw from the arena.
  const out: string[] = [];
  const copy = [...pool];
  while (out.length < size && copy.length) out.push(copy.splice(rng.int(0, copy.length), 1)[0].id);
  return out;
}

/** Seeding / invitation standing: rating + form + capped prestige (see docs/WORLD.md). */
export function standingKey(w: WorldState, c: Competitor): number {
  return c.rating + c.form * 80 + Math.min(300, competitorPrestige(w, c)) * 0.4;
}

export function scheduleSeason(w: WorldState, season: number) {
  const startDay = season * DAYS_PER_SEASON;
  for (const slot of seasonSlots(season)) {
    for (let a = 0; a < ARENAS.length; a++) {
      const id = `t${String(++w.tournamentSerial).padStart(6, '0')}`;
      w.tournaments.push({
        id, name: slot.name(a, season), arena: a, kind: slot.kind, format: slot.format, season,
        startDay: startDay + slot.offset, roundEveryDays: slot.every, nextRoundDay: startDay + slot.offset,
        status: 'scheduled', state: null, playerEntered: false, prize: prizeFor(slot.kind, a),
        titleId: slot.kind === 'championship' ? titleIdFor(a) : undefined, featured: [], gameIds: {}, size: slot.size,
      });
    }
  }
}

function competitorById(w: WorldState): Map<string, Competitor> {
  return new Map(w.competitors.map((c) => [c.id, c]));
}

export type PlayerHooks = {
  playerRating: () => number;
  playerArena: () => number;
  playerName: string;
  onPlayerTournamentEnd?: (t: WorldTournament, place: number) => void;
  onPlayerTitle?: (titleId: string, gained: boolean) => void;
  /** v0.2: a trophy was presented to the player (called once per new award). */
  onPlayerAward?: (a: AwardRecord) => void;
};

function startTournament(w: WorldState, t: WorldTournament, hooks: PlayerHooks | null) {
  const rng = createRng(mixSeed(w.seed, 'tstart', t.id));
  const exclude = busyIds(w);
  let entrants: string[];
  if (t.kind === 'championship') {
    const title = w.titles.find((x) => x.id === t.titleId)!;
    // A champion who retired or left the arena relinquishes the title before the match.
    if (title.holder && title.holder !== PLAYER_ID) {
      const hc = w.competitors.find((c) => c.id === title.holder);
      if (!hc || hc.retiredDay !== null) vacateTitle(w, title, hc ? `${hc.name} retires as champion; the title ${title.name} is vacated.` : `The title ${title.name} is vacated.`, hooks);
      else if (RANKS[hc.rank].arena !== t.arena) vacateTitle(w, title, `${hc.name} now competes in ${ARENAS[RANKS[hc.rank].arena].name} and relinquishes the title ${title.name}.`, hooks);
    } else if (title.holder === PLAYER_ID && hooks && hooks.playerArena() !== t.arena) {
      vacateTitle(w, title, `${hooks.playerName} now competes in ${ARENAS[hooks.playerArena()].name} and relinquishes the title ${title.name}.`, hooks);
    }
    const challenger = championshipChallenger(w, t.arena, title.holder);
    let holder = title.holder;
    if (!holder) {
      // Vacant title: the two top contenders contest it.
      const pool = arenaPool(w, t.arena).filter((c) => c.id !== challenger).sort((a, b) => b.rating - a.rating || (a.id < b.id ? -1 : 1));
      holder = pool[0]?.id ?? null;
    }
    const ch = t.playerEntered && holder !== PLAYER_ID ? PLAYER_ID : challenger && challenger !== holder ? challenger : null;
    if (!holder || !ch) {
      t.status = 'complete';
      return;
    }
    entrants = [holder, ch];
  } else {
    entrants = pickEntrants(w, t.arena, t.size - (t.playerEntered ? 1 : 0), t.kind, rng, exclude);
    if (t.playerEntered) entrants.push(PLAYER_ID);
  }
  if (entrants.length < 2) {
    t.status = 'complete';
    return;
  }
  const byId = competitorById(w);
  const ratings: Record<string, number> = {};
  for (const id of entrants) ratings[id] = id === PLAYER_ID ? (hooks?.playerRating() ?? 1000) : (byId.get(id)?.rating ?? 1000);
  const arenaGames = t.arena >= 8 ? 6 : 4;
  // Championship privilege: reigning title holders are seeded first (own arena's champion on top).
  const holders = w.titles.filter((x) => x.holder && entrants.includes(x.holder)).sort((a, b) => Number(b.arena === t.arena) - Number(a.arena === t.arena) || b.arena - a.arena).map((x) => x.holder!);
  const cfg = t.format === 'match-series' ? { matchGames: arenaGames } : holders.length ? { topSeeds: holders } : undefined;
  t.state = createTournament(t.format, entrants, ratings, cfg);
  t.status = 'running';
  t.nextRoundDay = w.day;
  // Feature the most prestigious pairings for live engine broadcast in Spectate.
  markFeatured(t);
}

/** Vacate a title (holder retired or left the arena). Reign closed, awards become historical. */
export function vacateTitle(w: WorldState, title: WorldState['titles'][number], text: string, hooks: PlayerHooks | null) {
  const prev = title.holder;
  if (!prev) return;
  const reign = w.reigns.find((r) => r.titleId === title.id && r.to === null);
  if (reign) reign.to = w.day;
  if (prev === PLAYER_ID) hooks?.onPlayerTitle?.(title.id, false);
  else {
    const pc = w.competitors.find((c) => c.id === prev);
    if (pc) pc.titles = pc.titles.filter((x) => x !== title.id);
  }
  title.holder = null;
  title.since = w.day;
  title.defenses = 0;
  titleSeriesChanged(w, title.arena, null);
  pushChronicle(w, { day: w.day, kind: 'title', arena: title.arena, ids: [prev], text });
}

export function markFeatured(t: WorldTournament) {
  if (!t.state) return;
  const pend = pendingPairings(t.state).filter((p) => p.white !== PLAYER_ID && p.black !== PLAYER_ID);
  const sum = (p: Pairing) => (t.state!.ratings[p.white] ?? 0) + (t.state!.ratings[p.black ?? ''] ?? 0);
  pend.sort((a, b) => sum(b) - sum(a));
  t.featured = pend.slice(0, t.kind === 'championship' ? 1 : 2).map((p) => p.id);
}

export function championshipChallenger(w: WorldState, arena: number, holder: string | null): string | null {
  // Most recent League winner of this arena, else most recent Open/Cup winner, else top-rated contender.
  const recent = [...w.history].reverse().filter((h) => h.arena === arena && h.winner && h.winner !== holder);
  const league = recent.find((h) => h.kind === 'league');
  const cand = league ?? recent.find((h) => h.kind === 'open' || h.kind === 'cup' || h.kind === 'gauntlet');
  if (cand?.winner) {
    if (cand.winner === PLAYER_ID) return PLAYER_ID;
    const c = w.competitors.find((x) => x.id === cand.winner);
    if (c && c.retiredDay === null && Math.abs(RANKS[c.rank].arena - arena) <= 1) return c.id;
  }
  const pool = arenaPool(w, arena).filter((c) => c.id !== holder);
  const key = new Map(pool.map((c) => [c.id, c.rating + Math.min(300, competitorPrestige(w, c)) * 0.3]));
  pool.sort((a, b) => key.get(b.id)! - key.get(a.id)! || (a.id < b.id ? -1 : 1));
  return pool[0]?.id ?? null;
}

/** Resolve a pairing statistically (AI vs AI). */
function simPairing(w: WorldState, t: WorldTournament, p: Pairing, rng: Rng, byId: Map<string, Competitor>) {
  const a = byId.get(p.white);
  const b = p.black ? byId.get(p.black) : undefined;
  if (!a || !b) {
    recordResult(t.state!, p.id, a ? 1 : 0);
    return;
  }
  let s = simulateGame(a, b, rng);
  if (p.armageddon && s === 0.5) s = 0.5; // matchOutcome applies the armageddon rule
  applyRatedTournamentResult(w, p, s, byId);
  recordResult(t.state!, p.id, s);
}

export function applyRatedTournamentResult(w: WorldState, p: Pairing, whiteScore: number, byId = competitorById(w)) {
  const a = byId.get(p.white);
  const b = p.black ? byId.get(p.black) : undefined;
  if (a && b) {
    const ar = a.rating;
    recordCompetitorResult(a, b.id, b.rating, whiteScore);
    recordCompetitorResult(b, a.id, ar, 1 - whiteScore);
    w.stats.simGames++;
  }
}

/** Is the player's game blocking this tournament's current round? */
export function playerPairing(t: WorldTournament): Pairing | null {
  if (!t.state || t.status !== 'running') return null;
  return pendingPairings(t.state).find((p) => p.white === PLAYER_ID || p.black === PLAYER_ID) ?? null;
}

function finishTournament(w: WorldState, t: WorldTournament, hooks: PlayerHooks | null) {
  const st = t.state!;
  t.status = 'complete';
  const byId = competitorById(w);
  const nameOf = (id: string | null) => (id === PLAYER_ID ? (hooks?.playerName ?? 'You') : id ? (byId.get(id)?.name ?? 'Unknown') : '—');
  const rows = standings(st);
  const winner = st.winner ?? rows[0]?.id ?? null;
  const runnerUp = st.runnerUp ?? rows[1]?.id ?? null;
  const summary: TournamentSummary = {
    id: t.id, name: t.name, arena: t.arena, kind: t.kind, format: t.format, season: t.season, endDay: w.day,
    winner, winnerName: nameOf(winner), runnerUp, runnerUpName: nameOf(runnerUp), size: st.entrants.length,
  };
  if (t.playerEntered) {
    const row = rows.find((r) => r.id === PLAYER_ID);
    summary.playerPlace = winner === PLAYER_ID ? 1 : runnerUp === PLAYER_ID ? 2 : row?.place;
    hooks?.onPlayerTournamentEnd?.(t, summary.playerPlace ?? rows.length);
  }
  w.history.push(summary);
  if (w.history.length > 1500) w.history.splice(0, w.history.length - 1500);
  // Trophies (before the title changes hands, so defences are recognised).
  const titleBefore = t.kind === 'championship' && t.titleId ? w.titles.find((x) => x.id === t.titleId) : undefined;
  processTournamentAwards(w, t, {
    nameOf: (id) => nameOf(id),
    prevHolder: titleBefore?.holder ?? null,
    prevDefenses: titleBefore?.defenses ?? 0,
    onAward: (a) => { if (a.holder === PLAYER_ID) hooks?.onPlayerAward?.(a); },
  });
  const wc = winner ? byId.get(winner) : undefined;
  if (wc) {
    wc.tournamentsWon++;
    if (t.kind !== 'open' || t.arena >= 6) wc.honours.push(`${t.name} (S${t.season + 1})`);
    if (wc.honours.length > 30) wc.honours.splice(0, wc.honours.length - 30);
  }
  if (t.kind === 'championship' && t.titleId && winner) {
    const title = w.titles.find((x) => x.id === t.titleId)!;
    const prev = title.holder;
    if (prev === winner) {
      title.defenses++;
      const reign = w.reigns.find((r) => r.titleId === title.id && r.to === null);
      if (reign) reign.defenses++;
      pushChronicle(w, { day: w.day, kind: 'title', arena: t.arena, ids: [winner], text: `${nameOf(winner)} defends the ${short(t.arena)} crown against ${nameOf(runnerUp)}.` });
    } else {
      const comeback = w.reigns.some((r) => r.titleId === title.id && r.holder === winner && r.to !== null);
      const gap = (st.ratings[runnerUp ?? ''] ?? 0) - (st.ratings[winner] ?? 0);
      const tag: ChronicleEntry['tag'] = prev && runnerUp === prev && gap >= 150 ? 'elite-upset' : comeback ? 'comeback' : 'new-champion';
      const old = w.reigns.find((r) => r.titleId === title.id && r.to === null);
      if (old) old.to = w.day;
      if (prev && prev !== PLAYER_ID) {
        const pc = byId.get(prev);
        if (pc) pc.titles = pc.titles.filter((x) => x !== title.id);
      }
      if (prev === PLAYER_ID) hooks?.onPlayerTitle?.(title.id, false);
      title.holder = winner;
      title.since = w.day;
      title.defenses = 0;
      titleSeriesChanged(w, t.arena, winner);
      w.reigns.push({ titleId: title.id, holder: winner, holderName: nameOf(winner), from: w.day, to: null, defenses: 0 });
      if (winner === PLAYER_ID) hooks?.onPlayerTitle?.(title.id, true);
      else if (wc) {
        wc.titles.push(title.id);
        wc.championships++;
      }
      const text = tag === 'comeback'
        ? `${nameOf(winner)} regains the crown: ${title.name} once more, defeating ${nameOf(runnerUp)}.`
        : tag === 'elite-upset'
          ? `Upset! ${nameOf(winner)} (${st.ratings[winner]}) dethrones ${nameOf(prev)} (${st.ratings[prev!]}) to become ${title.name}.`
          : prev ? `${nameOf(winner)} dethrones ${nameOf(prev)} to become ${title.name}.` : `${nameOf(winner)} claims the vacant title ${title.name}.`;
      pushChronicle(w, { day: w.day, kind: 'title', tag, arena: t.arena, ids: prev ? [winner, prev] : [winner], text });
    }
  } else if (winner) {
    const seed = st.entrants.indexOf(winner);
    const gap = (st.ratings[st.entrants[0]] ?? 0) - (st.ratings[winner] ?? 0);
    const upset = st.entrants.length >= 6 && seed >= st.entrants.length / 2 && gap >= 150;
    if (upset && (t.arena >= 3 || winner === PLAYER_ID)) {
      pushChronicle(w, { day: w.day, kind: 'tournament', tag: 'tournament-upset', arena: t.arena, ids: [winner], text: `Upset: ${nameOf(winner)}, seeded ${seed + 1} of ${st.entrants.length}, wins the ${t.name}.` });
    } else if (t.arena >= 6 || t.kind === 'league' || winner === PLAYER_ID) {
      pushChronicle(w, { day: w.day, kind: 'tournament', arena: t.arena, ids: [winner], text: `${nameOf(winner)} wins the ${t.name}.` });
    }
  }  // A late event may complete a past season: present its Season Laurel now.
  if (t.season < w.season) presentSeasonLaurels(w, (id) => nameOf(id), (a) => { if (a.holder === PLAYER_ID) hooks?.onPlayerAward?.(a); });
}

/** Advance tournaments for the current day. Rounds wait for the player's own game. */
export function tickTournaments(w: WorldState, hooks: PlayerHooks | null) {
  const rng = createRng(mixSeed(w.seed, 'tourn', w.day));
  for (const t of w.tournaments) {
    if (t.status === 'scheduled' && t.startDay <= w.day) startTournament(w, t, hooks);
    if (t.status !== 'running' || !t.state) continue;
    if (t.nextRoundDay > w.day) continue;
    const byId = competitorById(w);
    const roundBefore = t.state.rounds.length;
    // Resolve every AI pairing in the current round (including spawned tiebreaks).
    for (let guard = 0; guard < 20 && t.state && !t.state.complete; guard++) {
      const pend = pendingPairings(t.state).filter((p) => p.white !== PLAYER_ID && p.black !== PLAYER_ID);
      if (pend.length === 0) break;
      for (const p of pend) simPairing(w, t, p, rng, byId);
      if (t.state.rounds.length !== roundBefore) break;
    }
    if (t.state.complete) finishTournament(w, t, hooks);
    else if (t.state.rounds.length !== roundBefore) {
      t.nextRoundDay = w.day + t.roundEveryDays;
      markFeatured(t);
    }
  }
}

/** Record the player's tournament game. */
export function recordPlayerTournamentGame(w: WorldState, tournamentId: string, pairingId: string, whiteScore: number, hooks: PlayerHooks, gameId?: string) {
  const t = w.tournaments.find((x) => x.id === tournamentId);
  if (!t?.state) return;
  const p = t.state.rounds.flat().find((x) => x.id === pairingId);
  if (!p || p.result !== null) return;
  if (gameId) t.gameIds[pairingId] = gameId;
  // Rate the AI side (the player's own rating is handled by the career module).
  const byId = competitorById(w);
  const oppId = p.white === PLAYER_ID ? p.black : p.white;
  const opp = oppId ? byId.get(oppId) : undefined;
  if (opp) recordCompetitorResult(opp, PLAYER_ID, hooks.playerRating(), p.white === PLAYER_ID ? 1 - whiteScore : whiteScore);
  const roundBefore = t.state.rounds.length;
  recordResult(t.state, pairingId, whiteScore);
  if (t.state.complete) finishTournament(w, t, hooks);
  else if (t.state.rounds.length !== roundBefore) {
    t.nextRoundDay = w.day + t.roundEveryDays;
    markFeatured(t);
  }
}

/** Record an engine-played (spectated) AI tournament game. */
export function recordEngineTournamentGame(w: WorldState, tournamentId: string, pairingId: string, whiteScore: number, gameId: string, hooks: PlayerHooks | null) {
  const t = w.tournaments.find((x) => x.id === tournamentId);
  if (!t?.state) return;
  const p = t.state.rounds.flat().find((x) => x.id === pairingId);
  if (!p || p.result !== null) return;
  applyRatedTournamentResult(w, p, whiteScore);
  t.gameIds[pairingId] = gameId;
  w.stats.simGames--; // counted as engine game instead
  const roundBefore = t.state.rounds.length;
  recordResult(t.state, pairingId, whiteScore);
  if (t.state.complete) finishTournament(w, t, hooks);
  else if (t.state.rounds.length !== roundBefore) {
    t.nextRoundDay = w.day + t.roundEveryDays;
    markFeatured(t);
  }
}

export function withdrawPlayer(w: WorldState, tournamentId: string, hooks: PlayerHooks) {
  const t = w.tournaments.find((x) => x.id === tournamentId);
  if (!t) return;
  if (t.status === 'scheduled') {
    t.playerEntered = false;
    return;
  }
  if (t.state && !t.state.complete) {
    withdraw(t.state, PLAYER_ID);
    t.playerWithdrawn = true;
    if (t.state.complete) finishTournament(w, t, hooks);
  }
}

/** Advance the world one day: off-screen games, tournaments, season rollover. */
export function advanceDay(w: WorldState, hooks: PlayerHooks | null) {
  ensureWorldV2(w);
  tickTournaments(w, hooks);
  const busy = new Set<string>();
  for (const t of w.tournaments) if (t.status === 'running' && t.state) for (const id of t.state.entrants) busy.add(id);
  const seasonBefore = Math.floor(w.day / DAYS_PER_SEASON);
  simulateDay(w, { busy });
  const seasonAfter = Math.floor(w.day / DAYS_PER_SEASON);
  if (seasonAfter !== seasonBefore) {
    w.season = seasonAfter;
    scheduleSeason(w, seasonAfter);
    const names = new Map(w.competitors.map((c) => [c.id, c.name]));
    presentSeasonLaurels(w, (id) => (id === PLAYER_ID ? (hooks?.playerName ?? 'You') : names.get(id) ?? id), (a) => {
      if (a.holder === PLAYER_ID) hooks?.onPlayerAward?.(a);
    });
    checkRecordsBroken(w, (e) => pushChronicle(w, e));
    // Keep only live and recent tournaments in the save; summaries persist in history.
    w.tournaments = w.tournaments.filter((t) => t.status !== 'complete' || t.season >= seasonAfter - 1 || t.playerEntered && t.season >= seasonAfter - 4);
  }
}

export function tournamentLabel(t: WorldTournament): string {
  return t.name;
}

export { matchOutcome };
export type { TournamentState };
