import type { Save, GameRecord } from './state';
import { RANKS } from '../world/arenas';

export type AchievementDef = { id: string; name: string; desc: string; test: (s: Save, g: GameRecord | null) => boolean };

const won = (_s: Save, g: GameRecord | null) => !!g && g.playerColor !== null && ((g.result === '1-0' && g.playerColor === 'w') || (g.result === '0-1' && g.playerColor === 'b'));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-blood', name: 'First Blood', desc: 'Win your first game.', test: (s) => s.player.w >= 1 },
  { id: 'centurion', name: 'Centurion', desc: 'Play 100 games.', test: (s) => s.player.w + s.player.d + s.player.l >= 100 },
  { id: 'legion', name: 'A Legion', desc: 'Play 500 games.', test: (s) => s.player.w + s.player.d + s.player.l >= 500 },
  { id: 'streak-5', name: 'Unstoppable', desc: 'Win five games in a row.', test: (s) => s.player.streak >= 5 },
  { id: 'giant-slayer', name: 'Giant Slayer', desc: 'Defeat an opponent rated 300+ above you.', test: (s, g) => won(s, g) && !!g && (g.playerColor === 'w' ? g.black.rating - g.white.rating : g.white.rating - g.black.rating) >= 300 },
  { id: 'mate-quick', name: 'Swift Blade', desc: 'Checkmate in under 20 moves.', test: (s, g) => won(s, g) && !!g && g.termination === 'checkmate' && g.moves.length < 40 },
  { id: 'underpromote', name: 'Humble Crown', desc: 'Win a game in which you underpromoted.', test: (s, g) => won(s, g) && !!g && g.moves.some((m, i) => m.length === 5 && m[4] !== 'q' && (i % 2 === 0) === (g.playerColor === 'w')) },
  { id: 'arena-3', name: 'Into the Court', desc: "Reach the Gladiator's Court.", test: (s) => RANKS[s.player.peakRank].arena >= 3 },
  { id: 'arena-6', name: 'Senator', desc: 'Reach the Senate Hall.', test: (s) => RANKS[s.player.peakRank].arena >= 6 },
  { id: 'arena-9', name: 'Palatine', desc: 'Reach the Imperial Palace.', test: (s) => RANKS[s.player.peakRank].arena >= 9 },
  { id: 'arena-11', name: 'Eternal', desc: 'Reach the Eternal Throne.', test: (s) => RANKS[s.player.peakRank].arena >= 11 },
  { id: 'first-trophy', name: 'Laurels', desc: 'Win a tournament.', test: (s) => s.player.tournamentsWon >= 1 },
  { id: 'five-trophies', name: 'Trophy Hall', desc: 'Win five tournaments.', test: (s) => s.player.tournamentsWon >= 5 },
  { id: 'champion', name: 'Champion', desc: 'Win an arena championship.', test: (s) => s.player.championships >= 1 },
  { id: 'emperor', name: 'Caesar Aeternus', desc: 'Hold the Eternal Throne title.', test: (s) => s.player.titles.includes('title-11') },
  { id: 'student', name: 'Student of the Game', desc: 'Analyse 10 of your games.', test: (s) => Object.values(s.libraryMeta).filter((m) => m.analysed && m.playerColor).length >= 10 },
  { id: 'precise', name: 'Precision', desc: 'Score 90%+ accuracy in a won game.', test: (s) => Object.values(s.libraryMeta).some((m) => (m.accuracy ?? 0) >= 90 && m.eloDelta !== undefined && m.eloDelta > 0) },
  { id: 'rival', name: 'Nemesis', desc: 'Acquire a rival.', test: (s) => !!s.player.rivalId },
  { id: 'influence-100', name: 'Patron', desc: 'Hold 100 Influence.', test: (s) => s.player.influence >= 100 },
  { id: 'prestige-1000', name: 'Living Legend', desc: 'Earn 1,000 lifetime prestige.', test: (s) => s.player.prestige >= 1000 },
];

export function checkAchievements(s: Save, g: GameRecord | null): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.player.achievements[a.id] !== undefined) continue;
    if (a.test(s, g)) {
      s.player.achievements[a.id] = s.world.day;
      out.push(a.name);
    }
  }
  return out;
}
