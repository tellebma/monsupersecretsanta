import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { joinInvitation, joinSharedInvitation } from "@/app/actions";
import { ActionForm, InviteForm, Submit } from "@/app/components";
import { Brand } from "@/app/brand";
import { InvitationWelcome } from "@/app/invitation-intro";
import { invitationPreview } from "@/lib/invitation";
import { configured, session } from "@/lib/supabase";

export const metadata = { title: "Invitation", referrer: "no-referrer" as const, robots: { index: false } };

export default async function Invitation({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const path = `/invitation/${token}`;
  const invitation = await invitationPreview(path);
  const query = await searchParams;
  const participant = invitation?.participants?.find(({ id }) => id === query.participant);

  if (invitation?.shared && (!participant || !invitation.open)) {
    return <><header className="top"><div className="shell bar"><Brand/></div></header>
      <main className="narrow"><section className="panel stack">
        <InvitationWelcome invitation={invitation} heading="h1"/>
        {invitation.open ? <>
          <form action={path} method="get" className="stack">
            <label>Quel est votre nom ?<select name="participant" defaultValue="" required>
              <option value="" disabled>Sélectionnez votre nom</option>
              {invitation.participants?.map(({ id, name, available }) => <option key={id} value={id} disabled={!available}>
                {name}{available ? "" : " · Déjà inscrit"}
              </option>)}
            </select></label>
            <p className="hint">Choisissez votre nom, puis connectez-vous ou créez votre compte.</p>
            {invitation.participants?.some(({ available }) => available) ? <button className="button" type="submit">C’est moi, continuer</button> :
              <p role="status" className="feedback">Tous les noms ont déjà été choisis. Contactez l’organisateur si le vôtre manque.</p>}
          </form>
          <p className="hint">Votre nom n’apparaît pas ? Demandez à l’organisateur de vous ajouter à la liste.</p>
        </> : <p className="feedback">Les inscriptions à ce Secret Santa sont closes.</p>}
        <Link href="/connexion">Déjà inscrit ? Accéder à mes groupes</Link>
      </section></main></>;
  }

  const next = participant ? `${path}?participant=${participant.id}` : path;
  const login = `/connexion?next=${encodeURIComponent(next)}`;
  if (!configured()) redirect(login);
  const db = await session();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(login);
  const name = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.slice(0, 80) : "";
  return <><header className="top"><div className="shell bar"><Brand/></div></header>
    <main className="narrow"><section className="panel stack">
      {participant ? <>
        <InvitationWelcome invitation={invitation} heading="h1"/>
        <p>Vous avez choisi <strong>{participant.name}</strong>. Confirmez pour rejoindre le groupe avec votre compte.</p>
        <ActionForm action={joinSharedInvitation.bind(null, token, participant.id)} className="stack">
          <Submit>Rejoindre en tant que {participant.name}</Submit>
        </ActionForm>
        <Link href={path}>Choisir un autre nom</Link>
        <Link href="/groupes">Mes groupes</Link>
      </> : <><div><p className="eyebrow"><span/> INVITATION</p><h1 className="page-title">Rejoindre un Secret Santa</h1>
        <p>Choisis le nom que les autres participants verront. Si tu utilises une autre adresse, un code sera envoyé à l’adresse invitée.</p></div>
      <InviteForm action={joinInvitation.bind(null, token)} initialName={name}/></>}
    </section></main></>;
}
