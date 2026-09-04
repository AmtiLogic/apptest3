"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/useDashboard";

/**
 * Refresh control with the time of the last successful sync. The label is
 * recomputed on a timer so "just now" does not go stale while the page sits open.
 */
export function SyncButton({
  syncing,
  syncedAt,
  onSync,
}: {
  syncing: boolean;
  syncedAt: Date | null;
  onSync: () => void;
}) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <button type="button" className="sync" onClick={onSync} disabled={syncing} aria-label="Sync with Garmin">
      <svg width="15" height="15" viewBox="0 0 16 16" className={syncing ? "spin" : undefined} aria-hidden>
        <path
          d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path d="M13.7 1.8v3.1h-3.1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{syncing ? "Syncing…" : syncedAt ? relativeTime(syncedAt) : "Sync"}</span>
    </button>
  );
}
