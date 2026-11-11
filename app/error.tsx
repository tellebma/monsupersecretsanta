"use client";

import Link from "next/link";
import { Brand } from "./brand";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <>
    <header className="top"><div className="shell bar"><Brand/></div></header>
    <main className="shell workspace">
      <section className="panel stack form-width" aria-labelledby="page-error-title">
        <p className="eyebrow"><span/> UN CONTRETEMPS</p>
        <h1 id="page-error-title" className="page-title">Cette page n’a pas pu s’afficher</h1>
        <p>Réessaie pour retrouver tes groupes et tes cadeaux.</p>
        <div className="inline">
          <button type="button" className="button" onClick={reset}>Réessayer</button>
          <Link className="button outline" href="/groupes">Mes groupes</Link>
          <Link href="/">Retour à l’accueil</Link>
        </div>
      </section>
    </main>
  </>;
}
