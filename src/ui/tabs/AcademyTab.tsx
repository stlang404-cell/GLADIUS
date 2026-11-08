import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { useSave, archiveGame, getSave } from '../store';
import { AnalysisPanel } from '../AnalysisView';
import { queueAnalysis, resumePendingAnalysis } from '../analysisQueue';
import { CLASS_META } from '../../analysis/classify';
import { identifyOpening, openingFamily } from '../../chess/openings';
import { parseUci, START_FEN } from '../../chess/rules';
import type { GameRecord } from '../../game/state';
import { GamesSection } from '../components/academy/GamesSection';
import { TrainingSection, type TrainSub } from '../components/academy/TrainingSection';
import { ProgressSection } from '../components/academy/ProgressSection';
import { usePlayerGameIds, resultOf } from '../components/academy/useGames';
import '../academy.css';

type Sec = 'games' | 'review' | 'training' | 'progress';
const SECS: [Sec, string][] = [['games', 'Games'], ['review', 'Review'], ['training', 'Training'], ['progress', 'Progress']];

/**
 * Academy: Games (permanent library) · Review (engine analysis) · Training
 * (puzzles from your mistakes, tactics, endgames, openings) · Progress
 * (weaknesses, skill profile, improvement charts).
 */
export function AcademyTab() {
  const [sec, setSec] = useState<Sec>('games');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [sub, setSub] = useState<TrainSub>('mistakes');
  const [theme, setTheme] = useState<string | null>(null);
  const [drill, setDrill] = useState<string | null>(null);
  useEffect(() => resumePendingAnalysis(), []);
  const review = (id: string) => {
    setReviewId(id);
    setSec('review');
    window.scrollTo?.({ top: 0 });
  };
  const train = (t: TrainSub, th?: string) => {
    setSub(t);
    setTheme(th ?? null);
    setSec('training');
    window.scrollTo?.({ top: 0 });
  };
  return (
    <div className="page academy">
      <div className="seg ac-seg" role="tablist" aria-label="Academy">
        {SECS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={sec === k} className={sec === k ? 'on' : ''} onClick={() => setSec(k)}>{l}</button>
        ))}
      </div>
      {sec === 'games' && <GamesSection onReview={review} />}
      {sec === 'review' && <ReviewSection id={reviewId} setId={setReviewId} onTrainDrill={(d) => { setDrill(d); train('endgames'); }} />}
      {sec === 'training' && <TrainingSection sub={sub} setSub={(x) => { setSub(x); setTheme(null); }} theme={theme} setTheme={setTheme} focusDrill={drill} onReview={review} />}
      {sec === 'progress' && <ProgressSection onTrain={train} onReview={review} />}
    </div>
  );
}

function ReviewSection({ id, setId, onTrainDrill }: { id: string | null; setId: (id: string) => void; onTrainDrill: (d: string) => void }) {
  const s = useSave();
  const mine = usePlayerGameIds(40);
  const cur = id ?? mine.find((x) => s.libraryMeta[x]?.analysed) ?? mine[0] ?? null;
  if (!cur) return <div className="ac-empty">Finish a game to review it here.</div>;
  const options = mine.includes(cur) ? mine : [cur, ...mine];
  const label = (x: string) => {
    const m = s.libraryMeta[x];
    if (!m) return x;
    const r = resultOf(m);
    const opp = m.playerColor ? (m.playerColor === 'w' ? m.black : m.white) : `${m.white} – ${m.black}`;
    return `${r === 'win' ? 'W' : r === 'loss' ? 'L' : '½'} · ${opp}${m.opening ? ` · ${openingFamily(m.opening)}` : ''}`;
  };
  return (
    <>
      <div className="ac-picker">
        <select value={cur} onChange={(e) => setId(e.target.value)} aria-label="Game to review">
          {options.map((x) => <option key={x} value={x}>{label(x)}</option>)}
        </select>
      </div>
      <AnalysisPanel key={cur} gameId={cur} onTrainDrill={onTrainDrill} />
    </>
  );
}

export { CLASS_META };

// ------------------------------------------------------------------ dev helper (?debug only)
/**
 * `window.__gladiusAcademy.importGames([{ moves, result, color, daysAgo, analysis? }])`
 * archives UNRATED casual games for the player (so no Elo, no achievement
 * eligibility) and queues them for analysis — or, with `analysis`, stores that
 * precomputed analysis as-is (screenshots / UI checks). Only installed with ?debug.
 */
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).__gladiusAcademy = {
    async importGames(list: { moves: string[]; result: GameRecord['result']; color: 'w' | 'b'; daysAgo?: number; oppRating?: number; analysis?: GameRecord['analysis'] }[]) {
      const s = getSave();
      const ids: string[] = [];
      for (let k = 0; k < list.length; k++) {
        const x = list[k];
        const c = new Chess();
        const san = x.moves.map((u) => c.move(parseUci(u)).san);
        const opp = s.world.competitors[k % s.world.competitors.length];
        const me = { id: 'player', name: s.player.name, rating: 1200, rank: 0 };
        const them = { id: opp.id, name: opp.name, rating: x.oppRating ?? 1100 + k * 40, rank: 0 };
        const g: GameRecord = {
          id: `dbg-${Date.now().toString(36)}-${k}`, kind: 'casual', rated: false, pool: 'untimed', tc: 'untimed', day: s.world.day - (x.daysAgo ?? 0),
          date: new Date(Date.now() - (x.daysAgo ?? 0) * 864e5).toISOString(), white: x.color === 'w' ? me : them, black: x.color === 'w' ? them : me,
          playerColor: x.color, startFen: START_FEN, moves: x.moves, san, result: x.result, termination: 'agreement', arena: k % 3, source: 'player',
          opening: identifyOpening(x.moves),
          ...(x.analysis ? { analysis: x.analysis } : {}),
        };
        await archiveGame(g);
        if (!x.analysis) queueAnalysis(g.id);
        ids.push(g.id);
      }
      return ids;
    },
  };
}
