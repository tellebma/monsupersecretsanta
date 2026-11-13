import assert from "node:assert/strict";
import { test } from "node:test";
import { productsFromSearchHtml, searchMerchantCatalog, searchThemeCatalog } from "../lib/merchant-search.ts";
import { giftTheme, giftThemes } from "../lib/gift-themes.ts";

test("thematic discovery uses live bestseller pages and falls back without claiming a ranking", async () => {
  const html = Buffer.from('<article class="Article-itemGroup"><a href="/jeu/a123/w-4">Jeu</a><img class="Article-itemVisualImg" alt="Jeu du moment"></article>');
  for (const id of ["jeux", "livres"]) {
    const theme = giftTheme(id);
    const selection = await searchThemeCatalog(theme, async (url) => {
      assert.equal(url.href, theme.bestSellers);
      return { html };
    });
    assert.equal(selection.products[0].name, "Jeu du moment");
    assert.equal(selection.source.url, theme.bestSellers);
  }
  const queries = [];
  const fallback = await searchThemeCatalog(giftTheme("jeux"), async (url) => {
    if (url.pathname.startsWith("/l163007")) return { html: Buffer.from("Page sans produits") };
    queries.push(url.searchParams.get("Search") ?? url.searchParams.get("tr"));
    return { html };
  });
  assert.equal(fallback.source, undefined);
  assert.deepEqual(queries, ["jeux de société", "jeux de société"]);
  assert.equal(fallback.products.length, 1);
  assert.equal(giftTheme("inconnu"), undefined);
  assert.equal(new Set(giftThemes.map(({ id }) => id)).size, giftThemes.length);
});

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
