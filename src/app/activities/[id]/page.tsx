import { ActivityDetail } from "@/components/ActivityDetail";
import { DEMO_ACTIVITY_IDS } from "@/lib/garmin/mock";

/**
 * A static export has no server to render unknown ids on demand, so the sample
 * activities are listed here. The Node build ignores this and renders any id.
 */
export function generateStaticParams() {
  return process.env.STATIC_EXPORT === "1" ? DEMO_ACTIVITY_IDS.map((id) => ({ id })) : [];
}

export default function ActivityPage() {
  return <ActivityDetail />;
}
