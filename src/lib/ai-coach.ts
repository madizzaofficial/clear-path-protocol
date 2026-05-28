import { createServerFn } from "@tanstack/react-start";
import type { InciFlag } from "./inci-analysis";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiAnalysisResult = {
  draft: string;
  adminNote: string;
  final: string;
  analyzedAt: number;
};

export type SuggestedStep = {
  productId: string;
  productName: string;
  category: string;
  whyThisProduct: string;
  order: number;
};

export type RoutineSuggestion = {
  am: SuggestedStep[];
  pm: SuggestedStep[];
  reasoning: string;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | { type: string; [k: string]: unknown }[];
};

// ─── GPT-4o helper (vision) ───────────────────────────────────────────────────

async function callGpt4o(messages: ChatMessage[], maxTokens = 700): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(40_000),
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) return "";
  const json: any = await res.json().catch(() => null);
  return json?.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── DeepSeek helper (JSON mode) ─────────────────────────────────────────────

async function callDeepSeekCoach(systemPrompt: string, userContent: string, maxTokens = 1400): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return "";

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) return "";
  const json: any = await res.json().catch(() => null);
  return json?.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const INTAKE_SYSTEM_DRAFT = `Tu es un expert en cosmétologie médicale et en acné, assistant d'un coach de protocole peau.
Analyse le bilan initial à partir du profil rempli ET des photos fournies.

RÈGLES STRICTES :
• Décris UNIQUEMENT ce que tu observes réellement sur les photos. Ne déduis pas ce que tu ne vois pas.
• Distingue OBLIGATOIREMENT : lésions actives (comédons ouverts/fermés, pustules, papules, kystes avec relief) VS séquelles post-inflammatoires (marques rouges plates = érythème post-acnéique, marques brunes = hyperpigmentation post-inflammatoire).
• Si tu vois des marques rouges sans relief ni lésion active, dis "érythème post-acnéique", PAS "acné active".
• Ne liste pas de types de lésions que tu ne vois pas clairement sur la photo.

Réponds en français, en 5 parties numérotées :

1. **Lésions observées** (2-3 phrases) : distingue précisément lésions actives présentes / séquelles post-inflammatoires / état de surface de la peau. Sois factuel sur ce qui est visible.

2. **État de la barrière cutanée** (1-2 phrases) : évalue l'intégrité de la barrière — signes de fragilité, rougeurs réactives diffuses, zones de déshydratation, peau sensibilisée ou non.

3. **Niveau d'inflammation** : Faible / Modéré / Élevé — justifie brièvement par ce que tu observes.

4. **Orientations pour la routine** (liste à puces) : adaptées à ce qui est réellement observé. Ex : si séquelles post-inflammatoires prédominantes → unifier le teint, calmer l'inflammation résiduelle, actifs dépigmentants doux. Ex : si acné active → cibler les bactéries et réguler le sébum. Ne mentionne aucune marque ni produit.

5. **Points à valider par le coach** (2-3 max) : ce qui nécessite confirmation avant de construire la routine.`;

const INTAKE_SYSTEM_FINAL = `Tu es un expert en cosmétologie médicale et en acné, assistant d'un coach de protocole peau.
Tu reçois une analyse initiale détaillée (lésions, barrière cutanée, inflammation) et le retour du coach.

Intègre les deux perspectives et donne un verdict final structuré :

Ligne 1 : → GO : la routine peut être construite  /  → AJUSTEMENTS NÉCESSAIRES : [raison courte]

Ensuite (6-10 lignes max) :
- Phase prioritaire selon le profil (ex: réparer la barrière en premier, ou traiter l'acné active, ou unifier séquelles post-inflammatoires)
- Les 2-3 orientations clés à garder pour construire la routine
- Les précautions spécifiques à ce profil (actifs à éviter, associations à risque)

Sois précis et actionnable pour le coach.`;

const PROGRESS_SYSTEM_DRAFT = `Tu es un dermatologue expert en acné, assistant d'un coach de protocole peau.
Tu reçois les données de suivi d'un(e) élève : métriques (inflammation, barrière cutanée, acné) sur plusieurs semaines, et des photos de progression.

Analyse l'évolution et réponds en français en 4 parties :
1. Tendance globale (amélioration / stagnation / aggravation) — 1-2 phrases
2. Axes en progrès (liste)
3. Axes à surveiller (liste)
4. Suggestion d'action si nécessaire (1-2 phrases, ex: ajuster produit, ajouter étape)

Base-toi sur les chiffres ET les photos si présentes. Reste factuel.`;

const PROGRESS_SYSTEM_FINAL = `Tu es un dermatologue expert en acné, assistant d'un coach de protocole peau.
Tu reçois une analyse de progression initiale et le retour du coach.

Donne un verdict final clair :

Ligne 1 : → Sur la bonne voie  /  → Ajustements recommandés  /  → Protocole à revoir

Ensuite :
- Justification en 2-3 points
- Prochaine action concrète recommandée

Sois synthétique (6-10 lignes max).`;

const ROUTINE_SYSTEM = `Tu es un cosmétologue expert en routines acné. Tu reçois le profil peau d'un(e) élève et la liste des produits disponibles (sélection du coach) avec leurs analyses INCI.

Construis la routine AM/PM optimale selon ces priorités :
1. Synergie des actifs (pas d'AHA + rétinol le matin, ne pas empiler des acides exfoliants, etc.)
2. Texture adaptée au type de peau (léger pour peau grasse/mixte, plus riche pour peau sèche)
3. Ordre d'application optimal (du plus léger au plus épais)
4. Ingrédients à éviter selon le profil : comédogènes si peau grasse/mixte, irritants si peau sensible

Utilise UNIQUEMENT les produits fournis dans la liste. Ne suggère pas de produits absents.
Chaque produit ne peut apparaître qu'une fois (soit AM, soit PM, pas les deux).

Réponds UNIQUEMENT en JSON valide avec ce schéma exact :
{
  "am": [{ "productId": string, "productName": string, "category": string, "whyThisProduct": string, "order": number }],
  "pm": [{ "productId": string, "productName": string, "category": string, "whyThisProduct": string, "order": number }],
  "reasoning": string
}`;

// ─── analyzeIntakeFn ──────────────────────────────────────────────────────────

type IntakeInput = {
  skinType?: string;
  acneTypes?: string[];
  intensity?: string;
  currentRoutine?: string;
  mainGoal?: string;
};

export const analyzeIntakeFn = createServerFn({ method: "POST" })
  .inputValidator((d: { intake: IntakeInput; photoUrls: string[]; adminNote?: string }) => d)
  .handler(async (ctx): Promise<{ text: string }> => {
    const { intake, photoUrls, adminNote } = ctx.data;

    const profileText = [
      `Type de peau : ${intake.skinType ?? "non renseigné"}`,
      `Types d'acné : ${intake.acneTypes?.join(", ") ?? "non renseigné"}`,
      `Intensité : ${intake.intensity ?? "non renseigné"}`,
      `Routine actuelle : ${intake.currentRoutine ?? "aucune"}`,
      `Objectif principal : ${intake.mainGoal ?? "non renseigné"}`,
    ].join("\n");

    if (adminNote) {
      // 2nd turn: final verdict
      const userContent = `ANALYSE INITIALE :\n${adminNote}\n\nNOTE DU COACH :\n${adminNote}`;
      // Build messages with optional photos for context
      const messages: ChatMessage[] = [
        { role: "system", content: INTAKE_SYSTEM_FINAL },
        { role: "user", content: userContent },
      ];
      const text = await callGpt4o(messages, 500);
      return { text };
    }

    // 1st turn: initial analysis with vision
    const userContentBlocks: { type: string; [k: string]: unknown }[] = [
      { type: "text", text: `Profil élève :\n${profileText}` },
      ...photoUrls.slice(0, 4).map((url) => ({
        type: "image_url",
        image_url: { url, detail: "low" },
      })),
    ];

    const messages: ChatMessage[] = [
      { role: "system", content: INTAKE_SYSTEM_DRAFT },
      { role: "user", content: userContentBlocks },
    ];

    const text = await callGpt4o(messages, 700);
    return { text };
  });

// ─── analyzeIntakeFinalFn ─────────────────────────────────────────────────────

export const analyzeIntakeFinalFn = createServerFn({ method: "POST" })
  .inputValidator((d: { intake: IntakeInput; photoUrls: string[]; draft: string; adminNote: string }) => d)
  .handler(async (ctx): Promise<{ text: string }> => {
    const { intake, photoUrls, draft, adminNote } = ctx.data;

    const profileText = [
      `Type de peau : ${intake.skinType ?? "non renseigné"}`,
      `Types d'acné : ${intake.acneTypes?.join(", ") ?? "non renseigné"}`,
      `Intensité : ${intake.intensity ?? "non renseigné"}`,
    ].join("\n");

    const userContentBlocks: { type: string; [k: string]: unknown }[] = [
      {
        type: "text",
        text: `Profil élève :\n${profileText}\n\nANALYSE INITIALE :\n${draft}\n\nNOTE DU COACH :\n${adminNote}`,
      },
      ...photoUrls.slice(0, 4).map((url) => ({
        type: "image_url",
        image_url: { url, detail: "low" },
      })),
    ];

    const messages: ChatMessage[] = [
      { role: "system", content: INTAKE_SYSTEM_FINAL },
      { role: "user", content: userContentBlocks },
    ];

    const text = await callGpt4o(messages, 500);
    return { text };
  });

// ─── analyzeProgressFn ───────────────────────────────────────────────────────

type ProgressPhoto = { url: string; date: string; label?: string };
type SkinStateEntry = { inflammation: number; barrier: number; acne: number; date: number };

export const analyzeProgressFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    photos: ProgressPhoto[];
    skinStateHistory: SkinStateEntry[];
    adminContext?: string;
  }) => d)
  .handler(async (ctx): Promise<{ text: string }> => {
    const { photos, skinStateHistory, adminContext } = ctx.data;

    const historyText = skinStateHistory
      .slice(-8)
      .map((e) => {
        const d = new Date(e.date).toLocaleDateString("fr-FR");
        return `${d} — inflammation: ${e.inflammation}/10, barrière: ${e.barrier}/10, acné: ${e.acne}/10`;
      })
      .join("\n");

    const userContentBlocks: { type: string; [k: string]: unknown }[] = [
      {
        type: "text",
        text: [
          `MÉTRIQUES (${skinStateHistory.length} mesures) :`,
          historyText || "Aucune mesure disponible",
          adminContext ? `\nCONTEXTE COACH :\n${adminContext}` : "",
          photos.length > 0 ? `\n${photos.length} photo(s) de progression :` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
      ...photos.slice(0, 6).map((p) => ({
        type: "image_url",
        image_url: { url: p.url, detail: "low" },
      })),
    ];

    const messages: ChatMessage[] = [
      { role: "system", content: PROGRESS_SYSTEM_DRAFT },
      { role: "user", content: userContentBlocks },
    ];

    const text = await callGpt4o(messages, 600);
    return { text };
  });

// ─── analyzeProgressFinalFn ───────────────────────────────────────────────────

export const analyzeProgressFinalFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    photos: ProgressPhoto[];
    skinStateHistory: SkinStateEntry[];
    adminContext?: string;
    draft: string;
    adminNote: string;
  }) => d)
  .handler(async (ctx): Promise<{ text: string }> => {
    const { photos, skinStateHistory, adminContext, draft, adminNote } = ctx.data;

    const historyText = skinStateHistory
      .slice(-8)
      .map((e) => {
        const d = new Date(e.date).toLocaleDateString("fr-FR");
        return `${d} — inflammation: ${e.inflammation}/10, barrière: ${e.barrier}/10, acné: ${e.acne}/10`;
      })
      .join("\n");

    const userContentBlocks: { type: string; [k: string]: unknown }[] = [
      {
        type: "text",
        text: [
          `MÉTRIQUES :\n${historyText || "Aucune"}`,
          adminContext ? `CONTEXTE : ${adminContext}` : "",
          `\nANALYSE INITIALE :\n${draft}`,
          `\nNOTE DU COACH :\n${adminNote}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      ...photos.slice(0, 6).map((p) => ({
        type: "image_url",
        image_url: { url: p.url, detail: "low" },
      })),
    ];

    const messages: ChatMessage[] = [
      { role: "system", content: PROGRESS_SYSTEM_FINAL },
      { role: "user", content: userContentBlocks },
    ];

    const text = await callGpt4o(messages, 400);
    return { text };
  });

// ─── suggestRoutineFn ─────────────────────────────────────────────────────────

type FeaturedProductInput = {
  id: string;
  name: string;
  brand?: string;
  category: string;
  inciAnalysis?: {
    verdict: string;
    texture: { label: string; suited_for: string[]; avoid_for: string[] };
    flags: Pick<InciFlag, "name" | "category" | "risk">[];
  };
  suitableForSkinTypes?: string[];
};

export const suggestRoutineFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    intake: { skinType?: string; acneTypes?: string[]; intensity?: string };
    featuredProducts: FeaturedProductInput[];
  }) => d)
  .handler(async (ctx): Promise<RoutineSuggestion | null> => {
    const { intake, featuredProducts } = ctx.data;

    if (!featuredProducts.length) return null;

    const profileText = [
      `Type de peau : ${intake.skinType ?? "non renseigné"}`,
      `Types d'acné : ${intake.acneTypes?.join(", ") ?? "non renseigné"}`,
      `Intensité acné : ${intake.intensity ?? "non renseigné"}`,
    ].join("\n");

    const productsText = featuredProducts
      .map((p) => {
        const lines = [`- ID: ${p.id} | ${p.name}${p.brand ? ` (${p.brand})` : ""} | Catégorie: ${p.category}`];
        if (p.suitableForSkinTypes?.length)
          lines.push(`  Adaptés : ${p.suitableForSkinTypes.join(", ")}`);
        if (p.inciAnalysis) {
          lines.push(`  INCI verdict: ${p.inciAnalysis.verdict} | Texture: ${p.inciAnalysis.texture.label}`);
          lines.push(`  Textures adaptées: ${p.inciAnalysis.texture.suited_for.join(", ")}`);
          lines.push(`  Textures à éviter: ${p.inciAnalysis.texture.avoid_for.join(", ")}`);
          if (p.inciAnalysis.flags.length)
            lines.push(`  Flags: ${p.inciAnalysis.flags.map((f) => `${f.name}(${f.risk})`).join(", ")}`);
        }
        return lines.join("\n");
      })
      .join("\n");

    const userContent = `PROFIL ÉLÈVE :\n${profileText}\n\nPRODUITS DISPONIBLES (Ma Sélection) :\n${productsText}`;

    const raw = await callDeepSeekCoach(ROUTINE_SYSTEM, userContent, 1400);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as RoutineSuggestion;
      if (!Array.isArray(parsed.am) || !Array.isArray(parsed.pm)) return null;
      return parsed;
    } catch {
      return null;
    }
  });
