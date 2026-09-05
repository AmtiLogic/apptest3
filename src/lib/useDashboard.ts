"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { localDate } from "./dateWindows";
import { apiGet } from "./fetcher";
import type { Activity, DailySummary, SleepSummary, SocialProfile, StepsForDay } from "./garmin/endpoints";

/** Enough history for the weekday term in the forecast, and four weeks of load. */
/** Fetched once; the range tabs slice this for display. */
export const HISTORY_DAYS = 90;

export type SourceKey = "profile" | "daily" | "sleep" | "steps" | "activities";

export interface SourceIssue {
  source: SourceKey;
  label: string;
  message: string;
}

export interface DashboardData {
  profile: SocialProfile;
  daily: DailySummary | null;
  sleep: SleepSummary | null;
  steps: StepsForDay[];
  activities: Activity[];
}

export interface DashboardState {
  data: DashboardData | null;
  /** Set when the sync could not complete at all. */
  error: string | null;
  /** Sources that failed while others succeeded. Never silently discarded. */
  issues: SourceIssue[];
  loading: boolean;
  syncing: boolean;
  syncedAt: Date | null;
  refresh: () => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useDashboard(): DashboardState {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<SourceIssue[]>([]);
  const [syncing, setSyncing] = useState(true);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    // Ignore a second tap while a sync is already running.
    if (inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);

    try {
      // One request: the server resolves the session once and fetches every
      // section, reporting per-section failures rather than hiding them.
      const summary = await apiGet<DashboardData & { issues: SourceIssue[] }>(
        `/api/garmin/summary?days=${HISTORY_DAYS}&date=${localDate()}`,
      );

      const { issues: found = [], ...rest } = summary;
      setData(rest);
      setIssues(found);
      setError(found.length === 4 ? "Signed in, but Garmin returned no data for any section." : null);
      setSyncedAt(new Date());
    } catch (err) {
      setError(messageOf(err));
      setIssues([]);
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, issues, loading: data === null && syncing, syncing, syncedAt, refresh };
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
