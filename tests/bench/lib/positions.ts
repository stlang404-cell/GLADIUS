/**
 * Verified test positions (generated from the verification run; see docs/ENGINE.md).
 * Tactics: Win At Chess (WAC, Reinfeld) and Bratko-Kopec (BK) positions with their
 * published best moves. Each FEN+answer was re-checked with Stockfish 19 full net,
 * 4 threads, Hash 256, MultiPV 2, 10 s: kept only if the engine's choice is a listed
 * best move and (single-answer positions) it beats the second line by ≥ 25 cp.
 */
export type TestPosition = { id: string; fen: string; best: string[]; san: string; verify: string };

export const TACTICS: TestPosition[] = [
  { id: 'WAC.001', fen: '2rr3k/pp3pp1/1nnqbN1p/3pN3/2pP4/2P3Q1/PPB4P/R4RK1 w - - 0 1', best: ['g3g6'], san: 'Qg6', verify: 'd30 M2/816' },
  { id: 'WAC.003', fen: '5rk1/1ppb3p/p1pb4/6q1/3P1p1r/2P1R2P/PP1BQ1P1/5RKN w - - 0 1', best: ['e3g3'], san: 'Rg3', verify: 'd22 680/-282' },
  { id: 'WAC.004', fen: 'r1bq2rk/pp3pbp/2p1p1pQ/7P/3P4/2PB1N2/PP3PPR/2KR4 w - - 0 1', best: ['h6h7'], san: 'Qxh7+', verify: 'd35 M2/682' },
  { id: 'WAC.005', fen: '5k2/6pp/p1qN4/1p1p4/3P4/2PKP2Q/PP3r2/3R4 b - - 0 1', best: ['c6c4'], san: 'Qc4+', verify: 'd50 M2/0' },
  { id: 'WAC.006', fen: '7k/p7/1R5K/6r1/6p1/6P1/8/8 w - - 0 1', best: ['b6b7'], san: 'Rb7', verify: 'd32 9165/22' },
  { id: 'WAC.007', fen: 'rnbqkb1r/pppp1ppp/8/4P3/6n1/7P/PPPNPPP1/R1BQKBNR b KQkq - 0 1', best: ['g4e3'], san: 'Ne3', verify: 'd23 849/1' },
  { id: 'WAC.009', fen: '3q1rk1/p4pp1/2pb3p/3p4/6Pr/1PNQ4/P1PB1PP1/4RRK1 b - - 0 1', best: ['d6h2'], san: 'Bh2+', verify: 'd35 M5/-259' },
  { id: 'WAC.010', fen: '2br2k1/2q3rn/p2NppQ1/2p1P3/Pp5R/4P3/1P3PPP/3R2K1 w - - 0 1', best: ['h4h7'], san: 'Rxh7', verify: 'd21 674/-418' },
  { id: 'WAC.011', fen: 'r1b1kb1r/3q1ppp/pBp1pn2/8/Np3P2/5B2/PPP3PP/R2Q1RK1 w kq - 0 1', best: ['f3c6'], san: 'Bxc6', verify: 'd25 792/261' },
  { id: 'WAC.012', fen: '4k1r1/2p3r1/1pR1p3/3pP2p/3P2qP/P4N2/1PQ4P/5R1K b - - 0 1', best: ['g4f3'], san: 'Qxf3+', verify: 'd62 M2/0' },
  { id: 'WAC.013', fen: '5rk1/pp4p1/2n1p2p/2Npq3/2p5/6P1/P3P1BP/R4Q1K w - - 0 1', best: ['f1f8'], san: 'Qxf8+', verify: 'd21 354/-88' },
  { id: 'WAC.014', fen: 'r2rb1k1/pp1q1p1p/2n1p1p1/2bp4/5P2/PP1BPR1Q/1BPN2PP/R5K1 w - - 0 1', best: ['h3h7'], san: 'Qxh7+', verify: 'd26 M4/863' },
  { id: 'WAC.015', fen: '1R6/1brk2p1/4p2p/p1P1Pp2/P7/6P1/1P4P1/2R3K1 w - - 0 1', best: ['b8b7'], san: 'Rxb7', verify: 'd33 993/830' },
  { id: 'WAC.016', fen: 'r4rk1/ppp2ppp/2n5/2bqp3/8/P2PB3/1PP1NPPP/R2Q1RK1 w - - 0 1', best: ['e2c3'], san: 'Nc3', verify: 'd17 648/-2' },
  { id: 'WAC.018', fen: 'R7/P4k2/8/8/8/8/r7/6K1 w - - 0 1', best: ['a8h8'], san: 'Rh8', verify: 'd56 M23/0' },
  { id: 'WAC.019', fen: 'r1b2rk1/ppbn1ppp/4p3/1QP4q/3P4/N4N2/5PPP/R1B2RK1 w - - 0 1', best: ['c5c6'], san: 'c6', verify: 'd22 333/-28' },
  { id: 'WAC.020', fen: 'r2qkb1r/1ppb1ppp/p7/4p3/P1Q1P3/2P5/5PPP/R1B2KNR b kq - 0 1', best: ['d7b5'], san: 'Bb5', verify: 'd25 973/911' },
  { id: 'WAC.021', fen: '5rk1/1b3p1p/pp3p2/3n1N2/1P6/P1qB1PP1/3Q3P/4R1K1 w - - 0 1', best: ['d2h6'], san: 'Qh6', verify: 'd25 884/447' },
  { id: 'WAC.022', fen: 'r1bqk2r/ppp1nppp/4p3/n5N1/2BPp3/P1P5/2P2PPP/R1BQK2R w KQkq - 0 1', best: ['c4a2', 'g5f7'], san: 'Ba2 Nxf7', verify: 'd21 125/9' },
  { id: 'WAC.023', fen: 'r3nrk1/2p2p1p/p1p1b1p1/2NpPq2/3R4/P1N1Q3/1PP2PPP/4R1K1 w - - 0 1', best: ['g2g4'], san: 'g4', verify: 'd25 767/637' },
  { id: 'WAC.024', fen: '6k1/1b1nqpbp/pp4p1/5P2/1PN5/4Q3/P5PP/1B2B1K1 b - - 0 1', best: ['g7d4'], san: 'Bd4', verify: 'd24 894/133' },
  { id: 'WAC.025', fen: '3R1rk1/8/5Qpp/2p5/2P1p1q1/P3P3/1P2PK2/8 b - - 0 1', best: ['g4h4'], san: 'Qh4+', verify: 'd20 945/-614' },
  { id: 'WAC.026', fen: '3r2k1/1p1b1pp1/pq5p/8/3NR3/2PQ3P/PP3PP1/6K1 b - - 0 1', best: ['d7f5'], san: 'Bf5', verify: 'd21 565/16' },
  { id: 'WAC.027', fen: '7k/pp4np/2p3p1/3pN1q1/3P4/Q7/1r3rPP/2R2RK1 w - - 0 1', best: ['a3f8'], san: 'Qf8+', verify: 'd55 M2/0' },
  { id: 'WAC.028', fen: '1r1r2k1/4pp1p/2p1b1p1/p3R3/RqBP4/4P3/1PQ2PPP/6K1 b - - 0 1', best: ['b4e1'], san: 'Qe1+', verify: 'd26 708/3' },
  { id: 'WAC.029', fen: 'r2q2k1/pp1rbppp/4pn2/2P5/1P3B2/6P1/P3QPBP/1R3RK1 w - - 0 1', best: ['c5c6'], san: 'c6', verify: 'd20 528/115' },
  { id: 'WAC.030', fen: '1r3r2/4q1kp/b1pp2p1/5p2/pPn1N3/6P1/P3PPBP/2QRR1K1 w - - 0 1', best: ['e4d6'], san: 'Nxd6', verify: 'd23 136/93' },
  { id: 'WAC.032', fen: '6k1/p4p1p/1p3np1/2q5/4p3/4P1N1/PP3PPP/3Q2K1 w - - 0 1', best: ['d1d8'], san: 'Qd8+', verify: 'd21 502/18' },
  { id: 'WAC.033', fen: '8/p1q2pkp/2Pr2p1/8/P3Q3/6P1/5P1P/2R3K1 w - - 0 1', best: ['e4e5', 'e4f4'], san: 'Qe5+ Qf4', verify: 'd27 844/812' },
  { id: 'WAC.034', fen: '7k/1b1r2p1/p6p/1p2qN2/3bP3/3Q4/P5PP/1B1R3K b - - 0 1', best: ['d4g1'], san: 'Bg1', verify: 'd21 659/-581' },
  { id: 'WAC.035', fen: 'r3r2k/2R3pp/pp1q1p2/8/3P3R/7P/PP3PP1/3Q2K1 w - - 0 1', best: ['h4h7'], san: 'Rxh7+', verify: 'd33 M4/229' },
  { id: 'WAC.036', fen: '3r4/2p1rk2/1pQq1pp1/7p/1P1P4/P4P2/6PP/R1R3K1 b - - 0 1', best: ['e7e1'], san: 'Re1+', verify: 'd15 725/25' },
  { id: 'WAC.037', fen: '2r5/2rk2pp/1pn1pb2/pN1p4/P2P4/1N2B3/nPR1KPPP/3R4 b - - 0 1', best: ['c6d4'], san: 'Nxd4+', verify: 'd20 313/1' },
  { id: 'WAC.038', fen: '4k3/p4prp/1p6/2b5/8/2Q3P1/P2R1PKP/4q3 w - - 0 1', best: ['c3d3', 'd2d8'], san: 'Qd3 Rd8+', verify: 'd22 527/365' },
  { id: 'WAC.039', fen: 'r1br2k1/pp2bppp/2nppn2/8/2P1PB2/2N2P2/PqN1B1PP/R2Q1R1K w - - 0 1', best: ['c3a4'], san: 'Na4', verify: 'd19 684/-10' },
  { id: 'WAC.040', fen: '3r1r1k/1p4pp/p4p2/8/1PQR4/6Pq/P3PP2/2R3K1 b - - 0 1', best: ['d8c8'], san: 'Rc8', verify: 'd18 771/0' },
  { id: 'WAC.041', fen: '1k6/5RP1/1P6/1K6/6r1/8/8/8 w - - 0 1', best: ['b5a5', 'b5c5', 'b6b7'], san: 'Ka5 Kc5 b7', verify: 'd68 M12/M14' },
  { id: 'WAC.042', fen: 'r1b1r1k1/pp1n1pbp/1qp3p1/3p4/1B1P4/Q3PN2/PP2BPPP/R4RK1 w - - 0 1', best: ['b4a5'], san: 'Ba5', verify: 'd21 716/-14' },
  { id: 'WAC.043', fen: 'r2q3k/p2P3p/1p3p2/3QP1r1/8/B7/P5PP/2R3K1 w - - 0 1', best: ['a3e7', 'd5a8'], san: 'Be7 Qxa8', verify: 'd27 1733/1449' },
  { id: 'WAC.044', fen: '3rb1k1/pq3pbp/4n1p1/3p4/2N5/2P2QB1/PP3PPP/1B1R2K1 b - - 0 1', best: ['d5c4'], san: 'dxc4', verify: 'd18 527/24' },
  { id: 'WAC.045', fen: '7k/2p1b1pp/8/1p2P3/1P3r2/2P3Q1/1P5P/R4qBK b - - 0 1', best: ['f1a1'], san: 'Qxa1', verify: 'd23 910/0' },
  { id: 'WAC.046', fen: 'r1bqr1k1/pp1nb1p1/4p2p/3p1p2/3P4/P1N1PNP1/1PQ2PP1/3RKB1R w K - 0 1', best: ['c3b5'], san: 'Nb5', verify: 'd19 295/179' },
  { id: 'WAC.047', fen: 'r1b2rk1/pp2bppp/2n1pn2/q5B1/2BP4/2N2N2/PP2QPPP/2R2RK1 b - - 0 1', best: ['c6d4'], san: 'Nxd4', verify: 'd20 134/-10' },
  { id: 'WAC.048', fen: '1rbq1rk1/p1p1bppp/2p2n2/8/Q1BP4/2N5/PP3PPP/R1B2RK1 b - - 0 1', best: ['b8b4'], san: 'Rb4', verify: 'd20 620/23' },
  { id: 'WAC.049', fen: '2b3k1/4rrpp/p2p4/2pP2RQ/1pP1Pp1N/1P3P1P/1q6/6RK w - - 0 1', best: ['h5h7'], san: 'Qxh7+', verify: 'd33 M6/541' },
  { id: 'WAC.050', fen: 'k4r2/1R4pb/1pQp1n1p/3P4/5p1P/3P2P1/r1q1R2K/8 w - - 0 1', best: ['b7b6'], san: 'Rxb6+', verify: 'd41 M3/444' },
  { id: 'BK.01', fen: '1k1r4/pp1b1R2/3q2pp/4p3/2B5/4Q3/PPP2B2/2K5 b - - 0 1', best: ['d6d1'], san: 'Qd1+', verify: 'd23 M3/-695' },
  { id: 'BK.02', fen: '3r1k2/4npp1/1ppr3p/p6P/P2PPPP1/1NR5/5K2/2R5 w - - 0 1', best: ['d4d5'], san: 'd5', verify: 'd17 251/94' },
  { id: 'BK.04', fen: 'rnbqkb1r/p3pppp/1p6/2ppP3/3N4/2P5/PPP1QPPP/R1B1KB1R w KQkq - 0 1', best: ['e5e6'], san: 'e6', verify: 'd20 218/17' },
  { id: 'BK.05', fen: 'r1b2rk1/2q1b1pp/p2ppn2/1p6/3QP3/1BN1B3/PPP3PP/R4RK1 w - - 0 1', best: ['c3d5', 'a2a4'], san: 'Nd5 a4', verify: 'd20 173/62' },
  { id: 'BK.06', fen: '2r3k1/pppR1pp1/4p3/4P1P1/5P2/1P4K1/P1P5/8 w - - 0 1', best: ['g5g6'], san: 'g6', verify: 'd21 347/32' },
  { id: 'BK.08', fen: '4b3/p3kp2/6p1/3pP2p/2pP1P2/4K1P1/P3N2P/8 w - - 0 1', best: ['f4f5'], san: 'f5', verify: 'd24 111/14' },
  { id: 'BK.10', fen: '3rr1k1/pp3pp1/1qn2np1/8/3p4/PP1R1P2/2P1NQPP/R1B3K1 b - - 0 1', best: ['c6e5'], san: 'Ne5', verify: 'd17 630/64' },
  { id: 'BK.12', fen: 'r3r1k1/ppqb1ppp/8/4p1NQ/8/2P5/PP3PPP/R3R1K1 b - - 0 1', best: ['d7f5'], san: 'Bf5', verify: 'd18 0/-556' },
  { id: 'BK.13', fen: 'r2q1rk1/4bppp/p2p4/2pP4/3pP3/3Q4/PP1B1PPP/R3R1K1 w - - 0 1', best: ['b2b4'], san: 'b4', verify: 'd22 50/-11' },
  { id: 'BK.14', fen: 'rnb2r1k/pp2p2p/2pp2p1/q2P1p2/8/1Pb2NP1/PB2PPBP/R2Q1RK1 w - - 0 1', best: ['d1d2', 'd1e1'], san: 'Qd2 Qe1', verify: 'd21 772/721' },
  { id: 'BK.15', fen: '2r3k1/1p2q1pp/2b1pr2/p1pp4/6Q1/1P1PP1R1/P1PN2PP/5RK1 w - - 0 1', best: ['g4g7'], san: 'Qxg7+', verify: 'd22 161/14' },
  { id: 'BK.16', fen: 'r1bqkb1r/4npp1/p1p4p/1p1pP1B1/8/1B6/PPPN1PPP/R2Q1RK1 w kq - 0 1', best: ['d2e4'], san: 'Ne4', verify: 'd21 238/37' },
  { id: 'BK.19', fen: '3rr3/2pq2pk/p2p1pnp/8/2QBPP2/1P6/P5PP/4RRK1 b - - 0 1', best: ['e8e4'], san: 'Rxe4', verify: 'd21 195/6' },
  { id: 'BK.20', fen: 'r4k2/pb2bp1r/1p1qp2p/3pNp2/3P1P2/2N3P1/PPP1Q2P/2KRR3 w - - 0 1', best: ['g3g4'], san: 'g4', verify: 'd18 445/386' },
  { id: 'BK.21', fen: '3rn2k/ppb2rpp/2ppqp2/5N2/2P1P3/1P5Q/PB3PPP/3RR1K1 w - - 0 1', best: ['f5h6'], san: 'Nh6', verify: 'd17 453/273' },
  { id: 'BK.22', fen: '2r2rk1/1bqnbpp1/1p1ppn1p/pP6/N1P1P3/P2B1N1P/1B2QPP1/R2R2K1 b - - 0 1', best: ['b7e4'], san: 'Bxe4', verify: 'd21 86/5' },
];

/** Rejected candidates and why (kept for transparency). */
export const REJECTED: [string, string][] = [['WAC.002', 'engine disagrees'], ['WAC.008', 'ambiguous margin 2'], ['WAC.031', 'engine disagrees'], ['BK.03', 'engine disagrees'], ['BK.07', 'engine disagrees'], ['BK.09', 'engine disagrees'], ['BK.11', 'ambiguous margin 0'], ['BK.17', 'engine disagrees'], ['BK.18', 'ambiguous margin 10'], ['BK.23', 'ambiguous margin 0'], ['BK.24', 'ambiguous margin 24']];

export type EndgamePosition = { id: string; fen: string; expect: 'win' | 'draw'; note: string; verify: string };

/**
 * Endgame suite. The side to move is the tested side. Theoretical results are
 * textbook; the Stockfish 19 full-net check (4 threads, 8 s, no tablebases) is
 * recorded in `verify`. KBNK is a known hard case for engines without tablebases.
 */
export const ENDGAMES: EndgamePosition[] = [
  { id: 'KQK', fen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1', expect: 'win', note: 'queen mate', verify: 'mate 7 (d103)' },
  { id: 'KRK', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', expect: 'win', note: 'rook mate', verify: 'mate 15 (d64)' },
  { id: 'KBBK', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', expect: 'win', note: 'two bishops', verify: '+91.65 (d25)' },
  { id: 'KBNK', fen: '8/8/8/4k3/8/8/8/1N2KB2 w - - 0 1', expect: 'win', note: 'bishop + knight (≤33 moves with perfect play)', verify: '+1.98 (d32) — engine does not see the mate' },
  { id: 'KPK-6th', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', expect: 'win', note: 'king on the 6th in front of the pawn', verify: 'mate 11 (d106)' },
  { id: 'KPK-opposition', fen: '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1', expect: 'draw', note: 'defender has the opposition; attacker to move cannot win', verify: '0.00 (d64)' },
  { id: 'Lucena', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', expect: 'win', note: 'building the bridge', verify: '+8.65 (d36)' },
  { id: 'Philidor', fen: '4k3/R7/1r6/4PK2/8/8/8/8 b - - 0 1', expect: 'draw', note: 'third-rank defence (tested side defends)', verify: '0.00 (d68)' },
];
