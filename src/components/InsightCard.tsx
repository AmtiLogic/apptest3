import type { Insight } from "@/lib/insights";

const ARROWS: Record<Insight["tone"], string> = {
  up: "M3 9.5 7 5.5l2.5 2.5L13 4.5",
  down: "M3 4.5 7 8.5l2.5-2.5L13 9.5",
  flat: "M3 7h10",
  neutral: "M3 7h10",
};

/**
 * The headline reading. The arrow carries direction alongside the wording, so
 * the meaning never rests on colour alone.
 */
export function InsightCard({ insight, label }: { insight: Insight; label: string }) {
  return (
    <section className={`card insight tone-${insight.tone}`}>
      <div className="insight-label">{label}</div>
      <div className="insight-head">
        <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden>
          <path d={ARROWS[insight.tone]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2>{insight.headline}</h2>
      </div>
      <p className="insight-detail">{insight.detail}</p>
    </section>
  );
}
