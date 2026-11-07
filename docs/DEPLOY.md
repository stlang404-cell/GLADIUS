# Running GLADIUS

GLADIUS is a static, offline-first web app. No accounts, servers, cloud or paid APIs. The chess engine (Stockfish 19 WASM) runs on your device.

## Developer

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # full test suite (unit + engine + simulations)
npm run build        # production build in dist/
npm run preview      # serve dist/ locally
```

## Chess engine builds (read this once)

GLADIUS ships two strengths of Stockfish 19 (npm `stockfish@19.0.1`, GPL-3.0, see `public/engine/STOCKFISH-LICENSE.txt`):

| | Lite (always) | Full-strength "engine pack" |
|---|---|---|
| Files | `engine/stockfish-19-lite-single.*` (1.9 MB, precached) | `engine/pack/` — 4 gzip chunks (≤ 20 MiB each, 79 MB total) + a 259 KB delta for the threaded build + `engine-pack.json` (SHA-256 of every chunk and file) |
| Used for | every opponent, analysis, spectating | opponents ≥ 2700 (and analysis on desktops with ≥ 8 GB) |
| Strength | measured −137 Elo vs full at 100 ms/move, see docs/ENGINE.md v0.3 | strongest |

The full-size `.wasm` files (99 MB each) are **not** in git (GitHub refuses > 100 MiB and warns > 50 MB; Cloudflare Pages refuses > 25 MiB). The chunks are, so **every clone can build the full engine**: `npm run build` verifies the chunks (the build fails if they are missing or are git-LFS pointers), copies them to `dist/engine/pack/`, and the app installs them on demand. Nothing else to download.

- Rebuild the pack from npm (only when upgrading Stockfish): `npm pack stockfish@19.0.1 && tar xzf stockfish-19.0.1.tgz && node scripts/engine-pack.mjs build package/bin` (also copy `package/bin/*.js` into `public/engine/`).
- Check it: `node scripts/engine-pack.mjs verify`. Recreate the single files locally (optional; tests do it automatically into `node_modules/.cache/gladius-engine`): `node scripts/engine-pack.mjs assemble public/engine`.
- Hosts that accept 99 MB files may serve them directly: `GLADIUS_BUNDLE_FULL_ENGINE=1 npx vite build` writes the reassembled, verified files into `dist/engine/` (the app then uses them without an install step).

## Windows desktop (one click)

```bash
npm run package:win  # -> release/GLADIUS-windows/  (~200 MB: includes both full-strength builds)
```

`package-windows.mjs` reassembles both big-net builds from the pack (SHA-256 verified) into `app/engine/`, so the Windows package plays at **full strength out of the box, offline, with no download**. The launcher sends COOP/COEP headers, so the browser is cross-origin isolated and the **threaded** full build runs (threads = cores − 1, max 4).

Zip `release/GLADIUS-windows/` and copy it to any Windows 10/11 PC. Double-click **GLADIUS.bat**. It starts a tiny local server using only built-in PowerShell (no Node, no install) on `http://localhost:47615` and opens your browser.

Check the engine: **Legacy → Settings → Chess engine** shows exactly what runs, e.g. "Opponents ≥ 2700: Stockfish 19 full net, 3 threads · 128 MB hash" and "Full-strength engine pack: bundled with this app".

Optional: in Edge or Chrome choose **Install GLADIUS** in the address bar. The installed app window works offline; the launcher is then only needed if the browser's cache is cleared. (The full engine is cached by the service worker the first time it runs; if that cache is cleared, start GLADIUS.bat again.)

Saves live in the browser's storage for that origin (`localhost:47615`). Use **Legacy → Saves → Export backup** to keep a copy.

## iPhone (installable PWA)

`localhost` on your PC is **not** reachable from your phone over the internet, and Safari only installs service-worker PWAs from **HTTPS** origins. So host the `dist/` folder on any free static HTTPS host once; afterwards the phone needs neither your PC nor a network.

1. `npm run build`
2. Upload `dist/` to a static host. Any of these work (free tiers, no server code; every file in `dist/` is ≤ 20 MiB):
   - **GitHub Pages**: push `dist/` to a `gh-pages` branch (the build uses relative paths, so project sub-paths work).
   - **Netlify / Cloudflare Pages**: drag-and-drop the `dist/` folder in their dashboard.
3. On the iPhone open the HTTPS URL in **Safari**, wait for the first load to finish (≈ 5 MB including the Lite engine), then **Share → Add to Home Screen**.
4. Launch GLADIUS from the home screen once while online so the service worker caches everything. From then on it runs fully offline.

Engine on iPhone: the Lite engine (precached) is used for everything; Settings shows "Stockfish 19 Lite (small net, 1 thread)". The 79 MB full-strength pack is **never** downloaded on phones automatically. You can opt in under **Legacy → Settings → Chess engine → Install full-strength engine** (while online; it is stored in the browser's Cache Storage, verified with SHA-256, and works offline afterwards). On phones it is experimental: it needs ~0.5 GB of memory while an elite opponent plays; if iOS kills the page because of it, GLADIUS notices at the next start and switches back to Lite (the button re-enables it). **Verify** re-checks the stored files; **Remove** frees the space.

## Engine pack on a desktop browser (hosted PWA)

On a desktop browser the pack is installed automatically in the background the first time you meet an opponent rated ≥ 2700 (not on data-saver/2G/3G connections), or at once with the Settings button. Until it is installed those opponents play on Lite, and the Settings card says so ("full-strength engine not active"). Static hosts such as GitHub Pages cannot send COOP/COEP, so there the full engine runs single-threaded.

Notes and constraints (iOS 16.4+ recommended):
- WebAssembly Stockfish (single-threaded builds) needs no special headers, so any static host works.
- iOS may evict storage of web apps that go unused for weeks. GLADIUS requests persistent storage, but **export a backup** periodically (Legacy → Saves). An evicted engine pack simply shows "not installed" again.
- Saves are per device. To move a career between PC and phone, export on one and import on the other.
