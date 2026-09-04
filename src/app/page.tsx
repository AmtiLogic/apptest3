"use client";

import { useEffect, useState } from "react";
import { SleepChart, type SleepStage } from "@/components/SleepChart";
import { StepsChart, type StepsPoint } from "@/components/StepsChart";
import { Tile } from "@/components/Tile";
import { DemoBanner } from "@/components/DemoBanner";
import { TopBar } from "@/components/TopBar";
import type { DailySummary, SleepSummary, SocialProfile, StepsForDay } from "@/lib/garmin/endpoints";
import { apiGet } from "@/lib/fetcher";
import { formatHoursMinutes } from "@/lib/format";

interface Dashboard {
  profile: SocialProfile;
  daily: DailySummary | null;
  sleep: SleepSummary | null;
  steps: StepsForDay[];
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const profile = await apiGet<SocialProfile>("/api/garmin/profile");
        // Settled rather than all: a missing day of sleep should not blank the page.
        const [daily, sleep, steps] = await Promise.all([
          apiGet<DailySummary>("/api/garmin/daily").catch(() => null),
          apiGet<SleepSummary>("/api/garmin/sleep").catch(() => null),
          apiGet<StepsForDay[]>("/api/garmin/steps?days=14").catch(() => []),
        ]);
        if (!cancelled) setData({ profile, daily, sleep, steps: steps ?? [] });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load data");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="shell">
        <div className="notice error">{error}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="shell">
        <p className="empty">Loading your Garmin data…</p>
      </main>
    );
  }

  const { profile, daily, sleep, steps } = data;
  const night = sleep?.dailySleepDTO ?? null;

  const stages: SleepStage[] = [
    { label: "Deep", seconds: night?.deepSleepSeconds ?? 0, color: "var(--series-1)" },
    { label: "Light", seconds: night?.lightSleepSeconds ?? 0, color: "var(--series-2)" },
    { label: "REM", seconds: night?.remSleepSeconds ?? 0, color: "var(--series-3)" },
    { label: "Awake", seconds: night?.awakeSleepSeconds ?? 0, color: "var(--series-4)" },
  ];

  const stepSeries: StepsPoint[] = steps.map((d) => ({
    date: d.calendarDate,
    steps: d.totalSteps ?? 0,
    goal: d.stepGoal ?? daily?.dailyStepGoal ?? null,
  }));

  const distanceKm = daily?.totalDistanceMeters ? daily.totalDistanceMeters / 1000 : null;
  const activeMinutes =
    daily?.highlyActiveSeconds != null || daily?.activeSeconds != null
      ? Math.round(((daily?.highlyActiveSeconds ?? 0) + (daily?.activeSeconds ?? 0)) / 60)
      : null;

  return (
    <main className="shell">
      <TopBar title="Today" who={profile.fullName ?? profile.displayName} />
      <DemoBanner />

      <div className="grid">
        <Tile
          label="Steps"
          value={daily?.totalSteps ?? null}
          meta={daily?.dailyStepGoal ? `Goal ${daily.dailyStepGoal.toLocaleString()}` : null}
        />
        <Tile
          label="Distance"
          value={distanceKm ? distanceKm.toFixed(2) : null}
          unit="km"
        />
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
          meta={
            daily?.minHeartRate && daily?.maxHeartRate
              ? `${daily.minHeartRate}–${daily.maxHeartRate} today`
              : null
          }
        />
        <Tile label="Body Battery" value={daily?.bodyBatteryMostRecentValue ?? null} />
        <Tile label="Active time" value={activeMinutes} unit="min" />
      </div>

      <div className="two-col">
        <section className="card">
          <h2>Steps</h2>
          <p className="sub">Last {stepSeries.length || 14} days</p>
          <StepsChart data={stepSeries} />
        </section>

        <section className="card">
          <h2>Last night&rsquo;s sleep</h2>
          <p className="sub">
            {night?.calendarDate ?? "—"}
            {formatHoursMinutes(night?.sleepTimeSeconds) ? ` · ${formatHoursMinutes(night?.sleepTimeSeconds)} asleep` : ""}
          </p>
          <SleepChart stages={stages} />
          {night?.averageSpo2Value || night?.averageRespirationValue ? (
            <p className="sub" style={{ marginTop: 14, marginBottom: 0 }}>
              {night.averageSpo2Value ? `SpO₂ ${night.averageSpo2Value}%` : ""}
              {night.averageSpo2Value && night.averageRespirationValue ? " · " : ""}
              {night.averageRespirationValue ? `${night.averageRespirationValue} breaths/min` : ""}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
