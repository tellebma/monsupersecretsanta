import { loadBuffer } from "cheerio";
import { publicMerchantUrl, readMerchantPage } from "./merchant-http";
import { uniqueCatalogProducts, type CatalogProduct } from "./gift-catalog";

function productLink(value: unknown, origin: URL) {
  if (typeof value !== "string") return null;
  try {
    const url = publicMerchantUrl(new URL(value, origin).href);
    if (!url || url.hostname !== origin.hostname) return null;
    const path = origin.hostname === "www.fnac.com" ? /\/a\d+(?:\/|$)/ : /^\/ref\/\d+$/;
    if (!path.test(url.pathname)) return null;
    url.search = "";
    return url.href;
  } catch {
    return null;
  }
}

function imageLink(value: unknown, origin: URL) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return publicMerchantUrl(new URL(value, origin).href)?.href;
  } catch {
    return undefined;
  }
}

function structuredProducts(value: unknown, origin: URL, depth = 0): CatalogProduct[] {
  if (!value || typeof value !== "object" || depth > 10) return [];
  if (Array.isArray(value)) return value.flatMap((item) => structuredProducts(item, origin, depth + 1));
  const node = value as Record<string, unknown>;
  const url = productLink(node.url, origin);
  const products: CatalogProduct[] = [];
  if (url && typeof node.name === "string" && node.name.trim()) {
    const image = [node.image].flat()[0];
    const source = image && typeof image === "object" ? (image as Record<string, unknown>).url : image;
    products.push({ url, name: node.name.trim().slice(0, 200), image: imageLink(source, origin) });
  }
  return products.concat(Object.values(node).flatMap((child) => structuredProducts(child, origin, depth + 1)));
}

export function productsFromSearchHtml(html: Buffer, origin: URL): CatalogProduct[] {
  const $ = loadBuffer(html);
  const products: CatalogProduct[] = [];
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      products.push(...structuredProducts(JSON.parse($(script).text()), origin));
    } catch {
      // A malformed block does not invalidate the other product cards.
    }
  }
  if (origin.hostname === "www.fnac.com") {
    for (const element of $("article.Article-itemGroup").toArray()) {
      const card = $(element);
      const url = card.find("a[href]").toArray().map((link) => productLink($(link).attr("href"), origin)).find(Boolean);
      const image = card.find("img.Article-itemVisualImg").first();
      const name = image.attr("alt")?.trim();
      if (url && name) products.push({
        url, name: name.slice(0, 200),
        image: imageLink(image.attr("data-lazyimage"), origin) ?? imageLink(image.attr("src"), origin),
      });
    }
  }
  return uniqueCatalogProducts(products, 12);
}

export async function searchMerchantCatalog(query: string, readPage = readMerchantPage) {
  const fnac = new URL("https://www.fnac.com/SearchResult/ResultList.aspx");
  fnac.search = new URLSearchParams({ Search: query, SCat: "0!1" }).toString();
  const boulanger = new URL("https://www.boulanger.com/resultats");
  boulanger.search = new URLSearchParams({ tr: query }).toString();
  const signal = AbortSignal.timeout(6500);
  const results = await Promise.allSettled([fnac, boulanger].map(async (url) => {
    const page = await readPage(url, signal);
    if (!page || !("html" in page)) throw new Error("Catalogue marchand indisponible.");
    return productsFromSearchHtml(page.html, url);
  }));
  if (results.every((result) => result.status === "rejected")) throw new Error("Recherche marchande indisponible.");
  return uniqueCatalogProducts(results.flatMap((result) => result.status === "fulfilled" ? result.value : []), 24);
}
