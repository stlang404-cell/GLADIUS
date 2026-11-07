import { idb } from './db';
import { hashString } from '../core/rng';
import { SAVE_SCHEMA, DEFAULT_SETTINGS, type Save, type GameRecord } from '../game/state';

/**
 * Save format: one JSON document (the career + world) plus one record per
 * game. Each write stores a checksum; on load a mismatch falls back to the
 * newest valid rolling backup. Schema versions migrate forward step by step.
 */

export type Envelope = { schema: number; checksum: number; savedAt: string; data: string };
const MAIN_KEY = 'save';
const BACKUP_SLOTS = 3;

export function checksum(s: string): number {
  return hashString(s);
}

export function wrap(save: Save): Envelope {
  const data = JSON.stringify(save);
  return { schema: save.schema, checksum: checksum(data), savedAt: new Date().toISOString(), data };
}

export function unwrap(env: Envelope): Save {
  if (checksum(env.data) !== env.checksum) throw new Error('Save integrity check failed');
  return migrate(JSON.parse(env.data));
}

type Migration = (s: Record<string, unknown>) => Record<string, unknown>;
/** migrations[n] upgrades schema n → n+1. */
export const MIGRATIONS: Record<number, Migration> = {
  // 0 → 1: pre-release prototype saves lacked settings/coach.
  0: (s) => ({ ...s, schema: 1, settings: { ...DEFAULT_SETTINGS, ...(s.settings as object) }, coach: s.coach ?? { positions: [] } }),
};

export function migrate(raw: Record<string, unknown>): Save {
  let s = raw;
  let v = typeof s.schema === 'number' ? s.schema : 0;
  if (v > SAVE_SCHEMA) throw new Error(`Save is from a newer version of GLADIUS (schema ${v})`);
  while (v < SAVE_SCHEMA) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from schema ${v}`);
    s = m(s);
    v = s.schema as number;
  }
  const save = s as unknown as Save;
  save.settings = { ...DEFAULT_SETTINGS, ...save.settings };
  return save;
}

let writing: Promise<void> = Promise.resolve();
let rotation = 0;

export function persistSave(save: Save, opts: { backup?: boolean } = {}): Promise<void> {
  save.updatedAt = new Date().toISOString();
  const env = wrap(save);
  writing = writing.then(async () => {
    await idb.put('kv', MAIN_KEY, env);
    if (opts.backup) {
      rotation = (rotation + 1) % BACKUP_SLOTS;
      await idb.put('backups', `slot${rotation}`, env);
    }
  }).catch((e) => console.error('save failed', e));
  return writing;
}

export async function loadSave(): Promise<{ save: Save | null; recovered: boolean; error?: string }> {
  const env = await idb.get<Envelope>('kv', MAIN_KEY);
  if (env) {
    try {
      return { save: unwrap(env), recovered: false };
    } catch (e) {
      const b = await loadNewestBackup();
      if (b) return { save: b, recovered: true, error: (e as Error).message };
      return { save: null, recovered: false, error: (e as Error).message };
    }
  }
  return { save: null, recovered: false };
}

export async function loadNewestBackup(): Promise<Save | null> {
  const all = await idb.all<Envelope>('backups');
  const sorted = all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  for (const env of sorted) {
    try {
      return unwrap(env);
    } catch {
      /* try older */
    }
  }
  return null;
}

export async function listBackups(): Promise<{ key: string; savedAt: string; ok: boolean }[]> {
  const keys = (await idb.keys('backups')) as string[];
  const out = [];
  for (const k of keys) {
    const env = await idb.get<Envelope>('backups', k);
    if (!env) continue;
    let ok = true;
    try {
      unwrap(env);
    } catch {
      ok = false;
    }
    out.push({ key: k, savedAt: env.savedAt, ok });
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function restoreBackup(key: string): Promise<Save> {
  const env = await idb.get<Envelope>('backups', key);
  if (!env) throw new Error('Backup not found');
  const s = unwrap(env);
  await idb.put('kv', MAIN_KEY, env);
  return s;
}

export function storeGame(g: GameRecord) {
  return idb.put('games', g.id, g);
}
export function getGame(id: string) {
  return idb.get<GameRecord>('games', id);
}
export function allGames() {
  return idb.all<GameRecord>('games');
}

export type ExportFile = { format: 'gladius-backup'; version: 1; exportedAt: string; save: Envelope; games: GameRecord[] };

export async function exportAll(save: Save): Promise<string> {
  const games = await allGames();
  const file: ExportFile = { format: 'gladius-backup', version: 1, exportedAt: new Date().toISOString(), save: wrap(save), games };
  return JSON.stringify(file);
}

export function parseImport(text: string): { save: Save; games: GameRecord[] } {
  const f = JSON.parse(text) as ExportFile;
  if (f.format !== 'gladius-backup') throw new Error('Not a GLADIUS backup file');
  const save = unwrap(f.save);
  if (!Array.isArray(f.games)) throw new Error('Backup has no game list');
  return { save, games: f.games };
}

export async function importAll(text: string): Promise<Save> {
  const { save, games } = parseImport(text);
  await idb.clear('games');
  for (const g of games) await idb.put('games', g.id, g);
  await persistSave(save, { backup: true });
  return save;
}

export async function wipeAll() {
  await idb.clear('kv');
  await idb.clear('games');
  await idb.clear('backups');
}
