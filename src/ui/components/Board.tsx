import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { Chess, type Square, type Move } from 'chess.js';
import { Timeline, ease, moveDuration } from '../../board2d/animation';
import { boardImages, signatureTheme, themeById, type BoardTheme } from '../../board2d/themes';
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

export type PieceStyle = 'classical' | 'imperial' | 'marble';
export const PIECE_STYLES: { id: PieceStyle; name: string }[] = [
  { id: 'classical', name: 'Ivory & Bronze' },
  { id: 'imperial', name: 'Imperial Gold & Crimson' },
  { id: 'marble', name: 'Carrara & Nero Marble' },
];

export function pieceSrc(style: PieceStyle, color: 'w' | 'b', type: string): string {
  return new URL(`pieces/${style}/${color}${type}.webp`, document.baseURI).href;
}

export function animMs(s: Settings): number {
  return moveDuration(s.animSpeed, s.animMs, s.reduceMotion);
}

export function resolveTheme(s: Settings, arena: number): BoardTheme {
  const chosen = s.boardTheme && s.boardTheme !== 'arena' ? themeById(s.boardTheme) : undefined;
  return chosen ?? signatureTheme(arena);
}
export function resolvePieces(s: Settings, theme: BoardTheme): PieceStyle {
  const p = s.pieceStyle;
  return p && p !== 'board' ? (p as PieceStyle) : theme.pieces;
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
  const [sel, setSel] = useState<Square | null>(null);
  const [cursor, setCursor] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [announce, setAnnounce] = useState('');
  const [sprites, setSprites] = useState<Sprite[]>(() => nextSprites([], chess, null));
  const prevFen = useRef(fen);
  const lastAnimFen = useRef(fen);
  const boardRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<number, HTMLImageElement>());
  const fx = useRef<HTMLDivElement>(null);
  const tl = useRef(new Timeline());
  const raf = useRef(0);
  const drag = useRef<{ id: number; from: Square; x0: number; y0: number; active: boolean } | null>(null);
  const skipNextAnim = useRef(false);
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
  const setT = (el: HTMLElement | undefined, x: number, y: number, extra = '') => {
    if (el) el.style.transform = `translate(${x}%, ${y}%) ${extra}`;
  };

  useEffect(() => {
    setSel(null);
    setPromo(null);
    if (props.lastMove && props.lastMove.after === fen) setAnnounce(`${props.lastMove.color === 'w' ? 'White' : 'Black'} ${props.lastMove.san}`);
  }, [fen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sprite bookkeeping when the position changes.
  useEffect(() => {
    if (prevFen.current === fen) return;
    const last = props.lastMove && props.lastMove.after === fen && props.lastMove.before === prevFen.current ? props.lastMove : null;
    prevFen.current = fen;
    setSprites((s) => nextSprites(s, chess, last));
  }, [fen]); // eslint-disable-line react-hooks/exhaustive-deps

  const runLoop = () => {
    cancelAnimationFrame(raf.current);
    const step = () => {
      tl.current.tick();
      if (tl.current.active) raf.current = requestAnimationFrame(step);
      else setSprites((s) => (s.some((x) => x.dying) ? s.filter((x) => !x.dying) : s));
    };
    raf.current = requestAnimationFrame(step);
  };

  // Animate after React has committed the final positions (before paint).
  useLayoutEffect(() => {
    if (lastAnimFen.current === fen) return;
    const from = lastAnimFen.current;
    lastAnimFen.current = fen;
    const m = props.lastMove && props.lastMove.after === fen && props.lastMove.before === from ? props.lastMove : null;
    tl.current.begin(); // completes anything still running
    if (!m || D === 0 || skipNextAnim.current) {
      skipNextAnim.current = false;
      setSprites((s) => s.filter((x) => !x.dying));
      return;
    }
    const a = moveAnimFrom(m)!;
    const byId = new Map(sprites.map((s) => [s.id, s]));
    const mover = sprites.find((s) => !s.dying && s.sq === a.to);
    const victim = sprites.find((s) => s.dying);
    const moverEl = mover ? els.current.get(mover.id) : undefined;
    const p0 = pct(a.from), p1 = pct(a.to);
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y) / 100;
    const travel = D * (0.78 + 0.22 * Math.min(dist, 5) / 5);
    const knight = a.piece === 'n';
    const liftPct = knight ? 34 : 9;
    const dx = (p1.x - p0.x) / (dist * 100 || 1), dy = (p1.y - p0.y) / (dist * 100 || 1);
    // Mover: approach (and stop short on captures), lift, settle.
    const capture = !!victim;
    const stop = capture ? Math.max(0, dist - 0.42) : dist;
    const pc = { x: p0.x + dx * stop * 100, y: p0.y + dy * stop * 100 };
    const tA = capture ? travel * 0.72 : travel;
    if (moverEl) {
      moverEl.style.zIndex = '5';
      if (a.promotion && mover) moverEl.src = pieceSrc(style, mover.color, 'p');
      setT(moverEl, p0.x, p0.y);
      tl.current.add(0, tA, (k) => {
        const e = ease.inOutCubic(k);
        const arc = Math.sin(Math.PI * e);
        const x = p0.x + (pc.x - p0.x) * e, y = p0.y + (pc.y - p0.y) * e - arc * liftPct;
        setT(moverEl, x, y, `scale(${1 + arc * 0.12}) rotate(${arc * 4 * dx}deg)`);
        moverEl.style.filter = `drop-shadow(0 ${4 + arc * 16}px ${4 + arc * 10}px rgba(40,25,10,${0.35 - arc * 0.12}))`;
      });
      let tLand = tA;
      if (capture) {
        const t2 = tA + D * 0.06;
        const dur2 = travel * 0.36;
        tl.current.add(t2, dur2, (k) => {
          const e = ease.outCubic(k);
          setT(moverEl, pc.x + (p1.x - pc.x) * e, pc.y + (p1.y - pc.y) * e);
        });
        tLand = t2 + dur2;
      }
      // Weighted settle.
      tl.current.add(tLand, Math.min(220, D * 0.28), (k) => {
        const s = 1 - Math.sin(Math.PI * k) * 0.05;
        setT(moverEl, p1.x, p1.y, `scale(${2 - s}, ${s})`);
        moverEl.style.filter = '';
      }, () => {
        moverEl.style.zIndex = '';
        setT(moverEl, p1.x, p1.y);
      });
      if (a.promotion && mover) {
        tl.current.add(tLand, D * 0.5, (k) => {
          if (k < 0.45) setT(moverEl, p1.x, p1.y, `scale(${1 - ease.inCubic(k / 0.45) * 0.9})`);
          else {
            if (!moverEl.dataset.promoted) {
              moverEl.src = pieceSrc(style, mover.color, a.promotion!);
              moverEl.dataset.promoted = '1';
            }
            setT(moverEl, p1.x, p1.y, `scale(${0.1 + ease.outBack((k - 0.45) / 0.55) * 0.9})`);
          }
        }, () => {
          delete moverEl.dataset.promoted;
          setT(moverEl, p1.x, p1.y);
        });
        burst(fx.current, p1, 'promo', tLand, D);
      }
    }
    // Victim: hit at contact, tumble and fade.
    if (victim) {
      const vel = els.current.get(victim.id);
      const pv = pct(victim.sq);
      if (vel) {
        setT(vel, pv.x, pv.y);
        tl.current.add(tA - D * 0.03, D * 0.6, (k) => {
          const e = ease.outCubic(k);
          setT(vel, pv.x + dx * 22 * e, pv.y + dy * 22 * e - Math.sin(Math.PI * Math.min(1, k * 1.6)) * 8, `rotate(${e * 38 * (dx || 1)}deg) scale(${1 - e * 0.35})`);
          vel.style.opacity = String(1 - ease.inCubic(Math.max(0, (k - 0.25) / 0.75)));
        });
      }
      burst(fx.current, p1, 'hit', tA, D);
    }
    // Castling: the rook hops over in concert.
    if (a.castle) {
      const rook = sprites.find((s) => !s.dying && s.sq === a.castle!.rookTo);
      const rel = rook ? els.current.get(rook.id) : undefined;
      const r0 = pct(a.castle.rookFrom), r1 = pct(a.castle.rookTo);
      if (rel) {
        setT(rel, r0.x, r0.y);
        rel.style.zIndex = '4';
        tl.current.add(travel * 0.3, travel, (k) => {
          const e = ease.inOutCubic(k);
          const arc = Math.sin(Math.PI * e);
          setT(rel, r0.x + (r1.x - r0.x) * e, r0.y + (r1.y - r0.y) * e - arc * 26, `scale(${1 + arc * 0.1})`);
        }, () => {
          rel.style.zIndex = '';
          setT(rel, r1.x, r1.y);
        });
      }
    }
    // Sprites that didn't move stay put (new ones fade in on jumps).
    void byId;
    runLoop();
  }, [sprites, fen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mate / resignation: the beaten king topples.
  useEffect(() => {
    const loser = props.resigned ?? (props.mate ? chess.turn() : null);
    if (!loser) return;
    const k = kingSquare(chess, loser);
    const s = sprites.find((x) => !x.dying && x.sq === k);
    const el = s ? els.current.get(s.id) : undefined;
    if (!el || !k) return;
    const p = pct(k);
    const delay = props.mate ? D * 1.1 : 0;
    const dur = Math.max(600, D * 1.2);
    const t0 = performance.now();
    let id = 0;
    const step = () => {
      const t = Math.min(1, Math.max(0, (performance.now() - t0 - delay) / dur));
      const e = ease.outCubic(t);
      setT(el, p.x + e * 12, p.y + e * 10, `rotate(${e * 82}deg)`);
      el.style.filter = `grayscale(${e * 0.6}) brightness(${1 - e * 0.15})`;
      if (t < 1) id = requestAnimationFrame(step);
    };
    if (D === 0) setT(el, p.x + 12, p.y + 10, 'rotate(82deg)');
    else id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [props.mate, props.resigned]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // ── Input ────────────────────────────────────────────────────────────
  const legal = useMemo(() => (sel ? chess.moves({ square: sel, verbose: true }) : []), [chess, sel]);
  const targets = legal.filter((m) => !m.captured).map((m) => m.to);
  const captures = legal.filter((m) => m.captured).map((m) => m.to);

  const tryMove = (from: Square, to: Square, viaDrag = false): boolean => {
    const cand = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!cand.length) return false;
    if (cand.some((m) => m.promotion)) {
      if (settings.autoQueen) onMove?.(from + to + 'q');
      else setPromo({ from, to });
    } else {
      if (viaDrag) skipNextAnim.current = true;
      onMove?.(from + to);
    }
    setSel(null);
    return true;
  };

  const tap = (sq: Square) => {
    if (!interactive) return;
    tl.current.skip(); // never make the player wait for an animation
    const piece = chess.get(sq);
    if (sel && sel !== sq && tryMove(sel, sq)) return;
    if (piece && piece.color === chess.turn()) {
      setSel(sq === sel ? null : sq);
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
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
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
    const ok = to && to !== d.from && tryMove(d.from, to, true);
    if (el) {
      el.style.zIndex = '';
      el.style.filter = '';
      if (!ok) {
        const p = pct(d.from);
        setT(el, p.x, p.y);
        setSel(d.from);
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
  if (props.lastMove && props.lastMove.after === fen) marks.push({ sq: props.lastMove.from, cls: 'last from' }, { sq: props.lastMove.to, cls: 'last' });
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
      style={{ ['--trim' as string]: theme.trim, ['--ink' as string]: theme.ink }}
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
          onDoubleClick={() => tl.current.skip()}
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
            <button key={p} onClick={() => { onMove?.(promo.from + promo.to + p); setPromo(null); }} aria-label={`Promote to ${NAMES[p]}`}>
              <img src={pieceSrc(style, chess.turn(), p)} alt="" />
            </button>
          ))}
        </div>
      )}
      <div className="sr-only" aria-live="polite">{announce}</div>
    </div>
  );
}

/** Small, tasteful effects layer: impact ring on captures, golden flare on promotion. */
function burst(layer: HTMLDivElement | null, p: { x: number; y: number }, kind: 'hit' | 'promo', delay: number, D: number) {
  if (!layer || D === 0) return;
  const el = document.createElement('span');
  el.className = 'fx ' + kind;
  el.style.transform = `translate(${p.x}%, ${p.y}%)`;
  el.style.animationDelay = `${Math.round(delay)}ms`;
  el.style.animationDuration = `${Math.round(kind === 'promo' ? D * 0.9 : D * 0.55)}ms`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), delay + D + 200);
}
