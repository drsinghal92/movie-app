import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/db";
import { getPublishedYears, getYearWithMovies } from "../../src/lib/years";

// Data-layer tests against a real Postgres instance (DATABASE_URL from
// code/frontend/.env), exercising the canonical queries directly rather than
// through the UI, per docs/BUILD-STANDARDS.md #5 (one canonical query owns
// the predicate set).

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

describe("getPublishedYears", () => {
  it("S-001-AC1 lists years that have a published top-10 list", async () => {
    await prisma.year.create({
      data: { year: 1994, published: true, movies: { create: [movieRow(1, "Pulp Fiction")] } },
    });

    const years = await getPublishedYears();

    expect(years).toHaveLength(1);
    expect(years[0]).toMatchObject({ year: 1994, movieCount: 1 });
  });

  it("S-001-AC3 excludes a year with no published list yet", async () => {
    await prisma.year.create({
      data: { year: 1994, published: true, movies: { create: [movieRow(1, "Pulp Fiction")] } },
    });
    await prisma.year.create({
      data: { year: 2020, published: false, movies: { create: [movieRow(1, "Unreleased List")] } },
    });

    const years = await getPublishedYears();

    expect(years.map((y) => y.year)).toEqual([1994]);
    expect(years.map((y) => y.year)).not.toContain(2020);
  });

  it("S-001-AC1 orders years most recent first", async () => {
    await prisma.year.createMany({
      data: [
        { year: 1994, published: true },
        { year: 2010, published: true },
        { year: 2001, published: true },
      ],
    });

    const years = await getPublishedYears();

    expect(years.map((y) => y.year)).toEqual([2010, 2001, 1994]);
  });
});

describe("getYearWithMovies", () => {
  it("S-001-AC2 returns the year's movies in rank order", async () => {
    await prisma.year.create({
      data: {
        year: 1994,
        published: true,
        movies: {
          create: [
            movieRow(3, "Third"),
            movieRow(1, "First"),
            movieRow(2, "Second"),
          ],
        },
      },
    });

    const result = await getYearWithMovies(1994);

    expect(result).not.toBeNull();
    expect(result!.movies.map((m) => m.title)).toEqual(["First", "Second", "Third"]);
    expect(result!.movies.map((m) => m.rank)).toEqual([1, 2, 3]);
  });

  it("S-001-AC3 returns null for an unpublished year", async () => {
    await prisma.year.create({
      data: { year: 2020, published: false, movies: { create: [movieRow(1, "Hidden")] } },
    });

    const result = await getYearWithMovies(2020);

    expect(result).toBeNull();
  });

  it("S-001-AC3 returns null for a year that does not exist", async () => {
    const result = await getYearWithMovies(1901);

    expect(result).toBeNull();
  });
});
