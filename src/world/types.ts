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
  /** Career-arc markers (day of each real event), used so the Chronicle reports each arc once. v0.2, optional. */
  arc?: { prodigy?: number; breakthrough?: number; fell?: number };
};

export type ChronicleKind = 'title' | 'tournament' | 'promotion' | 'retirement' | 'debut' | 'record' | 'player' | 'season';
/**
 * Card-styling tag for Chronicle entries (v0.2). Every tagged entry is written
 * at the moment the underlying simulated event happens — never invented.
 */
export type ChronicleTag =
  | 'new-champion' | 'comeback' | 'elite-upset' | 'tournament-upset' | 'rival-promoted'
  | 'prodigy' | 'breakthrough' | 'fall-from-elite' | 'retirement' | 'record-broken';
export type ChronicleEntry = { day: number; kind: ChronicleKind; text: string; ids?: string[]; arena?: number; tag?: ChronicleTag };

export type TitleState = {
  id: string; // e.g. "arena-3"
  arena: number;
  name: string;
  holder: string | null; // competitor id or 'player'
  since: number;
  defenses: number;
};
export type TitleReign = { titleId: string; holder: string; holderName: string; from: number; to: number | null; defenses: number };

// ---------------------------------------------------------------- v0.2: trophies & records

export type TrophyTier = 'common' | 'rare' | 'epic' | 'legendary';
export type TrophyCategory = 'signature' | 'cup' | 'medal' | 'regional' | 'elite' | 'crown' | 'defense' | 'seasonal' | 'distinction' | 'historical';

/**
 * One awarded trophy instance. Append-only: never deleted, never duplicated
 * (awardId is deterministic). `current` is meaningful only for awards with a
 * `series` (an edition of an event, or a title): true while it is the latest
 * edition / the holder still holds that title. Distinctions and historical
 * feats have no series and `current: false`.
 */
export type AwardRecord = {
  awardId: string;
  defId: string;
  holder: string; // competitor id or 'player'
  holderName: string;
  tournamentId: string; // or a pseudo id for season awards: "S<season>-A<arena>"
  season: number;
  day: number;
  arena: number;
  format: string; // tournament format, or 'season'
  finalOpponent: string | null;
  finalOpponentName?: string;
  result: string; // e.g. "3½–2½" (match/final) or "6½/7" (points formats)
  gameIds: string[]; // engine-played or player game ids from this event
  defenseNumber?: number;
  current: boolean;
  series?: string; // e.g. "title-11", "open-3", "laurel-4"
  holderRating?: number;
  opponentRating?: number;
  unbeaten?: boolean;
  perfect?: boolean;
  backfilled?: boolean; // reconstructed by ensureWorldV2 from the persisted tournament history
};

/** Compact snapshot of a pruned competitor, so records survive the archive pruning. */
export type LegendEntry = {
  id: string; name: string; peak: number; peakRank: number; games: number; w: number; d: number; l: number;
  tournamentsWon: number; championships: number; retiredDay: number | null; debutDay: number;
};
export type RivalryEntry = { a: string; b: string; aName: string; bName: string; games: number; aw: number; d: number; bw: number; day: number };

export type HallOfRecords = {
  legends: LegendEntry[];
  rivalries: RivalryEntry[];
  /** Current record holder per record key (for "record broken" Chronicle entries). */
  best: Record<string, { holder: string; name: string; value: number; day: number }>;
};
