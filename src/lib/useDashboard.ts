"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "./fetcher";
import type { Activity, DailySummary, SleepSummary, SocialProfile, StepsForDay } from "./garmin/endpoints";

/** Enough history for the weekday term in the forecast, and four weeks of load. */
export const HISTORY_DAYS = 28;

export interface DashboardData {
  profile: SocialProfile;
  daily: DailySummary | null;
  sleep: SleepSummary | null;
  steps: StepsForDay[];
  activities: Activity[];
}

export interface DashboardState {
  data: DashboardData | null;
  error: string | null;
  /** True for the first load, when there is nothing to show yet. */
  loading: boolean;
  /** True for a refresh, when the previous data stays on screen. */
  syncing: boolean;
  syncedAt: Date | null;
  refresh: () => void;
}

export function useDashboard(): DashboardState {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    // Ignore a second tap while a sync is already running.
    if (inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);

    try {
      const profile = await apiGet<SocialProfile>("/api/garmin/profile");
      // Settled rather than all: one missing night should not blank the page.
      const [daily, sleep, steps, activities] = await Promise.all([
        apiGet<DailySummary>("/api/garmin/daily").catch(() => null),
        apiGet<SleepSummary>("/api/garmin/sleep").catch(() => null),
        apiGet<StepsForDay[]>(`/api/garmin/steps?days=${HISTORY_DAYS}`).catch(() => []),
        apiGet<Activity[]>("/api/garmin/activities?limit=60").catch(() => []),
      ]);

      setData({ profile, daily, sleep, steps: steps ?? [], activities: activities ?? [] });
      setSyncedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data");
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading: data === null && syncing, syncing, syncedAt, refresh };
}

export function relativeTime(date: Date, now = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
