import assert from "node:assert/strict";
import { test } from "node:test";
import { importProduct, productFromHtml } from "../lib/merchants.ts";
import { nextPath, safeLink } from "../lib/format.ts";

const productUrl = "https://www.fnac.com/produit";

test("reads product JSON-LD with localized prices, offer and relative image", () => {
  const html = `<script type="application/ld+json">{oops}</script>
  <script type="application/ld+json">{"@graph":[{"@type":["Thing","Product"],"name":"Carnet","image":{"url":"/photo.jpg"},"offers":[{"price":"14,90","priceCurrency":"EUR","availability":"https://schema.org/InStock"}]}]}</script>`;
  const product = productFromHtml(html, new URL(productUrl));
  assert.equal(product.name, "Carnet");
  assert.equal(product.price, 14.9);
  assert.equal(product.currency, "EUR");
  assert.equal(product.image, "https://www.fnac.com/photo.jpg");
  assert.equal(product.availability, "https://schema.org/InStock");
});

test("handles a product without pricing and refuses generic pages and unsafe images", () => {
  const url = new URL(productUrl);
  assert.equal(productFromHtml('<meta property="og:title" content="Accueil">', url), null);
  const product = productFromHtml('<meta property="og:type" content="product"><meta property="og:title" content="Carnet"><meta property="og:image" content="javascript:alert(1)">', url);
  assert.equal(product.name, "Carnet");
  assert.equal(product.price, undefined);
  assert.equal(product.image, undefined);
});

test("rejects off-site redirects and non-retailer hosts before fetching them", async (context) => {
  const fetch = context.mock.method(globalThis, "fetch", async () => new Response(null, {
    status: 302, headers: { Location: "http://127.0.0.1:54321/" },
  }));
  assert.equal(await importProduct("https://fnac.com.example.org/produit"), null);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(await importProduct(productUrl), null);
  assert.equal(fetch.mock.callCount(), 1);
});

test("only accepts ordinary product URLs and same-site invitation returns", () => {
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink("https://user:secret@example.com/"), null);
  assert.equal(safeLink("https://example.com/").hostname, "example.com");
  assert.equal(nextPath("//example.com/connexion"), "/groupes");
  const invitation = "/invitation/" + "a".repeat(64);
  assert.equal(nextPath(invitation), invitation);
  assert.equal(nextPath(invitation + "?external=true"), "/groupes");
});
