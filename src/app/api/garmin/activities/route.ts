import { NextResponse } from "next/server";
import { handleError, persistRefresh, requireSession } from "@/lib/api";
import { getActivities } from "@/lib/garmin/endpoints";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const params = new URL(request.url).searchParams;
    const start = Math.max(Number(params.get("start") ?? 0), 0);
    const limit = Math.min(Math.max(Number(params.get("limit") ?? 20), 1), 100);
    const { data, tokens } = await getActivities(session.tokens, start, limit);
    persistRefresh(tokens);
    return NextResponse.json(data);
  } catch (error) {
    return handleError(error);
  }
}
