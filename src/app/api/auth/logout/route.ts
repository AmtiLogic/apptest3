import { NextResponse } from "next/server";
import { clearCookie, currentSessionId, destroySession, MFA_COOKIE, SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  destroySession(await currentSessionId());
  await clearCookie(SESSION_COOKIE);
  await clearCookie(MFA_COOKIE);
  return NextResponse.json({ status: "ok" });
}
