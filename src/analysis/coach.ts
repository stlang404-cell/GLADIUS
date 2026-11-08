import type { Save } from '../game/state';

export type Finding = { title: string; short: string; detail: string; weight: number };

/**
 * Pattern detection across the player's analysed games. Uses only stored
 * analysis summaries + training positions (cheap; no engine calls).
 */
export function coachReport(s: Save): { recommendation: string; findings: Finding[] } {
  const metas = Object.values(s.libraryMeta).filter((m) => m.playerColor && m.analysed);
  const pos = s.coach.positions;
  const findings: Finding[] = [];
  const by = (t: string) => pos.filter((p) => p.theme === t).length;
  const n = Math.max(1, metas.length);
  if (metas.length >= 3) {
    const avg = metas.reduce((a, m) => a + (m.accuracy ?? 0), 0) / metas.length;
    findings.push({ title: `Average accuracy ${avg.toFixed(1)}%`, short: `over ${metas.length} games`, detail: 'Accuracy uses the published Lichess formula on Stockfish win-probability loss per move.', weight: 0 });
  }
  const tactic = by('tactic');
  const mate = by('mate');
  const end = by('endgame');
  const open = by('opening');
  const conv = by('conversion');
  if (tactic / n > 0.8) findings.push({ title: 'Tactical oversights', short: `${tactic} middlegame errors`, detail: 'You often miss forcing replies. Before each move, check every capture and check available to your opponent.', weight: tactic });
  if (mate > 0) findings.push({ title: 'Missed mates', short: `${mate} positions`, detail: 'A forced mate was on the board and slipped by. Practise mating patterns in Puzzles.', weight: mate * 1.5 });
  if (end > 1) findings.push({ title: 'Endgame technique', short: `${end} endgame errors`, detail: 'Errors appeared with few pieces left. The Endgames drills cover the key theoretical positions.', weight: end * 1.2 });
  if (open > 1) findings.push({ title: 'Opening preparation', short: `${open} early errors`, detail: 'Mistakes inside the first ten moves. Review the Opening explorer for your main lines.', weight: open });
  if (conv > 0) findings.push({ title: 'Converting advantages', short: `${conv} wins let slip`, detail: 'You reached winning positions and lost the thread. Simplify when ahead; trade pieces, not pawns.', weight: conv * 1.3 });
  const losses = Object.values(s.libraryMeta).filter((m) => m.playerColor && m.result !== '1/2-1/2' && (m.result === '1-0') !== (m.playerColor === 'w'));
  const timeLosses = losses.length; // timeouts are stored in the record termination; summarised via kind
  void timeLosses;
  const openings = Object.entries(s.player.openingsPlayed).filter(([, r]) => r.w + r.d + r.l >= 3);
  const worst = openings.sort((a, b) => (a[1].w - a[1].l) / (a[1].w + a[1].d + a[1].l) - (b[1].w - b[1].l) / (b[1].w + b[1].d + b[1].l))[0];
  if (worst && worst[1].l > worst[1].w) findings.push({ title: `Struggling in the ${worst[0]}`, short: `${worst[1].w}-${worst[1].d}-${worst[1].l}`, detail: 'Your results in this line trail the rest of your repertoire. Opponents who have met you before may be prepared for it.', weight: 2 });
  findings.sort((a, b) => b.weight - a.weight);
  const top = findings.find((f) => f.weight > 0);
  const unsolved = pos.filter((p) => p.solved < 2).length;
  const recommendation = top
    ? `Next: ${top.title.toLowerCase()}. ${unsolved ? `Solve ${Math.min(5, unsolved)} positions from your own games.` : ''}`
    : metas.length < 3
      ? 'Next: play and analyse three games to unlock personal coaching.'
      : 'Solid play. Next: test yourself against a stronger challenge in the Arena.';
  return { recommendation, findings };
}
