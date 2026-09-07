import { NextResponse } from "next/server";

// Scaffold health check, proves the Route Handler wiring works end to end.
// Real feature routes (movies, years, watchlist, founder/*) land per story.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
