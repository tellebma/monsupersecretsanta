import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("invitation preview only reveals names for an active token through the server role", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text not null,
        raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    `);
    for (const file of ["202611090001_initial.sql", "20261118185026_invitation_preview.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    const host = "00000000-0000-4000-8000-000000000001";
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'host@example.com',$2)",
      [host, JSON.stringify({ full_name: "Maxime" })]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [host]);
    await db.exec("set role authenticated");
    const edition = (await db.query(`select santa_create_edition(null,'Les amis',
      now()+interval '1 hour',now()+interval '20 days',25) as id`)).rows[0].id;
    await db.query("select santa_invite($1,array['guest@example.com'])", [edition]);
    await db.exec("reset role");
    const token = (await db.query("select payload->>'token' as token from santa.outbox where kind='invite'")).rows[0].token;
    const preview = async (value = token) => (await db.query("select santa_invitation_preview($1) as data", [value])).rows[0].data;
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(preview(), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.deepEqual(await preview(), { group: "Les amis", organizer: "Maxime" });
    assert.equal(await preview("a".repeat(64)), null);
    assert.equal(await preview("bad-token"), null);
    await db.exec("reset role");
    await db.query("select santa_add_host($1,'Max')", [edition]);
    assert.equal((await preview()).organizer, "Max");
    await db.query("update santa.editions set state='scheduled' where id=$1", [edition]);
    assert.equal(await preview(), null);
    await db.query("update santa.editions set state='blocked' where id=$1", [edition]);
    assert.ok(await preview());
    await db.query("update santa.invites set accepted_by=$1", [host]);
    assert.equal(await preview(), null);
  } finally {
    await db.close();
  }
});
