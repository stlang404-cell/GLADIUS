/**
 * Built-in tactical puzzles. `solution` is UCI: trainee moves at even
 * indices, the opponent's replies at odd indices. Mate puzzles were verified
 * by exhaustive search (unique first move, final position is checkmate);
 * material puzzles were checked with an engine (clear best move, decisive
 * advantage at the end of the line).
 */
export type Puzzle = { id: string; fen: string; solution: string[] /* UCI, trainee moves at even indices, forced replies at odd */; theme: string; rating: number };

export const BUILTIN_PUZZLES: Puzzle[] = [
  { id: 'p01', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', solution: ['d1d8'], theme: 'backRankMate', rating: 600 },
  { id: 'p02', fen: '3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', solution: ['d8d1'], theme: 'backRankMate', rating: 650 },
  { id: 'p03', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', solution: ['g5f7'], theme: 'smotheredMate', rating: 800 },
  { id: 'p04', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', solution: ['h5f7'], theme: 'mateIn1', rating: 500 },
  { id: 'p05', fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2', solution: ['d8h4'], theme: 'mateIn1', rating: 450 },
  { id: 'p06', fen: '5r2/4Nppk/8/8/8/3R4/8/6K1 w - - 0 1', solution: ['d3h3'], theme: 'anastasiaMate', rating: 1000 },
  { id: 'p07', fen: '7k/1R6/5N2/8/8/8/8/6K1 w - - 0 1', solution: ['b7h7'], theme: 'arabianMate', rating: 900 },
  { id: 'p08', fen: '2kr4/p2n4/2p5/8/5B2/8/4B3/6K1 w - - 0 1', solution: ['e2a6'], theme: 'bodenMate', rating: 1100 },
  { id: 'p09', fen: 'k7/8/1K6/8/8/8/7Q/8 w - - 0 1', solution: ['h2h8'], theme: 'mateIn1', rating: 500 },
  { id: 'p10', fen: 'k7/7R/8/8/8/8/8/6RK w - - 0 1', solution: ['g1g8'], theme: 'mateIn1', rating: 550 },
  { id: 'p11', fen: '3rkr2/8/8/8/8/8/4Q3/4K3 w - - 0 1', solution: ['e2e6'], theme: 'epauletteMate', rating: 900 },
  { id: 'p12', fen: '5rk1/5p2/6P1/8/8/8/8/6KQ w - - 0 1', solution: ['h1h7'], theme: 'damianoMate', rating: 850 },
  { id: 'p13', fen: '3r2k1/5ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1', solution: ['d2d8'], theme: 'backRankMate', rating: 700 },
  { id: 'p14', fen: 'rn1q1bnr/ppp1kB1p/3p2p1/4N3/4P3/2N5/PPPP1PPP/R1BbK2R w KQ - 1 7', solution: ['c3d5'], theme: 'legalsMate', rating: 900 },
  { id: 'p15', fen: 'r1b1k2r/ppppqppp/2n5/4n3/1PP2B2/5N2/1P1NPPPP/R2QKB1R b KQkq - 0 8', solution: ['e5d3'], theme: 'smotheredMate', rating: 1000 },
  { id: 'p16', fen: 'r1b1k1nr/pppp1ppp/2n5/4P3/8/2Q2N2/PqP1PPPP/RN2KB1R b KQkq - 0 8', solution: ['b2c1'], theme: 'mateIn1', rating: 800 },
  { id: 'p17', fen: 'r1bqkb1r/pp1npppp/2p2n2/8/3PN3/8/PPP1QPPP/R1B1KBNR w KQkq - 3 6', solution: ['e4d6'], theme: 'smotheredMate', rating: 1000 },
  { id: 'p18', fen: '6k1/5p1p/5PpQ/8/8/8/5PPP/6K1 w - - 0 1', solution: ['h6g7'], theme: 'mateIn1', rating: 800 },
  { id: 'p19', fen: 'r6k/ppp4p/8/8/8/8/3B3K/6R1 w - - 0 1', solution: ['d2c3'], theme: 'morphysMate', rating: 1000 },
  { id: 'p20', fen: '7k/7p/8/4N3/8/8/7K/6R1 w - - 0 1', solution: ['e5f7'], theme: 'cornerMate', rating: 900 },
  { id: 'p21', fen: '5rk1/5pp1/8/7Q/8/3B4/5PPP/6K1 w - - 0 1', solution: ['h5h7'], theme: 'mateIn1', rating: 700 },
  { id: 'p22', fen: '6k1/5ppp/8/8/6n1/8/6PP/6RK b - - 0 1', solution: ['g4f2'], theme: 'smotheredMate', rating: 800 },
  { id: 'p23', fen: 'r2qkb2/pp1p4/8/8/4N3/8/PP4PP/4R1K1 w - - 0 1', solution: ['e4d6'], theme: 'doubleCheck', rating: 1200 },
  { id: 'p24', fen: '8/8/6pp/7k/5P2/7K/6P1/8 w - - 0 1', solution: ['g2g4'], theme: 'pawnMate', rating: 1100 },
  { id: 'p25', fen: '6r1/3b3k/8/8/8/8/PPP4P/R6K b - - 0 1', solution: ['d7c6'], theme: 'morphysMate', rating: 1000 },
  { id: 'p26', fen: '5rk1/5ppp/8/6N1/8/3Q4/5PPP/6K1 w - - 0 1', solution: ['d3h7'], theme: 'mateIn1', rating: 750 },
  { id: 'p27', fen: '6k1/1b3ppp/8/6q1/8/8/5PPP/5RK1 b - - 0 1', solution: ['g5g2'], theme: 'mateIn1', rating: 700 },
  { id: 'p28', fen: '3r3k/6pp/7N/8/2Q5/8/6PP/6K1 w - - 0 1', solution: ['c4g8', 'd8g8', 'h6f7'], theme: 'smotheredMate', rating: 1500 },
  { id: 'p29', fen: '2r1r1k1/5ppp/8/4Q3/8/8/1q3PPP/4R1K1 w - - 0 1', solution: ['e5e8', 'c8e8', 'e1e8'], theme: 'deflection', rating: 1400 },
  { id: 'p30', fen: '5r1k/4Nppp/8/8/8/3R3Q/5PPP/6K1 w - - 0 1', solution: ['h3h7', 'h8h7', 'd3h3'], theme: 'anastasiaMate', rating: 1600 },
  { id: 'p31', fen: 'rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6', solution: ['c4f7', 'e8e7', 'c3d5'], theme: 'legalsMate', rating: 1500 },
  { id: 'p32', fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16', solution: ['b3b8', 'd7b8', 'd1d8'], theme: 'operaMate', rating: 1700 },
  { id: 'p33', fen: 'rnbk1b1r/pp3ppp/2p5/4q3/4n3/8/PPPB1PPP/2KR1BNR w - - 0 10', solution: ['d2g5', 'd8e8', 'd1d8'], theme: 'doubleCheck', rating: 1700 },
  { id: 'p34', fen: 'r1bk2nr/p2p1pNp/n2B4/1p1NP2P/6P1/3P1Q2/P1P1K3/q5b1 w - - 1 22', solution: ['f3f6', 'g8f6', 'd6e7'], theme: 'sacrifice', rating: 1800 },
  { id: 'p35', fen: '5rk1/5ppp/8/8/7B/Q7/5PPP/3R2K1 w - - 0 1', solution: ['a3f8', 'g8f8', 'd1d8'], theme: 'backRankMate', rating: 1500 },
  { id: 'p36', fen: '2kr4/pp1n4/2n5/8/5B2/5Q2/4BPPP/6K1 w - - 0 1', solution: ['f3c6', 'b7c6', 'e2a6'], theme: 'bodenMate', rating: 1700 },
  { id: 'p37', fen: '6k1/5ppp/3r3q/8/8/8/4nPPP/5R1K b - - 0 1', solution: ['h6h2', 'h1h2', 'd6h6'], theme: 'anastasiaMate', rating: 1600 },
  { id: 'p38', fen: '6k1/4bppp/5q2/5b2/8/2N5/PP1N4/2KR4 b - - 0 1', solution: ['f6c3', 'b2c3', 'e7a3'], theme: 'bodenMate', rating: 1700 },
  { id: 'p39', fen: 'rnbqkb1r/pppp1ppp/5n2/4N3/8/8/PPPPQPPP/RNB1KB1R w KQkq - 2 5', solution: ['e5c6', 'd8e7', 'c6e7'], theme: 'discoveredAttack', rating: 1300 },
  { id: 'p40', fen: '1q3k2/p4ppp/8/4N3/8/8/P4PPP/2R3K1 w - - 0 1', solution: ['e5d7', 'f8e8', 'd7b8'], theme: 'fork', rating: 1200 },
  { id: 'p41', fen: '8/p2k3q/P7/8/8/8/6PP/1R4K1 w - - 0 1', solution: ['b1b7', 'd7c6', 'b7h7'], theme: 'skewer', rating: 1100 },
  { id: 'p42', fen: '4k3/pp1q1ppp/8/8/8/2N5/PP3PPP/5BK1 w - - 0 1', solution: ['f1b5', 'd7b5', 'c3b5'], theme: 'pin', rating: 1000 },
  { id: 'p43', fen: 'rnbqk1nr/ppp2ppp/8/4P3/1BP5/4p3/PP3PPP/RN1QKBNR b KQkq - 0 6', solution: ['e3f2', 'e1e2', 'f2g1n'], theme: 'underPromotion', rating: 1900 },
  { id: 'p44', fen: 'r1bqkb1r/pppn1ppp/5n2/3N2B1/3P4/8/PP2PPPP/R2QKBNR b KQkq - 0 6', solution: ['f6d5', 'g5d8', 'f8b4'], theme: 'trap', rating: 1600 },
  { id: 'p45', fen: 'r1b1k3/pp3ppp/8/1N6/8/8/PP3PPP/3R2K1 w - - 0 1', solution: ['b5c7', 'e8e7', 'c7a8'], theme: 'fork', rating: 1000 },
];
