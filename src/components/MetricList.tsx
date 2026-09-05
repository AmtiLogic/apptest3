import Link from "next/link";
import { Sparkline } from "@/components/Sparkline";
import type { MetricSummary } from "@/lib/metrics";

/**
 * Every metric, each a door into its own screen with the same forecast,
 * typical range and percentile the headline metric gets.
 */
export function MetricList({ summaries }: { summaries: MetricSummary[] }) {
  return (
    <div className="metrics">
      {summaries.map((summary) => {
        const { definition, latest } = summary;
        const delta = summary.delta !== null && Math.abs(summary.delta) >= 2 ? Math.round(summary.delta) : null;

        if (!summary.available) {
          return (
            <div className="metric" key={definition.key}>
              <span className="metric-label">{definition.label}</span>
              <span className="metric-value missing">No data</span>
            </div>
          );
        }

        return (
          <Link className="metric link metric-row" key={definition.key} href={`/metric/${definition.key}`}>
            <span className="metric-label">{definition.label}</span>
            <Sparkline values={summary.recorded.slice(-30).map((p) => p.value)} />
            <span className="metric-value">
              {definition.format(latest!.value)}
              {delta !== null ? (
                <span className={`metric-delta ${delta > 0 ? "up" : "down"}`}>
                  {delta > 0 ? "+" : "−"}
                  {Math.abs(delta)}%
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
