import { useEffect, useState } from 'react';
import type { GameRecord } from '../game/state';
import type { PostGame } from '../game/career';
import { useSave } from './store';
import { onAnalysisProgress, progress } from './analysisQueue';
import { Emblem } from './components/common';
import { RANKS } from '../world/arenas';
import { CLASS_META } from '../analysis/classify';
import { getGame } from '../persist/save';

const TERM: Record<string, string> = {
  checkmate: 'by checkmate', stalemate: 'by stalemate', 'insufficient-material': 'insufficient material', 'fivefold-repetition': 'fivefold repetition',
  'seventy-five-move': '75-move rule', 'threefold-claim': 'threefold repetition', 'fifty-move-claim': '50-move rule', agreement: 'by agreement',
  resignation: 'by resignation', timeout: 'on time', 'timeout-insufficient': 'timeout vs insufficient material', abandoned: 'abandoned',
};

export function PostGameSheet({ pg, rec, onAnalyse, onRematch, onContinue }: { pg: PostGame; rec: GameRecord; onAnalyse: () => void; onRematch: () => void; onContinue: () => void }) {
  const s = useSave();
  const meta = s.libraryMeta[rec.id];
  const [p, setP] = useState(progress.get(rec.id) ?? 0);
  useEffect(() => onAnalysisProgress((id, d, t) => id === rec.id && setP(d / t)), [rec.id]);
  const title = pg.outcome === 'win' ? 'VICTORIA' : pg.outcome === 'loss' ? 'DEFEAT' : 'DRAW';
  const promoted = pg.rankAfter > pg.rankBefore;
  const counts = meta?.analysed ? null : null;
  void counts;
  return (
    <div className={'postgame ' + pg.outcome}>
      <div className="pg-laurel">{pg.outcome === 'win' ? '🏛️' : pg.outcome === 'loss' ? '⚔️' : '⚖️'}</div>
      <h1 className="pg-title">{title}</h1>
      <div className="pg-sub">{rec.result} · {TERM[rec.termination] ?? rec.termination}</div>
      <div className="pg-row">
        {pg.rated ? (
          <div className="pg-elo">
            <div className="big">{pg.ratingAfter}</div>
            <div className={'delta ' + (pg.delta >= 0 ? 'up' : 'down')}>{pg.delta >= 0 ? '+' : ''}{pg.delta}</div>
            <div className="lbl">{pg.pool} Elo</div>
          </div>
        ) : (
          <div className="pg-elo"><div className="lbl">Unrated</div></div>
        )}
        <div className="pg-acc">
          {meta?.accuracy !== undefined ? (
            <>
              <div className="big">{meta.accuracy.toFixed(1)}%</div>
              <div className="lbl">accuracy</div>
            </>
          ) : (
            <>
              <div className="meter"><span style={{ width: `${Math.round(p * 100)}%` }} /></div>
              <div className="lbl">analysing… {Math.round(p * 100)}%</div>
            </>
          )}
        </div>
        {pg.influence > 0 && (
          <div className="pg-inf"><div className="big">+{pg.influence}</div><div className="lbl">Influence</div></div>
        )}
      </div>
      {meta?.analysed && <ClassSummary rec={rec} />}
      {pg.rankNote && (
        <div className={'pg-rank' + (promoted ? ' up' : '')}>
          <Emblem rank={pg.rankAfter} size={44} />
          <div>
            <b>{pg.rankNote}</b>
            <div className="muted">{RANKS[pg.rankAfter].meaning}</div>
          </div>
        </div>
      )}
      {[...pg.events, ...pg.achievements.map((a) => `🏅 Achievement: ${a}`)].map((e, i) => (
        <div key={i} className="pg-event">{e}</div>
      ))}
      <div className="pg-actions">
        {rec.kind !== 'tournament' && rec.kind !== 'trial' && <button className="btn" onClick={onRematch}>REMATCH</button>}
        <button className="btn" onClick={onAnalyse}>ANALYZE</button>
        <button className="btn gold" onClick={onContinue}>CONTINUE</button>
      </div>
    </div>
  );
}

function ClassSummary({ rec }: { rec: GameRecord }) {
  const s = useSave();
  void s;
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    void getGame(rec.id).then((g) => {
      if (g?.analysis && rec.playerColor) setCounts(g.analysis.counts[rec.playerColor] as Record<string, number>);
    });
  }, [rec.id, rec.playerColor]);
  if (!counts) return null;
  const order = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder', 'miss'] as const;
  return (
    <div className="cls-summary">
      {order.filter((k) => counts[k]).map((k) => (
        <span key={k} className="cls-chip" style={{ borderColor: CLASS_META[k].color }}>
          <b style={{ color: CLASS_META[k].color }}>{CLASS_META[k].glyph}</b> {counts[k]} {CLASS_META[k].label}
        </span>
      ))}
    </div>
  );
}
