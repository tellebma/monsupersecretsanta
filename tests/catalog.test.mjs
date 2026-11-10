import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { catalogQuery, findCatalogProducts } from "../lib/gift-catalog.ts";
import { requestBraveCandidates } from "../lib/brave-gift-search.ts";

test("finds curated products with French accents, plurals and ignored connecting words", () => {
  const query = catalogQuery("  tasses   en  gres  ");
  assert.equal(query, "tasses en gres");
  const results = findCatalogProducts(query);
  assert.equal(results.length, 1);
  assert.match(results[0].name, /STRIMMIG/);
  assert.match(results[0].image, /^https:\/\/www\.ikea\.com\//);
  assert.match(results[0].url, /\/p\/strimmig/);
  assert.equal(results[0].price, undefined);
  assert.equal(catalogQuery("x"), null);
  assert.equal(catalogQuery("x".repeat(101)), null);
  assert.deepEqual(findCatalogProducts("sdfuhrindgd"), []);
});

test("returns matching saved links, without duplicates or unsafe protocols", () => {
  const gifts = [{
    name: "Carnet de voyage", description: "À spirale",
    links: [
      { url: "https://example.org/carnet#details" },
      { url: "https://example.org/carnet" },
      { url: "javascript:alert(1)" },
    ],
  }];
  assert.deepEqual(findCatalogProducts("carnet", gifts), [{
    name: "Carnet de voyage", description: "À spirale", url: "https://example.org/carnet",
  }]);
  assert.deepEqual(findCatalogProducts("carnet"), []);
});

test("Brave discovery returns only candidate product URLs without snippets", async (context) => {
  const results = [
    { url: "https://www.fnac.com/jeu/a123/w-4#reviews", title: "A snippet the API must never return" },
    { url: "https://example.org/article", description: "Unrelated article" },
    { url: "https://example.org/product", schemas: [{ "@type": ["Thing", "https://schema.org/Product"] }] },
    { url: "https://example.org:8443/product", product: {} },
    { url: "https://example.org/excluded", product: {}, family_friendly: false },
    { url: "https://www.fnac.com/jeu/a123/w-4" },
  ];
  const fetch = context.mock.method(globalThis, "fetch", async () => Response.json({ web: { results } }));
  assert.deepEqual(await requestBraveCandidates("jeu de société", "test-key", new AbortController().signal), [
    "https://www.fnac.com/jeu/a123/w-4", "https://example.org/product",
  ]);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url.hostname, "api.search.brave.com");
  assert.equal(url.searchParams.get("q"), "acheter jeu de société");
  assert.equal(url.searchParams.get("country"), "FR");
  assert.equal(options.cache, "no-store");
  assert.equal(options.headers["X-Subscription-Token"], "test-key");
});

test("the external search budget is limited by account and global month", async () => {
  const db = new PGlite();
  const migration = await readFile(new URL("../supabase/migrations/202611100002_catalog_search_limits.sql", import.meta.url), "utf8");
  const accountId = "fa32db66-25fe-4103-b470-58d594200427";
  try {
    await db.exec("create schema santa; create role anon; create role authenticated; create role service_role;");
    await db.exec(migration);
    await db.exec("set role authenticated;");
    await assert.rejects(db.query("select public.santa_take_catalog_search_budget($1)", [accountId]), /permission denied/);
    await db.exec("set role service_role;");
    async function take() {
      const result = await db.query("select public.santa_take_catalog_search_budget($1) as accepted", [accountId]);
      return result.rows[0].accepted;
    }
    for (let attempt = 0; attempt < 25; attempt++) assert.equal(await take(), true);
    assert.equal(await take(), false);
    await db.exec("reset role; update santa.catalog_search_budget set period = period - 1 where bucket like 'account:%'; update santa.catalog_search_budget set requests = 1000 where bucket = 'global'; set role service_role;");
    assert.equal(await take(), false);
    await db.exec("reset role; update santa.catalog_search_budget set period = period - 1 where bucket = 'global'; set role service_role;");
    assert.equal(await take(), true);
  } finally {
    await db.close();
  }
});
