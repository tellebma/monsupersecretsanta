import Link from "next/link";
import { requireSession } from "@/lib/supabase";
import type { Gift } from "@/lib/types";
import { EmptyState, PageHeader } from "@/app/ui";
import styles from "@/app/gift-search.module.css";
import GiftCard from "../gift-card";

export const metadata = { title: "Ma liste" };

export default async function MyGifts() {
  const db = await requireSession();
  const { data, error } = await db.rpc("santa_my_gifts");
  if (error) throw new Error(error.message);
  const gifts = data as Gift[];
  return <div className="stack">
    <PageHeader eyebrow="MES ENVIES" title="Ma liste de cadeaux" description="Une seule liste pour tous tes groupes. Seules les personnes qui t’ont tiré au sort la voient."
      action={<Link className="button" href="/mes-cadeaux/nouveau">Ajouter un cadeau <span aria-hidden="true">＋</span></Link>}/>
    <section className={`panel inspiration ${styles.entry}`} aria-labelledby="gift-catalog-title">
      <div>
        <h2 id="gift-catalog-title">Besoin d’inspiration ?</h2>
        <p>Explore les thématiques ou cherche un produit précis.</p>
      </div>
      <Link className="button outline" href="/mes-cadeaux/chercher">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/>
        </svg>
        Chercher un cadeau
      </Link>
    </section>
    {gifts.length === 0 && <EmptyState title="Ta liste est encore vide"><p>Un lien vers un produit ou simplement une idée : ajoute ce qui te ferait plaisir.</p></EmptyState>}
    {gifts.length > 0 && <p className="section-caption">{gifts.length} {gifts.length === 1 ? "idée dans ta liste" : "idées dans ta liste"} · Modifiable à tout moment</p>}
    <div className="card-grid">{gifts.map((gift) => <GiftCard gift={gift} key={gift.id}/>)}</div>
  </div>;
}
