import { toDayNumber } from "./forecast";

/**
 * Training volume over time, summarised as the classic acute-vs-chronic
 * comparison: this week's minutes against the average week of the last four.
 *
 * This is a rough guide to whether volume is climbing, holding or falling --
 * not a medical or injury-risk assessment.
 */

export interface LoadActivity {
  startTimeLocal: string | null;
  duration: number | null;
}

export type LoadStatus = "insufficient" | "detraining" | "steady" | "building" | "ramping";

export interface TrainingLoad {
  status: LoadStatus;
  /** Minutes in the last 7 days. */
  acuteMinutes: number;
  /** Average minutes per week across the last 28 days. */
  chronicMinutes: number;
  /** acute / chronic, or null when there is no chronic base to compare against. */
  ratio: number | null;
  sessionsThisWeek: number;
}

const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 28;

/** Garmin returns local time as "YYYY-MM-DD HH:MM:SS"; only the date matters. */
function activityDay(startTimeLocal: string | null): number | null {
  if (!startTimeLocal) return null;
  const day = toDayNumber(startTimeLocal.slice(0, 10));
  return Number.isFinite(day) ? day : null;
}

export function trainingLoad(activities: LoadActivity[], today: string): TrainingLoad {
  const todayDay = toDayNumber(today);

  let acuteMinutes = 0;
  let chronicMinutes = 0;
  let sessionsThisWeek = 0;
  let hasChronicHistory = false;

  for (const activity of activities) {
    const day = activityDay(activity.startTimeLocal);
    if (day === null || !activity.duration) continue;

    const age = todayDay - day;
    if (age < 0 || age >= CHRONIC_DAYS) continue;

    const minutes = activity.duration / 60;
    chronicMinutes += minutes;
    hasChronicHistory = true;

    if (age < ACUTE_DAYS) {
      acuteMinutes += minutes;
      sessionsThisWeek += 1;
    }
  }

  const chronicWeekly = chronicMinutes / (CHRONIC_DAYS / ACUTE_DAYS);

  if (!hasChronicHistory || chronicWeekly === 0) {
    return { status: "insufficient", acuteMinutes, chronicMinutes: chronicWeekly, ratio: null, sessionsThisWeek };
  }

  const ratio = acuteMinutes / chronicWeekly;
  const status: LoadStatus =
    ratio < 0.8 ? "detraining" : ratio <= 1.2 ? "steady" : ratio <= 1.5 ? "building" : "ramping";

  return { status, acuteMinutes, chronicMinutes: chronicWeekly, ratio, sessionsThisWeek };
}

export const LOAD_COPY: Record<LoadStatus, { label: string; detail: string }> = {
  insufficient: { label: "Not enough history", detail: "Four weeks of activities will show your volume trend." },
  detraining: { label: "Winding down", detail: "This week is lighter than your four-week average." },
  steady: { label: "Holding steady", detail: "This week matches your four-week average." },
  building: { label: "Building", detail: "This week is above your four-week average." },
  ramping: { label: "Ramping up fast", detail: "This week is well above your four-week average." },
};
