import { hashString } from '../core/rng';

/**
 * Split layout (save format 2).
 *
 * A Save is cut into "parts" (logical records). Most parts are a JSON string;
 * the daily-changing numeric competitor fields are stored column-wise as typed
 * arrays. The functions here are pure: `splitSave` turns a Save into part
 * drafts, `assembleSave` puts decoded parts back together. Nothing here knows
 * about IndexedDB. Unknown fields (added by future game code) are carried
 * generically: unknown top-level Save keys go to `meta`, unknown world keys to
 * `world`, unknown competitor keys to the competitor `cold` family.
 *
 * Logical part names:
 *   meta                 top-level Save keys not listed below (schema, ids, timestamps, settings, ...)
 *   player               { player, library, libraryMeta, coach }
 *   active               Save.active (in-progress game; written on every move)
 *   world                WorldState minus competitors / tournaments / array-valued keys
 *   pop/index            competitor ids in array order
 *   pop/hot/<key>        one typed-array column per hot numeric competitor field
 *   pop/<family>/<chunk> competitor sub-objects for a family, chunked by id serial
 *   tour/index, tour/<id>  live tournament states, one record per tournament
 *   wa/<key>/index, wa/<key>/<n>  every other array in WorldState (history, chronicle,
 *                        awards, reigns, ...), 128 entries per chunk: appends touch one chunk
 *   pop/raw, tour/raw    fallbacks if ids are not unique (never expected)
 */

export const HOT_KEYS = [
  'skill', 'rating', 'peak', 'games', 'w', 'd', 'l', 'form', 'streak', 'rank', 'peakRank',
  'potential', 'tournamentsWon', 'championships', 'retiredDay',
] as const;

export type Family = { name: string; keys: string[]; size: number };
/**
 * Competitor families (besides the hot columns). `cold` holds fields that game
 * logic never changes after a competitor is created; its chunks are rewritten
 * only when their membership changes (debut / pruning) or on a verification
 * pass. `rh` (rating history) changes once per season. Every other field —
 * including any field added later — goes to `warm`, which is fully diffed on
 * every full commit.
 */
export const COLD: Family = {
  name: 'cold', size: 250,
  keys: ['id', 'name', 'female', 'origin', 'portraitSeed', 'birthDay', 'debutDay', 'peakAge', 'style', 'openingStyles', 'strengths', 'weaknesses'],
};
export const RH: Family = { name: 'rh', keys: ['ratingHistory'], size: 250 };
export const WARM: Family = { name: 'warm', keys: [], size: 25 };
export const FAMILIES: Family[] = [COLD, RH, WARM];
export const ARRAY_CHUNK = 128;
/** Chunk sizes in effect; recorded in every manifest so a later layout change can still read old saves. */
export function layoutSizes(): Record<string, number> {
  return Object.fromEntries(FAMILIES.map((f) => [f.name, f.size]));
}
const PLAYER_KEYS = ['player', 'library', 'libraryMeta', 'coach'];

export type JsonDraft = { k: 'json'; s: string };
export type ColDraft = { k: 'col'; dt: 'f64' | 'i32'; v: ArrayBuffer; t: ArrayBuffer | null; sum: number; pad?: number };
export type Draft = JsonDraft | ColDraft;
/** Value stored in IndexedDB for one part. */
export type StoredPart = (JsonDraft | ColDraft) & { sum: number };

type Obj = Record<string, unknown>;

// ---------------------------------------------------------------- checksums

export function sumString(s: string): number {
  return hashString(s);
}

/** FNV-1a over 32-bit words (plus tail bytes) of one or more buffers. */
export function sumBuffers(...bufs: (ArrayBuffer | null)[]): number {
  let h = 0x811c9dc5;
  for (const b of bufs) {
    if (!b) {
      h = Math.imul(h ^ 0xff, 0x01000193);
      continue;
    }
    const words = b.byteLength >>> 2;
    const u32 = new Uint32Array(b, 0, words);
    for (let i = 0; i < words; i++) h = Math.imul(h ^ u32[i], 0x01000193);
    const u8 = new Uint8Array(b, words * 4);
    for (let i = 0; i < u8.length; i++) h = Math.imul(h ^ u8[i], 0x01000193);
    h = Math.imul(h ^ b.byteLength, 0x01000193);
  }
  return h >>> 0;
}

function colSum(p: ColDraft): number {
  const b = sumBuffers(p.v, p.t ?? null);
  return p.pad === undefined ? b : mixNum(b, p.pad + 1) >>> 0;
}

export function sumOf(p: Draft): number {
  return p.k === 'json' ? sumString(p.s) : p.sum;
}

export function sizeOf(p: Draft): number {
  return p.k === 'json' ? p.s.length * 2 : p.v.byteLength + (p.t?.byteLength ?? 0);
}

// ---------------------------------------------------------------- helpers

export function chunkOf(id: string, size: number): string {
  const m = /^c(\d+)$/.exec(id);
  if (m) return String(Math.floor(Number(m[1]) / size));
  return 'x' + (hashString(id) % 8);
}

function json(v: unknown): JsonDraft {
  return { k: 'json', s: JSON.stringify(v === undefined ? null : v) };
}

function uniqueIds(items: unknown[]): string[] | null {
  const ids: string[] = new Array(items.length);
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const it = items[i] as Obj | null;
    const id = it && typeof it === 'object' ? it.id : undefined;
    if (typeof id !== 'string' || seen.has(id)) return null;
    seen.add(id);
    ids[i] = id;
  }
  return ids;
}


// ---------------------------------------------------------------- split

export type SplitOpts = {
  /** Only produce meta + active (the caller knows nothing else changed). */
  light?: boolean;
  /** Signatures of cold/rh chunks from the previous split; unchanged chunks are skipped. */
  prevSigs?: Map<string, number> | null;
  /** Produce every chunk regardless of signatures (verification pass). */
  verifyAll?: boolean;
  /** Produce these chunks regardless of signatures (rolling verification). */
  verifyChunk?: (name: string) => boolean;
  /** Only compute the cold/rh chunk signatures (after a load). */
  sigsOnly?: boolean;
};

export type SplitResult = {
  parts: Map<string, Draft>;
  /** cold/rh chunk signatures for the next split. */
  sigs: Map<string, number>;
  /** Chunk names that exist but were not produced because their signature is unchanged. */
  skipped: Set<string>;
};

export function splitSave(save: object, opts: SplitOpts = {}): SplitResult {
  const out = new Map<string, Draft>();
  const res: SplitResult = { parts: out, sigs: new Map(), skipped: new Set() };
  const s = save as Obj;
  if (opts.sigsOnly) {
    const cs = (s.world as Obj | undefined)?.competitors;
    if (Array.isArray(cs)) splitCompetitors(cs as Obj[], res, opts);
    return res;
  }
  const meta: Obj = {};
  const player: Obj = {};
  for (const k of Object.keys(s)) {
    if (k === 'active' || k === 'world') continue;
    if (PLAYER_KEYS.includes(k)) player[k] = s[k];
    else meta[k] = s[k];
  }
  out.set('meta', json(meta));
  out.set('active', json(s.active ?? null));
  if (opts.light) return res;
  out.set('player', json(player));
  if (s.world && typeof s.world === 'object') splitWorld(s.world as Obj, res, opts);
  return res;
}

function splitWorld(w: Obj, res: SplitResult, opts: SplitOpts) {
  const out = res.parts;
  const core: Obj = {};
  for (const k of Object.keys(w)) {
    if (Array.isArray(w[k])) continue;
    core[k] = w[k];
  }
  out.set('world', json(core));
  if (Array.isArray(w.competitors)) splitCompetitors(w.competitors as Obj[], res, opts);
  if (Array.isArray(w.tournaments)) {
    const ts = w.tournaments as Obj[];
    const ids = uniqueIds(ts);
    if (!ids) out.set('tour/raw', json(ts));
    else {
      out.set('tour/index', json(ids));
      for (let i = 0; i < ts.length; i++) out.set('tour/' + ids[i], json(ts[i]));
    }
  }
  for (const k of Object.keys(w)) {
    if (k === 'competitors' || k === 'tournaments' || !Array.isArray(w[k])) continue;
    const a = w[k] as unknown[];
    const base = 'wa/' + encodeURIComponent(k) + '/';
    out.set(base + 'index', json({ n: a.length, size: ARRAY_CHUNK }));
    for (let i = 0; i * ARRAY_CHUNK < a.length; i++) out.set(base + i, json(a.slice(i * ARRAY_CHUNK, (i + 1) * ARRAY_CHUNK)));
  }
}

const SERIAL = /^c(\d+)$/;
const P = 0x01000193;
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

/** id -> [cold, rh, warm] chunk names (sizes are constants of this build). */
const chunkNames = new Map<string, [string, string, string]>();

function splitCompetitors(cs: Obj[], res: SplitResult, opts: SplitOpts) {
  const out = res.parts;
  const ids = uniqueIds(cs);
  if (!ids) {
    out.set('pop/raw', json(cs));
    return;
  }
  const n = cs.length;
  out.set('pop/index', encodeIds(ids));
  // Hot columns. tag 0 = number, 1 = null, 2 = not stored here (absent or another type -> warm).
  const hotTags: (Uint8Array | null)[] = [];
  for (const key of HOT_KEYS) {
    const vals = new Float64Array(n);
    let tags: Uint8Array | null = null;
    let int = true;
    for (let i = 0; i < n; i++) {
      const v = cs[i][key];
      if (typeof v === 'number' && v === v) {
        vals[i] = v;
        if (int && ((v | 0) !== v || Object.is(v, -0))) int = false;
      } else {
        tags ??= new Uint8Array(n);
        tags[i] = v === null || (typeof v === 'number' && v !== v) ? 1 : 2;
      }
    }
    hotTags.push(tags);
    const v = (int ? Int32Array.from(vals).buffer : vals.buffer) as ArrayBuffer;
    const t = tags ? (tags.buffer as ArrayBuffer) : null;
    out.set('pop/hot/' + key, { k: 'col', dt: int ? 'i32' : 'f64', v, t, sum: sumBuffers(v, t) });
  }
  // Chunk names per competitor and cold/rh signatures.
  const coldName: string[] = new Array(n);
  const rhName: string[] = new Array(n);
  const warmName: string[] = new Array(n);
  const sigs = res.sigs;
  for (let i = 0; i < n; i++) {
    const id = ids[i];
    let names = chunkNames.get(id);
    if (!names) {
      names = ['pop/cold/' + chunkOf(id, COLD.size), 'pop/rh/' + chunkOf(id, RH.size), 'pop/warm/' + chunkOf(id, WARM.size)];
      if (chunkNames.size > 50_000) chunkNames.clear();
      chunkNames.set(id, names);
    }
    const cn = (coldName[i] = names[0]);
    const rn = (rhName[i] = names[1]);
    warmName[i] = names[2];
    sigs.set(cn, mixStr(sigs.get(cn) ?? 0x811c9dc5, id));
    const rh = cs[i].ratingHistory;
    let hr = mixStr(sigs.get(rn) ?? 0x811c9dc5, id);
    if (Array.isArray(rh)) {
      hr = mixNum(hr, rh.length);
      const last = rh[rh.length - 1];
      if (Array.isArray(last)) for (const x of last) hr = mixNum(hr, x as number);
      else if (last !== undefined) hr = mixStr(hr, JSON.stringify(last));
      const first = rh[0];
      if (Array.isArray(first)) for (const x of first) hr = mixNum(hr, x as number);
    } else hr = mixStr(hr, JSON.stringify(rh ?? null));
    sigs.set(rn, hr);
  }
  if (opts.sigsOnly) return;
  const want = (name: string) => {
    if (opts.verifyAll || !opts.prevSigs) return true;
    const ok = opts.prevSigs.get(name) !== sigs.get(name) || !!opts.verifyChunk?.(name);
    if (!ok) res.skipped.add(name);
    return ok;
  };
  const wantCold = new Map<string, boolean>();
  const wantRh = new Map<string, boolean>();
  for (const name of sigs.keys()) (name.startsWith('pop/cold/') ? wantCold : wantRh).set(name, want(name));
  // Family pass.
  const chunks = new Map<string, Obj>(); // logical name -> { id: subobject }
  const put = (name: string, id: string, o: Obj) => {
    let ch = chunks.get(name);
    if (!ch) chunks.set(name, (ch = {}));
    ch[id] = o;
  };
  for (let i = 0; i < n; i++) {
    const c = cs[i];
    const id = ids[i];
    const doCold = wantCold.get(coldName[i])!;
    const doRh = wantRh.get(rhName[i])!;
    let cold: Obj | null = null;
    let warm: Obj | null = null;
    let rh: Obj | null = null;
    for (const k in c) {
      const v = c[k];
      if (v === undefined) continue;
      const r = ROUTE[k];
      if (r === 3) {
        const t = hotTags[HOT_INDEX[k]];
        if (!t || t[i] !== 2) continue; // stored in the column
        (warm ??= {})[k] = v;
      } else if (r === 1) {
        if (doCold) (cold ??= {})[k] = v;
      } else if (r === 2) {
        if (doRh) (rh ??= {})[k] = v;
      } else (warm ??= {})[k] = v;
    }
    if (cold) put(coldName[i], id, cold);
    else if (doCold) put(coldName[i], id, {});
    if (rh) put(rhName[i], id, rh);
    else if (doRh) put(rhName[i], id, {});
    if (warm) put(warmName[i], id, warm);
  }
  for (const [name, ch] of chunks) out.set(name, { k: 'json', s: JSON.stringify(ch) });
}

const ROUTE: Record<string, number> = Object.create(null);
for (const k of COLD.keys) ROUTE[k] = 1;
for (const k of RH.keys) ROUTE[k] = 2;
const HOT_INDEX: Record<string, number> = Object.create(null);
HOT_KEYS.forEach((k, i) => {
  ROUTE[k] = 3;
  HOT_INDEX[k] = i;
});

/** Competitor ids: a compact Int32 column when they all look like "c000123", else JSON. */
function encodeIds(ids: string[]): Draft {
  const width = ids.length ? ids[0].length : 0;
  const serials = new Int32Array(ids.length);
  for (let i = 0; i < ids.length; i++) {
    const m = SERIAL.exec(ids[i]);
    if (!m || ids[i].length !== width || m[1].length > 9) return json(ids);
    serials[i] = Number(m[1]);
  }
  const d: ColDraft = { k: 'col', dt: 'i32', v: serials.buffer, t: null, pad: width - 1, sum: 0 };
  d.sum = colSum(d);
  return d;
}

function decodeIds(p: unknown): string[] {
  if (Array.isArray(p)) return p as string[];
  const col = p as DecodedCol;
  const out: string[] = new Array(col.v.length);
  for (let i = 0; i < col.v.length; i++) out[i] = 'c' + String(col.v[i]).padStart(col.pad ?? 0, '0');
  return out;
}

// ---------------------------------------------------------------- decode / assemble

export type Decoded = Map<string, unknown>; // logical -> parsed JSON value, or Float64Array-like column

export type DecodedCol = { dt: 'f64' | 'i32'; v: ArrayLike<number>; t: Uint8Array | null; pad?: number };

export function decodePart(p: StoredPart): unknown {
  if (p.k === 'json') return JSON.parse(p.s);
  return { dt: p.dt, v: p.dt === 'i32' ? new Int32Array(p.v) : new Float64Array(p.v), t: p.t ? new Uint8Array(p.t) : null, pad: p.pad } satisfies DecodedCol;
}

export function verifyPart(p: StoredPart | undefined, expected: number): boolean {
  if (!p || typeof p !== 'object') return false;
  if (p.k === 'json') return typeof p.s === 'string' && sumString(p.s) === expected && p.sum === expected;
  if (p.k === 'col') return p.v instanceof ArrayBuffer && colSum(p) === expected && p.sum === expected;
  return false;
}

/**
 * Rebuild a raw Save object from decoded parts. For recovery, `damaged` names
 * population parts that could not be read; `fill` is then called for every
 * competitor whose data lived in such a part (family name, or 'hot:<key>').
 */
export function assembleSave(
  parts: Decoded,
  sizes: Record<string, number> = layoutSizes(),
  damaged?: Set<string>,
  fill?: (id: string, what: string, c: Obj) => void,
): Obj {
  const meta = (parts.get('meta') ?? {}) as Obj;
  const s: Obj = { ...meta };
  Object.assign(s, (parts.get('player') ?? {}) as Obj);
  s.active = parts.has('active') ? parts.get('active') : null;
  const world: Obj = { ...((parts.get('world') ?? {}) as Obj) };
  // Competitors
  if (parts.has('pop/raw')) world.competitors = parts.get('pop/raw');
  else if (parts.has('pop/index')) {
    const ids = decodeIds(parts.get('pop/index'));
    const cs: Obj[] = ids.map(() => ({}));
    const famChunks = new Map<string, Map<string, Obj>>(); // family -> chunk -> map
    for (const [name, val] of parts) {
      if (!name.startsWith('pop/') || name.startsWith('pop/hot/') || name === 'pop/index') continue;
      const [, fam, chunk] = name.split('/');
      let m = famChunks.get(fam);
      if (!m) famChunks.set(fam, (m = new Map()));
      m.set(chunk, val as Obj);
    }
    // cold first (carries id, name, ... and keeps a natural key order), then rh, warm, hot.
    for (const fam of FAMILIES) {
      const m = famChunks.get(fam.name);
      const size = sizes[fam.name] ?? fam.size;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const chunk = chunkOf(id, size);
        const sub = m?.get(chunk)?.[id] as Obj | undefined;
        if (sub) Object.assign(cs[i], sub);
        else if (fill && damaged?.has(`pop/${fam.name}/${chunk}`)) fill(id, fam.name, cs[i]);
      }
    }
    for (const key of HOT_KEYS) {
      const col = parts.get('pop/hot/' + key) as DecodedCol | undefined;
      if (!col) {
        if (fill && damaged?.has('pop/hot/' + key)) for (let i = 0; i < ids.length; i++) fill(ids[i], 'hot:' + key, cs[i]);
        continue;
      }
      for (let i = 0; i < ids.length; i++) {
        const t = col.t ? col.t[i] : 0;
        if (t === 0) cs[i][key] = col.v[i];
        else if (t === 1) cs[i][key] = null;
      }
    }
    if (!cs.every((c) => typeof c.id === 'string')) for (let i = 0; i < ids.length; i++) cs[i].id ??= ids[i];
    world.competitors = cs;
  }
  // Tournaments
  if (parts.has('tour/raw')) world.tournaments = parts.get('tour/raw');
  else if (parts.has('tour/index')) {
    const ids = parts.get('tour/index') as string[];
    world.tournaments = ids.filter((id) => parts.has('tour/' + id)).map((id) => parts.get('tour/' + id));
  }
  // Other world arrays
  for (const [name, val] of parts) {
    if (!name.startsWith('wa/') || !name.endsWith('/index')) continue;
    const base = name.slice(0, -'index'.length);
    const { n, size } = val as { n: number; size: number };
    const a: unknown[] = [];
    for (let i = 0; i * size < n; i++) {
      const ch = parts.get(base + i) as unknown[] | undefined;
      if (ch) for (const x of ch) a.push(x);
    }
    world[decodeURIComponent(base.slice(3, -1))] = a;
  }
  if (parts.has('world') || parts.has('pop/index') || parts.has('pop/raw')) s.world = world;
  return s;
}

/** Deterministic, key-order-independent JSON (used to verify migrations). */
export function canonicalJson(v: unknown): string {
  return JSON.stringify(v, function (this: unknown, _k, val) {
    if (val && typeof val === 'object' && !Array.isArray(val) && !ArrayBuffer.isView(val)) {
      const o: Obj = {};
      for (const k of Object.keys(val as Obj).sort()) o[k] = (val as Obj)[k];
      return o;
    }
    return val;
  });
}
