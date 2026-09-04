import type { GarminTokens } from "./types";

/**
 * Fixture mode. Set GARMIN_MOCK=1 to run the whole app -- sign-in, session,
 * pages -- against canned data without contacting Garmin. Useful for working on
 * the UI, and for seeing what the app does before handing it real credentials.
 */
export const MOCK_ENABLED = process.env.GARMIN_MOCK === "1";

/** The sample activities, so a static export knows which pages to render. */
export const DEMO_ACTIVITY_IDS = Array.from({ length: 20 }, (_, i) => String(1000 + i));

export const MOCK_TOKENS: GarminTokens = {
  oauth1: { oauthToken: "mock", oauthTokenSecret: "mock", domain: "garmin.com" },
  oauth2: {
    accessToken: "mock",
    refreshToken: "mock",
    tokenType: "Bearer",
    expiresAt: Number.MAX_SAFE_INTEGER,
  },
};

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Deterministic pseudo-random so screenshots and reloads stay stable. */
function seeded(n: number): number {
  return (Math.sin(n * 12.9898) * 43758.5453) % 1;
}

export function mockResponse(path: string): unknown {
  if (path.startsWith("/userprofile-service/socialProfile")) {
    return {
      displayName: "mock-user",
      fullName: "Mock Athlete",
      userName: "mockathlete",
      profileImageUrlMedium: null,
      location: "Stockholm, SE",
    };
  }

  if (path.startsWith("/usersummary-service/stats/steps/daily/")) {
    // Four weeks with a mild upward trend and a weekend dip, so the forecast has
    // a real weekly pattern to find rather than pure noise.
    return Array.from({ length: 28 }, (_, i) => {
      const date = isoDate(i - 27);
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const weekendDip = weekday === 0 || weekday === 6 ? -2600 : 400;
      return {
        calendarDate: date,
        totalSteps: Math.round(7200 + i * 55 + weekendDip + Math.abs(seeded(i + 1)) * 2600),
        stepGoal: 9000,
      };
    });
  }

  if (path.startsWith("/usersummary-service/usersummary/daily/")) {
    return {
      calendarDate: isoDate(0),
      totalSteps: 11482,
      dailyStepGoal: 9000,
      totalDistanceMeters: 8734,
      totalKilocalories: 2643,
      activeKilocalories: 812,
      floorsAscended: 14,
      minHeartRate: 48,
      maxHeartRate: 164,
      restingHeartRate: 52,
      averageStressLevel: 31,
      bodyBatteryMostRecentValue: 64,
      highlyActiveSeconds: 2640,
      activeSeconds: 5220,
      sedentarySeconds: 41000,
    };
  }

  if (path.startsWith("/wellness-service/wellness/dailySleepData/")) {
    return {
      dailySleepDTO: {
        calendarDate: isoDate(0),
        sleepTimeSeconds: 26_820,
        deepSleepSeconds: 5_040,
        lightSleepSeconds: 14_460,
        remSleepSeconds: 7_320,
        awakeSleepSeconds: 1_140,
        averageSpo2Value: 96,
        averageRespirationValue: 13,
      },
    };
  }

  if (path.startsWith("/activitylist-service/activities/search/activities")) {
    const types = ["running", "cycling", "lap_swimming", "strength_training", "hiking"];
    return Array.from({ length: 20 }, (_, i) => ({
      activityId: 1000 + i,
      activityName: ["Morning Run", "Commute", "Pool Session", "Gym", "Trail Loop"][i % 5],
      startTimeLocal: `${isoDate(-Math.round(i * 1.4))} 07:${String(10 + (i % 40)).padStart(2, "0")}:00`,
      distance: i % 4 === 3 ? null : 4000 + Math.abs(seeded(i + 5)) * 12000,
      duration: 1800 + Math.abs(seeded(i + 9)) * 4200,
      elapsedDuration: 1900 + Math.abs(seeded(i + 9)) * 4200,
      movingDuration: 1750 + Math.abs(seeded(i + 9)) * 4200,
      elevationGain: Math.round(Math.abs(seeded(i + 2)) * 240),
      averageSpeed: 2.6 + Math.abs(seeded(i + 3)),
      averageHR: 128 + Math.round(Math.abs(seeded(i + 4)) * 30),
      maxHR: 165 + Math.round(Math.abs(seeded(i + 6)) * 15),
      calories: 320 + Math.round(Math.abs(seeded(i + 7)) * 500),
      activityType: { typeKey: types[i % types.length] },
    }));
  }

  if (path.startsWith("/activity-service/activity/")) {
    return {
      activityName: "Morning Run",
      activityTypeDTO: { typeKey: "running" },
      summaryDTO: {
        startTimeLocal: `${isoDate(0)} 07:12:00`,
        distance: 10_240,
        duration: 3_180,
        movingDuration: 3_090,
        elevationGain: 96,
        averageSpeed: 3.22,
        maxSpeed: 4.6,
        averageHR: 148,
        maxHR: 172,
        calories: 712,
        averageRunCadence: 172,
        averagePower: 288,
      },
    };
  }

  return null;
}
