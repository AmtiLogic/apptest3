"use client";

import { useMemo } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { SyncIssues } from "@/components/SyncIssues";
import { ForecastChart } from "@/components/ForecastChart";
import { InsightCard } from "@/components/InsightCard";
import { SleepChart, type SleepStage } from "@/components/SleepChart";
import { Tile } from "@/components/Tile";
import { TopBar } from "@/components/TopBar";
import { forecastDaily, goalOutlook, type DailyPoint } from "@/lib/forecast";
import { formatHoursMinutes } from "@/lib/format";
import { compareToRecent, loadInsight, stepsInsight } from "@/lib/insights";
import { trainingLoad } from "@/lib/trainingLoad";
import { useDashboard } from "@/lib/useDashboard";

const HORIZON_DAYS = 7;

export default function DashboardPage() {
  const { data, error, issues, loading, syncing, syncedAt, refresh } = useDashboard();

  // "Nothing recorded" and "could not load" look identical otherwise, which is
  // exactly the confusion this whole screen is meant to avoid.
  const failed = useMemo(() => new Set(issues.map((issue) => issue.source)), [issues]);

  const analysis = useMemo(() => {
    if (!data) return null;

    const series: DailyPoint[] = data.steps.map((d) => ({ date: d.calendarDate, value: d.totalSteps }));
    const goal = data.daily?.dailyStepGoal ?? data.steps.find((d) => d.stepGoal)?.stepGoal ?? null;

    const forecast = forecastDaily(series, HORIZON_DAYS);
    const outlook = goalOutlook(series, forecast, goal);
    const today = data.daily?.calendarDate ?? series[series.length - 1]?.date ?? new Date().toISOString().slice(0, 10);
    const load = trainingLoad(data.activities, today);

    // Compare today against the week before it, excluding today itself.
    const recent = series.slice(-8, -1).map((p) => p.value).filter((v): v is number => v !== null && v > 0);

    return {
      goal,
      forecast,
      history: series.filter((p): p is { date: string; value: number } => p.value !== null && p.value > 0),
      steps: stepsInsight(forecast, outlook, goal),
      load: loadInsight(load),
      stepsDelta: compareToRecent(data.daily?.totalSteps ?? null, recent),
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
        <div className="grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="card tile" key={i}>
              <div className="skeleton line short" />
              <div className="skeleton line tall" />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="skeleton block" />
        </div>
      </main>
    );
  }

  const { daily, sleep, profile } = data;
  const night = sleep?.dailySleepDTO ?? null;

  const stages: SleepStage[] = [
    { label: "Deep", seconds: night?.deepSleepSeconds ?? 0, color: "var(--series-1)" },
    { label: "Light", seconds: night?.lightSleepSeconds ?? 0, color: "var(--series-2)" },
    { label: "REM", seconds: night?.remSleepSeconds ?? 0, color: "var(--series-3)" },
    { label: "Awake", seconds: night?.awakeSleepSeconds ?? 0, color: "var(--series-4)" },
  ];

  const distanceKm = daily?.totalDistanceMeters ? daily.totalDistanceMeters / 1000 : null;
  const activeMinutes =
    daily?.highlyActiveSeconds != null || daily?.activeSeconds != null
      ? Math.round(((daily?.highlyActiveSeconds ?? 0) + (daily?.activeSeconds ?? 0)) / 60)
      : null;

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

      <InsightCard insight={analysis.steps} label={`Steps · next ${HORIZON_DAYS} days`} />

      <div className="grid">
        <Tile
          label="Steps"
          value={daily?.totalSteps ?? null}
          delta={analysis.stepsDelta}
          meta={analysis.goal ? `Goal ${analysis.goal.toLocaleString()}` : null}
        />
        <Tile label="Distance" value={distanceKm ? distanceKm.toFixed(2) : null} unit="km" />
        <Tile
          label="Calories"
          value={daily?.totalKilocalories ?? null}
          unit="kcal"
          meta={daily?.activeKilocalories ? `${Math.round(daily.activeKilocalories)} active` : null}
        />
        <Tile
          label="Resting HR"
          value={daily?.restingHeartRate ?? null}
          unit="bpm"
          meta={daily?.minHeartRate && daily?.maxHeartRate ? `${daily.minHeartRate}–${daily.maxHeartRate} today` : null}
        />
        <Tile label="Body Battery" value={daily?.bodyBatteryMostRecentValue ?? null} />
        <Tile label="Active time" value={activeMinutes} unit="min" />
      </div>

      <div className="stack">
        <section className="card">
          <h2>Steps &amp; projection</h2>
          <p className="sub">
            {analysis.forecast.status === "ok"
              ? `${analysis.history.length} days recorded, ${HORIZON_DAYS} days projected from the trend and your weekly pattern.`
              : "Recorded history. A projection appears once there are seven days."}
          </p>
          {failed.has("steps") ? (
            <p className="empty failed">Step history could not be loaded — see the message above.</p>
          ) : (
            <ForecastChart
              history={analysis.history}
              forecast={analysis.forecast.predictions}
              goal={analysis.goal}
              unitLabel="steps"
            />
          )}
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
      </div>
    </main>
  );
}
