import { toDayNumber } from "./forecast";

/**
 * Consistency as a decaying weighted average rather than a streak.
 *
 * A streak is brittle and punitive: miss one day after forty and you are back
 * to zero, which is both untrue as a description of your fitness and a nasty
 * thing to do to someone. Recent days simply weigh more, so a missed day dents
 * the number and a good week repairs it.
 */

export interface MomentumInput {
  date: string;
  value: number | null;
  goal: number | null;
}

export interface Momentum {
  /** 0-100. Recency-weighted share of days that met the goal. */
  score: number;
  /** Change against the same measure a week ago, in points. */
  trend: number | null;
  /** Days counted. */
  days: number;
  /** Consecutive most-recent days meeting the goal, for context only. */
  currentRun: number;
}

/** Recent days weigh more; a day this old counts half as much as today. */
const HALF_LIFE_DAYS = 10;

function weightedScore(days: MomentumInput[], asOfDay: number): number | null {
  let weighted = 0;
  let total = 0;

  for (const day of days) {
    const age = asOfDay - toDayNumber(day.date);
    if (age < 0 || !Number.isFinite(age)) continue;
    if (day.value === null || day.value === undefined || !day.goal) continue;

    const weight = Math.pow(0.5, age / HALF_LIFE_DAYS);
    total += weight;
    if (day.value >= day.goal) weighted += weight;
  }

  return total === 0 ? null : (weighted / total) * 100;
}

export function momentum(days: MomentumInput[]): Momentum | null {
  const usable = days.filter((d) => d.value !== null && d.value !== undefined && d.goal);
  if (usable.length < 7) return null;

  const latestDay = Math.max(...usable.map((d) => toDayNumber(d.date)));
  const score = weightedScore(days, latestDay);
  if (score === null) return null;

  // The same measure as of a week ago, so the trend is like-for-like.
  const weekAgo = weightedScore(
    days.filter((d) => toDayNumber(d.date) <= latestDay - 7),
    latestDay - 7,
  );

  let currentRun = 0;
  const byDay = new Map(usable.map((d) => [toDayNumber(d.date), d]));
  for (let day = latestDay; ; day -= 1) {
    const entry = byDay.get(day);
    if (!entry || entry.value === null || !entry.goal || entry.value < entry.goal) break;
    currentRun += 1;
  }

  return {
    score,
    trend: weekAgo === null ? null : score - weekAgo,
    days: usable.length,
    currentRun,
  };
}

export function momentumLabel(score: number): string {
  if (score >= 80) return "Locked in";
  if (score >= 60) return "Consistent";
  if (score >= 40) return "On and off";
  if (score >= 20) return "Slipping";
  return "Dormant";
}
