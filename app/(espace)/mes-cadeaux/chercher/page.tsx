import Link from "next/link";
import { saveGift } from "@/app/actions";
import { GiftForm } from "@/app/components";

export const metadata = { title: "Chercher un cadeau" };

export default function SearchGiftsPage() {
  return <section className="form-width stack">
    <Link className="back" href="/mes-cadeaux">← Ma liste</Link>
    <div>
      <p className="eyebrow"><span/> CATALOGUE DE CADEAUX</p>
      <h1 className="page-title">Chercher un cadeau</h1>
      <p>Saisis un nom de produit, une marque ou une idée, puis choisis une fiche pour l’ajouter à ta liste.</p>
    </div>
    <GiftForm action={saveGift.bind(null, null)} startWithSearch/>
  </section>;
}
