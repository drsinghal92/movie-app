import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/db";
import { getMovieDetail } from "../../src/lib/years";

// Data-layer tests against a real Postgres instance (DATABASE_URL from
// code/frontend/.env), exercising the canonical `getMovieDetail` read
// directly, per docs/BUILD-STANDARDS.md #5.

async function resetDb() {
  await prisma.streamingLink.deleteMany();
  await prisma.watchlistEntry.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.year.deleteMany();
}

function movieRow(rank: number, title: string) {
  return {
    rank,
    title,
    poster: `/posters/${title}.jpg`,
    synopsis: "A synopsis.",
    rating: 8.5,
    cast: ["Actor One", "Actor Two"],
    genre: "Drama",
    personalNote: "Because it earned it.",
  };
}

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("getMovieDetail", () => {
  it("S-002-AC1 returns poster, synopsis, rating, and cast", async () => {
    const year = await prisma.year.create({
      data: { year: 1994, published: true, movies: { create: [movieRow(1, "Pulp Fiction")] } },
      include: { movies: true },
    });

    const result = await getMovieDetail(year.movies[0].id);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      title: "Pulp Fiction",
      poster: "/posters/Pulp Fiction.jpg",
      synopsis: "A synopsis.",
      rating: 8.5,
      cast: ["Actor One", "Actor Two"],
      year: 1994,
    });
  });

  it("S-002-AC2 returns the founder's personal note", async () => {
    const year = await prisma.year.create({
      data: { year: 1994, published: true, movies: { create: [movieRow(1, "Pulp Fiction")] } },
      include: { movies: true },
    });

    const result = await getMovieDetail(year.movies[0].id);

    expect(result!.personalNote).toBe("Because it earned it.");
  });

  it("S-002-AC3 returns one or more streaming links", async () => {
    const year = await prisma.year.create({
      data: {
        year: 1994,
        published: true,
        movies: {
          create: [
            {
              ...movieRow(1, "Pulp Fiction"),
              streamingLinks: {
                create: [{ provider: "Netflix", url: "https://netflix.com/watch/1" }],
              },
            },
          ],
        },
      },
      include: { movies: true },
    });

    const result = await getMovieDetail(year.movies[0].id);

    expect(result!.streamingLinks).toHaveLength(1);
    expect(result!.streamingLinks[0]).toMatchObject({
      provider: "Netflix",
      url: "https://netflix.com/watch/1",
    });
  });

  it("S-002-AC4 returns an empty streaming links array when none exist", async () => {
    const year = await prisma.year.create({
      data: { year: 1994, published: true, movies: { create: [movieRow(1, "No Links Movie")] } },
      include: { movies: true },
    });

    const result = await getMovieDetail(year.movies[0].id);

    expect(result!.streamingLinks).toEqual([]);
  });

  it("S-002-AC1 returns null for a movie in an unpublished year", async () => {
    const year = await prisma.year.create({
      data: { year: 2020, published: false, movies: { create: [movieRow(1, "Hidden")] } },
      include: { movies: true },
    });

    const result = await getMovieDetail(year.movies[0].id);

    expect(result).toBeNull();
  });

  it("S-002-AC1 returns null for a movie id that does not exist", async () => {
    const result = await getMovieDetail("does-not-exist");

    expect(result).toBeNull();
  });
});
