import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Authenticated encryption for cookie payloads (AES-256-GCM).
 *
 * The app holds its session in the cookie itself rather than in server memory,
 * so it works on hosts that run several instances or discard state between
 * requests -- which is every free serverless host.
 */

const KEY_INFO = "garmin-dashboard-session-v1";

function secret(): string {
  const value = process.env.APP_SECRET;
  if (value && value.length >= 16) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_SECRET must be set (32+ random characters) so sessions survive across server instances. " +
        "Generate one with: openssl rand -base64 32",
    );
  }
  // Development convenience: a stable per-process key, so restarting the dev
  // server simply signs you out instead of erroring.
  return (devSecret ??= randomBytes(32).toString("base64"));
}

let devSecret: string | undefined;

function key(): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret()), Buffer.alloc(0), Buffer.from(KEY_INFO), 32));
}

export function seal(payload: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    // Tampered, truncated, or sealed with a previous APP_SECRET.
    return null;
  }
}
