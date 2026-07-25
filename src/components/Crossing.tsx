import { useEffect, useMemo, useRef, useState } from 'react';
import { compact, longDate, money, monthYear } from '../engine/format';
import { addMonths } from '../engine/projection';
import type { Projection, SimResult } from '../engine/types';

const PAD = { top: 18, right: 74, bottom: 36, left: 8 };

/**
 * The Crossing.
 *
 * Every thread is one possible life: the same savings plan run through a
 * different sequence of markets. They climb toward the ochre line, which is the
 * capital your own spending demands — a moving target, because spending grows.
 * Where the median thread meets that line is the date. The spread of crossings
 * either side of it is the part nobody can promise you.
 */
export function Crossing({
  projection,
  sim,
  currency,
  today,
  logScale,
  onToggleScale,
}: {
  projection: Projection;
  sim: SimResult | null;
  currency: string;
  today: string;
  logScale: boolean;
  onToggleScale: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 320, h: 300 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(320, r.width), h: Math.max(260, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const months = projection.path.length - 1;
  const baseDate = useMemo(() => new Date(today), [today]);

  /** Upper bound: whichever is taller, the 75th-percentile fan or the target curve. */
  const yMax = useMemo(() => {
    let m = 0;
    for (const p of projection.path) m = Math.max(m, p.required, p.balance);
    if (sim) for (const b of sim.drawdown.bands) m = Math.max(m, b.p75);
    return m * 1.18;
  }, [projection, sim]);

  const yMin = useMemo(() => {
    if (!logScale) return 0;
    const start = projection.path[0]?.balance ?? 0;
    return Math.max(1000, Math.min(start * 0.5, yMax / 400));
  }, [logScale, projection, yMax]);

  const plot = {
    x: PAD.left,
    y: PAD.top,
    w: size.w - PAD.left - PAD.right,
    h: size.h - PAD.top - PAD.bottom,
  };

  const sx = (m: number) => plot.x + (m / months) * plot.w;
  const sy = useMemo(() => {
    if (!logScale) return (v: number) => plot.y + plot.h - (Math.max(0, v) / yMax) * plot.h;
    const lo = Math.log10(yMin);
    const hi = Math.log10(yMax);
    return (v: number) => {
      const t = (Math.log10(Math.max(yMin, v)) - lo) / (hi - lo);
      return plot.y + plot.h - t * plot.h;
    };
  }, [logScale, plot.y, plot.h, yMax, yMin]);

  // ── canvas: the fan ────────────────────────────────────────────────
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    if (!sim) return;

    // Percentile envelope, interpolated from the yearly bands.
    const bands = sim.drawdown.bands;
    const bandPath = (lo: (b: (typeof bands)[number]) => number, hi: (b: (typeof bands)[number]) => number) => {
      ctx.beginPath();
      bands.forEach((b, i) => {
        const x = sx(Math.min(b.t, months));
        const y = sy(hi(b));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      for (let i = bands.length - 1; i >= 0; i--) {
        ctx.lineTo(sx(Math.min(bands[i].t, months)), sy(lo(bands[i])));
      }
      ctx.closePath();
      ctx.fill();
    };

    ctx.fillStyle = 'rgba(123, 116, 255, 0.07)';
    bandPath((b) => b.p5, (b) => b.p95);
    ctx.fillStyle = 'rgba(123, 116, 255, 0.11)';
    bandPath((b) => b.p25, (b) => b.p75);

    // Individual lives.
    ctx.lineWidth = 1;
    for (const s of sim.fi.sample) {
      ctx.strokeStyle = s.ruined ? 'rgba(255, 106, 77, 0.5)' : 'rgba(123, 116, 255, 0.16)';
      ctx.beginPath();
      const step = Math.max(1, Math.floor(months / plot.w));
      for (let m = 0; m <= months; m += step) {
        const v = s.balance[m];
        const x = sx(m);
        const y = sy(v);
        m === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // The median life.
    ctx.strokeStyle = '#9c96ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    bands.forEach((b, i) => {
      const x = sx(Math.min(b.t, months));
      const y = sy(b.p50);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [sim, size, sx, sy, months, plot.w]);

  // ── svg overlay ────────────────────────────────────────────────
  const gridValues = useMemo(() => {
    const out: number[] = [];
    if (logScale) {
      for (let e = Math.ceil(Math.log10(yMin)); Math.pow(10, e) <= yMax; e++) {
        const base = Math.pow(10, e);
        for (const mul of [1, 3]) if (base * mul >= yMin && base * mul <= yMax) out.push(base * mul);
      }
    } else {
      const step = niceStep(yMax / 5);
      for (let v = step; v <= yMax; v += step) out.push(v);
    }
    return out;
  }, [logScale, yMin, yMax]);

  const decadeTicks = useMemo(() => {
    const out: { m: number; label: string }[] = [];
    const startAge = projection.path[0]?.age ?? 0;
    const firstFive = Math.ceil(startAge / 5) * 5;
    for (let a = firstFive; ; a += 5) {
      const m = Math.round((a - startAge) * 12);
      if (m > months) break;
      out.push({ m, label: `${a}` });
    }
    return out;
  }, [projection, months]);

  const fi = sim?.fi;
  // The labelled hairline is the central projection — the same date as the headline.
  const medianCross = projection.monthsToFi;
  const requiredAt = (m: number) => projection.path[Math.min(m, months)]?.required ?? 0;

  const hoverData =
    hover === null
      ? null
      : (() => {
          const m = Math.max(0, Math.min(months, hover));
          const band = sim?.drawdown.bands.find((b) => b.t >= m) ?? sim?.drawdown.bands.at(-1);
          return {
            m,
            date: addMonths(baseDate, m),
            age: (projection.path[0]?.age ?? 0) + m / 12,
            median: band?.p50 ?? projection.path[m].balance,
            low: band?.p5 ?? 0,
            high: band?.p95 ?? 0,
            required: requiredAt(m),
          };
        })();

  return (
    <div>
      <div className="crossing-canvas-wrap" ref={wrap}>
        {/* Sized by CSS, not inline styles — an inline pixel width would widen the
            container the ResizeObserver is measuring and never settle. */}
        <canvas ref={canvas} aria-hidden />
        <svg
          viewBox={`0 0 ${size.w} ${size.h}`}
          role="img"
          aria-label="Portfolio paths against the capital required to retire"
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * size.w;
            setHover(Math.round(((px - plot.x) / plot.w) * months));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {gridValues.map((v) => (
            <g key={v}>
              <line x1={plot.x} x2={plot.x + plot.w} y1={sy(v)} y2={sy(v)} stroke="#1f2731" strokeWidth={1} />
              <text className="axis-label" x={plot.x + plot.w + 8} y={sy(v) + 3.5}>
                {compact(v, currency)}
              </text>
            </g>
          ))}

          {decadeTicks.map((t) => (
            <g key={t.m}>
              <line x1={sx(t.m)} x2={sx(t.m)} y1={plot.y} y2={plot.y + plot.h} stroke="#1a2129" strokeWidth={1} />
              <text className="axis-label" x={sx(t.m)} y={size.h - 19} textAnchor="middle">
                {t.label}
              </text>
            </g>
          ))}
          <text className="axis-label" x={plot.x} y={size.h - 5}>
            YOUR AGE →
          </text>

          {/* The target: capital your spending demands, growing as spending grows. */}
          <path
            d={projection.path
              .filter((_, i) => i % 6 === 0)
              .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.t).toFixed(1)},${sy(p.required).toFixed(1)}`)
              .join(' ')}
            fill="none"
            stroke="var(--ochre-lit)"
            strokeWidth={1.75}
            strokeDasharray="5 4"
          />

          {/* Cone of possible dates along the floor. */}
          {fi?.p10 != null && fi.p90 != null && (
            <g>
              <line
                x1={sx(fi.p10)}
                x2={sx(fi.p90)}
                y1={plot.y + plot.h + 6}
                y2={plot.y + plot.h + 6}
                stroke="var(--ochre)"
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.55}
              />
              {[fi.p10, fi.p25, fi.p50, fi.p75, fi.p90].map((m, i) =>
                m == null ? null : (
                  <line
                    key={i}
                    x1={sx(m)}
                    x2={sx(m)}
                    y1={plot.y + plot.h + 2}
                    y2={plot.y + plot.h + 10}
                    stroke="var(--ochre)"
                    strokeWidth={i === 2 ? 2.5 : 1.5}
                    opacity={0.85}
                  />
                ),
              )}
            </g>
          )}

          {/* The crossing itself. */}
          {medianCross != null && (
            <g>
              <line
                x1={sx(medianCross)}
                x2={sx(medianCross)}
                y1={plot.y}
                y2={plot.y + plot.h + 12}
                stroke="var(--ochre-lit)"
                strokeWidth={1.25}
              />
              <circle cx={sx(medianCross)} cy={sy(requiredAt(medianCross))} r={4.5} fill="var(--ochre-lit)" />
              <circle
                cx={sx(medianCross)}
                cy={sy(requiredAt(medianCross))}
                r={10}
                fill="none"
                stroke="var(--ochre-lit)"
                strokeWidth={1}
                opacity={0.4}
              />
              <text
                className="axis-label"
                x={sx(medianCross) + (sx(medianCross) > plot.w * 0.7 ? -9 : 9)}
                y={plot.y + 12}
                textAnchor={sx(medianCross) > plot.w * 0.7 ? 'end' : 'start'}
                style={{ fill: 'var(--ochre-lit)', fontSize: 11 }}
              >
                {monthYear(addMonths(baseDate, medianCross)).toUpperCase()}
              </text>
            </g>
          )}

          {hoverData && (
            <line
              x1={sx(hoverData.m)}
              x2={sx(hoverData.m)}
              y1={plot.y}
              y2={plot.y + plot.h}
              stroke="var(--on-ink-faint)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          )}
        </svg>

        {hoverData && (
          <div
            className="crossing-tip"
            style={{
              left: `${(sx(hoverData.m) / size.w) * 100}%`,
              top: `${(sy(hoverData.median) / size.h) * 100}%`,
            }}
          >
            <div>
              <span className="lab">{longDate(hoverData.date)}</span>age {hoverData.age.toFixed(0)}
            </div>
            <div>
              <span className="lab">median</span>
              {money(hoverData.median, currency)}
            </div>
            <div>
              <span className="lab">range</span>
              {compact(hoverData.low, currency)} – {compact(hoverData.high, currency)}
            </div>
            <div style={{ color: 'var(--ochre-lit)' }}>
              <span className="lab">needed</span>
              {money(hoverData.required, currency)}
            </div>
          </div>
        )}
      </div>

      <div className="crossing-legend">
        <span>
          <i className="swatch" style={{ background: '#9c96ff' }} />
          median portfolio
        </span>
        <span>
          <i className="swatch" style={{ background: 'rgba(123,116,255,0.3)' }} />
          middle 90% of outcomes
        </span>
        <span>
          <i
            className="swatch"
            style={{ background: 'transparent', borderTop: '2px dashed var(--ochre-lit)', height: 0 }}
          />
          capital you need
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--coral-lit)' }} />
          ran out
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--ochre)', height: 4 }} />
          middle 80% of possible dates
        </span>
        <button onClick={onToggleScale} style={{ marginLeft: 'auto', color: 'var(--on-ink-mute)' }}>
          {logScale ? 'log scale' : 'linear scale'} ⇄
        </button>
      </div>
    </div>
  );
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}
