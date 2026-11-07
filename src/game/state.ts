import type { RatingState, TimeControlPool } from '../rating/elo';
import type { Competitor, ChronicleEntry, TitleState, TitleReign } from '../world/types';
import type { SimContext } from '../world/sim';
import type { TournamentState, Format } from '../tournament/formats';
import type { ResultCode, Termination } from '../chess/rules';

export const SAVE_SCHEMA = 1;

export type TimeControl = { id: string; pool: TimeControlPool; label: string; baseSec: number; incSec: number };
export const TIME_CONTROLS: TimeControl[] = [
  { id: 'blitz-5', pool: 'blitz', label: '5 min', baseSec: 300, incSec: 0 },
  { id: 'blitz-3-2', pool: 'blitz', label: '3 + 2', baseSec: 180, incSec: 2 },
  { id: 'rapid-10', pool: 'rapid', label: '10 min', baseSec: 600, incSec: 0 },
  { id: 'rapid-15-10', pool: 'rapid', label: '15 + 10', baseSec: 900, incSec: 10 },
  { id: 'classical-30', pool: 'classical', label: '30 min', baseSec: 1800, incSec: 0 },
  { id: 'untimed', pool: 'untimed', label: 'Untimed', baseSec: 0, incSec: 0 },
];

export type BoardMode = '3d' | '2d';
export type AnimSpeed = 'fast' | 'balanced' | 'cinematic';

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
  reduceMotion: boolean;
  highContrast: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  boardMode: '3d', animSpeed: 'balanced', pieceSet: 0, boardSet: 0, sound: true, ambience: false,
  showLegal: true, showCoords: true, autoQueen: false, opponentPace: 'natural', careerPool: 'rapid',
  defaultTc: 'rapid-10', cameraTilt: 0.55, reduceMotion: false, highContrast: false,
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
};

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
};

export type TournamentKind = 'open' | 'cup' | 'gauntlet' | 'invitational' | 'league' | 'championship' | 'hosted';

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
};

export type WorldState = SimContext & {
  titles: TitleState[];
  reigns: TitleReign[];
  tournaments: WorldTournament[];
  invitations: Invitation[];
  season: number;
  tournamentSerial: number;
  history: TournamentSummary[];
};

export type TournamentSummary = {
  id: string; name: string; arena: number; kind: TournamentKind; format: Format; season: number; endDay: number;
  winner: string | null; winnerName: string; runnerUp: string | null; runnerUpName: string; playerPlace?: number; size: number;
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
