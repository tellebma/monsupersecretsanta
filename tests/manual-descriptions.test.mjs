import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("clears imported descriptions, preserves personal text and reservation details, and is idempotent", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema santa;
      create table santa.gifts(id int primary key, description text not null, links jsonb not null, archived boolean default false);
      create table santa.claims(id int primary key, snapshot jsonb not null, state text);`);
    const links = [{ url: "https://boutique.fr/1", description: "Publicité" }, { url: "https://boutique.fr/2", description: "Détails marchands", price: 25 }];
    for (const [id, description] of [[1, "Détails marchands"], [2, "Couleur bleue, taille M"], [3, ""], [4, "Détails marchands, mais en bleu"]]) {
      await db.query("insert into santa.gifts values ($1,$2,$3,$4)", [id, description, JSON.stringify(links), id === 1]);
      await db.query("insert into santa.claims values ($1,$2,'reserved')", [id, JSON.stringify({ name: "Mon cadeau", description, links, custom: "keep" })]);
    }
    await db.query("insert into santa.gifts values (5,'À la main','[]',false)");
    const sql = await readFile(new URL("../supabase/maintenance/clear-imported-descriptions.sql", import.meta.url), "utf8");
    assert.deepEqual((await db.query(sql)).rows, [{ gifts_updated: 4, gift_descriptions_cleared: 1, reservations_updated: 4, reservation_descriptions_cleared: 1 }]);
    const cleanedLinks = links.map(({ description, ...link }) => link);
    const gifts = (await db.query("select * from santa.gifts order by id")).rows;
    assert.deepEqual(gifts.map(({ description }) => description), ["", "Couleur bleue, taille M", "", "Détails marchands, mais en bleu", "À la main"]);
    assert.equal(gifts[0].archived, true);
    assert.deepEqual(gifts[0].links, cleanedLinks);
    const claims = (await db.query("select * from santa.claims order by id")).rows;
    assert.deepEqual(claims[0].snapshot, { name: "Mon cadeau", description: "", links: cleanedLinks, custom: "keep" });
    assert.equal(claims[1].snapshot.description, "Couleur bleue, taille M");
    assert.ok(claims.every(({ state }) => state === "reserved"));
    assert.deepEqual((await db.query(sql)).rows, [{ gifts_updated: 0, gift_descriptions_cleared: 0, reservations_updated: 0, reservation_descriptions_cleared: 0 }]);
  } finally { await db.close(); }
});
