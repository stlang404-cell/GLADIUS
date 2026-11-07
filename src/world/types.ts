import type { PlayStyle, OpeningStyleTag as OpeningStyle } from '../engine/styles';

export const DAYS_PER_SEASON = 28;
export const SEASONS_PER_YEAR = 4;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS_PER_YEAR; // 112 in-world days

export type Trait = 'tactics' | 'endgames' | 'openings' | 'defence' | 'attack' | 'calculation' | 'intuition' | 'time-management';
export const TRAITS: Trait[] = ['tactics', 'endgames', 'openings', 'defence', 'attack', 'calculation', 'intuition', 'time-management'];

export type H2H = { id: string; w: number; d: number; l: number };

export type Competitor = {
  id: string; // stable: "c" + zero-padded serial, never reused
  name: string;
  female: boolean;
  origin: string;
  portraitSeed: number;
  birthDay: number; // in world days (may be negative)
  debutDay: number;
  /** Hidden true playing strength (what the engine plays at). Ratings track it via results. */
  skill: number;
  potential: number;
  peakAge: number;
  rating: number;
  peak: number;
  games: number;
  w: number;
  d: number;
  l: number;
  rank: number;
  peakRank: number;
  style: PlayStyle;
  openingStyles: OpeningStyle[];
  strengths: Trait[];
  weaknesses: Trait[];
  form: number; // EMA of (score - expected), -1..1
  streak: number; // +n wins / -n losses
  tournamentsWon: number;
  championships: number;
  titles: string[]; // title ids held currently
  honours: string[]; // short permanent records
  ratingHistory: [number, number][]; // [day, rating] sampled each season (capped)
  h2h: H2H[]; // most-played opponents (capped)
  retiredDay: number | null;
  /** Adaptation to the human player's habits (legitimate preparation only). */
  prep?: { vsPlayerOpenings: string[] };
};

export type ChronicleKind = 'title' | 'tournament' | 'promotion' | 'retirement' | 'debut' | 'record' | 'player' | 'season';
export type ChronicleEntry = { day: number; kind: ChronicleKind; text: string; ids?: string[]; arena?: number };

export type TitleState = {
  id: string; // e.g. "arena-3"
  arena: number;
  name: string;
  holder: string | null; // competitor id or 'player'
  since: number;
  defenses: number;
};
export type TitleReign = { titleId: string; holder: string; holderName: string; from: number; to: number | null; defenses: number };
