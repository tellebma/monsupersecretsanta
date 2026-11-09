import Link from "next/link";
import { requireSession } from "@/lib/supabase";
import type { Gift } from "@/lib/types";
import { GiftIcon } from "@/app/brand";
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
      <Link className="button" href="/mes-cadeaux/nouveau">Ajouter un cadeau</Link>
    </div>
    {gifts.length === 0 && <div className="panel empty"><div className="brand-mark"><GiftIcon/></div>
      <h2>Ta liste est encore vide</h2><p>Ajoute une première idée avec une description et, si tu en as, des liens marchands.</p></div>}
    <div className="card-grid">{gifts.map((gift) => <GiftCard gift={gift} key={gift.id}/>)}</div>
  </div>;
}
