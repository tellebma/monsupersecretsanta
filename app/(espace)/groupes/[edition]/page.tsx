import Link from "next/link";
import { notFound } from "next/navigation";
import { addHost, configureEdition, invite, removeMember, renameGroup, reveal } from "@/app/actions";
import { ActionForm, ExceptionFields, Submit } from "@/app/components";
import { dateLabel, priceLabel } from "@/lib/format";
import { requireSession } from "@/lib/supabase";
import type { Edition, Gift, SharedInvitation } from "@/lib/types";
import GiftCard from "../../gift-card";
import EditionFields from "../edition-fields";
import MemberRemoval from "../member-removal";
import { GroupInvitation } from "../group-invitation";
import { EditionStatus, GroupProgress, PageHeader } from "@/app/ui";

export const metadata = { title: "Mon Secret Santa" };
export const dynamic = "force-dynamic";

export default async function EditionPage({ params }: { params: Promise<{ edition: string }> }) {
  const { edition: id } = await params;
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) notFound();
  const db = await requireSession();
  const { data, error } = await db.rpc("santa_edition", { p_edition: id });
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const edition = data as Edition;
  const account = edition.owner ? (await db.auth.getClaims()).data?.claims.sub : undefined;
  const canParticipate = !edition.members?.some((member) => member.id === account);
  let invitation: SharedInvitation | null = null;
  if (edition.owner && edition.state !== "drawn") {
    const result = await db.rpc("santa_shared_invitation", { p_edition: id });
    if (result.error) throw new Error(result.error.message);
    invitation = result.data as SharedInvitation | null;
  }
  const closed = Date.parse(edition.exchange_at) <= Date.now();
  let gifts: Gift[] = [];
  if (edition.recipient) {
    const result = await db.rpc("santa_recipient_gifts", { p_edition: id });
    if (result.error) throw new Error(result.error.message);
    gifts = result.data as Gift[];
  }
  return <div className="stack">
    <Link className="back" href="/groupes">← Mes groupes</Link>
    <PageHeader eyebrow={`ÉDITION ${edition.year}`} title={edition.name} action={<EditionStatus state={edition.state}/>}/>
    <GroupProgress state={edition.state}/>
    <dl className="panel facts">
      <div><dt>Tirage</dt><dd>{dateLabel(edition.draw_at)}</dd></div>
      <div><dt>Échange des cadeaux</dt><dd>{dateLabel(edition.exchange_at)}</dd></div>
      {edition.budget && <div><dt>Budget total indicatif</dt><dd>{priceLabel(edition.budget)}</dd></div>}
    </dl>
    {edition.can_reveal && !edition.recipient && <section className="panel reveal stack">
      <div><p className="eyebrow"><span/> LA SURPRISE T’ATTEND</p><h2>Ton tirage est prêt</h2><p>Découvre à qui tu vas offrir un cadeau.</p></div>
      <ActionForm action={reveal.bind(null, id)}><Submit>Tirer au sort</Submit></ActionForm>
    </section>}
    {edition.recipient && <section className="stack">
      <div className="panel reveal"><p className="eyebrow"><span/> TON DESTINATAIRE</p><h2>Tu offres un cadeau à {edition.recipient}</h2>
        <p>{gifts.length} {gifts.length === 1 ? "souhait" : "souhaits"} dans sa liste.</p>
        <p>{closed ? "L’échange est terminé." : "Réserve une idée de sa liste, puis marque-la comme achetée."}</p></div>
      {gifts.length === 0 && <p className="panel">Sa liste est encore vide. Elle peut être complétée après le tirage.</p>}
      <div className="card-grid">{gifts.map((gift) => <GiftCard gift={gift} edition={id} closed={closed} key={gift.id}/>)}</div>
    </section>}
    {!edition.can_reveal && !edition.owner && <p className="panel">{edition.state === "drawn" ?
      "Tu ne fais pas partie de la liste validée pour ce tirage." : "Ton résultat sera disponible ici une fois le tirage effectué."}</p>}
    {edition.owner && <Organization edition={edition} invitation={invitation} canParticipate={canParticipate}/>}
  </div>;
}

function Organization({ edition, invitation, canParticipate }: { edition: Edition; invitation: SharedInvitation | null; canParticipate: boolean }) {
  const { id } = edition;
  const members = edition.members ?? [];
  return <section className="stack">
    <div className="page-header">
      <h2>Organisation</h2>
      {edition.state === "drawn" && <Link className="button outline" href={`/groupes/nouveau?groupe=${edition.group_id}`}>Créer la prochaine édition</Link>}
    </div>
    {edition.state === "blocked" && <p className="feedback error">Le tirage n’a pas pu être réalisé. Vérifie la liste, les exceptions et les trois années précédentes, puis programme une nouvelle date.</p>}
    {edition.state === "drawn" ? <div className="panel stack">
      <p>Ce tirage est définitif. Chaque participant peut ouvrir son propre résultat.</p>
      <h3>Listes de souhaits</h3>
      <ul className="pending">{members.filter((member) => member.selected).map((member) => <li key={member.id}>
        {member.name} · {member.gift_count} {member.gift_count === 1 ? "souhait" : "souhaits"}
      </li>)}</ul>
    </div> :
      <div className="organization-grid">
        <div className="stack">
          <GroupInvitation edition={id} group={edition.name} invitation={invitation} open={edition.state !== "scheduled"}/>
          <details className="panel">
            <summary>Inviter aussi par e-mail</summary>
            {edition.state === "scheduled" ? <p>Les inscriptions sont closes. Tu peux les rouvrir avant le tirage.</p> :
              <ActionForm action={invite.bind(null, id)} className="stack tight">
                <label>Adresses mail<textarea name="emails" rows={3} required placeholder="Une adresse par ligne"/></label>
                <Submit className="button outline">Envoyer les invitations</Submit>
              </ActionForm>}
            {Boolean(edition.pending?.length) && <div><b>En attente</b><ul className="pending">{edition.pending?.map((mail) => <li key={mail}>{mail}</li>)}</ul></div>}
          </details>
          {edition.state !== "scheduled" && canParticipate && <ActionForm action={addHost.bind(null, id)} className="panel stack">
            <h3>Participer à mon groupe</h3>
            <p className="hint">Tu organises ce Secret Santa. Ajoute aussi ton nom si tu souhaites recevoir et offrir un cadeau.</p>
            <label>Nom d’affichage<input name="name" maxLength={80} required/></label>
            <Submit className="button outline">M’ajouter aux participants</Submit>
          </ActionForm>}
        </div>
        <ActionForm action={configureEdition.bind(null, id)} className="panel stack">
          <div><span className="card-kicker">ÉTAPE 2</span><h3>Préparer le tirage</h3><p>Choisis les dates et les participants, puis programme le tirage.</p></div>
          <EditionFields edition={edition}/>
          <fieldset><legend>Participants retenus</legend>
            {members.length ? members.map((member) => <label className="check-row" key={member.id}>
              <input type="checkbox" name="member" value={member.id} defaultChecked={member.selected}/>
              <span className="break">{member.name}<small>{member.email}</small><small>{member.gift_count} {member.gift_count === 1 ? "souhait" : "souhaits"}</small></span>
            </label>) : <p className="hint">Les invités apparaissent ici après avoir rejoint le groupe.</p>}
          </fieldset>
          {members.length > 1 && <details className="disclosure" open={Boolean(edition.exceptions?.length)}>
            <summary>Exceptions au tirage{edition.exceptions?.length ? ` · ${edition.exceptions.length}` : " (facultatif)"}</summary>
            <ExceptionFields key={members.map(({ id }) => id).join(":")} members={members} initial={edition.exceptions}/>
          </details>}
          <p className="hint">Valider la liste ferme les inscriptions. Le tirage se lance ensuite à la date indiquée.</p>
          <div className="inline">
            <Submit intent="schedule">Valider et programmer</Submit>
            <Submit className="button outline" intent="draft">{edition.state === "scheduled" ? "Rouvrir les inscriptions" : "Enregistrer le brouillon"}</Submit>
          </div>
        </ActionForm>
      </div>}
    <div className="settings-grid">
      <details className="panel">
        <summary>Modifier le nom du groupe</summary>
        <ActionForm action={renameGroup.bind(null, edition.group_id)} className="stack tight">
          <label>Nom du groupe<input key={edition.name} name="name" defaultValue={edition.name} maxLength={100} required autoComplete="off"/></label>
          <p className="hint">Ce nom est commun à toutes les éditions du groupe.</p>
          <div><Submit>Enregistrer le nom</Submit></div>
        </ActionForm>
      </details>
      {edition.state !== "drawn" && members.length > 0 && <details className="panel">
        <summary>Gérer les participants</summary>
        <MemberRemoval action={removeMember.bind(null, id)} members={members} scheduled={edition.state === "scheduled"}/>
      </details>}
    </div>
  </section>;
}
