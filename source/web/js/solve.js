// Solve: chapter sets, stage tests, review queue, mixed and personal practice.
import * as data from './data.js';
import * as store from './store.js';
import * as srs from './srs.js';
import { GameBoard, Chess } from './chess-ui.js';
import { h, pageHead, pct, toast, esc } from './ui.js';

const norm = (s) => String(s || '').replace(/[+#!?]/g, '').trim();

export function acceptedAt(ex, ply) {
  const sol = ex.solution[ply];
  let list = [];
  if (Array.isArray(ex.accept_by_ply) && Array.isArray(ex.accept_by_ply[ply]) && ex.accept_by_ply[ply].length) list = ex.accept_by_ply[ply].slice();
  else {
    list = [sol];
    if (ply === 0 && Array.isArray(ex.accept)) list.push(...ex.accept);
  }
  if (sol && !list.includes(sol)) list.push(sol);
  return list.map(norm);
}

function diffDots(d) { return '●'.repeat(d || 0) + '○'.repeat(Math.max(0, 5 - (d || 0))); }

// ---------------------------------------------------------------- home
export function renderSolveHome(main) {
  const page = h('div', { class: 'page' });
  page.appendChild(pageHead('Solve', 'Find the move, then the opponent’s best reply. Misses come back at 1, 3, 7, 21 and 60 days.'));
  const due = srs.reviewQueue();
  const personal = Object.keys(store.get().personal);
  page.appendChild(h('div', { class: 'grid3' },
    h('section', { class: 'card accent' }, h('h2', { class: 'card-title' }, 'Review queue'),
      h('p', { class: 'big-num', id: 'due-count' }, String(due.length)), h('p', { class: 'muted' }, due.length ? 'exercises due today, mixed across chapters' : 'Nothing due today.'),
      due.length ? h('a', { class: 'btn primary', href: '#/solve/review', id: 'start-review' }, 'Start review') : null),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Mixed practice'), h('p', { class: 'muted' }, 'A shuffled set from everything you have seen — interleaving builds recall under game conditions.'),
      h('a', { class: 'btn ghost', href: '#/solve/mixed' }, 'Start mixed set')),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'From your games'), h('p', { class: 'muted' }, personal.length ? `${personal.length} positions from your own mistakes.` : 'Add flagged moments from analysed games to your journal and they appear here.'),
      personal.length ? h('a', { class: 'btn ghost', href: '#/solve/personal' }, 'Practise them') : h('a', { class: 'btn ghost', href: '#/games' }, 'Go to games'))));

  const sets = data.chapterSets();
  const list = h('ul', { class: 'set-list' });
  for (const k of sets) {
    const st = srs.setStats(k);
    const ch = data.chapter(k);
    list.appendChild(h('li', null, h('a', { href: `#/solve/set/${k}`, class: 'set-row' },
      h('span', { class: 'set-n' }, k), h('span', { class: 'set-t' }, data.book.sets[k].title || (ch && ch.title) || `Chapter ${k}`),
      h('span', { class: 'set-meta' }, `${st.attempted}/${st.n}`, st.attempted ? ` · ${pct(st.acc)} first try` : ''),
      h('span', { class: 'bar', 'aria-hidden': 'true' }, h('span', { style: { width: (st.n ? (st.attempted / st.n) * 100 : 0) + '%' } })))));
  }
  page.appendChild(h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Chapter exercises'),
    sets.length ? list : h('p', { class: 'muted' }, 'No exercise sets in this edition yet.')));

  const tests = data.testSets();
  const tl = h('ul', { class: 'set-list' });
  for (const k of tests) {
    const hist = store.get().tests[k] || [];
    const best = hist.reduce((b, t) => Math.max(b, t.score / t.n), -1);
    const set = data.setOf(k);
    tl.appendChild(h('li', null, h('a', { href: `#/solve/test/${k}`, class: 'set-row' },
      h('span', { class: 'set-n' }, k), h('span', { class: 'set-t' }, data.setTitle(k)),
      h('span', { class: 'set-meta' }, `${set.ids.length} positions`, best >= 0 ? ` · best ${Math.round(best * 100)}%` : ''))));
  }
  page.appendChild(h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Stage tests'),
    h('p', { class: 'muted' }, 'No hints, one attempt per position, scored at the end. 80% or more: move on.'),
    tests.length ? tl : h('p', { class: 'muted' }, 'The stage tests are still being prepared.')));
  main.appendChild(page);
}

export function renderSet(main, { key }) {
  const set = data.setOf(key);
  if (!set) return notFound(main, 'This exercise set is not available yet.');
  if (set.is_test) { location.hash = `#/solve/test/${key}`; return; }
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  let ids = set.ids;
  const s = store.get();
  const start = Number(q.get('start') || 0);
  if (!q.get('start')) {
    const firstUnsolved = ids.findIndex((id) => !(s.ex[id] && s.ex[id].attempts));
    return runSession(main, { title: data.setTitle(key), ids, mode: 'practice', back: '#/solve', startAt: firstUnsolved > 0 ? firstUnsolved : 0, setKey: key });
  }
  return runSession(main, { title: data.setTitle(key), ids, mode: 'practice', back: '#/solve', startAt: start, setKey: key });
}

export function renderReview(main) {
  const ids = srs.reviewQueue();
  if (!ids.length) {
    const page = h('div', { class: 'page' }, pageHead('Review queue', 'Nothing is due today.'),
      h('p', null, 'Solved exercises come back after 1, 3, 7, 21 and 60 days; a miss comes back tomorrow.'),
      h('p', null, h('a', { class: 'btn primary', href: '#/solve' }, 'Choose a set')));
    main.appendChild(page);
    return;
  }
  return runSession(main, { title: 'Review queue', ids, mode: 'review', back: '#/solve' });
}

export function renderMixed(main) {
  const ids = srs.mixedSet(12);
  if (!ids.length) return notFound(main, 'No exercises available yet.');
  return runSession(main, { title: 'Mixed practice', ids, mode: 'practice', back: '#/solve' });
}

export function renderPersonal(main) {
  const ids = srs.interleave(Object.keys(store.get().personal));
  if (!ids.length) return notFound(main, 'Add moments from your analysed games to the journal first.');
  return runSession(main, { title: 'Positions from your games', ids, mode: 'practice', back: '#/journal' });
}

export function renderSingle(main, { id }) {
  if (!data.exercise(id)) return notFound(main, 'Exercise not found.');
  return runSession(main, { title: 'Exercise', ids: [id], mode: 'practice', back: '#/solve' });
}

export function renderTest(main, { key }) {
  const set = data.setOf(key);
  if (!set) return notFound(main, 'This stage test is not available yet.');
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  if (q.get('go') !== '1') {
    const part = data.partByTest(key);
    const hist = store.get().tests[key] || [];
    const page = h('div', { class: 'page narrow' }, pageHead(data.setTitle(key), part ? `${part.name} · ${part.title} · Stage ${part.stage}` : ''),
      h('section', { class: 'card' },
        h('p', null, `${set.ids.length} positions. No hints and one attempt each: your first move counts. You see your score at the end.`),
        h('ul', null, h('li', null, '80% or more — move on to the next part.'), h('li', null, '60–79% — review the chapters of the positions you missed.'), h('li', null, 'Below 60% — repeat the part’s exercises before retesting.')),
        h('a', { class: 'btn primary', href: `#/solve/test/${key}?go=1`, id: 'start-test' }, 'Start the test')),
      hist.length ? h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Previous attempts'),
        h('ul', null, hist.slice().reverse().map((t) => h('li', null, `${new Date(t.at).toLocaleDateString()}: ${t.score}/${t.n} (${Math.round((t.score / t.n) * 100)}%)`)))) : null);
    main.appendChild(page);
    return;
  }
  return runSession(main, { title: data.setTitle(key), ids: set.ids, mode: 'test', back: `#/solve/test/${key}`, setKey: key });
}

function notFound(main, msg) {
  main.appendChild(h('div', { class: 'page' }, pageHead('Solve', msg), h('p', null, h('a', { href: '#/solve' }, '← Solve'))));
}

// ---------------------------------------------------------------- session runner
function runSession(main, cfg) {
  const page = h('div', { class: 'page solve-page' });
  main.appendChild(page);
  const results = [];
  let idx = cfg.startAt || 0;
  let solver = null;
  const head = h('div', { class: 'solve-head' });
  const body = h('div', { class: 'solve-body' });
  page.append(head, body);

  function header() {
    head.innerHTML = '';
    head.append(h('a', { class: 'back', href: cfg.back }, '←'), h('div', null, h('h1', { class: 'solve-title' }, cfg.title),
      h('p', { class: 'solve-count', id: 'solve-count' }, cfg.ids.length > 1 ? `${Math.min(idx + 1, cfg.ids.length)} / ${cfg.ids.length}` : '')),
    cfg.mode === 'test' ? h('span', { class: 'pill' }, 'Test mode') : null);
  }

  function next() {
    if (solver) solver.destroy();
    if (idx >= cfg.ids.length) return finish();
    header();
    body.innerHTML = '';
    solver = new Solver(body, data.exercise(cfg.ids[idx]), {
      mode: cfg.mode,
      onDone: (r) => { results.push({ id: cfg.ids[idx], ...r }); },
      onNext: () => { idx++; next(); },
      last: idx === cfg.ids.length - 1,
    });
  }

  function finish() {
    header();
    body.innerHTML = '';
    const ok = results.filter((r) => r.ok).length;
    const n = results.length;
    if (cfg.mode === 'test') return testSummary(body, cfg, results);
    body.appendChild(h('section', { class: 'card summary', id: 'session-summary' },
      h('h2', { class: 'card-title' }, 'Session complete'),
      h('p', { class: 'big-num' }, `${ok} / ${n}`), h('p', { class: 'muted' }, 'solved without a wrong move or revealing the solution'),
      results.some((r) => !r.ok) ? h('p', null, 'Missed positions come back in your review queue tomorrow.') : h('p', null, 'Clean run. These come back later at a longer interval.'),
      h('div', { class: 'row' }, h('a', { class: 'btn primary', href: cfg.back }, 'Done'), cfg.setKey ? h('a', { class: 'btn ghost', href: `#/read/ch/${cfg.setKey}` }, 'Back to the chapter') : null)));
  }
  next();
  return () => { if (solver) solver.destroy(); };
}

function testSummary(body, cfg, results) {
  const key = cfg.setKey;
  const n = results.length;
  const score = results.filter((r) => r.ok).length;
  const ratio = n ? score / n : 0;
  const missed = results.filter((r) => !r.ok).map((r) => r.id);
  store.update((s) => { (s.tests[key] = s.tests[key] || []).push({ at: new Date().toISOString(), score, n, missed }); });
  srs.checkBadges();
  const part = data.partByTest(key);
  const partCh = part ? part.chapters : [];
  let guidance, links = [];
  if (ratio >= 0.8) {
    guidance = 'Excellent — you are ready to move on to the next part.';
    const nextPart = part ? data.parts().find((p) => p.num === part.num + 1) : null;
    const firstNext = nextPart && nextPart.chapters.find((c) => data.chapter(c));
    if (firstNext) links.push(h('a', { class: 'btn primary', href: `#/read/ch/${firstNext}` }, `Start chapter ${firstNext}`));
  } else if (ratio >= 0.6) {
    const chs = new Set();
    for (const id of missed) {
      const ex = data.exercise(id);
      let found = [];
      for (const t of ex.tags || []) { found = data.chaptersForTag(t).filter((c) => !partCh.length || partCh.includes(c)); if (found.length) break; }
      if (!found.length) for (const t of ex.tags || []) { found = data.chaptersForTag(t); if (found.length) break; }
      found.slice(0, 1).forEach((c) => chs.add(c));
    }
    guidance = chs.size ? 'Review the chapters behind the positions you missed, then retest:' : 'Review the chapters of this part behind the positions you missed, then retest.';
    links = [...chs].sort((a, b) => a - b).map((c) => h('a', { class: 'btn ghost', href: `#/read/ch/${c}` }, `Chapter ${c}`));
  } else {
    guidance = 'Repeat this part’s exercises before you retest — the patterns need more repetitions.';
    links = partCh.filter((c) => data.setOf(String(c))).map((c) => h('a', { class: 'btn ghost', href: `#/solve/set/${c}` }, `Exercises ${c}`));
  }
  body.appendChild(h('section', { class: 'card summary', id: 'test-summary' },
    h('h2', { class: 'card-title' }, 'Test result'),
    h('p', { class: 'big-num', id: 'test-score' }, `${score} / ${n}`),
    h('p', { class: 'muted' }, `${Math.round(ratio * 100)}%`),
    h('p', { class: 'guidance', id: 'test-guidance' }, guidance),
    links.length ? h('div', { class: 'row wrap' }, links) : null,
    missed.length ? h('div', null, h('h3', null, 'Missed'), h('ul', null, missed.map((id) => h('li', null, h('a', { href: `#/solve/ex/${id}` }, `Exercise ${data.exercise(id).label || id}`))))) : null,
    h('p', null, h('a', { href: '#/solve' }, '← Solve'))));
}

// ---------------------------------------------------------------- single exercise solver
export class Solver {
  constructor(el, ex, opts) {
    this.ex = ex;
    this.opts = opts;
    this.ply = 0;
    this.wrong = 0;
    this.hint = false;
    this.revealed = false;
    this.done = false;
    this.timers = [];
    const solverColor = ex.fen.split(' ')[1] || 'w';
    this.color = solverColor;
    const test = opts.mode === 'test';
    const wrap = h('div', { class: 'solver', 'data-ex': ex.id });
    const boardCol = h('div', { class: 'solver-board' });
    const top = h('div', { class: 'solver-top' });
    const side = h('div', { class: 'solver-side' });
    wrap.append(top, boardCol, side);
    el.appendChild(wrap);
    this.gb = new GameBoard(boardCol, {
      fen: ex.fen, orientation: solverColor === 'w' ? 'white' : 'black', movable: () => !this.done && this.ply % 2 === 0,
      onAttempt: (m) => this.attempt(m), onMove: (m) => this.accepted(m), label: 'Exercise board',
    });
    const meta = h('p', { class: 'ex-meta' }, h('span', { class: 'ex-num' }, ex.label || ''), h('span', { class: 'ex-type' }, data.TYPE_LABELS[ex.type] || ex.type || ''),
      ex.difficulty ? h('span', { class: 'ex-diff', title: `difficulty ${ex.difficulty} of 5`, 'aria-label': `difficulty ${ex.difficulty} of 5` }, diffDots(ex.difficulty)) : null);
    const turn = h('p', { class: 'turn-line' }, h('span', { class: 'turn-dot ' + solverColor }), solverColor === 'w' ? 'White to move' : 'Black to move');
    const q = h('div', { class: 'ex-question', html: ex.question_html || esc(ex.question || '') });
    this.status = h('p', { class: 'solve-status', id: 'solve-status', role: 'status', 'aria-live': 'polite' }, test ? 'Your first move counts.' : 'Your move.');
    this.hintBox = h('p', { class: 'hint-box', id: 'hint-box', hidden: true });
    this.feedback = h('div', { class: 'feedback', id: 'feedback', hidden: true });
    this.btnHint = h('button', { class: 'btn ghost', type: 'button', id: 'btn-hint', onclick: () => this.showHint() }, 'Hint');
    this.btnSol = h('button', { class: 'btn ghost', type: 'button', id: 'btn-solution', onclick: () => this.showSolution() }, 'Show solution');
    this.btnNext = h('button', { class: 'btn primary', type: 'button', id: 'btn-next', hidden: true, onclick: () => opts.onNext() }, opts.last ? 'Finish' : 'Next →');
    this.btnSkip = h('button', { class: 'btn ghost', type: 'button', id: 'btn-skip', onclick: () => this.skip() }, 'Skip');
    const actions = h('div', { class: 'row wrap solve-actions' }, test ? null : this.btnHint, test ? null : this.btnSol, test ? this.btnSkip : null, this.btnNext);
    top.append(meta, turn, q);
    side.append(this.status, this.hintBox, actions, this.feedback);
  }

  attempt(m) {
    if (this.done) return false;
    const ok = acceptedAt(this.ex, this.ply).includes(norm(m.san));
    if (ok) return true;
    this.wrong++;
    const w = (this.ex.wrong || []).find((x) => norm(x.move) === norm(m.san));
    if (this.opts.mode === 'test') {
      this.setStatus(`${m.san} — not the answer.`, 'bad');
      this.finish(false, m.san);
      return false;
    }
    this.setStatus(w ? `${m.san}? ${w.why}` : `${m.san} — not the best. Try again.`, 'bad', w ? w.why : null);
    return false;
  }

  accepted(m) {
    const expected = this.ex.solution[this.ply];
    this.ply++;
    if (norm(m.san) !== norm(expected) || this.ply >= this.ex.solution.length) {
      // an accepted alternative ends the line (the book's continuation may no longer apply)
      const alt = norm(m.san) !== norm(expected);
      this.setStatus(alt ? `${m.san} is also correct.` : this.ex.solution.length > 1 ? 'Correct — line complete.' : 'Correct!', 'good');
      return this.finish(this.wrong === 0 && !this.revealed, null, alt);
    }
    this.setStatus(`${m.san} — correct. Opponent replies…`, 'good');
    this.gb.locked = true;
    this.timers.push(setTimeout(() => {
      const reply = this.ex.solution[this.ply];
      const r = this.gb.play(reply);
      this.gb.locked = false;
      this.ply++;
      if (!r) return this.finish(this.wrong === 0, null);
      if (this.ply >= this.ex.solution.length) return this.finish(this.wrong === 0 && !this.revealed);
      this.setStatus(`${r.san}. Your move — keep going.`, '');
    }, 400));
  }

  setStatus(text, cls, why) {
    this.status.textContent = text;
    this.status.className = 'solve-status ' + (cls || '');
    if (why) this.status.dataset.why = why; else delete this.status.dataset.why;
  }

  showHint() {
    if (this.done) return;
    this.hint = true;
    this.hintBox.hidden = false;
    this.hintBox.innerHTML = '<span class="label">Hint</span> ' + esc(this.ex.hint || 'Start with every check, capture and threat — for both sides.');
  }

  showSolution() {
    if (this.done && !this.revealed) return;
    this.revealed = true;
    this.gb.locked = true;
    this.gb.load(this.ex.fen);
    this.setStatus('Solution:', '');
    const line = this.ex.solution.slice();
    line.forEach((san, i) => {
      this.timers.push(setTimeout(() => {
        this.gb.play(san);
        if (i === line.length - 1) { this.gb.locked = true; this.finish(false, null, false, true); }
      }, 600 * (i + 1)));
    });
    this.btnSol.disabled = true;
    this.btnHint.disabled = true;
  }

  skip() {
    if (this.done) return;
    this.finish(false, 'skipped');
  }

  finish(ok, wrongMove, alt, viaSolution) {
    if (this.done) return;
    this.done = true;
    this.gb.locked = true;
    const r = { ok: !!ok, hint: this.hint, test: this.opts.mode === 'test' };
    if (!this.ex.id.startsWith('demo')) srs.record(this.ex.id, r);
    if (this.opts.onDone) this.opts.onDone(r);
    this.btnHint.disabled = true;
    this.btnSol.disabled = true;
    this.btnSkip.hidden = true;
    this.btnNext.hidden = false;
    setTimeout(() => this.btnNext.focus({ preventScroll: true }), 0);
    const ex = this.ex;
    const solLine = solutionText(ex);
    const fb = this.feedback;
    fb.hidden = false;
    fb.innerHTML = '';
    const headline = ok ? (this.hint ? 'Solved with a hint' : 'Solved first try') : (viaSolution ? 'Solution shown' : this.opts.mode === 'test' ? 'Missed' : wrongMove === 'skipped' ? 'Skipped' : 'Solved after a miss');
    fb.className = 'feedback ' + (ok ? 'good' : 'bad');
    fb.append(h('p', { class: 'fb-head', id: 'fb-head' }, headline),
      h('p', { class: 'fb-line' }, h('span', { class: 'label' }, 'Solution '), solLine),
      ex.explanation_html ? h('div', { class: 'fb-expl', html: ex.explanation_html }) : null,
      ex.objective ? h('p', { class: 'fb-obj' }, h('span', { class: 'label' }, 'Skill '), ex.objective) : null,
      (ex.tags || []).length ? h('p', { class: 'tags' }, ex.tags.map((t) => h('span', { class: 'tag' }, data.tagLabel(t)))) : null,
      !ok && this.opts.mode !== 'test' ? h('p', { class: 'muted small' }, 'This position returns in your review queue tomorrow.') : null,
      ok && !this.hint ? h('p', { class: 'muted small' }, `Next review in ${srs.INTERVALS[Math.max(0, store.get().ex[ex.id] ? store.get().ex[ex.id].step : 0)]} day(s).`) : null);
    if (this.opts.mode === 'test' && !ok) this.gb.load(ex.fen);
  }

  destroy() { for (const t of this.timers) clearTimeout(t); this.timers = []; }
}

export function solutionText(ex) {
  try {
    const c = new Chess(ex.fen);
    const parts = [];
    ex.solution.forEach((san, i) => {
      const fm = c.moveNumber();
      const white = c.turn() === 'w';
      const m = c.move(san);
      parts.push((white ? `${fm}.` : i === 0 ? `${fm}…` : '') + m.san);
    });
    return parts.join(' ');
  } catch (_) {
    return ex.solution.join(' ');
  }
}
