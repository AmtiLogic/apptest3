import type { RelationshipReport } from "@/lib/relationships";

/**
 * Personal relationships, stated only when they survive a permutation test and
 * a multiple-comparison correction. The sample size is shown because a reader
 * deserves to know how much to trust each line.
 */
export function Findings({ report }: { report: RelationshipReport }) {
  if (report.status === "collecting") {
    return (
      <section className="card">
        <h2>What moves your numbers</h2>
        <p className="sub" style={{ marginBottom: 0 }}>
          Learning your patterns — about {report.daysNeeded} more days of data and
          this starts reporting what actually predicts your good days.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>What moves your numbers</h2>
      <p className="sub">
        Found in your own history — {report.tested} relationship
        {report.tested === 1 ? "" : "s"} tested.
      </p>

      {report.findings.length === 0 ? (
        <p className="empty" style={{ padding: 0 }}>
          Nothing stands out yet. Your metrics are moving independently of each
          other, which is a real answer — not a missing one.
        </p>
      ) : (
        report.findings.slice(0, 3).map((finding) => (
          <div className="finding" key={finding.id}>
            <div className="finding-headline">{finding.headline}</div>
            <p className="finding-detail">{finding.detail}</p>
            <div className="finding-meta">
              {finding.samples} days · p = {finding.p < 0.001 ? "<0.001" : finding.p.toFixed(3)}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
