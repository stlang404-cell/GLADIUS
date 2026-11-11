// Read-only access to the book data (window.ELO_BOOK, written by tools/build_app.py).
import * as store from './store.js';

const B = window.ELO_BOOK || { meta: { title: 'The Elo Blueprint' }, parts: [], chapters: [], exercises: {}, sets: {}, docs: [], plan: null };
export const book = B;
export const build = window.ELO_BUILD || { version: 'dev' };

const chapterByN = new Map(B.chapters.map((c) => [c.n, c]));
export const chapter = (n) => chapterByN.get(Number(n));
export const chapters = () => B.chapters;
export const parts = () => B.parts || [];
export const doc = (slug) => B.docs.find((d) => d.slug === slug);
export const docs = () => B.docs || [];
export const sets = () => B.sets || {};
export const plan = () => B.plan;

export function partOf(n) { return parts().find((p) => p.chapters.includes(Number(n))); }
export function partByTest(key) { return parts().find((p) => p.test === key); }

// Exercises: book exercises plus personal ones created from the journal.
export function exercise(id) {
  return B.exercises[id] || store.get().personal[id] || null;
}
export function allExerciseIds() { return Object.keys(B.exercises); }

export function setOf(key) {
  const s = B.sets[key];
  if (!s) return null;
  return { key, ...s, ids: s.ids.filter((id) => B.exercises[id]) };
}

export function chapterSets() {
  return Object.keys(B.sets).filter((k) => !B.sets[k].is_test).sort((a, b) => Number(a) - Number(b));
}
export function testSets() {
  return Object.keys(B.sets).filter((k) => B.sets[k].is_test).sort();
}

export function setTitle(key) {
  const s = B.sets[key];
  if (!s) return key;
  if (s.is_test) return s.title || `Stage test ${key}`;
  return `Chapter ${key} · ${s.title}`;
}

// Chapter for a skill tag (first chapter that lists the skill).
export function chaptersForTag(tag) {
  return B.chapters.filter((c) => (c.skills || []).includes(tag)).map((c) => c.n);
}

export const TYPE_LABELS = {
  tactic: 'Tactic', mate: 'Checkmate', defense: 'Defence', 'blunder-check': 'Blunder check', opening: 'Opening',
  endgame: 'Endgame', quiet: 'Quiet move', strategy: 'Strategy', evaluation: 'Evaluation', counting: 'Counting',
  rules: 'Rules', vision: 'Board vision', conversion: 'Conversion', calculation: 'Calculation', personal: 'From your games',
};

export function tagLabel(t) { return String(t).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()); }
