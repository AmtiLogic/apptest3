import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";

export async function GET() {
  return NextResponse.json({ signedIn: Boolean(await readSession()) });
}
