"use client";

import { useState } from "react";
import type { Prediction } from "@/lib/forecast";
import { useElementWidth } from "@/lib/useElementWidth";

export interface HistoryPoint {
  date: string;
  value: number;
}

const HEIGHT = 240;
const PAD = { top: 22, right: 12, bottom: 26, left: 42 };

function niceTicks(max: number): number[] {
  const step = max > 20000 ? 10000 : max > 8000 ? 5000 : max > 3000 ? 2000 : 1000;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}

function shortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date.slice(5)
    : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * History as a solid line, the projection dashed, and the prediction interval as
 * a wash behind it. Same hue throughout -- it is one measure over time, not two
 * different things.
 */
export function ForecastChart({
  history,
  forecast,
  goal,
  unitLabel,
}: {
  history: HistoryPoint[];
  forecast: Prediction[];
  goal?: number | null;
  unitLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { ref, width } = useElementWidth<HTMLDivElement>();

  if (history.length === 0) return <p className="empty">No history yet.</p>;

  const all = [
    ...history.map((p) => ({ ...p, isForecast: false, lower: p.value, upper: p.value })),
    ...forecast.map((p) => ({ date: p.date, value: p.value, isForecast: true, lower: p.lower, upper: p.upper })),
  ];

  const peak = Math.max(...all.map((p) => p.upper), goal ?? 0, 1);
  const ceiling = peak * 1.1;
  const ticks = niceTicks(peak);

  const plotW = Math.max(width - PAD.left - PAD.right, 120);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const step = all.length > 1 ? plotW / (all.length - 1) : 0;
  const xOf = (i: number) => PAD.left + step * i;
  const yOf = (v: number) => PAD.top + plotH - (v / ceiling) * plotH;

  const line = (points: Array<{ value: number }>, offset: number) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i + offset)},${yOf(p.value)}`).join(" ");

  // The dashed segment starts at the last real observation so the line is continuous.
  const bridge = history.length > 0 ? [history[history.length - 1], ...forecast] : forecast;
  const bridgeOffset = history.length - 1;

  const bandPath =
    forecast.length > 0
      ? [
          `M${xOf(bridgeOffset)},${yOf(history[history.length - 1].value)}`,
          ...forecast.map((p, i) => `L${xOf(history.length + i)},${yOf(p.upper)}`),
          ...forecast
            .slice()
            .reverse()
            .map((p, i) => `L${xOf(all.length - 1 - i)},${yOf(p.lower)}`),
          "Z",
        ].join(" ")
      : "";

  const last = forecast[forecast.length - 1];
  const shown = active === null ? null : all[active];
  const labelStride = step >= 42 ? Math.ceil(all.length / 7) : Math.ceil(all.length / 4);

  return (
    <figure style={{ margin: 0 }} ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        style={{ display: "block", touchAction: "pan-y" }}
        role="img"
        aria-label={`${unitLabel} history and ${forecast.length}-day projection`}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={yOf(t)} y2={yOf(t)} stroke="var(--gridline)" strokeWidth={1} />
            <text x={PAD.left - 6} y={yOf(t) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
              {t >= 1000 ? `${t / 1000}k` : t}
            </text>
          </g>
        ))}

        {goal ? (
          <>
            <line x1={PAD.left} x2={width - PAD.right} y1={yOf(goal)} y2={yOf(goal)} stroke="var(--baseline)" strokeWidth={1} />
            <text x={PAD.left + 4} y={yOf(goal) - 5} textAnchor="start" fontSize={10} fill="var(--text-muted)">
              goal
            </text>
          </>
        ) : null}

        {bandPath ? <path d={bandPath} fill="var(--series-1)" opacity={0.12} /> : null}

        <path d={line(history, 0)} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {forecast.length > 0 ? (
          <path
            d={line(bridge, bridgeOffset)}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
        ) : null}

        {/* Endpoint marker, ringed in the surface colour so it stays legible. */}
        {last ? (
          <circle cx={xOf(all.length - 1)} cy={yOf(last.value)} r={4.5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
        ) : null}

        {last && active === null ? (
          <text
            x={Math.min(xOf(all.length - 1), width - PAD.right - 4)}
            y={yOf(last.value) - 10}
            textAnchor="end"
            fontSize={11}
            fontWeight={600}
            fill="var(--text-primary)"
          >
            {Math.round(last.value).toLocaleString()}
          </text>
        ) : null}

        {shown ? (
          <>
            <line x1={xOf(active!)} x2={xOf(active!)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--baseline)" strokeWidth={1} />
            <circle cx={xOf(active!)} cy={yOf(shown.value)} r={4.5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
          </>
        ) : null}

        <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--baseline)" strokeWidth={1} />

        {all.map((p, i) => {
          const isLast = i === all.length - 1;
          if (i % labelStride !== 0 && !isLast) return null;
          // Drop a label that would collide with the anchored final one.
          if (!isLast && xOf(all.length - 1) - xOf(i) < 34) return null;
          return (
            <text
              key={`x-${p.date}`}
              x={xOf(i)}
              y={HEIGHT - 7}
              // The final label is anchored inside the plot so it is not clipped.
              textAnchor={isLast ? "end" : i === 0 ? "start" : "middle"}
              fontSize={10}
              fill="var(--text-muted)"
            >
              {shortDate(p.date)}
            </text>
          );
        })}

        {all.map((p, i) => (
          <rect
            key={`hit-${p.date}`}
            x={xOf(i) - step / 2}
            y={PAD.top}
            width={Math.max(step, 8)}
            height={plotH}
            fill="transparent"
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
          />
        ))}
      </svg>

      <div className="legend">
        <span className="legend-item">
          <svg width="16" height="8" aria-hidden>
            <line x1="0" y1="4" x2="16" y2="4" stroke="var(--series-1)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Recorded
        </span>
        <span className="legend-item">
          <svg width="16" height="8" aria-hidden>
            <line x1="0" y1="4" x2="16" y2="4" stroke="var(--series-1)" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
          </svg>
          Projected
        </span>
        <span className="legend-item">
          <span className="swatch band" />
          Likely range
        </span>
      </div>

      <figcaption className="chart-readout">
        {shown ? (
          <>
            <strong>{Math.round(shown.value).toLocaleString()}</strong> {unitLabel} · {shortDate(shown.date)}
            {shown.isForecast ? (
              <span className="muted">
                {" "}
                projected, {Math.round(shown.lower).toLocaleString()}–{Math.round(shown.upper).toLocaleString()}
              </span>
            ) : null}
          </>
        ) : (
          "Tap or hover any point for its value."
        )}
      </figcaption>
    </figure>
  );
}
