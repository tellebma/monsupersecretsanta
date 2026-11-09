import Link from "next/link";
import { giftClaim, removeGift } from "@/app/actions";
import { ActionForm, Submit } from "@/app/components";
import { priceLabel, safeLink } from "@/lib/format";
import type { Gift } from "@/lib/types";

const statuses = { reserved: "Réservé par toi", unavailable: "Indisponible", bought: "Déjà acheté" };
const availability: Record<string, string> = {
  instock: "En stock", outofstock: "Rupture de stock", soldout: "Épuisé", preorder: "En précommande",
  backorder: "En réapprovisionnement", instoreonly: "En magasin uniquement", limitedavailability: "Stock limité",
};

export default function GiftCard({ gift, edition, closed = false }: { gift: Gift; edition?: string; closed?: boolean }) {
  return <article className="panel gift-card stack">
    <div className="inline spread start">
      <h3>{gift.name}</h3>
      {gift.status && <span className="pill">{statuses[gift.status]}</span>}
    </div>
    <p className="gift-description">{gift.description}</p>
    {gift.links.length > 0 && <ul className="merchant-list">
      {gift.links.map((offer) => {
        const url = safeLink(offer.url);
        if (!url) return null;
        const image = safeLink(offer.image);
        const available = typeof offer.availability === "string" ? offer.availability.split(/[\/#]/).at(-1)?.toLowerCase() : undefined;
        return <li className="offer" key={url.href}>
          {image && <img src={image.href} width="60" height="60" alt="" loading="lazy" referrerPolicy="no-referrer"/>}
          <div className="break"><a href={url.href} target="_blank" rel="noopener noreferrer">Voir le produit sur {url.hostname.replace(/^www\d*\./, "")} ↗</a>
            {offer.name && offer.name !== gift.name && <p>{offer.name}</p>}
            {offer.description && offer.description !== gift.description && <details><summary>Description du marchand</summary><p>{offer.description}</p></details>}
            {(typeof offer.price === "number" || available) && <p>{typeof offer.price === "number" ? priceLabel(offer.price, offer.currency) : ""}
              {available && <> <span className="hint">{availability[available] ?? offer.availability}</span></>}</p>}
          </div>
        </li>;
      })}
    </ul>}
    {!edition && <div className="inline">
      <Link className="button outline small" href={`/mes-cadeaux/${gift.id}`}>Modifier</Link>
      <ActionForm action={removeGift.bind(null, gift.id)}><Submit className="text-button">Retirer de ma liste</Submit></ActionForm>
    </div>}
    {edition && !closed && (!gift.status || (gift.status === "reserved" && gift.mine)) &&
      <ActionForm action={giftClaim.bind(null, edition, gift.id)} className="inline">
        {gift.status ? <>
          <Submit className="button small" intent="buy">Marquer comme acheté</Submit>
          <Submit className="text-button" intent="release">Libérer la réservation</Submit>
        </> : <Submit className="button small" intent="reserve">Réserver ce cadeau</Submit>}
      </ActionForm>}
  </article>;
}
