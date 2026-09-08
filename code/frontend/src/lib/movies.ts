import { prisma } from "@/lib/db";

// Search/filter reads for the Movie table (S-003), mirroring the canonical
// pattern in years.ts (docs/BUILD-STANDARDS.md #5): the published-year gate
// lives here once, so every future search-like read copies this predicate
// set rather than re-deriving it. `where: { year: { published: true } }` is
// applied first, unconditionally, so an unpublished year's movies never
// surface through search either, matching S-001-AC3.

export type SearchResult = {
  id: string;
  rank: number;
  title: string;
  poster: string;
  genre: string;
  year: number;
};

/**
 * Movies across all published years matching an optional title fragment
 * (case-insensitive contains, AC1) and optional exact year/genre filters
 * (AC2). An empty result set is a valid, non-error outcome (AC3).
 */
export async function searchMovies({
  q,
  year,
  genre,
}: {
  q?: string;
  year?: number;
  genre?: string;
}): Promise<SearchResult[]> {
  const where: Record<string, unknown> = {
    year: {
      published: true,
      ...(year ? { year } : {}),
    },
  };

  if (q && q.trim().length > 0) {
    where.title = { contains: q.trim(), mode: "insensitive" };
  }

  if (genre && genre.trim().length > 0) {
    where.genre = genre;
  }

  const movies = await prisma.movie.findMany({
    where,
    orderBy: [{ year: { year: "desc" } }, { rank: "asc" }],
    select: {
      id: true,
      rank: true,
      title: true,
      poster: true,
      genre: true,
      year: { select: { year: true } },
    },
  });

  return movies.map((m) => ({
    id: m.id,
    rank: m.rank,
    title: m.title,
    poster: m.poster,
    genre: m.genre,
    year: m.year.year,
  }));
}

export type SearchFilters = {
  years: number[];
  genres: string[];
};

/**
 * DISTINCT published years and DISTINCT genres, for the filter dropdowns
 * (AC2), recognition over recall (DESIGN.md 3.4). No `Genre` table exists
 * (ARCHITECTURE.md data-model note), so genres are the distinct values of
 * `Movie.genre` among movies belonging to a published year.
 */
export async function getSearchFilters(): Promise<SearchFilters> {
  const [years, genreRows] = await Promise.all([
    prisma.year.findMany({
      where: { published: true },
      orderBy: { year: "desc" },
      select: { year: true },
    }),
    prisma.movie.findMany({
      where: { year: { published: true } },
      distinct: ["genre"],
      select: { genre: true },
      orderBy: { genre: "asc" },
    }),
  ]);

  return {
    years: years.map((y) => y.year),
    genres: genreRows.map((g) => g.genre).sort(),
  };
}
