import { createServerFn } from "@tanstack/react-start";
import type { AnalysisResultV2, SkinProfile } from "./cosmetic-ingredients";

// ─── Types ────────────────────────────────────────────────────────────────────

type BarometerSnapshot = {
  score: number;
  label: string;
};

type ProductSnapshot = {
  barometers: { irritation: BarometerSnapshot; comedogenic: BarometerSnapshot; pe: BarometerSnapshot };
  usageReco: string;
  productType: string | null;
  edHighCount: number;
  edMediumCount: number;
  allergenCount: number;
  irritantCount: number;
  comedogenicCount: number;
};

export type ExplanationPayload = {
  product: ProductSnapshot;
  skinProfile: SkinProfile;
};

export type ComparisonPayload = {
  productA: ProductSnapshot;
  productB: ProductSnapshot;
  skinProfile: SkinProfile;
};

function toSnapshot(r: AnalysisResultV2): ProductSnapshot {
  return {
    barometers: {
      irritation:   { score: r.barometers.irritation.score,   label: r.barometers.irritation.label },
      comedogenic:  { score: r.barometers.comedogenic.score,  label: r.barometers.comedogenic.label },
      pe:           { score: r.barometers.pe.score,           label: r.barometers.pe.label },
    },
    usageReco:        r.usageReco,
    productType:      r.productType,
    edHighCount:      r.edHighCount,
    edMediumCount:    r.edMediumCount,
    allergenCount:    r.allergenCount,
    irritantCount:    r.irritantCount,
    comedogenicCount: r.comedogenicCount,
  };
}

export { toSnapshot };

// ─── OpenAI helper ────────────────────────────────────────────────────────────

async function callGpt(systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "Service temporairement indisponible.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent },
      ],
    }),
  });

  if (!res.ok) return "Service temporairement indisponible.";
  const json: any = await res.json().catch(() => null);
  return json?.choices?.[0]?.message?.content?.trim() ?? "Service temporairement indisponible.";
}

// ─── generateExplanationFn ────────────────────────────────────────────────────

const EXPLANATION_SYSTEM = `Tu es un dermatologue expert en cosmétologie. Explique en français, en 5-6 lignes maximum, si ce produit cosmétique est adapté au profil peau fourni. Sois direct, sans jargon technique. Structure : 1 phrase verdict → raison principale → recommandation d'usage. Ne cite pas les ingrédients individuellement. Ne crée pas de nouveaux scores. Réponds uniquement en prose, sans liste ni tirets.`;

export const generateExplanationFn = createServerFn({ method: "POST" })
  .inputValidator((d: ExplanationPayload) => d)
  .handler(async (ctx) => {
    const { product, skinProfile } = ctx.data;
    const userContent = JSON.stringify({ product, skinProfile }, null, 2);
    const text = await callGpt(EXPLANATION_SYSTEM, userContent);
    return { text };
  });

// ─── compareProductsFn ────────────────────────────────────────────────────────

const COMPARISON_SYSTEM = `Tu es un dermatologue expert. Compare ces deux produits cosmétiques (Produit A et Produit B) pour le profil peau indiqué. Réponds en français en maximum 5 points. Commence OBLIGATOIREMENT par "→ Recommandé : Produit A" ou "→ Recommandé : Produit B" ou "→ Équivalents" sur la première ligne. Puis donne 3-4 différences clés ciblées sur ce profil spécifique. Explique pourquoi l'un est mieux adapté. N'invente pas de scores. Ne liste pas les ingrédients individuellement.`;

export const compareProductsFn = createServerFn({ method: "POST" })
  .inputValidator((d: ComparisonPayload) => d)
  .handler(async (ctx) => {
    const { productA, productB, skinProfile } = ctx.data;
    const userContent = JSON.stringify({ productA, productB, skinProfile }, null, 2);
    const text = await callGpt(COMPARISON_SYSTEM, userContent);
    return { text };
  });
