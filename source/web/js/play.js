// Play: legal chess against Stockfish (lite, Web Worker) at eight honest levels.
import * as store from './store.js';
import * as data from './data.js';
import { GameBoard, Chess } from './chess-ui.js';
import { engine, levelMove, LEVELS } from './engine.js';
import { addGame, exportPgn, START_FEN } from './library.js';
import { h, pageHead, toast, downloadFile, confirmDialog } from './ui.js';

const CLOCKS = [
  { key: 'off', label: 'Untimed' },
  { key: '10+0', label: '10 min', base: 600, inc: 0 },
  { key: '15+10', label: '15 + 10', base: 900, inc: 10 },
  { key: '30+0', label: '30 min', base: 1800, inc: 0 },
];

export function renderPlay(main, params, query) {
  const s = store.get();
  if (s.playState && !s.playState.result && !query.fen && query.new !== '1') return gameScreen(main);
  return setupScreen(main, query);
}

function setupScreen(main, query) {
  const s = store.get();
  const page = h('div', { class: 'page narrow' });
  page.appendChild(pageHead('Play', 'A slow, careful game is the best test of what you have learned. Use the checklist on every move.'));
  if (s.playState && s.playState.result) {
    page.appendChild(h('p', { class: 'notice' }, `Last game: ${s.playState.result} (${s.playState.reason}). `, s.playState.savedId ? h('a', { href: `#/games/${s.playState.savedId}` }, 'Analyse it') : null));
  }
  let level = Number(query.level || s.settings.playLevel || 3);
  let color = query.color || s.settings.playColor || 'w';
  let clock = 'off';
  let fen = query.fen || '';

  const levels = h('div', { class: 'levels', role: 'radiogroup', 'aria-label': 'Opponent level' });
  for (const L of LEVELS) {
    const id = 'lvl-' + L.n;
    levels.appendChild(h('label', { class: 'level', for: id },
      h('input', { type: 'radio', name: 'level', id, value: L.n, checked: L.n === level, onchange: () => { level = L.n; } }),
      h('span', { class: 'level-n' }, `Level ${L.n}`), h('span', { class: 'level-name' }, L.name), h('span', { class: 'level-desc' }, L.desc)));
  }
  const colorSel = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Your colour' },
    ...[['w', 'White'], ['b', 'Black'], ['r', 'Random']].map(([v, l]) => h('label', null,
      h('input', { type: 'radio', name: 'color', value: v, checked: color === v, onchange: () => { color = v; } }), h('span', null, l))));
  const clockSel = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Clock' },
    ...CLOCKS.map((c) => h('label', null, h('input', { type: 'radio', name: 'clock', value: c.key, checked: c.key === clock, onchange: () => { clock = c.key; } }), h('span', null, c.label))));
  const fenInput = h('input', { type: 'text', id: 'start-fen', class: 'wide', value: fen, placeholder: 'Leave empty for the normal starting position', autocomplete: 'off', spellcheck: 'false' });
  const fenMsg = h('p', { class: 'small muted', 'aria-live': 'polite' });

  // practice against your mistakes
  const mistakes = [];
  for (const j of s.journal.slice(0, 12)) mistakes.push({ fen: j.fen, label: `Journal · ${j.played} (${j.category})` });
  for (const [id, e] of Object.entries(s.ex)) {
    if (e.last === 'fail' && data.exercise(id)) mistakes.push({ fen: data.exercise(id).fen, label: `Missed exercise ${data.exercise(id).label || id}` });
    if (mistakes.length > 24) break;
  }
  const mistakesBox = mistakes.length ? h('details', { class: 'mistakes' }, h('summary', null, `Practise against your mistakes (${mistakes.length})`),
    h('ul', { class: 'plain' }, mistakes.map((m) => h('li', null, h('button', { type: 'button', class: 'linkish', onclick: () => {
      fenInput.value = m.fen;
      const turn = m.fen.split(' ')[1];
      color = turn; colorSel.querySelector(`input[value="${turn}"]`).checked = true;
      fenMsg.textContent = 'Position loaded: you play the side to move.';
    } }, m.label))))) : null;

  const startBtn = h('button', { class: 'btn primary', type: 'button', id: 'start-game' }, 'Start game');
  startBtn.addEventListener('click', () => {
    let start = fenInput.value.trim() || START_FEN;
    try { new Chess(start); } catch (e) { fenMsg.textContent = 'That FEN is not a legal position: ' + e.message; return; }
    const c = color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    const ck = CLOCKS.find((x) => x.key === clock);
    store.update((st) => {
      st.settings.playLevel = level;
      st.settings.playColor = color;
      st.playState = { id: store.uid('p'), level, color: c, startFen: start, sans: [], started: new Date().toISOString(), result: null,
        clock: ck.base ? { base: ck.base, inc: ck.inc, w: ck.base * 1000, b: ck.base * 1000 } : null };
    });
    location.hash = '#/play';
  });
  page.append(
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Opponent'), levels,
      h('p', { class: 'small muted' }, 'Levels describe how the engine plays, not a rating. Only games against people measure your rating.')),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Your colour'), colorSel, h('h2', { class: 'card-title mt' }, 'Clock'), clockSel),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Start position'), h('label', { for: 'start-fen', class: 'small' }, 'FEN (optional)'), fenInput, fenMsg, mistakesBox),
    h('div', { class: 'row' }, startBtn));
  main.appendChild(page);
  engine.start().catch(() => {});
}

function gameScreen(main) {
  const st = store.get().playState;
  const page = h('div', { class: 'page play-page' });
  const boardCol = h('div', { class: 'play-board' });
  const side = h('div', { class: 'play-side' });
  page.append(boardCol, side);
  main.appendChild(page);
  const L = LEVELS.find((l) => l.n === st.level) || LEVELS[2];
  let thinking = false;
  let destroyed = false;
  let timer = null;
  const gb = new GameBoard(boardCol, {
    fen: st.startFen, orientation: st.color === 'w' ? 'white' : 'black',
    movable: (c) => c === st.color && !thinking && !st.result,
    onMove: () => afterMove(true), label: 'Game board',
  });
  for (const san of st.sans) gb.chess.move(san);
  gb.sync(undefined, false);

  const status = h('p', { class: 'play-status', id: 'play-status', role: 'status', 'aria-live': 'polite' });
  const clockEls = st.clock ? { w: h('span', { class: 'clock', id: 'clock-w' }), b: h('span', { class: 'clock', id: 'clock-b' }) } : null;
  const moves = h('ol', { class: 'movelist', id: 'play-moves', 'aria-label': 'Moves' });
  const btn = (label, id, fn, cls = 'btn ghost small') => h('button', { class: cls, type: 'button', id, onclick: fn }, label);
  const controls = h('div', { class: 'row wrap' },
    btn('Takeback', 'btn-takeback', takeback), btn('Flip board', 'btn-flip', () => gb.flip()),
    btn('Resign', 'btn-resign', resign), btn('Export PGN', 'btn-pgn', () => downloadFile('elo-blueprint-game.pgn', pgn(), 'application/x-chess-pgn')),
    btn('New game', 'btn-new', newGame));
  const after = h('div', { class: 'after', id: 'play-after' });
  side.append(h('p', { class: 'opp' }, h('strong', null, `Level ${L.n} · ${L.name}`), h('span', { class: 'muted small' }, ` — ${L.desc}`)),
    clockEls ? h('div', { class: 'clocks' }, h('span', null, 'White ', clockEls.w), h('span', null, 'Black ', clockEls.b)) : null,
    status, controls, moves, after);

  function persist() {
    store.update((s) => { s.playState.sans = gb.chess.history(); });
  }

  function renderMoves() {
    moves.innerHTML = '';
    const hist = gb.chess.history();
    const startBlack = (st.startFen.split(' ')[1] || 'w') === 'b';
    const startNo = Number(st.startFen.split(' ')[5] || 1);
    let li = null;
    hist.forEach((san, i) => {
      const idx = i + (startBlack ? 1 : 0);
      if (idx % 2 === 0 || !li) {
        li = h('li', { value: startNo + Math.floor(idx / 2) });
        if (idx % 2 === 1) li.appendChild(h('span', { class: 'mv' }, '…'));
        moves.appendChild(li);
      }
      li.appendChild(h('span', { class: 'mv' }, san));
    });
    moves.scrollTop = moves.scrollHeight;
  }

  function endReason(c) {
    if (c.isCheckmate()) return { result: c.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' };
    if (c.isStalemate()) return { result: '1/2-1/2', reason: 'stalemate' };
    if (c.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'threefold repetition' };
    if (c.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'insufficient material' };
    if (c.isDrawByFiftyMoves()) return { result: '1/2-1/2', reason: '50-move rule' };
    return null;
  }

  function updateStatus() {
    const c = gb.chess;
    if (st.result) { status.textContent = `Game over: ${st.result} — ${st.reason}.`; return; }
    const yours = c.turn() === st.color;
    status.textContent = thinking ? 'Engine is thinking…' : yours ? (c.inCheck() ? 'Check! Your move.' : 'Your move.') : 'Engine to move.';
  }

  function pgn() {
    const res = st.result || '*';
    const you = 'You', eng = `Engine level ${st.level}`;
    return exportPgn({ Event: 'Elo Blueprint training game', Site: 'The Elo Blueprint Interactive', Date: store.today().replace(/-/g, '.'),
      White: st.color === 'w' ? you : eng, Black: st.color === 'w' ? eng : you }, st.startFen, gb.chess.history(), res);
  }

  function finishGame(result, reason) {
    st.result = result; st.reason = reason;
    const you = 'You', eng = `Engine level ${st.level}`;
    const g = addGame({ source: 'play', white: st.color === 'w' ? you : eng, black: st.color === 'w' ? eng : you, result,
      startFen: st.startFen, sans: gb.chess.history(), pgn: pgn(), level: st.level, userColor: st.color, reason,
      event: 'Training game vs engine' });
    store.update((s) => { s.playState = Object.assign({}, st, { savedId: g.id }); });
    stopClock();
    updateStatus();
    after.innerHTML = '';
    after.append(h('p', { class: 'fb-head' }, resultText(result, reason)),
      h('div', { class: 'row wrap' }, h('a', { class: 'btn primary', href: `#/games/${g.id}`, id: 'analyse-game' }, 'Analyse this game'), h('a', { class: 'btn ghost', href: '#/play?new=1' }, 'New game')),
      h('p', { class: 'small muted' }, 'Analyse it yourself first: tag your mistakes, then run the engine review.'));
  }

  function resultText(result, reason) {
    const youWin = (result === '1-0' && st.color === 'w') || (result === '0-1' && st.color === 'b');
    if (result === '1/2-1/2') return `Draw by ${reason}.`;
    return youWin ? `You won by ${reason}.` : `You lost by ${reason}.`;
  }

  async function afterMove(user) {
    persist();
    renderMoves();
    if (st.clock && user) addIncrement(st.color);
    const end = endReason(gb.chess);
    if (end) return finishGame(end.result, end.reason);
    if (gb.chess.turn() !== st.color) await engineMove();
    updateStatus();
  }

  async function engineMove() {
    thinking = true;
    updateStatus();
    const fenAt = gb.chess.fen();
    let uci = null;
    try {
      const t0 = performance.now();
      uci = await levelMove(fenAt, st.level);
      const wait = 350 - (performance.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    } catch (e) {
      thinking = false;
      status.textContent = 'The engine could not start: ' + e.message;
      return;
    }
    if (destroyed || gb.chess.fen() !== fenAt || st.result) { thinking = false; return; }
    thinking = false;
    const m = uci && gb.play(uci);
    if (!m) { status.textContent = 'The engine returned no move.'; return; }
    if (st.clock) addIncrement(st.color === 'w' ? 'b' : 'w');
    persist();
    renderMoves();
    const end = endReason(gb.chess);
    if (end) return finishGame(end.result, end.reason);
    updateStatus();
  }

  function takeback() {
    if (thinking || st.result) return;
    const c = gb.chess;
    if (!c.history().length) return;
    gb.undo();
    if (c.turn() !== st.color && c.history().length) gb.undo();
    if (c.turn() !== st.color) { persist(); renderMoves(); engineMove(); return; }
    persist();
    renderMoves();
    updateStatus();
  }

  async function resign() {
    if (st.result) return;
    if (!(await confirmDialog('Resign?', 'The game is saved to your library so you can analyse it.', 'Resign', true))) return;
    finishGame(st.color === 'w' ? '0-1' : '1-0', 'resignation');
  }

  async function newGame() {
    if (!st.result && gb.chess.history().length && !(await confirmDialog('Abandon this game?', 'The current game will not be saved.', 'Abandon', true))) return;
    store.update((s) => { s.playState = null; });
    location.hash = '#/play?new=1';
  }

  // clocks
  let lastTick = null;
  function addIncrement(c) { if (st.clock) { st.clock[c] += st.clock.inc * 1000; store.update((s) => { s.playState.clock = st.clock; }); } }
  function fmt(ms) { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }
  function tick() {
    if (!st.clock || st.result) return;
    const now = performance.now();
    if (lastTick !== null && gb.chess.history().length) {
      const turn = gb.chess.turn();
      st.clock[turn] -= now - lastTick;
      if (st.clock[turn] <= 0) {
        st.clock[turn] = 0;
        const mat = new Chess(gb.chess.fen());
        finishGame(turn === 'w' ? '0-1' : '1-0', 'timeout');
        void mat;
      }
    }
    lastTick = now;
    clockEls.w.textContent = fmt(st.clock.w);
    clockEls.b.textContent = fmt(st.clock.b);
    clockEls.w.classList.toggle('on', gb.chess.turn() === 'w');
    clockEls.b.classList.toggle('on', gb.chess.turn() === 'b');
  }
  function stopClock() { if (timer) clearInterval(timer); timer = null; }
  if (st.clock) { tick(); timer = setInterval(() => { tick(); if (Math.random() < 0.1) store.update((s) => { if (s.playState) s.playState.clock = st.clock; }); }, 250); }

  renderMoves();
  updateStatus();
  engine.start().catch((e) => { status.textContent = 'The engine could not start: ' + e.message; });
  if (!st.result && gb.chess.turn() !== st.color) {
    const end = endReason(gb.chess);
    if (end) finishGame(end.result, end.reason); else engineMove();
  }
  return () => { destroyed = true; stopClock(); engine.stop(); };
}

export { toast };
