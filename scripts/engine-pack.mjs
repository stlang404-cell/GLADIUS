// GLADIUS "engine pack": how the full-strength (big-net) Stockfish 19 builds are
// stored in git, shipped to static hosts and reassembled (docs/ENGINE.md, "v0.3 → Distribution").
//
// The big-net .wasm files (~99 MB each) exceed what git hosting and some static
// hosts accept per file (GitHub warns at 50 MB and refuses 100 MiB; Cloudflare
// Pages refuses > 25 MiB). The pack stores them as:
//   - stockfish-19-single.wasm: gzip (-9), split into chunks of ≤ 20 MiB;
//   - stockfish-19.wasm (threaded): a binary delta against the single-threaded
//     build (both embed the same network), gzipped — a few MB instead of 79;
//   - engine-pack.json: sizes and SHA-256 of every chunk and of every final file.
// Gzip is used (not brotli) because every browser can decompress it with
// DecompressionStream('gzip'); brotli would save ~6 % more but needs a JS decoder.
//
// The same manifest + format is read by the browser (src/engine/enginePack.ts),
// by the build (vite.config.ts plugin), the Windows packager and the Node tests.
//
// CLI:
//   node scripts/engine-pack.mjs build <dir-with-npm-stockfish-bin> [outDir]
//   node scripts/engine-pack.mjs verify [packDir]
//   node scripts/engine-pack.mjs assemble <outDir> [packDir]
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PACK_DIR = path.resolve(here, '../public/engine/pack');
export const MANIFEST = 'engine-pack.json';
export const CHUNK_BYTES = 20 * 1024 * 1024;

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------------
// Delta format "GSD1" (little endian):
//   magic 'GSD1' | u32 targetLen | u32 baseLen | ops…
//   op 0: literal  u32 len, len bytes
//   op 1: copy     u32 baseOffset, u32 len
// ---------------------------------------------------------------------------
const W = 32; // match window
const STEP = 4; // base indexed every STEP bytes
const P = 0x01000193;

function powP(n) {
  let r = 1;
  for (let i = 0; i < n; i++) r = Math.imul(r, P);
  return r >>> 0;
}

export function makeDelta(base, target) {
  const bits = 24;
  const mask = (1 << bits) - 1;
  const table = new Int32Array(1 << bits).fill(-1);
  const PW = powP(W);
  // Index base: rolling hash at every offset, store every STEP-th.
  let h = 0;
  for (let i = 0; i < base.length; i++) {
    h = (Math.imul(h, P) + base[i]) >>> 0;
    if (i >= W) h = (h - Math.imul(base[i - W], PW)) >>> 0;
    const start = i - W + 1;
    if (start >= 0 && start % STEP === 0) table[h & mask] = start;
  }
  const out = [];
  let litStart = 0;
  const u32 = (v) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v >>> 0);
    return b;
  };
  const flushLit = (end) => {
    if (end > litStart) out.push(Buffer.from([0]), u32(end - litStart), target.subarray(litStart, end));
  };
  out.push(Buffer.from('GSD1'), u32(target.length), u32(base.length));
  let i = 0;
  h = 0;
  let filled = 0; // bytes in the rolling window
  while (i < target.length) {
    h = (Math.imul(h, P) + target[i]) >>> 0;
    if (filled >= W) h = (h - Math.imul(target[i - W], PW)) >>> 0;
    else filled++;
    i++;
    if (filled < W) continue;
    const ts = i - W;
    const cand = table[h & mask];
    if (cand < 0 || base.compare(target, ts, i, cand, cand + W) !== 0) continue;
    // Extend backwards into the pending literal and forwards.
    let bs = cand;
    let s = ts;
    while (s > litStart && bs > 0 && target[s - 1] === base[bs - 1]) {
      s--;
      bs--;
    }
    let e = i;
    let be = cand + W;
    while (e < target.length && be < base.length && target[e] === base[be]) {
      e++;
      be++;
    }
    if (e - s < 64) continue; // not worth an op
    flushLit(s);
    out.push(Buffer.from([1]), u32(bs), u32(e - s));
    litStart = e;
    i = e;
    h = 0;
    filled = 0;
  }
  flushLit(target.length);
  return Buffer.concat(out);
}

export function applyDelta(base, delta) {
  if (delta.toString('latin1', 0, 4) !== 'GSD1') throw new Error('not a GSD1 delta');
  const tlen = delta.readUInt32LE(4);
  const blen = delta.readUInt32LE(8);
  if (blen !== base.length) throw new Error(`delta base length ${blen} ≠ ${base.length}`);
  const out = Buffer.allocUnsafe(tlen);
  let o = 0;
  let p = 12;
  while (p < delta.length) {
    const op = delta[p++];
    if (op === 0) {
      const n = delta.readUInt32LE(p);
      p += 4;
      delta.copy(out, o, p, p + n);
      p += n;
      o += n;
    } else if (op === 1) {
      const off = delta.readUInt32LE(p);
      const n = delta.readUInt32LE(p + 4);
      p += 8;
      base.copy(out, o, off, off + n);
      o += n;
    } else throw new Error('bad delta op ' + op);
  }
  if (o !== tlen) throw new Error(`delta produced ${o} bytes, expected ${tlen}`);
  return out;
}

// ---------------------------------------------------------------------------
// Build / verify / assemble
// ---------------------------------------------------------------------------

function writeChunks(outDir, name, data) {
  const chunks = [];
  for (let off = 0, k = 0; off < data.length; off += CHUNK_BYTES, k++) {
    const part = data.subarray(off, Math.min(data.length, off + CHUNK_BYTES));
    const file = `${name}.${String(k).padStart(3, '0')}`;
    fs.writeFileSync(path.join(outDir, file), part);
    chunks.push({ file, bytes: part.length, sha256: sha256(part) });
  }
  return chunks;
}

export function buildPack(srcDir, outDir = DEFAULT_PACK_DIR) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^stockfish-19/.test(f) || f === MANIFEST) fs.rmSync(path.join(outDir, f));
  const single = fs.readFileSync(path.join(srcDir, 'stockfish-19-single.wasm'));
  const mt = fs.readFileSync(path.join(srcDir, 'stockfish-19.wasm'));
  const gzSingle = zlib.gzipSync(single, { level: 9 });
  const delta = makeDelta(single, mt);
  if (!applyDelta(single, delta).equals(mt)) throw new Error('delta round-trip failed');
  const gzDelta = zlib.gzipSync(delta, { level: 9 });
  const manifest = {
    format: 1,
    engine: 'Stockfish 19',
    source: 'npm stockfish@19.0.1 (https://github.com/nmrugg/stockfish.js), package/bin/',
    license: 'GPL-3.0 — see ../STOCKFISH-LICENSE.txt',
    files: {
      'stockfish-19-single.wasm': {
        build: 'full-single',
        bytes: single.length,
        sha256: sha256(single),
        encoding: 'gzip',
        chunks: writeChunks(outDir, 'stockfish-19-single.wasm.gz', gzSingle),
      },
      'stockfish-19.wasm': {
        build: 'full-mt',
        bytes: mt.length,
        sha256: sha256(mt),
        encoding: 'gzip',
        delta: { base: 'stockfish-19-single.wasm', format: 'GSD1' },
        chunks: writeChunks(outDir, 'stockfish-19.wasm.gsd1.gz', gzDelta),
      },
    },
  };
  fs.writeFileSync(path.join(outDir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

export function readManifest(packDir = DEFAULT_PACK_DIR) {
  const p = path.join(packDir, MANIFEST);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Check every chunk (size + SHA-256). Returns a list of problems (empty = OK). */
export function verifyPack(packDir = DEFAULT_PACK_DIR) {
  const m = readManifest(packDir);
  if (!m) return [`${MANIFEST} missing in ${packDir}`];
  const bad = [];
  for (const [name, f] of Object.entries(m.files)) {
    for (const c of f.chunks) {
      const p = path.join(packDir, c.file);
      if (!fs.existsSync(p)) {
        bad.push(`${name}: ${c.file} missing`);
        continue;
      }
      const b = fs.readFileSync(p);
      if (b.length !== c.bytes || sha256(b) !== c.sha256) bad.push(`${name}: ${c.file} corrupt (${b.length} bytes; git LFS pointer or truncated clone?)`);
    }
  }
  return bad;
}

/** Decode one file of the pack to a Buffer (verified against its SHA-256). */
export function decodeFile(name, packDir = DEFAULT_PACK_DIR, cache = new Map()) {
  if (cache.has(name)) return cache.get(name);
  const m = readManifest(packDir);
  if (!m) throw new Error(`${MANIFEST} missing in ${packDir}`);
  const f = m.files[name];
  if (!f) throw new Error(`${name} is not in the engine pack`);
  let data = Buffer.concat(f.chunks.map((c) => fs.readFileSync(path.join(packDir, c.file))));
  if (f.encoding === 'gzip') data = zlib.gunzipSync(data);
  if (f.delta) data = applyDelta(decodeFile(f.delta.base, packDir, cache), data);
  if (data.length !== f.bytes || sha256(data) !== f.sha256) throw new Error(`${name}: SHA-256 mismatch after reassembly`);
  cache.set(name, data);
  return data;
}

/**
 * Write the full-size .wasm files into outDir (skipping files that are already
 * there with the right SHA-256). Returns the names written or kept.
 */
export function assemblePack(outDir, packDir = DEFAULT_PACK_DIR, names) {
  const m = readManifest(packDir);
  if (!m) throw new Error(`${MANIFEST} missing in ${packDir}`);
  fs.mkdirSync(outDir, { recursive: true });
  const cache = new Map();
  const done = [];
  for (const name of names ?? Object.keys(m.files)) {
    const dst = path.join(outDir, name);
    const f = m.files[name];
    if (fs.existsSync(dst) && fs.statSync(dst).size === f.bytes && sha256(fs.readFileSync(dst)) === f.sha256) {
      done.push(name);
      continue;
    }
    fs.writeFileSync(dst, decodeFile(name, packDir, cache));
    done.push(name);
  }
  return done;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, a, b] = process.argv.slice(2);
  const t0 = Date.now();
  if (cmd === 'build') {
    if (!a) throw new Error('usage: engine-pack.mjs build <npm stockfish bin dir> [outDir]');
    const m = buildPack(a, b);
    for (const [n, f] of Object.entries(m.files)) console.log(n, f.bytes, '→', f.chunks.map((c) => `${c.file} ${c.bytes}`).join(', '));
  } else if (cmd === 'verify') {
    const bad = verifyPack(a);
    if (bad.length) {
      console.error(bad.join('\n'));
      process.exit(1);
    }
    const m = readManifest(a);
    const cache = new Map();
    for (const n of Object.keys(m.files)) decodeFile(n, a, cache);
    console.log('engine pack OK:', Object.keys(m.files).join(', '));
  } else if (cmd === 'assemble') {
    if (!a) throw new Error('usage: engine-pack.mjs assemble <outDir> [packDir]');
    console.log('assembled', assemblePack(a, b).join(', '), 'into', a);
  } else {
    console.log('usage: node scripts/engine-pack.mjs build|verify|assemble …');
    process.exit(2);
  }
  console.log(`(${Date.now() - t0} ms)`);
}
