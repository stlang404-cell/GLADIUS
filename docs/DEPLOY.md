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

## Windows desktop (one click)

```bash
npm run package:win  # -> release/GLADIUS-windows/
```

Zip `release/GLADIUS-windows/` and copy it to any Windows 10/11 PC. Double-click **GLADIUS.bat**. It starts a tiny local server using only built-in PowerShell (no Node, no install) on `http://localhost:47615` and opens your browser.

Optional: in Edge or Chrome choose **Install GLADIUS** in the address bar. The installed app window works offline; the launcher is then only needed if the browser's cache is cleared.

Saves live in the browser's storage for that origin (`localhost:47615`). Use **Legacy → Saves → Export backup** to keep a copy.

## iPhone (installable PWA)

`localhost` on your PC is **not** reachable from your phone over the internet, and Safari only installs service-worker PWAs from **HTTPS** origins. So host the `dist/` folder on any free static HTTPS host once; afterwards the phone needs neither your PC nor a network.

1. `npm run build`
2. Upload `dist/` to a static host. Any of these work (free tiers, no server code):
   - **GitHub Pages**: push `dist/` to a `gh-pages` branch (the build uses relative paths, so project sub-paths work).
   - **Netlify / Cloudflare Pages**: drag-and-drop the `dist/` folder in their dashboard.
3. On the iPhone open the HTTPS URL in **Safari**, wait for the first load to finish (≈ 4 MB including the engine), then **Share → Add to Home Screen**.
4. Launch GLADIUS from the home screen once while online so the service worker caches everything. From then on it runs fully offline.

Notes and constraints (iOS 16.4+ recommended):
- WebAssembly Stockfish (single-threaded lite build) needs no special headers, so any static host works.
- iOS may evict storage of web apps that go unused for weeks. GLADIUS requests persistent storage, but **export a backup** periodically (Legacy → Saves).
- Saves are per device. To move a career between PC and phone, export on one and import on the other.
