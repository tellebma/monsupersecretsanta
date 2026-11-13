"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ProductImage } from "./product-image";
import { priceLabel, safeLink, safeProductImage } from "@/lib/format";
import type { Link } from "@/lib/types";
import { giftThemes, giftTheme, type GiftTheme } from "@/lib/gift-themes";
import styles from "./gift-search.module.css";

type SearchResult = {
  status: "ok" | "unavailable" | "limited";
  products: Link[];
  source?: { label: string; url: string };
};

export function GiftSearch({ disabled, importing, links, editorVisible, suggestions = [], onChoose }: {
  disabled: boolean; importing: boolean; links: Link[]; editorVisible: boolean; suggestions?: Link[]; onChoose: (product: Link) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult>();
  const [searching, setSearching] = useState(false);
  const [themeId, setThemeId] = useState<string | null>(null);
  const theme = giftTheme(themeId);
  const request = useRef<AbortController>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setThemeId(null);
    await runSearch(query.trim());
  }

  async function runSearch(term: string, selection?: GiftTheme) {
    if (term.length < 2 || disabled) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setResult(undefined);
    setSearching(true);
    try {
      const response = await fetch(`/api/gift-search?${new URLSearchParams(selection ? { theme: selection.id } : { q: term })}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Recherche indisponible.");
      const payload: SearchResult = await response.json();
      if (!controller.signal.aborted) {
        setResult({
          status: payload.status,
          products: payload.products.filter((product) => Boolean(product.name && safeLink(product.url))),
          source: payload.source && safeLink(payload.source.url) ? payload.source : undefined,
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
  const products = matches?.length ? matches : theme ? [] : suggestions;

  function resetSearch() {
    request.current?.abort();
    request.current = null;
    setSearching(false);
    setResult(undefined);
    setThemeId(null);
    setQuery("");
  }

  return <section className={styles.search} aria-label="Catalogue de cadeaux">
    <div className={`panel ${styles.searchPanel}`}>
      <form role="search" aria-label="Recherche de cadeaux" className={styles.fields} onSubmit={search}>
        <label>Nom du produit
          <span className={styles.searchInput}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>
            </svg>
            <input type="search" autoComplete="off" value={query} disabled={disabled} minLength={2} maxLength={100}
              placeholder="Skyjo, bonnet, IKEA…" onChange={(event) => {
                request.current?.abort();
                request.current = null;
                setSearching(false);
                setResult(undefined);
                setThemeId(null);
                setQuery(event.target.value);
              }} required/>
          </span>
        </label>
        <button className="button" type="submit" disabled={searching || disabled}>Rechercher</button>
      </form>
      <p className="hint">Produits de Fnac, Boulanger et de notre sélection. Prix et disponibilité à vérifier chez le marchand.</p>
      <div className={styles.importLink}>
        <span>Tu as déjà un lien vers le produit&nbsp;?</span>
        <a href={productLink}>Importer un lien</a>
      </div>
    </div>
    <div className={styles.themes}>
      <div className={styles.themesHeader}>
        <div><h2>À chacun ses envies</h2><p>Explore une thématique pour trouver l’inspiration.</p></div>
        {theme && <button type="button" className="text-button" disabled={disabled} onClick={resetSearch}>Toutes les idées</button>}
      </div>
      <div className={styles.themeGrid} role="group" aria-label="Thématiques de cadeaux">
        {giftThemes.map((item) => <button key={item.id} type="button" className={styles.themeCard}
          aria-pressed={item.id === themeId} disabled={disabled} onClick={() => {
            setThemeId(item.id);
            setQuery("");
            void runSearch(item.query, item);
          }}>
          <span aria-hidden="true" className={styles.themeIcon}>{item.icon}</span><span>{item.label}</span>
        </button>)}
      </div>
      {theme && <div className={styles.themeSelection}>
        <h3>{theme.label}</h3><p>{theme.description}</p>
        <div className={styles.themeIdeas} role="group" aria-label={`Affiner : ${theme.label}`}>
          {theme.ideas.map((idea) => <button type="button" key={idea} disabled={disabled} onClick={() => {
            setThemeId(null);
            setQuery(idea);
            void runSearch(idea);
          }}>{idea}<span aria-hidden="true"> ↗</span></button>)}
        </div>
      </div>}
    </div>
    {links.length > 0 && <div className={styles.draft}>
      <p role="status">{suggestions.length > 0 && <strong>Fiche en cours</strong>}
        <span>{links.length} {links.length === 1 ? "lien marchand" : "liens marchands"}</span>
      </p>
      <a href="#gift-editor">Voir la fiche cadeau</a>
    </div>}
    {importing && <p role="status" className="feedback">Import des informations du produit…</p>}
    {searching && <p role="status" className="feedback">Recherche en cours…</p>}
    {result && (!result.products.length || result.status !== "ok") && <div className={styles.emptyResult}>
      <p role="status"><strong>{result.status === "limited" ? "La recherche auprès des marchands est momentanément limitée." :
        result.status === "unavailable" ? "La recherche est temporairement indisponible." : "Aucun produit trouvé."}</strong></p>
      <p>{theme ? "Essaie une des pistes de cette thématique, recherche un produit précis ou importe un lien." : result.status !== "ok" ? "Tu peux réessayer plus tard, choisir une idée ci-dessous ou importer un lien." :
        "Essaie un nom plus court, une marque ou importe le lien du produit."}</p>
    </div>}
    {!searching && products.length > 0 && <>
      {matches?.length
        ? <div className={styles.resultTitle}><h2 className={styles.resultsHeading}><span role="status">{products.length === 1 ? "1 produit trouvé" : `${products.length} produits trouvés`}{theme ? ` · ${theme.label}` : ""}</span></h2>
          {result?.source && <p className="hint">Sélection du moment · <a href={result.source.url} target="_blank" rel="noopener noreferrer">{result.source.label}<span className="sr-only"> (nouvel onglet)</span></a></p>}
          {theme?.bestSellers && !result?.source && <p className="hint">Idées de la catégorie · Les meilleures ventes du moment sont indisponibles.</p>}
        </div>
        : <h2 className={styles.resultsHeading}>{result ? "Autres idées cadeaux" : "Idées cadeaux à découvrir"}</h2>}
      <ul className={styles.results} role="list">
        {products.map((product) => {
          const image = safeProductImage(product.image);
          const url = safeLink(product.url);
          const retailer = url?.hostname.replace(/^www\d*\./, "");
          const selected = links.some((link) => link.url === url?.href);
          return <li key={product.url} className={styles.product} data-selected={selected}>
            <ProductImage src={image?.href} className={styles.productMedia}/>
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
