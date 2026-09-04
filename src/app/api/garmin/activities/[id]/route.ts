import { NextResponse } from "next/server";
import { handleError, persistRefresh, requireSession } from "@/lib/api";
import { getActivity } from "@/lib/garmin/endpoints";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const { data, tokens } = await getActivity(session.tokens, id);
    persistRefresh(tokens);
    return NextResponse.json(data);
  } catch (error) {
    return handleError(error);
  }
}
