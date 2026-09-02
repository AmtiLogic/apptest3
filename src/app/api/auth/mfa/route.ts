import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { submitMfaCode } from "@/lib/garmin/sso";
import { GarminError } from "@/lib/garmin/types";
import { clearCookie, createSession, currentMfaId, MFA_COOKIE, setSessionCookie, takeMfaChallenge } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    if (!body.code) throw new GarminError("A verification code is required", 400, "mfa_invalid");

    const challenge = takeMfaChallenge(await currentMfaId());
    if (!challenge) {
      throw new GarminError("That sign-in attempt expired. Start again.", 401, "mfa_required");
    }

    const tokens = await submitMfaCode(challenge, body.code.trim());
    await clearCookie(MFA_COOKIE);
    await setSessionCookie(createSession(tokens));
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return handleError(error);
  }
}
