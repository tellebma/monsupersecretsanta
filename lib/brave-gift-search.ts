import { safeLink } from "./format";
import { importProduct } from "./merchants";
import type { CatalogProduct } from "./gift-catalog";

const productPaths: Record<string, RegExp> = {
  "amazon.fr": /\/(?:dp|gp\/product)\//,
  "boulanger.com": /^\/ref\/\d+/,
  "decathlon.fr": /^\/p\//,
  "fnac.com": /\/a\d+(?:\/|$)/,
  "ikea.com": /^\/fr\/fr\/p\//,
  "lego.com": /^\/fr-fr\/product\//,
  "kiabi.com": /_P\d+/i,
  "hm.com": /\/productpage\./,
  "zara.com": /-p\d+\.html$/,
};

type BraveResult = { url?: unknown; product?: unknown; schemas?: unknown; family_friendly?: boolean };

function productSchema(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const type = (value as Record<string, unknown>)["@type"];
  return (Array.isArray(type) ? type : [type]).some((entry) => typeof entry === "string" && /(?:^|\/)Product(?:Group)?$/.test(entry));
}

export async function requestBraveCandidates(query: string, key: string, signal: AbortSignal) {
  const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
  endpoint.search = new URLSearchParams({
    q: `acheter ${query}`,
    country: "FR",
    search_lang: "fr",
    ui_lang: "fr-FR",
    safesearch: "strict",
    operators: "false",
    result_filter: "web",
    count: "20",
  }).toString();
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    cache: "no-store",
    redirect: "error",
    signal,
  });
  if (!response.ok) throw new Error("Recherche externe indisponible.");

  const payload = await response.json() as { web?: { results?: BraveResult[] } };
  const candidates = new Set<string>();
  for (const result of payload.web?.results ?? []) {
    const url = safeLink(result.url);
    if (!url || url.protocol !== "https:" || url.port || result.family_friendly === false) continue;
    const merchant = url.hostname.replace(/^(?:www\d*|m)\./, "");
    const knownProductPage = productPaths[merchant]?.test(url.pathname);
    const structuredProduct = result.product || (Array.isArray(result.schemas) && result.schemas.some(productSchema));
    if (!knownProductPage && !structuredProduct) continue;
    url.hash = "";
    candidates.add(url.href);
    if (candidates.size === 6) break;
  }
  return [...candidates];
}

export async function searchBraveCatalog(query: string, key: string, signal: AbortSignal): Promise<CatalogProduct[]> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(3_500)]);
  const candidates = await requestBraveCandidates(query, key, requestSignal);
  const products = await Promise.allSettled(candidates.map((url) => importProduct(url, { signal, merchantCanonicalOnly: true })));
  // The provider discovers candidates. Everything shown and saved comes directly from the merchant page.
  return products.flatMap((result) => {
    if (result.status !== "fulfilled" || !result.value?.name) return [];
    return [{ ...result.value, name: result.value.name }];
  });
}
