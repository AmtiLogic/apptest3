import type { WeightEntry } from "./metrics";

/**
 * Normalises Garmin's weight responses.
 *
 * The weight endpoints are undocumented and have appeared in several shapes
 * over the years, so this accepts the plausible ones rather than betting on
 * one. Garmin stores weight in grams; a value that looks like grams is
 * converted, and anything outside a believable human range is discarded rather
 * than charted.
 */

const MIN_KG = 20;
const MAX_KG = 400;

function toKilograms(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  // Grams if it is far too large to be kilograms.
  const kg = value > 1000 ? value / 1000 : value;
  return kg >= MIN_KG && kg <= MAX_KG ? kg : null;
}

function toDate(value: unknown): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  // Epoch milliseconds, which some of these endpoints return.
  if (typeof value === "number" && value > 1e11) return new Date(value).toISOString().slice(0, 10);
  return null;
}

const DATE_KEYS = ["calendarDate", "date", "summaryDate", "timestampGMT", "timestamp", "weightDate"];
const WEIGHT_KEYS = ["weight", "weightKg", "value", "averageWeight"];

/**
 * Reads whichever parts are present. The date and the weight are pulled
 * separately so an outer row carrying the date can be combined with a nested
 * row carrying the reading -- neither half is usable alone.
 */
function readParts(row: unknown): { date: string | null; weight: number | null } {
  if (!row || typeof row !== "object") return { date: null, weight: null };
  const record = row as Record<string, unknown>;

  let date: string | null = null;
  for (const key of DATE_KEYS) {
    date = toDate(record[key]);
    if (date) break;
  }

  let weight: number | null = null;
  for (const key of WEIGHT_KEYS) {
    weight = toKilograms(record[key]);
    if (weight !== null) break;
  }

  if ((date === null || weight === null) && Array.isArray(record.allWeightMetrics)) {
    const nested = readParts(record.allWeightMetrics[0]);
    date = date ?? nested.date;
    weight = weight ?? nested.weight;
  }

  return { date, weight };
}

function readRow(row: unknown): WeightEntry | null {
  const { date, weight } = readParts(row);
  return date !== null && weight !== null ? { date, weight } : null;
}

export function normaliseWeight(raw: unknown): WeightEntry[] {
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? ((raw as Record<string, unknown>).dailyWeightSummaries as unknown[]) ??
        ((raw as Record<string, unknown>).dateWeightList as unknown[]) ??
        ((raw as Record<string, unknown>).weightList as unknown[]) ??
        []
      : [];

  const byDate = new Map<string, WeightEntry>();
  for (const row of rows) {
    const entry = readRow(row);
    // Later rows win, so the most recent reading for a day is the one kept.
    if (entry) byDate.set(entry.date, entry);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
