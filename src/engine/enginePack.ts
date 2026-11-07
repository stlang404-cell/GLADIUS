/**
 * Engine pack: the optional full-strength (big-net) Stockfish 19 builds.
 *
 * Distribution (docs/ENGINE.md, "v0.3 → Distribution"): the two ~99 MB .wasm
 * files are committed as `engine/pack/` — gzip chunks of ≤ 20 MiB for
 * stockfish-19-single.wasm, a 259 KB binary delta (GSD1) that turns it into the
 * threaded stockfish-19.wasm, and `engine-pack.json` with the SHA-256 of every
 * chunk and of each final file (written by scripts/engine-pack.mjs).
 *
 * Sources, in order:
 *   1. "pack"    — installed in this browser: Cache Storage `gladius-engine-pack-v1`,
 *                  verified with SHA-256 at install; survives reloads, works offline.
 *   2. "bundled" — the host serves the full .wasm itself (Windows package, or a
 *                  build with GLADIUS_BUNDLE_FULL_ENGINE=1); used directly.
 *   3. absent    — only the precached lite build runs.
 * Install = download chunks (progress, per-chunk SHA-256, 2 retries) →
 * DecompressionStream('gzip') → SHA-256 of the result → Cache Storage; then the
 * delta is applied for the threaded build and verified the same way. Workers
 * load an installed build from a blob: URL passed in the glue's `#wasm` hash
 * parameter, so no service worker is needed to use it offline.
 *
 * All functions take their browser dependencies as parameters (fetch, Cache)
 * so tests/engine.pack.test.ts runs them in Node against the committed pack.
 */

export type PackChunk = { file: string; bytes: number; sha256: string };
export type PackFile = { build: string; bytes: number; sha256: string; encoding?: 'gzip'; delta?: { base: string; format: 'GSD1' }; chunks: PackChunk[] };
export type PackManifest = { format: number; engine: string; source: string; license: string; files: Record<string, PackFile> };

export const PACK_CACHE = 'gladius-engine-pack-v1';
export const PACK_DIR = 'engine/pack/';
export const PACK_MANIFEST = 'engine-pack.json';

export type PackProgress = { phase: 'manifest' | 'download' | 'decompress' | 'verify' | 'store'; file?: string; loaded: number; total: number };

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type CacheLike = { match(url: string): Promise<Response | undefined>; put(url: string, r: Response): Promise<void>; delete?(url: string): Promise<boolean> };

export async function sha256Hex(data: BufferSource): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Apply a GSD1 delta (format in scripts/engine-pack.mjs). */
export function applyDelta(base: Uint8Array, delta: Uint8Array): Uint8Array {
  const dv = new DataView(delta.buffer, delta.byteOffset, delta.byteLength);
  if (String.fromCharCode(delta[0], delta[1], delta[2], delta[3]) !== 'GSD1') throw new Error('not a GSD1 delta');
  const tlen = dv.getUint32(4, true);
  const blen = dv.getUint32(8, true);
  if (blen !== base.length) throw new Error(`delta base length ${blen} ≠ ${base.length}`);
  const out = new Uint8Array(tlen);
  let o = 0;
  let p = 12;
  while (p < delta.length) {
    const op = delta[p++];
    if (op === 0) {
      const n = dv.getUint32(p, true);
      p += 4;
      out.set(delta.subarray(p, p + n), o);
      p += n;
      o += n;
    } else if (op === 1) {
      const off = dv.getUint32(p, true);
      const n = dv.getUint32(p + 4, true);
      p += 8;
      out.set(base.subarray(off, off + n), o);
      o += n;
    } else throw new Error('bad delta op ' + op);
  }
  if (o !== tlen) throw new Error(`delta produced ${o} bytes, expected ${tlen}`);
  return out;
}

async function fetchBytes(f: FetchLike, url: string, onBytes: (n: number) => void, signal?: AbortSignal): Promise<Uint8Array> {
  const res = await f(url, { signal, cache: 'no-cache' });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || type.includes('text/html')) throw new Error(`${url}: HTTP ${res.status}${type.includes('html') ? ' (HTML — not deployed?)' : ''}`);
  if (!res.body) {
    const b = new Uint8Array(await res.arrayBuffer());
    onBytes(b.length);
    return b;
  }
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    n += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Gunzip a sequence of byte arrays with the platform DecompressionStream into a buffer of `size` bytes. */
async function gunzipInto(parts: AsyncIterable<Uint8Array>, size: number): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const out = new Uint8Array(size);
  let o = 0;
  const reading = (async () => {
    const r = ds.readable.getReader();
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      if (o + value.length > size) throw new Error('decompressed data larger than expected');
      out.set(value, o);
      o += value.length;
    }
  })();
  const w = ds.writable.getWriter();
  try {
    for await (const p of parts) await w.write(p as Uint8Array<ArrayBuffer>);
    await w.close();
  } catch (e) {
    await w.abort(e).catch(() => undefined);
    await reading.catch(() => undefined);
    throw e;
  }
  await reading;
  if (o !== size) throw new Error(`decompressed ${o} bytes, expected ${size}`);
  return out;
}

export type InstallOptions = {
  /** Absolute URL of the app's base (document.baseURI). */
  baseUrl: string;
  /** Files to install (default: every file in the manifest). */
  names?: string[];
  fetch?: FetchLike;
  cache: CacheLike;
  onProgress?: (p: PackProgress) => void;
  signal?: AbortSignal;
};

export function packUrl(baseUrl: string, file: string) {
  return new URL(PACK_DIR + file, baseUrl).href;
}
/** The canonical URL an installed file is stored under (= where a bundled host serves it). */
export function wasmUrl(baseUrl: string, name: string) {
  return new URL('engine/' + name, baseUrl).href;
}

export async function fetchManifest(baseUrl: string, f: FetchLike = fetch, signal?: AbortSignal): Promise<PackManifest> {
  const res = await f(packUrl(baseUrl, PACK_MANIFEST), { signal, cache: 'no-cache' });
  if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) throw new Error(`engine pack not deployed on this host (HTTP ${res.status})`);
  const m = (await res.json()) as PackManifest;
  if (m.format !== 1 || !m.files) throw new Error('unknown engine pack format');
  return m;
}

/**
 * Download, decode, verify (SHA-256) and store the engine pack. Resolves with the
 * names installed. Throws (and stores nothing for the failing file) on any
 * mismatch, network error or abort.
 */
export async function installPack(o: InstallOptions): Promise<string[]> {
  const f = o.fetch ?? fetch;
  const progress = o.onProgress ?? (() => undefined);
  progress({ phase: 'manifest', loaded: 0, total: 0 });
  const m = await fetchManifest(o.baseUrl, f, o.signal);
  const names = o.names ?? Object.keys(m.files);
  // Bases first (the delta file needs its base in memory).
  const order = [...names].sort((a, b) => (m.files[a].delta ? 1 : 0) - (m.files[b].delta ? 1 : 0));
  const total = order.reduce((s, n) => s + m.files[n].chunks.reduce((a, c) => a + c.bytes, 0), 0);
  let loaded = 0;
  const decoded = new Map<string, Uint8Array>();
  const done: string[] = [];
  for (const name of order) {
    const file = m.files[name];
    if (!file) throw new Error(`${name} is not in the engine pack`);
    const chunks = async function* () {
      for (const c of file.chunks) {
        let bytes: Uint8Array | null = null;
        for (let attempt = 0; ; attempt++) {
          const before = loaded;
          try {
            bytes = await fetchBytes(f, packUrl(o.baseUrl, c.file), (n) => {
              loaded += n;
              progress({ phase: 'download', file: name, loaded, total });
            }, o.signal);
            if (bytes.length !== c.bytes || (await sha256Hex(bytes as Uint8Array<ArrayBuffer>)) !== c.sha256) throw new Error(`${c.file}: checksum mismatch`);
            break;
          } catch (e) {
            loaded = before;
            if (o.signal?.aborted || attempt >= 2) throw e;
          }
        }
        yield bytes!;
      }
    };
    let data: Uint8Array;
    if (file.delta) {
      let base = decoded.get(file.delta.base);
      if (!base) {
        const r = await o.cache.match(wasmUrl(o.baseUrl, file.delta.base));
        if (!r) throw new Error(`${name} needs ${file.delta.base} first`);
        base = new Uint8Array(await r.arrayBuffer());
      }
      const parts: Uint8Array[] = [];
      for await (const p of chunks()) parts.push(p);
      const raw = file.encoding === 'gzip' ? await gunzipAll(parts) : concat(parts);
      progress({ phase: 'decompress', file: name, loaded, total });
      data = applyDelta(base, raw);
    } else {
      progress({ phase: 'download', file: name, loaded, total });
      data = file.encoding === 'gzip' ? await gunzipInto(chunks(), file.bytes) : concat(await collect(chunks()));
    }
    progress({ phase: 'verify', file: name, loaded, total });
    if (data.length !== file.bytes || (await sha256Hex(data as Uint8Array<ArrayBuffer>)) !== file.sha256) throw new Error(`${name}: SHA-256 mismatch after reassembly`);
    progress({ phase: 'store', file: name, loaded, total });
    await o.cache.put(
      wasmUrl(o.baseUrl, name),
      new Response(new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/wasm' }), {
        headers: { 'content-type': 'application/wasm', 'content-length': String(data.length), 'x-gladius-sha256': file.sha256 },
      }),
    );
    decoded.set(name, data);
    done.push(name);
  }
  await o.cache.put(packUrl(o.baseUrl, PACK_MANIFEST), new Response(JSON.stringify(m), { headers: { 'content-type': 'application/json' } }));
  return done;
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
async function gunzipAll(parts: Uint8Array[]): Promise<Uint8Array> {
  const blob = new Blob(parts as Uint8Array<ArrayBuffer>[]);
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Installed files whose stored size matches the (cached) manifest. Cheap: no hashing. */
export async function installedFiles(baseUrl: string, cache: CacheLike): Promise<{ manifest: PackManifest | null; files: string[] }> {
  const mr = await cache.match(packUrl(baseUrl, PACK_MANIFEST));
  if (!mr) return { manifest: null, files: [] };
  const m = (await mr.json()) as PackManifest;
  const files: string[] = [];
  for (const [name, f] of Object.entries(m.files)) {
    const r = await cache.match(wasmUrl(baseUrl, name));
    if (r && Number(r.headers.get('content-length')) === f.bytes && r.headers.get('x-gladius-sha256') === f.sha256) files.push(name);
  }
  return { manifest: m, files };
}

/** Re-hash every installed file against the manifest (the "Verify" button). */
export async function verifyInstalled(baseUrl: string, cache: CacheLike): Promise<{ ok: string[]; bad: string[] }> {
  const { manifest, files } = await installedFiles(baseUrl, cache);
  const ok: string[] = [];
  const bad: string[] = [];
  if (!manifest) return { ok, bad };
  for (const name of Object.keys(manifest.files)) {
    if (!files.includes(name)) continue;
    const r = await cache.match(wasmUrl(baseUrl, name));
    const buf = r ? await r.arrayBuffer() : null;
    if (buf && buf.byteLength === manifest.files[name].bytes && (await sha256Hex(buf)) === manifest.files[name].sha256) ok.push(name);
    else bad.push(name);
  }
  return { ok, bad };
}

export async function removeInstalled(baseUrl: string, cache: CacheLike, names: string[]) {
  for (const n of names) await cache.delete?.(wasmUrl(baseUrl, n));
  await cache.delete?.(packUrl(baseUrl, PACK_MANIFEST));
}

/**
 * Does the host serve this full .wasm directly (Windows package / bundled build)?
 * HEAD probe; SPA fallbacks answering index.html are detected by content type.
 */
export async function probeBundled(baseUrl: string, name: string, bytes: number, f: FetchLike = fetch): Promise<boolean> {
  try {
    const r = await f(wasmUrl(baseUrl, name), { method: 'HEAD', cache: 'no-cache' });
    const type = r.headers.get('content-type') ?? '';
    const len = Number(r.headers.get('content-length') ?? 0);
    return r.ok && !type.includes('html') && len === bytes;
  } catch {
    return false;
  }
}
