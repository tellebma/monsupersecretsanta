import { load, loadBuffer } from "cheerio";
import { safeLink } from "./format";
import { publicMerchantUrl, readMerchantPage } from "./merchant-http";
import type { Link } from "./types";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
}

function findProduct(value: unknown, depth = 0): RecordValue | undefined {
  if (depth > 12) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      const product = findProduct(item, depth + 1);
      if (product) return product;
    }
    return;
  }
  const node = record(value);
  if (!node) return;
  const types = [node["@type"]].flat();
  // Prefer the event itself over its nested ticket category (also typed Product).
  if (types.some((type) => typeof type === "string" && /(?:^|\/)(?:Product|\w*Event)$/.test(type))) return node;
  for (const child of Object.values(node)) {
    const product = findProduct(child, depth + 1);
    if (product) return product;
  }
}

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) || undefined : undefined;
}

export function productFromHtml(html: string | Buffer, url: URL, merchantCanonicalOnly = false): Link | null {
  const $ = typeof html === "string" ? load(html) : loadBuffer(html);
  const meta = (key: string) => $(`meta[property="${key}"], meta[name="${key}"], meta[itemprop="${key}"]`).first().attr("content");
  let product: RecordValue | undefined;
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      product = findProduct(JSON.parse($(script).text()));
    } catch {
      continue;
    }
    if (product) break;
  }
  const name = text(product?.name ?? meta("og:title") ?? $("#productTitle").text(), 200);
  const offers = record([product?.offers].flat()[0]);
  const priceText = offers?.price ?? offers?.lowPrice ?? meta("product:price:amount") ?? meta("price") ??
    $("#corePrice_feature_div .a-offscreen").first().text().replace(/[^0-9,.]/g, "");
  const amount = typeof priceText === "number" ? priceText : Number(String(priceText ?? "").replace(",", "."));
  const price = priceText !== "" && priceText != null && Number.isFinite(amount) && amount >= 0 ? amount : undefined;
  if (!name || (!product && !meta("product:price:amount") && meta("og:type") !== "product" && !$("#productTitle").length)) return null;
  let productUrl = url.href;
  if (merchantCanonicalOnly) {
    const declared = [$('link[rel~="canonical"]').first().attr("href"), meta("og:url"), product?.url];
    let canonical: URL | null = null;
    for (const value of declared) {
      if (typeof value !== "string" || !value.trim() || value.length > 2048) continue;
      try {
        const candidate = publicMerchantUrl(new URL(value, url).href);
        if (candidate?.hostname === url.hostname) { canonical = candidate; break; }
      } catch { /* Try the next declared product URL. */ }
    }
    if (!canonical) return null;
    productUrl = canonical.href;
  }
  const landingImage = $("#landingImage, #imgBlkFront, img[itemprop='image']").first();
  const imageCandidates = [
    ...[product?.image].flat().map((source) => record(source)?.url ?? record(source)?.contentUrl ?? source),
    meta("og:image:secure_url"), meta("og:image"), meta("twitter:image"),
    landingImage.attr("data-old-hires"), landingImage.attr("data-src"),
    landingImage.attr("data-lazyimage"), landingImage.attr("src"),
    $('link[rel="image_src"]').attr("href"),
  ];
  let image: string | undefined;
  for (const candidate of imageCandidates) {
    const rawImage = text(candidate, 2048);
    if (!rawImage) continue;
    try {
      image = publicMerchantUrl(new URL(rawImage, url).href)?.href;
      if (image) break;
    } catch { /* Try the next image supplied by the merchant. */ }
  }
  return {
    url: productUrl,
    name,
    description: text(product?.description ?? meta("og:description") ?? meta("description"), 1500),
    image,
    price,
    currency: text(offers?.priceCurrency ?? meta("product:price:currency") ?? meta("priceCurrency"), 3),
    availability: text(offers?.availability ?? meta("product:availability") ?? meta("availability"), 100),
  };
}

export async function importProduct(value: string, {
  signal: callerSignal,
  merchantCanonicalOnly = false,
  readPage = readMerchantPage,
}: {
  signal?: AbortSignal;
  merchantCanonicalOnly?: boolean;
  readPage?: typeof readMerchantPage;
} = {}) {
  const original = safeLink(value);
  let url = publicMerchantUrl(value);
  if (!original || !url) return null;
  const timeout = AbortSignal.timeout(6500);
  const signal = callerSignal ? AbortSignal.any([timeout, callerSignal]) : timeout;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const page = await readPage(url, signal);
    if (!page) return null;
    if ("redirect" in page) {
      url = publicMerchantUrl(new URL(page.redirect, url).href);
      if (!url) return null;
      continue;
    }
    const product = productFromHtml(page.html, url, merchantCanonicalOnly);
    return product && (merchantCanonicalOnly ? product : { ...product, url: original.href });
  }
  return null;
}
