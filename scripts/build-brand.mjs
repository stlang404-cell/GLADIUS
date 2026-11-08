// Writes the GLADIUS brand kit: SVG masters + PNG/ICO rasters.  npm run build:brand
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const server = await createServer({ server: { port: 0 }, logLevel: 'error', appType: 'custom' });
const L = await server.ssrLoadModule('/src/art/logo.ts');
mkdirSync('public/brand', { recursive: true });
const svgs = {
  'logo-horizontal': L.horizontalLogoSvg({ tagline: false }),
  'logo-horizontal-tagline': L.horizontalLogoSvg({ tagline: true }),
  'logo-horizontal-dark': L.horizontalLogoSvg({ tagline: true, dark: true }),
  'logo-stacked': L.stackedLogoSvg(),
  crest: L.crestSvg(),
  'app-icon': L.appIconSvg(),
  'app-icon-maskable': L.appIconSvg({ maskable: true }),
  favicon: L.faviconSvg(),
};
for (const [n, s] of Object.entries(svgs)) writeFileSync(`public/brand/${n}.svg`, s);
await server.close();

const browser = await chromium.launch();
const page = await browser.newPage();
async function raster(svg, size, out, transparent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}
for (const s of [1024, 512, 192, 180, 167, 152, 120]) await raster(svgs['app-icon'], s, `public/brand/app-icon-${s}.png`, false);
for (const s of [512, 192]) await raster(svgs['app-icon-maskable'], s, `public/brand/app-icon-maskable-${s}.png`, false);
for (const s of [512, 256, 128]) await raster(svgs.crest, s, `public/brand/crest-${s}.png`, true);
for (const s of [16, 32, 48, 64, 256]) await raster(s <= 48 ? svgs.favicon : svgs.crest, s, `public/brand/favicon-${s}.png`, true);
// Horizontal logo raster (transparent)
await page.setViewportSize({ width: 1200, height: 300 });
await page.setContent(`<html><body style="margin:0;background:transparent">${svgs['logo-horizontal-tagline'].replace('<svg ', '<svg width="1200" ')}</body></html>`);
const el = await page.$('svg');
await el.screenshot({ path: 'public/brand/logo-horizontal.png', omitBackground: true });
await browser.close();
console.log('brand kit written to public/brand/');
