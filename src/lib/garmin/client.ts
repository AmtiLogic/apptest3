import { MOCK_ENABLED, mockResponse } from "./mock";
import { exchangeForOAuth2, _internals } from "./sso";
import { GarminError, type GarminTokens } from "./types";

/** Refresh a little early so a request never races the expiry. */
const REFRESH_MARGIN_MS = 60_000;

export interface ConnectResponse<T> {
  data: T;
  /** Set when the bearer token was refreshed and the session should be updated. */
  tokens?: GarminTokens;
}

/**
 * Performs an authenticated GET against Garmin's internal Connect API,
 * refreshing the bearer token from the stored OAuth1 token when it has expired.
 */
export async function connectGet<T>(
  tokens: GarminTokens,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<ConnectResponse<T>> {
  if (MOCK_ENABLED) return { data: mockResponse(path) as T };

  let current = tokens;
  let refreshed: GarminTokens | undefined;

  if (current.oauth2.expiresAt - REFRESH_MARGIN_MS <= Date.now()) {
    current = { ...current, oauth2: await exchangeForOAuth2(current.oauth1) };
    refreshed = current;
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const url = `${_internals.API_ORIGIN}${path}${search.size ? `?${search}` : ""}`;

  let res = await request(url, current);

  // A token can be revoked server-side before it expires; retry once.
  if (res.status === 401 && !refreshed) {
    current = { ...current, oauth2: await exchangeForOAuth2(current.oauth1) };
    refreshed = current;
    res = await request(url, current);
  }

  if (res.status === 401 || res.status === 403) {
    const error = new GarminError("Garmin session is no longer valid. Sign in again.", 401, "unauthenticated");
    error.upstreamStatus = res.status;
    throw error;
  }
  if (res.status === 429) {
    const error = new GarminError("Garmin is rate-limiting requests. Try again shortly.", 429, "rate_limited");
    error.upstreamStatus = 429;
    throw error;
  }
  if (res.status === 204) {
    return { data: null as T, tokens: refreshed };
  }
  if (!res.ok) {
    const error = new GarminError(`Garmin returned HTTP ${res.status} for ${path}`, 502);
    error.upstreamStatus = res.status;
    throw error;
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : (null as T);
  return { data, tokens: refreshed };
}

function request(url: string, tokens: GarminTokens): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `${tokens.oauth2.tokenType} ${tokens.oauth2.accessToken}`,
      "User-Agent": _internals.API_UA,
      "NK": "NT",
      Accept: "application/json",
      "di-backend": `connectapi.${tokens.oauth1.domain}`,
    },
  });
}
