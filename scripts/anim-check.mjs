// Browser animation checks for the 2D board (Playwright + Chromium).
//
//   npm run test:anim                    board lab (dev server) + real GameScreen (production build)
//   node scripts/anim-check.mjs lab      board lab only
//   node scripts/anim-check.mjs prod     production GameScreen only (builds to $ANIM_DIST, serves on :4175)
//   ANIM_URL=http://localhost:4175 node scripts/anim-check.mjs prod   use an already running preview
//   ANIM_VIDEO=<dir>                     also record short videos (AI move, capture) into <dir>
//
// Every scenario samples frames (requestAnimationFrame) before / during / after
// the move and asserts: the board converges to the FEN (sprite squares and
// piece types, no duplicates, no lingering captured pieces or effects), the
// glide is monotone with no teleports, the duration sits inside the preset's
// bounds, and opponent / engine moves are pre-highlighted while the player's
// own moves are not. Exit code 1 on any failure.
import { createRequire } from 'node:module';
import { mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Chess } from 'chess.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); // preinstalled globally; not a project dependency
const vite = await import('vite');

const which = process.argv[2] ?? 'all';
const VIDEO = process.env.ANIM_VIDEO;
const BOUNDS = { fast: [150, 250], balanced: [350, 550], majestic: [900, 1000] };
const results = [];
const errors = [];
let current = '';

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`);
}
async function scenario(name, fn) {
  current = name;
  try {
    await fn();
  } catch (e) {
    record(name, false, 'threw: ' + (e?.message ?? e).split('\n')[0]);
  }
}

// ---------------------------------------------------------------- in-page probe

const PROBE = `
window.__probe = (ms, untilIdle) => new Promise((res) => {
  const t0 = performance.now(); const fr = []; let idleSince = null;
  const step = () => {
    const now = performance.now();
    const field = document.querySelector('.b2-field');
    fr.push({
      now, anim: field && field.dataset.anim, ds: field && { start: +field.dataset.animStart || null, done: +field.dataset.animDone || null, plan: field.dataset.animPlan || null },
      fx: [...document.querySelectorAll('.b2-fx .fx')].map((e) => e.className),
      mk: [...document.querySelectorAll('.b2-marks .mk.last:not(.from)')].map((e) => getComputedStyle(e).opacity),
      sp: [...document.querySelectorAll('.b2-sprites .pc')].map((e) => ({ sid: e.dataset.sid, tr: e.style.transform, op: e.style.opacity, filt: e.style.filter, src: e.getAttribute('src'), dying: e.classList.contains('dying') })),
    });
    if (field && field.dataset.anim === 'idle' && fr.length > 2) idleSince = idleSince ?? now; else idleSince = null;
    if (now - t0 < ms && !(untilIdle && idleSince !== null && now - idleSince > 120)) requestAnimationFrame(step); else res(fr);
  };
  step();
});
window.__boardState = () => {
  const f = document.querySelector('.b2-field');
  const wrap = document.querySelector('.board-wrap');
  return { anim: f.dataset.anim, start: +f.dataset.animStart || null, done: +f.dataset.animDone || null, plan: f.dataset.animPlan ? JSON.parse(f.dataset.animPlan) : null,
    flipped: (document.querySelector('.b2-ranks span') || {}).textContent === '1', hasWrap: !!wrap };
};`;

// ---------------------------------------------------------------- analysis helpers

const parseT = (tr) => {
  const m = /translate\(([-\d.e]+)%, ([-\d.e]+)%\)(.*)$/.exec(tr || '');
  return m ? { x: +m[1], y: +m[2], extra: m[3].trim() } : null;
};
const sqPct = (sq, flipped) => {
  const f = 'abcdefgh'.indexOf(sq[0]), r = +sq[1] - 1;
  return { x: (flipped ? 7 - f : f) * 100, y: (flipped ? r : 7 - r) * 100 };
};
const pieceOf = (src) => {
  const m = /\/([wb])([pnbrqk])\.webp/.exec(src || '');
  return m ? m[1] + m[2] : '?';
};

/** Sprites (final frame) vs FEN: same pieces on the same squares, nothing extra. */
function convergence(frame, fen, flipped, toppledOk = false) {
  const issues = [];
  const want = new Map();
  for (const row of new Chess(fen).board()) for (const p of row) if (p) want.set(p.square, p.color + p.type);
  const seen = new Map();
  for (const s of frame.sp) {
    if (s.dying) { issues.push('dying sprite left'); continue; }
    const t = parseT(s.tr);
    if (!t) { issues.push('no transform'); continue; }
    const fx = t.x / 100, fy = t.y / 100;
    const toppled = toppledOk && /rotate\(/.test(t.extra);
    const rx = toppled ? Math.round(fx - 0.12 * Math.sign(fx - Math.round(fx) || 1)) : fx, ry = toppled ? Math.round(fy - 0.1) : fy;
    if (!toppled && (Math.abs(fx - Math.round(fx)) > 0.002 || Math.abs(fy - Math.round(fy)) > 0.002 || t.extra)) issues.push(`sprite ${s.sid} off-grid ${s.tr}`);
    const f = flipped ? 7 - Math.round(rx) : Math.round(rx), r = flipped ? Math.round(ry) : 7 - Math.round(ry);
    const sq = 'abcdefgh'[f] + (r + 1);
    if (seen.has(sq)) issues.push('duplicate on ' + sq);
    seen.set(sq, pieceOf(s.src));
    if (s.op && s.op !== '1') issues.push(`sprite ${s.sid} opacity ${s.op}`);
  }
  for (const [sq, p] of want) if (seen.get(sq) !== p) issues.push(`${sq}: want ${p} got ${seen.get(sq) ?? 'none'}`);
  for (const [sq, p] of seen) if (!want.has(sq)) issues.push(`${sq}: extra ${p}`);
  if (frame.fx.length) issues.push('fx left: ' + frame.fx.join(','));
  if (frame.anim && frame.anim !== 'idle') issues.push('anim state ' + frame.anim);
  return issues;
}

/** Board state at the end of the first animation completed during the sample (else the given one). */
function firstCompleted(frames, st) {
  let busy = false;
  for (const f of frames) {
    if (f.anim && f.anim !== 'idle') busy = true;
    else if (busy && f.ds?.plan) return { ...st, start: f.ds.start, done: f.ds.done, plan: JSON.parse(f.ds.plan) };
  }
  return st;
}

/** Glide analysis of the sprite that ends on `to`. */
function glide(frames, st, from, to, flipped, opts = {}) {
  const issues = [];
  if (opts.first) st = firstCompleted(frames, st);
  const last = frames[frames.length - 1];
  const p1 = sqPct(to, flipped), p0 = opts.p0 ?? sqPct(from, flipped);
  const mover = last.sp.find((s) => { const t = parseT(s.tr); return t && !s.dying && Math.abs(t.x - p1.x) < 0.5 && Math.abs(t.y - p1.y) < 0.5; });
  if (!mover) return { issues: ['mover not found on ' + to] };
  const plan = st.plan ?? {};
  const t0 = st.start, t1 = st.done;
  const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  let prevD = Infinity, prevP = null, prevNow = null, regress = 0, maxJump = 0, moved = 0, preOk = 0, preFrames = 0, preGlow = 0, preFx = false;
  for (const fr of frames) {
    const s = fr.sp.find((x) => x.sid === mover.sid);
    if (!s) continue;
    const t = parseT(s.tr);
    if (!t) continue;
    if (fr.now < t0) continue;
    if (fr.fx.some((c) => c.includes('pre'))) preFx = true;
    const inPre = plan.pre > 0 && fr.now > t0 + 20 && fr.now < t0 + plan.pre - 20;
    if (inPre) {
      preFrames++;
      if (Math.abs(t.x - p0.x) < 0.5 && Math.abs(t.y - p0.y) < 0.5) preOk++;
      if (/255, 200, 80/.test(s.filt)) preGlow++;
    }
    const d = Math.hypot(t.x - p1.x, t.y - p1.y);
    if (d > prevD + 0.6) regress++;
    if (prevP) {
      const j = Math.hypot(t.x - prevP.x, t.y - prevP.y);
      const dt = Math.max(17, fr.now - prevNow); // probe and board ticks share frames but not timestamps
      const allowed = dist * (dt / Math.max(40, opts.glideMs ?? plan.glide ?? 100)) * 3.2 + 12;
      if (j > allowed) issues.push(`jump ${j.toFixed(0)}% in ${dt.toFixed(0)}ms`);
      maxJump = Math.max(maxJump, j);
      if (j > 0.01) moved++;
    }
    prevD = d; prevP = t; prevNow = fr.now;
  }
  if (regress) issues.push(`glide regressed ${regress}×`);
  if (dist > 1 && moved < (opts.minFrames ?? 3)) issues.push(`only ${moved} moving frames`);
  const dur = t1 && t0 ? t1 - t0 : null;
  if (!opts.noDuration && plan.total !== undefined && dur !== null && (dur < plan.total - 5 || dur > plan.total + 90)) issues.push(`duration ${dur.toFixed(0)} vs plan ${plan.total}`);
  const sawPre = frames.some((f) => f.now >= t0 && f.now < t0 + (plan.pre || 0) - 30);
  if (opts.remote === true) {
    if (!(plan.pre >= 60)) issues.push('no pre-highlight planned');
    if (!sawPre) { /* sampling began after the pre-highlight; plan checked only */ } else {
    if (preFrames && preOk < preFrames) issues.push(`piece left origin during pre (${preOk}/${preFrames})`);
    if (preFrames && preGlow < preFrames * 0.6) issues.push('no glow during pre');
    if (!preFx) issues.push('no origin glow fx');
    }
  }
  if (opts.remote === false && plan.pre) issues.push('player move was pre-highlighted');
  return { issues, dur, plan, maxJump: +maxJump.toFixed(1), moved };
}

// ---------------------------------------------------------------- board lab

async function labSuite(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[lab ${current}] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[lab ${current}] console: ${m.text()}`));
  await page.addInitScript(PROBE);
  await page.goto(base + '/boardlab.html');
  await page.waitForFunction(() => window.__lab && document.querySelector('.b2-field'));
  await page.waitForTimeout(400);

  const fen = () => page.evaluate(() => window.__labFen());
  const set = async (f) => { await page.evaluate((f) => window.__lab.set(f), f); await page.waitForTimeout(120); };
  const speed = async (animSpeed, extra = {}) => { await page.evaluate((p) => window.__lab.settings(p), { animSpeed, reduceMotion: false, ...extra }); await page.waitForTimeout(60); };
  /** Play a remote move and sample it until idle. */
  const remote = async (uci, ms = 2600) => page.evaluate(async ([uci, ms]) => { const p = window.__probe(ms, true); window.__lab.play(uci); const fr = await p; return { fr, st: window.__boardState() }; }, [uci, ms]);
  const final = async () => page.evaluate(() => window.__probe(40));
  const check = async (name, uci, opts = {}) => {
    const { fr, st } = await remote(uci, opts.ms);
    const g = glide(fr, st, uci.slice(0, 2), uci.slice(2, 4), false, { remote: true, ...opts });
    await page.waitForTimeout(80);
    const fin = await final();
    const conv = convergence(fin[fin.length - 1], await fen(), false, opts.toppled);
    const extra = opts.extra ? opts.extra(fr, st, fin) : [];
    const issues = [...g.issues, ...conv, ...extra];
    if (opts.bounds && st.plan && (st.plan.total < opts.bounds[0] || st.plan.total > opts.bounds[1])) issues.push(`total ${st.plan.total} outside ${opts.bounds}`);
    record(name, !issues.length, issues.length ? issues.slice(0, 4).join('; ') : `${st.plan?.total ?? 0} ms (pre ${st.plan?.pre} · glide ${st.plan?.glide} · settle ${st.plan?.settle}) measured ${g.dur?.toFixed(0)} ms, ${fr.length} frames, max step ${g.maxJump}%`);
    return { fr, st };
  };
  const START = new Chess().fen();

  for (const sp of ['fast', 'balanced', 'majestic']) {
    await scenario(`lab · ${sp} · AI pawn e2e4 (pre-highlight, glide, bounds)`, async () => {
      await speed(sp); await set(START);
      await check(current, 'e2e4', { bounds: BOUNDS[sp] });
    });
  }
  await speed('majestic');
  await scenario('lab · AI knight g1f3 (arc, no ground regress)', async () => { await set(START); await check(current, 'g1f3'); });
  await scenario('lab · AI capture e4xd5 (victim fades, gone at landing)', async () => {
    await set('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    await check(current, 'e4d5', { extra: (fr, st) => {
      const iss = [];
      const end = st.done;
      const dyingAfter = fr.filter((f) => f.now > end + 40 && f.sp.some((s) => s.dying));
      if (dyingAfter.length) iss.push('captured piece lingered');
      if (!fr.some((f) => f.fx.some((c) => c.includes('hit')))) iss.push('no impact fx');
      return iss;
    } });
  });
  const castles = [
    ['white O-O', 'r3k2r/pppqbppp/2np1n2/4p3/4P3/2NP1N2/PPPQBPPP/R3K2R w KQkq - 0 8', 'e1g1', 'h1', 'f1'],
    ['white O-O-O', 'r3k2r/pppqbppp/2np1n2/4p3/4P3/2NP1N2/PPPQBPPP/R3K2R w KQkq - 0 8', 'e1c1', 'a1', 'd1'],
    ['black O-O', 'r3k2r/pppqbppp/2np1n2/4p3/4P3/2NP1N2/PPPQBPPP/R4RK1 b kq - 1 8', 'e8g8', 'h8', 'f8'],
    ['black O-O-O', 'r3k2r/pppqbppp/2np1n2/4p3/4P3/2NP1N2/PPPQBPPP/R4RK1 b kq - 1 8', 'e8c8', 'a8', 'd8'],
  ];
  for (const [label, f, uci, rf, rt] of castles) {
    await scenario(`lab · castling ${label} (king + rook choreography)`, async () => {
      await set(f);
      await check(current, uci, { extra: (fr, st) => glide(fr, st, rf, rt, false, { glideMs: st.plan.glide * 0.7 }).issues.map((x) => 'rook: ' + x) });
    });
  }
  await scenario('lab · en passant e5xd6 (victim on d5 removed)', async () => {
    await set('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
    await check(current, 'e5d6');
  });
  for (const pr of ['q', 'r', 'b', 'n']) {
    await scenario(`lab · AI promotion a7a8=${pr.toUpperCase()}`, async () => {
      await set('8/P6k/8/8/8/8/6K1/8 w - - 0 1');
      await check(current, 'a7a8' + pr, { extra: (fr) => (fr.some((f) => f.fx.some((c) => c.includes('promo'))) ? [] : ['no promotion flare']) });
    });
  }
  await scenario('lab · capture-promotion b7xa8=N', async () => {
    await set('r6k/1P6/8/8/8/8/6K1/8 w - - 0 1');
    await check(current, 'b7a8n');
  });
  await scenario('lab · check: king flashes on landing', async () => {
    await set('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
    await check(current, 'a1a8');
  });
  await scenario('lab · checkmate: mate lands, king topples, victory flare', async () => {
    await set(START);
    await speed('fast');
    for (const m of ['f2f3', 'e7e5', 'g2g4']) { await page.evaluate((m) => window.__lab.play(m), m); await page.waitForTimeout(260); }
    await speed('majestic');
    const { fr, st } = await check(current + ' (move)', 'd8h4', { toppled: true, ms: 4200, noDuration: true });
    const fin = (await final()).pop();
    const k = fin.sp.find((s) => pieceOf(s.src) === 'wk');
    const iss = [];
    if (!/rotate\(-?8\d/.test(k?.tr ?? '')) iss.push('king not toppled: ' + k?.tr);
    if (!fr.some((f) => f.fx.some((c) => c.includes('win')))) iss.push('no victory flare');
    const toppleStart = fr.find((f) => f.sp.some((s) => pieceOf(s.src) === 'wk' && /rotate/.test(s.tr)));
    if (toppleStart && toppleStart.now < st.start + st.plan.total) iss.push('topple began before the mate landed');
    record(current, !iss.length, iss.join('; ') || 'king toppled after landing');
  });
  await scenario('lab · resign: king topples', async () => {
    await set(START);
    await page.evaluate(() => window.__lab.resign('b'));
    const fr = await page.evaluate(() => window.__probe(1200, true));
    const k = fr[fr.length - 1].sp.find((s) => pieceOf(s.src) === 'bk');
    const mid = fr.find((f) => f.sp.some((s) => pieceOf(s.src) === 'bk' && /rotate\((-?[1-7]\d|-?[1-9])(\.\d+)?deg/.test(s.tr)));
    const iss = [];
    if (!/rotate\(-?8\d/.test(k?.tr ?? '')) iss.push('not toppled');
    if (!mid) iss.push('no intermediate frames (teleported)');
    record(current, !iss.length, iss.join('; ') || 'smooth topple');
  });

  // ---- player input
  const click = async (sq) => {
    const box = await page.locator('.b2-field').boundingBox();
    const f = 'abcdefgh'.indexOf(sq[0]), r = +sq[1];
    await page.mouse.click(box.x + (box.width * (f + 0.5)) / 8, box.y + (box.height * (8 - r + 0.5)) / 8);
  };
  const local = async (from, to, promo) => page.evaluate(async ([from, to, promo]) => {
    const field = document.querySelector('.b2-field'); const r = field.getBoundingClientRect();
    const at = (sq) => ({ clientX: r.left + ('abcdefgh'.indexOf(sq[0]) + 0.5) * r.width / 8, clientY: r.top + (8 - +sq[1] + 0.5) * r.height / 8, bubbles: true, pointerId: 1 });
    const tapSq = (sq) => { field.dispatchEvent(new PointerEvent('pointerdown', at(sq))); field.dispatchEvent(new PointerEvent('pointerup', at(sq))); };
    const p = window.__probe(2200, true);
    tapSq(from); tapSq(to);
    if (promo) { await new Promise((z) => setTimeout(z, 30)); document.querySelector(`.promo button[aria-label="Promote to ${promo}"]`).click(); }
    const fr = await p; return { fr, st: window.__boardState() };
  }, [from, to, promo]);

  await page.evaluate(() => window.__lab.human('w'));
  await scenario('lab · player tap move e2e4 (no pre-highlight, immediate)', async () => {
    await set(START);
    const { fr, st } = await local('e2', 'e4');
    const g = glide(fr, st, 'e2', 'e4', false, { remote: false });
    const conv = convergence((await final()).pop(), await fen(), false);
    const firstMove = fr.find((f) => f.sp.some((s) => { const t = parseT(s.tr); return t && t.x === 400 && t.y < 600 && t.y > 400; }));
    const iss = [...g.issues, ...conv];
    if (firstMove && firstMove.now - st.start > 50) iss.push('slow to start');
    record(current, !iss.length, iss.join('; ') || `${st.plan.total} ms, starts on the next frame`);
  });
  for (const [label, name] of [['Q', 'queen'], ['R', 'rook'], ['B', 'bishop'], ['N', 'knight']]) {
    await scenario(`lab · player promotion via dialog =${label}`, async () => {
      await set('8/P6k/8/8/8/8/6K1/8 w - - 0 1');
      const { fr, st } = await local('a7', 'a8', name);
      const g = glide(fr, st, 'a7', 'a8', false, { remote: false });
      const conv = convergence((await final()).pop(), await fen(), false);
      const iss = [...g.issues, ...conv];
      if (!(await fen()).startsWith(label)) iss.push('wrong promotion ' + (await fen()));
      record(current, !iss.length, iss.join('; '));
    });
  }
  await scenario('lab · player drag-and-drop d2d4 (short settle from drop point)', async () => {
    await set(START);
    const box = await page.locator('.b2-field').boundingBox();
    const at = (sq, ox = 0, oy = 0) => [box.x + (box.width * ('abcdefgh'.indexOf(sq[0]) + 0.5 + ox)) / 8, box.y + (box.height * (8 - +sq[1] + 0.5 + oy)) / 8];
    await page.mouse.move(...at('d2'));
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(...at('d2', 0.03 * i, -0.25 * i));
    const pr = page.evaluate(() => window.__probe(900, true));
    await page.mouse.move(...at('d4', 0.2, 0.15));
    await page.mouse.up();
    const fr = await pr;
    const st = await page.evaluate(() => window.__boardState());
    const iss = [...convergence((await final()).pop(), await fen(), false)];
    if (!st.plan?.dragged) iss.push('not treated as a drop');
    if (st.plan?.pre) iss.push('pre-highlight on own move');
    if (st.plan && st.plan.total > 150) iss.push('drop settle too long ' + st.plan.total);
    if (!(await fen()).includes('3P4/8/PPP1PPPP')) iss.push('move not applied');
    record(current, !iss.length, iss.join('; ') || `settle ${st.plan.total} ms, ${fr.length} frames`);
  });
  await scenario('lab · rapid legal moves + instant engine replies (10 plies, no waits)', async () => {
    await set(START);
    const line = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6', 'e1g1', 'f7f6'];
    const fr = await page.evaluate(async (line) => {
      const field = document.querySelector('.b2-field'); const r = field.getBoundingClientRect();
      const at = (sq) => ({ clientX: r.left + ('abcdefgh'.indexOf(sq[0]) + 0.5) * r.width / 8, clientY: r.top + (8 - +sq[1] + 0.5) * r.height / 8, bubbles: true, pointerId: 1 });
      const tapSq = (sq) => { field.dispatchEvent(new PointerEvent('pointerdown', at(sq))); field.dispatchEvent(new PointerEvent('pointerup', at(sq))); };
      const p = window.__probe(4000, true);
      for (let i = 0; i < line.length; i += 2) {
        tapSq(line[i].slice(0, 2)); tapSq(line[i].slice(2, 4));
        await new Promise((z) => setTimeout(z, 0));
        window.__lab.play(line[i + 1]); // engine replies instantly, mid-animation
        await new Promise((z) => setTimeout(z, 40)); // the player taps again while the reply is still animating
      }
      return p;
    }, line);
    const moves = await page.evaluate(() => window.__labMoves.slice(-10));
    const iss = convergence(fr[fr.length - 1], await fen(), false);
    if (moves.join() !== line.join()) iss.push('dropped input: ' + moves.join(' '));
    const maxSprites = Math.max(...fr.map((f) => f.sp.filter((s) => !s.dying).length));
    if (maxSprites > 32) iss.push('duplicate sprites: ' + maxSprites);
    record(current, !iss.length, iss.join('; ') || `all 10 plies accepted, ${fr.length} frames`);
  });
  await scenario('lab · input during AI pre-highlight finishes it and is accepted', async () => {
    await set(START);
    await page.evaluate(() => window.__lab.human('b'));
    const r = await page.evaluate(async () => {
      const field = document.querySelector('.b2-field'); const rc = field.getBoundingClientRect();
      const at = (sq) => ({ clientX: rc.left + ('abcdefgh'.indexOf(sq[0]) + 0.5) * rc.width / 8, clientY: rc.top + (8 - +sq[1] + 0.5) * rc.height / 8, bubbles: true, pointerId: 1 });
      const tapSq = (sq) => { field.dispatchEvent(new PointerEvent('pointerdown', at(sq))); field.dispatchEvent(new PointerEvent('pointerup', at(sq))); };
      const p = window.__probe(2500, true);
      window.__lab.play('e2e4');
      await new Promise((z) => setTimeout(z, 90));
      const phase = field.dataset.anim;
      tapSq('e7'); tapSq('e5');
      return { phase, fr: await p };
    });
    const iss = convergence(r.fr[r.fr.length - 1], await fen(), false);
    if (!(await fen()).includes('4p3/4P3')) iss.push('reply not accepted');
    record(current, !iss.length, iss.join('; ') || `tapped during "${r.phase}" — finished instantly, reply accepted`);
    await page.evaluate(() => window.__lab.human('w'));
  });
  await scenario('lab · double-click skips', async () => {
    await set(START);
    const t = await page.evaluate(async () => {
      const p = window.__probe(1500, true);
      window.__lab.play('d2d4');
      await new Promise((z) => setTimeout(z, 300));
      document.querySelector('.b2-field').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const t = performance.now(); await p; return { t, st: window.__boardState() };
    });
    const iss = convergence((await final()).pop(), await fen(), false);
    if (t.st.done - t.t > 20) iss.push('skip not immediate');
    record(current, !iss.length, iss.join('; '));
  });
  await scenario('lab · speed change mid-animation (majestic → fast)', async () => {
    await set(START);
    await page.evaluate(async () => { window.__lab.play('e2e4'); await new Promise((z) => setTimeout(z, 200)); window.__lab.settings({ animSpeed: 'fast' }); });
    await page.waitForTimeout(1100);
    const { st } = await check(current + ' → next move', 'e7e5', { bounds: BOUNDS.fast });
    void st;
    await speed('custom', { animMs: 700 });
    await check('lab · custom 700 ms', 'g1f3', { bounds: [690, 710] });
    await speed('majestic');
  });
  await scenario('lab · undo mid-animation converges', async () => {
    await set(START);
    await page.evaluate(() => window.__lab.play('e2e4'));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__lab.undo());
    await page.waitForTimeout(100);
    const iss = convergence((await final()).pop(), await fen(), false);
    record(current, !iss.length && (await fen()) === START, iss.join('; '));
  });
  await scenario('lab · Reduce motion + OS prefers-reduced-motion are instant', async () => {
    await set(START);
    await speed('majestic', { reduceMotion: true });
    let { st } = await remote('e2e4', 300);
    const a = st.done - st.start;
    await speed('majestic', { reduceMotion: false });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.__lab.settings({ animMs: 481 })); // re-render under the media query
    ({ st } = await remote('e7e5', 300));
    const b = st.done - st.start;
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const iss = convergence((await final()).pop(), await fen(), false);
    if (!(a <= 1 && b <= 1)) iss.push(`not instant (${a}, ${b})`);
    record(current, !iss.length, iss.join('; ') || 'instant');
  });
  await scenario('lab · black orientation (spectator flip) converges', async () => {
    await page.evaluate(() => window.__lab.orient('b'));
    await set(START);
    const { fr, st } = await remote('e2e4');
    const g = glide(fr, st, 'e2', 'e4', true, { remote: true });
    const iss = [...g.issues, ...convergence((await final()).pop(), await fen(), true)];
    await page.evaluate(() => window.__lab.orient('w'));
    record(current, !iss.length, iss.join('; '));
  });
  await scenario('lab · unmount mid-animation (no errors, no leftovers) and remount', async () => {
    await set(START);
    const before = errors.length;
    await page.evaluate(async () => { window.__lab.play('e2e4'); await new Promise((z) => setTimeout(z, 150)); window.__lab.unmount(); });
    await page.waitForTimeout(1300);
    const left = await page.evaluate(() => document.querySelectorAll('.b2-sprites .pc, .b2-fx .fx').length);
    await page.evaluate(() => window.__lab.remount());
    await page.waitForTimeout(300);
    const iss = convergence((await final()).pop(), await fen(), false);
    if (left) iss.push(`${left} nodes left after unmount`);
    if (errors.length > before) iss.push('errors: ' + errors.slice(before).join(' | '));
    record(current, !iss.length, iss.join('; '));
  });
  await scenario('lab · reload mid-animation converges', async () => {
    await page.evaluate(() => window.__lab.play('e2e4'));
    await page.waitForTimeout(200);
    await page.reload();
    await page.waitForFunction(() => window.__lab && document.querySelector('.b2-field'));
    await page.waitForTimeout(300);
    const iss = convergence((await final()).pop(), await fen(), false);
    record(current, !iss.length, iss.join('; '));
  });
  await ctx.close();

  // ---- touch (phone viewport)
  await scenario('lab · touch taps on a phone viewport (hasTouch, 390×844)', async () => {
    const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const tp = await tctx.newPage();
    tp.on('pageerror', (e) => errors.push(`[touch] ${e.message}`));
    await tp.addInitScript(PROBE);
    await tp.goto(base + '/boardlab.html');
    await tp.waitForFunction(() => window.__lab && document.querySelector('.b2-field'));
    await tp.evaluate(() => window.__lab.human('w'));
    await tp.waitForTimeout(200);
    const box = await tp.locator('.b2-field').boundingBox();
    const at = (sq) => [box.x + (box.width * ('abcdefgh'.indexOf(sq[0]) + 0.5)) / 8, box.y + (box.height * (8 - +sq[1] + 0.5)) / 8];
    const iss = [];
    for (const [a, b, reply] of [['e2', 'e4', 'e7e5'], ['g1', 'f3', 'b8c6'], ['f1', 'c4', 'g8f6']]) {
      await tp.touchscreen.tap(...at(a));
      await tp.waitForTimeout(60);
      const pr = tp.evaluate(() => window.__probe(1600, true));
      await tp.touchscreen.tap(...at(b));
      const fr = await pr;
      const st = await tp.evaluate(() => window.__boardState());
      iss.push(...glide(fr, st, a, b, false, { remote: false }).issues);
      await tp.evaluate((m) => window.__lab.play(m), reply);
      await tp.waitForTimeout(1200);
    }
    const fin = await tp.evaluate(() => window.__probe(40));
    iss.push(...convergence(fin.pop(), await tp.evaluate(() => window.__labFen()), false));
    if ((await tp.evaluate(() => window.__labMoves.length)) !== 6) iss.push('taps lost');
    record(current, !iss.length, iss.join('; ') || '3 tapped moves + 3 replies');
    await tctx.close();
  });

  // ---- videos
  if (VIDEO) {
    mkdirSync(VIDEO, { recursive: true });
    const vctx = await browser.newContext({ viewport: { width: 760, height: 760 }, recordVideo: { dir: VIDEO, size: { width: 760, height: 760 } } });
    const vp = await vctx.newPage();
    await vp.goto(base + '/boardlab.html');
    await vp.waitForFunction(() => window.__lab && document.querySelector('.b2-field'));
    await vp.waitForTimeout(800);
    for (const m of ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5']) { await vp.evaluate((m) => window.__lab.play(m), m); await vp.waitForTimeout(1500); }
    await vp.evaluate(() => window.__lab.set('r3k2r/pppqbppp/2np1n2/4p3/4P3/2NP1N2/PPPQBPPP/R3K2R w KQkq - 0 8'));
    await vp.waitForTimeout(600);
    for (const m of ['e1g1', 'e8c8']) { await vp.evaluate((m) => window.__lab.play(m), m); await vp.waitForTimeout(1500); }
    await vp.evaluate(() => window.__lab.set('1r5k/P7/8/8/8/8/6K1/8 w - - 0 1'));
    await vp.waitForTimeout(600);
    await vp.evaluate(() => window.__lab.play('a7b8q'));
    await vp.waitForTimeout(1600);
    const v = vp.video();
    await vctx.close();
    console.log('video:', await v.path());
  }
}

// ---------------------------------------------------------------- production GameScreen

async function prodSuite(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[prod ${current}] ${e.message}`));
  await page.addInitScript(PROBE);
  await page.goto(base + '/');
  await page.fill('.name-in', 'Anim');
  await page.click('text=ENTER THE DUST PITS');
  await page.waitForSelector('text=Casual game', { timeout: 120000 });

  const sanList = async () => page.evaluate(() => [...document.querySelectorAll('.stage-side .move-strip .ms-pair')].map((e) => e.textContent.replace(/^\s*\d+\.\s*/, '').trim().split(/\s+/)).flat().filter(Boolean));
  const fenNow = async () => { const c = new Chess(); for (const s of await sanList()) c.move(s); return c.fen(); };
  const flipped = async () => page.evaluate(() => window.__boardState().flipped);
  const myColor = async () => ((await flipped()) ? 'b' : 'w');
  const tapMove = async (uci) => page.evaluate(async (uci) => {
    const field = document.querySelector('.b2-field'); const r = field.getBoundingClientRect();
    const fl = window.__boardState().flipped;
    const at = (sq) => { let f = 'abcdefgh'.indexOf(sq[0]), rk = +sq[1] - 1; if (fl) { f = 7 - f; rk = 7 - rk; } return { clientX: r.left + (f + 0.5) * r.width / 8, clientY: r.top + (7 - rk + 0.5) * r.height / 8, bubbles: true, pointerId: 1 }; };
    const tapSq = (sq) => { field.dispatchEvent(new PointerEvent('pointerdown', at(sq))); field.dispatchEvent(new PointerEvent('pointerup', at(sq))); };
    tapSq(uci.slice(0, 2)); tapSq(uci.slice(2, 4));
  }, uci);
  const pickMove = (fen) => {
    const c = new Chess(fen);
    const ms = c.moves({ verbose: true }).filter((m) => !m.promotion);
    const caps = ms.filter((m) => m.captured);
    const m = caps[0] ?? ms[(c.moveNumber() * 7) % ms.length];
    return m.from + m.to;
  };
  const waitMyTurn = async () => page.waitForFunction(() => document.querySelector('.turn-tag') && !document.querySelector('.thinking'), null, { timeout: 120000 });
  const startGame = async () => {
    await page.click('.tab >> text=Arena');
    await page.click('text=Casual game');
    await page.waitForSelector('.b2-field');
    await page.waitForTimeout(400);
  };
  /** Play one of our moves and sample both it and the AI reply. */
  const ply = async (name, sp) => {
    await waitMyTurn();
    await page.waitForFunction(() => window.__boardState().anim !== 'pre' && window.__boardState().anim !== 'glide', null, { timeout: 5000 }).catch(() => {});
    const fen0 = await fenNow();
    const nBefore = (await sanList()).length;
    const uci = pickMove(fen0);
    const fl = await flipped();
    const pr = page.evaluate(() => window.__probe(1500, true));
    await tapMove(uci);
    const fr = await pr;
    const st = await page.evaluate(() => window.__boardState());
    const iss = glide(fr, st, uci.slice(0, 2), uci.slice(2, 4), fl, { remote: false, first: true }).issues;
    // the AI reply: wait for its animation to begin, then sample it
    const n0 = (await sanList()).length;
    if (n0 < nBefore + 1) { record(name, false, `your move ${uci} was not applied (${nBefore} → ${n0} plies)`); return; }
    if (await page.evaluate(() => !document.querySelector('.in-game .b2-field'))) { record(name, false, 'game ended'); return; }
    if (new Chess(await fenNow()).isGameOver()) { record(name, !iss.length, 'game over after your move'); return; }
    await page.waitForFunction((n) => [...document.querySelectorAll('.stage-side .move-strip .ms-pair')].map((e) => e.textContent.replace(/^\s*\d+\.\s*/, '').trim().split(/\s+/)).flat().filter(Boolean).length > n, nBefore + 1, { timeout: 120000 });
    const fr2 = await page.evaluate(() => window.__probe(2600, true));
    const st2 = await page.evaluate(() => window.__boardState());
    const san = await sanList();
    const c = new Chess(); let last;
    for (const s of san) last = c.move(s);
    if (st2.plan && last) iss.push(...glide(fr2, st2, last.from, last.to, fl, { remote: true }).issues.map((x) => 'AI: ' + x));
    else iss.push('AI move not sampled');
    if (sp && st2.plan && (st2.plan.total < BOUNDS[sp][0] || st2.plan.total > BOUNDS[sp][1])) iss.push(`AI total ${st2.plan.total} outside ${sp}`);
    iss.push(...convergence((await page.evaluate(() => window.__probe(30))).pop(), c.fen(), fl));
    record(name, !iss.length, iss.slice(0, 4).join('; ') || `you ${uci} (${st.plan?.total} ms, no pre) · AI ${last?.san} (${st2.plan?.total} ms: pre ${st2.plan?.pre}, glide ${st2.plan?.glide}, settle ${st2.plan?.settle})`);
  };

  await scenario('prod · casual game vs AI, natural pace (majestic)', async () => {
    await startGame();
    if ((await myColor()) === 'b') await waitMyTurn();
    for (let i = 0; i < 4; i++) await ply(`prod · majestic ply ${i + 1} (player tap + AI reply)`, 'majestic');
  });
  await scenario('prod · Undo mid AI animation converges', async () => {
    await waitMyTurn();
    const uci = pickMove(await fenNow());
    await tapMove(uci);
    await page.waitForFunction(() => window.__boardState().anim === 'pre' || window.__boardState().anim === 'glide', null, { timeout: 120000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector('.turn-tag'), null, { timeout: 120000 });
    await page.waitForTimeout(150); // AI reply now mid-animation
    await page.locator('button:visible', { hasText: 'Undo' }).click();
    await page.waitForTimeout(250);
    const iss = convergence((await page.evaluate(() => window.__probe(30))).pop(), await fenNow(), await flipped());
    record(current, !iss.length, iss.join('; ') || 'board == FEN after undo');
  });
  await scenario('prod · navigate away mid-animation, change speed to Fast, resume', async () => {
    await waitMyTurn();
    await tapMove(pickMove(await fenNow()));
    await page.waitForTimeout(120);
    await page.click('.tab >> text=Legacy');
    await page.click('.seg >> text=Settings').catch(() => {});
    await page.click('text=Fast');
    await page.click('.tab >> text=Arena');
    await page.click('text=/resume|continue/i').catch(() => {});
    await page.waitForSelector('.in-game .b2-field', { timeout: 20000 });
    await page.waitForTimeout(300);
    const iss = convergence((await page.evaluate(() => window.__probe(30))).pop(), await fenNow(), await flipped());
    record(current, !iss.length, iss.join('; ') || 'resumed and converged');
    await ply('prod · fast ply after speed change', 'fast');
  });
  await scenario('prod · reload mid-animation converges', async () => {
    await page.click('.tab >> text=Legacy'); await page.click('.seg >> text=Settings').catch(() => {}); await page.click('text=Majestic');
    await page.click('.tab >> text=Arena'); await page.click('text=/resume|continue/i').catch(() => {});
    await page.waitForSelector('.in-game .b2-field');
    await waitMyTurn();
    await tapMove(pickMove(await fenNow()));
    await page.waitForFunction(() => document.querySelector('.turn-tag'), null, { timeout: 120000 });
    await page.waitForTimeout(100);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.in-game .b2-field') || [...document.querySelectorAll('button')].some((b) => /resume/i.test(b.textContent)), null, { timeout: 60000 });
    if (!(await page.$('.in-game .b2-field'))) await page.click('button:has-text("Resume")');
    await page.waitForSelector('.in-game .b2-field', { timeout: 20000 });
    await page.waitForTimeout(400);
    const iss = convergence((await page.evaluate(() => window.__probe(30))).pop(), await fenNow(), await flipped());
    record(current, !iss.length, iss.join('; ') || 'converged after reload');
  });
  await scenario('prod · resign: king topples before the ceremony', async () => {
    await waitMyTurn();
    const col = await myColor();
    await page.locator('button:visible', { hasText: 'Resign' }).first().click();
    const pr = page.evaluate(() => window.__probe(1500));
    await page.locator('.confirm:visible button', { hasText: 'Resign' }).click();
    const fr = await pr;
    const k = fr.map((f) => f.sp.find((s) => pieceOf(s.src) === col + 'k')).filter(Boolean).pop();
    const ok = /rotate\(-?8\d/.test(k?.tr ?? '');
    record(current, ok, ok ? 'toppled' : 'king pose ' + k?.tr);
  });
  // the resigned game ends in the post-game sheet; leave it for the Arena
  await page.click('.tab >> text=Arena').catch(() => {});
  await page.waitForTimeout(1500);
  await scenario('prod · instant engine replies (Opponent pace: Instant)', async () => {
    await page.click('.tab >> text=Legacy'); await page.click('.seg >> text=Settings').catch(() => {}); await page.click('text=Instant');
    await startGame();
    if ((await myColor()) === 'b') await waitMyTurn();
    for (let i = 0; i < 2; i++) await ply(`prod · instant-pace ply ${i + 1}`, 'majestic');
  });
  await ctx.close();

  await scenario('prod · touch taps on a phone (hasTouch, 390×844)', async () => {
    const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const tp = await tctx.newPage();
    tp.on('pageerror', (e) => errors.push(`[prod touch] ${e.message}`));
    await tp.addInitScript(PROBE);
    await tp.goto(base + '/');
    await tp.fill('.name-in', 'Touch');
    await tp.click('text=ENTER THE DUST PITS');
    await tp.waitForSelector('text=Casual game', { timeout: 120000 });
    await tp.tap('text=Casual game');
    await tp.waitForSelector('.b2-field');
    await tp.waitForFunction(() => document.querySelector('.turn-tag') && !document.querySelector('.thinking'), null, { timeout: 120000 });
    const san = await tp.evaluate(() => [...document.querySelectorAll('.stage-side .move-strip .ms-pair')].map((e) => e.textContent.replace(/^\s*\d+\.\s*/, '').trim().split(/\s+/)).flat().filter(Boolean));
    const c = new Chess(); for (const s of san) c.move(s);
    const fl = await tp.evaluate(() => window.__boardState().flipped);
    const m = c.moves({ verbose: true }).find((x) => x.piece === 'n');
    await tp.evaluate(() => document.querySelector('.b2-field').scrollIntoView({ block: 'center' }));
    await tp.waitForTimeout(300);
    const box = await tp.locator('.b2-field').boundingBox();
    const at = (sq) => { let f = 'abcdefgh'.indexOf(sq[0]), r = +sq[1] - 1; if (fl) { f = 7 - f; r = 7 - r; } return [box.x + (box.width * (f + 0.5)) / 8, box.y + (box.height * (7 - r + 0.5)) / 8]; };
    await tp.touchscreen.tap(...at(m.from));
    await tp.waitForTimeout(80);
    const pr = tp.evaluate(() => window.__probe(1500, true));
    await tp.touchscreen.tap(...at(m.to));
    const fr = await pr;
    const st = await tp.evaluate(() => window.__boardState());
    const iss = glide(fr, st, m.from, m.to, fl, { remote: false, first: true }).issues;
    const san2 = await tp.evaluate(() => document.querySelector('.stage-side .move-strip')?.textContent ?? '');
    if (!san2.includes(m.san)) iss.push('tap move not applied');
    record(current, !iss.length, iss.join('; ') || `tapped ${m.san} (${firstCompleted(fr, st).plan?.total} ms, no pre)`);
    if (VIDEO) await tp.screenshot({ path: join(VIDEO, 'prod-phone.png') });
    await tctx.close();
  });

  await scenario('prod · spectated broadcast moves are pre-highlighted', async () => {
    const sctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const sp = await sctx.newPage();
    sp.on('pageerror', (e) => errors.push(`[prod spectate] ${e.message}`));
    await sp.addInitScript(PROBE);
    await sp.goto(base + '/');
    await sp.fill('.name-in', 'Watcher');
    await sp.click('text=ENTER THE DUST PITS');
    await sp.waitForSelector('text=Casual game', { timeout: 120000 });
    await sp.click('.tab >> text=Spectate');
    await sp.click('.feature.tappable');
    await sp.waitForSelector('.b2-field');
    await sp.waitForFunction(() => window.__boardState().plan, null, { timeout: 90000 });
    await sp.waitForFunction(() => window.__boardState().anim === 'idle', null, { timeout: 5000 });
    const plan = await sp.evaluate(() => window.__boardState().plan);
    record(current, plan.remote && plan.pre >= 60, JSON.stringify(plan));
    await sctx.close();
  });

  if (VIDEO) {
    mkdirSync(VIDEO, { recursive: true });
    const vctx = await browser.newContext({ viewport: { width: 1100, height: 860 }, recordVideo: { dir: VIDEO, size: { width: 1100, height: 860 } } });
    const vp = await vctx.newPage();
    await vp.goto(base + '/');
    await vp.fill('.name-in', 'Video');
    await vp.click('text=ENTER THE DUST PITS');
    await vp.waitForSelector('text=Casual game', { timeout: 120000 });
    await vp.click('text=Casual game');
    await vp.waitForSelector('.b2-field');
    for (let i = 0; i < 3; i++) {
      await vp.waitForFunction(() => document.querySelector('.turn-tag') && !document.querySelector('.thinking'), null, { timeout: 120000 });
      await vp.waitForTimeout(1100);
      const san = await vp.evaluate(() => [...document.querySelectorAll('.stage-side .move-strip .ms-pair')].map((e) => e.textContent.replace(/^\s*\d+\.\s*/, '').trim().split(/\s+/)).flat().filter(Boolean));
      const c = new Chess(); for (const s of san) c.move(s);
      const ms = c.moves({ verbose: true });
      const m = ms.find((x) => x.captured) ?? ms.find((x) => x.piece === 'n') ?? ms[0];
      const fl = await vp.evaluate(() => (document.querySelector('.b2-ranks span') || {}).textContent === '1');
      const box = await vp.locator('.b2-field').boundingBox();
      const at = (sq) => { let f = 'abcdefgh'.indexOf(sq[0]), r = +sq[1] - 1; if (fl) { f = 7 - f; r = 7 - r; } return [box.x + (box.width * (f + 0.5)) / 8, box.y + (box.height * (7 - r + 0.5)) / 8]; };
      await vp.mouse.click(...at(m.from)); await vp.waitForTimeout(250); await vp.mouse.click(...at(m.to));
    }
    await vp.waitForTimeout(2500);
    const v = vp.video();
    await vctx.close();
    console.log('video:', await v.path());
  }
}

// ---------------------------------------------------------------- main

const browser = await chromium.launch();
let dev, preview;
try {
  if (which === 'all' || which === 'lab') {
    dev = await vite.createServer({ server: { port: 0 }, logLevel: 'error' });
    await dev.listen();
    await labSuite(browser, `http://localhost:${dev.httpServer.address().port}`);
  }
  if (which === 'all' || which === 'prod') {
    let base = process.env.ANIM_URL;
    if (!base) {
      const outDir = process.env.ANIM_DIST ?? join(tmpdir(), 'gladius-anim-dist');
      if (!process.env.ANIM_NO_BUILD || !existsSync(join(outDir, 'index.html'))) await vite.build({ build: { outDir, emptyOutDir: true }, logLevel: 'warn' });
      preview = await vite.preview({ build: { outDir }, preview: { port: Number(process.env.ANIM_PORT ?? 4175), strictPort: false }, logLevel: 'warn' });
      base = preview.resolvedUrls.local[0].replace(/\/$/, '');
    }
    await prodSuite(browser, base);
  }
} finally {
  await browser.close();
  await dev?.close();
  await preview?.close?.();
  if (preview?.httpServer) preview.httpServer.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${errors.length ? `, ${errors.length} page errors:\n  ` + errors.slice(0, 10).join('\n  ') : ', no page errors'}`);
process.exit(failed.length || errors.length ? 1 : 0);
