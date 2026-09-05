/**
 * Statistics for personal-history analysis.
 *
 * Everything here is deliberately non-parametric and permutation-based: sample
 * sizes are small (weeks, not thousands), distributions are skewed, and a
 * confident-sounding claim drawn from noise is worse than no claim at all.
 */

/** Deterministic RNG, so a finding never changes between two identical syncs. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

/** Linear-interpolation quantile (the common "type 7" definition). */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const position = (sorted.length - 1) * Math.min(Math.max(q, 0), 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (position - lower) * (sorted[upper] - sorted[lower]);
}

export function median(values: number[]): number {
  return quantile(values, 0.5);
}

/**
 * Where a value sits in a history, as a percentage of observations at or below
 * it. This is what makes a number self-explanatory: 9,431 means nothing, "higher
 * than 72% of your days" means something.
 */
export function percentileOf(value: number, history: number[]): number | null {
  if (history.length === 0) return null;
  const atOrBelow = history.filter((v) => v <= value).length;
  return (atOrBelow / history.length) * 100;
}

export interface TypicalRange {
  low: number;
  median: number;
  high: number;
}

/** The middle half of the history — the band a chart draws as "normal for you". */
export function typicalRange(values: number[]): TypicalRange | null {
  if (values.length < 4) return null;
  return { low: quantile(values, 0.25), median: quantile(values, 0.5), high: quantile(values, 0.75) };
}

export interface GroupComparison {
  /** mean(high group) - mean(low group), in the outcome's own units. */
  difference: number;
  highCount: number;
  lowCount: number;
  highMean: number;
  lowMean: number;
  /** Split point on the predictor. */
  threshold: number;
  /** Permutation p-value, two-sided. */
  p: number;
}

const PERMUTATIONS = 2000;

/**
 * Splits paired observations at the predictor's median and tests whether the
 * outcome differs between the halves.
 *
 * A difference in means is used rather than a correlation coefficient because
 * it reports in the outcome's own units -- "2,400 more steps" is legible in a
 * way that "r = 0.34" is not. Significance comes from a permutation test, which
 * needs no distributional assumption and no special functions.
 */
export function compareBySplit(
  pairs: Array<{ predictor: number; outcome: number }>,
  seed = 1,
): GroupComparison | null {
  if (pairs.length < 8) return null;

  const threshold = median(pairs.map((p) => p.predictor));
  const high = pairs.filter((p) => p.predictor > threshold).map((p) => p.outcome);
  const low = pairs.filter((p) => p.predictor <= threshold).map((p) => p.outcome);

  // A predictor with almost no spread cannot split into two usable groups.
  if (high.length < 4 || low.length < 4) return null;

  const highMean = mean(high);
  const lowMean = mean(low);
  const difference = highMean - lowMean;

  const outcomes = pairs.map((p) => p.outcome);
  const random = seededRandom(seed);
  const highSize = high.length;

  let atLeastAsExtreme = 0;
  for (let i = 0; i < PERMUTATIONS; i += 1) {
    const shuffled = [...outcomes];
    // Fisher-Yates over the outcomes only: this is the null in which the
    // predictor carries no information.
    for (let j = shuffled.length - 1; j > 0; j -= 1) {
      const k = Math.floor(random() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const permutedDiff = mean(shuffled.slice(0, highSize)) - mean(shuffled.slice(highSize));
    if (Math.abs(permutedDiff) >= Math.abs(difference)) atLeastAsExtreme += 1;
  }

  return {
    difference,
    highCount: high.length,
    lowCount: low.length,
    highMean,
    lowMean,
    threshold,
    // The +1s keep p away from an impossible zero.
    p: (atLeastAsExtreme + 1) / (PERMUTATIONS + 1),
  };
}

/**
 * Benjamini-Hochberg: which of several tests survive once you account for
 * having run several.
 *
 * Testing a dozen relationships and reporting whatever clears p < 0.05 will
 * surface roughly one pure coincidence every time. This is the difference
 * between a real finding and a horoscope.
 */
export function benjaminiHochberg(pValues: number[], fdr = 0.1): boolean[] {
  const m = pValues.length;
  if (m === 0) return [];

  const ordered = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p);

  let lastSignificant = -1;
  ordered.forEach((entry, rank) => {
    if (entry.p <= ((rank + 1) / m) * fdr) lastSignificant = rank;
  });

  const keep = new Array<boolean>(m).fill(false);
  for (let rank = 0; rank <= lastSignificant; rank += 1) keep[ordered[rank].index] = true;
  return keep;
}
