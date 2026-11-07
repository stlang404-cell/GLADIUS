// Builds release/GLADIUS-windows/ (zip it and copy to any Windows PC).
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
const out = 'release/GLADIUS-windows';
if (!existsSync('dist/index.html')) throw new Error('Run `npm run build` first');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('dist', `${out}/app`, { recursive: true });
cpSync('windows/GLADIUS.bat', `${out}/GLADIUS.bat`);
cpSync('windows/launcher.ps1', `${out}/launcher.ps1`);
writeFileSync(`${out}/README.txt`, 'Double-click GLADIUS.bat to play. Requires Windows 10/11 and a modern browser (Edge/Chrome/Firefox).\r\nSaves are stored in your browser for http://localhost:47615. Export backups from Legacy > Saves.\r\nStockfish (GPL-3.0) license: app/engine/STOCKFISH-LICENSE.txt\r\n');
console.log('Packaged', out);
