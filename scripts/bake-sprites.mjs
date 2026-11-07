// Bakes 2D sprites (pieces and trophies) from the sculpted models.
// Three.js is used ONLY here, at build time; the app ships plain images.
//   npm run bake:sprites
import { createServer } from 'vite';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // preinstalled globally; not a project dependency
import { mkdirSync, writeFileSync } from 'node:fs';

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error', e.message));
const what = process.argv[2] ?? 'pieces';
const url = what === 'pieces' ? `http://localhost:${port}/lab.html?mode=sprites&size=320` : `http://localhost:${port}/lab.html?mode=trophy-sprites`;
await page.goto(url);
await page.waitForFunction(() => window.__ready, null, { timeout: 600000 });
const sprites = await page.evaluate(() => window.__sprites);
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
