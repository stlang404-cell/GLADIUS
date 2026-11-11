// Dashboard (home) and the Progress view, which keeps four kinds of evidence strictly apart.
import * as store from './store.js';
import * as data from './data.js';
import * as srs from './srs.js';
import { planInfo, taskList, restartWeek, MINUTES } from './plan.js';
import { h, pct, fmtDate, toast } from './ui.js';

const CAVEAT = 'A learning stage is your position in the curriculum, not a rating. A handful of games or puzzles cannot measure a rating; only many rated games against people can.';

function stageCard() {
  const p = srs.learningStage();
  if (!p) return null;
  return h('section', { class: 'card stage-card', id: 'stage-card' },
    h('p', { class: 'kicker' }, 'Learning stage'),
    h('p', { class: 'stage-line' }, h('strong', null, `Stage ${p.num} · ${p.stage}`), h('span', null, ` — ${p.name}: ${p.title}`)),
    h('p', { class: 'small muted' }, CAVEAT));
}

function recCard() {
  const r = srs.recommendation();
  return h('section', { class: 'card accent rec', id: 'next-lesson' },
    h('p', { class: 'kicker' }, 'Next recommended'),
    h('h2', { class: 'rec-title' }, r.title),
    h('p', { class: 'small' }, r.why),
    h('a', { class: 'btn primary', href: r.href, id: 'rec-go' }, r.kind === 'review' ? 'Start review' : r.kind === 'exercises' ? 'Solve' : r.kind === 'play' ? 'Play' : 'Open lesson'));
}

function todayCard(rerender) {
  const info = planInfo();
  const s = store.get();
  const card = h('section', { class: 'card today', id: 'today' }, h('p', { class: 'kicker' }, 'Today’s assignment · 90-day plan'));
  if (!info.plan) { card.appendChild(h('p', { class: 'muted' }, 'The plan is not part of this build.')); return card; }
  if (!info.start) {
    const inp = h('input', { type: 'date', id: 'start-date', value: store.today() });
    card.append(h('p', null, 'Set the day you start (or started) the 90-day plan. The day number follows from it.'),
      h('div', { class: 'row wrap' }, h('label', { for: 'start-date', class: 'sr-only' }, 'Start date'), inp,
        h('button', { class: 'btn primary', type: 'button', id: 'set-start', onclick: () => { store.update((st) => { st.settings.startDate = inp.value || store.today(); }); rerender(); } }, 'Start the plan')));
    return card;
  }
  if (info.notStarted) { card.appendChild(h('p', null, `Your plan starts on ${fmtDate(info.start)}.`)); return card; }
  if (info.finished) { card.appendChild(h('p', null, 'You have finished the 90 days. Keep the loop: review queue, one slow game, analysis, journal.')); return card; }
  const d = info.plan.days[info.day - 1];
  const minutes = String(s.settings.minutes || 30);
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Minutes today' }, MINUTES.map((m) => h('label', null,
    h('input', { type: 'radio', name: 'dmin', value: m, checked: m === minutes, onchange: () => { store.update((st) => { st.settings.minutes = Number(m); }); rerender(); } }), h('span', null, `${m}′`))));
  card.append(h('div', { class: 'row between wrap' }, h('h2', { class: 'card-title' }, `Day ${d.day} · ${d.title}`), seg));
  if (info.catchup) {
    const cu = info.catchup;
    card.appendChild(h('div', { class: 'notice', id: 'catchup' }, h('p', null, cu.text),
      cu.kind === 'weekly' && cu.day ? h('a', { class: 'btn small ghost', href: `#/plan?day=${cu.day}` }, `Open Day ${cu.day}`) : null,
      cu.kind === 'restart' ? h('button', { class: 'btn small ghost', type: 'button', id: 'restart-week', onclick: () => { restartWeek(cu.weekStart); toast(`Plan shifted: today is Day ${cu.weekStart}.`); rerender(); } }, `Restart Week ${cu.week}`) : null));
  }
  card.appendChild(taskList(d, minutes, () => {}));
  if (d.game_focus) card.appendChild(h('p', { class: 'small' }, h('strong', null, 'Game focus: '), d.game_focus));
  card.appendChild(h('p', { class: 'small' }, h('a', { href: `#/plan?day=${d.day}` }, 'See the whole plan →')));
  return card;
}

function statTile(label, value, sub, id) {
  return h('div', { class: 'stat', id }, h('p', { class: 'stat-label' }, label), h('p', { class: 'stat-value' }, value), sub ? h('p', { class: 'stat-sub' }, sub) : null);
}

function historyStrip() {
  const s = store.get();
  const t = store.today();
  const cells = [];
  let active = 0;
  for (let i = 29; i >= 0; i--) {
    const d = store.addDays(t, -i);
    const a = s.activity[d];
    const n = a ? (a.ex || 0) + (a.lessons || 0) * 3 + (a.games || 0) * 3 + (a.tasks || 0) : 0;
    if (n) active++;
    const lvl = n === 0 ? 0 : n < 4 ? 1 : n < 10 ? 2 : 3;
    cells.push(h('span', { class: `day-cell l${lvl}`, title: `${fmtDate(d)}: ${a ? `${a.ex || 0} exercises, ${a.lessons || 0} lessons, ${a.games || 0} games, ${a.tasks || 0} plan tasks` : 'no practice'}` }));
  }
  return h('section', { class: 'card', id: 'history' }, h('h2', { class: 'card-title' }, 'Training history'),
    h('div', { class: 'strip', role: 'img', 'aria-label': `Practice on ${active} of the last 30 days` }, cells),
    h('p', { class: 'small muted' }, `Practised on ${active} of the last 30 days · current streak ${srs.streak()} day${srs.streak() === 1 ? '' : 's'}.`));
}

function goalsCard(rerender) {
  const s = store.get();
  const list = h('ul', { class: 'goals', id: 'goals' });
  for (const g of s.profile.goals) {
    const id = 'goal-' + g.id;
    const cb = h('input', { type: 'checkbox', id, checked: !!g.done, onchange: () => { store.update((st) => { const x = st.profile.goals.find((y) => y.id === g.id); if (x) x.done = cb.checked; }); } });
    list.appendChild(h('li', null, cb, h('label', { for: id }, g.text),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove goal ' + g.text, onclick: () => { store.update((st) => { st.profile.goals = st.profile.goals.filter((y) => y.id !== g.id); }); rerender(); } }, '×')));
  }
  const inp = h('input', { type: 'text', id: 'goal-input', placeholder: 'e.g. No hanging pieces in my next 5 games', maxlength: 140 });
  const form = h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; store.update((st) => { st.profile.goals.push({ id: store.uid('goal'), text: v, done: false }); }); rerender(); } },
    h('label', { for: 'goal-input', class: 'sr-only' }, 'New goal'), inp, h('button', { class: 'btn small', type: 'submit' }, 'Add'));
  return h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Personal goals'),
    s.profile.goals.length ? list : h('p', { class: 'small muted' }, 'Process goals work best: habits you control, not rating targets.'), form);
}

function badgesCard() {
  const b = srs.badgeList();
  const got = b.filter((x) => x.got);
  return h('section', { class: 'card', id: 'badges' }, h('h2', { class: 'card-title' }, 'Milestones'),
    h('p', { class: 'small muted' }, 'Earned only through real practice.'),
    h('ul', { class: 'badges' }, b.map((x) => h('li', { class: x.got ? 'got' : '' }, h('span', { class: 'badge-mark', 'aria-hidden': 'true' }, x.got ? '◆' : '◇'),
      h('span', null, x.title), x.got && x.date ? h('span', { class: 'muted small' }, ` · ${fmtDate(x.date)}`) : null, h('span', { class: 'sr-only' }, x.got ? ' (earned)' : ' (not yet)')))),
    h('p', { class: 'small muted' }, `${got.length} of ${b.length} earned.`));
}

function weakCard() {
  const w = srs.weaknesses().slice(0, 3);
  const wt = srs.weakTags().slice(0, 3);
  const mastered = srs.masteredSkills();
  return h('section', { class: 'card', id: 'skills' }, h('h2', { class: 'card-title' }, 'Skills'),
    h('p', { class: 'small' }, h('strong', null, 'Mastered: '), mastered.length ? mastered.slice(0, 10).map(data.tagLabel).join(', ') : 'none yet — a skill counts once its chapter is mastered or you reach 80% first-try on it.'),
    h('p', { class: 'small' }, h('strong', null, 'Weakest: '), (w.length || wt.length) ? '' : 'not enough evidence yet.'),
    (w.length || wt.length) ? h('ul', { class: 'small' },
      w.map((x) => h('li', null, `${x.label} — ${x.n} journal/tagged mistakes`, ' → ', h('a', { href: data.chapter(x.chapters[0]) ? `#/read/ch/${x.chapters[0]}` : '#/journal' }, `Ch. ${x.chapters[0]}`))),
      wt.map((t) => h('li', null, `${data.tagLabel(t.tag)} — ${pct(t.acc)} first try`))) : null,
    h('a', { class: 'small', href: '#/journal' }, 'Journal & weakness list →'));
}

export function renderDashboard(main) {
  const rerender = () => { main.innerHTML = ''; renderDashboard(main); };
  const s = store.get();
  const ps = srs.puzzleStats();
  const due = srs.reviewQueue();
  const chs = data.chapters();
  const done = chs.filter((c) => s.read[c.n]).length;
  const mastered = chs.filter((c) => srs.chapterState(c.n).mastered).length;
  const page = h('div', { class: 'page dash' });
  page.appendChild(h('header', { class: 'page-head' }, h('p', { class: 'kicker' }, new Date(store.today() + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })),
    h('h1', null, data.book.meta.title || 'The Elo Blueprint')));
  const reviewCard = h('section', { class: 'card review-card', id: 'review-card' }, h('p', { class: 'kicker' }, 'Review queue'),
    h('p', { class: 'big-num', id: 'dash-due' }, String(due.length)), h('p', { class: 'small muted' }, due.length ? 'due today, mixed across chapters' : 'Nothing due — new exercises are waiting in Solve.'),
    due.length ? h('a', { class: 'btn primary', href: '#/solve/review', id: 'dash-review' }, 'Start review') : h('a', { class: 'btn ghost', href: '#/solve' }, 'Solve'));
  page.appendChild(h('div', { class: 'dash-grid' },
    h('div', { class: 'col-main' }, recCard(), todayCard(rerender)),
    h('div', { class: 'col-side' }, reviewCard, stageCard())));
  page.appendChild(h('div', { class: 'stats', id: 'stats' },
    statTile('Puzzle accuracy', pct(ps.acc), ps.attempted ? `first try, ${ps.attempted} exercises` : 'no exercises yet', 'stat-acc'),
    statTile('Lessons completed', `${done}/${chs.length || data.parts().reduce((n, p) => n + p.chapters.length, 0)}`, `${mastered} mastered`, 'stat-lessons'),
    statTile('Exercises solved', String(ps.solvedTotal), 'total correct solves', 'stat-solved'),
    statTile('Streak', `${srs.streak()} d`, 'consecutive practice days', 'stat-streak')));
  page.appendChild(h('div', { class: 'grid2' }, weakCard(), historyStrip()));
  page.appendChild(h('div', { class: 'grid2' }, goalsCard(rerender), badgesCard()));
  page.appendChild(h('p', { class: 'center' }, h('a', { class: 'btn ghost', href: '#/progress' }, 'Full progress: rating, puzzles, engine accuracy, mastery →')));
  main.appendChild(page);
  const fresh = srs.checkBadges();
  if (fresh.length) toast('Milestone: ' + fresh.map((b) => b.title).join(', '));
}

// ---------------------------------------------------------------- progress
function lineChart(points, label) {
  if (points.length < 2) return null;
  const W = 560, H = 160, P = 30;
  const vals = points.map((p) => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 50) { lo -= 25; hi += 25; }
  const t0 = new Date(points[0].d).getTime(), t1 = new Date(points[points.length - 1].d).getTime() || t0 + 1;
  const x = (d) => P + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (v) => H - P + 8 - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const dots = points.map((p) => `<circle cx="${x(p.d).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="5" fill="#7E6219" stroke="#FFFFFF" stroke-width="2"><title>${fmtDate(p.d)}: ${p.v}${p.site ? ' (' + p.site + ')' : ''}</title></circle>`).join('');
  const last = points[points.length - 1];
  return h('div', { class: 'chart', html: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    <line x1="${P}" x2="${W - P}" y1="${H - P + 8}" y2="${H - P + 8}" stroke="#E3D9C4"/>
    <text x="${P}" y="${H - 6}" font-size="12" fill="#57514A" font-family="Inter,sans-serif">${fmtDate(points[0].d)}</text>
    <text x="${W - P}" y="${H - 6}" font-size="12" fill="#57514A" text-anchor="end" font-family="Inter,sans-serif">${fmtDate(last.d)}</text>
    <text x="${P - 4}" y="${y(hi) + 4}" font-size="12" fill="#57514A" text-anchor="end" font-family="Inter,sans-serif">${Math.round(hi)}</text>
    <text x="${P - 4}" y="${y(lo) + 4}" font-size="12" fill="#57514A" text-anchor="end" font-family="Inter,sans-serif">${Math.round(lo)}</text>
    <path d="${path}" fill="none" stroke="#7E6219" stroke-width="2" stroke-linejoin="round"/>${dots}
    <text x="${x(last.d) - 8}" y="${y(last.v) - 10}" font-size="13" font-weight="600" fill="#2A2724" text-anchor="end" font-family="Inter,sans-serif">${last.v}</text></svg>` });
}

export function renderProgress(main) {
  const rerender = () => { main.innerHTML = ''; renderProgress(main); };
  const s = store.get();
  const page = h('div', { class: 'page' });
  page.appendChild(h('header', { class: 'page-head' }, h('h1', null, 'Progress'),
    h('p', { class: 'page-sub' }, 'Four different kinds of evidence, kept apart on purpose. None of them is an Elo estimate.')));

  // A. self-reported rating
  const ratings = s.profile.ratings.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const rIn = h('input', { type: 'number', id: 'rating-input', min: 100, max: 3000, step: 1, placeholder: 'e.g. 812', inputmode: 'numeric' });
  const dIn = h('input', { type: 'date', id: 'rating-date', value: store.today() });
  const siteIn = h('input', { type: 'text', id: 'rating-site', placeholder: 'Site / pool (e.g. Lichess rapid)', maxlength: 40 });
  const form = h('form', { class: 'row wrap', onsubmit: (e) => {
    e.preventDefault();
    const v = Number(rIn.value);
    if (!v || v < 100 || v > 3500) { toast('Enter the rating shown on your chess site.'); return; }
    store.update((st) => { st.profile.ratings.push({ date: dIn.value || store.today(), rating: v, site: siteIn.value.trim() }); });
    rerender();
  } }, h('label', { for: 'rating-input', class: 'sr-only' }, 'Rating'), rIn, h('label', { for: 'rating-date', class: 'sr-only' }, 'Date'), dIn,
    h('label', { for: 'rating-site', class: 'sr-only' }, 'Site'), siteIn, h('button', { class: 'btn small primary', type: 'submit' }, 'Log rating'));
  page.appendChild(h('section', { class: 'card', id: 'p-rating' }, h('p', { class: 'kicker' }, 'A · Self-reported online rating'),
    h('h2', { class: 'card-title' }, ratings.length ? `Latest: ${ratings[ratings.length - 1].rating}${ratings[ratings.length - 1].site ? ' · ' + ratings[ratings.length - 1].site : ''}` : 'No rating logged yet'),
    h('p', { class: 'small muted' }, 'Copied by you from your chess site. This is the only real rating here; log it weekly, not after every game.'),
    lineChart(ratings.map((r) => ({ d: r.date, v: r.rating, site: r.site })), 'Self-reported rating over time'),
    ratings.length ? h('details', null, h('summary', null, 'Rating log (table)'), h('div', { class: 'table-wrap' }, h('table', { class: 'compact' }, h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Rating'), h('th', null, 'Site'), h('th', null, ''))),
      h('tbody', null, ratings.slice().reverse().map((r) => h('tr', null, h('td', null, fmtDate(r.date)), h('td', null, String(r.rating)), h('td', null, r.site || ''),
        h('td', null, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete entry', onclick: () => { store.update((st) => { const i = st.profile.ratings.indexOf(st.profile.ratings.find((x) => x.date === r.date && x.rating === r.rating)); if (i >= 0) st.profile.ratings.splice(i, 1); }); rerender(); } }, '×')))))))) : null,
    form));

  // B. puzzle performance
  const ps = srs.puzzleStats();
  const rows = [1, 2, 3, 4, 5].map((d) => {
    const b = ps.byDiff[d];
    const v = b ? b.ok / b.n : null;
    return h('div', { class: 'hbar', title: b ? `Difficulty ${d}: ${b.ok} of ${b.n} first try` : `Difficulty ${d}: no attempts` },
      h('span', { class: 'hbar-l' }, `Difficulty ${d}`),
      h('span', { class: 'hbar-track' }, h('span', { class: 'hbar-fill', style: { width: v === null ? '0' : Math.max(2, v * 100) + '%' } })),
      h('span', { class: 'hbar-v' }, b ? `${pct(v)} · ${b.ok}/${b.n}` : '—'));
  });
  page.appendChild(h('section', { class: 'card', id: 'p-puzzles' }, h('p', { class: 'kicker' }, 'B · Puzzle performance'),
    h('h2', { class: 'card-title' }, ps.attempted ? `${pct(ps.acc)} first-try accuracy over ${ps.attempted} exercises` : 'No exercises attempted yet'),
    h('p', { class: 'small muted' }, 'First try = the first attempt ever at an exercise, with no wrong move and no hint. Book exercises are graded 1–5.'),
    h('div', { class: 'hbars', role: 'list' }, rows)));

  // C. engine accuracy from analysed games
  const mine = s.games.filter((g) => g.review && g.review.done && g.review.summary && (g.userColor || g.source === 'play'));
  const anyRev = s.games.filter((g) => g.review && g.review.done);
  let acpl = null, blunders = null;
  if (mine.length) {
    const sides = mine.map((g) => g.review.summary[g.userColor || 'w']);
    acpl = Math.round(sides.reduce((a, x) => a + x.acpl, 0) / sides.length);
    blunders = (sides.reduce((a, x) => a + x.blunder, 0) / sides.length).toFixed(1);
  }
  page.appendChild(h('section', { class: 'card', id: 'p-engine' }, h('p', { class: 'kicker' }, 'C · Engine accuracy from analysed games'),
    h('h2', { class: 'card-title' }, mine.length ? `Average centipawn loss ${acpl} · ${blunders} blunders per game` : 'No analysed games with your side set'),
    h('p', { class: 'small muted' }, `Measured by Stockfish lite at a fixed depth over ${mine.length} of your analysed game${mine.length === 1 ? '' : 's'}${anyRev.length > mine.length ? ` (${anyRev.length - mine.length} more need “which side were you?” set)` : ''}. Lower is better. It depends heavily on the opponent and the kind of position, so compare trends, not single games.`),
    mine.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'compact' }, h('thead', null, h('tr', null, h('th', null, 'Game'), h('th', null, 'Avg cp loss'), h('th', null, 'Mistakes'), h('th', null, 'Blunders'))),
      h('tbody', null, mine.slice(0, 10).map((g) => { const x = g.review.summary[g.userColor || 'w']; return h('tr', null, h('td', null, h('a', { href: `#/games/${g.id}` }, `${g.white} – ${g.black}`)), h('td', null, String(x.acpl)), h('td', null, String(x.mistake)), h('td', null, String(x.blunder))); })))) : null));

  // D. learning mastery
  const chs = data.chapters();
  const list = h('ul', { class: 'mastery' });
  for (const p of data.parts()) {
    for (const n of p.chapters) {
      const c = data.chapter(n);
      const st = srs.chapterState(n);
      if (!c && !st.n) continue;
      list.appendChild(h('li', null, h('span', { class: 'm-n' }, n), h('a', { href: c ? `#/read/ch/${n}` : `#/solve/set/${n}`, class: 'm-t' }, c ? c.title : data.setTitle(String(n))),
        h('span', { class: 'hbar-track', 'aria-hidden': 'true' }, h('span', { class: 'hbar-fill', style: { width: Math.round(st.progress * 100) + '%' } })),
        h('span', { class: 'm-v' }, st.mastered ? 'Mastered' : `${Math.round(st.progress * 100)}%`)));
    }
  }
  const masteredN = chs.filter((c) => srs.chapterState(c.n).mastered).length;
  page.appendChild(h('section', { class: 'card', id: 'p-mastery' }, h('p', { class: 'kicker' }, 'D · Learning mastery'),
    h('h2', { class: 'card-title' }, `${masteredN} of ${chs.length} available chapters mastered`),
    h('p', { class: 'small muted' }, 'Mastered = lesson read + at least 80% first-try accuracy on the chapter’s full exercise set. Bars: 40% for reading, 60% for exercise accuracy.'),
    list.childNodes.length ? list : h('p', { class: 'muted' }, 'No chapters available yet.')));

  const st = srs.learningStage();
  if (st) page.appendChild(h('section', { class: 'card', id: 'p-stage' }, h('p', { class: 'kicker' }, 'Learning stage (broad band)'),
    h('h2', { class: 'card-title' }, `Stage ${st.num}: ${st.stage}`), h('p', { class: 'small' }, CAVEAT)));
  main.appendChild(page);
}
