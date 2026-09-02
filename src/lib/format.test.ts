import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatDistance, formatDuration, formatHoursMinutes, formatPace } from "./format.ts";

test("formatDuration never renders 60 seconds", () => {
  // 1919.9s rounds to 1920s = 32:00, not 31:60.
  assert.equal(formatDuration(1919.9), "32:00");
  assert.equal(formatDuration(3599.7), "1:00:00");
  assert.equal(formatDuration(3600), "1:00:00");
  assert.equal(formatDuration(61), "1:01");
  assert.equal(formatDuration(0), "—");
  assert.equal(formatDuration(null), "—");
});

test("formatHoursMinutes never renders 60 minutes", () => {
  // 3599s rounds to 60 minutes, which must carry into the hour.
  assert.equal(formatHoursMinutes(3599), "1h 0m");
  assert.equal(formatHoursMinutes(26_820), "7h 27m");
  assert.equal(formatHoursMinutes(1_140), "19m");
  assert.equal(formatHoursMinutes(0), null);
});

test("formatDistance switches units at a kilometre", () => {
  assert.equal(formatDistance(999), "999 m");
  assert.equal(formatDistance(1000), "1.00 km");
  assert.equal(formatDistance(10_240), "10.24 km");
  assert.equal(formatDistance(null), "—");
});

test("formatPace converts m/s to min/km", () => {
  assert.equal(formatPace(3.333333), "5:00 /km");
  assert.equal(formatPace(null), "—");
});
