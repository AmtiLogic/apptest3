import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  benjaminiHochberg,
  compareBySplit,
  mean,
  median,
  percentileOf,
  quantile,
  seededRandom,
  standardDeviation,
  typicalRange,
} from "./stats.ts";

const close = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} within ${tol} of ${b}`);

// Cross-checked against the standard "type 7" linear interpolation.
test("quantile matches the reference definition", () => {
  const data = [3, 1, 4, 1, 5, 9, 2, 6];
  close(quantile(data, 0.25), 1.75);
  close(quantile(data, 0.5), 3.5);
  close(quantile(data, 0.75), 5.25);
  close(median([10, 2, 38, 23, 38]), 23);
});

test("quantile handles degenerate inputs", () => {
  close(quantile([], 0.5), 0);
  close(quantile([7], 0.5), 7);
  close(quantile([1, 2, 3], 0), 1);
  close(quantile([1, 2, 3], 1), 3);
  // Out-of-range q is clamped rather than producing nonsense.
  close(quantile([1, 2, 3], -5), 1);
  close(quantile([1, 2, 3], 5), 3);
});

test("percentileOf places a value in its own history", () => {
  const history = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  close(percentileOf(10, history)!, 100);
  close(percentileOf(5, history)!, 50);
  close(percentileOf(0, history)!, 0);
  assert.equal(percentileOf(5, []), null);
});

test("typicalRange needs enough history to mean anything", () => {
  assert.equal(typicalRange([1, 2, 3]), null);
  const range = typicalRange([1, 2, 3, 4, 5, 6, 7, 8, 9])!;
  close(range.low, 3);
  close(range.median, 5);
  close(range.high, 7);
});

test("mean and standard deviation behave at the edges", () => {
  close(mean([]), 0);
  close(standardDeviation([5]), 0);
  // Sample standard deviation of 2,4,4,4,5,5,7,9 is exactly 2.13809...
  close(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]), 2.13808993529939, 1e-12);
});

test("seededRandom is deterministic and in range", () => {
  const a = seededRandom(42);
  const b = seededRandom(42);
  const draws = Array.from({ length: 200 }, () => a());
  assert.deepEqual(draws, Array.from({ length: 200 }, () => b()));
  assert.ok(draws.every((v) => v >= 0 && v < 1));
});

test("a real effect is detected with a small p-value", () => {
  // Outcome is 2000 higher whenever the predictor is high, plus mild noise.
  const pairs = Array.from({ length: 40 }, (_, i) => {
    const high = i % 2 === 0;
    return {
      predictor: high ? 8 + (i % 3) * 0.1 : 5 + (i % 3) * 0.1,
      outcome: (high ? 10000 : 8000) + (i % 5) * 100,
    };
  });
  const result = compareBySplit(pairs)!;
  assert.ok(result.difference > 1800, `difference was ${result.difference}`);
  assert.ok(result.p < 0.01, `p was ${result.p}`);
  assert.equal(result.highCount + result.lowCount, 40);
});

// A single noise dataset says nothing -- p < 0.05 happens 5% of the time by
// definition. What matters is that the test is calibrated: across many
// independent noise datasets, the false-positive rate should sit near nominal.
test("the permutation test is calibrated on pure noise", () => {
  const TRIALS = 300;
  let falsePositives = 0;

  for (let trial = 0; trial < TRIALS; trial += 1) {
    // Independent streams, so no serial structure in one generator can leak a
    // relationship between predictor and outcome.
    const predictorRng = seededRandom(1000 + trial);
    const outcomeRng = seededRandom(500000 + trial * 7919);
    const pairs = Array.from({ length: 40 }, () => ({
      predictor: predictorRng(),
      outcome: outcomeRng() * 10000,
    }));
    if (compareBySplit(pairs, trial + 1)!.p < 0.05) falsePositives += 1;
  }

  const rate = falsePositives / TRIALS;
  // Nominal is 0.05; allow generous slack for 300 trials without being useless.
  assert.ok(rate < 0.12, `false-positive rate was ${rate} (expected near 0.05)`);
});

test("compareBySplit refuses too little data or an unsplittable predictor", () => {
  assert.equal(compareBySplit([{ predictor: 1, outcome: 2 }]), null);
  // Every predictor identical: the median split cannot form two groups.
  const flat = Array.from({ length: 20 }, (_, i) => ({ predictor: 5, outcome: i }));
  assert.equal(compareBySplit(flat), null);
});

test("compareBySplit is reproducible for identical input", () => {
  const pairs = Array.from({ length: 30 }, (_, i) => ({ predictor: i % 7, outcome: (i * 37) % 91 }));
  assert.deepEqual(compareBySplit(pairs, 5), compareBySplit(pairs, 5));
});

test("Benjamini-Hochberg keeps the strong findings and drops the borderline", () => {
  // With 5 tests at FDR 0.1, only p <= (rank/5)*0.1 survives.
  // Sorted, 0.04 sits exactly on its threshold (2/5 x 0.1), so BH steps up to
  // it and keeps everything at or below that rank.
  assert.deepEqual(benjaminiHochberg([0.001, 0.9, 0.04, 0.7, 0.5], 0.1), [true, false, true, false, false]);
  assert.deepEqual(benjaminiHochberg([0.001, 0.9, 0.041, 0.7, 0.5], 0.1), [true, false, false, false, false]);
  assert.deepEqual(benjaminiHochberg([0.001, 0.01, 0.02, 0.03, 0.04], 0.1), [true, true, true, true, true]);
  assert.deepEqual(benjaminiHochberg([], 0.1), []);
});

test("a lone p just under 0.05 does not survive correction across many tests", () => {
  // The exact horoscope case: twelve tests, one "significant" by luck.
  const many = [0.04, ...Array.from({ length: 11 }, () => 0.8)];
  assert.deepEqual(benjaminiHochberg(many, 0.1)[0], false);
});
