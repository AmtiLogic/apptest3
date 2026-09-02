import { NextResponse } from "next/server";
import { currentSessionId, readSession } from "@/lib/session";

export async function GET() {
  const record = readSession(await currentSessionId());
  return NextResponse.json({ signedIn: Boolean(record) });
}
