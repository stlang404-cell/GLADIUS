/**
 * Achievements — evaluated only from authoritative state: the player ledger
 * (game.ledger.ts), the permanent trophy registry, title reigns and the
 * player's career record. Every achievement is `metric(ctx) >= target`, so
 * evaluation is idempotent and progress is always shown honestly.
 *
 * Ids of the original 20 achievements are kept (old saves store
 * player.achievements as Record<id, day>).
 * Rewards are modest Influence only — never anything that affects chess.
 */
import type { Save, GameRecord, PlayerLedger } from './state';
import type { AwardRecord } from '../world/types';
import { RANKS, ARENAS, ARENA_COUNT, RANK_COUNT, TOP_ARENA, TRIAL_BYPASS_MARGIN, migrateArenaIndex } from '../world/arenas';
import { awardsFor, isVictory, TROPHY_BY_ID } from '../world/trophies';
import { recordLeaders, type RecordKey } from '../world/records';
import { cnt, setSize, ensureLedger, ledgerRecordAnalysis } from './ledger';
import { feudsOf } from '../world/rivalry';

export type AchievementCategory =
  | 'chess-mastery' | 'tactical-brilliance' | 'endgame-excellence' | 'tournament-victories' | 'arena-conquests'
  | 'rivalries' | 'championship-defenses' | 'career-milestones' | 'rating-achievements' | 'historical-legacy';
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  'chess-mastery': 'Chess mastery', 'tactical-brilliance': 'Tactical brilliance', 'endgame-excellence': 'Endgame excellence',
  'tournament-victories': 'Tournament victories', 'arena-conquests': 'Arena conquests', rivalries: 'Rivalries',
  'championship-defenses': 'Championship defences', 'career-milestones': 'Career milestones',
  'rating-achievements': 'Rating achievements', 'historical-legacy': 'Historical legacy',
};

/** Influence granted on unlock, by rarity (modest; documented in docs/WORLD.md). */
export const RARITY_REWARD: Record<AchievementRarity, number> = { common: 2, rare: 5, epic: 10, legendary: 20 };

export type AchCtx = { s: Save; L: PlayerLedger; aw: AwardRecord[] };

export type AchievementDef = {
  id: string;
  name: string;
  desc: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  target: number;
  metric: (x: AchCtx) => number;
  /** Requires stored game analysis (unlocks via onGameAnalysed). */
  analysis?: boolean;
  /** Influence reward (defaults to RARITY_REWARD[rarity]). */
  reward?: number;
  /** Progress bar is meaningful (counters); false for yes/no feats. */
  progress?: boolean;
};

// ---------------------------------------------------------------- metric helpers
const C = (key: string) => (x: AchCtx) => cnt(x.L, key);
const S = (key: string) => (x: AchCtx) => setSize(x.L, key);
const games = (x: AchCtx) => x.s.player.w + x.s.player.d + x.s.player.l;
const peakArena = (x: AchCtx) => RANKS[x.s.player.peakRank].arena;
const victories = (x: AchCtx) => x.aw.filter(isVictory);
const nAw = (pred: (a: AwardRecord) => boolean) => (x: AchCtx) => x.aw.filter(pred).length;
const wonDef = (prefix: string) => nAw((a) => a.defId.startsWith(prefix));
const sigArenas = (x: AchCtx) => new Set(x.aw.filter((a) => a.defId.startsWith('sig-')).map((a) => a.arena)).size;
const reigns = (x: AchCtx) => x.s.world.reigns.filter((r) => r.holder === 'player');
const maxDefenses = (title?: string) => (x: AchCtx) => Math.max(0, ...reigns(x).filter((r) => !title || r.titleId === title).map((r) => r.defenses));
const maxReignDays = (x: AchCtx) => Math.max(0, ...reigns(x).map((r) => (r.to ?? x.s.world.day) - r.from));
const rivals = (x: AchCtx) => Object.values(x.s.player.rivals ?? {});
const h2hList = (x: AchCtx) => Object.values(x.s.player.h2h ?? {});
const meetings = (x: AchCtx, id: string | null) => {
  const h = id ? x.s.player.h2h[id] : undefined;
  return h ? h.w + h.d + h.l : 0;
};
const careerDays = (x: AchCtx) => x.s.world.day - x.s.player.createdDay;
const holdsRecord = (keys: RecordKey[]) => (x: AchCtx) => (keys.some((k) => recordLeaders(x.s.world, k, 1, x.s.player)[0]?.holder === 'player') ? 1 : 0);
const minEg = (x: AchCtx) => ['egRook', 'egQueen', 'egPawn', 'egMinor'].filter((k) => cnt(x.L, k) > 0).length;

type Row = [id: string, name: string, desc: string, rarity: AchievementRarity, target: number, metric: (x: AchCtx) => number, extra?: Partial<AchievementDef>];
const cat = (category: AchievementCategory, rows: Row[]): AchievementDef[] =>
  rows.map(([id, name, desc, rarity, target, metric, extra]) => ({ id, name, desc, category, rarity, target, metric, progress: target > 1, ...extra }));
const A = { analysis: true } as const;

const RATING_STEPS: [number, string, AchievementRarity][] = [
  [1000, 'Iron Will', 'common'], [1200, 'Bronze Discipline', 'common'], [1400, 'Silver Tongue of the Board', 'common'],
  [1600, 'Golden Tactician', 'rare'], [1800, 'Senatorial Mind', 'rare'], [2000, 'Consular Strength', 'epic'],
  [2200, 'Colosseum Grade', 'epic'], [2400, 'Palatine Mastery', 'legendary'], [2600, 'Among the Caesars', 'legendary'], [2800, 'Beyond Mortal Reckoning', 'legendary'],
];
const ARENA_REACH: [number, string, string, AchievementRarity][] = [
  [1, 'arena-1', 'Marching Orders', 'common'], [2, 'arena-2', 'Behind Iron Walls', 'common'], [3, 'arena-3', 'Into the Court', 'common'],
  [4, 'arena-4', 'The Sacred Way', 'rare'], [5, 'arena-5', 'Praetorian', 'rare'], [6, 'arena-6', 'Senator', 'rare'],
  [7, 'arena-7', 'Consul', 'epic'], [8, 'arena-8', 'Fifty Thousand Voices', 'epic'], [9, 'arena-9', 'Palatine', 'epic'],
  [10, 'arena-10', 'Hall of the Immortals', 'legendary'], [11, 'arena-11', 'Eternal', 'legendary'],
];
/** v0.3: the ids keep naming the v0.2 arenas (old index i); the target is that arena's v0.3 index (2·i, Eternal Throne 23). */
const reachTarget = (old: number) => migrateArenaIndex(old);
const arenaDesc = (a: number) => ARENAS[a].name.replace(/^The /, 'the ');
const TITLE_TOP = `title-${TOP_ARENA}`;
const CENTURIO_RANK = RANKS.find((r) => r.title === 'Centurio')!.index;

export const ACHIEVEMENTS: AchievementDef[] = [
  ...cat('chess-mastery', [
    ['first-blood', 'First Blood', 'Win your first game.', 'common', 1, (x) => x.s.player.w],
    ['proven-blade', 'Proven Blade', 'Win 10 rated games against eligible opponents (rated no more than 200 below you).', 'common', 10, C('eligibleWins')],
    ['seasoned-gladiator', 'Seasoned Gladiator', 'Win 50 eligible rated games.', 'rare', 50, C('eligibleWins')],
    ['arena-veteran', 'Arena Veteran', 'Win 200 eligible rated games.', 'epic', 200, C('eligibleWins')],
    ['undying-legend', 'Undying Legend', 'Win 1,000 eligible rated games.', 'legendary', 1000, C('eligibleWins')],
    ['shadow-legion', 'Shadow Legion', 'Win 25 eligible games with Black.', 'rare', 25, C('eligibleWinsBlack')],
    ['master-of-time', 'Master of Patience', 'Win eligible games with 5 different openings.', 'rare', 5, (x) => (x.L.sets.openingsWon ?? []).length],
    ['iron-shield', 'Iron Shield', 'Draw 10 rated games against opponents rated 100+ above you.', 'rare', 10, C('drawsHigher')],
    ['student', 'Student of the Game', 'Analyse 10 of your games.', 'common', 10, (x) => Object.values(x.s.libraryMeta).filter((m) => m.analysed && m.playerColor).length],
    ['scholar', 'Scholar of the Board', 'Analyse 50 of your games.', 'rare', 50, (x) => Object.values(x.s.libraryMeta).filter((m) => m.analysed && m.playerColor).length],
    ['precise', 'Precision', 'Score 90%+ accuracy in an eligible won game (analysis required).', 'rare', 1, C('acc90Wins'), A],
    ['master-of-calculation', 'Master of Calculation', 'Win an eligible game of 30+ moves with 92%+ accuracy (analysis required).', 'epic', 1, C('acc92Wins'), A],
    ['clockwork', 'Clockwork Precision', 'Play 10 eligible games at 85%+ accuracy (analysis required).', 'epic', 10, C('acc85Games'), A],
    ['flawless', 'Flawless', 'Win an eligible game of 30+ moves without a mistake, blunder or missed win (analysis required).', 'rare', 1, C('flawlessWins'), A],
    ['opening-scholar', 'Opening Scholar', 'Win eligible games with 10 different openings.', 'rare', 10, S('openingsWon')],
    ['repertoire', 'A Wide Repertoire', 'Play 25 different openings.', 'rare', 25, S('openingsPlayed')],
    ['diligent-student', 'Diligent Student', 'Solve 25 personal training positions.', 'rare', 25, (x) => x.s.coach.positions.reduce((n, p) => n + (p.solved > 0 ? 1 : 0), 0)],
  ]),
  ...cat('tactical-brilliance', [
    ['mate-quick', 'Swift Blade', 'Checkmate an eligible opponent in under 20 moves.', 'common', 1, C('quickMates')],
    ['miniature', 'Miniature', 'Checkmate an eligible opponent in 15 moves or fewer.', 'rare', 1, C('miniatures')],
    ['executioner', 'Executioner', 'Win 10 eligible games by checkmate.', 'rare', 10, C('mates')],
    ['coup-de-grace', 'Master of the Final Blow', 'Win 50 eligible games by checkmate.', 'epic', 50, C('mates')],
    ['first-brilliance', 'First Brilliance', 'Play a brilliant move in an eligible game (analysis required).', 'rare', 1, C('brilliant'), A],
    ['brilliant-victory', 'Brilliant Victory', 'Win an eligible game containing a brilliant move (analysis required).', 'rare', 1, C('brilliantWins'), A],
    ['ten-brilliancies', 'Ten Brilliancies', 'Play 10 brilliant moves in eligible games (analysis required).', 'epic', 10, C('brilliant'), A],
    ['double-brilliance', 'Double Brilliance', 'Play two brilliant moves in one eligible game (analysis required).', 'legendary', 1, C('doubleBrilliant'), A],
    ['sharp-eye', 'Sharp Eye', 'Find 25 great moves in eligible games (analysis required).', 'rare', 25, C('great'), A],
    ['underpromote', 'Humble Crown', 'Win an eligible game in which you underpromoted.', 'rare', 1, C('underpromoWins')],
    ['davids-sling', "David's Sling", 'Defeat an opponent rated 200+ above you.', 'common', 1, C('upset200')],
    ['giant-slayer', 'Giant Slayer', 'Defeat an opponent rated 300+ above you.', 'rare', 1, C('upset300')],
    ['titan-slayer', 'Titan Slayer', 'Defeat an opponent rated 400+ above you.', 'legendary', 1, C('upset400')],
    ['kingmaker', 'Bane of the Favoured', 'Win 10 games against opponents rated 100+ above you.', 'epic', 10, C('upset100')],
    ['the-comeback', 'The Comeback', 'Win an eligible game after your winning chances fell to 25% or less (analysis required).', 'epic', 1, C('comebacks'), A],
  ]),
  ...cat('endgame-excellence', [
    ['closer', 'The Closer', 'Win an eligible game that reached an endgame (analysis required).', 'common', 1, C('endgameWins'), A],
    ['rook-whisperer', 'Rook Whisperer', 'Win 5 rook endgames (analysis required).', 'rare', 5, C('egRook'), A],
    ['kings-march', "King's March", 'Win 3 king-and-pawn endgames (analysis required).', 'rare', 3, C('egPawn'), A],
    ['queens-gambit-won', 'Queen of the Endgame', 'Win 3 queen endgames (analysis required).', 'rare', 3, C('egQueen'), A],
    ['minor-masterpiece', 'Minor Masterpiece', 'Win 3 bishop/knight endgames (analysis required).', 'rare', 3, C('egMinor'), A],
    ['endgame-virtuoso', 'Endgame Virtuoso', 'Win 25 endgames (analysis required).', 'epic', 25, C('endgameWins'), A],
    ['complete-technique', 'Complete Technique', 'Win a rook, queen, pawn and minor-piece endgame (analysis required).', 'epic', 4, minEg, A],
    ['fortress-builder', 'Fortress Builder', 'Save 3 eligible games as draws from 25% or less (analysis required).', 'rare', 3, C('saves'), A],
    ['marathon', 'Marathon', 'Win an eligible game of 80+ moves.', 'rare', 1, C('longWins80')],
    ['attrition', 'War of Attrition', 'Win 10 eligible games of 60+ moves.', 'epic', 10, C('longWins60')],
  ]),
  ...cat('tournament-victories', [
    ['first-trophy', 'Laurels', 'Win a tournament.', 'common', 1, (x) => x.s.player.tournamentsWon],
    ['five-trophies', 'Trophy Hall', 'Win five tournaments.', 'rare', 5, (x) => x.s.player.tournamentsWon],
    ['gilded-hall', 'Gilded Hall', 'Win 15 events.', 'epic', 15, (x) => victories(x).length],
    ['imperial-treasury', 'Imperial Treasury', 'Win 40 events.', 'legendary', 40, (x) => victories(x).length],
    ['open-champion', 'Open Champion', 'Win a Swiss Open.', 'common', 1, wonDef('cup-open-')],
    ['knockout-artist', 'Knockout Artist', 'Win a single-elimination Cup.', 'rare', 1, wonDef('cup-cup-')],
    ['gauntlet-runner', 'Gauntlet Runner', 'Win a double-elimination Gauntlet.', 'rare', 1, wonDef('cup-gauntlet-')],
    ['regional-champion', 'Regional Champion', 'Win a season League.', 'rare', 1, wonDef('league-')],
    ['invited-victor', 'Invited Victor', 'Win an Invitational.', 'rare', 1, wonDef('invit-')],
    ['elite-invitational', 'Elite Invitational', 'Win an Invitational in the Senate Hall or above.', 'epic', 1, (x) => x.aw.filter((a) => /^invit-t[23]$/.test(a.defId)).length],
    ['patron-victor', "Patron's Victory", 'Win an invitational you hosted.', 'common', 1, wonDef('hosted-')],
    ['unbroken-laurel', 'Unbroken Laurel', 'Win a tournament or championship without losing a game.', 'epic', 1, (x) => victories(x).filter((a) => a.unbeaten).length],
    ['perfect-campaign', 'The Perfect Campaign', 'Win an event of 5+ games with a perfect score.', 'legendary', 1, wonDef('hist-perfect')],
    ['silver-standard', 'Silver Standard', 'Collect 5 finalist medals.', 'rare', 5, wonDef('medal-')],
    ['circuit-regular', 'Circuit Regular', 'Play in 25 tournaments.', 'rare', 25, (x) => x.s.player.tournamentsPlayed],
    ['season-laurel', 'Laurel of the Season', 'Be a season\'s top performer in an arena.', 'epic', 1, wonDef('laurel-')],
    ['master-of-season', 'Master of the Season', 'Win three events in one arena in a single season.', 'legendary', 1, wonDef('hist-sweep')],
  ]),
  ...cat('arena-conquests', [
    ...ARENA_REACH.map(([a, id, name, r]): Row => [id, name, `Reach ${arenaDesc(reachTarget(a))}.`, r, reachTarget(a), peakArena, { progress: true }]),
    ['rank-centurio', 'The Centurion', 'Reach the rank of Centurio.', 'rare', CENTURIO_RANK, (x) => x.s.player.peakRank, { progress: true }],
    ['rank-caesar-aeternus', 'Caesar Aeternus', 'Reach the highest rank of the empire.', 'legendary', RANK_COUNT - 1, (x) => x.s.player.peakRank, { progress: true }],
    ['proven-in-trial', 'Proven in Trial', 'Win a promotion trial.', 'common', 1, C('trialsWon')],
    ['trial-master', 'Five Gates', 'Win 5 promotion trials.', 'rare', 5, C('trialsWon')],
    ['dominance', 'Dominance', `Be promoted into a new arena by dominance (${TRIAL_BYPASS_MARGIN}+ above its floor).`, 'rare', 1, C('dominancePromotions')],
    ['first-signature', 'Signature Victory', "Win any arena's signature championship trophy.", 'epic', 1, wonDef('sig-')],
    ['half-the-empire', 'Half the Empire', `Win signature championships in ${ARENA_COUNT / 2} different arenas.`, 'legendary', ARENA_COUNT / 2, sigArenas],
    ['the-conqueror', 'The Conqueror', `Win the signature championships of all ${ARENA_COUNT} arenas.`, 'legendary', ARENA_COUNT, sigArenas],
    ['collector', 'Collector', 'Unlock 6 board and piece collections.', 'rare', 6, (x) => x.s.player.unlockedSets.length],
  ]),
  ...cat('rivalries', [
    ['rival', 'Nemesis', 'Acquire a rival.', 'common', 1, (x) => (x.s.player.rivalId ? 1 : 0)],
    ['settling-scores', 'Settling Scores', 'Defeat your rival.', 'common', 1, C('rivalWins')],
    ['rival-tamer', 'Rival Tamer', 'Defeat your rivals 10 times.', 'rare', 10, C('rivalWins')],
    ['rival-in-the-arena', 'Rival in the Arena', 'Defeat your rival in a tournament game.', 'rare', 1, C('rivalTournamentWins')],
    ['vendetta', 'Vendetta', 'Win the next meeting after losing to an eligible opponent.', 'common', 1, C('revengeWins')],
    ['nemesis-overcome', 'Nemesis Overcome', 'Beat an opponent who had beaten you at least 3 times and led your head-to-head.', 'rare', 1, C('nemesisWins')],
    ['dominant-rivalry', 'Dominant Rivalry', 'Lead a rivalry of 10+ games by 5 wins.', 'epic', 1, (x) => h2hList(x).filter((h) => h.w + h.d + h.l >= 10 && h.w - h.l >= 5).length],
    ['eternal-rivals', 'Eternal Rivals', 'Play 50 games against one opponent.', 'epic', 50, (x) => Math.max(0, ...h2hList(x).map((h) => h.w + h.d + h.l))],
    ['rival-championship', 'Clash of Titans', 'Win a championship match against a rival (10+ meetings).', 'legendary', 1, (x) => x.aw.filter((a) => a.defId.startsWith('sig-') && meetings(x, a.finalOpponent) >= 10).length],
    ['championship-battles', 'Old Adversaries', 'Meet the same opponent in 3 championship matches.', 'epic', 3, (x) => Math.max(0, ...rivals(x).map((r) => r.championshipBattles))],
  ]),
  ...cat('championship-defenses', [
    ['champion', 'Champion', 'Win an arena championship.', 'rare', 1, (x) => x.s.player.championships],
    ['title-contender', 'Title Contender', 'Play in a championship match.', 'common', 1, C('championshipGames')],
    ['emperor', 'Caesar of the Throne', 'Hold the Eternal Throne title.', 'legendary', 1, (x) => (x.s.player.titles.includes(TITLE_TOP) || reigns(x).some((r) => r.titleId === TITLE_TOP) ? 1 : 0)],
    ['first-defense', 'First Defence', 'Successfully defend an arena title.', 'rare', 1, wonDef('defense-')],
    ['iron-crown', 'Iron Crown', 'Defend arena titles 3 times.', 'epic', 3, wonDef('defense-')],
    ['iron-champion', 'The Iron Champion', 'Defend arena titles 10 times.', 'legendary', 10, wonDef('defense-')],
    ['dynasty', 'Dynasty', 'Hold one title through four consecutive championships.', 'legendary', 3, maxDefenses()],
    ['imperial-defender', 'Imperial Defender', 'Defend the Eternal Throne title 3 times.', 'legendary', 3, (x) => x.aw.filter((a) => a.defId.startsWith('defense-') && a.arena === TOP_ARENA).length],
    ['eternal-caesar', 'Eternal Caesar', 'Hold the Eternal Throne for 4 consecutive seasons.', 'legendary', 3, maxDefenses(TITLE_TOP)],
    ['the-return', 'The Return', 'Regain a title you had lost.', 'epic', 1, wonDef('hist-comeback')],
    ['three-crowns', 'Three Crowns', 'Win the championships of 3 different arenas.', 'epic', 3, sigArenas],
    ['year-of-reign', 'A Year on the Throne', 'Hold an arena title for 112 days (one in-world year).', 'epic', 112, maxReignDays],
    ['fall-of-a-giant', 'Fall of a Giant', 'Take a title from a champion rated 150+ above you.', 'legendary', 1, wonDef('hist-upset-crown')],
  ]),
  ...cat('career-milestones', [
    ['centurion', 'A Hundred Battles', 'Play 100 games.', 'common', 100, games],
    ['legion', 'A Legion', 'Play 500 games.', 'rare', 500, games],
    ['ten-centuries', 'Ten Centuries', 'Play 1,000 games.', 'epic', 1000, games],
    ['streak-5', 'Unstoppable', 'Win five eligible games in a row.', 'rare', 5, C('bestEligibleStreak')],
    ['streak-10', 'Relentless', 'Win ten eligible games in a row.', 'epic', 10, C('bestEligibleStreak')],
    ['unbeaten-20', 'Unbreakable', 'Go 20 eligible games without a loss.', 'epic', 20, C('bestUnbeaten')],
    ['first-year', 'First Year in the Empire', 'Compete for one in-world year.', 'common', 112, careerDays],
    ['five-years', 'Five Years of Glory', 'Compete for five in-world years.', 'epic', 560, careerDays],
    ['decade', 'A Decade of Legend', 'Compete for ten in-world years.', 'legendary', 1120, careerDays],
    ['four-seasons', 'Four Seasons', 'Complete four seasons.', 'common', 4, (x) => x.s.player.seasonReports?.length ?? 0],
    ['influence-100', 'Patron', 'Hold 100 Influence.', 'rare', 100, (x) => x.s.player.influence],
    ['prestige-1000', 'Living Legend', 'Earn 1,000 lifetime prestige.', 'epic', 1000, (x) => x.s.player.prestige],
    ['prestige-5000', 'Name Carved in Marble', 'Earn 5,000 lifetime prestige.', 'legendary', 5000, (x) => x.s.player.prestige],
    ['host-games', 'Giver of Games', 'Host an invitational.', 'common', 1, C('hosted')],
    ['circuit-podium', 'On the Podium', 'Finish in the top three of 10 tournaments.', 'rare', 10, C('podiums')],
  ]),
  ...cat('rating-achievements', [
    ...RATING_STEPS.map(([r, name, rar]): Row => [`rating-${r}`, name, `Reach an established rating of ${r} (any pool, 20+ games).`, rar, r, (x) => x.L.peakEstablished, { progress: true }]),
    ['breakthrough-season', 'Breakthrough Season', 'Gain 200 rating points within one season.', 'rare', 200, (x) => Math.max(0, ...(x.s.player.seasonReports ?? []).map((r) => r.ratingEnd - r.ratingStart))],
    ['immortal-peak', 'Immortal Peak', "Hold the empire's all-time highest peak rating.", 'legendary', 1, holdsRecord(['peak-elo'])],
  ]),
  // v0.3 "Golden Age": regional circuits, imperial events and tournament rivalries (9 new; all from the award registry / feuds).
  ...cat('tournament-victories', [
    ['local-hero', 'Local Hero', 'Win a Local Open of your region.', 'common', 1, wonDef('lopen-')],
    ['through-the-qualifier', 'Through the Qualifier', 'Win an arena Qualifier and earn your Invitational place.', 'common', 1, wonDef('qual-')],
    ['imperial-master', 'Imperial Master', 'Win the Imperial Masters.', 'legendary', 1, wonDef('masters')],
    ['laurel-of-the-province', 'Laurel of the Province', "Be a season's top performer in your region's circuit.", 'rare', 1, wonDef('rlaurel')],
  ]),
  ...cat('championship-defenses', [
    ['provincial-crown', 'Crown of the Province', 'Win your region\'s crown.', 'epic', 1, wonDef('rcrown-')],
    ['crown-defender', 'Defender of the Province', 'Successfully defend a regional crown.', 'epic', 1, wonDef('rdefense')],
    ['provincial-dynasty', 'Provincial Dynasty', 'Hold a regional crown through four consecutive title contests.', 'legendary', 1, wonDef('hist-regional-dynasty')],
  ]),
  ...cat('rivalries', [
    ['blood-feud', 'Blood Feud', 'Build a tournament rivalry of intensity 15 (finals, eliminations, title clashes).', 'epic', 15, (x) => Math.max(0, ...feudsOf(x.s.world, 'player', 1).map((f) => f.intensity))],
  ]),
  ...cat('historical-legacy', [
    ['slayer-of-giants', 'Slayer of Giants', 'Win a final or title match against an opponent rated 250+ higher.', 'legendary', 1, wonDef('hist-giant-slayer')],
  ]),
  ...cat('historical-legacy', [
    ['hall-of-records', 'Hall of Records', 'Hold any all-time record of the empire.', 'legendary', 1, holdsRecord(['championships', 'consecutive-defenses', 'longest-reign', 'tournament-wins', 'arena-championships', 'peak-elo'])],
    ['decorated', 'Corona Civica', 'Earn the lifetime distinction for 10 event victories.', 'epic', 1, wonDef('dist-decorated')],
    ['laureate', 'Corona Aurea', 'Earn the lifetime distinction for 25 event victories.', 'legendary', 1, wonDef('dist-laureate')],
    ['triple-crown', 'Triple Crown', 'Earn the Triple Crown distinction.', 'legendary', 1, wonDef('dist-triple-crown')],
    ['last-seed', 'Last Seed, First Place', 'Win an event of 8+ entrants as its lowest seed.', 'legendary', 1, wonDef('hist-underdog')],
    ['champion-slayer', 'Champion Slayer', 'Beat a reigning arena champion in a rated game.', 'epic', 1, C('beatChampion')],
    ['emperor-slayer', 'Regicide', 'Beat the reigning champion of the Eternal Throne.', 'legendary', 1, C('beatEmperor')],
    ['legend-slayer', 'Legend Slayer', 'Beat an opponent with 3+ championships.', 'epic', 1, C('beatLegend')],
    ['chronicled', 'Written in the Chronicle', 'Appear in the Imperial Chronicle 10 times.', 'rare', 10, (x) => x.s.world.chronicle.filter((e) => e.kind === 'player' || e.ids?.includes('player')).length],
    ['rare-honour', 'A Rare Honour', 'Win any legendary-tier trophy.', 'legendary', 1, nAw((a) => TROPHY_BY_ID[a.defId]?.tier === 'legendary')],
  ]),
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

function ctxOf(s: Save): AchCtx {
  return { s, L: ensureLedger(s.player, s.world.day), aw: awardsFor(s.world, 'player') };
}

export type AchievementUnlock = { id: string; name: string; reward: number };

/**
 * Evaluate all locked achievements and unlock those whose condition holds.
 * Idempotent. Grants the Influence reward and writes a timeline event per
 * unlock. Returns names (back-compatible with PostGame.achievements).
 */
export function checkAchievements(s: Save, _g: GameRecord | null = null): string[] {
  return unlockAchievements(s).map((u) => u.name);
}

export function unlockAchievements(s: Save): AchievementUnlock[] {
  const x = ctxOf(s);
  const out: AchievementUnlock[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.player.achievements[a.id] !== undefined) continue;
    if (a.metric(x) < a.target) continue;
    s.player.achievements[a.id] = s.world.day;
    const reward = a.reward ?? RARITY_REWARD[a.rarity];
    s.player.influence += reward;
    s.player.prestige += reward;
    (s.player.timeline ??= []).push({ day: s.world.day, kind: 'achievement', text: `Achievement: ${a.name}`, ref: a.id });
    out.push({ id: a.id, name: a.name, reward });
  }
  return out;
}

export type AchievementStatus = {
  def: AchievementDef; unlockedDay: number | null; current: number; target: number; fraction: number;
};
/** Progress of every achievement (pure; for the Legacy tab). */
export function achievementProgress(s: Save, opts: { progressOnly?: boolean } = {}): AchievementStatus[] {
  const x: AchCtx = { s, L: s.player.ledger ?? { v: 1, since: 0, c: {}, sets: {}, analysed: {}, recentIds: [], recent: [], peakEstablished: 0 }, aw: awardsFor(s.world, 'player') };
  return ACHIEVEMENTS.filter((def) => !opts.progressOnly || def.progress).map((def) => {
    const d = s.player.achievements[def.id];
    const cur = Math.max(0, Math.min(def.target, def.metric(x)));
    return { def, unlockedDay: d ?? null, current: d !== undefined ? def.target : cur, target: def.target, fraction: d !== undefined ? 1 : def.target ? cur / def.target : 0 };
  });
}

/**
 * Entry point for the UI analysis queue: call after a player's GameRecord
 * has been analysed and stored. Applies the analysis to the ledger once per
 * game id, then evaluates achievements. Returns newly unlocked names.
 */
export function onGameAnalysed(s: Save, g: GameRecord): string[] {
  if (!g.analysis || !g.playerColor) return [];
  if (!ledgerRecordAnalysis(s, g)) return [];
  return checkAchievements(s, g);
}

export function achievementCounts(): Record<AchievementCategory, number> {
  const out = {} as Record<AchievementCategory, number>;
  for (const a of ACHIEVEMENTS) out[a.category] = (out[a.category] ?? 0) + 1;
  return out;
}
