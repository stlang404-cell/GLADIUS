import { useMemo } from 'react';
import { useSave } from '../../store';
import { gameStat, progressSeries, rolling, weaknessReport, WEAKNESS_META, type GameStat } from '../../../analysis/weakness';
import { computeSkillProfile, type SkillDim } from '../../../analysis/skills';
import { PHASES } from '../../../analysis/types';
import { queueAnalysis } from '../../analysisQueue';
import { useGameRecords, usePlayerGameIds } from './useGames';
import { ColumnChart, LineChart, SeverityBar } from './charts';
import type { TrainSub } from './TrainingSection';

/** Validated categorical slots (dataviz validator, light surface): opening · middlegame · endgame. */
export const PHASE_COLORS = { opening: '#3A6FB0', middlegame: '#B08425', endgame: '#A92D3A' } as const;
const PHASE_NAME = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' } as const;

function rollingNullable(xs: (number | null)[], w: number): (number | null)[] {
  return xs.map((v, i) => {
    if (v === null) return null;
    const s = xs.slice(Math.max(0, i - w + 1), i + 1).filter((x): x is number => x !== null);
    return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null;
  });
}

export function ProgressSection({ onTrain, onReview }: { onTrain: (sub: TrainSub, theme?: string) => void; onReview: (id: string) => void }) {
  const s = useSave();
  const ids = usePlayerGameIds(400);
  const analysedIds = ids.filter((id) => s.libraryMeta[id]?.analysed);
  const { games, loading } = useGameRecords(analysedIds);
  const recs = useMemo(() => [...games.values()], [games]);
  const stats = useMemo(() => recs.map(gameStat).filter((x): x is GameStat => !!x), [recs]);
  const rep = useMemo(() => weaknessReport(stats), [stats]);
  const prof = useMemo(() => computeSkillProfile(recs), [recs]);
  const ser = useMemo(() => progressSeries(stats), [stats]);
  const pending = ids.filter((id) => !s.libraryMeta[id]?.analysed);
  const label = (i: number) => <>{ser.labels[i] ?? ''} <span className="muted">· {ser.dates[i] ? new Date(ser.dates[i]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}</span></>;
  if (stats.length === 0)
    return (
      <div className="ac-empty">
        {loading ? 'Loading your games…' : 'Progress appears once your games are analysed.'}
        {pending.length > 0 && <div className="ac-mt"><button className="btn gold" onClick={() => pending.slice(0, 20).forEach((id) => queueAnalysis(id))}>Analyse {Math.min(20, pending.length)} games</button></div>}
      </div>
    );
  const last5 = stats.length >= 6 ? rolling(ser.accuracy, 5).at(-1)! : null;
  const prev = stats.length >= 10 ? ser.accuracy.slice(-10, -5).reduce((a, b) => a + b, 0) / 5 : null;
  const accMin = Math.max(0, Math.min(60, Math.floor((Math.min(...ser.accuracy) - 5) / 20) * 20));
  const accTicks = [accMin, accMin + (100 - accMin) / 2, 100];
  const top = rep.weaknesses.filter((w) => w.games > 0).slice(0, 3);
  return (
    <>
      <div className="ac-tiles">
        <div className="ac-tile static"><span className="ac-k">Analysed</span><b>{stats.length}</b><span className="muted small">games</span></div>
        <div className="ac-tile static"><span className="ac-k">Accuracy</span><b>{rep.avgAccuracy?.toFixed(1) ?? '—'}</b><span className="muted small">{last5 !== null && prev !== null ? <span className={last5 >= prev ? 'ac-up' : 'ac-down'}>{last5 >= prev ? '▲' : '▼'} {Math.abs(last5 - prev).toFixed(1)} last 5</span> : 'average'}</span></div>
        <div className="ac-tile static"><span className="ac-k">Blunders</span><b>{rep.avgBlunders?.toFixed(1) ?? '—'}</b><span className="muted small">per game</span></div>
      </div>

      <div className="ac-card">
        <div className="ac-row"><span className="ac-k grow">Focus</span><span className="muted small">{rep.recommendation}</span></div>
        {top.map((w) => (
          <div key={w.key} className="ac-weak">
            <div className="ac-weak-main">
              <div className="ac-row gap"><b className="grow">{w.label}</b>{w.trend !== null && w.trend !== 0 && <span className={w.trend < 0 ? 'ac-up' : 'ac-down'}>{w.trend < 0 ? '▲ better' : '▼ worse'}</span>}</div>
              <SeverityBar value={w.severity} />
              <div className="muted small">{w.key === 'conversion' ? `${Math.round(w.rate * 100)}% ${w.unit}` : `${w.rate.toFixed(2)} ${w.unit}`} · {w.games} games</div>
            </div>
            <button className="ac-ib wide" onClick={() => onTrain(WEAKNESS_META[w.key].train, WEAKNESS_META[w.key].theme)}>Train</button>
          </div>
        ))}
      </div>

      <div className="ac-card">
        <span className="ac-k">Accuracy over time</span>
        <LineChart
          series={[
            { name: 'Game', color: '#527EAA', values: ser.accuracy, faint: true },
            { name: '5-game average', color: '#527EAA', values: ser.rolling },
          ]}
          yMin={accMin}
          ticks={accTicks}
          label={label}
          onPick={(i) => onReview(ser.ids[i])}
        />
      </div>

      <div className="ac-card">
        <span className="ac-k">Blunders per game</span>
        <ColumnChart values={ser.blunders} color="#A92D3A" label={label} />
      </div>

      <div className="ac-card">
        <span className="ac-k">Accuracy by phase · 5-game average</span>
        <LineChart
          series={PHASES.map((p) => ({ name: PHASE_NAME[p], color: PHASE_COLORS[p], values: rollingNullable(ser.phase[p], 5) }))}
          yMin={40}
          ticks={[40, 60, 80, 100]}
          label={label}
        />
      </div>

      <div className="ac-card">
        <div className="ac-row"><span className="ac-k grow">Skill profile</span><span className="muted small">{prof.games} games · {prof.moves} moves</span></div>
        <div className="ac-skills">
          {prof.dims.map((d) => <SkillRow key={d.key} d={d} />)}
        </div>
        <div className="muted small ac-mt">Bar: estimated skill (shrunk toward 50 on small samples). Text: what was measured.</div>
      </div>

      {prof.eloBands.length > 1 && (
        <div className="ac-card">
          <span className="ac-k">By opponent rating</span>
          {prof.eloBands.map((b) => (
            <div key={b.band} className="ac-band">
              <span className="ac-band-k">{b.band}</span>
              <span className="ac-band-bar"><span style={{ width: `${b.accuracy}%` }} /></span>
              <b>{b.accuracy.toFixed(0)}%</b>
              <span className="muted small">{b.score}% · {b.games}g</span>
            </div>
          ))}
        </div>
      )}
      {pending.length > 0 && (
        <div className="ac-row ac-count"><span className="grow muted small">{pending.length} games not analysed yet</span><button className="ac-link" onClick={() => pending.slice(0, 20).forEach((id) => queueAnalysis(id))}>Analyse</button></div>
      )}
    </>
  );
}

function SkillRow({ d }: { d: SkillDim }) {
  const v = d.measured.value;
  const measured = v === null ? 'no data' : d.key === 'blunders' ? `${v.toFixed(2)} ${d.measured.unit}` : d.key === 'consistency' ? `σ ${v.toFixed(1)}` : `${v.toFixed(0)}${d.measured.unit.startsWith('%') ? '%' : ''} ${d.measured.unit.replace(/^% ?/, '')}`;
  return (
    <div className={'ac-skill ' + d.confidence} title={d.evidence}>
      <div className="ac-row gap">
        <span className="grow ac-ellipsis">{d.label}</span>
        {d.trend !== null && Math.abs(d.trend) >= 1 && <span className={d.trend > 0 ? 'ac-up' : 'ac-down'}>{d.trend > 0 ? '▲' : '▼'}</span>}
        <b>{d.estimate === null ? '—' : d.estimate.toFixed(0)}</b>
      </div>
      <div className="ac-skillbar"><span style={{ width: `${d.estimate ?? 0}%` }} /></div>
      <div className="muted small ac-ellipsis">{measured} · {d.measured.sample} {d.measured.sampleUnit} · {d.confidence === 'none' ? 'no evidence' : `${d.confidence} confidence`}</div>
    </div>
  );
}
