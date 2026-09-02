"use client";

import { useState } from "react";

export interface StepsPoint {
  date: string;
  steps: number;
  goal: number | null;
}

// Authored close to the rendered width so the 24px mark cap survives scaling.
const WIDTH = 940;
const HEIGHT = 260;
const PAD = { top: 18, right: 12, bottom: 26, left: 44 };
const MAX_BAR = 24;

/** Rounded at the data end, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number, r = 4): string {
  const radius = Math.max(0, Math.min(r, h, w / 2));
  return [
    `M${x},${y + h}`,
    `L${x},${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `L${x + w - radius},${y}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `L${x + w},${y + h}`,
    "Z",
  ].join(" ");
}

function niceTicks(max: number): number[] {
  const step = max > 20000 ? 10000 : max > 8000 ? 5000 : max > 3000 ? 2000 : 1000;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date.slice(5) : String(parsed.getDate());
}

export function StepsChart({ data }: { data: StepsPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return <p className="empty">No step data for this range.</p>;

  const goal = data.find((d) => d.goal)?.goal ?? null;
  const peak = Math.max(...data.map((d) => d.steps), goal ?? 0, 1);
  const ceiling = peak * 1.12;
  const ticks = niceTicks(peak);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / data.length;
  // Leave the band's leftover as air rather than filling the slot.
  const barW = Math.min(MAX_BAR, band * 0.62);
  const yOf = (v: number) => PAD.top + plotH - (v / ceiling) * plotH;

  const best = data.reduce((a, b) => (b.steps > a.steps ? b : a), data[0]);
  const active = hover === null ? null : data[hover];

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label={`Daily steps for the last ${data.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yOf(t)}
              y2={yOf(t)}
              stroke="var(--gridline)"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={yOf(t) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
              {t.toLocaleString()}
            </text>
          </g>
        ))}

        {goal ? (
          <>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yOf(goal)}
              y2={yOf(goal)}
              stroke="var(--baseline)"
              strokeWidth={1}
            />
            <text x={WIDTH - PAD.right} y={yOf(goal) - 5} textAnchor="end" fontSize={10} fill="var(--text-muted)">
              goal {goal.toLocaleString()}
            </text>
          </>
        ) : null}

        {data.map((d, i) => {
          const x = PAD.left + band * i + (band - barW) / 2;
          const y = yOf(d.steps);
          const h = PAD.top + plotH - y;
          return (
            <path
              key={d.date}
              d={columnPath(x, y, barW, h)}
              fill="var(--series-1)"
              opacity={hover === null || hover === i ? 1 : 0.45}
            />
          );
        })}

        {/* One direct label, on the extreme; the axis and tooltip carry the rest. */}
        {best.steps > 0 ? (
          <text
            x={PAD.left + band * data.indexOf(best) + band / 2}
            y={yOf(best.steps) - 6}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--text-primary)"
          >
            {best.steps.toLocaleString()}
          </text>
        ) : null}

        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="var(--baseline)"
          strokeWidth={1}
        />

        {data.map((d, i) => (
          <text
            key={`x-${d.date}`}
            x={PAD.left + band * i + band / 2}
            y={HEIGHT - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-muted)"
          >
            {dayLabel(d.date)}
          </text>
        ))}

        {/* Hit targets are the full band, which is wider than the bar. */}
        {data.map((d, i) => (
          <rect
            key={`hit-${d.date}`}
            x={PAD.left + band * i}
            y={PAD.top}
            width={band}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      <figcaption style={{ fontSize: 12, color: "var(--text-secondary)", minHeight: 18 }}>
        {active
          ? `${active.date} — ${active.steps.toLocaleString()} steps`
          : "Hover a column for the exact count."}
      </figcaption>
    </figure>
  );
}
