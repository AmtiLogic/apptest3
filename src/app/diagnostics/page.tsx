"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { localDate } from "@/lib/dateWindows";
import { apiGet } from "@/lib/fetcher";
import type { DiagnosticReport } from "@/lib/diagnostics";
import { IS_STATIC_DEMO } from "@/lib/staticDemo";

/** A plain-text version, so the whole report can be pasted into a bug report. */
function asText(report: DiagnosticReport): string {
  const lines = [
    `Garmin Dashboard diagnostics`,
    `checked: ${report.checkedAt}`,
    `domain:  ${report.domain}`,
    "",
    ...report.checks.map((c) =>
      [
        `${c.ok ? "OK  " : c.optional ? "N/A " : "FAIL"} ${c.name} (${c.ms}ms)`,
        `     ${c.path}`,
        c.upstreamStatus ? `     HTTP ${c.upstreamStatus}` : "",
        c.error ? `     ${c.error}` : "",
        c.shape ? `     returned ${c.shape}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ];
  return lines.join("\n");
}

export default function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      setReport(await apiGet<DiagnosticReport>(`/api/diagnostics?date=${localDate()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run diagnostics");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    if (!IS_STATIC_DEMO) void run();
  }, [run]);

  async function copy() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(asText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the text below instead.");
    }
  }

  return (
    <main className="shell">
      <TopBar title="Diagnostics" />

      <section className="card">
        <h2>What this checks</h2>
        <p className="sub" style={{ marginBottom: 0 }}>
          Every Garmin endpoint the app depends on, one at a time, with the status
          each returned. If a section of the dashboard is empty, the failing call
          is named here.
        </p>
      </section>

      {IS_STATIC_DEMO ? (
        <div className="notice banner" style={{ marginTop: 16 }}>
          This is the sample-data build — there are no Garmin calls to check.
        </div>
      ) : null}

      {error ? <div className="notice error" style={{ marginTop: 16 }}>{error}</div> : null}

      {report ? (
        <>
          <div className="rows card" style={{ marginTop: 16 }}>
            {report.checks.map((check) => (
              <div className="check" key={check.path}>
                <span className={`pill ${check.ok ? "ok" : check.optional ? "" : "bad"}`}>
                  {check.ok ? "OK" : check.optional ? "N/A" : "FAIL"}
                </span>
                <div className="check-body">
                  <div className="check-name">
                    {check.name} <span className="muted">· {check.ms} ms</span>
                  </div>
                  <code>{check.path}</code>
                  {check.error ? <div className="check-error">{check.error}</div> : null}
                  {check.shape ? <div className="muted">returned {check.shape}</div> : null}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void run()} disabled={running}>
              {running ? "Running…" : "Run again"}
            </button>
            <button type="button" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy report"}
            </button>
          </div>

          <details style={{ marginTop: 14 }}>
            <summary className="muted">Show as text</summary>
            <pre className="report">{asText(report)}</pre>
          </details>
        </>
      ) : running ? (
        <p className="empty">Running checks…</p>
      ) : null}
    </main>
  );
}
