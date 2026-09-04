/**
 * Reads an environment variable, treating a blank value as unset.
 *
 * Hosts that pre-fill variable names from `.env.example` leave empty strings
 * behind, and `??` does not fall back on those -- an empty GARMIN_DOMAIN would
 * otherwise build URLs like `https://sso./sso/embed`.
 */
export function envOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}
