import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { verifyPack, readManifest, decodeFile, makeDelta, applyDelta as applyDeltaNode, DEFAULT_PACK_DIR } from '../scripts/engine-pack.mjs';
import { applyDelta, installPack, installedFiles, verifyInstalled, probeBundled, type CacheLike } from '../src/engine/enginePack';
import { BUILDS } from '../src/engine/builds';

/**
 * Engine pack (full-strength Stockfish 19 split into git-friendly chunks):
 * the committed chunks are intact, reassemble bit-exactly to the npm
 * stockfish@19.0.1 files, and the browser installer (run here in Node with a
 * fetch/Cache Storage stand-in serving public/) verifies and stores them.
 */
const PUBLIC = path.resolve(__dirname, '../public');
const BASE = 'http://gladius.test/app/';

function fsFetch(opts: { corrupt?: string; html?: boolean; log?: string[] } = {}) {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const u = new URL(url);
    const rel = decodeURIComponent(u.pathname.replace('/app/', ''));
    opts.log?.push(rel);
    const p = path.join(PUBLIC, rel);
    if (opts.html || !fs.existsSync(p)) return new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
    let body: Uint8Array = fs.readFileSync(p);
    if (opts.corrupt && rel.endsWith(opts.corrupt)) {
      body = Uint8Array.from(body);
      body[1000] ^= 0xff;
    }
    const headers = { 'content-type': rel.endsWith('.json') ? 'application/json' : 'application/octet-stream', 'content-length': String(body.length) };
    return new Response(init?.method === 'HEAD' ? null : (body as Uint8Array<ArrayBuffer>), { status: 200, headers });
  };
}

function memCache(): CacheLike & { map: Map<string, Response> } {
  const map = new Map<string, Response>();
  return {
    map,
    async match(url) {
      const r = map.get(url);
      return r?.clone();
    },
    async put(url, r) {
      // Store a materialised copy (like Cache Storage does).
      const buf = await r.arrayBuffer();
      map.set(url, new Response(buf, { headers: r.headers }));
    },
    async delete(url) {
      return map.delete(url);
    },
  };
}

describe('engine pack (committed chunks)', () => {
  it('is present and every chunk matches its SHA-256; chunks are git/host friendly (< 25 MiB)', () => {
    const m = readManifest();
    expect(m, 'public/engine/pack/engine-pack.json').toBeTruthy();
    expect(verifyPack()).toEqual([]);
    for (const f of Object.values(m!.files)) for (const c of f.chunks) expect(c.bytes).toBeLessThan(25 * 1024 * 1024);
  });

  it('manifest and builds.ts agree on size and SHA-256 of the full builds', () => {
    const m = readManifest()!;
    for (const id of ['full-single', 'full-mt'] as const) {
      const f = m.files[BUILDS[id].wasm];
      expect(f.bytes).toBe(BUILDS[id].wasmBytes);
      expect(f.sha256).toBe(BUILDS[id].sha256);
    }
  });

  it('Node reassembly reproduces both builds bit-exactly (gunzip + GSD1 delta)', () => {
    const cache = new Map<string, Buffer>();
    const single = decodeFile('stockfish-19-single.wasm', DEFAULT_PACK_DIR, cache);
    const mt = decodeFile('stockfish-19.wasm', DEFAULT_PACK_DIR, cache);
    expect(single.length).toBe(BUILDS['full-single'].wasmBytes);
    expect(mt.length).toBe(BUILDS['full-mt'].wasmBytes);
    // wasm magic
    expect([...single.subarray(0, 4)]).toEqual([0, 0x61, 0x73, 0x6d]);
    expect([...mt.subarray(0, 4)]).toEqual([0, 0x61, 0x73, 0x6d]);
  }, 60000);

  it('the browser delta decoder equals the Node one', () => {
    const base = randomBytes(200000);
    const target = Buffer.concat([randomBytes(100), base.subarray(5000, 90000), randomBytes(333), base.subarray(100000, 199000), randomBytes(7)]);
    const d = makeDelta(base, target);
    expect(d.length).toBeLessThan(2000);
    expect(Buffer.from(applyDelta(base, d)).equals(target)).toBe(true);
    expect(applyDeltaNode(base, d).equals(target)).toBe(true);
  });
});

describe('engine pack install (browser code path)', () => {
  it('downloads, decompresses, verifies and stores both builds; detects them after reload', async () => {
    const cache = memCache();
    const progress: number[] = [];
    const names = await installPack({ baseUrl: BASE, fetch: fsFetch(), cache, onProgress: (p) => p.phase === 'download' && progress.push(p.loaded) });
    expect(names.sort()).toEqual(['stockfish-19-single.wasm', 'stockfish-19.wasm']);
    expect(progress.length).toBeGreaterThan(4);
    expect(progress[progress.length - 1]).toBe(readManifest()!.files['stockfish-19-single.wasm'].chunks.reduce((a, c) => a + c.bytes, 0) + readManifest()!.files['stockfish-19.wasm'].chunks[0].bytes);
    const inst = await installedFiles(BASE, cache);
    expect(inst.files.sort()).toEqual(['stockfish-19-single.wasm', 'stockfish-19.wasm']);
    const v = await verifyInstalled(BASE, cache);
    expect(v.bad).toEqual([]);
    expect(v.ok.length).toBe(2);
    const r = await cache.match(BASE + 'engine/stockfish-19-single.wasm');
    expect(r!.headers.get('content-type')).toBe('application/wasm');
  }, 120000);

  it('a corrupt chunk is retried, then the install fails and stores nothing', async () => {
    const cache = memCache();
    const log: string[] = [];
    await expect(installPack({ baseUrl: BASE, names: ['stockfish-19-single.wasm'], fetch: fsFetch({ corrupt: '.gz.002', log }), cache })).rejects.toThrow(/checksum/);
    expect(log.filter((l) => l.endsWith('.gz.002')).length).toBe(3); // 1 + 2 retries
    expect((await installedFiles(BASE, cache)).files).toEqual([]);
  }, 120000);

  it('a host without the pack (SPA fallback HTML) is detected, nothing is downloaded', async () => {
    const cache = memCache();
    await expect(installPack({ baseUrl: BASE, fetch: fsFetch({ html: true }), cache })).rejects.toThrow(/not deployed/);
    expect(await probeBundled(BASE, 'stockfish-19-single.wasm', BUILDS['full-single'].wasmBytes, fsFetch({ html: true }))).toBe(false);
  });

  it('the threaded build needs its base installed first', async () => {
    const cache = memCache();
    await expect(installPack({ baseUrl: BASE, names: ['stockfish-19.wasm'], fetch: fsFetch(), cache })).rejects.toThrow(/needs stockfish-19-single.wasm/);
  });
});
