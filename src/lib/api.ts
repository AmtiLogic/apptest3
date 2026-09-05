import { NextResponse } from "next/server";
import { getProfile } from "./garmin/endpoints";
import { exchangeForOAuth2 } from "./garmin/sso";
import { GarminError, type GarminTokens } from "./garmin/types";
import { bearerFor, cacheBearer } from "./bearerCache";
import { endSession, readSession, saveSession } from "./session";

export interface AuthedContext {
  tokens: GarminTokens;
  displayName: string;
}

/**
 * Resolves the signed-in session from the sealed cookie.
 *
 * The cookie carries only the long-lived OAuth1 token, so the bearer token is
 * taken from the per-process cache or minted fresh -- which is what lets the app
 * run on a host that spreads requests across instances.
 */
export async function requireSession(): Promise<AuthedContext> {
  const session = await readSession();
  if (!session) throw new GarminError("Not signed in", 401, "unauthenticated");

  const oauth2 = await bearerFor(session.oauth1, exchangeForOAuth2);
  const tokens: GarminTokens = { oauth1: session.oauth1, oauth2 };
  if (session.displayName) return { tokens, displayName: session.displayName };

  const { data, tokens: refreshed } = await getProfile(tokens);
  persistRefresh(refreshed);
  await saveSession({ ...session, displayName: data.displayName });
  return { tokens: refreshed ?? tokens, displayName: data.displayName };
}

/** Caches a bearer token that was refreshed while serving a request. */
export function persistRefresh(tokens?: GarminTokens): void {
  if (tokens) cacheBearer(tokens.oauth1, tokens.oauth2);
}

export async function handleError(error: unknown): Promise<NextResponse> {
  if (error instanceof GarminError) {
    if (error.code === "unauthenticated") await endSession();
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("Unexpected error:", error);
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message, code: "upstream" }, { status: 500 });
}

/** YYYY-MM-DD for a date offset from today, in the server's local timezone. */
export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
