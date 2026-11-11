// Local-only persistence (localStorage) with a versioned schema and migration hook.

const KEY = 'elo-blueprint';
export const SCHEMA = 1;

function blank() {
  return {
    schema: SCHEMA,
    created: new Date().toISOString(),
    profile: { goal: '', ratings: [], goals: [] },
    settings: { minutes: 30, startDate: null, engineDepth: 12, coords: true, playLevel: 3, playColor: 'w' },
    read: {},          // chapter n -> {at}
    docsRead: {},      // doc slug -> {at}
    ex: {},            // exercise id -> progress record
    tests: {},         // set key -> [{at, score, n, missed}]
    personal: {},      // personal exercise id -> exercise (from journal)
    journal: [],
    games: [],
    playState: null,
    plan: { checks: {} },
    activity: {},      // YYYY-MM-DD -> {ex, ok, lessons, games, tasks}
    badges: {},        // key -> date earned
  };
}

// Migration hook: transform older schemas step by step. Add a case per schema bump.
function migrate(s) {
  if (!s || typeof s !== 'object') return blank();
  const base = blank();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  for (const k of Object.keys(base.settings)) if (s.settings[k] === undefined) s.settings[k] = base.settings[k];
  for (const k of Object.keys(base.profile)) if (s.profile[k] === undefined) s.profile[k] = base.profile[k];
  let v = s.schema || 0;
  while (v < SCHEMA) {
    // if (v === 1) { ...transform to 2... }
    v += 1;
  }
  s.schema = SCHEMA;
  return s;
}

let state = null;
const listeners = new Set();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = migrate(raw ? JSON.parse(raw) : null);
  } catch (e) {
    console.warn('progress could not be read; starting fresh', e);
    state = blank();
  }
  return state;
}

export function get() { return state || load(); }

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // Quota: drop stored engine evaluations of old games first, then retry once.
    for (const g of state.games) if (g.review) g.review.evals = undefined;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e2) { console.warn('save failed', e2); }
  }
  for (const fn of listeners) fn(state);
}

export function update(fn) { fn(state || load()); save(); }

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function exportJSON() {
  return JSON.stringify({ app: 'elo-blueprint-interactive', exported: new Date().toISOString(), data: get() }, null, 1);
}

export function importJSON(text) {
  const obj = JSON.parse(text);
  const data = obj && obj.app === 'elo-blueprint-interactive' ? obj.data : obj;
  if (!data || typeof data !== 'object' || !('ex' in data || 'schema' in data)) throw new Error('This file is not an Elo Blueprint progress export.');
  state = migrate(data);
  save();
  return state;
}

export function reset() { state = blank(); save(); }

// ---------------------------------------------------------------- dates (local calendar days)
export function today() {
  const fake = localStorage.getItem('elo-debug-today');
  if (fake && /^\d{4}-\d{2}-\d{2}$/.test(fake)) return fake;
  return ymd(new Date());
}
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}

export function logActivity(field, n = 1) {
  const s = get();
  const d = today();
  const a = s.activity[d] || (s.activity[d] = { ex: 0, ok: 0, lessons: 0, games: 0, tasks: 0 });
  a[field] = (a[field] || 0) + n;
}

export function uid(prefix = 'x') { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
