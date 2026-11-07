import { useEffect, useState } from 'react';
import type { GameRecord, MoveAnalysis } from '../game/state';
import type { PostGame } from '../game/career';
import { useSave } from './store';
import { onAnalysisProgress, progress } from './analysisQueue';
import { Emblem } from './components/common';
import { RANKS } from '../world/arenas';
import { CLASS_META } from '../analysis/classify';
import { getGame } from '../persist/save';
import { postGameReport } from '../analysis/report';
import { analysisStatus } from './analysisQueue';

const TERM: Record<string, string> = {
  checkmate: 'by checkmate', stalemate: 'by stalemate', 'insufficient-material': 'insufficient material', 'fivefold-repetition': 'fivefold repetition',
  'seventy-five-move': '75-move rule', 'threefold-claim': 'threefold repetition', 'fifty-move-claim': '50-move rule', agreement: 'by agreement',
  resignation: 'by resignation', timeout: 'on time', 'timeout-insufficient': 'timeout vs insufficient material', abandoned: 'abandoned',
};

export function Laurel() {
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    const a = 200 - i * 17;
    const rad = (a * Math.PI) / 180;
    const x = 75 + Math.cos(rad) * 52, y = 64 + Math.sin(rad) * 46;
    leaves.push(<ellipse key={'l' + i} cx={x} cy={y} rx="9" ry="4.2" transform={`rotate(${a + 70} ${x} ${y})`} />);
    const x2 = 150 - x;
    leaves.push(<ellipse key={'r' + i} cx={x2} cy={y} rx="9" ry="4.2" transform={`rotate(${-(a + 70)} ${x2} ${y})`} />);
  }
  return (
    <svg className="pg-laurel" viewBox="0 0 150 70" fill="currentColor" aria-hidden>
      {leaves}
      <path d="M40 64 Q75 72 110 64" stroke="currentColor" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

export function PostGameSheet({ pg, rec, onAnalyse, onRematch, onNext }: { pg: PostGame; rec: GameRecord; onAnalyse: () => void; onRematch: () => void; onNext: () => void }) {
  const s = useSave();
  const meta = s.libraryMeta[rec.id];
  const [p, setP] = useState(progress.get(rec.id) ?? 0);
  const [full, setFull] = useState<GameRecord | null>(null);
  useEffect(() => onAnalysisProgress((id, d, t) => id === rec.id && setP(d / t)), [rec.id]);
  useEffect(() => {
    if (meta?.analysed) void getGame(rec.id).then((g) => g && setFull(g));
  }, [meta?.analysed, rec.id]);
  const title = pg.outcome === 'win' ? 'VICTORIA' : pg.outcome === 'loss' ? 'DEFEAT' : 'DRAW';
  const promoted = pg.rankAfter > pg.rankBefore;
  const counts = full?.analysis && rec.playerColor ? (full.analysis.counts[rec.playerColor] as Record<string, number>) : null;
  const report = full ? postGameReport(full, analysisStatus(rec.id)) : null;
  const insight = report?.critical ? `Critical move — ${report.critical.san} (${report.critical.label}): ${report.critical.text}` : full?.analysis && rec.playerColor ? keyInsight(full.analysis.moves, rec.playerColor, full.startFen) : null;
  return (
    <div className={'postgame ' + pg.outcome} role="dialog" aria-label={title}>
      <Laurel />
      <h1 className="pg-title">{title}</h1>
      <div className="pg-sub">{rec.result} · {TERM[rec.termination] ?? rec.termination}</div>
      <div className="pg-row">
        {pg.rated ? (
          <div>
            <div className="big num">{pg.ratingAfter}</div>
            <div className={'delta ' + (pg.delta >= 0 ? 'up' : 'down')}>{pg.delta >= 0 ? '+' : ''}{pg.delta}</div>
            <div className="lbl">{pg.pool} Elo</div>
          </div>
        ) : (
          <div><div className="big">—</div><div className="lbl">Unrated</div></div>
        )}
        <div>
          {meta?.accuracy !== undefined ? (
            <><div className="big num">{meta.accuracy.toFixed(1)}%</div><div className="lbl">Est. accuracy{report?.accuracy ? ` · opp ${report.accuracy.opponent.toFixed(0)}%` : ''}</div></>
          ) : (
            <><div className="meter"><span style={{ width: `${Math.round(p * 100)}%` }} /></div><div className="lbl">Analysing {Math.round(p * 100)}%</div></>
          )}
        </div>
        {pg.influence > 0 && <div><div className="big num" style={{ color: 'var(--gold-deep)' }}>+{pg.influence}</div><div className="lbl">Influence</div></div>}
      </div>
      {counts && (
        <div className="cls-summary">
          {(['brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'miss'] as const).filter((k) => counts[k]).map((k) => (
            <span key={k} className="cls-chip" style={{ borderColor: CLASS_META[k].color }}><b style={{ color: CLASS_META[k].color }}>{CLASS_META[k].glyph}</b> {counts[k]} {CLASS_META[k].label}</span>
          ))}
        </div>
      )}
      {insight && <div className="pg-insight"><b>Insight</b><span>{insight}</span></div>}
      {report?.recommendation && <div className="pg-insight"><b>Next</b><span>{report.recommendation}</span></div>}
      {pg.rankNote && (
        <div className={'pg-rank' + (promoted ? ' up' : '')}>
          <Emblem rank={pg.rankAfter} size={52} />
          <div><b>{pg.rankNote}</b><div className="muted">{RANKS[pg.rankAfter].meaning}</div></div>
        </div>
      )}
      {[...pg.events, ...pg.achievements.map((a) => `Achievement: ${a}`)].map((e, i) => <div key={i} className="pg-event">{e}</div>)}
      <div className="pg-actions">
        <button className="btn" onClick={onRematch} disabled={rec.kind === 'tournament' || rec.kind === 'trial'}>REMATCH</button>
        <button className="btn" onClick={onAnalyse}>FULL ANALYSIS</button>
        <button className="btn crimson" onClick={onNext} autoFocus>NEXT CHALLENGE</button>
      </div>
    </div>
  );
}

/** The single most useful lesson from the player's own moves. */
function keyInsight(moves: MoveAnalysis[], me: 'w' | 'b', startFen: string): string | null {
  const offset = startFen.split(' ')[1] === 'w' ? 0 : 1;
  const mine = moves.filter((_m, i) => ((i + offset) % 2 === 0 ? 'w' : 'b') === me);
  const worst = [...mine].sort((a, b) => b.winLoss - a.winLoss)[0];
  const best = mine.find((m) => m.cls === 'brilliant' || m.cls === 'great');
  const moveNo = (m: MoveAnalysis) => Math.floor((m.ply + offset) / 2) + 1;
  if (worst && worst.winLoss >= 10) return `Move ${moveNo(worst)}: ${worst.san} cost ${worst.winLoss.toFixed(0)}% win chance — ${worst.bestSan} was the key move.`;
  if (best) return `Move ${moveNo(best)}: ${best.san} was ${CLASS_META[best.cls].label.toLowerCase()}. Well played.`;
  if (worst) return `Clean game — your largest slip was ${worst.san} on move ${moveNo(worst)}.`;
  return null;
}
