import { NextResponse } from "next/server";
import { handleError, isoDate, persistRefresh, requireSession } from "@/lib/api";
import { getSleep } from "@/lib/garmin/endpoints";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const date = new URL(request.url).searchParams.get("date") ?? isoDate();
    const { data, tokens } = await getSleep(session.tokens, session.displayName, date);
    persistRefresh(session.sessionId, tokens);
    return NextResponse.json(data);
  } catch (error) {
    return handleError(error);
  }
}
