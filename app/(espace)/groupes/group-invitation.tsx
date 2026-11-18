import { addInvitationNames, removeInvitationName } from "@/app/actions";
import { ActionForm, Submit } from "@/app/components";
import { InvitationShare } from "@/app/invitation-share";
import { appOrigin } from "@/lib/format";
import type { SharedInvitation } from "@/lib/types";

export function GroupInvitation({ edition, group, invitation, open }: {
  edition: string; group: string; invitation: SharedInvitation | null; open: boolean;
}) {
  return <section className="panel stack">
    <div><span className="card-kicker">ÉTAPE 1</span><h3>Inviter avec un lien</h3><p>Ajoute les noms, puis partage le lien du groupe dans votre conversation.</p></div>
    {invitation && <>
      <InvitationShare url={`${appOrigin()}/invitation/${invitation.token}`} group={group}/>
      <ul className="pending">{invitation.participants.map(({ id, name, joined }) => <li key={id} className="inline spread list-row">
        <span className="break">{name} <small>· {joined ? "Inscrit" : "En attente"}</small></span>
        {!joined && open && <ActionForm action={removeInvitationName.bind(null, edition, id)}>
          <Submit className="text-button">Retirer {name}</Submit>
        </ActionForm>}
      </li>)}</ul>
    </>}
    {open ? <ActionForm action={addInvitationNames.bind(null, edition)} className="stack tight">
      <label>{invitation ? "Ajouter des participants" : "Noms des participants"}<textarea name="names" rows={4} required maxLength={8100} placeholder={"Un nom par ligne\nCamille\nLéa\nThomas"}/></label>
      <p className="hint">Chaque invité choisira son nom avant de se connecter. Pour deux personnes du même prénom, ajoute une initiale ou un surnom.</p>
      <Submit>{invitation ? "Ajouter les noms" : "Créer l’invitation du groupe"}</Submit>
    </ActionForm> : <p className="hint">Les inscriptions sont closes. Tu peux les rouvrir avant le tirage.</p>}
  </section>;
}
