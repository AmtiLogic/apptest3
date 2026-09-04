import { NextResponse } from "next/server";
import { handleError, isoDate, persistRefresh, requireSession } from "@/lib/api";
import { getStepsRange } from "@/lib/garmin/endpoints";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const params = new URL(request.url).searchParams;
    const days = Math.min(Math.max(Number(params.get("days") ?? 14), 1), 28);
    const { data, tokens } = await getStepsRange(session.tokens, isoDate(-(days - 1)), isoDate());
    persistRefresh(tokens);
    return NextResponse.json(data);
  } catch (error) {
    return handleError(error);
  }
}
