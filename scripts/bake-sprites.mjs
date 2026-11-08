// Bakes the 2D sprites. Pieces: hand-authored vector illustrations
// (src/render/vectorPieces.ts) rasterised by Chromium to WebP. Trophies:
// sculpted models rendered with three.js (src/render/lab.ts).
// Three.js / Chromium are used ONLY here, at build time; the app ships plain images.
//   node scripts/bake-sprites.mjs pieces [setId,...]   node scripts/bake-sprites.mjs trophies
import { createServer } from 'vite';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // preinstalled globally; not a project dependency
import { mkdirSync, writeFileSync } from 'node:fs';

const SIZE = Number(process.env.SIZE ?? 320);
const QUALITY = Number(process.env.QUALITY ?? 0.86);
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error', e.message));
const what = process.argv[2] ?? 'pieces';
let sprites;
if (what === 'pieces') {
  const { pieceSVG, PIECE_TYPES, VECTOR_SETS } = await server.ssrLoadModule('/src/render/vectorPieces.ts');
  const sets = process.argv[3] ? process.argv[3].split(',') : Object.keys(VECTOR_SETS);
  const svgs = {};
  for (const set of sets) for (const c of ['w', 'b']) for (const t of PIECE_TYPES) svgs[`${set}/${c}${t}`] = pieceSVG(set, c, t, SIZE);
  await page.goto(`http://localhost:${port}/lab.html?mode=none`);
  sprites = await page.evaluate(async ({ svgs, size, q }) => {
    const out = {};
    for (const [k, svg] of Object.entries(svgs)) {
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + btoa(svg);
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, 0, 0, size, size);
      out[k] = c.toDataURL('image/webp', q);
    }
    return out;
  }, { svgs, size: SIZE, q: QUALITY });
} else {
  // optional id list: node scripts/bake-sprites.mjs trophies sig-a1,sig-a3
  await page.goto(`http://localhost:${port}/lab.html?mode=trophy-sprites${process.argv[3] ? `&ids=${process.argv[3]}` : ''}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 600000 });
  sprites = await page.evaluate(() => window.__sprites);
}
let bytes = 0;
for (const [key, dataUrl] of Object.entries(sprites)) {
  const file = `public/${what}/${key}.webp`;
  mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  bytes += buf.length;
  writeFileSync(file, buf);
}
console.log(`${Object.keys(sprites).length} sprites, ${(bytes / 1024).toFixed(0)} KB`);
await browser.close();
await server.close();
