import Link from "next/link";
import { requireSession } from "@/lib/supabase";
import { dateLabel } from "@/lib/format";
import type { Edition } from "@/lib/types";
import { EditionStatus, EmptyState, PageHeader } from "@/app/ui";

export const metadata = { title: "Mes groupes" };

export default async function GroupsPage() {
  const db = await requireSession();
  const { data, error } = await db.rpc("santa_groups");
  if (error) throw new Error(error.message);
  const editions = data as Edition[];
  return <div className="stack">
    <PageHeader eyebrow="MON ESPACE" title="Mes groupes" description="Retrouve tes échanges et prépare la prochaine surprise."
      action={<Link className="button" href="/groupes/nouveau">Créer un groupe <span aria-hidden="true">＋</span></Link>}/>
    {editions.length === 0 && <EmptyState title="Ton premier Secret Santa">
      <p>Tu organises ? Crée un groupe. Tu es invité ? Ouvre le lien partagé par ton organisateur.</p>
    </EmptyState>}
    <div className="card-grid">
      {editions.map((edition) => <article className="panel stack group-card" key={edition.id}>
        <div className="inline spread"><EditionStatus state={edition.state}/><span className="hint">{edition.year}</span></div>
        <div><span className="card-kicker">{edition.owner ? "Tu organises" : "Tu participes"}</span><h2>{edition.name}</h2></div>
        <dl className="card-facts"><div><dt>Tirage</dt><dd>{dateLabel(edition.draw_at)}</dd></div><div><dt>Échange des cadeaux</dt><dd>{dateLabel(edition.exchange_at)}</dd></div></dl>
        <Link className="button outline" href={`/groupes/${edition.id}`}>Ouvrir le groupe<span className="sr-only"> · {edition.name}, édition {edition.year}</span></Link>
      </article>)}
    </div>
  </div>;
}
