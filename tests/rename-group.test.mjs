import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const [owner, participant] = [1, 2].map((n) => `00000000-0000-4000-8000-00000000000${n}`);

test("only the owner can rename a group across editions and pending notifications", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
    for (const file of ["202611090001_initial.sql", "20261118195815_rename_groups.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    for (const id of [owner, participant]) await db.query("insert into auth.users values($1,$2)", [id, `${id}@example.com`]);
    const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
    const asUser = async (id, role = "authenticated") => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
      await db.exec(`set role ${role}`);
    };
    await asUser(owner);
    const edition = await scalar("select santa_create_edition(null,'Famille',now()+interval '1 day',now()+interval '20 days',25)");
    const group = (await scalar("select santa_edition($1)", [edition])).group_id;
    await scalar("select santa_invite($1,$2)", [edition, ["invite@example.com"]]);
    await asUser(null, "service_role");
    // An authenticated role with an empty subject is also rejected.
    await asUser(null);
    await assert.rejects(scalar("select santa_rename_group($1,'Intrus')", [group]), /Connectez-vous/);
    await asUser(participant);
    await assert.rejects(scalar("select santa_rename_group($1,'Intrus')", [group]), /Groupe inaccessible/);
    await asUser(null, "anon");
    await assert.rejects(scalar("select santa_rename_group($1,'Intrus')", [group]), /permission denied/);
    await db.exec("reset role");
    const second = await scalar(`insert into santa.editions(group_id,year,draw_at,exchange_at,state)
      values($1,2099,now()+interval '2 days',now()+interval '30 days','drawn') returning id`, [group]);
    await db.query("insert into santa.members values($1,$2,'Participant','participant@example.com',true)", [edition, participant]);
    await db.query(`insert into santa.outbox(event_key,kind,email,payload,sent_at) values
      ('draw:pending','draw','pending@example.com',jsonb_build_object('edition',$1::text,'group','Famille'),null),
      ('draw:sent','draw','sent@example.com',jsonb_build_object('edition',$1::text,'group','Famille'),now()),
      ('unrelated','draw','other@example.com','{"group":"Autre groupe"}',null)`, [second]);
    await asUser(owner);
    for (const invalid of [null, "   ", "x".repeat(101)]) await assert.rejects(scalar("select santa_rename_group($1,$2)", [group, invalid]), /entre 1 et 100/);
    await scalar("select santa_rename_group($1,$2)", [group, "  Noël & amis  "]);
    assert.equal((await scalar("select santa_edition($1)", [edition])).name, "Noël & amis");
    assert.equal((await scalar("select santa_edition($1)", [second])).name, "Noël & amis");
    await asUser(participant);
    assert.equal((await scalar("select santa_edition($1)", [edition])).name, "Noël & amis");
    await db.exec("reset role");
    const mail = (await db.query("select event_key,payload->>'group' as name from santa.outbox")).rows;
    assert.ok(mail.filter(({ event_key }) => event_key.startsWith("invite:") || event_key === "draw:pending").every(({ name }) => name === "Noël & amis"));
    assert.equal(mail.find(({ event_key }) => event_key === "draw:sent").name, "Famille");
    assert.equal(mail.find(({ event_key }) => event_key === "unrelated").name, "Autre groupe");
    assert.equal(await scalar("select state from santa.editions where id=$1", [second]), "drawn");
  } finally { await db.close(); }
});
