import { load } from "cheerio";
import { safeLink } from "./format";
import type { Link } from "./types";

const retailers = [
  "amazon.fr", "boulanger.com", "fnac.com", "decathlon.fr", "ikea.com", "zara.com", "kiabi.com", "hm.com",
];
const hostnames = new Set(retailers.flatMap((host) => [host, `www.${host}`]).concat("m.boulanger.com", "www2.hm.com"));
const maxBytes = 2_500_000;

function merchantUrl(value: string) {
  const url = safeLink(value);
  return url && url.protocol === "https:" && !url.port && hostnames.has(url.hostname) ? url : null;
}

async function documentText(response: Response) {
  if (!response.body || Number(response.headers.get("content-length")) > maxBytes) throw new Error("Page trop volumineuse.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) return html + decoder.decode();
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Page trop volumineuse.");
    }
    html += decoder.decode(value, { stream: true });
  }
}

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
  if (types.some((type) => typeof type === "string" && /(?:^|\/)Product$/.test(type))) return node;
  for (const child of Object.values(node)) {
    const product = findProduct(child, depth + 1);
    if (product) return product;
  }
}

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) || undefined : undefined;
}

export function productFromHtml(html: string, url: URL): Link | null {
  const $ = load(html);
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
  const imageSource = [product?.image].flat()[0];
  const rawImage = text(record(imageSource)?.url ?? record(imageSource)?.contentUrl ?? imageSource ??
    meta("og:image") ?? $("#landingImage").attr("src"), 2048);
  let image: string | undefined;
  if (rawImage) {
    try {
      image = safeLink(new URL(rawImage, url).href)?.href;
    } catch { /* The rest of the product is usable. */ }
  }
  return {
    url: url.href,
    name,
    description: text(product?.description ?? meta("og:description") ?? meta("description"), 1500),
    image,
    price,
    currency: text(offers?.priceCurrency ?? meta("product:price:currency") ?? meta("priceCurrency"), 3),
    availability: text(offers?.availability ?? meta("product:availability") ?? meta("availability"), 100),
  };
}

export async function importProduct(value: string) {
  let url = merchantUrl(value);
  if (!url) return null;
  const signal = AbortSignal.timeout(6500);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response: Response = await fetch(url, {
      redirect: "manual",
      signal,
      cache: "no-store",
      headers: { "Accept-Language": "fr-FR,fr;q=0.9", Accept: "text/html,application/xhtml+xml" },
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      const location: string | null = response.headers.get("location");
      url = location && merchantUrl(new URL(location, url).href) || null;
      if (!url) return null;
      continue;
    }
    if (!response.ok || !response.headers.get("content-type")?.includes("html")) return null;
    const product = productFromHtml(await documentText(response), url);
    return product && { ...product, url: value };
  }
  return null;
}
