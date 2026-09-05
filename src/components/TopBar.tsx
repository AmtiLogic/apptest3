"use client";

import { SyncButton } from "@/components/SyncButton";
import { IS_STATIC_DEMO } from "@/lib/staticDemo";

/**
 * Title, whose data it is, and the sync control. Navigation lives in the tab
 * bar, so the header stays one line on a phone.
 */
export function TopBar({
  title,
  who,
  onSync,
  syncing = false,
  syncedAt = null,
}: {
  title: string;
  who?: string | null;
  onSync?: () => void;
  syncing?: boolean;
  syncedAt?: Date | null;
}) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        {who ? <div className="who">{who}</div> : null}
      </div>
      {onSync && !IS_STATIC_DEMO ? (
        <SyncButton syncing={syncing} syncedAt={syncedAt} onSync={onSync} />
      ) : null}
    </header>
  );
}
