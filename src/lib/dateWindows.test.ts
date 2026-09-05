import { strict as assert } from "node:assert";
import { test } from "node:test";
import { localDate, mergeByDate, resolveToday, splitRange } from "./dateWindows.ts";

// The exact request that returned HTTP 400 in production.
test("a 90-day range splits into windows Garmin accepts", () => {
  const windows = splitRange("2026-06-08", "2026-09-05");
  assert.equal(windows.length, 4);
  assert.deepEqual(windows[0], { start: "2026-06-08", end: "2026-07-05" });
  assert.deepEqual(windows.at(-1), { start: "2026-08-31", end: "2026-09-05" });

  // Contiguous, no gaps and no overlaps.
  for (let i = 1; i < windows.length; i += 1) {
    const previousEnd = Date.parse(`${windows[i - 1].end}T00:00:00Z`);
    const thisStart = Date.parse(`${windows[i].start}T00:00:00Z`);
    assert.equal(thisStart - previousEnd, 86_400_000, `gap before window ${i}`);
  }
});

test("no window exceeds the limit", () => {
  for (const span of [1, 27, 28, 29, 90, 365]) {
    const end = new Date(Date.UTC(2026, 0, 1) + (span - 1) * 86_400_000).toISOString().slice(0, 10);
    for (const w of splitRange("2026-01-01", end)) {
      const days = (Date.parse(`${w.end}T00:00:00Z`) - Date.parse(`${w.start}T00:00:00Z`)) / 86_400_000 + 1;
      assert.ok(days <= 28, `window ${w.start}..${w.end} spans ${days} days`);
    }
  }
});

test("a range inside the limit stays a single request", () => {
  assert.deepEqual(splitRange("2026-08-09", "2026-09-05"), [{ start: "2026-08-09", end: "2026-09-05" }]);
  assert.deepEqual(splitRange("2026-09-05", "2026-09-05"), [{ start: "2026-09-05", end: "2026-09-05" }]);
});

test("an inverted or unparseable range yields nothing", () => {
  assert.deepEqual(splitRange("2026-09-05", "2026-08-09"), []);
  assert.deepEqual(splitRange("nonsense", "2026-09-05"), []);
});

// The reason every tile showed a dash: the server's UTC date was a day ahead.
test("the browser's date wins when it is a plausible neighbour", () => {
  assert.equal(resolveToday("2026-09-04", "2026-09-05"), "2026-09-04");
  assert.equal(resolveToday("2026-09-06", "2026-09-05"), "2026-09-06");
  assert.equal(resolveToday("2026-09-05", "2026-09-05"), "2026-09-05");
});

test("an implausible client date is ignored", () => {
  // No timezone is more than one day from UTC.
  assert.equal(resolveToday("2026-09-30", "2026-09-05"), "2026-09-05");
  assert.equal(resolveToday("1999-01-01", "2026-09-05"), "2026-09-05");
  assert.equal(resolveToday("not-a-date", "2026-09-05"), "2026-09-05");
  assert.equal(resolveToday("", "2026-09-05"), "2026-09-05");
  assert.equal(resolveToday(null, "2026-09-05"), "2026-09-05");
});

test("localDate formats the browser's own calendar day", () => {
  // Local components, not the UTC ones -- that is the whole point.
  const evening = new Date(2026, 8, 4, 22, 15);
  assert.equal(localDate(evening), "2026-09-04");
  assert.equal(localDate(new Date(2026, 0, 9, 0, 5)), "2026-01-09");
});

test("mergeByDate orders, de-duplicates and survives gaps", () => {
  const merged = mergeByDate([
    [{ calendarDate: "2026-09-02", totalSteps: 1 }, { calendarDate: "2026-09-03", totalSteps: 2 }],
    // A boundary day repeated by the next window: the later row wins.
    [{ calendarDate: "2026-09-03", totalSteps: 99 }, { calendarDate: "2026-09-01", totalSteps: 3 }],
    [],
  ]);
  assert.deepEqual(merged.map((r) => r.calendarDate), ["2026-09-01", "2026-09-02", "2026-09-03"]);
  assert.equal(merged[2].totalSteps, 99);
});

test("mergeByDate ignores rows without a date", () => {
  const merged = mergeByDate([[{ calendarDate: "2026-09-01" }, { calendarDate: "" }]] as Array<Array<{ calendarDate: string }>>);
  assert.equal(merged.length, 1);
});
