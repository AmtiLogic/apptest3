export function Tile({
  label,
  value,
  unit,
  meta,
  delta,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  meta?: string | null;
  /** Percent change against the recent baseline, if one could be computed. */
  delta?: number | null;
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "number"
        ? Math.round(value).toLocaleString()
        : value;

  // Below a point or two, a change is noise and not worth a badge.
  const shown = delta !== null && delta !== undefined && Math.abs(delta) >= 2 ? Math.round(delta) : null;

  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className="value">
        {display}
        {unit && display !== "—" ? <span className="unit">{unit}</span> : null}
      </div>
      {shown !== null ? (
        <div className={`delta ${shown > 0 ? "up" : "down"}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path
              d={shown > 0 ? "M5 8V2m0 0L2 5m3-3 3 3" : "M5 2v6m0 0L2 5m3 3 3-3"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {Math.abs(shown)}% vs last week
        </div>
      ) : meta ? (
        <div className="meta">{meta}</div>
      ) : null}
    </div>
  );
}
