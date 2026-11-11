import { safeLink, safeProductImage } from "./format";
import { importProduct } from "./merchants";
import { searchMerchantCatalog } from "./merchant-search";
import { unstable_cache } from "next/cache";

async function imageExists(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "error", signal: AbortSignal.timeout(2500) });
    return response.ok && Boolean(response.headers.get("content-type")?.startsWith("image/"));
  } catch {
    return false;
  }
}

export async function importProductMetadata(value: string, {
  importer = importProduct,
  search = searchMerchantCatalog,
  checkImage = imageExists,
} = {}) {
  const product = await importer(value).catch(() => null);
  if (safeProductImage(product?.image)) return product;
  const url = safeLink(value);
  if (!url || !/^(?:www\.)?lego\.com$/i.test(url.hostname)) return product;
  const setNumber = /^\/fr-fr\/product\/[a-z0-9-]+-(\d{4,7})\/?$/i.exec(url.pathname)?.[1];
  if (!setNumber) return product;
  const officialImage = `https://www.lego.com/cdn/product-assets/product.img.pri/${setNumber}_Prod.png`;
  if (await checkImage(officialImage)) return product ? { ...product, image: officialImage } : { url: url.href, image: officialImage };
  const candidates = await search(`LEGO ${setNumber}`).catch(() => []);
  const matching = candidates.find((item) => /\blego\b/i.test(item.name) && new RegExp(`\\b${setNumber}\\b`).test(item.name));
  const image = safeProductImage(matching?.image)?.href;
  if (!matching || !image) return product;
  return product ? { ...product, image } : { url: url.href, name: matching.name, image };
}

export const cachedProductMetadata = unstable_cache((url: string) => importProductMetadata(url), ["gift-product-metadata-v2"], { revalidate: 900 });
