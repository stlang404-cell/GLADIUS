// SVG chessboard: static diagrams and interactive play (tap-tap + drag via pointer events),
// legal-move dots, last-move / check highlights, coordinates, arrows, promotion picker, animation.
// The board is rules-agnostic: callers supply `dests(square)` and receive `onMove(from, to)`.

const NS = 'http://www.w3.org/2000/svg';
const FILES = 'abcdefgh';
const LIGHT = '#F3EBDC', DARK = '#C2A57D', INK = '#262421', IVORY = '#FBF8F1', GOLD = '#C9A227';
export const ARROW_COLORS = { green: '#2F7D4F', red: '#B23A2E', blue: '#2E5E8C', gold: '#C9A227' };
const NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

function svg(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

let spriteReady = false;
function ensureSprite() {
  if (spriteReady) return;
  spriteReady = true;
  const P = window.ELO_PIECES || {};
  const s = svg('svg', { width: '0', height: '0', 'aria-hidden': 'true', style: 'position:absolute;width:0;height:0;overflow:hidden' });
  const defs = svg('defs');
  for (const t of Object.keys(P)) {
    const v = P[t];
    for (const c of ['w', 'b']) {
      const sym = svg('symbol', { id: `pc-${c}${t}`, viewBox: '0 0 100 100' });
      sym.appendChild(svg('path', { d: v.outer, fill: IVORY, stroke: INK, 'stroke-width': '3', 'stroke-linejoin': 'round' }));
      if (c === 'w') sym.appendChild(svg('path', { d: `${v.outer} ${v.all}`, fill: INK, 'fill-rule': 'evenodd' }));
      else sym.appendChild(svg('path', { d: v.all, fill: INK }));
      defs.appendChild(sym);
    }
  }
  s.appendChild(defs);
  document.body.appendChild(s);
}

export function parseFenBoard(fen) {
  const map = {};
  const rows = fen.split(' ')[0].split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r] || '') {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        map[FILES[f] + (8 - r)] = color + ch.toUpperCase();
        f += 1;
      }
    }
  }
  return map;
}

export function describe(fen) {
  const map = parseFenBoard(fen);
  const turn = (fen.split(' ')[1] || 'w') === 'w' ? 'White' : 'Black';
  const order = 'KQRBNP';
  const list = (c) => Object.entries(map).filter(([, p]) => p[0] === c)
    .sort((a, b) => order.indexOf(a[1][1]) - order.indexOf(b[1][1]))
    .map(([sq, p]) => (p[1] === 'P' ? '' : p[1]) + sq).join(', ');
  return `${turn} to move. White: ${list('w') || 'none'}. Black: ${list('b') || 'none'}.`;
}

export class Board {
  constructor(el, opts = {}) {
    ensureSprite();
    this.el = el;
    this.opts = Object.assign({ orientation: 'white', interactive: false, coords: true, animate: true, label: '' }, opts);
    this.orientation = this.opts.orientation;
    this.fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    this.map = {};
    this.lastMove = null;
    this.check = null;
    this.selected = null;
    this.shapes = { arrows: [], squares: [] };
    this.el.classList.add('board');
    if (this.opts.interactive) this.el.classList.add('interactive');
    this.root = svg('svg', { viewBox: '0 0 800 800', class: 'board-svg', role: 'img', focusable: 'false' });
    this.gSquares = svg('g');
    this.gHl = svg('g');
    this.gCoords = svg('g', { class: 'coords', 'aria-hidden': 'true' });
    this.gPieces = svg('g', { class: 'pieces' });
    this.gDots = svg('g', { class: 'dots' });
    this.gArrows = svg('g', { class: 'arrows' });
    this.gDrag = svg('g', { class: 'drag' });
    this.root.append(this.gSquares, this.gHl, this.gCoords, this.gPieces, this.gDots, this.gArrows, this.gDrag);
    this.el.appendChild(this.root);
    this.drawSquares();
    if (this.opts.interactive) this.bindPointer();
    if (opts.fen) this.setPosition(opts.fen, { animate: false });
  }

  xy(sq) {
    let f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1;
    if (this.orientation === 'black') { f = 7 - f; r = 7 - r; }
    return [f * 100, (7 - r) * 100];
  }

  squareAtPoint(clientX, clientY) {
    const rect = this.root.getBoundingClientRect();
    let f = Math.floor(((clientX - rect.left) / rect.width) * 8);
    let r = 7 - Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (f < 0 || f > 7 || r < 0 || r > 7) return null;
    if (this.orientation === 'black') { f = 7 - f; r = 7 - r; }
    return FILES[f] + (r + 1);
  }

  drawSquares() {
    this.gSquares.innerHTML = '';
    this.gCoords.innerHTML = '';
    for (let r = 1; r <= 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = FILES[f] + r;
        const [x, y] = this.xy(sq);
        const light = (f + r) % 2 === 0;
        this.gSquares.appendChild(svg('rect', { x, y, width: 100, height: 100, fill: light ? LIGHT : DARK, 'data-sq': sq }));
      }
    }
    if (this.opts.coords) {
      const bottomRank = this.orientation === 'white' ? 1 : 8;
      const leftFile = this.orientation === 'white' ? 'a' : 'h';
      for (let i = 0; i < 8; i++) {
        const fsq = FILES[i] + bottomRank;
        const [fx, fy] = this.xy(fsq);
        const flight = (i + bottomRank) % 2 === 0;
        const t = svg('text', { x: fx + 93, y: fy + 93, 'text-anchor': 'end', class: 'coord', fill: flight ? '#8A6F48' : '#F6EFE2' });
        t.textContent = FILES[i];
        this.gCoords.appendChild(t);
        const rsq = leftFile + (i + 1);
        const [rx, ry] = this.xy(rsq);
        const rlight = (FILES.indexOf(leftFile) + i + 1) % 2 === 0;
        const u = svg('text', { x: rx + 7, y: ry + 24, class: 'coord', fill: rlight ? '#8A6F48' : '#F6EFE2' });
        u.textContent = String(i + 1);
        this.gCoords.appendChild(u);
      }
    }
  }

  setOrientation(o) {
    if (o === this.orientation) return;
    this.orientation = o;
    this.drawSquares();
    this.renderAll(false);
  }

  flip() { this.setOrientation(this.orientation === 'white' ? 'black' : 'white'); }

  // Update the position. opts: {lastMove:[from,to], check:sq, animate:bool}
  setPosition(fen, opts = {}) {
    const prev = this.map;
    this.fen = fen;
    this.map = parseFenBoard(fen);
    this.lastMove = opts.lastMove !== undefined ? opts.lastMove : this.lastMove;
    this.check = opts.check !== undefined ? opts.check : null;
    this.selected = null;
    const anim = opts.animate !== false && this.opts.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderAll(anim ? prev : null);
    const label = (this.opts.label ? this.opts.label + '. ' : '') + describe(fen);
    this.root.setAttribute('aria-label', label);
  }

  setShapes(shapes) { this.shapes = Object.assign({ arrows: [], squares: [] }, shapes); this.renderArrows(); this.renderHl(); }

  renderAll(prevMap) {
    this.renderHl();
    this.renderPieces(prevMap);
    this.renderDots();
    this.renderArrows();
  }

  renderHl() {
    const g = this.gHl;
    g.innerHTML = '';
    if (this.lastMove) {
      for (const sq of this.lastMove) {
        if (!sq) continue;
        const [x, y] = this.xy(sq);
        g.appendChild(svg('rect', { x, y, width: 100, height: 100, fill: '#E8C766', opacity: '0.5' }));
      }
    }
    if (this.selected) {
      const [x, y] = this.xy(this.selected);
      g.appendChild(svg('rect', { x, y, width: 100, height: 100, fill: GOLD, opacity: '0.55', class: 'sel' }));
    }
    for (const s of this.shapes.squares || []) {
      const sq = typeof s === 'string' ? s : s.sq;
      if (!/^[a-h][1-8]$/.test(sq)) continue;
      const [x, y] = this.xy(sq);
      const color = (typeof s === 'object' && s.color) ? (ARROW_COLORS[s.color] || s.color) : GOLD;
      g.appendChild(svg('rect', { x: x + 4, y: y + 4, width: 92, height: 92, fill: 'none', stroke: color, 'stroke-width': 8, rx: 4 }));
    }
    if (this.check) {
      const [x, y] = this.xy(this.check);
      const grad = svg('circle', { cx: x + 50, cy: y + 50, r: 47, fill: '#C0392B', opacity: '0.38', class: 'check' });
      g.appendChild(grad);
    }
  }

  renderPieces(prevMap) {
    const g = this.gPieces;
    g.innerHTML = '';
    this.gDrag.innerHTML = '';
    const els = {};
    for (const [sq, p] of Object.entries(this.map)) {
      const [x, y] = this.xy(sq);
      const u = svg('use', { href: `#pc-${p}`, width: 88, height: 88, 'data-piece': p, 'data-at': sq });
      u.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#pc-${p}`);
      u.style.transform = `translate(${x + 6}px, ${y + 6}px)`;
      g.appendChild(u);
      els[sq] = u;
    }
    if (!prevMap) return;
    // animate pieces that moved: match vanished squares to newly occupied squares with the same piece
    const removed = Object.keys(prevMap).filter((sq) => prevMap[sq] !== this.map[sq]);
    const added = Object.keys(this.map).filter((sq) => prevMap[sq] !== this.map[sq]);
    if (added.length > 4 || removed.length > 4) return;
    const used = new Set();
    for (const to of added) {
      const p = this.map[to];
      let best = null, bd = 99;
      for (const from of removed) {
        if (used.has(from) || prevMap[from] !== p) continue;
        const d = Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0])) + Math.abs(from[1] - to[1]);
        if (d < bd) { bd = d; best = from; }
      }
      if (!best) continue;
      used.add(best);
      const [fx, fy] = this.xy(best);
      const [tx, ty] = this.xy(to);
      const el = els[to];
      if (el.animate) {
        el.animate([{ transform: `translate(${fx + 6}px, ${fy + 6}px)` }, { transform: `translate(${tx + 6}px, ${ty + 6}px)` }],
          { duration: 190, easing: 'cubic-bezier(.25,.8,.35,1)' });
      }
    }
  }

  renderDots() {
    const g = this.gDots;
    g.innerHTML = '';
    if (!this.selected || !this.opts.dests) return;
    for (const to of this.opts.dests(this.selected) || []) {
      const [x, y] = this.xy(to);
      if (this.map[to]) {
        g.appendChild(svg('circle', { cx: x + 50, cy: y + 50, r: 44, fill: 'none', stroke: 'rgba(30,28,26,.32)', 'stroke-width': 8, 'data-dot': to }));
      } else {
        g.appendChild(svg('circle', { cx: x + 50, cy: y + 50, r: 15, fill: 'rgba(30,28,26,.30)', 'data-dot': to }));
      }
    }
  }

  renderArrows() {
    const g = this.gArrows;
    g.innerHTML = '';
    for (const a of this.shapes.arrows || []) {
      const from = a.from || a.slice(0, 2), to = a.to || a.slice(2, 4);
      if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to) || from === to) continue;
      const color = ARROW_COLORS[a.color || 'green'] || a.color;
      const [x1, y1] = this.xy(from).map((v) => v + 50);
      const [x2, y2] = this.xy(to).map((v) => v + 50);
      const df = Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0]));
      const dr = Math.abs(from[1] - to[1]);
      g.appendChild(arrowPath(x1, y1, x2, y2, color, (df === 1 && dr === 2) || (df === 2 && dr === 1)));
    }
  }

  select(sq) {
    this.selected = sq;
    this.renderHl();
    this.renderDots();
  }

  // --------------------------------------------------------------- interaction
  bindPointer() {
    const root = this.root;
    root.style.touchAction = 'none';
    let drag = null;
    const toSvg = (e) => {
      const rect = root.getBoundingClientRect();
      return [((e.clientX - rect.left) / rect.width) * 800, ((e.clientY - rect.top) / rect.height) * 800];
    };
    root.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (this.opts.locked && this.opts.locked()) return;
      const sq = this.squareAtPoint(e.clientX, e.clientY);
      if (!sq) return;
      e.preventDefault();
      const dests = this.selected && this.opts.dests ? this.opts.dests(this.selected) || [] : [];
      if (this.selected && dests.includes(sq)) {
        const from = this.selected;
        this.select(null);
        this.userMove(from, sq);
        return;
      }
      const myDests = this.opts.dests ? this.opts.dests(sq) || [] : [];
      if (this.map[sq] && myDests.length) {
        const wasSelected = this.selected === sq;
        this.select(sq);
        const el = this.gPieces.querySelector(`[data-at="${sq}"]`);
        drag = { from: sq, el, startX: e.clientX, startY: e.clientY, moved: false, wasSelected, id: e.pointerId };
        try { root.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      } else {
        this.select(null);
      }
    });
    root.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (!drag.moved && dist < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        if (drag.el) { this.gDrag.appendChild(drag.el); drag.el.classList.add('dragging'); }
      }
      const [x, y] = toSvg(e);
      if (drag.el) drag.el.style.transform = `translate(${x - 50}px, ${y - 62}px) scale(1.12)`;
      const over = this.squareAtPoint(e.clientX, e.clientY);
      this.hover(over);
    });
    const end = (e, cancel) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      this.hover(null);
      try { root.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      if (!d.moved) {
        if (d.wasSelected) this.select(null);
        return;
      }
      const to = cancel ? null : this.squareAtPoint(e.clientX, e.clientY);
      const dests = this.opts.dests ? this.opts.dests(d.from) || [] : [];
      if (to && to !== d.from && dests.includes(to)) {
        this.select(null);
        this.renderPieces(null);
        this.userMove(d.from, to, true);
      } else {
        this.renderPieces(null);
        if (to !== d.from) this.select(null);
        else this.select(d.from);
      }
    };
    root.addEventListener('pointerup', (e) => end(e, false));
    root.addEventListener('pointercancel', (e) => end(e, true));
  }

  hover(sq) {
    let r = this.gHl.querySelector('.hover');
    if (!sq) { if (r) r.remove(); return; }
    const [x, y] = this.xy(sq);
    if (!r) { r = svg('rect', { class: 'hover', width: 100, height: 100, fill: 'none', stroke: 'rgba(30,28,26,.45)', 'stroke-width': 6 }); this.gHl.appendChild(r); }
    r.setAttribute('x', x); r.setAttribute('y', y);
  }

  userMove(from, to, dropped = false) {
    if (this.opts.onMove) this.opts.onMove(from, to, { dropped });
  }

  // Promotion picker overlay; resolves to 'q','r','b','n' or null (cancelled).
  askPromotion(color) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'promo';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-label', 'Choose promotion piece');
      const inner = document.createElement('div');
      inner.className = 'promo-inner';
      for (const p of ['q', 'r', 'b', 'n']) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'promo-btn';
        b.dataset.promo = p;
        b.setAttribute('aria-label', 'Promote to ' + NAMES[p]);
        b.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#pc-${color}${p.toUpperCase()}"/></svg>`;
        b.addEventListener('click', (e) => { e.stopPropagation(); wrap.remove(); resolve(p); });
        inner.appendChild(b);
      }
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'promo-cancel';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => { wrap.remove(); resolve(null); });
      inner.appendChild(cancel);
      wrap.appendChild(inner);
      this.el.appendChild(wrap);
      setTimeout(() => inner.querySelector('button').focus(), 0);
    });
  }

  destroy() { this.el.innerHTML = ''; }
}

function arrowPath(x1, y1, x2, y2, color, knight) {
  const g = svg('g', { opacity: '0.82' });
  const width = 13, head = 34;
  if (knight) {
    let mx, my;
    if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) { mx = x2; my = y1; } else { mx = x1; my = y2; }
    g.appendChild(svg('path', { d: `M${x1},${y1} L${mx},${my}`, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', fill: 'none' }));
    x1 = mx; y1 = my;
  }
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const ex = x2 - Math.cos(ang) * head * 0.9, ey = y2 - Math.sin(ang) * head * 0.9;
  g.appendChild(svg('path', { d: `M${x1},${y1} L${ex},${ey}`, stroke: color, 'stroke-width': width, 'stroke-linecap': knight ? 'butt' : 'round', fill: 'none' }));
  const hx = x2 - Math.cos(ang) * 6, hy = y2 - Math.sin(ang) * 6;
  const bx = hx - Math.cos(ang) * head, by = hy - Math.sin(ang) * head;
  const px = -Math.sin(ang) * head * 0.62, py = Math.cos(ang) * head * 0.62;
  g.appendChild(svg('path', { d: `M${hx},${hy} L${bx + px},${by + py} L${bx - px},${by - py} Z`, fill: color }));
  return g;
}

// Static diagram from a <figure class="diagram" data-fen ...> placeholder.
export function renderDiagram(fig) {
  const wrap = fig.querySelector('.board-wrap') || fig;
  if (wrap.dataset.done) return null;
  wrap.dataset.done = '1';
  const sp = (k) => (fig.dataset[k] || '').split(/[\s,]+/).filter(Boolean);
  const host = document.createElement('div');
  wrap.appendChild(host);
  const b = new Board(host, { orientation: fig.dataset.orientation || 'white', interactive: false, label: 'Diagram' });
  const lm = fig.dataset.lastmove;
  b.setPosition(fig.dataset.fen, { animate: false, lastMove: lm ? [lm.slice(0, 2), lm.slice(2, 4)] : null });
  b.setShapes({
    arrows: [...sp('arrows').map((a) => ({ from: a.slice(0, 2), to: a.slice(2, 4), color: 'green' })),
      ...sp('red').map((a) => ({ from: a.slice(0, 2), to: a.slice(2, 4), color: 'red' })),
      ...sp('blue').map((a) => ({ from: a.slice(0, 2), to: a.slice(2, 4), color: 'blue' }))],
    squares: sp('squares'),
  });
  // the wrapper already carries role=img + aria-label from the book; hide the inner svg from AT
  if (wrap.getAttribute('aria-label')) b.root.setAttribute('aria-hidden', 'true');
  return b;
}
