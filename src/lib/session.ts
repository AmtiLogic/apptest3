import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { MfaChallenge } from "./garmin/sso";
import type { GarminTokens } from "./garmin/types";

import { MFA_COOKIE, SESSION_COOKIE } from "./cookie-names";

export { MFA_COOKIE, SESSION_COOKIE };

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MFA_TTL_MS = 10 * 60 * 1000;

interface SessionRecord {
  tokens: GarminTokens;
  displayName?: string;
  expiresAt: number;
}

interface MfaRecord {
  challenge: MfaChallenge;
  expiresAt: number;
}

/**
 * Sessions live in process memory: tokens never touch disk and never go to the
 * browser. The trade-off is that signing in again is required after a server
 * restart, and this will not work across multiple server instances.
 *
 * The maps hang off globalThis because route handlers are bundled separately --
 * a module-level Map would give each route its own copy (and would be dropped
 * on every hot reload in development).
 */
const store = globalThis as typeof globalThis & {
  __garminSessions?: Map<string, SessionRecord>;
  __garminMfa?: Map<string, MfaRecord>;
};

const sessions = (store.__garminSessions ??= new Map<string, SessionRecord>());
const mfaChallenges = (store.__garminMfa ??= new Map<string, MfaRecord>());

function sweep(): void {
  const now = Date.now();
  for (const [id, record] of sessions) if (record.expiresAt <= now) sessions.delete(id);
  for (const [id, record] of mfaChallenges) if (record.expiresAt <= now) mfaChallenges.delete(id);
}

function newId(): string {
  return randomBytes(32).toString("base64url");
}

export function createSession(tokens: GarminTokens): string {
  sweep();
  const id = newId();
  sessions.set(id, { tokens, expiresAt: Date.now() + SESSION_TTL_MS });
  return id;
}

export function readSession(id: string | undefined): SessionRecord | null {
  if (!id) return null;
  sweep();
  const record = sessions.get(id);
  if (!record) return null;
  record.expiresAt = Date.now() + SESSION_TTL_MS;
  return record;
}

export function updateSession(id: string, patch: Partial<Omit<SessionRecord, "expiresAt">>): void {
  const record = sessions.get(id);
  if (record) Object.assign(record, patch);
}

export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

export function createMfaChallenge(challenge: MfaChallenge): string {
  sweep();
  const id = newId();
  mfaChallenges.set(id, { challenge, expiresAt: Date.now() + MFA_TTL_MS });
  return id;
}

export function takeMfaChallenge(id: string | undefined): MfaChallenge | null {
  if (!id) return null;
  sweep();
  const record = mfaChallenges.get(id);
  if (!record) return null;
  mfaChallenges.delete(id);
  return record.challenge;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export async function setSessionCookie(id: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, id, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_MS / 1000 });
}

export async function setMfaCookie(id: string): Promise<void> {
  (await cookies()).set(MFA_COOKIE, id, { ...COOKIE_OPTIONS, maxAge: MFA_TTL_MS / 1000 });
}

export async function clearCookie(name: string): Promise<void> {
  (await cookies()).set(name, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

export async function currentSessionId(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function currentMfaId(): Promise<string | undefined> {
  return (await cookies()).get(MFA_COOKIE)?.value;
}
