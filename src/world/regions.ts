/**
 * Regional circuits (v0.3 "Golden Age").
 *
 * Eight Roman-inspired regions organise the *geography* of the empire. They
 * are NOT arena tiers: the 24 arenas and 72 ranks still measure strength;
 * a region is where a competitor comes from and where they play their local
 * opens, their regional championship and its title defences.
 *
 * A competitor's region is derived deterministically from their province of
 * origin (names.ts PROVINCES), so it never changes and old saves can be
 * upgraded without guessing (see `regionForOrigin`).
 */
import type { Format } from '../tournament/formats';

export type RegionId = 'latium' | 'campania' | 'etruria' | 'gallia' | 'hispania' | 'africa' | 'aegyptus' | 'achaea';
/** Tournaments that belong to no region (the arena circuit and imperial events). */
export const IMPERIAL = 'imperial' as const;
export type CircuitId = RegionId | typeof IMPERIAL;

export type RegionDef = {
  id: RegionId;
  index: number;
  name: string;
  capital: string;
  /** Provinces of origin (names.ts) whose competitors belong to this region. */
  provinces: string[];
  /** Name of the regional crown (the title). */
  crown: string;
  /** Signature trophy of the regional championship. */
  trophy: string;
  /** Signature event: the regional championship, with its own format and name. */
  signature: { name: string; format: Format; size: number; matchGames?: number };
  /** Name of the region's local opens. */
  openName: string;
  motto: string;
};

export const REGIONS: RegionDef[] = [
  {
    id: 'latium', index: 0, name: 'Latium', capital: 'Roma', provinces: ['Roma'], crown: 'Crown of Latium', trophy: 'The Capitoline Wolf',
    signature: { name: 'Ludi Romani', format: 'double-elim', size: 16 }, openName: 'Open of the Seven Hills', motto: 'Where every road begins.',
  },
  {
    id: 'campania', index: 1, name: 'Campania', capital: 'Capua', provinces: ['Italia:south'], crown: 'Crown of Campania', trophy: 'The Vesuvian Cup',
    signature: { name: 'Games of Capua', format: 'single-elim', size: 16 }, openName: 'Neapolis Open', motto: 'Fire beneath the vineyards.',
  },
  {
    id: 'etruria', index: 2, name: 'Etruria', capital: 'Florentia', provinces: ['Italia:north', 'Pannonia'], crown: 'Crown of Etruria', trophy: 'The Augur\'s Lituus',
    signature: { name: 'Etruscan Round', format: 'round-robin', size: 8 }, openName: 'Tuscan Open', motto: 'Read the omens, then strike.',
  },
  {
    id: 'gallia', index: 3, name: 'Gallia', capital: 'Lugdunum', provinces: ['Gallia', 'Britannia', 'Germania'], crown: 'Crown of Gallia', trophy: 'The Golden Torc',
    signature: { name: 'Council of the Three Gauls', format: 'swiss', size: 16 }, openName: 'Lugdunum Open', motto: 'Many tribes, one board.',
  },
  {
    id: 'hispania', index: 4, name: 'Hispania', capital: 'Tarraco', provinces: ['Hispania', 'Lusitania'], crown: 'Crown of Hispania', trophy: 'The Silver of Baetica',
    signature: { name: 'Tarraco Gauntlet', format: 'double-elim', size: 8 }, openName: 'Gades Open', motto: 'Silver tested in the forge.',
  },
  {
    id: 'africa', index: 5, name: 'Africa', capital: 'Carthago', provinces: ['Africa', 'Numidia'], crown: 'Crown of Africa', trophy: 'The Lion of Carthage',
    signature: { name: 'Carthaginian Games', format: 'single-elim', size: 16 }, openName: 'Leptis Open', motto: 'The desert forgives no blunder.',
  },
  {
    id: 'aegyptus', index: 6, name: 'Aegyptus', capital: 'Alexandria', provinces: ['Aegyptus', 'Syria', 'Judaea', 'Persia', 'Armenia'], crown: 'Crown of Aegyptus', trophy: 'The Lamp of Pharos',
    signature: { name: 'Alexandrian Symposium', format: 'round-robin', size: 8 }, openName: 'Alexandria Open', motto: 'Knowledge is the sharpest blade.',
  },
  {
    id: 'achaea', index: 7, name: 'Achaea', capital: 'Corinthus', provinces: ['Graecia', 'Thracia', 'Dacia'], crown: 'Crown of Achaea', trophy: 'The Olympian Olive',
    signature: { name: 'Isthmian Games', format: 'swiss', size: 16 }, openName: 'Corinth Open', motto: 'Glory to the patient mind.',
  },
];

export const REGION_IDS: RegionId[] = REGIONS.map((r) => r.id);
export const REGION_BY_ID: Record<RegionId, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;

export function isRegionId(x: unknown): x is RegionId {
  return typeof x === 'string' && x in REGION_BY_ID;
}

/**
 * Region of a province of origin. "Italia" is split deterministically by
 * competitor serial (north → Etruria, south → Campania); unknown origins
 * belong to Latium (the capital takes everyone in).
 */
export function regionForOrigin(origin: string, serial = 0): RegionId {
  if (origin === 'Italia') return serial % 2 === 0 ? 'campania' : 'etruria';
  for (const r of REGIONS) if (r.provinces.includes(origin)) return r.id;
  return 'latium';
}

export function serialOf(id: string): number {
  const m = /^c(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

/** Title id of a region's crown. */
export function regionTitleId(r: RegionId): string {
  return `crown-${r}`;
}

/**
 * Local opens are split into two divisions by arena band so that a debutant
 * and a senator never meet in the same Swiss: Lower (arenas 0–7) and Upper
 * (arenas 8–15). The elite (16–23) compete in the imperial arena circuit.
 * `arena` of the tournament = the band's representative arena (trophy tier).
 */
export const LOCAL_BANDS: { id: 'lower' | 'upper'; lo: number; hi: number; arena: number; label: string }[] = [
  { id: 'lower', lo: 0, hi: 7, arena: 3, label: 'Lower Division' },
  { id: 'upper', lo: 8, hi: 15, arena: 11, label: 'Upper Division' },
];
