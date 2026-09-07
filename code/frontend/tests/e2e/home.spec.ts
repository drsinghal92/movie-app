import { test, expect } from "@playwright/test";

// Scaffold e2e test, proves the Playwright runner drives a real browser
// against a real running build. Real ui_surface stories (S-001 browse,
// S-003 search, S-004 founder login, S-006 signup, S-007 watchlist) add
// their own specs here, each driving the actual input path, never a
// substitute API call, per docs/PROTOCOL.md's UI verification clause.
test("SCAFFOLD-AC1 home page loads in a real browser", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Movie Info App");
});
