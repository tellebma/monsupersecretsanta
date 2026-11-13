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

function legoReference(url: URL) {
  if (/^(?:www\.)?lego\.com$/i.test(url.hostname)) {
    return /^\/[a-z]{2}-[a-z]{2}\/product\/(?:[a-z0-9-]+-)?(\d{4,7})\/?$/i.exec(url.pathname)?.[1];
  }
  if (/^(?:www\.)?idealo\.fr$/i.test(url.hostname)) {
    return /^\/prix\/\d+\/lego-[a-z0-9-]+-(\d{4,7})\.html$/i.exec(url.pathname)?.[1];
  }
}

export async function importProductMetadata(value: string, {
  importer = importProduct,
  search = searchMerchantCatalog,
  checkImage = imageExists,
} = {}) {
  const product = await importer(value).catch(() => null);
  const url = safeLink(value);
  if (!url) return product;
  const setNumber = legoReference(url);
  if (!setNumber) return product;
  if (product?.name && product.description && safeProductImage(product.image)) return product;
  const officialImage = `https://www.lego.com/cdn/product-assets/product.img.pri/${setNumber}_Prod.png`;
  const [hasOfficialImage, candidates] = await Promise.all([
    safeProductImage(product?.image) ? false : checkImage(officialImage).catch(() => false),
    product?.name && product.description ? [] : search(`LEGO ${setNumber}`).catch(() => []),
  ]);
  const matching = candidates.find((item) => /\blego\b/i.test(item.name) && new RegExp(`\\b${setNumber}\\b`).test(item.name));
  const details = matching && !product?.description ? await importer(matching.url).catch(() => null) : null;
  // Retailer prices and stock do not describe the original LEGO/idealo offer.
  const image = safeProductImage(product?.image)?.href ?? (hasOfficialImage ? officialImage : undefined) ??
    safeProductImage(matching?.image)?.href;
  const slug = url.pathname.split("/").filter(Boolean).pop()!
    .replace(/\.html$/i, "").replace(new RegExp(`(?:^|-)${setNumber}$`), "").replace(/-/g, " ");
  const fallbackName = `LEGO ${slug.replace(/^lego\s+/i, "")} ${setNumber}`.replace(/\s+/g, " ").trim().slice(0, 200);
  return {
    ...product,
    url: product?.url ?? url.href,
    name: product?.name || matching?.name || fallbackName,
    description: product?.description || details?.description,
    image,
  };
}

export const cachedProductMetadata = unstable_cache((url: string) => importProductMetadata(url), ["gift-product-metadata-v3"], { revalidate: 900 });
