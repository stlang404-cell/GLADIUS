// App bootstrap: navigation shell, routes, service worker + update prompt.
import * as router from './router.js';
import * as store from './store.js';
import { h, toast } from './ui.js';
import { renderDashboard, renderProgress } from './dashboard.js';
import { renderToc, renderChapter, renderDoc } from './reader.js';
import { renderSolveHome, renderSet, renderReview, renderTest, renderSingle, renderMixed, renderPersonal } from './solve.js';
import { renderPlay } from './play.js';
import { renderGames, renderGame, renderImport } from './games.js';
import { renderAnalysisBoard } from './analysis.js';
import { renderJournal } from './journal.js';
import { renderPlan } from './plan.js';
import { renderSettings, renderMore, renderAbout } from './settings.js';

store.load();

const ICONS = {
  home: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  read: '<path d="M4 5.5C6.5 4.5 9.5 4.6 12 6.4c2.5-1.8 5.5-1.9 8-.9V19c-2.5-1-5.5-.9-8 .9-2.5-1.8-5.5-1.9-8-.9zM12 6.4V19.9"/>',
  solve: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zm0 4.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 3.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z"/>',
  play: '<path d="M9 20h7M9.6 17.5h5.8l-.9-5.2 1.6-1.4-1.2-4.1-3.1-1.6-3.4 2.5.9 1.4 2-.6-2.3 3.8z"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.2"/>',
  games: '<path d="M5 4h14v16H5zM8.5 8h7M8.5 12h7M8.5 16h4"/>',
  journal: '<path d="M6 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6zM6 3.5v17M9.5 8h5M9.5 11.5h5"/>',
  plan: '<path d="M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4M8 13.5h2M11 13.5h2M14 13.5h2M8 16.5h2M11 16.5h2"/>',
  progress: '<path d="M4 19.5h16M6.5 16V11M11 16V7M15.5 16v-5.5M20 16V5"/>',
  board: '<path d="M4 4h16v16H4zM4 12h16M12 4v16M4 8h4v8H4M8 4h4v4M12 16h4v4M16 8h4v4"/>',
  settings: '<path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.3 3h-4l-.3 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.3 2.5h4l.3-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
};
export const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="ico"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ''}</g></svg>`;

const NAV = [
  { href: '#/', key: 'home', label: 'Home', match: /^\/$|^\/progress/ },
  { href: '#/read', key: 'read', label: 'Read', match: /^\/read/ },
  { href: '#/solve', key: 'solve', label: 'Solve', match: /^\/solve/ },
  { href: '#/play', key: 'play', label: 'Play', match: /^\/play/ },
  { href: '#/games', key: 'games', label: 'Games', match: /^\/games|^\/analysis/, side: true },
  { href: '#/journal', key: 'journal', label: 'Journal', match: /^\/journal/, side: true },
  { href: '#/plan', key: 'plan', label: '90-day plan', match: /^\/plan/, side: true },
  { href: '#/progress', key: 'progress', label: 'Progress', match: /^\/progress/, side: true },
  { href: '#/settings', key: 'settings', label: 'Settings & data', match: /^\/settings|^\/about/, side: true },
  { href: '#/more', key: 'more', label: 'More', match: /^\/more|^\/games|^\/analysis|^\/journal|^\/plan|^\/settings|^\/about|^\/progress/, tab: true },
];

function buildNav() {
  const side = document.getElementById('nav-side');
  const tabs = document.getElementById('nav-tabs');
  for (const n of NAV) {
    if (!n.tab) side.appendChild(h('li', null, h('a', { href: n.href, 'data-nav': n.key, html: icon(n.key) + `<span>${n.label}</span>` })));
    if (!n.side) tabs.appendChild(h('li', null, h('a', { href: n.href, 'data-nav': n.key, html: icon(n.key) + `<span>${n.label}</span>` })));
  }
}

function markNav(cur) {
  for (const a of document.querySelectorAll('[data-nav]')) {
    const n = NAV.find((x) => x.key === a.dataset.nav);
    let on = n.match.test(cur.path);
    if (a.closest('#nav-tabs') && n.key === 'home' && /^\/progress/.test(cur.path)) on = false;
    if (a.closest('#nav-side') && n.key === 'home' && /^\/progress/.test(cur.path)) on = false;
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  document.body.dataset.route = cur.path.split('/')[1] || 'home';
}

router.route('/', renderDashboard);
router.route('/progress', renderProgress);
router.route('/read', renderToc);
router.route('/read/ch/:n', renderChapter);
router.route('/read/doc/:slug', renderDoc);
router.route('/solve', renderSolveHome);
router.route('/solve/set/:key', renderSet);
router.route('/solve/review', renderReview);
router.route('/solve/mixed', renderMixed);
router.route('/solve/personal', renderPersonal);
router.route('/solve/test/:key', renderTest);
router.route('/solve/ex/:id', renderSingle);
router.route('/play', renderPlay);
router.route('/games', renderGames);
router.route('/games/import', renderImport);
router.route('/games/:id', renderGame);
router.route('/analysis', renderAnalysisBoard);
router.route('/journal', renderJournal);
router.route('/plan', renderPlan);
router.route('/settings', renderSettings);
router.route('/about', renderAbout);
router.route('/more', renderMore);
router.onBefore(markNav);

buildNav();
router.start();

// ---------------------------------------------------------------- service worker
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const prompt = (w) => toast('A new version of the trainer is ready.', { sticky: true, action: { label: 'Reload', fn: () => w.postMessage('SKIP_WAITING') } });
      if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w);
        });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch((e) => console.warn('service worker registration failed', e));
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !window.__eloHadController) return;
      reloading = true;
      location.reload();
    });
    window.__eloHadController = !!navigator.serviceWorker.controller;
  });
}
