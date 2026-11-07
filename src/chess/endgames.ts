/**
 * Classic instructive endgames. The trainee plays the side to move and must
 * reach `goal` against best defence. Results were checked with an engine.
 */
export type EndgameDrill = { id: string; name: string; fen: string; goal: 'win' | 'draw'; difficulty: 1 | 2 | 3 | 4 | 5; hint: string };

export const ENDGAME_DRILLS: EndgameDrill[] = [
  { id: 'kqk', name: 'Queen Mate', fen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1', goal: 'win', difficulty: 1, hint: 'Box the king in with the queen, then bring your own king up to help.' },
  { id: 'krrk', name: 'Two-Rook Ladder', fen: '8/8/8/4k3/8/8/8/R3K2R w - - 0 1', goal: 'win', difficulty: 1, hint: 'Roll the rooks rank by rank: one checks while the other guards the next rank.' },
  { id: 'krk', name: 'Rook Mate', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', goal: 'win', difficulty: 2, hint: 'Cut the king off with the rook and use your king to take the opposition.' },
  { id: 'kbbk', name: 'Two Bishops Mate', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', goal: 'win', difficulty: 4, hint: 'Side-by-side bishops form a wall; drive the king to a corner with your king.' },
  { id: 'kbnk', name: 'Bishop and Knight Mate', fen: '8/8/8/4k3/8/8/8/1N2KB2 w - - 0 1', goal: 'win', difficulty: 5, hint: "Mate only in a corner of the bishop's colour; use the knight's W-manoeuvre." },
  { id: 'lucena', name: 'Lucena Position', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', goal: 'win', difficulty: 4, hint: 'Build a bridge: check the king away, then put your rook on the 4th rank.' },
  { id: 'philidor', name: 'Philidor Position', fen: '4k3/8/7r/3KP3/8/8/8/R7 b - - 0 1', goal: 'draw', difficulty: 3, hint: 'Keep your rook on the 6th rank; once the pawn advances, check from behind.' },
  { id: 'vancura', name: 'Vancura Position', fen: 'R7/6k1/P4r2/8/8/8/8/6K1 b - - 0 1', goal: 'draw', difficulty: 4, hint: 'Attack the pawn from the side; check from behind when the king approaches.' },
  { id: 'kpk-key-square', name: 'King and Pawn: Key Squares', fen: '8/4k3/8/8/4K3/8/4P3/8 w - - 0 1', goal: 'win', difficulty: 2, hint: 'Your king already stands on a key square: lead with the king, not the pawn.' },
  { id: 'kpk-opposition', name: 'King and Pawn: Holding the Opposition', fen: '4k3/8/8/4K3/4P3/8/8/8 b - - 0 1', goal: 'draw', difficulty: 2, hint: 'Take the opposition: face the enemy king with one square between you.' },
  { id: 'kpkp-outflank', name: 'Outflanking', fen: '8/2k5/3p4/1K1P4/8/8/8/8 w - - 0 1', goal: 'win', difficulty: 3, hint: 'Go round the side: Ka6! outflanks the defender and wins the d6 pawn.' },
  { id: 'square', name: 'Square of the Pawn', fen: '8/8/8/8/1p6/5K2/8/7k w - - 0 1', goal: 'draw', difficulty: 1, hint: 'Step into the square of the pawn and you will catch it.' },
  { id: 'wrong-bishop', name: 'Wrong Rook Pawn', fen: 'k7/8/1K6/P7/8/8/8/4B3 b - - 0 1', goal: 'draw', difficulty: 2, hint: "The bishop can't control a8: just shuffle between a8 and b8." },
  { id: 'right-bishop', name: 'Right Rook Pawn', fen: 'k7/8/1K6/P7/8/8/8/5B2 w - - 0 1', goal: 'win', difficulty: 2, hint: 'This bishop controls the queening square: push the pawn but avoid stalemate.' },
  { id: 'kpk-rook-pawn', name: 'Rook Pawn Fortress', fen: '7k/8/6K1/7P/8/8/8/8 b - - 0 1', goal: 'draw', difficulty: 1, hint: "Stay in the corner; the h-pawn can't drive you out without stalemate." },
  { id: 'q-vs-pawn', name: 'Queen v Pawn on the 7th', fen: '8/8/8/8/8/8/3kp3/K6Q w - - 0 1', goal: 'win', difficulty: 3, hint: 'Check and pin until the king blocks its pawn, then bring your king closer.' },
  { id: 'q-vs-rook-pawn', name: 'Queen v Rook Pawn', fen: '7K/8/8/8/8/1Q6/p7/1k6 b - - 0 1', goal: 'draw', difficulty: 2, hint: 'Hide in the corner: with the a-pawn, stalemate tricks save you.' },
  { id: 'r-vs-pawn', name: 'Rook v Pawn', fen: '8/8/8/8/4K3/2kp4/8/3R4 w - - 0 1', goal: 'win', difficulty: 3, hint: 'Bring your king toward the pawn; the rook alone cannot stop it in time.' },
  { id: 'reti', name: 'Réti Manoeuvre', fen: '7K/8/k1P5/7p/8/8/8/8 w - - 0 1', goal: 'draw', difficulty: 5, hint: 'Walk the king diagonally: chase the h-pawn and support your own at once.' },
  { id: 'breakthrough', name: 'Pawn Breakthrough', fen: '8/ppp5/8/PPP5/8/8/8/k6K w - - 0 1', goal: 'win', difficulty: 3, hint: 'Sacrifice in the middle: b6! opens a path for one of your pawns.' },
  { id: 'outside-passer', name: 'Outside Passed Pawn', fen: '8/5kpp/8/8/P7/8/5KPP/8 w - - 0 1', goal: 'win', difficulty: 3, hint: 'Push the outside passer to decoy the enemy king, then feast on the kingside.' },
  { id: 'r-vs-b', name: 'Rook v Bishop: Safe Corner', fen: '6bk/8/6K1/8/8/8/8/R7 b - - 0 1', goal: 'draw', difficulty: 4, hint: "Keep your king in the corner the bishop can't cover and avoid pins." },
  { id: 'q-vs-r', name: 'Queen v Rook', fen: '8/8/3k4/8/8/8/2r5/4K2Q w - - 0 1', goal: 'win', difficulty: 5, hint: 'Push the king to the edge, look for forks and keep the rook away from its king.' },
  { id: 'saavedra', name: 'Saavedra Position', fen: '8/8/1KP5/3r4/8/8/8/k7 w - - 0 1', goal: 'win', difficulty: 5, hint: 'Escape the checks, then underpromote to a rook to avoid stalemate.' },
];
