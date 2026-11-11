import { configured, session } from "@/lib/supabase";
import { publicMerchantUrl } from "@/lib/merchant-http";
import { cachedProductMetadata } from "@/lib/product-metadata";
import { safeProductImage } from "@/lib/format";

function reply(image: string | null, status = 200) {
  return Response.json({ image }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  if (!configured()) return reply(null, 401);
  const db = await session();
  const { data } = await db.auth.getClaims();
  if (!data?.claims.sub) return reply(null, 401);
  const url = publicMerchantUrl(new URL(request.url).searchParams.get("url") ?? "");
  if (!url) return reply(null, 400);
  const product = await cachedProductMetadata(url.href).catch(() => null);
  return reply(safeProductImage(product?.image)?.href ?? null);
}
