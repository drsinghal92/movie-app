import { defineConfig, devices } from "@playwright/test";

// Drives a real browser against a real running instance of the app, per the
// UI verification clause in docs/PROTOCOL.md. Every ui_surface story's
// acceptance criteria get a test here that uses the actual input path
// (real form submit, real click, real drag), never a substitute API call.
export default defineConfig({
  testDir: "./tests/e2e",
  // Each e2e spec seeds/cleans the same shared Postgres tables with an
  // unscoped deleteMany in beforeAll/afterAll, so running spec files
  // concurrently lets one file's cleanup wipe another's in-flight fixtures.
  // Serialize across files; tests within a file still run in the order
  // Playwright encounters them.
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
