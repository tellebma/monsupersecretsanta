"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { appOrigin, nextPath, parisInstant, safeLink } from "@/lib/format";
import { configured, requireSession, session } from "@/lib/supabase";
import { importProduct } from "@/lib/merchants";
import type { Link } from "@/lib/types";

export type Result = { error?: string; message?: string; stage?: "verify" | "password" | "invite_code"; email?: string };
const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const raw = (data: FormData, key: string) => String(data.get(key) ?? "");
const err = (error: unknown) => ({ error: error instanceof Error ? error.message : "Une erreur est survenue." });
const authUnavailable = { error: "La connexion sera disponible dès que Supabase sera configuré." };

export async function login(_: Result, data: FormData): Promise<Result> {
  if (!configured()) return authUnavailable;
  const db = await session();
  const { error } = await db.auth.signInWithPassword({ email: field(data, "email"), password: raw(data, "password") });
  if (error) return { error: "Adresse mail ou mot de passe incorrect." };
  redirect(nextPath(field(data, "next")));
}

export async function emailAccount(mode: "signup" | "reset", previous: Result, data: FormData): Promise<Result> {
  if (!configured()) return authUnavailable;
  const db = await session();
  const next = nextPath(field(data, "next"));
  const email = previous.email ?? field(data, "email");
  if (previous.stage === "password") {
    const password = raw(data, "password");
    if (password.length < 8 || password !== raw(data, "confirmation")) {
      return { ...previous, error: "Saisissez deux mots de passe identiques d’au moins 8 caractères." };
    }
    const { error } = await db.auth.updateUser({ password });
    if (error) return { ...previous, error: "Impossible d’enregistrer ce mot de passe. Réessayez." };
    redirect(next);
  }
  if (previous.stage === "verify" && field(data, "intent") !== "resend") {
    const { error } = await db.auth.verifyOtp({ email, token: field(data, "code"), type: "email" });
    if (error) return { stage: "verify", email, error: "Code incorrect ou expiré." };
    return { stage: "password", email };
  }
  const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: mode === "signup" } });
  if (error && !(mode === "reset" && error.code === "otp_disabled")) {
    return { stage: previous.stage, email: previous.email, error: "L’envoi du code a échoué. Réessayez dans un instant." };
  }
  return { stage: "verify", email, message: "Vérifiez votre boîte mail pour récupérer le code." };
}

export async function social(provider: "google" | "apple", _: Result, data: FormData): Promise<Result> {
  if (!configured()) return authUnavailable;
  const callback = new URL("/auth/callback", appOrigin());
  (await cookies()).set("santa-oauth-next", nextPath(field(data, "next")), {
    httpOnly: true, sameSite: "lax", secure: callback.protocol === "https:", path: "/auth/callback", maxAge: 600,
  });
  const db = await session();
  const { data: result, error } = await db.auth.signInWithOAuth({ provider, options: { redirectTo: callback.href } });
  if (error || !result.url) return { error: "Cette méthode de connexion est temporairement indisponible." };
  redirect(result.url);
}

export async function logout() {
  const db = await session();
  await db.auth.signOut();
  redirect("/");
}

export async function joinInvitation(token: string, previous: Result, data: FormData): Promise<Result> {
  if (!/^[a-f0-9]{64}$/.test(token)) return { error: "Ce lien d’invitation est invalide." };
  const db = await requireSession();
  const { data: result, error } = await db.rpc("santa_join", {
    p_token: token,
    p_name: field(data, "name"),
    p_code: field(data, "intent") === "resend" ? null : field(data, "code") || null,
  });
  if (error) return { ...previous, error: error.message };
  switch (result.status) {
    case "joined": redirect(`/groupes/${result.edition}`);
    case "code_sent": return { stage: "invite_code", message: "Un code a été envoyé à l’adresse invitée." };
    case "bad_code": return { stage: "invite_code", error: "Ce code est incorrect." };
    case "expired_code": return { stage: "invite_code", error: "Le code a expiré. Demandez-en un nouveau." };
    case "already_member": return { error: "Ce compte est déjà inscrit avec une autre invitation." };
    default: return { error: "Cette invitation a été utilisée ou les inscriptions sont closes." };
  }
}

function editionDates(data: FormData) {
  const amount = field(data, "budget").replace(",", ".");
  const budget = amount ? Number(amount) : null;
  if (budget !== null && (!Number.isFinite(budget) || budget <= 0 || budget > 99999999.99)) {
    throw new Error("Renseignez un budget positif ou laissez ce champ vide.");
  }
  return { p_draw: parisInstant(field(data, "draw")), p_exchange: parisInstant(field(data, "exchange")), p_budget: budget };
}

export async function createEdition(_: Result, data: FormData): Promise<Result> {
  let dates;
  try { dates = editionDates(data); } catch (error) { return err(error); }
  const db = await requireSession();
  const { data: id, error } = await db.rpc("santa_create_edition", {
    p_group: field(data, "group") || null, p_name: field(data, "name"), ...dates,
  });
  if (error) return { error: error.message };
  revalidatePath("/groupes");
  redirect(`/groupes/${id}`);
}

export async function invite(edition: string, _: Result, data: FormData): Promise<Result> {
  const emails = [...new Set(field(data, "emails").toLowerCase().split(/[\s,;]+/).filter(Boolean))];
  const db = await requireSession();
  const { data: count, error } = await db.rpc("santa_invite", { p_edition: edition, p_emails: emails });
  if (error) return { error: error.message };
  revalidatePath(`/groupes/${edition}`);
  return { message: count ? `${count} invitation${count > 1 ? "s" : ""} en cours d’envoi.` : "Ces adresses ont déjà été invitées." };
}

export async function addHost(edition: string, _: Result, data: FormData): Promise<Result> {
  const db = await requireSession();
  const { error } = await db.rpc("santa_add_host", { p_edition: edition, p_name: field(data, "name") });
  if (error) return { error: error.message };
  revalidatePath(`/groupes/${edition}`);
  return { message: "Votre nom a été ajouté aux participants." };
}

export async function configureEdition(edition: string, _: Result, data: FormData): Promise<Result> {
  let dates;
  try { dates = editionDates(data); } catch (error) { return err(error); }
  const db = await requireSession();
  const scheduled = field(data, "intent") === "schedule";
  const { error } = await db.rpc("santa_configure", {
    p_edition: edition, ...dates, p_members: data.getAll("member").map(String),
    p_exceptions: data.getAll("exception").map((pair) => String(pair).split(":")), p_schedule: scheduled,
  });
  if (error) return { error: error.message };
  revalidatePath(`/groupes/${edition}`);
  return { message: scheduled ? "Liste validée. Le tirage est programmé." : "Brouillon enregistré. Les inscriptions sont ouvertes." };
}

export async function reveal(edition: string, _: Result): Promise<Result> {
  const db = await requireSession();
  const { error } = await db.rpc("santa_reveal", { p_edition: edition });
  if (error) return { error: error.message };
  revalidatePath(`/groupes/${edition}`);
  return {};
}

function readLinks(value: string): Link[] {
  const submitted: Link[] = JSON.parse(value || "[]");
  if (!Array.isArray(submitted) || submitted.length > 20) throw new Error("Ajoutez au maximum 20 liens par cadeau.");
  const links = new Map<string, Link>();
  for (const item of submitted) {
    const url = safeLink(item?.url);
    if (!url) throw new Error("Vérifiez les liens. Ils doivent commencer par https:// ou http://.");
    const image = safeLink(item.image);
    links.set(url.href, {
      url: url.href, name: item.name?.slice(0, 200), description: item.description?.slice(0, 1500), image: image?.href,
      price: typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0 ? item.price : undefined,
      currency: item.currency?.slice(0, 3), availability: item.availability?.slice(0, 100),
    });
  }
  return [...links.values()];
}

export async function saveGift(id: string | null, _: Result, data: FormData): Promise<Result> {
  let links;
  try { links = readLinks(field(data, "links")); } catch (error) { return err(error); }
  const db = await requireSession();
  const { error } = await db.rpc("santa_save_gift", {
    p_id: id, p_name: field(data, "name"), p_description: field(data, "description"), p_links: links,
  });
  if (error) return { error: error.message };
  revalidatePath("/mes-cadeaux");
  redirect("/mes-cadeaux");
}

export async function removeGift(id: string, _: Result): Promise<Result> {
  const db = await requireSession();
  const { error } = await db.rpc("santa_remove_gift", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/mes-cadeaux");
  return {};
}

export async function fetchProduct(value: string): Promise<Link | null> {
  await requireSession();
  try { return await importProduct(value); } catch { return null; }
}

export async function giftClaim(edition: string, gift: string, _: Result, data: FormData): Promise<Result> {
  const db = await requireSession();
  const { error } = await db.rpc("santa_claim", { p_edition: edition, p_gift: gift, p_action: field(data, "intent") });
  revalidatePath(`/groupes/${edition}`);
  return error ? { error: error.message } : {};
}
