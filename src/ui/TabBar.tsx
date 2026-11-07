import type React from 'react';
import { useNav, type Tab } from './nav';
import { IconArena, IconEmpire, IconAcademy, IconSpectate, IconLegacy } from './components/icons';

const TABS: { id: Tab; label: string; Icon: (p: { size?: number }) => React.ReactElement }[] = [
  { id: 'arena', label: 'Arena', Icon: IconArena },
  { id: 'empire', label: 'Empire', Icon: IconEmpire },
  { id: 'academy', label: 'Academy', Icon: IconAcademy },
  { id: 'spectate', label: 'Spectate', Icon: IconSpectate },
  { id: 'legacy', label: 'Legacy', Icon: IconLegacy },
];

export function TabBar({ badge }: { badge?: Partial<Record<Tab, number>> }) {
  const nav = useNav();
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ id, label, Icon }) => (
        <button key={id} className={'tab' + (nav.tab === id ? ' on' : '')} onClick={() => nav.go(id)} aria-current={nav.tab === id ? 'page' : undefined}>
          <Icon />
          <span className="tab-l">{label}</span>
          {badge?.[id] ? <span className="badge">{badge[id]}</span> : null}
        </button>
      ))}
    </nav>
  );
}
