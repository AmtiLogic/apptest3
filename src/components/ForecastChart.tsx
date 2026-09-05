"use client";

import { useState } from "react";
import type { Prediction } from "@/lib/forecast";
import type { TypicalRange } from "@/lib/stats";
import { useElementWidth } from "@/lib/useElementWidth";

export interface HistoryPoint {
  date: string;
  value: number;
}

const DEFAULT_HEIGHT = 240;
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
export interface ScrubPoint {
  date: string;
  value: number;
  isForecast: boolean;
  lower: number;
  upper: number;
}

export function ForecastChart({
  history,
  forecast,
  goal,
  unitLabel,
  /** Drops gridlines and axis labels; the scrub readout carries the values. */
  minimal = false,
  height,
  onScrub,
  /** The middle half of the user's own history, drawn as a reference band. */
  normalBand,
  /** Anchor the scale at zero. False lets a narrow range fill the plot. */
  zeroBaseline = true,
  /** The metric's own formatter, so labels keep their precision and unit. */
  formatValue,
}: {
  history: HistoryPoint[];
  forecast: Prediction[];
  goal?: number | null;
  unitLabel: string;
  minimal?: boolean;
  height?: number;
  onScrub?: (point: ScrubPoint | null) => void;
  normalBand?: TypicalRange | null;
  zeroBaseline?: boolean;
  formatValue?: (value: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const HEIGHT = height ?? DEFAULT_HEIGHT;

  if (history.length === 0) return <p className="empty">No history yet.</p>;

  const all = [
    ...history.map((p) => ({ ...p, isForecast: false, lower: p.value, upper: p.value })),
    ...forecast.map((p) => ({ date: p.date, value: p.value, isForecast: true, lower: p.lower, upper: p.upper })),
  ];

  const highs = [...all.map((p) => p.upper), ...(goal ? [goal] : []), ...(normalBand ? [normalBand.high] : [])];
  const lows = [...all.map((p) => p.lower), ...(goal ? [goal] : []), ...(normalBand ? [normalBand.low] : [])];
  const peak = Math.max(...highs, 1);
  const trough = Math.min(...lows);

  // A weight series spans a kilo or two; anchored at zero it is a flat line
  // with the whole plot empty beneath it.
  const span = Math.max(peak - (zeroBaseline ? 0 : trough), 1e-6);
  const floor = zeroBaseline ? 0 : trough - span * 0.15;
  const ceiling = zeroBaseline ? peak * 1.1 : peak + span * 0.15;
  const ticks = zeroBaseline ? niceTicks(peak) : [];

  const pad = minimal ? { top: 14, right: 2, bottom: 18, left: 2 } : PAD;
  const plotW = Math.max(width - pad.left - pad.right, 120);
  const plotH = HEIGHT - pad.top - pad.bottom;
  const step = all.length > 1 ? plotW / (all.length - 1) : 0;
  const xOf = (i: number) => pad.left + step * i;
  const yOf = (v: number) => pad.top + plotH - ((v - floor) / (ceiling - floor)) * plotH;

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

  // Highest and lowest recorded days, skipped when they sit under the endpoint
  // label or under each other.
  const extremes = (() => {
    if (history.length < 5) return [];
    let maxIndex = 0;
    let minIndex = 0;
    history.forEach((point, i) => {
      if (point.value > history[maxIndex].value) maxIndex = i;
      if (point.value < history[minIndex].value) minIndex = i;
    });
    const candidates = [
      { index: maxIndex, value: history[maxIndex].value, isMax: true },
      { index: minIndex, value: history[minIndex].value, isMax: false },
    ];
    return candidates.filter(
      (c) => Math.abs(c.index - (all.length - 1)) > 2 && Math.abs(maxIndex - minIndex) > 2,
    );
  })();
  const shown = active === null ? null : all[active];

  const label = (value: number) => (formatValue ? formatValue(value) : Math.round(value).toLocaleString());

  const scrubTo = (index: number | null) => {
    setActive(index);
    onScrub?.(index === null ? null : (all[index] as ScrubPoint));
  };
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
        onPointerLeave={() => scrubTo(null)}
      >
        {minimal ? null : ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={yOf(t)} y2={yOf(t)} stroke="var(--gridline)" strokeWidth={1} />
            <text x={pad.left - 6} y={yOf(t) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
              {t >= 1000 ? `${t / 1000}k` : t}
            </text>
          </g>
        ))}

        {goal ? (
          <>
            <line x1={pad.left} x2={width - pad.right} y1={yOf(goal)} y2={yOf(goal)} stroke="var(--baseline)" strokeWidth={1} />
            <text x={pad.left + 4} y={yOf(goal) - 5} textAnchor="start" fontSize={10} fill="var(--text-muted)">
              goal
            </text>
          </>
        ) : null}

        {/* "Normal for you", so a value can be judged without reading an axis. */}
        {normalBand ? (
          <>
            <rect
              x={pad.left}
              y={yOf(normalBand.high)}
              width={plotW}
              height={Math.max(yOf(normalBand.low) - yOf(normalBand.high), 1)}
              fill="var(--text-muted)"
              opacity={0.13}
              rx={3}
            />
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yOf(normalBand.median)}
              y2={yOf(normalBand.median)}
              stroke="var(--text-muted)"
              strokeWidth={1}
              opacity={0.55}
            />
            {/* Anchored right, so it cannot stack on the goal label at the left. */}
            <text
              x={width - pad.right - 3}
              y={yOf(normalBand.high) - 4}
              textAnchor="end"
              fontSize={9.5}
              fill="var(--text-muted)"
            >
              typical
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

        {/* Label the extremes directly rather than making the axis carry them. */}
        {active === null
          ? extremes.map((point) => (
              <text
                key={`extreme-${point.index}`}
                // Half the rendered label, so an edge value is never clipped.
                x={(() => {
                  const half = (label(point.value).length * 5.6) / 2 + 2;
                  return Math.min(Math.max(xOf(point.index), pad.left + half), width - pad.right - half);
                })()}
                y={point.isMax ? yOf(point.value) - 7 : yOf(point.value) + 14}
                textAnchor="middle"
                fontSize={10.5}
                fontWeight={600}
                fill="var(--text-secondary)"
              >
                {label(point.value)}
              </text>
            ))
          : null}

        {last && active === null ? (
          <text
            x={Math.min(xOf(all.length - 1), width - pad.right - 4)}
            y={yOf(last.value) - 10}
            textAnchor="end"
            fontSize={11}
            fontWeight={600}
            fill="var(--text-primary)"
          >
            {label(last.value)}
          </text>
        ) : null}

        {shown ? (
          <>
            <line x1={xOf(active!)} x2={xOf(active!)} y1={pad.top} y2={pad.top + plotH} stroke="var(--baseline)" strokeWidth={1} />
            <circle cx={xOf(active!)} cy={yOf(shown.value)} r={4.5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
          </>
        ) : null}

        <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="var(--baseline)" strokeWidth={1} />

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
            y={pad.top}
            width={Math.max(step, 8)}
            height={plotH}
            fill="transparent"
            onPointerEnter={() => scrubTo(i)}
            onPointerDown={() => scrubTo(i)}
          />
        ))}
      </svg>

      {minimal ? null : (
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
      )}

      {minimal ? null : (
      <figcaption className="chart-readout">
        {shown ? (
          <>
            <strong>{label(shown.value)}</strong> · {shortDate(shown.date)}
            {shown.isForecast ? (
              <span className="muted">
                {" "}
                projected, {label(shown.lower)}–{label(shown.upper)}
              </span>
            ) : null}
          </>
        ) : (
          "Tap or hover any point for its value."
        )}
      </figcaption>
      )}
    </figure>
  );
}
