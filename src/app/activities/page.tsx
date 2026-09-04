"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { TopBar } from "@/components/TopBar";
import type { Activity } from "@/lib/garmin/endpoints";
import { apiGet } from "@/lib/fetcher";
import { formatActivityType, formatDateTime, formatDistance, formatDuration } from "@/lib/format";

const PAGE_SIZE = 25;

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  async function loadMore(start: number) {
    setLoading(true);
    try {
      const page = await apiGet<Activity[]>(`/api/garmin/activities?start=${start}&limit=${PAGE_SIZE}`);
      setActivities((prev) => (start === 0 ? page : [...prev, ...page]));
      if (page.length < PAGE_SIZE) setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMore(0);
  }, []);

  return (
    <main className="shell">
      <TopBar title="Activities" />
      <DemoBanner />

      {error ? <div className="notice error">{error}</div> : null}

      <div className="card">
        {activities.length === 0 && !loading ? (
          <p className="empty">No activities found.</p>
        ) : (
          <div className="rows">
            <div className="row-head" aria-hidden>
              <span>Activity</span>
              <span>When</span>
              <span>Distance</span>
              <span>Time</span>
              <span>Avg HR</span>
            </div>

            {activities.map((activity) => (
              <Link className="row" key={activity.activityId} href={`/activities/${activity.activityId}`}>
                <span className="row-name">
                  {activity.activityName || formatActivityType(activity.activityType?.typeKey)}
                  <span className="row-type">{formatActivityType(activity.activityType?.typeKey)}</span>
                </span>
                <span className="row-when">{formatDateTime(activity.startTimeLocal)}</span>
                <span className="row-stats">
                  <span>
                    <span className="key">Distance </span>
                    {formatDistance(activity.distance)}
                  </span>
                  <span>
                    <span className="key">Time </span>
                    {formatDuration(activity.duration)}
                  </span>
                  <span>
                    <span className="key">Avg HR </span>
                    {activity.averageHR ? Math.round(activity.averageHR) : "—"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          {loading ? (
            <span className="empty">Loading…</span>
          ) : done ? (
            <span className="empty">That&rsquo;s everything.</span>
          ) : (
            <button type="button" onClick={() => void loadMore(activities.length)}>
              Load more
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
