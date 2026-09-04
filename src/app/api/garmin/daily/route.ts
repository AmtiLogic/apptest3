import { NextResponse } from "next/server";
import { handleError, isoDate, persistRefresh, requireSession } from "@/lib/api";
import { getDailySummary } from "@/lib/garmin/endpoints";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const date = new URL(request.url).searchParams.get("date") ?? isoDate();
    const { data, tokens } = await getDailySummary(session.tokens, session.displayName, date);
    persistRefresh(tokens);
    return NextResponse.json(data);
  } catch (error) {
    return handleError(error);
  }
}
