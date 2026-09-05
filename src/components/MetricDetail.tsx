"use client";

import { useState } from "react";
import { ForecastChart, type ScrubPoint } from "@/components/ForecastChart";
import { Hero } from "@/components/Hero";
import { MomentumCard } from "@/components/MomentumCard";
import { RANGES, RangeTabs, type RangeKey } from "@/components/RangeTabs";
import { SyncIssues } from "@/components/SyncIssues";
import { TopBar } from "@/components/TopBar";
import { METRICS, buildSeries, summariseMetric, type MetricKey } from "@/lib/metrics";
import { percentileOf } from "@/lib/stats";
import { stepGoal } from "@/lib/todayMetrics";
import { useDashboard } from "@/lib/useDashboard";

function longDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** Every metric gets the same treatment: trend, projection, and context. */
export function MetricDetail({ metricKey }: { metricKey: MetricKey }) {
  const { data, error, issues, loading, syncing, syncedAt, refresh } = useDashboard();
  const [range, setRange] = useState<RangeKey>("1M");
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);

  const definition = METRICS[metricKey];

  if (loading || !data) {
    return (
      <main className="shell">
        <TopBar title={definition.label} onSync={refresh} syncing={syncing} syncedAt={syncedAt} />
        <div className="skeleton line" style={{ height: 44, width: "60%", marginTop: 14 }} />
        <div className="skeleton block" style={{ marginTop: 18 }} />
      </main>
    );
  }

  const goal = metricKey === "steps" ? stepGoal(data.daily, data.steps) : null;
  const series = buildSeries({ steps: data.steps, activities: data.activities, weight: data.weight })[metricKey];
  const summary = summariseMetric(metricKey, series, goal);

  const values = summary.recorded.map((p) => p.value);
  const windowDays = RANGES.find((r) => r.key === range)?.days ?? 30;
  const shown = summary.recorded.slice(-windowDays);

  // Whether a trend is worth naming depends on the metric's own variability,
  // not on a fixed percentage: 0.4% a week is noise in a step count and a real
  // drift in a body weight.
  const fit = summary.forecast.fit;
  const changePerWeek = summary.forecast.changePerWeek ?? 0;
  const notable =
    summary.forecast.status === "ok" &&
    !!fit &&
    fit.r2 >= 0.15 &&
    Math.abs(changePerWeek) >= 0.5 * fit.residualSd;

  const projectedAverage =
    summary.forecast.predictions.reduce((sum, p) => sum + p.value, 0) /
    Math.max(summary.forecast.predictions.length, 1);

  const projection =
    summary.forecast.status !== "ok"
      ? (summary.forecast.reason ?? "Not enough history to project yet.")
      : `${
          notable
            ? `Trending ${changePerWeek > 0 ? "up" : "down"} about ${definition.sentence(Math.abs(changePerWeek))} a week. `
            : "Holding steady week to week. "
        }Next 7 days projected around ${definition.sentence(projectedAverage)}${
          // Counts accumulate per day; a weight or a heart rate does not.
          definition.zeroBaseline ? " a day" : ""
        }.`;

  const caption = scrub
    ? `${longDate(scrub.date)}${scrub.isForecast ? " · projected" : ""}`
    : summary.latest
      ? longDate(summary.latest.date)
      : "no readings yet";

  return (
    <main className="shell">
      <TopBar title={definition.label} onSync={refresh} syncing={syncing} syncedAt={syncedAt} />
      <SyncIssues error={error} issues={issues} />

      {!summary.available ? (
        <section className="card">
          <h2>Nothing recorded</h2>
          <p className="sub" style={{ marginBottom: 0 }}>
            {definition.description} No readings have come through yet, so there is
            nothing to chart or project.
          </p>
        </section>
      ) : (
        <>
          <Hero
            label={definition.label}
            value={scrub ? scrub.value : summary.latest!.value}
            caption={caption}
            format={definition.format}
            activityLike={definition.zeroBaseline}
            delta={summary.delta}
            scrubbed={scrub !== null}
            percentile={scrub ? percentileOf(scrub.value, values) : summary.percentile}
          />

          <ForecastChart
            history={shown}
            forecast={summary.forecast.predictions}
            goal={goal}
            unitLabel={definition.label.toLowerCase()}
            minimal
            height={200}
            onScrub={setScrub}
            normalBand={summary.typical}
            zeroBaseline={definition.zeroBaseline}
            formatValue={definition.format}
          />
          <RangeTabs value={range} onChange={setRange} />

          <section className="card">
            <h2>Projection</h2>
            <p className="sub" style={{ marginBottom: 0 }}>
              {projection}
            </p>
          </section>

          <section className="card">
            <h2>Your range</h2>
            <div className="metrics">
              {summary.typical ? (
                <>
                  <div className="metric">
                    <span className="metric-label">Typical day</span>
                    <span className="metric-value">{definition.format(summary.typical.median)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Middle half</span>
                    <span className="metric-value">
                      {definition.format(summary.typical.low)} – {definition.format(summary.typical.high)}
                    </span>
                  </div>
                </>
              ) : null}
              <div className="metric">
                <span className="metric-label">Best</span>
                <span className="metric-value">{definition.format(Math.max(...values))}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Lowest</span>
                <span className="metric-value">{definition.format(Math.min(...values))}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Days recorded</span>
                <span className="metric-value">{summary.recorded.length}</span>
              </div>
            </div>
            <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>{definition.description}</p>
          </section>

          {summary.momentum ? <MomentumCard momentum={summary.momentum} /> : null}
        </>
      )}
    </main>
  );
}
