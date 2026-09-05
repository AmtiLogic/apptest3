import { strict as assert } from "node:assert";
import { test } from "node:test";
import { normaliseWeight } from "./weight.ts";

test("grams are converted, kilograms are left alone", () => {
  assert.deepEqual(normaliseWeight([{ calendarDate: "2026-05-01", weight: 78400 }]), [
    { date: "2026-05-01", weight: 78.4 },
  ]);
  assert.deepEqual(normaliseWeight([{ calendarDate: "2026-05-01", weight: 78.4 }]), [
    { date: "2026-05-01", weight: 78.4 },
  ]);
});

test("the documented wrapper shapes are all accepted", () => {
  const expected = [{ date: "2026-05-01", weight: 80 }];
  assert.deepEqual(normaliseWeight({ dailyWeightSummaries: [{ calendarDate: "2026-05-01", weight: 80000 }] }), expected);
  assert.deepEqual(normaliseWeight({ dateWeightList: [{ date: "2026-05-01", weightKg: 80 }] }), expected);
  assert.deepEqual(normaliseWeight({ weightList: [{ summaryDate: "2026-05-01", value: 80000 }] }), expected);
});

test("epoch timestamps are read as dates", () => {
  const midday = Date.UTC(2026, 4, 1, 12);
  assert.deepEqual(normaliseWeight([{ timestampGMT: midday, weight: 80000 }]), [{ date: "2026-05-01", weight: 80 }]);
});

test("a nested reading is picked up", () => {
  assert.deepEqual(
    normaliseWeight([{ calendarDate: "2026-05-02", allWeightMetrics: [{ weight: 81500 }] }]),
    [{ date: "2026-05-02", weight: 81.5 }],
  );
});

test("implausible and malformed rows are discarded, not charted", () => {
  assert.deepEqual(
    normaliseWeight([
      { calendarDate: "2026-05-01", weight: 0 },
      { calendarDate: "2026-05-02", weight: -5 },
      { calendarDate: "2026-05-03", weight: 5 },
      { calendarDate: "2026-05-04", weight: 900000 },
      { weight: 80000 },
      { calendarDate: "2026-05-05" },
      null,
      "nonsense",
    ]),
    [],
  );
});

test("multiple readings for one day collapse to the last", () => {
  assert.deepEqual(
    normaliseWeight([
      { calendarDate: "2026-05-01", weight: 80000 },
      { calendarDate: "2026-05-01", weight: 79500 },
    ]),
    [{ date: "2026-05-01", weight: 79.5 }],
  );
});

test("results come back in date order", () => {
  const result = normaliseWeight([
    { calendarDate: "2026-05-03", weight: 80000 },
    { calendarDate: "2026-05-01", weight: 81000 },
    { calendarDate: "2026-05-02", weight: 80500 },
  ]);
  assert.deepEqual(result.map((r) => r.date), ["2026-05-01", "2026-05-02", "2026-05-03"]);
});

test("unusable input yields an empty series rather than throwing", () => {
  assert.deepEqual(normaliseWeight(null), []);
  assert.deepEqual(normaliseWeight(undefined), []);
  assert.deepEqual(normaliseWeight({}), []);
  assert.deepEqual(normaliseWeight("nope"), []);
});
