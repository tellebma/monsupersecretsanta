import { searchBraveCatalog } from "@/lib/brave-gift-search";
import { catalogQuery, findCatalogProducts, uniqueCatalogProducts, type CatalogProduct } from "@/lib/gift-catalog";
import { configured, session, workerClient } from "@/lib/supabase";
import type { Gift } from "@/lib/types";

function reply(products: CatalogProduct[], status: "ok" | "unavailable", code = 200) {
  return Response.json({ products, status }, { status: code, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  if (!configured()) return reply([], "unavailable", 401);
  const db = await session();
  const { data } = await db.auth.getClaims();
  const accountId = data?.claims.sub;
  if (!accountId) return reply([], "unavailable", 401);

  const query = catalogQuery(new URL(request.url).searchParams.get("q"));
  if (!query) return reply([], "ok", 400);
  if (/https?:\/\//i.test(query)) return reply([], "ok");

  const { data: gifts, error } = await db.rpc("santa_my_gifts");
  const local = findCatalogProducts(query, Array.isArray(gifts) ? gifts as Gift[] : []);
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (local.length >= 8 || process.env.BRAVE_SEARCH_ENABLED !== "true" || !key || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return reply(local, error && !local.length ? "unavailable" : "ok");
  }

  try {
    const { data: permitted } = await workerClient().rpc("santa_take_catalog_search_budget", { p_account: accountId });
    if (permitted !== true) return reply(local, local.length ? "ok" : "unavailable");
    const external = await searchBraveCatalog(query, key, request.signal);
    return reply(uniqueCatalogProducts([...local, ...external]), "ok");
  } catch {
    return reply(local, local.length ? "ok" : "unavailable");
  }
}
