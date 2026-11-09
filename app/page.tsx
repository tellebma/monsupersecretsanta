import Link from "next/link";
import { Brand, GiftIcon } from "./brand";

function Wrapping() {
  return <svg className="wrapping" viewBox="0 0 520 465" fill="none" aria-hidden="true">
    <defs>
      <pattern id="dots" x="0" y="0" width="23" height="23" patternUnits="userSpaceOnUse">
        <circle cx="9" cy="9" r="2.8" fill="#f8b59a"/>
      </pattern>
      <pattern id="lines" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(33)">
        <rect width="16" height="16" fill="#f9b9a4"/><path d="M0 0V16" stroke="#f6a38d" strokeWidth="5"/>
      </pattern>
    </defs>
    <path d="M99 352c-41-51-56-104-31-171 22-63 78-105 141-104 81 1 105 50 157 58 70 11 112 32 124 100 11 65-25 125-79 154-44 23-103 20-144 20-75 0-132-13-168-57Z" fill="#fff1db"/>
    <ellipse cx="278" cy="384" rx="187" ry="26" fill="#f3dabe"/>
    <g transform="rotate(-14 158 264)">
      <rect x="76" y="230" width="170" height="122" rx="8" fill="url(#lines)"/>
      <rect x="67" y="210" width="188" height="35" rx="7" fill="#f7a68f"/>
      <path d="M143 210h36v142h-36z" fill="#b64445"/>
      <path d="M160 211c-17-42-53-43-53-20 0 18 31 21 53 20Zm0 0c13-44 52-51 54-25 1 20-28 24-54 25Z" stroke="#b64445" strokeWidth="9" strokeLinejoin="round"/>
    </g>
    <g transform="rotate(8 329 261)">
      <rect x="205" y="193" width="251" height="172" rx="10" fill="#184d3e"/>
      <rect x="205" y="193" width="251" height="172" rx="10" fill="url(#dots)"/>
      <rect x="195" y="164" width="271" height="51" rx="8" fill="#1f6049"/>
      <path d="M305 164h49v201h-49z" fill="#efc770"/>
      <path d="M329 166c-12-57-77-74-79-40-2 28 45 40 79 40Zm0 0c20-61 75-71 76-36 1 26-42 35-76 36Z" stroke="#efc770" strokeWidth="12" strokeLinejoin="round"/>
      <path d="m331 169-44 61m42-62 40 49" stroke="#efc770" strokeWidth="12" strokeLinecap="round"/>
    </g>
    <path d="M92 133v32m-16-16h32m300-86v38m-19-19h38M476 161v25m-12.5-12.5h25M151 83v25m-12.5-12.5h25" stroke="#be514a" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="457" cy="122" r="4" fill="#d39e42"/><circle cx="107" cy="192" r="4" fill="#d39e42"/><circle cx="50" cy="264" r="4" fill="#d39e42"/>
  </svg>;
}

export default function Home() {
  return <>
    <header className="top"><div className="shell bar"><Brand/><Link className="button outline small" href="/connexion">Se connecter</Link></div></header>
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow"><span/> LE SECRET SANTA, ENSEMBLE</p>
          <h1>La surprise, <em>sans les doublons.</em></h1>
          <p className="hero-copy">Une seule liste de cadeaux pour tous tes Secret Santa. Organise tes tirages et réserve une idée en toute discrétion.</p>
          <Link className="button" href="/connexion?mode=signup">Créer mon compte <span aria-hidden="true">↗</span></Link>
        </div>
        <Wrapping/>
      </section>
      <section className="home-how" aria-labelledby="how">
        <div className="section-heading"><p className="eyebrow"><span/> COMMENT ÇA MARCHE</p><h2 id="how">Tout commence par une liste</h2></div>
        <div className="steps">
          <article><span className="step-number">01</span><h3>Ajoute tes idées</h3><p>Crée ta liste de cadeaux et ajoute des liens vers tes boutiques préférées.</p></article>
          <article><span className="step-number">02</span><h3>Découvre ton destinataire</h3><p>Rejoins un groupe sur invitation et révèle le résultat à la date du tirage.</p></article>
          <article><span className="step-number">03</span><h3>Réserve ton cadeau</h3><p>Une idée réservée devient indisponible dans les autres groupes de ton destinataire.</p></article>
        </div>
      </section>
    </main>
    <footer className="shell foot"><GiftIcon size={17}/> Mon Super Secret Santa</footer>
  </>;
}
