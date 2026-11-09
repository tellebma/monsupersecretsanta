export const localPassword = "DemoNoel-2026!";
export const people = [
  ["camille", "Camille"], ["lea", "Léa"], ["max", "Max"], ["nora", "Nora"], ["sami", "Sami"],
  ["ines", "Inès"], ["julien", "Julien"], ["alice", "Alice"], ["mehdi", "Mehdi"],
  ["chloe", "Chloé"], ["theo", "Théo"], ["emma", "Emma"], ["lina", "Lina"],
  ["hugo", "Hugo"], ["jules", "Jules"], ["zoe", "Zoé"],
];

export const demoEmail = (slug) => `${slug}@secret-santa.example.com`;

export const scenarios = [
  { key: "family", name: "Noël en famille", state: "drawn", members: ["camille", "lea", "max", "ines", "julien"], matches: [["camille", "lea"], ["lea", "max"], ["max", "ines"], ["ines", "julien"], ["julien", "camille"]] },
  { key: "friends", name: "Noël entre amis", state: "drawn", members: ["nora", "lea", "sami", "alice", "mehdi"], matches: [["nora", "lea"], ["lea", "sami"], ["sami", "alice"], ["alice", "mehdi"], ["mehdi", "nora"]] },
  { key: "office", name: "Noël au bureau", state: "drawn", members: ["chloe", "lea", "theo", "emma"], matches: [["chloe", "lea"], ["lea", "theo"], ["theo", "emma"], ["emma", "chloe"]] },
  { key: "draft", name: "Noël en préparation", state: "draft", members: ["camille", "zoe", "hugo", "lina"] },
  { key: "planned", name: "Noël programmé", state: "scheduled", members: ["jules", "lina", "hugo", "zoe"] },
  { key: "blocked", name: "Tirage à ajuster", state: "blocked", members: ["chloe", "theo"] },
  { key: "closed", name: "Échange terminé", state: "drawn", members: ["emma", "sami"], matches: [["emma", "sami"], ["sami", "emma"]] },
];

const commonGifts = [
  ["Puzzle 1000 pièces", "Un paysage de montagne, avec de belles couleurs."],
  ["Carnet de voyage", "Format A5, avec des pages assez épaisses pour l’aquarelle."],
  ["Jeu de cartes", "Un jeu facile à emporter pour jouer à trois ou quatre."],
  ["Coffret de thés", "Plutôt des mélanges fruités, sans réglisse."],
];

export const leaGifts = [
  ["Livre illustré", "Une édition illustrée sur les oiseaux.", [
    { url: "https://www.fnac.com/", name: "Fnac", price: 24.9, currency: "EUR", availability: "InStock" },
    { url: "https://www.amazon.fr/", name: "Amazon", price: 26, currency: "EUR" },
  ]],
  ["Casque audio", "Un casque pliable, couleur noire.", [{ url: "https://www.boulanger.com/", name: "Boulanger", price: 49.9, currency: "EUR" }]],
  ["Tasse en grès", "Une grande tasse, dans les tons bleu et crème.", [{ url: "https://www.ikea.com/fr/fr/", name: "IKEA", price: 8.99, currency: "EUR" }]],
  ["Sac de randonnée", "Un petit sac de 10 litres pour les balades.", [{ url: "https://www.decathlon.fr/", name: "Decathlon", price: 19.99, currency: "EUR" }]],
  ["Écharpe en laine", "Bordeaux ou vert foncé. Un lien pour comparer suffit.", [{ url: "https://www2.hm.com/fr_fr/", name: "H&M", price: 29.99, currency: "EUR" }]],
];

export const giftsFor = (slug) => slug === "lea" ? leaGifts : slug === "zoe" ? [] : commonGifts;
