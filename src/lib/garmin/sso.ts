import { envOr } from "../env";
import { CookieJar } from "./cookies";
import { MOCK_ENABLED, MOCK_TOKENS } from "./mock";
import { authorizationHeader } from "./oauth1";
import { GarminError, type GarminTokens, type OAuth1Token, type OAuth2Token } from "./types";

const DOMAIN = envOr(process.env.GARMIN_DOMAIN, "garmin.com");
const SSO_ORIGIN = `https://sso.${DOMAIN}`;
const API_ORIGIN = `https://connectapi.${DOMAIN}`;

/**
 * Garmin's mobile client credentials, published by the `garth` project. They
 * identify the client, not the user, and Garmin rotates them occasionally --
 * hence the fetch at runtime rather than a hard-coded constant.
 */
const CONSUMER_URL = "https://thegarth.s3.amazonaws.com/oauth_consumer.json";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const API_UA = "com.garmin.android.apps.connectmobile/5.7.2.1";

const EMBED_PARAMS = {
  id: "gauth-widget",
  embedWidget: "true",
  gauthHost: SSO_ORIGIN,
};

const SIGNIN_PARAMS = {
  ...EMBED_PARAMS,
  gauthHost: `${SSO_ORIGIN}/sso/embed`,
  service: `${SSO_ORIGIN}/sso/embed`,
  source: `${SSO_ORIGIN}/sso/embed`,
  redirectAfterAccountLoginUrl: `${SSO_ORIGIN}/sso/embed`,
  redirectAfterAccountCreationUrl: `${SSO_ORIGIN}/sso/embed`,
};

let consumerCache: { key: string; secret: string } | null = null;

async function consumerCredentials(): Promise<{ key: string; secret: string }> {
  if (consumerCache) return consumerCache;
  if (process.env.GARMIN_CONSUMER_KEY && process.env.GARMIN_CONSUMER_SECRET) {
    consumerCache = {
      key: process.env.GARMIN_CONSUMER_KEY,
      secret: process.env.GARMIN_CONSUMER_SECRET,
    };
    return consumerCache;
  }
  const res = await fetch(CONSUMER_URL);
  if (!res.ok) {
    throw new GarminError(`Could not fetch OAuth consumer credentials (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { consumer_key: string; consumer_secret: string };
  consumerCache = { key: json.consumer_key, secret: json.consumer_secret };
  return consumerCache;
}

function query(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export function extractCsrfToken(html: string): string {
  const match = html.match(/name="_csrf"\s+value="(.+?)"/);
  if (!match) throw new GarminError("Garmin's sign-in page did not include a CSRF token");
  return match[1];
}

export function extractTitle(html: string): string {
  return html.match(/<title>(.+?)<\/title>/s)?.[1]?.trim() ?? "";
}

export function extractTicket(html: string): string {
  const match = html.match(/embed\?ticket=([^"]+)"/);
  if (!match) throw new GarminError("Garmin did not return a login ticket");
  return match[1];
}

/**
 * State carried between the password step and the MFA step. It holds session
 * cookies and a CSRF token -- never the user's password.
 */
export interface MfaChallenge {
  cookies: string;
  csrf: string;
}

export interface LoginResult {
  status: "ok" | "mfa_required";
  tokens?: GarminTokens;
  challenge?: MfaChallenge;
}

async function ssoFetch(
  jar: CookieJar,
  url: string,
  init: RequestInit & { referrer?: string } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("User-Agent", BROWSER_UA);
  if (jar.size) headers.set("Cookie", jar.header());
  if (init.referrer) headers.set("Referer", init.referrer);

  const res = await fetch(url, { ...init, headers, redirect: "follow" });
  jar.absorb(res);
  return res;
}

/**
 * Step 1-3 of the Garmin Connect sign-in: seed cookies, read the CSRF token,
 * then post the credentials. Returns either a ticket exchange or an MFA
 * challenge for the caller to complete.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  if (MOCK_ENABLED) return { status: "ok", tokens: MOCK_TOKENS };

  const jar = new CookieJar();
  const signinUrl = `${SSO_ORIGIN}/sso/signin?${query(SIGNIN_PARAMS)}`;

  await ssoFetch(jar, `${SSO_ORIGIN}/sso/embed?${query(EMBED_PARAMS)}`);

  const formRes = await ssoFetch(jar, signinUrl, { referrer: `${SSO_ORIGIN}/sso/embed` });
  const csrf = extractCsrfToken(await formRes.text());

  const postRes = await ssoFetch(jar, signinUrl, {
    method: "POST",
    referrer: signinUrl,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password, embed: "true", _csrf: csrf }),
  });

  if (postRes.status === 429) {
    throw new GarminError("Garmin is rate-limiting sign-in attempts. Wait a few minutes.", 429, "rate_limited");
  }

  const html = await postRes.text();
  const title = extractTitle(html);

  if (/MFA/i.test(title)) {
    return {
      status: "mfa_required",
      challenge: { cookies: jar.header(), csrf: extractCsrfToken(html) },
    };
  }

  if (!/success/i.test(title)) {
    throw new GarminError("Garmin rejected the email or password", 401, "bad_credentials");
  }

  return { status: "ok", tokens: await exchangeTicket(extractTicket(html)) };
}

/** Completes a login that Garmin answered with a multi-factor challenge. */
export async function submitMfaCode(challenge: MfaChallenge, code: string): Promise<GarminTokens> {
  const jar = new CookieJar();
  const headers = new Headers({
    "User-Agent": BROWSER_UA,
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: challenge.cookies,
    Referer: `${SSO_ORIGIN}/sso/signin?${query(SIGNIN_PARAMS)}`,
  });

  const res = await fetch(
    `${SSO_ORIGIN}/sso/verifyMFA/loginEnterMfaCode?${query(SIGNIN_PARAMS)}`,
    {
      method: "POST",
      headers,
      redirect: "follow",
      body: new URLSearchParams({
        "mfa-code": code,
        embed: "true",
        _csrf: challenge.csrf,
        fromPage: "setupEnterMfaCode",
      }),
    },
  );
  jar.absorb(res);

  const html = await res.text();
  if (!/embed\?ticket=/.test(html)) {
    throw new GarminError("That verification code was not accepted", 401, "mfa_invalid");
  }
  return exchangeTicket(extractTicket(html));
}

/** Trades the SSO ticket for an OAuth1 token, then for an OAuth2 bearer token. */
export async function exchangeTicket(ticket: string): Promise<GarminTokens> {
  const oauth1 = await requestOAuth1Token(ticket);
  const oauth2 = await exchangeForOAuth2(oauth1);
  return { oauth1, oauth2 };
}

async function requestOAuth1Token(ticket: string): Promise<OAuth1Token> {
  const consumer = await consumerCredentials();
  const url =
    `${API_ORIGIN}/oauth-service/oauth/preauthorized?` +
    query({
      ticket,
      "login-url": `${SSO_ORIGIN}/sso/embed`,
      "accepts-mfa-tokens": "true",
    });

  const res = await fetch(url, {
    headers: {
      "User-Agent": API_UA,
      Authorization: authorizationHeader("GET", url, {
        consumerKey: consumer.key,
        consumerSecret: consumer.secret,
      }),
    },
  });

  if (!res.ok) {
    throw new GarminError(`Garmin refused the login ticket (HTTP ${res.status})`, 502);
  }

  const parsed = new URLSearchParams(await res.text());
  const token = parsed.get("oauth_token");
  const secret = parsed.get("oauth_token_secret");
  if (!token || !secret) throw new GarminError("Garmin returned an unusable OAuth token");

  return {
    oauthToken: token,
    oauthTokenSecret: secret,
    mfaToken: parsed.get("mfa_token") ?? undefined,
    domain: DOMAIN,
  };
}

/**
 * Exchanges an OAuth1 token for a bearer token. This is also the refresh path:
 * the OAuth1 token is long-lived, so a new bearer token can be minted without
 * the user's password.
 */
export async function exchangeForOAuth2(oauth1: OAuth1Token): Promise<OAuth2Token> {
  if (MOCK_ENABLED) return MOCK_TOKENS.oauth2;

  const consumer = await consumerCredentials();
  const url = `${API_ORIGIN}/oauth-service/oauth/exchange/user/2.0`;
  const bodyParams: Array<[string, string]> = oauth1.mfaToken ? [["mfa_token", oauth1.mfaToken]] : [];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": API_UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: authorizationHeader(
        "POST",
        url,
        {
          consumerKey: consumer.key,
          consumerSecret: consumer.secret,
          token: oauth1.oauthToken,
          tokenSecret: oauth1.oauthTokenSecret,
        },
        bodyParams,
      ),
    },
    body: new URLSearchParams(bodyParams),
  });

  if (!res.ok) {
    throw new GarminError(
      `Garmin refused the token exchange (HTTP ${res.status})`,
      res.status === 401 ? 401 : 502,
      res.status === 401 ? "unauthenticated" : "upstream",
    );
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope?: string;
    jti?: string;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    tokenType: json.token_type ?? "Bearer",
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope,
    jti: json.jti,
  };
}

export const _internals = { API_ORIGIN, API_UA, SSO_ORIGIN };
