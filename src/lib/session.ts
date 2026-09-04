import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { MFA_COOKIE, SESSION_COOKIE } from "./cookie-names";
import { seal, unseal } from "./crypto-cookie";
import type { MfaChallenge } from "./garmin/sso";
import type { GarminTokens, OAuth1Token, OAuth2Token } from "./garmin/types";

export { MFA_COOKIE, SESSION_COOKIE };

const SESSION_TTL_S = 30 * 24 * 60 * 60;
const MFA_TTL_S = 10 * 60;

/** Browsers cap a cookie near 4KB; stay well under and split what doesn't fit. */
const MAX_COOKIE_VALUE = 3000;

interface SessionPayload {
  oauth1: OAuth1Token;
  displayName?: string;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/**
 * Bearer tokens are large and short-lived, so they stay out of the cookie and
 * live in a per-process cache instead. A cold instance simply misses and mints a
 * fresh one from the OAuth1 token in the cookie -- correctness never depends on
 * this surviving.
 */
const bearerCache = new Map<string, OAuth2Token>();

function cacheKey(oauth1: OAuth1Token): string {
  return createHash("sha256").update(oauth1.oauthToken).digest("base64url");
}

export function cacheBearer(oauth1: OAuth1Token, oauth2: OAuth2Token): void {
  // Bound the map: a personal deployment has one user, but never grow without limit.
  if (bearerCache.size > 32) bearerCache.clear();
  bearerCache.set(cacheKey(oauth1), oauth2);
}

export function cachedBearer(oauth1: OAuth1Token): OAuth2Token | null {
  const token = bearerCache.get(cacheKey(oauth1));
  if (!token) return null;
  if (token.expiresAt - 60_000 <= Date.now()) {
    bearerCache.delete(cacheKey(oauth1));
    return null;
  }
  return token;
}

/** Writes a sealed value across as many numbered cookies as it needs. */
async function writeChunked(name: string, value: string, maxAge: number): Promise<void> {
  const jar = await cookies();
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += MAX_COOKIE_VALUE) {
    chunks.push(value.slice(i, i + MAX_COOKIE_VALUE));
  }

  jar.set(name, String(chunks.length), { ...COOKIE_OPTIONS, maxAge });
  chunks.forEach((chunk, i) => {
    jar.set(`${name}.${i}`, chunk, { ...COOKIE_OPTIONS, maxAge });
  });
}

async function readChunked(name: string): Promise<string | undefined> {
  const jar = await cookies();
  const count = Number(jar.get(name)?.value);
  if (!Number.isInteger(count) || count < 1 || count > 8) return undefined;

  let value = "";
  for (let i = 0; i < count; i += 1) {
    const chunk = jar.get(`${name}.${i}`)?.value;
    if (chunk === undefined) return undefined;
    value += chunk;
  }
  return value;
}

async function clearChunked(name: string): Promise<void> {
  const jar = await cookies();
  jar.set(name, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  for (let i = 0; i < 8; i += 1) {
    jar.set(`${name}.${i}`, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  }
}

export async function startSession(tokens: GarminTokens): Promise<void> {
  cacheBearer(tokens.oauth1, tokens.oauth2);
  await writeChunked(SESSION_COOKIE, seal({ oauth1: tokens.oauth1 } satisfies SessionPayload), SESSION_TTL_S);
}

export async function readSession(): Promise<SessionPayload | null> {
  return unseal<SessionPayload>(await readChunked(SESSION_COOKIE));
}

/** Re-seals the session, e.g. once the Garmin display name has been resolved. */
export async function saveSession(payload: SessionPayload): Promise<void> {
  await writeChunked(SESSION_COOKIE, seal(payload), SESSION_TTL_S);
}

export async function endSession(): Promise<void> {
  const session = await readSession();
  if (session) bearerCache.delete(cacheKey(session.oauth1));
  await clearChunked(SESSION_COOKIE);
  await clearChunked(MFA_COOKIE);
}

export async function startMfaChallenge(challenge: MfaChallenge): Promise<void> {
  await writeChunked(MFA_COOKIE, seal(challenge), MFA_TTL_S);
}

export async function readMfaChallenge(): Promise<MfaChallenge | null> {
  return unseal<MfaChallenge>(await readChunked(MFA_COOKIE));
}

export async function clearMfaChallenge(): Promise<void> {
  await clearChunked(MFA_COOKIE);
}
