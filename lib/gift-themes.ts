export type GiftTheme = {
  id: string;
  label: string;
  icon: string;
  description: string;
  query: string;
  ideas: string[];
  bestSellers?: string;
};

export const giftThemes: GiftTheme[] = [
  { id: "jeux", label: "Jeux de société", icon: "🎲", description: "Les jeux du moment, les soirées entre amis et les parties en famille.", query: "jeux de société", ideas: ["Jeux d’ambiance", "Jeux de stratégie", "Jeux coopératifs", "Jeux de cartes"], bestSellers: "https://www.fnac.com/l163007/Meilleures-ventes-jeux-de-societe/Jeux-de-societe" },
  { id: "livres", label: "Livres & BD", icon: "📚", description: "Les livres du moment et de quoi trouver sa prochaine lecture.", query: "livres", ideas: ["Romans", "Bandes dessinées", "Mangas", "Beaux livres"], bestSellers: "https://www.fnac.com/l898/Meilleures-ventes-Livre" },
  { id: "high-tech", label: "High-tech", icon: "🎧", description: "Des objets utiles pour écouter, lire et rester connecté.", query: "casque audio", ideas: ["Écouteurs sans fil", "Enceinte Bluetooth", "Liseuse", "Chargeur sans fil"] },
  { id: "gaming", label: "Jeux vidéo", icon: "🎮", description: "Des jeux et des accessoires pour les petites et grandes sessions.", query: "jeux vidéo", ideas: ["Jeux Nintendo Switch", "Jeux PS5", "Manette", "Accessoires gaming"] },
  { id: "maison", label: "Maison & déco", icon: "🏡", description: "Des petites touches pour se sentir bien chez soi.", query: "décoration maison", ideas: ["Bougie", "Lampe de table", "Vase", "Plaid"] },
  { id: "cuisine", label: "Cuisine & café", icon: "☕", description: "Pour les amateurs de bons petits plats et de pauses café.", query: "accessoires cuisine", ideas: ["Cafetière", "Tasse", "Moulin à café", "Livre de cuisine"] },
  { id: "gourmand", label: "Cadeaux gourmands", icon: "🍫", description: "Des découvertes et des douceurs à déguster.", query: "coffret gourmand", ideas: ["Coffret chocolat", "Coffret thé", "Coffret épices", "Coffret biscuits"] },
  { id: "beaute", label: "Beauté & bien-être", icon: "🛁", description: "De quoi prendre soin de soi et s’offrir une pause.", query: "coffret bien-être", ideas: ["Coffret soin", "Coffret bain", "Accessoires massage", "Parfum"] },
  { id: "mode", label: "Mode & accessoires", icon: "🧣", description: "Des accessoires à porter au quotidien.", query: "écharpe", ideas: ["Bonnet", "Écharpe", "Portefeuille", "Sac"] },
  { id: "bijoux", label: "Bijoux & montres", icon: "⌚", description: "Une petite attention à garder près de soi.", query: "bijoux", ideas: ["Bracelet", "Collier", "Boucles d’oreilles", "Montre"] },
  { id: "sport", label: "Sport & yoga", icon: "🧘", description: "Pour bouger, récupérer ou découvrir une nouvelle activité.", query: "accessoires sport", ideas: ["Tapis de yoga", "Gourde", "Accessoires fitness", "Ballon"] },
  { id: "voyage", label: "Voyage & plein air", icon: "🎒", description: "Des compagnons pour les escapades et les grands départs.", query: "accessoires randonnée", ideas: ["Sac à dos", "Gourde isotherme", "Carnet de voyage", "Accessoires voyage"] },
  { id: "creatif", label: "Loisirs créatifs", icon: "🎨", description: "Le plaisir de construire, dessiner et fabriquer de ses mains.", query: "loisirs créatifs", ideas: ["LEGO", "Puzzle", "Kit peinture", "Kit broderie"] },
  { id: "papeterie", label: "Papeterie & bureau", icon: "✏️", description: "De jolies fournitures pour noter ses envies et ses idées.", query: "papeterie", ideas: ["Carnet", "Stylo", "Agenda", "Organiseur bureau"] },
  { id: "musique", label: "Musique & cinéma", icon: "🎵", description: "Des découvertes à écouter, à regarder ou à jouer.", query: "vinyle", ideas: ["Vinyle", "Coffret Blu-ray", "Ukulélé", "Accessoires musique"] },
  { id: "jardin", label: "Plantes & jardin", icon: "🌿", description: "Un peu de verdure et le plaisir de faire pousser.", query: "kit jardinage", ideas: ["Kit aromates", "Terrarium", "Cache-pot", "Outils jardinage"] },
  { id: "enfants", label: "Enfants & jouets", icon: "🧸", description: "Pour les petits curieux, les inventeurs et les rêveurs.", query: "jouets enfants", ideas: ["Jeux de construction", "Jeux éducatifs", "Livre jeunesse", "Peluche"] },
  { id: "experiences", label: "Expériences & sorties", icon: "🎟️", description: "Des moments à vivre et des souvenirs à partager.", query: "coffret expérience", ideas: ["Coffret atelier cuisine", "Coffret spa", "Coffret séjour", "Coffret aventure"] },
];

export function giftTheme(id: string | null) {
  return giftThemes.find((theme) => theme.id === id);
}
