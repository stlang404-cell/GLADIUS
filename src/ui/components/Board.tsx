import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { Chess, type Square, type Move } from 'chess.js';
import { Timeline, ease, moveDuration, planMove, prefersReducedMotion } from '../../board2d/animation';
import { boardImages, signatureTheme, themeById, type BoardTheme } from '../../board2d/themes';
import { DEFAULT_PIECE_SET, PIECE_SETS, normalizePieceStyle, pieceSetById, type PieceSetId } from '../../board2d/pieceSets';
import type { Settings } from '../../game/state';
import { sfx } from '../sound';

/**
 * The GLADIUS 2D board. Chess state is authoritative and lives outside; this
 * component renders a FEN, animates the move that produced it, and reports
 * moves. Animations are frame-driven timelines on DOM sprites (no layout
 * thrash, no React re-render per frame) and can be skipped at any instant.
 */
export type BoardProps = {
  fen: string;
  orientation: 'w' | 'b';
  interactive: boolean;
  onMove?: (uci: string) => void;
  lastMove?: Move | null;
  settings: Settings;
  set?: number; // arena index → signature board unless the player chose one
  mate?: boolean;
  resigned?: 'w' | 'b' | null;
  hint?: [Square, Square] | null;
  label?: string;
  arena?: number | null;
  azimuth?: number; // legacy prop (ignored)
};

export type PieceStyle = PieceSetId;
/** Piece collections, derived from src/board2d/pieceSets.ts (kept here for compatibility). */
export const PIECE_STYLES: { id: PieceStyle; name: string; description: string }[] = PIECE_SETS.map((p) => ({ id: p.id, name: p.name, description: p.description }));

export function pieceSrc(style: PieceStyle | string, color: 'w' | 'b', type: string): string {
  const set = pieceSetById(style) ?? pieceSetById(DEFAULT_PIECE_SET)!;
  return new URL(`pieces/${set.folder}/${color}${type}.webp`, document.baseURI).href;
}

/** Total duration of one move for these settings (0 = instant: Reduce motion or the OS preference). */
export function animMs(s: Settings): number {
  return moveDuration(s.animSpeed, s.animMs, s.reduceMotion || prefersReducedMotion());
}
/** When an opponent's (pre-highlighted) move lands, ms after it is shown — for sounds. */
export function landingMs(s: Settings): number {
  const p = planMove(animMs(s), { remote: true });
  return p.pre + p.glide;
}

export function resolveTheme(s: Settings, arena: number): BoardTheme {
  const chosen = s.boardTheme && s.boardTheme !== 'arena' ? themeById(s.boardTheme) : undefined;
  return chosen ?? signatureTheme(arena);
}
export function resolvePieces(s: Settings, theme: BoardTheme): PieceStyle {
  const p = normalizePieceStyle(s.pieceStyle);
  return p !== 'board' ? p : theme.pieces;
}

export function moveAnimFrom(m: Move | null | undefined) {
  if (!m) return null;
  const a: { from: Square; to: Square; promotion?: string; captured?: boolean; castle?: { rookFrom: Square; rookTo: Square }; epSquare?: Square; piece: string } = {
    from: m.from, to: m.to, promotion: m.promotion, captured: !!m.captured, piece: m.piece,
  };
  if (m.isKingsideCastle()) a.castle = m.color === 'w' ? { rookFrom: 'h1', rookTo: 'f1' } : { rookFrom: 'h8', rookTo: 'f8' };
  if (m.isQueensideCastle()) a.castle = m.color === 'w' ? { rookFrom: 'a1', rookTo: 'd1' } : { rookFrom: 'a8', rookTo: 'd8' };
  if (m.isEnPassant()) a.epSquare = (m.to[0] + m.from[1]) as Square;
  return a;
}

const FILES = 'abcdefgh';
/** Same position for animation purposes (placement + side to move; ignores ep/castling/clock notation). */
const samePos = (a: string | undefined, b: string | undefined) => !!a && !!b && a.split(' ').slice(0, 2).join(' ') === b.split(' ').slice(0, 2).join(' ');
const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

type Sprite = { id: number; type: string; color: 'w' | 'b'; sq: Square; dying?: boolean; promoFrom?: boolean };
let spriteSerial = 1;

/** Track piece identities across positions so each move animates the right sprite. */
function nextSprites(prev: Sprite[], chess: Chess, last: Move | null | undefined): Sprite[] {
  const live = prev.filter((s) => !s.dying);
  const out: Sprite[] = [];
  const bySq = new Map(live.map((s) => [s.sq, { ...s, promoFrom: false }]));
  const used = new Set<number>();
  if (last) {
    const a = moveAnimFrom(last)!;
    const mover = bySq.get(a.from);
    const capSq = a.epSquare ?? a.to;
    const victim = last.captured ? bySq.get(capSq) : undefined;
    if (victim) {
      out.push({ ...victim, dying: true });
      used.add(victim.id);
      bySq.delete(capSq);
    }
    if (mover) {
      bySq.delete(a.from);
      bySq.set(a.to, { ...mover, sq: a.to, type: a.promotion ?? mover.type, promoFrom: !!a.promotion });
    }
    if (a.castle) {
      const rook = bySq.get(a.castle.rookFrom);
      if (rook) {
        bySq.delete(a.castle.rookFrom);
        bySq.set(a.castle.rookTo, { ...rook, sq: a.castle.rookTo });
      }
    }
  }
  for (const row of chess.board())
    for (const pc of row) {
      if (!pc) continue;
      const s = bySq.get(pc.square);
      if (s && s.color === pc.color && s.type === pc.type && !used.has(s.id)) {
        out.push({ ...s, sq: pc.square });
        used.add(s.id);
      } else out.push({ id: spriteSerial++, type: pc.type, color: pc.color, sq: pc.square });
    }
  return out;
}

function kingSquare(c: Chess, color: 'w' | 'b'): Square | null {
  for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  return null;
}

export function Board(props: BoardProps) {
  const { fen, interactive, onMove, settings } = props;
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [sel, setSelState] = useState<Square | null>(null);
  const selRef = useRef<Square | null>(null);
  const setSel = (v: Square | null) => {
    selRef.current = v;
    setSelState(v);
  };
  const [cursor, setCursor] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square; drop?: { x: number; y: number } } | null>(null);
  const [announce, setAnnounce] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<number, HTMLImageElement>());
  const fx = useRef<HTMLDivElement>(null);
  const tl = useRef(new Timeline());
  const raf = useRef(0);
  const anims = useRef<Animation[]>([]); // WAAPI effects (mark fade-ins, check pulse) that skip() must finish
  const drag = useRef<{ id: number; from: Square; x0: number; y0: number; active: boolean } | null>(null);
  /** The move this board itself just sent (tap/drag/keyboard), so it animates without the opponent pre-highlight. */
  const localMove = useRef<{ uci: string; drop?: { x: number; y: number } } | null>(null);
  /** Sprite ids lying toppled (mate / resignation) and their resting pose. */
  const toppled = useRef(new Map<number, { dx: number; dy: number; extra: string; filter: string }>());
  const flip = props.orientation === 'b';
  const theme = resolveTheme(settings, props.arena ?? props.set ?? 0);
  const style = resolvePieces(settings, theme);
  const imgs = useMemo(() => boardImages(theme), [theme]);
  const D = animMs(settings);

  const pct = (sq: Square) => {
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]) - 1;
    return { x: (flip ? 7 - f : f) * 100, y: (flip ? r : 7 - r) * 100 };
  };
  /** Ground position first (what tests read), then lift and pose. */
  const setT = (el: HTMLElement | undefined, x: number, y: number, extra = '') => {
    if (el) el.style.transform = `translate(${x}%, ${y}%)${extra ? ' ' + extra : ''}`;
  };

  /** Put every sprite exactly where the position says, clear transient styles. */
  const settleAll = () => {
    const d = drag.current?.active ? drag.current.id : -1;
    for (const s of spritesRef.current ?? []) {
      const el = els.current.get(s.id);
      if (!el || s.id === d) continue;
      const p = pct(s.sq);
      const top = toppled.current.get(s.id);
      setT(el, p.x + (top?.dx ?? 0), p.y + (top?.dy ?? 0), top?.extra ?? '');
      el.style.filter = top?.filter ?? '';
      el.style.zIndex = '';
      el.style.opacity = s.dying ? '0' : '';
      delete el.dataset.promoted;
    }
  };
  /** Finish everything in flight: timeline, CSS/WAAPI effects, transient poses. */
  const finishAll = () => {
    tl.current.skip();
    for (const a of anims.current) {
      try {
        a.finish();
      } catch {
        /* already finished or cancelled */
      }
    }
    anims.current = [];
    fx.current?.replaceChildren();
    settleAll();
    const field = boardRef.current;
    if (field && field.dataset.anim !== 'idle') {
      field.dataset.anim = 'idle';
      field.dataset.animDone = String(Math.round(performance.now()));
    }
  };

  // Sprite identities are derived synchronously with the position so the
  // layout effect below sees the new arrangement in the same commit. Anything
  // still animating is completed first, so the DOM matches the outgoing
  // position before React writes the incoming one (no snapping, no ghosts).
  const spritesRef = useRef<Sprite[] | null>(null);
  const spriteFen = useRef<string>('');
  if (spritesRef.current === null) {
    spritesRef.current = nextSprites([], chess, null);
    spriteFen.current = fen;
  } else if (spriteFen.current !== fen) {
    finishAll();
    const last = props.lastMove && samePos(props.lastMove.after, fen) && samePos(props.lastMove.before, spriteFen.current) ? props.lastMove : null;
    spritesRef.current = nextSprites(spritesRef.current, chess, last);
    spriteFen.current = fen;
  }
  const sprites = spritesRef.current;
  const [, forceRender] = useState(0);
  const setSprites = (f: (s: Sprite[]) => Sprite[]) => {
    const next = f(spritesRef.current ?? []);
    if (next !== spritesRef.current) {
      spritesRef.current = next;
      forceRender((n) => n + 1);
    }
  };
  const lastAnimFen = useRef(fen);

  useEffect(() => {
    setSel(null);
    setPromo(null);
    if (props.lastMove && samePos(props.lastMove.after, fen)) setAnnounce(`${props.lastMove.color === 'w' ? 'White' : 'Black'} ${props.lastMove.san}`);
  }, [fen]); // eslint-disable-line react-hooks/exhaustive-deps

  const runLoop = () => {
    cancelAnimationFrame(raf.current);
    let first = true;
    const step = () => {
      if (first) {
        first = false;
        const f = boardRef.current;
        const shift = tl.current.rebase();
        if (shift > 0) {
          // keep the CSS / WAAPI effects in step with the shifted motion
          for (const a of anims.current) if (a.startTime !== null) a.startTime = Number(a.startTime) + shift;
          for (const el of fx.current?.children ?? []) {
            const h = el as HTMLElement;
            h.style.animationDelay = `${(parseFloat(h.style.animationDelay) || 0) + shift}ms`;
          }
          if (f && f.dataset.anim !== 'idle') f.dataset.animStart = String(Math.round(performance.now() - 16));
        }
      }
      tl.current.tick();
      if (tl.current.active) raf.current = requestAnimationFrame(step);
      else {
        finishAll();
        setSprites((s) => (s.some((x) => x.dying) ? s.filter((x) => !x.dying) : s));
      }
    };
    raf.current = requestAnimationFrame(step);
  };
  const keep = (a: Animation | undefined) => {
    if (a) anims.current.push(a);
  };

  // Animate after React has committed the final positions (before paint).
  useLayoutEffect(() => {
    if (lastAnimFen.current === fen) return;
    const from = lastAnimFen.current;
    lastAnimFen.current = fen;
    const m = props.lastMove && samePos(props.lastMove.after, fen) && samePos(props.lastMove.before, from) ? props.lastMove : null;
    const mine = m && localMove.current && localMove.current.uci === m.from + m.to + (m.promotion ?? '') ? localMove.current : null;
    localMove.current = null;
    tl.current.begin();
    const field = boardRef.current;
    const a = m ? moveAnimFrom(m) : null;
    const mover = a ? sprites.find((s) => !s.dying && s.sq === a.to) : undefined;
    const moverEl = mover ? els.current.get(mover.id) : undefined;
    if (!a || !m || D === 0 || !moverEl) {
      finishAll();
      if (field) {
        const now = String(Math.round(performance.now()));
        field.dataset.animStart = field.dataset.animDone = now;
        field.dataset.animPlan = JSON.stringify({ pre: 0, glide: 0, settle: 0, total: 0, uci: m ? m.from + m.to + (m.promotion ?? '') : null, remote: !mine, dragged: false });
      }
      setSprites((s) => (s.some((x) => x.dying) ? s.filter((x) => !x.dying) : s));
      return;
    }
    const remote = !mine;
    const plan = planMove(D, { remote, dragged: !!mine?.drop });
    const { pre } = plan;
    const victim = sprites.find((s) => s.dying);
    const p0 = mine?.drop ?? pct(a.from), p1 = pct(a.to);
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y) / 100;
    const dx = (p1.x - p0.x) / (dist * 100 || 1), dy = (p1.y - p0.y) / (dist * 100 || 1);
    const knight = a.piece === 'n' && !mine?.drop;
    const lift = knight ? 30 : mine?.drop ? 0 : Math.min(10, 4 + dist * 2.5); // % of a square, applied as a separate translate
    // Promotions spend the end of the glide on the transformation.
    const glide = a.promotion && !mine?.drop ? Math.round(plan.glide * 0.62) : plan.glide;
    const promoDur = a.promotion ? Math.max(plan.glide - glide + plan.settle, Math.min(260, D * 0.3)) : 0;
    const tLand = pre + glide;
    const capture = !!victim;
    const stop = capture && !mine?.drop ? Math.max(0, dist - 0.42) : dist;
    const pc = { x: p0.x + dx * stop * 100, y: p0.y + dy * stop * 100 };
    const tA = capture ? pre + glide * 0.76 : tLand; // contact
    if (field) {
      field.dataset.anim = remote ? 'pre' : 'glide';
      field.dataset.animStart = String(Math.round(performance.now()));
      field.dataset.animPlan = JSON.stringify({ ...plan, uci: m.from + m.to + (m.promotion ?? ''), remote, dragged: !!mine?.drop });
    }
    moverEl.style.zIndex = '5';
    if (a.promotion && mover) moverEl.src = pieceSrc(style, mover.color, 'p');
    setT(moverEl, p0.x, p0.y);
    // 1 · Pre-highlight (opponent / engine / spectated moves): the piece rises and glows on its square.
    if (pre > 0) {
      tl.current.add(0, pre, (k) => {
        const e = ease.outCubic(k);
        setT(moverEl, p0.x, p0.y, `translateY(${-e * 4}%) scale(${1 + e * 0.08})`);
        moverEl.style.filter = `drop-shadow(0 0 ${2 + e * 5}px rgba(255, 200, 80, ${0.35 + e * 0.6})) drop-shadow(0 ${3 + e * 6}px ${3 + e * 4}px rgba(40,25,10,.3))`;
      });
      burst(fx.current, pct(a.from), 'pre', 0, pre + glide * 0.35);
    }
    // 2 · Glide (and, on captures, stop at contact then push in).
    const tGlide = capture ? tA - pre : glide;
    tl.current.add(pre, tGlide, (k) => {
      const e = capture ? ease.inOutSine(k) : ease.inOutCubic(k);
      const arc = Math.sin(Math.PI * Math.min(1, capture ? e * 0.9 : e));
      const s0 = pre > 0 ? 0.08 * (1 - e) : 0;
      const x = p0.x + (pc.x - p0.x) * e, y = p0.y + (pc.y - p0.y) * e;
      const up = pre > 0 ? 4 * (1 - e) + arc * lift : arc * lift;
      setT(moverEl, x, y, `translateY(${-up}%) scale(${1 + s0 + arc * 0.1}) rotate(${arc * 4 * dx}deg)`);
      const glow = pre > 0 ? `drop-shadow(0 0 ${7 * (1 - e)}px rgba(255, 200, 80, ${0.95 * (1 - e)})) ` : '';
      moverEl.style.filter = `${glow}drop-shadow(0 ${4 + arc * 16}px ${4 + arc * 10}px rgba(40,25,10,${0.35 - arc * 0.12}))`;
    });
    if (capture) {
      tl.current.add(tA, tLand - tA, (k) => {
        const e = ease.outCubic(k);
        setT(moverEl, pc.x + (p1.x - pc.x) * e, pc.y + (p1.y - pc.y) * e);
        moverEl.style.filter = '';
      });
    }
    // 3 · Weighted settle.
    tl.current.add(tLand, plan.settle, (k) => {
      const s = 1 - Math.sin(Math.PI * k) * 0.05;
      setT(moverEl, p1.x, p1.y, a.promotion ? '' : `scale(${2 - s}, ${s})`);
      moverEl.style.filter = '';
    }, () => {
      moverEl.style.zIndex = '';
      if (!a.promotion) setT(moverEl, p1.x, p1.y);
    });
    // Promotion: the pawn shrinks into a golden flare and the chosen piece pops out.
    if (a.promotion && mover) {
      const target = a.promotion;
      tl.current.add(tLand, promoDur, (k) => {
        if (k < 0.42) setT(moverEl, p1.x, p1.y, `scale(${1 - ease.inCubic(k / 0.42) * 0.9})`);
        else {
          if (!moverEl.dataset.promoted) {
            moverEl.src = pieceSrc(style, mover.color, target);
            moverEl.dataset.promoted = '1';
          }
          setT(moverEl, p1.x, p1.y, `scale(${0.1 + ease.outBack((k - 0.42) / 0.58) * 0.9})`);
        }
      }, () => {
        moverEl.src = pieceSrc(style, mover.color, target);
        delete moverEl.dataset.promoted;
        setT(moverEl, p1.x, p1.y);
      });
      burst(fx.current, p1, 'promo', tLand, promoDur * 1.6);
    }
    // Victim: struck at contact, tumbles away and is gone by the landing.
    if (victim) {
      const vel = els.current.get(victim.id);
      const pv = pct(victim.sq);
      const t0v = Math.max(pre, tA - 30);
      if (vel) {
        setT(vel, pv.x, pv.y);
        vel.style.zIndex = '3';
        tl.current.add(t0v, Math.max(60, tLand + plan.settle - t0v), (k) => {
          const e = ease.outCubic(k);
          setT(vel, pv.x + dx * 24 * e, pv.y + dy * 24 * e, `translateY(${-Math.sin(Math.PI * Math.min(1, k * 1.6)) * 8}%) rotate(${e * 40 * (dx || 1)}deg) scale(${1 - e * 0.35})`);
          vel.style.opacity = String(1 - ease.inCubic(Math.min(1, Math.max(0, (k - 0.15) / 0.8))));
        }, () => {
          vel.style.opacity = '0';
        });
      }
      burst(fx.current, pv, 'hit', tA - pre * 0, Math.max(200, D * 0.55));
    }
    // Castling: the king steps aside, the rook hops over him in concert.
    if (a.castle) {
      const rook = sprites.find((s) => !s.dying && s.sq === a.castle!.rookTo);
      const rel = rook ? els.current.get(rook.id) : undefined;
      const r0 = pct(a.castle.rookFrom), r1 = pct(a.castle.rookTo);
      if (rel) {
        setT(rel, r0.x, r0.y);
        rel.style.zIndex = '6';
        const rs = pre + glide * 0.3;
        tl.current.add(rs, tLand - rs, (k) => {
          const e = ease.inOutCubic(k);
          const arc = Math.sin(Math.PI * e);
          setT(rel, r0.x + (r1.x - r0.x) * e, r0.y + (r1.y - r0.y) * e, `translateY(${-arc * 30}%) scale(${1 + arc * 0.1})`);
          rel.style.filter = `drop-shadow(0 ${4 + arc * 14}px ${4 + arc * 8}px rgba(40,25,10,.3))`;
        }, () => {
          rel.style.zIndex = '';
          rel.style.filter = '';
          setT(rel, r1.x, r1.y);
        });
      }
    }
    // 4 · The completed move is highlighted: the destination mark fades in on landing.
    for (const mk of field?.querySelectorAll<HTMLElement>('.mk.last:not(.from), .mk.check') ?? [])
      keep(mk.animate?.([{ opacity: 0 }, { opacity: 1 }], { delay: tLand, duration: Math.max(120, plan.settle + 60), fill: 'backwards', easing: 'ease-out' }));
    if (remote) burst(fx.current, p1, 'land', tLand - Math.min(60, glide * 0.1), plan.settle + Math.min(60, glide * 0.1));
    // Check: the threatened king flashes red as the piece lands.
    if (chess.isCheck()) {
      const ks = kingSquare(chess, chess.turn());
      const kspr = sprites.find((s) => !s.dying && s.sq === ks);
      const kel = kspr ? els.current.get(kspr.id) : undefined;
      keep(kel?.animate?.(
        [{ filter: 'drop-shadow(0 0 0 rgba(220,40,40,0))' }, { filter: 'drop-shadow(0 0 9px rgba(225,35,35,.95))' }, { filter: 'drop-shadow(0 0 0 rgba(220,40,40,0))' }, { filter: 'drop-shadow(0 0 9px rgba(225,35,35,.95))' }, { filter: 'drop-shadow(0 0 0 rgba(220,40,40,0))' }],
        { delay: tLand, duration: Math.max(360, D * 0.8), easing: 'ease-in-out' },
      ));
    }
    if (field) {
      if (remote) tl.current.add(pre, 0, () => (field.dataset.anim = 'glide'));
      field.dataset.animPlan = JSON.stringify({ ...plan, total: Math.round(tl.current.endsAt), uci: m.from + m.to + (m.promotion ?? ''), remote, dragged: !!mine?.drop });
    }
    runLoop();
  }, [fen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mate / resignation: the beaten king topples once the move has landed; on mate a victory laurel flares.
  useEffect(() => {
    const loser = props.resigned ?? (props.mate ? chess.turn() : null);
    if (!loser) {
      if (toppled.current.size) {
        finishAll();
        toppled.current.clear();
        settleAll();
      }
      return;
    }
    const k = kingSquare(chess, loser);
    const s = sprites.find((x) => !x.dying && x.sq === k);
    const el = s ? els.current.get(s.id) : undefined;
    if (!el || !k || !s) return;
    const p = pct(k);
    const side = FILES.indexOf(k[0]) < 4 !== flip ? 1 : -1;
    const pose = { dx: side * 12, dy: 10, extra: `rotate(${side * 82}deg)`, filter: 'grayscale(.6) brightness(.85)' };
    if (toppled.current.has(s.id)) return;
    if (D === 0) {
      toppled.current.set(s.id, pose);
      settleAll();
      return;
    }
    const running = tl.current.active;
    if (!running) tl.current.begin();
    const t0 = running ? tl.current.endsAt + 120 : 0;
    const field = boardRef.current;
    if (field && !running) {
      field.dataset.anim = 'topple';
      field.dataset.animStart = String(Math.round(performance.now()));
    }
    if (props.mate && props.lastMove) burst(fx.current, pct(props.lastMove.to), 'win', t0 - tl.current.elapsed, Math.max(700, D));
    tl.current.add(t0, Math.max(600, D * 0.8), (kk) => {
      const e = ease.outCubic(kk);
      setT(el, p.x + e * pose.dx, p.y + e * pose.dy, `rotate(${e * side * 82}deg)`);
      el.style.filter = `grayscale(${e * 0.6}) brightness(${1 - e * 0.15})`;
    }, () => toppled.current.set(s.id, pose));
    // A skip at any moment lands the king in its final pose.
    toppled.current.set(s.id, pose);
    runLoop();
  }, [props.mate, props.resigned, fen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    tl.current.skip();
    for (const a of anims.current) a.cancel();
    anims.current = [];
  }, []);

  // ── Input ────────────────────────────────────────────────────────────
  const legal = useMemo(() => (sel ? chess.moves({ square: sel, verbose: true }) : []), [chess, sel]);
  const targets = legal.filter((m) => !m.captured).map((m) => m.to);
  const captures = legal.filter((m) => m.captured).map((m) => m.to);

  /** Send one of the player's own moves (animated without the opponent pre-highlight). */
  const send = (uci: string, drop?: { x: number; y: number }) => {
    localMove.current = { uci, drop };
    onMove?.(uci);
  };
  const tryMove = (from: Square, to: Square, drop?: { x: number; y: number }): boolean => {
    const cand = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!cand.length) return false;
    if (cand.some((m) => m.promotion)) {
      if (settings.autoQueen) send(from + to + 'q', drop && pct(to));
      else setPromo({ from, to, drop: drop && pct(to) });
    } else send(from + to, drop);
    setSel(null);
    return true;
  };

  const tap = (sq: Square) => {
    if (!interactive) return;
    if (tl.current.active) finishAll(); // never make the player wait for an animation
    const piece = chess.get(sq);
    const cur = selRef.current;
    if (cur && cur !== sq && tryMove(cur, sq)) return;
    if (piece && piece.color === chess.turn()) {
      setSel(sq === cur ? null : sq);
      sfx('select', settings);
    } else setSel(null);
  };

  const squareAt = (clientX: number, clientY: number): Square | null => {
    const r = boardRef.current?.getBoundingClientRect();
    if (!r) return null;
    let f = Math.floor(((clientX - r.left) / r.width) * 8);
    let rr = 7 - Math.floor(((clientY - r.top) / r.height) * 8);
    if (f < 0 || f > 7 || rr < 0 || rr > 7) return null;
    if (flip) {
      f = 7 - f;
      rr = 7 - rr;
    }
    return (FILES[f] + (rr + 1)) as Square;
  };

  const onPointerDown = (e: RPointerEvent) => {
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    const pc = chess.get(sq);
    if (interactive && pc && pc.color === chess.turn()) {
      const s = sprites.find((x) => !x.dying && x.sq === sq);
      if (s) drag.current = { id: s.id, from: sq, x0: e.clientX, y0: e.clientY, active: false };
      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        /* synthetic or already-released pointer */
      }
    }
    tap(sq);
  };
  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.active && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
    d.active = true;
    const el = els.current.get(d.id);
    const r = boardRef.current!.getBoundingClientRect();
    if (el) {
      const x = ((e.clientX - r.left) / r.width) * 800 - 50;
      const y = ((e.clientY - r.top) / r.height) * 800 - 62;
      el.style.zIndex = '9';
      el.style.filter = 'drop-shadow(0 18px 14px rgba(40,25,10,.28))';
      setT(el, x, y, 'scale(1.14)');
    }
  };
  const onPointerUp = (e: RPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active) return;
    const el = els.current.get(d.id);
    const to = squareAt(e.clientX, e.clientY);
    const r = boardRef.current!.getBoundingClientRect();
    const drop = { x: ((e.clientX - r.left) / r.width) * 800 - 50, y: ((e.clientY - r.top) / r.height) * 800 - 62 };
    const ok = to && to !== d.from && tryMove(d.from, to, drop);
    if (el) {
      el.style.zIndex = '';
      el.style.filter = '';
      if (!ok) {
        const p = pct(d.from);
        setT(el, p.x, p.y);
        setSel(d.from);
      } else if (to && !localMove.current) {
        // promotion dialog open: rest the pawn on the promotion square meanwhile
        const p = pct(to);
        setT(el, p.x, p.y);
      }
    }
  };

  const onKey = (e: KeyboardEvent) => {
    const cur = cursor ?? (props.orientation === 'w' ? 'e2' : 'e7');
    let f = FILES.indexOf(cur[0]);
    let r = Number(cur[1]) - 1;
    const k = flip ? -1 : 1;
    switch (e.key) {
      case 'ArrowUp': r += k; break;
      case 'ArrowDown': r -= k; break;
      case 'ArrowLeft': f -= k; break;
      case 'ArrowRight': f += k; break;
      case 'Enter': case ' ':
        e.preventDefault();
        tap(cur as Square);
        setCursor(cur as Square);
        return;
      case 'Escape': setSel(null); return;
      default: return;
    }
    e.preventDefault();
    f = Math.max(0, Math.min(7, f));
    r = Math.max(0, Math.min(7, r));
    const sq = (FILES[f] + (r + 1)) as Square;
    setCursor(sq);
    const pc = chess.get(sq);
    setAnnounce(`${sq}${pc ? `, ${pc.color === 'w' ? 'white' : 'black'} ${NAMES[pc.type]}` : ''}${targets.includes(sq) || captures.includes(sq) ? ', legal move' : ''}`);
  };

  const inCheck = chess.isCheck() ? kingSquare(chess, chess.turn()) : null;
  const marks: { sq: Square; cls: string }[] = [];
  if (props.lastMove && samePos(props.lastMove.after, fen)) marks.push({ sq: props.lastMove.from, cls: 'last from' }, { sq: props.lastMove.to, cls: 'last' });
  if (props.hint) marks.push({ sq: props.hint[0], cls: 'hint' }, { sq: props.hint[1], cls: 'hint' });
  if (sel) marks.push({ sq: sel, cls: 'sel' });
  if (inCheck) marks.push({ sq: inCheck, cls: 'check' });
  if (settings.showLegal) {
    for (const t of targets) marks.push({ sq: t, cls: 'dot' });
    for (const t of captures) marks.push({ sq: t, cls: 'ring' });
  }
  if (cursor) marks.push({ sq: cursor, cls: 'cursor' });

  const ranks = flip ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'];
  const files = flip ? 'hgfedcba'.split('') : 'abcdefgh'.split('');

  return (
    <div
      className="board-wrap"
      tabIndex={0}
      role="application"
      aria-label={props.label ?? 'Chessboard. Arrow keys move the cursor, Enter selects.'}
      onKeyDown={onKey}
      onBlur={() => setCursor(null)}
      style={{ ['--trim' as string]: theme.trim, ['--coord' as string]: theme.ink }}
    >
      <div className="b2-frame" style={{ backgroundImage: `url(${imgs.frame})` }}>
        {settings.showCoords && <div className="b2-ranks" aria-hidden>{ranks.map((r) => <span key={r}>{r}</span>)}</div>}
        {settings.showCoords && <div className="b2-files" aria-hidden>{files.map((f) => <span key={f}>{f}</span>)}</div>}
        <div
          className="b2-field"
          ref={boardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={() => finishAll()}
        >
          <div className="b2-squares" style={{ backgroundImage: `url(${imgs.squares})`, transform: flip ? 'rotate(180deg)' : undefined }} />
          <div className="b2-marks">
            {marks.map((m, i) => {
              const p = pct(m.sq);
              return <span key={i} className={'mk ' + m.cls} style={{ transform: `translate(${p.x}%, ${p.y}%)` }} />;
            })}
          </div>
          <div className="b2-sprites">
            {sprites.map((s) => {
              const p = pct(s.sq);
              return (
                <img
                  key={s.id}
                  ref={(el) => {
                    if (el) els.current.set(s.id, el);
                    else els.current.delete(s.id);
                  }}
                  data-sid={s.id}
                  className={'pc' + (sel === s.sq && !s.dying ? ' lifted' : '') + (s.dying ? ' dying' : '')}
                  src={pieceSrc(style, s.color, s.type)}
                  alt=""
                  draggable={false}
                  style={{ transform: `translate(${p.x}%, ${p.y}%)` }}
                />
              );
            })}
          </div>
          <div className="b2-fx" ref={fx} />
        </div>
      </div>
      {promo && (
        <div className="promo" role="dialog" aria-label="Choose promotion">
          {(['q', 'r', 'b', 'n'] as const).map((p) => (
            <button key={p} onClick={() => { send(promo.from + promo.to + p, promo.drop); setPromo(null); }} aria-label={`Promote to ${NAMES[p]}`}>
              <img src={pieceSrc(style, chess.turn(), p)} alt="" />
            </button>
          ))}
        </div>
      )}
      <div className="sr-only" aria-live="polite">{announce}</div>
    </div>
  );
}

/**
 * Small, tasteful effects layer: origin glow before an opponent's move (pre),
 * landing ring (land), impact ring on captures (hit), golden flare on
 * promotion (promo), victory laurel on mate (win). finishAll() clears the layer.
 */
function burst(layer: HTMLDivElement | null, p: { x: number; y: number }, kind: 'pre' | 'land' | 'hit' | 'promo' | 'win', delay: number, dur: number) {
  if (!layer || dur <= 0) return;
  const el = document.createElement('span');
  el.className = 'fx ' + kind;
  el.style.transform = `translate(${p.x}%, ${p.y}%)`;
  el.style.animationDelay = `${Math.round(Math.max(0, delay))}ms`;
  el.style.animationDuration = `${Math.round(dur)}ms`;
  el.addEventListener('animationend', () => el.remove());
  layer.appendChild(el);
}
