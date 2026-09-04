import type { Forecast, GoalOutlook } from "./forecast";
import { LOAD_COPY, type TrainingLoad } from "./trainingLoad";

/**
 * Turns the model output into plain sentences.
 *
 * Wording tracks the evidence: a weak fit is described as flat rather than
 * given a direction it cannot support, and a projection is always labelled as
 * one.
 */

export type InsightTone = "up" | "down" | "flat" | "neutral";

export interface Insight {
  headline: string;
  detail: string;
  tone: InsightTone;
}

/** Below this, the trend is not distinguishable from noise at this sample size. */
const WEAK_FIT_R2 = 0.15;
/** A week-on-week move smaller than this is not worth calling a trend. */
const FLAT_PCT = 3;

export function stepsInsight(forecast: Forecast, outlook: GoalOutlook | null, goal: number | null): Insight {
  if (forecast.status !== "ok" || forecast.changePerWeekPct === undefined) {
    return {
      headline: "Not enough history yet",
      detail: forecast.reason ?? "A week of data unlocks the projection.",
      tone: "neutral",
    };
  }

  const pct = forecast.changePerWeekPct;
  const perWeek = Math.abs(Math.round(forecast.changePerWeek ?? 0));
  const weak = (forecast.fit?.r2 ?? 0) < WEAK_FIT_R2;
  const flat = weak || Math.abs(pct) < FLAT_PCT;

  const projectedAverage = Math.round(
    forecast.predictions.reduce((sum, p) => sum + p.value, 0) / Math.max(forecast.predictions.length, 1),
  );

  const headline = flat
    ? `Holding around ${projectedAverage.toLocaleString()} steps a day`
    : pct > 0
      ? `Trending up ${Math.round(pct)}% a week`
      : `Trending down ${Math.abs(Math.round(pct))}% a week`;

  const parts: string[] = [];
  parts.push(
    flat
      ? weak
        ? "Your day-to-day swing is larger than any trend, so this is best read as steady."
        : "Your average is essentially level week to week."
      : `That is about ${perWeek.toLocaleString()} steps a day different each week.`,
  );

  if (outlook && goal) {
    parts.push(
      `On the next ${outlook.horizon} days the model clears your ${goal.toLocaleString()} goal on ${outlook.daysMeetingGoal} of them; lately you have hit it ${Math.round(outlook.recentHitRate * 100)}% of days.`,
    );
  }

  return { headline, detail: parts.join(" "), tone: flat ? "flat" : pct > 0 ? "up" : "down" };
}

export function loadInsight(load: TrainingLoad): Insight {
  const copy = LOAD_COPY[load.status];

  if (load.status === "insufficient") {
    return { headline: copy.label, detail: copy.detail, tone: "neutral" };
  }

  const detail = `${Math.round(load.acuteMinutes)} min across ${load.sessionsThisWeek} ${
    load.sessionsThisWeek === 1 ? "session" : "sessions"
  } this week, against a ${Math.round(load.chronicMinutes)} min four-week average.`;

  const tone: InsightTone =
    load.status === "detraining" ? "down" : load.status === "ramping" ? "up" : "flat";

  return { headline: copy.label, detail, tone };
}

/** Percent change of the latest value against the mean of the prior window. */
export function compareToRecent(latest: number | null, history: number[]): number | null {
  if (latest === null || history.length < 3) return null;
  const baseline = history.reduce((a, b) => a + b, 0) / history.length;
  if (baseline <= 0) return null;
  return ((latest - baseline) / baseline) * 100;
}
