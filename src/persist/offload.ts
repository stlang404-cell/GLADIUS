import { openDb } from './db';
import { assembleSave, sumString, sumBuffers, decodePart, canonicalJson, type StoredPart } from './layout';
import { assemblePopulationGen, decodePart4, verifyPart4, genOf, LAYOUT_V4, type Part4 } from './layout4';
import { compressText, decompressBytes, compressBytes, gamesOf } from './backup';
import { hashString } from '../core/rng';
import { migrateGameRecordArenas } from '../game/legacy';
import type { GameRecord } from '../game/state';

/**
 * Work that does not need the live Save object and can run off the main
 * thread (persist.worker.ts), or inline where workers are unavailable (tests,
 * very old browsers): backup snapshots and export files are produced from the
 * committed parts in IndexedDB, read in one read-only transaction, so they are
 * always one consistent generation.
 */

export type ManifestEntry = { key: string; sum: number; n: number; g?: number };
export type ManifestLike = { v: 2; gen: number; savedAt: string; schema: number; sizes: Record<string, number>; parts: Record<string, ManifestEntry>; migratedFrom?: number };
type ManifestRecord = { s: string; sum: number; gen?: number };

/** Backup format 3 (v0.4): gzip of a container holding the committed parts of one generation. */
export type BackupV3 = {
  v: 3;
  savedAt: string;
  schema: number;
  season: number;
  day: number;
  games: number;
  gen: number;
  checksum: number; // sumBuffers over the uncompressed container
  enc: 'gzip' | 'raw';
  data: ArrayBuffer;
  bytes: number; // uncompressed container bytes
};

export function isBackupV3(x: unknown): x is BackupV3 {
  return !!x && typeof x === 'object' && (x as BackupV3).v === 3 && (x as BackupV3).data instanceof ArrayBuffer;
}

// ------------------------------------------------------------------ reading the committed generation

export function parseManifestRecord(rec: ManifestRecord | undefined): ManifestLike {
  if (!rec || typeof rec.s !== 'string' || sumString(rec.s) !== rec.sum) throw new Error('Save index integrity check failed');
  const m = JSON.parse(rec.s) as ManifestLike;
  if (m.v !== 2 || !m.parts) throw new Error('Unknown save index format');
  return m;
}

/** Manifest record + every part it names, in one read-only transaction (plus `extra` stores read whole). */
export async function snapshotCommitted(extra: 'games' | null = null): Promise<{ rec: ManifestRecord; parts: Map<string, Part4 | undefined>; games: GameRecord[] } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(extra ? ['parts', extra] : ['parts'], 'readonly');
    const st = t.objectStore('parts');
    const parts = new Map<string, Part4 | undefined>();
    let rec: ManifestRecord | undefined;
    let games: GameRecord[] = [];
    const r = st.get('manifest');
    r.onsuccess = () => {
      rec = r.result as ManifestRecord | undefined;
      if (!rec) return;
      let m: ManifestLike;
      try {
        m = parseManifestRecord(rec);
      } catch {
        return;
      }
      for (const [name, e] of Object.entries(m.parts)) {
        const g = st.get(e.key);
        g.onsuccess = () => parts.set(name, g.result as Part4 | undefined);
      }
    };
    if (extra) {
      const gr = t.objectStore(extra).getAll();
      gr.onsuccess = () => (games = gr.result as GameRecord[]);
    }
    t.oncomplete = () => resolve(rec ? { rec, parts, games } : null);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Transaction aborted'));
  });
}

/** Verify and decode parts; returns the decoded map and the generation of each part. Throws on damage. */
export function decodeAll(m: ManifestLike, parts: Map<string, Part4 | undefined>): { decoded: Map<string, unknown>; gens: Map<string, number> } {
  const v4 = m.sizes?.v === LAYOUT_V4;
  const decoded = new Map<string, unknown>();
  const gens = new Map<string, number>();
  for (const [name, e] of Object.entries(m.parts)) {
    const p = parts.get(name);
    if (!verifyPart4(p, e.sum)) throw new Error(`Damaged record ${name}`);
    decoded.set(name, v4 ? decodePart4(name, p!) : decodePart(p as StoredPart));
    gens.set(name, genOf(e));
  }
  return { decoded, gens };
}

/** Assemble a raw Save object (before schema migration) from decoded parts of any layout. */
export function assembleAny(m: ManifestLike, decoded: Map<string, unknown>, gens: Map<string, number>, damaged?: Set<string>, fill?: (id: string, what: string, c: Record<string, unknown>) => void): Record<string, unknown> {
  const it = assembleAnyGen(m, decoded, gens, damaged, fill);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

/** assembleAny as a generator (yields between slices of the population assembly). */
export function* assembleAnyGen(m: ManifestLike, decoded: Map<string, unknown>, gens: Map<string, number>, damaged?: Set<string>, fill?: (id: string, what: string, c: Record<string, unknown>) => void): Generator<void, Record<string, unknown>> {
  if (m.sizes?.v !== LAYOUT_V4) return assembleSave(decoded, m.sizes, damaged, fill);
  const rest = new Map<string, unknown>();
  for (const [n, v] of decoded) if (!n.startsWith('pop/') && !n.startsWith('jr/')) rest.set(n, v);
  const s = assembleSave(rest, m.sizes);
  yield;
  const cs = yield* assemblePopulationGen(decoded, gens, damaged, fill);
  if (cs) {
    const w = (s.world ??= {}) as Record<string, unknown>;
    w.competitors = cs;
  }
  return s;
}

// ------------------------------------------------------------------ container (backup v3)

const MAGIC = 0x33424c47; // "GLB3"
type Desc =
  | { k: 'json'; sum: number; o: number; n: number }
  | { k: 'col'; sum: number; dt: string; pad?: number; o: number; n: number; to?: number; tn?: number }
  | { k: 'jr'; sum: number; h: string; b: [number, number][] };

/** Pack a manifest record and its parts into one byte array (JSON text as UTF-8, buffers as they are). */
export function packContainer(rec: ManifestRecord, parts: Map<string, Part4 | undefined>): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let off = 0;
  const push = (u: Uint8Array) => {
    const o = off;
    chunks.push(u);
    off += u.byteLength;
    const pad = (8 - (off % 8)) % 8;
    if (pad) {
      chunks.push(new Uint8Array(pad));
      off += pad;
    }
    return o;
  };
  const descs: [string, Desc][] = [];
  for (const [name, p] of parts) {
    if (!p) continue;
    if (p.k === 'json') {
      const u = enc.encode(p.s);
      descs.push([name, { k: 'json', sum: p.sum, o: push(u), n: u.byteLength }]);
    } else if (p.k === 'col') {
      const d: Desc = { k: 'col', sum: p.sum, dt: p.dt, o: push(new Uint8Array(p.v)), n: p.v.byteLength };
      if (p.pad !== undefined) d.pad = p.pad;
      if (p.t) {
        d.to = push(new Uint8Array(p.t));
        d.tn = p.t.byteLength;
      }
      descs.push([name, d]);
    } else if (p.k === 'jr') {
      descs.push([name, { k: 'jr', sum: p.sum, h: p.h, b: p.b.map((x) => [push(new Uint8Array(x)), x.byteLength] as [number, number]) }]);
    }
  }
  const head = enc.encode(JSON.stringify({ rec, parts: descs }));
  const headLen = 8 + head.byteLength;
  const base = headLen + ((8 - (headLen % 8)) % 8);
  const out = new Uint8Array(base + off);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, head.byteLength, true);
  out.set(head, 8);
  let at = base;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

export function unpackContainer(bytes: Uint8Array): { rec: ManifestRecord; parts: Map<string, Part4> } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 8 || dv.getUint32(0, true) !== MAGIC) throw new Error('Not a GLADIUS backup container');
  const hl = dv.getUint32(4, true);
  const dec = new TextDecoder();
  const head = JSON.parse(dec.decode(bytes.subarray(8, 8 + hl))) as { rec: ManifestRecord; parts: [string, Desc][] };
  const base = 8 + hl + ((8 - ((8 + hl) % 8)) % 8);
  const slice = (o: number, n: number) => bytes.slice(base + o, base + o + n).buffer as ArrayBuffer;
  const parts = new Map<string, Part4>();
  for (const [name, d] of head.parts) {
    if (d.k === 'json') parts.set(name, { k: 'json', s: dec.decode(bytes.subarray(base + d.o, base + d.o + d.n)), sum: d.sum });
    else if (d.k === 'col') {
      const p: StoredPart = { k: 'col', dt: d.dt as 'i32', v: slice(d.o, d.n), t: d.to !== undefined ? slice(d.to, d.tn!) : null, sum: d.sum };
      if (d.pad !== undefined) p.pad = d.pad;
      parts.set(name, p);
    } else parts.set(name, { k: 'jr', h: d.h, b: d.b.map(([o, n]) => slice(o, n)), sum: d.sum });
  }
  return { rec: head.rec, parts };
}

/** Build a backup record from the committed generation (null if there is no committed save). */
export async function buildBackupFromDb(): Promise<BackupV3 | null> {
  const snap = await snapshotCommitted();
  if (!snap) return null;
  const m = parseManifestRecord(snap.rec);
  // Refuse to snapshot damaged data: every part must verify.
  for (const [name, e] of Object.entries(m.parts)) if (!verifyPart4(snap.parts.get(name), e.sum)) throw new Error(`Backup source record ${name} is damaged`);
  const container = packContainer(snap.rec, snap.parts);
  const sum = sumBuffers(container.buffer as ArrayBuffer);
  const player = (() => {
    try {
      const p = snap.parts.get('player');
      return p && p.k === 'json' ? (JSON.parse(p.s) as { player?: { w?: number; d?: number; l?: number } }) : {};
    } catch {
      return {};
    }
  })();
  const world = (() => {
    try {
      const p = snap.parts.get('world');
      return p && p.k === 'json' ? (JSON.parse(p.s) as { season?: number; day?: number }) : {};
    } catch {
      return {};
    }
  })();
  const z = await compressBytes(container);
  return {
    v: 3, savedAt: new Date().toISOString(), schema: m.schema, season: world.season ?? 0, day: world.day ?? 0, games: gamesOf(player as never),
    gen: m.gen, checksum: sum, enc: z.enc, data: z.data, bytes: container.byteLength,
  };
}

/** Decompress + verify a v3 backup and assemble its raw Save object. */
export async function readBackupV3(b: BackupV3): Promise<Record<string, unknown>> {
  const bytes = b.enc === 'raw' ? new Uint8Array(b.data) : await decompressBytes(b.data);
  if (bytes.byteLength !== b.bytes || sumBuffers(bytes.buffer as ArrayBuffer) !== b.checksum) throw new Error('Backup integrity check failed');
  const { rec, parts } = unpackContainer(bytes);
  const m = parseManifestRecord(rec);
  const { decoded, gens } = decodeAll(m, parts);
  return assembleAny(m, decoded, gens);
}

/** Verify a v3 backup without assembling it. */
export async function checkBackupV3(b: BackupV3): Promise<void> {
  const bytes = b.enc === 'raw' ? new Uint8Array(b.data) : await decompressBytes(b.data);
  if (bytes.byteLength !== b.bytes || sumBuffers(bytes.buffer as ArrayBuffer) !== b.checksum) throw new Error('Backup integrity check failed');
}

// ------------------------------------------------------------------ export

/**
 * Export file (format version 2, unchanged since v0.2) built from the
 * committed generation: the Save object, a checksum of its JSON, and every
 * stored game. Null if there is no committed save.
 */
export async function exportTextFromDb(): Promise<string | null> {
  const snap = await snapshotCommitted('games');
  if (!snap) return null;
  const m = parseManifestRecord(snap.rec);
  const { decoded, gens } = decodeAll(m, snap.parts);
  const save = assembleAny(m, decoded, gens);
  const data = JSON.stringify(save);
  const head = { format: 'gladius-backup', version: 2, exportedAt: new Date().toISOString(), schema: save.schema, checksum: hashString(data) };
  return `${JSON.stringify(head).slice(0, -1)},"save":${data},"games":${JSON.stringify(snap.games.map(migrateGameRecordArenas))}}`;
}

/** Test helper: canonical JSON of the committed save (any layout). */
export async function committedCanonical(): Promise<string | null> {
  const snap = await snapshotCommitted();
  if (!snap) return null;
  const m = parseManifestRecord(snap.rec);
  const { decoded, gens } = decodeAll(m, snap.parts);
  return canonicalJson(assembleAny(m, decoded, gens));
}

export { compressText };
