import Link from "next/link";
import { Brand, GiftIcon } from "./brand";

export default function NotFoundPage() {
  return <>
    <header className="top"><div className="shell bar"><Brand/></div></header>
    <main className="shell workspace">
      <section className="panel stack form-width" aria-labelledby="not-found-title">
        <div className="brand-mark"><GiftIcon/></div>
        <div>
          <p className="eyebrow"><span/> PAGE INTROUVABLE</p>
          <h1 id="not-found-title" className="page-title">Tu t’es égaré&nbsp;?</h1>
          <p>Ce lien n’est plus disponible ou l’adresse est incorrecte. Retrouve tes groupes depuis ton espace.</p>
        </div>
        <div className="inline">
          <Link className="button" href="/groupes">Mes groupes</Link>
          <Link className="button outline" href="/">Retour à l’accueil</Link>
        </div>
      </section>
    </main>
  </>;
}
