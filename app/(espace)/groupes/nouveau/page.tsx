import Link from "next/link";
import { notFound } from "next/navigation";
import { createEdition } from "@/app/actions";
import { ActionForm, Submit } from "@/app/components";
import { requireSession } from "@/lib/supabase";
import type { Edition } from "@/lib/types";
import EditionFields from "../edition-fields";

export const metadata = { title: "Nouvelle édition" };

export default async function NewEdition({ searchParams }: { searchParams: Promise<{ groupe?: string }> }) {
  const { groupe } = await searchParams;
  let group: Edition | undefined;
  if (groupe) {
    const db = await requireSession();
    const { data, error } = await db.rpc("santa_groups");
    if (error) throw new Error(error.message);
    group = (data as Edition[]).find((edition) => edition.group_id === groupe && edition.owner);
    if (!group) notFound();
  }
  return <section className="form-width stack">
    <Link className="back" href={group ? `/groupes/${group.id}` : "/groupes"}>← Retour aux groupes</Link>
    <div><p className="eyebrow"><span/> ORGANISATION</p><h1 className="page-title">{group ? `Nouvelle édition · ${group.name}` : "Créer un groupe"}</h1></div>
    <ActionForm action={createEdition} className="panel stack">
      {group ? <><input type="hidden" name="group" value={group.group_id}/><p>Cette édition conservera l’historique des tirages du groupe.</p></> :
        <label>Nom du groupe<input name="name" maxLength={100} required placeholder="Le Noël de la famille"/></label>}
      <EditionFields/>
      <Submit>Créer l’édition</Submit>
    </ActionForm>
  </section>;
}
