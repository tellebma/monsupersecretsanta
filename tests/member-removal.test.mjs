import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const [host, alex, lea, sam] = [1, 2, 3, 4].map((id) => `00000000-0000-4000-8000-00000000000${id}`);
const addresses = new Map([[host, "host"], [alex, "alex"], [lea, "lea"], [sam, "sam"]]
  .map(([id, name]) => [id, `${name}@example.com`]));

test("member removal revokes access, respects draw state and invalidates old worker jobs", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text not null, email_confirmed_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    `);
    for (const file of ["202611090001_initial.sql", "202611100003_remove_members.sql", "202611130001_wishlist_counts.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    for (const [id, email] of addresses) await db.query("insert into auth.users(id,email) values($1,$2)", [id, email]);

    async function asUser(id, role = id ? "authenticated" : null) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
      if (role) await db.exec(`set role ${role}`);
    }

    async function call(name, ...params) {
      const query = `select public.santa_${name}(${params.map((_, index) => `$${index + 1}`).join(",")}) as result`;
      const result = await db.query(query, params);
      return result.rows[0].result;
    }

    const draw = new Date(Date.now() + 3_600_000).toISOString();
    const exchange = new Date(Date.now() + 20 * 86_400_000).toISOString();
    await asUser(host);
    const edition = await call("create_edition", null, "Famille", draw, exchange, null);
    await call("add_host", edition, "Hôte");
    assert.equal(await call("invite", edition, [addresses.get(alex), addresses.get(lea), addresses.get(sam)]), 3);
    await asUser();
    const invites = (await db.query("select email,payload->>'token' as token from santa.outbox where kind='invite'")).rows;
    const tokens = new Map(invites.map(({ email, token }) => [email, token]));
    for (const id of [alex, lea, sam]) {
      await asUser(id);
      assert.equal((await call("join", tokens.get(addresses.get(id)), addresses.get(id), null)).status, "joined");
    }

    await asUser();
    await db.query(`insert into santa.gifts(owner_id,name,description,archived) values
      ($1,'Livre','Un livre',false),
      ($1,'Ancien souhait','Archivé',true),
      ($2,'Jeu','Un jeu',false),
      ($2,'Puzzle','Un puzzle',false)`, [host, lea]);
    await asUser(host);
    const withCounts = await call("edition", edition);
    assert.deepEqual(Object.fromEntries(withCounts.members.map(({ id, gift_count }) => [id, gift_count])),
      { [host]: 1, [alex]: 0, [lea]: 2, [sam]: 0 });

    await asUser(lea);
    assert.equal((await call("edition", edition)).members, undefined);
    await assert.rejects(call("remove_member", edition, alex), /Groupe inaccessible/);
    await asUser(host);
    await call("configure", edition, draw, exchange, null, [host, alex, lea, sam], JSON.stringify([[alex, lea], [host, sam]]), false);
    assert.deepEqual(await call("remove_member", edition, alex), { state: "draft", reopened: false });
    const draft = await call("edition", edition);
    assert.deepEqual(draft.exceptions, [[host, sam]]);
    assert.deepEqual(draft.members.map(({ id }) => id).sort(), [host, lea, sam]);

    await asUser(alex);
    assert.equal(await call("edition", edition), null);
    assert.deepEqual(await call("groups"), []);
    assert.deepEqual(await call("join", tokens.get(addresses.get(alex)), "Alex", null), { status: "invalid" });

    await asUser(host);
    assert.equal(await call("invite", edition, [addresses.get(alex)]), 1);
    await asUser();
    const freshToken = (await db.query("select payload->>'token' as token from santa.outbox where kind='invite' and email=$1", [addresses.get(alex)])).rows[0].token;
    assert.notEqual(freshToken, tokens.get(addresses.get(alex)));
    await asUser(alex);
    assert.equal((await call("join", freshToken, "Alex", null)).status, "joined");

    await asUser(host);
    await call("configure", edition, draw, exchange, null, [host, alex, lea, sam], "[]", true);
    await asUser();
    await db.query("update santa.editions set draw_at=now()-interval '1 minute' where id=$1", [edition]);
    await asUser(null, "service_role");
    const [staleJob] = await call("due_draws");
    assert.equal(staleJob.members.length, 4);
    await asUser(host);
    assert.deepEqual(await call("remove_member", edition, alex), { state: "scheduled", reopened: false });
    await asUser(null, "service_role");
    assert.equal(await call("finish_draw", edition, staleJob.version, null), false);
    const [updatedJob] = await call("due_draws");
    assert.equal(updatedJob.version, staleJob.version + 1);
    assert.equal(updatedJob.members.includes(alex), false);

    await asUser(host);
    assert.deepEqual(await call("remove_member", edition, host), { state: "scheduled", reopened: false });
    const scheduled = await call("edition", edition);
    assert.equal(scheduled.owner, true);
    assert.equal(scheduled.members.some(({ id }) => id === host), false);
    assert.deepEqual(await call("remove_member", edition, lea), { state: "draft", reopened: true });
    const reopened = await call("edition", edition);
    assert.equal(reopened.draw_at, scheduled.draw_at);
    assert.equal(reopened.exchange_at, scheduled.exchange_at);
    await assert.rejects(call("remove_member", edition, lea), /déjà été retiré/);
    await asUser(null, "service_role");
    assert.deepEqual(await call("due_draws"), []);

    await asUser(host);
    await call("add_host", edition, "Hôte");
    await call("configure", edition, draw, exchange, null, [host, sam], "[]", true);
    await asUser();
    await db.query("update santa.editions set draw_at=now()-interval '1 minute' where id=$1", [edition]);
    await asUser(null, "service_role");
    const [finalJob] = await call("due_draws");
    assert.equal(await call("finish_draw", edition, finalJob.version,
      JSON.stringify([{ giver: host, receiver: sam }, { giver: sam, receiver: host }])), true);
    await asUser(host);
    await assert.rejects(call("remove_member", edition, sam), /tirage est définitif/);
    assert.deepEqual((await call("edition", edition)).members.map(({ id }) => id).sort(), [host, sam]);
  } finally {
    await db.close();
  }
});
