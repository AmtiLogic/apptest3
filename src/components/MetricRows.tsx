export interface MetricRow {
  label: string;
  value: string;
  sub?: string | null;
  /** Renders muted, so a missing number never looks like a real reading. */
  missing?: boolean;
}

export function MetricRows({ rows }: { rows: MetricRow[] }) {
  return (
    <div className="metrics">
      {rows.map((row) => (
        <div className="metric" key={row.label}>
          <span className="metric-label">{row.label}</span>
          <span className={row.missing ? "metric-value missing" : "metric-value"}>
            {row.value}
            {row.sub ? <span className="metric-sub">{row.sub}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
