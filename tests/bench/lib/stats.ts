/**
 * Match statistics. Elo difference from the score fraction s:
 *   D = -400 · log10(1/s − 1)
 * 95 % confidence interval from the trinomial (W/D/L) per-game variance:
 *   σ² = [w(1−s)² + d(½−s)² + l(0−s)²] / n,  SE = σ / √n,  s± = s ± 1.96·SE
 * and the interval is mapped through the same Elo formula (the standard
 * method used by e.g. cutechess-cli / BayesElo's "naive" estimate).
 */
export type Wdl = { w: number; d: number; l: number };

export function eloFromScore(s: number): number {
  const c = Math.min(Math.max(s, 1e-6), 1 - 1e-6);
  return -400 * Math.log10(1 / c - 1);
}

export function matchStats(r: Wdl) {
  const n = r.w + r.d + r.l;
  if (n === 0) return { n, score: NaN, elo: NaN, lo: NaN, hi: NaN, se: NaN, los: NaN };
  const s = (r.w + 0.5 * r.d) / n;
  const w = r.w / n;
  const d = r.d / n;
  const l = r.l / n;
  const variance = w * (1 - s) ** 2 + d * (0.5 - s) ** 2 + l * (0 - s) ** 2;
  const se = Math.sqrt(variance / n);
  const lo = eloFromScore(s - 1.96 * se);
  const hi = eloFromScore(s + 1.96 * se);
  // Likelihood of superiority (normal approx on decisive games).
  const los = r.w + r.l > 0 ? 0.5 * (1 + erf((r.w - r.l) / Math.sqrt(2 * (r.w + r.l)))) : 0.5;
  return { n, score: s, elo: eloFromScore(s), lo, hi, se, los };
}

export function fmtStats(name: string, r: Wdl): string {
  const st = matchStats(r);
  const f = (x: number) => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(0) : x > 0 ? '+inf' : '-inf');
  return `${name}: +${r.w} =${r.d} -${r.l} (n=${st.n}) score ${(st.score * 100).toFixed(1)}%  Elo ${f(st.elo)} [95% CI ${f(st.lo)}, ${f(st.hi)}]  LOS ${(st.los * 100).toFixed(1)}%`;
}

function erf(x: number): number {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
