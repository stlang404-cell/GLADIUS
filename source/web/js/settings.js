// Settings & data (profile, plan, export/import/reset), the More menu and About/licences.
import * as store from './store.js';
import * as data from './data.js';
import { h, pageHead, toast, downloadFile, confirmDialog } from './ui.js';

export function renderMore(main) {
  const items = [
    ['#/games', 'Games', 'Your played and imported games; engine review'],
    ['#/games/import', 'Import PGN', 'Bring in games from Lichess, Chess.com or a file'],
    ['#/analysis', 'Analysis board', 'Set up and explore any position'],
    ['#/journal', 'Journal & weaknesses', 'Your mistakes, ranked, with remedies'],
    ['#/plan', '90-day plan', 'Every day of the accelerator'],
    ['#/progress', 'Progress', 'Rating log, puzzles, engine accuracy, mastery'],
    ['#/settings', 'Settings & data', 'Profile, export / import, reset'],
    ['#/about', 'About & licences', 'Credits, Stockfish GPL notice'],
  ];
  main.appendChild(h('div', { class: 'page' }, pageHead('More'),
    h('ul', { class: 'more-list' }, items.map(([href, t, d]) => h('li', null, h('a', { href }, h('strong', null, t), h('span', { class: 'muted small' }, d)))))));
}

export function renderSettings(main) {
  const rerender = () => { main.innerHTML = ''; renderSettings(main); };
  const s = store.get();
  const page = h('div', { class: 'page narrow' });
  page.appendChild(pageHead('Settings & data', 'Everything is stored only on this device, in this browser.'));

  const goal = h('textarea', { id: 'profile-goal', rows: 2, class: 'wide', placeholder: 'Why are you training? e.g. Reach 1200 rapid and enjoy my games more.' });
  goal.value = s.profile.goal || '';
  const minutes = h('select', { id: 'set-minutes' }, ['15', '30', '60', '90'].map((m) => h('option', { value: m, selected: String(s.settings.minutes) === m }, `${m} minutes`)));
  const start = h('input', { type: 'date', id: 'set-start', value: s.settings.startDate || '' });
  const depth = h('select', { id: 'set-depth' }, [10, 12, 14, 16].map((d) => h('option', { value: d, selected: Number(s.settings.engineDepth) === d }, `depth ${d}${d === 12 ? ' (default)' : d > 12 ? ' (slower)' : ' (faster)'}`)));
  const saveBtn = h('button', { class: 'btn primary', type: 'button', id: 'save-settings', onclick: () => {
    store.update((st) => {
      st.profile.goal = goal.value.trim();
      st.settings.minutes = Number(minutes.value);
      st.settings.startDate = start.value || null;
      st.settings.engineDepth = Number(depth.value);
    });
    toast('Settings saved.');
  } }, 'Save');
  page.appendChild(h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Profile & plan'),
    h('label', { for: 'profile-goal' }, 'Your goal'), goal,
    h('div', { class: 'form-grid' },
      h('label', { for: 'set-minutes' }, 'Default daily time'), minutes,
      h('label', { for: 'set-start' }, '90-day plan start date'), start,
      h('label', { for: 'set-depth' }, 'Engine review depth'), depth),
    h('p', { class: 'small muted' }, 'Your online rating is logged on the ', h('a', { href: '#/progress' }, 'Progress'), ' page.'),
    saveBtn));

  const file = h('input', { type: 'file', id: 'import-file', accept: 'application/json,.json', class: 'sr-only' });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      if (!(await confirmDialog('Import progress?', 'This replaces all progress on this device with the contents of the file.', 'Import'))) return;
      store.importJSON(text);
      toast('Progress imported.');
      rerender();
    } catch (e) { toast('Import failed: ' + e.message); }
    file.value = '';
  });
  const stats = `${Object.keys(s.ex).length} exercises, ${s.games.length} games, ${s.journal.length} journal entries, ${Object.keys(s.read).length} lessons`;
  page.appendChild(h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Your data'),
    h('p', { class: 'small' }, `Stored: ${stats}. Schema version ${s.schema}.`),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn ghost', type: 'button', id: 'export-progress', onclick: () => downloadFile(`elo-blueprint-progress-${store.today()}.json`, store.exportJSON()) }, 'Export progress (JSON)'),
      h('label', { class: 'btn ghost', for: 'import-file', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } } }, 'Import progress…'), file,
      h('button', { class: 'btn danger', type: 'button', id: 'reset-progress', onclick: async () => {
        if (!(await confirmDialog('Reset all progress?', 'This deletes every exercise result, game, journal entry and setting on this device. Export first if you may want it back.', 'Delete everything', true))) return;
        store.reset();
        toast('All progress deleted.');
        rerender();
      } }, 'Reset…')),
    h('p', { class: 'small muted' }, 'Browsers may clear site data if storage runs low or you clear your history. Export regularly — especially on iPhone, where unused web apps can be cleared after some weeks.')));
  main.appendChild(page);
}

export function renderAbout(main) {
  const b = data.build;
  main.appendChild(h('div', { class: 'page narrow prose' }, pageHead('About & licences'),
    h('p', null, `${data.book.meta.title} Interactive — build ${b.version}${b.built ? ' (' + b.built + ')' : ''}. Book data version ${data.book.meta.version || ''}.`),
    h('p', null, 'A companion to the book: learn, solve, play, analyse, fix, repeat. It runs entirely on your device, makes no network requests and needs no account.'),
    h('h2', null, 'Stockfish'),
    h('p', null, 'The engine is Stockfish 18 (stockfish.js lite single-threaded WebAssembly build by Nathan Rugg / Chess.com), based on Stockfish by the Stockfish developers. Stockfish is free software released under the GNU General Public License version 3. You may redistribute and modify it under that licence. The full licence text is included with this app (vendor/stockfish/Copying.txt). Corresponding source code: https://github.com/official-stockfish/Stockfish and https://github.com/nmrugg/stockfish.js (release v18.0.0).'),
    h('p', null, h('a', { href: 'vendor/stockfish/Copying.txt' }, 'Read the GPL v3 licence text')),
    h('h2', null, 'chess.js'),
    h('p', null, 'Move generation and PGN parsing by chess.js 1.4.0, © Jeff Hlywa, BSD 2-Clause licence. ', h('a', { href: 'vendor/chess.js-LICENSE.txt' }, 'Licence text')),
    h('h2', null, 'Fonts'),
    h('p', null, 'Source Serif 4, Cormorant Garamond and Inter, under the SIL Open Font Licence 1.1. ',
      h('a', { href: 'fonts/LICENSE-source-serif-4.txt' }, 'Source Serif 4'), ' · ', h('a', { href: 'fonts/LICENSE-cormorant-garamond.txt' }, 'Cormorant Garamond'), ' · ', h('a', { href: 'fonts/LICENSE-inter.txt' }, 'Inter')),
    h('h2', null, 'Pieces'),
    h('p', null, 'Piece artwork derived from the chess glyphs of DejaVu Sans (Bitstream Vera / DejaVu licence: free to modify and redistribute).'),
    h('h2', null, 'Honesty notes'),
    h('p', null, 'Engine levels describe playing behaviour, not ratings. Puzzle accuracy, engine accuracy and chapter mastery are training measures and are never converted into an Elo number.')));
}
