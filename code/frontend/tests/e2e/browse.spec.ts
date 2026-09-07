import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Drives the real browse-and-click path against the running app (built by
// playwright.config.ts's webServer), per docs/PROTOCOL.md's UI verification
// clause: a real navigation and a real click, not a substitute API call.

const prisma = new PrismaClient();

function movieRow(rank: number, title: string) {
  return {
    rank,
    title,
    poster: "",
    synopsis: "A synopsis.",
    rating: 8.0,
    cast: ["Actor"],
    genre: "Drama",
    personalNote: "Why it made the list.",
  };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.streamingLink.deleteMany();
  await prisma.watchlistEntry.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.year.deleteMany();

  // A published year with a full ten-movie list, ranks seeded out of order
  // so rank ordering is genuinely proven, not accidentally correct.
  await prisma.year.create({
    data: {
      year: 1994,
      published: true,
      movies: {
        create: [
          movieRow(10, "Tenth Place"),
          movieRow(1, "Pulp Fiction"),
          movieRow(4, "Fourth Place"),
          movieRow(2, "The Shawshank Redemption"),
          movieRow(7, "Seventh Place"),
          movieRow(3, "Forrest Gump"),
          movieRow(9, "Ninth Place"),
          movieRow(5, "Fifth Place"),
          movieRow(8, "Eighth Place"),
          movieRow(6, "Sixth Place"),
        ],
      },
    },
  });

  // A second published year, so AC1 proves "list of years", not just one.
  await prisma.year.create({
    data: { year: 2010, published: true, movies: { create: [movieRow(1, "Inception")] } },
  });

  // An unpublished year, must never appear (AC3).
  await prisma.year.create({
    data: { year: 2099, published: false, movies: { create: [movieRow(1, "Unreleased")] } },
  });
});

test.afterAll(async () => {
  await prisma.streamingLink.deleteMany();
  await prisma.watchlistEntry.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.year.deleteMany();
  await prisma.$disconnect();
});

test("S-001-AC1 shows a list of years that have a published top-10 list", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("years-grid")).toBeVisible();
  await expect(page.getByRole("link", { name: /1994/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /2010/ })).toBeVisible();
});

test("S-001-AC3 does not show a year with no published list yet", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: /2099/ })).toHaveCount(0);
});

test("S-001-AC2 shows that year's 10 movies in rank order after a real click", async ({ page }) => {
  await page.goto("/");

  // Real click through the actual year card link, not a direct navigation.
  await page.getByRole("link", { name: /1994/ }).click();

  await expect(page).toHaveURL(/\/years\/1994$/);

  const cards = page.getByTestId("poster-card");
  await expect(cards).toHaveCount(10);

  const titlesInDomOrder = await cards.locator("div.truncate.text-sm").allTextContents();
  expect(titlesInDomOrder).toEqual([
    "Pulp Fiction",
    "The Shawshank Redemption",
    "Forrest Gump",
    "Fourth Place",
    "Fifth Place",
    "Sixth Place",
    "Seventh Place",
    "Eighth Place",
    "Ninth Place",
    "Tenth Place",
  ]);
});
