import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Activity } from "./garmin/endpoints.ts";
import { buildSeries, METRIC_ORDER, METRICS, summariseMetric } from "./metrics.ts";

const day = (n: number) => `2026-03-${String(n).padStart(2, "0")}`;

const activity = (date: string, over: Partial<Activity> = {}): Activity => ({
  activityId: Math.random(),
  activityName: "Session",
  startTimeLocal: `${date} 07:00:00`,
  distance: 5000,
  duration: 1800,
  elapsedDuration: null,
  movingDuration: null,
  elevationGain: 50,
  averageSpeed: null,
  averageHR: 140,
  maxHR: null,
  calories: 300,
  activityType: { typeKey: "running" },
  ...over,
});

test("every registered metric has an entry in the display order", () => {
  assert.deepEqual([...METRIC_ORDER].sort(), Object.keys(METRICS).sort());
});

test("activity metrics aggregate per day", () => {
  const series = buildSeries({
    steps: [
      { calendarDate: day(1), totalSteps: 9000, stepGoal: 10000 },
      { calendarDate: day(2), totalSteps: 7000, stepGoal: 10000 },
    ],
    activities: [
      activity(day(1)),
      activity(day(1), { distance: 3000, duration: 600, calories: 120, elevationGain: 10 }),
    ],
  });

  // Two sessions sum: 30 + 10 minutes, 8 km, 420 kcal, 60 m.
  assert.equal(series.trainingMinutes[0].value, 40);
  assert.equal(series.exerciseDistance[0].value, 8);
  assert.equal(series.exerciseCalories[0].value, 420);
  assert.equal(series.elevation[0].value, 60);
});

test("workout heart rate is weighted by duration, not a plain mean", () => {
  const series = buildSeries({
    steps: [{ calendarDate: day(1), totalSteps: 9000, stepGoal: null }],
    activities: [
      activity(day(1), { duration: 3600, averageHR: 150 }),
      activity(day(1), { duration: 600, averageHR: 100 }),
    ],
  });
  // (150*3600 + 100*600) / 4200 = 142.857..., not the plain mean of 125.
  assert.ok(Math.abs(series.activityHr[0].value! - 142.857142) < 1e-4, String(series.activityHr[0].value));
});

test("a rest day is zero volume but unknown heart rate", () => {
  const series = buildSeries({
    steps: [
      { calendarDate: day(1), totalSteps: 9000, stepGoal: null },
      { calendarDate: day(2), totalSteps: 8000, stepGoal: null },
    ],
    activities: [activity(day(1))],
  });

  assert.equal(series.trainingMinutes[1].value, 0, "no workout means zero minutes");
  assert.equal(series.exerciseDistance[1].value, 0);
  // There is no workout heart rate on a rest day; that is not a zero.
  assert.equal(series.activityHr[1].value, null);
});

test("a day with no record at all stays unknown", () => {
  const series = buildSeries({ steps: [], activities: [activity(day(5))] });
  assert.equal(series.trainingMinutes.length, 1);
  assert.equal(series.trainingMinutes[0].value, 30);
});

test("weight comes through when present and is absent otherwise", () => {
  const withWeight = buildSeries({
    steps: [{ calendarDate: day(1), totalSteps: 9000, stepGoal: null }],
    activities: [],
    weight: [{ date: day(1), weight: 78.4 }],
  });
  assert.equal(withWeight.weight[0].value, 78.4);

  const without = buildSeries({ steps: [{ calendarDate: day(1), totalSteps: 9000, stepGoal: null }], activities: [] });
  assert.equal(without.weight[0].value, null);
  assert.equal(summariseMetric("weight", without.weight).available, false);
});

test("summary reports latest, percentile and typical range", () => {
  const series = Array.from({ length: 20 }, (_, i) => ({ date: day(i + 1), value: 5000 + i * 200 }));
  const summary = summariseMetric("steps", series);

  assert.equal(summary.available, true);
  assert.equal(summary.latest!.value, 8800);
  // The newest value is the highest of the series.
  assert.equal(Math.round(summary.percentile!), 100);
  assert.ok(summary.typical !== null);
  assert.equal(summary.forecast.status, "ok");
});

test("zero-as-missing applies only where a zero is meaningless", () => {
  const stepDays = [
    { date: day(1), value: 9000 },
    { date: day(2), value: 0 },
    { date: day(3), value: 8000 },
  ];
  // A zero step day is an unworn watch, so it is not a recorded observation.
  assert.equal(summariseMetric("steps", stepDays).recorded.length, 2);
  // A zero training day is a real rest day and counts.
  assert.equal(summariseMetric("trainingMinutes", stepDays).recorded.length, 3);
});

test("an empty series reports unavailable rather than throwing", () => {
  const summary = summariseMetric("elevation", []);
  assert.equal(summary.available, false);
  assert.equal(summary.latest, null);
  assert.equal(summary.percentile, null);
  assert.equal(summary.forecast.status, "insufficient");
  assert.equal(summary.momentum, null);
});

test("momentum only applies when the metric has a goal", () => {
  const series = Array.from({ length: 20 }, (_, i) => ({ date: day(i + 1), value: 11000 }));
  assert.equal(summariseMetric("steps", series).momentum, null);
  assert.ok(summariseMetric("steps", series, 10000)!.momentum!.score > 99);
});

test("formatters carry their units", () => {
  assert.equal(METRICS.exerciseDistance.format(8.234), "8.23 km");
  assert.equal(METRICS.trainingMinutes.format(45.6), "46 min");
  assert.equal(METRICS.activityHr.format(142.86), "143 bpm");
  assert.equal(METRICS.weight.format(78.44), "78.4 kg");
});

test("every metric has a prose formatter carrying its unit", () => {
  for (const key of METRIC_ORDER) {
    const rendered = METRICS[key].sentence(12.5);
    assert.ok(/[a-z]/i.test(rendered), `${key} sentence form "${rendered}" has no unit`);
  }
  // The one that used to render bare in prose.
  assert.equal(METRICS.steps.sentence(668), "668 steps");
});
