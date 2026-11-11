// Reader: table of contents, chapters and documents with live boards and clickable move lines.
import * as data from './data.js';
import * as store from './store.js';
import * as srs from './srs.js';
import { Board, renderDiagram } from './board.js';
import { h, modal, toast, pageHead } from './ui.js';

export function analysisHref(fen, orientation) {
  return `#/analysis?fen=${encodeURIComponent(fen)}${orientation ? '&orientation=' + orientation : ''}`;
}

export function renderToc(main) {
  const page = h('div', { class: 'page toc' });
  page.appendChild(pageHead('Read', `${data.book.meta.title} — ${data.book.meta.subtitle || ''}`));
  const s = store.get();
  const docs = data.docs();
  const docLink = (d) => h('li', { class: 'toc-doc' }, h('a', { href: `#/read/doc/${d.slug}` }, d.title), s.docsRead[d.slug] ? h('span', { class: 'tick', 'aria-label': 'read' }, '✓') : null);
  const front = docs.filter((d) => d.kind === 'front');
  if (front.length) page.appendChild(h('section', { class: 'toc-part' }, h('h2', null, 'Before you begin'), h('ul', { class: 'toc-list' }, front.map(docLink))));
  if (!data.chapters().length) {
    page.appendChild(h('p', { class: 'notice' }, 'The chapters of this edition are still being prepared. The exercises, cheat sheets and the 90-day plan are already available.'));
  }
  for (const p of data.parts()) {
    const items = p.chapters.map((n) => {
      const c = data.chapter(n);
      if (!c) return h('li', { class: 'toc-ch unavailable' }, h('span', { class: 'toc-n' }, n), h('span', { class: 'toc-t' }, `Chapter ${n}`), h('span', { class: 'toc-state' }, 'in preparation'));
      const st = srs.chapterState(n);
      const state = st.mastered ? 'mastered' : st.read ? 'read' : '';
      return h('li', { class: 'toc-ch' + (state ? ' ' + state : '') },
        h('span', { class: 'toc-n' }, n),
        h('a', { class: 'toc-t', href: `#/read/ch/${n}` }, c.title),
        h('span', { class: 'toc-state' }, st.mastered ? 'Mastered' : st.read ? `Read · ${st.firstOk}/${st.n}` : ''));
    });
    const sec = h('section', { class: 'toc-part' },
      h('p', { class: 'toc-kicker' }, `${p.name} · Stage ${p.stage}`),
      h('h2', null, p.title),
      p.intro ? h('p', { class: 'toc-intro' }, p.intro) : null,
      h('ol', { class: 'toc-list' }, items),
      p.test && data.setOf(p.test) ? h('p', { class: 'toc-test' }, h('a', { class: 'btn small ghost', href: `#/solve/test/${p.test}` }, `Stage ${p.num} test →`)) : null);
    page.appendChild(sec);
  }
  const back = docs.filter((d) => d.kind !== 'front');
  if (back.length) page.appendChild(h('section', { class: 'toc-part' }, h('h2', null, 'Reference'), h('ul', { class: 'toc-list' }, back.map(docLink))));
  main.appendChild(page);
}

export function renderChapter(main, { n }) {
  const c = data.chapter(n);
  const page = h('div', { class: 'page reader' });
  if (!c) {
    page.appendChild(pageHead(`Chapter ${n}`, 'This chapter is still in preparation.'));
    if (data.setOf(String(n))) page.appendChild(h('p', null, h('a', { class: 'btn primary', href: `#/solve/set/${n}` }, 'Solve its exercises')));
    page.appendChild(h('p', null, h('a', { href: '#/read' }, '← Contents')));
    main.appendChild(page);
    return;
  }
  const part = data.partOf(c.n);
  const st = srs.chapterState(c.n);
  const opener = h('header', { class: 'chapter-opener' },
    h('p', { class: 'chapter-kicker' }, `Chapter ${c.n}`, c.stage ? h('span', { class: 'stage-badge' }, `Stage ${c.stage}`) : null),
    h('h1', { class: 'chapter-title', id: `ch-${c.n}` }, c.title),
    c.subtitle ? h('p', { class: 'chapter-subtitle' }, c.subtitle) : null,
    c.objectives && c.objectives.length ? h('div', { class: 'objectives' }, h('p', { class: 'obj-head' }, 'You will learn to'), h('ul', { html: c.objectives.map((o) => `<li>${o}</li>`).join('') })) : null,
    c.next_game ? h('aside', { class: 'box box-nextgame opener-next', html: `<p class="box-head"><span class="box-label">In your next game</span></p><p>${c.next_game}</p>` }) : null);
  const crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: '#/read' }, 'Contents'), part ? h('span', null, ` / ${part.name}: ${part.title}`) : null);
  const article = h('article', { class: 'book', html: c.html });
  page.append(crumbs, h('div', { class: 'book' }, opener), article);
  hydrate(article);

  const markBtn = h('button', { class: 'btn ' + (st.read ? 'ghost' : 'primary'), type: 'button', id: 'mark-complete', 'aria-pressed': st.read ? 'true' : 'false' }, st.read ? '✓ Lesson complete' : 'Mark lesson complete');
  markBtn.addEventListener('click', () => {
    store.update((s) => {
      if (s.read[c.n]) delete s.read[c.n];
      else { s.read[c.n] = { at: new Date().toISOString() }; store.logActivity('lessons'); }
    });
    srs.checkBadges();
    const on = !!store.get().read[c.n];
    markBtn.textContent = on ? '✓ Lesson complete' : 'Mark lesson complete';
    markBtn.className = 'btn ' + (on ? 'ghost' : 'primary');
    markBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) toast('Lesson marked complete. Now solve its exercises.');
  });
  const set = data.setOf(String(c.n));
  const prev = data.chapters().filter((x) => x.n < c.n).pop();
  const next = data.chapters().find((x) => x.n > c.n);
  page.appendChild(h('footer', { class: 'chapter-end' },
    h('div', { class: 'end-actions' }, markBtn,
      set && set.ids.length ? h('a', { class: 'btn primary', href: `#/solve/set/${c.n}`, id: 'chapter-exercises' }, `Solve the ${set.ids.length} exercises →`) : null),
    set && set.ids.length ? h('p', { class: 'muted' }, `Mastery: lesson read + at least 80% first-try accuracy on the set (now ${st.firstOk}/${st.n}).`) : null,
    h('nav', { class: 'prevnext', 'aria-label': 'Chapters' },
      prev ? h('a', { href: `#/read/ch/${prev.n}`, rel: 'prev' }, `← ${prev.n}. ${prev.title}`) : h('span'),
      next ? h('a', { href: `#/read/ch/${next.n}`, rel: 'next' }, `${next.n}. ${next.title} →`) : h('span'))));
  main.appendChild(page);
  scrollToAnchor();
}

export function renderDoc(main, { slug }) {
  const d = data.doc(slug);
  const page = h('div', { class: 'page reader' });
  if (!d) { page.appendChild(pageHead('Not found', 'This document is not part of this edition.')); main.appendChild(page); return; }
  page.appendChild(h('nav', { class: 'crumbs' }, h('a', { href: '#/read' }, 'Contents')));
  const article = h('article', { class: 'book doc' }, h('h1', { class: 'doc-title' }, d.title));
  article.insertAdjacentHTML('beforeend', d.html);
  page.appendChild(article);
  hydrate(article);
  store.update((s) => { s.docsRead[slug] = { at: new Date().toISOString() }; });
  main.appendChild(page);
}

function scrollToAnchor() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const id = q.get('at');
  if (id) setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView(); }, 50);
}

// Turn placeholders into boards; moves into buttons.
export function hydrate(root) {
  for (const fig of root.querySelectorAll('figure.diagram')) {
    renderDiagram(fig);
    const fen = fig.dataset.fen;
    const btn = h('a', { class: 'open-board', href: analysisHref(fen, fig.dataset.orientation) }, 'Open on board');
    const cap = fig.querySelector('figcaption');
    if (cap) cap.appendChild(btn); else fig.appendChild(h('figcaption', null, btn));
  }
  for (const line of root.querySelectorAll('.line')) {
    const mvs = [...line.querySelectorAll('.mv')];
    mvs.forEach((mv, i) => {
      mv.setAttribute('role', 'button');
      mv.setAttribute('tabindex', '0');
      mv.setAttribute('aria-label', `Show position after ${mv.textContent}`);
      const open = (e) => { e.preventDefault(); openLine(line, i); };
      mv.addEventListener('click', open);
      mv.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); });
    });
  }
  for (const t of root.querySelectorAll('table')) {
    if (!t.parentElement.classList.contains('table-wrap')) {
      const w = h('div', { class: 'table-wrap' });
      t.replaceWith(w);
      w.appendChild(t);
    }
  }
}

export function openLine(line, index) {
  const mvs = [...line.querySelectorAll('.mv')];
  const start = line.dataset.start;
  const fig = line.closest('.line').querySelector('figure.diagram');
  const orientation = fig ? fig.dataset.orientation : (start && start.split(' ')[1] === 'b' ? 'black' : 'white');
  const m = modal('Position', { wide: false });
  const host = h('div', { class: 'line-board' });
  const board = new Board(host, { orientation, interactive: false, label: 'Line position' });
  const list = h('p', { class: 'line-list moves' });
  const items = [];
  for (const node of line.querySelector('.moves').childNodes) {
    if (node.nodeType === 1 && node.classList.contains('mv')) {
      const k = items.length;
      const b = h('button', { class: 'mvb', type: 'button', onclick: () => show(k) }, node.textContent);
      items.push(b);
      list.appendChild(b);
    } else if (node.nodeType === 1 && node.classList.contains('mn')) {
      list.appendChild(h('span', { class: 'mn' }, node.textContent));
    } else list.appendChild(document.createTextNode(' '));
  }
  let cur = index;
  const openBtn = h('a', { class: 'btn small ghost', href: '#' }, 'Open on board');
  const label = h('p', { class: 'line-label', 'aria-live': 'polite' });
  const ctrl = h('div', { class: 'stepper' },
    h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Start position', onclick: () => show(-1) }, '|‹'),
    h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Previous move', 'data-step': 'prev', onclick: () => show(Math.max(-1, cur - 1)) }, '‹'),
    h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Next move', 'data-step': 'next', onclick: () => show(Math.min(mvs.length - 1, cur + 1)) }, '›'),
    h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Last move', onclick: () => show(mvs.length - 1) }, '›|'),
    openBtn);
  function show(i) {
    const first = cur;
    cur = i;
    const fen = i < 0 ? start : mvs[i].dataset.fen;
    const uci = i < 0 ? null : mvs[i].dataset.uci;
    board.setPosition(fen, { lastMove: uci ? [uci.slice(0, 2), uci.slice(2, 4)] : null, animate: Math.abs(first - i) === 1 });
    items.forEach((b, k) => b.classList.toggle('on', k === i));
    label.textContent = i < 0 ? 'Start position' : `After ${mvs[i].textContent}`;
    openBtn.setAttribute('href', analysisHref(fen, orientation));
  }
  openBtn.addEventListener('click', () => m.close());
  m.body.append(host, label, ctrl, list);
  m.el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(Math.min(mvs.length - 1, cur + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(Math.max(-1, cur - 1)); }
  });
  show(index);
}
