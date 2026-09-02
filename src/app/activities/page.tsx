"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

      {error ? <div className="notice error">{error}</div> : null}

      <div className="card">
        {activities.length === 0 && !loading ? (
          <p className="empty">No activities found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>When</th>
                <th>Distance</th>
                <th>Time</th>
                <th>Avg HR</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.activityId}>
                  <td className="name">
                    <Link href={`/activities/${activity.activityId}`}>
                      {activity.activityName || formatActivityType(activity.activityType?.typeKey)}
                    </Link>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {formatActivityType(activity.activityType?.typeKey)}
                    </div>
                  </td>
                  <td>{formatDateTime(activity.startTimeLocal)}</td>
                  <td>{formatDistance(activity.distance)}</td>
                  <td>{formatDuration(activity.duration)}</td>
                  <td>{activity.averageHR ? Math.round(activity.averageHR) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
