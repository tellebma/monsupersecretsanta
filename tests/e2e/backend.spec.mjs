import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { demoEmail } from "../../scripts/preprod-data.mjs";

const connect = async () => {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  return client;
};

test("exécute le tirage programmé et envoie les notifications sans dévoiler les attributions", async ({ request }) => {
  const db = await connect();
  const messages = [];
  const transport = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    messages.push({ ...JSON.parse(Buffer.concat(chunks).toString()), key: req.headers["idempotency-key"] });
    res.writeHead(200, { "Content-Type": "application/json" }).end('{"id":"fake-delivery"}');
  });
  transport.listen(3101, "127.0.0.1");
  try {
    await once(transport, "listening");
    const people = (await db.query("select id,email from auth.users where email=any($1) order by email", [
      [demoEmail("hugo"), demoEmail("jules"), demoEmail("lina")],
    ])).rows;
    expect(people).toHaveLength(3);
    const group = randomUUID();
    const edition = randomUUID();
    const name = "Tirage programmé QA " + edition.slice(0, 6);
    await db.query("insert into santa.groups(id,owner_id,name) values($1,$2,$3)", [group, people[0].id, name]);
    await db.query(`insert into santa.editions(id,group_id,year,draw_at,exchange_at,state)
      values($1,$2,extract(year from now()),now()-interval '1 minute',now()+interval '20 days','scheduled')`, [edition, group]);
    for (const person of people) {
      await db.query("insert into santa.members(edition_id,user_id,name,email) values($1,$2,$3,$4)",
        [edition, person.id, person.email.split("@")[0], person.email]);
    }
    const headers = { Authorization: `Bearer ${process.env.SCHEDULE_SECRET}` };
    expect((await request.post("/api/schedule", { headers })).status()).toBe(200);
    expect((await request.post("/api/schedule", { headers })).status()).toBe(200);
    const draws = (await db.query("select giver_id,receiver_id,revealed from santa.draws where edition_id=$1", [edition])).rows;
    expect(draws).toHaveLength(3);
    expect(draws.every((draw) => draw.giver_id !== draw.receiver_id && !draw.revealed)).toBe(true);
    const notifications = messages.filter(({ subject }) => subject.includes(name));
    expect(notifications).toHaveLength(3);
    expect(new Set(notifications.map(({ key }) => key)).size).toBe(3);
    for (const message of notifications) {
      expect(message.text).toContain("pour découvrir ton destinataire");
      expect(message.text).not.toMatch(/hugo|jules|lina/i);
    }
    const queued = await db.query("select kind,count(*)::int as count from santa.outbox where payload->>'edition'=$1 group by kind order by kind", [edition]);
    expect(queued.rows).toEqual([{ kind: "empty", count: 3 }, { kind: "exchange", count: 3 }]);
  } finally {
    transport.closeAllConnections();
    await new Promise((resolve) => transport.close(resolve));
    await db.end();
  }
});

test("une course de réservation sur PostgreSQL ne produit qu’un gagnant", async () => {
  const admin = await connect();
  const connections = await Promise.all([connect(), connect()]);
  try {
    const targets = (await admin.query(`select d.edition_id,d.giver_id,g.id as gift
      from santa.draws d join santa.editions e on e.id=d.edition_id
      join santa.groups sg on sg.id=e.group_id
      join santa.gifts g on g.owner_id=d.receiver_id
      where g.name='Écharpe en laine' and sg.name in ('Noël en famille','Noël entre amis') and e.exchange_at>now()
      order by sg.name`)).rows;
    expect(targets).toHaveLength(2);
    const attempt = async (client, target, action) => {
      await client.query("begin");
      try {
        await client.query("select set_config('request.jwt.claim.sub',$1,true)", [target.giver_id]);
        await client.query("set local role authenticated");
        await client.query("select santa_reveal($1)", [target.edition_id]);
        await client.query("select santa_claim($1,$2,$3)", [target.edition_id, target.gift, action]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    };
    const results = await Promise.allSettled(connections.map((client, index) => attempt(client, targets[index], "reserve")));
    const winners = results.map((result, index) => result.status === "fulfilled" ? index : -1).filter((index) => index >= 0);
    expect(winners).toHaveLength(1);
    const loser = results.find((result) => result.status === "rejected");
    expect(loser?.reason.message).toMatch(/déjà indisponible/);
    await attempt(connections[winners[0]], targets[winners[0]], "release");
  } finally {
    await Promise.all([admin, ...connections].map((client) => client.end()));
  }
});
