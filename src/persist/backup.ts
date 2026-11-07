import { sumString } from './layout';

/**
 * Rolling snapshots of the whole Save (format 2). Stored gzip-compressed when
 * CompressionStream exists (all current browsers, Node ≥ 18), otherwise as a
 * plain JSON string. The checksum is over the uncompressed JSON.
 */
export type BackupV2 = {
  v: 2;
  savedAt: string;
  schema: number;
  season: number;
  day: number;
  games: number;
  checksum: number;
  enc: 'gzip' | 'json';
  data: ArrayBuffer | string;
  bytes: number; // uncompressed length (chars)
};

export const BACKUP_SLOTS = 3;
/** A snapshot is taken at most every this many finished games (or at a new season). */
export const BACKUP_EVERY_GAMES = 10;

const hasCompression = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined' && typeof Response !== 'undefined';

export async function compressText(s: string): Promise<{ enc: 'gzip' | 'json'; data: ArrayBuffer | string }> {
  if (!hasCompression()) return { enc: 'json', data: s };
  try {
    const stream = new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'));
    return { enc: 'gzip', data: await new Response(stream).arrayBuffer() };
  } catch {
    return { enc: 'json', data: s };
  }
}

export async function decompressText(enc: string, data: ArrayBuffer | string): Promise<string> {
  if (enc === 'json') return data as string;
  if (enc !== 'gzip') throw new Error(`Unknown backup encoding ${enc}`);
  if (!hasCompression()) throw new Error('This browser cannot read compressed backups');
  const stream = new Blob([data as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

export function gamesOf(save: { player?: { w?: number; d?: number; l?: number } }): number {
  const p = save.player ?? {};
  return (p.w ?? 0) + (p.d ?? 0) + (p.l ?? 0);
}

export async function makeBackup(save: { schema: number; world?: { season?: number; day?: number }; player?: object }): Promise<BackupV2> {
  const text = JSON.stringify(save);
  const { enc, data } = await compressText(text);
  return {
    v: 2, savedAt: new Date().toISOString(), schema: save.schema, season: save.world?.season ?? 0, day: save.world?.day ?? 0,
    games: gamesOf(save as never), checksum: sumString(text), enc, data, bytes: text.length,
  };
}

export async function readBackupText(b: BackupV2): Promise<string> {
  const text = await decompressText(b.enc, b.data);
  if (sumString(text) !== b.checksum) throw new Error('Backup integrity check failed');
  return text;
}

export function isBackupV2(x: unknown): x is BackupV2 {
  return !!x && typeof x === 'object' && (x as BackupV2).v === 2 && 'data' in (x as object);
}

/** Policy: take a snapshot if none exists, the season changed, or enough games were played since the newest one. */
export function backupDue(newest: { season: number; games: number } | null, save: { world?: { season?: number } }, games: number): boolean {
  if (!newest) return true;
  if ((save.world?.season ?? 0) !== newest.season) return true;
  return games - newest.games >= BACKUP_EVERY_GAMES;
}
