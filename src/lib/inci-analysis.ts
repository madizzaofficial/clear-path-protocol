import { createServerFn } from "@tanstack/react-start";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InciFlag = {
  name: string;
  category: "comédogène" | "irritant" | "perturbateur";
  concern: string;
  risk: "élevé" | "moyen" | "faible";
  riskFor: string[];
};

export type InciAnalysis = {
  verdict: "compatible" | "prudence" | "déconseillé";
  score: number;
  texture: {
    label: string;
    suited_for: string[];
    avoid_for: string[];
  };
  summary: string;
  flags: InciFlag[];
  analyzedAt: number;
};

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert en cosmétologie spécialisé dans les peaux acnéiques.
Analyse la liste INCI fournie selon 4 axes :
1. Ingrédients comédogènes (bouchent les pores, favorisent les comédons)
2. Ingrédients irritants (alcool dénaturé, parfums synthétiques, conservateurs agressifs, acides concentrés)
3. Perturbateurs endocriniens (parabens, certains filtres UV chimiques, phénoxyéthanol en formule dominante)
4. Texture globale de la formule : légère / équilibrée / riche / très riche ou occlusive
   — évalue l'adéquation aux types de peau : Normale, Grasse, Sèche, Mixte, Sensible
   — base-toi sur la nature et la proportion des émollients, agents filmogènes et humectants

Contexte fixe : toutes les personnes ont une problématique acnéique.
Les types d'acné possibles (valeurs exactes à utiliser dans riskFor) : comedons, papules, microkystes, kystes.
Les types de peau (valeurs exactes à utiliser dans riskFor) : Normale, Grasse, Sèche, Mixte, Sensible.

Ne liste que les ingrédients réellement présents dans la liste fournie.
Ne liste pas les ingrédients sans risque.
score = compatibilité globale pour peau acnéique (1 = très problématique, 10 = excellent).

Réponds UNIQUEMENT en JSON valide, aucun texte autour, avec ce schéma exact :
{
  "verdict": "compatible" | "prudence" | "déconseillé",
  "score": number,
  "texture": { "label": string, "suited_for": string[], "avoid_for": string[] },
  "summary": string,
  "flags": [{ "name": string, "category": "comédogène"|"irritant"|"perturbateur", "concern": string, "risk": "élevé"|"moyen"|"faible", "riskFor": string[] }]
}`;

// ─── DeepSeek helper ──────────────────────────────────────────────────────────

async function callDeepSeek(userContent: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return "";

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) return "";
  const json: any = await res.json().catch(() => null);
  return json?.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Server function ──────────────────────────────────────────────────────────

export const analyzeInciFn = createServerFn({ method: "POST" })
  .inputValidator((d: { inciText: string; productName: string }) => d)
  .handler(async (ctx): Promise<InciAnalysis | null> => {
    const { inciText, productName } = ctx.data;
    if (!inciText.trim()) return null;

    const userContent = `Produit : ${productName}\nIngrédients INCI : ${inciText}`;
    const raw = await callDeepSeek(userContent);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as InciAnalysis;
      parsed.analyzedAt = Date.now();
      return parsed;
    } catch {
      return null;
    }
  });

// ─── Personalization (client-side) ───────────────────────────────────────────

export function getPersonalizedAnalysis(
  analysis: InciAnalysis,
  profile: { skinType: string; acneTypes: string[] }
) {
  const relevantFlags = analysis.flags.filter((f) =>
    f.riskFor.some((r) => r === profile.skinType || profile.acneTypes.includes(r))
  );
  const textureWarning = analysis.texture.avoid_for.includes(profile.skinType);
  const textureSuited = analysis.texture.suited_for.includes(profile.skinType);

  let personalizedVerdict: "compatible" | "prudence" | "déconseillé" = "compatible";
  if (relevantFlags.some((f) => f.risk === "élevé") || textureWarning) {
    personalizedVerdict = "déconseillé";
  } else if (relevantFlags.some((f) => f.risk === "moyen")) {
    personalizedVerdict = "prudence";
  }

  return { relevantFlags, textureWarning, textureSuited, personalizedVerdict };
}
