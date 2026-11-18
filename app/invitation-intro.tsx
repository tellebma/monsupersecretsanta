import Link from "next/link";
import { redirect } from "next/navigation";
import { invitationPreview, type InvitationPreview } from "@/lib/invitation";

export async function InvitationIntro({ path }: { path: string }) {
  const invitation = await invitationPreview(path);
  const base = path.split("?")[0];
  const selected = invitation?.participants?.find(({ id }) => id === new URL(path, "http://localhost").searchParams.get("participant"));
  if (invitation?.shared && (!invitation.open || !selected?.available)) redirect(base);
  return <section className="panel stack" aria-labelledby="invitation-title">
    <InvitationWelcome invitation={invitation}/>
    {selected ? <div className="stack tight"><p>Tu rejoins le groupe en tant que <strong>{selected.name}</strong>.</p>
      <Link href={base}>Ce n’est pas moi, choisir un autre nom</Link></div> : null}
    <p>Connecte-toi ou crée ton compte pour rejoindre le groupe et partager tes envies.</p>
  </section>;
}

export function InvitationWelcome({ invitation, heading = "h2" }: { invitation: InvitationPreview | null; heading?: "h1" | "h2" }) {
  const Heading = heading;
  return <>
    <div><p className="eyebrow"><span/> UNE SURPRISE SE PRÉPARE</p>
      <Heading id="invitation-title" className={heading === "h1" ? "page-title" : undefined} style={{ overflowWrap: "anywhere" }}>{invitation?.organizer ? `${invitation.organizer} t’invite à son Secret Santa !` : "Tu es invité à un Secret Santa !"}</Heading>
    </div>
    {invitation && <p>Rejoins le groupe <strong>{invitation.group}</strong>.</p>}
    <p>Le principe : un tirage au sort attribue à chacun une personne à qui offrir un cadeau, en secret. Partage tes envies pour l’aider à choisir !</p>
  </>;
}
