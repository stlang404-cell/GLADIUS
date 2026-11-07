/**
 * Dev-only board lab (boardlab.html, not part of the production build): renders
 * the real <Board> and exposes window.__lab to set positions and play moves, so
 * animation sampling scripts can reach promotions, en passant and mates directly.
 */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess, type Move } from 'chess.js';
import { Board } from './components/Board';
import { DEFAULT_SETTINGS } from '../game/state';
import './styles.css';

function Lab() {
  const [st, setSt] = useState<{ fen: string; last: Move | null; mate: boolean; resigned: 'w' | 'b' | null }>({ fen: new Chess().fen(), last: null, mate: false, resigned: null });
  (window as unknown as { __lab: unknown }).__lab = {
    set: (fen: string) => setSt({ fen, last: null, mate: false, resigned: null }),
    play: (uci: string) => setSt((s) => {
      const c = new Chess(s.fen);
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      return { fen: c.fen(), last: m, mate: c.isCheckmate(), resigned: null };
    }),
    resign: (side: 'w' | 'b') => setSt((s) => ({ ...s, resigned: side })),
    unmount: () => root.unmount(),
  };
  (window as unknown as { __labFen: () => string }).__labFen = () => st.fen;
  return <Board fen={st.fen} orientation="w" interactive={false} lastMove={st.last} settings={{ ...DEFAULT_SETTINGS }} set={0} arena={0} mate={st.mate} resigned={st.resigned} />;
}
const root = createRoot(document.getElementById('root')!);
root.render(<Lab />);
