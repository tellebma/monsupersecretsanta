import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const cli = resolve("node_modules/supabase/dist/supabase.js");
const status = () => spawnSync(process.execPath, [cli, "status", "-o", "json"], { encoding: "utf8" });
let result = status();
if (result.status !== 0) {
  const start = spawnSync(process.execPath, [cli, "start", "-x", "imgproxy,postgres-meta,supavisor,vector"], { stdio: ["ignore", "ignore", "inherit"] });
  if (start.status !== 0) process.exit(start.status ?? 1);
  result = status();
}
if (result.status !== 0) throw new Error("Impossible de lire l’état de Supabase local.");
const services = JSON.parse(result.stdout);
const env = {
  NEXT_PUBLIC_SUPABASE_URL: services.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: services.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: services.SERVICE_ROLE_KEY,
  TEST_DATABASE_URL: services.DB_URL,
  TEST_MAILPIT_URL: services.MAILPIT_URL,
  APP_ORIGIN: "http://127.0.0.1:3100",
  SCHEDULE_SECRET: randomBytes(32).toString("hex"),
  RESEND_API_URL: "http://127.0.0.1:3101/emails",
  RESEND_API_KEY: "local-test-key",
  EMAIL_FROM: "Secret Santa <preview@example.com>",
};
for (const [name, value] of Object.entries(env)) {
  if (typeof value !== "string") throw new Error(`Supabase local n’a pas retourné ${name}.`);
}
writeFileSync(".env.preprod", Object.entries(env).map(([name, value]) => `${name}=${value}`).join("\n") + "\n", { mode: 0o600 });
const seed = spawnSync(process.execPath, [resolve("scripts/seed-preprod.mjs")], { stdio: "inherit" });
process.exit(seed.status ?? 1);
