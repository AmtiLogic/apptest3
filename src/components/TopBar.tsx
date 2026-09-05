"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SyncButton } from "@/components/SyncButton";
import { IS_STATIC_DEMO } from "@/lib/staticDemo";

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
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        {who ? <div className="who">{who}</div> : null}
      </div>
      <nav className="nav">
        <Link className="button" href="/">
          Today
        </Link>
        <Link className="button" href="/activities">
          Activities
        </Link>
        {onSync && !IS_STATIC_DEMO ? (
          <SyncButton syncing={syncing} syncedAt={syncedAt} onSync={onSync} />
        ) : null}
        {IS_STATIC_DEMO ? null : (
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        )}
      </nav>
    </header>
  );
}
