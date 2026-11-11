// Games: library, PGN import, viewer with self-analysis first, then engine review.
import * as store from './store.js';
import { Board } from './board.js';
import { Chess } from './chess-ui.js';
import { getGame, updateGame, deleteGame, importPgnText, positions, sampleGamePgn, exportPgn } from './library.js';
import { reviewGame, CLASS_LABEL } from './analysis.js';
import { fmtScore, winProb } from './engine.js';
import { CATEGORIES } from './srs.js';
import { addMomentToJournal } from './journal.js';
import { h, pageHead, toast, downloadFile, confirmDialog, fmtDate } from './ui.js';

export function renderGames(main) {
  const s = store.get();
  const page = h('div', { class: 'page' });
  page.appendChild(pageHead('Games', 'Your played and imported games. Analyse each one yourself first, then with the engine.',
    h('div', { class: 'row wrap' }, h('a', { class: 'btn primary', href: '#/games/import', id: 'import-link' }, 'Import PGN'), h('a', { class: 'btn ghost', href: '#/play' }, 'Play a game'), h('a', { class: 'btn ghost', href: '#/analysis' }, 'Analysis board'))));
  if (!s.games.length) {
    page.appendChild(h('section', { class: 'card' }, h('p', null, 'No games yet. Play one against the engine or import your online games as PGN (from Lichess or Chess.com: “Download PGN”).')));
  } else {
    const ul = h('ul', { class: 'game-list', id: 'game-list' });
    for (const g of s.games) {
      const fl = g.review && g.review.flags ? g.review.flags.filter((f) => !g.userColor || f.color === g.userColor) : null;
      ul.appendChild(h('li', null, h('a', { class: 'game-row', href: `#/games/${g.id}` },
        h('span', { class: 'g-players' }, `${g.white} – ${g.black}`),
        h('span', { class: 'g-res' }, g.result),
        h('span', { class: 'g-meta muted small' }, `${fmtDate(g.date)} · ${g.source === 'play' ? 'vs engine' : 'imported'} · ${Math.ceil(g.sans.length / 2)} moves`,
          fl ? ` · reviewed: ${fl.filter((f) => f.cls === 'blunder').length} blunders, ${fl.filter((f) => f.cls === 'mistake').length} mistakes` : Object.keys(g.tags || {}).length ? ` · ${Object.keys(g.tags).length} self-tagged` : ''))));
    }
    page.appendChild(ul);
  }
  main.appendChild(page);
}

export function renderImport(main) {
  const page = h('div', { class: 'page narrow' });
  page.appendChild(pageHead('Import games', 'Paste PGN or choose a .pgn file. Several games at once are fine; comments, NAGs and variations are ignored.'));
  const ta = h('textarea', { id: 'pgn-text', rows: 12, class: 'wide mono', placeholder: '[Event "…"]\n\n1. e4 e5 2. Nf3 …', spellcheck: 'false' });
  const file = h('input', { type: 'file', id: 'pgn-file', accept: '.pgn,.txt,application/x-chess-pgn,text/plain' });
  file.addEventListener('change', async () => { const f = file.files[0]; if (f) ta.value = await f.text(); });
  const msg = h('div', { class: 'import-msg', id: 'import-msg', 'aria-live': 'polite' });
  const btn = h('button', { class: 'btn primary', type: 'button', id: 'do-import' }, 'Import');
  btn.addEventListener('click', () => {
    const res = importPgnText(ta.value);
    msg.innerHTML = '';
    if (res.ok.length) msg.appendChild(h('p', { class: 'good' }, `Imported ${res.ok.length} game${res.ok.length > 1 ? 's' : ''}. `, h('a', { href: `#/games/${res.ok[0].id}`, id: 'open-imported' }, 'Open the first one →')));
    if (res.errors.length) msg.appendChild(h('div', { class: 'bad' }, h('p', null, 'Some games could not be read:'), h('ul', null, res.errors.slice(0, 10).map((e) => h('li', null, e)))));
    if (!res.ok.length && !res.errors.length) msg.appendChild(h('p', { class: 'bad' }, 'No games found in that text.'));
  });
  page.append(h('section', { class: 'card' }, h('label', { for: 'pgn-text' }, 'PGN text'), ta,
    h('p', null, h('label', { for: 'pgn-file' }, 'or a file: '), file),
    h('div', { class: 'row wrap' }, btn, h('button', { class: 'btn ghost', type: 'button', onclick: () => { ta.value = sampleGamePgn(); } }, 'Load a sample game')), msg));
  main.appendChild(page);
}

export function renderGame(main, { id }) {
  let g = getGame(id);
  if (!g) { main.appendChild(h('div', { class: 'page' }, pageHead('Game not found', ''), h('a', { href: '#/games' }, '← Games'))); return; }
  const pos = positions(g);
  let cur = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('ply') || pos.length - 1);
  cur = Math.max(0, Math.min(pos.length - 1, cur));
  let cancel = null;
  const page = h('div', { class: 'page play-page game-page' });
  const boardCol = h('div', { class: 'play-board' });
  const side = h('div', { class: 'play-side' });
  page.append(boardCol, side);
  main.appendChild(page);
  const userColor = () => g.userColor || null;
  const board = new Board(h('div'), { orientation: g.userColor === 'b' ? 'black' : 'white', interactive: false, label: 'Game position' });
  boardCol.appendChild(board.el);
  const stepper = h('div', { class: 'stepper' },
    h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'First position', onclick: () => go(0) }, '|‹'),
    h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Previous move', id: 'g-prev', onclick: () => go(cur - 1) }, '‹'),
    h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Next move', id: 'g-next', onclick: () => go(cur + 1) }, '›'),
    h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Last position', onclick: () => go(pos.length - 1) }, '›|'),
    h('button', { class: 'btn small ghost', type: 'button', onclick: () => board.flip() }, 'Flip'));
  const graph = h('div', { class: 'evalgraph', id: 'eval-graph' });
  boardCol.append(stepper, graph);

  const head = h('div', { class: 'game-head' }, h('a', { class: 'back', href: '#/games' }, '← Games'),
    h('h1', { class: 'game-title' }, `${g.white} – ${g.black}`), h('p', { class: 'muted small' }, `${g.result}${g.reason ? ' · ' + g.reason : ''} · ${fmtDate(g.date)}${g.event ? ' · ' + g.event : ''}`));
  const sideSel = h('select', { id: 'my-side', 'aria-label': 'Which side were you?' },
    h('option', { value: '' }, 'Both sides'), h('option', { value: 'w', selected: g.userColor === 'w' }, 'I was White'), h('option', { value: 'b', selected: g.userColor === 'b' }, 'I was Black'));
  sideSel.addEventListener('change', () => { updateGame(g.id, (x) => { x.userColor = sideSel.value || null; }); g = getGame(g.id); renderFlags(); renderList(); });
  const moveList = h('div', { class: 'movelist-inline', id: 'game-moves' });
  const tagBox = h('div', { class: 'card tagbox', id: 'tag-box' });
  const reviewBox = h('div', { class: 'card', id: 'review-box' });
  const flagsBox = h('div', { id: 'flags' });
  side.append(head, h('p', null, h('label', { for: 'my-side', class: 'small' }, 'Show mistakes for: '), sideSel), moveList, tagBox, reviewBox, flagsBox,
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn small ghost', type: 'button', onclick: () => downloadFile(`game-${g.id}.pgn`, g.pgn || exportPgn(g.headers || {}, g.startFen, g.sans, g.result), 'application/x-chess-pgn') }, 'Export PGN'),
      h('a', { class: 'btn small ghost', id: 'g-analyse-here', href: '#' }, 'Analyse this position'),
      h('button', { class: 'btn small ghost danger-text', type: 'button', onclick: async () => {
        if (await confirmDialog('Delete this game?', 'Journal entries made from it are kept.', 'Delete', true)) { deleteGame(g.id); location.hash = '#/games'; }
      } }, 'Delete game')));

  function flagAt(ply) { return g.review && g.review.flags ? g.review.flags.find((f) => f.ply === ply) : null; }

  function go(i) {
    const prev = cur;
    cur = Math.max(0, Math.min(pos.length - 1, i));
    const p = pos[cur];
    const last = cur > 0 ? pos[cur - 1] : null;
    const c = new Chess(p.fen);
    let check = null;
    if (c.inCheck()) for (const row of c.board()) for (const x of row) if (x && x.type === 'k' && x.color === c.turn()) check = x.square;
    board.setPosition(p.fen, { lastMove: last ? [last.from, last.to] : null, check, animate: Math.abs(prev - cur) === 1 });
    const fl = cur > 0 ? flagAt(cur - 1) : null;
    board.setShapes(fl && fl.best ? { arrows: [{ from: fl.best.slice(0, 2), to: fl.best.slice(2, 4), color: 'green' }] } : {});
    for (const b of moveList.querySelectorAll('.mvb')) b.classList.toggle('on', Number(b.dataset.ply) === cur - 1);
    const on = moveList.querySelector('.mvb.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    side.querySelector('#g-analyse-here').setAttribute('href', `#/analysis?fen=${encodeURIComponent(p.fen)}`);
    renderTag();
    drawGraph();
  }

  function renderList() {
    moveList.innerHTML = '';
    pos.slice(0, -1).forEach((p, i) => {
      if (p.color === 'w' || i === 0) moveList.appendChild(h('span', { class: 'mn' }, p.color === 'w' ? `${p.moveNo}.` : `${p.moveNo}…`));
      const fl = flagAt(i);
      const tag = g.tags && g.tags[i];
      const show = !fl || !userColor() || fl.color === userColor();
      moveList.appendChild(h('button', { class: 'mvb' + (fl && show ? ' f-' + fl.cls : '') + (tag ? ' tagged' : ''), type: 'button', 'data-ply': i, onclick: () => go(i + 1),
        'aria-label': `${p.moveNo}${p.color === 'w' ? '.' : '…'} ${p.san}${fl && show ? ', ' + fl.cls : ''}${tag ? ', tagged ' + tag.cat : ''}` }, p.san + (fl && show ? (fl.cls === 'blunder' ? '??' : fl.cls === 'mistake' ? '?' : '?!') : '')));
      moveList.appendChild(document.createTextNode(' '));
    });
  }

  function renderTag() {
    tagBox.innerHTML = '';
    if (cur === 0) {
      tagBox.append(h('h2', { class: 'card-title' }, 'Self-analysis first'), h('p', { class: 'small muted' }, 'Step through the game. At each move you now think was a mistake, tag it with a category and a note — before you run the engine.'));
      return;
    }
    const ply = cur - 1;
    const p = pos[ply];
    const t = (g.tags && g.tags[ply]) || {};
    const sel = h('select', { id: 'tag-cat', 'aria-label': 'Mistake category' }, h('option', { value: '' }, '— no mistake —'),
      Object.entries(CATEGORIES).map(([k, v]) => h('option', { value: k, selected: t.cat === k }, v.label)));
    const note = h('textarea', { id: 'tag-note', rows: 2, class: 'wide', placeholder: 'What did you miss? What should you have asked?' });
    note.value = t.note || '';
    const save = h('button', { class: 'btn small primary', type: 'button', id: 'tag-save', onclick: () => {
      updateGame(g.id, (x) => { x.tags = x.tags || {}; if (sel.value || note.value.trim()) x.tags[ply] = { cat: sel.value, note: note.value.trim() }; else delete x.tags[ply]; });
      g = getGame(g.id);
      renderList(); go(cur);
      toast('Saved.');
    } }, 'Save tag');
    tagBox.append(h('h2', { class: 'card-title' }, `Your verdict on ${p.moveNo}${p.color === 'w' ? '.' : '…'}${p.san}`), sel, note, save);
    const fl = flagAt(ply);
    if (fl && (!userColor() || fl.color === userColor())) tagBox.appendChild(flagCard(fl, true));
  }

  function renderReviewBox() {
    reviewBox.innerHTML = '';
    const nTags = Object.keys(g.tags || {}).length;
    if (g.review && g.review.done) {
      const sm = g.review.summary;
      const row = (c, label) => h('tr', null, h('th', { scope: 'row' }, label), h('td', null, String(sm[c].acpl)), h('td', null, String(sm[c].inaccuracy)), h('td', null, String(sm[c].mistake)), h('td', null, String(sm[c].blunder)));
      reviewBox.append(h('h2', { class: 'card-title' }, 'Engine review'),
        h('p', { class: 'small muted' }, `Engine accuracy for this game only (Stockfish lite, depth ${g.review.depth}). Average centipawn loss: lower is better. One game says little about your rating.`),
        h('div', { class: 'table-wrap' }, h('table', { class: 'compact', id: 'review-summary' }, h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Avg cp loss'), h('th', null, 'Inacc.'), h('th', null, 'Mistakes'), h('th', null, 'Blunders'))),
          h('tbody', null, row('w', 'White'), row('b', 'Black')))),
        h('button', { class: 'btn small ghost', type: 'button', onclick: () => start() }, 'Run again'));
      return;
    }
    const btn = h('button', { class: 'btn primary', type: 'button', id: 'run-review' }, 'Run engine review');
    btn.addEventListener('click', start);
    reviewBox.append(h('h2', { class: 'card-title' }, 'Engine review'),
      h('p', { class: 'small' }, nTags ? `You tagged ${nTags} move${nTags > 1 ? 's' : ''}. Now compare with the engine.` : 'Tip: tag the moves you think were mistakes first — finding them yourself is the training.'),
      btn);
  }

  function start() {
    if (cancel) return;
    cancel = { cancelled: false };
    reviewBox.innerHTML = '';
    const bar = h('progress', { max: pos.length, value: 0, id: 'review-progress', 'aria-label': 'Engine review progress' });
    const lab = h('span', { class: 'small muted' }, 'Starting the engine…');
    const stop = h('button', { class: 'btn small ghost', type: 'button', id: 'cancel-review', onclick: () => { if (cancel) cancel.cancelled = true; } }, 'Cancel');
    reviewBox.append(h('h2', { class: 'card-title' }, 'Engine review'), bar, lab, stop);
    const depth = store.get().settings.engineDepth || 12;
    reviewGame(g, { depth, cancel, onProgress: (i, n) => { bar.value = i; lab.textContent = ` Position ${i} of ${n}`; } }).then((rev) => {
      cancel = null;
      if (!rev) { toast('Review cancelled.'); renderReviewBox(); return; }
      updateGame(g.id, (x) => { x.review = rev; });
      g = getGame(g.id);
      import('./srs.js').then((m) => m.checkBadges());
      renderReviewBox(); renderList(); renderFlags(); go(cur);
    }).catch((e) => { cancel = null; reviewBox.appendChild(h('p', { class: 'bad' }, 'Engine review failed: ' + e.message)); });
  }

  function flagCard(fl, compact) {
    const inJournal = store.get().journal.find((j) => j.gameId === g.id && j.ply === fl.ply);
    const cat = (g.tags && g.tags[fl.ply] && g.tags[fl.ply].cat) || fl.cat;
    const catSel = h('select', { 'aria-label': 'Category for the journal', class: 'flag-cat' }, Object.entries(CATEGORIES).map(([k, v]) => h('option', { value: k, selected: k === cat }, v.label)));
    const add = h('button', { class: 'btn small primary add-journal', type: 'button', disabled: !!inJournal }, inJournal ? '✓ In journal' : 'Add to journal');
    add.addEventListener('click', async () => {
      add.disabled = true;
      add.textContent = 'Adding…';
      const note = (g.tags && g.tags[fl.ply] && g.tags[fl.ply].note) || '';
      try {
        await addMomentToJournal(g, fl, { category: catSel.value, note });
        add.textContent = '✓ In journal';
        toast('Added to your journal and review queue.');
        renderFlags();
      } catch (e) { add.disabled = false; add.textContent = 'Add to journal'; toast('Could not add: ' + e.message); }
    });
    return h('div', { class: 'flag f-' + fl.cls, 'data-ply': fl.ply },
      h('p', { class: 'flag-head' }, h('span', { class: 'flag-cls' }, CLASS_LABEL[fl.cls]), ' ',
        h('button', { class: 'linkish', type: 'button', onclick: () => go(fl.ply) }, `${fl.moveNo}${fl.color === 'w' ? '.' : '…'}${fl.san}`),
        h('span', { class: 'muted small' }, ` ${fmtScore(toWhite(fl.before, fl.color))} → ${fmtScore(toWhite(fl.after, fl.color))}`)),
      h('p', { class: 'flag-expl' }, fl.expl),
      fl.bestSan ? h('p', { class: 'small' }, 'Engine best: ', h('strong', null, fl.bestSan)) : null,
      compact ? null : h('div', { class: 'row wrap' }, catSel, add, h('button', { class: 'btn small ghost', type: 'button', onclick: () => go(fl.ply) }, 'Show position')),
      compact ? h('div', { class: 'row wrap' }, catSel, add) : null);
  }

  function renderFlags() {
    flagsBox.innerHTML = '';
    if (!g.review || !g.review.flags) return;
    const list = g.review.flags.filter((f) => !userColor() || f.color === userColor()).filter((f) => f.cls !== 'inaccuracy' || g.review.flags.length < 8);
    flagsBox.append(h('h2', { class: 'section-title' }, `Flagged moments (${list.length})`),
      list.length ? h('div', { class: 'flag-list', id: 'flag-list' }, list.map((f) => flagCard(f, false))) : h('p', { class: 'muted' }, 'No significant mistakes found for this side. Well played.'));
  }

  function drawGraph() {
    graph.innerHTML = '';
    if (!g.review || !g.review.evals) return;
    const ev = g.review.evals;
    const W = 600, H = 90;
    const pts = ev.map((e, i) => [ev.length > 1 ? (i / (ev.length - 1)) * W : 0, H - winProb(e.s) * H]);
    const area = `M0,${H / 2} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${W},${H / 2} Z`;
    const cx = ev.length > 1 ? (cur / (ev.length - 1)) * W : 0;
    graph.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evaluation graph: White's winning chances over the game">
      <rect width="${W}" height="${H}" fill="#2A2724"/><path d="${area}" fill="#FBF8F1"/>
      <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="#B08D2E" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="${cx}" x2="${cx}" y1="0" y2="${H}" stroke="#C9A227" stroke-width="2.5"/></svg>`;
    graph.querySelector('svg').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      go(Math.round(((e.clientX - r.left) / r.width) * (ev.length - 1)));
    });
  }

  const onKey = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'Home') { e.preventDefault(); go(0); }
    if (e.key === 'End') { e.preventDefault(); go(pos.length - 1); }
  };
  document.addEventListener('keydown', onKey);
  renderList(); renderReviewBox(); renderFlags(); go(cur);
  return () => { document.removeEventListener('keydown', onKey); if (cancel) cancel.cancelled = true; };
}

function toWhite(s, color) { return color === 'w' ? s : (s.mate !== undefined ? { mate: -s.mate } : { cp: -s.cp }); }
