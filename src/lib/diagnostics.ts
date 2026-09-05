/**
 * Shared shape for the endpoint probe.
 *
 * It lives here rather than beside the route because the static Pages build
 * strips `src/app/api`, and the diagnostics page still has to typecheck.
 */
export interface DiagnosticCheck {
  name: string;
  path: string;
  ok: boolean;
  /** HTTP status Garmin returned, when the call reached it. */
  upstreamStatus?: number;
  ms: number;
  error?: string;
  /** Shape of a successful response, to spot an endpoint returning the wrong thing. */
  shape?: string;
}

export interface DiagnosticReport {
  checkedAt: string;
  displayName: string;
  domain: string;
  checks: DiagnosticCheck[];
}
