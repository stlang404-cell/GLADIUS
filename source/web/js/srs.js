// Spaced repetition, exercise statistics, mastery, weaknesses, recommendations and badges.
import * as store from './store.js';
import * as data from './data.js';

export const INTERVALS = [1, 3, 7, 21, 60];

/**
 * Record a finished attempt.
 * r: {ok: solved without a wrong move and without revealing the solution, hint: used a hint, test: in a stage test}
 */
export function record(id, r) {
  const s = store.get();
  const now = new Date().toISOString();
  const t = store.today();
  const e = s.ex[id] || (s.ex[id] = { attempts: 0, ok: 0, fail: 0, hints: 0, firstTry: null, firstAt: now, step: -1 });
  const first = e.attempts === 0;
  e.attempts += 1;
  e.lastAt = now;
  e.last = r.ok ? 'ok' : 'fail';
  if (r.hint) { e.hints += 1; e.usedHint = true; }
  if (first) e.firstTry = !!(r.ok && !r.hint);
  if (r.ok) {
    e.ok += 1;
    e.step = r.hint ? Math.max(0, e.step) : Math.min(INTERVALS.length - 1, e.step + 1);
  } else {
    e.fail += 1;
    e.step = 0;
  }
  e.due = store.addDays(t, INTERVALS[Math.max(0, e.step)]);
  store.logActivity('ex');
  if (r.ok) store.logActivity('ok');
  store.save();
  checkBadges();
  return e;
}

export function dueIds(day = store.today()) {
  const s = store.get();
  return Object.entries(s.ex).filter(([id, e]) => e.due && e.due <= day && data.exercise(id)).map(([id]) => id);
}

// Interleave due items across sets (mixed practice): round-robin by set, most overdue first.
export function reviewQueue(day = store.today()) {
  const s = store.get();
  const ids = dueIds(day).sort((a, b) => (s.ex[a].due < s.ex[b].due ? -1 : s.ex[a].due > s.ex[b].due ? 1 : 0));
  return interleave(ids);
}

export function interleave(ids) {
  const groups = new Map();
  for (const id of ids) {
    const ex = data.exercise(id);
    const k = ex ? ex.set : '?';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(id);
  }
  const out = [];
  const lists = [...groups.values()];
  while (lists.some((l) => l.length)) for (const l of lists) if (l.length) out.push(l.shift());
  return out;
}

// Mixed review of already-seen exercises across chapters (for "Mixed review" sessions).
export function mixedSet(n = 12) {
  const s = store.get();
  const seen = Object.keys(s.ex).filter((id) => data.exercise(id));
  let pool = seen.length >= 6 ? seen : data.allExerciseIds();
  pool = pool.slice().sort(() => Math.random() - 0.5).slice(0, n);
  return interleave(pool);
}

// ---------------------------------------------------------------- stats
export function setStats(key) {
  const set = data.setOf(key);
  const s = store.get();
  if (!set) return { n: 0, attempted: 0, firstOk: 0, acc: null };
  let attempted = 0, firstOk = 0;
  for (const id of set.ids) {
    const e = s.ex[id];
    if (e && e.attempts) { attempted++; if (e.firstTry) firstOk++; }
  }
  return { n: set.ids.length, attempted, firstOk, acc: attempted ? firstOk / attempted : null, fullAcc: set.ids.length ? firstOk / set.ids.length : null };
}

export function chapterState(n) {
  const s = store.get();
  const read = !!s.read[n];
  const st = setStats(String(n));
  const mastered = read && st.n > 0 && st.attempted === st.n && st.firstOk / st.n >= 0.8;
  // simple progress: 40% for reading, 60% for first-try accuracy over the whole set
  const progress = (read ? 0.4 : 0) + (st.n ? 0.6 * Math.min(1, (st.firstOk / st.n) / 0.8) : (read ? 0.6 : 0));
  return { n, read, ...st, mastered, progress: Math.min(1, progress) };
}

export function puzzleStats() {
  const s = store.get();
  const byDiff = {};
  let attempted = 0, firstOk = 0, solvedTotal = 0;
  for (const [id, e] of Object.entries(s.ex)) {
    const ex = data.exercise(id);
    if (!ex || !e.attempts) continue;
    attempted++;
    if (e.firstTry) firstOk++;
    solvedTotal += e.ok;
    const d = ex.difficulty || 0;
    const b = byDiff[d] || (byDiff[d] = { n: 0, ok: 0 });
    b.n++;
    if (e.firstTry) b.ok++;
  }
  return { attempted, firstOk, acc: attempted ? firstOk / attempted : null, byDiff, solvedTotal };
}

export function tagStats() {
  const s = store.get();
  const tags = {};
  for (const [id, e] of Object.entries(s.ex)) {
    const ex = data.exercise(id);
    if (!ex || !e.attempts) continue;
    for (const t of ex.tags || []) {
      const x = tags[t] || (tags[t] = { tag: t, n: 0, firstOk: 0, attempts: 0 });
      x.n++;
      x.attempts += e.attempts;
      if (e.firstTry) x.firstOk++;
    }
  }
  return Object.values(tags).map((x) => ({ ...x, acc: x.n ? x.firstOk / x.n : null }));
}

export function weakTags() {
  return tagStats().filter((t) => t.attempts >= 4 && t.acc < 0.6).sort((a, b) => a.acc - b.acc);
}

export function masteredSkills() {
  const out = new Set();
  for (const c of data.chapters()) if (chapterState(c.n).mastered) for (const sk of c.skills || []) out.add(sk);
  for (const t of tagStats()) if (t.n >= 3 && t.acc >= 0.8) out.add(t.tag);
  return [...out];
}

// ---------------------------------------------------------------- weaknesses (journal)
export const CATEGORIES = {
  'hanging-piece': { label: 'Hanging piece', chapters: [3, 4] },
  'missed-tactic': { label: 'Missed tactic', chapters: [7, 8, 9, 10, 24] },
  'missed-mate': { label: 'Missed mate', chapters: [5, 11] },
  'king-safety': { label: 'King safety', chapters: [6, 21] },
  calculation: { label: 'Calculation', chapters: [14, 15, 24] },
  opening: { label: 'Opening', chapters: [6, 12, 13] },
  endgame: { label: 'Endgame', chapters: [5, 18, 23, 26] },
  'missed-win': { label: 'Missed win', chapters: [16] },
  conversion: { label: 'Conversion', chapters: [16] },
  positional: { label: 'Positional', chapters: [19, 20, 22, 25] },
  'time-psychology': { label: 'Time / psychology', chapters: [27] },
};

export function weaknesses() {
  const s = store.get();
  const cats = {};
  const add = (cat, cost, src) => {
    if (!CATEGORIES[cat]) return;
    const c = cats[cat] || (cats[cat] = { cat, n: 0, cost: 0, sources: { journal: 0, tags: 0 } });
    c.n++;
    c.cost += Math.min(1000, Math.max(0, cost || 0));
    c.sources[src]++;
  };
  const journaled = new Set();
  for (const j of s.journal) { add(j.category, j.cost ?? 150, 'journal'); journaled.add(j.gameId + ':' + j.ply); }
  for (const g of s.games) {
    for (const [ply, t] of Object.entries(g.tags || {})) {
      if (!t.cat || journaled.has(g.id + ':' + ply)) continue;
      const fl = g.review && g.review.flags ? g.review.flags.find((f) => f.ply === Number(ply)) : null;
      add(t.cat, fl ? fl.loss : 100, 'tags');
    }
  }
  return Object.values(cats).map((c) => {
    const avg = c.n ? c.cost / c.n : 0;
    return { ...c, avg, score: c.n * (avg / 100), label: CATEGORIES[c.cat].label, chapters: CATEGORIES[c.cat].chapters };
  }).sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- recommendation
// Due reviews first; then remedial chapter for a well-evidenced top weakness; else next incomplete chapter.
export function recommendation() {
  const due = reviewQueue();
  if (due.length) return { kind: 'review', n: due.length, href: '#/solve/review', title: `Review queue: ${due.length} due`, why: 'Spaced review comes first: these are exercises scheduled for today.' };
  const w = weaknesses()[0];
  if (w && w.n >= 3) {
    const ch = w.chapters.map((n) => data.chapter(n)).find((c) => c && !chapterState(c.n).mastered) || w.chapters.map((n) => data.chapter(n)).find(Boolean);
    if (ch) return { kind: 'remedial', chapter: ch.n, href: `#/read/ch/${ch.n}`, title: `Chapter ${ch.n} · ${ch.title}`, why: `Your journal shows ${w.n} “${w.label}” mistakes — your most costly pattern. This chapter targets it.` };
  }
  for (const c of data.chapters()) {
    const st = chapterState(c.n);
    if (!st.read) return { kind: 'next', chapter: c.n, href: `#/read/ch/${c.n}`, title: `Chapter ${c.n} · ${c.title}`, why: 'The next chapter you have not completed.' };
    if (!st.mastered && st.n) return { kind: 'exercises', chapter: c.n, href: `#/solve/set/${c.n}`, title: `Chapter ${c.n} exercises`, why: `Chapter mastery needs 80% first-try accuracy on its exercises (now ${st.firstOk}/${st.n}).` };
  }
  const anySet = data.chapterSets().find((k) => setStats(k).attempted < setStats(k).n);
  if (anySet) return { kind: 'exercises', href: `#/solve/set/${anySet}`, title: data.setTitle(anySet), why: 'Unsolved exercises are waiting.' };
  return { kind: 'play', href: '#/play', title: 'Play and analyse a game', why: 'You are up to date. Play a slow game, then analyse it.' };
}

// Learning stage: the part of the first not-yet-mastered chapter (a curriculum position, not a rating).
export function learningStage() {
  const parts = data.parts();
  for (const p of parts) {
    const avail = p.chapters.filter((n) => data.chapter(n) || data.setOf(String(n)));
    const done = avail.length && avail.every((n) => chapterState(n).mastered);
    const testPassed = (store.get().tests[p.test] || []).some((t) => t.score / t.n >= 0.8);
    if (!(done || testPassed)) return p;
  }
  return parts[parts.length - 1];
}

// ---------------------------------------------------------------- streaks & badges
export function streak() {
  const s = store.get();
  let n = 0;
  let d = store.today();
  if (!s.activity[d]) d = store.addDays(d, -1);
  while (s.activity[d] && Object.values(s.activity[d]).some((v) => v > 0)) { n++; d = store.addDays(d, -1); }
  return n;
}

export function badgeList() {
  const s = store.get();
  const ps = puzzleStats();
  const mastered = data.chapters().filter((c) => chapterState(c.n).mastered).length;
  const list = [
    { key: 'first-solve', title: 'First exercise solved', got: ps.solvedTotal >= 1 },
    { key: 'solved-25', title: '25 exercises solved', got: ps.solvedTotal >= 25 },
    { key: 'solved-100', title: '100 exercises solved', got: ps.solvedTotal >= 100 },
    { key: 'solved-300', title: '300 exercises solved', got: ps.solvedTotal >= 300 },
    { key: 'streak-7', title: '7-day practice streak', got: streak() >= 7 || !!s.badges['streak-7'] },
    { key: 'streak-30', title: '30-day practice streak', got: streak() >= 30 || !!s.badges['streak-30'] },
    { key: 'chapter-1', title: 'First chapter mastered', got: mastered >= 1 },
    { key: 'first-review', title: 'First game analysed', got: s.games.some((g) => g.review && g.review.done) },
    { key: 'journal-10', title: '10 mistakes journaled', got: s.journal.length >= 10 },
  ];
  for (const p of data.parts()) {
    if (!p.test) continue;
    list.push({ key: 'test-' + p.test, title: `Stage ${p.num} Test passed`, got: (s.tests[p.test] || []).some((t) => t.score / t.n >= 0.8) || !!s.badges['test-' + p.test] });
  }
  return list.map((b) => ({ ...b, date: s.badges[b.key] || null }));
}

export function checkBadges() {
  const s = store.get();
  const fresh = [];
  for (const b of badgeList()) {
    if (b.got && !s.badges[b.key]) { s.badges[b.key] = store.today(); fresh.push(b); }
  }
  if (fresh.length) store.save();
  return fresh;
}
