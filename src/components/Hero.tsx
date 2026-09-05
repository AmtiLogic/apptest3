"use client";

/**
 * The one number that matters, with what it did this week.
 *
 * Scrubbing the chart replaces the value and the caption, so the figure always
 * answers "what am I looking at" without a tooltip.
 */
/**
 * Says what the number means without a chart lookup. "9,431" is not
 * interpretable; "higher than 72% of your days" is.
 */
function percentilePhrase(percentile: number): string {
  const rounded = Math.round(percentile);
  if (rounded >= 95) return "One of your highest days ever";
  if (rounded >= 80) return `Higher than ${rounded}% of your days`;
  if (rounded >= 55) return `A little above your usual`;
  if (rounded >= 45) return "Right around your usual";
  if (rounded >= 20) return `Lower than ${100 - rounded}% of your days`;
  return "One of your quietest days";
}

export function Hero({
  label,
  value,
  unit,
  caption,
  delta,
  scrubbed,
  percentile,
}: {
  label: string;
  value: number | null;
  unit?: string;
  caption: string;
  /** Percent change against the recent baseline. */
  delta: number | null;
  scrubbed: boolean;
  /** Where this value sits in the user's own history, 0-100. */
  percentile?: number | null;
}) {
  const shown = delta !== null && Math.abs(delta) >= 1 ? Math.round(delta) : null;

  return (
    <header className="hero">
      <div className="hero-label">{label}</div>
      <div className="hero-value">
        {value === null ? "—" : Math.round(value).toLocaleString()}
        {unit && value !== null ? <span className="hero-unit">{unit}</span> : null}
      </div>
      <div className="hero-caption">
        {!scrubbed && shown !== null ? (
          <span className={`hero-delta ${shown > 0 ? "up" : "down"}`}>
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
              <path
                d={shown > 0 ? "M5 8V2m0 0L2 5m3-3 3 3" : "M5 2v6m0 0L2 5m3 3 3-3"}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {Math.abs(shown)}%
          </span>
        ) : null}
        <span>{caption}</span>
      </div>
      {percentile !== null && percentile !== undefined ? (
        <div className="hero-context">{percentilePhrase(percentile)}</div>
      ) : null}
    </header>
  );
}
