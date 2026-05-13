export const CATEGORIES = [
  "Démaquillant",
  "Nettoyant",
  "Exfoliant",
  "Tonique",
  "Sérum",
  "Actif",
  "Hydratant",
  "Crème de nuit",
  "Protection solaire",
  "Huile",
  "Autre",
] as const;

export type SkincareCategory = (typeof CATEGORIES)[number];
