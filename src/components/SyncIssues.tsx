import Link from "next/link";
import type { SourceIssue } from "@/lib/useDashboard";

/**
 * Names the sections that failed and why.
 *
 * These calls hit Garmin's private endpoints, which are undocumented and change
 * without notice, so "this section is empty" has to be distinguishable from
 * "this section failed to load".
 */
export function SyncIssues({ error, issues }: { error: string | null; issues: SourceIssue[] }) {
  if (!error && issues.length === 0) return null;

  return (
    <div className="notice error issues">
      <strong>{error ?? `${issues.length} of 5 sections did not load.`}</strong>

      {issues.length > 0 ? (
        <ul>
          {issues.map((issue) => (
            <li key={issue.source}>
              <span className="issue-label">{issue.label}</span>
              <span className="issue-message">{issue.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p>
        <Link href="/diagnostics">Run diagnostics</Link> to see which Garmin call is
        failing and what it returned.
      </p>
    </div>
  );
}
