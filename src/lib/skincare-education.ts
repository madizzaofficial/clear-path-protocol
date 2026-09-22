/**
 * Couche "compréhension" : micro-contenu éducatif contextuel (pas un cours).
 * Contenu par défaut, volontairement doux et non médical — le coach pourra
 * personnaliser plus tard. Sert la carte "Cette semaine", le glossaire au tap
 * et les "Le savais-tu ?" par produit.
 */

// ── Cette semaine : ce qui se passe pour la peau, par bande de semaines ────────
export type WeeklyGuidance = { title: string; body: string };

export function weeklyGuidance(week: number): WeeklyGuidance {
  if (week <= 2)
    return {
      title: "On pose les bases en douceur",
      body: "Ta peau s'habitue à la nouvelle routine. C'est normal de ne pas voir de résultat visible tout de suite — la régularité de ces premières semaines fait toute la différence.",
    };
  if (week <= 6)
    return {
      title: "La phase où la patience paie",
      body: "Les actifs travaillent en profondeur. Quelques boutons peuvent remonter (la purge) : c'est le renouvellement de la peau qui s'accélère, c'est temporaire et plutôt bon signe. On ne change rien et on continue.",
    };
  if (week <= 9)
    return {
      title: "Ça monte en puissance",
      body: "L'inflammation devrait commencer à baisser et le grain de peau à s'affiner. C'est le moment de tenir la régularité — c'est là que les résultats s'installent vraiment.",
    };
  return {
    title: "Consolidation des résultats",
    body: "Ta peau se stabilise : c'est souvent la période où les progrès se voient le plus. On sécurise les acquis sans relâcher la protection solaire.",
  };
}

// ── Glossaire au tap ───────────────────────────────────────────────────────────
export const GLOSSARY: Record<string, string> = {
  purge: "Remontée temporaire de boutons en début de traitement : le renouvellement de la peau s'accélère et fait sortir ce qui était sous la surface. Dure en général 2 à 4 semaines.",
  "barrière cutanée":
    "Le film protecteur naturel de la peau. Quand elle est fragilisée, la peau tiraille, rougit et réagit plus. On la renforce avant tout.",
  comédon:
    "Pore bouché par le sébum et les cellules mortes. Point noir (ouvert) ou point blanc (fermé, le microkyste).",
  sébum: "L'huile naturelle produite par la peau. Utile en quantité normale ; en excès, il bouche les pores.",
  actif: "Ingrédient qui a une action ciblée (ex. acide azélaïque, niacinamide, rétinoïde). Puissant, donc à introduire progressivement.",
  exfoliation:
    "Élimination des cellules mortes en surface. Utile avec modération — trop souvent, ça abîme la barrière cutanée.",
  spf: "Indice de protection solaire. Le geste anti-taches et anti-vieillissement le plus important, à faire chaque matin.",
  niacinamide: "Forme de vitamine B3 : régule le sébum, apaise les rougeurs et aide à unifier le teint. Très bien tolérée.",
  rétinoïde:
    "Dérivé de vitamine A (ex. adapalène) qui accélère le renouvellement cellulaire. Très efficace sur l'acné, d'où la purge au début.",
  "acide azélaïque":
    "Actif doux anti-taches et anti-inflammatoire, bien toléré même par les peaux sensibles.",
  titration: "Le fait d'augmenter progressivement la fréquence d'un actif pour laisser la peau s'habituer sans l'irriter.",
};

function normalizeTerm(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function lookupGlossary(term: string): string | null {
  const n = normalizeTerm(term);
  for (const [k, v] of Object.entries(GLOSSARY)) {
    if (normalizeTerm(k) === n) return v;
  }
  return null;
}

// ── "Le savais-tu ?" par catégorie / produit ──────────────────────────────────
const FACTS: { match: RegExp; fact: string }[] = [
  { match: /nettoyant|cleanser|gel|mousse/i, fact: "Un bon nettoyant ne doit pas tirailler : si ta peau « tire » après, c'est qu'il est trop décapant pour toi." },
  { match: /s[ée]rum|niacinamide|vitamine c/i, fact: "Les sérums s'appliquent sur peau propre et sèche, et on attend 30–60 s avant l'étape suivante pour bien les laisser pénétrer." },
  { match: /solaire|spf|protection/i, fact: "Jusqu'à 80 % du vieillissement cutané vient du soleil. Le SPF le matin protège aussi tes progrès anti-taches — même par temps gris." },
  { match: /adapal|r[ée]tino|trait/i, fact: "Les rétinoïdes accélèrent le renouvellement de la peau : c'est ce qui provoque la purge au début. La régularité (pas la quantité) fait le résultat." },
  { match: /az[ée]la/i, fact: "L'acide azélaïque agit à la fois sur les boutons, les rougeurs et les taches — et il est doux, idéal pour démarrer les actifs." },
  { match: /hydratant|baume|cr[èe]me|c[ée]ramid/i, fact: "Bien hydrater renforce la barrière cutanée — et une peau apaisée produit moins de sébum réactionnel." },
  { match: /masque|argile|exfoli|bha|aha|peeling/i, fact: "Moins mais mieux : trop exfolier fragilise la barrière. 1×/semaine suffit souvent largement." },
];

export function didYouKnow(category: string, product: string): string | null {
  const hay = `${category} ${product}`;
  return FACTS.find((f) => f.match.test(hay))?.fact ?? null;
}
