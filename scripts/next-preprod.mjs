import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const env = parseEnv(readFileSync(".env.preprod", "utf8"));
const command = process.argv.slice(2);
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", ...command], {
  env: { ...process.env, ...env },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
