import { useSyncExternalStore } from 'react';
import type { Save, GameRecord, LibraryMeta } from '../game/state';
import { persistSave, storeGame } from '../persist/save';

/**
 * Single source of truth for the UI. All gameplay mutations go through
 * `mutate`, which bumps a version (re-render) and schedules a debounced,
 * checksummed save. Expensive work (engine, world creation) lives elsewhere.
 */
let save: Save | null = null;
let version = 0;
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let gamesSinceBackup = 0;

export function getSave(): Save {
  if (!save) throw new Error('No save loaded');
  return save;
}
export function hasSave() {
  return !!save;
}

export function setSave(s: Save | null) {
  save = s;
  bump();
}

function bump() {
  version++;
  for (const f of subs) f();
}

export function mutate(fn: (s: Save) => void, opts: { immediate?: boolean; backup?: boolean } = {}) {
  if (!save) return;
  fn(save);
  bump();
  scheduleSave(opts);
}

export function scheduleSave(opts: { immediate?: boolean; backup?: boolean } = {}) {
  if (!save) return;
  if (timer) clearTimeout(timer);
  const run = () => {
    timer = null;
    if (save) void persistSave(save, { backup: opts.backup });
  };
  if (opts.immediate || opts.backup) run();
  else timer = setTimeout(run, 500);
}

export function flushSave() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (save) return persistSave(save);
}

export async function archiveGame(g: GameRecord) {
  await storeGame(g);
  mutate((s) => {
    if (!s.library.includes(g.id)) s.library.push(g.id);
    s.libraryMeta[g.id] = metaOf(g);
  }, { backup: ++gamesSinceBackup % 5 === 0 });
}

export function metaOf(g: GameRecord): LibraryMeta {
  const acc = g.analysis && g.playerColor ? g.analysis.accuracy[g.playerColor] : undefined;
  return {
    id: g.id, day: g.day, kind: g.kind, white: g.white.name, black: g.black.name, result: g.result, playerColor: g.playerColor,
    accuracy: acc, opening: g.opening?.name ?? g.analysis?.opening?.name, analysed: !!g.analysis, eloDelta: g.eloDelta, source: g.source,
  };
}

export function useSave(): Save {
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => version,
  );
  return getSave();
}

export function useVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => version,
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flushSave());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushSave();
  });
}
