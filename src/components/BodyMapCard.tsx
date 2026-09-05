import { coverageSentence, type BodyCoverage } from "@/lib/bodyMap";

/**
 * Which parts of you are getting trained, inferred from activity types.
 *
 * The caveat is stated in the card because it matters: Garmin records what you
 * did, not which muscles worked.
 */
export function BodyMapCard({ coverage }: { coverage: BodyCoverage }) {
  const max = Math.max(...coverage.regions.map((r) => r.share), 1);

  return (
    <section className="card">
      <h2>Body coverage</h2>
      <p className="sub">{coverageSentence(coverage)}</p>

      {coverage.status === "ok" ? (
        <div className="regions">
          {coverage.regions.map((region) => (
            <div className="region" key={region.region}>
              <span className="region-label">{region.label}</span>
              <span className="region-bar">
                <span
                  className={coverage.neglected.includes(region.region) ? "region-fill low" : "region-fill"}
                  style={{ width: `${Math.max((region.share / max) * 100, 2)}%` }}
                />
              </span>
              <span className="region-value">
                {Math.round(region.share)}%
                <span className="region-sub">
                  {region.daysSince === null
                    ? "not in window"
                    : region.daysSince === 0
                      ? "today"
                      : `${region.daysSince}d ago`}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>
        Inferred from what each activity type mainly demands — Garmin records the
        activity, not the muscles.
        {coverage.unclassifiedMinutes > 0
          ? ` ${Math.round(coverage.unclassifiedMinutes)} min of unrecognised activity types are excluded.`
          : ""}
      </p>
    </section>
  );
}
