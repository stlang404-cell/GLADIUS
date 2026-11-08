#!/usr/bin/env node
/**
 * Verifies a GitHub Pages build before upload:
 *  - every URL referenced by index.html and the web manifest exists in dist/ under the base path;
 *  - every service-worker precache entry exists (and none is an engine-pack chunk);
 *  - the always-available Lite engine and the full-strength engine pack (chunks + manifest) are present;
 *  - no file exceeds GitHub Pages' 100 MB limit and the site stays under 1 GB.
 * Usage: node scripts/check-pages-dist.mjs dist /GLADIUS/
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
const base = process.argv[3] ?? '/';
const errors = [];
const exists = (rel) => fs.existsSync(path.join(dist, rel));

function local(url) {
  if (/^(data:|https?:|mailto:|#)/.test(url)) return null;
  let u = url.split(/[?#]/)[0];
  if (u.startsWith(base)) u = u.slice(base.length);
  else if (u.startsWith('/')) { errors.push(`absolute URL outside base ${base}: ${url}`); return null; }
  return u.replace(/^\.\//, '');
}

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const rel = local(m[1]);
  if (rel && !exists(rel)) errors.push(`index.html → missing ${m[1]}`);
}

const manifestFile = fs.readdirSync(dist).find((f) => f.endsWith('.webmanifest'));
if (!manifestFile) errors.push('no web manifest');
else {
  const man = JSON.parse(fs.readFileSync(path.join(dist, manifestFile), 'utf8'));
  for (const i of man.icons ?? []) if (!exists(local(i.src) ?? '')) errors.push(`manifest icon missing: ${i.src}`);
  if (!(man.icons ?? []).some((i) => i.sizes === '512x512')) errors.push('manifest has no 512×512 icon');
}

const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
const pre = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
if (pre.length < 50) errors.push(`suspiciously small precache (${pre.length} entries)`);
for (const u of pre) {
  if (!exists(u)) errors.push(`precache entry missing: ${u}`);
  if (u.includes('engine/pack/')) errors.push(`engine pack must not be precached: ${u}`);
}

for (const f of ['engine/stockfish-19-lite-single.js', 'engine/stockfish-19-lite-single.wasm', 'engine/STOCKFISH-LICENSE.txt', 'engine/pack/engine-pack.json', 'apple-touch-icon.png'].filter((f) => f !== 'apple-touch-icon.png' || exists(f)))
  if (!exists(f)) errors.push(`missing ${f}`);
const pack = JSON.parse(fs.readFileSync(path.join(dist, 'engine/pack/engine-pack.json'), 'utf8'));
for (const file of Object.values(pack.files ?? {})) for (const c of file.chunks ?? []) if (!exists(path.join('engine/pack', c.name ?? c.file ?? c))) errors.push(`engine chunk missing: ${JSON.stringify(c)}`);

let total = 0, biggest = ['', 0];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else {
      const n = fs.statSync(p).size;
      total += n;
      if (n > biggest[1]) biggest = [path.relative(dist, p), n];
      if (n > 100 * 1024 * 1024) errors.push(`file over 100 MB: ${p}`);
    }
  }
})(dist);
if (total > 1024 ** 3) errors.push(`site over 1 GB (${(total / 1048576).toFixed(0)} MB)`);

console.log(`dist ${(total / 1048576).toFixed(1)} MB · largest ${biggest[0]} ${(biggest[1] / 1048576).toFixed(1)} MB · precache ${pre.length} entries · base ${base}`);
if (errors.length) {
  console.error('Pages bundle check failed:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('Pages bundle check passed.');
