import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { nextPath } from "../lib/format.ts";

test("selected names survive authentication without accepting arbitrary redirect targets", () => {
  const path = `/invitation/${"a".repeat(64)}`;
  const selected = `${path}?participant=00000000-0000-4000-8000-000000000002`;
  assert.equal(nextPath(selected), selected);
  assert.equal(nextPath(path), path);
  for (const value of [`https://evil.example${selected}`, `//evil.example${selected}`, `${selected}&next=https://evil.example`,
    `${path}?participant=not-a-uuid`, `${selected}#fragment`, `${path}?name=Camille`]) assert.equal(nextPath(value), "/groupes");
});

test("one shared link claims named places once, keeps contacts private and respects ownership and closure", async () => {
  const db = new PGlite();
  const [host, camille, lea, stranger] = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text not null,
        raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    `);
    for (const file of ["202611090001_initial.sql", "202611100003_remove_members.sql",
      "20261118180656_invitation_preview.sql", "20261118182034_shared_group_invitations.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    for (const [id, name] of [[host, "Maxime"], [camille, "Camille"], [lea, "Léa"], [stranger, "Autre"]]) {
      await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
        [id, `${id}@example.com`, JSON.stringify({ full_name: name })]);
    }
    const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
    const call = (name, ...params) => scalar(`select public.santa_${name}(${params.map((_, i) => `$${i + 1}`).join(",")})`, params);
    async function user(id, role = id ? "authenticated" : null) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
      if (role) await db.exec(`set role ${role}`);
    }
    await user(host);
    const edition = await call("create_edition", null, "Noël entre amis", new Date(Date.now() + 3600000), new Date(Date.now() + 86400000), 25);
    assert.equal(await call("shared_invitation", edition), null);
    await assert.rejects(call("add_invitation_names", edition, [""]), /Chaque nom/);
    assert.equal(await call("shared_invitation", edition), null);
    await call("add_invitation_names", edition, [" Camille ", "Léa", "camille"]);
    let invitation = await call("shared_invitation", edition);
    assert.equal(invitation.participants.length, 2);
    assert.match(invitation.token, /^[a-f0-9]{64}$/);
    const token = invitation.token;
    const camilleSlot = invitation.participants.find(({ name }) => name === "Camille").id;
    const leaSlot = invitation.participants.find(({ name }) => name === "Léa").id;
    await call("add_invitation_names", edition, ["Thomas"]);
    invitation = await call("shared_invitation", edition);
    assert.equal(invitation.token, token);
    const thomasSlot = invitation.participants.find(({ name }) => name === "Thomas").id;
    await user(null, "anon");
    await assert.rejects(call("shared_invitation", edition), /permission denied/);
    await assert.rejects(call("invitation_preview", token), /permission denied/);
    await assert.rejects(call("join_shared", token, camilleSlot), /permission denied/);
    await user(stranger);
    await assert.rejects(call("shared_invitation", edition), /Groupe inaccessible/);
    await assert.rejects(call("add_invitation_names", edition, ["Intrus"]), /Groupe inaccessible/);
    await assert.rejects(call("remove_invitation_name", edition, camilleSlot), /Groupe inaccessible/);
    await assert.rejects(db.query("select * from santa.invitation_names"), /permission denied/);
    await user(null, "service_role");
    let preview = await call("invitation_preview", token);
    assert.equal(preview.organizer, "Maxime");
    assert.equal(preview.shared, true);
    assert.ok(preview.participants.every(({ available }) => available));
    assert.equal(JSON.stringify(preview).includes("example.com"), false);
    assert.equal(JSON.stringify(preview).includes("user_id"), false);
    assert.equal(await call("invitation_preview", "b".repeat(64)), null);
    await user(camille);
    assert.equal(await call("edition", edition), null); // Choosing a name has not granted membership.
    assert.equal((await call("join_shared", token, stranger)).status, "invalid");
    assert.equal((await call("join_shared", "bad-token", camilleSlot)).status, "invalid");
    assert.equal((await call("join_shared", token, camilleSlot)).status, "joined");
    assert.equal((await call("join_shared", token, camilleSlot)).status, "joined"); // Retry is idempotent.
    assert.equal((await call("join_shared", token, leaSlot)).status, "already_member");
    await user(lea);
    assert.equal((await call("join_shared", token, camilleSlot)).status, "taken");
    await user();
    await db.query("update auth.users set email_confirmed_at=null where id=$1", [lea]);
    await user(lea);
    await assert.rejects(call("join_shared", token, leaSlot), /Vérifiez votre adresse mail/);
    await user();
    await db.query("update auth.users set email_confirmed_at=now() where id=$1", [lea]);
    await user(lea);
    assert.equal((await call("join_shared", token, leaSlot)).status, "joined");
    await user(host);
    assert.equal((await call("edition", edition)).members.find(({ id }) => id === camille).name, "Camille");
    await assert.rejects(call("remove_invitation_name", edition, camilleSlot), /déjà été choisi/);
    await call("remove_invitation_name", edition, thomasSlot);
    await call("configure", edition, new Date(Date.now() + 3600000), new Date(Date.now() + 86400000), 25, [camille, lea], "[]", true);
    await assert.rejects(call("add_invitation_names", edition, ["Retardataire"]), /Rouvrez/);
    await user(null, "service_role");
    preview = await call("invitation_preview", token);
    assert.equal(preview.open, false);
    assert.deepEqual(preview.participants, []);
    await user(host);
    await call("configure", edition, new Date(Date.now() + 3600000), new Date(Date.now() + 86400000), 25, [camille, lea], "[]", false);
    await call("remove_member", edition, camille);
    assert.equal((await call("shared_invitation", edition)).participants.some(({ id }) => id === camilleSlot), false);
    await user(camille);
    assert.equal((await call("join_shared", token, camilleSlot)).status, "invalid");
    assert.equal(await call("edition", edition), null);
    await user(null, "authenticated");
    await assert.rejects(call("join_shared", token, leaSlot), /Connectez-vous/);
    await user(host);
    await call("invite", edition, ["personal@example.com"]);
    await user();
    const personalToken = await scalar("select payload->>'token' from santa.outbox where kind='invite' and email='personal@example.com'");
    await user(null, "service_role");
    const personalPreview = await call("invitation_preview", personalToken);
    assert.equal(personalPreview.group, "Noël entre amis");
    assert.equal(personalPreview.shared, undefined);
  } finally {
    await db.close();
  }
});
