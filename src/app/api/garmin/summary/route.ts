import { NextResponse } from "next/server";
import { handleError, isoDate, persistRefresh, requireSession } from "@/lib/api";
import { getActivities, getDailySummary, getProfile, getSleep, getStepsRange } from "@/lib/garmin/endpoints";
import type { ConnectResponse } from "@/lib/garmin/client";

const HISTORY_DAYS = 28;

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
    const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days") ?? HISTORY_DAYS), 7), 90);
    const today = isoDate();

    const [daily, sleep, steps, activities] = await Promise.allSettled([
      getDailySummary(session.tokens, session.displayName, today),
      getSleep(session.tokens, session.displayName, today),
      getStepsRange(session.tokens, isoDate(-(days - 1)), today),
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

    return NextResponse.json({
      profile,
      daily: take(daily, "daily", "Today's summary", null),
      sleep: take(sleep, "sleep", "Sleep", null),
      steps: take(steps, "steps", "Step history", []),
      activities: take(activities, "activities", "Activities", []),
      issues,
    });
  } catch (error) {
    return handleError(error);
  }
}
