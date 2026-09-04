import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fitLine, forecastDaily, fromDayNumber, goalOutlook, toDayNumber, weekdayOf } from "./forecast.ts";

const close = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

test("fitLine recovers an exact line", () => {
  const xs = [0, 1, 2, 3, 4];
  const fit = fitLine(xs, xs.map((x) => 3 * x + 5));
  close(fit.slopePerDay, 3);
  close(fit.intercept, 5);
  close(fit.r2, 1);
  close(fit.residualSd, 0);
});

// Cross-checked against an independent implementation (normal equations, computed
// in Python) over the same data.
test("fitLine matches an independent OLS reference", () => {
  const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const ys = [8200, 4100, 9300, 9900, 7400, 11200, 6100, 8800, 4600, 9900, 10400, 7900, 11800, 6600];
  const fit = fitLine(xs, ys);
  close(fit.slopePerDay, 110.3296703297, 1e-6);
  close(fit.intercept, 7582.8571428571, 1e-6);
  close(fit.r2, 0.0387419519, 1e-9);
  close(fit.residualSd, 2392.8839865095, 1e-6);
});

test("fitLine handles a flat series without dividing by zero", () => {
  const fit = fitLine([5, 5, 5], [10, 10, 10]);
  close(fit.slopePerDay, 0);
  assert.ok(Number.isFinite(fit.intercept));
  assert.ok(Number.isFinite(fit.r2));
});

test("weekdayOf agrees with the platform date parser", () => {
  for (const date of ["2026-01-01", "2026-03-15", "2026-09-04", "1999-12-31"]) {
    assert.equal(weekdayOf(toDayNumber(date)), new Date(`${date}T00:00:00Z`).getUTCDay(), date);
  }
});

test("day numbers round-trip through dates", () => {
  assert.equal(fromDayNumber(toDayNumber("2026-09-04")), "2026-09-04");
});

/** Builds a series with a known trend and known weekday offsets. */
function syntheticSeries(days: number, base: number, slope: number, offsets: number[]) {
  const start = toDayNumber("2026-01-04"); // a Sunday
  return Array.from({ length: days }, (_, i) => ({
    date: fromDayNumber(start + i),
    value: base + slope * i + offsets[weekdayOf(start + i)],
  }));
}

test("forecastDaily recovers a known trend and weekday shape", () => {
  const offsets = [-2000, 500, 400, 300, 200, 1000, -400];
  const series = syntheticSeries(28, 8000, 40, offsets);

  const forecast = forecastDaily(series, 7);
  assert.equal(forecast.status, "ok");
  close(forecast.fit!.slopePerDay, 40, 1e-6);
  close(forecast.changePerWeek!, 280, 1e-5);

  // Effects are centred, so compare against the centred truth.
  const centre = offsets.reduce((a, b) => a + b, 0) / 7;
  offsets.forEach((offset, weekday) => {
    close(forecast.weekdayEffects![weekday], offset - centre, 1e-6);
  });

  // Noise-free data means the projection reproduces the generator exactly.
  const first = forecast.predictions[0];
  const expected = 8000 + 40 * 28 + offsets[weekdayOf(toDayNumber(first.date))];
  close(first.value, expected, 1e-5);
});

test("a noise-free fit produces a zero-width interval", () => {
  const forecast = forecastDaily(syntheticSeries(28, 8000, 40, [0, 0, 0, 0, 0, 0, 0]), 3);
  close(forecast.predictions[0].upper - forecast.predictions[0].lower, 0, 1e-6);
});

test("the weekday term is skipped below two weeks of data", () => {
  const forecast = forecastDaily(syntheticSeries(10, 8000, 40, [0, 0, 0, 0, 0, 0, 0]), 7);
  assert.equal(forecast.status, "ok");
  assert.equal(forecast.weekdayEffects, null);
});

test("too little data refuses to forecast", () => {
  const forecast = forecastDaily(syntheticSeries(4, 8000, 0, [0, 0, 0, 0, 0, 0, 0]), 7);
  assert.equal(forecast.status, "insufficient");
  assert.equal(forecast.predictions.length, 0);
  assert.match(forecast.reason!, /Needs 7 days/);
});

test("unworn days are excluded rather than dragging the trend down", () => {
  const clean = syntheticSeries(21, 8000, 50, [0, 0, 0, 0, 0, 0, 0]);
  const withGaps = clean.map((p, i) => (i === 5 ? { ...p, value: 0 } : i === 11 ? { ...p, value: null } : p));

  const a = forecastDaily(clean, 7);
  const b = forecastDaily(withGaps, 7);
  // Dates carry the gaps, so the surviving points still imply the same slope.
  close(b.fit!.slopePerDay, a.fit!.slopePerDay, 1e-6);
});

test("counts are never predicted negative", () => {
  const series = syntheticSeries(21, 6000, -400, [0, 0, 0, 0, 0, 0, 0]);
  const forecast = forecastDaily(series, 14);
  assert.ok(forecast.predictions.every((p) => p.value >= 0 && p.lower >= 0));
});

test("goalOutlook counts predicted and historical goal days", () => {
  const series = syntheticSeries(28, 9000, 0, [0, 0, 0, 0, 0, 0, 0]);
  const forecast = forecastDaily(series, 7);

  const met = goalOutlook(series, forecast, 8000)!;
  assert.equal(met.daysMeetingGoal, 7);
  assert.equal(met.horizon, 7);
  close(met.recentHitRate, 1);

  const missed = goalOutlook(series, forecast, 20000)!;
  assert.equal(missed.daysMeetingGoal, 0);
  close(missed.recentHitRate, 0);

  assert.equal(goalOutlook(series, forecast, null), null);
});
