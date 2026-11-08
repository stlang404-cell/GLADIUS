import { HOT_KEYS, COLD, RH, sumString, sumBuffers, decodePart, type ColDraft, type JsonDraft, type StoredPart, type DecodedCol } from './layout';
import { tjEncode, tjDecode } from './tj';

/**
 * Population layout v4 (GLADIUS v0.4, see docs/PERSISTENCE.md "v0.4").
 *
 * v0.3 re-encoded the whole population on every full commit and rewrote every
 * hot column and every head-to-head chunk (a simulated day touches ~30% of
 * 25,000 competitors). v0.4 keeps a *mirror* of what is persisted (typed
 * arrays indexed by competitor serial) and writes a per-commit **journal**
 * record holding only the rows / fields that differ from the mirror. Base
 * parts are rewritten only when the journals grow too large (compaction), on a
 * verification rewrite, or when a structure changes.
 *
 * Every part carries the generation that wrote it (manifest entry `g`). A
 * journal written at generation J applies to a base part written at
 * generation B only if J > B, so a base rewritten after a journal is never
 * overwritten by it on load, and journals can be dropped once every base they
 * touch is newer than they are. All of this lives in one manifest flip, so a
 * crash can never expose a mix of generations.
 *
 * Parts (logical names):
 *   pop/index          Int32 serials in array order (-1 = a competitor with a non-standard id, see pop/odd)
 *   pop/odd            JSON array of whole competitors with non-standard ids (normally absent)
 *   pop/raw            JSON of all competitors if ids are not unique (never expected)
 *   pop/hot/<key>      one column per hot numeric field, dense by serial (i8/i16/i32/f64 + optional tags)
 *   pop/h2h/<n>        Int32 blobs [serial, len, (oppSerial, w + 65536·d, l)…] for serials n·1024 …
 *   pop/rh/<n>         Int32 blobs [serial, len, (day, rating)…] (rating histories)
 *   pop/cold/<n>       tabular JSON {ids, t} of creation-time fields, 250 serials per chunk
 *   pop/warm/<n>       tabular JSON {ids, t} of everything else, 100 serials per chunk
 *   jr/<gen>           journal: changes of one commit (index appends, hot cells, blob patches, family rows)
 */

export const LAYOUT_V4 = 4;
export const SIZES_V4: Record<string, number> = { cold: 250, warm: 100, h2h: 1024, rh: 1024, v: LAYOUT_V4 };
const SZ = { cold: 250, warm: 100, h2h: 1024, rh: 1024 } as const;
/** Serials above this are treated as non-standard ids (keeps the typed-array mirror bounded). */
const MAX_SERIAL = 1 << 22;
const NKEYS = HOT_KEYS.length;
/** Read the hot fields of one competitor with named loads (one function, no per-key closure calls). */
function readHot(c: Obj, o: unknown[]) {
  o[0] = c.skill; o[1] = c.rating; o[2] = c.peak; o[3] = c.games; o[4] = c.w; o[5] = c.d; o[6] = c.l; o[7] = c.form; o[8] = c.streak;
  o[9] = c.rank; o[10] = c.peakRank; o[11] = c.potential; o[12] = c.tournamentsWon; o[13] = c.championships; o[14] = c.retiredDay; o[15] = c.tp; o[16] = c.last;
}
if (HOT_KEYS.join() !== 'skill,rating,peak,games,w,d,l,form,streak,rank,peakRank,potential,tournamentsWon,championships,retiredDay,tp,last') throw new Error('readHot out of sync with HOT_KEYS');

type Obj = Record<string, unknown>;
export type Dt = ColDraft['dt'];
export type BlobFam = 'h2h' | 'rh';
export type JsonFam = 'cold' | 'warm';
const BLOB_FAMS: BlobFam[] = ['h2h', 'rh'];
const JSON_FAMS: JsonFam[] = ['cold', 'warm'];

/** Journal part as stored: JSON header + typed buffers (IndexedDB clones ArrayBuffers natively). */
export type JrPart = { k: 'jr'; h: string; b: ArrayBuffer[]; sum: number };
export type Part4 = StoredPart | JrPart;
type JrHeader = {
  v: 4;
  /** buffer index: serials appended to pop/index */
  idx?: number;
  /** buffer index: shared row serials for dense hot entries */
  R?: number;
  hot?: { k: string; rows: number; dt: Dt; v: number; t: number }[]; // rows: buffer index, or -1 = R
  blob?: Partial<Record<BlobFam, number>>;
  fam?: Partial<Record<JsonFam, { ids: number[]; t: unknown }>>;
};

// ---------------------------------------------------------------- small helpers

const P = 0x01000193;
const FNV = 0x811c9dc5;
function mixNum(h: number, x: number): number {
  if ((x | 0) === x) return Math.imul(h ^ x, P);
  if (typeof x !== 'number' || x !== x) return Math.imul(h ^ 0x7fffffff, P);
  h = Math.imul(h ^ Math.floor(x), P);
  return Math.imul(h ^ Math.round((x - Math.floor(x)) * 1e9), P);
}
function mixStr(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), P);
  return Math.imul(h ^ 0x2c, P);
}

/** Serial of a standard competitor id ("c" + ≥ 6 digits, no extra zero padding), else -1. */
export function serialOfId(id: unknown): number {
  if (typeof id !== 'string') return -1;
  const len = id.length;
  if (len < 7 || len > 10 || id.charCodeAt(0) !== 99 || (len > 7 && id.charCodeAt(1) === 48)) return -1;
  let n = 0;
  for (let i = 1; i < len; i++) {
    const d = id.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return -1;
    n = n * 10 + d;
  }
  return n;
}
/** h2h opponent: 'player' = -1, standard id = serial, else null. */
function oppSerial(id: unknown): number | null {
  if (id === 'player') return -1;
  const s = serialOfId(id);
  return s < 0 ? null : s;
}
export const idOfSerial = (n: number) => (n === -1 ? 'player' : 'c' + String(n).padStart(6, '0'));
export const chunkName = (fam: string, serial: number) => `pop/${fam}/${Math.floor(serial / (SZ as Record<string, number>)[fam])}`;
/** Generation of a stored part from its manifest entry. */
export function genOf(e: { key: string; g?: number }): number {
  if (typeof e.g === 'number') return e.g;
  const at = e.key.lastIndexOf('@');
  const g = at >= 0 ? Number(e.key.slice(at + 1)) : 0;
  return Number.isFinite(g) ? g : 0;
}

function isInt(x: number) {
  return (x | 0) === x && !(x === 0 && 1 / x < 0);
}
function narrow(vals: Float64Array | number[], n: number): { dt: Dt; v: ArrayBuffer } {
  let int = true;
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const x = vals[i];
    if (!isInt(x)) {
      int = false;
      break;
    }
    if (x < lo) lo = x;
    else if (x > hi) hi = x;
  }
  const src = vals instanceof Float64Array ? vals.subarray(0, n) : Float64Array.from(vals.slice(0, n));
  if (!int) return { dt: 'f64', v: src.slice().buffer as ArrayBuffer };
  if (lo >= -128 && hi <= 127) return { dt: 'i8', v: Int8Array.from(src).buffer as ArrayBuffer };
  if (lo >= -32768 && hi <= 32767) return { dt: 'i16', v: Int16Array.from(src).buffer as ArrayBuffer };
  return { dt: 'i32', v: Int32Array.from(src).buffer as ArrayBuffer };
}
function typed(dt: Dt, b: ArrayBuffer): ArrayLike<number> {
  return dt === 'i32' ? new Int32Array(b) : dt === 'i16' ? new Int16Array(b) : dt === 'i8' ? new Int8Array(b) : new Float64Array(b);
}
const i32buf = (a: number[] | Int32Array) => (a instanceof Int32Array ? a.slice().buffer : Int32Array.from(a).buffer) as ArrayBuffer;

// ---------------------------------------------------------------- blob encoders

/** h2h list → Int32 words (oppSerial, w + 65536·d, l)×n into scratch; length or -1 if not encodable. */
function encH2H(list: unknown, sc: Scratch): number {
  if (!Array.isArray(list)) return -1;
  const need = list.length * 3;
  const v = sc.need(need);
  let p = 0;
  for (let k = 0; k < list.length; k++) {
    const e = list[k] as Obj;
    if (!e || typeof e !== 'object') return -1;
    const s = oppSerial(e.id);
    const w = e.w as number;
    const d = e.d as number;
    const l = e.l as number;
    // (H2H entries have exactly id / w / d / l, as in v0.3; other properties are not part of the format.)
    if (s === null || !Number.isInteger(w) || !Number.isInteger(d) || !Number.isInteger(l) || w < 0 || w >= 65536 || d < 0 || d >= 32768 || l < 0 || l > 0x7fffffff) return -1;
    v[p++] = s;
    v[p++] = w + 65536 * d;
    v[p++] = l;
  }
  return p;
}
function decH2H(v: ArrayLike<number>, from: number, len: number): { id: string; w: number; d: number; l: number }[] {
  const out: { id: string; w: number; d: number; l: number }[] = new Array(len / 3);
  for (let i = 0, k = 0; i < len; i += 3, k++) {
    const wd = v[from + i + 1];
    out[k] = { id: idOfSerial(v[from + i]), w: wd % 65536, d: Math.floor(wd / 65536), l: v[from + i + 2] };
  }
  return out;
}
/** rating history [[day, rating], …] of int32 → words; -1 if not encodable (then it is kept as JSON in warm). */
function encRH(list: unknown, sc: Scratch): number {
  if (!Array.isArray(list)) return -1;
  const v = sc.need(list.length * 2);
  let p = 0;
  for (let k = 0; k < list.length; k++) {
    const e = list[k];
    if (!Array.isArray(e) || e.length !== 2) return -1;
    const a = e[0];
    const b = e[1];
    if (typeof a !== 'number' || typeof b !== 'number' || !isInt(a) || !isInt(b)) return -1;
    v[p++] = a;
    v[p++] = b;
  }
  return p;
}
/**
 * Quick check that a rating history equals its persisted blob: same length and
 * same first and last samples (the simulation only appends and thins, which
 * always changes the last sample). The full comparison runs on the rolling
 * verification turn of the competitor's chunk.
 */
function rhSame(list: unknown, old: number[] | undefined): boolean {
  if (!old || !Array.isArray(list) || list.length * 2 !== old.length || !list.length) return false;
  const a = list[0];
  const z = list[list.length - 1];
  return Array.isArray(a) && Array.isArray(z) && a[0] === old[0] && a[1] === old[1] && z[0] === old[old.length - 2] && z[1] === old[old.length - 1];
}
function decRH(v: ArrayLike<number>, from: number, len: number): [number, number][] {
  const out: [number, number][] = new Array(len / 2);
  for (let i = 0, k = 0; i < len; i += 2, k++) out[k] = [v[from + i], v[from + i + 1]];
  return out;
}

class Scratch {
  v = new Int32Array(256);
  need(n: number) {
    if (n > this.v.length) this.v = new Int32Array(Math.max(n, this.v.length * 2));
    return this.v;
  }
}

// ---------------------------------------------------------------- signatures (cheap change filters for JSON families)

/**
 * Cold signature: the only cold fields game code edits after creation are the
 * playing / opening styles, and every such edit stamps `styleDay`
 * (sim.styleDrift). The cheap signature covers styleDay, the style's length
 * and first letter and the opening-style count; anything else is caught by the
 * rolling verification.
 */
function coldSig(c: Obj, nKeys: number): number {
  let h = mixNum(mixNum(FNV, nKeys), typeof c.styleDay === 'number' ? c.styleDay : -1);
  const st = c.style;
  if (typeof st === 'string') h = mixNum(mixNum(h, st.length), st.length ? st.charCodeAt(0) : 0);
  const os = c.openingStyles;
  if (Array.isArray(os)) h = mixNum(h, os.length + 1000);
  return h >>> 0;
}
/**
 * Warm signature: titles, honours (count + first + last), career arcs,
 * preparation, style day, and any value that had to fall back to the warm
 * family (non-numeric hot field, unencodable h2h / rating history), and the
 * competitor's key count. An edit it cannot see (a value of an unknown field
 * changed in place) is caught by the rolling verification.
 */
function warmSig(c: Obj, fb: number, fbHot: string | null, nKeys: number): number {
  let h = mixNum(mixNum(FNV, fb), nKeys);
  const titles = c.titles;
  if (Array.isArray(titles)) for (const t of titles) h = mixStr(h, String(t));
  const hon = c.honours;
  if (Array.isArray(hon)) {
    h = mixNum(h, hon.length);
    if (hon.length) h = mixStr(mixStr(h, String(hon[0])), String(hon[hon.length - 1]));
  }
  const arc = c.arc as Obj | undefined;
  if (arc && typeof arc === 'object') for (const k in arc) h = mixNum(mixStr(h, k), Number(arc[k]));
  const prep = c.prep as { vsPlayerOpenings?: unknown[] } | undefined;
  if (prep && Array.isArray(prep.vsPlayerOpenings)) for (const x of prep.vsPlayerOpenings) h = mixStr(h, String(x));
  if (typeof c.styleDay === 'number') h = mixNum(h, c.styleDay);
  if (fb & 1) h = mixStr(h, JSON.stringify(c.h2h) ?? '');
  if (fb & 2) h = mixStr(h, JSON.stringify(c.ratingHistory) ?? '');
  if (fbHot) h = mixStr(h, fbHot);
  return h >>> 0;
}

const ROUTE: Record<string, number> = Object.create(null); // 1 cold, 2 rh, 3 hot, 4 h2h
for (const k of COLD.keys) ROUTE[k] = 1;
for (const k of RH.keys) ROUTE[k] = 2;
const HOT_INDEX: Record<string, number> = Object.create(null);
HOT_KEYS.forEach((k, i) => {
  ROUTE[k] = 3;
  HOT_INDEX[k] = i;
});
ROUTE.h2h = 4;

/** Sub-object of family `fam` (fb: 1 = h2h in warm, 2 = rating history in warm). */
function subOf(c: Obj, fam: JsonFam, fb: number): Obj {
  const o: Obj = {};
  for (const k in c) {
    const v = c[k];
    if (v === undefined) continue;
    const r = ROUTE[k];
    if (fam === 'cold') {
      if (r === 1) o[k] = v;
      continue;
    }
    if (r === 1) continue;
    if (r === 2 && !(fb & 2)) continue;
    if (r === 4 && !(fb & 1)) continue;
    if (r === 3 && (v === null || typeof v === 'number')) continue; // stored in the column
    o[k] = v;
  }
  return o;
}

// ---------------------------------------------------------------- mirror

/**
 * What is persisted, per serial. Invariant: for every serial in the persisted
 * index the mirror equals what a load would produce; for other serials it is
 * either equal or marked unknown (hot tag 3, no blob, `has` 0).
 */
export class Mirror {
  cap = 0;
  hv: Float64Array[] = [];
  ht: Uint8Array[] = []; // 0 number, 1 null, 2 not in the column, 3 unknown
  /**
   * Persisted blob words per serial (holey arrays indexed by serial; plain arrays are cheap to
   * allocate, unlike thousands of small typed arrays). `h2hIds` keeps the opponent id strings the
   * h2h words were encoded from, so an unchanged list is recognised by identity without re-parsing ids.
   */
  blobs: Record<BlobFam, (number[] | undefined)[]> = { h2h: [], rh: [] };
  h2hIds: (string[] | undefined)[] = [];
  sig: Record<JsonFam, Uint32Array> = { cold: new Uint32Array(0), warm: new Uint32Array(0) };
  hash: Record<JsonFam, Uint32Array> = { cold: new Uint32Array(0), warm: new Uint32Array(0) };
  has: Record<JsonFam, Uint8Array> = { cold: new Uint8Array(0), warm: new Uint8Array(0) };
  /** Fallback flags per serial (1 h2h in warm, 2 rh in warm) as persisted. */
  fb = new Uint8Array(0);
  index: Int32Array = new Int32Array(0);
  /** Rows per stored family / blob chunk base (for stale-member bookkeeping). */
  baseRows = new Map<string, number>();
  constructor() {
    for (let k = 0; k < NKEYS; k++) {
      this.hv.push(new Float64Array(0));
      this.ht.push(new Uint8Array(0));
    }
  }
  grow(maxSerial: number) {
    if (maxSerial < this.cap) return;
    const cap = Math.max(maxSerial + 1, Math.ceil(this.cap * 1.25), 1024);
    const g8 = (a: Uint8Array, fill = 0) => {
      const n = new Uint8Array(cap);
      if (fill) n.fill(fill);
      n.set(a);
      return n;
    };
    for (let k = 0; k < NKEYS; k++) {
      const v = new Float64Array(cap);
      v.set(this.hv[k]);
      this.hv[k] = v;
      this.ht[k] = g8(this.ht[k], 3);
    }
    for (const f of JSON_FAMS) {
      const s = new Uint32Array(cap);
      s.set(this.sig[f]);
      this.sig[f] = s;
      const h = new Uint32Array(cap);
      h.set(this.hash[f]);
      this.hash[f] = h;
      this.has[f] = g8(this.has[f]);
    }
    this.fb = g8(this.fb);
    this.cap = cap;
  }
}

// ---------------------------------------------------------------- scan (change detection)

export type PopScan = {
  /** pop/raw fallback (ids not unique): the JSON text. */
  raw: string | null;
  index: Int32Array;
  odd: Obj[];
  maxSerial: number;
  /** Mirror-only scan (fresh): no journal content was produced; every present member is stored by the bases. */
  fresh: boolean;
  hot: { s: number[]; v: number[]; t: number[] }[];
  blobOps: Record<BlobFam, number[]>;
  blobNew: Record<BlobFam, Map<number, number[] | null>>;
  /** Opponent id strings of h2h lists whose words were (re)encoded. */
  h2hIds: Map<number, string[]>;
  fam: Record<JsonFam, Map<number, { sub: Obj; hash: number }>>;
  sigs: Record<JsonFam, Map<number, number>>;
  /** Baselines established by the verification pass (hash only). */
  base: Record<JsonFam, Map<number, number>>;
  fb: Map<number, number>;
  /** Number of family members checked by the verification pass. */
  verified: number;
  touched: Set<string>;
};

export type ScanOpts = {
  /** Verification: family chunks whose index mod `every` equals `turn` are re-serialised and compared. */
  verify?: { every: number; turn: number; coldEvery: number };
  /**
   * Mirror-only scan: every value is recorded as changed (to fill a new mirror), no
   * journal content is produced (the caller writes every base part) and family
   * sub-records are not serialised.
   */
  fresh?: boolean;
  /**
   * With `fresh`: also record the content hash of family sub-records (verification baselines):
   * 'all', or 'warm' (cold baselines are then computed later by fillColdHashes).
   */
  hashes?: 'all' | 'warm';
};

const SLICE_ROWS = 1536;

/**
 * Compare the live population with the mirror. A generator: it yields every
 * SLICE_ROWS competitors so the caller can give the main thread back. It never
 * modifies the mirror (see applyScan).
 */
export function* scanPopulation(cs: Obj[], m: Mirror, o: ScanOpts = {}): Generator<void, PopScan> {
  const n = cs.length;
  const index = new Int32Array(n);
  const odd: Obj[] = [];
  let maxSerial = -1;
  let dup = false;
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const c = cs[i];
    const id = c && typeof c === 'object' ? c.id : undefined;
    let s = serialOfId(id);
    if (s > MAX_SERIAL) s = -1;
    index[i] = s;
    if (s < 0) {
      if (typeof id !== 'string' || seen.has(id)) dup = true;
      else seen.add(id);
      odd.push(c);
    } else if (s > maxSerial) maxSerial = s;
  }
  const res: PopScan = {
    raw: null, index, odd, maxSerial, fresh: !!o.fresh,
    hot: HOT_KEYS.map(() => ({ s: [], v: [], t: [] })),
    blobOps: { h2h: [], rh: [] }, blobNew: { h2h: new Map(), rh: new Map() }, h2hIds: new Map(),
    fam: { cold: new Map(), warm: new Map() }, sigs: { cold: new Map(), warm: new Map() }, base: { cold: new Map(), warm: new Map() },
    fb: new Map(), verified: 0, touched: new Set(),
  };
  // Duplicate serials?
  if (!dup && maxSerial >= 0) {
    const bits = new Uint8Array(maxSerial + 1);
    for (let i = 0; i < n; i++) {
      const s = index[i];
      if (s < 0) continue;
      if (bits[s]) {
        dup = true;
        break;
      }
      bits[s] = 1;
    }
  }
  if (dup) {
    res.raw = JSON.stringify(cs);
    return res;
  }
  m.grow(Math.max(maxSerial, 0));
  const ctx: ScanCtx = { cs, m, res, sc: new Scratch(), fresh: !!o.fresh, hashes: o.fresh ? o.hashes ?? null : null, v: o.verify };
  for (let i0 = 0; i0 < n; i0 += SLICE_ROWS) {
    const end = Math.min(n, i0 + SLICE_ROWS);
    scanRows(ctx, i0, end);
    if (end < n) yield;
  }
  return res;
}

type ScanCtx = { cs: Obj[]; m: Mirror; res: PopScan; sc: Scratch; fresh: boolean; hashes: 'all' | 'warm' | null; v: ScanOpts['verify'] };

/**
 * Encode one blob (h2h list / rating history), compare it with the mirror and record a change.
 * False if the value exists but cannot be encoded (it is then kept as JSON in the warm family).
 */
function blobChange(ctx: ScanCtx, fam: BlobFam, s: number, raw: unknown, old: number[] | undefined): boolean {
  const { res, sc, fresh } = ctx;
  const len = raw === undefined ? -1 : fam === 'h2h' ? encH2H(raw, sc) : encRH(raw, sc);
  if (len < 0) {
    if (old) {
      res.blobOps[fam].push(s, 2);
      res.blobNew[fam].set(s, null);
    }
    return raw === undefined;
  }
  const w = sc.v;
  if (!fresh && old && old.length === len) {
    let same = true;
    for (let j = 0; j < len; j++) if (old[j] !== w[j]) { same = false; break; }
    if (same) {
      if (fam === 'h2h') res.h2hIds.set(s, (raw as { id: string }[]).map((e) => e.id)); // same words, new id strings
      return true;
    }
  }
  const nb: number[] = new Array(len);
  for (let j = 0; j < len; j++) nb[j] = w[j];
  if (fresh) {
    ctx.m.blobs[fam][s] = nb;
    if (fam === 'h2h') ctx.m.h2hIds[s] = (raw as { id: string }[]).map((e) => e.id);
    return true;
  }
  res.blobNew[fam].set(s, nb);
  if (fam === 'h2h') res.h2hIds.set(s, (raw as { id: string }[]).map((e) => e.id));
  const ops = res.blobOps[fam];
  if (!old) {
    ops.push(s, 0, len);
    for (let j = 0; j < len; j++) ops.push(nb[j]);
    return true;
  }
  const ol = old.length;
  const min = Math.min(ol, len);
  let p = 0;
  while (p < min && old[p] === nb[p]) p++;
  let q = 0;
  while (q < min - p && old[ol - 1 - q] === nb[len - 1 - q]) q++;
  const mid = len - p - q;
  if (mid + 5 < len + 3) {
    ops.push(s, 1, p, q, mid);
    for (let j = p; j < p + mid; j++) ops.push(nb[j]);
  } else {
    ops.push(s, 0, len);
    for (let j = 0; j < len; j++) ops.push(nb[j]);
  }
  return true;
}

/** One slice of the scan (a plain function: V8 optimises it, unlike a loop inside a generator). */
function scanRows(ctx: ScanCtx, i0: number, end: number) {
  const { cs, m, res, fresh, hashes, v } = ctx;
  const index = res.index;
  const hot: unknown[] = new Array(NKEYS);
  const hts = m.ht;
  const hvs = m.hv;
  const resHot = res.hot;
  for (let i = i0; i < end; i++) {
    const s = index[i];
    if (s < 0) continue;
    const c = cs[i];
    // Hot columns.
    let fbHot: string | null = null;
    readHot(c, hot);
    for (let k = 0; k < NKEYS; k++) {
      const x = hot[k];
      let t: number;
      let val = 0;
      if (typeof x === 'number' && x === x) {
        t = 0;
        val = x;
      } else if (x === null || typeof x === 'number') t = 1;
      else {
        t = 2;
        if (x !== undefined) fbHot = (fbHot ?? '') + HOT_KEYS[k] + '=' + JSON.stringify(x) + ';';
      }
      if (fresh) {
        // Fresh scans fill their own new mirror directly.
        hvs[k][s] = val;
        hts[k][s] = t;
        continue;
      }
      const mt = hts[k][s];
      if (mt !== t || (t === 0 && (hvs[k][s] !== val || (val === 0 && 1 / val !== 1 / hvs[k][s])))) {
        const h = resHot[k];
        h.s.push(s);
        h.v.push(val);
        h.t.push(t);
      }
    }
    // Blob families.
    let fb = 0;
    // h2h: an unchanged list is recognised entry by entry against the persisted words and id strings.
    const hl = c.h2h;
    const oldH = m.blobs.h2h[s];
    let same = false;
    if (!fresh && oldH && Array.isArray(hl) && oldH.length === hl.length * 3) {
      const ids = m.h2hIds[s]!;
      same = true;
      for (let k = 0, j = 0; k < hl.length; k++, j += 3) {
        const e = hl[k] as { id?: unknown; w?: number; d?: number; l?: number } | null;
        if (!e || e.id !== ids[k]) { same = false; break; }
        const w = e.w as number;
        const d = e.d as number;
        if ((w | 0) !== w || (d | 0) !== d || w < 0 || w >= 65536 || d < 0 || w + 65536 * d !== oldH[j + 1] || e.l !== oldH[j + 2]) { same = false; break; }
      }
    }
    if (!same && !blobChange(ctx, 'h2h', s, hl, oldH)) fb |= 1;
    // Rating history: quick check (see rhSame), full comparison on the verification turn.
    const rl = c.ratingHistory;
    const oldR = m.blobs.rh[s];
    if ((fresh || !rhSame(rl, oldR) || (v && (Math.floor(s / SZ.warm) + 3) % v.every === v.turn % v.every)) && !blobChange(ctx, 'rh', s, rl, oldR)) fb |= 2;
    if (fresh) m.fb[s] = fb;
    else if (fb !== m.fb[s]) res.fb.set(s, fb);
    // JSON families (cold, warm). The number of own keys is part of both signatures (catches added / deleted fields).
    let nKeys = 0;
    for (const _ in c) nKeys++;
    for (let fi = 0; fi < 2; fi++) {
      const fam = JSON_FAMS[fi];
      const sig = fi === 0 ? coldSig(c, nKeys) : warmSig(c, fb, fbHot, nKeys);
      const has = m.has[fam][s] === 1;
      if (fresh) {
        m.sig[fam][s] = sig;
        if (hashes && (fi === 1 || hashes === 'all')) m.hash[fam][s] = sumString(JSON.stringify(subOf(c, fam, fb)));
        continue;
      }
      const sigChanged = !has || m.sig[fam][s] !== sig;
      const chunk = Math.floor(s / SZ[fam]);
      const verifyNow = !sigChanged && !!v && (chunk + fi * 7) % (fi === 0 ? v.coldEvery : v.every) === v.turn % (fi === 0 ? v.coldEvery : v.every);
      if (!sigChanged && !verifyNow) continue;
      const sub = subOf(c, fam, fb);
      const hash = sumString(JSON.stringify(sub));
      if (verifyNow) {
        res.verified++;
        const known = m.hash[fam][s];
        if (known === 0) {
          res.base[fam].set(s, hash);
          continue;
        }
        if (known === hash) continue;
      } else if (has && m.hash[fam][s] === hash) {
        res.sigs[fam].set(s, sig);
        continue;
      }
      res.sigs[fam].set(s, sig);
      res.fam[fam].set(s, { sub, hash });
    }
  }
}

// ---------------------------------------------------------------- journal

export type JournalDraft = { part: JrPart; bytes: number; touches: Set<string> };

/** Base part names the changes of a scan touch. */
export function scanTouches(sc: PopScan, idxAppend: number): Set<string> {
  const t = new Set<string>();
  if (idxAppend) t.add('pop/index');
  sc.hot.forEach((x, k) => x.s.length && t.add('pop/hot/' + HOT_KEYS[k]));
  for (const f of BLOB_FAMS) for (const s of sc.blobNew[f].keys()) t.add(chunkName(f, s));
  for (const f of JSON_FAMS) for (const s of sc.fam[f].keys()) t.add(chunkName(f, s));
  return t;
}

/** Rough size of the journal a scan would produce (to decide on compaction before building it). */
export function journalEstimate(sc: PopScan, idxAppend: number): number {
  let n = idxAppend * 4;
  for (const x of sc.hot) n += x.s.length * 9;
  for (const f of BLOB_FAMS) n += sc.blobOps[f].length * 4;
  for (const f of JSON_FAMS) n += sc.fam[f].size * 400;
  return n;
}

/** Encode the changes of one scan as a journal record (null when there are none). */
export function buildJournal(sc: PopScan, m: Mirror, idxAppend: Int32Array | null): JournalDraft | null {
  const h: JrHeader = { v: 4 };
  const b: ArrayBuffer[] = [];
  const touches = new Set<string>();
  const add = (x: ArrayBuffer) => b.push(x) - 1;
  if (idxAppend && idxAppend.length) {
    h.idx = add(idxAppend.slice().buffer as ArrayBuffer);
    touches.add('pop/index');
  }
  // Hot: rows shared by the columns that change a lot (R), own rows for the others.
  const mark = new Uint8Array(Math.max(sc.maxSerial + 1, 0));
  let nR = 0;
  for (const x of sc.hot) for (const s of x.s) if (!mark[s]) {
    mark[s] = 1;
    nR++;
  }
  if (nR) {
    const R = new Int32Array(nR);
    const pos = new Int32Array(mark.length);
    for (let s = 0, i = 0; s < mark.length; s++) if (mark[s]) {
      pos[s] = i;
      R[i++] = s;
    }
    let rIdx = -1;
    h.hot = [];
    for (let k = 0; k < NKEYS; k++) {
      const x = sc.hot[k];
      if (!x.s.length) continue;
      touches.add('pop/hot/' + HOT_KEYS[k]);
      const dense = x.s.length * 3 >= R.length;
      let vals: Float64Array;
      let tags: Uint8Array | null = null;
      let rows: number;
      if (dense) {
        if (rIdx < 0) rIdx = h.R = add(R.buffer as ArrayBuffer);
        rows = -1;
        vals = new Float64Array(R.length);
        const tg = new Uint8Array(R.length);
        // Rows of R this column does not change carry the mirror value (they are unchanged).
        for (let i = 0; i < R.length; i++) {
          const s = R[i];
          const mt = m.ht[k][s];
          tg[i] = mt === 3 ? 2 : mt;
          vals[i] = m.hv[k][s];
        }
        for (let j = 0; j < x.s.length; j++) {
          const i = pos[x.s[j]];
          vals[i] = x.v[j];
          tg[i] = x.t[j];
        }
        if (tg.some((t) => t !== 0)) tags = tg;
      } else {
        rows = add(i32buf(x.s));
        vals = Float64Array.from(x.v);
        if (x.t.some((t) => t !== 0)) tags = Uint8Array.from(x.t);
      }
      if (tags) for (let i = 0; i < vals.length; i++) if (tags[i] !== 0) vals[i] = 0;
      const nv = narrow(vals, vals.length);
      h.hot.push({ k: HOT_KEYS[k], rows, dt: nv.dt, v: add(nv.v), t: tags ? add(tags.buffer as ArrayBuffer) : -1 });
    }
  }
  for (const fam of BLOB_FAMS) {
    const ops = sc.blobOps[fam];
    if (!ops.length) continue;
    (h.blob ??= {})[fam] = add(i32buf(ops));
    for (const s of sc.blobNew[fam].keys()) touches.add(chunkName(fam, s));
  }
  for (const fam of JSON_FAMS) {
    const up = sc.fam[fam];
    if (!up.size) continue;
    const ids = [...up.keys()];
    (h.fam ??= {})[fam] = { ids, t: tjEncode(ids.map((s) => up.get(s)!.sub)) };
    for (const s of ids) touches.add(chunkName(fam, s));
  }
  if (!touches.size) return null;
  const hs = JSON.stringify(h);
  const sum = jrSum(hs, b);
  let bytes = hs.length * 2;
  for (const x of b) bytes += x.byteLength;
  return { part: { k: 'jr', h: hs, b, sum }, bytes, touches };
}

function jrSum(h: string, b: ArrayBuffer[]): number {
  return (Math.imul(sumString(h) ^ sumBuffers(...b), P) ^ b.length) >>> 0;
}

export type JrDecoded = {
  idx: Int32Array | null;
  hot: { k: string; rows: Int32Array; v: ArrayLike<number>; t: Uint8Array | null }[];
  blob: Partial<Record<BlobFam, Int32Array>>;
  fam: Partial<Record<JsonFam, Map<number, Obj>>>;
};

export function decodeJournal(p: JrPart): JrDecoded {
  const h = JSON.parse(p.h) as JrHeader;
  if (h.v !== 4) throw new Error('unknown journal version');
  const B = (i: number) => {
    const x = p.b[i];
    if (!(x instanceof ArrayBuffer)) throw new Error('journal buffer missing');
    return x;
  };
  const R = h.R !== undefined ? new Int32Array(B(h.R)) : null;
  const out: JrDecoded = { idx: h.idx !== undefined ? new Int32Array(B(h.idx)) : null, hot: [], blob: {}, fam: {} };
  for (const x of h.hot ?? []) {
    const rows = x.rows < 0 ? R! : new Int32Array(B(x.rows));
    out.hot.push({ k: x.k, rows, v: typed(x.dt, B(x.v)), t: x.t >= 0 ? new Uint8Array(B(x.t)) : null });
  }
  for (const fam of BLOB_FAMS) if (h.blob?.[fam] !== undefined) out.blob[fam] = new Int32Array(B(h.blob[fam]!));
  for (const fam of JSON_FAMS) {
    const f = h.fam?.[fam];
    if (!f) continue;
    const rows = tjDecode(f.t) as Obj[];
    const mm = new Map<number, Obj>();
    f.ids.forEach((s, i) => mm.set(s, rows[i]));
    out.fam[fam] = mm;
  }
  return out;
}

/** Base part names a decoded journal touches (to know when it can be dropped). */
export function journalTouches(j: JrDecoded): Set<string> {
  const t = new Set<string>();
  if (j.idx) t.add('pop/index');
  for (const x of j.hot) t.add('pop/hot/' + x.k);
  for (const fam of BLOB_FAMS) {
    const ops = j.blob[fam];
    if (!ops) continue;
    walkOps(ops, (s) => t.add(chunkName(fam, s)));
  }
  for (const fam of JSON_FAMS) for (const s of j.fam[fam]?.keys() ?? []) t.add(chunkName(fam, s));
  return t;
}

/** Iterate blob ops; `apply` (if given) receives the new blob or null. */
function walkOps(ops: Int32Array, visit: (s: number, at: number) => void) {
  let i = 0;
  while (i < ops.length) {
    const s = ops[i];
    const op = ops[i + 1];
    visit(s, i);
    if (op === 0) i += 3 + ops[i + 2];
    else if (op === 1) i += 5 + ops[i + 4];
    else if (op === 2) i += 2;
    else throw new Error('bad blob op');
  }
}
function applyOp(ops: Int32Array, at: number, old: Int32Array | undefined): Int32Array | null {
  const op = ops[at + 1];
  if (op === 0) return ops.slice(at + 3, at + 3 + ops[at + 2]);
  if (op === 2) return null;
  const p = ops[at + 2];
  const q = ops[at + 3];
  const mid = ops[at + 4];
  if (!old || p + q > old.length) throw new Error('blob patch without base');
  const out = new Int32Array(p + mid + q);
  out.set(old.subarray(0, p), 0);
  out.set(ops.subarray(at + 5, at + 5 + mid), p);
  out.set(old.subarray(old.length - q), p + mid);
  return out;
}

// ---------------------------------------------------------------- apply a scan to the mirror

export function applyScan(m: Mirror, sc: PopScan) {
  for (let k = 0; k < NKEYS; k++) {
    const x = sc.hot[k];
    const hv = m.hv[k];
    const ht = m.ht[k];
    for (let j = 0; j < x.s.length; j++) {
      hv[x.s[j]] = x.v[j];
      ht[x.s[j]] = x.t[j];
    }
  }
  for (const fam of BLOB_FAMS)
    for (const [s, b] of sc.blobNew[fam]) {
      m.blobs[fam][s] = b ?? undefined;
      if (fam === 'h2h' && !b) m.h2hIds[s] = undefined;
    }
  for (const [s, ids] of sc.h2hIds) m.h2hIds[s] = ids;
  for (const fam of JSON_FAMS) {
    for (const [s, sig] of sc.sigs[fam]) m.sig[fam][s] = sig;
    for (const [s, u] of sc.fam[fam]) {
      m.hash[fam][s] = u.hash;
      m.has[fam][s] = 1;
    }
    for (const [s, h] of sc.base[fam]) m.hash[fam][s] = h;
  }
  for (const [s, f] of sc.fb) m.fb[s] = f;
  if (sc.fresh) for (const s of sc.index) if (s >= 0) m.has.cold[s] = m.has.warm[s] = 1;
  m.index = sc.index;
}

// ---------------------------------------------------------------- base parts (compaction / verification rewrite)

/**
 * Hot column over all serials of the index (other serials hold 0), as the mirror will be once
 * `sc` is applied. Pure (it may run between yields); see forgetAbsent.
 */
export function buildHotBase(m: Mirror, sc: PopScan, k: number, live: Uint8Array): ColDraft {
  const len = sc.maxSerial + 1;
  const vals = new Float64Array(Math.max(len, 0));
  const tg = new Uint8Array(Math.max(len, 0));
  vals.set(m.hv[k].subarray(0, Math.min(len, m.cap)));
  tg.set(m.ht[k].subarray(0, Math.min(len, m.cap)));
  const x = sc.hot[k];
  for (let j = 0; j < x.s.length; j++) {
    vals[x.s[j]] = x.v[j];
    tg[x.s[j]] = x.t[j];
  }
  let tags: Uint8Array | null = null;
  for (let s = 0; s < len; s++) {
    if (!live[s]) {
      vals[s] = 0;
      continue;
    }
    const t = tg[s];
    if (t !== 0) {
      tags ??= new Uint8Array(len);
      tags[s] = t === 3 ? 2 : t;
      vals[s] = 0;
    }
  }
  const nv = narrow(vals, len);
  const t = tags ? (tags.buffer as ArrayBuffer) : null;
  return { k: 'col', dt: nv.dt, v: nv.v, t, sum: sumBuffers(nv.v, t) };
}

/** Blob chunk [serial, len, words…]* of the indexed serials of chunk `c`, as the mirror will be once `sc` is applied (pure). */
export function buildBlobBase(m: Mirror, sc: PopScan, fam: BlobFam, c: number, live: Uint8Array): { d: ColDraft | null; rows: number } {
  const lo = c * SZ[fam];
  const hi = lo + SZ[fam];
  const map = m.blobs[fam];
  const nw = sc.blobNew[fam];
  let n = 0;
  let rows = 0;
  const pick = (s: number) => (nw.has(s) ? nw.get(s) ?? undefined : map[s]);
  for (let s = lo; s < hi; s++) {
    if (!live[s]) continue;
    const b = pick(s);
    if (!b) continue;
    rows++;
    n += 2 + b.length;
  }
  if (!rows) return { d: null, rows };
  const v = new Int32Array(n);
  let p = 0;
  for (let s = lo; s < hi; s++) {
    if (!live[s]) continue;
    const b = pick(s);
    if (!b) continue;
    v[p++] = s;
    v[p++] = b.length;
    for (let j = 0; j < b.length; j++) v[p++] = b[j];
  }
  return { d: { k: 'col', dt: 'i32', v: v.buffer as ArrayBuffer, t: null, sum: sumBuffers(v.buffer as ArrayBuffer, null) }, rows };
}

/**
 * After base parts were rebuilt from the indexed serials only: serials no longer indexed become
 * unknown in the mirror for those parts (hot columns rebuilt, blob chunks rebuilt).
 */
export function forgetAbsent(m: Mirror, live: Uint8Array, hotKeys: number[], blobChunks: { fam: BlobFam; c: number; rows: number }[]) {
  for (const k of hotKeys) {
    const ht = m.ht[k];
    for (let s = 0; s < m.cap; s++) if (!(s < live.length && live[s])) ht[s] = 3;
  }
  for (const { fam, c, rows } of blobChunks) {
    const map = m.blobs[fam];
    for (let s = c * SZ[fam]; s < Math.min((c + 1) * SZ[fam], map.length); s++) {
      if (s < live.length && live[s]) continue;
      map[s] = undefined;
      if (fam === 'h2h') m.h2hIds[s] = undefined;
    }
    m.baseRows.set(`pop/${fam}/${c}`, rows);
  }
}

/** Family chunk {ids, t} of the given members, built from the live objects (pure; see markFamBase in save.ts). */
export function buildFamBase(fam: JsonFam, members: { s: number; c: Obj }[], fbOf: (s: number) => number): { d: JsonDraft; ids: number[] } | null {
  if (!members.length) return null;
  const ids: number[] = [];
  const subs: Obj[] = [];
  for (const x of members) {
    ids.push(x.s);
    subs.push(subOf(x.c, fam, fbOf(x.s)));
  }
  return { d: { k: 'json', s: JSON.stringify({ ids, t: tjEncode(subs) }) }, ids };
}

/** Members (present std competitors) grouped by chunk name. */
export function membersByChunk(cs: Obj[], index: Int32Array, fam: JsonFam | BlobFam): Map<number, { s: number; c: Obj }[]> {
  const out = new Map<number, { s: number; c: Obj }[]>();
  const size = SZ[fam];
  for (let i = 0; i < index.length; i++) {
    const s = index[i];
    if (s < 0) continue;
    const c = Math.floor(s / size);
    let a = out.get(c);
    if (!a) out.set(c, (a = []));
    a.push({ s, c: cs[i] });
  }
  return out;
}

export function indexDraft(index: Int32Array): ColDraft {
  const v = index.slice().buffer as ArrayBuffer;
  return { k: 'col', dt: 'i32', v, t: null, sum: sumBuffers(v, null) };
}

// ---------------------------------------------------------------- verification of stored parts

export function verifyPart4(p: Part4 | undefined, expected: number): boolean {
  if (!p || typeof p !== 'object') return false;
  if (p.k === 'jr') return typeof p.h === 'string' && Array.isArray(p.b) && p.b.every((x) => x instanceof ArrayBuffer) && jrSum(p.h, p.b) === expected && p.sum === expected;
  if (p.k === 'json') return typeof p.s === 'string' && sumString(p.s) === expected && p.sum === expected;
  if (p.k === 'col') {
    if (!(p.v instanceof ArrayBuffer)) return false;
    const b = sumBuffers(p.v, p.t ?? null);
    const s = p.pad === undefined ? b : (Math.imul(b ^ (p.pad + 1), P) >>> 0);
    return s === expected && p.sum === expected;
  }
  return false;
}

export function decodePart4(name: string, p: Part4): unknown {
  if (p.k === 'jr') return decodeJournal(p);
  const v = decodePart(p as StoredPart);
  if (p.k === 'json' && (name.startsWith('pop/cold/') || name.startsWith('pop/warm/'))) return decodeFamChunk(v);
  if (p.k === 'json' && name.startsWith('wa/') && !name.endsWith('/index')) return tjDecode(v);
  return v;
}

/** {ids, t} → serial → sub-object. */
export function decodeFamChunk(v: unknown): Map<number, Obj> {
  const o = v as { ids: number[]; t: unknown };
  if (!o || !Array.isArray(o.ids)) throw new Error('bad family chunk');
  const rows = tjDecode(o.t) as Obj[];
  const m = new Map<number, Obj>();
  o.ids.forEach((s, i) => m.set(s, rows[i]));
  return m;
}

// ---------------------------------------------------------------- assemble (load)

export type PartInfo = { gen: number };

/**
 * Rebuild the competitor array from decoded v4 parts. `gens` maps logical part
 * names to the generation that wrote them; journals are applied in generation
 * order, each only to bases older than itself. `damaged` (base part names) and
 * `fill` work as in assembleSave: competitors whose data lived in a damaged part
 * are filled by the caller (from a backup) instead.
 */
export function assemblePopulation(
  parts: Map<string, unknown>,
  gens: Map<string, number>,
  damaged?: Set<string>,
  fill?: (id: string, what: string, c: Obj) => void,
): Obj[] | undefined {
  const it = assemblePopulationGen(parts, gens, damaged, fill);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

/** assemblePopulation as a generator (yields between slices of work, for a load that keeps the page responsive). */
export function* assemblePopulationGen(
  parts: Map<string, unknown>,
  gens: Map<string, number>,
  damaged?: Set<string>,
  fill?: (id: string, what: string, c: Obj) => void,
): Generator<void, Obj[] | undefined> {
  if (parts.has('pop/raw')) return parts.get('pop/raw') as Obj[];
  if (!parts.has('pop/index')) return undefined;
  const g = (name: string) => gens.get(name) ?? 0;
  const journals = [...parts.keys()].filter((n) => n.startsWith('jr/')).map((n) => ({ n, g: g(n), j: parts.get(n) as JrDecoded })).sort((a, b) => a.g - b.g);
  // Index
  const base = parts.get('pop/index') as DecodedCol;
  const idxGen = g('pop/index');
  const idxParts: ArrayLike<number>[] = [base.v];
  for (const j of journals) if (j.g > idxGen && j.j.idx) idxParts.push(j.j.idx);
  let n = 0;
  for (const a of idxParts) n += a.length;
  const index = new Int32Array(n);
  let at = 0;
  for (const a of idxParts) {
    index.set(a as Int32Array, at);
    at += a.length;
  }
  let maxSerial = -1;
  for (let i = 0; i < n; i++) if (index[i] > maxSerial) maxSerial = index[i];
  const oddList = (parts.get('pop/odd') as Obj[] | undefined) ?? [];
  let oi = 0;
  const cs: Obj[] = new Array(n);
  for (let i = 0; i < n; i++) cs[i] = index[i] < 0 ? { ...(oddList[oi++] ?? {}) } : {};
  const dmg = (name: string) => !!damaged?.has(name);

  // Cold, then rating history, warm, head-to-head, hot (key order close to the original objects).
  const famOf = (fam: JsonFam): ((s: number) => Obj | undefined) => {
    const chunks = new Map<number, Map<number, Obj>>();
    for (const [name, val] of parts) if (name.startsWith(`pop/${fam}/`)) chunks.set(Number(name.slice(fam.length + 5)), val as Map<number, Obj>);
    const latest = new Map<number, Obj>();
    for (const j of journals) {
      const up = j.j.fam[fam];
      if (!up) continue;
      for (const [s, sub] of up) if (j.g > g(chunkName(fam, s))) latest.set(s, sub);
    }
    return (s) => latest.get(s) ?? chunks.get(Math.floor(s / SZ[fam]))?.get(s);
  };
  const blobOf = (fam: BlobFam): Map<number, Int32Array> => {
    const map = new Map<number, Int32Array>();
    for (const [name, val] of parts) {
      if (!name.startsWith(`pop/${fam}/`)) continue;
      const v = (val as DecodedCol).v as Int32Array;
      let i = 0;
      while (i + 1 < v.length) {
        const s = v[i];
        const len = v[i + 1];
        map.set(s, v.subarray(i + 2, i + 2 + len) as Int32Array);
        i += 2 + len;
      }
    }
    for (const j of journals) {
      const ops = j.j.blob[fam];
      if (!ops) continue;
      walkOps(ops, (s, a) => {
        const cn = chunkName(fam, s);
        if (j.g <= g(cn) || dmg(cn)) return; // (a damaged chunk is filled by the caller instead)
        const nb = applyOp(ops, a, map.get(s));
        if (nb) map.set(s, nb);
        else map.delete(s);
      });
    }
    return map;
  };
  const cold = famOf('cold');
  yield;
  const rh = blobOf('rh');
  yield;
  const warm = famOf('warm');
  yield;
  const h2h = blobOf('h2h');
  yield;
  if (!damaged?.size) {
    // Fast path (no damage): every competitor is built once, from a template with the creation-order keys.
    const cap = maxSerial + 1;
    const hv: Float64Array[] = [];
    const ht: Uint8Array[] = [];
    for (let k = 0; k < NKEYS; k++) {
      const r = hotColumn(parts, journals, g, HOT_KEYS[k], cap);
      hv.push(r.vals);
      ht.push(r.tags);
      yield;
    }
    const build = (i0: number, i1: number) => {
      for (let i = i0; i < i1; i++) {
        const s = index[i];
        if (s < 0) continue;
        cs[i] = buildCompetitor(s, cold(s), rh.get(s), warm(s), h2h.get(s), hv, ht);
      }
    };
    for (let i0 = 0; i0 < n; i0 += 2048) {
      build(i0, Math.min(n, i0 + 2048));
      yield;
    }
    return cs;
  }
  const rows = (i0: number, i1: number) => {
    for (let i = i0; i < i1; i++) {
      const s = index[i];
      if (s < 0) continue;
      const c = cs[i];
      if (dmg(chunkName('cold', s))) fill?.(idOfSerial(s), 'cold', c);
      else {
        const sub = cold(s);
        if (sub) Object.assign(c, sub);
      }
      if (dmg(chunkName('rh', s))) fill?.(idOfSerial(s), 'rh', c);
      else {
        const b = rh.get(s);
        if (b) c.ratingHistory = decRH(b, 0, b.length);
      }
      if (dmg(chunkName('warm', s))) fill?.(idOfSerial(s), 'warm', c);
      else {
        const sub = warm(s);
        if (sub) Object.assign(c, sub);
      }
      if (dmg(chunkName('h2h', s))) fill?.(idOfSerial(s), 'h2h', c);
      else if (c.h2h === undefined) {
        const b = h2h.get(s);
        if (b) c.h2h = decH2H(b, 0, b.length);
      }
    }
  };
  for (let i0 = 0; i0 < n; i0 += 2048) {
    rows(i0, Math.min(n, i0 + 2048));
    yield;
  }
  // Hot columns: base dense by serial, then journal cells newer than the base.
  const cap = maxSerial + 1;
  const hotKey = (k: number) => {
    const key = HOT_KEYS[k];
    const name = 'pop/hot/' + key;
    if (dmg(name)) {
      if (fill) for (let i = 0; i < n; i++) if (index[i] >= 0) fill(idOfSerial(index[i]), 'hot:' + key, cs[i]);
      return;
    }
    const col = parts.get(name) as DecodedCol | undefined;
    const vals = new Float64Array(Math.max(cap, 0));
    const tags = new Uint8Array(Math.max(cap, 0)).fill(2);
    if (col) {
      const L = Math.min(col.v.length, cap);
      for (let s = 0; s < L; s++) {
        const t = col.t ? col.t[s] : 0;
        tags[s] = t;
        if (t === 0) vals[s] = col.v[s];
      }
    }
    const cg = g(name);
    for (const j of journals) {
      if (j.g <= cg) continue;
      for (const x of j.j.hot) {
        if (x.k !== key) continue;
        for (let r = 0; r < x.rows.length; r++) {
          const s = x.rows[r];
          if (s >= cap) continue;
          const t = x.t ? x.t[r] : 0;
          tags[s] = t;
          vals[s] = t === 0 ? x.v[r] : 0;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const s = index[i];
      if (s < 0) continue;
      const t = tags[s];
      if (t === 0) cs[i][key] = vals[s];
      else if (t === 1) cs[i][key] = null;
    }
  };
  for (let k = 0; k < NKEYS; k++) {
    hotKey(k);
    yield;
  }
  // Rebuild each competitor with its keys in creation order (known keys first, others after in the
  // order found): objects then share a handful of hidden classes, as freshly created ones do, which
  // keeps every later property access (simulation and the next commit's scan) fast.
  const reorder = (i0: number, i1: number) => {
    for (let i = i0; i < i1; i++) {
      if (index[i] < 0) continue;
      if (typeof cs[i].id !== 'string') cs[i].id = idOfSerial(index[i]);
      cs[i] = inCreationOrder(cs[i]);
    }
  };
  for (let i0 = 0; i0 < n; i0 += 4096) {
    reorder(i0, Math.min(n, i0 + 4096));
    yield;
  }
  return cs;
}

/** Dense hot column (values, tags; 2 = absent) by serial: base part, then newer journal cells. */
function hotColumn(parts: Map<string, unknown>, journals: { g: number; j: JrDecoded }[], g: (n: string) => number, key: string, cap: number) {
  const name = 'pop/hot/' + key;
  const col = parts.get(name) as DecodedCol | undefined;
  const vals = new Float64Array(Math.max(cap, 0));
  const tags = new Uint8Array(Math.max(cap, 0)).fill(2);
  if (col) {
    const L = Math.min(col.v.length, cap);
    for (let s = 0; s < L; s++) {
      const t = col.t ? col.t[s] : 0;
      tags[s] = t;
      if (t === 0) vals[s] = col.v[s];
    }
  }
  const cg = g(name);
  for (const j of journals) {
    if (j.g <= cg) continue;
    for (const x of j.j.hot) {
      if (x.k !== key) continue;
      for (let r = 0; r < x.rows.length; r++) {
        const s = x.rows[r];
        if (s >= cap) continue;
        const t = x.t ? x.t[r] : 0;
        tags[s] = t;
        vals[s] = t === 0 ? x.v[r] : 0;
      }
    }
  }
  return { vals, tags };
}

/**
 * One competitor from its family records, built on a clone of a template that holds the
 * creation-order keys (so the object keeps fast properties and the same hidden class as a
 * freshly created competitor). Keys the records do not have are left out again (generic path).
 */
function buildCompetitor(s: number, cold: Obj | undefined, rh: Int32Array | undefined, warm: Obj | undefined, h2h: Int32Array | undefined, hv: Float64Array[], ht: Uint8Array[]): Obj {
  const o: Obj = { ...TEMPLATE };
  let lo = 0;
  let hi = 0;
  let extra = false;
  const set = (k: string, v: unknown) => {
    const x = KEY_INDEX[k];
    o[k] = v;
    if (x === undefined) extra = true;
    else if (x < 32) lo |= 1 << x;
    else hi |= 1 << (x - 32);
  };
  if (cold) for (const k in cold) set(k, cold[k]);
  if (rh) set('ratingHistory', decRH(rh, 0, rh.length));
  if (warm) for (const k in warm) set(k, warm[k]);
  if (h2h && !(lo & (1 << H2H_IX))) set('h2h', decH2H(h2h, 0, h2h.length));
  for (let k = 0; k < NKEYS; k++) {
    const t = ht[k][s];
    if (t === 0) set(HOT_KEYS[k], hv[k][s]);
    else if (t === 1) set(HOT_KEYS[k], null);
  }
  if (!(lo & 1)) set('id', idOfSerial(s));
  if (lo === -1 && hi === ALL_HI) return o;
  // Some creation-order key is missing (an old or unusual record): copy the keys that are present.
  const r: Obj = {};
  for (let x = 0; x < KEY_ORDER.length; x++) if (x < 32 ? lo & (1 << x) : hi & (1 << (x - 32))) r[KEY_ORDER[x]] = o[KEY_ORDER[x]];
  if (extra) for (const k in o) if (KEY_INDEX[k] === undefined) r[k] = o[k];
  return r;
}

/** Key order of world/population.createCompetitor (plus the v0.2/v0.3 optional keys). */
const KEY_ORDER = [
  'id', 'name', 'female', 'origin', 'portraitSeed', 'birthDay', 'debutDay', 'skill', 'potential', 'peakAge', 'rating', 'peak', 'games', 'w', 'd', 'l',
  'rank', 'peakRank', 'style', 'openingStyles', 'strengths', 'weaknesses', 'form', 'streak', 'tournamentsWon', 'championships', 'titles', 'honours',
  'ratingHistory', 'h2h', 'retiredDay', 'region', 'tp', 'last',
];
const KEY_SET = new Set(KEY_ORDER);
const KEY_INDEX: Record<string, number> = Object.create(null);
KEY_ORDER.forEach((k, i) => (KEY_INDEX[k] = i));
const H2H_IX = KEY_INDEX.h2h;
const ALL_HI = (1 << (KEY_ORDER.length - 32)) - 1;
const TEMPLATE = JSON.parse(JSON.stringify(Object.fromEntries(KEY_ORDER.map((k) => [k, 0])))) as Obj;
if (KEY_ORDER.length <= 32 || KEY_ORDER.length > 64 || H2H_IX >= 32) throw new Error('KEY_ORDER layout changed');
function inCreationOrder(t: Obj): Obj {
  let all = true;
  for (let k = 0; k < KEY_ORDER.length; k++) if (!(KEY_ORDER[k] in t)) {
    all = false;
    break;
  }
  // An object literal (named stores) keeps fast properties; adding 30+ properties with keyed stores
  // would put every competitor in dictionary mode (V8), making all later accesses several times slower.
  const o: Obj = all ? { id: t.id, name: t.name, female: t.female, origin: t.origin, portraitSeed: t.portraitSeed, birthDay: t.birthDay, debutDay: t.debutDay, skill: t.skill, potential: t.potential, peakAge: t.peakAge, rating: t.rating, peak: t.peak, games: t.games, w: t.w, d: t.d, l: t.l, rank: t.rank, peakRank: t.peakRank, style: t.style, openingStyles: t.openingStyles, strengths: t.strengths, weaknesses: t.weaknesses, form: t.form, streak: t.streak, tournamentsWon: t.tournamentsWon, championships: t.championships, titles: t.titles, honours: t.honours, ratingHistory: t.ratingHistory, h2h: t.h2h, retiredDay: t.retiredDay, region: t.region, tp: t.tp, last: t.last } : {};
  if (!all) for (let k = 0; k < KEY_ORDER.length; k++) {
    const key = KEY_ORDER[k];
    if (key in t) o[key] = t[key];
  }
  for (const key in t) if (!KEY_SET.has(key)) o[key] = t[key];
  return o;
}

/**
 * Initialise a mirror from a freshly loaded population (what was just read is
 * what is persisted), including the content hashes the rolling verification
 * compares against. Sliced (a generator).
 */
export function* mirrorFromLoaded(cs: Obj[], baseRows: Map<string, number>): Generator<void, Mirror> {
  const m = new Mirror();
  const it = scanPopulation(cs, m, { fresh: true, hashes: 'warm' });
  let r = it.next();
  while (!r.done) {
    yield;
    r = it.next();
  }
  const sc = r.value;
  if (sc.raw !== null) return m;
  applyScan(m, sc);
  for (const [k, v] of baseRows) m.baseRows.set(k, v);
  return m;
}

/**
 * Cold verification baselines after a load, computed in slices in the background
 * (cold fields are fixed after creation, apart from styles which the signature
 * covers). Members without a baseline are skipped by the verification until then.
 */
export function* fillColdHashes(cs: Obj[], m: Mirror): Generator<void, void> {
  const one = (i0: number, i1: number) => {
    for (let i = i0; i < i1; i++) {
      const c = cs[i];
      const s = serialOfId(c?.id);
      if (s < 0 || s >= m.cap || m.hash.cold[s] !== 0 || !m.has.cold[s]) continue;
      m.hash.cold[s] = sumString(JSON.stringify(subOf(c, 'cold', m.fb[s])));
    }
  };
  for (let i0 = 0; i0 < cs.length; i0 += 512) {
    one(i0, Math.min(cs.length, i0 + 512));
    yield;
  }
}

/** Rows of a decoded base chunk (for stale bookkeeping after a load). */
export function rowsOfBase(val: unknown): number {
  if (val instanceof Map) return val.size;
  const v = (val as DecodedCol | undefined)?.v;
  if (!v) return 0;
  let i = 0;
  let rows = 0;
  while (i + 1 < v.length) {
    rows++;
    i += 2 + v[i + 1];
  }
  return rows;
}

/** Present (indexed) serials per chunk of a family. */
export function presentCounts(index: Int32Array, fam: JsonFam | BlobFam): Map<number, number> {
  const out = new Map<number, number>();
  const size = SZ[fam];
  for (let i = 0; i < index.length; i++) {
    const s = index[i];
    if (s < 0) continue;
    const c = Math.floor(s / size);
    out.set(c, (out.get(c) ?? 0) + 1);
  }
  return out;
}

export const FAMILY_SIZES = SZ;
export { JSON_FAMS, BLOB_FAMS };
