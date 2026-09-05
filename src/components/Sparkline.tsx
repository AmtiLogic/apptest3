"use client";

import { useElementWidth } from "@/lib/useElementWidth";

const HEIGHT = 28;

/**
 * A shape, not a chart: enough to see direction and volatility at a glance in a
 * list row. The exact values live on the metric's own screen.
 */
export function Sparkline({ values }: { values: number[] }) {
  const { ref, width } = useElementWidth<HTMLDivElement>(72);
  if (values.length < 2) return <div className="spark" ref={ref} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((value, i) => ({
    x: i * step,
    // Inset by 3px so the stroke is never clipped at the extremes.
    y: 3 + (1 - (value - min) / span) * (HEIGHT - 6),
  }));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <div className="spark" ref={ref}>
      <svg width={width} height={HEIGHT} aria-hidden>
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last.x} cy={last.y} r={2.4} fill="var(--series-1)" />
      </svg>
    </div>
  );
}
