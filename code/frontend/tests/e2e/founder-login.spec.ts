import { test, expect } from "@playwright/test";

// Drives the real founder login form (docs/DESIGN.md 3.7) per the UI
// verification clause in docs/PROTOCOL.md: real field entry, real submit
// click, real browser navigation. Relies on the seeded founder user
// (prisma/seed.ts, FOUNDER_EMAIL/FOUNDER_PASSWORD in .env) being present in
// the database playwright.config.ts's webServer runs against.
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? "founder@example.com";
const FOUNDER_PASSWORD = process.env.FOUNDER_PASSWORD ?? "change-me-locally";

test("S-004-AC1 correct founder credentials reach the edit page", async ({
  page,
}) => {
  await page.goto("/founder/login");
  await page.getByLabel("Email").fill(FOUNDER_EMAIL);
  await page.getByLabel("Password").fill(FOUNDER_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/founder\/edit$/);
  await expect(
    page.getByRole("heading", { name: "Founder tool" })
  ).toBeVisible();
});

test("S-004-AC2 wrong credentials are denied with a visible inline error", async ({
  page,
}) => {
  await page.goto("/founder/login");
  await page.getByLabel("Email").fill(FOUNDER_EMAIL);
  await page.getByLabel("Password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(
    page.getByText("Incorrect email or password.")
  ).toBeVisible();
  // Still on the login page, access was not granted.
  await expect(page).toHaveURL(/\/founder\/login$/);
});

test("S-004-AC3 a logged-out visitor hitting the edit page is redirected to login", async ({
  page,
}) => {
  await page.goto("/founder/edit");
  await expect(page).toHaveURL(/\/founder\/login$/);
});
