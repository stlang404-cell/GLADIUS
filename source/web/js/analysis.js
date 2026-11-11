// Engine review of games (classification + position-specific explanations) and the free analysis board.
import { Chess, GameBoard, sanLine, uciToMove } from './chess-ui.js';
import { engine, scoreCp, flip, fmtScore, winProb } from './engine.js';
import { positions } from './library.js';
import { h, pageHead, toast } from './ui.js';

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const CLASS_LABEL = { inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder' };

// Score object from White's point of view, given a side-to-move score.
function whitePov(score, fen) { return (fen.split(' ')[1] === 'w') ? score : flip(score); }
function forColor(scoreW, color) { return color === 'w' ? scoreW : flip(scoreW); }
const mateFor = (s) => (s.mate !== undefined && s.mate > 0) || (s.cp !== undefined && s.cp >= 99999);
const mateAgainst = (s) => (s.mate !== undefined && s.mate < 0) || (s.cp !== undefined && s.cp <= -99999);
const clampCp = (s) => Math.max(-1000, Math.min(1000, scoreCp(s)));

/**
 * Analyse every position of a game. opts: {depth, onProgress(i, n), cancel: {cancelled}}.
 * Returns review {depth, done, evals:[{s,b,pv}], flags:[...], summary}.
 */
export async function reviewGame(game, opts = {}) {
  const depth = opts.depth || 12;
  const pos = positions(game);
  const evals = [];
  await engine.start();
  for (let i = 0; i < pos.length; i++) {
    if (opts.cancel && opts.cancel.cancelled) return null;
    const fen = pos[i].fen;
    const c = new Chess(fen);
    if (c.isCheckmate()) evals.push({ s: { cp: c.turn() === 'w' ? -100000 : 100000 }, b: null, pv: [] });
    else if (c.isStalemate() || c.isInsufficientMaterial()) evals.push({ s: { cp: 0 }, b: null, pv: [] });
    else {
      const r = await engine.search(fen, { depth, multipv: 1, skill: 20 });
      const top = r.lines[0];
      evals.push({ s: whitePov(top ? top.score : { cp: 0 }, fen), b: r.bestmove, pv: top ? top.pv.slice(0, 8) : [] });
    }
    if (opts.onProgress) opts.onProgress(i + 1, pos.length);
  }
  if (opts.cancel && opts.cancel.cancelled) return null;
  return classify(game, pos, evals, depth);
}

export function classify(game, pos, evals, depth) {
  const flags = [];
  const sum = { w: { loss: 0, n: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, b: { loss: 0, n: 0, inaccuracy: 0, mistake: 0, blunder: 0 } };
  for (let i = 0; i < pos.length - 1; i++) {
    const p = pos[i];
    const color = p.color;
    const before = forColor(evals[i].s, color);
    const after = forColor(evals[i + 1].s, color);
    const loss = Math.max(0, clampCp(before) - clampCp(after));
    sum[color].loss += loss;
    sum[color].n += 1;
    if (evals[i].b && evals[i].b === p.uci) continue;
    const drop = winProb(before) - winProb(after);
    let cls = drop >= 0.15 ? 'blunder' : drop >= 0.10 ? 'mistake' : drop >= 0.05 ? 'inaccuracy' : null;
    const hadMate = mateFor(before);
    const stillMate = mateFor(after);
    const allowsMate = mateAgainst(after) && !mateAgainst(before);
    if (hadMate && !stillMate && !cls) cls = 'mistake';
    if (hadMate && !stillMate && cls === 'inaccuracy') cls = 'mistake';
    if (allowsMate) cls = 'blunder';
    if (!cls) continue;
    sum[color][cls] += 1;
    const ex = explain(p, evals[i], evals[i + 1], before, after, { hadMate, stillMate, allowsMate, loss, ply: i, total: pos.length - 1 });
    flags.push({ ply: i, color, san: p.san, uci: p.uci, fen: p.fen, best: evals[i].b, bestSan: evals[i].b ? sanOf(p.fen, evals[i].b) : null,
      bestLine: sanLine(p.fen, evals[i].pv || [], 6), cls, drop: Math.round(drop * 100) / 100, loss, before, after,
      expl: ex.text, cat: ex.cat, moveNo: p.moveNo });
  }
  const summary = {};
  for (const c of ['w', 'b']) {
    const x = sum[c];
    summary[c] = { acpl: x.n ? Math.round(x.loss / x.n) : 0, moves: x.n, inaccuracy: x.inaccuracy, mistake: x.mistake, blunder: x.blunder };
  }
  return { depth, done: true, at: new Date().toISOString(), evals, flags, summary };
}

function sanOf(fen, uci) {
  try { const c = new Chess(fen); const m = uciToMove(c, uci); return m ? m.san : uci; } catch (_) { return uci; }
}

function explain(p, evBefore, evAfter, before, after, k) {
  const bestSan = evBefore.b ? sanOf(p.fen, evBefore.b) : null;
  const line = sanLine(p.fen, evBefore.pv || [], 5);
  const oppLine = sanLine(p.after, evAfter.pv || [], 5);
  if (k.hadMate && !k.stillMate) {
    return { cat: 'missed-mate', text: `Missed mate: you had mate in ${before.mate} starting with ${bestSan} (${line}).` };
  }
  if (k.allowsMate) {
    const n = after.mate !== undefined ? Math.abs(after.mate) : 1;
    return { cat: 'king-safety', text: `${p.san} allows mate in ${n}: ${oppLine}. Check your opponent’s checks before every move.` };
  }
  // piece left hanging: the opponent's best reply captures a piece that is undefended or attacked by something cheaper
  const hang = hangingAfter(p, evAfter.b);
  if (hang) {
    return { cat: 'hanging-piece', text: `${p.san} leaves your ${NAME[hang.piece]} on ${hang.sq} ${hang.defended ? 'under-defended' : 'undefended'}: ${hang.san} wins it${hang.defended ? ' (it is attacked by a cheaper piece)' : ''}.` };
  }
  // the move allows a forcing reply (capture / check) that wins material or the game
  const replyC = new Chess(p.after);
  const reply = evAfter.b ? uciToMove(replyC, evAfter.b) : null;
  const lossCp = scoreCp(before) - scoreCp(after);
  if (reply && (reply.captured || /[+#]/.test(reply.san)) && lossCp >= 200 && Math.abs(scoreCp(after)) < 90000) {
    return { cat: reply.captured ? 'hanging-piece' : 'calculation', text: `${p.san} allows ${reply.san}${reply.captured ? ', winning material' : ''}: ${oppLine}. Better was ${bestSan} (${fmtScore(before)} instead of ${fmtScore(after)}). Before each move, list your opponent’s checks and captures in the new position.` };
  }
  // missed tactic: best move was forcing and wins at least two pawns more than the move played
  const c = new Chess(p.fen);
  const bm = evBefore.b ? uciToMove(c, evBefore.b) : null;
  const gain = scoreCp(before) - scoreCp(after);
  if (bm && (bm.captured || /[+#]/.test(bm.san)) && gain >= 200 && Math.abs(scoreCp(before)) < 90000) {
    return { cat: 'missed-tactic', text: `Missed tactic: ${bm.san} was much stronger (${fmtScore(before)} instead of ${fmtScore(after)}). Line: ${line}.` };
  }
  if (scoreCp(before) >= 300 && scoreCp(after) < 150) {
    return { cat: 'conversion', text: `You were clearly better (${fmtScore(before)}); after ${p.san} the advantage is mostly gone (${fmtScore(after)}). Better: ${bestSan}.` };
  }
  const pieces = (p.fen.split(' ')[0].match(/[nbrqNBRQ]/g) || []).length;
  const cat = k.ply < 20 ? 'opening' : pieces <= 4 ? 'endgame' : 'positional';
  return { cat, text: `${p.san} (${fmtScore(after)}) is weaker than ${bestSan} (${fmtScore(before)}). Engine line: ${line}.` };
}

function hangingAfter(p, oppBest) {
  if (!oppBest) return null;
  const c = new Chess(p.after);
  const m = uciToMove(c, oppBest);
  if (!m || !m.captured) return null;
  const victim = m.captured;
  const vv = VAL[victim];
  if (vv < 3 && !(vv === 1 && false)) return null;
  const me = p.color;
  const defended = c.isAttacked(m.to, me);
  const attackerVal = VAL[m.piece];
  if (defended && attackerVal >= vv) return null;
  // was it already hanging before the move? still report: the move failed to fix it
  return { piece: victim, sq: m.to, san: m.san, defended };
}

// ---------------------------------------------------------------- analysis board
export function renderAnalysisBoard(main, params, query) {
  let startFen = query.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  try { new Chess(startFen); } catch (e) { startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; toast('That position is not valid; showing the start position.'); }
  const page = h('div', { class: 'page play-page' });
  const boardCol = h('div', { class: 'play-board' });
  const side = h('div', { class: 'play-side' });
  page.append(boardCol, side);
  main.appendChild(page);
  let line = [];
  let cur = 0;
  let engineOn = query.engine === '1';
  let searchToken = 0;
  const gb = new GameBoard(boardCol, { fen: startFen, orientation: query.orientation || (startFen.split(' ')[1] === 'b' ? 'black' : 'white'), movable: 'both', label: 'Analysis board',
    onMove: (m) => { line = line.slice(0, cur); line.push(m.san); cur = line.length; refresh(false); } });
  const evalBox = h('div', { class: 'evalbox', id: 'eval-box', 'aria-live': 'polite' });
  const list = h('p', { class: 'movelist-inline', id: 'an-moves' });
  const engBtn = h('button', { class: 'btn small ghost', type: 'button', id: 'btn-engine', 'aria-pressed': String(engineOn) }, engineOn ? 'Engine: on' : 'Engine: off');
  engBtn.addEventListener('click', () => { engineOn = !engineOn; engBtn.textContent = engineOn ? 'Engine: on' : 'Engine: off'; engBtn.setAttribute('aria-pressed', String(engineOn)); refresh(true); });
  const step = (d) => { cur = Math.max(0, Math.min(line.length, cur + d)); goto(); };
  side.append(pageHead('Analysis board', 'Move freely for both sides. Turn the engine on only after you have formed your own opinion.'),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Back', onclick: () => step(-1) }, '‹ Back'),
      h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Forward', onclick: () => step(1) }, 'Forward ›'),
      h('button', { class: 'btn small ghost', type: 'button', onclick: () => gb.flip() }, 'Flip'),
      h('button', { class: 'btn small ghost', type: 'button', onclick: () => { line = []; cur = 0; goto(); } }, 'Reset'),
      engBtn),
    evalBox, list,
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn small ghost', type: 'button', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(gb.chess.fen()).then(() => toast('FEN copied'), () => toast(gb.chess.fen())); } }, 'Copy FEN'),
      h('a', { class: 'btn small ghost', id: 'play-from-here', href: '#' }, 'Play this position vs engine')));

  function goto() {
    const c = new Chess(startFen);
    let last = null;
    for (const s of line.slice(0, cur)) last = c.move(s);
    gb.load(c.fen(), last ? [last.from, last.to] : null);
    gb.chess = c;
    gb.sync(last ? [last.from, last.to] : null, true);
    refresh(false);
  }

  function refresh() {
    list.innerHTML = '';
    const c = new Chess(startFen);
    line.forEach((s, i) => {
      const n = c.moveNumber(); const w = c.turn() === 'w';
      c.move(s);
      if (w || i === 0) list.appendChild(h('span', { class: 'mn' }, w ? `${n}.` : `${n}…`));
      list.appendChild(h('button', { class: 'mvb' + (i === cur - 1 ? ' on' : ''), type: 'button', onclick: () => { cur = i + 1; goto(); } }, s));
      list.appendChild(document.createTextNode(' '));
    });
    const fen = gb.chess.fen();
    side.querySelector('#play-from-here').setAttribute('href', `#/play?fen=${encodeURIComponent(fen)}&color=${fen.split(' ')[1]}`);
    runEngine(fen);
  }

  async function runEngine(fen) {
    const token = ++searchToken;
    if (!engineOn) { evalBox.textContent = ''; engine.stop(); return; }
    const c = new Chess(fen);
    if (c.isGameOver()) { evalBox.textContent = c.isCheckmate() ? 'Checkmate.' : 'Draw.'; return; }
    evalBox.textContent = 'Engine thinking…';
    engine.stop();
    try {
      await engine.search(fen, { depth: 16, multipv: 1, onInfo: (info) => {
        if (token !== searchToken) return;
        const s = whitePov(info.score, fen);
        evalBox.innerHTML = '';
        evalBox.append(h('span', { class: 'eval-num' }, fmtScore(s)), h('span', { class: 'muted small' }, ` depth ${info.depth} · `), h('span', { class: 'small' }, sanLine(fen, info.pv, 8)));
      } });
    } catch (e) { evalBox.textContent = 'Engine unavailable: ' + e.message; }
  }

  const onKey = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  };
  document.addEventListener('keydown', onKey);
  refresh();
  return () => { document.removeEventListener('keydown', onKey); searchToken++; engine.stop(); };
}
