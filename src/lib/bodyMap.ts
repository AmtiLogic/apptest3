import { toDayNumber } from "./forecast";
import type { Activity } from "./garmin/endpoints";

/**
 * Which parts of you are actually getting trained.
 *
 * Garmin records activity types, not muscle activation, so this is an inference
 * from what each activity type predominantly demands -- useful for spotting
 * a month of nothing but running, not a substitute for a training log. The UI
 * says so; overstating it would be the easiest way to make this feature junk.
 */

export type Region = "legs" | "back" | "chest" | "arms" | "core";

export const REGION_LABELS: Record<Region, string> = {
  legs: "Legs",
  back: "Back",
  chest: "Chest & shoulders",
  arms: "Arms",
  core: "Core",
};

type Emphasis = Partial<Record<Region, number>>;

/** Fractional emphasis per activity type; each entry sums to 1. */
const EMPHASIS: Record<string, Emphasis> = {
  running: { legs: 0.75, core: 0.25 },
  trail_running: { legs: 0.7, core: 0.3 },
  treadmill_running: { legs: 0.75, core: 0.25 },
  walking: { legs: 0.8, core: 0.2 },
  hiking: { legs: 0.75, core: 0.25 },
  cycling: { legs: 0.85, core: 0.15 },
  road_biking: { legs: 0.85, core: 0.15 },
  mountain_biking: { legs: 0.7, core: 0.2, arms: 0.1 },
  indoor_cycling: { legs: 0.85, core: 0.15 },
  virtual_ride: { legs: 0.85, core: 0.15 },
  lap_swimming: { back: 0.35, chest: 0.25, core: 0.2, legs: 0.2 },
  open_water_swimming: { back: 0.35, chest: 0.25, core: 0.2, legs: 0.2 },
  rowing: { back: 0.4, legs: 0.3, arms: 0.15, core: 0.15 },
  indoor_rowing: { back: 0.4, legs: 0.3, arms: 0.15, core: 0.15 },
  // Without exercise-set detail, a balanced session is the honest assumption.
  strength_training: { legs: 0.25, back: 0.2, chest: 0.25, arms: 0.15, core: 0.15 },
  indoor_climbing: { back: 0.3, arms: 0.3, core: 0.25, legs: 0.15 },
  bouldering: { back: 0.3, arms: 0.3, core: 0.25, legs: 0.15 },
  yoga: { core: 0.5, legs: 0.25, back: 0.25 },
  pilates: { core: 0.6, legs: 0.2, back: 0.2 },
  elliptical: { legs: 0.7, core: 0.15, arms: 0.15 },
  hiit: { legs: 0.35, core: 0.25, chest: 0.2, arms: 0.2 },
  cardio: { legs: 0.4, core: 0.3, arms: 0.15, chest: 0.15 },
  bootcamp: { legs: 0.35, core: 0.25, chest: 0.2, arms: 0.2 },
};

export const REGIONS: Region[] = ["legs", "back", "chest", "arms", "core"];

export interface RegionCoverage {
  region: Region;
  label: string;
  minutes: number;
  /** Share of all classified minutes, 0-100. */
  share: number;
  /** Days since this region was last trained, null if never in the window. */
  daysSince: number | null;
}

export interface BodyCoverage {
  status: "ok" | "insufficient";
  regions: RegionCoverage[];
  /** Regions well below an even spread, worth naming. */
  neglected: Region[];
  totalMinutes: number;
  /** Minutes from activity types with no mapping. */
  unclassifiedMinutes: number;
  windowDays: number;
}

/** A region under this share of an even split counts as neglected. */
const NEGLECT_RATIO = 0.4;

export function bodyCoverage(activities: Activity[], today: string, windowDays = 28): BodyCoverage {
  const todayDay = toDayNumber(today);
  const minutes: Record<Region, number> = { legs: 0, back: 0, chest: 0, arms: 0, core: 0 };
  const lastTrained: Partial<Record<Region, number>> = {};
  let unclassifiedMinutes = 0;

  for (const activity of activities) {
    if (!activity.startTimeLocal || !activity.duration) continue;
    const day = toDayNumber(activity.startTimeLocal.slice(0, 10));
    const age = todayDay - day;
    if (!Number.isFinite(age) || age < 0 || age >= windowDays) continue;

    const emphasis = EMPHASIS[activity.activityType?.typeKey ?? ""];
    const activityMinutes = activity.duration / 60;

    if (!emphasis) {
      unclassifiedMinutes += activityMinutes;
      continue;
    }

    for (const [region, weight] of Object.entries(emphasis) as Array<[Region, number]>) {
      minutes[region] += activityMinutes * weight;
      // Only count as "trained" where the activity actually emphasises it.
      if (weight >= 0.15) {
        lastTrained[region] = Math.min(lastTrained[region] ?? Infinity, age);
      }
    }
  }

  const totalMinutes = REGIONS.reduce((sum, region) => sum + minutes[region], 0);

  if (totalMinutes <= 0) {
    return {
      status: "insufficient",
      regions: REGIONS.map((region) => ({
        region,
        label: REGION_LABELS[region],
        minutes: 0,
        share: 0,
        daysSince: null,
      })),
      neglected: [],
      totalMinutes: 0,
      unclassifiedMinutes,
      windowDays,
    };
  }

  const evenShare = 100 / REGIONS.length;
  const regions = REGIONS.map((region) => ({
    region,
    label: REGION_LABELS[region],
    minutes: minutes[region],
    share: (minutes[region] / totalMinutes) * 100,
    daysSince: lastTrained[region] === undefined ? null : lastTrained[region]!,
  })).sort((a, b) => b.minutes - a.minutes);

  return {
    status: "ok",
    regions,
    neglected: regions.filter((r) => r.share < evenShare * NEGLECT_RATIO).map((r) => r.region),
    totalMinutes,
    unclassifiedMinutes,
    windowDays,
  };
}

export function coverageSentence(coverage: BodyCoverage): string {
  if (coverage.status === "insufficient") {
    return "Record a few activities and this will show which parts of you are getting worked.";
  }

  const leader = coverage.regions[0];
  const neglected = coverage.regions.filter((r) => coverage.neglected.includes(r.region));

  const lead = `${leader.label} take ${Math.round(leader.share)}% of your training over the last ${coverage.windowDays} days.`;

  if (neglected.length === 0) return `${lead} Everything is getting some work.`;

  const names = neglected.map((r) => r.label.toLowerCase());
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${lead} Least worked: ${list}.`;
}
