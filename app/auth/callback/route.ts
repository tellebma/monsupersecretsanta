import { NextRequest, NextResponse } from "next/server";
import { appOrigin, nextPath } from "@/lib/format";
import { configured, session } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = nextPath(request.cookies.get("santa-oauth-next")?.value);
  if (code && configured()) {
    const db = await session();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, appOrigin()));
      response.cookies.set("santa-oauth-next", "", { path: "/auth/callback", maxAge: 0 });
      return response;
    }
  }
  const retry = new URL("/connexion", appOrigin());
  retry.searchParams.set("erreur", "oauth");
  retry.searchParams.set("next", next);
  return NextResponse.redirect(retry);
}
