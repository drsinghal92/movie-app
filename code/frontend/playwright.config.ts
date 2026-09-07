import { defineConfig, devices } from "@playwright/test";

// Drives a real browser against a real running instance of the app, per the
// UI verification clause in docs/PROTOCOL.md. Every ui_surface story's
// acceptance criteria get a test here that uses the actual input path
// (real form submit, real click, real drag), never a substitute API call.
export default defineConfig({
  testDir: "./tests/e2e",
  // Specs share one real Postgres instance and each seeds/tears down its own
  // fixture rows (year 1994 in more than one file), so full parallelism
  // across spec files races them against each other's resets. Serial
  // execution trades speed for a suite that reflects real defects instead of
  // cross-file contention (S-002 surfaced this once a second spec file
  // shared fixture data with browse.spec.ts).
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
