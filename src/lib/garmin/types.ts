export interface OAuth1Token {
  oauthToken: string;
  oauthTokenSecret: string;
  mfaToken?: string;
  domain: string;
}

export interface OAuth2Token {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  scope?: string;
  jti?: string;
}

export interface GarminTokens {
  oauth1: OAuth1Token;
  oauth2: OAuth2Token;
}

export class GarminError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
    readonly code:
      | "bad_credentials"
      | "mfa_required"
      | "mfa_invalid"
      | "rate_limited"
      | "unauthenticated"
      | "upstream" = "upstream",
  ) {
    super(message);
    this.name = "GarminError";
  }
}
