import Link from "next/link";
import { saveGift } from "@/app/actions";
import { GiftForm } from "@/app/components";
import { catalogSuggestions } from "@/lib/gift-catalog";
import styles from "@/app/gift-search.module.css";

export const metadata = { title: "Chercher un cadeau" };

export default function SearchGiftsPage() {
  return <section className={`stack ${styles.page}`}>
    <Link className="back" href="/mes-cadeaux">← Ma liste</Link>
    <div>
      <p className="eyebrow"><span/> CATALOGUE DE CADEAUX</p>
      <h1 className="page-title">Chercher un cadeau</h1>
      <p>Jeux, livres, déco, sorties… Explore les thématiques ou recherche un produit pour préparer ta fiche cadeau.</p>
    </div>
    <GiftForm action={saveGift.bind(null, null)} suggestions={catalogSuggestions()}/>
  </section>;
}
