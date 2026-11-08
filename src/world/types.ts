import type { PlayStyle, OpeningStyleTag as OpeningStyle } from '../engine/styles';
import type { RegionId } from './regions';

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
  // ---- v0.3 (optional in the type for old saves; `ensureWorldV3` fills them) ----
  /** Home region (derived from origin at creation; never changes). */
  region?: RegionId;
  /** Tournaments entered (counted from v0.3; migrated saves start at tournamentsWon). */
  tp?: number;
  /** Last 10 results packed 2 bits each, newest in the low bits: 3 = win, 2 = draw, 1 = loss, 0 = none. See `recentResults`. */
  last?: number;
  /** Day of the last rule-based style change (style drift, see sim.styleDrift). */
  styleDay?: number;
};

export type ChronicleKind = 'title' | 'tournament' | 'promotion' | 'retirement' | 'debut' | 'record' | 'player' | 'season';
/**
 * Card-styling tag for Chronicle entries (v0.2). Every tagged entry is written
 * at the moment the underlying simulated event happens — never invented.
 */
export type ChronicleTag =
  | 'new-champion' | 'comeback' | 'elite-upset' | 'tournament-upset' | 'rival-promoted'
  | 'prodigy' | 'breakthrough' | 'fall-from-elite' | 'retirement' | 'record-broken'
  // v0.3
  | 'major-upset' | 'legend-defeated' | 'historic-defense' | 'veteran-retirement' | 'rating-record'
  | 'invitation' | 'regional-champion';
/** `region` (v0.3): the regional circuit the event belongs to, or 'imperial'. */
export type ChronicleEntry = { day: number; kind: ChronicleKind; text: string; ids?: string[]; arena?: number; tag?: ChronicleTag; region?: string };

export type TitleState = {
  id: string; // e.g. "title-3"; v0.3 regional crowns: "crown-latium" (in WorldState.regionTitles)
  arena: number; // regional crowns: -1
  /** v0.3: set on regional crowns. */
  region?: RegionId;
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
  /** v0.3: regional circuit of the event ('imperial' for arena / imperial events). Migrated awards get 'imperial'. */
  region?: string;
};

/** Compact snapshot of a pruned competitor, so records survive the archive pruning. */
export type LegendEntry = {
  id: string; name: string; peak: number; peakRank: number; games: number; w: number; d: number; l: number;
  tournamentsWon: number; championships: number; retiredDay: number | null; debutDay: number;
  /** v0.3 (optional): home region, style, birth day, tournaments entered. */
  region?: string; style?: string; birthDay?: number; tp?: number;
};
export type RivalryEntry = { a: string; b: string; aName: string; bName: string; games: number; aw: number; d: number; bw: number; day: number };

export type HallOfRecords = {
  legends: LegendEntry[];
  rivalries: RivalryEntry[];
  /** Current record holder per record key (for "record broken" Chronicle entries). */
  best: Record<string, { holder: string; name: string; value: number; day: number }>;
};

// ---------------------------------------------------------------- v0.3: rivalries & upsets

/**
 * A rivalry between two competitors (or a competitor and the player, id
 * 'player'), built only from important tournament encounters: finals,
 * eliminations, title clashes and upsets. `a < b` lexicographically.
 */
export type Feud = {
  a: string; b: string; aName: string; bName: string;
  /** Tournament encounters (any pairing in an event). */
  meetings: number;
  finals: number;
  eliminations: number;
  titleClashes: number;
  upsets: number;
  /** Games won by a / b in those encounters (draws not counted). */
  aWins: number; bWins: number;
  firstDay: number; lastDay: number;
  /** Who won the latest encounter ('a' | 'b' | null for a draw). */
  lastWinner: 'a' | 'b' | null;
};

/** A notable upset (event-driven, capped log). */
export type UpsetEntry = {
  day: number; season: number; tournamentId: string; tournamentName: string; arena: number; region: string;
  winner: string; winnerName: string; winnerRating: number;
  loser: string; loserName: string; loserRating: number;
  gap: number; stage: 'final' | 'title' | 'elimination' | 'game';
};
