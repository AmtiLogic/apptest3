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

export function getProfile(tokens: GarminTokens): Promise<ConnectResponse<SocialProfile>> {
  return connectGet<SocialProfile>(tokens, "/userprofile-service/socialProfile");
}

export function getDailySummary(
  tokens: GarminTokens,
  displayName: string,
  date: string,
): Promise<ConnectResponse<DailySummary>> {
  return connectGet<DailySummary>(
    tokens,
    `/usersummary-service/usersummary/daily/${encodeURIComponent(displayName)}`,
    { calendarDate: date },
  );
}

export function getSleep(
  tokens: GarminTokens,
  displayName: string,
  date: string,
): Promise<ConnectResponse<SleepSummary>> {
  return connectGet<SleepSummary>(
    tokens,
    `/wellness-service/wellness/dailySleepData/${encodeURIComponent(displayName)}`,
    { date, nonSleepBufferMinutes: 60 },
  );
}

export function getStepsRange(
  tokens: GarminTokens,
  start: string,
  end: string,
): Promise<ConnectResponse<StepsForDay[]>> {
  return connectGet<StepsForDay[]>(
    tokens,
    `/usersummary-service/stats/steps/daily/${start}/${end}`,
  );
}

export function getActivities(
  tokens: GarminTokens,
  start = 0,
  limit = 20,
): Promise<ConnectResponse<Activity[]>> {
  return connectGet<Activity[]>(tokens, "/activitylist-service/activities/search/activities", {
    start,
    limit,
  });
}

export function getActivity(
  tokens: GarminTokens,
  activityId: string,
): Promise<ConnectResponse<Record<string, unknown>>> {
  return connectGet<Record<string, unknown>>(
    tokens,
    `/activity-service/activity/${encodeURIComponent(activityId)}`,
  );
}
