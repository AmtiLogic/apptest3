import { createHash } from "node:crypto";
import type { OAuth1Token, OAuth2Token } from "./garmin/types";

/**
 * Per-process cache of Garmin bearer tokens.
 *
 * Bearer tokens are large and short-lived, so they stay out of the session
 * cookie. A cold instance simply misses and mints a fresh one from the OAuth1
 * token -- correctness never depends on this surviving.
 */

/** Refresh a little early so a request never races the expiry. */
const MARGIN_MS = 60_000;
const MAX_ENTRIES = 32;

const cache = new Map<string, OAuth2Token>();

/**
 * Exchanges in flight, so simultaneous requests on a cold instance share one
 * call to Garmin instead of racing each other into a rate limit.
 */
const pending = new Map<string, Promise<OAuth2Token>>();

function keyFor(oauth1: OAuth1Token): string {
  return createHash("sha256").update(oauth1.oauthToken).digest("base64url");
}

export function cacheBearer(oauth1: OAuth1Token, oauth2: OAuth2Token): void {
  // A personal deployment has one user, but never grow without limit.
  if (cache.size > MAX_ENTRIES) cache.clear();
  cache.set(keyFor(oauth1), oauth2);
}

export function cachedBearer(oauth1: OAuth1Token): OAuth2Token | null {
  const key = keyFor(oauth1);
  const token = cache.get(key);
  if (!token) return null;
  if (token.expiresAt - MARGIN_MS <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return token;
}

export function dropBearer(oauth1: OAuth1Token): void {
  cache.delete(keyFor(oauth1));
}

/**
 * Returns the cached bearer token, or runs `exchange` once on behalf of every
 * caller waiting on the same OAuth1 token.
 */
export function bearerFor(
  oauth1: OAuth1Token,
  exchange: (token: OAuth1Token) => Promise<OAuth2Token>,
): Promise<OAuth2Token> {
  const cached = cachedBearer(oauth1);
  if (cached) return Promise.resolve(cached);

  const key = keyFor(oauth1);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const promise = exchange(oauth1)
    .then((token) => {
      cacheBearer(oauth1, token);
      return token;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, promise);
  return promise;
}

/** Test seam. */
export function _resetBearerCache(): void {
  cache.clear();
  pending.clear();
}
