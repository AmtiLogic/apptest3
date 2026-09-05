import { momentumLabel, type Momentum } from "@/lib/momentum";

/**
 * Consistency without a streak counter. A streak resets to zero on one missed
 * day, which is both a poor description of someone's fitness and a mean thing
 * to show them.
 */
export function MomentumCard({ momentum }: { momentum: Momentum | null }) {
  if (!momentum) return null;

  const score = Math.round(momentum.score);
  const trend = momentum.trend === null ? null : Math.round(momentum.trend);

  return (
    <section className="card">
      <h2>Momentum</h2>
      <div className="momentum">
        <span className="momentum-score">{score}</span>
        <span className="momentum-label">{momentumLabel(momentum.score)}</span>
      </div>

      <div className="momentum-bar">
        <div className="momentum-fill" style={{ width: `${Math.max(score, 2)}%` }} />
      </div>

      <p className="sub" style={{ marginTop: 11, marginBottom: 0 }}>
        Recency-weighted share of days you met your goal
        {trend !== null ? `, ${trend >= 0 ? "up" : "down"} ${Math.abs(trend)} from last week` : ""}.
        {momentum.currentRun >= 3 ? ` ${momentum.currentRun} in a row right now.` : ""} A missed day
        dents this rather than resetting it.
      </p>
    </section>
  );
}
