"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Tile } from "@/components/Tile";
import { TopBar } from "@/components/TopBar";
import { apiGet } from "@/lib/fetcher";
import { formatActivityType, formatDateTime, formatDuration, formatPace } from "@/lib/format";

/** The activity detail payload is large and loosely typed; pick what is shown. */
interface ActivityDetail {
  activityName?: string | null;
  activityTypeDTO?: { typeKey?: string } | null;
  summaryDTO?: {
    startTimeLocal?: string;
    distance?: number | null;
    duration?: number | null;
    movingDuration?: number | null;
    elevationGain?: number | null;
    averageSpeed?: number | null;
    maxSpeed?: number | null;
    averageHR?: number | null;
    maxHR?: number | null;
    calories?: number | null;
    averageRunCadence?: number | null;
    averagePower?: number | null;
  } | null;
}

export default function ActivityPage() {
  const params = useParams<{ id: string }>();
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    apiGet<ActivityDetail>(`/api/garmin/activities/${params.id}`)
      .then(setActivity)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load activity"));
  }, [params?.id]);

  if (error) {
    return (
      <main className="shell">
        <div className="notice error">{error}</div>
      </main>
    );
  }

  if (!activity) {
    return (
      <main className="shell">
        <p className="empty">Loading activity…</p>
      </main>
    );
  }

  const summary = activity.summaryDTO ?? {};
  const title = activity.activityName || formatActivityType(activity.activityTypeDTO?.typeKey);

  return (
    <main className="shell">
      <TopBar title={title} who={formatDateTime(summary.startTimeLocal)} />

      <div className="grid">
        <Tile
          label="Distance"
          value={summary.distance ? (summary.distance / 1000).toFixed(2) : null}
          unit="km"
        />
        <Tile label="Time" value={formatDuration(summary.duration)} />
        <Tile label="Moving time" value={formatDuration(summary.movingDuration)} />
        <Tile label="Avg pace" value={formatPace(summary.averageSpeed)} />
        <Tile
          label="Avg heart rate"
          value={summary.averageHR ? Math.round(summary.averageHR) : null}
          unit="bpm"
          meta={summary.maxHR ? `Max ${Math.round(summary.maxHR)}` : null}
        />
        <Tile label="Elevation gain" value={summary.elevationGain ?? null} unit="m" />
        <Tile label="Calories" value={summary.calories ?? null} unit="kcal" />
        <Tile
          label="Avg cadence"
          value={summary.averageRunCadence ? Math.round(summary.averageRunCadence) : null}
          unit="spm"
        />
        <Tile
          label="Avg power"
          value={summary.averagePower ? Math.round(summary.averagePower) : null}
          unit="W"
        />
      </div>
    </main>
  );
}
