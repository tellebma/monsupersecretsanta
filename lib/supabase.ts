import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export function configured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export async function socialProviderStatus(provider: "google" | "apple") {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!projectUrl || !key) return undefined;

  try {
    const response = await fetch(new URL("/auth/v1/settings", projectUrl), {
      cache: "no-store",
      headers: { apikey: key },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return undefined;

    const settings = await response.json();
    const enabled = settings?.external?.[provider];
    return typeof enabled === "boolean" ? enabled : undefined;
  } catch {
    return undefined;
  }
}

export async function session() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server components read the refreshed cookies supplied by the proxy.
        }
      },
    },
  });
}

export async function requireSession() {
  if (!configured()) redirect("/connexion");
  const db = await session();
  const { data } = await db.auth.getClaims();
  if (!data?.claims.sub) redirect("/connexion");
  return db;
}

export function workerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
