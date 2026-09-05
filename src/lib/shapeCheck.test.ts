import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkShape, EXPECTED } from "./shapeCheck.ts";

test("a recognised response with values is fine", () => {
  const verdict = checkShape({ totalSteps: 9431, dailyStepGoal: 10000 }, EXPECTED.daily);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.emptyButValid, undefined);
});

test("a recognised response with only nulls is valid but empty", () => {
  const verdict = checkShape({ totalSteps: null, dailyStepGoal: null }, EXPECTED.daily);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.emptyButValid, true);
});

// The case that produced a dashboard of dashes with no explanation.
test("an unrecognised shape names the keys it actually got", () => {
  const verdict = checkShape({ userDailySummaryId: 1, steps: 9431, kcal: 2643 }, EXPECTED.daily);
  assert.equal(verdict.ok, false);
  assert.match(verdict.message!, /none of the expected fields/);
  assert.match(verdict.message!, /userDailySummaryId, steps, kcal/);
  assert.match(verdict.message!, /Expected any of: totalSteps/);
});

test("a long key list is truncated with a total", () => {
  const wide = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`field${i}`, i]));
  const verdict = checkShape(wide, EXPECTED.daily);
  assert.match(verdict.message!, /…\(30 total\)/);
});

test("empty and non-object responses are reported distinctly", () => {
  assert.match(checkShape(null, EXPECTED.daily).message!, /empty response/);
  assert.match(checkShape({}, EXPECTED.daily).message!, /empty object/);
  assert.match(checkShape("nope", EXPECTED.daily).message!, /returned a string/);
  assert.match(checkShape([], EXPECTED.daily).message!, /empty list/);
});

test("a non-empty array is accepted", () => {
  assert.equal(checkShape([{ calendarDate: "2026-09-05" }], EXPECTED.daily).ok, true);
});
