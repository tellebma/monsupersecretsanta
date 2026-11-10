import { excludedMerchant, safeLink, safeProductImage } from "./format";
import type { Gift, Link } from "./types";

export type CatalogProduct = Link & { name: string };

// A small selection of direct merchant product pages. Prices and stock are intentionally live on the merchant site.
const starterCatalog: CatalogProduct[] = [
  {
    name: "STRIMMIG — Tasse en grès IKEA",
    description: "Un mug gris-vert en céramique, d’une contenance de 36 cl.",
    url: "https://www.ikea.com/fr/fr/p/strimmig-tasse-gres-gris-vert-pale-20569897/",
    image: "https://www.ikea.com/fr/fr/images/products/strimmig-tasse-gres-gris-vert-pale__1290053_pe934496_s5.jpg",
  },
  {
    name: "LOTSFÅGEL — Bougie parfumée à la vanille IKEA",
    description: "Une bougie beige dans un verre, parfumée à la vanille.",
    url: "https://www.ikea.com/fr/fr/p/lotsfagel-bougie-parfumee-dans-verre-vanille-beige-claire-70608368/",
    image: "https://www.ikea.com/fr/fr/images/products/lotsfagel-bougie-parfumee-dans-verre-vanille-beige-claire__1485916_pe1002238_s5.jpg",
  },
  {
    name: "TÄRNABY — Lampe de table IKEA",
    description: "Une lampe de chevet anthracite de 25 cm avec variateur de lumière.",
    url: "https://www.ikea.com/fr/fr/p/taernaby-lampe-de-table-intensite-lumineuse-reglable-anthracite-60323894/",
    image: "https://www.ikea.com/fr/fr/images/products/taernaby-lampe-de-table-intensite-lumineuse-reglable-anthracite__1188962_pe899634_s5.jpg",
  },
  {
    name: "Quechua Arpenaz 100 — Sac à dos de randonnée",
    description: "Un sac de randonnée bleu de 10 litres chez Decathlon.",
    url: "https://www.decathlon.fr/p/sac-a-dos-de-randonnee-10l-arpenaz-100-bleu/344147/c246m8775637",
  },
  {
    name: "Kimjaly — Tapis de yoga débutant 5 mm",
    description: "Un tapis antidérapant de 5 mm pour découvrir le yoga, chez Decathlon.",
    url: "https://www.decathlon.fr/p/tapis-de-yoga-debutant-adherence-et-confort-5mm-marron/360462/c184m8928286",
  },
  {
    name: "Quechua — Gourde isotherme en inox",
    description: "Une bouteille de randonnée de 50 cl à ouverture rapide, chez Decathlon.",
    url: "https://www.decathlon.fr/p/gourde-mh500-isotherme-randonnee-inox-0-5l/_/R-p-301267",
  },
  {
    name: "Skyjo — Jeu de cartes",
    description: "Un jeu de société où le but est de marquer le moins de points, chez Fnac.",
    url: "https://www.fnac.com/Jeu-de-cartes-Blackrock-Games-Skyjo/a13877783/w-4",
  },
  {
    name: "Le Petit Prince — Antoine de Saint-Exupéry",
    description: "Le livre en édition reliée, chez Fnac.",
    url: "https://www.fnac.com/a1082197/Le-Petit-Prince-Le-Petit-Prince-Antoine-de-Saint-Exupery",
  },
  {
    name: "JBL Tune 520BT — Casque audio Bluetooth",
    description: "Un casque sans fil, pliable et de couleur blanche, chez Boulanger.",
    url: "https://www.boulanger.com/ref/1189077",
    image: "https://boulanger.scene7.com/is/image/Boulanger/6925281964732_h_f_l_0",
  },
  {
    name: "Kobo Clara BW — Liseuse",
    description: "Une liseuse à écran noir et blanc pour les livres numériques, chez Boulanger.",
    url: "https://www.boulanger.com/ref/1204906",
  },
  {
    name: "LEGO Botanicals — Le bouquet de roses",
    description: "Un bouquet de fleurs à construire en briques LEGO, référence 10328.",
    url: "https://www.lego.com/fr-fr/product/bouquet-of-roses-10328",
  },
  {
    name: "Bodum Chambord — Cafetière à piston",
    description: "Une cafetière de 0,5 litre en acier inoxydable, chez Truffaut.",
    url: "https://www.truffaut.com/chambord-cafetiere-a-piston-bodum-4-tasses-0-5-l-acier-inox.html",
  },
  {
    name: "Zara — Écharpe en laine",
    description: "Une écharpe écrue de 180 × 60 cm.",
    url: "https://www.zara.com/fr/fr/echarpe-en-maille-100-laine-p01942305.html?v1=578150322",
  },
  {
    name: "Uniqlo — Écharpe en cachemire",
    description: "Une écharpe unisexe en cachemire, avec des franges.",
    url: "https://www.uniqlo.com/fr/fr/products/E470089-000/00?colorDisplayCode=09",
  },
  {
    name: "H&M — Bonnet en maille côtelée",
    description: "Un bonnet beige chiné avec un bord replié.",
    url: "https://www2.hm.com/fr_fr/productpage.1241279004.html",
  },
  {
    name: "Kiabi — Bonnet avec revers",
    description: "Un bonnet noir pour homme.",
    url: "https://www.kiabi.com/bonnet-avec-revers-noir_P2388256C2388257",
  },
];

const excludedWords = new Set(["un", "une", "des", "les", "du", "de", "la", "le", "d", "l", "a", "en", "et", "pour"]);

function normalize(value: string) {
  return value.normalize("NFD").toLowerCase().replace(/\p{M}/gu, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
}

function words(value: string): string[] {
  return normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function catalogQuery(value: string | null) {
  const query = value?.trim().replace(/\s+/g, " ");
  if (!query || query.length < 2 || query.length > 100 || !words(query).some((word) => !excludedWords.has(word))) return null;
  return query;
}

function score(queryWords: string[], product: CatalogProduct) {
  const title = words(product.name);
  const details = words(`${product.description ?? ""} ${new URL(product.url).hostname}`);
  let total = 0;
  for (const term of queryWords) {
    const matches = (word: string) => word.startsWith(term) || (term.endsWith("s") && term.length > 3 && word === term.slice(0, -1));
    if (title.includes(term)) total += 4;
    else if (title.some(matches)) total += 3;
    else if (details.some(matches)) total += 1;
    else return 0;
  }
  return total;
}

export function uniqueCatalogProducts(products: CatalogProduct[], limit = 8) {
  const seen = new Set<string>();
  return products.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  }).slice(0, limit);
}

export function findCatalogProducts(query: string, gifts: Gift[] = []) {
  const queryWords = words(query).filter((word) => !excludedWords.has(word));
  if (!queryWords.length) return [];
  const ownProducts = gifts.flatMap((gift) => (gift.links ?? []).flatMap((link) => {
    const url = safeLink(link.url);
    const name = (typeof link.name === "string" && link.name.trim()) || gift.name;
    if (!url || !name || excludedMerchant(url.hostname)) return [];
    url.hash = "";
    const description = (typeof link.description === "string" && link.description.trim()) || gift.description || undefined;
    return [{
      url: url.href,
      name,
      description,
      image: safeProductImage(link.image)?.href,
      price: typeof link.price === "number" && Number.isFinite(link.price) && link.price >= 0 ? link.price : undefined,
      currency: typeof link.currency === "string" ? link.currency : undefined,
      availability: typeof link.availability === "string" ? link.availability : undefined,
    }];
  }));
  return uniqueCatalogProducts([...ownProducts, ...starterCatalog]
    .map((product) => ({ product, score: score(queryWords, product) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ product }) => product));
}

export function catalogSuggestions() {
  return ["Skyjo", "tasse en grès", "sac de randonnée", "casque audio", "Lego", "bonnet Kiabi"]
    .flatMap((query) => findCatalogProducts(query).slice(0, 1));
}
