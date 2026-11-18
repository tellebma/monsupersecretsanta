import Link from "next/link";
import { notFound } from "next/navigation";
import { saveGift } from "@/app/actions";
import { GiftForm } from "@/app/components";
import { requireSession } from "@/lib/supabase";
import type { Gift } from "@/lib/types";
import { PageHeader } from "@/app/ui";

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
    <PageHeader eyebrow="MA LISTE" title={gift ? "Modifier le cadeau" : "Ajouter un cadeau"}
      description={gift ? "Ajuste les détails pour guider ton Secret Santa." : "Une idée, un lien, une envie : fais ta liste à ta façon."}/>
    <GiftForm action={saveGift.bind(null, gift?.id ?? null)} gift={gift}/>
  </section>;
}
