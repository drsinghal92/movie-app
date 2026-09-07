import { defineConfig } from "vitest/config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// No dotenv dependency in this scaffold, so read .env by hand (same shape
// Next.js reads automatically) and seed process.env before tests run, since
// the data-layer tests hit a real Postgres instance via DATABASE_URL.
const envPath = resolve(__dirname, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
    }
  }
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
