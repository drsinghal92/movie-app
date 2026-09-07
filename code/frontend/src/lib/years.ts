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

export type MovieDetail = {
  id: string;
  poster: string;
  title: string;
  synopsis: string;
  rating: number;
  cast: string[];
  personalNote: string;
  streamingLinks: { id: string; provider: string; url: string }[];
  year: number;
};

/**
 * One movie's full detail (DESIGN.md 3.3, S-002). Returns null for a movie
 * that does not exist or whose parent year is not published (AC1-AC4),
 * copying the `Year.published` predicate `getYearWithMovies` carries above
 * (docs/BUILD-STANDARDS.md #5), so an unpublished year's movie is
 * unreachable even by a guessed `/movies/[id]` URL.
 */
export async function getMovieDetail(id: string): Promise<MovieDetail | null> {
  const found = await prisma.movie.findUnique({
    where: { id },
    select: {
      id: true,
      poster: true,
      title: true,
      synopsis: true,
      rating: true,
      cast: true,
      personalNote: true,
      year: { select: { year: true, published: true } },
      streamingLinks: {
        select: { id: true, provider: true, url: true },
      },
    },
  });

  if (!found || !found.year.published) {
    return null;
  }

  return {
    id: found.id,
    poster: found.poster,
    title: found.title,
    synopsis: found.synopsis,
    rating: found.rating,
    cast: found.cast,
    personalNote: found.personalNote,
    streamingLinks: found.streamingLinks,
    year: found.year.year,
  };
}
