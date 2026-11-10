import Link from "next/link";
import { requireSession } from "@/lib/supabase";
import type { Gift } from "@/lib/types";
import { GiftIcon } from "@/app/brand";
import styles from "@/app/gift-search.module.css";
import GiftCard from "../gift-card";

export const metadata = { title: "Ma liste" };

export default async function MyGifts() {
  const db = await requireSession();
  const { data, error } = await db.rpc("santa_my_gifts");
  if (error) throw new Error(error.message);
  const gifts = data as Gift[];
  return <div className="stack">
    <div className="page-header">
      <div><p className="eyebrow"><span/> MES ENVIES</p><h1 className="page-title">Ma liste de cadeaux</h1>
        <p>Une liste commune à tous tes Secret Santa, visible par les personnes qui t’ont tiré au sort.</p></div>
      <Link className="button outline" href="/mes-cadeaux/nouveau">Ajouter un cadeau</Link>
    </div>
    <section className={`panel reveal ${styles.entry}`} aria-labelledby="gift-catalog-title">
      <div>
        <h2 id="gift-catalog-title">Trouve ta prochaine idée cadeau</h2>
        <p>Recherche un produit et ajoute-le à ta liste avec son lien marchand.</p>
      </div>
      <Link className="button" href="/mes-cadeaux/chercher">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/>
        </svg>
        Chercher un cadeau
      </Link>
    </section>
    {gifts.length === 0 && <div className="panel empty"><div className="brand-mark"><GiftIcon/></div>
      <h2>Ta liste est encore vide</h2><p>Ajoute une première idée. Tu peux la compléter avec une description et des liens marchands.</p></div>}
    <div className="card-grid">{gifts.map((gift) => <GiftCard gift={gift} key={gift.id}/>)}</div>
  </div>;
}
