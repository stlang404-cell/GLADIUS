import { useEffect, useMemo, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import type { GameRecord, MoveClass } from '../game/state';
import { getGame } from '../persist/save';
import { useSave } from './store';
import { Board } from './components/Board';
import { CLASS_META, displayClass, UNCLEAR_META } from '../analysis/classify';
import { explainMove, provenanceText } from '../analysis/analyzer';
import { winPercent } from '../engine/uci';
import { queueAnalysis, onAnalysisProgress, progress, cancelAnalysis, requestDeeperAnalysis, cancelDeeperAnalysis, deepStatus, onDeeperAnalysis } from './analysisQueue';
import { getEngine } from '../engine/browserEngine';
import { playVariation, evaluatePosition, type PositionEval } from '../analysis/explore';
import { annotatedPgn, biggestMistakes, gameRecommendations, missedTactics, plyAtGraphX, graphValue, reliability, openingReview, endgameSummary, displayCounts } from '../analysis/report';
import { parseUci } from '../chess/rules';
import { Sheet } from './components/common';
import { analysisBlockReason, deepenBlockReason } from '../analysis/integrity';
import { isUnclear } from '../analysis/confidence';
import { ANALYSIS_VERSION, PHASES, asX, type GameAnalysisX, type MoveAnalysisX } from '../analysis/types';
import { ENDGAME_DRILLS, ENDGAME_GUIDE } from '../chess/endgames';
import { useWidth } from './components/academy/charts';
import './academy.css';

export function evalText(e: { cp?: number; mate?: number } | undefined) {
  if (!e) return '0.0';
  if (e.mate !== undefined) return (e.mate > 0 ? '+' : '−') + 'M' + Math.abs(e.mate);
  const v = (e.cp ?? 0) / 100;
  if (Math.abs(v) < 0.05) return '0.0';
  return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1);
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

const MARK: MoveClass[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder', 'miss'];

/**
 * Win-probability graph (White's win% over the game); tap to jump. Classified
 * moves are dots in their class colour; low-confidence points are hollow
 * dashed rings (grey for an "Unclear" claim), so an unstable evaluation never
 * looks like a certain swing.
 */
export function EvalGraph({ moves, ply, onPick, height = 96 }: { moves: MoveAnalysisX[]; ply: number; onPick: (p: number) => void; height?: number }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = height;
  const pts = [moves[0] ? graphValue(moves[0].evalBefore) : 50, ...moves.map((m) => graphValue(m.evalAfter))];
  const step = W / Math.max(1, pts.length - 1);
  const yy = (v: number) => 3 + (1 - v / 100) * (H - 6);
  const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${yy(v).toFixed(1)}`).join(' ');
  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    onPick(plyAtGraphX((clientX - r.left) / r.width, moves.length));
  };
  const low = moves.filter((m) => m.conf === 'low').length;
  return (
    <div className="ac-evalgraph" ref={ref}>
      <svg width={W} height={H} onClick={(e) => pick(e.clientX, e.currentTarget)} role="img" aria-label={`Evaluation graph${low ? `, ${low} uncertain points` : ''}`}>
        <rect width={W} height={H} fill="#3A3631" rx="0" />
        <path d={`${line} L${W},${H} L0,${H} Z`} fill="#FFFFFF" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#C59A42" strokeOpacity=".55" strokeWidth="1" />
        <path d={line} fill="none" stroke="#C59A42" strokeWidth="1.5" strokeLinejoin="round" />
        {moves.map((m, i) => {
          const cx = (i + 1) * step;
          const cy = yy(graphValue(m.evalAfter));
          if (m.conf === 'low') {
            const col = isUnclear(m) ? UNCLEAR_META.color : '#A39C8E';
            return <circle key={i} className="ac-eg-unclear" cx={cx} cy={cy} r="4.5" fill="#fff" fillOpacity=".85" stroke={col} strokeWidth="2" strokeDasharray="2 1.6" />;
          }
          return MARK.includes(m.cls) ? <circle key={i} cx={cx} cy={cy} r="4" fill={CLASS_META[m.cls].color} stroke="#fff" strokeWidth="1.5" /> : null;
        })}
        <line x1={ply * step} x2={ply * step} y1="0" y2={H} stroke="#A92D3A" strokeWidth="2" />
      </svg>
      {low > 0 && (
        <div className="ac-eg-legend"><i /> {low} uncertain {low === 1 ? 'point' : 'points'}: the engine's evaluation was unstable there</div>
      )}
    </div>
  );
}

function moveNo(ply: number, startBlack: boolean) {
  const p = ply + (startBlack ? 1 : 0);
  return `${Math.floor(p / 2) + 1}${p % 2 ? '…' : '.'}`;
}

/**
 * Full game review, inline (Academy → Review) or in a sheet: replay, eval bar
 * & graph, classifications with concise explanations, best move and up to
 * three engine candidates, per-phase accuracy, opening and endgame review.
 * Refuses to show anything for a game in progress (competitive integrity).
 */
export function AnalysisPanel({ gameId, record, onTrainDrill }: { gameId?: string; record?: GameRecord; onTrainDrill?: (drillId: string) => void }) {
  const s = useSave();
  const [g, setG] = useState<GameRecord | null>(record ?? null);
  const [ply, setPly] = useState(0);
  const [prog, setProg] = useState(gameId ? (progress.get(gameId) ?? 0) : 0);
  const [showBest, setShowBest] = useState<number | null>(null); // index into alts, or null
  const [auto, setAuto] = useState(false);
  const [flip, setFlip] = useState(false);
  const [vari, setVari] = useState<string[] | null>(null); // explore mode: moves played from `ply`
  const [vEval, setVEval] = useState<{ key: string; e: PositionEval } | null>(null);
  const meta = gameId ? s.libraryMeta[gameId] : undefined;
  useEffect(() => {
    if (gameId) void getGame(gameId).then((x) => { if (x) { setG(x); setPly((p) => (p === 0 ? x.moves.length : Math.min(p, x.moves.length))); } });
  }, [gameId, meta?.analysed, meta?.accuracy]);
  useEffect(() => { setPly(0); setVari(null); }, [gameId]);
  useEffect(() => (gameId ? onAnalysisProgress((id, d, t) => id === gameId && setProg(d >= t ? 0 : d / t)) : undefined), [gameId]);
  // A finished deeper search of one move updates the record in place (it is already stored).
  useEffect(() => (gameId ? onDeeperAnalysis((id, _p, st, info) => { if (id === gameId && st === 'done' && info?.record) setG({ ...info.record }); }) : undefined), [gameId]);
  useEffect(() => {
    if (!auto || !g) return;
    const iv = setInterval(() => setPly((p) => (p >= g.moves.length ? (setAuto(false), p) : p + 1)), 900);
    return () => clearInterval(iv);
  }, [auto, g]);
  useEffect(() => { setShowBest(null); setVari(null); }, [ply]);
  useEffect(() => {
    if (!g) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1));
      else if (e.key === 'ArrowRight') setPly((p) => Math.min(g.moves.length, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g]);
  const positions = useMemo(() => {
    if (!g) return [] as { fen: string; move: Move | null }[];
    const c = new Chess(g.startFen);
    const out: { fen: string; move: Move | null }[] = [{ fen: c.fen(), move: null }];
    for (const u of g.moves) {
      try {
        const mv = c.move(parseUci(u));
        out.push({ fen: c.fen(), move: mv });
      } catch {
        break;
      }
    }
    return out;
  }, [g]);
  const P = Math.min(ply, Math.max(0, positions.length - 1));
  const varSteps = useMemo(() => (vari && positions[P] ? playVariation(positions[P].fen, vari) : []), [vari, P, positions]);
  const varFen = varSteps.length ? varSteps[varSteps.length - 1].fen : positions[P]?.fen;
  // Engine evaluation of the explored position (finished games only; the panel is locked otherwise).
  useEffect(() => {
    if (vari === null || !varFen || !g || analysisBlockReason(s, g)) return;
    const key = varFen;
    if (vEval?.key === key) return;
    const ctl = new AbortController();
    void evaluatePosition(getEngine('analysis'), varFen, Math.min(14, g.analysis?.depth ?? 12), ctl.signal)
      .then((e) => { if (!ctl.signal.aborted) setVEval({ key, e }); })
      .catch(() => {});
    return () => ctl.abort();
  }, [vari, varFen]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return <div className="ac-empty">Loading…</div>;
  const blocked = analysisBlockReason(s, g);
  if (blocked) return <div className="ac-card ac-lock"><b>Locked</b><div className="muted">{blocked}</div></div>;
  const a = asX(g.analysis);
  const startBlack = g.startFen.split(' ')[1] === 'b';
  const m = a && P > 0 ? a.moves[P - 1] : null;
  const evalNow = a ? (P === 0 ? a.moves[0]?.evalBefore : a.moves[P - 1]?.evalAfter) : undefined;
  const orient: 'w' | 'b' = (g.playerColor ?? 'w') === 'w' ? (flip ? 'b' : 'w') : flip ? 'w' : 'b';
  const exploring = vari !== null;
  const viewingBest = !exploring && showBest !== null && m && P > 0;
  const alt = viewingBest ? m.alts?.[showBest] : undefined;
  const arrowUci = viewingBest ? (alt?.uci ?? m.bestUci) : exploring && vEval?.key === varFen ? vEval.e.best : null;
  const boardFen = exploring ? varFen : viewingBest ? positions[P - 1].fen : positions[P].fen;
  const lastMove = exploring ? (varSteps.length ? varSteps[varSteps.length - 1].move : positions[P].move) : viewingBest ? positions[P - 1].move : positions[P].move;
  const bestArrow: [Square, Square] | null = arrowUci ? [arrowUci.slice(0, 2) as Square, arrowUci.slice(2, 4) as Square] : null;
  const pgn = annotatedPgn(g);
  const side = g.playerColor;
  const stale = !!a && (a.version ?? 0) < ANALYSIS_VERSION;
  const curEval = exploring ? (vEval?.key === varFen ? vEval.e.eval : undefined) : viewingBest ? m.evalBefore : evalNow;
  return (
    <div className="ac-review">
      <div className="ac-rv-board">
        <div className="ac-rv-boardrow">
          {a && <EvalBar e={curEval} orientation={orient} />}
          <div className="ac-rv-boardinner">
            <Board fen={boardFen} orientation={orient} interactive={exploring} onMove={(u) => setVari([...(vari ?? []), u])} lastMove={lastMove} settings={s.settings} hint={bestArrow} arena={g.arena} />
          </div>
        </div>
        {exploring ? (
          <div className="ac-card ac-explore">
            <div className="ac-row gap">
              <span className="ac-k grow">Exploring from {P === 0 ? 'the start' : `${moveNo(P - 1, startBlack)} ${g.san[P - 1]}`}</span>
              <button className="ac-ib" onClick={() => setVari((v) => (v && v.length ? v.slice(0, -1) : v))} disabled={!vari?.length} aria-label="Undo">↶</button>
              <button className="ac-ib wide" onClick={() => setVari(null)}>Done</button>
            </div>
            <div className="ac-var">{varSteps.length ? varSteps.map((st, k) => <span key={k}>{st.san}</span>) : <span className="muted small">Make a move on the board.</span>}</div>
            {vEval?.key === varFen ? (
              <div className="ac-row gap"><b className="ac-eval">{vEval.e.over === 'mate' ? '#' : evalText(vEval.e.eval)}</b><span className="muted small ac-ellipsis">{vEval.e.line.join(' ')}</span></div>
            ) : <div className="muted small">Engine thinking…</div>}
          </div>
        ) : (
          <div className="ac-replay" role="toolbar" aria-label="Replay">
            <button className="ac-ib" onClick={() => setPly(0)} aria-label="Start">⏮</button>
            <button className="ac-ib" onClick={() => setPly((p) => Math.max(0, p - 1))} aria-label="Back">◀</button>
            <button className="ac-ib" onClick={() => setAuto((x) => !x)} aria-label="Autoplay">{auto ? '❚❚' : '▶︎'}</button>
            <button className="ac-ib" onClick={() => setPly((p) => Math.min(positions.length - 1, p + 1))} aria-label="Forward">▶</button>
            <button className="ac-ib" onClick={() => setPly(positions.length - 1)} aria-label="End">⏭</button>
            <button className="ac-ib" onClick={() => setFlip((f) => !f)} aria-label="Flip board">⇅</button>
            {a && m && <button className={'ac-ib wide' + (viewingBest ? ' on' : '')} onClick={() => setShowBest(viewingBest ? null : 0)} aria-pressed={!!viewingBest}>Best</button>}
            {a && <button className="ac-ib wide" onClick={() => { setAuto(false); setVari([]); }}>Explore</button>}
          </div>
        )}
      </div>
      <div className="ac-rv-side">
        {!a ? (
          <div className="ac-card">
            {prog > 0 ? (
              <><div className="ac-prog"><span style={{ width: `${prog * 100}%` }} /></div><div className="ac-row"><span className="grow muted small">Stockfish analysis · {Math.round(prog * 100)}%</span>{gameId && <button className="ac-link" onClick={() => cancelAnalysis(gameId)}>Cancel</button>}</div></>
            ) : gameId ? (
              <button className="btn gold ac-wide" onClick={() => queueAnalysis(gameId, true)}>Analyse with Stockfish</button>
            ) : <div className="muted">No analysis.</div>}
          </div>
        ) : (
          <>
            <Summary g={g} a={a} />
            {m ? <MoveCard m={m} no={moveNo(P - 1, startBlack)} active={viewingBest ? showBest : null} onAlt={(k) => setShowBest(k === showBest ? null : k)} gameId={gameId} g={g} /> : (
              <div className="ac-card ac-move"><div className="muted small">Start position. Step through the moves or tap the graph.</div></div>
            )}
            <EvalGraph moves={a.moves} ply={P} onPick={setPly} />
            {a.critical.length > 0 && (
              <div>
              <span className="ac-k ac-mt">Key moments</span>
              <div className="ac-chips scroll" aria-label="Key moments">
                {a.critical.map((c) => {
                  const cm = a.moves[c];
                  return <button key={c} className={'ac-chip' + (P === c + 1 ? ' on' : '')} onClick={() => setPly(c + 1)}><i style={{ background: displayClass(cm).color }} />{moveNo(c, startBlack)} {cm.san}</button>;
                })}
              </div>
              </div>
            )}
            <ReportCard g={g} onJump={setPly} startBlack={startBlack} />
            {a.phases && <Phases a={a} side={side} />}
            <OpeningNote g={g} onJump={setPly} />
            {a.endgameReview && <EndgameNote g={g} onJump={setPly} onTrainDrill={onTrainDrill} />}
            {stale && gameId && (
              <div className="ac-card ac-row">
                <span className="grow muted small">{prog > 0 ? `Re-analysing · ${Math.round(prog * 100)}%` : (a.version ?? 0) >= 3 ? 'Older analysis: no verification or confidence ratings.' : 'Older analysis: no alternatives or motifs.'}</span>
                {prog === 0 && <button className="btn small" onClick={() => queueAnalysis(gameId, true, true)}>Re-analyse</button>}
              </div>
            )}
          </>
        )}
        <div className="ac-movelist">
          {g.san.map((san, i) => {
            const ma = a?.moves[i];
            const white = (i + (startBlack ? 1 : 0)) % 2 === 0;
            const dc = ma ? displayClass(ma) : null;
            return (
              <button key={i} className={'ac-mv' + (P === i + 1 ? ' on' : '')} onClick={() => setPly(i + 1)}>
                {(white || i === 0) && <i>{moveNo(i, startBlack)}</i>}
                {san}
                {ma && dc && MARK.includes(ma.cls) && <sup style={{ color: dc.color }} title={dc.label}>{dc.glyph}</sup>}
              </button>
            );
          })}
        </div>
        <div className="ac-row gap wrap">
          <button className="btn small" onClick={() => void navigator.clipboard?.writeText(pgn)}>Copy PGN</button>
          <button className="btn small" onClick={() => downloadText(`gladius-${g.id}.pgn`, pgn)}>Download</button>
          <button className="btn small" onClick={() => void navigator.clipboard?.writeText(boardFen)}>Copy FEN</button>
        </div>
        {g.source === 'engine' && <div className="muted small">Broadcast: both sides were played by the engine at each competitor's strength.</div>}
      </div>
    </div>
  );
}

function ReportCard({ g, onJump, startBlack }: { g: GameRecord; onJump: (p: number) => void; startBlack: boolean }) {
  const worst = biggestMistakes(g, undefined, 3).filter((m) => m.winLoss >= 5);
  const missed = missedTactics(g);
  const recs = gameRecommendations(g);
  if (!worst.length && !recs.length) return null;
  return (
    <div className="ac-card ac-note">
      <span className="ac-k">{g.playerColor ? 'Your biggest moments' : "White's biggest moments"}</span>
      {worst.length > 0 && (
        <div className="ac-chips">
          {worst.map((m) => (
            <button key={m.ply} className="ac-chip" onClick={() => onJump(m.ply + 1)}>
              <i style={{ background: displayClass(m).color }} />{moveNo(m.ply, startBlack)} {m.san} <span className="muted">−{m.winLoss.toFixed(0)}%</span>
            </button>
          ))}
        </div>
      )}
      {missed.length > 0 && <div className="muted small">{missed.length} missed {missed.length === 1 ? 'win' : 'wins'}: {missed.slice(0, 3).map((m) => `${moveNo(m.ply, startBlack)} ${m.bestSan}`).join(', ')}</div>}
      <ul className="ac-recs">{recs.map((r, i) => <li key={i}>{r}</li>)}</ul>
    </div>
  );
}

function Summary({ g, a }: { g: GameRecord; a: GameAnalysisX }) {
  const sides: ('w' | 'b')[] = g.playerColor ? [g.playerColor, g.playerColor === 'w' ? 'b' : 'w'] : ['w', 'b'];
  const show: MoveClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder', 'miss'];
  const rel = reliability(a);
  const shown = displayCounts(g, a); // "Unclear" moves get their own chip instead of the class they were not confirmed as
  return (
    <div className="ac-card ac-sum">
      {sides.map((sd, k) => {
        const name = sd === 'w' ? g.white.name : g.black.name;
        const { counts: cnt, unclear } = shown[sd];
        return (
          <div key={sd} className={'ac-sum-side' + (k === 0 ? ' me' : '')}>
            <div className="ac-sum-head">
              <span className={'ac-pawn ' + sd} />
              <span className="ac-sum-name">{name}</span>
              <b className="ac-acc">{a.accuracy[sd].toFixed(1)}<small>%</small></b>
            </div>
            <div className="ac-cls">
              {show.filter((c) => cnt[c]).map((c) => (
                <span key={c} title={CLASS_META[c].label}><i style={{ background: CLASS_META[c].color }}>{CLASS_META[c].glyph}</i>{cnt[c]}</span>
              ))}
              {unclear > 0 && <span title="Unclear: the engine's evaluation was unstable"><i className="unclear" style={{ background: UNCLEAR_META.color }}>{UNCLEAR_META.glyph}</i>{unclear}</span>}
            </div>
          </div>
        );
      })}
      <div className={'ac-rel ' + rel.level} title="Accuracy is an estimate: Lichess-style win% model on Stockfish at a fixed depth. Brilliant/Great moves and errors are re-searched deeper before they are shown as certain.">
        <span>{rel.level === 'high' ? 'High' : rel.level === 'medium' ? 'Medium' : 'Low'} reliability</span> · {rel.note}
        {rel.engine && <div className="ac-rel-eng">{rel.engine}</div>}
      </div>
    </div>
  );
}

function MoveCard({ m, no, active, onAlt, gameId, g }: { m: MoveAnalysisX; no: string; active: number | null; onAlt: (k: number) => void; gameId?: string; g: GameRecord }) {
  const meta = displayClass(m);
  const alts = m.alts ?? (m.pv.length ? [{ uci: m.bestUci, san: m.bestSan, eval: m.evalBefore, line: m.pv }] : []);
  const quiet = m.cls === 'book' || m.cls === 'forced';
  const prov = provenanceText(m, (c) => CLASS_META[c].label);
  return (
    <div className={'ac-card ac-move' + (meta.unclear ? ' unclear' : '')} style={{ borderLeftColor: meta.color }}>
      <div className="ac-move-head">
        <span className={'ac-badge' + (meta.unclear ? ' unclear' : '')} style={{ background: meta.color }}>{meta.glyph}</span>
        <b>{no} {m.san}</b>
        <span className="ac-move-cls" style={{ color: meta.color }}>{meta.label}</span>
        {!quiet && (m.conf === 'low' || (m.conf === 'medium' && MARK.includes(m.cls))) && <span className={'ac-conf ' + m.conf}>{m.conf === 'low' ? 'low confidence' : 'unverified'}</span>}
        <span className="grow" />
        <span className="ac-eval">{m.san.endsWith('#') ? '#' : evalText(m.evalAfter)}</span>
      </div>
      <div className="ac-move-text">{explainMove(m)}</div>
      {!quiet && m.uci !== m.bestUci && (
        <div className="ac-compare">
          <span><em>Played</em><b>{m.san}</b>{evalText(m.evalAfter)}</span>
          <span><em>Engine</em><b>{m.bestSan}</b>{evalText(m.evalBefore)}</span>
        </div>
      )}
      {!quiet && alts.length > 0 && (
        <div className="ac-alts">
          {alts.map((l, k) => (
            <button key={l.uci + k} className={'ac-alt' + (active === k ? ' on' : '') + (l.uci === m.uci ? ' played' : '')} onClick={() => onAlt(k)}>
              <span className="ac-alt-ev">{evalText(l.eval)}</span>
              <span className="ac-alt-line"><b>{l.line[0] ?? l.san}</b> {l.line.slice(1).join(' ')}</span>
            </button>
          ))}
        </div>
      )}
      {!quiet && <div className="muted small">{m.winLoss > 0 ? `−${m.winLoss.toFixed(1)}% win chance · ` : ''}move accuracy {m.accuracy.toFixed(0)}%</div>}
      {prov && <div className="ac-prov">{prov}{m.verified?.engine ? ` · ${m.verified.engine}` : ''}</div>}
      {gameId && !quiet && <DeeperButton gameId={gameId} ply={m.ply} g={g} />}
    </div>
  );
}

/** "Analyse deeper": queued deeper search of this move (finished games only; refused while any game is in progress). */
function DeeperButton({ gameId, ply, g }: { gameId: string; ply: number; g: GameRecord }) {
  const s = useSave();
  const [st, setSt] = useState<'queued' | 'running' | null>(() => deepStatus(gameId, ply));
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  useEffect(() => {
    setSt(deepStatus(gameId, ply));
    setMsg(null);
    return onDeeperAnalysis((id, p, state, info) => {
      if (id !== gameId || p !== ply) return;
      setSt(state === 'queued' || state === 'running' ? state : null);
      if (state === 'failed') setMsg({ t: info?.error ?? 'The deeper search failed.', bad: true });
      else if (state === 'done') setMsg({ t: 'Updated with the deeper search.' });
      else if (state === 'cancelled') setMsg(null);
    });
  }, [gameId, ply]);
  const blocked = deepenBlockReason(s, g);
  if (st)
    return (
      <div className="ac-deep busy" aria-live="polite">
        <span className="ac-spin" aria-hidden="true" />
        <span className="grow small">{st === 'running' ? 'Searching deeper…' : 'Queued for a deeper search…'}</span>
        <button className="ac-link" onClick={() => cancelDeeperAnalysis(gameId, ply)}>Cancel</button>
      </div>
    );
  return (
    <div className="ac-deep">
      <button className="btn small" disabled={!!blocked} title={blocked ?? 'Search this position and the played move deeper'} onClick={() => void requestDeeperAnalysis(gameId, ply).then((why) => why && setMsg({ t: why, bad: true }))}>
        Analyse deeper
      </button>
      {(msg || blocked) && <span className={'small ' + (msg?.bad || blocked ? 'ac-deep-why' : 'muted')}>{msg?.t ?? blocked}</span>}
    </div>
  );
}

const PHASE_LABEL = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' } as const;

function Phases({ a, side }: { a: GameAnalysisX; side: 'w' | 'b' | null }) {
  const sides: ('w' | 'b')[] = side ? [side] : ['w', 'b'];
  return (
    <div className="ac-card ac-phases">
      {PHASES.map((p) => {
        const st = a.phases![p];
        const any = sides.some((sd) => st[sd].moves > 0);
        return (
          <div key={p} className={'ac-phase' + (any ? '' : ' off')}>
            <span className="ac-k">{PHASE_LABEL[p]}</span>
            {sides.map((sd) => (
              <span key={sd} className="ac-phase-v">
                {!side && <span className={'ac-pawn sm ' + sd} />}
                <b>{st[sd].acc === null ? '—' : st[sd].acc.toFixed(0)}</b>
                {st[sd].errors > 0 && <em>{st[sd].errors}✗</em>}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function OpeningNote({ g, onJump }: { g: GameRecord; onJump: (p: number) => void }) {
  const r = openingReview(g);
  if (!r) return null;
  return (
    <div className="ac-card ac-note">
      <span className="ac-k">Opening</span>
      <div><b>{r.name ?? 'Unnamed opening'}</b> {r.eco && <span className="muted small">{r.eco}</span>}</div>
      {r.exit ? (
        <>
          <button className="ac-link" onClick={() => onJump(r.exit!.ply + 1)}>
            Left the book with {r.exit.san}{r.theory.length ? ` · theory: ${r.theory.join(', ')}` : ''}
          </button>
          <div className="muted small">
            {r.exit.unclear ? 'The engine could not judge the book exit reliably.' : r.costly ? `Leaving the book cost ${r.exit.loss.toFixed(0)}% win chance (${r.exit.label.toLowerCase()}).` : 'A playable way to leave theory.'}
          </div>
        </>
      ) : (
        <div className="muted small">{r.leftBy === 'opponent' ? 'Your opponent left the book first.' : r.leftBy === 'end' ? 'Followed theory to the end of the book line.' : 'Stayed in the book throughout.'}</div>
      )}
    </div>
  );
}

function EndgameNote({ g, onJump, onTrainDrill }: { g: GameRecord; onJump: (p: number) => void; onTrainDrill?: (id: string) => void }) {
  const r = endgameSummary(g);
  if (!r) return null;
  const drill = ENDGAME_DRILLS.find((d) => d.id === ENDGAME_GUIDE[r.type]?.drills[0]);
  return (
    <div className="ac-card ac-note">
      <span className="ac-k">Endgame</span>
      <div className="ac-row"><b className="grow">{r.type}</b><button className="ac-link" onClick={() => onJump(r.ply)}>from move {Math.floor(r.ply / 2) + 1} · {r.winAtEntry}%</button></div>
      <div className="muted small">{r.text}</div>
      {drill && onTrainDrill && <button className="btn small ac-mt" onClick={() => onTrainDrill(drill.id)}>Drill: {drill.name}</button>}
    </div>
  );
}

/** Review in a sheet (opened from other tabs and the post-game ceremony). */
export function AnalysisSheet({ gameId, onClose, record }: { gameId?: string; onClose: () => void; record?: GameRecord }) {
  const s = useSave();
  const m = gameId ? s.libraryMeta[gameId] : undefined;
  const title = m ? `${m.white} – ${m.black}  ${m.result}` : record ? `${record.white.name} – ${record.black.name}  ${record.result}` : 'Analysis';
  return (
    <Sheet title={title} onClose={onClose} wide>
      <AnalysisPanel gameId={gameId} record={record} />
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
