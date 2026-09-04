import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fromDayNumber, toDayNumber } from "./forecast.ts";
import { trainingLoad } from "./trainingLoad.ts";

const TODAY = "2026-09-04";

/** An activity `daysAgo` before TODAY, lasting `minutes`. */
function activity(daysAgo: number, minutes: number) {
  return {
    startTimeLocal: `${fromDayNumber(toDayNumber(TODAY) - daysAgo)} 07:00:00`,
    duration: minutes * 60,
  };
}

test("a steady four weeks reports a ratio near 1", () => {
  // 60 minutes every day for 28 days.
  const activities = Array.from({ length: 28 }, (_, i) => activity(i, 60));
  const load = trainingLoad(activities, TODAY);

  assert.equal(load.acuteMinutes, 420);
  assert.equal(load.chronicMinutes, 420);
  assert.equal(load.ratio, 1);
  assert.equal(load.status, "steady");
  assert.equal(load.sessionsThisWeek, 7);
});

test("a heavy recent week reads as ramping", () => {
  const activities = [
    ...Array.from({ length: 7 }, (_, i) => activity(i, 120)),
    ...Array.from({ length: 21 }, (_, i) => activity(i + 7, 30)),
  ];
  const load = trainingLoad(activities, TODAY);
  assert.equal(load.acuteMinutes, 840);
  assert.equal(load.chronicMinutes, (840 + 630) / 4);
  assert.ok(load.ratio! > 1.5, String(load.ratio));
  assert.equal(load.status, "ramping");
});

test("a quiet recent week reads as detraining", () => {
  const activities = Array.from({ length: 21 }, (_, i) => activity(i + 7, 90));
  const load = trainingLoad(activities, TODAY);
  assert.equal(load.acuteMinutes, 0);
  assert.equal(load.ratio, 0);
  assert.equal(load.status, "detraining");
});

test("activities beyond four weeks and in the future are ignored", () => {
  const load = trainingLoad([activity(28, 600), activity(60, 600), activity(-3, 600)], TODAY);
  assert.equal(load.status, "insufficient");
  assert.equal(load.acuteMinutes, 0);
});

test("missing dates and durations are skipped, not counted as zero", () => {
  const load = trainingLoad(
    [activity(1, 60), { startTimeLocal: null, duration: 3600 }, { startTimeLocal: `${TODAY} 07:00:00`, duration: null }],
    TODAY,
  );
  assert.equal(load.acuteMinutes, 60);
  assert.equal(load.sessionsThisWeek, 1);
});

test("no history at all is reported as insufficient rather than a ratio", () => {
  const load = trainingLoad([], TODAY);
  assert.equal(load.status, "insufficient");
  assert.equal(load.ratio, null);
});
