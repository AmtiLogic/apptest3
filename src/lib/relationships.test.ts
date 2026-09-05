import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fromDayNumber, toDayNumber } from "./forecast.ts";
import { buildDailyFeatures, findRelationships, MIN_PAIRS, type DayFeatures } from "./relationships.ts";
import { seededRandom } from "./stats.ts";

const START = toDayNumber("2026-01-05");
const dateAt = (i: number) => fromDayNumber(START + i);

test("features merge steps, activities and extra series by date", () => {
  const features = buildDailyFeatures(
    [
      { calendarDate: dateAt(0), totalSteps: 9000, stepGoal: 10000 },
      { calendarDate: dateAt(1), totalSteps: 0, stepGoal: 10000 },
    ],
    [
      { activityId: 1, activityName: "Run", startTimeLocal: `${dateAt(0)} 07:00:00`, distance: 5000, duration: 1800,
        elapsedDuration: null, movingDuration: null, elevationGain: null, averageSpeed: null, averageHR: null,
        maxHR: null, calories: null, activityType: null },
      { activityId: 2, activityName: "Ride", startTimeLocal: `${dateAt(0)} 18:00:00`, distance: 9000, duration: 900,
        elapsedDuration: null, movingDuration: null, elevationGain: null, averageSpeed: null, averageHR: null,
        maxHR: null, calories: null, activityType: null },
    ],
    [{ date: dateAt(0), sleepHours: 7.5, restingHr: 52 }],
  );

  assert.equal(features.length, 2);
  assert.equal(features[0].steps, 9000);
  // Two sessions on one day sum.
  assert.equal(features[0].trainingMinutes, 45);
  assert.equal(features[0].sleepHours, 7.5);
  assert.equal(features[0].restingHr, 52);
  // A zero-step day is an unworn watch, not a real zero.
  assert.equal(features[1].steps, undefined);
});

test("a day with steps but no workout counts as zero training, not missing", () => {
  const features = buildDailyFeatures([{ calendarDate: dateAt(0), totalSteps: 8000, stepGoal: null }], []);
  assert.equal(features[0].trainingMinutes, 0);
});

/** Days where sleep drives next-day steps by a known amount. */
function plantedSeries(days: number, effect: number): DayFeatures[] {
  const rng = seededRandom(11);
  return Array.from({ length: days }, (_, i) => {
    const sleptWell = i % 2 === 0;
    const sleepHours = sleptWell ? 8 + rng() * 0.3 : 6 + rng() * 0.3;
    return {
      date: dateAt(i),
      day: START + i,
      sleepHours,
      // Steps respond to the PREVIOUS night, so shift the effect by a day.
      steps: 8000 + ((i - 1) % 2 === 0 ? effect : 0) + rng() * 400,
    };
  });
}

test("a planted relationship is found and described in real units", () => {
  const report = findRelationships(plantedSeries(60, 2500));
  assert.equal(report.status, "ok");
  assert.ok(report.findings.length >= 1, "expected at least one finding");

  const finding = report.findings.find((f) => f.id === "sleep-steps");
  assert.ok(finding, `expected the sleep->steps finding, got ${report.findings.map((f) => f.id).join(", ")}`);
  assert.match(finding!.headline, /When you sleep more than/);
  assert.match(finding!.headline, /the next day runs [\d,]+ steps higher/);
  assert.match(finding!.detail, /versus .* on the \d+ you sleep under/);
  assert.ok(finding!.p < 0.05, `p was ${finding!.p}`);
  // The effect is reported near its true size.
  assert.ok(Math.abs(finding!.difference - 2500) < 600, `difference was ${finding!.difference}`);
});

test("no relationship is claimed from unrelated series", () => {
  const rng = seededRandom(3);
  const noise: DayFeatures[] = Array.from({ length: 60 }, (_, i) => ({
    date: dateAt(i),
    day: START + i,
    sleepHours: 5 + rng() * 3,
    steps: 4000 + rng() * 9000,
    restingHr: 48 + rng() * 12,
    trainingMinutes: rng() * 70,
  }));

  const report = findRelationships(noise, 42);
  assert.equal(report.status, "ok");
  assert.ok(report.tested >= 4, `expected several candidates tested, got ${report.tested}`);
  assert.equal(report.findings.length, 0, `claimed ${report.findings.map((f) => f.headline).join(" | ")}`);
});

test("a real but trivially small effect is not reported", () => {
  // Statistically detectable, but a ~1% change is not worth a headline.
  const report = findRelationships(plantedSeries(90, 90));
  assert.equal(report.findings.find((f) => f.id === "sleep-steps"), undefined);
});

test("too little history reports a countdown instead of a guess", () => {
  const report = findRelationships(plantedSeries(10, 2500));
  assert.equal(report.status, "collecting");
  assert.equal(report.findings.length, 0);
  assert.ok(report.daysNeeded! > 0 && report.daysNeeded! <= MIN_PAIRS);
});

test("findings are deterministic across runs", () => {
  const series = plantedSeries(60, 2500);
  assert.deepEqual(findRelationships(series), findRelationships(series));
});
