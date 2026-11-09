import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drawAssignments } from "../lib/draw.ts";
import { parisInstant } from "../lib/format.ts";

const [host, first, second, recipient] = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-00000000000${n}`);

test("finds valid draws and reports impossible constraints", () => {
  const result = drawAssignments(["a", "b", "c"], [["a", "c"], ["b", "a"], ["c", "b"]]);
  assert.deepEqual(result?.sort((a, b) => a.giver.localeCompare(b.giver)),
    [{ giver: "a", receiver: "b" }, { giver: "b", receiver: "c" }, { giver: "c", receiver: "a" }]);
  assert.equal(drawAssignments(["a", "b"], [["a", "b"]]), null);
});

test("matches every feasible graph of four participants", () => {
  const members = ["a", "b", "c", "d"];
  const edges = members.flatMap((giver) => members.filter((receiver) => giver !== receiver).map((receiver) => [giver, receiver]));
  function possible(allowed, index = 0, receivers = new Set()) {
    if (index === members.length) return true;
    return allowed.some(([giver, receiver]) => giver === members[index] && !receivers.has(receiver) &&
      possible(allowed, index + 1, new Set([...receivers, receiver])));
  }
  for (let mask = 0; mask < 2 ** edges.length; mask++) {
    const blocked = edges.filter((_, index) => mask & (1 << index));
    const allowed = edges.filter((_, index) => !(mask & (1 << index)));
    const result = drawAssignments(members, blocked);
    assert.equal(Boolean(result), possible(allowed), `graph ${mask}`);
    if (result) {
      assert.equal(new Set(result.map(({ giver }) => giver)).size, members.length);
      assert.equal(new Set(result.map(({ receiver }) => receiver)).size, members.length);
      assert.ok(result.every(({ giver, receiver }) => allowed.some(([a, b]) => a === giver && b === receiver)));
    }
  }
});

test("uses Paris time and rejects a nonexistent local time", () => {
  assert.equal(parisInstant("2026-12-24T18:00"), "2026-12-24T17:00:00.000Z");
  assert.equal(parisInstant("2027-06-01T18:00"), "2027-06-01T16:00:00.000Z");
  assert.throws(() => parisInstant("2027-03-28T02:30"));
});

test("verifies invitations, keeps draws private, and reserves gifts across groups", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text not null, email_confirmed_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202611090001_initial.sql", import.meta.url), "utf8"));
    const query = async (sql, params = []) => (await db.query(sql, params)).rows;
    const scalar = async (sql, params) => Object.values((await query(sql, params))[0])[0];
    async function user(id, role = id ? "authenticated" : null) {
      await db.exec("reset role");
      await query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
      if (role) await db.exec(`set role ${role}`);
    }
    const call = (name, params = []) => scalar(`select santa_${name}(${params.map((_, i) => `$${i + 1}`).join(",")})`, params);
    for (const [id, email] of [[host, "host"], [first, "first"], [second, "apple"], [recipient, "recipient"]]) {
      await query("insert into auth.users(id,email) values ($1,$2)", [id, `${email}@example.com`]);
    }
    async function edition(name, giver, email) {
      await user(host);
      const id = await scalar("select santa_create_edition(null,$1,now()+interval '1 hour',now()+interval '20 days',25)", [name]);
      assert.equal(await call("invite", [id, [email, "recipient@example.com"]]), 2);
      await user();
      const tokens = new Map((await query("select email,payload->>'token' as token from santa.outbox where kind='invite' and payload->>'group'=$1", [name]))
        .map((item) => [item.email, item.token]));
      await user(giver);
      let joined = await call("join", [tokens.get(email), "Donneur", null]);
      if (giver === second) {
        assert.equal(joined.status, "code_sent");
        assert.equal((await call("join", [tokens.get(email), "Donneur", "BADCODE"])).status, "bad_code");
        await user();
        const code = await scalar("select payload->>'code' from santa.outbox where kind='invite_code' and email=$1", [email]);
        await user(giver);
        joined = await call("join", [tokens.get(email), "Donneur", code]);
      }
      assert.equal(joined.status, "joined");
      await user(recipient);
      assert.equal((await call("join", [tokens.get("recipient@example.com"), "Destinataire", null])).status, "joined");
      await user(host);
      await query("select santa_configure($1,now()+interval '1 hour',now()+interval '20 days',25,$2,'[]',true)", [id, [giver, recipient]]);
      await user();
      await query("update santa.editions set draw_at=now()-interval '1 minute' where id=$1", [id]);
      await user(null, "service_role");
      const job = (await call("due_draws")).find((item) => item.id === id);
      const args = [id, job.version, JSON.stringify(drawAssignments(job.members, job.blocked))];
      assert.equal(await call("finish_draw", args), true);
      assert.equal(await call("finish_draw", args), false);
      return id;
    }

    const a = await edition("Famille", first, "first@example.com");
    const b = await edition("Amis", second, "masked-original@example.com");
    await user(host);
    assert.equal((await call("edition", [a])).recipient, null);
    await assert.rejects(() => query("select * from santa.draws"), /permission denied/);
    await assert.rejects(() => call("due_draws"), /permission denied/);
    await assert.rejects(() => query("select santa_configure($1,now(),now()+interval '1 day',null,'{}','[]',false)", [a]), /définitif/);
    await user(recipient);
    const gift = await call("save_gift", [null, "Livre", "Une édition illustrée", "[]"]);
    await user(first);
    assert.deepEqual(await call("recipient_gifts", [a]), []);
    await call("reveal", [a]);
    assert.equal((await call("edition", [a])).recipient, "Destinataire");
    await call("claim", [a, gift, "reserve"]);
    await user(second);
    await call("reveal", [b]);
    const [reserved] = await call("recipient_gifts", [b]);
    assert.equal(reserved.status, "unavailable");
    assert.equal(reserved.mine, false);
    assert.equal("giver" in reserved || "expires_at" in reserved, false);
    await assert.rejects(() => call("claim", [b, gift, "reserve"]), /déjà indisponible/);
    await user();
    assert.equal(await scalar("select extract(epoch from expires_at-now()) between 1209590 and 1209600 from santa.claims"), true);
    assert.equal(await scalar("select extract(epoch from due_at-now()) between 431990 and 432000 from santa.outbox where kind='reservation'"), true);
    await query("update santa.claims set expires_at=now()-interval '1 second' where gift_id=$1", [gift]);
    await user(second);
    await call("claim", [b, gift, "reserve"]);
    await call("claim", [b, gift, "release"]);
    await call("claim", [b, gift, "reserve"]);
    await user(recipient);
    await call("save_gift", [gift, "Nouveau titre", "Une description modifiée", "[]"]);
    assert.equal((await call("my_gifts"))[0].status, null);
    await call("remove_gift", [gift]);
    await user(second);
    assert.equal((await call("recipient_gifts", [b]))[0].name, "Livre");
    await call("claim", [b, gift, "buy"]);
    await user();
    await query("update santa.gifts set archived=false where id=$1", [gift]);
    await user(first);
    assert.equal((await call("recipient_gifts", [a]))[0].status, "bought");
    await user(recipient);
    assert.equal((await call("my_gifts"))[0].status, null);
    await user();
    await query("update santa.editions set draw_at=now()-interval '2 days',exchange_at=now()-interval '1 day' where id=$1", [b]);
    await user(recipient);
    assert.equal((await call("my_gifts"))[0].status, "bought");
    await user(null, "service_role");
    const mail = await call("due_mail");
    assert.ok(mail.some((job) => job.kind === "draw"));
    assert.equal((await call("due_mail")).length, 0);
    await call("mail_result", [mail[0].id, mail[0].attempts, true]);
    await user();
    assert.deepEqual(await scalar("select payload from santa.outbox where id=$1", [mail[0].id]), {});
    const [{ group_id, year }] = await query("select group_id,year from santa.editions where id=$1", [a]);
    for (let years = 1; years <= 4; years++) {
      const id = await scalar("insert into santa.editions(group_id,year,draw_at,exchange_at) values($1,$2,now(),now()+interval '1 day') returning id", [group_id, year + years]);
      const blocked = await query("select * from santa.blocked($1)", [id]);
      assert.equal(blocked.some((pair) => pair.giver_id === first && pair.receiver_id === recipient), years <= 3);
    }
  } finally {
    await db.close();
  }
});
