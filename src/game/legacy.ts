/**
 * Player legacy systems (v0.2): migration, rivalry model + legitimate rival
 * preparation, legacy timeline, season-end reports, personal objectives and
 * championship privileges. Everything here is derived from or written at the
 * moment of real events; nothing is reconstructed by guessing.
 */
import type {
  Save, GameRecord, RivalRecord, TimelineEvent, SeasonReport, SeasonTracker, PlayerState,
} from './state';
import type { Competitor } from '../world/types';
import { RANKS, ARENAS, TRIAL_BYPASS_MARGIN } from '../world/arenas';
import { ensureWorldV2, awardsFor, TROPHY_BY_ID } from '../world/trophies';
import { ensureLedger } from './ledger';
import { ACHIEVEMENTS, achievementProgress } from './achievements';
import { hostCost } from './influence';
import { PLAYER_ID, playerPairing } from '../world/calendar';
import { DAYS_PER_SEASON } from '../world/types';

export const RIVAL_GAMES_CAP = 12;
export const RIVALS_CAP = 60;
export const TIMELINE_CAP = 3000;

const careerRatingOf = (s: Save) => s.player.ratings[s.settings.careerPool].rating;

// ---------------------------------------------------------------- migration

/**
 * v0.2 save migration (idempotent; safe to call on every load and before
 * every mutation). Adds only optional fields:
 *   world.awards / hall / seasonTally / worldVersion  (ensureWorldV2)
 *   player.ledger, player.rivals (seeded from the real h2h aggregates),
 *   player.timeline (seeded from persisted rankHistory, achievement unlock
 *   days and the player's tournament wins in world.history),
 *   player.seasonReports.
 */
export function ensureSaveV2(s: Save): Save {
  ensureWorldV2(s.world);
  const p = s.player;
  const L = ensureLedger(p, s.world.day);
  if (!p.rivals) {
    p.rivals = {};
    const names = new Map(s.world.competitors.map((c) => [c.id, c.name]));
    for (const [id, h] of Object.entries(p.h2h ?? {})) {
      p.rivals[id] = {
        id, name: names.get(id) ?? id, w: h.w, d: h.d, l: h.l, games: [], tournamentEncounters: 0, championshipBattles: 0,
        significance: 0, openings: {}, firstDay: h.lastDay, lastDay: h.lastDay,
      };
      p.rivals[id].significance = rawSignificance(p.rivals[id]);
    }
  }
  if (!p.timeline) {
    const tl: TimelineEvent[] = [];
    for (const r of p.rankHistory ?? []) {
      if (r.reason === 'Enlisted') tl.push({ day: r.day, kind: 'enlisted', text: `Enlisted as ${RANKS[r.rank].name} in ${ARENAS[RANKS[r.rank].arena].name}.` });
      else tl.push({ day: r.day, kind: r.reason === 'Demotion' ? 'demotion' : 'promotion', text: `${r.reason}: ${RANKS[r.rank].name}`, arena: RANKS[r.rank].arena });
    }
    for (const h of s.world.history) if (h.winner === PLAYER_ID) tl.push({ day: h.endDay, kind: 'trophy', text: `Won the ${h.name}`, ref: h.id, arena: h.arena });
    for (const [id, day] of Object.entries(p.achievements ?? {})) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) tl.push({ day, kind: 'achievement', text: `Achievement: ${a.name}`, ref: id });
    }
    tl.sort((a, b) => a.day - b.day);
    p.timeline = tl;
  }
  p.seasonReports ??= [];
  L.season ??= newTracker(s);
  return s;
}

// ---------------------------------------------------------------- timeline

export function pushTimeline(s: Save, e: TimelineEvent) {
  const tl = (s.player.timeline ??= []);
  tl.push(e);
  if (tl.length > TIMELINE_CAP) {
    // Keep the enlistment and all titles/trophies; drop the oldest minor entries.
    const minor = tl.findIndex((x) => x.kind === 'achievement' || x.kind === 'rating-milestone' || x.kind === 'notable-win' || x.kind === 'season');
    tl.splice(minor >= 0 ? minor : 1, 1);
  }
}

/** The player's legacy timeline, oldest first (stable by insertion order within a day). */
export function legacyTimeline(s: Save): TimelineEvent[] {
  const tl = s.player.timeline ?? [];
  return tl.map((e, i) => ({ e, i })).sort((a, b) => a.e.day - b.e.day || a.i - b.i).map((x) => x.e);
}

// ---------------------------------------------------------------- rivalry model

export function rawSignificance(r: Pick<RivalRecord, 'w' | 'd' | 'l' | 'tournamentEncounters' | 'championshipBattles'>): number {
  const n = r.w + r.d + r.l;
  const closeness = 1 / (1 + Math.abs(r.w - r.l));
  return Math.round((n + 2 * r.tournamentEncounters + 5 * r.championshipBattles + 3 * closeness * Math.min(n, 10) / 10 + (r.l > r.w ? 2 : 0)) * 10) / 10;
}
/** Significance with recency decay (recent rivals matter more). */
export function rivalSignificance(r: RivalRecord, day: number): number {
  return r.significance / (1 + Math.max(0, day - r.lastDay) / (2 * DAYS_PER_SEASON));
}

export function updateRivalry(s: Save, g: GameRecord, opp: Competitor, score: number, tournamentKind?: string): RivalRecord {
  const p = s.player;
  const map = (p.rivals ??= {});
  const r = (map[opp.id] ??= {
    id: opp.id, name: opp.name, w: 0, d: 0, l: 0, games: [], tournamentEncounters: 0, championshipBattles: 0, significance: 0,
    openings: {}, firstDay: s.world.day, lastDay: s.world.day,
  });
  r.name = opp.name;
  const res = score === 1 ? 'w' : score === 0 ? 'l' : 'd';
  r[res]++;
  if (g.tournamentId && !r.games.some((x) => x.tournamentId === g.tournamentId)) {
    r.tournamentEncounters++;
    if (tournamentKind === 'championship') r.championshipBattles++;
  }
  r.games.push({ gameId: g.id, day: g.day, result: res, color: g.playerColor!, opening: g.opening?.name, kind: g.kind, tournamentId: g.tournamentId });
  if (r.games.length > RIVAL_GAMES_CAP) r.games.splice(0, r.games.length - RIVAL_GAMES_CAP);
  if (g.opening?.name) {
    r.lastOpening = g.opening.name;
    const o = (r.openings[g.opening.name] ??= { w: 0, d: 0, l: 0 });
    o[res]++;
  }
  r.lastDay = s.world.day;
  r.significance = rawSignificance(r);
  const ids = Object.keys(map);
  if (ids.length > RIVALS_CAP) {
    const day = s.world.day;
    const victim = ids.filter((id) => id !== p.rivalId && id !== opp.id).sort((a, b) => rivalSignificance(map[a], day) - rivalSignificance(map[b], day))[0];
    if (victim) delete map[victim];
  }
  return r;
}

/** Ranked rivalries for a rivals screen (most significant first). */
export function rivalries(s: Save, n = 10): (RivalRecord & { score: number })[] {
  const day = s.world.day;
  return Object.values(s.player.rivals ?? {}).map((r) => ({ ...r, score: rivalSignificance(r, day) })).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, n);
}

export type RivalPrep = { avoidLines?: string[]; preferLines?: string[]; basis?: string };

/**
 * Legitimate preparation against the player's tendencies (opening names,
 * consumed by the engine's chooseMove). Only opponents who have actually
 * faced the player (≥ 2 games), or elite opponents (arena ≥ 8) who can study
 * the player's public games, prepare. Deterministic; no strength change:
 *   avoidLines  — openings where the player has scored ≥ 60% (vs this
 *                 opponent with ≥ 1 game, or overall with ≥ 3 games)
 *   preferLines — openings where the player has scored ≤ 40% (≥ 2 games)
 * The number of lines grows with the opponent's arena (1–3).
 */
export function rivalPrep(s: Save, competitorId: string): RivalPrep {
  const c = s.world.competitors.find((x) => x.id === competitorId);
  if (!c) return {};
  const r = s.player.rivals?.[competitorId];
  const met = r ? r.w + r.d + r.l : 0;
  const arena = RANKS[c.rank].arena;
  if (met < 2 && arena < 8) return {};
  const depth = 1 + (arena >= 6 ? 1 : 0) + (arena >= 9 ? 1 : 0);
  const sc = (o: { w: number; d: number; l: number }) => (o.w + o.d / 2) / Math.max(1, o.w + o.d + o.l);
  const n = (o: { w: number; d: number; l: number }) => o.w + o.d + o.l;
  const avoid = new Map<string, number>();
  const prefer = new Map<string, number>();
  for (const [name, o] of Object.entries(r?.openings ?? {})) {
    if (sc(o) >= 0.6) avoid.set(name, sc(o) + n(o) / 100 + 1);
    else if (sc(o) <= 0.4 && n(o) >= 2) prefer.set(name, 1 - sc(o) + n(o) / 100 + 1);
  }
  for (const [name, o] of Object.entries(s.player.openingsPlayed ?? {})) {
    if (n(o) >= 3 && sc(o) >= 0.6 && !avoid.has(name)) avoid.set(name, sc(o) + n(o) / 100);
    if (n(o) >= 2 && sc(o) <= 0.4 && !prefer.has(name) && !avoid.has(name)) prefer.set(name, 1 - sc(o) + n(o) / 100);
  }
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, depth).map(([k]) => k);
  const out: RivalPrep = { basis: met >= 2 ? `${met} games against you` : 'study of your public games' };
  const a = top(avoid);
  const pf = top(prefer);
  if (a.length) out.avoidLines = a;
  if (pf.length) out.preferLines = pf;
  return out;
}

// ---------------------------------------------------------------- season reports

export function newTracker(s: Save): SeasonTracker {
  const r = careerRatingOf(s);
  return {
    season: s.world.season, startDay: s.world.day, ratingStart: r, peak: r, rankStart: s.player.rank,
    games: 0, w: 0, d: 0, l: 0, awardsStart: awardsFor(s.world, PLAYER_ID).length, vs: {},
  };
}

export function trackSeasonGame(s: Save, g: GameRecord, score: number, oppId: string | null, oppName: string, oppRating: number) {
  const L = ensureLedger(s.player, s.world.day);
  const t = (L.season ??= newTracker(s));
  t.games++;
  if (score === 1) t.w++;
  else if (score === 0) t.l++;
  else t.d++;
  t.peak = Math.max(t.peak, careerRatingOf(s));
  if (oppId) {
    const v = (t.vs[oppId] ??= [0, 0, 0]);
    v[score === 1 ? 0 : score === 0 ? 2 : 1]++;
  }
  if (score === 1 && g.rated && oppId && (!t.bestWin || oppRating > t.bestWin.oppRating)) {
    t.bestWin = { gameId: g.id, oppId, oppName, oppRating, day: g.day };
  }
}

/** Close the running season tracker into an appended SeasonReport and start the next one. */
export function closeSeason(s: Save): SeasonReport {
  const L = ensureLedger(s.player, s.world.day);
  const t = (L.season ??= newTracker(s));
  const endDay = s.world.day;
  const mine = awardsFor(s.world, PLAYER_ID);
  const rivalId = s.player.rivalId;
  const rv = rivalId ? t.vs[rivalId] : undefined;
  const rivalName = rivalId ? (s.world.competitors.find((c) => c.id === rivalId)?.name ?? s.player.rivals?.[rivalId]?.name ?? rivalId) : '';
  const report: SeasonReport = {
    season: t.season, startDay: t.startDay, endDay,
    ratingStart: t.ratingStart, ratingEnd: careerRatingOf(s), peak: Math.max(t.peak, careerRatingOf(s)),
    games: t.games, w: t.w, d: t.d, l: t.l,
    tournaments: s.world.history.filter((h) => h.playerPlace !== undefined && h.endDay >= t.startDay && h.endDay <= endDay).map((h) => ({ id: h.id, name: h.name, place: h.playerPlace ?? null, arena: h.arena })),
    trophies: mine.slice(t.awardsStart).map((a) => a.awardId),
    rankStart: t.rankStart, rankEnd: s.player.rank, rankChange: s.player.rank - t.rankStart,
    rival: rivalId ? { id: rivalId, name: rivalName, w: rv?.[0] ?? 0, d: rv?.[1] ?? 0, l: rv?.[2] ?? 0 } : null,
    bestWin: t.bestWin ?? null,
  };
  (s.player.seasonReports ??= []).push(report);
  L.season = newTracker(s);
  pushTimeline(s, {
    day: endDay, kind: 'season', ref: `season-${report.season}`,
    text: `Season ${report.season + 1} ends: ${report.w}-${report.d}-${report.l}, rating ${report.ratingStart} → ${report.ratingEnd}${report.trophies.length ? `, ${report.trophies.length} trophies` : ''}.`,
  });
  return report;
}

/** The latest season-end report not yet shown (UI ceremony). */
export function latestSeasonReport(s: Save): SeasonReport | null {
  const r = s.player.seasonReports ?? [];
  return r.length ? r[r.length - 1] : null;
}

// ---------------------------------------------------------------- privileges

export const HOST_DISCOUNT = 0.25;
export type ChampionshipPrivileges = {
  titles: { titleId: string; name: string; arena: number; trophy: string; since: number; defenses: number }[];
  autoSeeded: boolean;
  hostDiscount: number;
  standards: string[]; // trophy names to display as banners
};
/** Privileges of a reigning title holder (auto-seeding, hosting discount, standards). */
export function championshipPrivileges(s: Save): ChampionshipPrivileges {
  const titles = s.world.titles.filter((t) => t.holder === PLAYER_ID).map((t) => ({ titleId: t.id, name: t.name, arena: t.arena, trophy: ARENAS[t.arena].trophy, since: t.since, defenses: t.defenses }));
  return { titles, autoSeeded: titles.length > 0, hostDiscount: titles.length ? HOST_DISCOUNT : 0, standards: titles.map((t) => t.trophy) };
}
/** Influence cost to host an invitational in the player's arena (25% off for title holders). */
export function hostCostFor(s: Save): number {
  const base = hostCost(RANKS[s.player.rank].arena);
  return Math.round(base * (1 - championshipPrivileges(s).hostDiscount));
}

// ---------------------------------------------------------------- objectives

export type ObjectiveKind =
  | 'trial' | 'tournament-round' | 'defend-title' | 'title-challenge' | 'enter-tournament' | 'next-rank'
  | 'beat-rival' | 'peak-record' | 'achievement' | 'training' | 'play';
export type Objective = {
  id: string;
  kind: ObjectiveKind;
  title: string;
  detail: string;
  priority: number;
  primary?: boolean;
  progress?: { current: number; target: number };
  ref?: string; // tournament id, competitor id, achievement id, invitation id ...
};

/**
 * Ranked list of current concrete goals. Never empty: index 0 is the primary
 * recommendation (`primary: true`); the rest are alternatives (max 5 total).
 * Pure: reads the save only.
 */
export function objectives(s: Save): Objective[] {
  const p = s.player;
  const w = s.world;
  const out: Objective[] = [];
  const rating = careerRatingOf(s);
  const arena = RANKS[p.rank].arena;

  // Your tournament round is waiting.
  for (const t of w.tournaments) {
    const pr = playerPairing(t);
    if (!pr) continue;
    const opp = w.competitors.find((c) => c.id === (pr.white === PLAYER_ID ? pr.black : pr.white));
    out.push({ id: `round-${t.id}`, kind: 'tournament-round', title: `Play round ${pr.round + 1} of the ${t.name}`, detail: opp ? `vs ${opp.name} (${opp.rating})` : 'Your pairing is ready', priority: 100, ref: t.id });
    break;
  }
  // Defend your title.
  for (const title of w.titles.filter((x) => x.holder === PLAYER_ID)) {
    const t = w.tournaments.find((x) => x.kind === 'championship' && x.titleId === title.id && x.status !== 'complete');
    out.push({ id: `defend-${title.id}`, kind: 'defend-title', title: `Defend ${title.name}`, detail: t ? (t.status === 'running' ? 'The title match is under way.' : `Title match begins on day ${t.startDay}.`) : `Held since day ${title.since} · ${title.defenses} defences`, priority: 90, ref: t?.id ?? title.id, progress: { current: title.defenses, target: title.defenses + 1 } });
  }
  // Title challenge invitation.
  const champInv = w.invitations.find((i) => i.kind === 'championship');
  if (champInv) out.push({ id: `challenge-${champInv.id}`, kind: 'title-challenge', title: champInv.title, detail: champInv.detail, priority: 88, ref: champInv.tournamentId });
  // Promotion trial.
  if (p.trial) {
    const ready = p.ratedGames >= p.trial.cooldownUntilGames;
    out.push({ id: 'trial', kind: 'trial', title: `Win your Promotion Trial into ${ARENAS[RANKS[p.trial.toRank].arena].name}`, detail: ready ? `Victory promotes you to ${RANKS[p.trial.toRank].name}.` : `Available after ${p.trial.cooldownUntilGames - p.ratedGames} more rated game(s).`, priority: ready ? 95 : 60, ref: w.invitations.find((i) => i.kind === 'trial')?.id });
  }
  // Tournament registration.
  const reg = w.invitations.find((i) => i.tournamentId && i.kind !== 'championship');
  if (reg) out.push({ id: `enter-${reg.tournamentId}`, kind: 'enter-tournament', title: `Enter the ${reg.title}`, detail: `${reg.detail} · ${reg.stakes}`, priority: 70, ref: reg.tournamentId });
  // Next rank.
  if (p.rank < RANKS.length - 1 && !p.trial) {
    const next = RANKS[p.rank + 1];
    const crossing = next.arena > arena;
    const need = next.floor - rating;
    out.push({
      id: 'next-rank', kind: 'next-rank', title: `Reach ${next.name}`,
      detail: crossing ? `Reach ${next.floor} to earn a Promotion Trial into ${ARENAS[next.arena].name} (or ${next.floor + TRIAL_BYPASS_MARGIN} to be promoted outright).` : need > 0 ? `${need} rating points to go (floor ${next.floor}).` : 'Within reach — keep winning rated games.',
      priority: need <= 40 ? 65 : 45, progress: { current: Math.max(0, rating - RANKS[p.rank].floor), target: Math.max(1, next.floor - RANKS[p.rank].floor) },
    });
  }
  // Beat your rival.
  if (p.rivalId) {
    const r = p.rivals?.[p.rivalId];
    const c = w.competitors.find((x) => x.id === p.rivalId && x.retiredDay === null);
    if (c && r) {
      const behind = r.l >= r.w;
      out.push({ id: `rival-${c.id}`, kind: 'beat-rival', title: `${behind ? 'Overcome' : 'Stay ahead of'} your rival ${c.name}`, detail: `Record ${r.w}-${r.d}-${r.l} · rated ${c.rating}${r.lastOpening ? ` · they expect your ${r.lastOpening}` : ''}`, priority: behind ? 55 : 40, ref: c.id });
    }
  }
  // Personal best.
  const est = Object.values(p.ratings).filter((x) => x.games >= 20);
  const pool = p.ratings[s.settings.careerPool];
  if (pool.games >= 20 && pool.peak - pool.rating <= 60 && pool.peak > 0) {
    out.push({ id: 'peak', kind: 'peak-record', title: `Set a new personal best (peak ${pool.peak})`, detail: pool.rating >= pool.peak ? 'You are at your peak — every win sets a new record.' : `${pool.peak - pool.rating + 1} points from a new peak.`, priority: 50, progress: { current: pool.rating, target: pool.peak + 1 } });
  } else if (!est.length) {
    out.push({ id: 'placement', kind: 'play', title: 'Complete your placement games', detail: `${Math.max(0, 20 - pool.games)} rated games until your rating is established.`, priority: 58, progress: { current: pool.games, target: 20 } });
  }
  // Achievement closest to completion (counters only).
  const near = achievementProgress(s, { progressOnly: true }).filter((a) => a.unlockedDay === null && a.def.progress && a.fraction >= 0.6 && a.fraction < 1).sort((a, b) => b.fraction - a.fraction || (a.def.id < b.def.id ? -1 : 1))[0];
  if (near) out.push({ id: `ach-${near.def.id}`, kind: 'achievement', title: `Achievement: ${near.def.name}`, detail: near.def.desc, priority: 35 + Math.round(near.fraction * 10), progress: { current: Math.floor(near.current), target: near.target }, ref: near.def.id });
  // Weakness training: unsolved personal positions, or a losing opening.
  const unsolved = s.coach.positions.filter((x) => x.solved === 0);
  const weakOpening = Object.entries(p.openingsPlayed ?? {}).map(([name, o]) => ({ name, n: o.w + o.d + o.l, sc: (o.w + o.d / 2) / Math.max(1, o.w + o.d + o.l) })).filter((o) => o.n >= 3 && o.sc < 0.4).sort((a, b) => a.sc - b.sc || b.n - a.n)[0];
  if (unsolved.length >= 3) {
    const theme = mostCommon(unsolved.map((x) => x.theme));
    out.push({ id: 'training', kind: 'training', title: `Train your ${theme} positions`, detail: `${unsolved.length} positions from your own mistakes await in the Academy.`, priority: 30 });
  } else if (weakOpening) {
    out.push({ id: `opening-${weakOpening.name}`, kind: 'training', title: `Repair your ${weakOpening.name}`, detail: `You score ${Math.round(weakOpening.sc * 100)}% in ${weakOpening.n} games with it.`, priority: 28 });
  }
  // Always at least one goal.
  out.push({ id: 'play', kind: 'play', title: 'Play a rated game', detail: `An even match in ${ARENAS[arena].name} moves your career forward.`, priority: 1 });
  const seen = new Set<string>();
  const ranked = out.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true))).sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1)).slice(0, 5);
  ranked[0].primary = true;
  return ranked;
}

function mostCommon<T extends string>(xs: T[]): T {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
}

// ---------------------------------------------------------------- player trophies

export type PlayerTrophy = { awardId: string; name: string; category: string; tier: string; day: number; season: number; arena: number; result: string; finalOpponentName?: string; current: boolean; defenseNumber?: number };
/** The player's trophy hall from the permanent award registry (newest first). */
export function playerTrophies(s: Save): PlayerTrophy[] {
  return [...awardsFor(s.world, PLAYER_ID)].reverse().map((a) => {
    const d = TROPHY_BY_ID[a.defId];
    return { awardId: a.awardId, name: d?.name ?? a.defId, category: d?.category ?? '', tier: d?.tier ?? 'common', day: a.day, season: a.season, arena: a.arena, result: a.result, finalOpponentName: a.finalOpponentName, current: a.current, defenseNumber: a.defenseNumber };
  });
}

export type { PlayerState };
