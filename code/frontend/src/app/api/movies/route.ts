import { NextRequest, NextResponse } from "next/server";
import { searchMovies } from "@/lib/movies";

// GET /api/movies?q=&year=&genre= (S-003). Backs the live-filter search
// client per docs/ARCHITECTURE.md section 3. Returns `{ movies }` on
// success or `{ error }` with a matching status on failure, per the
// error-handling convention in ARCHITECTURE.md section 5, never a bare 500.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? undefined;
  const yearParam = params.get("year");
  const genre = params.get("genre") ?? undefined;

  let year: number | undefined;
  if (yearParam) {
    const parsed = Number(yearParam);
    if (!Number.isInteger(parsed)) {
      return NextResponse.json(
        { error: "year must be an integer" },
        { status: 400 },
      );
    }
    year = parsed;
  }

  try {
    const movies = await searchMovies({ q, year, genre });
    return NextResponse.json({ movies });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong, retry." },
      { status: 500 },
    );
  }
}
