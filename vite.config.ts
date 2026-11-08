import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';
import { verifyPack, assemblePack, readManifest } from './scripts/engine-pack.mjs';

/**
 * Engine pack (docs/ENGINE.md, "v0.3 → Distribution"). The full-strength
 * Stockfish builds live in public/engine/pack/ as checksummed chunks (copied to
 * dist/ as-is; the PWA installs them on demand). At build time:
 *  - every chunk is verified (a clone without the chunks, or with git-LFS
 *    pointers, fails the build instead of silently shipping Lite only);
 *  - single full-size .wasm files that a developer may have in public/engine/
 *    (git-ignored) are removed from dist/, so every build is identical to a
 *    fresh clone's — unless GLADIUS_BUNDLE_FULL_ENGINE=1, which writes them,
 *    reassembled and SHA-256 verified (hosts that accept 99 MB files; the
 *    Windows packager does this itself).
 */
function enginePack(): Plugin {
  let outDir = 'dist';
  return {
    name: 'gladius-engine-pack',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    buildStart() {
      const bad = verifyPack();
      if (bad.length) this.error(`engine pack invalid:\n  ${bad.join('\n  ')}\nRestore public/engine/pack/ (see docs/ENGINE.md) or rebuild it: node scripts/engine-pack.mjs build <npm stockfish bin dir>`);
    },
    closeBundle() {
      // Baked SDF meshes (public/models) are bake inputs only, never loaded by the game.
      fs.rmSync(path.join(outDir, 'models'), { recursive: true, force: true });
      const engineDir = path.join(outDir, 'engine');
      if (!fs.existsSync(engineDir)) return;
      const names = Object.keys(readManifest()?.files ?? {});
      if (process.env.GLADIUS_BUNDLE_FULL_ENGINE) {
        assemblePack(engineDir, undefined, names);
      } else {
        for (const n of names) fs.rmSync(path.join(engineDir, n), { force: true });
      }
    },
  };
}

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

// Base path. Relative by default so the build works from any static host sub-path
// (local launcher, Windows package, Netlify…). The GitHub Pages workflow sets
// GLADIUS_BASE=/<repository>/ (e.g. /GLADIUS/) so the service worker scope,
// manifest and every asset URL are absolute under the project site.
const base = process.env.GLADIUS_BASE ? `/${process.env.GLADIUS_BASE.replace(/^\/+|\/+$/g, '')}/` : './';

export default defineConfig({
  base,
  plugins: [
    react(),
    enginePack(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Only the always-used lite single-threaded engine is precached (≈1.9 MB).
      includeAssets: ['brand/*', 'favicon.ico', 'engine/STOCKFISH-LICENSE.txt', 'engine/package.json', 'engine/stockfish-19-lite-single.*'],
      manifest: {
        name: 'GLADIUS',
        short_name: 'GLADIUS',
        description: 'The Eternal Chess Empire — an offline Roman chess career.',
        theme_color: '#FAF8F3',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'brand/app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'brand/app-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'brand/app-icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'brand/app-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'brand/app-icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,txt,webmanifest,woff2,webp,ico}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Never precached: the engine pack (≈79 MB of chunks; installed on demand by the app
        // into its own Cache Storage, verified by SHA-256), full-size big-net files (bundled
        // hosts only) and the threaded lite wasm (only usable when cross-origin isolated).
        // The small JS glue of every build IS precached so an installed pack works offline.
        globIgnores: ['**/engine/pack/**', '**/engine/stockfish-19-single.wasm', '**/engine/stockfish-19.wasm', '**/engine/stockfish-19-lite.wasm'],
        runtimeCaching: [
          {
            // The installed engine pack lives in its own cache (written by the app after SHA-256
            // verification, key = canonical engine/<file>.wasm URL). Workers whose script is served
            // from the precache lose the "#blob:" hash, so the Stockfish glue then fetches the wasm
            // by path: answer it from the pack cache (no network; GitHub Pages does not host it).
            urlPattern: /\/engine\/stockfish-19(?:-single)?\.wasm$/,
            // Pack cache first; otherwise the network (Windows package / bundled hosts serve the file).
            handler: async ({ request }) => (await (await caches.open('gladius-engine-pack-v1')).match(request.url)) ?? fetch(request),
          },
          {
            urlPattern: /\/engine\/stockfish-19(?:-single|-lite)?\.js$|\/engine\/stockfish-19-lite\.wasm$/,
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
