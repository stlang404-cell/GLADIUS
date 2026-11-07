import { createContext, useContext } from 'react';

export type Tab = 'arena' | 'empire' | 'academy' | 'spectate' | 'legacy';
export type Overlay =
  | { kind: 'passport' }
  | { kind: 'competitor'; id: string }
  | { kind: 'tournament'; id: string }
  | { kind: 'analysis'; gameId: string }
  | { kind: 'arena'; index: number };

export type Nav = {
  tab: Tab;
  go: (t: Tab) => void;
  open: (o: Overlay) => void;
  close: () => void;
  play: () => void; // show the active game
  startVs: (oppId: string, opts?: { kind?: 'ranked' | 'challenge' | 'casual' | 'trial' | 'rivalry'; tcId?: string; rated?: boolean; startFen?: string; color?: 'w' | 'b' }) => void;
};

export const NavCtx = createContext<Nav>(null as unknown as Nav);
export const useNav = () => useContext(NavCtx);
