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
function percentilePhrase(percentile: number, activity: boolean): string {
  const rounded = Math.round(percentile);
  if (rounded >= 95) return activity ? "One of your highest days ever" : "Your highest reading yet";
  if (rounded >= 80) return `Higher than ${rounded}% of your ${activity ? "days" : "readings"}`;
  if (rounded >= 55) return "A little above your usual";
  if (rounded >= 45) return "Right around your usual";
  if (rounded >= 20) return `Lower than ${100 - rounded}% of your ${activity ? "days" : "readings"}`;
  // "One of your quietest days" is meaningless for a weight or a heart rate.
  return activity ? "One of your quietest days" : "Your lowest reading yet";
}

export function Hero({
  label,
  value,
  unit,
  caption,
  delta,
  scrubbed,
  percentile,
  format,
  /** False for readings like weight, where "high" carries no activity meaning. */
  activityLike = true,
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
  /**
   * The metric's own formatter. Without it a hero rounds to a whole number,
   * which turns 9.44 km into "9 km" and 81.7 kg into "82 kg".
   */
  format?: (value: number) => string;
  activityLike?: boolean;
}) {
  const shown = delta !== null && Math.abs(delta) >= 1 ? Math.round(delta) : null;

  return (
    <header className="hero">
      <div className="hero-label">{label}</div>
      <div className="hero-value">
        {value === null ? "—" : format ? format(value) : Math.round(value).toLocaleString()}
        {unit && value !== null && !format ? <span className="hero-unit">{unit}</span> : null}
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
        <div className="hero-context">{percentilePhrase(percentile, activityLike)}</div>
      ) : null}
    </header>
  );
}
