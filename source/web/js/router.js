// Minimal hash router: '#/path/:param?query'. Views return an optional cleanup function.

const routes = [];
let cleanup = null;
let current = null;
let beforeEach = null;

export function route(pattern, view, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  routes.push({ pattern, re, keys, view, opts });
}

export function parse(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path: path || '/', query };
}

export function go(path) { if (location.hash !== '#' + path) location.hash = path; else render(); }

export function onBefore(fn) { beforeEach = fn; }
export function currentRoute() { return current; }

export async function render() {
  const { path, query } = parse();
  const main = document.getElementById('main');
  let match = null;
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      match = { r, params };
      break;
    }
  }
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.warn(e); } }
  cleanup = null;
  main.innerHTML = '';
  main.className = '';
  if (!match) {
    main.innerHTML = '<div class="page"><h1>Not found</h1><p>This page does not exist. <a href="#/">Go to the dashboard</a>.</p></div>';
    return;
  }
  current = { path, query, params: match.params, pattern: match.r.pattern, opts: match.r.opts };
  if (beforeEach) beforeEach(current);
  try {
    cleanup = await match.r.view(main, match.params, query);
  } catch (e) {
    console.error(e);
    main.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'page';
    p.innerHTML = '<h1>Something went wrong</h1><p>This screen could not be shown. Your progress is safe.</p>';
    const pre = document.createElement('pre');
    pre.textContent = String(e && e.message || e);
    p.appendChild(pre);
    main.appendChild(p);
  }
  if (!query.keep) {
    window.scrollTo(0, 0);
  }
  if (query.focus !== 'none') main.focus({ preventScroll: true });
}

export function start() {
  window.addEventListener('hashchange', render);
  render();
}
