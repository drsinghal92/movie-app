import { prisma } from "@/lib/db";

// Canonical reads for the Year/Movie tables (docs/BUILD-STANDARDS.md #5).
// Both queries carry the full predicate set S-001 requires: `published:
// true` on Year, so an unpublished or absent year never surfaces (AC1, AC3).
// Any future read over these tables copies this predicate set rather than
// re-deriving it.

export type PublishedYear = {
  id: string;
  year: number;
  movieCount: number;
};

/**
 * Years with a published top-10 list, most recent first (DESIGN.md 3.1).
 * Unpublished years are excluded by the `published: true` predicate, which
 * is what makes S-001-AC3 hold at the query layer, not just in the UI.
 */
export async function getPublishedYears(): Promise<PublishedYear[]> {
  const years = await prisma.year.findMany({
    where: { published: true },
    orderBy: { year: "desc" },
    select: {
      id: true,
      year: true,
      _count: { select: { movies: true } },
    },
  });

  return years.map((y) => ({
    id: y.id,
    year: y.year,
    movieCount: y._count.movies,
  }));
}

export type YearWithMovies = {
  id: string;
  year: number;
  movies: {
    id: string;
    rank: number;
    title: string;
    poster: string;
    genre: string;
  }[];
};

/**
 * One year's movies in rank order (AC2). Returns null for a year that does
 * not exist or is not published, so an unpublished year's detail page is
 * unreachable even by direct URL, matching the Home listing (AC1, AC3).
 */
export async function getYearWithMovies(
  year: number,
): Promise<YearWithMovies | null> {
  const found = await prisma.year.findUnique({
    where: { year },
    select: {
      id: true,
      year: true,
      published: true,
      movies: {
        orderBy: { rank: "asc" },
        select: {
          id: true,
          rank: true,
          title: true,
          poster: true,
          genre: true,
        },
      },
    },
  });

  if (!found || !found.published) {
    return null;
  }

  return {
    id: found.id,
    year: found.year,
    movies: found.movies,
  };
}
