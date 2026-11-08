import { Chess, type Move, type Square, type PieceSymbol, type Color } from 'chess.js';

/**
 * Authoritative chess state. chess.js provides legal move generation, SAN,
 * FEN and PGN. This layer adds FIDE game-ending semantics that chess.js
 * models differently:
 *   - threefold repetition and the fifty-move rule are CLAIMABLE draws
 *     (chess.js treats them as automatic),
 *   - fivefold repetition and the seventy-five-move rule end the game
 *     automatically (FIDE Laws 9.6),
 *   - flag-fall against a lone king / insufficient material is a draw (6.9).
 */

export type ResultCode = '1-0' | '0-1' | '1/2-1/2' | '*';
export type Termination =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient-material'
  | 'fivefold-repetition'
  | 'seventy-five-move'
  | 'threefold-claim'
  | 'fifty-move-claim'
  | 'agreement'
  | 'resignation'
  | 'timeout'
  | 'timeout-insufficient'
  | 'abandoned'
  | 'ongoing';

export type DrawClaim = 'threefold' | 'fifty';

export type GameStatus = {
  over: boolean;
  result: ResultCode;
  termination: Termination;
  claimable: DrawClaim[];
  inCheck: boolean;
};

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Position identity for repetition: placement, side to move, castling, legal e.p. square. */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export type UciMove = string; // e2e4, e7e8q

export function moveToUci(m: Pick<Move, 'from' | 'to' | 'promotion'>): UciMove {
  return m.from + m.to + (m.promotion ?? '');
}

export function parseUci(uci: string): { from: Square; to: Square; promotion?: PieceSymbol } {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: (uci.length > 4 ? uci[4] : undefined) as PieceSymbol | undefined,
  };
}

export class ChessGame {
  readonly chess: Chess;
  readonly startFen: string;
  private counts = new Map<string, number>();
  private keyHistory: string[] = [];
  private forced: { result: ResultCode; termination: Termination } | null = null;
  uciHistory: UciMove[] = [];

  constructor(startFen: string = START_FEN) {
    this.startFen = startFen;
    this.chess = new Chess(startFen);
    this.pushKey();
  }

  static fromUci(moves: readonly string[], startFen: string = START_FEN): ChessGame {
    const g = new ChessGame(startFen);
    for (const m of moves) {
      if (!g.playUci(m)) throw new Error(`Illegal move in record: ${m}`);
    }
    return g;
  }

  private pushKey() {
    const k = positionKey(this.chess.fen());
    this.keyHistory.push(k);
    this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
  }

  fen(): string {
    return this.chess.fen();
  }
  turn(): Color {
    return this.chess.turn();
  }
  ply(): number {
    return this.uciHistory.length;
  }

  legalMoves(square?: Square): Move[] {
    return square ? this.chess.moves({ square, verbose: true }) : this.chess.moves({ verbose: true });
  }

  isLegal(uci: string): boolean {
    if (this.status().over) return false;
    const p = parseUci(uci);
    return this.legalMoves(p.from).some(
      (m) => m.to === p.to && (m.promotion ?? undefined) === (p.promotion ?? undefined),
    );
  }

  /** Play a move in UCI notation. Returns the Move or null if illegal / game over. */
  playUci(uci: string): Move | null {
    if (this.status().over) return null;
    const p = parseUci(uci);
    let mv: Move;
    try {
      mv = this.chess.move({ from: p.from, to: p.to, promotion: p.promotion });
    } catch {
      return null;
    }
    this.uciHistory.push(moveToUci(mv));
    this.pushKey();
    return mv;
  }

  playSan(san: string): Move | null {
    if (this.status().over) return null;
    let mv: Move;
    try {
      mv = this.chess.move(san);
    } catch {
      return null;
    }
    this.uciHistory.push(moveToUci(mv));
    this.pushKey();
    return mv;
  }

  undo(): Move | null {
    if (this.uciHistory.length === 0) return null;
    const k = this.keyHistory.pop()!;
    this.counts.set(k, (this.counts.get(k) ?? 1) - 1);
    this.uciHistory.pop();
    this.forced = null;
    return this.chess.undo();
  }

  repetitionCount(): number {
    return this.counts.get(positionKey(this.chess.fen())) ?? 0;
  }

  halfmoveClock(): number {
    return Number(this.chess.fen().split(' ')[4]);
  }

  status(): GameStatus {
    const inCheck = this.chess.isCheck();
    if (this.forced) return { over: true, ...this.forced, claimable: [], inCheck };
    const loser = this.chess.turn();
    if (this.chess.isCheckmate()) {
      return { over: true, result: loser === 'w' ? '0-1' : '1-0', termination: 'checkmate', claimable: [], inCheck };
    }
    if (this.chess.isStalemate()) return draw('stalemate', inCheck);
    if (this.chess.isInsufficientMaterial()) return draw('insufficient-material', inCheck);
    if (this.repetitionCount() >= 5) return draw('fivefold-repetition', inCheck);
    if (this.halfmoveClock() >= 150) return draw('seventy-five-move', inCheck);
    const claimable: DrawClaim[] = [];
    if (this.repetitionCount() >= 3) claimable.push('threefold');
    if (this.halfmoveClock() >= 100) claimable.push('fifty');
    return { over: false, result: '*', termination: 'ongoing', claimable, inCheck };
  }

  claimDraw(kind: DrawClaim): boolean {
    const s = this.status();
    if (s.over || !s.claimable.includes(kind)) return false;
    this.forced = { result: '1/2-1/2', termination: kind === 'threefold' ? 'threefold-claim' : 'fifty-move-claim' };
    return true;
  }

  resign(color: Color) {
    if (this.status().over) return;
    this.forced = { result: color === 'w' ? '0-1' : '1-0', termination: 'resignation' };
  }

  agreeDraw() {
    if (this.status().over) return;
    this.forced = { result: '1/2-1/2', termination: 'agreement' };
  }

  abandon(color: Color) {
    if (this.status().over) return;
    this.forced = { result: color === 'w' ? '0-1' : '1-0', termination: 'abandoned' };
  }

  /** Flag fall for `color`. Draw if the opponent cannot possibly mate (FIDE 6.9, simplified). */
  flag(color: Color) {
    if (this.status().over) return;
    const opp: Color = color === 'w' ? 'b' : 'w';
    if (!canEverMate(this.chess, opp)) {
      this.forced = { result: '1/2-1/2', termination: 'timeout-insufficient' };
    } else {
      this.forced = { result: color === 'w' ? '0-1' : '1-0', termination: 'timeout' };
    }
  }

  pgn(headers: Record<string, string> = {}): string {
    const c = new Chess(this.startFen);
    if (this.startFen !== START_FEN) {
      c.setHeader('SetUp', '1');
      c.setHeader('FEN', this.startFen);
    }
    for (const [k, v] of Object.entries(headers)) c.setHeader(k, v);
    c.setHeader('Result', this.status().result);
    for (const u of this.uciHistory) c.move(parseUci(u));
    return c.pgn();
  }

  sanHistory(): string[] {
    return this.chess.history();
  }
}

function draw(termination: Termination, inCheck: boolean): GameStatus {
  return { over: true, result: '1/2-1/2', termination, claimable: [], inCheck };
}

/**
 * Conservative "could this side ever deliver mate" test used for flag-fall.
 * A side with only a king, or king + one minor piece, cannot force or even
 * help-mate in nearly all practical positions; anything else is treated as
 * sufficient. (K+N vs K+pawn helpmates exist; we follow common online
 * practice and treat lone minors as insufficient.)
 */
export function canEverMate(chess: Chess, color: Color): boolean {
  let minors = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color) continue;
      if (sq.type === 'p' || sq.type === 'r' || sq.type === 'q') return true;
      if (sq.type === 'n' || sq.type === 'b') minors++;
    }
  }
  return minors >= 2;
}

export function perft(chess: Chess, depth: number): number {
  if (depth === 0) return 1;
  const moves = chess.moves({ verbose: true });
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    chess.move(m);
    n += perft(chess, depth - 1);
    chess.undo();
  }
  return n;
}

/** Parse a PGN into a UCI move list + headers, validating legality. */
export function importPgn(pgn: string): { startFen: string; moves: UciMove[]; headers: Record<string, string> } {
  const c = new Chess();
  c.loadPgn(pgn);
  const headers = c.getHeaders() as Record<string, string>;
  const startFen = headers.FEN ?? START_FEN;
  const moves = c.history({ verbose: true }).map(moveToUci);
  return { startFen, moves, headers };
}

export function validateFen(fen: string): string | null {
  try {
    new Chess(fen);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function materialBalance(chess: Chess): number {
  let s = 0;
  for (const row of chess.board())
    for (const sq of row) if (sq) s += (sq.color === 'w' ? 1 : -1) * PIECE_VALUES[sq.type];
  return s;
}
