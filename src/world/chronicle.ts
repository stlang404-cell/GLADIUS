/**
 * Imperial Chronicle helpers (v0.3). The Chronicle itself is written only by
 * simulation events (calendar / sim / records / career); this module offers
 * labels and filtering for the UI. Bounded: at most CHRONICLE_CAP +
 * CHRONICLE_SLACK entries are kept; `w.chronicleArchived` counts dropped ones.
 */
import type { ChronicleEntry, ChronicleKind, ChronicleTag } from './types';
import type { WorldState } from '../game/state';
import { CHRONICLE_CAP, CHRONICLE_SLACK } from './sim';

/** Display labels of every Chronicle tag ('prodigy' is the "rising prodigy" card). */
export const CHRONICLE_TAG_LABELS: Record<ChronicleTag, string> = {
  'new-champion': 'New champion',
  comeback: 'Comeback',
  'elite-upset': 'Title upset',
  'tournament-upset': 'Tournament upset',
  'rival-promoted': 'Rival promoted',
  prodigy: 'Rising prodigy',
  breakthrough: 'Breakthrough',
  'fall-from-elite': 'Fall from the elite',
  retirement: 'Retirement',
  'record-broken': 'Record broken',
  'major-upset': 'Major upset',
  'legend-defeated': 'Legend defeated',
  'historic-defense': 'Historic defence',
  'veteran-retirement': 'Veteran retirement',
  'rating-record': 'Rating record',
  invitation: 'Invitation received',
  'regional-champion': 'Regional champion',
};

export type ChronicleFilter = {
  kind?: ChronicleKind | ChronicleKind[];
  tag?: ChronicleTag | ChronicleTag[];
  /** Region id, or 'imperial' for entries without a region. */
  region?: string;
  arena?: number;
  /** Only entries that involve the player or one of `rivals` (pass the player's rival ids). */
  onlyRivals?: boolean;
  rivals?: string[];
  /** Entries involving this competitor id (or 'player'). */
  id?: string;
  sinceDay?: number;
  /** Newest first (default true). */
  newestFirst?: boolean;
  limit?: number;
};

const asSet = <T,>(x: T | T[] | undefined) => (x === undefined ? null : new Set(Array.isArray(x) ? x : [x]));

/** Filter Chronicle entries. Pure; does not mutate `entries`. */
export function chronicleFilter(entries: readonly ChronicleEntry[], f: ChronicleFilter = {}): ChronicleEntry[] {
  const kinds = asSet(f.kind);
  const tags = asSet(f.tag);
  const rivals = f.onlyRivals ? new Set(['player', ...(f.rivals ?? [])]) : null;
  const out: ChronicleEntry[] = [];
  const newest = f.newestFirst !== false;
  const n = entries.length;
  for (let k = 0; k < n; k++) {
    const e = entries[newest ? n - 1 - k : k];
    if (kinds && !kinds.has(e.kind)) continue;
    if (tags && (!e.tag || !tags.has(e.tag))) continue;
    if (f.region !== undefined && (e.region ?? 'imperial') !== f.region) continue;
    if (f.arena !== undefined && e.arena !== f.arena) continue;
    if (f.sinceDay !== undefined && e.day < f.sinceDay) continue;
    if (f.id && !e.ids?.includes(f.id)) continue;
    if (rivals && !(e.kind === 'player' || e.ids?.some((id) => rivals.has(id)))) continue;
    out.push(e);
    if (f.limit && out.length >= f.limit) break;
  }
  return out;
}

export type ChronicleStats = { kept: number; archived: number; cap: number; maxInMemory: number; byTag: Partial<Record<ChronicleTag, number>> };
/** Size of the Chronicle (kept entries, entries dropped by the cap, counts by tag of the kept ones). */
export function chronicleStats(w: WorldState): ChronicleStats {
  const byTag: Partial<Record<ChronicleTag, number>> = {};
  for (const e of w.chronicle) if (e.tag) byTag[e.tag] = (byTag[e.tag] ?? 0) + 1;
  return { kept: w.chronicle.length, archived: w.chronicleArchived ?? 0, cap: CHRONICLE_CAP, maxInMemory: CHRONICLE_CAP + CHRONICLE_SLACK, byTag };
}
