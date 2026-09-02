import { NextResponse } from "next/server";
import { getProfile } from "./garmin/endpoints";
import { GarminError, type GarminTokens } from "./garmin/types";
import { clearCookie, currentSessionId, readSession, SESSION_COOKIE, updateSession } from "./session";

export interface AuthedContext {
  sessionId: string;
  tokens: GarminTokens;
  displayName: string;
}

/**
 * Resolves the signed-in session, looking up (and caching) the Garmin display
 * name that most wellness endpoints are keyed by.
 */
export async function requireSession(): Promise<AuthedContext> {
  const sessionId = await currentSessionId();
  const record = readSession(sessionId);
  if (!record || !sessionId) {
    throw new GarminError("Not signed in", 401, "unauthenticated");
  }

  if (record.displayName) {
    return { sessionId, tokens: record.tokens, displayName: record.displayName };
  }

  const { data, tokens } = await getProfile(record.tokens);
  if (tokens) updateSession(sessionId, { tokens });
  updateSession(sessionId, { displayName: data.displayName });
  return { sessionId, tokens: tokens ?? record.tokens, displayName: data.displayName };
}

/** Persists a bearer token that was refreshed while serving a request. */
export function persistRefresh(sessionId: string, tokens?: GarminTokens): void {
  if (tokens) updateSession(sessionId, { tokens });
}

export async function handleError(error: unknown): Promise<NextResponse> {
  if (error instanceof GarminError) {
    if (error.code === "unauthenticated") await clearCookie(SESSION_COOKIE);
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
