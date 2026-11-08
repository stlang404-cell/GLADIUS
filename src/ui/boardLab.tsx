/**
 * Dev-only board lab (boardlab.html, not part of the production build): renders
 * the real <Board> and exposes window.__lab to set positions and play moves, so
 * animation sampling scripts (scripts/anim-check.mjs) can reach promotions, en
 * passant, castling and mates directly.
 *   __lab.set(fen)            new position, no animation
 *   __lab.play(uci)           an opponent / engine move (pre-highlighted)
 *   __lab.settings(patch)     change settings live (animSpeed, animMs, reduceMotion, …)
 *   __lab.human('w'|'b'|null) let the board accept input for that side (moves land via onMove)
 *   __lab.undo() · resign(side) · unmount() · remount()
 * window.__labFen() returns the authoritative FEN; window.__labMoves lists every applied move.
 */
import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Chess, type Move } from 'chess.js';
import { Board } from './components/Board';
import { DEFAULT_SETTINGS, type Settings } from '../game/state';
import './styles.css';

type St = { fen: string; last: Move | null; mate: boolean; resigned: 'w' | 'b' | null; history: string[] };
const W = window as unknown as Record<string, unknown>;
const params = new URLSearchParams(location.search);

function Lab() {
  const [st, setSt] = useState<St>({ fen: new Chess().fen(), last: null, mate: false, resigned: null, history: [] });
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, animSpeed: (params.get('speed') as Settings['animSpeed']) ?? DEFAULT_SETTINGS.animSpeed });
  const [human, setHuman] = useState<'w' | 'b' | null>(null);
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  const apply = (uci: string) =>
    setSt((s) => {
      const c = new Chess(s.fen);
      let m: Move;
      try {
        m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      } catch {
        console.warn('illegal', uci);
        return s;
      }
      (W.__labMoves as string[]).push(uci);
      return { fen: c.fen(), last: m, mate: c.isCheckmate(), resigned: null, history: [...s.history, s.fen] };
    });
  W.__lab = {
    set: (fen: string) => setSt({ fen: new Chess(fen).fen(), last: null, mate: false, resigned: null, history: [] }),
    play: apply,
    resign: (side: 'w' | 'b') => setSt((s) => ({ ...s, resigned: side })),
    undo: () => setSt((s) => (s.history.length ? { fen: s.history[s.history.length - 1], last: null, mate: false, resigned: null, history: s.history.slice(0, -1) } : s)),
    settings: (patch: Partial<Settings>) => setSettings((x) => ({ ...x, ...patch })),
    human: (side: 'w' | 'b' | null) => setHuman(side),
    orient: (o: 'w' | 'b') => setOrientation(o),
    unmount: () => root.unmount(),
    remount: () => {
      root = createRoot(document.getElementById('root')!);
      root.render(<Lab />);
    },
  };
  W.__labFen = () => st.fen;
  const turn = st.fen.split(' ')[1];
  return (
    <Board
      fen={st.fen}
      orientation={orientation}
      interactive={!!human && human === turn && !st.mate && !st.resigned}
      onMove={apply}
      lastMove={st.last}
      settings={settings}
      set={0}
      arena={0}
      mate={st.mate}
      resigned={st.resigned}
    />
  );
}
W.__labMoves = [];
let root: Root = createRoot(document.getElementById('root')!);
root.render(<Lab />);
