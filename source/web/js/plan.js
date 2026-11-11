// The 90-day plan: day calculation, catch-up guidance, task checklists and benchmarks.
import * as store from './store.js';
import * as data from './data.js';
import { h, pageHead, fmtDate, toast } from './ui.js';

export const MINUTES = ['15', '30', '60', '90'];

export function planInfo() {
  const plan = data.plan();
  const s = store.get();
  if (!plan || !plan.days || !plan.days.length) return { plan: null };
  const start = s.settings.startDate;
  if (!start) return { plan, start: null };
  const t = store.today();
  const raw = store.daysBetween(start, t) + 1;
  const day = Math.max(1, Math.min(plan.days.length, raw));
  return { plan, start, raw, day, finished: raw > plan.days.length, notStarted: raw < 1, catchup: catchUp(plan, start, t, day) };
}

function catchUp(plan, start, t, day) {
  const s = store.get();
  const active = Object.keys(s.activity).filter((d) => d < t && d >= start && Object.values(s.activity[d]).some((v) => v > 0)).sort();
  const last = active[active.length - 1] || null;
  const fromRef = last || store.addDays(start, -1);
  const missed = Math.max(0, store.daysBetween(fromRef, t) - 1);
  if (missed === 0) return null;
  const lastDay = last ? store.daysBetween(start, last) + 1 : 1;
  if (missed === 1) return { missed, kind: 'continue', text: 'You missed one day. No problem — just continue with today’s plan.' };
  if (missed <= 6) {
    const wk = plan.days.find((d) => d.day >= Math.max(1, lastDay + 1) && (d.type === 'weekly' || d.type === 'milestone'));
    return { missed, kind: 'weekly', day: wk ? wk.day : null, text: `You missed ${missed} days. Do the next weekly-review day${wk ? ` (Day ${wk.day})` : ''} first to consolidate, then continue with today’s plan.` };
  }
  const week = Math.ceil(Math.max(1, Math.min(lastDay, plan.days.length)) / 7);
  return { missed, kind: 'restart', week, weekStart: (week - 1) * 7 + 1, text: `You missed ${missed} days. Restart the current week (Week ${week}) rather than jumping ahead — the plan shifts so today is Day ${(week - 1) * 7 + 1}.` };
}

export function restartWeek(weekStart) {
  store.update((s) => { s.settings.startDate = store.addDays(store.today(), -(weekStart - 1)); });
}

function taskHref(kind, d) {
  if (d.test && (kind === 'solve' || kind === 'review' || d.type === 'milestone')) return data.setOf(d.test) ? `#/solve/test/${d.test}` : '#/solve';
  switch (kind) {
    case 'learn': return d.chapter ? `#/read/ch/${d.chapter}` : '#/read';
    case 'solve': return d.chapter && data.setOf(String(d.chapter)) ? `#/solve/set/${d.chapter}` : '#/solve/review';
    case 'review': return '#/solve/review';
    case 'play': return '#/play';
    case 'analyze': return '#/games';
    case 'fix': return '#/journal';
    default: return null;
  }
}

export function dayTasks(d, minutes) {
  const opts = (d.options && (d.options[minutes] || d.options['30'])) || [];
  return opts;
}

export function taskList(d, minutes, onChange) {
  const s = store.get();
  const checks = s.plan.checks[d.day] || {};
  const ul = h('ul', { class: 'tasks', 'data-day': d.day });
  dayTasks(d, minutes).forEach((t, i) => {
    const key = `${minutes}-${i}`;
    const id = `task-${d.day}-${key}`;
    const cb = h('input', { type: 'checkbox', id, checked: !!checks[key] });
    cb.addEventListener('change', () => {
      store.update((st) => {
        const c = st.plan.checks[d.day] || (st.plan.checks[d.day] = {});
        if (cb.checked) { c[key] = store.today(); store.logActivity('tasks'); } else delete c[key];
      });
      if (onChange) onChange();
    });
    const href = taskHref(t.kind, d);
    ul.appendChild(h('li', { class: 'task' + (checks[key] ? ' done' : '') }, cb,
      h('label', { for: id }, h('span', { class: 'task-kind k-' + t.kind }, t.kind), ' ', t.text),
      href ? h('a', { class: 'task-go', href, 'aria-label': 'Go: ' + t.text }, '→') : null));
  });
  return ul;
}

function benchmarksFor(plan, d) {
  if (!plan.benchmarks) return null;
  if (plan.benchmarks[String(d.day)]) return { day: d.day, items: plan.benchmarks[String(d.day)] };
  if (d.type === 'weekly' || d.type === 'milestone') {
    const next = Object.keys(plan.benchmarks).map(Number).sort((a, b) => a - b).find((k) => k >= d.day);
    if (next) return { day: next, items: plan.benchmarks[String(next)], upcoming: true };
  }
  return null;
}

export function dayDetail(plan, d, minutes, onChange) {
  const box = h('div', { class: 'day-detail' });
  const extra = [];
  if (d.read && d.read.length) extra.push(h('p', { class: 'small' }, h('strong', null, 'Read: '), d.read.join(' · ')));
  if (d.exercises && d.exercises.length) extra.push(h('p', { class: 'small' }, h('strong', null, 'Exercises: '), d.exercises.map((id, i) => [i ? ', ' : '', data.exercise(id) ? h('a', { href: `#/solve/ex/${id}` }, data.exercise(id).label || id) : id])));
  if (d.check_exercises && d.check_exercises.length) extra.push(h('p', { class: 'small' }, h('strong', null, 'Re-check: '), d.check_exercises.map((id, i) => [i ? ', ' : '', data.exercise(id) ? h('a', { href: `#/solve/ex/${id}` }, data.exercise(id).label || id) : id])));
  if (d.game_focus) extra.push(h('p', { class: 'small' }, h('strong', null, 'Game focus: '), d.game_focus));
  box.append(taskList(d, minutes, onChange), ...extra);
  const bm = benchmarksFor(plan, d);
  if (bm) box.appendChild(h('div', { class: 'benchmarks' }, h('p', { class: 'obj-head' }, bm.upcoming ? `Benchmarks for Day ${bm.day}` : 'Milestone benchmarks'), h('ul', null, bm.items.map((x) => h('li', null, x)))));
  return box;
}

export function renderPlan(main, params, query) {
  const info = planInfo();
  const s = store.get();
  const page = h('div', { class: 'page' });
  page.appendChild(pageHead('The 90-day plan', 'Thirteen weeks: study days, consolidation days, a weekly evaluation and a stage test at each milestone.'));
  if (!info.plan) { page.appendChild(h('p', null, 'The plan is not included in this build.')); main.appendChild(page); return; }
  const minutes = query.min || String(s.settings.minutes || 30);
  const startIn = h('input', { type: 'date', id: 'plan-start', value: s.settings.startDate || '' });
  startIn.addEventListener('change', () => { store.update((st) => { st.settings.startDate = startIn.value || null; }); toast('Start date saved.'); location.hash = '#/plan?t=' + Date.now(); });
  const minSel = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Minutes per day' }, MINUTES.map((m) => h('label', null,
    h('input', { type: 'radio', name: 'pmin', value: m, checked: m === minutes, onchange: () => { store.update((st) => { st.settings.minutes = Number(m); }); location.hash = `#/plan?min=${m}`; } }), h('span', null, `${m} min`))));
  page.appendChild(h('section', { class: 'card' }, h('div', { class: 'row wrap between' },
    h('p', null, h('label', { for: 'plan-start' }, 'Start date '), startIn),
    minSel),
  info.start ? h('p', { class: 'small muted' }, info.notStarted ? `Your plan starts on ${fmtDate(info.start)}.` : info.finished ? 'You have completed the 90 days. Keep the loop going: review queue, slow games, analysis.' : `Today is Day ${info.day} of ${info.plan.days.length}.`) : h('p', { class: 'small muted' }, 'Set a start date to see which day you are on.'),
  info.catchup ? h('p', { class: 'notice' }, info.catchup.text) : null));

  const selDay = Number(query.day || info.day || 1);
  const weeks = {};
  for (const d of info.plan.days) (weeks[d.week] = weeks[d.week] || []).push(d);
  const wrap = h('div', { class: 'plan-weeks' });
  for (const [w, days] of Object.entries(weeks)) {
    const sec = h('section', { class: 'plan-week' }, h('h2', { class: 'section-title' }, `Week ${w}`, h('span', { class: 'muted small' }, ` · Stage ${days[0].stage} (${days[0].range || ''})`)));
    const ul = h('ol', { class: 'plan-days' });
    for (const d of days) {
      const checks = s.plan.checks[d.day] || {};
      const nTasks = dayTasks(d, minutes).length;
      const nDone = Object.keys(checks).filter((k) => k.startsWith(minutes + '-')).length;
      const isToday = info.day === d.day && !info.notStarted && !info.finished;
      const open = d.day === selDay;
      const li = h('li', { class: 'plan-day' + (isToday ? ' today' : '') + (open ? ' open' : '') + ` t-${d.type}`, id: `day-${d.day}` },
        h('a', { class: 'pd-row', href: `#/plan?day=${d.day}&min=${minutes}&keep=1`, 'aria-expanded': String(open) },
          h('span', { class: 'pd-n' }, `Day ${d.day}`), h('span', { class: 'pd-t' }, d.title), isToday ? h('span', { class: 'pill gold' }, 'Today') : null,
          h('span', { class: 'pd-done muted small' }, nDone ? `${nDone}/${nTasks}` : '')));
      if (open) li.appendChild(dayDetail(info.plan, d, minutes, () => {}));
      ul.appendChild(li);
    }
    sec.appendChild(ul);
    wrap.appendChild(sec);
  }
  page.appendChild(wrap);
  main.appendChild(page);
  if (query.day) setTimeout(() => { const el = document.getElementById(`day-${selDay}`); if (el) el.scrollIntoView({ block: 'center' }); }, 30);
}
