import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { login } from "@/lib/garmin/sso";
import { GarminError } from "@/lib/garmin/types";
import { startMfaChallenge, startSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      throw new GarminError("Email and password are required", 400, "bad_credentials");
    }

    const result = await login(body.email, body.password);

    if (result.status === "mfa_required" && result.challenge) {
      await startMfaChallenge(result.challenge);
      return NextResponse.json({ status: "mfa_required" });
    }

    await startSession(result.tokens!);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return handleError(error);
  }
}
