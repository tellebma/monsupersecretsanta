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
  await assert.rejects(searchMerchantCatalog("casque", async () => null), /indisponible/);
});
