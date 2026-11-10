"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { GiftIcon } from "./brand";
import { priceLabel, safeLink, safeProductImage } from "@/lib/format";
import type { Link } from "@/lib/types";
import styles from "./gift-search.module.css";

type SearchResult = {
  status: "ok" | "unavailable";
  products: Link[];
};

export function GiftSearch({ disabled, importing, links, editorVisible, suggestions = [], onChoose }: {
  disabled: boolean; importing: boolean; links: Link[]; editorVisible: boolean; suggestions?: Link[]; onChoose: (product: Link) => void;
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

  const productLink = editorVisible ? "#gift-product-link" : "/mes-cadeaux/nouveau#gift-product-link";
  const matches = result?.products;
  const products = matches?.length ? matches : suggestions;

  return <section className={styles.search} aria-label="Catalogue de cadeaux">
    <div className={`panel ${styles.searchPanel}`}>
      <form role="search" aria-label="Recherche de cadeaux" className={styles.fields} onSubmit={search}>
        <label>Nom du produit
          <span className={styles.searchInput}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>
            </svg>
            <input type="search" autoComplete="off" value={query} minLength={2} maxLength={100}
              placeholder="Skyjo, bonnet, IKEA…" onChange={(event) => {
                request.current?.abort();
                request.current = null;
                setSearching(false);
                setResult(undefined);
                setQuery(event.target.value);
              }} required/>
          </span>
        </label>
        <button className="button" type="submit" disabled={searching || disabled}>Rechercher</button>
      </form>
      <div className={styles.importLink}>
        <span>Tu as déjà un lien vers le produit&nbsp;?</span>
        <a href={productLink}>Importer un lien</a>
      </div>
    </div>
    {links.length > 0 && <div className={styles.draft}>
      <p role="status">{suggestions.length > 0 && <strong>Fiche en cours</strong>}
        <span>{links.length} {links.length === 1 ? "lien marchand" : "liens marchands"}</span>
      </p>
      <a href="#gift-editor">Voir la fiche cadeau</a>
    </div>}
    {importing && <p role="status" className="feedback">Import des informations du produit…</p>}
    {searching && <p role="status" className="feedback">Recherche en cours…</p>}
    {result && !result.products.length && <div className={styles.emptyResult}>
      <p role="status"><strong>{result.status === "unavailable" ? "La recherche est temporairement indisponible." : "Aucun produit trouvé."}</strong></p>
      <p>{result.status === "unavailable" ? "Tu peux réessayer dans un instant ou importer un lien." : "Essaie un nom plus court, une marque ou importe le lien du produit."}</p>
    </div>}
    {!searching && products.length > 0 && <>
      {matches?.length
        ? <h2 className={styles.resultsHeading}><span role="status">{products.length === 1 ? "1 produit trouvé" : `${products.length} produits trouvés`}</span></h2>
        : <h2 className={styles.resultsHeading}>{result ? "Autres idées cadeaux" : "Idées cadeaux à découvrir"}</h2>}
      <ul className={styles.results} role="list">
        {products.map((product) => {
          const image = safeProductImage(product.image);
          const url = safeLink(product.url);
          const retailer = url?.hostname.replace(/^www\d*\./, "");
          const selected = links.some((link) => link.url === url?.href);
          return <li key={product.url} className={styles.product} data-selected={selected}>
            <div className={styles.productMedia} aria-hidden="true">
              <GiftIcon size={24}/>
              {image && <img key={image.href} src={image.href} alt="" width={64} height={64} loading="lazy" referrerPolicy="no-referrer"
                onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}/>}
            </div>
            <div className={`break ${styles.productDetails}`}>
              <span className={styles.retailer}>{retailer}</span>
              <strong>{product.name}</strong>
              {typeof product.price === "number" && <span className={styles.price}>{priceLabel(product.price, product.currency)}</span>}
            </div>
            <button type="button" className="button outline small" aria-label={`${selected ? "Ajouté" : "Choisir"} ${product.name}`}
              disabled={disabled || selected} onClick={() => onChoose(product)}>{selected ? "Ajouté" : "Choisir"}</button>
          </li>;
        })}
      </ul>
    </>}
  </section>;
}
