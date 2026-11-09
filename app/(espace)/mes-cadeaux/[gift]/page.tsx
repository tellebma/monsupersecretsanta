import Link from "next/link";
import { notFound } from "next/navigation";
import { saveGift } from "@/app/actions";
import { GiftForm } from "@/app/components";
import { requireSession } from "@/lib/supabase";
import type { Gift } from "@/lib/types";

export const metadata = { title: "Idée cadeau" };

export default async function GiftPage({ params }: { params: Promise<{ gift: string }> }) {
  const { gift: id } = await params;
  let gift: Gift | undefined;
  if (id !== "nouveau") {
    const db = await requireSession();
    const { data, error } = await db.rpc("santa_my_gifts");
    if (error) throw new Error(error.message);
    gift = (data as Gift[]).find((item) => item.id === id);
    if (!gift) notFound();
  }
  return <section className="form-width stack">
    <Link className="back" href="/mes-cadeaux">← Ma liste</Link>
    <div><p className="eyebrow"><span/> UNE IDÉE CADEAU</p><h1 className="page-title">{gift ? "Modifier le cadeau" : "Ajouter un cadeau"}</h1></div>
    <div className="panel"><GiftForm action={saveGift.bind(null, gift?.id ?? null)} gift={gift}/></div>
  </section>;
}
