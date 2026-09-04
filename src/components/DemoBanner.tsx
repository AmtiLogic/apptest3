import Link from "next/link";
import { IS_STATIC_DEMO } from "@/lib/staticDemo";

/**
 * Shown only in the GitHub Pages bundle, so nobody mistakes the fixtures for
 * their own Garmin data.
 */
export function DemoBanner() {
  if (!IS_STATIC_DEMO) return null;

  return (
    <div className="notice banner">
      <strong>Sample data.</strong> GitHub Pages serves files only — it cannot run
      the server that signs in to Garmin. <Link href="/setup/">How to connect your own data →</Link>
    </div>
  );
}
