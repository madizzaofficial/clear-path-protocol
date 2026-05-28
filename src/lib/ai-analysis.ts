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
Tu es un interpréteur de signaux cosmétiques. Tu reçois uniquement des scores précalculés et des flags binaires — jamais de liste INCI brute.

RÈGLES STRICTES:
• Ne jamais analyser d'ingrédients individuels
• Ne jamais créer de nouveaux scores
• Ne jamais inventer d'effets ou d'ingrédients
• Réponse courte, décision en premier

FORMAT OBLIGATOIRE (en français):
Ligne 1 — Verdict: ✓ Adapté / ⚠ Avec prudence / ✗ Déconseillé + raison en 5-8 mots max
Lignes 2-5 — Explication: basée uniquement sur les scores et flags fournis (4-5 lignes max)
Dernière ligne — Risques: signal1 · signal2 · signal3 (max 3, seulement si présents)

Si données insuffisantes: "Données insuffisantes pour une recommandation fiable."`;

export const generateExplanationFn = createServerFn({ method: "POST" })
  .inputValidator((d: ExplanationPayload) => d)
  .handler(async (ctx) => {
    const { product, skinProfile } = ctx.data;
    const text = await callDeepSeek(EXPLANATION_SYSTEM, JSON.stringify({ product, skinProfile }), 280);
    return { text };
  });

// ─── compareProductsFn ────────────────────────────────────────────────────────

const COMPARISON_SYSTEM = `\
Tu es un interpréteur de comparaison cosmétique. Tu reçois les scores et flags de deux produits et un profil peau. Tu génères UNE recommandation claire et actionnable.

RÈGLES STRICTES:
• Toujours choisir Produit A ou Produit B — "Équivalents" seulement si écart < 0.5 sur tous les scores
• Priorité décision: irritation > comédogénicité > PE > texture
• Jamais d'ingrédients, jamais de nouveaux scores

FORMAT OBLIGATOIRE (en français):
Ligne 1: → Produit A recommandé / → Produit B recommandé / → Équivalents
• différence pratique 1 pour ce profil
• différence pratique 2
• différence pratique 3 max
[Nuance ou compromis en 2 lignes max si pertinent]

Si données insuffisantes: "Données insuffisantes pour une comparaison fiable."`;

export const compareProductsFn = createServerFn({ method: "POST" })
  .inputValidator((d: ComparisonPayload) => d)
  .handler(async (ctx) => {
    const { productA, productB, skinProfile } = ctx.data;
    const text = await callDeepSeek(COMPARISON_SYSTEM, JSON.stringify({ productA, productB, skinProfile }), 320);
    return { text };
  });
