import { useNav, type Tab } from './nav';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'arena', label: 'Arena', icon: '⚔' },
  { id: 'empire', label: 'Empire', icon: '🏛' },
  { id: 'academy', label: 'Academy', icon: '📜' },
  { id: 'spectate', label: 'Spectate', icon: '👁' },
  { id: 'legacy', label: 'Legacy', icon: '🦅' },
];

export function TabBar({ badge }: { badge?: Partial<Record<Tab, number>> }) {
  const nav = useNav();
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <button key={t.id} className={'tab' + (nav.tab === t.id ? ' on' : '')} onClick={() => nav.go(t.id)} aria-current={nav.tab === t.id}>
          <span className="tab-i" aria-hidden>{t.icon}</span>
          <span className="tab-l">{t.label}</span>
          {badge?.[t.id] ? <span className="badge">{badge[t.id]}</span> : null}
        </button>
      ))}
    </nav>
  );
}
