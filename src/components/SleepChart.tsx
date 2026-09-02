"use client";

import { formatHoursMinutes } from "@/lib/format";

export interface SleepStage {
  label: string;
  seconds: number;
  color: string;
}

const GAP = 2;
const BAR_HEIGHT = 24;

const duration = (seconds: number) => formatHoursMinutes(seconds) ?? "0m";

/**
 * A single stacked bar of sleep stages. The legend carries a value per stage:
 * interior segments have no free end to label, and the light-mode aqua/yellow
 * steps sit below 3:1 on the surface, so the values must be visible as text.
 */
export function SleepChart({ stages }: { stages: SleepStage[] }) {
  const present = stages.filter((s) => s.seconds > 0);
  const total = present.reduce((sum, s) => sum + s.seconds, 0);

  if (total === 0) return <p className="empty">No sleep recorded for this night.</p>;

  return (
    <figure style={{ margin: 0 }}>
      {/* Flexbox rather than SVG: the 2px surface gaps and the rounded ends of
          the stack stay exact at any container width. */}
      <div
        style={{ display: "flex", gap: GAP, height: BAR_HEIGHT, width: "100%" }}
        role="img"
        aria-label={`Sleep stages totalling ${duration(total)}`}
      >
        {present.map((stage, i) => (
          <div
            key={stage.label}
            title={`${stage.label}: ${duration(stage.seconds)}`}
            style={{
              flexGrow: stage.seconds,
              flexBasis: 0,
              background: stage.color,
              borderTopLeftRadius: i === 0 ? 4 : 0,
              borderBottomLeftRadius: i === 0 ? 4 : 0,
              borderTopRightRadius: i === present.length - 1 ? 4 : 0,
              borderBottomRightRadius: i === present.length - 1 ? 4 : 0,
            }}
          />
        ))}
      </div>

      <div className="legend">
        {stages.map((stage) => (
          <span className="legend-item" key={stage.label}>
            <span className="swatch" style={{ background: stage.color }} />
            {stage.label}
            <span className="legend-value">{duration(stage.seconds)}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}
