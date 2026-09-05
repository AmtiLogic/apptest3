"use client";

/**
 * The one number that matters, with what it did this week.
 *
 * Scrubbing the chart replaces the value and the caption, so the figure always
 * answers "what am I looking at" without a tooltip.
 */
export function Hero({
  label,
  value,
  unit,
  caption,
  delta,
  scrubbed,
}: {
  label: string;
  value: number | null;
  unit?: string;
  caption: string;
  /** Percent change against the recent baseline. */
  delta: number | null;
  scrubbed: boolean;
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
    </header>
  );
}
