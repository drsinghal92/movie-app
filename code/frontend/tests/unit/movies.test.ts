import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/db";
import { getSearchFilters, searchMovies } from "../../src/lib/movies";

// Data-layer tests against a real Postgres instance (DATABASE_URL from
// code/frontend/.env), mirroring tests/unit/years.test.ts.

async function resetDb() {
  await prisma.streamingLink.deleteMany();
  await prisma.watchlistEntry.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.year.deleteMany();
}

function movieRow(rank: number, title: string, genre: string) {
  return {
    rank,
    title,
    poster: `/posters/${title}.jpg`,
    synopsis: "A synopsis.",
    rating: 8.5,
    cast: ["Actor One", "Actor Two"],
    genre,
    personalNote: "Because it earned it.",
  };
}

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

// Years chosen well outside tests/unit/years.test.ts's range (1901-2020) so
// concurrent test files never collide on Year.year's unique constraint.
async function seed() {
  await prisma.year.create({
    data: {
      year: 3994,
      published: true,
      movies: {
        create: [
          movieRow(1, "Pulp Fiction", "Crime"),
          movieRow(2, "The Lion King", "Animation"),
        ],
      },
    },
  });
  await prisma.year.create({
    data: {
      year: 4010,
      published: true,
      movies: {
        create: [movieRow(1, "Inception Story", "Sci-Fi")],
      },
    },
  });
  await prisma.year.create({
    data: {
      year: 4099,
      published: false,
      movies: {
        create: [movieRow(1, "Inception Sequel", "Sci-Fi")],
      },
    },
  });
}

describe("searchMovies", () => {
  it("S-003-AC1 returns title matches across every published year and excludes unpublished years", async () => {
    await seed();

    const results = await searchMovies({ q: "inception" });

    expect(results.map((r) => r.title)).toEqual(["Inception Story"]);
    expect(results.map((r) => r.year)).toEqual([4010]);
    expect(results.some((r) => r.title === "Inception Sequel")).toBe(false);
  });

  it("S-003-AC2 narrows by year-only, genre-only, and combined year+genre filters", async () => {
    await seed();

    const byYear = await searchMovies({ year: 3994 });
    expect(byYear.map((r) => r.title).sort()).toEqual([
      "Pulp Fiction",
      "The Lion King",
    ]);

    const byGenre = await searchMovies({ genre: "Sci-Fi" });
    expect(byGenre.map((r) => r.title)).toEqual(["Inception Story"]);

    const combined = await searchMovies({ year: 3994, genre: "Crime" });
    expect(combined.map((r) => r.title)).toEqual(["Pulp Fiction"]);
  });

  it("S-003-AC3 returns an empty array, not a throw, when nothing matches", async () => {
    await seed();

    const results = await searchMovies({ q: "no such movie title" });

    expect(results).toEqual([]);
  });
});

describe("getSearchFilters", () => {
  it("S-003-AC3 returns only published years and the distinct genre set", async () => {
    await seed();

    const filters = await getSearchFilters();

    expect(filters.years).toEqual(expect.arrayContaining([3994, 4010]));
    expect(filters.years).not.toContain(4099);
    expect(filters.genres).toEqual(
      expect.arrayContaining(["Animation", "Crime", "Sci-Fi"]),
    );
  });
});
