import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm, SocialForm } from "../components";
import { Brand } from "../brand";
import { nextPath } from "@/lib/format";
import { configured, session } from "@/lib/supabase";
import { InvitationIntro } from "../invitation-intro";

export const metadata = { title: "Connexion", referrer: "no-referrer" as const, robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = nextPath(params.next);
  const mode = params.mode === "signup" || params.mode === "reset" ? params.mode : "login";
  if (configured() && mode === "login") {
    const db = await session();
    const { data } = await db.auth.getClaims();
    if (data?.claims.sub) redirect(next);
  }
  const link = (target: string) => `/connexion?mode=${target}&next=${encodeURIComponent(next)}`;
  return <><header className="top"><div className="shell bar"><Brand/></div></header>
    <main className="narrow stack">
      {next.startsWith("/invitation/") && <InvitationIntro path={next}/>}
      <section className="panel stack">
        <div><p className="eyebrow"><span/> TON ESPACE</p>
          <h1 className="page-title">{mode === "signup" ? "Créer mon compte" : mode === "reset" ? "Réinitialiser mon mot de passe" : "Se connecter"}</h1>
        </div>
        {mode !== "reset" && <nav className="auth-switch" aria-label="Accès au compte">
          <Link href={link("login")} aria-current={mode === "login" ? "page" : undefined}>Se connecter</Link>
          <Link href={link("signup")} aria-current={mode === "signup" ? "page" : undefined}>Créer un compte</Link>
        </nav>}
        {!configured() && <p className="feedback">L’environnement de connexion est en cours de configuration.</p>}
        {params.erreur === "oauth" && <p className="feedback error">La connexion a échoué. Tu peux réessayer.</p>}
        {mode !== "reset" && <><div className="stack tight"><SocialForm provider="google" next={next}/><SocialForm provider="apple" next={next}/></div><p className="divider">ou par mail</p></>}
        <AuthForm key={mode} mode={mode} next={next}/>
        <div className="inline spread auth-links">
          {mode === "login" ? <Link href={link("reset")}>Mot de passe oublié ?</Link> : mode === "reset" ?
            <Link href={link("login")}>Revenir à la connexion</Link> : <p className="hint">Tes idées et tes tirages restent dans un seul compte.</p>}
        </div>
      </section>
    </main></>;
}
