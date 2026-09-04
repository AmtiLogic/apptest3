import { strict as assert } from "node:assert";
import { test } from "node:test";
import { forecastDaily, fromDayNumber, goalOutlook, toDayNumber, weekdayOf } from "./forecast.ts";
import { compareToRecent, loadInsight, stepsInsight } from "./insights.ts";
import { trainingLoad } from "./trainingLoad.ts";

function series(days: number, base: number, slope: number, noise = 0) {
  const start = toDayNumber("2026-01-04");
  return Array.from({ length: days }, (_, i) => ({
    date: fromDayNumber(start + i),
    // Deterministic alternating noise, so tests never flake.
    value: base + slope * i + (noise === 0 ? 0 : (i % 2 === 0 ? noise : -noise)),
  }));
}

test("a rising series is described as trending up", () => {
  const data = series(28, 6000, 60);
  const insight = stepsInsight(forecastDaily(data, 7), null, null);
  assert.equal(insight.tone, "up");
  assert.match(insight.headline, /Trending up \d+% a week/);
});

test("a falling series is described as trending down", () => {
  const insight = stepsInsight(forecastDaily(series(28, 12000, -80), 7), null, null);
  assert.equal(insight.tone, "down");
  assert.match(insight.headline, /Trending down/);
});

test("a flat series is described as holding, with an average", () => {
  const insight = stepsInsight(forecastDaily(series(28, 9000, 0), 7), null, null);
  assert.equal(insight.tone, "flat");
  assert.match(insight.headline, /Holding around 9,000 steps a day/);
});

test("noise larger than the trend is reported as steady, not as a direction", () => {
  // A tiny slope buried in large swings: r2 is near zero, so no direction is claimed.
  const insight = stepsInsight(forecastDaily(series(28, 9000, 2, 4000), 7), null, null);
  assert.equal(insight.tone, "flat");
  assert.match(insight.detail, /larger than any trend/);
});

test("insufficient history says so instead of inventing a trend", () => {
  const insight = stepsInsight(forecastDaily(series(3, 9000, 0), 7), null, null);
  assert.equal(insight.tone, "neutral");
  assert.match(insight.headline, /Not enough history/);
});

test("the goal sentence reports both projection and recent record", () => {
  const data = series(28, 9500, 0);
  const forecast = forecastDaily(data, 7);
  const insight = stepsInsight(forecast, goalOutlook(data, forecast, 9000), 9000);
  assert.match(insight.detail, /clears your 9,000 goal on 7 of them/);
  assert.match(insight.detail, /hit it 100% of days/);
});

test("loadInsight summarises volume against the four-week average", () => {
  const activities = Array.from({ length: 28 }, (_, i) => ({
    startTimeLocal: `${fromDayNumber(toDayNumber("2026-09-04") - i)} 07:00:00`,
    duration: 3600,
  }));
  const insight = loadInsight(trainingLoad(activities, "2026-09-04"));
  assert.equal(insight.headline, "Holding steady");
  assert.match(insight.detail, /420 min across 7 sessions/);
});

test("loadInsight handles no history", () => {
  const insight = loadInsight(trainingLoad([], "2026-09-04"));
  assert.equal(insight.tone, "neutral");
  assert.match(insight.detail, /Four weeks of activities/);
});

test("compareToRecent needs a baseline before reporting a change", () => {
  assert.equal(compareToRecent(100, []), null);
  assert.equal(compareToRecent(null, [1, 2, 3]), null);
  assert.equal(compareToRecent(100, [0, 0, 0]), null);
  assert.equal(compareToRecent(110, [100, 100, 100]), 10);
  assert.equal(compareToRecent(90, [100, 100, 100]), -10);
});

test("weekdayOf stays consistent across the helpers used here", () => {
  assert.equal(weekdayOf(toDayNumber("2026-01-04")), 0);
});
