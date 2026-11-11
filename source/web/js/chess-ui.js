// Binds chess.js rules to the SVG board: legal moves only, promotion picker, SAN text input.
import { Chess } from '../vendor/chess.js';
import { Board } from './board.js';
import { h } from './ui.js';

export { Chess };

export function kingSquare(chess, color) {
  const b = chess.board();
  for (const row of b) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  return null;
}

export function checkSquare(chess) { return chess.inCheck() ? kingSquare(chess, chess.turn()) : null; }

// Lenient SAN parsing for typed input ("nf3", "0-0", "e8=q", "exd6 e.p.").
export function parseTypedMove(chess, text) {
  let t = String(text || '').trim().replace(/[!?]+$/, '').replace(/e\.?p\.?$/i, '').trim();
  if (!t) return null;
  t = t.replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O').replace(/^o-o-o$/i, 'O-O-O').replace(/^o-o$/i, 'O-O');
  const legal = chess.moves({ verbose: true });
  const norm = (s) => s.replace(/[+#]/g, '');
  const tries = [t, t.replace(/^([nbrqk])/, (c) => c.toUpperCase()), t.replace(/=?([qrbn])$/i, (_, p) => '=' + p.toUpperCase())];
  tries.push(tries[1].replace(/=?([qrbn])$/i, (_, p) => '=' + p.toUpperCase()));
  for (const c of tries) {
    const m = legal.find((x) => norm(x.san) === norm(c));
    if (m) return m;
  }
  // coordinate notation e2e4 / e7e8q
  const uci = t.toLowerCase().match(/^([a-h][1-8])-?([a-h][1-8])([qrbn])?$/);
  if (uci) {
    const m = legal.find((x) => x.from === uci[1] && x.to === uci[2] && (!x.promotion || x.promotion === (uci[3] || 'q')));
    if (m) return m;
  }
  return null;
}

export function uciToMove(chess, uci) {
  return chess.moves({ verbose: true }).find((m) => m.from === uci.slice(0, 2) && m.to === uci.slice(2, 4) && (!m.promotion || m.promotion === (uci[4] || 'q'))) || null;
}

export function sanFromUci(fen, uci) {
  try { const c = new Chess(fen); const m = uciToMove(c, uci); return m ? m.san : uci; } catch (_) { return uci; }
}

export function sanLine(fen, ucis, max = 8) {
  const c = new Chess(fen);
  const out = [];
  for (const u of ucis.slice(0, max)) {
    const m = uciToMove(c, u);
    if (!m) break;
    const moveNo = Number(c.fen().split(' ')[5]);
    const white = c.turn() === 'w';
    c.move(m);
    out.push((white ? moveNo + '.' : (out.length === 0 ? moveNo + '…' : '')) + m.san);
  }
  return out.join(' ');
}

/**
 * GameBoard: a board + chess.js game.
 * opts: fen, orientation, coords, movable ('w'|'b'|'both'|() => bool by color),
 *       onAttempt(move) -> true|false  (called after the move is applied; return false to undo it),
 *       onMove(move) after an accepted user move, typeInput (bool), label
 */
export class GameBoard {
  constructor(el, opts = {}) {
    this.opts = Object.assign({ movable: 'both', typeInput: true, coords: true }, opts);
    this.chess = new Chess(opts.fen || undefined);
    this.locked = false;
    this.wrap = h('div', { class: 'gameboard' });
    const boardEl = h('div', { class: 'board-host' });
    this.wrap.appendChild(boardEl);
    el.appendChild(this.wrap);
    this.board = new Board(boardEl, {
      interactive: true, orientation: opts.orientation || 'white', coords: this.opts.coords, label: opts.label || 'Chessboard',
      dests: (sq) => this.dests(sq),
      onMove: (from, to, info) => this.userMove(from, to, info),
      locked: () => this.locked,
    });
    if (this.opts.typeInput) this.buildTypeInput();
    this.sync(null, false);
  }

  canMoveColor(c) {
    const m = this.opts.movable;
    if (typeof m === 'function') return m(c);
    return m === 'both' || m === c;
  }

  dests(sq) {
    if (this.locked || this.chess.isGameOver()) return [];
    const p = this.chess.get(sq);
    if (!p || p.color !== this.chess.turn() || !this.canMoveColor(p.color)) return [];
    return [...new Set(this.chess.moves({ square: sq, verbose: true }).map((m) => m.to))];
  }

  async userMove(from, to) {
    const cands = this.chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!cands.length) return this.sync();
    let promotion;
    if (cands.some((m) => m.promotion)) {
      this.locked = true;
      promotion = await this.board.askPromotion(this.chess.turn());
      this.locked = false;
      if (!promotion) return this.sync(undefined, false);
    }
    this.tryMove({ from, to, promotion }, true);
  }

  tryMove(mv, fromBoard) {
    let move;
    try { move = this.chess.move(mv); } catch (_) { move = null; }
    if (!move) { this.sync(undefined, false); return null; }
    if (this.opts.onAttempt && this.opts.onAttempt(move) === false) {
      this.chess.undo();
      this.sync(undefined, false);
      this.shake();
      return null;
    }
    this.sync([move.from, move.to], !fromBoard || true);
    if (this.opts.onMove) this.opts.onMove(move);
    return move;
  }

  // programmatic move (engine / opponent reply / replay). Accepts SAN, uci or verbose object.
  play(mv, animate = true) {
    let move = null;
    try {
      if (typeof mv === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(mv)) move = this.chess.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] });
      else move = this.chess.move(mv);
    } catch (_) { move = null; }
    if (move) this.sync([move.from, move.to], animate);
    return move;
  }

  undo() {
    const m = this.chess.undo();
    const hist = this.chess.history({ verbose: true });
    const last = hist[hist.length - 1];
    this.sync(last ? [last.from, last.to] : null, true);
    return m;
  }

  load(fen, lastMove = null) {
    this.chess = new Chess(fen);
    this.sync(lastMove, false);
  }

  loadPgn(pgn) { this.chess = new Chess(); this.chess.loadPgn(pgn); this.sync(); }

  sync(lastMove, animate = true) {
    if (lastMove === undefined) {
      const hist = this.chess.history({ verbose: true });
      const last = hist[hist.length - 1];
      lastMove = last ? [last.from, last.to] : this.board.lastMove;
    }
    this.board.setPosition(this.chess.fen(), { lastMove, check: checkSquare(this.chess), animate });
    if (this.typeMsg) this.typeMsg.textContent = '';
  }

  shake() {
    this.wrap.classList.remove('shake');
    void this.wrap.offsetWidth;
    this.wrap.classList.add('shake');
  }

  buildTypeInput() {
    const id = 'type-' + Math.random().toString(36).slice(2, 7);
    const input = h('input', { id, class: 'type-move', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'e.g. Nf3 or e2e4', 'aria-describedby': id + '-msg' });
    this.typeMsg = h('span', { class: 'type-msg', id: id + '-msg', 'aria-live': 'polite' });
    const form = h('form', { class: 'type-form-inner', onsubmit: (e) => {
      e.preventDefault();
      if (this.locked) return;
      const m = parseTypedMove(this.chess, input.value);
      if (!m || !this.canMoveColor(this.chess.turn())) { this.typeMsg.textContent = m ? 'It is not your move.' : `“${input.value}” is not a legal move here.`; return; }
      input.value = '';
      this.tryMove({ from: m.from, to: m.to, promotion: m.promotion }, false);
    } }, h('label', { for: id }, 'Type a move'), input, h('button', { class: 'btn small', type: 'submit' }, 'Play'), this.typeMsg);
    const det = h('details', { class: 'type-form' }, h('summary', null, 'Type a move instead'), form);
    det.addEventListener('toggle', () => { if (det.open) input.focus(); });
    this.wrap.appendChild(det);
    this.typeInput = input;
    this.typeDetails = det;
  }

  setOrientation(o) { this.board.setOrientation(o); }
  flip() { this.board.flip(); }
}
