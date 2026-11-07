import { useSyncExternalStore } from 'react';
import type { Save, GameRecord, LibraryMeta } from '../game/state';
import { persistSave, storeGame } from '../persist/save';
import { ensureSaveV2 } from '../game/legacy';

/**
 * Single source of truth for the UI. All gameplay mutations go through
 * `mutate`, which bumps a version (re-render) and schedules a debounced,
 * checksummed save. Expensive work (engine, world creation) lives elsewhere.
 *
 * The persistence layer (src/persist) works out what changed: an in-game move
 * writes only the active game; a finished game writes only changed parts of the
 * world. Rolling backups are requested after every archived game and taken when
 * the backup policy says one is due (every ~10 games or at a new season).
 */
let save: Save | null = null;
let version = 0;
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function getSave(): Save {
  if (!save) throw new Error('No save loaded');
  return save;
}
export function hasSave() {
  return !!save;
}

export function setSave(s: Save | null) {
  save = s ? ensureSaveV2(s) : null; // idempotent v2 world/career upgrade for any loaded or imported save
  bump();
}

/** Lightweight toasts (achievements, trophies, records) — never blocking. */
export type Toast = { id: number; text: string; kind: 'achievement' | 'trophy' | 'info' };
let toastSerial = 0;
export const toasts: Toast[] = [];
export function pushToast(text: string, kind: Toast['kind'] = 'info') {
  toasts.push({ id: ++toastSerial, text, kind });
  if (toasts.length > 4) toasts.shift();
  bump();
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.text === text);
    if (i >= 0) toasts.splice(i, 1);
    bump();
  }, 4200);
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
  // Page is going away: do a full (non-light) commit so nothing waits for a later save.
  if (save) return persistSave(save, { full: true });
}

export async function archiveGame(g: GameRecord) {
  await storeGame(g);
  mutate((s) => {
    if (!s.library.includes(g.id)) s.library.push(g.id);
    s.libraryMeta[g.id] = metaOf(g);
  }, { backup: true });
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
