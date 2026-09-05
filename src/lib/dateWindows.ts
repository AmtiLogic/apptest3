import { fromDayNumber, toDayNumber } from "./forecast";

/**
 * Garmin's step-history endpoint rejects long ranges with HTTP 400. Requests
 * are split into windows it accepts and the results concatenated.
 */
export const MAX_STEP_WINDOW_DAYS = 28;

export interface DateWindow {
  start: string;
  end: string;
}

/**
 * Splits an inclusive date range into consecutive windows of at most
 * `maxDays` days each. Windows are returned oldest first.
 */
export function splitRange(start: string, end: string, maxDays = MAX_STEP_WINDOW_DAYS): DateWindow[] {
  const first = toDayNumber(start);
  const last = toDayNumber(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return [];
  if (maxDays < 1) throw new Error("maxDays must be at least 1");

  const windows: DateWindow[] = [];
  for (let cursor = first; cursor <= last; cursor += maxDays) {
    windows.push({
      start: fromDayNumber(cursor),
      end: fromDayNumber(Math.min(cursor + maxDays - 1, last)),
    });
  }
  return windows;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Accepts the calendar date the browser reports, so "today" is the user's day
 * rather than the server's.
 *
 * A server in UTC serving a user at UTC-7 is on tomorrow's date all evening,
 * and Garmin answers with an empty day. Timezone offsets span UTC-12..UTC+14,
 * so a genuine local date is never more than one day from the server's; anything
 * further is rejected rather than trusted.
 */
export function resolveToday(clientDate: string | null, serverDate: string): string {
  if (!clientDate || !DATE_PATTERN.test(clientDate)) return serverDate;

  const client = toDayNumber(clientDate);
  const server = toDayNumber(serverDate);
  if (!Number.isFinite(client)) return serverDate;

  return Math.abs(client - server) <= 1 ? clientDate : serverDate;
}

/** The browser's own calendar date, formatted without a timezone round-trip. */
export function localDate(now = new Date()): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Merges day-keyed rows from several windows into one ordered series.
 *
 * Windows are contiguous rather than overlapping, but Garmin has been known to
 * return a boundary day in both, so later rows win and dates stay unique.
 */
export function mergeByDate<T extends { calendarDate: string }>(chunks: T[][]): T[] {
  const byDate = new Map<string, T>();
  for (const chunk of chunks) {
    for (const row of chunk ?? []) {
      if (row?.calendarDate) byDate.set(row.calendarDate, row);
    }
  }
  return [...byDate.values()].sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));
}
