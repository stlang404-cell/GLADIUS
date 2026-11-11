// Render an HTML/SVG file to PNG with the pre-installed Chromium.
// usage: node tools/rasterize.js <input.html|svg> <out.png> <width> <height> [scale]
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const [, , src, out, w, h, scale = '1'] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
  await page.goto('file://' + path.resolve(src));
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: +w, height: +h } });
  await browser.close();
})();
