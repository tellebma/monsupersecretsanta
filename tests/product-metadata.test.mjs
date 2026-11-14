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
  assert.deepEqual(await importProductMetadata(url, { importer, search, checkImage }), { url, name: "LEGO Icons 11390 Shenron", image, description: undefined });
  assert.deepEqual(await importProductMetadata(url, { importer, search: async () => [], checkImage: async () => true }), {
    url, name: "LEGO dragon ball shenron goku 11390", description: undefined, image: "https://www.lego.com/cdn/product-assets/product.img.pri/11390_Prod.png",
  });
  const idealo = "https://www.idealo.fr/prix/207082072/lego-super-mario-game-boy-72046.html";
  assert.deepEqual(await importProductMetadata(idealo, { importer, search: async () => [], checkImage: async () => true }), {
    url: idealo, name: "LEGO super mario game boy 72046", description: undefined, image: "https://www.lego.com/cdn/product-assets/product.img.pri/72046_Prod.png",
  });
  const mismatch = await importProductMetadata(url, {
    importer, checkImage, search: async () => [{ name: "LEGO 113900", image }],
  });
  assert.equal(mismatch.image, undefined);
  assert.equal(mismatch.name, "LEGO dragon ball shenron goku 11390");
  assert.equal(await importProductMetadata("https://autre.fr/produit-11390", {
    importer, search: async () => { throw new Error("Must not search"); },
  }), null);
});

test("completes LEGO metadata despite an existing image and preserves the original offer", async () => {
  const url = "https://www.lego.com/en-us/product/shenron-11390?CMP=affiliate";
  const original = { url, image: "https://www.lego.com/photo.png", price: 99, currency: "USD" };
  const importer = async (value) => value === url ? original : {
    url: value, name: "LEGO 11390 Shenron", description: "Un dragon à construire.", price: 80, currency: "EUR",
  };
  const result = await importProductMetadata(url, {
    importer,
    checkImage: async () => { throw new Error("Image already available"); },
    search: async () => [{ name: "LEGO 11390 Shenron", url: "https://www.fnac.com/produit" }],
  });
  assert.deepEqual(result, { ...original, name: "LEGO 11390 Shenron", description: "Un dragon à construire." });
});

test("LEGO fallback survives unavailable services without changing complete products", async () => {
  const url = "https://www.lego.com/fr-fr/product/11390";
  const result = await importProductMetadata(url, {
    importer: async () => { throw new Error("Blocked"); },
    checkImage: async () => { throw new Error("Timeout"); },
    search: async () => { throw new Error("Unavailable"); },
  });
  assert.equal(result.name, "LEGO 11390");
  assert.equal(result.image, undefined);
  const complete = { url, name: "Shenron", description: "Dragon", image: "https://www.lego.com/photo.png" };
  assert.equal(await importProductMetadata(url, {
    importer: async () => complete,
    search: async () => { throw new Error("Should not search"); },
  }), complete);
});
