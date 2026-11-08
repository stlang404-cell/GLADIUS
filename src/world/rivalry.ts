/**
 * Rivalries between competitors (and between a competitor and the player)
 * and the log of notable upsets — v0.3.
 *
 * Built only from important tournament encounters, written when a tournament
 * completes (event-driven, never invented):
 *  - final        the two finalists of a knockout, or the two players of a title match
 *  - elimination  a knockout pairing that sent one of the two out
 *  - title clash  an arena championship or a regional title defence match
 *  - upset        an elimination / final / title match won by the player rated ≥ 200 lower
 * Round-robin and Swiss games are ordinary meetings and are not recorded here
 * (the per-competitor head-to-head lists cover them).
 *
 * Intensity (see `feudIntensity`) = meetings + 3·finals + 2·eliminations +
 * 5·title clashes + 2·upsets, × closeness (up to 1.5 when the wins are even),
 * × recency (half weight after two in-world years without a meeting).
 */
import { matchOutcome, type Pairing, type TournamentState } from '../tournament/formats';
import { DAYS_PER_YEAR, type Feud, type UpsetEntry } from './types';
import type { WorldState, WorldTournament } from '../game/state';

export const FEUD_CAP = 1500;
export const UPSET_CAP = 300;
/** Minimum rating gap (loser − winner, pre-event ratings) for an upset. */
export const UPSET_GAP = 200;
/** Minimum gap for a 'major-upset' Chronicle entry. */
export const MAJOR_UPSET_GAP = 250;

const keyOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

type FIdx = { arr: Feud[]; len: number; map: Map<string, Feud>; byId: Map<string, Feud[]> };
const FIDX = new WeakMap<Feud[], FIdx>();
function fidx(w: WorldState): FIdx {
  const arr = (w.feuds ??= []);
  let ix = FIDX.get(arr);
  if (!ix || arr.length < ix.len) {
    ix = { arr, len: 0, map: new Map(), byId: new Map() };
    FIDX.set(arr, ix);
  }
  for (let i = ix.len; i < arr.length; i++) {
    const f = arr[i];
    ix.map.set(keyOf(f.a, f.b), f);
    for (const id of [f.a, f.b]) {
      const l = ix.byId.get(id);
      if (l) l.push(f);
      else ix.byId.set(id, [f]);
    }
  }
  ix.len = arr.length;
  return ix;
}

export function feudIntensity(f: Feud, day: number): number {
  const raw = f.meetings + 3 * f.finals + 2 * f.eliminations + 5 * f.titleClashes + 2 * f.upsets;
  const n = f.aWins + f.bWins;
  const closeness = 1 + 0.5 * (1 - Math.abs(f.aWins - f.bWins) / (n + 1));
  const recency = 1 / (1 + Math.max(0, day - f.lastDay) / (2 * DAYS_PER_YEAR));
  return Math.round(raw * closeness * recency * 10) / 10;
}

/** The feud between two ids, if any. */
export function feudBetween(w: WorldState, a: string, b: string): Feud | undefined {
  return fidx(w).map.get(keyOf(a, b));
}
/** Feuds of one competitor (or 'player'), most intense first. */
export function feudsOf(w: WorldState, id: string, n = 10): (Feud & { intensity: number; other: string; otherName: string })[] {
  const list = fidx(w).byId.get(id) ?? [];
  return list
    .map((f) => ({ ...f, intensity: feudIntensity(f, w.day), other: f.a === id ? f.b : f.a, otherName: f.a === id ? f.bName : f.aName }))
    .sort((x, y) => y.intensity - x.intensity || (x.other < y.other ? -1 : 1))
    .slice(0, n);
}
/** The empire's most intense rivalries (all time, recency-weighted unless `allTime`). */
export function topFeuds(w: WorldState, n = 10, opts: { allTime?: boolean; includePlayer?: boolean } = {}): (Feud & { intensity: number })[] {
  const day = opts.allTime ? Infinity : w.day;
  return (w.feuds ?? [])
    .filter((f) => opts.includePlayer !== false || (f.a !== 'player' && f.b !== 'player'))
    .map((f) => ({ ...f, intensity: opts.allTime ? feudIntensity({ ...f, lastDay: Number.MAX_SAFE_INTEGER }, 0) : feudIntensity(f, day) }))
    .sort((x, y) => y.intensity - x.intensity || (x.a + x.b < y.a + y.b ? -1 : 1))
    .slice(0, n);
}

/** Keep the registry bounded (season boundary): drop the least intense, oldest entries. */
export function pruneFeuds(w: WorldState) {
  const arr = w.feuds ?? [];
  if (arr.length <= FEUD_CAP) return;
  const keep = new Set(
    arr
      .map((f) => ({ f, s: feudIntensity(f, w.day) + (f.a === 'player' || f.b === 'player' ? 1000 : 0) + 5 * f.titleClashes }))
      .sort((x, y) => y.s - x.s || (x.f.a + x.f.b < y.f.a + y.f.b ? -1 : 1))
      .slice(0, FEUD_CAP)
      .map((x) => x.f),
  );
  w.feuds = arr.filter((f) => keep.has(f));
}

export type EncounterResult = {
  /** Biggest upset of the event (elimination / final / title stage), if any. */
  upset: UpsetEntry | null;
  /** A legend (3+ arena championships) knocked out / beaten in the final or title match by a lower-rated opponent. */
  legendFall: { legend: string; by: string } | null;
};

/**
 * Record the important encounters of a completed tournament into the feud
 * registry and the upset log. Pure apart from the world mutation; idempotent
 * through `t.encounters`.
 */
export function recordEncounters(w: WorldState, t: WorldTournament, nameOf: (id: string) => string, isLegend: (id: string) => boolean, region: string): EncounterResult {
  const out: EncounterResult = { upset: null, legendFall: null };
  const st = t.state;
  if (!st || !st.complete || t.encounters) return out;
  t.encounters = true;
  const titleMatch = t.kind === 'championship' || t.kind === 'regional-defense';
  const knockout = st.format === 'single-elim' || st.format === 'double-elim';
  if (!knockout && !titleMatch) return out;
  type Enc = { a: string; b: string; final: boolean; elim: boolean; title: boolean; upset: boolean; aw: number; bw: number; lastWinner: 'a' | 'b' | null; loser: string | null; stage: UpsetEntry['stage'] };
  const encs = new Map<string, Enc>();
  const enc = (x: string, y: string): Enc => {
    const k = keyOf(x, y);
    let e = encs.get(k);
    if (!e) {
      const [a, b] = x < y ? [x, y] : [y, x];
      e = { a, b, final: false, elim: false, title: false, upset: false, aw: 0, bw: 0, lastWinner: null, loser: null, stage: 'game' };
      encs.set(k, e);
    }
    return e;
  };
  const all: Pairing[] = st.rounds.flat();
  for (const p of all) {
    if (!p.black || p.result === null || p.forfeit) continue;
    const e = enc(p.white, p.black);
    const o = matchOutcome(p);
    const winner = o === 'white' ? p.white : o === 'black' ? p.black : null;
    if (winner) {
      if (winner === e.a) e.aw++;
      else e.bw++;
      e.lastWinner = winner === e.a ? 'a' : 'b';
    }
  }
  const W = st.winner;
  const R = st.runnerUp;
  if (W && R) {
    const e = encs.get(keyOf(W, R));
    if (e) {
      if (titleMatch) {
        e.title = true;
        e.stage = 'title';
      } else {
        e.final = true;
        e.stage = 'final';
      }
      e.loser = R;
    }
  }
  if (knockout) {
    for (const [loser, r] of Object.entries(st.eliminatedAt)) {
      if (loser === R) continue; // the final is recorded above
      for (const round of [st.rounds[r], st.rounds[r - 1]]) {
        const root = round?.find((p) => !p.tiebreakOf && p.black && (p.white === loser || p.black === loser));
        if (!root) continue;
        const other = root.white === loser ? root.black! : root.white;
        const e = encs.get(keyOf(loser, other));
        if (e && !e.final) {
          e.elim = true;
          e.loser = loser;
          if (e.stage === 'game') e.stage = 'elimination';
        }
        break;
      }
    }
  }
  const ix = fidx(w);
  for (const e of encs.values()) {
    if (!e.final && !e.elim && !e.title) continue;
    const winner = e.loser ? (e.loser === e.a ? e.b : e.a) : null;
    const wr = winner ? st.ratings[winner] ?? 0 : 0;
    const lr = e.loser ? st.ratings[e.loser] ?? 0 : 0;
    const gap = lr - wr;
    if (winner && e.loser && gap >= UPSET_GAP) {
      e.upset = true;
      const u: UpsetEntry = {
        day: w.day, season: t.season, tournamentId: t.id, tournamentName: t.name, arena: t.arena, region,
        winner, winnerName: nameOf(winner), winnerRating: wr, loser: e.loser, loserName: nameOf(e.loser), loserRating: lr, gap, stage: e.stage,
      };
      const log = (w.upsets ??= []);
      log.push(u);
      if (log.length > UPSET_CAP) {
        // Keep the largest upsets (and the most recent 50) once the log is full.
        const recent = new Set(log.slice(-50));
        const kept = log.filter((x) => recent.has(x)).concat(log.filter((x) => !recent.has(x)).sort((x, y) => y.gap - x.gap).slice(0, UPSET_CAP - 50));
        w.upsets = kept.sort((x, y) => x.day - y.day || (x.tournamentId < y.tournamentId ? -1 : 1));
      }
      if (!out.upset || gap > out.upset.gap) out.upset = u;
    }
    if (winner && e.loser && isLegend(e.loser) && !isLegend(winner) && gap >= 50 && !out.legendFall) out.legendFall = { legend: e.loser, by: winner };
    const k = keyOf(e.a, e.b);
    let f = ix.map.get(k);
    if (!f) {
      f = { a: e.a, b: e.b, aName: nameOf(e.a), bName: nameOf(e.b), meetings: 0, finals: 0, eliminations: 0, titleClashes: 0, upsets: 0, aWins: 0, bWins: 0, firstDay: w.day, lastDay: w.day, lastWinner: null };
      w.feuds!.push(f);
      fidx(w);
    }
    f.aName = nameOf(e.a);
    f.bName = nameOf(e.b);
    f.meetings++;
    if (e.final) f.finals++;
    if (e.elim) f.eliminations++;
    if (e.title) f.titleClashes++;
    if (e.upset) f.upsets++;
    f.aWins += e.aw;
    f.bWins += e.bw;
    f.lastDay = w.day;
    f.lastWinner = winner === null ? null : winner === e.a ? 'a' : 'b';
  }
  return out;
}

export type { TournamentState };
