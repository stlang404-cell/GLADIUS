import { useEffect, useMemo, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import type { GameRecord, MoveAnalysis } from '../game/state';
import { getGame } from '../persist/save';
import { useSave } from './store';
import { Board } from './components/Board';
import { CLASS_META } from '../analysis/classify';
import { explainMove } from '../analysis/analyzer';
import { winPercent } from '../engine/uci';
import { queueAnalysis, onAnalysisProgress, progress } from './analysisQueue';
import { ChessGame, parseUci } from '../chess/rules';
import { Sheet } from './components/common';

export function evalText(e: { cp?: number; mate?: number } | undefined) {
  if (!e) return '0.0';
  if (e.mate !== undefined) return (e.mate > 0 ? '+' : '−') + 'M' + Math.abs(e.mate);
  const v = (e.cp ?? 0) / 100;
  return (v >= 0 ? '+' : '') + v.toFixed(1);
}

export function EvalBar({ e, orientation }: { e: { cp?: number; mate?: number } | undefined; orientation: 'w' | 'b' }) {
  const w = e ? winPercent(e) : 50;
  return (
    <div className={'evalbar' + (orientation === 'b' ? ' flip' : '')} aria-label={`Evaluation ${evalText(e)}`}>
      <div className="eb-white" style={{ height: `${w}%` }} />
      <span className="eb-txt">{evalText(e)}</span>
    </div>
  );
}

export function EvalGraph({ moves, ply, onPick }: { moves: MoveAnalysis[]; ply: number; onPick: (p: number) => void }) {
  const W = 600;
  const H = 90;
  const pts = [50, ...moves.map((m) => winPercent(m.evalAfter))];
  const step = W / Math.max(1, pts.length - 1);
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(H - (v / 100) * H).toFixed(1)}`).join(' ');
  return (
    <svg className="evalgraph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onClick={(e) => {
      const r = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
      onPick(Math.max(0, Math.min(moves.length, Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1)))));
    }}>
      <rect width={W} height={H} fill="#2a1d18" />
      <path d={path + ` L${W},${H} L0,${H} Z`} fill="#f3e7d0" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#8a6a4a" strokeDasharray="4 4" />
      {moves.map((m, i) => ['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(m.cls) ? (
        <circle key={i} cx={(i + 1) * step} cy={H - (winPercent(m.evalAfter) / 100) * H} r="4" fill={CLASS_META[m.cls].color} />
      ) : null)}
      <line x1={ply * step} x2={ply * step} y1="0" y2={H} stroke="#e8b04b" strokeWidth="2" />
    </svg>
  );
}

/** Full game review: replay, eval bar & graph, classifications, best lines, PGN. */
export function AnalysisSheet({ gameId, onClose, record }: { gameId?: string; onClose: () => void; record?: GameRecord }) {
  const s = useSave();
  const [g, setG] = useState<GameRecord | null>(record ?? null);
  const [ply, setPly] = useState(0);
  const [prog, setProg] = useState(0);
  const [showPv, setShowPv] = useState(false);
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (gameId) void getGame(gameId).then((x) => { if (x) { setG(x); setPly(x.moves.length); } });
  }, [gameId, s.libraryMeta[gameId ?? '']?.analysed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => (gameId ? onAnalysisProgress((id, d, t) => id === gameId && setProg(d / t)) : undefined), [gameId]);
  useEffect(() => {
    if (!auto || !g) return;
    const iv = setInterval(() => setPly((p) => (p >= g.moves.length ? (setAuto(false), p) : p + 1)), 900);
    return () => clearInterval(iv);
  }, [auto, g]);
  const positions = useMemo(() => {
    if (!g) return [] as { fen: string; move: Move | null }[];
    const c = new Chess(g.startFen);
    const out: { fen: string; move: Move | null }[] = [{ fen: c.fen(), move: null }];
    for (const u of g.moves) {
      try {
        const m = c.move(parseUci(u));
        out.push({ fen: c.fen(), move: m });
      } catch {
        break;
      }
    }
    return out;
  }, [g]);
  if (!g) return <Sheet title="Analysis" onClose={onClose}><div className="muted">Loading…</div></Sheet>;
  const a = g.analysis;
  const cur = positions[Math.min(ply, positions.length - 1)];
  const m = a && ply > 0 ? a.moves[ply - 1] : null;
  const evalNow = a ? (ply === 0 ? a.moves[0]?.evalBefore : a.moves[ply - 1]?.evalAfter) : undefined;
  const orient = g.playerColor ?? 'w';
  const bestArrow: [Square, Square] | null = showPv && a && a.moves[ply] ? [a.moves[ply].bestUci.slice(0, 2) as Square, a.moves[ply].bestUci.slice(2, 4) as Square] : null;
  const pgn = ChessGame.fromUci(g.moves, g.startFen).pgn({
    Event: g.kind === 'spectated' ? 'GLADIUS broadcast' : 'GLADIUS', White: g.white.name, Black: g.black.name, WhiteElo: String(g.white.rating), BlackElo: String(g.black.rating), Result: g.result,
    ...(g.opening ? { Opening: g.opening.name, ECO: g.opening.eco } : {}),
  });
  return (
    <Sheet title={`${g.white.name} – ${g.black.name}  ${g.result}`} onClose={onClose} wide>
      <div className="analysis">
        <div className="an-board">
          {a && <EvalBar e={evalNow} orientation={orient} />}
          <div className="an-board-inner">
            <Board fen={cur.fen} orientation={orient} interactive={false} lastMove={cur.move} settings={s.settings} hint={bestArrow} />
          </div>
        </div>
        <div className="an-side">
          {!a ? (
            <div className="card">
              {prog > 0 ? <><div className="meter"><span style={{ width: `${prog * 100}%` }} /></div><div className="muted">Engine analysis {Math.round(prog * 100)}%</div></>
                : gameId ? <button className="btn gold" onClick={() => queueAnalysis(gameId, true)}>Analyse with Stockfish</button> : <div className="muted">No analysis.</div>}
            </div>
          ) : (
            <>
              <div className="acc-row">
                <div><span className="muted">White</span><b>{a.accuracy.w.toFixed(1)}%</b></div>
                <div className="muted small">{a.opening ? `${a.opening.eco} ${a.opening.name}` : g.startFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w') ? 'Unnamed opening' : 'Custom start'}{a.endgame ? ` · ${a.endgame}` : ''}</div>
                <div><span className="muted">Black</span><b>{a.accuracy.b.toFixed(1)}%</b></div>
              </div>
              <EvalGraph moves={a.moves} ply={ply} onPick={setPly} />
              {m && (
                <div className="move-explain" style={{ borderColor: CLASS_META[m.cls].color }}>
                  <b style={{ color: CLASS_META[m.cls].color }}>{CLASS_META[m.cls].glyph} {m.san} — {CLASS_META[m.cls].label}</b>
                  <div>{explainMove(m)}</div>
                  {m.cls !== 'best' && m.cls !== 'book' && m.cls !== 'forced' && <div className="muted small">Best line: {m.pv.join(' ')}</div>}
                  <div className="muted small">Win chance lost: {m.winLoss.toFixed(1)} · move accuracy {m.accuracy.toFixed(0)}%</div>
                </div>
              )}
              {a.critical.length > 0 && (
                <div className="chips">
                  <span className="muted small">Critical:</span>
                  {a.critical.map((c) => <button key={c} className="chip" onClick={() => setPly(c + 1)}>{Math.floor(c / 2) + 1}{c % 2 ? '…' : '.'} {a.moves[c].san}</button>)}
                </div>
              )}
            </>
          )}
          <div className="replay">
            <button className="btn small" onClick={() => setPly(0)} aria-label="Start">⏮</button>
            <button className="btn small" onClick={() => setPly((p) => Math.max(0, p - 1))} aria-label="Back">◀</button>
            <button className="btn small" onClick={() => setAuto((x) => !x)} aria-label="Autoplay">{auto ? '⏸' : '▶︎'}</button>
            <button className="btn small" onClick={() => setPly((p) => Math.min(positions.length - 1, p + 1))} aria-label="Forward">▶</button>
            <button className="btn small" onClick={() => setPly(positions.length - 1)} aria-label="End">⏭</button>
            {a && <button className={'btn small' + (showPv ? ' gold' : '')} onClick={() => setShowPv((x) => !x)}>Best</button>}
          </div>
          <div className="movelist">
            {g.san.map((san, i) => {
              const ma = a?.moves[i];
              return (
                <span key={i} className={'mv' + (ply === i + 1 ? ' on' : '')} onClick={() => setPly(i + 1)}>
                  {i % 2 === 0 && <i>{i / 2 + 1}.</i>}
                  {san}
                  {ma && ['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder', 'miss'].includes(ma.cls) && <sup style={{ color: CLASS_META[ma.cls].color }}>{CLASS_META[ma.cls].glyph}</sup>}
                </span>
              );
            })}
          </div>
          <div className="row gap">
            <button className="btn small" onClick={() => void navigator.clipboard?.writeText(pgn)}>Copy PGN</button>
            <button className="btn small" onClick={() => downloadText(`gladius-${g.id}.pgn`, pgn)}>Download PGN</button>
            <button className="btn small" onClick={() => void navigator.clipboard?.writeText(cur.fen)}>Copy FEN</button>
          </div>
          {g.source === 'engine' && <div className="muted small">Broadcast game: both sides were played move-by-move by the engine at each competitor's strength.</div>}
          {gameId && progress.has(gameId) ? null : null}
        </div>
      </div>
    </Sheet>
  );
}

export function downloadText(name: string, text: string, type = 'application/x-chess-pgn') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
