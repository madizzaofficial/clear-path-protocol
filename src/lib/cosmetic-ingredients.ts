export type EDSeverity = "high" | "medium";

export type EDEntry = { severity: EDSeverity; reason: string; description: string };

// ─── Perturbateurs endocriniens ───────────────────────────────────────────────
// Sources : ECHA SVHC, ChemSec SIN List, ANSES, SCCS opinions
export const ENDOCRINE_DISRUPTORS: Record<string, EDEntry> = {
  // UV filters — avérés
  "BENZOPHENONE-3":              { severity: "high",   reason: "Filtre UV, PE avéré (ECHA SVHC)",       description: "Absorbeur UV utilisé comme filtre solaire. Pénètre la peau et le sang, détecté dans le lait maternel. Classé perturbateur endocrinien avéré par l'ECHA : interfère avec les hormones thyroïdiennes et oestrogéniques. Réglementé mais toujours autorisé sous plafond EU." },
  "OXYBENZONE":                  { severity: "high",   reason: "Filtre UV, PE avéré (alias benzophenone-3)", description: "Alias de Benzophenone-3. Même profil de risque : PE avéré, haute pénétration cutanée, bioaccumulation. Interdit dans certaines zones marines (récifs coralliens)." },
  "HOMOSALATE":                  { severity: "high",   reason: "Filtre UV, PE avéré (SCCS 2020)",       description: "Filtre UV organique dont la concentration maximale a été abaissée par l'EU en 2021 suite à l'avis SCCS/1622/20. Perturbe les récepteurs des hormones sexuelles (œstrogènes, androgènes, progestérone). À éviter dans les produits quotidiens." },
  "ETHYLHEXYL METHOXYCINNAMATE": { severity: "high",   reason: "Filtre UV (octinoxate), PE avéré",      description: "Filtre UVB très répandu (crèmes solaires, produits de soin avec SPF). Pénètre la peau rapidement, perturbe la thyroïde et les œstrogènes chez l'animal. Interdit à Hawaii pour la protection des coraux. Avis SCCS recommande une réduction de concentration." },
  "OCTINOXATE":                  { severity: "high",   reason: "Filtre UV, PE avéré (alias EHMC)",      description: "Alias d'Ethylhexyl Methoxycinnamate. Même profil de risque PE." },
  "OCTYL METHOXYCINNAMATE":      { severity: "high",   reason: "Filtre UV, PE avéré",                   description: "Autre nom commercial pour l'Ethylhexyl Methoxycinnamate / Octinoxate." },
  "4-METHYLBENZYLIDENE CAMPHOR": { severity: "high",   reason: "Filtre UV, PE avéré (SCCS)",            description: "Filtre UVB interdit dans plusieurs pays. Propriétés œstrogéniques démontrées in vivo. En cours de restriction renforcée dans le règlement EU cosmétiques." },
  "BENZOPHENONE-4":              { severity: "high",   reason: "Filtre UV, PE suspecté",                description: "Filtre UV hydrosoluble, utilisé pour protéger les parfums et colorants. Moins étudié que BP-3 mais classé PE suspecté par plusieurs agences. Peut traverser la barrière cutanée." },
  "SULISOBENZONE":               { severity: "high",   reason: "Filtre UV, PE suspecté (alias BP-4)",   description: "Alias de Benzophenone-4. Même profil de risque." },
  "ETHYLHEXYL DIMETHYL PABA":    { severity: "high",   reason: "Filtre UV PABA, PE avéré",              description: "Dérivé du PABA (acide para-aminobenzoïque). Fort potentiel de photoallergie et propriétés œstrogéniques avérées. Quasiment abandonné par l'industrie mais encore présent dans certains produits." },
  "OCTYL DIMETHYL PABA":         { severity: "high",   reason: "Filtre UV PABA, PE avéré",              description: "Dérivé PABA. Propriétés œstrogéniques, photoallergie, pénétration cutanée. À éviter." },
  "DROMETRIZOLE TRISILOXANE":    { severity: "medium", reason: "Filtre UV, PE suspecté",                description: "Filtre UV large spectre d'usage croissant dans les soins de jour. Données PE limitées mais suspecté par précaution. Appartient à la famille des triazoles." },

  // Parabènes
  "BUTYLPARABEN":                { severity: "high",   reason: "Parabène, PE avéré (SCCS)",             description: "Conservateur parabène à chaîne longue. Activité œstrogénique la plus élevée de la famille. Interdit dans les produits pour bébés et enfants <3 ans en EU. Détecté dans les tumeurs du sein dans plusieurs études (lien causal non établi mais concernant)." },
  "ISOBUTYLPARABEN":             { severity: "high",   reason: "Parabène, PE avéré",                    description: "Isomère du butylparaben avec profil PE similaire. Interdit dans les produits bébé/enfant EU. Activité œstrogénique élevée." },
  "PROPYLPARABEN":               { severity: "high",   reason: "Parabène, PE avéré (SCCS 2013)",        description: "Classé PE avéré par le SCCS en 2013. Concentration maximale abaissée dans les produits ne couvrant pas de grandes surfaces. Perturbe les hormones thyroïdiennes et reproductives chez l'animal." },
  "ISOPROPYLPARABEN":            { severity: "high",   reason: "Parabène, PE avéré",                    description: "Isomère du propylparaben. Même niveau de préoccupation PE. Interdit dans les produits bébé EU." },
  "METHYLPARABEN":               { severity: "medium", reason: "Parabène, activité estrogénique faible", description: "Conservateur le plus utilisé dans les cosmétiques. Activité œstrogénique mesurée mais 10 000× plus faible que l'œstradiol naturel. Toujours autorisé EU mais controversé car bioaccumulable. Alternative : phénoxyéthanol, acide benzoïque." },
  "ETHYLPARABEN":                { severity: "medium", reason: "Parabène, activité estrogénique faible", description: "Conservateur de la famille des parabènes. Activité estrogénique légère. Moins étudié que methyl- et propylparaben. Souvent utilisé en combinaison avec d'autres parabènes (effet cocktail non évalué)." },
  "BENZYLPARABEN":               { severity: "high",   reason: "Parabène, PE avéré",                    description: "Parabène à activité PE élevée, moins courant mais présent dans certains produits. Profil similaire au butylparaben." },

  // Antibactériens
  "TRICLOSAN":                   { severity: "high",   reason: "PE avéré, perturbateur thyroïdien (ECHA SVHC)", description: "Antibactérien puissant, classé SVHC (Substance of Very High Concern) par l'ECHA. Perturbe la thyroïde, les œstrogènes et les androgènes. Favorise la résistance aux antibiotiques. Interdit dans les produits de rinçage EU depuis 2014 mais encore présent dans certains dentifrices et déodorants." },
  "TRICLOCARBAN":                { severity: "high",   reason: "PE avéré, similaire au triclosan",      description: "Antibactérien utilisé dans les savons solides. Profil PE similaire au triclosan : perturbation thyroïdienne et androgénique. Interdit aux USA dans les savons antibactériens depuis 2017 (FDA)." },

  // Phtalates
  "DIETHYL PHTHALATE":           { severity: "high",   reason: "Phtalate, PE avéré (ECHA SVHC)",       description: "Plastifiant utilisé comme fixateur de parfum dans les cosmétiques. SVHC selon l'ECHA. Perturbe les androgènes et œstrogènes, impact sur la fertilité masculine documenté. Souvent masqué sous le terme générique 'PARFUM'." },
  "DIBUTYL PHTHALATE":           { severity: "high",   reason: "Phtalate, PE avéré (ECHA SVHC)",       description: "Phtalate interdit dans les cosmétiques EU depuis 2004 mais encore présent dans des importations. SVHC. Perturbateur androgénique fort, reprotoxique de catégorie 1B." },
  "DIISOBUTYL PHTHALATE":        { severity: "high",   reason: "Phtalate, PE avéré",                   description: "Phtalate de substitution au DBP, profil toxicologique similaire. Interdit cosmétiques EU. Perturbateur reproductif." },

  // Antioxydants
  "BHA":                         { severity: "medium", reason: "Antioxydant, PE suspecté (SCCS)",      description: "Butylhydroxyanisole, antioxydant de synthèse utilisé comme conservateur de graisses. Classé PE suspecté par le SCCS et cancérogène possible (groupe 2B CIRC). Interdit dans les produits corps/mains EU depuis 2021 mais autorisé en fragrance." },
  "BUTYLATED HYDROXYANISOLE":    { severity: "medium", reason: "PE suspecté — alias BHA",              description: "Alias de BHA. Même profil de risque." },

  // Résorcinol
  "RESORCINOL":                  { severity: "medium", reason: "PE avéré (perturbateur thyroïdien)",   description: "Agent dépigmentant et antibactérien. Perturbe la fonction thyroïdienne (inhibe la synthèse des hormones T3/T4) de façon dose-dépendante. Utilisé dans les anti-pelliculaires et certains traitements acné." },
  "P-PHENYLENEDIAMINE":          { severity: "medium", reason: "PE suspecté, allergène fort",          description: "Colorant oxydatif utilisé dans les colorations capillaires. Fort potentiel allergisant (eczéma de contact). PE suspecté, génotoxique selon le SCCS." },

  // Silicones cycliques
  "CYCLOTETRASILOXANE":          { severity: "medium", reason: "Silicone cyclique D4, PE suspecté (ECHA)", description: "Silicone volatile (D4) classée SVHC par l'ECHA pour ses propriétés PE et sa persistance environnementale (PBT). Interdit >0,1% dans les cosmétiques de rinçage EU depuis 2020. Encore présent dans certains produits lissants." },
  "CYCLOPENTASILOXANE":          { severity: "medium", reason: "Silicone cyclique D5, PE suspecté (ECHA)", description: "Silicone volatile (D5) également classée PBT par l'ECHA. Restrictions croissantes en EU. Perturbateur endocrinien suspecté, bioaccumulable dans l'environnement aquatique." },
  "CYCLOHEXASILOXANE":           { severity: "medium", reason: "Silicone cyclique D6, PE suspecté",    description: "Silicone cyclique D6. Restrictions EU en cours, profil PE suspecté par analogie avec D4/D5." },

  // Muscs nitrés
  "MUSK AMBRETTE":               { severity: "high",   reason: "Musc nitré, PE avéré, interdit EU",    description: "Musc nitré interdit dans les cosmétiques EU (Annexe II). Neurotoxique et photoallergiène documenté. PE avéré." },
  "MUSK TIBETENE":               { severity: "high",   reason: "Musc nitré, PE avéré",                 description: "Musc nitré aux propriétés bioaccumulables et PE. Restrictions sévères." },
  "MUSK MOSKENE":                { severity: "high",   reason: "Musc nitré, PE avéré",                 description: "Musc nitré interdit ou fortement restreint. Bioaccumulable, PE." },

  // Autres
  "KOJIC ACID":                  { severity: "medium", reason: "PE suspecté (perturbateur thyroïdien)", description: "Agent dépigmentant populaire contre les taches. Inhibe la tyrosinase. Perturbateur thyroïdien suspecté à hautes concentrations. Restrictions d'usage en EU (max 1% dans les soins visage)." },
  "PHENOXYETHANOL":              { severity: "medium", reason: "PE suspecté, débat scientifique en cours", description: "Conservateur très répandu, présenté comme alternative aux parabènes. Controversé : PE suspecté selon certaines études in vitro, mais le SCCS le juge sûr aux concentrations actuelles (max 1%). Déconseillé chez les nourrissons (alerte ANSM 2012). Peut causer une irritation cutanée." },
};

// ─── Allergènes (UE Règlement 1223/2009 Annexe III + SCCS extended) ──────────
export type AllergenEntry = { euMandatory: boolean; description?: string };

export const ALLERGENS: Record<string, AllergenEntry> = {
  // Terme générique — masque potentiellement des centaines de molécules dont des phtalates et allergènes EU
  "PARFUM":     { euMandatory: false, description: "Terme générique qui peut désigner jusqu'à 3 000+ molécules différentes, dont des phtalates (DEP, DBP), des muscs synthétiques PE, et les 26 allergènes EU obligatoires. Une formule 'sans parfum' est préférable pour les peaux sensibles et à tendance acnéique. La réglementation EU impose la déclaration individuelle des allergènes au-dessus de certains seuils, mais le reste reste opaque." },
  "FRAGRANCE":  { euMandatory: false, description: "Alias de PARFUM (terme anglais). Même problématique d'opacité réglementaire." },
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

// ─── Irritants cutanés ────────────────────────────────────────────────────────
// Ingrédients irritants / perturbateurs de barrière cutanée, particulièrement
// problématiques pour les peaux à tendance acnéique
export type IrritantEntry = { reason: string; description: string };

export const IRRITANTS: Record<string, IrritantEntry> = {
  "SODIUM LAURYL SULFATE":       { reason: "Tensioactif irritant, perturbateur de barrière cutanée", description: "SLS : tensioactif anionique très moussant mais très agressif. Détruit le film lipidique de la peau, augmente la perméabilité cutanée et peut déclencher des réactions inflammatoires. Particulièrement problématique sur les peaux acnéiques car il aggrave l'inflammation et déshydrate l'épiderme. À éviter dans les nettoyants visage pour peaux sensibles." },
  "SODIUM DODECYL SULFATE":      { reason: "Alias du SLS — tensioactif irritant", description: "Alias chimique du Sodium Lauryl Sulfate. Même profil d'irritation et de perturbation de barrière." },
  "SODIUM LAURETH SULFATE":      { reason: "Tensioactif, peut être contaminé au 1,4-dioxane", description: "SLES : version éthoxylée du SLS, moins irritante mais susceptible d'être contaminée par du 1,4-dioxane (sous-produit de fabrication, cancérogène possible groupe 2B CIRC). La pureté dépend du procédé de fabrication. Toléré en formulation douce mais à surveiller pour les peaux sensibles." },
  "AMMONIUM LAURYL SULFATE":     { reason: "Tensioactif irritant, similaire au SLS", description: "Tensioactif anionique très proche du SLS. Même potentiel irritant, moins courant dans les soins visage." },
  "AMMONIUM LAURETH SULFATE":    { reason: "Tensioactif irritant", description: "Version ammonium du SLES. Profil irritant similaire." },
  "ALCOHOL DENAT":               { reason: "Alcool dénaturé, assèche et peut irriter", description: "Alcool éthylique dénaturé (rendu impropre à la consommation). À fortes concentrations, détruit le microbiome cutané, assèche l'épiderme et peut perturber la barrière lipidique. Utilisé comme antimicrobien et agent de texture dans les toniques et lotions. À doser modérément." },
  "SD ALCOHOL":                  { reason: "Alcool dénaturé, assèche et peut irriter", description: "Alias d'Alcohol Denat dans les nomenclatures américaines. Même profil de tolérance." },
  "ISOPROPYL ALCOHOL":           { reason: "Alcool irritant, perturbateur de barrière", description: "Alcool isopropylique, très astringent. Dégraisse fortement la peau, peut déclencher un rebond sébacé et aggraver l'acné inflammatoire. À éviter dans les soins visage acnéiques." },
  "ISOPROPYL MYRISTATE":         { reason: "Comédogène avéré", description: "Ester gras très comédogène (indice comédogénicité 5/5). Obstrue facilement les follicules pileux et peut déclencher ou aggraver l'acné. Utilisé comme émollient dans de nombreuses crèmes et fonds de teint." },
  "ISOPROPYL PALMITATE":         { reason: "Comédogène", description: "Ester gras comédogène (indice 4/5). Peut boucher les pores et aggraver les comédons." },
  "MYRISTYL MYRISTATE":          { reason: "Comédogène", description: "Ester gras comédogène. Présent dans certains émollients de fond de teint et crèmes corps." },
  "SODIUM CHLORIDE":             { reason: "Sel — peut irriter et assécher à haute concentration", description: "Le sel (chlorure de sodium) utilisé comme modificateur de viscosité. Aux concentrations élevées dans les formules nettoyantes, il peut irriter les yeux et assécher la peau. À faible dose, généralement inoffensif." },
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

export type IngredientFlag = "ed_high" | "ed_medium" | "allergen" | "irritant" | "petrochem" | "ok";

export type AnalyzedIngredient = {
  raw: string;
  normalized: string;
  flag: IngredientFlag;
  reason?: string;
  description?: string;
  euMandatory?: boolean;
};

export type AnalysisResult = {
  ingredients: AnalyzedIngredient[];
  edHighCount: number;
  edMediumCount: number;
  allergenCount: number;
  irritantCount: number;
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

    const edKey = Object.keys(ENDOCRINE_DISRUPTORS).find(
      (k) => norm === k || norm.includes(k)
    );
    if (edKey) {
      const entry = ENDOCRINE_DISRUPTORS[edKey];
      return {
        raw: token, normalized: norm,
        flag: entry.severity === "high" ? "ed_high" : "ed_medium",
        reason: entry.reason,
        description: entry.description,
      };
    }

    const allergenKey = Object.keys(ALLERGENS).find(
      (k) => norm === k || norm.includes(k)
    );
    if (allergenKey) {
      const entry = ALLERGENS[allergenKey];
      return {
        raw: token, normalized: norm,
        flag: "allergen",
        euMandatory: entry.euMandatory,
        description: entry.description,
      };
    }

    const irritantKey = Object.keys(IRRITANTS).find(
      (k) => norm === k || norm.includes(k)
    );
    if (irritantKey) {
      const entry = IRRITANTS[irritantKey];
      return {
        raw: token, normalized: norm,
        flag: "irritant",
        reason: entry.reason,
        description: entry.description,
      };
    }

    const isPetro = PETROCHEMICALS.some((k) => norm === k || norm.includes(k));
    if (isPetro) {
      return { raw: token, normalized: norm, flag: "petrochem" };
    }

    return { raw: token, normalized: norm, flag: "ok" };
  });

  const edHighCount   = ingredients.filter((i) => i.flag === "ed_high").length;
  const edMediumCount = ingredients.filter((i) => i.flag === "ed_medium").length;
  const allergenCount = ingredients.filter((i) => i.flag === "allergen").length;
  const irritantCount = ingredients.filter((i) => i.flag === "irritant").length;
  const petrochemCount = ingredients.filter((i) => i.flag === "petrochem").length;

  // Scoring : PE pénalise fortement avec un plafond par sévérité
  // Un seul PE medium → score max 70 ; un seul PE high → score max 40
  const edHighPenalty   = edHighCount * 30;
  const edMediumPenalty = edMediumCount * 15;
  const allergenPenalty = Math.min(allergenCount * 5, 20);
  let score = Math.max(0, 100 - edHighPenalty - edMediumPenalty - allergenPenalty);
  if (edHighCount > 0)   score = Math.min(score, 40);
  if (edMediumCount > 0) score = Math.min(score, 70);

  return { ingredients, edHighCount, edMediumCount, allergenCount, irritantCount, petrochemCount, score };
}
