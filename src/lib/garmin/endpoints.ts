import { mergeByDate, splitRange } from "../dateWindows";
import { connectGet, type ConnectResponse } from "./client";
import type { GarminTokens } from "./types";

export interface SocialProfile {
  displayName: string;
  fullName: string | null;
  userName: string | null;
  profileImageUrlMedium: string | null;
  location: string | null;
}

export interface DailySummary {
  calendarDate: string;
  totalSteps: number | null;
  dailyStepGoal: number | null;
  totalDistanceMeters: number | null;
  totalKilocalories: number | null;
  activeKilocalories: number | null;
  floorsAscended: number | null;
  minHeartRate: number | null;
  maxHeartRate: number | null;
  restingHeartRate: number | null;
  averageStressLevel: number | null;
  bodyBatteryMostRecentValue: number | null;
  highlyActiveSeconds: number | null;
  activeSeconds: number | null;
  sedentarySeconds: number | null;
}

export interface Activity {
  activityId: number;
  activityName: string | null;
  startTimeLocal: string;
  distance: number | null;
  duration: number | null;
  elapsedDuration: number | null;
  movingDuration: number | null;
  elevationGain: number | null;
  averageSpeed: number | null;
  averageHR: number | null;
  maxHR: number | null;
  calories: number | null;
  activityType: { typeKey: string } | null;
}

export interface SleepSummary {
  dailySleepDTO: {
    calendarDate: string;
    sleepTimeSeconds: number | null;
    deepSleepSeconds: number | null;
    lightSleepSeconds: number | null;
    remSleepSeconds: number | null;
    awakeSleepSeconds: number | null;
    averageSpo2Value: number | null;
    averageRespirationValue: number | null;
  } | null;
}

export interface StepsForDay {
  calendarDate: string;
  totalSteps: number | null;
  stepGoal: number | null;
}

export const PATHS = {
  profile: () => "/userprofile-service/socialProfile",
  daily: (displayName: string) =>
    `/usersummary-service/usersummary/daily/${encodeURIComponent(displayName)}`,
  sleep: (displayName: string) =>
    `/wellness-service/wellness/dailySleepData/${encodeURIComponent(displayName)}`,
  steps: (start: string, end: string) => `/usersummary-service/stats/steps/daily/${start}/${end}`,
  activities: () => "/activitylist-service/activities/search/activities",
  activity: (id: string) => `/activity-service/activity/${encodeURIComponent(id)}`,
} as const;

export function getProfile(tokens: GarminTokens): Promise<ConnectResponse<SocialProfile>> {
  return connectGet<SocialProfile>(tokens, PATHS.profile());
}

export function getDailySummary(
  tokens: GarminTokens,
  displayName: string,
  date: string,
): Promise<ConnectResponse<DailySummary>> {
  return connectGet<DailySummary>(tokens, PATHS.daily(displayName), { calendarDate: date });
}

export function getSleep(
  tokens: GarminTokens,
  displayName: string,
  date: string,
): Promise<ConnectResponse<SleepSummary>> {
  return connectGet<SleepSummary>(tokens, PATHS.sleep(displayName), {
    date,
    nonSleepBufferMinutes: 60,
  });
}

/**
 * Fetches a step range of any length by splitting it into windows Garmin
 * accepts and merging the results. One window failing does not lose the rest.
 */
export async function getStepsRangeChunked(
  tokens: GarminTokens,
  start: string,
  end: string,
): Promise<{ data: StepsForDay[]; tokens?: GarminTokens; failures: string[] }> {
  const windows = splitRange(start, end);
  const results = await Promise.allSettled(
    windows.map((window) => getStepsRange(tokens, window.start, window.end)),
  );

  const chunks: StepsForDay[][] = [];
  const failures: string[] = [];
  let refreshed: GarminTokens | undefined;

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push(`${windows[i].start}..${windows[i].end}: ${reason}`);
      return;
    }
    if (result.value.tokens) refreshed = result.value.tokens;
    chunks.push(result.value.data ?? []);
  });

  return { data: mergeByDate(chunks), tokens: refreshed, failures };
}

export function getStepsRange(
  tokens: GarminTokens,
  start: string,
  end: string,
): Promise<ConnectResponse<StepsForDay[]>> {
  return connectGet<StepsForDay[]>(tokens, PATHS.steps(start, end));
}

export function getActivities(
  tokens: GarminTokens,
  start = 0,
  limit = 20,
): Promise<ConnectResponse<Activity[]>> {
  return connectGet<Activity[]>(tokens, PATHS.activities(), { start, limit });
}

export function getActivity(
  tokens: GarminTokens,
  activityId: string,
): Promise<ConnectResponse<Record<string, unknown>>> {
  return connectGet<Record<string, unknown>>(tokens, PATHS.activity(activityId));
}
