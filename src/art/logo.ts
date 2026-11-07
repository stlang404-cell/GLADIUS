import { WORDMARK, TAGLINE } from './logoWordmark';

/**
 * Official GLADIUS identity (original): a Roman gladius on a crimson roundel,
 * framed by a gold laurel wreath; Cinzel wordmark converted to outlines.
 * Palette: ivory #FAF8F3, gold #C59A42, crimson #A92D3A, charcoal #242424.
 */
export const BRAND = { ivory: '#FAF8F3', gold: '#C59A42', goldLight: '#E6C878', goldDeep: '#8E6A22', crimson: '#A92D3A', crimsonDeep: '#7A1E28', charcoal: '#242424', blue: '#527EAA' };

function leaf(cx: number, cy: number, ang: number, len: number, wid: number, fill: string): string {
  const r = (ang * Math.PI) / 180;
  const dx = Math.cos(r), dy = Math.sin(r);
  const tx = cx + dx * len, ty = cy + dy * len;
  const nx = -dy * wid, ny = dx * wid;
  const mx = cx + dx * len * 0.5, my = cy + dy * len * 0.5;
  return `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)} Q${(mx + nx).toFixed(1)} ${(my + ny).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)} Q${(mx - nx).toFixed(1)} ${(my - ny).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}Z" fill="${fill}"/>`;
}

/** Laurel wreath: two branches rising from the bottom, around (100,100). */
function laurel(id: string, R: number, leaves: number, size: number): string {
  let out = '';
  for (const side of [-1, 1]) {
    // stem
    const a0 = 100, a1 = 300; // degrees along circle from bottom (90°) up the side
    void a0; void a1;
    let stem = '';
    for (let i = 0; i <= leaves; i++) {
      const t = i / leaves;
      const ang = (90 + side * (25 + t * 125)) * (Math.PI / 180);
      const x = 100 + Math.cos(ang) * R, y = 100 + Math.sin(ang) * R;
      stem += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
      if (i < leaves) {
        const tangent = (ang * 180) / Math.PI + side * 90 - side * 28;
        const s = size * (1 - t * 0.35);
        out += leaf(x, y, tangent + side * 34, s, s * 0.42, `url(#${id}g)`);
        out += leaf(x, y, tangent - side * 26, s * 0.92, s * 0.4, `url(#${id}g)`);
      }
    }
    out += `<path d="${stem}" fill="none" stroke="${BRAND.goldDeep}" stroke-width="${(size * 0.12).toFixed(1)}" stroke-linecap="round"/>`;
  }
  return out;
}

function sword(id: string): string {
  return `
  <path d="M100 22 L111 44 L110.5 121 L89.5 121 L89 44 Z" fill="url(#${id}b)" stroke="${BRAND.charcoal}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M100 30 L100 118" stroke="#9aa2ad" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M100 30 L103 44 L103 118" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="1.6"/>
  <rect x="76" y="119" width="48" height="11" rx="5.5" fill="url(#${id}g)" stroke="${BRAND.charcoal}" stroke-width="2.4"/>
  <rect x="92.5" y="129" width="15" height="30" rx="3" fill="${BRAND.crimson}" stroke="${BRAND.charcoal}" stroke-width="2.4"/>
  <path d="M93 136h14M93 143h14M93 150h14" stroke="${BRAND.crimsonDeep}" stroke-width="2"/>
  <ellipse cx="100" cy="165" rx="14" ry="9.5" fill="url(#${id}g)" stroke="${BRAND.charcoal}" stroke-width="2.4"/>
  <circle cx="96" cy="162.5" r="3" fill="#fff6d8" opacity=".8"/>`;
}

function defs(id: string): string {
  return `<defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BRAND.goldLight}"/><stop offset=".55" stop-color="${BRAND.gold}"/><stop offset="1" stop-color="${BRAND.goldDeep}"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfd5dc"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#aab1ba"/></linearGradient>
    <radialGradient id="${id}r" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#c8414e"/><stop offset=".7" stop-color="${BRAND.crimson}"/><stop offset="1" stop-color="${BRAND.crimsonDeep}"/></radialGradient>
  </defs>`;
}

/** Compact crest: crimson roundel, gold rim, laurel, gladius. viewBox 0 0 200 200. */
export function crestSvg(opts: { id?: string; size?: number } = {}): string {
  const id = opts.id ?? 'gl';
  const size = opts.size;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"${size ? ` width="${size}" height="${size}"` : ''}>${defs(id)}
  <circle cx="100" cy="100" r="95" fill="url(#${id}g)"/>
  <circle cx="100" cy="100" r="88" fill="url(#${id}r)"/>
  <circle cx="100" cy="100" r="81" fill="none" stroke="${BRAND.goldLight}" stroke-opacity=".7" stroke-width="1.6"/>
  ${laurel(id, 67, 9, 21)}
  <path d="M84 186 L100 176 L116 186" fill="none" stroke="${BRAND.ivory}" stroke-width="0"/>
  ${sword(id)}
</svg>`;
}

/** Square application icon (full-bleed, no transparency) — iOS/PWA/Windows. */
export function appIconSvg(opts: { maskable?: boolean } = {}): string {
  const id = 'ai';
  const scale = opts.maskable ? 0.62 : 0.8;
  const off = (1 - scale) * 512 / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><radialGradient id="aibg" cx=".5" cy=".38" r=".8"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="${BRAND.ivory}"/><stop offset="1" stop-color="#EDE6D6"/></radialGradient></defs>
  <rect width="512" height="512" fill="url(#aibg)"/>
  <g transform="translate(${off} ${off}) scale(${(scale * 512) / 200})">${crestSvg({ id }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>
</svg>`;
}

/** Favicon: simplified for 16–32 px (no laurel detail). */
export function faviconSvg(): string {
  const id = 'fv';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${defs(id)}
  <circle cx="100" cy="100" r="96" fill="url(#${id}g)"/>
  <circle cx="100" cy="100" r="84" fill="url(#${id}r)"/>
  <g transform="translate(100 100) scale(1.12) translate(-100 -96)">${sword(id).replace(/stroke-width="2.4"/g, 'stroke-width="3.4"')}</g>
</svg>`;
}

/** Horizontal logo: crest + wordmark (+ optional tagline). */
export function horizontalLogoSvg(opts: { tagline?: boolean; dark?: boolean } = {}): string {
  const id = 'hl';
  const ink = opts.dark ? BRAND.ivory : BRAND.charcoal;
  const crestH = 150;
  const wmX = crestH + 34;
  const wmY = opts.tagline ? 22 : 34;
  const w = Math.ceil(wmX + WORDMARK.width + 10);
  const h = 170;
  const tagScale = WORDMARK.width / TAGLINE.width;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${defs(id)}
  <g transform="translate(6 10) scale(${crestH / 200})">${crestSvg({ id: id + 'c' }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>
  <g transform="translate(${wmX} ${wmY})">
    <path d="${WORDMARK.d}" fill="${ink}"/>
    <path d="M0 ${110} H${WORDMARK.width.toFixed(0)}" stroke="url(#${id}g)" stroke-width="3"/>
    ${opts.tagline ? `<g transform="translate(0 118) scale(${tagScale.toFixed(4)})"><path d="${TAGLINE.d}" fill="${BRAND.crimson}"/></g>` : ''}
  </g>
</svg>`;
}

/** Stacked logo for splash screens. */
export function stackedLogoSvg(): string {
  const id = 'sl';
  const w = Math.ceil(WORDMARK.width + 40);
  const tagScale = WORDMARK.width / TAGLINE.width;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 400">${defs(id)}
  <g transform="translate(${(w - 220) / 2} 0) scale(1.1)">${crestSvg({ id: id + 'c' }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>
  <g transform="translate(20 236)"><path d="${WORDMARK.d}" fill="${BRAND.charcoal}"/>
  <path d="M0 112 H${WORDMARK.width.toFixed(0)}" stroke="url(#${id}g)" stroke-width="3"/>
  <g transform="translate(0 122) scale(${tagScale.toFixed(4)})"><path d="${TAGLINE.d}" fill="${BRAND.crimson}"/></g></g>
</svg>`;
}
