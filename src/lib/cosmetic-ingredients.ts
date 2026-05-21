export type EDSeverity = "high" | "medium";

export type EDEntry = { severity: EDSeverity; reason: string };

// ─── Perturbateurs endocriniens ───────────────────────────────────────────────
// Sources : ECHA SVHC, ChemSec SIN List, ANSES, SCCS opinions
export const ENDOCRINE_DISRUPTORS: Record<string, EDEntry> = {
  // UV filters — avérés
  "BENZOPHENONE-3":                    { severity: "high",   reason: "Filtre UV, PE avéré (ECHA SVHC)" },
  "OXYBENZONE":                        { severity: "high",   reason: "Filtre UV, PE avéré — alias benzophenone-3" },
  "HOMOSALATE":                        { severity: "high",   reason: "Filtre UV, PE avéré (SCCS 2020)" },
  "ETHYLHEXYL METHOXYCINNAMATE":       { severity: "high",   reason: "Filtre UV (octinoxate), PE avéré" },
  "OCTINOXATE":                        { severity: "high",   reason: "Filtre UV, PE avéré — alias EHMC" },
  "OCTYL METHOXYCINNAMATE":            { severity: "high",   reason: "Filtre UV, PE avéré" },
  "4-METHYLBENZYLIDENE CAMPHOR":       { severity: "high",   reason: "Filtre UV, PE avéré (SCCS)" },
  "BENZOPHENONE-4":                    { severity: "high",   reason: "Filtre UV, PE suspecté" },
  "SULISOBENZONE":                     { severity: "high",   reason: "Filtre UV, PE suspecté — alias benzophenone-4" },
  "ETHYLHEXYL DIMETHYL PABA":          { severity: "high",   reason: "Filtre UV, PE avéré" },
  "OCTYL DIMETHYL PABA":               { severity: "high",   reason: "Filtre UV, PE avéré" },
  "DROMETRIZOLE TRISILOXANE":          { severity: "medium", reason: "Filtre UV, PE suspecté" },

  // Parabènes
  "BUTYLPARABEN":                      { severity: "high",   reason: "Parabène, PE avéré (SCCS)" },
  "ISOBUTYLPARABEN":                   { severity: "high",   reason: "Parabène, PE avéré" },
  "PROPYLPARABEN":                     { severity: "high",   reason: "Parabène, PE avéré (SCCS 2013)" },
  "ISOPROPYLPARABEN":                  { severity: "high",   reason: "Parabène, PE avéré" },
  "METHYLPARABEN":                     { severity: "medium", reason: "Parabène, activité estrogénique faible" },
  "ETHYLPARABEN":                      { severity: "medium", reason: "Parabène, activité estrogénique faible" },
  "BENZYLPARABEN":                     { severity: "high",   reason: "Parabène, PE avéré" },

  // Antibactériens
  "TRICLOSAN":                         { severity: "high",   reason: "PE avéré, perturbateur thyroïdien (ECHA SVHC)" },
  "TRICLOCARBAN":                      { severity: "high",   reason: "PE avéré, similaire triclosan" },

  // Phtalates
  "DIETHYL PHTHALATE":                 { severity: "high",   reason: "Phtalate, PE avéré (ECHA SVHC)" },
  "DIBUTYL PHTHALATE":                 { severity: "high",   reason: "Phtalate, PE avéré (ECHA SVHC)" },
  "DIISOBUTYL PHTHALATE":              { severity: "high",   reason: "Phtalate, PE avéré" },

  // Antioxydants
  "BHA":                               { severity: "medium", reason: "Butylhydroxyanisole, PE suspecté (SCCS)" },
  "BUTYLATED HYDROXYANISOLE":          { severity: "medium", reason: "PE suspecté — alias BHA" },

  // Résorcinol
  "RESORCINOL":                        { severity: "medium", reason: "PE avéré (perturbateur thyroïdien)" },
  "P-PHENYLENEDIAMINE":                { severity: "medium", reason: "PE suspecté, allergène fort" },

  // Silicones cycliques
  "CYCLOTETRASILOXANE":                { severity: "medium", reason: "Silicone cyclique D4, PE suspecté (ECHA)" },
  "CYCLOPENTASILOXANE":                { severity: "medium", reason: "Silicone cyclique D5, PE suspecté (ECHA)" },
  "CYCLOHEXASILOXANE":                 { severity: "medium", reason: "Silicone cyclique D6, PE suspecté" },

  // Muscs nitrés
  "MUSK AMBRETTE":                     { severity: "high",   reason: "Musc nitré, PE avéré, interdit EU" },
  "MUSK TIBETENE":                     { severity: "high",   reason: "Musc nitré, PE avéré" },
  "MUSK MOSKENE":                      { severity: "high",   reason: "Musc nitré, PE avéré" },

  // Autres
  "KOJIC ACID":                        { severity: "medium", reason: "PE suspecté (perturbateur thyroïdien)" },
  "PHENOXYETHANOL":                    { severity: "medium", reason: "PE suspecté, débat scientifique en cours" },
};

// ─── Allergènes (UE Règlement 1223/2009 Annexe III + SCCS extended) ──────────
export type AllergenEntry = { euMandatory: boolean };

export const ALLERGENS: Record<string, AllergenEntry> = {
  // 26 allergènes EU obligatoires (Annexe III, déclaration ≥0.001% rinçage / ≥0.01% sans rinçage)
  "AMYL CINNAMAL":                           { euMandatory: true },
  "AMYLCINNAMYL ALCOHOL":                    { euMandatory: true },
  "BENZYL ALCOHOL":                          { euMandatory: true },
  "BENZYL SALICYLATE":                       { euMandatory: true },
  "CINNAMYL ALCOHOL":                        { euMandatory: true },
  "CINNAMALDEHYDE":                          { euMandatory: true },
  "CITRAL":                                  { euMandatory: true },
  "CITRONELLOL":                             { euMandatory: true },
  "COUMARIN":                                { euMandatory: true },
  "EUGENOL":                                 { euMandatory: true },
  "FARNESOL":                                { euMandatory: true },
  "GERANIOL":                                { euMandatory: true },
  "HEXYL CINNAMAL":                          { euMandatory: true },
  "HYDROXYCITRONELLAL":                      { euMandatory: true },
  "HYDROXYISOHEXYL 3-CYCLOHEXENE CARBOXALDEHYDE": { euMandatory: true },
  "HICC":                                    { euMandatory: true },
  "ISOEUGENOL":                              { euMandatory: true },
  "LIMONENE":                                { euMandatory: true },
  "LINALOOL":                                { euMandatory: true },
  "METHYL 2-OCTYNOATE":                      { euMandatory: true },
  "ANISE ALCOHOL":                           { euMandatory: true },
  "BENZYL BENZOATE":                         { euMandatory: true },
  "BENZYL CINNAMATE":                        { euMandatory: true },
  "ALPHA-ISOMETHYL IONONE":                  { euMandatory: true },
  "EVERNIA PRUNASTRI":                       { euMandatory: true },
  "EVERNIA FURFURACEA":                      { euMandatory: true },
  // Lilial — interdit EU depuis 2022
  "BUTYLPHENYL METHYLPROPIONAL":             { euMandatory: true },
  "LILIAL":                                  { euMandatory: true },

  // SCCS extended (non encore obligatoires mais à signaler)
  "HYDROXYMETHYLPENTYLCYCLOHEXENECARBOXALDEHYDE": { euMandatory: false },
  "METHYL HEPTINE CARBONATE":                { euMandatory: false },
  "METHYL OCTINE CARBONATE":                 { euMandatory: false },
  "TREEMOSS":                                { euMandatory: false },
  "OAKMOSS":                                 { euMandatory: false },
  "SANTALOL":                                { euMandatory: false },
  "COSTUS ROOT":                             { euMandatory: false },
  "PERU BALSAM":                             { euMandatory: false },
  "MYROXYLON PEREIRAE":                      { euMandatory: false },
  "YLANG YLANG OIL":                         { euMandatory: false },
  "JASMINE":                                 { euMandatory: false },
  "JASMIN ABSOLUTE":                         { euMandatory: false },
  "ROSE FLOWER OIL":                         { euMandatory: false },
  "CANANGA ODORATA":                         { euMandatory: false },
  "NARCISSUS POETICUS":                      { euMandatory: false },
  "ATRANORIN":                               { euMandatory: false },
  "CHLOROATRANORIN":                         { euMandatory: false },
};

// ─── Pétrochimiques ────────────────────────────────────────────────────────────
export const PETROCHEMICALS: string[] = [
  "PARAFFINUM LIQUIDUM",
  "PETROLATUM",
  "MINERAL OIL",
  "CERA MICROCRISTALLINA",
  "MICROCRYSTALLINE WAX",
  "OZOKERITE",
  "CERESIN",
  "PARAFFIN",
  "POLYISOBUTENE",
  "HYDROGENATED POLYISOBUTENE",
  "POLYBUTENE",
  "NAPHTHA",
  "ISOHEXADECANE",
  "ISODODECANE",
  "ISOEICOSANE",
  "POLYDECENE",
  "HYDROGENATED POLYDECENE",
  "SYNTHETIC WAX",
  "VASELINE",
];

// ─── Analyse ───────────────────────────────────────────────────────────────────

export type IngredientFlag = "ed_high" | "ed_medium" | "allergen" | "petrochem" | "ok";

export type AnalyzedIngredient = {
  raw: string;
  normalized: string;
  flag: IngredientFlag;
  reason?: string;
  euMandatory?: boolean;
};

export type AnalysisResult = {
  ingredients: AnalyzedIngredient[];
  edHighCount: number;
  edMediumCount: number;
  allergenCount: number;
  petrochemCount: number;
  score: number;
};

function normalize(s: string): string {
  return s.toUpperCase().replace(/\s+/g, " ").trim();
}

export function analyzeIngredients(raw: string): AnalysisResult {
  const tokens = raw
    .split(/[,\n]|\s\.\s/)
    .map((t) => t.trim())
    .filter(Boolean);

  const ingredients: AnalyzedIngredient[] = tokens.map((token) => {
    const norm = normalize(token);

    // Exact match first, then substring match for each database key
    const edKey = Object.keys(ENDOCRINE_DISRUPTORS).find(
      (k) => norm === k || norm.includes(k)
    );
    if (edKey) {
      const entry = ENDOCRINE_DISRUPTORS[edKey];
      return {
        raw: token,
        normalized: norm,
        flag: entry.severity === "high" ? "ed_high" : "ed_medium",
        reason: entry.reason,
      };
    }

    const allergenKey = Object.keys(ALLERGENS).find(
      (k) => norm === k || norm.includes(k)
    );
    if (allergenKey) {
      return {
        raw: token,
        normalized: norm,
        flag: "allergen",
        euMandatory: ALLERGENS[allergenKey].euMandatory,
      };
    }

    const isPetro = PETROCHEMICALS.some((k) => norm === k || norm.includes(k));
    if (isPetro) {
      return { raw: token, normalized: norm, flag: "petrochem" };
    }

    return { raw: token, normalized: norm, flag: "ok" };
  });

  const edHighCount  = ingredients.filter((i) => i.flag === "ed_high").length;
  const edMediumCount = ingredients.filter((i) => i.flag === "ed_medium").length;
  const allergenCount = ingredients.filter((i) => i.flag === "allergen").length;
  const petrochemCount = ingredients.filter((i) => i.flag === "petrochem").length;

  const edPenalty = Math.min(edHighCount * 20 + edMediumCount * 10, 90);
  const allergenPenalty = Math.min(allergenCount * 5, 25);
  const score = Math.max(0, 100 - edPenalty - allergenPenalty);

  return { ingredients, edHighCount, edMediumCount, allergenCount, petrochemCount, score };
}
