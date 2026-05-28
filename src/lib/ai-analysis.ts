import { createServerFn } from "@tanstack/react-start";
import type { AnalysisResultV2, SkinProfile } from "./cosmetic-ingredients";

// ─── Types ────────────────────────────────────────────────────────────────────

type BarometerSnapshot = { score: number; label: string };

type ProductSnapshot = {
  barometers: { irritation: BarometerSnapshot; comedogenic: BarometerSnapshot; pe: BarometerSnapshot };
  usageReco: string;
  productType: string | null;
  textureProfile: "light" | "medium" | "rich";
  counts: {
    edHigh: number;
    edMedium: number;
    allergens: number;
    irritants: number;
    comedogenic: number;
  };
  flags: {
    hasFragrance: boolean;
    hasAlcohol: boolean;
    hasAcids: boolean;
    hasSurfactants: boolean;
  };
};

export type ExplanationPayload = { product: ProductSnapshot; skinProfile: SkinProfile };
export type ComparisonPayload  = { productA: ProductSnapshot; productB: ProductSnapshot; skinProfile: SkinProfile };

export function toSnapshot(r: AnalysisResultV2): ProductSnapshot {
  const ings = r.ingredients;
  return {
    barometers: {
      irritation:  { score: r.barometers.irritation.score,  label: r.barometers.irritation.label },
      comedogenic: { score: r.barometers.comedogenic.score, label: r.barometers.comedogenic.label },
      pe:          { score: r.barometers.pe.score,          label: r.barometers.pe.label },
    },
    usageReco:    r.usageReco,
    productType:  r.productType,
    textureProfile:
      r.productType === "Crème/Huile" ? "rich" :
      r.productType === "Nettoyant" || r.productType === "Tonique" ? "light" : "medium",
    counts: {
      edHigh:      r.edHighCount,
      edMedium:    r.edMediumCount,
      allergens:   r.allergenCount,
      irritants:   r.irritantCount,
      comedogenic: r.comedogenicCount,
    },
    flags: {
      hasFragrance:   r.allergenCount > 0,
      hasAlcohol:     ings.some(i => i.flag === "irritant" && i.normalized?.toUpperCase().includes("ALCOHOL")),
      hasAcids:       ings.some(i => i.role?.startsWith("Exfoliant")),
      hasSurfactants: ings.some(i => i.flag === "irritant" && i.role === "Tensioactif"),
    },
  };
}

// ─── DeepSeek helper ──────────────────────────────────────────────────────────

async function callDeepSeek(systemPrompt: string, userContent: string, maxTokens = 300): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return "";

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent },
      ],
    }),
  });

  if (!res.ok) return "";
  const json: any = await res.json().catch(() => null);
  return json?.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── generateExplanationFn ────────────────────────────────────────────────────

const EXPLANATION_SYSTEM = `\
Tu es un conseiller cosmétique. Tu reçois les caractéristiques d'un produit (textureProfile, flags) et le profil peau d'une personne (skinType, acneTypes).

RÈGLES STRICTES :
• Ne jamais mentionner de scores, chiffres, baromètres ou métriques internes
• Ne jamais nommer d'ingrédients individuels
• Réponse en français, 4-6 lignes max, naturelle et accessible
• Sépare chaque idée par un saut de ligne (\n)

FORMAT OBLIGATOIRE :

Ligne 1 — Verdict : commence obligatoirement par l'une de ces phrases exactes selon la compatibilité avec le skinType fourni :
  "Ce produit est ADAPTÉ à ta peau"
  "Ce produit est À UTILISER AVEC PRUDENCE pour ta peau"
  "Ce produit n'est PAS RECOMMANDÉ pour ta peau"
  Ajoute ensuite une raison courte (5-7 mots max) sur la même ligne.

[saut de ligne]

Ligne 2 — Texture : traduis textureProfile (light→léger, medium→médium, rich→riche/nourrissant) et dis si c'est adapté au skinType. Ex : "Texture légère — idéale pour les peaux grasses et mixtes." ou "Texture riche — peut être trop lourde pour une peau grasse."

[saut de ligne]

Ligne 3-4 (seulement si flags présents) — Signaux notables : traduis en langage naturel uniquement les flags vrais (hasFragrance → "contient des fragrances, à surveiller pour les peaux sensibles", hasAlcohol → "contient de l'alcool, peut assécher", hasAcids → "contient des acides exfoliants, ne pas sur-utiliser", hasSurfactants + peaux sensibles → "tensioactifs présents"). Omets cette section si aucun flag.`;

export const generateExplanationFn = createServerFn({ method: "POST" })
  .inputValidator((d: ExplanationPayload) => d)
  .handler(async (ctx) => {
    const { product, skinProfile } = ctx.data;
    const text = await callDeepSeek(EXPLANATION_SYSTEM, JSON.stringify({ product, skinProfile }), 300);
    return { text };
  });

// ─── compareProductsFn ────────────────────────────────────────────────────────

const COMPARISON_SYSTEM = `\
Tu es un conseiller cosmétique. Tu reçois les caractéristiques de deux produits (textureProfile, flags) et le profil peau d'une personne.

RÈGLES STRICTES :
• Ne jamais mentionner de scores, chiffres, baromètres ou métriques internes
• Ne jamais nommer d'ingrédients individuels
• Réponse en français, 6-10 lignes max, naturelle et accessible
• Sépare chaque section par un saut de ligne (\n)

FORMAT OBLIGATOIRE :

Ligne 1 — Recommandation : "→ Produit A recommandé pour ton profil" / "→ Produit B recommandé pour ton profil" / "→ Équivalents pour ton profil"

[saut de ligne]

Produit A : verdict (ADAPTÉ / AVEC PRUDENCE / DÉCONSEILLÉ) · texture (léger/médium/riche) · compatibilité avec le skinType fourni en 1 phrase.

Produit B : verdict (ADAPTÉ / AVEC PRUDENCE / DÉCONSEILLÉ) · texture (léger/médium/riche) · compatibilité avec le skinType fourni en 1 phrase.

[saut de ligne]

Justification (1-2 lignes) : explique pourquoi l'un est préférable à l'autre pour ce profil spécifique, ou en quoi ils sont équivalents. Base-toi sur la texture et les flags (fragrances, alcool, comédogènes, acides) — pas sur des chiffres.`;

export const compareProductsFn = createServerFn({ method: "POST" })
  .inputValidator((d: ComparisonPayload) => d)
  .handler(async (ctx) => {
    const { productA, productB, skinProfile } = ctx.data;
    const text = await callDeepSeek(COMPARISON_SYSTEM, JSON.stringify({ productA, productB, skinProfile }), 360);
    return { text };
  });
