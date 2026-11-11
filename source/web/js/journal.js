// Mistake journal, prioritised weakness list and personal review exercises (the FIX step).
import * as store from './store.js';
import * as data from './data.js';
import * as srs from './srs.js';
import { engine, scoreCp } from './engine.js';
import { Chess, uciToMove } from './chess-ui.js';
import { renderDiagram } from './board.js';
import { h, pageHead, fmtDate, confirmDialog, pct } from './ui.js';

// Create a journal entry and a personal spaced-repetition exercise from a flagged moment.
export async function addMomentToJournal(game, flag, { category, note }) {
  const fen = flag.fen;
  const c = new Chess(fen);
  const best = flag.best ? uciToMove(c, flag.best) : null;
  if (!best) throw new Error('no engine move for this position');
  // accept moves within ~30 centipawns of the best move
  const accept = [best.san];
  try {
    const r = await engine.search(fen, { depth: 10, multipv: 4, skill: 20 });
    const top = r.lines[0] ? scoreCp(r.lines[0].score) : null;
    for (const l of r.lines) {
      if (top === null || !l.pv[0]) continue;
      if (Math.abs(top) >= 90000 ? scoreCp(l.score) === top : top - scoreCp(l.score) <= 30) {
        const m = uciToMove(new Chess(fen), l.pv[0]);
        if (m && !accept.includes(m.san)) accept.push(m.san);
      }
    }
  } catch (_) { /* engine unavailable: keep the single best move */ }
  const id = store.uid('my-');
  const side = fen.split(' ')[1] === 'w' ? 'White' : 'Black';
  const cat = srs.CATEGORIES[category] ? category : flag.cat;
  const ex = {
    id, type: 'personal', difficulty: 0, fen, solution: [best.san], accept_by_ply: [accept], goal: 'best',
    question: `${side} to move. From your game ${game.white} – ${game.black}: you played ${flag.san}. Find the better move.`,
    question_html: '', hint: hintFor(cat), wrong: [{ move: flag.san, why: flag.expl }],
    explanation_html: '', objective: srs.CATEGORIES[cat] ? `Fix: ${srs.CATEGORIES[cat].label.toLowerCase()}` : '',
    tags: [cat], set: 'personal', label: 'Your game',
  };
  ex.question_html = ex.question.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]));
  ex.explanation_html = `${flag.expl.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))}${note ? ` <em>Your note: ${note.replace(/[&<>]/g, '')}</em>` : ''}`;
  const entry = {
    id: store.uid('j'), date: store.today(), gameId: game.id, game: `${game.white} – ${game.black}`, ply: flag.ply, moveNo: flag.moveNo, color: flag.color,
    fen, played: flag.san, best: best.san, bestLine: flag.bestLine, category: cat, note: note || '', cost: flag.loss, cls: flag.cls, expl: flag.expl, exId: id,
  };
  store.update((s) => {
    s.personal[id] = ex;
    s.journal.unshift(entry);
    // enters the review queue today
    s.ex[id] = { attempts: 0, ok: 0, fail: 0, hints: 0, firstTry: null, firstAt: new Date().toISOString(), step: -1, due: store.today() };
  });
  srs.checkBadges();
  return entry;
}

function hintFor(cat) {
  return {
    'hanging-piece': 'Which pieces are undefended — yours and theirs?',
    'missed-tactic': 'List every check, capture and threat first.',
    'missed-mate': 'Look at checks against the king first.',
    'king-safety': 'What does your opponent threaten against your king?',
  }[cat] || 'Compare your candidate moves; what does each one change?';
}

export function renderJournal(main, params, query) {
  const s = store.get();
  const page = h('div', { class: 'page' });
  page.appendChild(pageHead('Journal & weaknesses', 'Every real mistake is data. Rank them by how often and how much they cost, then train the top one.'));
  const weak = srs.weaknesses();
  const weakEl = h('section', { class: 'card', id: 'weaknesses' }, h('h2', { class: 'card-title' }, 'Your weakness list'),
    h('p', { class: 'small muted' }, 'Ranked by frequency × average cost (engine centipawn loss). Built from journal entries and your own move tags.'));
  if (!weak.length) weakEl.appendChild(h('p', null, 'No data yet. Analyse a game and add its flagged moments to the journal.'));
  else {
    weakEl.appendChild(h('ol', { class: 'weak-list' }, weak.slice(0, 6).map((w) => h('li', null,
      h('div', { class: 'weak-row' }, h('strong', null, w.label), h('span', { class: 'muted small' }, ` ${w.n}× · avg ${Math.round(w.avg)} cp`)),
      h('div', { class: 'small' }, 'Remedy: ', w.chapters.map((n, i) => {
        const c = data.chapter(n);
        return [i ? ', ' : '', c ? h('a', { href: `#/read/ch/${n}` }, `Ch. ${n} ${c.title}`) : h('span', { class: 'muted' }, `Ch. ${n}`)];
      }))))));
  }
  const wt = srs.weakTags();
  if (wt.length) {
    weakEl.appendChild(h('h3', null, 'Weak exercise skills'));
    weakEl.appendChild(h('ul', null, wt.slice(0, 6).map((t) => {
      const chs = data.chaptersForTag(t.tag);
      return h('li', null, `${data.tagLabel(t.tag)}: ${pct(t.acc)} first try over ${t.n} exercises`, chs.length ? [' — ', h('a', { href: `#/read/ch/${chs[0]}` }, `Chapter ${chs[0]}`)] : null);
    })));
  }
  page.appendChild(weakEl);

  const filter = query.cat || '';
  const sel = h('select', { id: 'journal-filter', 'aria-label': 'Filter by category' }, h('option', { value: '' }, 'All categories'),
    Object.entries(srs.CATEGORIES).map(([k, v]) => h('option', { value: k, selected: filter === k }, v.label)));
  sel.addEventListener('change', () => { location.hash = '#/journal' + (sel.value ? '?cat=' + sel.value : ''); });
  const entries = s.journal.filter((j) => !filter || j.category === filter);
  const list = h('div', { class: 'journal-list', id: 'journal-list' });
  for (const j of entries) {
    const fig = h('figure', { class: 'diagram mini', 'data-fen': j.fen, 'data-orientation': j.color === 'b' ? 'black' : 'white', 'data-arrows': '', 'data-red': '', 'data-blue': '', 'data-squares': '', 'data-lastmove': '' }, h('div', { class: 'board-wrap' }));
    const exs = s.ex[j.exId];
    list.appendChild(h('article', { class: 'jentry card', 'data-id': j.id }, fig,
      h('div', { class: 'jbody' },
        h('p', { class: 'jhead' }, h('span', { class: 'tag' }, (srs.CATEGORIES[j.category] || {}).label || j.category), ' ', h('span', { class: 'muted small' }, `${fmtDate(j.date)} · ${j.game}`)),
        h('p', null, `You played `, h('strong', null, `${j.moveNo}${j.color === 'w' ? '.' : '…'}${j.played}`), '; engine preferred ', h('strong', null, j.best), j.cost ? h('span', { class: 'muted small' }, ` (−${(j.cost / 100).toFixed(1)})`) : null),
        h('p', { class: 'small' }, j.expl),
        j.note ? h('p', { class: 'small' }, h('em', null, j.note)) : null,
        h('div', { class: 'row wrap' },
          h('a', { class: 'btn small primary', href: `#/solve/ex/${j.exId}` }, 'Solve it'),
          h('a', { class: 'btn small ghost', href: `#/play?fen=${encodeURIComponent(j.fen)}&color=${j.color}` }, 'Play from here'),
          h('a', { class: 'btn small ghost', href: `#/games/${j.gameId}?ply=${j.ply}` }, 'Open game'),
          exs && exs.due ? h('span', { class: 'muted small' }, `review ${exs.due <= store.today() ? 'due now' : 'on ' + fmtDate(exs.due)}`) : null,
          h('button', { class: 'btn small ghost danger-text', type: 'button', onclick: async () => {
            if (!(await confirmDialog('Delete entry?', 'The entry and its review exercise are removed.', 'Delete', true))) return;
            store.update((st) => { st.journal = st.journal.filter((x) => x.id !== j.id); delete st.personal[j.exId]; delete st.ex[j.exId]; });
            location.hash = '#/journal?t=' + Date.now();
          } }, 'Delete')))));
  }
  page.appendChild(h('section', null, h('div', { class: 'row between' }, h('h2', { class: 'section-title' }, `Journal (${entries.length})`), sel),
    entries.length ? list : h('p', { class: 'muted' }, 'No entries yet. Open a game, run the engine review and use “Add to journal” on a flagged moment.')));
  main.appendChild(page);
  for (const f of page.querySelectorAll('figure.diagram')) renderDiagram(f);
}
