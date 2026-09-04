/**
 * Forecasting for daily health series.
 *
 * The model is a linear trend plus an additive day-of-week effect, fitted by
 * classical decomposition: fit a trend, take the mean residual per weekday as
 * the weekday effect, then refit the trend on the deseasonalised series. Step
 * counts depend heavily on which day it is, so a plain straight line through
 * the raw numbers reads the weekly rhythm as noise and forecasts badly.
 *
 * Everything here is deliberately conservative: too little history returns
 * "insufficient" rather than a confident-looking line through three points.
 */

const DAY_MS = 86_400_000;

export interface DailyPoint {
  date: string;
  value: number | null;
}

export interface Prediction {
  date: string;
  value: number;
  /** Approximate 95% prediction interval. */
  lower: number;
  upper: number;
  isForecast: true;
}

export interface LineFit {
  slopePerDay: number;
  intercept: number;
  /** Share of variance explained, 0-1. */
  r2: number;
  /** Residual standard deviation, in the series' own units. */
  residualSd: number;
  n: number;
}

export interface Forecast {
  status: "ok" | "insufficient";
  /** Why a forecast could not be made. */
  reason?: string;
  fit?: LineFit;
  /** Mean offset per weekday (0 = Sunday), or null when history is too short. */
  weekdayEffects?: number[] | null;
  predictions: Prediction[];
  /** Modelled level today, and the change per week implied by the trend. */
  currentLevel?: number;
  changePerWeek?: number;
  changePerWeekPct?: number;
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Days since the Unix epoch, so gaps in the series stay real gaps. */
export function toDayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

export function fromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Ordinary least squares through (x, y). */
export function fitLine(xs: number[], ys: number[], parameters = 2): LineFit {
  const n = xs.length;
  if (n === 0) return { slopePerDay: 0, intercept: 0, r2: 0, residualSd: 0, n: 0 };

  const mx = mean(xs);
  const my = mean(ys);

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }

  const slopePerDay = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slopePerDay * mx;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    ssRes += (ys[i] - (intercept + slopePerDay * xs[i])) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }

  // Degrees of freedom account for every fitted parameter, weekday effects included.
  const df = Math.max(n - parameters, 1);
  return {
    slopePerDay,
    intercept,
    r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot,
    residualSd: Math.sqrt(ssRes / df),
    n,
  };
}

/**
 * A zero-valued day almost always means the watch was not worn rather than a
 * genuinely motionless day, and including those craters the trend.
 */
function usablePoints(series: DailyPoint[]): Array<{ day: number; value: number; date: string }> {
  return series
    .filter((p): p is { date: string; value: number } => p.value !== null && p.value > 0)
    .map((p) => ({ day: toDayNumber(p.date), value: p.value, date: p.date }))
    .filter((p) => Number.isFinite(p.day))
    .sort((a, b) => a.day - b.day);
}

const MIN_FOR_TREND = 7;
/** Slope, intercept, and six free weekday effects (the seventh is implied). */
const PARAMETERS_WITH_WEEKDAY = 8;
const MIN_FOR_WEEKDAY = 14;

/**
 * Fits the model and projects `horizon` days past the last observation.
 *
 * `floorAtZero` keeps counts from being predicted negative.
 */
export function forecastDaily(
  series: DailyPoint[],
  horizon = 7,
  { floorAtZero = true }: { floorAtZero?: boolean } = {},
): Forecast {
  const points = usablePoints(series);

  if (points.length < MIN_FOR_TREND) {
    return {
      status: "insufficient",
      reason: `Needs ${MIN_FOR_TREND} days of data; have ${points.length}.`,
      predictions: [],
    };
  }

  const xs = points.map((p) => p.day);
  const ys = points.map((p) => p.value);
  const weekdays = xs.map(weekdayOf);

  let weekdayEffects: number[] | null = null;
  let fit = fitLine(xs, ys);

  if (points.length >= MIN_FOR_WEEKDAY) {
    // Each weekday sits at a different average position in the window, so the
    // trend and the weekday term stay correlated. A single pass leaves that
    // bias in the slope; backfitting to convergence reaches the joint
    // least-squares solution.
    let effects = new Array(7).fill(0) as number[];

    for (let iteration = 0; iteration < 100; iteration += 1) {
      const deseasonalised = ys.map((y, i) => y - effects[weekdays[i]]);
      const trend = fitLine(xs, deseasonalised, PARAMETERS_WITH_WEEKDAY);

      const byWeekday: number[][] = Array.from({ length: 7 }, () => []);
      for (let i = 0; i < ys.length; i += 1) {
        byWeekday[weekdays[i]].push(ys[i] - (trend.intercept + trend.slopePerDay * xs[i]));
      }

      const raw = byWeekday.map((residuals) => (residuals.length > 0 ? mean(residuals) : 0));
      // Centre the effects so they change shape, not level.
      const centre = mean(raw);
      const next = raw.map((e) => e - centre);

      const settled =
        Math.abs(trend.slopePerDay - fit.slopePerDay) < 1e-12 &&
        next.every((e, w) => Math.abs(e - effects[w]) < 1e-12);

      fit = trend;
      effects = next;
      if (settled) break;
    }

    weekdayEffects = effects;

    // Report fit quality against the raw series, not the deseasonalised one.
    fit = { ...fit, ...goodnessOfFit(xs, ys, weekdays, fit, effects, PARAMETERS_WITH_WEEKDAY) };
  }

  const lastDay = xs[xs.length - 1];
  const level = (day: number) =>
    fit.intercept + fit.slopePerDay * day + (weekdayEffects ? weekdayEffects[weekdayOf(day)] : 0);

  // Normal approximation; with this little history it is indicative, not exact.
  const margin = 1.96 * fit.residualSd;

  const predictions: Prediction[] = [];
  for (let i = 1; i <= horizon; i += 1) {
    const day = lastDay + i;
    const value = level(day);
    predictions.push({
      date: fromDayNumber(day),
      value: floorAtZero ? Math.max(0, value) : value,
      lower: floorAtZero ? Math.max(0, value - margin) : value - margin,
      upper: value + margin,
      isForecast: true,
    });
  }

  // Trend level ignores the weekday term, which nets out over a full week.
  const trendToday = fit.intercept + fit.slopePerDay * lastDay;
  const changePerWeek = fit.slopePerDay * 7;

  return {
    status: "ok",
    fit,
    weekdayEffects,
    predictions,
    currentLevel: trendToday,
    changePerWeek,
    changePerWeekPct: trendToday > 0 ? (changePerWeek / trendToday) * 100 : 0,
  };
}

/** Variance explained and residual spread of the full model on the raw series. */
function goodnessOfFit(
  xs: number[],
  ys: number[],
  weekdays: number[],
  fit: LineFit,
  effects: number[],
  parameters: number,
): Pick<LineFit, "r2" | "residualSd"> {
  const my = mean(ys);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < ys.length; i += 1) {
    const predicted = fit.intercept + fit.slopePerDay * xs[i] + effects[weekdays[i]];
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  return {
    r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot,
    residualSd: Math.sqrt(ssRes / Math.max(ys.length - parameters, 1)),
  };
}

/** 0 = Sunday. 1970-01-01 (day 0) was a Thursday. */
export function weekdayOf(dayNumber: number): number {
  return (((dayNumber + 4) % 7) + 7) % 7;
}

export interface GoalOutlook {
  /** Predicted days out of the horizon that clear the goal. */
  daysMeetingGoal: number;
  horizon: number;
  /** Fraction of history that cleared the goal, for comparison. */
  recentHitRate: number;
}

export function goalOutlook(
  series: DailyPoint[],
  forecast: Forecast,
  goal: number | null,
): GoalOutlook | null {
  if (!goal || goal <= 0 || forecast.status !== "ok") return null;

  const history = usablePoints(series);
  const recentHits = history.filter((p) => p.value >= goal).length;

  return {
    daysMeetingGoal: forecast.predictions.filter((p) => p.value >= goal).length,
    horizon: forecast.predictions.length,
    recentHitRate: history.length === 0 ? 0 : recentHits / history.length,
  };
}
