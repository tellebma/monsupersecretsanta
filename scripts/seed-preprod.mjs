import { createHash } from "node:crypto";
import { parseEnv } from "node:util";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { demoEmail, giftsFor, leaGifts, localPassword, people, scenarios } from "./preprod-data.mjs";

const hosted = process.argv.includes("--hosted");
const values = hosted ? process.env : parseEnv(readFileSync(".env.preprod", "utf8"));
const url = new URL(hosted ? values.STAGING_SUPABASE_URL : values.NEXT_PUBLIC_SUPABASE_URL);
const key = hosted ? values.STAGING_SUPABASE_SERVICE_ROLE_KEY : values.SUPABASE_SERVICE_ROLE_KEY;
const password = hosted ? values.STAGING_DEMO_PASSWORD : localPassword;
const loopback = (host) => ["127.0.0.1", "localhost", "[::1]"].includes(host);
const dbUrl = hosted ? null : new URL(values.TEST_DATABASE_URL);
const ref = values.STAGING_PROJECT_REF;

if (hosted) {
  if (!/^[a-z]{20}$/.test(ref ?? "") || !values.PRODUCTION_SUPABASE_REF || ref === values.PRODUCTION_SUPABASE_REF ||
    url.origin !== `https://${ref}.supabase.co`) {
    throw new Error("Utilisez un projet Supabase distinct.");
  }
} else if (!loopback(url.hostname) || !loopback(dbUrl.hostname)) {
  throw new Error("Le peuplement local exige des adresses de boucle locale.");
}
if (!key || !password || password.length < 12) throw new Error("Identifiants de préproduction incomplets.");

const auth = createClient(url.href, key, { auth: { autoRefreshToken: false, persistSession: false } }).auth.admin;
function cli(args) {
  const result = spawnSync(process.execPath, ["node_modules/supabase/dist/supabase.js", ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Le CLI Supabase a refusé ${args.slice(0, 2).join(" ")} pour la préproduction.`);
  return JSON.parse(result.stdout);
}

function hostedDatabase() {
  const statements = [];
  function literal(value) {
    if (value === null) return "null";
    if (typeof value === "boolean" || typeof value === "number") return String(value);
    const text = value instanceof Date ? value.toISOString() : value;
    return "'" + text.replaceAll("'", "''") + "'";
  }
  return {
    async connect() {
      const projects = cli(["projects", "list", "-o", "json"]);
      const project = (projects.projects ?? projects).find((item) => item.ref === ref);
      if (project?.name !== "monsupersecretsanta-preprod") throw new Error("Nom du projet de préproduction inattendu.");
      cli(["db", "query", `--remote=${ref}`, "--read-only", "-o", "json", "select 1 from santa.groups limit 0"]);
    },
    async query(sql, params = []) {
      if (sql === "rollback") return;
      statements.push(sql.replace(/\$(\d+)/g, (_, index) => literal(params[Number(index) - 1])) + ";");
      if (sql !== "commit") return;
      const folder = mkdtempSync(join(tmpdir(), "santa-fixtures-"));
      const file = join(folder, "fixtures.sql");
      try {
        writeFileSync(file, statements.join("\n"), { mode: 0o600 });
        cli(["db", "query", `--remote=${ref}`, "--yes", "--file", file, "-o", "json"]);
      } finally {
        unlinkSync(file);
        rmdirSync(folder);
      }
    },
    async end() {},
  };
}

const db = hosted ? hostedDatabase() : new pg.Client({ connectionString: dbUrl.href, connectionTimeoutMillis: 10_000 });
const id = (label) => {
  const hash = createHash("sha256").update(`mon-super-secret-santa-fixtures:${label}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
const names = new Map(people);
const users = new Map();
const now = Date.now();
const day = (offset) => new Date(now + offset * 86_400_000);
const year = (date) => Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric" }).format(date));

async function ensureAccounts() {
  const accounts = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await auth.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Lecture des comptes impossible (${error.code ?? error.status}).`);
    for (const account of data.users) accounts.set(account.email, account);
    if (data.users.length < 100) break;
  }
  for (const [slug, name] of people) {
    const email = demoEmail(slug);
    let account = accounts.get(email);
    if (account && account.app_metadata.santa_fixture !== true) throw new Error("Un compte existant utilise une adresse de démonstration.");
    if (!account) {
      const { data, error } = await auth.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: name }, app_metadata: { santa_fixture: true },
      });
      if (error) throw new Error(`Création du compte ${slug} impossible (${error.code ?? error.status}).`);
      account = data.user;
    }
    users.set(slug, account.id);
  }
}

async function addEdition(scenario, groupId, editionId, drawAt, exchangeAt, historical = false) {
  const { key, state, members, matches } = scenario;
  await db.query(
    "insert into santa.editions(id,group_id,year,draw_at,exchange_at,budget,state,drawn_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(id) do nothing",
    [editionId, groupId, year(exchangeAt), drawAt, exchangeAt, key === "family" ? 45 : null, state, state === "drawn" ? drawAt : null],
  );
  for (const slug of members) {
    await db.query("insert into santa.members(edition_id,user_id,name,email) values($1,$2,$3,$4) on conflict do nothing",
      [editionId, users.get(slug), names.get(slug), demoEmail(slug)]);
  }
  for (const [giver, receiver] of matches ?? []) {
    await db.query("insert into santa.draws(edition_id,giver_id,receiver_id,revealed) values($1,$2,$3,$4) on conflict do nothing",
      [editionId, users.get(giver), users.get(receiver), historical || giver !== "camille"]);
  }
  if (key === "blocked") {
    await db.query("insert into santa.exceptions values($1,least($2::uuid,$3::uuid),greatest($2::uuid,$3::uuid)) on conflict do nothing",
      [editionId, users.get(members[0]), users.get(members[1])]);
  }
}

try {
  await db.connect();
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(hashtext('santa-preprod-fixtures'))");
  await db.query("select 1 from santa.groups limit 0");
  await ensureAccounts();
  for (const scenario of scenarios) {
    const { key, name, state, members } = scenario;
    const groupId = id(`group:${key}`);
    await db.query("insert into santa.groups(id,owner_id,name) values($1,$2,$3) on conflict(id) do nothing", [groupId, users.get(members[0]), name]);
    const exchange = key === "closed" ? day(-4) : day(35);
    const draw = key === "closed" ? day(-24) : day(state === "draft" || state === "scheduled" ? 3 : -1);
    await addEdition(scenario, groupId, id(`edition:${key}`), draw, exchange);
    if (key === "family") {
      const historicExchange = new Date(exchange);
      historicExchange.setUTCFullYear(historicExchange.getUTCFullYear() - 1);
      const historicDraw = new Date(historicExchange.valueOf() - 14 * 86_400_000);
      const historicMatches = members.map((giver, index) => [giver, members[(index + 2) % members.length]]);
      await addEdition({ ...scenario, matches: historicMatches }, groupId, id("edition:family:previous"), historicDraw, historicExchange, true);
    }
  }
  for (const [slug] of people) {
    for (const [index, [name, description, links = []]] of giftsFor(slug).entries()) {
      await db.query("insert into santa.gifts(id,owner_id,name,description,links) values($1,$2,$3,$4,$5) on conflict(id) do nothing",
        [id(`gift:${slug}:${index}`), users.get(slug), name, description, JSON.stringify(links)]);
    }
  }
  for (const [index, state] of [[1, "reserved"], [2, "bought"]]) {
    const [name, description, links] = leaGifts[index];
    await db.query("insert into santa.claims(id,gift_id,edition_id,giver_id,state,expires_at,snapshot) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing",
      [id(`claim:${index}`), id(`gift:lea:${index}`), id("edition:friends"), users.get("nora"), state, day(12), JSON.stringify({ name, description, links })]);
  }
  await db.query("commit");
  console.log(`Préproduction peuplée. ${people.length} comptes, ${scenarios.length + 1} éditions et ${people.reduce((sum, [slug]) => sum + giftsFor(slug).length, 0)} idées fictives.`);
} catch (error) {
  await db.query("rollback").catch(() => {});
  console.error(error.code ? `Peuplement impossible (${error.code}).` : error.message);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
