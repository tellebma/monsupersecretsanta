import assert from "node:assert/strict";
import { test } from "node:test";
import { productsFromSearchHtml, searchMerchantCatalog } from "../lib/merchant-search.ts";

test("reads multiple merchant results with real images and rejects unrelated links", () => {
  const html = Buffer.from(`<script type="application/ld+json">${JSON.stringify({
    "@type": "ItemList", itemListElement: [
      { url: "/ref/123", name: "Casque A", image: "https://images.boutique.fr/a.jpg" },
      { item: { url: "/ref/456", name: "Casque B", image: "/b.jpg" } },
      { url: "https://autre.fr/ref/789", name: "Autre boutique" },
      { url: "/resultats?tr=casque", name: "Page de recherche" },
    ],
  })}</script>`);
  const products = productsFromSearchHtml(html, new URL("https://www.boulanger.com/resultats?tr=casque"));
  assert.equal(products.length, 2);
  assert.equal(products[1].image, "https://www.boulanger.com/b.jpg");
  const fnac = Buffer.from('<article class="Article-itemGroup"><a href="/Carnet/a123/w-4?oref=suivi">Lien</a><img class="Article-itemVisualImg" src="data:image/gif;base64,x" data-lazyimage="https://images.boutique.fr/carnet.jpg" alt="Carnet"></article>');
  assert.deepEqual(productsFromSearchHtml(fnac, new URL("https://www.fnac.com/SearchResult/ResultList.aspx")), [{
    url: "https://www.fnac.com/Carnet/a123/w-4", name: "Carnet", image: "https://images.boutique.fr/carnet.jpg",
  }]);
});

test("keeps the available merchant results when another merchant fails", async () => {
  const visited = [];
  const products = await searchMerchantCatalog("casque & audio", async (url) => {
    visited.push(url);
    if (url.hostname === "www.fnac.com") throw new Error("Indisponible");
    return { html: Buffer.from('<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"url":"/ref/123","name":"Casque","image":"/image.jpg"}]}</script>') };
  });
  assert.equal(products.length, 1);
  assert.equal(visited[0].searchParams.get("Search"), "casque & audio");
  assert.equal(visited[1].searchParams.get("tr"), "casque & audio");
  assert.equal(visited[2].searchParams.get("q"), "casque & audio");
  await assert.rejects(searchMerchantCatalog("casque", async () => null), /indisponible/);
});

test("reads Truffaut product microdata and ignores navigation and external links", () => {
  const card = (href, name, image) => `<li class="product-item" itemprop="itemListElement">
    <a href="${href}" itemprop="item" itemtype="https://schema.org/Product">
      <meta itemprop="name" content="${name}">
      <span itemprop="image"><meta itemprop="url" content="${image}"></span>
      <img class="product-image-photo" src="data:image/gif;base64,placeholder">
    </a></li>`;
  const html = Buffer.from('<meta charset="utf-8">' + [
    card("/orchidee-123.html?tracking=ignored", "Orchidée", "https://images.truffaut.com/orchidee.jpg"),
    card("/cache-pot-ceramique.html", "Cache-pot", "/pot.jpg"),
    card("https://autre.fr/plante-789.html", "Autre boutique", "/x.jpg"),
    '<a href="/plantes.html">Plantes</a>',
  ].join(""));
  assert.deepEqual(productsFromSearchHtml(html, new URL("https://www.truffaut.com/catalogsearch/result/?q=orchidee")), [
    { url: "https://www.truffaut.com/orchidee-123.html", name: "Orchidée", image: "https://images.truffaut.com/orchidee.jpg" },
    { url: "https://www.truffaut.com/cache-pot-ceramique.html", name: "Cache-pot", image: "https://www.truffaut.com/pot.jpg" },
  ]);
});

test("includes each merchant before applying the 24-product limit", async () => {
  const products = await searchMerchantCatalog("cadeau", async (url) => {
    const paths = {
      "www.fnac.com": (rank) => `/Cadeau/a${100 + rank}/w-4`,
      "www.boulanger.com": (rank) => `/ref/${200 + rank}`,
      "www.truffaut.com": (rank) => `/orchidee-${300 + rank}.html`,
    };
    const items = Array.from({ length: 12 }, (_, rank) => ({
      url: paths[url.hostname](rank), name: `Cadeau ${rank}`, image: "/image.jpg",
    }));
    return { html: Buffer.from(`<script type="application/ld+json">${JSON.stringify({ "@type": "ItemList", itemListElement: items })}</script>`) };
  });
  assert.equal(products.length, 24);
  assert.deepEqual(products.slice(0, 3).map(({ url }) => new URL(url).hostname), [
    "www.fnac.com", "www.boulanger.com", "www.truffaut.com",
  ]);
  assert.equal(products.filter(({ url }) => new URL(url).hostname === "www.truffaut.com").length, 8);
});
