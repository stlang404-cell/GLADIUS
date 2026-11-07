// Dev-only board contact-sheet lab (not part of the production build).
//   lab.html?mode=boards&sets=classical,marble&themes=all&sq=40&fen=...&last=e2e4
import { createRoot } from 'react-dom/client';
import { Chess, type Move } from 'chess.js';
import { Board } from '../ui/components/Board';
import { ALL_THEMES } from '../board2d/themes';
import { DEFAULT_SETTINGS } from '../game/state';
import '../ui/styles.css';

export function mountBoardLab(el: HTMLElement, params: URLSearchParams): void {
  const sets = (params.get('sets') ?? 'classical').split(',');
  const themeIds = params.get('themes');
  const themes = !themeIds || themeIds === 'all' ? ALL_THEMES : ALL_THEMES.filter((t) => themeIds.split(',').includes(t.id));
  const sq = Number(params.get('sq') ?? 40);
  const moves = (params.get('moves') ?? '').split(',').filter(Boolean);
  const chess = new Chess();
  let last: Move | null = null;
  for (const m of moves) last = chess.move(m);
  const fen = chess.fen();
  const cols = Number(params.get('cols') ?? 4);
  const gray = params.has('gray');
  const cb = params.has('cb'); // deuteranopia simulation (Machado et al. 2009, severity 1)
  if (cb) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'position:absolute;width:0;height:0');
    svg.innerHTML = '<filter id="deut"><feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0 0.280 0.673 0.047 0 0 -0.012 0.043 0.969 0 0 0 0 0 1 0"/></filter>';
    document.body.appendChild(svg);
  }
  el.style.cssText = `display:grid;grid-template-columns:repeat(${cols}, ${sq * 8 * 1.07 + 4}px);gap:14px;padding:14px;background:#FAF8F3;height:auto;width:max-content;${gray ? 'filter:grayscale(1)' : cb ? 'filter:url(#deut)' : ''}`;
  const css = document.createElement('style');
  css.textContent = '.board-wrap{max-width:none!important;min-width:0!important;width:100%!important}.lab-cell{font:600 11px Inter,sans-serif;color:#555}';
  document.head.appendChild(css);
  const cells = [];
  for (const set of sets)
    for (const t of themes)
      cells.push(
        <div className="lab-cell" key={set + t.id} data-cell={`${set}/${t.id}`}>
          <Board
            fen={fen}
            orientation="w"
            interactive
            lastMove={last}
            settings={{ ...DEFAULT_SETTINGS, boardTheme: t.id, pieceStyle: set, animSpeed: 'fast', reduceMotion: true }}
            arena={t.arena}
          />
          <div>{set} · {t.name}</div>
        </div>,
      );
  createRoot(el).render(<>{cells}</>);
}
