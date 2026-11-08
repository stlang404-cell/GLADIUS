import type { ReactNode } from 'react';
import { portraitUri, emblemUri } from '../art';
import { RANKS, ARENAS } from '../../world/arenas';
import { DAYS_PER_YEAR, type Competitor } from '../../world/types';
import { IconClose } from './icons';

export function Portrait({ seed, female, age = 30, arena = 0, size = 48, ring }: { seed: number; female?: boolean; age?: number; arena?: number; size?: number; ring?: string }) {
  return (
    <img className="portrait" src={portraitUri(seed, !!female, age, arena)} width={size} height={size} alt="" style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined} />
  );
}

export function Emblem({ rank, size = 32 }: { rank: number; size?: number }) {
  return <img className="emblem" src={emblemUri(rank)} width={size} height={size} alt={RANKS[rank].name} title={`${RANKS[rank].name} — ${RANKS[rank].meaning}`} />;
}

export function compAge(c: Competitor, day: number) {
  return Math.floor((day - c.birthDay) / DAYS_PER_YEAR);
}

export function CompetitorPortrait({ c, day, size = 48 }: { c: Competitor; day: number; size?: number }) {
  return <Portrait seed={c.portraitSeed} female={c.female} age={compAge(c, day)} arena={RANKS[c.rank].arena} size={size} />;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-v">{value}</div>
      <div className="stat-l">{label}</div>
      {sub && <div className="stat-s">{sub}</div>}
    </div>
  );
}

export function Card({ children, className = '', onClick, title }: { children: ReactNode; className?: string; onClick?: () => void; title?: ReactNode }) {
  return (
    <section className={'card ' + className + (onClick ? ' tappable' : '')} onClick={onClick}>
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </section>
  );
}

export function Sheet({ children, onClose, title, wide }: { children: ReactNode; onClose: () => void; title?: ReactNode; wide?: boolean }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className={'sheet' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Record({ w, d, l }: { w: number; d: number; l: number }) {
  return (
    <span className="wdl">
      <b className="w">{w}</b>–<b className="d">{d}</b>–<b className="l">{l}</b>
    </span>
  );
}

export function pct(w: number, d: number, l: number) {
  const n = w + d + l;
  return n ? Math.round(((w + d / 2) / n) * 100) : 0;
}

export function arenaName(i: number) {
  return ARENAS[i].name;
}

export function dayLabel(day: number) {
  const season = Math.floor(day / 28) + 1;
  return `S${season} · D${(day % 28) + 1}`;
}

export function Sparkline({ values, w = 160, h = 40, color = '#e8b04b' }: { values: number[]; w?: number; h?: number; color?: string }) {
  if (values.length < 2) return <svg width={w} height={h} />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - lo) / span) * (h - 6)}`).join(' ');
  return (
    <svg width={w} height={h} className="spark" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
