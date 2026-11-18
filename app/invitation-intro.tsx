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
    {selected ? <div className="stack tight"><p>Vous rejoignez le groupe en tant que <strong>{selected.name}</strong>.</p>
      <Link href={base}>Ce n’est pas moi, choisir un autre nom</Link></div> : null}
    <p>Connectez-vous ou créez votre compte pour accepter l’invitation et partager vos idées de cadeaux.</p>
  </section>;
}

export function InvitationWelcome({ invitation, heading = "h2" }: { invitation: InvitationPreview | null; heading?: "h1" | "h2" }) {
  const Heading = heading;
  return <>
    <div><p className="eyebrow"><span/> UNE SURPRISE SE PRÉPARE</p>
      <Heading id="invitation-title" className={heading === "h1" ? "page-title" : undefined} style={{ overflowWrap: "anywhere" }}>{invitation?.organizer ? `${invitation.organizer} vous invite à rejoindre son Secret Santa !` : "Vous êtes invité à rejoindre un Secret Santa !"}</Heading>
    </div>
    {invitation && <p>Rejoignez le groupe <strong>{invitation.group}</strong>.</p>}
    <p>Le principe : un tirage au sort attribue à chacun une personne à qui offrir un cadeau, en secret. Partagez vos envies pour l’aider à choisir !</p>
  </>;
}
