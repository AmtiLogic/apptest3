import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fromDayNumber, toDayNumber } from "./forecast.ts";
import { momentum, momentumLabel } from "./momentum.ts";

const START = toDayNumber("2026-02-01");
const build = (values: Array<number | null>, goal = 10000) =>
  values.map((value, i) => ({ date: fromDayNumber(START + i), value, goal }));

test("hitting the goal every day scores 100", () => {
  const result = momentum(build(Array(20).fill(12000)))!;
  assert.equal(Math.round(result.score), 100);
  assert.equal(result.currentRun, 20);
});

test("never hitting the goal scores 0", () => {
  const result = momentum(build(Array(20).fill(4000)))!;
  assert.equal(Math.round(result.score), 0);
  assert.equal(result.currentRun, 0);
});

// The point of the design: one bad day should dent, not erase.
test("a single miss after a long run costs a little, not everything", () => {
  const perfect = momentum(build(Array(30).fill(12000)))!;
  const oneMiss = momentum(build([...Array(29).fill(12000), 3000]))!;

  assert.equal(oneMiss.currentRun, 0, "the streak is broken");
  assert.ok(oneMiss.score > 50, `score collapsed to ${oneMiss.score}`);
  assert.ok(perfect.score - oneMiss.score < 40, `a single miss cost ${perfect.score - oneMiss.score} points`);
});

test("recent days weigh more than old ones", () => {
  // Same number of good days, but recency differs.
  const improving = momentum(build([...Array(10).fill(4000), ...Array(10).fill(12000)]))!;
  const declining = momentum(build([...Array(10).fill(12000), ...Array(10).fill(4000)]))!;
  assert.ok(improving.score > declining.score, `${improving.score} should beat ${declining.score}`);
  // A 10-day half-life still gives a 20-day-old day about a quarter of the
  // weight, so the split is decisive without pretending the past vanishes.
  assert.ok(improving.score > 60, `improving was ${improving.score}`);
  assert.ok(declining.score < 40, `declining was ${declining.score}`);
  assert.ok(improving.score - declining.score > 25, "the two should be clearly apart");
});

test("the trend compares like with like", () => {
  const improving = momentum(build([...Array(14).fill(4000), ...Array(7).fill(12000)]))!;
  assert.ok(improving.trend !== null && improving.trend > 0, `trend was ${improving.trend}`);

  const worsening = momentum(build([...Array(14).fill(12000), ...Array(7).fill(4000)]))!;
  assert.ok(worsening.trend !== null && worsening.trend < 0, `trend was ${worsening.trend}`);
});

test("missing days and absent goals are skipped, not counted as failures", () => {
  const withGaps = momentum([
    ...build(Array(10).fill(12000)),
    { date: fromDayNumber(START + 10), value: null, goal: 10000 },
    { date: fromDayNumber(START + 11), value: 12000, goal: null },
  ])!;
  assert.equal(Math.round(withGaps.score), 100);
});

test("too little history returns nothing rather than a shaky number", () => {
  assert.equal(momentum(build([12000, 11000, 9000])), null);
  assert.equal(momentum([]), null);
});

test("labels cover the whole range", () => {
  assert.equal(momentumLabel(95), "Locked in");
  assert.equal(momentumLabel(65), "Consistent");
  assert.equal(momentumLabel(45), "On and off");
  assert.equal(momentumLabel(25), "Slipping");
  assert.equal(momentumLabel(5), "Dormant");
});
