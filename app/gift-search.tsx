"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { priceLabel, safeLink, safeProductImage } from "@/lib/format";
import type { Link } from "@/lib/types";
import styles from "./gift-search.module.css";

type SearchResult = {
  status: "ok" | "unavailable";
  products: Link[];
};

export function GiftSearch({ disabled, importing, links, onChoose }: {
  disabled: boolean; importing: boolean; links: Link[]; onChoose: (product: Link) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult>();
  const [searching, setSearching] = useState(false);
  const request = useRef<AbortController>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2 || searching || disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setResult(undefined);
    setSearching(true);
    try {
      const response = await fetch(`/api/gift-search?${new URLSearchParams({ q: term })}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Recherche indisponible.");
      const payload: SearchResult = await response.json();
      if (!controller.signal.aborted) {
        setResult({
          status: payload.status,
          products: payload.products.filter((product) => Boolean(product.name && safeLink(product.url))),
        });
      }
    } catch {
      if (!controller.signal.aborted) setResult({ status: "unavailable", products: [] });
    } finally {
      if (request.current === controller) {
        request.current = null;
        setSearching(false);
      }
    }
  }

  return <section className={styles.search} aria-labelledby="gift-search-heading">
    <h2 id="gift-search-heading">Rechercher un cadeau</h2>
    <form role="search" aria-label="Recherche de cadeaux" className={styles.fields} onSubmit={search}>
      <label>Nom du produit
        <input type="search" autoComplete="off" value={query} minLength={2} maxLength={100}
          placeholder="Par exemple, jeu de société" onChange={(event) => {
            request.current?.abort();
            request.current = null;
            setSearching(false);
            setResult(undefined);
            setQuery(event.target.value);
          }} required/>
      </label>
      <button className="button" type="submit" disabled={searching || disabled}>Rechercher</button>
    </form>
    {searching && <p role="status" className="hint">Recherche en cours…</p>}
    {result && !result.products.length && <div className="feedback">
      <p role="status">{result.status === "unavailable" ? "La recherche est temporairement indisponible." : "Aucun produit trouvé."}</p>
      <a href="#gift-product-link">Tu as un lien vers le produit&nbsp;?</a>
    </div>}
    {result && result.products.length > 0 && <>
      <p role="status" className="hint">{result.products.length === 1 ? "1 produit trouvé" : `${result.products.length} produits trouvés`}</p>
      {importing && <p role="status" className="hint">Import des informations du produit…</p>}
      <ul className={styles.results}>
        {result.products.map((product) => {
          const image = safeProductImage(product.image);
          const url = safeLink(product.url);
          const retailer = url?.hostname.replace(/^www\d*\./, "");
          const selected = links.some((link) => link.url === url?.href);
          return <li key={product.url} className={styles.product}>
            {image && <img className={styles.thumbnail} src={image.href} alt="" width={48} height={48} loading="lazy" referrerPolicy="no-referrer"/>}
            <div className="break">
              <strong>{product.name}</strong>
              <p className="hint">{[retailer, typeof product.price === "number" ? priceLabel(product.price, product.currency) : null]
                .filter(Boolean).join(" · ")}</p>
            </div>
            <button type="button" className="button outline small" aria-label={`${selected ? "Ajouté" : "Choisir"} ${product.name}`}
              disabled={disabled || selected} onClick={() => onChoose(product)}>{selected ? "Ajouté" : "Choisir"}</button>
          </li>;
        })}
      </ul>
    </>}
  </section>;
}
