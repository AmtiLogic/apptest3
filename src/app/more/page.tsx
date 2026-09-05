"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { IS_STATIC_DEMO } from "@/lib/staticDemo";

export default function MorePage() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="shell">
      <TopBar title="More" />

      <section className="card">
        <div className="metrics">
          <Link className="metric link" href="/diagnostics">
            <span className="metric-label">Diagnostics</span>
            <span className="metric-value">Check Garmin endpoints →</span>
          </Link>
          <Link className="metric link" href="/setup">
            <span className="metric-label">Setup</span>
            <span className="metric-value">How this connects →</span>
          </Link>
        </div>
      </section>

      {IS_STATIC_DEMO ? (
        <div className="notice banner" style={{ marginTop: 16 }}>
          Sample data — this build has no Garmin connection.
        </div>
      ) : (
        <button type="button" onClick={signOut} style={{ marginTop: 16 }}>
          Sign out
        </button>
      )}

      <p className="sub" style={{ marginTop: 20 }}>
        Reads your Garmin Connect account the way the mobile app does. Personal
        use only — see Setup for what that means.
      </p>
    </main>
  );
}
