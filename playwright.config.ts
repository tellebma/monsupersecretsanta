import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

const env = Object.fromEntries(Object.entries(parseEnv(readFileSync(".env.preprod", "utf8")))
  .filter((entry): entry is [string, string] => typeof entry[1] === "string"));
for (const name of ["APP_ORIGIN", "NEXT_PUBLIC_SUPABASE_URL", "TEST_DATABASE_URL", "TEST_MAILPIT_URL"]) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(env[name] ?? "").hostname)) {
    throw new Error(`Les tests d’acceptation exigent un service local pour ${name}.`);
  }
}
Object.assign(process.env, env);

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 45_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: env.APP_ORIGIN, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: env.APP_ORIGIN,
    reuseExistingServer: false,
    env,
  },
});
