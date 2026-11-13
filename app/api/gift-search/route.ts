import { searchBraveCatalog } from "@/lib/brave-gift-search";
import { unstable_cache } from "next/cache";
import { searchMerchantCatalog, searchThemeCatalog } from "@/lib/merchant-search";
import { giftTheme } from "@/lib/gift-themes";
import { catalogQuery, findCatalogProducts, uniqueCatalogProducts, type CatalogProduct } from "@/lib/gift-catalog";
import { configured, session, workerClient } from "@/lib/supabase";
import type { Gift } from "@/lib/types";

const merchantSearch = unstable_cache((query: string) => searchMerchantCatalog(query), ["gift-merchants-v1"], { revalidate: 900 });
const themeSearch = unstable_cache((id: string) => {
  const theme = giftTheme(id);
  if (!theme) throw new Error("Thématique inconnue.");
  return searchThemeCatalog(theme);
}, ["gift-themes-v1"], { revalidate: 900 });

function reply(products: CatalogProduct[], status: "ok" | "unavailable" | "limited", code = 200, source?: { label: string; url: string }) {
  return Response.json({ products, status, ...(source ? { source } : {}) }, { status: code, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  if (!configured()) return reply([], "unavailable", 401);
  const db = await session();
  const { data } = await db.auth.getClaims();
  const accountId = data?.claims.sub;
  if (!accountId) return reply([], "unavailable", 401);

  const parameters = new URL(request.url).searchParams;
  const theme = giftTheme(parameters.get("theme"));
  if (parameters.has("theme") && !theme) return reply([], "ok", 400);
  const query = theme?.query ?? catalogQuery(parameters.get("q"));
  if (!query) return reply([], "ok", 400);
  if (/https?:\/\//i.test(query)) return reply([], "ok");

  const { data: gifts, error } = await db.rpc("santa_my_gifts");
  if (theme) {
    const local = uniqueCatalogProducts([theme.query, ...theme.ideas].flatMap((term) =>
      findCatalogProducts(term, Array.isArray(gifts) ? gifts as Gift[] : [])), 24);
    const selection = await themeSearch(theme.id).catch(() => null);
    return reply(selection?.source ? selection.products : uniqueCatalogProducts([...(selection?.products ?? []), ...local], 24), selection ? "ok" : "unavailable", 200, selection?.source);
  }
  const local = findCatalogProducts(query, Array.isArray(gifts) ? gifts as Gift[] : []);
  const merchantProducts = await merchantSearch(query).catch(() => null);
  const products = uniqueCatalogProducts([...(merchantProducts ?? []), ...local], 24);
  const status = merchantProducts === null || (error && !products.length) ? "unavailable" : "ok";
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (products.length >= 8 || process.env.BRAVE_SEARCH_ENABLED !== "true" || !key || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return reply(products, status);
  }

  try {
    const { data: permitted } = await workerClient().rpc("santa_take_catalog_search_budget", { p_account: accountId });
    if (permitted !== true) return reply(products, "limited");
    const external = await searchBraveCatalog(query, key, request.signal);
    return reply(uniqueCatalogProducts([...products, ...external], 24), "ok");
  } catch {
    return reply(products, status);
  }
}
