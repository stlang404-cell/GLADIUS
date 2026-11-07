import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Chess, type Square, type Move } from 'chess.js';
import { Board3D, webglAvailable, type MoveAnim } from '../../render/board3d';
import { moveDuration } from '../../render/animation';
import { ARENAS } from '../../world/arenas';
import { pieceUri } from '../art';
import type { Settings } from '../../game/state';
import { sfx } from '../sound';

export type BoardProps = {
  fen: string;
  orientation: 'w' | 'b';
  interactive: boolean;
  onMove?: (uci: string) => void;
  lastMove?: Move | null;
  settings: Settings;
  set?: number; // arena collection (board theme)
  mate?: boolean;
  resigned?: 'w' | 'b' | null;
  hint?: [Square, Square] | null;
  azimuth?: number;
  label?: string;
};

export function moveAnimFrom(m: Move | null | undefined): MoveAnim | null {
  if (!m) return null;
  const a: MoveAnim = { from: m.from, to: m.to, promotion: m.promotion, captured: !!m.captured };
  if (m.isKingsideCastle()) a.castle = m.color === 'w' ? { rookFrom: 'h1', rookTo: 'f1' } : { rookFrom: 'h8', rookTo: 'f8' };
  if (m.isQueensideCastle()) a.castle = m.color === 'w' ? { rookFrom: 'a1', rookTo: 'd1' } : { rookFrom: 'a8', rookTo: 'd8' };
  if (m.isEnPassant()) a.epSquare = (m.to[0] + m.from[1]) as Square;
  return a;
}

export function animMs(s: Settings): number {
  return moveDuration(s.animSpeed, s.animMs, s.reduceMotion);
}

function kingInCheck(c: Chess): Square | null {
  if (!c.isCheck()) return null;
  for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === c.turn()) return p.square;
  return null;
}

const FILES = 'abcdefgh';
const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export function Board(props: BoardProps) {
  const { fen, interactive, onMove, settings } = props;
  const [sel, setSel] = useState<Square | null>(null);
  const [cursor, setCursor] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [announce, setAnnounce] = useState('');
  const chess = useMemo(() => new Chess(fen), [fen]);
  useEffect(() => {
    setSel(null);
    setPromo(null);
  }, [fen]);
  useEffect(() => {
    if (props.lastMove && props.lastMove.after === fen) setAnnounce(`${props.lastMove.color === 'w' ? 'White' : 'Black'} ${props.lastMove.san}`);
  }, [props.lastMove, fen]);
  const legal = useMemo(() => (sel ? chess.moves({ square: sel, verbose: true }) : []), [chess, sel]);
  const targets = legal.filter((m) => !m.captured).map((m) => m.to);
  const captures = legal.filter((m) => m.captured).map((m) => m.to);

  const tap = (sq: Square) => {
    if (!interactive) return;
    const piece = chess.get(sq);
    if (sel) {
      const cand = legal.filter((m) => m.to === sq);
      if (cand.length) {
        if (cand.some((m) => m.promotion)) {
          if (settings.autoQueen) onMove?.(sel + sq + 'q');
          else setPromo({ from: sel, to: sq });
        } else onMove?.(sel + sq);
        setSel(null);
        return;
      }
    }
    if (piece && piece.color === chess.turn()) {
      setSel(sq === sel ? null : sq);
      sfx('select', settings);
    } else setSel(null);
  };

  const onKey = (e: KeyboardEvent) => {
    const cur = cursor ?? (props.orientation === 'w' ? 'e2' : 'e7');
    let f = FILES.indexOf(cur[0]);
    let r = Number(cur[1]) - 1;
    const flip = props.orientation === 'b' ? -1 : 1;
    switch (e.key) {
      case 'ArrowUp': r += flip; break;
      case 'ArrowDown': r -= flip; break;
      case 'ArrowLeft': f -= flip; break;
      case 'ArrowRight': f += flip; break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        tap(cur as Square);
        setCursor(cur as Square);
        return;
      case 'Escape':
        setSel(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    f = Math.max(0, Math.min(7, f));
    r = Math.max(0, Math.min(7, r));
    const sq = (FILES[f] + (r + 1)) as Square;
    setCursor(sq);
    const pc = chess.get(sq);
    setAnnounce(`${sq}${pc ? `, ${pc.color === 'w' ? 'white' : 'black'} ${NAMES[pc.type]}` : ''}${targets.includes(sq) || captures.includes(sq) ? ', legal move' : ''}`);
  };

  const set = props.set ?? settings.boardSet ?? 0;
  const use3d = settings.boardMode === '3d' && webglAvailable();
  const hl = {
    selected: sel,
    targets: settings.showLegal ? targets : [],
    captures: settings.showLegal ? captures : [],
    lastMove: props.lastMove ? ([props.lastMove.from, props.lastMove.to] as [Square, Square]) : null,
    check: kingInCheck(chess),
    hint: props.hint ?? null,
    cursor,
  };
  return (
    <div
      className={'board-wrap' + (use3d ? ' is3d' : ' is2d')}
      tabIndex={0}
      role="application"
      aria-label={props.label ?? 'Chessboard. Use arrow keys to move the cursor and Enter to select.'}
      onKeyDown={onKey}
      onBlur={() => setCursor(null)}
    >
      {use3d ? <Board3DView {...props} set={set} onTap={tap} hl={hl} /> : <Board2D {...props} set={set} onTap={tap} hl={hl} chess={chess} />}
      {promo && (
        <div className="promo" role="dialog" aria-label="Choose promotion">
          {(['q', 'r', 'b', 'n'] as const).map((p) => (
            <button key={p} onClick={() => { onMove?.(promo.from + promo.to + p); setPromo(null); }} aria-label={`Promote to ${NAMES[p]}`}>
              <img src={pieceUri(p, chess.turn(), set)} alt="" />
            </button>
          ))}
        </div>
      )}
      <div className="sr-only" aria-live="polite">{announce}</div>
    </div>
  );
}

type HL = { selected: Square | null; targets: Square[]; captures: Square[]; lastMove: [Square, Square] | null; check: Square | null; hint: [Square, Square] | null; cursor: Square | null };

function Board3DView(p: BoardProps & { set: number; onTap: (s: Square) => void; hl: HL }) {
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<Board3D | null>(null);
  const tapRef = useRef(p.onTap);
  tapRef.current = p.onTap;
  const lastFen = useRef<string>('');
  useEffect(() => {
    const b = new Board3D(host.current!, ARENAS[p.set].palette);
    b.setOrientation(p.orientation, true);
    b.onSquare = (sq) => tapRef.current(sq);
    board.current = b;
    lastFen.current = '';
    return () => b.dispose();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => board.current?.setPalette(ARENAS[p.set].palette), [p.set]);
  useEffect(() => {
    const b = board.current!;
    b.setMoveDuration(animMs(p.settings));
    b.setTilt(p.settings.cameraTilt);
    b.setCoords(p.settings.showCoords);
  }, [p.settings.animSpeed, p.settings.animMs, p.settings.cameraTilt, p.settings.showCoords, p.settings.reduceMotion]);
  useEffect(() => board.current?.setOrientation(p.orientation), [p.orientation]);
  useEffect(() => board.current?.setAzimuth(p.azimuth ?? 0), [p.azimuth]);
  useEffect(() => {
    const b = board.current!;
    const anim = lastFen.current && p.lastMove && p.lastMove.after === p.fen && p.lastMove.before === lastFen.current ? moveAnimFrom(p.lastMove) : null;
    b.setPosition(p.fen, anim, !!p.mate);
    lastFen.current = p.fen;
  }, [p.fen, p.lastMove, p.mate]);
  useEffect(() => {
    if (p.resigned) board.current?.resign(p.resigned);
  }, [p.resigned]);
  useEffect(() => {
    board.current?.setHighlights(p.hl);
  }, [JSON.stringify(p.hl), p.fen]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="board3d" ref={host} onDoubleClick={() => board.current?.skipAnimations()} />;
}

type Sprite = { id: number; type: string; color: 'w' | 'b'; sq: Square; dying?: boolean };
let spriteSerial = 1;

/** Track piece identities across positions so every move (incl. captures, castling, e.p.) animates. */
function nextSprites(prev: Sprite[], chess: Chess, last: Move | null | undefined): Sprite[] {
  const live = prev.filter((s) => !s.dying);
  const out: Sprite[] = [];
  const bySq = new Map(live.map((s) => [s.sq, s]));
  const used = new Set<number>();
  const want: { sq: Square; type: string; color: 'w' | 'b' }[] = [];
  for (const row of chess.board()) for (const pc of row) if (pc) want.push({ sq: pc.square, type: pc.type, color: pc.color });
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
      bySq.set(a.to, { ...mover, sq: a.to, type: a.promotion ?? mover.type });
    }
    if (a.castle) {
      const rook = bySq.get(a.castle.rookFrom);
      if (rook) {
        bySq.delete(a.castle.rookFrom);
        bySq.set(a.castle.rookTo, { ...rook, sq: a.castle.rookTo });
      }
    }
  }
  for (const w of want) {
    const s = bySq.get(w.sq);
    if (s && s.color === w.color && s.type === w.type && !used.has(s.id)) {
      out.push({ ...s, sq: w.sq });
      used.add(s.id);
    } else out.push({ id: spriteSerial++, type: w.type, color: w.color, sq: w.sq });
  }
  return out;
}

function Board2D(p: BoardProps & { set: number; onTap: (s: Square) => void; hl: HL; chess: Chess }) {
  const pal = ARENAS[p.set].palette;
  const D = animMs(p.settings);
  const [sprites, setSprites] = useState<Sprite[]>(() => nextSprites([], p.chess, null));
  const prevFen = useRef(p.fen);
  useEffect(() => {
    if (prevFen.current === p.fen) return;
    const last = p.lastMove && p.lastMove.after === p.fen && p.lastMove.before === prevFen.current ? p.lastMove : null;
    prevFen.current = p.fen;
    setSprites((s) => nextSprites(s, p.chess, last));
    if (D > 0) {
      const t = setTimeout(() => setSprites((s) => s.filter((x) => !x.dying)), D + 50);
      return () => clearTimeout(t);
    }
    setSprites((s) => s.filter((x) => !x.dying));
  }, [p.fen]); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = p.orientation === 'b';
  const pos = (sq: Square) => {
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]) - 1;
    return { x: (flip ? 7 - f : f) * 100, y: (flip ? r : 7 - r) * 100 };
  };
  const cells = [];
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      const f = flip ? 7 - col : col;
      const r = flip ? row : 7 - row;
      const sq = (FILES[f] + (r + 1)) as Square;
      const light = (f + r) % 2 === 1;
      const cls = ['sq', light ? 'light' : 'dark'];
      if (p.hl.selected === sq) cls.push('sel');
      if (p.hl.lastMove?.includes(sq)) cls.push('last');
      if (p.hl.check === sq) cls.push('check');
      if (p.hl.hint?.includes(sq)) cls.push('hint');
      if (p.hl.cursor === sq) cls.push('cursor');
      cells.push(
        <div key={sq} className={cls.join(' ')} style={{ background: light ? pal.light : pal.dark }} onPointerDown={() => p.onTap(sq)}>
          {p.settings.showCoords && col === 0 && <span className="coord r">{r + 1}</span>}
          {p.settings.showCoords && row === 7 && <span className="coord f">{FILES[f]}</span>}
          {p.hl.targets.includes(sq) && <span className="dot" />}
          {p.hl.captures.includes(sq) && <span className="ring" />}
        </div>,
      );
    }
  return (
    <div className="board2d" style={{ ['--frame' as string]: pal.frame }}>
      <div className="b2-grid">{cells}</div>
      <div className="b2-pieces" style={{ ['--dur' as string]: `${D}ms` }}>
        {sprites.map((s) => {
          const { x, y } = pos(s.sq);
          return (
            <img
              key={s.id}
              className={'pc2' + (s.dying ? ' dying' : '') + (p.hl.selected === s.sq && !s.dying ? ' lifted' : '')}
              src={pieceUri(s.type, s.color, p.set)}
              alt=""
              draggable={false}
              style={{ transform: `translate(${x}%, ${y}%)` }}
            />
          );
        })}
      </div>
    </div>
  );
}
