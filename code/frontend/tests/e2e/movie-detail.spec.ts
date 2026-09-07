import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Drives the real click-through from a year list into the movie detail
// page against the running app (built by playwright.config.ts's
// webServer), per docs/PROTOCOL.md's UI verification clause: a real
// navigation and a real click on the actual poster card, not a direct
// route visit or a substitute API call.

const prisma = new PrismaClient();

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.streamingLink.deleteMany();
  await prisma.watchlistEntry.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.year.deleteMany();

  await prisma.year.create({
    data: {
      year: 1994,
      published: true,
      movies: {
        create: [
          {
            rank: 1,
            title: "Pulp Fiction",
            poster: "/posters/pulp-fiction.jpg",
            synopsis: "Criminals cross paths in Los Angeles.",
            rating: 8.9,
            cast: ["John Travolta", "Samuel L. Jackson"],
            genre: "Crime",
            personalNote: "Rewrote how a crime film could be told.",
            streamingLinks: {
              create: [{ provider: "Netflix", url: "https://netflix.com/watch/pulp-fiction" }],
            },
          },
          {
            rank: 2,
            title: "No Links Movie",
            poster: "/posters/no-links.jpg",
            synopsis: "A movie with nowhere to stream it.",
            rating: 7.0,
            cast: ["An Actor"],
            genre: "Drama",
            personalNote: "Included for completeness.",
          },
        ],
      },
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

test("S-002-AC1,AC2,AC3 clicking a poster from a year list shows poster, synopsis, rating, cast, note, and a streaming link", async ({
  page,
}) => {
  await page.goto("/years/1994");

  // Real click on the actual poster card, the input mechanism this story ships.
  await page.getByTestId("poster-card").filter({ hasText: "Pulp Fiction" }).click();

  await expect(page).toHaveURL(/\/movies\/.+/);

  await expect(page.getByTestId("movie-title")).toHaveText("Pulp Fiction");
  await expect(page.getByTestId("movie-poster")).toBeVisible();
  await expect(page.getByTestId("movie-synopsis")).toHaveText(
    "Criminals cross paths in Los Angeles.",
  );
  await expect(page.getByTestId("rating-pill")).toHaveText("★ 8.9");
  await expect(page.getByTestId("movie-cast")).toHaveText("John Travolta, Samuel L. Jackson");
  await expect(page.getByTestId("note-card")).toContainText(
    "Rewrote how a crime film could be told.",
  );
  await expect(page.getByTestId("streaming-links")).toContainText("Netflix");
});

test("S-002-AC4 a movie with no streaming links shows the no-link message instead of a dead link", async ({
  page,
}) => {
  await page.goto("/years/1994");

  await page.getByTestId("poster-card").filter({ hasText: "No Links Movie" }).click();

  await expect(page).toHaveURL(/\/movies\/.+/);
  await expect(page.getByTestId("movie-title")).toHaveText("No Links Movie");
  await expect(page.getByTestId("no-streaming-links")).toHaveText(
    "No streaming link available yet.",
  );
  await expect(page.getByTestId("streaming-links")).toHaveCount(0);
});
