import { NextResponse } from "next/server";
import { handleError, isoDate, requireSession } from "@/lib/api";
import { connectGet } from "@/lib/garmin/client";
import { PATHS } from "@/lib/garmin/endpoints";
import { GarminError } from "@/lib/garmin/types";
import type { DiagnosticCheck } from "@/lib/diagnostics";
import { resolveToday } from "@/lib/dateWindows";

/** A one-line description of what came back, without including any of the data. */
function describe(value: unknown): string {
  if (value === null || value === undefined) return "empty response";
  if (Array.isArray(value)) return `array of ${value.length}`;
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    return `object with ${keys.length} keys: ${keys.slice(0, 6).join(", ")}${keys.length > 6 ? ", …" : ""}`;
  }
  return typeof value;
}

/**
 * Probes each Garmin endpoint the app depends on and reports what happened.
 *
 * These paths are Garmin's private ones and are not documented anywhere, so
 * when a section comes back empty this is how to find out which call is at
 * fault and what it actually returned.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const today = resolveToday(new URL(request.url).searchParams.get("date"), isoDate());

    const probes: Array<{ name: string; path: string; params?: Record<string, string | number> }> = [
      { name: "Profile", path: PATHS.profile() },
      { name: "Today's summary", path: PATHS.daily(session.displayName), params: { calendarDate: today } },
      { name: "Sleep", path: PATHS.sleep(session.displayName), params: { date: today, nonSleepBufferMinutes: 60 } },
      { name: "Step history", path: PATHS.steps(isoDate(-27, today), today) },
      { name: "Activities", path: PATHS.activities(), params: { start: 0, limit: 3 } },
    ];

    const checks: DiagnosticCheck[] = [];
    for (const probe of probes) {
      const started = Date.now();
      try {
        const { data } = await connectGet<unknown>(session.tokens, probe.path, probe.params);
        checks.push({
          name: probe.name,
          path: probe.path,
          ok: true,
          ms: Date.now() - started,
          shape: describe(data),
        });
      } catch (error) {
        checks.push({
          name: probe.name,
          path: probe.path,
          ok: false,
          ms: Date.now() - started,
          upstreamStatus: error instanceof GarminError ? error.upstreamStatus : undefined,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      displayName: session.displayName,
      domain: session.tokens.oauth1.domain,
      checks,
    });
  } catch (error) {
    return handleError(error);
  }
}
