import { idb, commitOps, getMany, CommitConflict, type Op } from './db';
import { hashString } from '../core/rng';
import { SAVE_SCHEMA, DEFAULT_SETTINGS, type Save, type GameRecord } from '../game/state';
import { createCompetitor } from '../world/population';
import {
  splitSave, assembleSave, decodePart, verifyPart, sumOf, sizeOf, sumString, layoutSizes, canonicalJson,
  COLD, RH, HOT_KEYS, type StoredPart, type SplitResult,
} from './layout';
import { BACKUP_SLOTS, makeBackup, readBackupText, isBackupV2, backupDue, gamesOf, type BackupV2 } from './backup';

/**
 * Persistence (save format 2, see docs/PERSISTENCE.md).
 *
 * The Save lives in the `parts` store as many small records plus a manifest.
 * Every commit is ONE IndexedDB transaction: changed parts are written under
 * new generation-tagged keys, then the manifest, then superseded keys are
 * deleted — so even a non-atomic store can never expose a mixed generation.
 * Only parts whose content changed are written; in-game move saves write just
 * `meta` + `active` (+ manifest). Schema-1 single-document saves (kv 'save')
 * are migrated on first load and kept as a backup.
 */

// ------------------------------------------------------------------ v1 envelope (still used for v1 backups / imports)

export type Envelope = { schema: number; checksum: number; savedAt: string; data: string };
const MAIN_KEY = 'save';
const MANIFEST_KEY = 'manifest';
const PRE_SPLIT_KEY = 'pre-split';

export function checksum(s: string): number {
  return hashString(s);
}

export function wrap(save: Save): Envelope {
  const data = JSON.stringify(save);
  return { schema: save.schema, checksum: checksum(data), savedAt: new Date().toISOString(), data };
}

export function unwrap(env: Envelope): Save {
  if (!env || typeof env.data !== 'string' || checksum(env.data) !== env.checksum) throw new Error('Save integrity check failed');
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

// ------------------------------------------------------------------ manifest & commit tracking

export type Manifest = {
  v: 2;
  gen: number;
  savedAt: string;
  schema: number;
  sizes: Record<string, number>;
  parts: Record<string, { key: string; sum: number; n: number }>;
  migratedFrom?: number;
};
type ManifestRecord = { s: string; sum: number; gen?: number };

/** Light (meta + active only) commits are allowed for at most this many in a row / this long. */
const LIGHT_MAX_RUN = 50;
const LIGHT_MAX_MS = 30_000;
/**
 * Rolling verification: each full commit also re-serialises 1/VERIFY_EVERY of
 * the cold / rating-history chunks whose signatures are unchanged, so every
 * chunk is re-checked at least every VERIFY_EVERY full commits (catches edits
 * the cheap signatures cannot see) without a periodic spike.
 */
const VERIFY_EVERY = 8;

type Tracker = {
  manifest: Manifest | null;
  cache: Map<string, string | number>; // logical part -> JSON (json parts) or checksum (columns)
  sigs: Map<string, number> | null;
  probe: string | null;
  lightRun: number;
  fullRun: number;
  lastFullAt: number;
};
const fresh = (): Tracker => ({ manifest: null, cache: new Map(), sigs: null, probe: null, lightRun: 0, fullRun: 0, lastFullAt: 0 });
let T: Tracker = fresh();

export type CommitInfo = { mode: 'light' | 'full'; verify: boolean; gen: number; prepMs: number; written: string[]; bytes: number; deleted: number };
/** Instrumentation (read by tests and the perf report). */
export const persistStats = { commits: 0, light: 0, full: 0, partsWritten: 0, bytesWritten: 0, backups: 0, last: null as CommitInfo | null };

/**
 * Cheap signature of everything outside `active`: every scalar and array
 * length at the top of world and player, plus library/coach sizes. If it is
 * unchanged during a game, a light commit (meta + active) is enough; a full
 * commit still runs at least every LIGHT_MAX_RUN commits / LIGHT_MAX_MS.
 */
function probeOf(s: Save): string {
  const parts: unknown[] = [];
  const scan = (o: unknown) => {
    if (!o || typeof o !== 'object') return parts.push(o);
    for (const k in o as Record<string, unknown>) {
      const v = (o as Record<string, unknown>)[k];
      parts.push(Array.isArray(v) ? 'a' + v.length : v === null || typeof v !== 'object' ? v : 'o');
    }
  };
  scan(s.world);
  scan((s.world as unknown as { stats?: unknown })?.stats);
  scan(s.player);
  parts.push(s.library?.length, s.coach?.positions?.length, s.libraryMeta ? Object.keys(s.libraryMeta).length : -1);
  return parts.join(',');
}

type Prepared = { ops: Op[]; gc: Set<string> | null; expectGen: number | null; info: CommitInfo };

type CommitOpts = { backup?: boolean; full?: boolean; verify?: boolean; forceBackup?: boolean; migratedFrom?: number };

function prepare(save: Save, o: CommitOpts): Prepared {
  const t0 = performance.now();
  const probe = probeOf(save);
  const now = Date.now();
  const prev = T.manifest;
  const sizes = layoutSizes();
  const sameLayout = !!prev && JSON.stringify(prev.sizes) === JSON.stringify(sizes);
  const light = !!prev && sameLayout && !!save.active && !o.full && !o.verify && !o.backup && T.probe === probe
    && T.lightRun < LIGHT_MAX_RUN && now - T.lastFullAt < LIGHT_MAX_MS && !!prev.parts.meta;
  let verify = !light && (!!o.verify || !T.sigs || !sameLayout);
  const turn = T.fullRun % VERIFY_EVERY;
  const verifyChunk = (name: string) => hashString(name) % VERIFY_EVERY === turn;
  let r: SplitResult = splitSave(save, { light, prevSigs: verify ? null : T.sigs, verifyAll: verify, verifyChunk });
  const parts: Manifest['parts'] = sameLayout && prev ? { ...prev.parts } : {};
  if (!light && [...r.skipped].some((n) => !parts[n])) {
    verify = true;
    r = splitSave(save, { verifyAll: true });
  }
  const gen = (prev?.gen ?? 0) + 1;
  const puts: Op[] = [];
  const dels: Op[] = [];
  const written: string[] = [];
  let bytes = 0;
  for (const [name, d] of r.parts) {
    const c = T.cache.get(name);
    const same = parts[name] && (d.k === 'json' ? c === d.s : c === d.sum);
    if (same) continue;
    const sum = sumOf(d);
    const key = `${name}@${gen}`;
    if (parts[name]) dels.push({ store: 'parts', key: parts[name].key, del: true });
    const n = sizeOf(d);
    parts[name] = { key, sum, n };
    puts.push({ store: 'parts', key, value: { ...d, sum } satisfies StoredPart });
    T.cache.set(name, d.k === 'json' ? d.s : d.sum);
    written.push(name);
    bytes += n;
  }
  if (!light) {
    for (const name of Object.keys(parts)) {
      if (r.parts.has(name) || r.skipped.has(name)) continue;
      dels.push({ store: 'parts', key: parts[name].key, del: true });
      delete parts[name];
      T.cache.delete(name);
    }
  }
  const manifest: Manifest = {
    v: 2, gen, savedAt: new Date().toISOString(), schema: save.schema, sizes, parts,
    migratedFrom: o.migratedFrom ?? prev?.migratedFrom,
  };
  const ms = JSON.stringify(manifest);
  const ops = [...puts, { store: 'parts' as const, key: MANIFEST_KEY, value: { s: ms, sum: sumString(ms), gen } satisfies ManifestRecord }, ...dels];
  const gc = prev && sameLayout ? null : new Set([MANIFEST_KEY, ...Object.values(parts).map((p) => p.key)]);
  // Optimistic: later commits diff against this one (a failure resets the tracker).
  T.manifest = manifest;
  if (light) T.lightRun++;
  else {
    T.lightRun = 0;
    T.fullRun++;
    T.lastFullAt = now;
    T.probe = probe;
    T.sigs = r.sigs;
  }
  const info: CommitInfo = { mode: light ? 'light' : 'full', verify, gen, prepMs: performance.now() - t0, written, bytes, deleted: dels.length };
  return { ops, gc, expectGen: gc ? null : prev!.gen, info };
}

// ------------------------------------------------------------------ queue (coalescing, one transaction per commit)

type Job = { save: Save; opts: CommitOpts; done: ((e?: unknown) => void)[] };
let pending: Job | null = null;
let busy = false;
let failStreak = 0;
let lastSave: Save | null = null;

function enqueue(save: Save, opts: CommitOpts): Promise<void> {
  lastSave = save;
  return new Promise((resolve, reject) => {
    const done = (e?: unknown) => (e ? reject(e) : resolve());
    if (pending) {
      // Coalesce: one commit of the latest state satisfies every waiting request.
      pending.save = save;
      pending.opts = {
        backup: pending.opts.backup || opts.backup, full: pending.opts.full || opts.full, verify: pending.opts.verify || opts.verify,
        forceBackup: pending.opts.forceBackup || opts.forceBackup, migratedFrom: opts.migratedFrom ?? pending.opts.migratedFrom,
      };
      pending.done.push(done);
      return;
    }
    pending = { save, opts, done: [done] };
    if (!busy) pump();
  });
}

function pump() {
  const job = pending;
  pending = null;
  if (!job) {
    busy = false;
    return;
  }
  busy = true;
  let p: Prepared;
  try {
    p = prepare(job.save, job.opts);
  } catch (e) {
    T = fresh();
    for (const d of job.done) d(e);
    pump();
    return;
  }
  const guard = p.expectGen === null ? undefined : {
    store: 'parts' as const, key: MANIFEST_KEY,
    // Another tab may have committed since our last commit; then our diff base is wrong.
    test: (v: unknown) => (v as ManifestRecord | undefined)?.gen === p.expectGen,
  };
  void commitOps(p.ops, p.gc ? { store: 'parts', keep: p.gc } : undefined, guard)
    .then(async () => {
      failStreak = 0;
      persistStats.commits++;
      persistStats[p.info.mode]++;
      persistStats.partsWritten += p.info.written.length;
      persistStats.bytesWritten += p.info.bytes;
      persistStats.last = p.info;
      if (job.opts.backup || job.opts.forceBackup) {
        try {
          await maybeBackup(job.save, !!job.opts.forceBackup);
        } catch (e) {
          console.error('backup failed', e);
        }
      }
      for (const d of job.done) d();
    })
    .catch((e) => {
      // The tracker assumed this commit landed; forget it so the next commit rewrites everything
      // (after a conflict with another tab: last writer wins, as a whole consistent save).
      if (e instanceof CommitConflict) console.warn(e.message + '; rewriting this window\'s state');
      T = fresh();
      for (const d of job.done) d(e);
      if (++failStreak <= 2 && !pending && lastSave) pending = { save: lastSave, opts: { full: true }, done: [() => {}] };
    })
    .finally(pump);
}

/**
 * Save the career. Cheap when little changed: during a game only the active
 * game is written; after a game only changed parts. `backup: true` asks for a
 * rolling snapshot, taken when the backup policy says one is due.
 */
export function persistSave(save: Save, opts: { backup?: boolean; full?: boolean } = {}): Promise<void> {
  save.updatedAt = new Date().toISOString();
  return enqueue(save, { backup: opts.backup, full: opts.full }).catch((e) => console.error('save failed', e));
}

/** Resolves once every queued commit has finished. */
export async function whenSaved(): Promise<void> {
  while (busy || pending) await new Promise((r) => setTimeout(r, 1));
}

/** Forget in-memory commit state (as after a reload). Test helper; also used after restore/import. */
export function resetPersistState() {
  T = fresh();
  backupHeads = null;
}

// ------------------------------------------------------------------ backups

type Head = { key: string; savedAt: string; v: 1 | 2; season: number; games: number };
let backupHeads: Head[] | null = null;
const SLOT_KEYS = Array.from({ length: BACKUP_SLOTS }, (_, i) => `slot${i}`);

async function heads(): Promise<Head[]> {
  if (backupHeads) return backupHeads;
  const out: Head[] = [];
  for (const k of SLOT_KEYS) {
    const b = await idb.get<BackupV2 | Envelope>('backups', k);
    if (!b) continue;
    if (isBackupV2(b)) out.push({ key: k, savedAt: b.savedAt, v: 2, season: b.season, games: b.games });
    else out.push({ key: k, savedAt: (b as Envelope).savedAt ?? '', v: 1, season: -1, games: -1 });
  }
  return (backupHeads = out);
}

async function maybeBackup(save: Save, force: boolean) {
  const hs = await heads();
  const v2 = hs.filter((h) => h.v === 2).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  if (!force && !backupDue(v2[0] ?? null, save, gamesOf(save))) return;
  const b = await makeBackup(save);
  const free = SLOT_KEYS.find((k) => !hs.some((h) => h.key === k));
  const slot = free ?? [...hs].sort((a, c) => a.savedAt.localeCompare(c.savedAt))[0].key;
  const ops: Op[] = [{ store: 'backups', key: slot, value: b }];
  const next = [...hs.filter((h) => h.key !== slot), { key: slot, savedAt: b.savedAt, v: 2 as const, season: b.season, games: b.games }];
  // The pre-split (schema 1) save is kept until two new-format snapshots exist.
  if (next.filter((h) => h.v === 2).length >= 2) ops.push({ store: 'backups', key: PRE_SPLIT_KEY, del: true });
  await commitOps(ops);
  backupHeads = next;
  persistStats.backups++;
}

async function decodeBackup(rec: unknown): Promise<Save> {
  if (isBackupV2(rec)) return migrate(JSON.parse(await readBackupText(rec)));
  if (rec && typeof rec === 'object' && typeof (rec as Envelope).data === 'string') return unwrap(rec as Envelope);
  throw new Error('Not a backup');
}

const isQuarantine = (k: string) => k.startsWith('damaged-');

export async function loadNewestBackup(): Promise<Save | null> {
  return (await newestBackup())?.save ?? null;
}

async function newestBackup(): Promise<{ save: Save; savedAt: string } | null> {
  const keys = ((await idb.keys('backups')) as string[]).filter((k) => !isQuarantine(k));
  const recs = await getMany<{ savedAt?: string }>('backups', keys);
  const sorted = recs.filter((r) => !!r).sort((a, b) => (b!.savedAt ?? '').localeCompare(a!.savedAt ?? ''));
  for (const r of sorted) {
    try {
      return { save: await decodeBackup(r), savedAt: r!.savedAt ?? '' };
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
    const rec = await idb.get<{ savedAt?: string }>('backups', k);
    if (!rec) continue;
    let ok = !isQuarantine(k);
    if (ok) {
      try {
        if (isBackupV2(rec)) await readBackupText(rec);
        else unwrap(rec as Envelope);
      } catch {
        ok = false;
      }
    }
    out.push({ key: k, savedAt: rec.savedAt ?? '', ok });
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function restoreBackup(key: string): Promise<Save> {
  const rec = await idb.get('backups', key);
  if (!rec) throw new Error('Backup not found');
  const s = await decodeBackup(rec);
  T = fresh();
  await enqueue(s, { full: true, verify: true });
  return s;
}

// ------------------------------------------------------------------ load

export type LoadResult = { save: Save | null; recovered: boolean; error?: string };

export async function loadSave(): Promise<LoadResult> {
  const [manRec, legacy] = await Promise.all([idb.get<ManifestRecord>('parts', MANIFEST_KEY), idb.get<Envelope>('kv', MAIN_KEY)]);
  if (!manRec) {
    if (!legacy) return { save: null, recovered: false };
    return migrateLegacy(legacy);
  }
  const res = await loadSplit(manRec);
  if (legacy) {
    // A schema-1 record next to a split save: either an interrupted migration or a stray record.
    let ok = true;
    try {
      unwrap(legacy);
    } catch {
      ok = false;
    }
    const aside = ok ? PRE_SPLIT_KEY : `damaged-legacy-${Date.now()}`;
    await commitOps([{ store: 'backups', key: aside, value: legacy }, { store: 'kv', key: MAIN_KEY, del: true }]);
    backupHeads = null;
    if (!ok && res.save) {
      res.recovered = true;
      res.error = [res.error, 'An old-format save record was damaged and has been set aside; your current save is intact.'].filter(Boolean).join(' ');
    }
  }
  return res;
}

function parseManifest(rec: ManifestRecord | undefined): Manifest {
  if (!rec || typeof rec.s !== 'string' || sumString(rec.s) !== rec.sum) throw new Error('Save index integrity check failed');
  const m = JSON.parse(rec.s) as Manifest;
  if (m.v !== 2 || !m.parts) throw new Error('Unknown save index format');
  return m;
}

async function readParts(m: Manifest) {
  const names = Object.keys(m.parts);
  const recs = await getMany<StoredPart>('parts', names.map((n) => m.parts[n].key));
  const decoded = new Map<string, unknown>();
  const raw = new Map<string, StoredPart | undefined>();
  const damaged = new Set<string>();
  names.forEach((n, i) => {
    const r = recs[i];
    raw.set(n, r);
    if (!verifyPart(r, m.parts[n].sum)) {
      damaged.add(n);
      return;
    }
    try {
      decoded.set(n, decodePart(r!));
    } catch {
      damaged.add(n);
    }
  });
  return { decoded, raw, damaged };
}

function trackLoaded(m: Manifest, raw: Map<string, StoredPart | undefined>, save: Save) {
  T = fresh();
  T.manifest = m;
  for (const [n, r] of raw) if (r) T.cache.set(n, r.k === 'json' ? r.s : r.sum);
  T.probe = probeOf(save);
  T.lastFullAt = Date.now();
  // Signatures of what was just read, so the first commit does not have to re-serialise every chunk.
  T.sigs = splitSave(save, { sigsOnly: true }).sigs;
}

async function loadSplit(manRec: ManifestRecord): Promise<LoadResult> {
  let m: Manifest;
  try {
    m = parseManifest(manRec);
  } catch (e) {
    return recoverWhole((e as Error).message, null);
  }
  const { decoded, raw, damaged } = await readParts(m);
  if (damaged.size === 0) {
    const save = migrate(assembleSave(decoded, m.sizes));
    trackLoaded(m, raw, save);
    return { save, recovered: false };
  }
  return recoverParts(m, decoded, raw, damaged);
}

const isPopData = (n: string) => n.startsWith('pop/hot/') || n.startsWith('pop/cold/') || n.startsWith('pop/rh/') || n.startsWith('pop/warm/');

function lenient(r: StoredPart | undefined): unknown {
  try {
    if (r && r.k === 'json' && typeof r.s === 'string') return JSON.parse(r.s);
  } catch {
    /* unreadable */
  }
  return undefined;
}

/** Repair a split save with damaged records, preferring the newest backup; never drops the career silently. */
async function recoverParts(m: Manifest, decoded: Map<string, unknown>, raw: Map<string, StoredPart | undefined>, damaged: Set<string>): Promise<LoadResult> {
  const list = [...damaged];
  const notes: string[] = [];
  const structural = list.filter((n) => !isPopData(n) && n !== 'active');
  const backup = await newestBackup();
  if (structural.length) {
    // Career, world core, tournaments or an index is damaged: a consistent backup beats a patchwork.
    if (backup) return recoverWhole(`Damaged save records (${structural.join(', ')}).`, backup);
    for (const n of structural) {
      const v = lenient(raw.get(n));
      if (v === undefined) return quarantine(m, raw, `Save records are damaged (${structural.join(', ')}) and no backup exists.`);
      decoded.set(n, v);
    }
    notes.push(`Read damaged records as-is (${structural.join(', ')}); no backup was available.`);
  }
  if (damaged.has('active')) {
    decoded.set('active', null);
    notes.push('The in-progress game could not be read and was abandoned.');
  }
  const pop = list.filter(isPopData);
  if (pop.length) {
    const byId = new Map<string, Record<string, unknown>>();
    for (const c of (backup?.save.world?.competitors ?? []) as unknown as Record<string, unknown>[]) byId.set(c.id as string, c);
    const lenientChunks = new Map<string, Record<string, Record<string, unknown>>>();
    for (const n of pop) {
      const v = lenient(raw.get(n));
      if (v && typeof v === 'object') lenientChunks.set(n, v as Record<string, Record<string, unknown>>);
    }
    const core = (decoded.get('world') ?? {}) as { seed?: number; day?: number };
    let fromBackup = 0;
    let fromDamaged = 0;
    let regenerated = 0;
    const hotSet = new Set<string>(HOT_KEYS);
    const keysOf = (fam: string, src: Record<string, unknown>) =>
      fam === 'cold' ? COLD.keys : fam === 'rh' ? RH.keys : Object.keys(src).filter((k) => !COLD.keys.includes(k) && !RH.keys.includes(k) && !hotSet.has(k));
    const fill = (id: string, what: string, c: Record<string, unknown>) => {
      const src = byId.get(id);
      if (what.startsWith('hot:')) {
        const k = what.slice(4);
        if (src && k in src) c[k] = src[k];
        else c[k] ??= regen(id, core)[k];
        return;
      }
      if (src) {
        for (const k of keysOf(what, src)) if (k in src) c[k] = src[k];
        fromBackup++;
        return;
      }
      const chunkName = [...lenientChunks.keys()].find((n) => n.startsWith(`pop/${what}/`) && lenientChunks.get(n)![id]);
      if (chunkName) {
        Object.assign(c, lenientChunks.get(chunkName)![id]);
        fromDamaged++;
        return;
      }
      const g = regen(id, core);
      for (const k of keysOf(what, g)) if (k in g && !(k in c)) c[k] = g[k];
      regenerated++;
    };
    const save = migrate(assembleSave(decoded, m.sizes, damaged, fill));
    notes.push(
      `Repaired ${pop.length} damaged competitor record${pop.length > 1 ? 's' : ''}` +
        (backup ? ` from the backup of ${new Date(backup.savedAt).toLocaleString()}` : '') +
        ` (${fromBackup} from backup, ${fromDamaged} read as-is, ${regenerated} regenerated).`,
    );
    return heal(save, notes);
  }
  return heal(migrate(assembleSave(decoded, m.sizes)), notes);
}

function regen(id: string, core: { seed?: number; day?: number }): Record<string, unknown> {
  const serial = Number(/^c(\d+)$/.exec(id)?.[1] ?? 0);
  const c = createCompetitor(serial, core.seed ?? 1, core.day ?? 0, new Set()) as unknown as Record<string, unknown>;
  c.id = id;
  return c;
}

async function heal(save: Save, notes: string[]): Promise<LoadResult> {
  T = fresh();
  try {
    await enqueue(save, { full: true, verify: true });
  } catch (e) {
    console.error('could not rewrite repaired save', e);
  }
  return { save, recovered: true, error: notes.join(' ') };
}

async function recoverWhole(why: string, b: { save: Save; savedAt: string } | null): Promise<LoadResult> {
  b ??= await newestBackup();
  if (!b) return { save: null, recovered: false, error: why };
  return heal(b.save, [why, `Restored the backup of ${new Date(b.savedAt).toLocaleString()}.`]);
}

/** Unrecoverable: keep the raw records aside (so nothing is lost) and report. */
async function quarantine(m: Manifest, raw: Map<string, StoredPart | undefined>, why: string): Promise<LoadResult> {
  try {
    await commitOps([{ store: 'backups', key: `damaged-${Date.now()}`, value: { savedAt: m.savedAt, manifest: m, parts: Object.fromEntries(raw) } }]);
  } catch (e) {
    console.error('could not quarantine damaged save', e);
  }
  return { save: null, recovered: false, error: why };
}

// ------------------------------------------------------------------ migration from schema-1 single document

async function migrateLegacy(env: Envelope): Promise<LoadResult> {
  let save: Save;
  let recovered = false;
  let error: string | undefined;
  try {
    save = unwrap(env);
  } catch (e) {
    const b = await loadNewestBackup();
    if (!b) return { save: null, recovered: false, error: (e as Error).message };
    save = b;
    recovered = true;
    error = (e as Error).message;
  }
  const expected = canonicalJson(save);
  T = fresh();
  try {
    await enqueue(save, { full: true, verify: true, migratedFrom: env.checksum });
    const manRec = await idb.get<ManifestRecord>('parts', MANIFEST_KEY);
    const m = parseManifest(manRec);
    const { decoded, damaged } = await readParts(m);
    if (damaged.size || canonicalJson(migrate(assembleSave(decoded, m.sizes))) !== expected) throw new Error('split save did not verify');
    // Verified: keep the schema-1 document as a backup and retire the old key (atomically).
    await commitOps([{ store: 'backups', key: PRE_SPLIT_KEY, value: env }, { store: 'kv', key: MAIN_KEY, del: true }]);
    backupHeads = null;
  } catch (e) {
    // Leave the schema-1 record in place; the next load retries.
    console.error('save migration failed; keeping the old save', e);
    await idb.del('parts', MANIFEST_KEY).catch(() => {});
    T = fresh();
  }
  return { save, recovered, error };
}

// ------------------------------------------------------------------ games

export function storeGame(g: GameRecord) {
  return idb.put('games', g.id, g);
}
export function getGame(id: string) {
  return idb.get<GameRecord>('games', id);
}
export function allGames() {
  return idb.all<GameRecord>('games');
}

// ------------------------------------------------------------------ export / import

export type ExportFileV1 = { format: 'gladius-backup'; version: 1; exportedAt: string; save: Envelope; games: GameRecord[] };
export type ExportFileV2 = { format: 'gladius-backup'; version: 2; exportedAt: string; schema: number; checksum: number; save: Save; games: GameRecord[] };
export type ExportFile = ExportFileV1 | ExportFileV2;

/** One JSON file (version 2): the Save as a plain object with a checksum of its JSON, plus every stored game. */
export async function exportAll(save: Save): Promise<string> {
  const games = await allGames();
  const data = JSON.stringify(save);
  const head = { format: 'gladius-backup', version: 2, exportedAt: new Date().toISOString(), schema: save.schema, checksum: checksum(data) };
  return `${JSON.stringify(head).slice(0, -1)},"save":${data},"games":${JSON.stringify(games)}}`;
}

export function parseImport(text: string): { save: Save; games: GameRecord[] } {
  const f = JSON.parse(text) as ExportFile;
  if (!f || f.format !== 'gladius-backup') throw new Error('Not a GLADIUS backup file');
  let save: Save;
  if (f.version === 1 || (f.save && typeof (f.save as unknown as Envelope).data === 'string')) save = unwrap((f as ExportFileV1).save);
  else if (f.version === 2) {
    if (!f.save || typeof f.save !== 'object' || checksum(JSON.stringify(f.save)) !== f.checksum) throw new Error('Backup integrity check failed');
    save = migrate(f.save as unknown as Record<string, unknown>);
  } else throw new Error(`Unsupported backup version ${(f as { version?: unknown }).version}`);
  if (!Array.isArray(f.games)) throw new Error('Backup has no game list');
  return { save, games: f.games };
}

export async function importAll(text: string): Promise<Save> {
  const { save, games } = parseImport(text);
  await idb.clear('games');
  await commitOps(games.map((g) => ({ store: 'games' as const, key: g.id, value: g })));
  T = fresh();
  await enqueue(save, { full: true, verify: true, forceBackup: true });
  return save;
}

export async function wipeAll() {
  await whenSaved();
  await idb.clear('kv');
  await idb.clear('games');
  await idb.clear('backups');
  await idb.clear('parts');
  resetPersistState();
}
