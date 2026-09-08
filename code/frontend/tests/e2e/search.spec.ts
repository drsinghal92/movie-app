import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Drives the real /search screen (S-003), per docs/PROTOCOL.md's UI
// verification clause: the real search input and the real filter `select`s,
// not a substitute API call. Mirrors tests/e2e/browse.spec.ts's fixture
// shape.

const prisma = new PrismaClient();

function movieRow(rank: number, title: string, genre: string) {
  return {
    rank,
    title,
    poster: "",
    synopsis: "A synopsis.",
    rating: 8.0,
    cast: ["Actor"],
    genre,
    personalNote: "Why it made the list.",
  };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.streamingLink.deleteMany();
  await prisma.watchlistEntry.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.year.deleteMany();

  // Two published years sharing a title fragment across genres, so AC1
  // proves matches span published years (not just one), and AC2 has real
  // year/genre variety to filter across. Years chosen outside the ranges
  // used by other e2e specs (browse.spec.ts uses 1994/2010/2099) since
  // playwright runs spec files in parallel against one shared database.
  await prisma.year.create({
    data: {
      year: 5994,
      published: true,
      movies: {
        create: [
          movieRow(1, "Quest for Fire", "Adventure"),
          movieRow(2, "Pulp Fiction", "Crime"),
        ],
      },
    },
  });
  await prisma.year.create({
    data: {
      year: 6010,
      published: true,
      movies: {
        create: [movieRow(1, "The Quest Begins", "Fantasy")],
      },
    },
  });

  // Unpublished year, must never appear in search results (AC1/S-001-AC3).
  await prisma.year.create({
    data: {
      year: 6099,
      published: false,
      movies: { create: [movieRow(1, "Quest Unreleased", "Adventure")] },
    },
  });
});

test.afterAll(async () => {
  await prisma.streamingLink.deleteMany();
  await prisma.watchlistEntry.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.year.deleteMany();
  await prisma.$disconnect();
});

test("S-003-AC1 shows matching movies across all published years and never an unpublished year's title", async ({
  page,
}) => {
  await page.goto("/search");

  await page.getByTestId("search-input").fill("quest");

  const results = page.getByTestId("search-results");
  await expect(results).toBeVisible();
  await expect(page.getByText("Quest for Fire")).toBeVisible();
  await expect(page.getByText("The Quest Begins")).toBeVisible();
  await expect(page.getByText("Quest Unreleased")).toHaveCount(0);
});

test("S-003-AC2 narrows the grid with the real year and genre dropdowns", async ({
  page,
}) => {
  await page.goto("/search");

  await page.getByTestId("search-input").fill("quest");
  await expect(page.getByTestId("search-results")).toBeVisible();

  await page.getByTestId("year-filter").selectOption("5994");
  await expect(page.getByText("Quest for Fire")).toBeVisible();
  await expect(page.getByText("The Quest Begins")).toHaveCount(0);

  await page.getByTestId("genre-filter").selectOption("Adventure");
  await expect(page.getByText("Quest for Fire")).toBeVisible();
});

test("S-003-AC3 shows the empty state instead of an error when nothing matches", async ({
  page,
}) => {
  await page.goto("/search");

  await page.getByTestId("search-input").fill("no such movie exists anywhere");

  const empty = page.getByTestId("search-empty");
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("No movies match your search");
  // Not a substitute for role=alert (Next.js's own hidden route announcer
  // also carries role="alert"), so check the Errnote's own copy is absent.
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  await expect(page.getByTestId("search-input")).toBeVisible();
  await expect(page.getByTestId("year-filter")).toBeVisible();
});
