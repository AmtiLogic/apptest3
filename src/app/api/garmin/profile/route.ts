import { NextResponse } from "next/server";
import { handleError, persistRefresh, requireSession } from "@/lib/api";
import { getProfile } from "@/lib/garmin/endpoints";

export async function GET() {
  try {
    const session = await requireSession();
    const { data, tokens } = await getProfile(session.tokens);
    persistRefresh(session.sessionId, tokens);
    return NextResponse.json(data);
  } catch (error) {
    return handleError(error);
  }
}
