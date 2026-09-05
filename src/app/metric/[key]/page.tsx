import { notFound } from "next/navigation";
import { MetricDetail } from "@/components/MetricDetail";
import { METRIC_ORDER, type MetricKey } from "@/lib/metrics";

/** A static export has no server to render unknown keys on demand. */
export function generateStaticParams() {
  return METRIC_ORDER.map((key) => ({ key }));
}

export default async function MetricPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!METRIC_ORDER.includes(key as MetricKey)) notFound();
  return <MetricDetail metricKey={key as MetricKey} />;
}
