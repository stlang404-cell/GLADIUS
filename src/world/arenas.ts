/**
 * The twenty-four arenas and seventy-two competitive grades of the empire (v0.3).
 *
 * v0.3 expansion: the 12 v0.2 arenas keep their identity and Elo floor and move
 * to index 2·i (the Eternal Throne, old 11, becomes 23); 12 new arenas fill the
 * steps between them. Ranks are 24 titles × 3 grades (III → II → I), grouped in
 * four families that read as one coherent ladder:
 *   arenas 0–5   gladiatorial school & recruits  (Tiro … Decanus)
 *   arenas 6–11  legion officers                 (Signifer … Praefectus)
 *   arenas 12–17 civic magistracies (cursus honorum: Quaestor … Censor)
 *   arenas 18–23 imperial dignities              (Legatus … Caesar Aeternus)
 * Rank index = 3·arena + tier; stable string ids `r<arena>-<tier>` (`rankId`).
 * Old saves (36 ranks) are remapped by `migrateRankIndex` (see world/migrate.ts).
 * The ordering is a Roman-inspired competitive ladder, not a historical
 * cursus honorum.
 */

export type Palette = {
  sky: [string, string]; // top, bottom gradient
  stone: string;
  stoneDark: string;
  accent: string;
  accent2: string;
  light: string; // light board squares
  dark: string; // dark board squares
  frame: string;
  pieceLight: string;
  pieceDark: string;
  pieceMetal: number; // 0..1 material metalness for 3D
  ink: string; // readable text color over backdrop
};

export type ArenaDef = {
  index: number;
  id: string;
  name: string;
  motto: string;
  architecture: string;
  trophy: string;
  floor: number; // minimum Elo for the arena
  palette: Palette;
  ambience: { base: number; type: OscillatorType; tempo: number }; // procedural ambient identity
  /** v0.3: index of this arena in the v0.2 12-arena layout (absent for the 12 arenas added in v0.3). */
  legacyIndex?: number;
};

export const ARENAS: ArenaDef[] = [
  {
    index: 0, id: 'dust-pits', name: 'The Dust Pits', motto: 'Every legend begins in the sand.',
    architecture: 'ludus', trophy: 'The Wooden Rudis', floor: 0,
    palette: { sky: ['#f2c58a', '#d9865a'], stone: '#c89b6d', stoneDark: '#7a4a2c', accent: '#b4442b', accent2: '#e8b04b', light: '#ecd3a6', dark: '#b07a4f', frame: '#6b3f22', pieceLight: '#f3e3c4', pieceDark: '#5a3420', pieceMetal: 0.05, ink: '#2b160b' },
    ambience: { base: 110, type: 'triangle', tempo: 0.6 },
    legacyIndex: 0,
  },
  {
    index: 1, id: 'ludus-yard', name: 'The Ludus Yard', motto: 'Sweat in the yard, glory in the arena.',
    architecture: 'ludus-yard', trophy: 'The Gladiator Helm', floor: 550,
    palette: { sky: ['#f4d09a', '#e0a070'], stone: '#d6b080', stoneDark: '#8a5a34', accent: '#a84a2c', accent2: '#e0b860', light: '#efd9b0', dark: '#b98a5c', frame: '#704426', pieceLight: '#f6e8cc', pieceDark: '#62381f', pieceMetal: 0.1, ink: '#2a170b' },
    ambience: { base: 116, type: 'triangle', tempo: 0.7 },
  },
  {
    index: 2, id: 'legion-camp', name: 'The Legion Camp', motto: 'Discipline before glory.',
    architecture: 'camp', trophy: 'The Vexillum', floor: 700,
    palette: { sky: ['#9fd0e8', '#e9d9a8'], stone: '#a67c52', stoneDark: '#5a3b22', accent: '#c0392b', accent2: '#2f6db3', light: '#efe2c2', dark: '#8f6a45', frame: '#4b2e19', pieceLight: '#f4ead2', pieceDark: '#7a1f1a', pieceMetal: 0.1, ink: '#1f1208' },
    ambience: { base: 98, type: 'sine', tempo: 0.8 },
    legacyIndex: 1,
  },
  {
    index: 3, id: 'rhine-frontier', name: 'The Rhine Frontier', motto: 'Timber walls, iron resolve.',
    architecture: 'frontier-fort', trophy: 'The Limes Palisade', floor: 800,
    palette: { sky: ['#8fb4c8', '#d8d2b0'], stone: '#8a6a48', stoneDark: '#4a3420', accent: '#9c3a2a', accent2: '#4a7a4a', light: '#e6dcc0', dark: '#7f6448', frame: '#3e2a18', pieceLight: '#efe4cc', pieceDark: '#3a2a1c', pieceMetal: 0.2, ink: '#1a1208' },
    ambience: { base: 90, type: 'sawtooth', tempo: 0.6 },
  },
  {
    index: 4, id: 'iron-citadel', name: 'The Iron Citadel', motto: 'Hold the wall. Hold the file.',
    architecture: 'fortress', trophy: 'The Iron Aquila', floor: 900,
    palette: { sky: ['#6d8aa6', '#c9b79a'], stone: '#7d8590', stoneDark: '#3b4048', accent: '#a33b2b', accent2: '#d6a54a', light: '#d8d6d0', dark: '#6f7680', frame: '#2c3036', pieceLight: '#e7e4dc', pieceDark: '#2f3338', pieceMetal: 0.55, ink: '#15181c' },
    ambience: { base: 82, type: 'sawtooth', tempo: 0.5 },
    legacyIndex: 2,
  },
  {
    index: 5, id: 'harbour-ostia', name: 'The Harbour of Ostia', motto: 'Every ship brings a new challenger.',
    architecture: 'harbour', trophy: 'The Golden Anchor', floor: 1000,
    palette: { sky: ['#a8d8ee', '#f0e4c0'], stone: '#d8c4a0', stoneDark: '#7a6448', accent: '#2a6a9a', accent2: '#d8a640', light: '#f2e8d0', dark: '#8fa6b0', frame: '#5a4a34', pieceLight: '#fbf4e4', pieceDark: '#24485e', pieceMetal: 0.3, ink: '#16222c' },
    ambience: { base: 120, type: 'sine', tempo: 0.8 },
  },
  {
    index: 6, id: 'gladiators-court', name: "The Gladiator's Court", motto: 'The crowd remembers courage.',
    architecture: 'court', trophy: 'The Golden Rudis', floor: 1100,
    palette: { sky: ['#ffb36b', '#f2e0b0'], stone: '#e0b77e', stoneDark: '#8c5a2b', accent: '#c8302a', accent2: '#2c7a7b', light: '#f7e6c4', dark: '#c48a52', frame: '#7a3e1a', pieceLight: '#fff1d6', pieceDark: '#8a2a1d', pieceMetal: 0.2, ink: '#2a1408' },
    ambience: { base: 130, type: 'triangle', tempo: 1.1 },
    legacyIndex: 3,
  },
  {
    index: 7, id: 'aqueduct-heights', name: 'The Aqueduct Heights', motto: 'Water and wit both run downhill to the patient.',
    architecture: 'aqueduct', trophy: 'The Arch of Waters', floor: 1200,
    palette: { sky: ['#b8dcec', '#f6ead0'], stone: '#d0b890', stoneDark: '#7a6040', accent: '#a8402a', accent2: '#3a8aa0', light: '#f0e2c4', dark: '#a89070', frame: '#5a4228', pieceLight: '#fbf0da', pieceDark: '#3a3020', pieceMetal: 0.25, ink: '#1e1810' },
    ambience: { base: 138, type: 'triangle', tempo: 0.9 },
  },
  {
    index: 8, id: 'forum-of-triumph', name: 'The Forum of Triumph', motto: 'Victory walks the Sacred Way.',
    architecture: 'forum', trophy: 'The Laurel of the Via Sacra', floor: 1300,
    palette: { sky: ['#bfe3f5', '#fbf3df'], stone: '#efe8da', stoneDark: '#a89d88', accent: '#b8862b', accent2: '#3a6ea5', light: '#f6f1e6', dark: '#a9b4b8', frame: '#8a7a5a', pieceLight: '#fbf8f0', pieceDark: '#3c4f66', pieceMetal: 0.25, ink: '#1d2430' },
    ambience: { base: 147, type: 'sine', tempo: 0.9 },
    legacyIndex: 4,
  },
  {
    index: 9, id: 'imperial-baths', name: 'The Imperial Baths', motto: 'Clear water, clear mind.',
    architecture: 'thermae', trophy: 'The Krater of the Baths', floor: 1400,
    palette: { sky: ['#cfe8f0', '#f8f0e0'], stone: '#eadfcc', stoneDark: '#9a8a70', accent: '#2c7a8a', accent2: '#c89a42', light: '#f6f0e4', dark: '#8fb0b8', frame: '#6a5a44', pieceLight: '#fffaf0', pieceDark: '#2a4a56', pieceMetal: 0.35, ink: '#18242a' },
    ambience: { base: 150, type: 'sine', tempo: 0.7 },
  },
  {
    index: 10, id: 'praetorian-bastion', name: 'The Praetorian Bastion', motto: 'Loyal, silent, unbroken.',
    architecture: 'bastion', trophy: 'The Scorpion Standard', floor: 1500,
    palette: { sky: ['#3b4a7a', '#c98a6a'], stone: '#8b6b5a', stoneDark: '#3d2a24', accent: '#7b1e3a', accent2: '#e0b050', light: '#e8d7c0', dark: '#6e4b45', frame: '#2b1a17', pieceLight: '#efe1cb', pieceDark: '#3a1520', pieceMetal: 0.45, ink: '#120a08' },
    ambience: { base: 73, type: 'square', tempo: 0.7 },
    legacyIndex: 5,
  },
  {
    index: 11, id: 'circus-maximus', name: 'The Circus Maximus', motto: 'Seven laps. One victor.',
    architecture: 'circus', trophy: 'The Chariot Wheel', floor: 1600,
    palette: { sky: ['#ffc07a', '#f6e0b0'], stone: '#dcae78', stoneDark: '#84502a', accent: '#b8302a', accent2: '#2a6ab0', light: '#f4dcb4', dark: '#c08450', frame: '#6a3a1a', pieceLight: '#fff0d4', pieceDark: '#6e2418', pieceMetal: 0.35, ink: '#2a1608' },
    ambience: { base: 112, type: 'sawtooth', tempo: 1.3 },
  },
  {
    index: 12, id: 'senate-hall', name: 'The Senate Hall', motto: 'Argue every move. Defend every square.',
    architecture: 'curia', trophy: 'The Curule Seat', floor: 1700,
    palette: { sky: ['#d9e6e0', '#f2e6cf'], stone: '#e9e2d0', stoneDark: '#9c8f74', accent: '#8e1b1b', accent2: '#1f5f4a', light: '#f3ecdc', dark: '#7f9b8c', frame: '#4f4632', pieceLight: '#fffaf0', pieceDark: '#1f3f35', pieceMetal: 0.3, ink: '#1a1c16' },
    ambience: { base: 123, type: 'sine', tempo: 0.5 },
    legacyIndex: 6,
  },
  {
    index: 13, id: 'great-library', name: 'The Great Library', motto: 'Every opening was once a scroll.',
    architecture: 'library', trophy: 'The Scroll of Alexandria', floor: 1800,
    palette: { sky: ['#f0d8a0', '#f8eed8'], stone: '#e8d6b0', stoneDark: '#9a7a4a', accent: '#1f5a7a', accent2: '#c8902a', light: '#f4ead4', dark: '#b09a70', frame: '#5a4428', pieceLight: '#fff8e8', pieceDark: '#2e3e4e', pieceMetal: 0.3, ink: '#1c1a14' },
    ambience: { base: 118, type: 'sine', tempo: 0.45 },
  },
  {
    index: 14, id: 'consular-palace', name: 'The Consular Palace', motto: 'Power is the patience of the strong.',
    architecture: 'palace', trophy: 'The Fasces of Office', floor: 1900,
    palette: { sky: ['#5a1020', '#e08a5a'], stone: '#b5473f', stoneDark: '#5a1616', accent: '#e8c060', accent2: '#2b3f7a', light: '#f0d9bf', dark: '#9c3a33', frame: '#3a0d0d', pieceLight: '#f7e7cc', pieceDark: '#4a0f14', pieceMetal: 0.5, ink: '#fff1dc' },
    ambience: { base: 87, type: 'triangle', tempo: 0.6 },
    legacyIndex: 7,
  },
  {
    index: 15, id: 'capitoline-temple', name: 'The Capitoline Temple', motto: 'Jupiter watches every move.',
    architecture: 'temple', trophy: 'The Capitoline Pediment', floor: 2000,
    palette: { sky: ['#7a8ab8', '#f0d8b0'], stone: '#ece0c8', stoneDark: '#7a6a50', accent: '#a82a2a', accent2: '#e8c060', light: '#f6eedc', dark: '#9a8a70', frame: '#3a2e1e', pieceLight: '#fffaf0', pieceDark: '#3a2a1a', pieceMetal: 0.55, ink: '#14100a' },
    ambience: { base: 82, type: 'triangle', tempo: 0.55 },
  },
  {
    index: 16, id: 'grand-colosseum', name: 'The Grand Colosseum', motto: 'Fifty thousand voices. One move.',
    architecture: 'colosseum', trophy: 'The Flavian Crown', floor: 2100,
    palette: { sky: ['#ff8a4a', '#ffd88a'], stone: '#d9a066', stoneDark: '#7a4320', accent: '#9c1c1c', accent2: '#f0c040', light: '#f6dfb6', dark: '#b8743e', frame: '#5c2c10', pieceLight: '#fff0d0', pieceDark: '#6b1610', pieceMetal: 0.35, ink: '#2a1206' },
    ambience: { base: 104, type: 'sawtooth', tempo: 1.2 },
    legacyIndex: 8,
  },
  {
    index: 17, id: 'pantheon', name: 'The Pantheon', motto: 'Under the open sky, all gods are judges.',
    architecture: 'pantheon', trophy: 'The Dome of the Gods', floor: 2200,
    palette: { sky: ['#6a90c0', '#e8e0d0'], stone: '#dcd4c4', stoneDark: '#5a5448', accent: '#b8862b', accent2: '#3a5a8a', light: '#efe9dc', dark: '#8a8a84', frame: '#2e2c28', pieceLight: '#fbf8f0', pieceDark: '#2a2e3a', pieceMetal: 0.5, ink: '#f4f0e6' },
    ambience: { base: 78, type: 'sine', tempo: 0.4 },
  },
  {
    index: 18, id: 'imperial-palace', name: 'The Imperial Palace', motto: 'Rule the centre, rule the world.',
    architecture: 'palatine', trophy: 'The Purple Mantle', floor: 2300,
    palette: { sky: ['#2a1a4a', '#b06a9a'], stone: '#c9b8d8', stoneDark: '#4a3260', accent: '#e8c060', accent2: '#7a2a8a', light: '#efe6f2', dark: '#7c5f92', frame: '#2a1638', pieceLight: '#fbf5ff', pieceDark: '#3b1a52', pieceMetal: 0.6, ink: '#fdf6ff' },
    ambience: { base: 92, type: 'sine', tempo: 0.4 },
    legacyIndex: 9,
  },
  {
    index: 19, id: 'villa-tibur', name: 'The Villa of Tibur', motto: "In the emperor's garden, every square is cultivated.",
    architecture: 'villa', trophy: 'The Golden Pigna', floor: 2400,
    palette: { sky: ['#9ad0b0', '#f4ecd0'], stone: '#e6dcc4', stoneDark: '#6a7a5a', accent: '#8a2a3a', accent2: '#3a7a5a', light: '#f2ecd8', dark: '#8aa48a', frame: '#3a4a32', pieceLight: '#fffaee', pieceDark: '#2a4430', pieceMetal: 0.5, ink: '#141c12' },
    ambience: { base: 96, type: 'sine', tempo: 0.4 },
  },
  {
    index: 20, id: 'hall-of-caesars', name: 'The Hall of Caesars', motto: 'Stand among the immortal.',
    architecture: 'hall', trophy: 'The Corona Triumphalis', floor: 2500,
    palette: { sky: ['#0f2a3a', '#3a7a8a'], stone: '#d8d2c0', stoneDark: '#2f4a52', accent: '#d9a440', accent2: '#b03030', light: '#ece6d4', dark: '#3f6b74', frame: '#132328', pieceLight: '#fff8e6', pieceDark: '#1a3a42', pieceMetal: 0.7, ink: '#f6f0de' },
    ambience: { base: 65, type: 'triangle', tempo: 0.35 },
    legacyIndex: 10,
  },
  {
    index: 21, id: 'golden-house', name: 'The Golden House', motto: 'Gold on every wall; nowhere to hide.',
    architecture: 'domus-aurea', trophy: 'The Radiate Crown', floor: 2570,
    palette: { sky: ['#3a2a10', '#e0a840'], stone: '#e8c878', stoneDark: '#6a4a18', accent: '#f4cf6a', accent2: '#9c1c1c', light: '#f6e6c0', dark: '#b8924a', frame: '#3a2808', pieceLight: '#fff4d8', pieceDark: '#4a300c', pieceMetal: 0.8, ink: '#fff6e0' },
    ambience: { base: 70, type: 'triangle', tempo: 0.35 },
  },
  {
    index: 22, id: 'sanctum-victory', name: 'The Sanctum of Victory', motto: 'Victoria crowns only the unbroken.',
    architecture: 'sanctum', trophy: 'The Wings of Victoria', floor: 2635,
    palette: { sky: ['#1a2050', '#c89adc'], stone: '#f0e8d8', stoneDark: '#4a3a6a', accent: '#f0d070', accent2: '#c04a5a', light: '#f6f0e2', dark: '#7a6a9a', frame: '#1c1636', pieceLight: '#fffcf4', pieceDark: '#2a2048', pieceMetal: 0.8, ink: '#fff8ec' },
    ambience: { base: 60, type: 'sine', tempo: 0.32 },
  },
  {
    index: 23, id: 'eternal-throne', name: 'The Eternal Throne', motto: 'One throne. Defend it forever.',
    architecture: 'celestial', trophy: 'The Eternal Laurel', floor: 2700,
    palette: { sky: ['#0b1440', '#6a4aa8'], stone: '#f2e6c8', stoneDark: '#3a2f6a', accent: '#f4cf6a', accent2: '#e0605a', light: '#f7efdc', dark: '#5a4f8a', frame: '#141033', pieceLight: '#fffaf0', pieceDark: '#231a4a', pieceMetal: 0.85, ink: '#fff8e8' },
    ambience: { base: 55, type: 'sine', tempo: 0.3 },
    legacyIndex: 11,
  },
];

export type RankFamily = 'gladiatorial' | 'legion' | 'civic' | 'imperial';
export type RankDef = {
  index: number;
  /** Stable id, e.g. "r12-0" (arena 12, lowest grade). */
  id: string;
  /** Full grade name, e.g. "Quaestor III". */
  name: string;
  /** Title shared by the three grades of an arena, e.g. "Quaestor". */
  title: string;
  /** Grade numeral: 'III' (entry) → 'II' → 'I' (top of the arena). */
  grade: 'III' | 'II' | 'I';
  arena: number;
  tier: 0 | 1 | 2;
  floor: number;
  meaning: string;
  family: RankFamily;
  /** Short prestige description shown with the rank. */
  prestige: string;
};

/** One title per arena (index = arena). */
const RANK_TITLES: [string, string][] = [
  ['Tiro', 'Recruit'], ['Auctoratus', 'Sworn gladiator of the ludus'], ['Miles', 'Soldier'],
  ['Veteranus', 'Veteran of the frontier'], ['Immunis', 'Specialist'], ['Decanus', 'Leader of eight'],
  ['Signifer', 'Standard-bearer'], ['Optio', 'Second-in-command'], ['Aquilifer', 'Eagle-bearer'],
  ['Centurio', 'Centurion'], ['Primus Pilus', 'First spear of the legion'], ['Praefectus', 'Prefect'],
  ['Quaestor', 'Treasurer'], ['Aedilis', 'Magistrate of the games'], ['Tribunus', 'Tribune'],
  ['Praetor', 'Judge'], ['Consul', 'Consul'], ['Censor', 'Censor'],
  ['Legatus', 'Legate of a province'], ['Proconsul', 'Governor'], ['Imperator', 'Victorious general'],
  ['Princeps', 'First citizen'], ['Augustus', 'The revered'], ['Caesar Aeternus', 'Eternal Caesar'],
];
const FAMILIES: RankFamily[] = ['gladiatorial', 'legion', 'civic', 'imperial'];
const FAMILY_LABEL: Record<RankFamily, string> = {
  gladiatorial: 'the gladiatorial school', legion: 'the officers of the legion', civic: 'the magistracies of the Republic', imperial: 'the dignities of the Empire',
};
const GRADES = ['III', 'II', 'I'] as const;

/** Floor of a grade: arena floor + thirds of the band up to the next arena (Dust Pits: 0 / 350 / 450). */
function gradeFloor(arena: number, tier: number): number {
  const f = ARENAS[arena].floor;
  if (arena === 0) return [0, 350, 450][tier];
  const next = ARENAS[arena + 1]?.floor ?? f + 100;
  return f + Math.round(((next - f) * tier) / 3);
}

export const RANKS: RankDef[] = Array.from({ length: ARENAS.length * 3 }, (_, i) => {
  const arena = Math.floor(i / 3);
  const tier = (i % 3) as 0 | 1 | 2;
  const [title, meaning] = RANK_TITLES[arena];
  const family = FAMILIES[Math.floor(arena / 6)];
  return {
    index: i, id: `r${arena}-${tier}`, name: `${title} ${GRADES[tier]}`, title, grade: GRADES[tier], arena, tier,
    floor: gradeFloor(arena, tier), meaning, family,
    prestige: `${meaning}, grade ${GRADES[tier]} — ${FAMILY_LABEL[family]}, ${ARENAS[arena].name}.`,
  };
});

export const RANK_COUNT = RANKS.length; // 72
export const ARENA_COUNT = ARENAS.length; // 24
/** Index of the top arena (the Eternal Throne). */
export const TOP_ARENA = ARENA_COUNT - 1;
/** Arenas per trophy tier (Provincial / Legionary / Senatorial / Imperial). */
export const ARENAS_PER_TIER = ARENA_COUNT / 4;

const RANK_BY_ID: Record<string, number> = Object.fromEntries(RANKS.map((r) => [r.id, r.index]));
export function rankId(index: number): string {
  return RANKS[index]?.id ?? RANKS[0].id;
}
export function rankIndexById(id: string): number | undefined {
  return RANK_BY_ID[id];
}

/**
 * v0.2 → v0.3 index mapping. Old arena i → 2·i, the Eternal Throne (old 11) → 23;
 * old rank r (= 3·arena + tier) → 3·newArena + tier.
 */
export const LEGACY_ARENA_MAP: number[] = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 23];
export function migrateArenaIndex(old: number): number {
  return LEGACY_ARENA_MAP[Math.max(0, Math.min(11, Math.round(old)))];
}
export function migrateRankIndex(old: number): number {
  const r = Math.max(0, Math.min(35, Math.round(old)));
  return 3 * migrateArenaIndex(Math.floor(r / 3)) + (r % 3);
}

/**
 * Arena on the v0.2 0–11 scale (arena / 2, capped at 11). Thresholds that were
 * tuned for 12 arenas (prizes, Influence, Chronicle significance) use it so the
 * economy keeps its v0.2 balance across 24 arenas.
 */
export function legacyScale(arena: number): number {
  return Math.min(11, arena / 2);
}

/** The grade a rating naturally corresponds to (no hysteresis, no trials). */
export function naturalRank(rating: number): number {
  // Binary search over the increasing grade floors.
  let lo = 0;
  let hi = RANKS.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (rating >= RANKS[m].floor) lo = m;
    else hi = m - 1;
  }
  return lo;
}

/**
 * Hysteresis margins: you must fall this far below a floor to lose it.
 * v0.3 (24 arenas of ~100 points, grades of ~33): grade buffer 30, arena buffer 60.
 */
export const GRADE_DEMOTION_MARGIN = 30;
export const ARENA_DEMOTION_MARGIN = 60;
/** Clear dominance above the next arena floor bypasses the promotion trial (v0.3: 100). */
export const TRIAL_BYPASS_MARGIN = 100;

export type RankDecision =
  | { kind: 'stay' }
  | { kind: 'grade-up'; to: number }
  | { kind: 'grade-down'; to: number }
  | { kind: 'arena-down'; to: number }
  | { kind: 'trial-available'; to: number }
  | { kind: 'arena-up'; to: number; bypass: boolean };

/**
 * Rank movement rules (shared by the human player and the AI population):
 *  - Within an arena, grades follow rating, with a 30-point demotion buffer.
 *  - Crossing INTO a higher arena requires winning a Promotion Trial, unless
 *    the rating exceeds the next arena floor by ≥100 (dominance bypass), so a
 *    strong player is never artificially held back. Arenas are entered one at
 *    a time (v0.4): a dominance promotion lands in the next arena.
 *  - Falling more than 60 below the current arena floor demotes to the lower arena.
 *  - While provisional, rank follows rating directly (placement).
 */
export function decideRank(current: number, rating: number, provisional: boolean): RankDecision {
  const natural = naturalRank(rating);
  if (provisional) {
    // Placement: rank follows rating, at most two grades per game, so the
    // first 20 games read as a rapid climb rather than a jump.
    if (natural > current) return { kind: 'grade-up', to: Math.min(natural, current + 2) };
    if (natural < current) return { kind: 'grade-down', to: Math.max(natural, current - 2) };
    return { kind: 'stay' };
  }
  const cur = RANKS[current];
  if (natural > current) {
    const natArena = RANKS[natural].arena;
    if (natArena === cur.arena) return { kind: 'grade-up', to: natural };
    // natural rank lies in a higher arena
    const nextArena = cur.arena + 1;
    const nextFloor = ARENAS[nextArena].floor;
    // v0.4: dominance promotes into the NEXT arena only (v0.3 jumped straight to the natural
    // rank, so a rating far above the next floor could skip whole arenas); the next game continues.
    if (rating >= nextFloor + TRIAL_BYPASS_MARGIN) return { kind: 'arena-up', to: Math.min(natural, nextArena * 3 + 2), bypass: true };
    const topOfArena = cur.arena * 3 + 2;
    if (current < topOfArena) return { kind: 'grade-up', to: topOfArena };
    return { kind: 'trial-available', to: nextArena * 3 };
  }
  if (natural < current) {
    const arenaFloor = ARENAS[cur.arena].floor;
    if (cur.arena > 0 && rating < arenaFloor - ARENA_DEMOTION_MARGIN) {
      return { kind: 'arena-down', to: Math.max(natural, (cur.arena - 1) * 3) };
    }
    if (RANKS[natural].arena < cur.arena) {
      // inside the arena buffer: hold the arena's lowest grade
      return current > cur.arena * 3 ? { kind: 'grade-down', to: cur.arena * 3 } : { kind: 'stay' };
    }
    if (rating < cur.floor - GRADE_DEMOTION_MARGIN) return { kind: 'grade-down', to: natural };
  }
  return { kind: 'stay' };
}

export function arenaOfRank(rank: number): ArenaDef {
  return ARENAS[RANKS[rank].arena];
}

export type RankProgress = {
  rank: RankDef;
  next: RankDef | null;
  /** Points above the current grade floor / needed for the next grade. */
  current: number;
  target: number;
  /** Rating needed for the next grade (or the next arena floor). */
  nextFloor: number | null;
  /** The next step crosses into a new arena (Promotion Trial, or dominance at nextFloor + TRIAL_BYPASS_MARGIN). */
  crossesArena: boolean;
  bypassAt: number | null;
  /** Rating below which the grade / arena is lost (demotion buffer). */
  gradeLostBelow: number;
  arenaLostBelow: number | null;
  requirement: string;
};

/** Transparent promotion requirements and progress for a rank at a rating. Pure. */
export function rankProgress(rank: number, rating: number): RankProgress {
  const r = RANKS[Math.max(0, Math.min(RANK_COUNT - 1, rank))];
  const next = RANKS[r.index + 1] ?? null;
  const crosses = !!next && next.arena !== r.arena;
  const bypassAt = crosses ? next!.floor + TRIAL_BYPASS_MARGIN : null;
  const requirement = !next
    ? 'The summit of the empire: hold it.'
    : crosses
      ? `Reach ${next.floor} to earn a Promotion Trial into ${ARENAS[next.arena].name} — or ${bypassAt} to be promoted outright.`
      : `Reach ${next.floor} for ${next.name}.`;
  return {
    rank: r, next, current: Math.max(0, rating - r.floor), target: next ? Math.max(1, next.floor - r.floor) : 1, nextFloor: next?.floor ?? null,
    crossesArena: crosses, bypassAt, gradeLostBelow: r.floor - GRADE_DEMOTION_MARGIN,
    arenaLostBelow: r.arena > 0 ? ARENAS[r.arena].floor - ARENA_DEMOTION_MARGIN : null, requirement,
  };
}
