import { notFound, redirect } from "next/navigation";
import { joinInvitation } from "@/app/actions";
import { InviteForm } from "@/app/components";
import { Brand } from "@/app/brand";
import { configured, session } from "@/lib/supabase";

export const metadata = { title: "Invitation", referrer: "no-referrer" as const, robots: { index: false } };

export default async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const login = `/connexion?next=${encodeURIComponent(`/invitation/${token}`)}`;
  if (!configured()) redirect(login);
  const db = await session();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(login);
  const name = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.slice(0, 80) : "";
  return <><header className="top"><div className="shell bar"><Brand/></div></header>
    <main className="narrow"><section className="panel stack">
      <div><p className="eyebrow"><span/> INVITATION</p><h1 className="page-title">Rejoindre un Secret Santa</h1>
        <p>Choisis le nom que les autres participants verront. Si tu utilises une autre adresse, un code sera envoyé à l’adresse invitée.</p></div>
      <InviteForm action={joinInvitation.bind(null, token)} initialName={name}/>
    </section></main></>;
}
