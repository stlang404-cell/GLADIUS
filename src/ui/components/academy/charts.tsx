import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Width of an element in CSS px (ResizeObserver), so SVG charts render 1:1 without distortion. */
export function useWidth<T extends HTMLElement>(fallback = 320): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => {
      const cw = Math.floor(es[0].contentRect.width);
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    setW(Math.floor(el.getBoundingClientRect().width) || fallback);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w];
}

export type Series = { name: string; color: string; values: (number | null)[]; faint?: boolean; dots?: boolean };

const PAD = { l: 30, r: 10, t: 10, b: 18 };
const GRID = '#ECE8DF';
const AXIS_TXT = '#8A8478';

/**
 * Line chart (one y-axis, 0..100 by default). Hover/tap shows a crosshair and
 * a readout above the plot; a legend is shown for two or more series.
 */
export function LineChart({ series, height = 168, yMin = 0, yMax = 100, ticks = [0, 25, 50, 75, 100], fmt = (v: number) => `${v.toFixed(1)}%`, label, onPick }: {
  series: Series[];
  height?: number;
  yMin?: number;
  yMax?: number;
  ticks?: number[];
  fmt?: (v: number) => string;
  label?: (i: number) => ReactNode;
  onPick?: (i: number) => void;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(...series.map((s) => s.values.length), 0);
  const iw = Math.max(10, W - PAD.l - PAD.r);
  const ih = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.t + ih - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * ih;
  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null || v === undefined) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const rel = (clientX - r.left - PAD.l) / iw;
    return Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
  };
  const hi = hover ?? n - 1;
  return (
    <div className="ac-chart" ref={ref}>
      <div className="ac-chart-read" aria-live="polite">
        {n > 0 && (
          <>
            <span className="ac-chart-x">{label ? label(hi) : `#${hi + 1}`}</span>
            {series.map((s) => {
              const v = s.values[hi];
              return (
                <span key={s.name} className="ac-chart-v">
                  {series.length > 1 && <i style={{ background: s.color }} />}
                  {series.length > 1 && <em>{s.name}</em>}
                  <b>{v === null || v === undefined ? '—' : fmt(v)}</b>
                </span>
              );
            })}
          </>
        )}
      </div>
      <svg
        width={W}
        height={height}
        role="img"
        onPointerMove={(e) => n && setHover(pick(e.clientX, e.currentTarget))}
        onPointerDown={(e) => n && setHover(pick(e.clientX, e.currentTarget))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onPick && n && onPick(pick(e.clientX, e.currentTarget))}
        style={{ cursor: onPick ? 'pointer' : 'crosshair', touchAction: 'pan-y' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={AXIS_TXT}>{t}</text>
          </g>
        ))}
        {series.map((s) => (
          <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity={s.faint ? 0.45 : 1} />
        ))}
        {series.filter((s) => s.dots !== false && !s.faint).map((s) =>
          s.values.map((v, i) => (v === null || v === undefined || (n > 24 && i !== hi && i !== n - 1) ? null : (
            <circle key={s.name + i} cx={x(i)} cy={y(v)} r={i === hi ? 5 : 3.5} fill={s.color} stroke="#fff" strokeWidth="2" />
          ))),
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="#242424" strokeOpacity=".25" strokeWidth="1" />}
      </svg>
      {series.length > 1 && (
        <div className="ac-legend">
          {series.map((s) => <span key={s.name}><i style={{ background: s.color, opacity: s.faint ? 0.45 : 1 }} />{s.name}</span>)}
        </div>
      )}
    </div>
  );
}

/** Column chart: one value per game; ≤ 24 px columns with 4 px rounded caps and 2 px gaps. */
export function ColumnChart({ values, color, height = 120, label, fmt = (v: number) => String(v) }: { values: number[]; color: string; height?: number; label?: (i: number) => ReactNode; fmt?: (v: number) => string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  const max = Math.max(2, ...values);
  const top = Math.ceil(max);
  const iw = Math.max(10, W - PAD.l - PAD.r);
  const ih = height - PAD.t - PAD.b;
  const slot = n ? iw / n : iw;
  const bw = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => PAD.t + ih - (v / top) * ih;
  const pick = (clientX: number, el: Element) => Math.max(0, Math.min(n - 1, Math.floor((clientX - el.getBoundingClientRect().left - PAD.l) / slot)));
  const hi = hover ?? n - 1;
  const ticks = top <= 4 ? Array.from({ length: top + 1 }, (_, i) => i) : [0, Math.round(top / 2), top];
  return (
    <div className="ac-chart" ref={ref}>
      <div className="ac-chart-read">
        {n > 0 && <><span className="ac-chart-x">{label ? label(hi) : `#${hi + 1}`}</span><span className="ac-chart-v"><b>{fmt(values[hi])}</b></span></>}
      </div>
      <svg width={W} height={height} onPointerMove={(e) => n && setHover(pick(e.clientX, e.currentTarget))} onPointerDown={(e) => n && setHover(pick(e.clientX, e.currentTarget))} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={AXIS_TXT}>{t}</text>
          </g>
        ))}
        {values.map((v, i) => {
          if (v <= 0) return null;
          const h = Math.max(2, (v / top) * ih);
          const x0 = PAD.l + i * slot + (slot - bw) / 2;
          const y0 = PAD.t + ih - h;
          const r = Math.min(4, bw / 2, h);
          const d = `M${x0},${PAD.t + ih} L${x0},${y0 + r} Q${x0},${y0} ${x0 + r},${y0} L${x0 + bw - r},${y0} Q${x0 + bw},${y0} ${x0 + bw},${y0 + r} L${x0 + bw},${PAD.t + ih} Z`;
          return <path key={i} d={d} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />;
        })}
      </svg>
    </div>
  );
}

/** Horizontal meter for a 0..∞ severity (1 = typical), clamped visually at 2. */
export function SeverityBar({ value }: { value: number }) {
  const pct = Math.max(2, Math.min(100, (value / 2) * 100));
  const tone = value >= 1.3 ? 'hi' : value >= 0.8 ? 'mid' : 'lo';
  return (
    <div className={'ac-sev ' + tone} aria-label={`Severity ${value.toFixed(2)}`}>
      <span style={{ width: `${pct}%` }} />
      <i style={{ left: '50%' }} />
    </div>
  );
}
