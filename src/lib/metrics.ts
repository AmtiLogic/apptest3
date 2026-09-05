import type { DailyPoint } from "./forecast";
import { forecastDaily, type Forecast } from "./forecast";
import type { Activity, StepsForDay } from "./garmin/endpoints";
import { momentum, type Momentum } from "./momentum";
import { percentileOf, typicalRange, type TypicalRange } from "./stats";

/**
 * One registry, every metric.
 *
 * The forecast, the typical-range band, the percentile and the momentum score
 * are all generic over a daily series -- they were only ever pointed at steps.
 * Registering a metric here gives it the whole treatment, and a metric whose
 * data is unavailable simply reports as such rather than being special-cased.
 */

export type MetricKey =
  | "steps"
  | "trainingMinutes"
  | "exerciseDistance"
  | "exerciseCalories"
  | "elevation"
  | "activityHr"
  | "weight";

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  /** Shown beside the hero figure. */
  unit: string;
  /** Whether a rise is progress, for colouring a delta. "neutral" makes no claim. */
  direction: "up" | "neutral";
  format: (value: number) => string;
  /** Compact form for a list row. */
  compact: (value: number) => string;
  /**
   * Form for use inside prose, always carrying its unit. A metric whose label
   * sits beside it can render bare, but "668 a week" in a sentence is exactly
   * the kind of number that means nothing on its own.
   */
  sentence: (value: number) => string;
  /**
   * True when a day with no record means zero (you did no training), false when
   * it means unknown (there is no workout heart rate on a rest day).
   */
  zeroFill: boolean;
  /** Days below this are treated as "not worn" rather than a real reading. */
  treatZeroAsMissing: boolean;
  /**
   * Whether the chart should start at zero. True for counts, where zero is the
   * meaningful floor; false for weight and heart rate, where anchoring at zero
   * squashes every real change into a flat line.
   */
  zeroBaseline: boolean;
  description: string;
}

const round = (v: number, dp = 0) =>
  v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const METRICS: Record<MetricKey, MetricDefinition> = {
  steps: {
    key: "steps",
    label: "Steps",
    unit: "",
    direction: "up",
    format: (v) => round(v),
    compact: (v) => round(v),
    sentence: (v) => `${round(v)} steps`,
    zeroFill: false,
    treatZeroAsMissing: true,
    zeroBaseline: true,
    description: "Daily step count from your watch.",
  },
  trainingMinutes: {
    key: "trainingMinutes",
    label: "Training",
    unit: "min",
    direction: "up",
    format: (v) => `${round(v)} min`,
    sentence: (v) => `${round(v)} min`,
    compact: (v) => `${round(v)} min`,
    zeroFill: true,
    treatZeroAsMissing: false,
    zeroBaseline: true,
    description: "Recorded activity time each day. Rest days count as zero.",
  },
  exerciseDistance: {
    key: "exerciseDistance",
    label: "Exercise distance",
    unit: "km",
    direction: "up",
    format: (v) => `${round(v, 2)} km`,
    sentence: (v) => `${round(v, 2)} km`,
    compact: (v) => `${round(v, 1)} km`,
    zeroFill: true,
    treatZeroAsMissing: false,
    zeroBaseline: true,
    description: "Distance covered in recorded activities, not total daily movement.",
  },
  exerciseCalories: {
    key: "exerciseCalories",
    label: "Exercise calories",
    unit: "kcal",
    direction: "up",
    format: (v) => `${round(v)} kcal`,
    sentence: (v) => `${round(v)} kcal`,
    compact: (v) => `${round(v)}`,
    zeroFill: true,
    treatZeroAsMissing: false,
    zeroBaseline: true,
    description: "Calories from recorded activities.",
  },
  elevation: {
    key: "elevation",
    label: "Elevation",
    unit: "m",
    direction: "neutral",
    format: (v) => `${round(v)} m`,
    sentence: (v) => `${round(v)} m`,
    compact: (v) => `${round(v)} m`,
    zeroFill: true,
    treatZeroAsMissing: false,
    zeroBaseline: true,
    description: "Elevation climbed in recorded activities.",
  },
  activityHr: {
    key: "activityHr",
    label: "Workout heart rate",
    unit: "bpm",
    direction: "neutral",
    format: (v) => `${round(v)} bpm`,
    sentence: (v) => `${round(v)} bpm`,
    compact: (v) => `${round(v)}`,
    // A rest day has no workout heart rate; that is unknown, not zero.
    zeroFill: false,
    treatZeroAsMissing: true,
    zeroBaseline: false,
    description: "Average heart rate across your activities, weighted by duration.",
  },
  weight: {
    key: "weight",
    label: "Weight",
    unit: "kg",
    // Deliberately neutral: which direction counts as progress is not the
    // app's call to make.
    direction: "neutral",
    format: (v) => `${round(v, 1)} kg`,
    sentence: (v) => `${round(v, 1)} kg`,
    compact: (v) => `${round(v, 1)}`,
    zeroFill: false,
    treatZeroAsMissing: true,
    zeroBaseline: false,
    description: "Body weight, from a connected scale or manual entries.",
  },
};

export const METRIC_ORDER: MetricKey[] = [
  "steps",
  "trainingMinutes",
  "exerciseDistance",
  "exerciseCalories",
  "elevation",
  "activityHr",
  "weight",
];

export interface WeightEntry {
  date: string;
  /** Kilograms. */
  weight: number;
}

export interface SeriesSource {
  steps: StepsForDay[];
  activities: Activity[];
  weight?: WeightEntry[];
}

function activityDate(startTimeLocal: string | null): string | null {
  return startTimeLocal ? startTimeLocal.slice(0, 10) : null;
}

/** Builds every metric's daily series from whatever data is present. */
export function buildSeries(source: SeriesSource): Record<MetricKey, DailyPoint[]> {
  const days = new Set<string>();
  for (const day of source.steps) if (day?.calendarDate) days.add(day.calendarDate);

  const stepsByDate = new Map<string, number | null>();
  for (const day of source.steps) {
    if (!day?.calendarDate) continue;
    const value = day.totalSteps;
    stepsByDate.set(day.calendarDate, value !== null && value !== undefined && value > 0 ? value : null);
  }

  interface Bucket {
    minutes: number;
    metres: number;
    calories: number;
    elevation: number;
    hrWeighted: number;
    hrDuration: number;
  }
  const activityByDate = new Map<string, Bucket>();

  for (const activity of source.activities) {
    const date = activityDate(activity.startTimeLocal);
    if (!date) continue;
    days.add(date);

    const bucket = activityByDate.get(date) ?? {
      minutes: 0,
      metres: 0,
      calories: 0,
      elevation: 0,
      hrWeighted: 0,
      hrDuration: 0,
    };

    const duration = activity.duration ?? 0;
    bucket.minutes += duration / 60;
    bucket.metres += activity.distance ?? 0;
    bucket.calories += activity.calories ?? 0;
    bucket.elevation += activity.elevationGain ?? 0;
    // Weighted by duration: a 90-minute ride should count for more than a
    // 10-minute warm-up when averaging heart rate.
    if (activity.averageHR && duration > 0) {
      bucket.hrWeighted += activity.averageHR * duration;
      bucket.hrDuration += duration;
    }

    activityByDate.set(date, bucket);
  }

  const weightByDate = new Map<string, number>();
  for (const entry of source.weight ?? []) {
    if (entry?.date && Number.isFinite(entry.weight)) weightByDate.set(entry.date, entry.weight);
    if (entry?.date) days.add(entry.date);
  }

  const ordered = [...days].sort();
  const build = (pick: (date: string) => number | null): DailyPoint[] =>
    ordered.map((date) => ({ date, value: pick(date) }));

  // A day the watch recorded but no activity was logged is a genuine zero for
  // volume metrics; a day with no record at all stays unknown.
  const known = (date: string) => stepsByDate.has(date) || activityByDate.has(date);
  const volume = (date: string, read: (b: Bucket) => number) => {
    const bucket = activityByDate.get(date);
    if (bucket) return read(bucket);
    return known(date) ? 0 : null;
  };

  return {
    steps: build((date) => stepsByDate.get(date) ?? null),
    trainingMinutes: build((date) => volume(date, (b) => b.minutes)),
    exerciseDistance: build((date) => volume(date, (b) => b.metres / 1000)),
    exerciseCalories: build((date) => volume(date, (b) => b.calories)),
    elevation: build((date) => volume(date, (b) => b.elevation)),
    activityHr: build((date) => {
      const bucket = activityByDate.get(date);
      return bucket && bucket.hrDuration > 0 ? bucket.hrWeighted / bucket.hrDuration : null;
    }),
    weight: build((date) => weightByDate.get(date) ?? null),
  };
}

export interface MetricSummary {
  definition: MetricDefinition;
  series: DailyPoint[];
  /** Observations with a real value, oldest first. */
  recorded: Array<{ date: string; value: number }>;
  latest: { date: string; value: number } | null;
  percentile: number | null;
  typical: TypicalRange | null;
  forecast: Forecast;
  momentum: Momentum | null;
  /** Percent change of the latest value against the prior week's mean. */
  delta: number | null;
  available: boolean;
}

export function summariseMetric(key: MetricKey, series: DailyPoint[], goal: number | null = null): MetricSummary {
  const definition = METRICS[key];

  const recorded = series
    .filter((p): p is { date: string; value: number } => {
      if (p.value === null || p.value === undefined || !Number.isFinite(p.value)) return false;
      return definition.treatZeroAsMissing ? p.value > 0 : true;
    })
    .map((p) => ({ date: p.date, value: p.value }));

  const values = recorded.map((p) => p.value);
  const latest = recorded.length > 0 ? recorded[recorded.length - 1] : null;

  // Compare against the week before the latest reading, excluding it.
  const priorWeek = values.slice(-8, -1);
  const baseline = priorWeek.length >= 3 ? priorWeek.reduce((a, b) => a + b, 0) / priorWeek.length : null;

  return {
    definition,
    series,
    recorded,
    latest,
    percentile: latest ? percentileOf(latest.value, values) : null,
    typical: typicalRange(values),
    // The forecast expects zero to mean "not worn"; volume metrics say
    // otherwise, so they opt out of that filter by never being zero-missing.
    forecast: forecastDaily(
      definition.treatZeroAsMissing ? series : series.map((p) => ({ ...p, value: p.value === 0 ? 0.0001 : p.value })),
      7,
    ),
    momentum: goal ? momentum(series.map((p) => ({ date: p.date, value: p.value, goal }))) : null,
    delta: latest && baseline && baseline > 0 ? ((latest.value - baseline) / baseline) * 100 : null,
    available: recorded.length > 0,
  };
}
