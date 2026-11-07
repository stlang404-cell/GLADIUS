import { useSave } from './store';
import { useNav } from './nav';
import { RANKS, ARENAS } from '../world/arenas';
import { careerRating } from '../game/career';
import { isProvisional } from '../rating/elo';
import { emblemUri } from './art';
import { IconCrown } from './components/icons';

export const brandUrl = (f: string) => new URL(`brand/${f}`, document.baseURI).href;

/** The permanent Imperial header. Every value comes from persisted player data. */
export function Header() {
  const s = useSave();
  const nav = useNav();
  const p = s.player;
  const r = careerRating(s);
  const rk = RANKS[p.rank];
  return (
    <header className="imperial" onClick={() => nav.open({ kind: 'passport' })} role="button" tabIndex={0}
      aria-label={`${rk.name}, ${r.rating} Elo, ${p.influence} Influence. Open your profile.`}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && nav.open({ kind: 'passport' })}>
      <div className="imperial-inner">
        <img className="ih-logo full" src={brandUrl('logo-horizontal.svg')} alt="GLADIUS" />
        <img className="ih-logo compact" src={brandUrl('crest.svg')} alt="GLADIUS" />
        <span className="ih-sep" />
        <div className="ih-medal"><img src={emblemUri(p.rank)} alt="" /></div>
        <div className="ih-main">
          <div className="ih-rank">{rk.name}</div>
          <div className="ih-arena">{ARENAS[rk.arena].name}</div>
        </div>
        <div className="ih-stat elo"><b>{r.rating}{isProvisional(r) ? '?' : ''}</b><span>Elo</span></div>
        <div className="ih-stat inf"><b>{p.influence}</b><span>Influence</span></div>
        <div className="ih-stat wide-only"><b><span className="w">{p.w}</span>–<span className="d">{p.d}</span>–<span className="l">{p.l}</span></b><span>W–D–L</span></div>
        <div className="ih-stat wide-only"><b style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconCrown size={15} />{p.championships}</b><span>Titles</span></div>
      </div>
    </header>
  );
}
