import { toDayNumber } from "./forecast";
import type { Activity, StepsForDay } from "./garmin/endpoints";
import { benjaminiHochberg, compareBySplit, type GroupComparison } from "./stats";

/**
 * Finds what actually moves your numbers.
 *
 * Health apps report metrics side by side and leave the reader to guess at the
 * relationships. This tests them: does more sleep really precede more movement
 * *for you*? Each candidate is a median split with a permutation test, and the
 * whole set is corrected for multiple comparisons -- test a dozen relationships
 * at p < 0.05 and roughly one coincidence surfaces every time, which is how a
 * feature like this becomes a horoscope.
 */

export type MetricKey = "steps" | "trainingMinutes" | "sleepHours" | "restingHr";

export interface DayFeatures {
  date: string;
  day: number;
  steps?: number;
  trainingMinutes?: number;
  sleepHours?: number;
  restingHr?: number;
}

/** Three weeks: enough for a median split with a usable group on each side. */
export const MIN_PAIRS = 21;
const FDR = 0.1;
/** Below this the finding is real but too small to act on. */
const MIN_RELATIVE_EFFECT = 0.04;

export interface Finding {
  id: string;
  headline: string;
  detail: string;
  /** Signed effect in the outcome's units. */
  difference: number;
  p: number;
  samples: number;
}

export interface RelationshipReport {
  status: "ok" | "collecting";
  findings: Finding[];
  /** Days still needed before anything can be tested. */
  daysNeeded?: number;
  /** How many candidate relationships had enough data to test. */
  tested: number;
}

interface Metric {
  label: string;
  format: (value: number) => string;
  /** Phrase describing the upper half, e.g. "sleep more than 7h 10m". */
  high: (threshold: number) => string;
  low: (threshold: number) => string;
}

const hoursMinutes = (hours: number) => {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

const METRICS: Record<MetricKey, Metric> = {
  steps: {
    label: "steps",
    // Every formatter carries its unit: a bare "2,393" in a sentence is exactly
    // the kind of number that means nothing on its own.
    format: (v) => `${Math.round(v).toLocaleString()} steps`,
    high: (t) => `walk more than ${Math.round(t).toLocaleString()} steps`,
    low: (t) => `walk under ${Math.round(t).toLocaleString()} steps`,
  },
  trainingMinutes: {
    label: "training",
    format: (v) => `${Math.round(v)} min`,
    high: (t) => `train more than ${Math.round(t)} min`,
    low: (t) => `train less than ${Math.round(t)} min`,
  },
  sleepHours: {
    label: "sleep",
    format: hoursMinutes,
    high: (t) => `sleep more than ${hoursMinutes(t)}`,
    low: (t) => `sleep under ${hoursMinutes(t)}`,
  },
  restingHr: {
    label: "resting heart rate",
    format: (v) => `${Math.round(v)} bpm`,
    high: (t) => `resting heart rate is above ${Math.round(t)} bpm`,
    low: (t) => `resting heart rate is below ${Math.round(t)} bpm`,
  },
};

interface Candidate {
  id: string;
  predictor: MetricKey;
  outcome: MetricKey;
  /** 1 = predictor is measured the day before the outcome. */
  lag: 0 | 1;
  /** How to describe the outcome moving. */
  subject: string;
}

const CANDIDATES: Candidate[] = [
  { id: "sleep-steps", predictor: "sleepHours", outcome: "steps", lag: 1, subject: "the next day" },
  { id: "sleep-rhr", predictor: "sleepHours", outcome: "restingHr", lag: 1, subject: "your resting heart rate" },
  { id: "training-sleep", predictor: "trainingMinutes", outcome: "sleepHours", lag: 0, subject: "that night's sleep" },
  { id: "training-steps", predictor: "trainingMinutes", outcome: "steps", lag: 1, subject: "the next day" },
  { id: "training-rhr", predictor: "trainingMinutes", outcome: "restingHr", lag: 1, subject: "your resting heart rate" },
  { id: "steps-steps", predictor: "steps", outcome: "steps", lag: 1, subject: "the next day" },
  { id: "steps-sleep", predictor: "steps", outcome: "sleepHours", lag: 0, subject: "that night's sleep" },
  { id: "rhr-steps", predictor: "restingHr", outcome: "steps", lag: 0, subject: "that day" },
];

/** Garmin returns local time as "YYYY-MM-DD HH:MM:SS". */
function activityDate(startTimeLocal: string | null): string | null {
  return startTimeLocal ? startTimeLocal.slice(0, 10) : null;
}

export function buildDailyFeatures(
  steps: StepsForDay[],
  activities: Activity[],
  extra: Array<{ date: string; sleepHours?: number; restingHr?: number }> = [],
): DayFeatures[] {
  const byDate = new Map<string, DayFeatures>();

  const ensure = (date: string): DayFeatures => {
    let entry = byDate.get(date);
    if (!entry) {
      entry = { date, day: toDayNumber(date) };
      byDate.set(date, entry);
    }
    return entry;
  };

  for (const day of steps) {
    if (!day?.calendarDate) continue;
    // A zero-step day means the watch was not worn, not a motionless day.
    if (day.totalSteps !== null && day.totalSteps !== undefined && day.totalSteps > 0) {
      ensure(day.calendarDate).steps = day.totalSteps;
    } else {
      ensure(day.calendarDate);
    }
  }

  for (const activity of activities) {
    const date = activityDate(activity.startTimeLocal);
    if (!date || !activity.duration) continue;
    const entry = ensure(date);
    entry.trainingMinutes = (entry.trainingMinutes ?? 0) + activity.duration / 60;
  }

  // Days with step data but no activity genuinely trained zero minutes.
  for (const entry of byDate.values()) {
    if (entry.trainingMinutes === undefined && entry.steps !== undefined) entry.trainingMinutes = 0;
  }

  for (const row of extra) {
    if (!row?.date) continue;
    const entry = ensure(row.date);
    if (row.sleepHours !== undefined) entry.sleepHours = row.sleepHours;
    if (row.restingHr !== undefined) entry.restingHr = row.restingHr;
  }

  return [...byDate.values()].sort((a, b) => a.day - b.day);
}

function pairsFor(features: DayFeatures[], candidate: Candidate) {
  const byDay = new Map(features.map((f) => [f.day, f]));
  const pairs: Array<{ predictor: number; outcome: number }> = [];

  for (const feature of features) {
    const predictor = feature[candidate.predictor];
    const outcomeDay = byDay.get(feature.day + candidate.lag);
    const outcome = outcomeDay?.[candidate.outcome];
    if (typeof predictor === "number" && typeof outcome === "number") {
      pairs.push({ predictor, outcome });
    }
  }
  return pairs;
}

function phrase(candidate: Candidate, comparison: GroupComparison): Finding {
  const predictor = METRICS[candidate.predictor];
  const outcome = METRICS[candidate.outcome];
  const up = comparison.difference > 0;
  const size = outcome.format(Math.abs(comparison.difference));

  return {
    id: candidate.id,
    headline: `When you ${predictor.high(comparison.threshold)}, ${candidate.subject} runs ${size} ${up ? "higher" : "lower"}`,
    detail:
      `${outcome.format(comparison.highMean)} on the ${comparison.highCount} days you ${predictor.high(comparison.threshold)}, ` +
      `versus ${outcome.format(comparison.lowMean)} on the ${comparison.lowCount} you ${predictor.low(comparison.threshold)}.`,
    difference: comparison.difference,
    p: comparison.p,
    samples: comparison.highCount + comparison.lowCount,
  };
}

export function findRelationships(features: DayFeatures[], seed = 1): RelationshipReport {
  const tests: Array<{ candidate: Candidate; comparison: GroupComparison }> = [];

  CANDIDATES.forEach((candidate, index) => {
    const pairs = pairsFor(features, candidate);
    if (pairs.length < MIN_PAIRS) return;
    const comparison = compareBySplit(pairs, seed + index);
    if (comparison) tests.push({ candidate, comparison });
  });

  if (tests.length === 0) {
    // Report against the richest candidate so the countdown is honest.
    const best = Math.max(0, ...CANDIDATES.map((c) => pairsFor(features, c).length));
    return { status: "collecting", findings: [], daysNeeded: Math.max(1, MIN_PAIRS - best), tested: 0 };
  }

  const keep = benjaminiHochberg(tests.map((t) => t.comparison.p), FDR);

  const findings = tests
    .filter((_, i) => keep[i])
    .map(({ candidate, comparison }) => ({ candidate, comparison }))
    // Drop effects too small to matter even when statistically real.
    .filter(({ comparison }) => {
      const base = Math.abs(comparison.lowMean) || 1;
      return Math.abs(comparison.difference) / base >= MIN_RELATIVE_EFFECT;
    })
    .map(({ candidate, comparison }) => phrase(candidate, comparison))
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return { status: "ok", findings, tested: tests.length };
}
