import assert from "node:assert/strict";
import { test } from "node:test";
import { importProduct, productFromHtml } from "../lib/merchants.ts";
import { importFailureKey, isPublicAddress, publicMerchantUrl } from "../lib/merchant-http.ts";
import { nextPath, safeLink } from "../lib/format.ts";

const productUrl = "https://www.fnac.com/produit";

test("imports a show as an event instead of its nested ticket category", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@type": "ComedyEvent", name: "Une comédie", description: "Un spectacle à Lyon",
    image: "/spectacle.jpg", offers: [{ "@type": "AggregateOffer", lowPrice: "20.00", priceCurrency: "EUR",
      itemOffered: { "@type": "Product", name: "Catégorie unique - Assis" } }],
  })}</script>`;
  const result = productFromHtml(html, new URL("https://www.fnacspectacles.com/event/spectacle/"));
  assert.equal(result.name, "Une comédie");
  assert.equal(result.description, "Un spectacle à Lyon");
  assert.equal(result.price, 20);
  assert.equal(result.currency, "EUR");
  assert.equal(result.image, "https://www.fnacspectacles.com/spectacle.jpg");
});

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

test("uses another merchant image when the first one is empty or unsafe", () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"Carnet","image":["data:image/gif;base64,placeholder",{"contentUrl":"/photo.jpg"}]}</script>';
  assert.equal(productFromHtml(html, new URL(productUrl)).image, "https://www.fnac.com/photo.jpg");
  const amazon = '<span id="productTitle">Livre</span><meta property="og:image" content=""><img id="landingImage" src="data:image/gif;base64,placeholder" data-old-hires="https://images.boutique.fr/livre.jpg">';
  assert.equal(productFromHtml(amazon, new URL("https://www.amazon.fr/dp/TEST")).image, "https://images.boutique.fr/livre.jpg");
});

test("imports other public merchant domains and revalidates redirect destinations", async () => {
  const visited = [];
  const readPage = async (url) => {
    visited.push(url.href);
    if (url.hostname === "boutique.fr") return { redirect: "https://catalogue.boutique.fr/produit" };
    return { html: Buffer.from('<script type="application/ld+json">{"@type":"Product","name":"Carnet"}</script>') };
  };
  const original = "http://boutique.fr/article";
  assert.equal((await importProduct(original, { readPage }))?.url, original);
  assert.deepEqual(visited, ["https://boutique.fr/article", "https://catalogue.boutique.fr/produit"]);
  assert.equal(await importProduct(productUrl, { readPage: async () => ({ redirect: "https://127.0.0.1/" }) }), null);
});

test("catalogue imports use a product URL declared by the merchant", () => {
  const url = new URL(productUrl);
  const product = '<script type="application/ld+json">{"@type":"Product","name":"Carnet"}</script>';
  assert.equal(productFromHtml(product, url, true), null);
  assert.equal(productFromHtml(product + '<link rel="canonical" href="https://autre.fr/produit">', url, true), null);
  assert.equal(productFromHtml(product + '<link rel="canonical" href="/offre/123">', url, true)?.url, "https://www.fnac.com/offre/123");
});

test("rejects internal hosts and IP ranges used for server-side request forgery", () => {
  for (const url of ["https://localhost/", "https://service.internal/", "https://127.1/", "https://[::1]/", "https://shop.fr:8443/"]) {
    assert.equal(publicMerchantUrl(url), null, url);
  }
  assert.equal(publicMerchantUrl("https://fr.shein.com/produit"), null);
  for (const address of ["127.0.0.1", "10.0.1.1", "169.254.169.254", "100.64.0.1", "::ffff:192.168.0.1", "fc00::1", "64:ff9b::127.0.0.1"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  for (const address of ["1.1.1.1", "2606:4700::1"]) assert.equal(isPublicAddress(address), true);
});

test("normalizes failed imports without retaining tracking or secret query parameters", () => {
  assert.deepEqual(importFailureKey("http://boutique.fr/produit?utm_source=x&token=secret&sku=456&id=12#section"), {
    url: "https://boutique.fr/produit?id=12&sku=456", merchant: "boutique.fr",
  });
  assert.equal(importFailureKey("https://shop.fr/produit?id=abc%20def").url, "https://shop.fr/produit");
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
