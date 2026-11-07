import { useEffect, useSyncExternalStore } from 'react';
import { ARENAS, RANKS } from '../world/arenas';
import { TROPHY_BY_ID } from '../world/trophies';
import type { SeasonReport } from '../game/state';
import type { AwardRecord } from '../world/types';
import { emblemUri, backdropUri } from './art';
import { TrophyImage } from './components/TrophyImage';
import { getSave } from './store';
import { sfx } from './sound';

/**
 * Brief, skippable ceremonies: promotion, arena reveal, trophy presentation,
 * season close. Tap anywhere (or Enter/Escape) to continue. Queue-driven so
 * several honours from one game play in order.
 */
export type CeremonyItem =
  | { kind: 'promotion'; rank: number; next: string }
  | { kind: 'arena'; arena: number; next: string }
  | { kind: 'trophy'; award: AwardRecord }
  | { kind: 'season'; report: SeasonReport };

const q: CeremonyItem[] = [];
const subs = new Set<() => void>();
let ver = 0;
const notify = () => {
  ver++;
  for (const f of subs) f();
};
export function queueCeremonies(items: CeremonyItem[]) {
  q.push(...items);
  notify();
}
function advance() {
  q.shift();
  notify();
}

export function CeremonyHost() {
  useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), () => ver);
  const item = q[0];
  useEffect(() => {
    if (!item) return;
    sfx('fanfare', getSave().settings);
    const key = (e: KeyboardEvent) => (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') && advance();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [item]);
  if (!item) return null;
  return (
    <div className="ceremony" onClick={advance} role="dialog" aria-live="assertive">
      <div className="ceremony-rays" />
      {item.kind === 'promotion' && (
        <div className="ceremony-card">
          <img className="ceremony-emblem" src={emblemUri(item.rank)} alt="" />
          <div className="kicker" style={{ color: '#f2cf6e' }}>Promoted</div>
          <h2>{RANKS[item.rank].name}</h2>
          <p>{RANKS[item.rank].meaning}</p>
          <div className="next">Next: {item.next}</div>
        </div>
      )}
      {item.kind === 'arena' && (
        <div className="arena-transition" style={{ ['--backdrop' as string]: `url("${backdropUri(item.arena)}")` }}>
          <div>
            <div className="kicker" style={{ color: '#f2cf6e' }}>Arena {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][item.arena]}</div>
            <h1>{ARENAS[item.arena].name}</h1>
            <p>{ARENAS[item.arena].motto}</p>
            <div className="next" style={{ display: 'inline-block' }}>{item.next}</div>
          </div>
        </div>
      )}
      {item.kind === 'trophy' && (
        <div className="ceremony-card">
          <div className="ceremony-emblem"><TrophyImage defId={item.award.defId} arena={item.award.arena} size={170} /></div>
          <div className="kicker" style={{ color: '#f2cf6e' }}>{item.award.current ? 'Title won' : 'Honour awarded'}</div>
          <h2>{TROPHY_BY_ID[item.award.defId]?.name ?? 'Trophy'}</h2>
          <p>{item.award.result}{item.award.finalOpponentName ? ` · vs ${item.award.finalOpponentName}` : ''}</p>
        </div>
      )}
      {item.kind === 'season' && (
        <div className="ceremony-card">
          <div className="kicker" style={{ color: '#f2cf6e' }}>Season {item.report.season + 1} closes</div>
          <h2>{item.report.ratingEnd} <small style={{ fontSize: '1rem' }}>{item.report.ratingEnd - item.report.ratingStart >= 0 ? '+' : ''}{item.report.ratingEnd - item.report.ratingStart}</small></h2>
          <p>{item.report.w}–{item.report.d}–{item.report.l} · peak {item.report.peak}{item.report.trophies.length ? ` · ${item.report.trophies.length} trophies` : ''}</p>
          {item.report.bestWin && <p>Best win: {item.report.bestWin.oppName} ({item.report.bestWin.oppRating})</p>}
          {item.report.rival && <p>Rival: {item.report.rival.name} · {item.report.rival.w}–{item.report.rival.d}–{item.report.rival.l}</p>}
        </div>
      )}
      <div className="skip" style={{ position: 'absolute', bottom: 'calc(30px + env(safe-area-inset-bottom))' }}>Tap to continue</div>
    </div>
  );
}
