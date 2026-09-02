import { createHmac, randomBytes } from "node:crypto";

export interface OAuth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
}

/**
 * RFC 3986 percent-encoding. Unreserved characters are A-Z a-z 0-9 - . _ ~
 * `encodeURIComponent` leaves ! * ' ( ) alone, so they are escaped here.
 */
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * Normalises request parameters per RFC 5849 3.4.1.3.2: encode each key and
 * value, sort by encoded key then encoded value, and join as k=v pairs.
 */
export function normaliseParameters(params: Array<[string, string]>): string {
  return params
    .map(([k, v]) => [percentEncode(k), percentEncode(v)] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

/**
 * Builds the signature base string (RFC 5849 3.4.1.1). `url` may carry a query
 * string; its parameters are folded into the signature alongside `params`.
 */
export function signatureBaseString(
  method: string,
  url: string,
  params: Array<[string, string]>,
): string {
  const parsed = new URL(url);
  const collected: Array<[string, string]> = [...params];
  parsed.searchParams.forEach((value, key) => collected.push([key, value]));

  const port = parsed.port ? `:${parsed.port}` : "";
  const baseUrl = `${parsed.protocol}//${parsed.hostname}${port}${parsed.pathname}`;

  return [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(normaliseParameters(collected)),
  ].join("&");
}

export function sign(baseString: string, consumerSecret: string, tokenSecret = ""): string {
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return createHmac("sha1", key).update(baseString).digest("base64");
}

/**
 * Produces the `Authorization: OAuth ...` header for a request.
 *
 * `bodyParams` must be supplied for `application/x-www-form-urlencoded` bodies,
 * which RFC 5849 3.4.1.3.1 includes in the signature.
 */
export function authorizationHeader(
  method: string,
  url: string,
  creds: OAuth1Credentials,
  bodyParams: Array<[string, string]> = [],
  nonce = randomBytes(16).toString("hex"),
  timestamp = Math.floor(Date.now() / 1000).toString(),
): string {
  const oauthParams: Array<[string, string]> = [
    ["oauth_consumer_key", creds.consumerKey],
    ["oauth_nonce", nonce],
    ["oauth_signature_method", "HMAC-SHA1"],
    ["oauth_timestamp", timestamp],
    ["oauth_version", "1.0"],
  ];
  if (creds.token) oauthParams.push(["oauth_token", creds.token]);

  const baseString = signatureBaseString(method, url, [...oauthParams, ...bodyParams]);
  const signature = sign(baseString, creds.consumerSecret, creds.tokenSecret);

  const headerParams = [...oauthParams, ["oauth_signature", signature] as [string, string]].sort(
    (a, b) => (a[0] < b[0] ? -1 : 1),
  );

  return (
    "OAuth " +
    headerParams.map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`).join(", ")
  );
}
