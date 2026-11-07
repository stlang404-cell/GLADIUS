import type { RatingState, TimeControlPool } from '../rating/elo';
import type { Competitor, ChronicleEntry, TitleState, TitleReign, AwardRecord, HallOfRecords, Feud, UpsetEntry } from '../world/types';
import type { RegionId } from '../world/regions';
import type { SimContext } from '../world/sim';
import type { TournamentState, Format } from '../tournament/formats';
import type { ResultCode, Termination } from '../chess/rules';

export const SAVE_SCHEMA = 1;

export type TimeControl = { id: string; pool: TimeControlPool; label: string; baseSec: number; incSec: number };
/**
 * GLADIUS is untimed: the human player always has unlimited thinking time.
 * Clocked play is kept only as a disabled, hidden future option.
 */
export const CLOCKS_ENABLED = false;
export const UNTIMED_TC = 'untimed';

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'blitz-5', pool: 'blitz', label: '5 min', baseSec: 300, incSec: 0 },
  { id: 'blitz-3-2', pool: 'blitz', label: '3 + 2', baseSec: 180, incSec: 2 },
  { id: 'rapid-10', pool: 'rapid', label: '10 min', baseSec: 600, incSec: 0 },
  { id: 'rapid-15-10', pool: 'rapid', label: '15 + 10', baseSec: 900, incSec: 10 },
  { id: 'classical-30', pool: 'classical', label: '30 min', baseSec: 1800, incSec: 0 },
  { id: 'untimed', pool: 'untimed', label: 'Untimed', baseSec: 0, incSec: 0 },
];

export type BoardMode = '3d' | '2d';
export type AnimSpeed = 'fast' | 'balanced' | 'majestic' | 'custom' | 'cinematic'; // 'cinematic' = legacy alias of 'majestic'

export type Settings = {
  boardMode: BoardMode;
  animSpeed: AnimSpeed;
  pieceSet: number; // arena index of the cosmetic collection
  boardSet: number;
  sound: boolean;
  ambience: boolean;
  showLegal: boolean;
  showCoords: boolean;
  autoQueen: boolean;
  opponentPace: 'instant' | 'natural';
  careerPool: TimeControlPool;
  defaultTc: string;
  cameraTilt: number; // 0..1
  animMs?: number; // custom move duration (150–1200)
  textScale?: number; // 0.9–1.3 UI text scaling
  scenery?: 'auto' | 'scenic' | 'focused'; // legacy (2.5D removed)
  boardTheme?: string; // board collection id, or 'arena' (the arena's signature board)
  pieceStyle?: string; // 'classical' | 'imperial' | 'marble' | 'board'
  reduceMotion: boolean;
  highContrast: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  boardMode: '2d', animSpeed: 'majestic', pieceSet: 0, boardSet: 0, sound: true, ambience: false,
  showLegal: true, showCoords: true, autoQueen: false, opponentPace: 'natural', careerPool: 'rapid',
  defaultTc: 'untimed', cameraTilt: 0.55, reduceMotion: false, highContrast: false,
};

export type PlayerH2H = { w: number; d: number; l: number; lastDay: number };

export type PlayerState = {
  name: string;
  female: boolean;
  portraitSeed: number;
  createdDay: number;
  ratings: Record<TimeControlPool, RatingState>;
  rank: number;
  peakRank: number;
  rankHistory: { day: number; rank: number; reason: string }[];
  trial: { toRank: number; availableSinceGames: number; attempts: number; cooldownUntilGames: number } | null;
  influence: number; // current standing (decays)
  prestige: number; // lifetime (never decays)
  w: number;
  d: number;
  l: number;
  ratedGames: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  championships: number;
  titles: string[];
  achievements: Record<string, number>; // id -> day unlocked
  unlockedSets: number[];
  h2h: Record<string, PlayerH2H>;
  rivalId: string | null;
  ratingHistory: { day: number; pool: TimeControlPool; rating: number }[];
  openingsPlayed: Record<string, { w: number; d: number; l: number; color: 'w' | 'b' }>;
  streak: number;
  bestWinRating: number;
  // ---- v0.2 (all optional; `ensureSaveV2` initialises them on old saves) ----
  /** Authoritative counters for achievements, updated as games/analyses happen. */
  ledger?: PlayerLedger;
  /** Per-opponent rivalry model (capped). */
  rivals?: Record<string, RivalRecord>;
  /** Append-only legacy timeline, written as events happen. */
  timeline?: TimelineEvent[];
  /** Append-only season-end reports (one per season rollover). */
  seasonReports?: SeasonReport[];
  // ---- v0.3 (optional) ----
  /** Home region for the regional circuit (default 'latium', see career.playerRegion). */
  region?: RegionId;
  /** Rank layout of rank / peakRank / rankHistory / trial / unlockedSets: 24 arenas (v0.3). Absent = v0.2 (12 arenas), remapped by ensureSaveV2. */
  rankLayout?: number;
};

export type PlayerLedger = {
  v: 1;
  since: number; // world day the ledger started counting
  /** Named counters (see game/achievements.ts for the keys). */
  c: Record<string, number>;
  /** Named distinct-value sets (openings won with, pools won in, ...). */
  sets: Record<string, string[]>;
  /** Game ids whose stored analysis has been processed by onGameAnalysed. */
  analysed: Record<string, 1>;
  /** Last game ids processed by finishPlayerGame (guards double processing). */
  recentIds: string[];
  /** Last 10 rated scores (1 / 0.5 / 0), newest last. */
  recent: number[];
  /** Highest rating reached in any pool once that pool was established (≥ 20 games). */
  peakEstablished: number;
  /** Season tracker for the season-end report. */
  season?: SeasonTracker;
};

export type SeasonTracker = {
  season: number; startDay: number; ratingStart: number; peak: number; rankStart: number;
  games: number; w: number; d: number; l: number; awardsStart: number;
  vs: Record<string, [number, number, number]>;
  bestWin?: { gameId: string; oppId: string; oppName: string; oppRating: number; day: number };
};

export type SeasonReport = {
  season: number; startDay: number; endDay: number;
  ratingStart: number; ratingEnd: number; peak: number;
  games: number; w: number; d: number; l: number;
  tournaments: { id: string; name: string; place: number | null; arena: number }[];
  trophies: string[]; // awardIds won this season
  rankStart: number; rankEnd: number; rankChange: number;
  rival: { id: string; name: string; w: number; d: number; l: number } | null;
  bestWin: { gameId: string; oppId: string; oppName: string; oppRating: number; day: number } | null;
};

export type RivalGame = { gameId: string; day: number; result: 'w' | 'd' | 'l'; color: 'w' | 'b'; opening?: string; kind: GameKind; tournamentId?: string };
export type RivalRecord = {
  id: string; name: string; w: number; d: number; l: number;
  games: RivalGame[]; // newest last, capped
  tournamentEncounters: number;
  championshipBattles: number;
  significance: number; // raw (recency is applied by selectors)
  lastOpening?: string; // last opening the player used against this opponent
  openings: Record<string, { w: number; d: number; l: number }>; // player's results by opening vs this opponent
  firstDay: number; lastDay: number;
};

export type TimelineKind = 'enlisted' | 'promotion' | 'demotion' | 'trophy' | 'title-won' | 'title-lost' | 'achievement' | 'rating-milestone' | 'notable-win' | 'season' | 'rival';
export type TimelineEvent = { day: number; kind: TimelineKind; text: string; ref?: string; arena?: number };

export type GameKind = 'ranked' | 'challenge' | 'casual' | 'trial' | 'tournament' | 'rivalry' | 'drill' | 'spectated';

export type Side = { id: string; name: string; rating: number; rank: number; portraitSeed?: number; female?: boolean };

export type MoveAnalysis = {
  ply: number;
  uci: string;
  san: string;
  evalBefore: { cp?: number; mate?: number }; // white perspective
  evalAfter: { cp?: number; mate?: number };
  bestUci: string;
  bestSan: string;
  pv: string[]; // SAN of best line from position before move
  winLoss: number; // win% lost by the mover
  accuracy: number;
  cls: MoveClass;
};
export type MoveClass = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder' | 'miss' | 'forced';

export type GameAnalysis = {
  depth: number;
  engine: string;
  moves: MoveAnalysis[];
  accuracy: { w: number; b: number };
  counts: { w: Partial<Record<MoveClass, number>>; b: Partial<Record<MoveClass, number>> };
  critical: number[]; // plies
  opening: { eco: string; name: string } | null;
  endgame: string | null;
};

export type GameRecord = {
  id: string;
  kind: GameKind;
  rated: boolean;
  pool: TimeControlPool;
  tc: string;
  day: number;
  date: string;
  white: Side;
  black: Side;
  playerColor: 'w' | 'b' | null; // null for AI-vs-AI
  startFen: string;
  moves: string[]; // UCI
  san: string[];
  clocks?: number[]; // ms remaining after each ply
  result: ResultCode;
  termination: Termination;
  arena: number;
  tournamentId?: string;
  pairingId?: string;
  eloDelta?: number;
  analysis?: GameAnalysis;
  opening?: { eco: string; name: string } | null;
  source: 'engine' | 'player';
  /** v0.3: arena / rank numbering of `arena` and the sides' `rank` (24 = 24 arenas). Absent = v0.2 numbering; persist/save.ts remaps on read. */
  arenaLayout?: number;
};

export type ActiveGame = {
  record: GameRecord; // result '*' while ongoing
  opponentId: string;
  clockMs: { w: number; b: number };
  lastTick: number;
  undoUsed?: boolean;
  drawOfferedPly?: number;
};

export type InvitationKind = 'challenge' | 'rivalry' | 'invitational' | 'wildcard' | 'championship' | 'exhibition' | 'trial';
export type Invitation = {
  id: string;
  kind: InvitationKind;
  fromId: string | null; // competitor or organiser (null)
  tournamentId?: string;
  title: string;
  detail: string;
  stakes: string;
  expiresDay: number;
  createdDay: number;
  /** v0.2: why this invitation exists (eligibility rule), for UI labels. */
  context?: InvitationContext;
  reason?: string;
};
export type InvitationContext =
  | 'rival-rematch' | 'regional-championship' | 'open-registration' | 'elite-invitational' | 'invitational'
  | 'seeded' | 'wildcard' | 'title-challenge' | 'exhibition' | 'challenge' | 'trial'
  // v0.3 regional circuit
  | 'local-open' | 'regional-crown' | 'regional-defense' | 'qualifier' | 'imperial-masters' | 'rival-challenge';

export type TournamentKind =
  | 'open' | 'cup' | 'gauntlet' | 'invitational' | 'league' | 'championship' | 'hosted'
  // v0.3: regional circuit and imperial events
  | 'local-open' | 'regional' | 'regional-defense' | 'qualifier' | 'elite';

export type WorldTournament = {
  id: string;
  name: string;
  arena: number;
  kind: TournamentKind;
  format: Format;
  season: number;
  startDay: number;
  roundEveryDays: number;
  nextRoundDay: number;
  status: 'scheduled' | 'running' | 'complete';
  state: TournamentState | null;
  playerEntered: boolean;
  playerWithdrawn?: boolean;
  invitedPlayer?: boolean;
  prize: number; // influence for the winner
  titleId?: string;
  featured: string[]; // pairing ids flagged for engine play / spectating
  gameIds: Record<string, string>; // pairing id -> GameRecord id (engine-played games only)
  size: number;
  hostId?: string;
  /** v0.2: set once trophies for this tournament have been presented (idempotency guard). */
  awarded?: boolean;
  // ---- v0.3 (optional; `tournamentInfo()` derives them for older records) ----
  /** Regional circuit, or 'imperial' for the arena circuit / imperial events. */
  region?: string;
  /** Prestige value of the event (see calendar.tournamentPrestige). */
  prestige?: number;
  /** Human-readable qualification rule. */
  qualification?: string;
  /** Historical series key (winners by series), e.g. "open-4", "crown-latium", "lopen-gallia-upper", "masters". */
  series?: string;
  /** Winner's trophy definition id. */
  trophy?: string;
  /** Local opens: arena band [lo, hi]. */
  band?: [number, number];
  /** Qualifier: the tournament its winner qualifies for. */
  feeds?: string;
  /** Entrants guaranteed a place through qualifiers / regional opens. */
  qualified?: string[];
  /** Match length for match-series events created by the regional circuit. */
  matchGames?: number;
  /** Set once rivalry encounters / upsets have been recorded (idempotency guard). */
  encounters?: boolean;
};

export type WorldState = SimContext & {
  titles: TitleState[];
  reigns: TitleReign[];
  tournaments: WorldTournament[];
  invitations: Invitation[];
  season: number;
  tournamentSerial: number;
  history: TournamentSummary[];
  // ---- v0.2 (optional; `ensureWorldV2` initialises them) ----
  /** Permanent, append-only trophy registry. */
  awards?: AwardRecord[];
  /** Hall of Records: survives competitor pruning. */
  hall?: HallOfRecords;
  /** Seasonal points tally per "season:arena" until the seasonal award is presented. */
  seasonTally?: Record<string, Record<string, number>>;
  worldVersion?: number;
  // ---- v0.3 (optional; `ensureWorldV3` initialises them) ----
  /** Regional crowns (one per region; `arena` is -1). */
  regionTitles?: TitleState[];
  /** Reigns of regional crowns (never pruned). */
  regionReigns?: TitleReign[];
  /** Seasonal points tally per "season:region" (regional events) until the Provincial Laurel is presented. */
  regionTally?: Record<string, Record<string, number>>;
  /** Rivalries built from important tournament encounters (capped, see world/rivalry.ts). */
  feuds?: Feud[];
  /** Notable upsets (capped log). */
  upsets?: UpsetEntry[];
  /** Population size the world was created / last grown for. */
  populationTarget?: number;
  /** Arena layout: 24 (v0.3: 24 arenas, 72 ranks). Absent = v0.2 layout (12 / 36), remapped by ensureWorldV3. */
  arenaLayout?: number;
};

export type TournamentSummary = {
  id: string; name: string; arena: number; kind: TournamentKind; format: Format; season: number; endDay: number;
  winner: string | null; winnerName: string; runnerUp: string | null; runnerUpName: string; playerPlace?: number; size: number;
  /** v0.3 (optional): circuit, series and prestige of the event. */
  region?: string; series?: string; prestige?: number;
};

export type Save = {
  schema: number;
  createdAt: string;
  updatedAt: string;
  seed: number;
  player: PlayerState;
  world: WorldState;
  settings: Settings;
  active: ActiveGame | null;
  library: string[]; // GameRecord ids, newest last
  libraryMeta: Record<string, LibraryMeta>;
  coach: CoachState;
};

export type LibraryMeta = {
  id: string; day: number; kind: GameKind; white: string; black: string; result: ResultCode;
  playerColor: 'w' | 'b' | null; accuracy?: number; opening?: string; analysed: boolean; eloDelta?: number; source: 'engine' | 'player';
};

export type CoachState = {
  positions: TrainingPosition[];
  lastRecommendation?: string;
};

export type TrainingPosition = {
  id: string;
  fen: string;
  bestUci: string;
  playedUci: string;
  theme: 'tactic' | 'endgame' | 'opening' | 'mate' | 'conversion' | 'defence';
  fromGame: string;
  ply: number;
  solved: number;
  failed: number;
};

export type { Competitor, ChronicleEntry };
