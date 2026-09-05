"use client";

import { useMemo, useState } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { ForecastChart, type ScrubPoint } from "@/components/ForecastChart";
import { Hero } from "@/components/Hero";
import { InsightCard } from "@/components/InsightCard";
import { MetricRows, type MetricRow } from "@/components/MetricRows";
import { RANGES, RangeTabs, type RangeKey } from "@/components/RangeTabs";
import { SleepChart, type SleepStage } from "@/components/SleepChart";
import { SyncIssues } from "@/components/SyncIssues";
import { TopBar } from "@/components/TopBar";
import { forecastDaily, goalOutlook, type DailyPoint } from "@/lib/forecast";
import { formatHoursMinutes } from "@/lib/format";
import { compareToRecent, loadInsight, stepsInsight } from "@/lib/insights";
import { activeMinutes, distanceKm, stepGoal, todaySteps } from "@/lib/todayMetrics";
import { trainingLoad } from "@/lib/trainingLoad";
import { useDashboard } from "@/lib/useDashboard";

const HORIZON_DAYS = 7;

function longDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function DashboardPage() {
  const { data, error, issues, loading, syncing, syncedAt, refresh } = useDashboard();
  const [range, setRange] = useState<RangeKey>("1M");
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);

  // "Nothing recorded" and "could not load" look identical otherwise, which is
  // exactly the confusion this screen exists to avoid.
  const failed = useMemo(() => new Set(issues.map((issue) => issue.source)), [issues]);

  const analysis = useMemo(() => {
    if (!data) return null;

    const series: DailyPoint[] = data.steps.map((d) => ({ date: d.calendarDate, value: d.totalSteps }));
    const goal = stepGoal(data.daily, data.steps);

    // The model sees the whole window; the tabs only change what is drawn.
    const forecast = forecastDaily(series, HORIZON_DAYS);
    const outlook = goalOutlook(series, forecast, goal);
    const today = data.daily?.calendarDate ?? series[series.length - 1]?.date ?? new Date().toISOString().slice(0, 10);

    const history = series.filter((p): p is { date: string; value: number } => p.value !== null && p.value > 0);
    const recent = series.slice(-8, -1).map((p) => p.value).filter((v): v is number => v !== null && v > 0);
    const steps = todaySteps(data.daily, data.steps);

    return {
      goal,
      forecast,
      history,
      steps,
      stepsDelta: compareToRecent(steps.value, recent),
      insight: stepsInsight(forecast, outlook, goal),
      load: loadInsight(trainingLoad(data.activities, today)),
    };
  }, [data]);

  if (error && !data) {
    return (
      <main className="shell">
        <TopBar title="Today" onSync={refresh} syncing={syncing} syncedAt={syncedAt} />
        <SyncIssues error={error} issues={issues} />
      </main>
    );
  }

  if (loading || !data || !analysis) {
    return (
      <main className="shell">
        <TopBar title="Today" onSync={refresh} syncing={syncing} syncedAt={syncedAt} />
        <div className="skeleton line short" style={{ width: 90, marginTop: 12 }} />
        <div className="skeleton line" style={{ height: 44, width: "60%" }} />
        <div className="skeleton block" style={{ marginTop: 18 }} />
      </main>
    );
  }

  const { daily, sleep, profile } = data;
  const night = sleep?.dailySleepDTO ?? null;

  const windowDays = RANGES.find((r) => r.key === range)?.days ?? 30;
  const shownHistory = analysis.history.slice(-windowDays);

  const km = distanceKm(daily);
  const active = activeMinutes(daily);
  const summaryMissing = failed.has("daily");
  const dash = (label: string): MetricRow => ({ label, value: "—", missing: true });

  const rows: MetricRow[] = [
    km !== null ? { label: "Distance", value: `${km.toFixed(2)} km` } : dash("Distance"),
    daily?.totalKilocalories
      ? {
          label: "Calories",
          value: Math.round(daily.totalKilocalories).toLocaleString(),
          sub: daily.activeKilocalories ? `${Math.round(daily.activeKilocalories)} active` : null,
        }
      : dash("Calories"),
    daily?.restingHeartRate
      ? {
          label: "Resting HR",
          value: `${daily.restingHeartRate} bpm`,
          sub: daily.minHeartRate && daily.maxHeartRate ? `${daily.minHeartRate}–${daily.maxHeartRate} today` : null,
        }
      : dash("Resting HR"),
    daily?.bodyBatteryMostRecentValue
      ? { label: "Body Battery", value: String(daily.bodyBatteryMostRecentValue) }
      : dash("Body Battery"),
    active !== null ? { label: "Active", value: `${active} min` } : dash("Active"),
    night?.sleepTimeSeconds
      ? { label: "Sleep", value: formatHoursMinutes(night.sleepTimeSeconds) ?? "—" }
      : dash("Sleep"),
  ];

  const stages: SleepStage[] = [
    { label: "Deep", seconds: night?.deepSleepSeconds ?? 0, color: "var(--series-1)" },
    { label: "Light", seconds: night?.lightSleepSeconds ?? 0, color: "var(--series-2)" },
    { label: "REM", seconds: night?.remSleepSeconds ?? 0, color: "var(--series-3)" },
    { label: "Awake", seconds: night?.awakeSleepSeconds ?? 0, color: "var(--series-4)" },
  ];

  const heroCaption = scrub
    ? `${longDate(scrub.date)}${scrub.isForecast ? " · projected" : ""}`
    : analysis.steps.source === "history"
      ? "steps, latest recorded day"
      : "steps today";

  return (
    <main className="shell">
      <TopBar
        title="Today"
        who={profile.fullName ?? profile.displayName}
        onSync={refresh}
        syncing={syncing}
        syncedAt={syncedAt}
      />
      <DemoBanner />
      <SyncIssues error={error} issues={issues} />

      <Hero
        label="Steps"
        value={scrub ? scrub.value : analysis.steps.value}
        caption={heroCaption}
        delta={analysis.stepsDelta}
        scrubbed={scrub !== null}
      />

      {failed.has("steps") ? (
        <p className="empty failed">Step history could not be loaded — see the message above.</p>
      ) : (
        <>
          <ForecastChart
            history={shownHistory}
            forecast={analysis.forecast.predictions}
            goal={analysis.goal}
            unitLabel="steps"
            minimal
            height={190}
            onScrub={setScrub}
          />
          <RangeTabs value={range} onChange={setRange} />
        </>
      )}

      <InsightCard insight={analysis.insight} label={`Projection · next ${HORIZON_DAYS} days`} />

      <section className="card">
        <h2>Today</h2>
        {summaryMissing ? (
          <p className="sub">
            Garmin&rsquo;s daily summary is unavailable, so only what other endpoints
            provide is shown.
          </p>
        ) : null}
        <MetricRows rows={rows} />
      </section>

      <div className="two-col">
        <InsightCard insight={analysis.load} label="Training volume" />

        <section className="card">
          <h2>Last night&rsquo;s sleep</h2>
          <p className="sub">
            {night?.calendarDate ?? "—"}
            {formatHoursMinutes(night?.sleepTimeSeconds) ? ` · ${formatHoursMinutes(night?.sleepTimeSeconds)} asleep` : ""}
          </p>
          {failed.has("sleep") ? (
            <p className="empty failed">Sleep could not be loaded — see the message above.</p>
          ) : (
            <SleepChart stages={stages} />
          )}
        </section>
      </div>
    </main>
  );
}
