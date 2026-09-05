import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { DailySummary, StepsForDay } from "./garmin/endpoints.ts";
import { activeMinutes, distanceKm, stepGoal, todaySteps } from "./todayMetrics.ts";

const series = (values: Array<number | null>): StepsForDay[] =>
  values.map((v, i) => ({ calendarDate: `2026-09-${String(i + 1).padStart(2, "0")}`, totalSteps: v, stepGoal: 10000 }));

const daily = (fields: Partial<DailySummary>) => fields as DailySummary;

test("the summary is used when it has the value", () => {
  const result = todaySteps(daily({ totalSteps: 9431 }), series([1000, 2000]));
  assert.deepEqual(result, { value: 9431, source: "summary" });
});

// The case seen in production: the summary returns 200 but nothing usable.
test("step history covers for a missing summary", () => {
  const result = todaySteps(null, series([4000, 8123]));
  assert.deepEqual(result, { value: 8123, source: "history" });
});

test("the fallback skips trailing empty days", () => {
  const result = todaySteps(daily({ totalSteps: null }), series([4000, 8123, null, 0]));
  assert.deepEqual(result, { value: 8123, source: "history" });
});

test("no data anywhere reports no source rather than zero", () => {
  assert.deepEqual(todaySteps(null, []), { value: null, source: null });
  assert.deepEqual(todaySteps(null, series([null, 0])), { value: null, source: null });
});

test("zero steps from the summary is kept, not treated as missing", () => {
  // An explicit 0 from the summary is a real reading; only history uses >0.
  assert.deepEqual(todaySteps(daily({ totalSteps: 0 }), series([5000])), { value: 0, source: "summary" });
});

test("the goal falls back to the history too", () => {
  assert.equal(stepGoal(daily({ dailyStepGoal: 12000 }), series([1])), 12000);
  assert.equal(stepGoal(null, series([1])), 10000);
  assert.equal(stepGoal(null, []), null);
});

test("distance and active time handle missing pieces", () => {
  assert.equal(distanceKm(daily({ totalDistanceMeters: 8734 })), 8.734);
  assert.equal(distanceKm(null), null);
  assert.equal(activeMinutes(daily({ highlyActiveSeconds: 2640, activeSeconds: 5220 })), 131);
  assert.equal(activeMinutes(daily({ activeSeconds: 600 })), 10);
  assert.equal(activeMinutes(null), null);
});
