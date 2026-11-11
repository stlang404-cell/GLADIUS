// Element.append that ignores null/undefined/false children (lets views write `cond ? el : null`).
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  const orig = proto.append;
  proto.append = function (...kids) { return orig.apply(this, kids.flat().filter((k) => k !== null && k !== undefined && k !== false)); };
}

// Small DOM helpers shared by every view.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

let toastTimer = null;
export function toast(msg, opts = {}) {
  const t = document.getElementById('toast');
  clear(t);
  t.appendChild(h('span', null, msg));
  if (opts.action) {
    t.appendChild(h('button', { class: 'btn small light', onclick: () => { opts.action.fn(); hide(); } }, opts.action.label));
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  const hide = () => t.classList.remove('show');
  if (!opts.sticky) toastTimer = setTimeout(hide, opts.ms || 3200);
}

// Accessible modal dialog. Returns {el, body, close}.
export function modal(title, opts = {}) {
  const prev = document.activeElement;
  const back = h('div', { class: 'modal-back', role: 'presentation' });
  const titleId = 'm' + Math.random().toString(36).slice(2, 8);
  const body = h('div', { class: 'modal-body' });
  const closeBtn = h('button', { class: 'icon-btn modal-x', 'aria-label': 'Close', type: 'button' }, '×');
  const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div', { class: 'modal-head' }, h('h2', { id: titleId }, title), closeBtn), body);
  back.appendChild(box);
  document.body.appendChild(back);
  document.body.classList.add('modal-open');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    if (!document.querySelector('.modal-back')) document.body.classList.remove('modal-open');
    if (opts.onClose) opts.onClose();
    if (prev && prev.focus) prev.focus();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const f = [...box.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  closeBtn.addEventListener('click', close);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  setTimeout(() => closeBtn.focus(), 0);
  return { el: box, body, close };
}

export function confirmDialog(title, text, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    let result = false;
    const m = modal(title, { onClose: () => resolve(result) });
    m.body.appendChild(h('p', null, text));
    m.body.appendChild(h('div', { class: 'row end' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', 'data-ok': '1', onclick: () => { result = true; m.close(); } }, okLabel)));
  });
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function pct(x) { return x === null || x === undefined || isNaN(x) ? '—' : Math.round(x * 100) + '%'; }

export function downloadFile(name, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function section(title, ...kids) {
  return h('section', { class: 'card' }, title ? h('h2', { class: 'card-title' }, title) : null, ...kids);
}

export function pageHead(title, sub, ...extra) {
  return h('header', { class: 'page-head' }, h('h1', null, title), sub ? h('p', { class: 'page-sub' }, sub) : null, ...extra);
}

export function link(href, text, cls) { return h('a', { href, class: cls }, text); }

export function stripHtml(s) { const d = document.createElement('div'); d.innerHTML = s || ''; return d.textContent || ''; }
