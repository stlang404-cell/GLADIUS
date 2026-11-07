import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Heavy engine benchmarks (tests/bench/**/*.slow.test.ts) only run when asked for
// explicitly (`npm run bench`, or a path under tests/bench), never in `npm test`.
const benchRun = process.argv.some((a) => a.includes('tests/bench')) || !!process.env.GLADIUS_BENCH;

// Relative base so the build works from any static host sub-path
// (GitHub Pages project sites, Netlify, a local launcher, etc.).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.svg', 'icons/*.png', 'engine/*'],
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
      },
    }),
  ],
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', ...(benchRun ? [] : ['tests/bench/**/*.slow.test.ts'])],
    testTimeout: 60000,
  },
});
