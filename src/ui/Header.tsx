import { useSave } from './store';
import { useNav } from './nav';
import { Emblem } from './components/common';
import { RANKS, ARENAS } from '../world/arenas';
import { careerRating } from '../game/career';
import { isProvisional } from '../rating/elo';
import { dayLabel } from './components/common';

/** The permanent Imperial header. Every value comes from persisted player data. */
export function Header() {
  const s = useSave();
  const nav = useNav();
  const p = s.player;
  const r = careerRating(s);
  const rk = RANKS[p.rank];
  return (
    <header className="imperial" onClick={() => nav.open({ kind: 'passport' })} role="button" aria-label="Open your passport">
      <Emblem rank={p.rank} size={38} />
      <div className="ih-main">
        <div className="ih-rank">{rk.name}</div>
        <div className="ih-arena">{ARENAS[rk.arena].name}</div>
      </div>
      <div className="ih-stat"><b>{r.rating}{isProvisional(r) ? '?' : ''}</b><span>Elo</span></div>
      <div className="ih-stat"><b>{p.influence}</b><span>Influence</span></div>
      <div className="ih-stat wide-only"><b><span className="w">{p.w}</span>–<span className="d">{p.d}</span>–<span className="l">{p.l}</span></b><span>W–D–L</span></div>
      <div className="ih-stat wide-only"><b>{p.championships}</b><span>Titles</span></div>
      <div className="ih-stat wide-only"><b>{dayLabel(s.world.day)}</b><span>Calendar</span></div>
    </header>
  );
}
