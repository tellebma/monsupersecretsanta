import Link from "next/link";
import { requireSession } from "@/lib/supabase";
import { dateLabel } from "@/lib/format";
import type { Edition } from "@/lib/types";
import { GiftIcon } from "@/app/brand";

export const metadata = { title: "Mes groupes" };
const states = { draft: "Inscriptions ouvertes", scheduled: "Tirage programmé", blocked: "Tirage à ajuster", drawn: "Tirage effectué" };

export default async function GroupsPage() {
  const db = await requireSession();
  const { data, error } = await db.rpc("santa_groups");
  if (error) throw new Error(error.message);
  const editions = data as Edition[];
  return <div className="stack">
    <div className="page-header">
      <div><p className="eyebrow"><span/> MON ESPACE</p><h1 className="page-title">Mes groupes</h1><p>Retrouve tes échanges et prépare la prochaine édition.</p></div>
      <Link className="button" href="/groupes/nouveau">Créer un groupe</Link>
    </div>
    {editions.length === 0 && <div className="panel empty"><div className="brand-mark"><GiftIcon/></div><h2>Ton premier Secret Santa</h2>
      <p>Crée un groupe ou ouvre le lien reçu par mail pour rejoindre un groupe existant.</p></div>}
    <div className="card-grid">
      {editions.map((edition) => <article className="panel stack" key={edition.id}>
        <div className="inline spread"><span className="pill">{states[edition.state]}</span><span className="hint">{edition.year}</span></div>
        <div><h2>{edition.name}</h2><p>Échange le {dateLabel(edition.exchange_at)}</p></div>
        <Link className="button outline" href={`/groupes/${edition.id}`}>Ouvrir le groupe</Link>
      </article>)}
    </div>
  </div>;
}
