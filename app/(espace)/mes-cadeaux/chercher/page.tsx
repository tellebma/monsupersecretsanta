import Link from "next/link";
import { saveGift } from "@/app/actions";
import { GiftForm } from "@/app/components";
import { catalogSuggestions } from "@/lib/gift-catalog";
import styles from "@/app/gift-search.module.css";
import { PageHeader } from "@/app/ui";

export const metadata = { title: "Chercher un cadeau" };

export default function SearchGiftsPage() {
  return <section className={`stack ${styles.page}`}>
    <Link className="back" href="/mes-cadeaux">← Ma liste</Link>
    <PageHeader eyebrow="INSPIRATION" title="Chercher un cadeau" description="Cherche un produit ou explore les thématiques. Choisis une idée pour préparer ta fiche."/>
    <GiftForm action={saveGift.bind(null, null)} suggestions={catalogSuggestions()}/>
  </section>;
}
