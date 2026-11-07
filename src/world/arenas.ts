/**
 * The twelve arenas and thirty-six competitive grades of the empire.
 *
 * Rank-name audit (vs. the original proposal):
 *  - "Legionarius" removed: it is a synonym of "Miles" and placing it after
 *    "Veteranus" read as a regression.
 *  - "Decanus" (leader of a tent-group of eight) moved before "Optio"; it was
 *    previously ranked above the standard-bearers it historically served under.
 *  - "Praefectus" moved into the Forum tier and "Legatus" into the Praetorian
 *    tier so each arena's three grades share a theme.
 *  - "Pater Patriae" (Father of the Fatherland, a real imperial honorific)
 *    added to fill the vacated slot at the Eternal Throne.
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
};

export const ARENAS: ArenaDef[] = [
  {
    index: 0, id: 'dust-pits', name: 'The Dust Pits', motto: 'Every legend begins in the sand.',
    architecture: 'ludus', trophy: 'The Wooden Rudis', floor: 0,
    palette: { sky: ['#f2c58a', '#d9865a'], stone: '#c89b6d', stoneDark: '#7a4a2c', accent: '#b4442b', accent2: '#e8b04b', light: '#ecd3a6', dark: '#b07a4f', frame: '#6b3f22', pieceLight: '#f3e3c4', pieceDark: '#5a3420', pieceMetal: 0.05, ink: '#2b160b' },
    ambience: { base: 110, type: 'triangle', tempo: 0.6 },
  },
  {
    index: 1, id: 'legion-camp', name: 'The Legion Camp', motto: 'Discipline before glory.',
    architecture: 'camp', trophy: 'The Vexillum', floor: 700,
    palette: { sky: ['#9fd0e8', '#e9d9a8'], stone: '#a67c52', stoneDark: '#5a3b22', accent: '#c0392b', accent2: '#2f6db3', light: '#efe2c2', dark: '#8f6a45', frame: '#4b2e19', pieceLight: '#f4ead2', pieceDark: '#7a1f1a', pieceMetal: 0.1, ink: '#1f1208' },
    ambience: { base: 98, type: 'sine', tempo: 0.8 },
  },
  {
    index: 2, id: 'iron-citadel', name: 'The Iron Citadel', motto: 'Hold the wall. Hold the file.',
    architecture: 'fortress', trophy: 'The Iron Aquila', floor: 900,
    palette: { sky: ['#6d8aa6', '#c9b79a'], stone: '#7d8590', stoneDark: '#3b4048', accent: '#a33b2b', accent2: '#d6a54a', light: '#d8d6d0', dark: '#6f7680', frame: '#2c3036', pieceLight: '#e7e4dc', pieceDark: '#2f3338', pieceMetal: 0.55, ink: '#15181c' },
    ambience: { base: 82, type: 'sawtooth', tempo: 0.5 },
  },
  {
    index: 3, id: 'gladiators-court', name: "The Gladiator's Court", motto: 'The crowd remembers courage.',
    architecture: 'court', trophy: 'The Golden Rudis', floor: 1100,
    palette: { sky: ['#ffb36b', '#f2e0b0'], stone: '#e0b77e', stoneDark: '#8c5a2b', accent: '#c8302a', accent2: '#2c7a7b', light: '#f7e6c4', dark: '#c48a52', frame: '#7a3e1a', pieceLight: '#fff1d6', pieceDark: '#8a2a1d', pieceMetal: 0.2, ink: '#2a1408' },
    ambience: { base: 130, type: 'triangle', tempo: 1.1 },
  },
  {
    index: 4, id: 'forum-of-triumph', name: 'The Forum of Triumph', motto: 'Victory walks the Sacred Way.',
    architecture: 'forum', trophy: 'The Laurel of the Via Sacra', floor: 1300,
    palette: { sky: ['#bfe3f5', '#fbf3df'], stone: '#efe8da', stoneDark: '#a89d88', accent: '#b8862b', accent2: '#3a6ea5', light: '#f6f1e6', dark: '#a9b4b8', frame: '#8a7a5a', pieceLight: '#fbf8f0', pieceDark: '#3c4f66', pieceMetal: 0.25, ink: '#1d2430' },
    ambience: { base: 147, type: 'sine', tempo: 0.9 },
  },
  {
    index: 5, id: 'praetorian-bastion', name: 'The Praetorian Bastion', motto: 'Loyal, silent, unbroken.',
    architecture: 'bastion', trophy: 'The Scorpion Standard', floor: 1500,
    palette: { sky: ['#3b4a7a', '#c98a6a'], stone: '#8b6b5a', stoneDark: '#3d2a24', accent: '#7b1e3a', accent2: '#e0b050', light: '#e8d7c0', dark: '#6e4b45', frame: '#2b1a17', pieceLight: '#efe1cb', pieceDark: '#3a1520', pieceMetal: 0.45, ink: '#120a08' },
    ambience: { base: 73, type: 'square', tempo: 0.7 },
  },
  {
    index: 6, id: 'senate-hall', name: 'The Senate Hall', motto: 'Argue every move. Defend every square.',
    architecture: 'curia', trophy: 'The Curule Seat', floor: 1700,
    palette: { sky: ['#d9e6e0', '#f2e6cf'], stone: '#e9e2d0', stoneDark: '#9c8f74', accent: '#8e1b1b', accent2: '#1f5f4a', light: '#f3ecdc', dark: '#7f9b8c', frame: '#4f4632', pieceLight: '#fffaf0', pieceDark: '#1f3f35', pieceMetal: 0.3, ink: '#1a1c16' },
    ambience: { base: 123, type: 'sine', tempo: 0.5 },
  },
  {
    index: 7, id: 'consular-palace', name: 'The Consular Palace', motto: 'Power is the patience of the strong.',
    architecture: 'palace', trophy: 'The Fasces of Office', floor: 1900,
    palette: { sky: ['#5a1020', '#e08a5a'], stone: '#b5473f', stoneDark: '#5a1616', accent: '#e8c060', accent2: '#2b3f7a', light: '#f0d9bf', dark: '#9c3a33', frame: '#3a0d0d', pieceLight: '#f7e7cc', pieceDark: '#4a0f14', pieceMetal: 0.5, ink: '#fff1dc' },
    ambience: { base: 87, type: 'triangle', tempo: 0.6 },
  },
  {
    index: 8, id: 'grand-colosseum', name: 'The Grand Colosseum', motto: 'Fifty thousand voices. One move.',
    architecture: 'colosseum', trophy: 'The Flavian Crown', floor: 2100,
    palette: { sky: ['#ff8a4a', '#ffd88a'], stone: '#d9a066', stoneDark: '#7a4320', accent: '#9c1c1c', accent2: '#f0c040', light: '#f6dfb6', dark: '#b8743e', frame: '#5c2c10', pieceLight: '#fff0d0', pieceDark: '#6b1610', pieceMetal: 0.35, ink: '#2a1206' },
    ambience: { base: 104, type: 'sawtooth', tempo: 1.2 },
  },
  {
    index: 9, id: 'imperial-palace', name: 'The Imperial Palace', motto: 'Rule the centre, rule the world.',
    architecture: 'palatine', trophy: 'The Purple Mantle', floor: 2300,
    palette: { sky: ['#2a1a4a', '#b06a9a'], stone: '#c9b8d8', stoneDark: '#4a3260', accent: '#e8c060', accent2: '#7a2a8a', light: '#efe6f2', dark: '#7c5f92', frame: '#2a1638', pieceLight: '#fbf5ff', pieceDark: '#3b1a52', pieceMetal: 0.6, ink: '#fdf6ff' },
    ambience: { base: 92, type: 'sine', tempo: 0.4 },
  },
  {
    index: 10, id: 'hall-of-caesars', name: 'The Hall of Caesars', motto: 'Stand among the immortal.',
    architecture: 'hall', trophy: 'The Corona Triumphalis', floor: 2500,
    palette: { sky: ['#0f2a3a', '#3a7a8a'], stone: '#d8d2c0', stoneDark: '#2f4a52', accent: '#d9a440', accent2: '#b03030', light: '#ece6d4', dark: '#3f6b74', frame: '#132328', pieceLight: '#fff8e6', pieceDark: '#1a3a42', pieceMetal: 0.7, ink: '#f6f0de' },
    ambience: { base: 65, type: 'triangle', tempo: 0.35 },
  },
  {
    index: 11, id: 'eternal-throne', name: 'The Eternal Throne', motto: 'One throne. Defend it forever.',
    architecture: 'celestial', trophy: 'The Eternal Laurel', floor: 2700,
    palette: { sky: ['#0b1440', '#6a4aa8'], stone: '#f2e6c8', stoneDark: '#3a2f6a', accent: '#f4cf6a', accent2: '#e0605a', light: '#f7efdc', dark: '#5a4f8a', frame: '#141033', pieceLight: '#fffaf0', pieceDark: '#231a4a', pieceMetal: 0.85, ink: '#fff8e8' },
    ambience: { base: 55, type: 'sine', tempo: 0.3 },
  },
];

export type RankDef = { index: number; name: string; arena: number; tier: 0 | 1 | 2; floor: number; meaning: string };

const RANK_NAMES: [string, string][] = [
  ['Tiro', 'Recruit'], ['Miles', 'Soldier'], ['Veteranus', 'Veteran'],
  ['Immunis', 'Specialist'], ['Decanus', 'Squad leader'], ['Principalis', 'Junior officer'],
  ['Optio', 'Second-in-command'], ['Signifer', 'Standard-bearer'], ['Aquilifer', 'Eagle-bearer'],
  ['Provocator', 'Challenger'], ['Murmillo', 'Heavy gladiator'], ['Rudiarius', 'Freed champion'],
  ['Centurio', 'Centurion'], ['Primus Pilus', 'First spear'], ['Praefectus', 'Prefect'],
  ['Praetorianus', 'Guardsman'], ['Tribunus', 'Tribune'], ['Legatus', 'Legate'],
  ['Quaestor', 'Treasurer'], ['Aedilis', 'Magistrate of the games'], ['Praetor', 'Judge'],
  ['Consul', 'Consul'], ['Proconsul', 'Governor'], ['Censor', 'Censor'],
  ['Victor', 'Victor'], ['Triumphator', 'Triumphant'], ['Invictus', 'Unconquered'],
  ['Dux', 'Commander'], ['Imperator', 'Victorious general'], ['Princeps', 'First citizen'],
  ['Augustus', 'The revered'], ['Caesar', 'Caesar'], ['Dominus', 'Lord'],
  ['Pater Patriae', 'Father of the Fatherland'], ['Caesar Magnus', 'Caesar the Great'], ['Caesar Aeternus', 'Eternal Caesar'],
];

/** Offsets of the second and third grade inside an arena's 200-point band. */
function gradeFloor(arena: number, tier: number): number {
  const f = ARENAS[arena].floor;
  if (arena === 0) return [0, 450, 575][tier];
  return f + [0, 67, 133][tier];
}

export const RANKS: RankDef[] = RANK_NAMES.map(([name, meaning], i) => ({
  index: i,
  name,
  meaning,
  arena: Math.floor(i / 3),
  tier: (i % 3) as 0 | 1 | 2,
  floor: gradeFloor(Math.floor(i / 3), i % 3),
}));

export const RANK_COUNT = RANKS.length; // 36
export const ARENA_COUNT = ARENAS.length; // 12

/** The grade a rating naturally corresponds to (no hysteresis, no trials). */
export function naturalRank(rating: number): number {
  let r = 0;
  for (const rk of RANKS) if (rating >= rk.floor) r = rk.index;
  return r;
}

/** Hysteresis margins: you must fall this far below a floor to lose it. */
export const GRADE_DEMOTION_MARGIN = 50;
export const ARENA_DEMOTION_MARGIN = 100;
/** Clear dominance above the next arena floor bypasses the promotion trial. */
export const TRIAL_BYPASS_MARGIN = 150;

export type RankDecision =
  | { kind: 'stay' }
  | { kind: 'grade-up'; to: number }
  | { kind: 'grade-down'; to: number }
  | { kind: 'arena-down'; to: number }
  | { kind: 'trial-available'; to: number }
  | { kind: 'arena-up'; to: number; bypass: boolean };

/**
 * Rank movement rules (shared by the human player and the AI population):
 *  - Within an arena, grades follow rating, with a 50-point demotion buffer.
 *  - Crossing INTO a higher arena requires winning a Promotion Trial, unless
 *    the rating exceeds the next arena floor by ≥150 (dominance bypass), so a
 *    strong player is never artificially held back.
 *  - Falling ≥100 below the current arena floor demotes to the lower arena.
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
    if (rating >= nextFloor + TRIAL_BYPASS_MARGIN) return { kind: 'arena-up', to: natural, bypass: true };
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
