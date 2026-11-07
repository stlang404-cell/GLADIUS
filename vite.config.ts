import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Heavy engine benchmarks (tests/bench/**/*.slow.test.ts) only run when asked for
// explicitly (`npm run bench`, or a path under tests/bench), never in `npm test`.
const benchRun = process.argv.some((a) => a.includes('tests/bench')) || !!process.env.GLADIUS_BENCH;

// Cross-origin isolation (COOP/COEP) lets the browser use the multi-threaded
// Stockfish builds (SharedArrayBuffer). Opt-in for dev/preview: GLADIUS_COI=1.
// Static hosts that cannot send headers (GitHub Pages) stay single-threaded;
// see docs/ENGINE.md "Hosting" for the options.
const coiHeaders = process.env.GLADIUS_COI
  ? { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }
  : undefined;

// Relative base so the build works from any static host sub-path
// (GitHub Pages project sites, Netlify, a local launcher, etc.).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Only the always-used lite single-threaded engine is precached (≈1.9 MB).
      includeAssets: ['icons/*.svg', 'icons/*.png', 'engine/STOCKFISH-LICENSE.txt', 'engine/package.json', 'engine/stockfish-19-lite-single.*'],
      manifest: {
        name: 'GLADIUS',
        short_name: 'GLADIUS',
        description: 'The Eternal Chess Empire — an offline Roman chess career.',
        theme_color: '#2a0f0f',
        background_color: '#1a0b0b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,txt,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Optional engine builds (big net ≈99 MB, threaded builds) are never precached:
        // they are fetched on demand and kept by a CacheFirst runtime route (offline after first use).
        globIgnores: ['**/engine/stockfish-19-single.wasm', '**/engine/stockfish-19.wasm', '**/engine/stockfish-19.js', '**/engine/stockfish-19-lite.wasm', '**/engine/stockfish-19-lite.js'],
        runtimeCaching: [
          {
            urlPattern: /\/engine\/stockfish-19(?:-single|-lite)?\.(?:wasm|js)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'gladius-engine-bignet', cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 8 } },
          },
        ],
      },
    }),
  ],
  server: { headers: coiHeaders },
  preview: { headers: coiHeaders },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', ...(benchRun ? [] : ['tests/bench/**/*.slow.test.ts'])],
    // Benchmarks measure time: run their files one after another.
    fileParallelism: !benchRun,
    testTimeout: 60000,
  },
});
