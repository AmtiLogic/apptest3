import type { DailySummary, StepsForDay } from "./garmin/endpoints";

/**
 * Today's headline numbers, with fallbacks.
 *
 * The daily-summary endpoint and the step-history endpoint carry overlapping
 * data, and they do not fail together. When the summary is unavailable or in an
 * unfamiliar shape, today's step count is still recoverable from the history —
 * so the dashboard shows a real number instead of a dash.
 */

export interface DerivedValue<T> {
  value: T | null;
  /** Where the number came from, so the UI can say when it is a fallback. */
  source: "summary" | "history" | null;
}

function latestRecorded(series: StepsForDay[]): StepsForDay | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const day = series[i];
    if (day?.totalSteps !== null && day?.totalSteps !== undefined && day.totalSteps > 0) return day;
  }
  return null;
}

export function todaySteps(daily: DailySummary | null, series: StepsForDay[]): DerivedValue<number> {
  if (daily?.totalSteps !== null && daily?.totalSteps !== undefined) {
    return { value: daily.totalSteps, source: "summary" };
  }
  const latest = latestRecorded(series);
  return latest ? { value: latest.totalSteps, source: "history" } : { value: null, source: null };
}

export function stepGoal(daily: DailySummary | null, series: StepsForDay[]): number | null {
  if (daily?.dailyStepGoal) return daily.dailyStepGoal;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (series[i]?.stepGoal) return series[i].stepGoal;
  }
  return null;
}

export function distanceKm(daily: DailySummary | null): number | null {
  return daily?.totalDistanceMeters ? daily.totalDistanceMeters / 1000 : null;
}

export function activeMinutes(daily: DailySummary | null): number | null {
  if (daily?.highlyActiveSeconds == null && daily?.activeSeconds == null) return null;
  return Math.round(((daily?.highlyActiveSeconds ?? 0) + (daily?.activeSeconds ?? 0)) / 60);
}
