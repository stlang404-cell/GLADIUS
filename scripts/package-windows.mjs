// Builds release/GLADIUS-windows/ (zip it and copy to any Windows PC).
// The full-strength engine is bundled: both big-net Stockfish 19 builds are
// reassembled from the committed engine pack (public/engine/pack) and verified
// with SHA-256, so the package plays at full strength offline with no download.
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { assemblePack, readManifest } from './engine-pack.mjs';
const out = 'release/GLADIUS-windows';
if (!existsSync('dist/index.html')) throw new Error('Run `npm run build` first');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('dist', `${out}/app`, { recursive: true });
// The chunks are only needed by hosted PWAs; the package ships the assembled files instead.
rmSync(`${out}/app/engine/pack`, { recursive: true, force: true });
const m = readManifest();
if (!m) throw new Error('public/engine/pack/engine-pack.json missing: the full engine cannot be bundled');
const files = assemblePack(`${out}/app/engine`);
for (const f of files) {
  const want = m.files[f];
  if (statSync(`${out}/app/engine/${f}`).size !== want.bytes) throw new Error(`${f}: wrong size`);
  console.log(`bundled ${f} (${want.build}, ${(want.bytes / 1048576).toFixed(1)} MiB, sha256 ${want.sha256.slice(0, 12)}…)`);
}
cpSync('windows/GLADIUS.bat', `${out}/GLADIUS.bat`);
cpSync('windows/launcher.ps1', `${out}/launcher.ps1`);
cpSync('public/brand/gladius.ico', `${out}/gladius.ico`);
writeFileSync(
  `${out}/README.txt`,
  [
    'Double-click GLADIUS.bat to play. Requires Windows 10/11 and a modern browser (Edge/Chrome/Firefox).',
    'Saves are stored in your browser for http://localhost:47615. Export backups from Legacy > Saves.',
    'Chess engine: Stockfish 19 (npm stockfish@19.0.1 by Nathan Rugg / Chess.com, based on the Stockfish project).',
    'This package bundles the full-strength builds (big NNUE net; multi-threaded when the browser allows it).',
    'Stockfish is free software under the GNU GPL v3: app/engine/STOCKFISH-LICENSE.txt.',
    'Source: https://github.com/official-stockfish/Stockfish and https://github.com/nmrugg/stockfish.js (v19.0.1).',
    '',
  ].join('\r\n'),
);
console.log('Packaged', out);
