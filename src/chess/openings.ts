import { Chess } from 'chess.js';
import { positionKey, parseUci, START_FEN } from './rules';

/**
 * Opening book: named lines with ECO codes, used for opening identification
 * (position-based, so transpositions are recognised) and for book moves of
 * computer opponents. Names follow "Family: Variation" with British spelling.
 */

export type OpeningStyle = 'aggressive' | 'solid' | 'positional' | 'gambit' | 'hypermodern' | 'classical';
export type OpeningLine = { eco: string; name: string; uci: string[]; styles: OpeningStyle[]; weight: number /* popularity 1..10 */ };

export const OPENINGS: OpeningLine[] = [
  { eco: 'B20', name: "Sicilian Defence", uci: ['e2e4', 'c7c5'], styles: ['aggressive'], weight: 10 },
  { eco: 'B20', name: "Sicilian Defence: Wing Gambit", uci: ['e2e4', 'c7c5', 'b2b4'], styles: ['gambit', 'aggressive'], weight: 1 },
  { eco: 'B21', name: "Sicilian Defence: McDonnell Attack", uci: ['e2e4', 'c7c5', 'f2f4'], styles: ['aggressive'], weight: 2 },
  { eco: 'B21', name: "Sicilian Defence: Smith-Morra Gambit", uci: ['e2e4', 'c7c5', 'd2d4', 'c5d4', 'c2c3'], styles: ['gambit', 'aggressive'], weight: 4 },
  { eco: 'B21', name: "Sicilian Defence: Smith-Morra Gambit Accepted", uci: ['e2e4', 'c7c5', 'd2d4', 'c5d4', 'c2c3', 'd4c3', 'b1c3'], styles: ['gambit', 'aggressive'], weight: 3 },
  { eco: 'B22', name: "Sicilian Defence: Alapin Variation", uci: ['e2e4', 'c7c5', 'c2c3'], styles: ['solid', 'classical'], weight: 6 },
  { eco: 'B22', name: "Sicilian Defence: Alapin Variation, 2...Nf6", uci: ['e2e4', 'c7c5', 'c2c3', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'c5d4'], styles: ['solid'], weight: 4 },
  { eco: 'B22', name: "Sicilian Defence: Alapin Variation, 2...d5", uci: ['e2e4', 'c7c5', 'c2c3', 'd7d5', 'e4d5', 'd8d5', 'd2d4'], styles: ['solid'], weight: 4 },
  { eco: 'B23', name: "Sicilian Defence: Closed Variation", uci: ['e2e4', 'c7c5', 'b1c3'], styles: ['positional'], weight: 5 },
  { eco: 'B23', name: "Sicilian Defence: Grand Prix Attack", uci: ['e2e4', 'c7c5', 'b1c3', 'b8c6', 'f2f4'], styles: ['aggressive'], weight: 4 },
  { eco: 'B25', name: "Sicilian Defence: Closed Variation, Fianchetto Line", uci: ['e2e4', 'c7c5', 'b1c3', 'b8c6', 'g2g3', 'g7g6', 'f1g2', 'f8g7', 'd2d3', 'd7d6'], styles: ['positional'], weight: 3 },
  { eco: 'B27', name: "Sicilian Defence: Hyperaccelerated Dragon", uci: ['e2e4', 'c7c5', 'g1f3', 'g7g6'], styles: ['hypermodern'], weight: 2 },
  { eco: 'B28', name: "Sicilian Defence: O'Kelly Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'a7a6'], styles: ['hypermodern'], weight: 1 },
  { eco: 'B29', name: "Sicilian Defence: Nimzowitsch Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'g8f6'], styles: ['hypermodern'], weight: 1 },
  { eco: 'B30', name: "Sicilian Defence: Old Sicilian", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6'], styles: ['classical'], weight: 7 },
  { eco: 'B30', name: "Sicilian Defence: Rossolimo Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'f1b5'], styles: ['positional', 'solid'], weight: 6 },
  { eco: 'B31', name: "Sicilian Defence: Rossolimo Variation, 3...g6", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'f1b5', 'g7g6'], styles: ['positional'], weight: 4 },
  { eco: 'B32', name: "Sicilian Defence: Open Variation, 2...Nc6", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4'], styles: ['aggressive'], weight: 6 },
  { eco: 'B32', name: "Sicilian Defence: Kalashnikov Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'e7e5', 'd4b5', 'd7d6'], styles: ['aggressive'], weight: 3 },
  { eco: 'B32', name: "Sicilian Defence: Löwenthal Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'e7e5', 'd4b5', 'a7a6'], styles: ['aggressive'], weight: 1 },
  { eco: 'B33', name: "Sicilian Defence: Lasker-Pelikan Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e5'], styles: ['aggressive'], weight: 5 },
  { eco: 'B33', name: "Sicilian Defence: Sveshnikov Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e5', 'd4b5', 'd7d6', 'c1g5', 'a7a6'], styles: ['aggressive'], weight: 6 },
  { eco: 'B34', name: "Sicilian Defence: Accelerated Dragon", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g7g6'], styles: ['hypermodern'], weight: 5 },
  { eco: 'B35', name: "Sicilian Defence: Accelerated Dragon, Modern Bc4 Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g7g6', 'b1c3', 'f8g7', 'c1e3', 'g8f6', 'f1c4'], styles: ['aggressive'], weight: 3 },
  { eco: 'B36', name: "Sicilian Defence: Accelerated Dragon, Maróczy Bind", uci: ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g7g6', 'c2c4'], styles: ['positional'], weight: 4 },
  { eco: 'B40', name: "Sicilian Defence: French Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'e7e6'], styles: ['solid'], weight: 6 },
  { eco: 'B41', name: "Sicilian Defence: Kan Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'a7a6'], styles: ['solid', 'hypermodern'], weight: 5 },
  { eco: 'B42', name: "Sicilian Defence: Kan Variation, 5.Bd3", uci: ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'a7a6', 'f1d3'], styles: ['positional'], weight: 3 },
  { eco: 'B44', name: "Sicilian Defence: Taimanov Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'b8c6'], styles: ['solid'], weight: 5 },
  { eco: 'B46', name: "Sicilian Defence: Taimanov Variation, 5...a6", uci: ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'b8c6', 'b1c3', 'a7a6'], styles: ['solid'], weight: 3 },
  { eco: 'B47', name: "Sicilian Defence: Taimanov Variation, Bastrikov Line", uci: ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'b8c6', 'b1c3', 'd8c7'], styles: ['solid'], weight: 4 },
  { eco: 'B48', name: "Sicilian Defence: Taimanov Variation, English Attack", uci: ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'b8c6', 'b1c3', 'd8c7', 'c1e3'], styles: ['aggressive'], weight: 3 },
  { eco: 'B45', name: "Sicilian Defence: Four Knights Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'b8c6'], styles: ['solid'], weight: 3 },
  { eco: 'B45', name: "Sicilian Defence: Pin Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'f8b4'], styles: ['aggressive'], weight: 1 },
  { eco: 'B50', name: "Sicilian Defence: Modern Variations", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6'], styles: ['classical'], weight: 8 },
  { eco: 'B51', name: "Sicilian Defence: Moscow Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'f1b5'], styles: ['solid', 'positional'], weight: 4 },
  { eco: 'B52', name: "Sicilian Defence: Moscow Variation, 3...Bd7", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'f1b5', 'c8d7'], styles: ['solid'], weight: 3 },
  { eco: 'B53', name: "Sicilian Defence: Chekhover Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'd1d4'], styles: ['solid'], weight: 2 },
  { eco: 'B54', name: "Sicilian Defence: Open Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4'], styles: ['aggressive'], weight: 7 },
  { eco: 'B55', name: "Sicilian Defence: Prins Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'f2f3'], styles: ['positional'], weight: 1 },
  { eco: 'B56', name: "Sicilian Defence: Classical Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'b8c6'], styles: ['classical'], weight: 5 },
  { eco: 'B57', name: "Sicilian Defence: Sozin Attack", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'b8c6', 'f1c4'], styles: ['aggressive'], weight: 3 },
  { eco: 'B58', name: "Sicilian Defence: Boleslavsky Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'b8c6', 'f1e2', 'e7e5'], styles: ['classical'], weight: 2 },
  { eco: 'B60', name: "Sicilian Defence: Richter-Rauzer Attack", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'b8c6', 'c1g5'], styles: ['aggressive', 'classical'], weight: 4 },
  { eco: 'B62', name: "Sicilian Defence: Richter-Rauzer Attack, 6...e6", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'b8c6', 'c1g5', 'e7e6'], styles: ['classical'], weight: 3 },
  { eco: 'B70', name: "Sicilian Defence: Dragon Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'g7g6'], styles: ['aggressive'], weight: 7 },
  { eco: 'B70', name: "Sicilian Defence: Dragon Variation, Classical Line", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'g7g6', 'f1e2', 'f8g7'], styles: ['classical'], weight: 3 },
  { eco: 'B71', name: "Sicilian Defence: Dragon Variation, Levenfish Attack", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'g7g6', 'f2f4'], styles: ['aggressive'], weight: 1 },
  { eco: 'B75', name: "Sicilian Defence: Dragon Variation, Yugoslav Attack", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'g7g6', 'c1e3', 'f8g7', 'f2f3'], styles: ['aggressive'], weight: 6 },
  { eco: 'B76', name: "Sicilian Defence: Dragon Variation, Yugoslav Attack, 7...O-O", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'g7g6', 'c1e3', 'f8g7', 'f2f3', 'e8g8'], styles: ['aggressive'], weight: 5 },
  { eco: 'B80', name: "Sicilian Defence: Scheveningen Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e6'], styles: ['solid'], weight: 5 },
  { eco: 'B80', name: "Sicilian Defence: Scheveningen Variation, English Attack", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e6', 'c1e3', 'a7a6', 'f2f3'], styles: ['aggressive'], weight: 3 },
  { eco: 'B81', name: "Sicilian Defence: Scheveningen Variation, Keres Attack", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e6', 'g2g4'], styles: ['aggressive'], weight: 3 },
  { eco: 'B90', name: "Sicilian Defence: Najdorf Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'], styles: ['aggressive'], weight: 10 },
  { eco: 'B90', name: "Sicilian Defence: Najdorf Variation, English Attack", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'c1e3'], styles: ['aggressive'], weight: 8 },
  { eco: 'B90', name: "Sicilian Defence: Najdorf Variation, Adams Attack", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'h2h3'], styles: ['aggressive'], weight: 3 },
  { eco: 'B91', name: "Sicilian Defence: Najdorf Variation, Zagreb Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'g2g3'], styles: ['positional'], weight: 2 },
  { eco: 'B92', name: "Sicilian Defence: Najdorf Variation, Opocensky Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'f1e2'], styles: ['classical', 'positional'], weight: 4 },
  { eco: 'B93', name: "Sicilian Defence: Najdorf Variation, Amsterdam Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'f2f4'], styles: ['aggressive'], weight: 2 },
  { eco: 'B94', name: "Sicilian Defence: Najdorf Variation, 6.Bg5", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'c1g5'], styles: ['aggressive'], weight: 6 },
  { eco: 'B97', name: "Sicilian Defence: Najdorf Variation, Poisoned Pawn Variation", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'c1g5', 'e7e6', 'f2f4', 'd8b6'], styles: ['aggressive'], weight: 4 },
  { eco: 'B98', name: "Sicilian Defence: Najdorf Variation, 7...Be7", uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'c1g5', 'e7e6', 'f2f4', 'f8e7'], styles: ['classical'], weight: 3 },
  { eco: 'C00', name: "French Defence", uci: ['e2e4', 'e7e6'], styles: ['solid'], weight: 8 },
  { eco: 'C00', name: "French Defence: Normal Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5'], styles: ['solid', 'classical'], weight: 8 },
  { eco: 'C00', name: "French Defence: King's Indian Attack", uci: ['e2e4', 'e7e6', 'd2d3', 'd7d5', 'b1d2'], styles: ['positional'], weight: 3 },
  { eco: 'C00', name: "French Defence: Chigorin Variation", uci: ['e2e4', 'e7e6', 'd1e2'], styles: ['positional'], weight: 1 },
  { eco: 'C01', name: "French Defence: Exchange Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4d5', 'e6d5'], styles: ['solid'], weight: 4 },
  { eco: 'C02', name: "French Defence: Advance Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4e5'], styles: ['aggressive', 'positional'], weight: 7 },
  { eco: 'C02', name: "French Defence: Advance Variation, Main Line", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4e5', 'c7c5', 'c2c3', 'b8c6', 'g1f3', 'd8b6'], styles: ['positional'], weight: 5 },
  { eco: 'C02', name: "French Defence: Advance Variation, Milner-Barry Gambit", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4e5', 'c7c5', 'c2c3', 'b8c6', 'g1f3', 'd8b6', 'f1d3'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'C03', name: "French Defence: Tarrasch Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1d2'], styles: ['solid', 'positional'], weight: 6 },
  { eco: 'C03', name: "French Defence: Tarrasch Variation, Guimard Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1d2', 'b8c6'], styles: ['solid'], weight: 1 },
  { eco: 'C03', name: "French Defence: Tarrasch Variation, Morozevich Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1d2', 'f8e7'], styles: ['solid'], weight: 2 },
  { eco: 'C05', name: "French Defence: Tarrasch Variation, Closed Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1d2', 'g8f6', 'e4e5', 'f6d7'], styles: ['positional'], weight: 3 },
  { eco: 'C07', name: "French Defence: Tarrasch Variation, Open System", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1d2', 'c7c5', 'e4d5', 'd8d5'], styles: ['solid'], weight: 3 },
  { eco: 'C08', name: "French Defence: Tarrasch Variation, Open System, 4...exd5", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1d2', 'c7c5', 'e4d5', 'e6d5'], styles: ['solid'], weight: 2 },
  { eco: 'C10', name: "French Defence: Paulsen Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3'], styles: ['classical'], weight: 7 },
  { eco: 'C10', name: "French Defence: Rubinstein Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4'], styles: ['solid'], weight: 4 },
  { eco: 'C10', name: "French Defence: Rubinstein Variation, Fort Knox Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'c8d7'], styles: ['solid'], weight: 2 },
  { eco: 'C11', name: "French Defence: Classical Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6'], styles: ['classical'], weight: 5 },
  { eco: 'C11', name: "French Defence: Steinitz Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'e4e5', 'f6d7'], styles: ['aggressive'], weight: 4 },
  { eco: 'C11', name: "French Defence: Burn Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'c1g5', 'd5e4'], styles: ['solid'], weight: 2 },
  { eco: 'C12', name: "French Defence: McCutcheon Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'c1g5', 'f8b4'], styles: ['aggressive'], weight: 2 },
  { eco: 'C13', name: "French Defence: Alekhine-Chatard Attack", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e4e5', 'f6d7', 'h2h4'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'C14', name: "French Defence: Classical Variation, Main Line", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e4e5', 'f6d7', 'g5e7', 'd8e7'], styles: ['classical'], weight: 3 },
  { eco: 'C15', name: "French Defence: Winawer Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4'], styles: ['aggressive'], weight: 6 },
  { eco: 'C16', name: "French Defence: Winawer Variation, Advance Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4', 'e4e5'], styles: ['aggressive'], weight: 5 },
  { eco: 'C17', name: "French Defence: Winawer Variation, Advance Variation, 4...c5", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4', 'e4e5', 'c7c5'], styles: ['aggressive'], weight: 4 },
  { eco: 'C18', name: "French Defence: Winawer Variation, Main Line", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4', 'e4e5', 'c7c5', 'a2a3', 'b4c3', 'b2c3'], styles: ['aggressive'], weight: 4 },
  { eco: 'C18', name: "French Defence: Winawer Variation, Poisoned Pawn Variation", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4', 'e4e5', 'c7c5', 'a2a3', 'b4c3', 'b2c3', 'g8e7', 'd1g4'], styles: ['aggressive'], weight: 3 },
  { eco: 'C19', name: "French Defence: Winawer Variation, Positional Line", uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4', 'e4e5', 'c7c5', 'a2a3', 'b4c3', 'b2c3', 'g8e7', 'g1f3'], styles: ['positional'], weight: 2 },
  { eco: 'B10', name: "Caro-Kann Defence", uci: ['e2e4', 'c7c6'], styles: ['solid'], weight: 8 },
  { eco: 'B10', name: "Caro-Kann Defence: Two Knights Attack", uci: ['e2e4', 'c7c6', 'b1c3', 'd7d5', 'g1f3'], styles: ['classical'], weight: 3 },
  { eco: 'B11', name: "Caro-Kann Defence: Two Knights Attack, Mindeno Variation", uci: ['e2e4', 'c7c6', 'b1c3', 'd7d5', 'g1f3', 'c8g4'], styles: ['solid'], weight: 2 },
  { eco: 'B12', name: "Caro-Kann Defence: Advance Variation", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5'], styles: ['aggressive', 'positional'], weight: 6 },
  { eco: 'B12', name: "Caro-Kann Defence: Advance Variation, 3...Bf5", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'c8f5'], styles: ['solid'], weight: 5 },
  { eco: 'B12', name: "Caro-Kann Defence: Advance Variation, Short Variation", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'c8f5', 'g1f3', 'e7e6', 'f1e2'], styles: ['positional'], weight: 4 },
  { eco: 'B12', name: "Caro-Kann Defence: Advance Variation, Bayonet Attack", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'c8f5', 'g2g4'], styles: ['aggressive'], weight: 1 },
  { eco: 'B12', name: "Caro-Kann Defence: Fantasy Variation", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'f2f3'], styles: ['aggressive'], weight: 2 },
  { eco: 'B13', name: "Caro-Kann Defence: Exchange Variation", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4d5', 'c6d5'], styles: ['solid'], weight: 4 },
  { eco: 'B13', name: "Caro-Kann Defence: Exchange Variation, Main Line", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4d5', 'c6d5', 'f1d3', 'b8c6', 'c2c3'], styles: ['positional'], weight: 2 },
  { eco: 'B13', name: "Caro-Kann Defence: Panov Attack", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4d5', 'c6d5', 'c2c4'], styles: ['aggressive'], weight: 4 },
  { eco: 'B14', name: "Caro-Kann Defence: Panov Attack, Main Line", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4d5', 'c6d5', 'c2c4', 'g8f6', 'b1c3', 'e7e6'], styles: ['classical'], weight: 3 },
  { eco: 'B15', name: "Caro-Kann Defence: Main Line", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4'], styles: ['classical'], weight: 6 },
  { eco: 'B15', name: "Caro-Kann Defence: Tartakower Variation", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'g8f6', 'e4f6', 'e7f6'], styles: ['solid'], weight: 2 },
  { eco: 'B16', name: "Caro-Kann Defence: Bronstein-Larsen Variation", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'g8f6', 'e4f6', 'g7f6'], styles: ['aggressive'], weight: 1 },
  { eco: 'B17', name: "Caro-Kann Defence: Karpov Variation", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'b8d7'], styles: ['solid', 'positional'], weight: 4 },
  { eco: 'B18', name: "Caro-Kann Defence: Classical Variation", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'c8f5'], styles: ['classical', 'solid'], weight: 5 },
  { eco: 'B19', name: "Caro-Kann Defence: Classical Variation, Main Line", uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'c8f5', 'e4g3', 'f5g6', 'h2h4', 'h7h6', 'g1f3', 'b8d7'], styles: ['classical'], weight: 4 },
  { eco: 'B01', name: "Scandinavian Defence", uci: ['e2e4', 'd7d5'], styles: ['aggressive'], weight: 5 },
  { eco: 'B01', name: "Scandinavian Defence: Main Line", uci: ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5'], styles: ['classical'], weight: 4 },
  { eco: 'B01', name: "Scandinavian Defence: 3...Qd6 Variation", uci: ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5d6'], styles: ['solid'], weight: 3 },
  { eco: 'B01', name: "Scandinavian Defence: Valencian Variation", uci: ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5d8'], styles: ['solid'], weight: 1 },
  { eco: 'B01', name: "Scandinavian Defence: Modern Variation", uci: ['e2e4', 'd7d5', 'e4d5', 'g8f6', 'd2d4'], styles: ['hypermodern'], weight: 2 },
  { eco: 'B01', name: "Scandinavian Defence: Portuguese Gambit", uci: ['e2e4', 'd7d5', 'e4d5', 'g8f6', 'd2d4', 'c8g4'], styles: ['gambit'], weight: 1 },
  { eco: 'B01', name: "Scandinavian Defence: Icelandic-Palme Gambit", uci: ['e2e4', 'd7d5', 'e4d5', 'g8f6', 'c2c4', 'e7e6'], styles: ['gambit'], weight: 1 },
  { eco: 'B02', name: "Alekhine Defence", uci: ['e2e4', 'g8f6'], styles: ['hypermodern'], weight: 3 },
  { eco: 'B02', name: "Alekhine Defence: Scandinavian Variation", uci: ['e2e4', 'g8f6', 'b1c3', 'd7d5'], styles: ['hypermodern'], weight: 1 },
  { eco: 'B02', name: "Alekhine Defence: Two Pawns Attack", uci: ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'c2c4', 'd5b6', 'c4c5'], styles: ['aggressive'], weight: 1 },
  { eco: 'B03', name: "Alekhine Defence: Four Pawns Attack", uci: ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'd7d6', 'c2c4', 'd5b6', 'f2f4'], styles: ['aggressive'], weight: 2 },
  { eco: 'B03', name: "Alekhine Defence: Exchange Variation", uci: ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'd7d6', 'c2c4', 'd5b6', 'e5d6'], styles: ['positional'], weight: 2 },
  { eco: 'B04', name: "Alekhine Defence: Modern Variation", uci: ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'd7d6', 'g1f3'], styles: ['classical'], weight: 3 },
  { eco: 'B05', name: "Alekhine Defence: Modern Variation, Main Line", uci: ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'd7d6', 'g1f3', 'c8g4'], styles: ['hypermodern'], weight: 2 },
  { eco: 'B07', name: "Pirc Defence", uci: ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6'], styles: ['hypermodern'], weight: 4 },
  { eco: 'B07', name: "Pirc Defence: 150 Attack", uci: ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6', 'c1e3', 'c7c6', 'd1d2'], styles: ['aggressive'], weight: 2 },
  { eco: 'B07', name: "Pirc Defence: Byrne Variation", uci: ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6', 'c1g5'], styles: ['aggressive'], weight: 1 },
  { eco: 'B08', name: "Pirc Defence: Classical Variation", uci: ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6', 'g1f3', 'f8g7', 'f1e2'], styles: ['classical'], weight: 3 },
  { eco: 'B09', name: "Pirc Defence: Austrian Attack", uci: ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6', 'f2f4'], styles: ['aggressive'], weight: 3 },
  { eco: 'B06', name: "Modern Defence", uci: ['e2e4', 'g7g6'], styles: ['hypermodern'], weight: 4 },
  { eco: 'B06', name: "Modern Defence: Standard Line", uci: ['e2e4', 'g7g6', 'd2d4', 'f8g7', 'b1c3', 'd7d6'], styles: ['hypermodern'], weight: 3 },
  { eco: 'B06', name: "Modern Defence: Three Pawns Attack", uci: ['e2e4', 'g7g6', 'd2d4', 'f8g7', 'f2f4'], styles: ['aggressive'], weight: 1 },
  { eco: 'B00', name: "Nimzowitsch Defence", uci: ['e2e4', 'b8c6'], styles: ['hypermodern'], weight: 1 },
  { eco: 'B00', name: "Nimzowitsch Defence: Scandinavian Variation", uci: ['e2e4', 'b8c6', 'd2d4', 'd7d5'], styles: ['hypermodern'], weight: 1 },
  { eco: 'B00', name: "Owen Defence", uci: ['e2e4', 'b7b6', 'd2d4', 'c8b7'], styles: ['hypermodern'], weight: 1 },
  { eco: 'B00', name: "St. George Defence", uci: ['e2e4', 'a7a6', 'd2d4', 'b7b5'], styles: ['hypermodern'], weight: 1 },
  { eco: 'C20', name: "King's Pawn Game", uci: ['e2e4', 'e7e5'], styles: ['classical'], weight: 10 },
  { eco: 'C20', name: "King's Pawn Game: Wayward Queen Attack", uci: ['e2e4', 'e7e5', 'd1h5'], styles: ['aggressive'], weight: 1 },
  { eco: 'C20', name: "King's Pawn Game: Alapin Opening", uci: ['e2e4', 'e7e5', 'g1e2'], styles: ['positional'], weight: 1 },
  { eco: 'C21', name: "Danish Gambit", uci: ['e2e4', 'e7e5', 'd2d4', 'e5d4', 'c2c3'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'C21', name: "Danish Gambit: Accepted", uci: ['e2e4', 'e7e5', 'd2d4', 'e5d4', 'c2c3', 'd4c3', 'f1c4', 'c3b2', 'c1b2'], styles: ['gambit', 'aggressive'], weight: 1 },
  { eco: 'C22', name: "Centre Game", uci: ['e2e4', 'e7e5', 'd2d4', 'e5d4', 'd1d4'], styles: ['aggressive'], weight: 2 },
  { eco: 'C22', name: "Centre Game: Paulsen Attack", uci: ['e2e4', 'e7e5', 'd2d4', 'e5d4', 'd1d4', 'b8c6', 'd4e3'], styles: ['aggressive'], weight: 1 },
  { eco: 'C23', name: "Bishop's Opening", uci: ['e2e4', 'e7e5', 'f1c4'], styles: ['classical'], weight: 3 },
  { eco: 'C24', name: "Bishop's Opening: Berlin Defence", uci: ['e2e4', 'e7e5', 'f1c4', 'g8f6'], styles: ['classical'], weight: 2 },
  { eco: 'C24', name: "Bishop's Opening: Urusov Gambit", uci: ['e2e4', 'e7e5', 'f1c4', 'g8f6', 'd2d4', 'e5d4', 'g1f3'], styles: ['gambit'], weight: 1 },
  { eco: 'C25', name: "Vienna Game", uci: ['e2e4', 'e7e5', 'b1c3'], styles: ['classical'], weight: 4 },
  { eco: 'C25', name: "Vienna Game: Max Lange Defence", uci: ['e2e4', 'e7e5', 'b1c3', 'b8c6'], styles: ['classical'], weight: 2 },
  { eco: 'C26', name: "Vienna Game: Falkbeer Variation", uci: ['e2e4', 'e7e5', 'b1c3', 'g8f6'], styles: ['classical'], weight: 3 },
  { eco: 'C26', name: "Vienna Game: Mieses Variation", uci: ['e2e4', 'e7e5', 'b1c3', 'g8f6', 'g2g3'], styles: ['positional'], weight: 1 },
  { eco: 'C26', name: "Vienna Game: Stanley Variation", uci: ['e2e4', 'e7e5', 'b1c3', 'g8f6', 'f1c4'], styles: ['classical'], weight: 2 },
  { eco: 'C27', name: "Vienna Game: Frankenstein-Dracula Variation", uci: ['e2e4', 'e7e5', 'b1c3', 'g8f6', 'f1c4', 'f6e4', 'd1h5', 'e4d6', 'c4b3', 'b8c6', 'c3b5', 'g7g6', 'h5f3', 'f7f5'], styles: ['aggressive'], weight: 1 },
  { eco: 'C29', name: "Vienna Game: Vienna Gambit", uci: ['e2e4', 'e7e5', 'b1c3', 'g8f6', 'f2f4', 'd7d5'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'C30', name: "King's Gambit", uci: ['e2e4', 'e7e5', 'f2f4'], styles: ['gambit', 'aggressive'], weight: 4 },
  { eco: 'C30', name: "King's Gambit: Declined, Classical Variation", uci: ['e2e4', 'e7e5', 'f2f4', 'f8c5'], styles: ['classical'], weight: 2 },
  { eco: 'C31', name: "King's Gambit: Falkbeer Countergambit", uci: ['e2e4', 'e7e5', 'f2f4', 'd7d5'], styles: ['gambit'], weight: 1 },
  { eco: 'C33', name: "King's Gambit: Accepted", uci: ['e2e4', 'e7e5', 'f2f4', 'e5f4'], styles: ['gambit'], weight: 3 },
  { eco: 'C33', name: "King's Gambit: Accepted, Bishop's Gambit", uci: ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'f1c4'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'C34', name: "King's Gambit: Accepted, King's Knight's Gambit", uci: ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3'], styles: ['gambit'], weight: 3 },
  { eco: 'C34', name: "King's Gambit: Accepted, Fischer Defence", uci: ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'd7d6'], styles: ['solid'], weight: 2 },
  { eco: 'C35', name: "King's Gambit: Accepted, Cunningham Defence", uci: ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'f8e7'], styles: ['solid'], weight: 1 },
  { eco: 'C36', name: "King's Gambit: Accepted, Modern Defence", uci: ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'd7d5'], styles: ['classical'], weight: 2 },
  { eco: 'C37', name: "King's Gambit: Accepted, Muzio Gambit", uci: ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'g7g5', 'f1c4', 'g5g4', 'e1g1'], styles: ['gambit', 'aggressive'], weight: 1 },
  { eco: 'C38', name: "King's Gambit: Accepted, Hanstein Gambit", uci: ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'g7g5', 'f1c4', 'f8g7', 'e1g1'], styles: ['gambit'], weight: 1 },
  { eco: 'C39', name: "King's Gambit: Accepted, Kieseritzky Gambit", uci: ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'g7g5', 'h2h4', 'g5g4', 'f3e5'], styles: ['gambit', 'aggressive'], weight: 1 },
  { eco: 'C39', name: "King's Gambit: Accepted, Allgaier Gambit", uci: ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'g7g5', 'h2h4', 'g5g4', 'f3g5'], styles: ['gambit', 'aggressive'], weight: 1 },
  { eco: 'C40', name: "Latvian Gambit", uci: ['e2e4', 'e7e5', 'g1f3', 'f7f5'], styles: ['gambit', 'aggressive'], weight: 1 },
  { eco: 'C40', name: "Elephant Gambit", uci: ['e2e4', 'e7e5', 'g1f3', 'd7d5'], styles: ['gambit'], weight: 1 },
  { eco: 'C41', name: "Philidor Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'd7d6'], styles: ['solid'], weight: 3 },
  { eco: 'C41', name: "Philidor Defence: Exchange Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'd2d4', 'e5d4'], styles: ['solid'], weight: 2 },
  { eco: 'C41', name: "Philidor Defence: Hanham Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'd2d4', 'b8d7'], styles: ['solid'], weight: 2 },
  { eco: 'C41', name: "Philidor Defence: Lion Variation", uci: ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'e7e5', 'g1f3', 'b8d7'], styles: ['solid'], weight: 2 },
  { eco: 'C42', name: "Petrov's Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'g8f6'], styles: ['solid'], weight: 6 },
  { eco: 'C42', name: "Petrov's Defence: Classical Attack", uci: ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5', 'd7d6', 'e5f3', 'f6e4', 'd2d4'], styles: ['solid', 'classical'], weight: 4 },
  { eco: 'C42', name: "Petrov's Defence: Nimzowitsch Attack", uci: ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5', 'd7d6', 'e5f3', 'f6e4', 'b1c3'], styles: ['solid'], weight: 2 },
  { eco: 'C42', name: "Petrov's Defence: Three Knights Game", uci: ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'b1c3'], styles: ['classical'], weight: 2 },
  { eco: 'C42', name: "Petrov's Defence: Stafford Gambit", uci: ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5', 'b8c6'], styles: ['gambit'], weight: 1 },
  { eco: 'C43', name: "Petrov's Defence: Modern Attack", uci: ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'd2d4'], styles: ['aggressive'], weight: 3 },
  { eco: 'C44', name: "King's Knight Opening: Normal Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6'], styles: ['classical'], weight: 10 },
  { eco: 'C44', name: "Ponziani Opening", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'c2c3'], styles: ['classical'], weight: 1 },
  { eco: 'C44', name: "Scotch Game", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4'], styles: ['classical', 'aggressive'], weight: 6 },
  { eco: 'C44', name: "Scotch Game: Scotch Gambit", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f1c4'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'C44', name: "Scotch Game: Göring Gambit", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'c2c3'], styles: ['gambit'], weight: 1 },
  { eco: 'C45', name: "Scotch Game: Classical Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'f8c5'], styles: ['classical'], weight: 4 },
  { eco: 'C45', name: "Scotch Game: Schmidt Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'g8f6'], styles: ['classical'], weight: 4 },
  { eco: 'C45', name: "Scotch Game: Mieses Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'g8f6', 'd4c6', 'b7c6', 'e4e5'], styles: ['aggressive'], weight: 3 },
  { eco: 'C45', name: "Scotch Game: Steinitz Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'd8h4'], styles: ['aggressive'], weight: 1 },
  { eco: 'C46', name: "Three Knights Opening", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3'], styles: ['classical'], weight: 2 },
  { eco: 'C47', name: "Four Knights Game", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3', 'g8f6'], styles: ['classical', 'solid'], weight: 4 },
  { eco: 'C47', name: "Four Knights Game: Scotch Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3', 'g8f6', 'd2d4', 'e5d4', 'f3d4'], styles: ['classical'], weight: 3 },
  { eco: 'C47', name: "Four Knights Game: Belgrade Gambit", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3', 'g8f6', 'd2d4', 'e5d4', 'c3d5'], styles: ['gambit'], weight: 1 },
  { eco: 'C47', name: "Four Knights Game: Glek System", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3', 'g8f6', 'g2g3'], styles: ['positional'], weight: 1 },
  { eco: 'C48', name: "Four Knights Game: Spanish Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3', 'g8f6', 'f1b5'], styles: ['classical'], weight: 3 },
  { eco: 'C48', name: "Four Knights Game: Rubinstein Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3', 'g8f6', 'f1b5', 'c6d4'], styles: ['aggressive'], weight: 2 },
  { eco: 'C49', name: "Four Knights Game: Double Spanish", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3', 'g8f6', 'f1b5', 'f8b4'], styles: ['solid'], weight: 1 },
  { eco: 'C50', name: "Italian Game", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'], styles: ['classical'], weight: 9 },
  { eco: 'C50', name: "Italian Game: Giuoco Piano", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'], styles: ['classical'], weight: 8 },
  { eco: 'C50', name: "Italian Game: Giuoco Pianissimo", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'd2d3'], styles: ['positional', 'solid'], weight: 5 },
  { eco: 'C50', name: "Italian Game: Hungarian Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8e7'], styles: ['solid'], weight: 1 },
  { eco: 'C50', name: "Italian Game: Rousseau Gambit", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f7f5'], styles: ['gambit'], weight: 1 },
  { eco: 'C50', name: "Italian Game: Blackburne Shilling Gambit", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'c6d4'], styles: ['gambit'], weight: 1 },
  { eco: 'C51', name: "Italian Game: Evans Gambit", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'b2b4'], styles: ['gambit', 'aggressive'], weight: 3 },
  { eco: 'C52', name: "Italian Game: Evans Gambit Accepted", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'b2b4', 'c5b4', 'c2c3', 'b4a5'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'C53', name: "Italian Game: Classical Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3'], styles: ['classical'], weight: 6 },
  { eco: 'C54', name: "Italian Game: Classical Variation, Centre Attack", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d4', 'e5d4', 'c3d4', 'c5b4'], styles: ['classical', 'aggressive'], weight: 3 },
  { eco: 'C54', name: "Italian Game: Giuoco Pianissimo, Main Line", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d3'], styles: ['positional', 'solid'], weight: 6 },
  { eco: 'C55', name: "Italian Game: Two Knights Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'], styles: ['aggressive'], weight: 6 },
  { eco: 'C55', name: "Italian Game: Two Knights Defence, Modern Bishop's Opening", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3'], styles: ['positional'], weight: 4 },
  { eco: 'C55', name: "Italian Game: Two Knights Defence, Max Lange Attack", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d4', 'e5d4', 'e1g1', 'f8c5', 'e4e5'], styles: ['gambit', 'aggressive'], weight: 1 },
  { eco: 'C57', name: "Italian Game: Two Knights Defence, Knight Attack", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5'], styles: ['aggressive'], weight: 4 },
  { eco: 'C57', name: "Italian Game: Two Knights Defence, Fried Liver Attack", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5', 'd7d5', 'e4d5', 'f6d5', 'g5f7'], styles: ['aggressive'], weight: 2 },
  { eco: 'C57', name: "Italian Game: Two Knights Defence, Traxler Counterattack", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5', 'f8c5'], styles: ['gambit', 'aggressive'], weight: 1 },
  { eco: 'C58', name: "Italian Game: Two Knights Defence, Polerio Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5', 'd7d5', 'e4d5', 'c6a5'], styles: ['gambit'], weight: 3 },
  { eco: 'C60', name: "Ruy Lopez", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'], styles: ['classical', 'positional'], weight: 10 },
  { eco: 'C60', name: "Ruy Lopez: Cozio Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8e7'], styles: ['solid'], weight: 1 },
  { eco: 'C61', name: "Ruy Lopez: Bird's Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'c6d4'], styles: ['solid'], weight: 1 },
  { eco: 'C62', name: "Ruy Lopez: Steinitz Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'd7d6'], styles: ['solid'], weight: 1 },
  { eco: 'C63', name: "Ruy Lopez: Schliemann Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'f7f5'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'C64', name: "Ruy Lopez: Classical Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'f8c5'], styles: ['classical'], weight: 2 },
  { eco: 'C65', name: "Ruy Lopez: Berlin Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6'], styles: ['solid'], weight: 7 },
  { eco: 'C65', name: "Ruy Lopez: Berlin Defence, Anti-Berlin", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'd2d3'], styles: ['positional'], weight: 5 },
  { eco: 'C66', name: "Ruy Lopez: Berlin Defence, Improved Steinitz Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'e1g1', 'd7d6'], styles: ['solid'], weight: 1 },
  { eco: 'C67', name: "Ruy Lopez: Berlin Defence, Rio Gambit Accepted", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'e1g1', 'f6e4'], styles: ['solid'], weight: 4 },
  { eco: 'C67', name: "Ruy Lopez: Berlin Defence, Berlin Wall", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'e1g1', 'f6e4', 'd2d4', 'e4d6', 'b5c6', 'd7c6', 'd4e5', 'd6f5'], styles: ['solid', 'positional'], weight: 4 },
  { eco: 'C68', name: "Ruy Lopez: Exchange Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6'], styles: ['positional'], weight: 4 },
  { eco: 'C69', name: "Ruy Lopez: Exchange Variation, Gligoric Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6', 'e1g1', 'f7f6'], styles: ['positional'], weight: 2 },
  { eco: 'C70', name: "Ruy Lopez: Morphy Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4'], styles: ['classical'], weight: 9 },
  { eco: 'C71', name: "Ruy Lopez: Morphy Defence, Modern Steinitz Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'd7d6'], styles: ['solid'], weight: 2 },
  { eco: 'C77', name: "Ruy Lopez: Morphy Defence, 4...Nf6", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6'], styles: ['classical'], weight: 8 },
  { eco: 'C77', name: "Ruy Lopez: Morphy Defence, Anderssen Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'd2d3'], styles: ['positional'], weight: 2 },
  { eco: 'C78', name: "Ruy Lopez: Arkhangelsk Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'b7b5', 'a4b3', 'c8b7'], styles: ['aggressive'], weight: 3 },
  { eco: 'C78', name: "Ruy Lopez: Møller Defence", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8c5'], styles: ['aggressive'], weight: 2 },
  { eco: 'C80', name: "Ruy Lopez: Open Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f6e4'], styles: ['aggressive', 'classical'], weight: 4 },
  { eco: 'C80', name: "Ruy Lopez: Open Variation, 6.d4", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f6e4', 'd2d4', 'b7b5', 'a4b3', 'd7d5'], styles: ['classical'], weight: 3 },
  { eco: 'C84', name: "Ruy Lopez: Closed Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7'], styles: ['classical', 'positional'], weight: 8 },
  { eco: 'C85', name: "Ruy Lopez: Exchange Variation Deferred", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7', 'a4c6'], styles: ['positional'], weight: 2 },
  { eco: 'C86', name: "Ruy Lopez: Worrall Attack", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7', 'd1e2'], styles: ['positional'], weight: 1 },
  { eco: 'C87', name: "Ruy Lopez: Closed, Averbakh Variation", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7', 'f1e1', 'd7d6'], styles: ['solid'], weight: 1 },
  { eco: 'C88', name: "Ruy Lopez: Closed Variation, Main Line", uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7', 'f1e1', 'b7b5', 'a4b3', 'e8g8'], styles: ['classical', 'positional'], weight: 7 },
  { eco: 'D00', name: "Queen's Pawn Game", uci: ['d2d4', 'd7d5'], styles: ['classical'], weight: 9 },
  { eco: 'D00', name: "London System: Accelerated", uci: ['d2d4', 'd7d5', 'c1f4'], styles: ['solid', 'positional'], weight: 5 },
  { eco: 'D00', name: "London System: Jobava Variation", uci: ['d2d4', 'd7d5', 'b1c3', 'g8f6', 'c1f4'], styles: ['aggressive'], weight: 3 },
  { eco: 'D00', name: "Blackmar-Diemer Gambit", uci: ['d2d4', 'd7d5', 'e2e4', 'd5e4', 'b1c3'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'D00', name: "Blackmar-Diemer Gambit: Accepted", uci: ['d2d4', 'd7d5', 'e2e4', 'd5e4', 'b1c3', 'g8f6', 'f2f3', 'e4f3', 'g1f3'], styles: ['gambit', 'aggressive'], weight: 1 },
  { eco: 'D00', name: "Queen's Pawn Game: Levitsky Attack", uci: ['d2d4', 'd7d5', 'c1g5'], styles: ['aggressive'], weight: 1 },
  { eco: 'D00', name: "Queen's Pawn Game: Stonewall Attack", uci: ['d2d4', 'd7d5', 'e2e3', 'g8f6', 'f1d3', 'c7c5', 'c2c3', 'b8c6', 'f2f4'], styles: ['aggressive'], weight: 2 },
  { eco: 'D01', name: "Richter-Veresov Attack", uci: ['d2d4', 'd7d5', 'b1c3', 'g8f6', 'c1g5'], styles: ['aggressive'], weight: 1 },
  { eco: 'D02', name: "Queen's Pawn Game: Zukertort Variation", uci: ['d2d4', 'd7d5', 'g1f3'], styles: ['classical'], weight: 6 },
  { eco: 'D02', name: "London System", uci: ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1f4'], styles: ['solid', 'positional'], weight: 7 },
  { eco: 'D02', name: "London System: Main Line", uci: ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1f4', 'e7e6', 'e2e3', 'c7c5', 'c2c3', 'b8c6', 'b1d2'], styles: ['solid', 'positional'], weight: 5 },
  { eco: 'D03', name: "Torre Attack: 2...d5 Line", uci: ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1g5'], styles: ['positional'], weight: 2 },
  { eco: 'D04', name: "Colle System", uci: ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'e2e3'], styles: ['solid'], weight: 3 },
  { eco: 'D05', name: "Colle System: Main Line", uci: ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'e2e3', 'e7e6', 'f1d3'], styles: ['solid'], weight: 2 },
  { eco: 'D05', name: "Colle System: Zukertort Variation", uci: ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'e2e3', 'e7e6', 'f1d3', 'c7c5', 'b2b3'], styles: ['solid', 'positional'], weight: 2 },
  { eco: 'D06', name: "Queen's Gambit", uci: ['d2d4', 'd7d5', 'c2c4'], styles: ['classical', 'positional'], weight: 10 },
  { eco: 'D06', name: "Queen's Gambit Declined: Baltic Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'c8f5'], styles: ['aggressive'], weight: 1 },
  { eco: 'D06', name: "Queen's Gambit Declined: Marshall Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'g8f6'], styles: ['aggressive'], weight: 1 },
  { eco: 'D06', name: "Queen's Gambit Declined: Austrian Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c5'], styles: ['aggressive'], weight: 1 },
  { eco: 'D07', name: "Queen's Gambit Declined: Chigorin Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'b8c6'], styles: ['aggressive'], weight: 2 },
  { eco: 'D08', name: "Queen's Gambit Declined: Albin Countergambit", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e5', 'd4e5', 'd5d4'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'D10', name: "Slav Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c6'], styles: ['solid'], weight: 8 },
  { eco: 'D10', name: "Slav Defence: Exchange Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'c4d5', 'c6d5'], styles: ['solid'], weight: 4 },
  { eco: 'D11', name: "Slav Defence: Modern Line", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3'], styles: ['classical'], weight: 6 },
  { eco: 'D11', name: "Slav Defence: Quiet Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'e2e3'], styles: ['solid'], weight: 4 },
  { eco: 'D12', name: "Slav Defence: Quiet Variation, 4...Bf5", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'e2e3', 'c8f5'], styles: ['solid'], weight: 3 },
  { eco: 'D15', name: "Slav Defence: Three Knights Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'b1c3'], styles: ['classical'], weight: 5 },
  { eco: 'D15', name: "Slav Defence: Chebanenko Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'b1c3', 'a7a6'], styles: ['solid', 'positional'], weight: 4 },
  { eco: 'D16', name: "Slav Defence: Alapin Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'b1c3', 'd5c4', 'a2a4'], styles: ['classical'], weight: 4 },
  { eco: 'D17', name: "Slav Defence: Czech Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'b1c3', 'd5c4', 'a2a4', 'c8f5'], styles: ['classical', 'solid'], weight: 4 },
  { eco: 'D18', name: "Slav Defence: Dutch Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'b1c3', 'd5c4', 'a2a4', 'c8f5', 'e2e3'], styles: ['classical'], weight: 3 },
  { eco: 'D31', name: "Semi-Slav Defence: Marshall Gambit", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'c7c6', 'e2e4'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'D31', name: "Semi-Slav Defence: Noteboom Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'c7c6', 'g1f3', 'd5c4'], styles: ['aggressive'], weight: 1 },
  { eco: 'D43', name: "Semi-Slav Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'c7c6'], styles: ['solid'], weight: 7 },
  { eco: 'D43', name: "Semi-Slav Defence: Moscow Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'c7c6', 'c1g5', 'h7h6'], styles: ['positional'], weight: 3 },
  { eco: 'D44', name: "Semi-Slav Defence: Botvinnik Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'c7c6', 'c1g5', 'd5c4'], styles: ['aggressive'], weight: 3 },
  { eco: 'D45', name: "Semi-Slav Defence: Normal Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'c7c6', 'e2e3', 'b8d7'], styles: ['solid'], weight: 4 },
  { eco: 'D45', name: "Semi-Slav Defence: Anti-Meran Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'c7c6', 'e2e3', 'b8d7', 'd1c2'], styles: ['positional'], weight: 4 },
  { eco: 'D46', name: "Semi-Slav Defence: 6.Bd3", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'c7c6', 'e2e3', 'b8d7', 'f1d3'], styles: ['classical'], weight: 3 },
  { eco: 'D47', name: "Semi-Slav Defence: Meran Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'c7c6', 'e2e3', 'b8d7', 'f1d3', 'd5c4', 'd3c4', 'b7b5'], styles: ['aggressive'], weight: 4 },
  { eco: 'D30', name: "Queen's Gambit Declined", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6'], styles: ['classical', 'solid'], weight: 9 },
  { eco: 'D31', name: "Queen's Gambit Declined: Alatortsev Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'f8e7'], styles: ['solid'], weight: 3 },
  { eco: 'D32', name: "Tarrasch Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'c7c5'], styles: ['classical', 'aggressive'], weight: 3 },
  { eco: 'D32', name: "Tarrasch Defence: Schara Gambit", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'c7c5', 'c4d5', 'c5d4'], styles: ['gambit'], weight: 1 },
  { eco: 'D34', name: "Tarrasch Defence: Prague Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'c7c5', 'c4d5', 'e6d5', 'g1f3', 'b8c6', 'g2g3', 'g8f6', 'f1g2'], styles: ['classical'], weight: 2 },
  { eco: 'D35', name: "Queen's Gambit Declined: Exchange Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c4d5', 'e6d5'], styles: ['positional'], weight: 5 },
  { eco: 'D36', name: "Queen's Gambit Declined: Exchange Variation, Carlsbad Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c4d5', 'e6d5', 'c1g5', 'c7c6', 'd1c2'], styles: ['positional'], weight: 3 },
  { eco: 'D37', name: "Queen's Gambit Declined: Three Knights Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3'], styles: ['classical'], weight: 6 },
  { eco: 'D37', name: "Queen's Gambit Declined: Harrwitz Attack", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'f8e7', 'c1f4'], styles: ['positional'], weight: 5 },
  { eco: 'D38', name: "Queen's Gambit Declined: Ragozin Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'f8b4'], styles: ['aggressive'], weight: 4 },
  { eco: 'D39', name: "Queen's Gambit Declined: Ragozin Defence, Vienna Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'f8b4', 'c1g5', 'd5c4'], styles: ['aggressive'], weight: 2 },
  { eco: 'D40', name: "Queen's Gambit Declined: Semi-Tarrasch Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'c7c5'], styles: ['classical'], weight: 3 },
  { eco: 'D41', name: "Queen's Gambit Declined: Semi-Tarrasch Defence, 5.cxd5", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'c7c5', 'c4d5', 'f6d5'], styles: ['classical'], weight: 2 },
  { eco: 'D50', name: "Queen's Gambit Declined: 4.Bg5 Line", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5'], styles: ['classical'], weight: 5 },
  { eco: 'D52', name: "Queen's Gambit Declined: Cambridge Springs Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'b8d7', 'e2e3', 'c7c6', 'g1f3', 'd8a5'], styles: ['aggressive'], weight: 2 },
  { eco: 'D55', name: "Queen's Gambit Declined: Neo-Orthodox Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e2e3', 'e8g8', 'g1f3', 'h7h6'], styles: ['classical'], weight: 3 },
  { eco: 'D56', name: "Queen's Gambit Declined: Lasker Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e2e3', 'e8g8', 'g1f3', 'h7h6', 'g5h4', 'f6e4'], styles: ['solid'], weight: 2 },
  { eco: 'D58', name: "Queen's Gambit Declined: Tartakower Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e2e3', 'e8g8', 'g1f3', 'h7h6', 'g5h4', 'b7b6'], styles: ['solid', 'classical'], weight: 3 },
  { eco: 'D60', name: "Queen's Gambit Declined: Orthodox Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e2e3', 'e8g8', 'g1f3', 'b8d7'], styles: ['classical', 'solid'], weight: 3 },
  { eco: 'D20', name: "Queen's Gambit Accepted", uci: ['d2d4', 'd7d5', 'c2c4', 'd5c4'], styles: ['classical'], weight: 6 },
  { eco: 'D20', name: "Queen's Gambit Accepted: Central Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'e2e4'], styles: ['aggressive'], weight: 3 },
  { eco: 'D21', name: "Queen's Gambit Accepted: Normal Variation", uci: ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'g1f3'], styles: ['classical'], weight: 4 },
  { eco: 'D22', name: "Queen's Gambit Accepted: Alekhine Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'g1f3', 'a7a6'], styles: ['hypermodern'], weight: 2 },
  { eco: 'D25', name: "Queen's Gambit Accepted: 4.e3", uci: ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'g1f3', 'g8f6', 'e2e3'], styles: ['classical'], weight: 3 },
  { eco: 'D26', name: "Queen's Gambit Accepted: Classical Defence", uci: ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'g1f3', 'g8f6', 'e2e3', 'e7e6', 'f1c4', 'c7c5'], styles: ['classical'], weight: 3 },
  { eco: 'D27', name: "Queen's Gambit Accepted: Classical Defence, Main Line", uci: ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'g1f3', 'g8f6', 'e2e3', 'e7e6', 'f1c4', 'c7c5', 'e1g1', 'a7a6'], styles: ['classical'], weight: 3 },
  { eco: 'A45', name: "Indian Defence", uci: ['d2d4', 'g8f6'], styles: ['hypermodern'], weight: 10 },
  { eco: 'A45', name: "Trompowsky Attack", uci: ['d2d4', 'g8f6', 'c1g5'], styles: ['aggressive'], weight: 4 },
  { eco: 'A45', name: "Trompowsky Attack: 2...Ne4", uci: ['d2d4', 'g8f6', 'c1g5', 'f6e4'], styles: ['aggressive'], weight: 2 },
  { eco: 'A45', name: "Trompowsky Attack: 2...e6", uci: ['d2d4', 'g8f6', 'c1g5', 'e7e6'], styles: ['solid'], weight: 2 },
  { eco: 'A46', name: "Indian Defence: Knights Variation", uci: ['d2d4', 'g8f6', 'g1f3'], styles: ['classical'], weight: 6 },
  { eco: 'A46', name: "Torre Attack", uci: ['d2d4', 'g8f6', 'g1f3', 'e7e6', 'c1g5'], styles: ['positional'], weight: 2 },
  { eco: 'A46', name: "London System: Indian Setup", uci: ['d2d4', 'g8f6', 'g1f3', 'e7e6', 'c1f4'], styles: ['solid', 'positional'], weight: 3 },
  { eco: 'A48', name: "London System: King's Indian Setup", uci: ['d2d4', 'g8f6', 'g1f3', 'g7g6', 'c1f4'], styles: ['solid', 'positional'], weight: 3 },
  { eco: 'A48', name: "Torre Attack: King's Indian Setup", uci: ['d2d4', 'g8f6', 'g1f3', 'g7g6', 'c1g5'], styles: ['positional'], weight: 1 },
  { eco: 'A50', name: "Indian Defence: Normal Variation", uci: ['d2d4', 'g8f6', 'c2c4'], styles: ['classical'], weight: 9 },
  { eco: 'A51', name: "Budapest Gambit", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e5'], styles: ['gambit', 'aggressive'], weight: 2 },
  { eco: 'A51', name: "Budapest Gambit: Fajarowicz Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e5', 'd4e5', 'f6e4'], styles: ['gambit'], weight: 1 },
  { eco: 'A52', name: "Budapest Gambit: Main Line", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e5', 'd4e5', 'f6g4'], styles: ['gambit'], weight: 2 },
  { eco: 'A52', name: "Budapest Gambit: Rubinstein Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e5', 'd4e5', 'f6g4', 'c1f4'], styles: ['classical'], weight: 1 },
  { eco: 'A53', name: "Old Indian Defence", uci: ['d2d4', 'g8f6', 'c2c4', 'd7d6'], styles: ['solid'], weight: 2 },
  { eco: 'A56', name: "Benoni Defence", uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5'], styles: ['aggressive'], weight: 4 },
  { eco: 'A56', name: "Benoni Defence: Czech Benoni", uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e5'], styles: ['solid'], weight: 1 },
  { eco: 'A57', name: "Benko Gambit", uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'b7b5'], styles: ['gambit', 'aggressive'], weight: 3 },
  { eco: 'A58', name: "Benko Gambit: Accepted", uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'b7b5', 'c4b5', 'a7a6', 'b5a6'], styles: ['gambit'], weight: 2 },
  { eco: 'A60', name: "Benoni Defence: Modern Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e6'], styles: ['aggressive'], weight: 4 },
  { eco: 'A61', name: "Benoni Defence: Modern Variation, 6.Nf3", uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e6', 'b1c3', 'e6d5', 'c4d5', 'd7d6', 'g1f3', 'g7g6'], styles: ['aggressive'], weight: 2 },
  { eco: 'A65', name: "Benoni Defence: King's Pawn Line", uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e6', 'b1c3', 'e6d5', 'c4d5', 'd7d6', 'e2e4'], styles: ['aggressive'], weight: 3 },
  { eco: 'A66', name: "Benoni Defence: Pawn Storm Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e6', 'b1c3', 'e6d5', 'c4d5', 'd7d6', 'e2e4', 'g7g6', 'f2f4'], styles: ['aggressive'], weight: 2 },
  { eco: 'A70', name: "Benoni Defence: Classical Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e6', 'b1c3', 'e6d5', 'c4d5', 'd7d6', 'e2e4', 'g7g6', 'g1f3'], styles: ['classical'], weight: 2 },
  { eco: 'A43', name: "Old Benoni Defence", uci: ['d2d4', 'c7c5'], styles: ['aggressive'], weight: 1 },
  { eco: 'A44', name: "Old Benoni Defence: Czech Variation", uci: ['d2d4', 'c7c5', 'd4d5', 'e7e5'], styles: ['solid'], weight: 1 },
  { eco: 'A40', name: "Englund Gambit", uci: ['d2d4', 'e7e5', 'd4e5', 'b8c6'], styles: ['gambit'], weight: 1 },
  { eco: 'A40', name: "Queen's Pawn Game: Modern Defence", uci: ['d2d4', 'g7g6'], styles: ['hypermodern'], weight: 2 },
  { eco: 'A40', name: "Polish Defence", uci: ['d2d4', 'b7b5'], styles: ['hypermodern'], weight: 1 },
  { eco: 'A40', name: "Horwitz Defence", uci: ['d2d4', 'e7e6'], styles: ['solid'], weight: 2 },
  { eco: 'A80', name: "Dutch Defence", uci: ['d2d4', 'f7f5'], styles: ['aggressive'], weight: 4 },
  { eco: 'A80', name: "Dutch Defence: Hopton Attack", uci: ['d2d4', 'f7f5', 'c1g5'], styles: ['aggressive'], weight: 1 },
  { eco: 'A82', name: "Dutch Defence: Staunton Gambit", uci: ['d2d4', 'f7f5', 'e2e4'], styles: ['gambit', 'aggressive'], weight: 1 },
  { eco: 'A83', name: "Dutch Defence: Staunton Gambit Accepted", uci: ['d2d4', 'f7f5', 'e2e4', 'f5e4', 'b1c3', 'g8f6', 'c1g5'], styles: ['gambit'], weight: 1 },
  { eco: 'A87', name: "Dutch Defence: Leningrad Variation", uci: ['d2d4', 'f7f5', 'c2c4', 'g8f6', 'g2g3', 'g7g6', 'f1g2', 'f8g7', 'g1f3'], styles: ['aggressive', 'hypermodern'], weight: 3 },
  { eco: 'A90', name: "Dutch Defence: Stonewall Variation", uci: ['d2d4', 'f7f5', 'c2c4', 'g8f6', 'g2g3', 'e7e6', 'f1g2', 'd7d5'], styles: ['solid'], weight: 3 },
  { eco: 'A92', name: "Dutch Defence: Classical Variation", uci: ['d2d4', 'f7f5', 'c2c4', 'g8f6', 'g2g3', 'e7e6', 'f1g2', 'f8e7'], styles: ['classical'], weight: 2 },
  { eco: 'A96', name: "Dutch Defence: Classical Variation, Main Line", uci: ['d2d4', 'f7f5', 'c2c4', 'g8f6', 'g2g3', 'e7e6', 'f1g2', 'f8e7', 'g1f3', 'e8g8', 'e1g1', 'd7d6'], styles: ['classical'], weight: 2 },
  { eco: 'E00', name: "Catalan Opening", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g2g3'], styles: ['positional'], weight: 6 },
  { eco: 'E01', name: "Catalan Opening: Main Line", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g2g3', 'd7d5', 'f1g2'], styles: ['positional'], weight: 5 },
  { eco: 'E04', name: "Catalan Opening: Open Defence", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g2g3', 'd7d5', 'f1g2', 'd5c4', 'g1f3'], styles: ['positional'], weight: 4 },
  { eco: 'E06', name: "Catalan Opening: Closed Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g2g3', 'd7d5', 'f1g2', 'f8e7', 'g1f3', 'e8g8', 'e1g1'], styles: ['positional', 'solid'], weight: 4 },
  { eco: 'E10', name: "Blumenfeld Countergambit", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'c7c5', 'd4d5', 'b7b5'], styles: ['gambit'], weight: 1 },
  { eco: 'E11', name: "Bogo-Indian Defence", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'f8b4'], styles: ['solid'], weight: 4 },
  { eco: 'E11', name: "Bogo-Indian Defence: Grünfeld Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'f8b4', 'b1d2'], styles: ['positional'], weight: 2 },
  { eco: 'E11', name: "Bogo-Indian Defence: Exchange Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'f8b4', 'c1d2', 'b4d2'], styles: ['solid'], weight: 2 },
  { eco: 'E12', name: "Queen's Indian Defence", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6'], styles: ['solid', 'hypermodern'], weight: 6 },
  { eco: 'E12', name: "Queen's Indian Defence: Petrosian Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6', 'a2a3'], styles: ['positional'], weight: 4 },
  { eco: 'E14', name: "Queen's Indian Defence: Spassky System", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6', 'e2e3'], styles: ['solid'], weight: 2 },
  { eco: 'E15', name: "Queen's Indian Defence: Fianchetto Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6', 'g2g3'], styles: ['positional'], weight: 4 },
  { eco: 'E15', name: "Queen's Indian Defence: Nimzowitsch Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6', 'g2g3', 'c8a6'], styles: ['hypermodern'], weight: 3 },
  { eco: 'E17', name: "Queen's Indian Defence: Classical Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6', 'g2g3', 'c8b7', 'f1g2', 'f8e7'], styles: ['solid'], weight: 3 },
  { eco: 'E20', name: "Nimzo-Indian Defence", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4'], styles: ['hypermodern', 'positional'], weight: 8 },
  { eco: 'E20', name: "Nimzo-Indian Defence: Kmoch Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'f2f3'], styles: ['aggressive'], weight: 2 },
  { eco: 'E20', name: "Nimzo-Indian Defence: Romanishin Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'g2g3'], styles: ['positional'], weight: 2 },
  { eco: 'E21', name: "Nimzo-Indian Defence: Three Knights Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'g1f3'], styles: ['classical'], weight: 4 },
  { eco: 'E24', name: "Nimzo-Indian Defence: Sämisch Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'a2a3', 'b4c3', 'b2c3'], styles: ['aggressive'], weight: 2 },
  { eco: 'E30', name: "Nimzo-Indian Defence: Leningrad Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'c1g5'], styles: ['aggressive'], weight: 1 },
  { eco: 'E32', name: "Nimzo-Indian Defence: Classical Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'd1c2'], styles: ['classical', 'positional'], weight: 6 },
  { eco: 'E33', name: "Nimzo-Indian Defence: Classical Variation, Zurich Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'd1c2', 'b8c6'], styles: ['hypermodern'], weight: 1 },
  { eco: 'E34', name: "Nimzo-Indian Defence: Classical Variation, Noa Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'd1c2', 'd7d5'], styles: ['classical'], weight: 3 },
  { eco: 'E38', name: "Nimzo-Indian Defence: Classical Variation, 4...c5", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'd1c2', 'c7c5'], styles: ['aggressive'], weight: 2 },
  { eco: 'E40', name: "Nimzo-Indian Defence: Rubinstein Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3'], styles: ['solid', 'classical'], weight: 6 },
  { eco: 'E41', name: "Nimzo-Indian Defence: Hübner Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3', 'c7c5', 'f1d3', 'b8c6', 'g1f3', 'b4c3', 'b2c3', 'd7d6'], styles: ['positional'], weight: 2 },
  { eco: 'E43', name: "Nimzo-Indian Defence: St. Petersburg Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3', 'b7b6'], styles: ['hypermodern'], weight: 2 },
  { eco: 'E46', name: "Nimzo-Indian Defence: Normal Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3', 'e8g8'], styles: ['solid'], weight: 4 },
  { eco: 'E48', name: "Nimzo-Indian Defence: Normal Variation, 5.Bd3 d5", uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3', 'e8g8', 'f1d3', 'd7d5'], styles: ['classical'], weight: 3 },
  { eco: 'D70', name: "Neo-Grünfeld Defence", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'g2g3', 'd7d5'], styles: ['hypermodern'], weight: 2 },
  { eco: 'D80', name: "Grünfeld Defence", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5'], styles: ['hypermodern', 'aggressive'], weight: 7 },
  { eco: 'D80', name: "Grünfeld Defence: Stockholm Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'c1g5'], styles: ['aggressive'], weight: 2 },
  { eco: 'D82', name: "Grünfeld Defence: Brinckmann Attack", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'c1f4'], styles: ['positional'], weight: 3 },
  { eco: 'D85', name: "Grünfeld Defence: Exchange Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'c4d5', 'f6d5', 'e2e4', 'd5c3', 'b2c3'], styles: ['classical', 'aggressive'], weight: 6 },
  { eco: 'D85', name: "Grünfeld Defence: Exchange Variation, Modern Exchange", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'c4d5', 'f6d5', 'e2e4', 'd5c3', 'b2c3', 'f8g7', 'g1f3'], styles: ['classical'], weight: 4 },
  { eco: 'D86', name: "Grünfeld Defence: Exchange Variation, Classical Exchange", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'c4d5', 'f6d5', 'e2e4', 'd5c3', 'b2c3', 'f8g7', 'f1c4'], styles: ['classical'], weight: 3 },
  { eco: 'D90', name: "Grünfeld Defence: Three Knights Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'g1f3', 'f8g7'], styles: ['hypermodern'], weight: 4 },
  { eco: 'D92', name: "Grünfeld Defence: Three Knights Variation, Hungarian Attack", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'g1f3', 'f8g7', 'c1f4'], styles: ['positional'], weight: 2 },
  { eco: 'D96', name: "Grünfeld Defence: Russian Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'g1f3', 'f8g7', 'd1b3'], styles: ['classical'], weight: 3 },
  { eco: 'D97', name: "Grünfeld Defence: Russian Variation, Main Line", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'g1f3', 'f8g7', 'd1b3', 'd5c4', 'b3c4', 'e8g8', 'e2e4'], styles: ['classical'], weight: 2 },
  { eco: 'E60', name: "King's Indian Defence", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6'], styles: ['hypermodern', 'aggressive'], weight: 9 },
  { eco: 'E62', name: "King's Indian Defence: Fianchetto Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'g1f3', 'f8g7', 'g2g3', 'e8g8', 'f1g2', 'd7d6'], styles: ['positional'], weight: 4 },
  { eco: 'E70', name: "King's Indian Defence: Normal Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6'], styles: ['aggressive'], weight: 7 },
  { eco: 'E71', name: "King's Indian Defence: Makogonov Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'h2h3'], styles: ['positional'], weight: 2 },
  { eco: 'E73', name: "King's Indian Defence: Averbakh Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'f1e2', 'e8g8', 'c1g5'], styles: ['positional'], weight: 3 },
  { eco: 'E76', name: "King's Indian Defence: Four Pawns Attack", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'f2f4'], styles: ['aggressive'], weight: 2 },
  { eco: 'E80', name: "King's Indian Defence: Sämisch Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'f2f3'], styles: ['aggressive', 'positional'], weight: 4 },
  { eco: 'E92', name: "King's Indian Defence: Classical Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'g1f3', 'e8g8', 'f1e2', 'e7e5'], styles: ['classical', 'aggressive'], weight: 7 },
  { eco: 'E92', name: "King's Indian Defence: Petrosian Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'g1f3', 'e8g8', 'f1e2', 'e7e5', 'd4d5'], styles: ['positional'], weight: 3 },
  { eco: 'E92', name: "King's Indian Defence: Gligoric-Taimanov System", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'g1f3', 'e8g8', 'f1e2', 'e7e5', 'c1e3'], styles: ['positional'], weight: 3 },
  { eco: 'E94', name: "King's Indian Defence: Orthodox Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'g1f3', 'e8g8', 'f1e2', 'e7e5', 'e1g1'], styles: ['classical'], weight: 6 },
  { eco: 'E97', name: "King's Indian Defence: Mar del Plata Variation", uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'g1f3', 'e8g8', 'f1e2', 'e7e5', 'e1g1', 'b8c6'], styles: ['aggressive'], weight: 5 },
  { eco: 'A10', name: "English Opening: Great Snake Variation", uci: ['c2c4', 'g7g6'], styles: ['hypermodern'], weight: 2 },
  { eco: 'A10', name: "English Opening: Anglo-Dutch Defence", uci: ['c2c4', 'f7f5'], styles: ['aggressive'], weight: 1 },
  { eco: 'A11', name: "English Opening: Caro-Kann Defensive System", uci: ['c2c4', 'c7c6'], styles: ['solid'], weight: 3 },
  { eco: 'A13', name: "English Opening: Agincourt Defence", uci: ['c2c4', 'e7e6'], styles: ['solid'], weight: 4 },
  { eco: 'A15', name: "English Opening: Anglo-Indian Defence", uci: ['c2c4', 'g8f6'], styles: ['hypermodern'], weight: 7 },
  { eco: 'A16', name: "English Opening: Anglo-Grünfeld Defence", uci: ['c2c4', 'g8f6', 'b1c3', 'd7d5'], styles: ['hypermodern'], weight: 3 },
  { eco: 'A18', name: "English Opening: Mikenas-Carls Variation", uci: ['c2c4', 'g8f6', 'b1c3', 'e7e6', 'e2e4'], styles: ['aggressive'], weight: 2 },
  { eco: 'A20', name: "English Opening: King's English Variation", uci: ['c2c4', 'e7e5'], styles: ['classical'], weight: 6 },
  { eco: 'A22', name: "English Opening: King's English Variation, Two Knights Variation", uci: ['c2c4', 'e7e5', 'b1c3', 'g8f6'], styles: ['classical'], weight: 4 },
  { eco: 'A22', name: "English Opening: King's English Variation, Bremen System", uci: ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g2g3'], styles: ['positional'], weight: 3 },
  { eco: 'A25', name: "English Opening: King's English Variation, Reversed Closed Sicilian", uci: ['c2c4', 'e7e5', 'b1c3', 'b8c6'], styles: ['positional'], weight: 3 },
  { eco: 'A26', name: "English Opening: King's English Variation, Closed System", uci: ['c2c4', 'e7e5', 'b1c3', 'b8c6', 'g2g3', 'g7g6', 'f1g2', 'f8g7', 'd2d3', 'd7d6'], styles: ['positional'], weight: 2 },
  { eco: 'A28', name: "English Opening: King's English Variation, Four Knights Variation", uci: ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g1f3', 'b8c6'], styles: ['classical'], weight: 3 },
  { eco: 'A29', name: "English Opening: King's English Variation, Four Knights, Fianchetto Line", uci: ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g1f3', 'b8c6', 'g2g3'], styles: ['positional'], weight: 2 },
  { eco: 'A30', name: "English Opening: Symmetrical Variation", uci: ['c2c4', 'c7c5'], styles: ['positional'], weight: 5 },
  { eco: 'A30', name: "English Opening: Symmetrical Variation, Hedgehog Defence", uci: ['c2c4', 'c7c5', 'g1f3', 'g8f6', 'g2g3', 'b7b6', 'f1g2', 'c8b7', 'e1g1', 'e7e6', 'b1c3', 'f8e7'], styles: ['hypermodern', 'solid'], weight: 2 },
  { eco: 'A36', name: "English Opening: Symmetrical Variation, Fianchetto Line", uci: ['c2c4', 'c7c5', 'b1c3', 'b8c6', 'g2g3', 'g7g6', 'f1g2', 'f8g7'], styles: ['positional'], weight: 2 },
  { eco: 'A38', name: "English Opening: Symmetrical Variation, Full Symmetry Line", uci: ['c2c4', 'c7c5', 'b1c3', 'b8c6', 'g2g3', 'g7g6', 'f1g2', 'f8g7', 'g1f3', 'g8f6'], styles: ['positional'], weight: 2 },
  { eco: 'A04', name: "Zukertort Opening: Sicilian Invitation", uci: ['g1f3', 'c7c5'], styles: ['hypermodern'], weight: 3 },
  { eco: 'A04', name: "Zukertort Opening: Dutch Variation", uci: ['g1f3', 'f7f5'], styles: ['aggressive'], weight: 1 },
  { eco: 'A06', name: "Zukertort Opening", uci: ['g1f3', 'd7d5'], styles: ['hypermodern'], weight: 6 },
  { eco: 'A05', name: "King's Indian Attack", uci: ['g1f3', 'g8f6', 'g2g3'], styles: ['positional', 'hypermodern'], weight: 4 },
  { eco: 'A07', name: "King's Indian Attack: 1...d5", uci: ['g1f3', 'd7d5', 'g2g3'], styles: ['positional'], weight: 3 },
  { eco: 'A08', name: "King's Indian Attack: 2...c5", uci: ['g1f3', 'd7d5', 'g2g3', 'c7c5', 'f1g2'], styles: ['positional'], weight: 2 },
  { eco: 'A09', name: "Réti Opening", uci: ['g1f3', 'd7d5', 'c2c4'], styles: ['hypermodern'], weight: 5 },
  { eco: 'A09', name: "Réti Opening: Advance Variation", uci: ['g1f3', 'd7d5', 'c2c4', 'd5d4'], styles: ['hypermodern'], weight: 3 },
  { eco: 'A09', name: "Réti Opening: Accepted", uci: ['g1f3', 'd7d5', 'c2c4', 'd5c4'], styles: ['hypermodern'], weight: 2 },
  { eco: 'A00', name: "Polish Opening", uci: ['b2b4', 'e7e5'], styles: ['hypermodern'], weight: 1 },
  { eco: 'A00', name: "Grob Opening", uci: ['g2g4', 'd7d5'], styles: ['aggressive'], weight: 1 },
  { eco: 'A00', name: "Van't Kruijs Opening", uci: ['e2e3', 'e7e5'], styles: ['solid'], weight: 1 },
  { eco: 'A00', name: "Mieses Opening", uci: ['d2d3', 'e7e5'], styles: ['solid'], weight: 1 },
  { eco: 'A00', name: "Anderssen's Opening", uci: ['a2a3', 'e7e5'], styles: ['hypermodern'], weight: 1 },
  { eco: 'A00', name: "Saragossa Opening", uci: ['c2c3', 'e7e5'], styles: ['solid'], weight: 1 },
  { eco: 'A00', name: "Hungarian Opening", uci: ['g2g3', 'd7d5'], styles: ['hypermodern'], weight: 2 },
  { eco: 'A00', name: "Van Geet Opening", uci: ['b1c3', 'd7d5'], styles: ['positional'], weight: 1 },
  { eco: 'A01', name: "Nimzo-Larsen Attack", uci: ['b2b3', 'e7e5'], styles: ['hypermodern'], weight: 2 },
  { eco: 'A01', name: "Nimzo-Larsen Attack: Modern Variation", uci: ['b2b3', 'e7e5', 'c1b2', 'b8c6'], styles: ['hypermodern'], weight: 2 },
  { eco: 'A02', name: "Bird Opening: From's Gambit", uci: ['f2f4', 'e7e5'], styles: ['gambit'], weight: 1 },
  { eco: 'A03', name: "Bird Opening: Dutch Variation", uci: ['f2f4', 'd7d5'], styles: ['aggressive'], weight: 2 },
];

/** Max plies of a game scanned by identifyOpening. */
const IDENTIFY_MAX_PLY = 24;

type Continuation = { uci: string; line: number };
type BookIndex = {
  /** positionKey of a line's final position -> index of the line naming it */
  named: Map<string, number>;
  /** positionKey -> continuations found in book lines from that position */
  next: Map<string, Continuation[]>;
};

let index: BookIndex | null = null;

function applyUci(chess: Chess, uci: string): boolean {
  try {
    chess.move(parseUci(uci));
    return true;
  } catch {
    return false;
  }
}

function moreSpecific(a: OpeningLine, b: OpeningLine): boolean {
  if (a.uci.length !== b.uci.length) return a.uci.length > b.uci.length;
  if (a.name.length !== b.name.length) return a.name.length > b.name.length;
  return a.weight > b.weight;
}

function buildIndex(): BookIndex {
  const named = new Map<string, number>();
  const next = new Map<string, Continuation[]>();
  OPENINGS.forEach((line, li) => {
    const chess = new Chess(START_FEN);
    for (const uci of line.uci) {
      const key = positionKey(chess.fen());
      if (!applyUci(chess, uci)) return; // malformed line: ignore the rest
      let list = next.get(key);
      if (!list) next.set(key, (list = []));
      if (!list.some((c) => c.uci === uci && c.line === li)) list.push({ uci, line: li });
    }
    const end = positionKey(chess.fen());
    const prev = named.get(end);
    if (prev === undefined || moreSpecific(line, OPENINGS[prev])) named.set(end, li);
  });
  return { named, next };
}

function getIndex(): BookIndex {
  return (index ??= buildIndex());
}

/** Position keys after each ply of the game (index 0 = start position). Stops at an illegal move. */
function gameKeys(uciMoves: readonly string[], maxPly: number): string[] {
  const chess = new Chess(START_FEN);
  const keys = [positionKey(chess.fen())];
  for (let i = 0; i < uciMoves.length && i < maxPly; i++) {
    if (!applyUci(chess, uciMoves[i])) break;
    keys.push(positionKey(chess.fen()));
  }
  return keys;
}

/**
 * Deepest named line reached by the game, by position (handles transpositions).
 * `ply` is the game ply at which that position occurred.
 */
export function identifyOpening(uciMoves: string[]): { eco: string; name: string; ply: number } | null {
  const { named } = getIndex();
  const keys = gameKeys(uciMoves, IDENTIFY_MAX_PLY);
  let hit: { eco: string; name: string; ply: number } | null = null;
  for (let ply = 1; ply < keys.length; ply++) {
    const li = named.get(keys[ply]);
    if (li !== undefined) hit = { eco: OPENINGS[li].eco, name: OPENINGS[li].name, ply };
  }
  return hit;
}

/**
 * Book continuations from the current position (position-based). Weights are
 * summed over all lines that play the move; lines whose styles intersect
 * `styles` count triple. `name` is the most general line containing the move.
 */
export function bookMoves(uciMoves: string[], styles?: OpeningStyle[]): { uci: string; weight: number; name: string }[] {
  const keys = gameKeys(uciMoves, uciMoves.length);
  if (keys.length !== uciMoves.length + 1) return []; // illegal move in history
  const conts = getIndex().next.get(keys[keys.length - 1]);
  if (!conts) return [];
  const wanted = new Set(styles ?? []);
  const merged = new Map<string, { uci: string; weight: number; name: string; nameLen: number }>();
  for (const c of conts) {
    const line = OPENINGS[c.line];
    const boost = line.styles.some((s) => wanted.has(s)) ? 3 : 1;
    const w = line.weight * boost;
    const cur = merged.get(c.uci);
    if (!cur) merged.set(c.uci, { uci: c.uci, weight: w, name: line.name, nameLen: line.uci.length });
    else {
      cur.weight += w;
      if (line.uci.length < cur.nameLen) {
        cur.name = line.name;
        cur.nameLen = line.uci.length;
      }
    }
  }
  return [...merged.values()]
    .map(({ uci, weight, name }) => ({ uci, weight, name }))
    .sort((a, b) => b.weight - a.weight || a.uci.localeCompare(b.uci));
}

/** "Sicilian Defence: Najdorf Variation" -> "Sicilian Defence". */
export function openingFamily(name: string): string {
  const i = name.indexOf(':');
  return (i < 0 ? name : name.slice(0, i)).trim();
}
