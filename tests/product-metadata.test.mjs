import assert from "node:assert/strict";
import { test } from "node:test";
import { importProductMetadata } from "../lib/product-metadata.ts";

test("recovers a LEGO image only when the set number matches exactly", async () => {
  const url = "https://www.lego.com/fr-fr/product/dragon-ball-shenron-goku-11390";
  const importer = async () => null;
  const checkImage = async () => false;
  const image = "https://images.boutique.fr/11390.jpg";
  const search = async (query) => {
    assert.equal(query, "LEGO 11390");
    return [{ name: "LEGO Icons 11390 Shenron", image, url: "https://www.fnac.com/lego/a123/w-4" }];
  };
  assert.deepEqual(await importProductMetadata(url, { importer, search, checkImage }), { url, name: "LEGO Icons 11390 Shenron", image });
  assert.deepEqual(await importProductMetadata(url, { importer, checkImage: async () => true }), {
    url, image: "https://www.lego.com/cdn/product-assets/product.img.pri/11390_Prod.png",
  });
  const idealo = "https://www.idealo.fr/prix/207082072/lego-super-mario-game-boy-72046.html";
  assert.deepEqual(await importProductMetadata(idealo, { importer, checkImage: async () => true }), {
    url: idealo, image: "https://www.lego.com/cdn/product-assets/product.img.pri/72046_Prod.png",
  });
  assert.equal(await importProductMetadata(url, {
    importer, checkImage, search: async () => [{ name: "LEGO 113900", image }],
  }), null);
  assert.equal(await importProductMetadata("https://autre.fr/produit-11390", {
    importer, search: async () => { throw new Error("Must not search"); },
  }), null);
});
