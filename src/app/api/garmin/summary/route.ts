import { NextResponse } from "next/server";
import { handleError, isoDate, persistRefresh, requireSession } from "@/lib/api";
import { getActivities, getDailySummary, getProfile, getSleep, getStepsRangeChunked } from "@/lib/garmin/endpoints";
import type { ConnectResponse } from "@/lib/garmin/client";
import { checkShape, EXPECTED } from "@/lib/shapeCheck";
import { resolveToday } from "@/lib/dateWindows";

const HISTORY_DAYS = 90;

/**
 * Everything the dashboard needs, in one request.
 *
 * Fetching the five sections separately meant five round trips from the phone
 * and, on a cold instance, five simultaneous token exchanges with Garmin --
 * which is both slow and a good way to get rate-limited. Here the session is
 * resolved once and the calls share it.
 *
 * A section that fails is reported in `issues` rather than failing the whole
 * response: a missing night of sleep should not cost you the rest of the page.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const params = new URL(request.url).searchParams;
    const days = Math.min(Math.max(Number(params.get("days") ?? HISTORY_DAYS), 7), 90);

    // The browser's calendar date, not the server's: a UTC server is a day ahead
    // of a user in the Americas all evening, and Garmin answers with an empty day.
    const today = resolveToday(params.get("date"), isoDate());
    const rangeStart = isoDate(-(days - 1), today);

    const [daily, sleep, steps, activities] = await Promise.allSettled([
      getDailySummary(session.tokens, session.displayName, today),
      getSleep(session.tokens, session.displayName, today),
      getStepsRangeChunked(session.tokens, rangeStart, today),
      getActivities(session.tokens, 0, 60),
    ]);

    const issues: Array<{ source: string; label: string; message: string }> = [];

    const take = <T,>(result: PromiseSettledResult<ConnectResponse<T>>, source: string, label: string, fallback: T): T => {
      if (result.status === "fulfilled") {
        persistRefresh(result.value.tokens);
        return result.value.data;
      }
      issues.push({
        source,
        label,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      return fallback;
    };

    // The profile is already resolved by requireSession; re-reading it here
    // would be a sixth call for data we hold.
    const { data: profile, tokens } = await getProfile(session.tokens);
    persistRefresh(tokens);

    const dailyData = take(daily, "daily", "Today's summary", null);
    const sleepData = take(sleep, "sleep", "Sleep", null);
    // Chunked: partial windows still yield data, and any that failed are named.
    const stepsResult = steps.status === "fulfilled" ? steps.value : null;
    const stepsData = take(steps, "steps", "Step history", []);
    if (stepsResult && stepsResult.failures.length > 0) {
      issues.push({
        source: "steps",
        label: "Step history",
        message: `${stepsResult.failures.length} of ${stepsResult.failures.length + 1} history windows failed: ${stepsResult.failures[0]}`,
      });
    }
    const activitiesData = take(activities, "activities", "Activities", []);

    // A 200 with an unfamiliar shape is not a success. Without this the tiles
    // just render dashes and nothing says why.
    if (daily.status === "fulfilled") {
      const verdict = checkShape(dailyData, EXPECTED.daily);
      if (!verdict.ok) issues.push({ source: "daily", label: "Today's summary", message: verdict.message! });
    }
    if (sleep.status === "fulfilled") {
      const verdict = checkShape(sleepData, EXPECTED.sleep);
      if (!verdict.ok) issues.push({ source: "sleep", label: "Sleep", message: verdict.message! });
    }

    return NextResponse.json({
      profile,
      daily: dailyData,
      sleep: sleepData,
      steps: stepsData,
      activities: activitiesData,
      issues,
    });
  } catch (error) {
    return handleError(error);
  }
}
