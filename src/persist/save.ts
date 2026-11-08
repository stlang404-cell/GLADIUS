import { idb, commitOps, getMany, CommitConflict, type Op } from './db';
import { hashString } from '../core/rng';
import { SAVE_SCHEMA, DEFAULT_SETTINGS, type Save, type GameRecord } from '../game/state';
import { createCompetitor } from '../world/population';
import { migrateGameRecordArenas } from '../game/legacy';
import { sumString, sizeOf, canonicalJson, decodePart, COLD, RH, HOT_KEYS, ARRAY_CHUNK, type StoredPart, type Draft } from './layout';
import {
  Mirror, scanPopulation, buildJournal, applyScan, buildHotBase, buildBlobBase, buildFamBase, membersByChunk, indexDraft, forgetAbsent,
  verifyPart4, decodePart4, decodeJournal, journalTouches, journalEstimate, scanTouches, fillColdHashes, mirrorFromLoaded, rowsOfBase, presentCounts, decodeFamChunk, genOf, idOfSerial,
  SIZES_V4, LAYOUT_V4, FAMILY_SIZES, type Part4, type JrPart, type JrDecoded, type PopScan, type JsonFam, type BlobFam,
} from './layout4';
import { tjStringify, tjDecode } from './tj';
import { BACKUP_SLOTS, makeBackup, readBackupText, isBackupV2, backupDue, gamesOf, type BackupV2 } from './backup';
import { buildBackupFromDb, exportTextFromDb, readBackupV3, checkBackupV3, isBackupV3, assembleAny, assembleAnyGen, type BackupV3 } from './offload';

/**
 * Persistence (save format 2, layout v4 — see docs/PERSISTENCE.md).
 *
 * The Save lives in the `parts` store as many small records plus a manifest.
 * Every commit is ONE IndexedDB transaction: changed parts are written under
 * new generation-tagged keys, then the manifest, then superseded keys are
 * deleted — so even a non-atomic store can never expose a mixed generation.
 *
 * v0.4: the population is diffed against an in-memory mirror of what is
 * persisted and each full commit appends a small journal record (only the
 * changed rows / fields) instead of rewriting columns and chunks; base parts
 * are rewritten when the journals grow too large. Commit preparation runs in
 * slices of a few milliseconds and yields to the main thread in between; a
 * mutation during a yield restarts it, so a commit is always a snapshot of one
 * moment. Backups and exports are built from the committed parts in a worker.
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
  /** Chunk sizes and layout version (`v`: 3 = v0.3, 4 = v0.4; absent = v0.2). */
  sizes: Record<string, number>;
  /** `g` (v0.4): generation that wrote the part (also the key suffix). */
  parts: Record<string, { key: string; sum: number; n: number; g?: number }>;
  migratedFrom?: number;
};
type ManifestRecord = { s: string; sum: number; gen?: number };

/** Light (meta + active only) commits are allowed for at most this many in a row / this long. */
const LIGHT_MAX_RUN = 50;
const LIGHT_MAX_MS = 30_000;
/**
 * Rolling verification: each full commit re-serialises the warm records of
 * 1/VERIFY_EVERY of the population (cold records: 1/COLD_VERIFY_EVERY) and
 * compares them with what was persisted, catching edits the cheap signatures
 * cannot see. Everything else (hot columns, h2h, rating histories, world,
 * tournaments, arrays) is compared exactly on every full commit.
 */
const VERIFY_EVERY = 16;
const COLD_VERIFY_EVERY = 64;
/**
 * Tuning (tests may change it). Compaction folds the journals into new base
 * parts once they exceed `journalLimitBytes` or `journalMax` records;
 * `sliceMs` is the main-thread budget per slice of commit preparation.
 */
export const persistTuning = { journalLimitBytes: 4 << 20, journalMax: 48, sliceMs: 8 };

type JournalInfo = { name: string; gen: number; bytes: number; touches: Set<string> };
type Tracker = {
  manifest: Manifest | null;
  /** logical part -> JSON text used for change detection (json parts) or checksum (columns). Population parts are tracked by the mirror. */
  cache: Map<string, string | number>;
  mirror: Mirror | null;
  journals: JournalInfo[];
  probe: string | null;
  lightRun: number;
  fullRun: number;
  lastFullAt: number;
};
const fresh = (): Tracker => ({ manifest: null, cache: new Map(), mirror: null, journals: [], probe: null, lightRun: 0, fullRun: 0, lastFullAt: 0 });
let T: Tracker = fresh();

export type CommitInfo = {
  mode: 'light' | 'full'; verify: boolean; gen: number;
  /** Main-thread time spent preparing (sum of slices) and the longest slice. */
  prepMs: number; maxSliceMs: number; maxSlicePhase: string; slices: number; restarts: number;
  written: string[]; bytes: number; deleted: number;
  journalBytes: number; compacted: boolean;
};
/** Instrumentation (read by tests and the perf report). */
export const persistStats = {
  commits: 0, light: 0, full: 0, partsWritten: 0, bytesWritten: 0, backups: 0, compactions: 0, restarts: 0,
  last: null as CommitInfo | null, lastBackup: null as null | { ms: number; v: number; bytes: number; inline: boolean },
};

/**
 * Cheap signature of everything outside `active`: every scalar and array
 * length at the top of world and player, plus library/coach sizes. If it is
 * unchanged during a game, a light commit (meta + active) is enough; a full
 * commit still runs at least every LIGHT_MAX_RUN commits / LIGHT_MAX_MS.
 * Also re-checked at the end of a sliced preparation (mutation guard).
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

/**
 * Mutation epoch. Bumped by every persistSave and by `noteMutation()` (the UI
 * store calls it on every mutate / scheduleSave). A sliced commit preparation
 * that sees the epoch move during a yield starts again on the latest state.
 */
let epoch = 0;
export function noteMutation() {
  epoch++;
}

type Prepared = { ops: Op[]; gc: Set<string> | null; expectGen: number | null; info: CommitInfo };
type CommitOpts = { backup?: boolean; full?: boolean; verify?: boolean; forceBackup?: boolean; migratedFrom?: number };
const RESTART = Symbol('restart');
type Obj = Record<string, unknown>;
type Out = Draft | JrPart;
const sizeOfOut = (d: Out) => (d.k === 'jr' ? d.h.length * 2 + d.b.reduce((a, b) => a + b.byteLength, 0) : sizeOf(d));
const sumOfOut = (d: Out) => (d.k === 'json' ? sumString(d.s) : d.sum);
const isPop = (n: string) => n.startsWith('pop/') || n.startsWith('jr/');

/**
 * Commit preparation as a generator: it yields at fine granularity and the
 * driver (runPrepare) decides when to give the main thread back. Nothing in
 * the tracker changes before the final, synchronous section, so a restart
 * after a yield is free of side effects.
 */
function* prepareGen(save: Save, o: CommitOpts): Generator<void, Prepared | typeof RESTART> {
  const probe = probeOf(save);
  const now = Date.now();
  const prev = T.manifest;
  const sameLayout = !!prev && prev.sizes?.v === LAYOUT_V4 && !!T.mirror;
  const light = !!prev && sameLayout && !!save.active && !o.full && !o.verify && !o.backup && T.probe === probe
    && T.lightRun < LIGHT_MAX_RUN && now - T.lastFullAt < LIGHT_MAX_MS && !!prev.parts.meta;
  const rewrite = !light && (!sameLayout || !!o.verify);
  const gen = (prev?.gen ?? 0) + 1;
  const parts: Manifest['parts'] = !rewrite && prev ? { ...prev.parts } : {};
  const out = new Map<string, Out>();
  const produced = new Set<string>();
  const cacheSet = new Map<string, string | number>();
  const popDel = new Set<string>();

  /** A JSON part: `plain` is compared with the cached text; `store` (default: plain) is what gets written. */
  const offer = (name: string, plain: string, store?: () => string) => {
    produced.add(name);
    const c = T.cache.get(name);
    if (parts[name] && c === plain) return;
    const s = store ? store() : plain;
    if (parts[name] && c === undefined && sumString(s) === parts[name].sum) {
      cacheSet.set(name, plain);
      return;
    }
    out.set(name, { k: 'json', s });
    cacheSet.set(name, plain);
  };

  phase = 'core';
  const s = save as unknown as Obj;
  const meta: Obj = {};
  const player: Obj = {};
  for (const k of Object.keys(s)) {
    if (k === 'active' || k === 'world') continue;
    if (k === 'player' || k === 'library' || k === 'libraryMeta' || k === 'coach') player[k] = s[k];
    else meta[k] = s[k];
  }
  offer('meta', JSON.stringify(meta));
  offer('active', JSON.stringify(s.active ?? null));
  let sc: PopScan | null = null;
  let m: Mirror | null = T.mirror;
  let journal: ReturnType<typeof buildJournal> = null;
  let compact = false;
  const famBases = new Map<string, ReturnType<typeof buildFamBase>>();
  const baseOut = new Map<string, Draft | null>();
  const hotRebuilt: number[] = [];
  const blobRebuilt: { fam: BlobFam; c: number; rows: number }[] = [];
  let liveSerial = new Uint8Array(0);
  let hasPresentFn: (name: string) => boolean = () => true;
  const rebuild = new Set<string>();
  if (!light) {
    offer('player', JSON.stringify(player));
    const w = s.world as Obj | undefined;
    if (w && typeof w === 'object') {
      const core: Obj = {};
      for (const k of Object.keys(w)) if (!Array.isArray(w[k])) core[k] = w[k];
      offer('world', JSON.stringify(core));
      yield;
      phase = 'tournaments';
      // Tournaments: one record each.
      if (Array.isArray(w.tournaments)) {
        const ts = w.tournaments as Obj[];
        const ids = ts.map((t) => (t && typeof t === 'object' ? t.id : undefined));
        if (ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) offer('tour/raw', JSON.stringify(ts));
        else {
          offer('tour/index', JSON.stringify(ids));
          for (let i = 0; i < ts.length; i++) {
            offer('tour/' + ids[i], JSON.stringify(ts[i]));
            if (i % 16 === 15) yield;
          }
        }
      }
      phase = 'arrays';
      // Other world arrays, 128 entries per chunk, stored as tabular JSON.
      for (const k of Object.keys(w)) {
        if (k === 'competitors' || k === 'tournaments' || !Array.isArray(w[k])) continue;
        const a = w[k] as unknown[];
        const base = 'wa/' + encodeURIComponent(k) + '/';
        offer(base + 'index', JSON.stringify({ n: a.length, size: ARRAY_CHUNK }));
        for (let i = 0; i * ARRAY_CHUNK < a.length; i++) {
          const ch = a.slice(i * ARRAY_CHUNK, (i + 1) * ARRAY_CHUNK);
          offer(base + i, JSON.stringify(ch), () => tjStringify(ch));
          yield;
        }
      }
      phase = 'population scan';
      // Population.
      if (Array.isArray(w.competitors)) {
        if (rewrite || !m) m = new Mirror();
        const mm = m;
        sc = yield* scanPopulation(w.competitors as Obj[], mm, rewrite ? { fresh: true, hashes: 'all' } : { verify: { every: VERIFY_EVERY, coldEvery: COLD_VERIFY_EVERY, turn: T.fullRun } });
        if (sc.raw !== null) {
          offer('pop/raw', sc.raw);
          m = null; // never expected (ids not unique): every commit rewrites everything
        } else {
          const scan = sc;
          if (scan.odd.length) offer('pop/odd', JSON.stringify(scan.odd));
          const pres: Record<string, Map<number, number>> = {};
          for (const f of ['cold', 'warm', 'h2h', 'rh'] as const) pres[f] = presentCounts(scan.index, f);
          const hasPresent = (hasPresentFn = (name: string) => {
            if (name === 'pop/index' || name.startsWith('pop/hot/')) return true;
            const [, f, c] = name.split('/');
            return (pres[f]?.get(Number(c)) ?? 0) > 0;
          });
          // pop/index: unchanged, appended to (journal), or rewritten.
          const old = mm.index;
          let idxMode: 'same' | 'append' | 'base' = 'base';
          if (!rewrite && parts['pop/index']) {
            let prefix = old.length <= scan.index.length;
            for (let i = 0; prefix && i < old.length; i++) if (old[i] !== scan.index[i]) prefix = false;
            idxMode = prefix ? (old.length === scan.index.length ? 'same' : 'append') : 'base';
          }
          const idxAppend = idxMode === 'append' ? scan.index.subarray(old.length) : null;
          phase = 'journal';
          // Which bases must be rebuilt?
          const pendingFor = (name: string, j: number) => hasPresent(name) && (!parts[name] || genOf(parts[name]) < j);
          const live = T.journals.filter((j) => [...j.touches].some((n) => pendingFor(n, j.gen)));
          const est = rewrite ? 0 : journalEstimate(scan, idxAppend?.length ?? 0);
          const liveBytes = live.reduce((a, j) => a + j.bytes, 0) + est;
          compact = rewrite || liveBytes > persistTuning.journalLimitBytes || live.length + (est ? 1 : 0) > persistTuning.journalMax;
          // A journal is written unless this commit compacts; when compacting, its changes go straight into the bases.
          if (!rewrite && !compact) journal = buildJournal(scan, mm, idxAppend);
          const touches = rewrite ? new Set<string>() : journal?.touches ?? scanTouches(scan, idxAppend?.length ?? 0);
          yield;
          if (rewrite) {
            rebuild.add('pop/index');
            for (const k of HOT_KEYS) rebuild.add('pop/hot/' + k);
            for (const f of ['cold', 'warm', 'h2h', 'rh']) for (const c of pres[f].keys()) rebuild.add(`pop/${f}/${c}`);
          } else {
            if (idxMode === 'base') rebuild.add('pop/index');
            if (compact) {
              for (const j of live) for (const n of j.touches) if (pendingFor(n, j.gen)) rebuild.add(n);
              for (const n of touches) if (hasPresent(n)) rebuild.add(n);
              // Chunks holding many members that are no longer in the index.
              for (const f of ['cold', 'warm', 'h2h', 'rh']) {
                for (const [c, rows] of [...mm.baseRows].filter(([n]) => n.startsWith(`pop/${f}/`)).map(([n, r]) => [Number(n.split('/')[2]), r] as const)) {
                  const p = pres[f].get(c) ?? 0;
                  if (p > 0 && rows - p > Math.max(8, rows / 2)) rebuild.add(`pop/${f}/${c}`);
                }
              }
              if (idxMode !== 'same') rebuild.add('pop/index');
            }
          }
          // Chunks with no indexed member left are deleted.
          for (const name of Object.keys(parts)) {
            if (!/^pop\/(cold|warm|h2h|rh)\//.test(name)) continue;
            if (!hasPresent(name)) {
              popDel.add(name);
              rebuild.delete(name);
            }
          }
          phase = 'base parts';
          // Base parts are built (sliced) as the mirror will be once this scan is applied.
          liveSerial = new Uint8Array(Math.max(scan.maxSerial + 1, 0));
          for (const sr of scan.index) if (sr >= 0) liveSerial[sr] = 1;
          const fbOf = (sr: number) => scan.fb.get(sr) ?? mm.fb[sr];
          const groups = new Map<JsonFam, ReturnType<typeof membersByChunk>>();
          for (const name of rebuild) {
            if (name === 'pop/index') baseOut.set(name, indexDraft(scan.index));
            else if (name.startsWith('pop/hot/')) {
              const k = HOT_KEYS.indexOf(name.slice(8) as never);
              baseOut.set(name, buildHotBase(mm, scan, k, liveSerial));
              hotRebuilt.push(k);
            } else {
              const [, fam, c] = name.split('/');
              if (fam === 'h2h' || fam === 'rh') {
                const r = buildBlobBase(mm, scan, fam as BlobFam, Number(c), liveSerial);
                baseOut.set(name, r.d);
                blobRebuilt.push({ fam: fam as BlobFam, c: Number(c), rows: r.rows });
              } else {
                const f = fam as JsonFam;
                if (!groups.has(f)) groups.set(f, membersByChunk(w.competitors as Obj[], scan.index, f));
                const fb = buildFamBase(f, groups.get(f)!.get(Number(c)) ?? [], fbOf);
                famBases.set(name, fb);
                baseOut.set(name, fb?.d ?? null);
              }
            }
            yield;
          }
        }
      }
    }
  }
  // Mutation guard: everything above may have yielded.
  if (probeOf(save) !== probe) return RESTART;

  phase = 'final';
  // ---------------- final, synchronous section: apply to the mirror and build the commit
  let journalBytes = 0;
  if (sc && sc.raw === null && m) {
    const mm = m;
    applyScan(mm, sc);
    if (journal && !compact) {
      out.set('jr/' + gen, journal.part);
      journalBytes = journal.bytes;
    }
    forgetAbsent(mm, liveSerial, hotRebuilt, blobRebuilt);
    for (const [name, d] of baseOut) {
      const [, fam, c] = name.split('/');
      if (fam === 'cold' || fam === 'warm') markFamBase(mm, fam as JsonFam, Number(c), famBases.get(name)?.ids ?? []);
      if (d) out.set(name, d);
      else popDel.add(name);
    }
    if (!sc.odd.length && parts['pop/odd']) popDel.add('pop/odd');
    if (parts['pop/raw']) popDel.add('pop/raw');
  } else if (sc && sc.raw !== null) {
    for (const name of Object.keys(parts)) if (isPop(name) && name !== 'pop/raw') popDel.add(name);
  }

  const puts: Op[] = [];
  const dels: Op[] = [];
  const written: string[] = [];
  let bytes = 0;
  for (const [name, d] of out) {
    const sum = sumOfOut(d);
    const key = `${name}@${gen}`;
    if (parts[name]) dels.push({ store: 'parts', key: parts[name].key, del: true });
    const n = sizeOfOut(d);
    parts[name] = { key, sum, n, g: gen };
    puts.push({ store: 'parts', key, value: { ...d, sum } satisfies Part4, n });
    if (d.k === 'col') cacheSet.set(name, d.sum);
    written.push(name);
    bytes += n;
  }
  const dropped = new Set<string>();
  const drop = (name: string) => {
    if (!parts[name] || out.has(name)) return;
    dels.push({ store: 'parts', key: parts[name].key, del: true });
    delete parts[name];
    dropped.add(name);
  };
  if (!light) {
    for (const name of Object.keys(parts)) if (!isPop(name) && !produced.has(name)) drop(name);
    for (const name of popDel) drop(name);
  }
  // Journals: all dropped by a compaction; otherwise those whose every base is newer.
  let journals = T.journals;
  if (!light && sc) {
    if (compact || sc.raw !== null || rewrite) {
      for (const j of journals) drop(j.name);
      journals = [];
    } else {
      const keep: JournalInfo[] = [];
      for (const j of journals) {
        const pending = [...j.touches].some((nm) => hasPresentFn(nm) && (!parts[nm] || genOf(parts[nm]) < j.gen));
        if (pending) keep.push(j);
        else drop(j.name);
      }
      journals = keep;
    }
    if (journal && !compact && sc.raw === null) journals = [...journals, { name: 'jr/' + gen, gen, bytes: journalBytes, touches: journal.touches }];
  }
  const manifest: Manifest = {
    v: 2, gen, savedAt: new Date().toISOString(), schema: save.schema, sizes: SIZES_V4, parts,
    migratedFrom: o.migratedFrom ?? prev?.migratedFrom,
  };
  const ms = JSON.stringify(manifest);
  const ops = [...puts, { store: 'parts' as const, key: MANIFEST_KEY, value: { s: ms, sum: sumString(ms), gen } satisfies ManifestRecord, n: ms.length * 2 }, ...dels];
  const gc = prev && !rewrite ? null : new Set([MANIFEST_KEY, ...Object.values(parts).map((p) => p.key)]);
  // Optimistic: later commits diff against this one (a failure resets the tracker).
  T.manifest = manifest;
  for (const [k, v] of cacheSet) T.cache.set(k, v);
  for (const k of dropped) T.cache.delete(k);
  if (rewrite) for (const k of [...T.cache.keys()]) if (!parts[k]) T.cache.delete(k);
  if (light) T.lightRun++;
  else {
    T.lightRun = 0;
    T.fullRun++;
    T.lastFullAt = now;
    T.probe = probe;
    T.mirror = m;
    T.journals = journals;
  }
  const info: CommitInfo = {
    mode: light ? 'light' : 'full', verify: rewrite, gen, prepMs: 0, maxSliceMs: 0, maxSlicePhase: '', slices: 0, restarts: 0, written, bytes, deleted: dels.length,
    journalBytes, compacted: compact && !rewrite,
  };
  return { ops, gc, expectGen: gc ? null : prev!.gen, info };
}

/** Family-chunk bookkeeping after a base rebuild: exactly `ids` are stored in it now. */
function markFamBase(m: Mirror, fam: JsonFam, c: number, ids: number[]) {
  const size = FAMILY_SIZES[fam];
  for (let sr = c * size; sr < Math.min((c + 1) * size, m.cap); sr++) m.has[fam][sr] = 0;
  for (const sr of ids) m.has[fam][sr] = 1;
  m.baseRows.set(`pop/${fam}/${c}`, ids.length);
}

/** Give the main thread back (scheduler.yield where available, else a macrotask). */
function yieldToMain(): Promise<void> {
  const sch = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sch?.yield) return sch.yield();
  if (typeof MessageChannel !== 'undefined' && typeof window !== 'undefined') {
    return new Promise((r) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        ch.port1.close();
        r();
      };
      ch.port2.postMessage(0);
    });
  }
  return new Promise((r) => setTimeout(r, 0));
}

/** Phase of the preparation that is running (diagnostics: the phase of the longest slice is reported). */
let phase = '';
type Timing = { total: number; max: number; slices: number; maxPhase: string };
/** Run a generator in slices of SLICE_MS. `guard` (if given) is checked after every yield; false aborts. */
async function runSliced<R>(it: Generator<void, R>, sync: boolean, guard?: () => boolean): Promise<{ value: R | typeof RESTART; t: Timing }> {
  const t: Timing = { total: 0, max: 0, slices: 0, maxPhase: '' };
  let t0 = performance.now();
  let p0 = phase;
  const slice = (d: number) => {
    t.total += d;
    if (d > t.max) {
      t.max = d;
      t.maxPhase = p0 === phase ? phase : `${p0}…${phase}`;
    }
    t.slices++;
  };
  for (;;) {
    const r = it.next();
    const now = performance.now();
    if (r.done) {
      slice(now - t0);
      return { value: r.value, t };
    }
    if (!sync && now - t0 >= persistTuning.sliceMs) {
      slice(now - t0);
      await yieldToMain();
      if (guard && !guard()) {
        it.return(undefined as never);
        return { value: RESTART, t };
      }
      t0 = performance.now();
      p0 = phase;
    }
  }
}

// ------------------------------------------------------------------ queue (coalescing, one transaction per commit)

type Job = { save: Save; opts: CommitOpts; done: ((e?: unknown) => void)[] };
let pending: Job | null = null;
let busy = false;
let failStreak = 0;
let lastSave: Save | null = null;

const mergeOpts = (a: CommitOpts, b: CommitOpts): CommitOpts => ({
  backup: a.backup || b.backup, full: a.full || b.full, verify: a.verify || b.verify,
  forceBackup: a.forceBackup || b.forceBackup, migratedFrom: b.migratedFrom ?? a.migratedFrom,
});

function enqueue(save: Save, opts: CommitOpts): Promise<void> {
  lastSave = save;
  epoch++;
  return new Promise((resolve, reject) => {
    const done = (e?: unknown) => (e ? reject(e) : resolve());
    if (pending) {
      // Coalesce: one commit of the latest state satisfies every waiting request.
      pending.save = save;
      pending.opts = mergeOpts(pending.opts, opts);
      pending.done.push(done);
      return;
    }
    pending = { save, opts, done: [done] };
    if (!busy) void pump();
  });
}

async function pump(): Promise<void> {
  let job = pending;
  pending = null;
  if (!job) {
    busy = false;
    return;
  }
  busy = true;
  let p: Prepared | null = null;
  let restarts = 0;
  const timing: Timing = { total: 0, max: 0, slices: 0, maxPhase: '' };
  try {
    for (;;) {
      const e0 = epoch;
      // After two restarts, prepare in one go so a stream of mutations cannot starve the save.
      const r = await runSliced(prepareGen(job.save, job.opts), restarts >= 2, () => epoch === e0);
      timing.total += r.t.total;
      if (r.t.max > timing.max) {
        timing.max = r.t.max;
        timing.maxPhase = r.t.maxPhase;
      }
      timing.slices += r.t.slices;
      if (r.value !== RESTART) {
        p = r.value;
        break;
      }
      restarts++;
      persistStats.restarts++;
      if (pending) {
        // The newer request covers this one: commit the latest state for both.
        const nj: Job = pending;
        pending = null;
        nj.opts = mergeOpts(job.opts, nj.opts);
        nj.done = [...job.done, ...nj.done];
        job = nj;
      }
    }
  } catch (e) {
    T = fresh();
    for (const d of job.done) d(e);
    return pump();
  }
  const prepared = p!;
  Object.assign(prepared.info, { prepMs: timing.total, maxSliceMs: timing.max, maxSlicePhase: timing.maxPhase, slices: timing.slices, restarts });
  const guard = prepared.expectGen === null ? undefined : {
    store: 'parts' as const, key: MANIFEST_KEY,
    // Another tab may have committed since our last commit; then our diff base is wrong.
    test: (v: unknown) => (v as ManifestRecord | undefined)?.gen === prepared.expectGen,
  };
  const theJob = job;
  try {
    await commitOps(prepared.ops, prepared.gc ? { store: 'parts', keep: prepared.gc } : undefined, guard);
    failStreak = 0;
    persistStats.commits++;
    persistStats[prepared.info.mode]++;
    persistStats.partsWritten += prepared.info.written.length;
    persistStats.bytesWritten += prepared.info.bytes;
    if (prepared.info.compacted) persistStats.compactions++;
    persistStats.last = prepared.info;
    if (theJob.opts.backup || theJob.opts.forceBackup) {
      try {
        await maybeBackup(theJob.save, !!theJob.opts.forceBackup);
      } catch (e) {
        console.error('backup failed', e);
      }
    }
    for (const d of theJob.done) d();
  } catch (e) {
    // The tracker assumed this commit landed; forget it so the next commit rewrites everything
    // (after a conflict with another tab: last writer wins, as a whole consistent save).
    if (e instanceof CommitConflict) console.warn(e.message + '; rewriting this window\'s state');
    T = fresh();
    for (const d of theJob.done) d(e);
    if (++failStreak <= 2 && !pending && lastSave) pending = { save: lastSave, opts: { full: true }, done: [() => {}] };
  }
  return pump();
}

/**
 * Save the career. Cheap when little changed: during a game only the active
 * game is written; after a game only a journal of the changed rows. `backup:
 * true` asks for a rolling snapshot, taken when the backup policy says one is due.
 */
export function persistSave(save: Save, opts: { backup?: boolean; full?: boolean } = {}): Promise<void> {
  save.updatedAt = new Date().toISOString();
  return enqueue(save, { backup: opts.backup, full: opts.full }).catch((e) => console.error('save failed', e));
}

let background: Promise<void> = Promise.resolve();
/** Resolves once background work after a load (verification baselines) has finished. Test helper. */
export function persistIdle(): Promise<void> {
  return background;
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

// ------------------------------------------------------------------ persistence worker (backups, exports)

type WorkerReply = { id: number; ok: boolean; value?: unknown; error?: string };
let worker: Worker | null | undefined;
let workerSeq = 0;
const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

function persistWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  try {
    if (typeof Worker === 'undefined' || typeof window === 'undefined') return null;
    const w = new Worker(new URL('./persist.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerReply>) => {
      const p = waiting.get(e.data.id);
      if (!p) return;
      waiting.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.value);
      else p.reject(new Error(e.data.error));
    };
    w.onerror = (e) => {
      // Unusable worker (e.g. blocked by the browser): fall back to inline work from now on.
      console.warn('persistence worker failed', e.message);
      worker = null;
      for (const p of waiting.values()) p.reject(new Error('persistence worker failed'));
      waiting.clear();
      w.terminate();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** Run a job in the persistence worker, or inline where there is none (tests) or it fails. */
async function offload<T>(cmd: 'backup' | 'export'): Promise<{ value: T; inline: boolean }> {
  const w = persistWorker();
  if (w) {
    try {
      const value = await new Promise<unknown>((resolve, reject) => {
        const id = ++workerSeq;
        waiting.set(id, { resolve, reject });
        w.postMessage({ id, cmd });
      });
      return { value: value as T, inline: false };
    } catch (e) {
      console.warn(`persistence worker could not run ${cmd}; running it here`, e);
    }
  }
  return { value: (await (cmd === 'backup' ? buildBackupFromDb() : exportTextFromDb())) as T, inline: true };
}

// ------------------------------------------------------------------ backups

type Head = { key: string; savedAt: string; v: 1 | 2 | 3; season: number; games: number };
let backupHeads: Head[] | null = null;
const SLOT_KEYS = Array.from({ length: BACKUP_SLOTS }, (_, i) => `slot${i}`);
const isSnapshot = (b: unknown): b is BackupV2 | BackupV3 => isBackupV2(b) || isBackupV3(b);

async function heads(): Promise<Head[]> {
  if (backupHeads) return backupHeads;
  const out: Head[] = [];
  for (const k of SLOT_KEYS) {
    const b = await idb.get<BackupV2 | BackupV3 | Envelope>('backups', k);
    if (!b) continue;
    if (isSnapshot(b)) out.push({ key: k, savedAt: b.savedAt, v: b.v, season: b.season, games: b.games });
    else out.push({ key: k, savedAt: (b as Envelope).savedAt ?? '', v: 1, season: -1, games: -1 });
  }
  return (backupHeads = out);
}

async function maybeBackup(save: Save, force: boolean) {
  const hs = await heads();
  const v2 = hs.filter((h) => h.v >= 2).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  if (!force && !backupDue(v2[0] ?? null, save, gamesOf(save))) return;
  const t0 = performance.now();
  let b: BackupV2 | BackupV3 | null = null;
  let inline = true;
  try {
    // v0.4: built from the committed parts, off the main thread where possible.
    const r = await offload<BackupV3 | null>('backup');
    b = r.value;
    inline = r.inline;
  } catch (e) {
    console.warn('parts snapshot failed; taking a JSON backup instead', e);
  }
  b ??= await makeBackup(save);
  const free = SLOT_KEYS.find((k) => !hs.some((h) => h.key === k));
  const slot = free ?? [...hs].sort((a, c) => a.savedAt.localeCompare(c.savedAt))[0].key;
  const ops: Op[] = [{ store: 'backups', key: slot, value: b }];
  const next = [...hs.filter((h) => h.key !== slot), { key: slot, savedAt: b.savedAt, v: b.v, season: b.season, games: b.games }];
  // The pre-split (schema 1) save is kept until two new-format snapshots exist.
  if (next.filter((h) => h.v >= 2).length >= 2) ops.push({ store: 'backups', key: PRE_SPLIT_KEY, del: true });
  await commitOps(ops);
  backupHeads = next;
  persistStats.backups++;
  persistStats.lastBackup = { ms: performance.now() - t0, v: b.v, bytes: b.data instanceof ArrayBuffer ? b.data.byteLength : String(b.data).length, inline };
}

async function decodeBackup(rec: unknown): Promise<Save> {
  if (isBackupV3(rec)) return migrate(await readBackupV3(rec));
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
        if (isBackupV3(rec)) await checkBackupV3(rec);
        else if (isBackupV2(rec)) await readBackupText(rec);
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

const isV4 = (m: Manifest) => m.sizes?.v === LAYOUT_V4;

async function readParts(m: Manifest) {
  const names = Object.keys(m.parts);
  const recs = await getMany<Part4>('parts', names.map((n) => m.parts[n].key));
  const decoded = new Map<string, unknown>();
  const gens = new Map<string, number>();
  const raw = new Map<string, Part4 | undefined>();
  const damaged = new Set<string>();
  const v4 = isV4(m);
  let t0 = performance.now();
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    const r = recs[i];
    raw.set(n, r);
    gens.set(n, genOf(m.parts[n]));
    if (!verifyPart4(r, m.parts[n].sum)) {
      damaged.add(n);
      continue;
    }
    try {
      decoded.set(n, v4 ? decodePart4(n, r!) : decodePart(r as StoredPart));
    } catch {
      damaged.add(n);
    }
    if (performance.now() - t0 > persistTuning.sliceMs) {
      await yieldToMain();
      t0 = performance.now();
    }
  }
  return { decoded, gens, raw, damaged };
}

async function trackLoaded(m: Manifest, raw: Map<string, Part4 | undefined>, decoded: Map<string, unknown>, save: Save) {
  T = fresh();
  T.manifest = m;
  T.probe = probeOf(save);
  T.lastFullAt = Date.now();
  // An older layout: the first commit rewrites everything in layout v4 (old keys are collected).
  if (!isV4(m)) return;
  let t0 = performance.now();
  for (const [n, r] of raw) {
    if (!r || isPop(n)) continue;
    if (r.k === 'col') T.cache.set(n, r.sum);
    else if (r.k === 'json') {
      // Array chunks are stored as tabular JSON; change detection compares plain JSON of the
      // same (just decoded) elements.
      T.cache.set(n, n.startsWith('wa/') && !n.endsWith('/index') ? JSON.stringify(decoded.get(n)) : r.s);
    }
    if (performance.now() - t0 > persistTuning.sliceMs) {
      await yieldToMain();
      t0 = performance.now();
    }
  }
  const cs = (save.world as unknown as { competitors?: Obj[] } | undefined)?.competitors;
  if (!decoded.has('pop/index') || !Array.isArray(cs)) {
    if (!decoded.has('pop/raw')) T.mirror = new Mirror();
    return;
  }
  const baseRows = new Map<string, number>();
  for (const [n, v] of decoded) if (/^pop\/(cold|warm|h2h|rh)\//.test(n)) baseRows.set(n, rowsOfBase(v));
  const r = await runSliced(mirrorFromLoaded(cs, baseRows), false);
  const mirror = (T.mirror = r.value as Mirror);
  // Cold verification baselines are filled in the background (sliced), off the load path.
  background = runSliced(fillColdHashes(cs, mirror), false, () => T.mirror === mirror).then(() => {});
  for (const n of Object.keys(m.parts)) {
    if (!n.startsWith('jr/')) continue;
    const j = decoded.get(n) as JrDecoded;
    T.journals.push({ name: n, gen: genOf(m.parts[n]), bytes: m.parts[n].n, touches: journalTouches(j) });
  }
  T.journals.sort((a, b) => a.gen - b.gen);
}

async function loadSplit(manRec: ManifestRecord): Promise<LoadResult> {
  let m: Manifest;
  try {
    m = parseManifest(manRec);
  } catch (e) {
    return recoverWhole((e as Error).message, null);
  }
  const { decoded, gens, raw, damaged } = await readParts(m);
  if (damaged.size === 0) {
    let save: Save;
    try {
      const r = await runSliced(assembleAnyGen(m, decoded, gens), false);
      save = migrate(r.value as Record<string, unknown>);
    } catch (e) {
      return recoverWhole(`The save could not be assembled (${(e as Error).message}).`, null);
    }
    await trackLoaded(m, raw, decoded, save);
    return { save, recovered: false };
  }
  return recoverParts(m, decoded, gens, raw, damaged);
}

const isPopData = (n: string) => n.startsWith('pop/hot/') || n.startsWith('pop/cold/') || n.startsWith('pop/rh/') || n.startsWith('pop/warm/') || n.startsWith('pop/h2h/');

function lenient(n: string, r: Part4 | undefined, v4: boolean): unknown {
  try {
    if (r && r.k === 'jr') return decodeJournal(r);
    if (r && r.k === 'json' && typeof r.s === 'string') {
      const v = JSON.parse(r.s);
      return v4 && n.startsWith('wa/') && !n.endsWith('/index') ? tjDecode(v) : v;
    }
  } catch {
    /* unreadable */
  }
  return undefined;
}

/** A damaged competitor chunk read as-is if it still parses: id -> sub-record. */
function lenientChunk(r: Part4 | undefined, v4: boolean): Record<string, Record<string, unknown>> | undefined {
  try {
    if (!r || r.k !== 'json' || typeof r.s !== 'string') return undefined;
    const v = JSON.parse(r.s);
    if (!v4) return v && typeof v === 'object' ? v : undefined;
    const out: Record<string, Record<string, unknown>> = {};
    for (const [sr, sub] of decodeFamChunk(v)) out[idOfSerial(sr)] = sub;
    return out;
  } catch {
    return undefined;
  }
}

/** Repair a split save with damaged records, preferring the newest backup; never drops the career silently. */
async function recoverParts(m: Manifest, decoded: Map<string, unknown>, gens: Map<string, number>, raw: Map<string, Part4 | undefined>, damaged: Set<string>): Promise<LoadResult> {
  const v4 = isV4(m);
  const list = [...damaged];
  const notes: string[] = [];
  // Career, world core, tournaments, an index or a journal (which may hold new members of the index):
  // a consistent backup beats a patchwork.
  const structural = list.filter((n) => !isPopData(n) && n !== 'active');
  const backup = await newestBackup();
  if (structural.length) {
    if (backup) return recoverWhole(`Damaged save records (${structural.join(', ')}).`, backup);
    const unreadable: string[] = [];
    for (const n of structural) {
      const v = lenient(n, raw.get(n), v4);
      if (v === undefined) {
        if (n.startsWith('jr/')) {
          unreadable.push(n);
          continue;
        }
        return quarantine(m, raw, `Save records are damaged (${structural.join(', ')}) and no backup exists.`);
      }
      decoded.set(n, v);
      damaged.delete(n);
    }
    notes.push(`Read damaged records as-is (${structural.join(', ')}); no backup was available.`);
    if (unreadable.length) notes.push(`Changes in ${unreadable.join(', ')} could not be read and were lost.`);
    for (const n of unreadable) damaged.delete(n);
  }
  if (damaged.has('active')) {
    decoded.set('active', null);
    damaged.delete('active');
    notes.push('The in-progress game could not be read and was abandoned.');
  }
  const pop = list.filter(isPopData);
  let save: Save;
  try {
    if (pop.length) {
      const byId = new Map<string, Record<string, unknown>>();
      for (const c of (backup?.save.world?.competitors ?? []) as unknown as Record<string, unknown>[]) byId.set(c.id as string, c);
      const lenientChunks = new Map<string, Record<string, Record<string, unknown>>>();
      for (const n of pop) {
        const v = lenientChunk(raw.get(n), v4);
        if (v) lenientChunks.set(n, v);
      }
      const core = (decoded.get('world') ?? {}) as { seed?: number; day?: number };
      let fromBackup = 0;
      let fromDamaged = 0;
      let regenerated = 0;
      const hotSet = new Set<string>(HOT_KEYS);
      const keysOf = (fam: string, src: Record<string, unknown>) =>
        fam === 'cold' ? COLD.keys : fam === 'rh' ? RH.keys : fam === 'h2h' ? ['h2h'] : Object.keys(src).filter((k) => !COLD.keys.includes(k) && !RH.keys.includes(k) && !hotSet.has(k) && k !== 'h2h');
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
      save = migrate(assembleAny(m, decoded, gens, damaged, fill));
      notes.push(
        `Repaired ${pop.length} damaged competitor record${pop.length > 1 ? 's' : ''}` +
          (backup ? ` from the backup of ${new Date(backup.savedAt).toLocaleString()}` : '') +
          ` (${fromBackup} from backup, ${fromDamaged} read as-is, ${regenerated} regenerated).`,
      );
    } else save = migrate(assembleAny(m, decoded, gens));
  } catch (e) {
    return backup ? recoverWhole(`The save could not be repaired (${(e as Error).message}).`, backup) : quarantine(m, raw, `The save could not be repaired (${(e as Error).message}) and no backup exists.`);
  }
  return heal(save, notes);
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
async function quarantine(m: Manifest, raw: Map<string, Part4 | undefined>, why: string): Promise<LoadResult> {
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
    const { decoded, gens, damaged } = await readParts(m);
    if (damaged.size || canonicalJson(migrate(assembleAny(m, decoded, gens))) !== expected) throw new Error('split save did not verify');
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

/**
 * Game records. v0.3: records written before the 24-arena layout carry v0.2
 * arena / rank numbers; they are remapped when read (and tagged with
 * `arenaLayout`), new records are tagged when stored.
 */
export function storeGame(g: GameRecord) {
  g.arenaLayout ??= 24;
  return idb.put('games', g.id, g);
}
export async function getGame(id: string) {
  const g = await idb.get<GameRecord>('games', id);
  return g ? migrateGameRecordArenas(g) : g;
}
export async function allGames() {
  return (await idb.all<GameRecord>('games')).map(migrateGameRecordArenas);
}

// ------------------------------------------------------------------ export / import

export type ExportFileV1 = { format: 'gladius-backup'; version: 1; exportedAt: string; save: Envelope; games: GameRecord[] };
export type ExportFileV2 = { format: 'gladius-backup'; version: 2; exportedAt: string; schema: number; checksum: number; save: Save; games: GameRecord[] };
export type ExportFile = ExportFileV1 | ExportFileV2;

/**
 * One JSON file (version 2, unchanged): the Save as a plain object with a
 * checksum of its JSON, plus every stored game. v0.4: the save is committed
 * first and the file is built from the committed parts in the persistence
 * worker; if that is not possible it is built here from the live object.
 */
export async function exportAll(save: Save): Promise<string> {
  try {
    save.updatedAt = new Date().toISOString();
    await enqueue(save, { full: true });
    const r = await offload<string | null>('export');
    if (r.value) return r.value;
  } catch (e) {
    console.warn('export from the committed save failed; exporting the live save', e);
  }
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
  await commitOps(games.map((g) => ({ store: 'games' as const, key: g.id, value: migrateGameRecordArenas(g) })));
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
