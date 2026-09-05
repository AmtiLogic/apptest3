import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bodyCoverage, coverageSentence } from "./bodyMap.ts";
import { fromDayNumber, toDayNumber } from "./forecast.ts";
import type { Activity } from "./garmin/endpoints.ts";

const TODAY = "2026-04-20";
const ago = (days: number) => fromDayNumber(toDayNumber(TODAY) - days);

const act = (daysAgo: number, typeKey: string, minutes: number): Activity => ({
  activityId: Math.random(),
  activityName: typeKey,
  startTimeLocal: `${ago(daysAgo)} 07:00:00`,
  distance: null,
  duration: minutes * 60,
  elapsedDuration: null,
  movingDuration: null,
  elevationGain: null,
  averageSpeed: null,
  averageHR: null,
  maxHR: null,
  calories: null,
  activityType: { typeKey },
});

test("running-only training concentrates on legs and flags the rest", () => {
  const coverage = bodyCoverage(Array.from({ length: 12 }, (_, i) => act(i * 2, "running", 45)), TODAY);

  assert.equal(coverage.status, "ok");
  assert.equal(coverage.regions[0].region, "legs");
  assert.ok(coverage.regions[0].share > 70, `legs share was ${coverage.regions[0].share}`);
  // Nothing in the running mapping touches these.
  for (const region of ["back", "chest", "arms"] as const) {
    assert.ok(coverage.neglected.includes(region), `${region} should be flagged`);
  }
  assert.match(coverageSentence(coverage), /Least worked:/);
});

test("a varied week spreads across regions and flags nothing", () => {
  const coverage = bodyCoverage(
    [act(1, "running", 45), act(3, "strength_training", 60), act(5, "lap_swimming", 45), act(7, "rowing", 40),
     act(9, "strength_training", 60), act(11, "indoor_climbing", 50)],
    TODAY,
  );
  assert.equal(coverage.status, "ok");
  assert.equal(coverage.neglected.length, 0, `flagged ${coverage.neglected.join(", ")}`);
  assert.match(coverageSentence(coverage), /Everything is getting some work/);
});

test("emphasis is duration-weighted, not per-session", () => {
  // One long ride against one short swim: legs should dominate.
  const coverage = bodyCoverage([act(1, "cycling", 180), act(2, "lap_swimming", 20)], TODAY);
  assert.equal(coverage.regions[0].region, "legs");
  assert.ok(coverage.regions[0].share > 60);
});

test("days since last trained is tracked per region", () => {
  const coverage = bodyCoverage([act(2, "running", 45), act(9, "lap_swimming", 45)], TODAY);
  const legs = coverage.regions.find((r) => r.region === "legs")!;
  const chest = coverage.regions.find((r) => r.region === "chest")!;
  assert.equal(legs.daysSince, 2);
  assert.equal(chest.daysSince, 9);
});

test("activities outside the window and in the future are excluded", () => {
  const coverage = bodyCoverage([act(28, "running", 60), act(400, "running", 60), act(-3, "running", 60)], TODAY);
  assert.equal(coverage.status, "insufficient");
  assert.equal(coverage.totalMinutes, 0);
});

test("unmapped activity types are counted separately, never silently dropped", () => {
  const coverage = bodyCoverage([act(1, "running", 30), act(2, "underwater_basket_weaving", 90)], TODAY);
  assert.equal(coverage.unclassifiedMinutes, 90);
  assert.ok(coverage.totalMinutes > 0);
});

test("no activities gives an honest empty state", () => {
  const coverage = bodyCoverage([], TODAY);
  assert.equal(coverage.status, "insufficient");
  assert.equal(coverage.regions.length, 5);
  assert.equal(coverage.neglected.length, 0);
  assert.match(coverageSentence(coverage), /Record a few activities/);
});

test("shares add up to 100", () => {
  const coverage = bodyCoverage([act(1, "running", 45), act(2, "strength_training", 60), act(4, "rowing", 30)], TODAY);
  const total = coverage.regions.reduce((sum, r) => sum + r.share, 0);
  assert.ok(Math.abs(total - 100) < 1e-6, `shares summed to ${total}`);
});
