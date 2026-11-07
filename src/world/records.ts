/**
 * Hall of Records and historical leaderboards.
 *
 * Sources (all real simulation outcomes):
 *  - the permanent award registry (championships, event wins, upsets),
 *  - title reigns (`w.reigns`, never pruned),
 *  - live competitors, plus compact LegendEntry snapshots of competitors that
 *    the season-boundary archive pruning removes (sim.ts calls
 *    `archiveLegends` before dropping anyone), so records survive retirement
 *    and pruning,
 *  - a max-snapshot of the most-played pairings (`hall.rivalries`).
 */
import type { Competitor, HallOfRecords, LegendEntry, RivalryEntry, AwardRecord, ChronicleEntry } from './types';
import type { WorldState, PlayerState } from '../game/state';
import { awardsFor, allAwards, isVictory, trophyPrestige, emptyHall, PLAYER } from './trophies';

const LEGEND_TOP = 40;
const RIVALRY_TOP = 40;

export function legendOf(c: Competitor): LegendEntry {
  return {
    id: c.id, name: c.name, peak: c.peak, peakRank: c.peakRank, games: c.games, w: c.w, d: c.d, l: c.l,
    tournamentsWon: c.tournamentsWon, championships: c.championships, retiredDay: c.retiredDay, debutDay: c.debutDay,
  };
}

const winPct = (x: { w: number; d: number; l: number }) => {
  const n = x.w + x.d + x.l;
  return n ? x.w / n : 0;
};
const LEGEND_METRICS: ((l: LegendEntry) => number)[] = [
  (l) => l.peak,
  (l) => l.championships,
  (l) => l.tournamentsWon,
  (l) => l.games,
  (l) => (l.games >= 200 ? winPct(l) : 0),
];

/**
 * Archive competitors about to be pruned. Keeps the union of the top
 * LEGEND_TOP entries for each record metric, so a record-holder is never lost.
 */
export function archiveLegends(hall: HallOfRecords, removed: Competitor[]) {
  if (!removed.length) return;
  const byId = new Map(hall.legends.map((l) => [l.id, l]));
  for (const c of removed) byId.set(c.id, legendOf(c));
  const all = [...byId.values()];
  const keep = new Set<string>();
  for (const m of LEGEND_METRICS) {
    const sorted = [...all].sort((a, b) => m(b) - m(a) || (a.id < b.id ? -1 : 1));
    for (const l of sorted.slice(0, LEGEND_TOP)) if (m(l) > 0) keep.add(l.id);
  }
  hall.legends = all.filter((l) => keep.has(l.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Update the max-snapshot of most-played pairings from competitors' head-to-head lists. */
export function snapshotRivalries(hall: HallOfRecords, competitors: Competitor[], day: number) {
  const names = new Map(competitors.map((c) => [c.id, c.name]));
  const map = new Map(hall.rivalries.map((r) => [`${r.a}|${r.b}`, r]));
  for (const c of competitors) {
    for (const h of c.h2h) {
      if (h.id === PLAYER || !names.has(h.id)) continue;
      const [a, b] = c.id < h.id ? [c.id, h.id] : [h.id, c.id];
      const games = h.w + h.d + h.l;
      const key = `${a}|${b}`;
      const prev = map.get(key);
      if (prev && prev.games >= games) continue;
      const aw = c.id === a ? h.w : h.l;
      const bw = c.id === a ? h.l : h.w;
      map.set(key, { a, b, aName: names.get(a)!, bName: names.get(b)!, games, aw, d: h.d, bw, day });
    }
  }
  hall.rivalries = [...map.values()].sort((x, y) => y.games - x.games || (x.a + x.b < y.a + y.b ? -1 : 1)).slice(0, RIVALRY_TOP);
}

// ---------------------------------------------------------------- prestige

/**
 * Derived competitor prestige: trophy prestige from the award registry,
 * +20 per title currently held, + (peak − 1200)/20. Used for invitations,
 * seeding and challenger selection. Never affects playing strength.
 */
export function competitorPrestige(w: WorldState, c: Competitor): number {
  return Math.round(trophyPrestige(w, c.id) + 20 * c.titles.length + Math.max(0, c.peak - 1200) / 20);
}

// ---------------------------------------------------------------- leaderboards

export type RecordRow = { holder: string; name: string; value: number; detail?: string; retired?: boolean };
export type RecordKey =
  | 'championships' | 'consecutive-defenses' | 'longest-reign' | 'tournament-wins' | 'arena-championships'
  | 'peak-elo' | 'rivalries' | 'win-pct' | 'upsets';

export const RECORD_LABELS: Record<RecordKey, string> = {
  championships: 'Most championships',
  'consecutive-defenses': 'Most consecutive title defences',
  'longest-reign': 'Longest reign (days)',
  'tournament-wins': 'Most event victories',
  'arena-championships': 'Championships in most arenas',
  'peak-elo': 'Highest peak Elo',
  rivalries: 'Greatest rivalries (games)',
  'win-pct': 'Best career win % (200+ games)',
  upsets: 'Notable title upsets (rating gap)',
};

type PersonLite = { id: string; name: string; peak: number; w: number; d: number; l: number; retired: boolean };

function people(w: WorldState, player?: PlayerState): PersonLite[] {
  const map = new Map<string, PersonLite>();
  for (const l of w.hall?.legends ?? []) map.set(l.id, { id: l.id, name: l.name, peak: l.peak, w: l.w, d: l.d, l: l.l, retired: true });
  for (const c of w.competitors) map.set(c.id, { id: c.id, name: c.name, peak: c.peak, w: c.w, d: c.d, l: c.l, retired: c.retiredDay !== null });
  if (player) {
    const peak = Math.max(...Object.values(player.ratings).filter((r) => r.games >= 20).map((r) => r.peak), 0);
    map.set(PLAYER, { id: PLAYER, name: player.name, peak, w: player.w, d: player.d, l: player.l, retired: false });
  }
  return [...map.values()];
}

function topN(rows: RecordRow[], n: number): RecordRow[] {
  return rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value || (a.holder < b.holder ? -1 : 1)).slice(0, n);
}

function countBy(awards: AwardRecord[], pred: (a: AwardRecord) => boolean) {
  const m = new Map<string, { n: number; name: string; set: Set<number> }>();
  for (const a of awards) {
    if (!pred(a)) continue;
    const e = m.get(a.holder) ?? { n: 0, name: a.holderName, set: new Set<number>() };
    e.n++;
    e.set.add(a.arena);
    e.name = a.holderName;
    m.set(a.holder, e);
  }
  return m;
}

/**
 * Top-N leaderboard for a record. Includes the player (pass `player`) and
 * retired / pruned competitors. Pure.
 */
export function recordLeaders(w: WorldState, key: RecordKey, n = 10, player?: PlayerState): RecordRow[] {
  const awards = allAwards(w);
  const retiredIds = new Set([...(w.hall?.legends ?? []).map((l) => l.id), ...w.competitors.filter((c) => c.retiredDay !== null).map((c) => c.id)]);
  const pname = (id: string, fallback: string) => (id === PLAYER && player ? player.name : fallback);
  switch (key) {
    case 'championships': {
      const m = countBy(awards, (a) => a.defId.startsWith('sig-'));
      return topN([...m].map(([holder, e]) => ({ holder, name: pname(holder, e.name), value: e.n, retired: retiredIds.has(holder) })), n);
    }
    case 'arena-championships': {
      const m = countBy(awards, (a) => a.defId.startsWith('sig-'));
      return topN([...m].map(([holder, e]) => ({ holder, name: pname(holder, e.name), value: e.set.size, retired: retiredIds.has(holder) })), n);
    }
    case 'tournament-wins': {
      const m = countBy(awards, isVictory);
      return topN([...m].map(([holder, e]) => ({ holder, name: pname(holder, e.name), value: e.n, retired: retiredIds.has(holder) })), n);
    }
    case 'consecutive-defenses': {
      const best = new Map<string, RecordRow>();
      for (const r of w.reigns) {
        const cur = best.get(r.holder);
        if (!cur || r.defenses > cur.value) best.set(r.holder, { holder: r.holder, name: pname(r.holder, r.holderName), value: r.defenses, detail: r.titleId, retired: retiredIds.has(r.holder) });
      }
      return topN([...best.values()], n);
    }
    case 'longest-reign': {
      const best = new Map<string, RecordRow>();
      for (const r of w.reigns) {
        const len = (r.to ?? w.day) - r.from;
        const cur = best.get(r.holder);
        if (!cur || len > cur.value) best.set(r.holder, { holder: r.holder, name: pname(r.holder, r.holderName), value: len, detail: r.titleId + (r.to === null ? ' (reigning)' : ''), retired: retiredIds.has(r.holder) });
      }
      return topN([...best.values()], n);
    }
    case 'peak-elo':
      return topN(people(w, player).map((p) => ({ holder: p.id, name: p.name, value: p.peak, retired: p.retired })), n);
    case 'win-pct':
      return topN(people(w, player).filter((p) => p.w + p.d + p.l >= 200).map((p) => ({ holder: p.id, name: p.name, value: Math.round(winPct(p) * 1000) / 10, detail: `${p.w}-${p.d}-${p.l}`, retired: p.retired })), n);
    case 'rivalries': {
      const rows: RecordRow[] = (w.hall?.rivalries ?? []).map((r) => ({ holder: `${r.a}|${r.b}`, name: `${r.aName} vs ${r.bName}`, value: r.games, detail: `${r.aw}-${r.d}-${r.bw}` }));
      if (player?.h2h) {
        const names = new Map(w.competitors.map((c) => [c.id, c.name]));
        for (const [id, h] of Object.entries(player.h2h)) {
          const g = h.w + h.d + h.l;
          rows.push({ holder: `${PLAYER}|${id}`, name: `${player.name} vs ${names.get(id) ?? player.rivals?.[id]?.name ?? id}`, value: g, detail: `${h.w}-${h.d}-${h.l}` });
        }
      }
      return topN(rows, n);
    }
    case 'upsets': {
      const rows: RecordRow[] = [];
      for (const a of awards) {
        if (!a.defId.startsWith('sig-') || a.opponentRating === undefined || a.holderRating === undefined || a.defenseNumber) continue;
        const gap = a.opponentRating - a.holderRating;
        if (gap >= 150) rows.push({ holder: a.holder, name: pname(a.holder, a.holderName), value: gap, detail: `${a.awardId}`, retired: retiredIds.has(a.holder) });
      }
      return topN(rows, n);
    }
  }
}

export const ALL_RECORD_KEYS: RecordKey[] = ['championships', 'consecutive-defenses', 'longest-reign', 'tournament-wins', 'arena-championships', 'peak-elo', 'rivalries', 'win-pct', 'upsets'];

/** All leaderboards at once (for a Hall of Records screen). */
export function hallOfRecords(w: WorldState, n = 5, player?: PlayerState): Record<RecordKey, RecordRow[]> {
  const out = {} as Record<RecordKey, RecordRow[]>;
  for (const k of ALL_RECORD_KEYS) out[k] = recordLeaders(w, k, n, player);
  return out;
}

/** Monotone record keys tracked for "record broken" Chronicle entries. */
const TRACKED: RecordKey[] = ['championships', 'longest-reign', 'tournament-wins', 'peak-elo', 'consecutive-defenses'];

/**
 * Season-boundary record check: if a different holder now tops a tracked
 * record with a strictly higher value, write one 'record-broken' Chronicle
 * entry. Returns the entries pushed.
 */
export function checkRecordsBroken(w: WorldState, push: (e: ChronicleEntry) => void): ChronicleEntry[] {
  w.hall ??= emptyHall();
  const out: ChronicleEntry[] = [];
  for (const k of TRACKED) {
    const top = recordLeaders(w, k, 1)[0];
    if (!top) continue;
    const prev = w.hall.best[k];
    if (!prev) {
      w.hall.best[k] = { holder: top.holder, name: top.name, value: top.value, day: w.day };
      continue;
    }
    if (top.value > prev.value) {
      if (top.holder !== prev.holder && prev.value > 0) {
        const e: ChronicleEntry = { day: w.day, kind: 'record', tag: 'record-broken', ids: [top.holder], text: `${top.name} breaks the record — ${RECORD_LABELS[k]}: ${top.value} (was ${prev.value}, ${prev.name}).` };
        push(e);
        out.push(e);
      }
      w.hall.best[k] = { holder: top.holder, name: top.name, value: top.value, day: w.day };
    }
  }
  return out;
}

export type CompetitorHonours = {
  awards: AwardRecord[];
  victories: number;
  championships: number;
  defenses: number;
  arenasConquered: number[];
  currentTitles: string[];
  prestige: number;
  record: { w: number; d: number; l: number; games: number; peak: number };
};
/** Everything a competitor profile needs to show real trophies and records. */
export function competitorHonours(w: WorldState, id: string): CompetitorHonours | null {
  const c = w.competitors.find((x) => x.id === id);
  const leg = c ? null : w.hall?.legends.find((l) => l.id === id);
  if (!c && !leg) return null;
  const awards = awardsFor(w, id);
  return {
    awards: [...awards].reverse(),
    victories: awards.filter(isVictory).length,
    championships: awards.filter((a) => a.defId.startsWith('sig-')).length,
    defenses: awards.filter((a) => a.defId.startsWith('defense-')).length,
    arenasConquered: [...new Set(awards.filter((a) => a.defId.startsWith('sig-')).map((a) => a.arena))].sort((a, b) => a - b),
    currentTitles: c ? [...c.titles] : [],
    prestige: c ? competitorPrestige(w, c) : trophyPrestige(w, id),
    record: c ? { w: c.w, d: c.d, l: c.l, games: c.games, peak: c.peak } : { w: leg!.w, d: leg!.d, l: leg!.l, games: leg!.games, peak: leg!.peak },
  };
}

export type { RivalryEntry };
