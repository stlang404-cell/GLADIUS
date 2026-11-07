import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square, type Move } from 'chess.js';
import { Board3D, webglAvailable, type MoveAnim } from '../../render/board3d';
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
  set?: number; // board/piece collection
  mate?: boolean;
  hint?: [Square, Square] | null;
  azimuth?: number;
};

export const SPEEDS = { fast: { move: 120, lift: 0.15 }, balanced: { move: 260, lift: 0.25 }, cinematic: { move: 560, lift: 0.5 } };

export function moveAnimFrom(m: Move | null | undefined): MoveAnim | null {
  if (!m) return null;
  const a: MoveAnim = { from: m.from, to: m.to, promotion: m.promotion, captured: !!m.captured };
  if (m.isKingsideCastle()) a.castle = m.color === 'w' ? { rookFrom: 'h1', rookTo: 'f1' } : { rookFrom: 'h8', rookTo: 'f8' };
  if (m.isQueensideCastle()) a.castle = m.color === 'w' ? { rookFrom: 'a1', rookTo: 'd1' } : { rookFrom: 'a8', rookTo: 'd8' };
  if (m.isEnPassant()) a.epSquare = (m.to[0] + m.from[1]) as Square;
  return a;
}

function kingInCheck(c: Chess): Square | null {
  if (!c.isCheck()) return null;
  for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === c.turn()) return p.square;
  return null;
}

export function Board(props: BoardProps) {
  const { fen, interactive, onMove, settings } = props;
  const [sel, setSel] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const chess = useMemo(() => new Chess(fen), [fen]);
  useEffect(() => {
    setSel(null);
    setPromo(null);
  }, [fen]);
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

  const set = props.set ?? settings.pieceSet;
  const use3d = settings.boardMode === '3d' && webglAvailable();
  const hl = {
    selected: sel,
    targets: settings.showLegal ? targets : [],
    captures: settings.showLegal ? captures : [],
    lastMove: props.lastMove ? ([props.lastMove.from, props.lastMove.to] as [Square, Square]) : null,
    check: kingInCheck(chess),
    hint: props.hint ?? null,
  };
  return (
    <div className="board-wrap">
      {use3d ? (
        <Board3DView {...props} set={set} onTap={tap} hl={hl} />
      ) : (
        <Board2D {...props} set={set} onTap={tap} hl={hl} chess={chess} />
      )}
      {promo && (
        <div className="promo" role="dialog" aria-label="Choose promotion">
          {(['q', 'r', 'b', 'n'] as const).map((p) => (
            <button key={p} onClick={() => { onMove?.(promo.from + promo.to + p); setPromo(null); }} aria-label={`Promote to ${p}`}>
              <img src={pieceUri(p, chess.turn(), set)} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type HL = { selected: Square | null; targets: Square[]; captures: Square[]; lastMove: [Square, Square] | null; check: Square | null; hint: [Square, Square] | null };

function Board3DView(p: BoardProps & { set: number; onTap: (s: Square) => void; hl: HL }) {
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<Board3D | null>(null);
  const tapRef = useRef(p.onTap);
  tapRef.current = p.onTap;
  const lastFen = useRef<string>('');
  useEffect(() => {
    const b = new Board3D(host.current!, ARENAS[p.set].palette);
    b.onSquare = (sq) => tapRef.current(sq);
    board.current = b;
    lastFen.current = '';
    return () => b.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.set]);
  useEffect(() => {
    const b = board.current!;
    b.speed = p.settings.reduceMotion ? { move: 60, lift: 0 } : SPEEDS[p.settings.animSpeed];
    b.setTilt(p.settings.cameraTilt);
    b.setCoords(p.settings.showCoords);
  }, [p.settings.animSpeed, p.settings.cameraTilt, p.settings.showCoords, p.settings.reduceMotion, p.set]);
  useEffect(() => board.current?.setOrientation(p.orientation), [p.orientation, p.set]);
  useEffect(() => board.current?.setAzimuth(p.azimuth ?? 0), [p.azimuth, p.set]);
  useEffect(() => {
    const b = board.current!;
    const anim = lastFen.current && p.lastMove && p.lastMove.after === p.fen && p.lastMove.before === lastFen.current ? moveAnimFrom(p.lastMove) : null;
    b.setPosition(p.fen, anim, !!p.mate);
    lastFen.current = p.fen;
  }, [p.fen, p.lastMove, p.mate, p.set]);
  useEffect(() => {
    board.current?.setHighlights(p.hl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(p.hl), p.set, p.fen]);
  return <div className="board3d" ref={host} onDoubleClick={() => board.current?.skipAnimations()} />;
}

const FILES = 'abcdefgh';

function Board2D(p: BoardProps & { set: number; onTap: (s: Square) => void; hl: HL; chess: Chess }) {
  const pal = ARENAS[p.settings.boardSet ?? p.set]?.palette ?? ARENAS[p.set].palette;
  const anim = p.lastMove && p.lastMove.after === p.fen ? p.lastMove : null;
  const speed = p.settings.reduceMotion ? 0 : SPEEDS[p.settings.animSpeed].move;
  const [animating, setAnimating] = useState<string | null>(null);
  useEffect(() => {
    if (!anim || !speed) return;
    setAnimating(anim.to);
    const t = setTimeout(() => setAnimating(null), 20);
    return () => clearTimeout(t);
  }, [anim, speed]);
  const rows = p.orientation === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = p.orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cells = [];
  for (const r of rows)
    for (const f of cols) {
      const sq = (FILES[f] + (r + 1)) as Square;
      const light = (f + r) % 2 === 1;
      const pc = p.chess.get(sq);
      const isLast = p.hl.lastMove?.includes(sq);
      let offset: string | undefined;
      if (anim && sq === anim.to && animating === sq) {
        const df = FILES.indexOf(anim.from[0]) - f;
        const dr = Number(anim.from[1]) - 1 - r;
        const sx = p.orientation === 'w' ? df : -df;
        const sy = p.orientation === 'w' ? -dr : dr;
        offset = `translate(${sx * 100}%, ${sy * 100}%)`;
      }
      cells.push(
        <div
          key={sq}
          className={'sq' + (p.hl.selected === sq ? ' sel' : '') + (isLast ? ' last' : '') + (p.hl.check === sq ? ' check' : '') + (p.hl.hint?.includes(sq) ? ' hint' : '')}
          style={{ background: light ? pal.light : pal.dark }}
          onPointerDown={() => p.onTap(sq)}
          role="gridcell"
          aria-label={sq + (pc ? ` ${pc.color === 'w' ? 'white' : 'black'} ${pc.type}` : '')}
        >
          {p.settings.showCoords && f === cols[0] && <span className="coord r" style={{ color: light ? pal.dark : pal.light }}>{r + 1}</span>}
          {p.settings.showCoords && r === rows[7] && <span className="coord f" style={{ color: light ? pal.dark : pal.light }}>{FILES[f]}</span>}
          {pc && (
            <img
              className="pc"
              src={pieceUri(pc.type, pc.color, p.set)}
              alt=""
              draggable={false}
              style={offset ? { transform: offset, transition: 'none' } : { transition: `transform ${speed}ms cubic-bezier(.4,0,.2,1)` }}
            />
          )}
          {p.hl.targets.includes(sq) && <span className="dot" />}
          {p.hl.captures.includes(sq) && <span className="ring" />}
        </div>,
      );
    }
  return (
    <div className="board2d" role="grid" aria-label="Chessboard" style={{ borderColor: pal.frame }}>
      {cells}
    </div>
  );
}
