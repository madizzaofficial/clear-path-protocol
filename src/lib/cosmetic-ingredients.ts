import inciDbRaw from "./inci-db.json";

// Build INCI_NAME → entry index once at module load
type InciDbEntry = { role_fr?: string | null; inci_name?: string | null; found?: boolean };
const INCI_DB: Map<string, InciDbEntry> = new Map(
  Object.values(inciDbRaw as Record<string, InciDbEntry>)
    .filter((e) => e.inci_name)
    .map((e) => [e.inci_name as string, e])
);

export type EDSeverity = "high" | "medium";
export type EDEntry = { severity: EDSeverity; reason: string; description: string };
export type AllergenEntry = { euMandatory: boolean; description: string };
export type IrritantEntry = { reason: string; description: string; irritationLevel: 1 | 2 | 3 };
export type PetrochemEntry = { description: string };

// ─── Perturbateurs endocriniens ───────────────────────────────────────────────
export const ENDOCRINE_DISRUPTORS: Record<string, EDEntry> = {
  // Filtres UV — avérés
  "BENZOPHENONE-3":              { severity: "high",   reason: "Filtre UV, PE avéré (ECHA SVHC)",           description: "Filtre UV qui pénètre dans le sang et a été détecté dans le lait maternel. Perturbateur hormonal avéré (ECHA) : agit sur les œstrogènes et la thyroïde. Peaux concernées : toutes, surtout peaux jeunes et à barrière fragilisée." },
  "OXYBENZONE":                  { severity: "high",   reason: "Filtre UV, PE avéré (alias benzophenone-3)", description: "Alias de Benzophenone-3 (nom INCI américain). Même profil PE avéré : pénétration cutanée élevée, perturbation hormonale. Peaux concernées : toutes." },
  "HOMOSALATE":                  { severity: "high",   reason: "Filtre UV, PE avéré (SCCS 2020)",           description: "Filtre UV dont le seuil maximal EU a été abaissé en 2021. Perturbe les œstrogènes, androgènes et progestérone. Peaux concernées : toutes, à éviter dans les soins visage quotidiens." },
  "ETHYLHEXYL METHOXYCINNAMATE": { severity: "high",   reason: "Filtre UV (octinoxate), PE avéré",          description: "Filtre UVB très répandu, pénètre rapidement la peau. Perturbateur thyroïdien et œstrogénique avéré. Peaux concernées : toutes, particulièrement les peaux sensibles et acnéiques." },
  "OCTINOXATE":                  { severity: "high",   reason: "Filtre UV, PE avéré (alias EHMC)",          description: "Alias d'Ethylhexyl Methoxycinnamate. Même profil PE avéré." },
  "OCTYL METHOXYCINNAMATE":      { severity: "high",   reason: "Filtre UV, PE avéré",                       description: "Autre nom commercial pour l'Ethylhexyl Methoxycinnamate. Même profil PE." },
  "4-METHYLBENZYLIDENE CAMPHOR": { severity: "high",   reason: "Filtre UV, PE avéré (SCCS)",                description: "Filtre UVB interdit dans plusieurs pays. Activité œstrogénique démontrée in vivo. Peaux concernées : toutes." },
  "BENZOPHENONE-4":              { severity: "high",   reason: "Filtre UV, PE suspecté",                    description: "Filtre UV hydrosoluble, PE suspecté. Peut traverser la barrière cutanée. Peaux concernées : toutes, particulièrement les peaux fragilisées." },
  "SULISOBENZONE":               { severity: "high",   reason: "Filtre UV, PE suspecté (alias BP-4)",       description: "Alias de Benzophenone-4. Même profil PE suspecté." },
  "ETHYLHEXYL DIMETHYL PABA":    { severity: "high",   reason: "Filtre UV PABA, PE avéré",                  description: "Dérivé PABA. Propriétés œstrogéniques avérées et fort risque de photoallergie. Peaux concernées : peaux sensibles, réactives et acnéiques." },
  "OCTYL DIMETHYL PABA":         { severity: "high",   reason: "Filtre UV PABA, PE avéré",                  description: "Dérivé PABA. Œstrogénique et photoallergène. Peaux concernées : peaux sensibles." },
  "DROMETRIZOLE TRISILOXANE":    { severity: "medium", reason: "Filtre UV, PE suspecté",                    description: "Filtre UV large spectre d'usage croissant dans les soins de jour. PE suspecté par précaution, données encore limitées. Peaux concernées : toutes." },

  // Parabènes
  "BUTYLPARABEN":                { severity: "high",   reason: "Parabène, PE avéré (SCCS)",                 description: "Conservateur parabène à chaîne longue, activité œstrogénique élevée. Interdit dans les produits bébé/enfant EU. Retrouvé dans certaines tumeurs du sein dans plusieurs études. Peaux concernées : toutes, surtout peaux à acné hormonale." },
  "ISOBUTYLPARABEN":             { severity: "high",   reason: "Parabène, PE avéré",                        description: "Isomère du butylparaben, profil PE similaire. Interdit dans les produits bébé EU. Peaux concernées : toutes, surtout peaux à acné hormonale." },
  "PROPYLPARABEN":               { severity: "medium", reason: "Parabène, activité anti-androgénique (SCCS 2013)", description: "Activité anti-androgénique démontrée en études animales. Le SCCS (2013) a restreint son usage dans les produits enfants EU. Aux concentrations adultes normales (≤0,14%), considéré sûr par FDA et SCCS. Peaux concernées : toutes — prudence lors d'usage prolongé sur grandes surfaces." },
  "ISOPROPYLPARABEN":            { severity: "medium", reason: "Parabène, profil similaire au propylparaben", description: "Isomère du propylparaben. Restrictions similaires dans les produits enfants EU. Peaux concernées : toutes." },
  "METHYLPARABEN":               { severity: "medium", reason: "Parabène, activité estrogénique très faible", description: "Conservateur le plus courant des parabènes. Activité œstrogénique 10 000–1 000 000× plus faible que l'œstradiol. FDA et SCCS le considèrent sûr aux concentrations habituelles. Présence dans tumeurs mammaires détectée (2004) mais lien causal non établi. Peaux concernées : toutes." },
  "ETHYLPARABEN":                { severity: "medium", reason: "Parabène, activité estrogénique très faible", description: "Profil proche du méthylparaben. Activité estrogénique très faible. Considéré sûr par les principaux régulateurs. Peaux concernées : toutes." },
  "BENZYLPARABEN":               { severity: "high",   reason: "Parabène, PE avéré",                        description: "Parabène à activité PE élevée, profil proche du butylparaben. Peaux concernées : toutes." },

  // Antibactériens
  "TRICLOSAN":                   { severity: "high",   reason: "PE avéré, perturbateur thyroïdien (ECHA SVHC)", description: "Antibactérien classé SVHC par l'ECHA. Perturbe la thyroïde, les œstrogènes et les androgènes. Favorise aussi la résistance aux antibiotiques. Peaux concernées : toutes, particulièrement les peaux acnéiques sous traitement antibiotique." },
  "TRICLOCARBAN":                { severity: "high",   reason: "PE avéré, similaire au triclosan",          description: "Antibactérien aux propriétés PE similaires au triclosan. Perturbation thyroïdienne et androgénique. Interdit aux USA depuis 2017 (FDA). Peaux concernées : toutes." },

  // Phtalates
  "DIETHYL PHTHALATE":           { severity: "high",   reason: "Phtalate, PE avéré (ECHA SVHC)",           description: "Fixateur de parfum souvent masqué sous le terme générique 'PARFUM'. PE avéré (ECHA SVHC), impact sur la fertilité masculine documenté. Peaux concernées : toutes." },
  "DIBUTYL PHTHALATE":           { severity: "high",   reason: "Phtalate, PE avéré (ECHA SVHC)",           description: "Phtalate interdit dans les cosmétiques EU. PE avéré, reprotoxique 1B. Encore présent dans certaines importations hors EU. Peaux concernées : toutes." },
  "DIISOBUTYL PHTHALATE":        { severity: "high",   reason: "Phtalate, PE avéré",                       description: "Phtalate de substitution au DBP, interdit en EU cosmétiques. PE avéré. Peaux concernées : toutes." },

  // Antioxydants
  "BHA":                         { severity: "medium", reason: "Antioxydant, PE suspecté (SCCS)",           description: "Antioxydant de synthèse (ne pas confondre avec l'acide bêta-hydroxy). PE suspecté par le SCCS, potentiellement cancérogène (CIRC 2B). Interdit produits corps/mains EU depuis 2021. Peaux concernées : toutes." },
  "BUTYLATED HYDROXYANISOLE":    { severity: "medium", reason: "PE suspecté — alias BHA",                  description: "Alias de BHA. Même profil PE suspecté." },

  // Résorcinol
  "RESORCINOL":                  { severity: "medium", reason: "PE avéré (perturbateur thyroïdien)",        description: "Agent dépigmentant et antibactérien. Perturbe la synthèse des hormones thyroïdiennes à usage prolongé. Peaux concernées : toutes, surtout peaux sous traitement dépigmentant ou anti-acné au long cours." },
  "P-PHENYLENEDIAMINE":          { severity: "medium", reason: "PE suspecté, allergène fort",               description: "Colorant oxydatif des colorations capillaires. Fort potentiel allergisant (eczéma de contact) et PE suspecté. Peaux concernées : peaux sensibles et réactives." },

  // Silicones cycliques
  "CYCLOTETRASILOXANE":          { severity: "medium", reason: "Silicone cyclique D4, PE suspecté (ECHA)", description: "Silicone volatile D4, classée SVHC par l'ECHA. PE suspecté, persistante et bioaccumulable. Interdit >0,1% dans les produits de rinçage EU depuis 2020. Peaux concernées : toutes, impact surtout environnemental." },
  "CYCLOPENTASILOXANE":          { severity: "medium", reason: "Silicone cyclique D5, PE suspecté (ECHA)", description: "Silicone volatile D5, restrictions EU croissantes. PE suspecté, bioaccumulable. Souvent présent dans les sérums et primers. Peaux concernées : toutes, impact surtout environnemental." },

  // Muscs nitrés
  "MUSK AMBRETTE":               { severity: "high",   reason: "Musc nitré, PE avéré, interdit EU",        description: "Musc nitré interdit dans les cosmétiques EU. Neurotoxique, photoallergiène et PE avéré. Peaux concernées : toutes." },
  "MUSK TIBETENE":               { severity: "high",   reason: "Musc nitré, PE avéré",                     description: "Musc nitré bioaccumulable et PE avéré. Peaux concernées : toutes." },
  "MUSK MOSKENE":                { severity: "high",   reason: "Musc nitré, PE avéré",                     description: "Musc nitré interdit ou fortement restreint. Bioaccumulable, PE avéré. Peaux concernées : toutes." },

  // Autres
  "KOJIC ACID":                  { severity: "medium", reason: "PE suspecté (perturbateur thyroïdien)",     description: "Agent dépigmentant populaire contre les taches. Perturbateur thyroïdien suspecté à concentrations élevées. Limité à 1% en EU. Peaux concernées : toutes les peaux sous traitement dépigmentant prolongé." },
  "METHOXYPROPYLAMINO CYCLOHEXENYLIDENE ETHOXYETHYLCYANOACETATE": { severity: "medium", reason: "Filtre UV organique, activité estrogénique suspectée in vitro", description: "Filtre UV organique (MCE). Des ��tudes in vitro suggèrent une activité estrogénique faible. Non encore classé par l'ECHA mais sous surveillance. Peaux concernées : toutes, en particulier peaux à acné hormonale." },
};

// ─── Allergènes (UE Règlement 1223/2009 Annexe III + SCCS extended) ──────────
export const ALLERGENS: Record<string, AllergenEntry> = {
  // Termes génériques
  "PARFUM":     { euMandatory: false, description: "Terme générique qui peut désigner jusqu'à 3 000+ molécules dont des phtalates PE et les 26 allergènes EU obligatoires. Peaux concernées : peaux sensibles, acnéiques et réactives — une formule sans parfum est préférable." },
  "FRAGRANCE":  { euMandatory: false, description: "Alias anglais de PARFUM. Même opacité réglementaire sur les molécules contenues. Peaux concernées : peaux sensibles, acnéiques et réactives." },

  // 26 allergènes EU obligatoires
  "AMYL CINNAMAL":                           { euMandatory: true,  description: "Aldéhyde à odeur de jasmin. Peut provoquer un eczéma de contact. Peaux concernées : peaux sensibles et réactives." },
  "AMYLCINNAMYL ALCOHOL":                    { euMandatory: true,  description: "Alcool cinnamique, sensitisant cutané. Peaux concernées : peaux sensibles." },
  "BENZYL ALCOHOL":                          { euMandatory: true,  description: "Solvant et conservateur naturel. Peut provoquer des réactions de contact. Peaux concernées : peaux sensibles et réactives." },
  "BENZYL SALICYLATE":                       { euMandatory: true,  description: "Ester floral, sensitisant cutané. Peaux concernées : peaux sensibles." },
  "CINNAMYL ALCOHOL":                        { euMandatory: true,  description: "Alcool de cannelle, réactions cutanées fréquentes. Peaux concernées : peaux sensibles et réactives." },
  "CINNAMALDEHYDE":                          { euMandatory: true,  description: "Aldéhyde de cannelle, allergène fort. Réactions de contact même à faibles doses. Peaux concernées : peaux sensibles, acnéiques et réactives." },
  "CITRAL":                                  { euMandatory: true,  description: "Terpène d'agrumes et de citronnelle, sensitisant cutané courant. Peaux concernées : peaux sensibles et réactives." },
  "CITRONELLOL":                             { euMandatory: true,  description: "Terpène floral (rose, géranium). Peut provoquer de l'eczéma de contact. Peaux concernées : peaux sensibles." },
  "COUMARIN":                                { euMandatory: true,  description: "Composé aromatique (fève tonka, cannelle), sensitisant. Peaux concernées : peaux sensibles." },
  "EUGENOL":                                 { euMandatory: true,  description: "Composant des clous de girofle et de la cannelle, allergène fort. Réactions de contact fréquentes. Peaux concernées : peaux sensibles et réactives." },
  "FARNESOL":                                { euMandatory: true,  description: "Alcool terpénique, fixateur de parfum. Sensitisant cutané. Peaux concernées : peaux sensibles." },
  "GERANIOL":                                { euMandatory: true,  description: "Terpène de rose et géranium, sensitisant cutané. Peaux concernées : peaux sensibles et réactives." },
  "HEXYL CINNAMAL":                          { euMandatory: true,  description: "Aldéhyde à odeur de jasmin, très utilisé en parfumerie. Sensitisant. Peaux concernées : peaux sensibles." },
  "HYDROXYCITRONELLAL":                      { euMandatory: true,  description: "Aldéhyde à odeur florale, sensitisant cutané. Peaux concernées : peaux sensibles." },
  "HYDROXYISOHEXYL 3-CYCLOHEXENE CARBOXALDEHYDE": { euMandatory: true, description: "Lyral : molécule de muguet synthétique. Interdit dans les cosmétiques EU depuis 2019 — fort potentiel allergisant. Peaux concernées : toutes." },
  "HICC":                                    { euMandatory: true,  description: "Alias du Lyral. Interdit en EU depuis 2019. Peaux concernées : toutes." },
  "ISOEUGENOL":                              { euMandatory: true,  description: "Dérivé de l'eugénol, fort allergène de contact. Peaux concernées : peaux sensibles et réactives." },
  "LIMONENE":                                { euMandatory: true,  description: "Terpène d'agrumes très courant en parfumerie. S'oxyde à l'air et devient encore plus sensibilisant. Peaux concernées : peaux sensibles, réactives et atopiques." },
  "LINALOOL":                                { euMandatory: true,  description: "Composé floral (lavande, coriandre), allergène surtout lorsqu'il est oxydé. Peaux concernées : peaux sensibles et réactives." },
  "METHYL 2-OCTYNOATE":                      { euMandatory: true,  description: "Ester à odeur de violette, très potent allergisant. Peaux concernées : peaux sensibles." },
  "ANISE ALCOHOL":                           { euMandatory: true,  description: "Alcool d'anis, sensitisant cutané. Peaux concernées : peaux sensibles." },
  "BENZYL BENZOATE":                         { euMandatory: true,  description: "Ester floral, aussi utilisé comme acaricide. Sensitisant. Peaux concernées : peaux sensibles." },
  "BENZYL CINNAMATE":                        { euMandatory: true,  description: "Ester balsamique, sensitisant. Peaux concernées : peaux sensibles." },
  "ALPHA-ISOMETHYL IONONE":                  { euMandatory: true,  description: "Molécule synthétique à odeur d'iris et violette. Sensitisant cutané. Peaux concernées : peaux sensibles." },
  "EVERNIA PRUNASTRI":                       { euMandatory: true,  description: "Mousse de chêne (oakmoss), fort sensitisant naturel. Peaux concernées : peaux sensibles et réactives." },
  "EVERNIA FURFURACEA":                      { euMandatory: true,  description: "Mousse d'arbre (treemoss). Sensitisant. Peaux concernées : peaux sensibles et réactives." },
  "BUTYLPHENYL METHYLPROPIONAL":             { euMandatory: true,  description: "Lilial : molécule de muguet synthétique interdite en EU depuis 2022. Allergène et PE suspecté. Peaux concernées : toutes." },
  "LILIAL":                                  { euMandatory: true,  description: "Alias de Butylphenyl Methylpropional. Interdit en EU depuis 2022. Peaux concernées : toutes." },

  // SCCS extended
  "HYDROXYMETHYLPENTYLCYCLOHEXENECARBOXALDEHYDE": { euMandatory: false, description: "Sensitisant cutané, surveillance en cours pour inclusion obligatoire EU. Peaux concernées : peaux sensibles." },
  "METHYL HEPTINE CARBONATE":                { euMandatory: false, description: "Ester allergisant, liste SCCS étendue. Peaux concernées : peaux sensibles." },
  "METHYL OCTINE CARBONATE":                 { euMandatory: false, description: "Ester allergisant, liste SCCS étendue. Peaux concernées : peaux sensibles." },
  "TREEMOSS":                                { euMandatory: false, description: "Extrait de mousse d'arbre, fort sensitisant. Peaux concernées : peaux sensibles et réactives." },
  "OAKMOSS":                                 { euMandatory: false, description: "Extrait de mousse de chêne, fort sensitisant. Peaux concernées : peaux sensibles et réactives." },
  "SANTALOL":                                { euMandatory: false, description: "Composant du bois de santal. Peut provoquer des réactions de contact. Peaux concernées : peaux sensibles." },
  "COSTUS ROOT":                             { euMandatory: false, description: "Extrait de racine de costus, fort allergisant. Peaux concernées : peaux sensibles." },
  "PERU BALSAM":                             { euMandatory: false, description: "Baume naturel très riche en allergènes. Peaux concernées : peaux sensibles et réactives." },
  "MYROXYLON PEREIRAE":                      { euMandatory: false, description: "Alias du Baume du Pérou. Allergisant fort. Peaux concernées : peaux sensibles." },
  "YLANG YLANG OIL":                         { euMandatory: false, description: "Huile essentielle de ylang ylang. Peut provoquer des réactions de contact. Peaux concernées : peaux sensibles." },
  "JASMINE":                                 { euMandatory: false, description: "Extrait de jasmin. Sensitisant cutané potentiel. Peaux concernées : peaux sensibles et réactives." },
  "JASMIN ABSOLUTE":                         { euMandatory: false, description: "Absolu de jasmin, concentré aromatique. Sensitisant. Peaux concernées : peaux sensibles." },
  "ROSE FLOWER OIL":                         { euMandatory: false, description: "Huile essentielle de rose. Peut provoquer des réactions de contact. Peaux concernées : peaux sensibles et réactives." },
  "CANANGA ODORATA":                         { euMandatory: false, description: "Huile essentielle de ylang ylang (nom botanique). Sensitisant. Peaux concernées : peaux sensibles." },
  "NARCISSUS POETICUS":                      { euMandatory: false, description: "Extrait de narcisse. Allergisant potentiel. Peaux concernées : peaux sensibles." },
  "ATRANORIN":                               { euMandatory: false, description: "Composant des mousses de chêne, fort sensitisant. Peaux concernées : peaux sensibles." },
  "CHLOROATRANORIN":                         { euMandatory: false, description: "Composant des mousses de chêne, allergisant. Peaux concernées : peaux sensibles." },

  // Muscs synthétiques et molécules parfumantes — liste SCCS étendue
  "HEXAMETHYLINDANOPYRAN":                   { euMandatory: false, description: "Galaxolide (HHCB) : musc synthétique polycyclique très répandu en parfumerie. Faiblement biodégradable, retrouvé dans l'environnement et le plasma humain. Sensitisant pour certains profils. Peaux concernées : peaux sensibles." },
  "TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES": { euMandatory: false, description: "Tonalide (AHTN) : musc polycyclique synthétique. Sensitisant potentiel, bioaccumulable. Peaux concernées : peaux sensibles." },
  "TRIMETHYLBENZENEPROPANOL":                { euMandatory: false, description: "Majantol : molécule parfumante proposée sur la liste étendue EU. Sensitisant cutané documenté. Peaux concernées : peaux sensibles." },
  "LINALYL ACETATE":                         { euMandatory: false, description: "Ester lié au linalool (lavande, bergamote). Peut provoquer des réactions de contact chez les peaux sensibilisées. Peaux concernées : peaux sensibles et réactives." },
  "TERPINEOL":                               { euMandatory: false, description: "Terpène alcoolique (pin, arbre à thé, lavande). Parfum naturel, sensitisant potentiel pour les peaux réactives. Peaux concernées : peaux sensibles." },
  "PINENE":                                  { euMandatory: false, description: "α-pinène, terpène naturel de résine de pin et d'eucalyptus. S'oxyde à l'air et devient plus allergisant. Présent sur la liste étendue SCCS. Peaux concernées : peaux sensibles et réactives." },
};

// ─── Irritants cutanés ────────────────────────────────────────────────────────
export const IRRITANTS: Record<string, IrritantEntry> = {
  "SODIUM LAURYL SULFATE":       { irritationLevel: 3, reason: "Tensioactif irritant, perturbateur de barrière cutanée", description: "SLS : tensioactif très moussant mais agressif. Détruit le film lipidique, augmente l'inflammation et déshydrate l'épiderme. Peaux concernées : peaux acnéiques, sensibles et à barrière fragilisée — à éviter dans les nettoyants visage." },
  "SODIUM DODECYL SULFATE":      { irritationLevel: 3, reason: "Alias du SLS — tensioactif irritant",                   description: "Alias chimique du Sodium Lauryl Sulfate. Même profil d'irritation et de perturbation de barrière. Peaux concernées : peaux acnéiques et sensibles." },
  "SODIUM LAURETH SULFATE":      { irritationLevel: 2, reason: "Tensioactif, peut être contaminé au 1,4-dioxane",       description: "SLES : version moins irritante du SLS, mais peut contenir du 1,4-dioxane (cancérogène possible, sous-produit de fabrication). Peaux concernées : peaux sensibles et réactives." },
  "AMMONIUM LAURYL SULFATE":     { irritationLevel: 3, reason: "Tensioactif irritant, similaire au SLS",                description: "Tensioactif anionique proche du SLS, même potentiel irritant. Peaux concernées : peaux acnéiques et sensibles." },
  "AMMONIUM LAURETH SULFATE":    { irritationLevel: 2, reason: "Tensioactif irritant",                                  description: "Version ammonium du SLES. Profil irritant similaire. Peaux concernées : peaux sensibles." },
  "ALCOHOL DENAT":               { irritationLevel: 2, reason: "Alcool dénaturé, assèche et peut irriter",              description: "Alcool éthylique dénaturé. À fortes concentrations, assèche l'épiderme, détruit le microbiome et peut déclencher un rebond sébacé. Peaux concernées : peaux sèches, sensibles et acnéiques." },
  "SD ALCOHOL":                  { irritationLevel: 2, reason: "Alcool dénaturé, assèche et peut irriter",              description: "Alias américain d'Alcohol Denat. Même profil desséchant et potentiellement irritant. Peaux concernées : peaux sèches, sensibles et acnéiques." },
  "ISOPROPYL ALCOHOL":           { irritationLevel: 2, reason: "Alcool irritant, perturbateur de barrière",             description: "Alcool isopropylique très astringent. Dégraisse fortement, peut déclencher un rebond sébacé. Peaux concernées : peaux acnéiques, sèches et sensibles." },
  "SODIUM CHLORIDE":             { irritationLevel: 1, reason: "Sel — peut irriter et assécher à haute concentration",  description: "Sel (chlorure de sodium) utilisé comme modificateur de viscosité. Irritant aux concentrations élevées dans les nettoyants. Peaux concernées : peaux sensibles et peaux sèches." },
  "ETHANOL":                     { irritationLevel: 2, reason: "Alcool éthylique, assèche et peut irriter",              description: "Alcool éthylique. À fortes concentrations, assèche l'épiderme et peut déclencher un rebond sébacé. Peaux concernées : peaux sèches, sensibles et acnéiques." },
  "BENZOYL PEROXIDE":            { irritationLevel: 2, reason: "Actif anti-acné, peut provoquer sécheresse et desquamation", description: "Peroxyde de benzoyle. Irritant connu : provoque sécheresse, rougeurs et desquamation en début d'utilisation. Introduire progressivement (2,5% → 5%) et utiliser hydratant. Peaux concernées : peaux sensibles et sèches — à protéger." },
  "MELALEUCA ALTERNIFOLIA LEAF OIL": { irritationLevel: 1, reason: "Huile essentielle, irritante à forte concentration", description: "Huile essentielle d'arbre à thé. Bien tolérée aux concentrations cosmétiques (<5%) mais peut irriter les peaux sensibles non diluée. Peaux concernées : peaux sensibles et réactives." },
  "HYDROXYPINACOLONE RETINOATE":     { irritationLevel: 1, reason: "Rétinoïde ester, peut provoquer une rétinisation l��gère", description: "HPR (ester de rétinoïde), alternative douce au rétinol. Peut provoquer desquamation, rougeur et sensibilité transitoire en début d'utilisation. Introduire progressivement (1-2x/sem) et associer à un hydratant. Peaux concernées : peaux sensibles et réactives — surveiller en début de traitement." },
};

// ─── Pétrochimiques ────────────────────────────────────────────────────────────
export const PETROCHEMICALS: Record<string, PetrochemEntry> = {
  "PARAFFINUM LIQUIDUM":        { description: "Huile minérale dérivée du pétrole. Forme un film occlusif sur la peau pouvant bloquer les pores. Peaux concernées : peaux grasses et acnéiques (comédogène pour certains profils)." },
  "PETROLATUM":                 { description: "Vaseline issue du raffinage du pétrole. Très occlusif, peut obstruer les follicules pileux. Peaux concernées : peaux grasses et acnéiques." },
  "MINERAL OIL":                { description: "Huile minérale issue du pétrole (alias anglais de Paraffinum Liquidum). Occlusif, peut aggraver les pores dilatés. Peaux concernées : peaux mixtes, grasses et acnéiques." },
  "CERA MICROCRISTALLINA":      { description: "Cire microcristalline issue du pétrole, texturant dans les baumes et sticks. Peaux concernées : peaux acnéiques si appliqué sur le visage en formule dense." },
  "MICROCRYSTALLINE WAX":       { description: "Alias anglais de Cera Microcristallina. Même profil pétrochimique. Peaux concernées : peaux acnéiques." },
  "OZOKERITE":                  { description: "Cire minérale d'origine pétrochimique, texturant et épaississant. Peaux concernées : peaux acnéiques selon la formule." },
  "CERESIN":                    { description: "Cire purifiée issue de l'ozokerite, utilisée dans les baumes lèvres et sticks. Peaux concernées : peaux acnéiques si appliqué sur le visage." },
  "PARAFFIN":                   { description: "Paraffine issue du pétrole, forme un film occlusif sur la peau. Peaux concernées : peaux grasses et acnéiques." },
  "POLYISOBUTENE":              { description: "Polymère synthétique issu du pétrole, émollient filmogène. Peaux concernées : peaux grasses et acnéiques." },
  "HYDROGENATED POLYISOBUTENE": { description: "Version hydrogénée du polyisobutène. Même origine pétrochimique. Peaux concernées : peaux grasses et acnéiques." },
  "POLYBUTENE":                 { description: "Polymère pétrochimique à effet filmogène. Peaux concernées : peaux grasses et acnéiques." },
  "NAPHTHA":                    { description: "Fraction légère du pétrole, utilisée comme solvant. Peut irriter les peaux sensibles. Peaux concernées : peaux sensibles et acnéiques." },
  "ISOHEXADECANE":              { description: "Isoalcane pétrochimique léger, émollient non gras. Moins comédogène que les paraffines. Peaux concernées : peaux acnéiques sensibles aux dérivés pétrochimiques." },
  "ISODODECANE":                { description: "Isoalcane pétrochimique volatil, souvent dans les formules longue tenue (fond de teint, mascara). Peaux concernées : peaux acnéiques selon la formule globale." },
  "ISOEICOSANE":                { description: "Isoalcane pétrochimique lourd, émollient filmogène. Peaux concernées : peaux grasses et acnéiques." },
  "POLYDECENE":                 { description: "Polyalphaoléfine pétrochimique, émollient léger. Peaux concernées : peaux acnéiques selon concentration." },
  "HYDROGENATED POLYDECENE":    { description: "Version hydrogénée du polydécène. Même profil pétrochimique. Peaux concernées : peaux grasses et acnéiques." },
  "SYNTHETIC WAX":              { description: "Cire synthétique pétrochimique (terme générique). Peaux concernées : peaux acnéiques selon la formule." },
  "VASELINE":                   { description: "Nom commercial du Petrolatum. Très occlusif, peut obstruer les pores. Peaux concernées : peaux grasses et acnéiques." },
};

// ─── Comédogènes ──────────────────────────────────────────────────────────────
// Sources : Acne Clinic NYC, Skinsort, INCIDecoder, Comedogenic Ratings Database
// Indices de comédogénicité sur 5 (ne pas confondre avec irritation)
export type ComedogenicEntry = { rating: 1 | 2 | 3 | 4 | 5; description: string };

export const COMEDOGENIC_INGREDIENTS: Record<string, ComedogenicEntry> = {
  // Indice 5 — très comédogène
  "ISOPROPYL MYRISTATE":          { rating: 4, description: "Ester gras synthétique léger. Indice comédogénique élevé (4/5 — sources : Kligman 1989 + études humaines). Présent dans de nombreux écrans solaires et soins. À surveiller sur peau acnéique, en particulier en application quotidienne sur le visage. Peaux concernées : peaux acnéiques et grasses." },
  "ISOPROPYL PALMITATE":          { rating: 4, description: "Ester gras synthétique comédogène (4/5). Peut boucher les pores en s'accumulant. Peaux concernées : peaux acnéiques et grasses." },
  "MYRISTYL MYRISTATE":           { rating: 5, description: "Ester gras très comédogène (5/5). Présent dans certains émollients et fonds de teint. Peaux concernées : peaux acnéiques et grasses." },
  "OCTYL STEARATE":               { rating: 5, description: "Ester gras synthétique. Indice comédogénique très élevé (5/5). Peaux concernées : peaux acnéiques — à éviter dans les formules visage." },
  "WHEAT GERM OIL":               { rating: 5, description: "Huile de germe de blé, riche en acides gras lourds. Indice comédogénique 5/5. Peaux concernées : peaux acnéiques et mixtes à grasses — malgré ses qualités nutritives, à éviter sur le visage acnéique." },
  "TRITICUM VULGARE GERM OIL":    { rating: 5, description: "Huile de germe de blé (nom INCI). Indice comédogénique 5/5. Peaux concernées : peaux acnéiques et grasses." },
  "LAURETH-4":                    { rating: 5, description: "Tensioactif éthoxylé dérivé de l'acide laurique. Indice comédogénique 5/5. Peaux concernées : peaux acnéiques." },
  "MYRISTIC ACID":                { rating: 3, description: "Acide gras saturé (C14) présent dans les huiles de coco, palmiste et muscade. Indice comédogénique 3/5 (INCIDecoder). Peaux concernées : peaux acnéiques et grasses." },
  "ACETYLATED LANOLIN ALCOHOL":   { rating: 5, description: "Alcool de lanoline acétylé. Indice comédogénique élevé 4-5/5 (INCIDecoder). Peaux concernées : peaux acnéiques." },

  // Indice 4 — fortement comédogène
  "ETHYLHEXYL PALMITATE":         { rating: 4, description: "Ester très répandu dans les écrans solaires et fond de teint. Indice comédogénique 4/5 : peut accélérer la formation de comédons. Peaux concernées : peaux acnéiques et grasses — présence à surveiller notamment dans les SPF quotidiens." },
  "OCTYL PALMITATE":              { rating: 4, description: "Ester palmitate d'origine synthétique. Indice comédogénique 4/5. Peaux concernées : peaux acnéiques." },
  "COCOS NUCIFERA OIL":           { rating: 4, description: "Huile de coco. Riche en acide laurique (antibactérien) mais indice comédogénique élevé (4/5). Peut aggraver l'acné sur le visage malgré ses propriétés bénéfiques pour le corps. Peaux concernées : peaux acnéiques et grasses — usage déconseillé sur le visage." },
  "COCOS NUCIFERA FRUIT OIL":     { rating: 4, description: "Huile de coco (nom INCI alternatif). Même profil comédogénique élevé (4/5). Peaux concernées : peaux acnéiques et grasses." },
  "THEOBROMA CACAO SEED BUTTER":  { rating: 4, description: "Beurre de cacao. Indice comédogénique élevé (4/5) malgré ses propriétés émollientes. Peaux concernées : peaux acnéiques — à éviter sur le visage, convient pour le corps." },
  "LANOLIN ALCOHOL":              { rating: 2, description: "Alcool de lanoline. Légèrement comédogène (indice 0-2/5 selon INCIDecoder, 4/5 selon certaines sources). Peaux concernées : peaux acnéiques sensibles à la lanoline." },
  "DECYL OLEATE":                 { rating: 3, description: "Ester de l'acide oléique. Indice comédogénique 3/5 (INCIDecoder). Peaux concernées : peaux acnéiques." },
  "ISOPROPYL ISOSTEARATE":        { rating: 5, description: "Ester synthétique très occlusif. Indice comédogénique 4-5/5 (INCIDecoder). Peaux concernées : peaux acnéiques et grasses — à éviter sur le visage." },
  "LINUM USITATISSIMUM SEED OIL": { rating: 4, description: "Huile de lin. Riche en oméga-3 mais s'oxyde rapidement et peut déclencher de l'acné. Indice comédogénique 4/5. Peaux concernées : peaux acnéiques — malgré son image 'naturelle', peut aggraver l'acné." },

  // Indice 3 — modérément comédogène
  "BUTYL STEARATE":               { rating: 3, description: "Ester gras synthétique. Indice comédogénique 3/5. Peaux concernées : peaux acnéiques et grasses." },
  "CETYL ACETATE":                { rating: 4, description: "Ester de l'acide acétique et du cétanol. Indice comédogénique 4/5 (INCIDecoder). Peaux concernées : peaux acnéiques." },
  "ISOSTEARYL NEOPENTANOATE":     { rating: 3, description: "Ester synthétique. Indice comédogénique 3-4/5. Peaux concernées : peaux acnéiques et mixtes." },
  "POLYGLYCERYL-3-DIISOSTEARATE": { rating: 3, description: "Émulsifiant lipidique. Indice comédogénique 3-4/5. Peaux concernées : peaux acnéiques." },
  "LAURIC ACID":                  { rating: 4, description: "Acide gras saturé (C12) présent dans l'huile de coco et de palmiste. Indice comédogénique 4/5. Bien que possédant des propriétés antibactériennes sur Cutibacterium acnes, peut obstruer les pores. Peaux concernées : peaux acnéiques — à surveiller dans les formules riches." },
  "D&C RED NO. 17":               { rating: 4, description: "Colorant rouge synthétique. Comédogène (4/5), souvent présent dans les rouges à lèvres et maquillages colorés. Peaux concernées : peaux acnéiques, surtout pour les produits appliqués près de la bouche." },
  "D&C RED NO. 21":               { rating: 3, description: "Colorant rouge synthétique. Modérément comédogène (3/5). Peaux concernées : peaux acnéiques." },
  "D&C RED NO. 27":               { rating: 3, description: "Colorant rouge synthétique. Modérément comédogène (3/5). Peaux concernées : peaux acnéiques." },
};

// ─── Analyse ───────────────────────────────────────────────────────────────────

export type IngredientFlag = "ed_high" | "ed_medium" | "allergen" | "irritant" | "petrochem" | "comedogenic" | "ok";

export type AnalyzedIngredient = {
  raw: string;
  normalized: string;
  flag: IngredientFlag;
  reason?: string;
  description?: string;
  euMandatory?: boolean;
  comedogenicRating?: number;
  role?: string;
};

export type AnalysisResult = {
  ingredients: AnalyzedIngredient[];
  edHighCount: number;
  edMediumCount: number;
  allergenCount: number;
  irritantCount: number;
  petrochemCount: number;
  comedogenicCount: number;
  score: number;
};

function normalize(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // strip diacritics (é→e, à→a…)
    .replace(/[''ʼ`]/g, " ")                              // apostrophes → espace
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Traduction noms français → INCI ─────────────────────────────────────────
// Clés : noms français normalisés (sans accents, majuscules)
const FRENCH_TO_INCI: Record<string, string> = {
  // Eau / solvants
  "EAU":                                        "AQUA",
  "EAU PURIFIEE":                               "AQUA",
  "EAU DEMINERALISEE":                          "AQUA",
  "EAU DISTILLEE":                              "AQUA",
  "ETHANOL":                                    "ALCOHOL DENAT",
  "ALCOOL ETHYLIQUE":                           "ALCOHOL DENAT",
  "ALCOOL DENATURE":                            "ALCOHOL DENAT",
  "ALCOOL ISOPROPYLIQUE":                       "ISOPROPYL ALCOHOL",

  // Glycols / humectants
  "GLYCERINE":                                  "GLYCERIN",
  "GLYCEROL":                                   "GLYCEROL",

  // Actifs
  "ACIDE SALICYLIQUE":                          "SALICYLIC ACID",
  "ACIDE GLYCOLIQUE":                           "GLYCOLIC ACID",
  "ACIDE LACTIQUE":                             "LACTIC ACID",
  "ACIDE HYALURONIQUE":                         "HYALURONIC ACID",
  "HYALURONATE DE SODIUM":                      "SODIUM HYALURONATE",
  "ACIDE ASCORBIQUE":                           "ASCORBIC ACID",
  "VITAMINE C":                                 "ASCORBIC ACID",
  "VITAMINE E":                                 "TOCOPHEROL",
  "ACIDE AZELAIQUE":                            "AZELAIC ACID",
  "ACIDE TRANEXAMIQUE":                         "TRANEXAMIC ACID",
  "PEROXYDE DE BENZOYLE":                       "BENZOYL PEROXIDE",
  "ACIDE MANDELIQUE":                           "MANDELIC ACID",
  "ACIDE MALIQUE":                              "MALIC ACID",
  "ACIDE TARTRIQUE":                            "TARTARIC ACID",
  "ACIDE KOJIQUE":                              "KOJIC ACID",
  "ACIDE FERULIQUE":                            "FERULIC ACID",
  "ACIDE PHYTIQUE":                             "PHYTIC ACID",
  "ACIDE BENZOIQUE":                            "BENZOIC ACID",
  "ACIDE CITRIQUE":                             "CITRIC ACID",
  "ACIDE SORBIQUE":                             "SORBIC ACID",
  "ALLANTOINE":                                 "ALLANTOIN",

  // Conservateurs / parabènes
  "PARAHYDROXYBENZOATE DE METHYLE":             "METHYLPARABEN",
  "METHYLPARABENE":                             "METHYLPARABEN",
  "PARAHYDROXYBENZOATE D ETHYLE":               "ETHYLPARABEN",
  "ETHYLPARABENE":                              "ETHYLPARABEN",
  "PARAHYDROXYBENZOATE DE PROPYLE":             "PROPYLPARABEN",
  "PROPYLPARABENE":                             "PROPYLPARABEN",
  "PARAHYDROXYBENZOATE DE BUTYLE":              "BUTYLPARABEN",
  "BUTYLPARABENE":                              "BUTYLPARABEN",
  "PHENOXYETHANOL":                             "PHENOXYETHANOL",
  "ALCOOL BENZYLIQUE":                          "BENZYL ALCOHOL",
  "SORBATE DE POTASSIUM":                       "POTASSIUM SORBATE",
  "BENZOATE DE SODIUM":                         "SODIUM BENZOATE",

  // Tensioactifs
  "LAURYL SULFATE DE SODIUM":                   "SODIUM LAURYL SULFATE",
  "LAURETH SULFATE DE SODIUM":                  "SODIUM LAURETH SULFATE",
  "LAURYL SULFATE D AMMONIUM":                  "AMMONIUM LAURYL SULFATE",
  "LAURETH SULFATE D AMMONIUM":                 "AMMONIUM LAURETH SULFATE",

  // Filtres UV
  "DIOXYDE DE TITANE":                          "TITANIUM DIOXIDE",
  "OXYDE DE ZINC":                              "ZINC OXIDE",
  "BENZOPHENONE 3":                             "BENZOPHENONE-3",

  // Texturants / épaississants
  "CARBOMERE":                                  "CARBOMER",
  "GOMME XANTHANE":                             "XANTHAN GUM",
  "SILICE":                                     "SILICA",
  "ARGILE BLANCHE":                             "KAOLIN",
  "AMIDON DE TAPIOCA":                          "TAPIOCA STARCH",
  "POLYETHYLENE GLYCOL":                        "PEG",

  // Régulateurs pH
  "TROMETAMINE":                                "TROMETHAMINE",
  "HYDROXYDE DE SODIUM":                        "SODIUM HYDROXIDE",
  "SOUDE":                                      "SODIUM HYDROXIDE",
  "LESSIVE DE SOUDE":                           "SODIUM HYDROXIDE",
  "HYDROXYDE DE POTASSIUM":                     "POTASSIUM HYDROXIDE",
  "TRIETHANOLAMINE":                            "TRIETHANOLAMINE",

  // Émollients / huiles
  "VASELINE":                                   "PETROLATUM",
  "PARAFFINE LIQUIDE":                          "PARAFFINUM LIQUIDUM",
  "HUILE MINERALE":                             "MINERAL OIL",
  "BEURRE DE KARITE":                           "BUTYROSPERMUM PARKII BUTTER",
  "HUILE DE JOJOBA":                            "SIMMONDSIA CHINENSIS SEED OIL",
  "HUILE D ARGAN":                              "ARGANIA SPINOSA KERNEL OIL",
  "HUILE DE TOURNESOL":                         "HELIANTHUS ANNUUS SEED OIL",
  "HUILE DE ROSE MUSQUEE":                      "ROSA CANINA FRUIT OIL",
  "HUILE DE COCO":                              "COCOS NUCIFERA OIL",
  "HUILE D AMANDE DOUCE":                       "PRUNUS AMYGDALUS DULCIS OIL",
  "HUILE D AVOCAT":                             "PERSEA GRATISSIMA OIL",
  "HUILE D ARBRE A THE":                        "MELALEUCA ALTERNIFOLIA LEAF OIL",
  "HUILE DE RICIN HYDROGENEE POLYOXYL 40":      "PEG-40 HYDROGENATED CASTOR OIL",
  "HUILE DE MARULA":                            "MARULA OIL",
  "HUILE D ARGOUSIER":                          "HIPPOPHAE RHAMNOIDES OIL",

  // Humectants
  "UREE":                                       "UREA",
  "PANTHENOL":                                  "PANTHENOL",
  "BETAINE":                                    "BETAINE",
  "SORBITOL":                                   "SORBITOL",

  // Émulsifiants
  "LECITHINE":                                  "LECITHIN",
  "GOMME DE XANTHANE":                          "XANTHAN GUM",

  // Céramides (terme générique)
  "CERAMIDE":                                   "CERAMIDE NP",

  // Apaisants
  "EXTRAIT DE CENTELLA ASIATICA":               "CENTELLA ASIATICA EXTRACT",
  "EXTRAIT DE THE VERT":                        "CAMELLIA SINENSIS LEAF EXTRACT",
  "GEL D ALOE VERA":                            "ALOE VERA",
  "JUS D ALOE VERA":                            "ALOE BARBADENSIS LEAF JUICE",
  "CAMOMILLE":                                  "CHAMOMILLA RECUTITA EXTRACT",
  "CALENDULA":                                  "CALENDULA OFFICINALIS EXTRACT",
  "REGLISSE":                                   "GLYCYRRHIZA GLABRA ROOT EXTRACT",

  // Pétrochimiques communs
  "CIRE MICROCRISTALLINE":                      "CERA MICROCRISTALLINA",
  "CIRE DE PARAFFINE":                          "PARAFFIN",

  // Émollients / esters courants
  "GLYCERYL MONOSTEAARTE":                      "GLYCERYL STEARATE",
  "GLYCERYL MONOSTEARATE":                      "GLYCERYL STEARATE",
  "MONOSTEARATE DE GLYCERYLE":                  "GLYCERYL STEARATE",
  "MYRISTATE D ISOPROPYLE":                     "ISOPROPYL MYRISTATE",
  "PALMITATE D ISOPROPYLE":                     "ISOPROPYL PALMITATE",

  // Alcools gras
  "ALCOOL CETOSTEARYLIQUE":                     "CETEARYL ALCOHOL",
  "ALCOOL CETEARYLIQUE":                        "CETEARYL ALCOHOL",
  "ALCOOL CETYLIQUE":                           "CETYL ALCOHOL",
  "ALCOOL STEARYLIQUE":                         "STEARYL ALCOHOL",
  "ALCOOL BEHENYLIQUE":                         "BEHENYL ALCOHOL",

  // Antioxydants
  "BUTYLHYDROXYTOLUENE":                        "BHT",
  "HYDROXYTOLUENE BUTYLE":                      "BHT",
  "BUTYLHYDROXYANISOLE":                        "BHA",

  // Chélateurs
  "EDETATE DISODIQUE":                          "DISODIUM EDTA",
  "EDETATE DISODIQUE HYDRATE":                  "DISODIUM EDTA",
  "EDTA DISODIQUE":                             "DISODIUM EDTA",
  "TETRASODIUM EDTA":                           "TETRASODIUM EDTA",

  // Émulsifiants PEG
  "STEAARTE DE POLYOXY 40":                     "PEG-40 STEARATE",
  "STEARATE DE POLYOXY 40":                     "PEG-40 STEARATE",
  "STEARATE DE MACROGOL 40":                    "PEG-40 STEARATE",
  "POLYSORBATE 20":                             "POLYSORBATE 20",
  "POLYSORBATE 60":                             "POLYSORBATE 60",
  "POLYSORBATE 80":                             "POLYSORBATE 80",

  // Antiseptiques / actifs pharmaceutiques
  "ISOPROPYLMETHYLPHENOL":                      "ISOPROPYLMETHYLPHENOL",
  "ISOPROPYL METHYLPHENOL":                     "ISOPROPYLMETHYLPHENOL",
  "IPMP":                                       "ISOPROPYLMETHYLPHENOL",
  "IBUPROFEN PICONOL":                          "IBUPROFEN PICONOL",

  // Divers
  "DIMETHICONE":                                "DIMETHICONE",
  "VASELINE BLANCHE":                           "PETROLATUM",
  "PARAFFINE BLANCHE":                          "PETROLATUM",
};

// Traduit un nom normalisé (français ou INCI) vers son équivalent INCI.
// EU label format: "Common Name (INCI Name)" — parenthetical is the canonical INCI name.
// Tries French dict on outer name first; if no match, uses the parenthetical content directly.
function translateToInci(norm: string): string {
  const parenMatch = norm.match(/\(([^)]+)\)/);
  const clean = norm.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (FRENCH_TO_INCI[clean]) return FRENCH_TO_INCI[clean];
  // Substring match — retourne la traduction de la clé la plus longue trouvée dans clean
  let best = "";
  let result = "";
  for (const [fr, inci] of Object.entries(FRENCH_TO_INCI)) {
    if (clean.includes(fr) && fr.length > best.length) { best = fr; result = inci; }
  }
  if (result) return result;
  // If outer name didn't match the French dict, use the parenthetical as the INCI name
  if (parenMatch) {
    return parenMatch[1].trim().replace(/([A-Z])-([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  }
  // Dehyphenation: "CENTELLA-ASIATICA EXTRACT" → "CENTELLA ASIATICA EXTRACT"
  // Only replace letter-to-letter hyphens — never digit-to-letter (preserves "1,2-HEXANEDIOL")
  const dehyphen = clean.replace(/([A-Z])-([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  return dehyphen;
}

function stripQuantity(t: string): string {
  return t.replace(/\s*\d+[,.]?\d*\s*(mg|g|ml|µg|mcg|%|mL|µL)\b/gi, "").trim();
}

// Word-boundary match: prevents "ETHANOL" from matching "PHENOXYETHANOL" or "TRIETHANOLAMINE".
// Also dehyphenates the key (letter-letter only) to match tokens that went through translateToInci
// e.g. key "BIS-ETHYLHEXYLOXYPHENOL..." matches norm "BIS ETHYLHEXYLOXYPHENOL..."
function matchesKey(norm: string, key: string): boolean {
  if (norm === key) return true;
  const keyD = key.replace(/([A-Z])-([A-Z])/g, "$1 $2");
  if (norm === keyD) return true;
  const escaped = keyD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s/,])${escaped}($|[\\s/,])`).test(norm);
}

export function analyzeIngredients(raw: string): AnalysisResult {
  const tokens = raw
    .split(/(?<!\d),(?!\d)|\n|(?<!\d)\.\s+/)
    .map((t) => stripQuantity(t.trim().replace(/\.$/, "")))
    .filter(Boolean);

  const ingredients: AnalyzedIngredient[] = tokens.map((token) => {
    const norm = translateToInci(normalize(token));

    const edKey = Object.keys(ENDOCRINE_DISRUPTORS).find(
      (k) => matchesKey(norm, k)
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
      (k) => matchesKey(norm, k)
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
      (k) => matchesKey(norm, k)
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

    const petroKey = Object.keys(PETROCHEMICALS).find(
      (k) => matchesKey(norm, k)
    );
    if (petroKey) {
      const entry = PETROCHEMICALS[petroKey];
      return {
        raw: token, normalized: norm,
        flag: "petrochem",
        description: entry.description,
      };
    }

    const comedoKey = Object.keys(COMEDOGENIC_INGREDIENTS).find(
      (k) => matchesKey(norm, k)
    );
    if (comedoKey) {
      const entry = COMEDOGENIC_INGREDIENTS[comedoKey];
      return {
        raw: token, normalized: norm,
        flag: "comedogenic",
        reason: `Comédogène — indice ${entry.rating}/5`,
        description: entry.description,
        comedogenicRating: entry.rating,
      };
    }

    const inferred = inferRoleFromName(norm);
    return {
      raw: token, normalized: norm, flag: "ok",
      description: inferred?.description ?? "Aucun signal identifié dans les bases consultées (ECHA, SCCS, Acne Clinic NYC). Peaux concernées : tous types.",
    };
  });

  const edHighCount      = ingredients.filter((i) => i.flag === "ed_high").length;
  const edMediumCount    = ingredients.filter((i) => i.flag === "ed_medium").length;
  const allergenCount    = ingredients.filter((i) => i.flag === "allergen").length;
  const irritantCount    = ingredients.filter((i) => i.flag === "irritant").length;
  const petrochemCount   = ingredients.filter((i) => i.flag === "petrochem").length;
  const comedogenicCount = ingredients.filter((i) => i.flag === "comedogenic").length;

  // PE pénalise fortement avec plafond par sévérité
  const edHighPenalty   = edHighCount * 30;
  const edMediumPenalty = edMediumCount * 15;
  const allergenPenalty = Math.min(allergenCount * 5, 20);
  let score = Math.max(0, 100 - edHighPenalty - edMediumPenalty - allergenPenalty);
  if (edHighCount > 0)   score = Math.min(score, 40);
  if (edMediumCount > 0) score = Math.min(score, 70);

  return { ingredients, edHighCount, edMediumCount, allergenCount, irritantCount, petrochemCount, comedogenicCount, score };
}

// ─── Ingrédients courants (descriptions encyclopédiques) ─────────────────────
// Fallback avant le flag "ok" générique — couvre ~80% des listes INCI courantes

export type CommonEntry = { role: string; description: string };

export const COMMON_INGREDIENTS: Record<string, CommonEntry> = {
  // ─ Solvants / bases ─
  "WATER":                          { role: "Solvant",          description: "Principal solvant des formules cosmétiques. Constitue généralement 50–80% d'une émulsion. Peaux concernées : tous types." },
  "AQUA":                           { role: "Solvant",          description: "Eau purifiée — principal solvant des formules. Peaux concernées : tous types." },

  // ─ Humectants ─
  "GLYCERIN":                       { role: "Humectant",        description: "Humectant de référence : attire et retient l'eau dans l'épiderme, renforce la barrière cutanée. Peaux concernées : tous types, idéal peaux sèches et déshydratées." },
  "GLYCEROL":                       { role: "Humectant",        description: "Alias de la glycérine. Même action hydratante et protectrice de la barrière. Peaux concernées : tous types." },
  "SODIUM HYALURONATE":             { role: "Humectant",        description: "Sel de l'acide hyaluronique, pénètre mieux dans la peau. Hydratation intense et repulpante. Peaux concernées : tous types, idéal peaux sèches et matures." },
  "HYALURONIC ACID":                { role: "Humectant",        description: "Acide hyaluronique : retient jusqu'à 1 000× son poids en eau. Effet repulpant immédiat. Peaux concernées : tous types." },
  "SODIUM HYALURONATE CROSSPOLYMER": { role: "Humectant",       description: "Forme réticulée de l'hyaluronate de sodium — hydratation longue durée en surface. Peaux concernées : tous types." },
  "PANTHENOL":                      { role: "Actif",            description: "Provitamine B5 : hydratante, apaisante et cicatrisante. Renforce la barrière cutanée. Peaux concernées : tous types, idéal peaux sensibles et irritées." },
  "BETAINE":                        { role: "Humectant",        description: "Humectant naturel (betterave) : adoucissant et protecteur osmotique. Peaux concernées : tous types." },
  "SODIUM PCA":                     { role: "Humectant",        description: "Facteur naturel d'hydratation (NMF) de la peau. Hygroscopique, retient l'eau en surface. Peaux concernées : tous types, idéal peaux déshydratées." },
  "BUTYLENE GLYCOL":                { role: "Humectant",        description: "Humectant et solvant. Améliore la pénétration des actifs. Bien toléré. Peaux concernées : tous types." },
  "PROPANEDIOL":                    { role: "Humectant",        description: "Solvant et humectant naturel (maïs). Alternative végétale bien tolérée au propylène glycol. Peaux concernées : tous types." },
  "PROPYLENE GLYCOL":               { role: "Humectant",        description: "Humectant et solvant courant. Bien toléré aux concentrations habituelles. Peaux concernées : tous types." },
  "PENTYLENE GLYCOL":               { role: "Humectant",        description: "Humectant et conservateur doux. Bien toléré. Peaux concernées : tous types." },
  "SORBITOL":                       { role: "Humectant",        description: "Polyol humectant d'origine végétale. Adoucissant naturel. Peaux concernées : tous types." },
  "SODIUM LACTATE":                 { role: "Humectant",        description: "Sel de l'acide lactique. Composant du NMF, maintient l'hydratation naturelle de la peau. Peaux concernées : tous types." },
  "UREA":                           { role: "Humectant",        description: "Urée : composant naturel du NMF. Hydratant puissant et kératolytique doux. Peaux concernées : peaux sèches, hyperkératosiques." },

  // ─ Actifs ─
  "NIACINAMIDE":                    { role: "Actif",            description: "Vitamine B3 : réduit les pores, unifie le teint, régule le sébum et renforce la barrière cutanée. L'un des actifs les mieux tolérés. Peaux concernées : tous types, idéal peaux grasses et acnéiques." },
  "RETINOL":                        { role: "Actif",            description: "Vitamine A : réduit les rides, désobstrue les pores et stimule le renouvellement cellulaire. Peut irriter en début d'utilisation — introduire progressivement. Peaux concernées : peaux matures et acnéiques. Déconseillé enceinte." },
  "RETINYL PALMITATE":              { role: "Actif",            description: "Précurseur doux du rétinol. Action anti-âge progressive, moins irritant. Peaux concernées : tous types y compris peaux sensibles." },
  "RETINAL":                        { role: "Actif",            description: "Rétinaldéhyde : plus puissant que le rétinol, moins irritant que la trétinoïne. Anti-âge et anti-acné. Peaux concernées : peaux matures et acnéiques. Déconseillé enceinte." },
  "BAKUCHIOL":                      { role: "Actif",            description: "Alternative végétale au rétinol (Psoralea corylifolia). Anti-âge doux, anti-inflammatoire. Peaux concernées : tous types, y compris femmes enceintes et peaux sensibles." },
  "SALICYLIC ACID":                 { role: "Exfoliant BHA",    description: "Acide bêta-hydroxy (BHA) : exfoliant liposoluble qui pénètre dans les pores et régule le sébum. Légèrement irritant à haute dose. Peaux concernées : peaux grasses, acnéiques et à pores dilatés." },
  "AZELAIC ACID":                   { role: "Actif",            description: "Acide azélaïque : anti-inflammatoire, antibactérien et dépigmentant. Excellente tolérance cutanée. Peaux concernées : acné, rosacée, taches." },
  "ALPHA ARBUTIN":                  { role: "Actif",            description: "Dépigmentant efficace, dérivé de l'hydroquinone. Unifie le teint progressivement sans irritation. Peaux concernées : tous types avec taches ou hyperpigmentation." },
  "ARBUTIN":                        { role: "Actif",            description: "Dépigmentant naturel. Unifie le teint. Peaux concernées : tous types avec taches." },
  "ASCORBIC ACID":                  { role: "Actif",            description: "Vitamine C pure : antioxydante, éclairante et stimulatrice du collagène. Instable à l'air et la lumière. Peaux concernées : tous types, surtout peaux ternes et matures." },
  "ASCORBYL GLUCOSIDE":             { role: "Actif",            description: "Dérivé stable de la vitamine C. Éclairant progressif, antioxydant. Bien toléré. Peaux concernées : tous types." },
  "SODIUM ASCORBYL PHOSPHATE":      { role: "Actif",            description: "Dérivé stable de la vitamine C, bien toléré même par les peaux sensibles. Antioxydant et éclairant. Peaux concernées : tous types." },
  "ASCORBYL TETRAISOPALMITATE":     { role: "Actif",            description: "Dérivé liposoluble stable de la vitamine C. Pénètre facilement, antioxydant. Peaux concernées : tous types." },
  "ALLANTOIN":                      { role: "Apaisant",         description: "Dérivé naturel apaisant, cicatrisant et kératolytique très doux. Apaise les irritations rapidement. Peaux concernées : tous types, idéal peaux irritées et sensibles." },
  "BISABOLOL":                      { role: "Apaisant",         description: "Composant actif de la camomille. Anti-inflammatoire et apaisant puissant. Peaux concernées : peaux sensibles, réactives et rosacée." },
  "CENTELLA ASIATICA EXTRACT":      { role: "Apaisant",         description: "Extrait de centella (CICA) : cicatrisant, anti-inflammatoire et stimulant du collagène. Idéal après-soleil ou après irritation. Peaux concernées : peaux sensibles, irritées et acnéiques." },
  "CENTELLA ASIATICA LEAF EXTRACT": { role: "Apaisant",         description: "Extrait de feuilles de centella asiatica. Cicatrisant et anti-inflammatoire. Peaux concernées : peaux sensibles et acnéiques." },
  "ASIATICOSIDE":                   { role: "Apaisant",         description: "Principe actif du centella asiatica. Stimule la synthèse de collagène et accélère la cicatrisation. Peaux concernées : peaux irritées et acnéiques." },
  "MADECASSOSIDE":                  { role: "Apaisant",         description: "Principe actif du centella asiatica. Puissant anti-inflammatoire et cicatrisant. Peaux concernées : peaux sensibles et acnéiques." },
  "ADENOSINE":                      { role: "Actif",            description: "Nucléoside naturel : anti-rides et anti-inflammatoire, stimule le collagène. Très bien toléré. Peaux concernées : peaux matures." },
  "ECTOIN":                         { role: "Protecteur",       description: "Molécule naturelle (bactéries extrêmophiles) : renforce la barrière cutanée et protège du stress environnemental. Peaux concernées : tous types, idéal peaux sensibles et exposées à la pollution." },
  "TRANEXAMIC ACID":                { role: "Dépigmentant",     description: "Acide tranexamique : inhibe la mélanine, efficace contre le mélasma. Bien toléré, peut être utilisé enceinte. Peaux concernées : tous types avec taches ou mélasma." },
  "HEXYLRESORCINOL":                { role: "Dépigmentant",     description: "Dépigmentant plus puissant que l'alpha-arbutin. Anti-inflammatoire. Peaux concernées : tous types avec hyperpigmentation." },
  "ZINC PCA":                       { role: "Sébo-régulateur",  description: "Association zinc + PCA : régule le sébum et resserre les pores. Anti-inflammatoire léger. Peaux concernées : peaux grasses et acnéiques." },

  // ─ Antioxydants ─
  "TOCOPHEROL":                     { role: "Antioxydant",      description: "Vitamine E naturelle : protège les lipides cutanés de l'oxydation et nourrit la peau. Peaux concernées : tous types, idéal peaux sèches et matures." },
  "TOCOPHERYL ACETATE":             { role: "Antioxydant",      description: "Forme stable de la vitamine E. Antioxydante et nourrissante. Peaux concernées : tous types." },
  "FERULIC ACID":                   { role: "Antioxydant",      description: "Polyphénol végétal : potentialise l'efficacité des vitamines C et E. Peaux concernées : tous types." },
  "RESVERATROL":                    { role: "Antioxydant",      description: "Polyphénol du raisin : protège contre le vieillissement oxydatif et stimule le collagène. Peaux concernées : tous types, surtout peaux matures." },
  "COENZYME Q10":                   { role: "Antioxydant",      description: "Ubiquinone : antioxydant cellulaire, ralentit le vieillissement cutané. Peaux concernées : peaux matures." },
  "UBIQUINONE":                     { role: "Antioxydant",      description: "Coenzyme Q10. Antioxydant anti-âge. Peaux concernées : peaux matures." },
  "HYDROXYACETOPHENONE":            { role: "Antioxydant",      description: "Antioxydant et conservateur naturel. Stabilise la formule et protège les actifs. Peaux concernées : tous types." },

  // ─ Émollients ─
  "SQUALANE":                       { role: "Émollient",        description: "Huile végétale légère (olive, canne à sucre) mimétique du sébum. Non comédogène, idéale pour hydrater sans graisser. Peaux concernées : tous types y compris peaux acnéiques." },
  "SIMMONDSIA CHINENSIS SEED OIL":  { role: "Émollient",        description: "Huile de jojoba (cire liquide végétale). Non comédogène, équilibrante, proche du sébum. Peaux concernées : tous types." },
  "ROSA CANINA FRUIT OIL":          { role: "Émollient",        description: "Huile de rose musquée : réparatrice, riche en acides gras insaturés et rétinol naturel. Peaux concernées : peaux sèches, matures et cicatrices." },
  "ARGANIA SPINOSA KERNEL OIL":     { role: "Émollient",        description: "Huile d'argan : riche en vitamine E et acides gras, nourrissante et antioxydante. Peaux concernées : peaux sèches et matures." },
  "CETYL ALCOHOL":                  { role: "Émollient",        description: "Alcool gras (non irritant, à ne pas confondre avec les alcools courts). Adoucit la peau et améliore la texture des crèmes. Peaux concernées : tous types." },
  "STEARYL ALCOHOL":                { role: "Émollient",        description: "Alcool gras émollient et co-émulsifiant. Non irritant. Peaux concernées : tous types." },
  "CETEARYL ALCOHOL":               { role: "Émollient",        description: "Mélange d'alcools gras (cétylique + stéarylique). Émollient, co-émulsifiant non irritant. Peaux concernées : tous types." },
  "DIMETHICONE":                    { role: "Émollient",        description: "Silicone non volatile : forme un film protecteur et améliore la texture sans obstruer les pores. Non comédogène. Peaux concernées : tous types." },
  "CAPRYLIC/CAPRIC TRIGLYCERIDE":   { role: "Émollient",        description: "Ester d'huile de coco fractionnée : léger, non comédogène, très bien toléré. Peaux concernées : tous types." },
  "COCO-CAPRYLATE/CAPRATE":         { role: "Émollient",        description: "Émollient léger d'origine coco. Texture sèche, non comédogène. Peaux concernées : tous types." },
  "BUTYROSPERMUM PARKII BUTTER":    { role: "Émollient",        description: "Beurre de karité : très nourrissant et réparateur. Légèrement comédogène en application pure sur le visage. Peaux concernées : peaux sèches — à limiter sur visage acnéique." },
  "BUTYROSPERMUM PARKII SEED BUTTER": { role: "Émollient",      description: "Beurre de karité (INCI alternatif). Nourrissant et réparateur. Peaux concernées : peaux sèches." },
  "HELIANTHUS ANNUUS SEED OIL":     { role: "Émollient",        description: "Huile de tournesol : légère, riche en vitamine E. Non comédogène. Peaux concernées : tous types." },

  // ─ Barrière cutanée ─
  "CERAMIDE NP":                    { role: "Barrière",         description: "Céramide de type NP : composant essentiel du film lipidique cutané. Restaure la barrière fragilisée. Peaux concernées : peaux sèches, atopiques et sensibles." },
  "CERAMIDE AP":                    { role: "Barrière",         description: "Céramide de type AP. Renforce la barrière cutanée. Peaux concernées : peaux sèches et sensibles." },
  "CERAMIDE EOP":                   { role: "Barrière",         description: "Céramide de type EOP. Composant clé du film lipidique. Peaux concernées : peaux sèches et atopiques." },
  "CERAMIDE 1":                     { role: "Barrière",         description: "Céramide naturel type EOP. Composant essentiel du film lipidique cutané. Peaux concernées : peaux sèches et atopiques." },
  "CERAMIDE 3":                     { role: "Barrière",         description: "Céramide naturel type NP. Restaure la barrière cutanée. Peaux concernées : peaux sèches et fragilisées." },
  "CHOLESTEROL":                    { role: "Barrière",         description: "Stérol naturel de la peau : composant du film lipidique, émollient et réparateur. Peaux concernées : peaux sèches et matures." },
  "PHYTOSPHINGOSINE":               { role: "Barrière",         description: "Sphingolipide naturel : renforce la barrière et possède une action antimicrobienne. Peaux concernées : peaux acnéiques et sensibles." },

  // ─ Filtres UV minéraux ─
  "ZINC OXIDE":                     { role: "Filtre UV minéral", description: "Filtre UV minéral (UVA + UVB). Anti-inflammatoire, sébo-régulateur, non irritant. Considéré le filtre le plus sûr. Peaux concernées : tous types, idéal peaux sensibles et acnéiques." },
  "TITANIUM DIOXIDE":               { role: "Filtre UV minéral", description: "Filtre UV minéral. Non irritant, couvrant. Peaux concernées : tous types, idéal peaux sensibles." },

  // ─ Conservateurs sûrs ─
  "PHENOXYETHANOL":                 { role: "Conservateur",     description: "Conservateur de référence actuel. Considéré sûr par le SCCS jusqu'à 1% (limite EU). Bien toléré. Peaux concernées : tous types." },
  "SODIUM BENZOATE":                { role: "Conservateur",     description: "Conservateur naturel (sel de l'acide benzoïque). Bien toléré. Peaux concernées : tous types." },
  "POTASSIUM SORBATE":              { role: "Conservateur",     description: "Conservateur naturel actif contre moisissures et levures. Bien toléré. Peaux concernées : tous types." },
  "ETHYLHEXYLGLYCERIN":             { role: "Conservateur",     description: "Conservateur et humectant doux d'origine végétale. Souvent associé à la phénoxyéthanol. Peaux concernées : tous types." },
  "CAPRYLYL GLYCOL":                { role: "Conservateur",     description: "Conservateur et émollient doux. Bien toléré, d'origine végétale. Peaux concernées : tous types." },

  // ─ Texturants / structurants ─
  "CARBOMER":                       { role: "Épaississant",     description: "Polymère acrylique gélifiant. Donne une texture gel. Non irritant aux concentrations habituelles. Peaux concernées : tous types." },
  "XANTHAN GUM":                    { role: "Épaississant",     description: "Gomme naturelle (fermentation bactérienne). Gélifiant et stabilisant naturel. Peaux concernées : tous types." },
  "HYDROXYETHYLCELLULOSE":          { role: "Épaississant",     description: "Dérivé naturel de la cellulose. Épaississant et modificateur de texture. Peaux concernées : tous types." },
  "HYDROXYPROPYL METHYLCELLULOSE":  { role: "Épaississant",     description: "Épaississant cellulosique. Texture gel, non irritant. Peaux concernées : tous types." },

  // ─ Exfoliants chimiques ─
  "GLYCOLIC ACID":                  { role: "Exfoliant AHA",    description: "Acide alpha-hydroxy (AHA) : exfoliant puissant, lisse et éclaircit. Peut irriter les peaux sensibles — utiliser progressivement et avec protection solaire. Peaux concernées : peaux ternes et acnéiques — pas sur peaux très sensibles." },
  "LACTIC ACID":                    { role: "Exfoliant AHA",    description: "AHA doux : exfoliant et humectant à la fois. Plus toléré que l'acide glycolique. Peaux concernées : tous types y compris peaux sensibles." },
  "MANDELIC ACID":                  { role: "Exfoliant AHA",    description: "AHA à molécule large : exfoliant doux, antibactérien. Idéal pour les peaux sensibles qui ne tolèrent pas l'acide glycolique. Peaux concernées : peaux acnéiques et sensibles." },
  "CITRIC ACID":                    { role: "Régulateur pH",    description: "Acide citrique : régulateur de pH des formules. Légèrement exfoliant à concentration élevée. Peaux concernées : tous types." },
  "GLUCONOLACTONE":                 { role: "Exfoliant PHA",    description: "Acide poly-hydroxy (PHA) : exfoliant très doux, hydratant. Idéal pour les peaux sensibles ne tolérant pas les AHA. Peaux concernées : tous types." },
  "LACTOBIONIC ACID":               { role: "Exfoliant PHA",    description: "PHA très doux : exfoliant, antioxydant et humectant. Peaux concernées : tous types y compris peaux sensibles et réactives." },

  // ─ Chélateurs ─
  "DISODIUM EDTA":                  { role: "Chélateur",        description: "Agent chélateur : stabilise la formule en neutralisant les ions métalliques. Non irritant aux doses habituelles. Peaux concernées : tous types." },
  "TRISODIUM EDTA":                 { role: "Chélateur",        description: "Chélateur EDTA trisodique. Stabilise la formule et améliore l'efficacité des conservateurs. Non irritant aux doses habituelles. Peaux concernées : tous types." },
  "TETRASODIUM EDTA":               { role: "Chélateur",        description: "Chélateur EDTA tétrasodique. Stabilise la formule. Peaux concernées : tous types." },
  "TRISODIUM ETHYLENEDIAMINE DISUCCINATE": { role: "Chélateur", description: "Chélateur biodégradable, alternative verte à l'EDTA. Stabilise les formules. Peaux concernées : tous types." },
  "PHYTIC ACID":                    { role: "Chélateur",        description: "Acide phytique d'origine végétale (son de riz). Chélateur doux et antioxydant léger. Peaux concernées : tous types." },
  "SODIUM PHYTATE":                 { role: "Chélateur",        description: "Sel de l'acide phytique. Chélateur naturel, stabilisateur de formule. Peaux concernées : tous types." },

  // ─ Acides gras (émollients) ─
  "STEARIC ACID":                   { role: "Émollient",        description: "Acide gras saturé (C18) très courant dans les crèmes. Agent structurant et émollient doux. Constituant naturel du sébum. Peaux concernées : tous types." },
  "PALMITIC ACID":                  { role: "Émollient",        description: "Acide gras saturé (C16) présent dans le sébum et nombreuses huiles végétales. Émollient structurant. Peaux concernées : tous types." },
  "OLEIC ACID":                     { role: "Émollient",        description: "Acide gras mono-insaturé (C18:1). Pénètre facilement la peau, émollient nourrissant. Peaux concernées : tous types — léger potentiel comédogène pour les peaux très acnéiques." },
  "LINOLEIC ACID":                  { role: "Émollient",        description: "Acide gras essentiel oméga-6. Renforce la barrière cutanée et réduit les comédons. Peaux concernées : tous types, idéal peaux acnéiques." },
  "BEHENIC ACID":                   { role: "Émollient",        description: "Acide gras saturé (C22) naturel (huile de colza). Émollient doux, structurant non comédogène. Peaux concernées : tous types." },
  "CAPRYLIC ACID":                  { role: "Émollient",        description: "Acide gras saturé à chaîne moyenne (C8). Léger, absorbé rapidement. Peaux concernées : tous types." },
  "LAURIC ACID":                    { role: "Émollient",        description: "Acide gras (C12) de l'huile de coco. Propriétés antibactériennes sur C. acnes, mais peut obstruer les pores. Peaux concernées : à surveiller sur peaux acnéiques." },

  // ─ Alcools gras (émollients) ─
  "BEHENYL ALCOHOL":                { role: "Émollient",        description: "Alcool gras (C22) non irritant. Émollient et co-émulsifiant. Améliore la texture des crèmes. Peaux concernées : tous types." },
  "ARACHIDYL ALCOHOL":              { role: "Émollient",        description: "Alcool gras (C20) naturel. Co-émulsifiant et émollient doux. Peaux concernées : tous types." },

  // ─ Esters émollients ─
  "DICAPRYLYL CARBONATE":           { role: "Émollient",        description: "Ester léger à texture sèche. Alternative aux silicones, excellente glisse sans film gras. Non comédogène. Peaux concernées : tous types y compris peaux grasses." },
  "C12-15 ALKYL BENZOATE":          { role: "Émollient",        description: "Ester synthétique léger à texture sèche. Vecteur d'actifs, améliore l'étalement. Non comédogène. Peaux concernées : tous types." },
  "DIBUTYL ADIPATE":                { role: "Émollient",        description: "Ester synthétique léger, souvent utilisé comme cosolvant dans les écrans solaires pour disperser les filtres UV. Non comédogène. Peaux concernées : tous types." },
  "BUTYLENE GLYCOL DICAPRYLATE/DICAPRATE": { role: "Émollient", description: "Ester d'origine végétale très léger. Texture non grasse, excellente tolérance. Non comédogène. Peaux concernées : tous types." },
  "OCTYLDODECANOL":                 { role: "Émollient",        description: "Alcool gras liquide, émollient non gras. Améliore la pénétration des actifs. Non comédogène. Peaux concernées : tous types." },
  "ISONONYL ISONONANOATE":          { role: "Émollient",        description: "Ester léger à texture sèche. Bonne tolérance, résidu non gras. Peaux concernées : tous types." },
  "ETHYLHEXYL ISONONANOATE":        { role: "Émollient",        description: "Ester léger, texture sèche, améliore l'étalage. Non comédogène. Peaux concernées : tous types." },
  "ETHYLHEXYL OLIVATE":             { role: "Émollient",        description: "Ester d'huile d'olive légèrement transformé. Plus léger que l'huile brute. Peaux concernées : tous types." },
  "DIISOPROPYL SEBACATE":           { role: "Émollient",        description: "Ester léger issu de l'acide sébacique. Texture non grasse, bon vecteur. Peaux concernées : tous types." },
  "TRIETHYLHEXANOIN":               { role: "Émollient",        description: "Ester triglycéridique léger et stable. Émollient non comédogène. Peaux concernées : tous types." },
  "OCTYLDODECYL MYRISTATE":         { role: "Émollient",        description: "Ester émollient lourd, texture riche. Peaux concernées : peaux sèches — à surveiller sur peaux acnéiques." },
  "PENTAERYTHRITYL TETRAETHYLHEXANOATE": { role: "Émollient",  description: "Ester synthétique filmogène. Résistant à l'eau. Peaux concernées : tous types." },

  // ─ Filtres UV chimiques (hors PE) ─
  "BUTYL METHOXYDIBENZOYLMETHANE":  { role: "Filtre UV",        description: "Filtre UVA (320-400 nm) très efficace — actif principal des SPF à large spectre. Photolabile : se dégrade à la lumière, nécessite photostabilisateurs. Bien toléré aux concentrations habituelles. Peaux concernées : tous types." },
  "BIS-ETHYLHEXYLOXYPHENOL METHOXYPHENYL TRIAZINE": { role: "Filtre UV", description: "Tinosorb S : filtre UVA/UVB large spectre, photostable. Considéré parmi les filtres chimiques les plus sûrs et efficaces. Peaux concernées : tous types." },
  "ETHYLHEXYL TRIAZONE":            { role: "Filtre UV",        description: "Filtre UVB puissant et photostable. Très faible pénétration cutanée. Peaux concernées : tous types." },
  "PHENYLBENZIMIDAZOLE SULFONIC ACID": { role: "Filtre UV",     description: "Filtre UVB hydrosoluble (Parsol HS). Bonne tolérance, utilisé dans les formules légères. Peaux concernées : tous types." },
  "DIETHYLAMINO HYDROXYBENZOYL HEXYL BENZOATE": { role: "Filtre UV", description: "Filtre UVA (Uvinul A Plus). Très faible absorption percutanée, photostable. Peaux concernées : tous types." },
  "METHYLENE BIS-BENZOTRIAZOLYL TETRAMETHYLBUTYLPHENOL": { role: "Filtre UV", description: "Tinosorb M : filtre minéral-organique hybride, large spectre. Très photostable, faible pénétration. Peaux concernées : tous types." },
  "ETHYLHEXYL SALICYLATE":          { role: "Filtre UV",        description: "Octisalate : filtre UVB, améliore aussi la photostabilité d'autres filtres. Bien toléré. Peaux concernées : tous types." },
  "ETHYLHEXYL METHOXYCRYLENE":      { role: "Filtre UV",        description: "Photostabilisateur qui améliore la durabilité des filtres UVA. Utilisé en synergie avec Avobenzone. Peaux concernées : tous types." },
  "ISCOTRIZINOL":                   { role: "Filtre UV",        description: "Filtre UVB large (Uvasorb HEB). Photostable, bonne tolérance. Peaux concernées : tous types." },
  "BISOCTRIZOLE":                   { role: "Filtre UV",        description: "Tinosorb M — voir Methylene Bis-Benzotriazolyl Tetramethylbutylphenol. Peaux concernées : tous types." },

  // ─ Émulsifiants ─
  "GLYCERYL STEARATE":              { role: "Émulsifiant",      description: "Émulsifiant courant dérivé du glycérol et de l'acide stéarique. Stabilise les émulsions huile-dans-eau. Non irritant. Peaux concernées : tous types." },
  "PEG-100 STEARATE":               { role: "Émulsifiant",      description: "Co-émulsifiant PEG souvent associé au glyceryl stearate. Améliore la texture et la stabilité. Peaux concernées : tous types." },
  "CETEARYL GLUCOSIDE":             { role: "Émulsifiant",      description: "Émulsifiant doux d'origine végétale (coco + glucose). Non irritant, bien toléré. Peaux concernées : tous types." },
  "POLYSORBATE 20":                 { role: "Émulsifiant",      description: "Tensioactif non-ionique doux. Solubilisateur d'huiles et parfums dans les formules aqueuses. Bien toléré. Peaux concernées : tous types." },
  "POLYSORBATE 60":                 { role: "Émulsifiant",      description: "Émulsifiant non-ionique doux. Stabilise les émulsions corps. Peaux concernées : tous types." },
  "POLYSORBATE 80":                 { role: "Émulsifiant",      description: "Émulsifiant non-ionique très courant. Bien toléré. Peaux concernées : tous types." },
  "SORBITAN STEARATE":              { role: "Émulsifiant",      description: "Émulsifiant doux d'origine naturelle (sorbitol + acide stéarique). Stabilise les émulsions. Peaux concernées : tous types." },
  "SORBITAN OLEATE":                { role: "Émulsifiant",      description: "Émulsifiant non-ionique naturel. Améliore la texture. Peaux concernées : tous types." },
  "SORBITAN SESQUIOLEATE":          { role: "Émulsifiant",      description: "Émulsifiant lipophile. Utilisé dans les formules eau-dans-huile. Peaux concernées : tous types." },
  "SODIUM STEAROYL GLUTAMATE":      { role: "Émulsifiant",      description: "Émulsifiant d'origine naturelle (acide aminé + acide stéarique). Doux, adapté aux formules sans PEG. Peaux concernées : tous types." },
  "STEARETH-2":                     { role: "Émulsifiant",      description: "Co-émulsifiant alcool éthoxylé lipophile. Stabilise les émulsions. Peaux concernées : tous types." },
  "STEARETH-21":                    { role: "Émulsifiant",      description: "Émulsifiant alcool éthoxylé hydrophile. Souvent associé au Steareth-2. Peaux concernées : tous types." },
  "LECITHIN":                       { role: "Émulsifiant",      description: "Phospholipide naturel (soja ou tournesol). Émulsifiant, renforce la barrière cutanée. Peaux concernées : tous types." },
  "HYDROGENATED LECITHIN":          { role: "Émulsifiant",      description: "Lécithine hydrogénée, plus stable. Même profil de douceur. Peaux concernées : tous types." },
  "POLYGLYCERYL-3 METHYLGLUCOSE DISTEARATE": { role: "Émulsifiant", description: "Émulsifiant doux à base de sucre. Bien toléré, sans PEG. Peaux concernées : tous types." },
  "PEG-40 HYDROGENATED CASTOR OIL": { role: "Émulsifiant",      description: "Solubilisateur d'huiles essentielles et de lipides dans les formules aqueuses. Peaux concernées : tous types." },
  "BEHENTRIMONIUM METHOSULFATE":    { role: "Émulsifiant",      description: "Émulsifiant conditionneur. Très utilisé dans les après-shampooings et soins capillaires. Doux. Peaux concernées : tous types." },
  "GLYCERYL STEARATE SE":           { role: "Émulsifiant",      description: "Version auto-émulsifiante du glyceryl stearate. Facilite la formulation sans co-émulsifiants. Peaux concernées : tous types." },
  "ARACHIDYL GLUCOSIDE":            { role: "Émulsifiant",      description: "Émulsifiant doux à base de sucre d'origine végétale. Peaux concernées : tous types." },

  // ─ Silicones fonctionnels ─
  "PHENYL TRIMETHICONE":            { role: "Émollient",        description: "Silicone phénylée brillante et lisse. Améliore la brillance et la douceur. Non comédogène. Peaux concernées : tous types." },
  "DIMETHICONOL":                   { role: "Émollient",        description: "Silicone hydroxylée. Lissante et filmogène, améliore la texture des formules. Non comédogène. Peaux concernées : tous types." },
  "METHYL TRIMETHICONE":            { role: "Émollient",        description: "Silicone ramifiée légère. Texture sèche et non grasse, excellente glisse. Volatile, très proche des silicones cycliques mais plus sûre. Peaux concernées : tous types." },

  // ─ Texturants inorganiques ─
  "SILICA":                         { role: "Texturant",        description: "Dioxyde de silicium (silice). Matifiant, absorbe le sébum et améliore la texture. Non irritant. Peaux concernées : tous types, idéal peaux grasses." },
  "SILICA DIMETHYL SILYLATE":       { role: "Texturant",        description: "Silice traitée en surface, hydrophobe. Améliore la tenue et la texture. Peaux concernées : tous types." },
  "MAGNESIUM ALUMINUM SILICATE":    { role: "Texturant",        description: "Argile minérale naturelle. Épaississant et stabilisant d'émulsion. Peaux concernées : tous types." },
  "KAOLIN":                         { role: "Texturant",        description: "Argile blanche naturelle. Absorbe le sébum, assainit. Peaux concernées : tous types, idéal peaux grasses." },
  "TALC":                           { role: "Texturant",        description: "Silicate de magnésium naturel. Texturant, matifiant. Peaux concernées : tous types." },
  "MICA":                           { role: "Texturant",        description: "Minéral naturel micacé. Donne brillance et effet lumière dans les cosmétiques de couleur. Peaux concernées : tous types." },
  "NYLON-12":                       { role: "Texturant",        description: "Polymère synthétique en poudre. Toucher soyeux, matifiant. Peaux concernées : tous types." },
  "TRIMETHYLSILOXYSILICATE":        { role: "Texturant",        description: "Résine silicone filmogène. Améliore la tenue des maquillages et crèmes SPF. Peaux concernées : tous types." },

  // ─ Cires végétales ─
  "COPERNICIA CERIFERA CERA":       { role: "Épaississant",     description: "Cire de carnauba (palmier brésilien). Épaississant végétal naturel, structurant. Forme un film protecteur. Peaux concernées : tous types." },
  "CANDELILLA CERA":                { role: "Épaississant",     description: "Cire de candelilla (arbuste mexicain). Alternative végétale à la cire d'abeille. Structurant. Peaux concernées : tous types." },
  "CERA ALBA":                      { role: "Épaississant",     description: "Cire d'abeille blanche. Structurante, légèrement émolliente. Peaux concernées : tous types." },
  "CERA FLAVA":                     { role: "Épaississant",     description: "Cire d'abeille jaune. Structurante, légèrement émolliente. Peaux concernées : tous types." },
  "HYDROGENATED JOJOBA OIL":        { role: "Épaississant",     description: "Huile de jojoba hydrogénée — se transforme en cire. Structurante végétale. Peaux concernées : tous types." },

  // ─ Épaississants polymères ─
  "CARRAGEENAN":                    { role: "Épaississant",     description: "Polysaccharide extrait d'algues rouges. Gélifiant naturel. Peaux concernées : tous types." },
  "MICROCRYSTALLINE CELLULOSE":     { role: "Épaississant",     description: "Cellulose purifiée en poudre. Épaississant et stabilisant naturel. Peaux concernées : tous types." },
  "SODIUM POLYACRYLATE":            { role: "Épaississant",     description: "Polymère synthétique superabsorbant. Gélifiant utilisé dans les formules légères. Peaux concernées : tous types." },
  "ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER": { role: "Épaississant", description: "Polymère réticulé acrylique — carbomère modifié. Textures gel légères et fluides. Peaux concernées : tous types." },
  "HYDROXYETHYL ACRYLATE/SODIUM ACRYLOYLDIMETHYL TAURATE COPOLYMER": { role: "Épaississant", description: "Polymère hybride acrylique-taurate. Textures gel légères, bonne tolérance. Peaux concernées : tous types." },
  "ACRYLATES COPOLYMER":            { role: "Épaississant",     description: "Copolymère acrylique polyvalent. Épaississant et filmogène. Peaux concernées : tous types." },

  // ─ Humectants supplémentaires ─
  "MANNITOL":                       { role: "Humectant",        description: "Sucre-alcool naturel. Humectant doux, antioxydant léger. Peaux concernées : tous types." },
  "ERYTHRITOL":                     { role: "Humectant",        description: "Sucre-alcool naturel. Humectant doux, améliore le toucher. Peaux concernées : tous types." },
  "XYLITOL":                        { role: "Humectant",        description: "Sucre-alcool du bouleau. Humectant et légèrement prébiotique pour le microbiome. Peaux concernées : tous types." },
  "TREHALOSE":                      { role: "Humectant",        description: "Disaccharide naturel. Protège les cellules du stress osmotique, hydratant film-forming. Peaux concernées : tous types, idéal peaux sensibles." },
  "INOSITOL":                       { role: "Humectant",        description: "Polyol naturel (vitamine B8). Hydratant, améliore la tolérance cutanée. Peaux concernées : tous types." },
  "SUCROSE":                        { role: "Humectant",        description: "Saccharose naturel. Humectant doux dans les formules concentrées. Peaux concernées : tous types." },
  "MALTOSE":                        { role: "Humectant",        description: "Disaccharide naturel. Humectant et calmant. Peaux concernées : tous types." },
  "FRUCTOSE":                       { role: "Humectant",        description: "Sucre naturel humectant. Améliore le toucher. Peaux concernées : tous types." },

  // ─ Régulateurs de pH ─
  "SODIUM HYDROXIDE":               { role: "Régulateur pH",    description: "Soude (NaOH). Ajuste le pH des formules à la neutralité cutanée. Utilisé à très faibles doses. Peaux concernées : tous types." },
  "POTASSIUM HYDROXIDE":            { role: "Régulateur pH",    description: "Potasse (KOH). Ajuste le pH des formules. Utilisé à très faibles doses. Peaux concernées : tous types." },
  "TRIETHANOLAMINE":                { role: "Régulateur pH",    description: "Agent neutralisant courant. Utilisé pour ajuster le pH des carbomères. Bien toléré aux concentrations habituelles. Peaux concernées : tous types." },
  "AMINOMETHYL PROPANOL":           { role: "Régulateur pH",    description: "Neutralisant alcalin doux. Alternative à la triéthanolamine. Peaux concernées : tous types." },
  "ARGININE":                       { role: "Régulateur pH",    description: "Acide aminé naturel. Neutralisant doux des formules acides, renforçant la barrière. Peaux concernées : tous types." },

  // ─ Conservateurs supplémentaires ─
  "DECYLENE GLYCOL":                { role: "Conservateur",     description: "Diol à 10 carbones. Conservateur naturel actif contre les bactéries et moisissures. Bien toléré. Peaux concernées : tous types." },
  "1,2-HEXANEDIOL":                 { role: "Conservateur",     description: "Diol conservateur doux. Souvent associé à la phénoxyéthanol ou à la caprylhydroxamic acid. Peaux concernées : tous types." },
  "CAPRYLHYDROXAMIC ACID":          { role: "Conservateur",     description: "Conservateur dérivé de l'acide caprylique (coco). Doux, d'origine naturelle. Peaux concernées : tous types." },
  "CHLORPHENESIN":                  { role: "Conservateur",     description: "Conservateur synthétique antibactérien. Efficace à faibles doses. Peaux concernées : tous types." },
  "DEHYDROACETIC ACID":             { role: "Conservateur",     description: "Conservateur naturel actif contre levures et moisissures. Souvent associé à l'alcool benzylique. Peaux concernées : tous types." },
  "BENZOIC ACID":                   { role: "Conservateur",     description: "Conservateur naturel (acidifiant). Actif à pH <5. Peaux concernées : tous types." },
  "GLYCERYL CAPRYLATE":             { role: "Conservateur",     description: "Dérivé du glycérol et de l'acide caprylique. Conservateur et émollient doux d'origine naturelle. Peaux concernées : tous types." },

  // ─ Actifs supplémentaires ─
  "GLYCYRRHIZIC ACID":              { role: "Apaisant",         description: "Acide glycyrrhizique extrait de la réglisse. Anti-inflammatoire et apaisant. Réduit les rougeurs. Peaux concernées : tous types, idéal peaux sensibles et acnéiques." },
  "GLYCYRRHETINIC ACID":            { role: "Apaisant",         description: "Acide glycyrrhétinique (métabolite actif de la réglisse). Puissant anti-inflammatoire et apaisant. Peaux concernées : tous types, idéal peaux sensibles et acnéiques." },
  "DIPOTASSIUM GLYCYRRHIZATE":      { role: "Apaisant",         description: "Sel de l'acide glycyrrhizique. Anti-inflammatoire doux, apaisant. Peaux concernées : tous types." },
  "GLYCYRRHIZA GLABRA ROOT EXTRACT": { role: "Apaisant",        description: "Extrait de réglisse lisse. Apaisant, anti-inflammatoire et légèrement dépigmentant. Peaux concernées : tous types." },
  "GLYCYRRHIZA INFLATA ROOT EXTRACT": { role: "Apaisant",       description: "Extrait de réglisse (racine). Riche en glabridine et glycyrrhizine. Anti-inflammatoire actif. Peaux concernées : tous types, idéal peaux sensibles." },
  "CARNITINE":                      { role: "Actif",            description: "Acide aminé naturel. Stimule le métabolisme cellulaire, antioxydant léger. Peaux concernées : tous types." },
  "CAFFEINE":                       { role: "Actif",            description: "Stimulant naturel (thé, café). Vasoconstricteur, décongestionnant des cernes, potentiellement anti-cellulite. Antioxydant. Peaux concernées : tous types." },
  "CREATINE":                       { role: "Actif",            description: "Molécule énergétique cellulaire. Stimule la synthèse du collagène et la régénération cellulaire. Peaux concernées : peaux matures." },
  "TAURINE":                        { role: "Actif",            description: "Acide aminé sulfonique. Antioxydant cellulaire, protège des UV et du stress environnemental. Peaux concernées : tous types." },
  "HYDROLYZED COLLAGEN":            { role: "Actif",            description: "Collagène hydrolysé en peptides. Hydratant filmogène en surface, améliore l'élasticité. Peaux concernées : tous types, surtout peaux matures." },
  "HYDROLYZED ELASTIN":             { role: "Actif",            description: "Élastine hydrolysée. Améliore l'élasticité cutanée perçue. Peaux concernées : peaux matures." },
  "HYDROLYZED KERATIN":             { role: "Actif",            description: "Kératine hydrolysée. Protège et lisse. Peaux concernées : tous types." },
  "HYDROLYZED SILK":                { role: "Actif",            description: "Protéines de soie hydrolysées. Toucher soyeux, lissant. Peaux concernées : tous types." },
  "PALMITOYL TRIPEPTIDE-1":         { role: "Actif",            description: "Peptide signal. Stimule la synthèse de collagène et d'élastine. Peaux concernées : peaux matures." },
  "PALMITOYL TETRAPEPTIDE-7":       { role: "Actif",            description: "Peptide anti-inflammatoire. Réduit l'accumulation de cytokines pro-inflammatoires. Peaux concernées : tous types." },
  "PALMITOYL PENTAPEPTIDE-4":       { role: "Actif",            description: "Matrixyl — peptide signal anti-âge. Stimule le collagène. Peaux concernées : peaux matures." },
  "ACETYL HEXAPEPTIDE-3":           { role: "Actif",            description: "Argireline — peptide myorelaxant topique. Réduit les rides d'expression. Peaux concernées : peaux matures." },
  "CERAMIDE 2":                     { role: "Barrière",         description: "Céramide de type NS. Composant du film lipidique cutané. Restaure la barrière. Peaux concernées : peaux sèches et atopiques." },
  "CERAMIDE 6-II":                  { role: "Barrière",         description: "Céramide de type AP. Renforce la barrière cutanée. Peaux concernées : peaux sèches et sensibles." },

  // ─ Huiles végétales supplémentaires ─
  "PRUNUS AMYGDALUS DULCIS OIL":    { role: "Émollient",        description: "Huile douce d'amande (amande douce). Légère, riche en acides gras insaturés. Non comédogène. Peaux concernées : tous types y compris peaux sensibles." },
  "VITIS VINIFERA SEED OIL":        { role: "Émollient",        description: "Huile de pépins de raisin. Légère, riche en linoléique, antioxydante. Non comédogène. Peaux concernées : tous types." },
  "PERSEA GRATISSIMA OIL":          { role: "Émollient",        description: "Huile d'avocat. Riche et nourrissante. Peaux concernées : peaux sèches et matures — à doser pour les peaux grasses." },
  "MACADAMIA TERNIFOLIA SEED OIL":  { role: "Émollient",        description: "Huile de macadamia. Riche en acide palmitoléique, pénètre facilement, très douce. Peaux concernées : tous types." },
  "CALOPHYLLUM INOPHYLLUM SEED OIL": { role: "Émollient",       description: "Huile de tamanu. Réparatrice, cicatrisante, anti-inflammatoire. Peaux concernées : peaux irritées, cicatrices." },
  "CAMELLIA SINENSIS SEED OIL":     { role: "Émollient",        description: "Huile de caméllia (thé vert). Légère, riche en oléique. Non comédogène. Peaux concernées : tous types." },
  "HIPPOPHAE RHAMNOIDES OIL":       { role: "Actif",            description: "Huile d'argousier. Très riche en caroténoïdes et vitamine C. Actif réparateur et antioxydant puissant. Peaux concernées : peaux irritées, sèches et matures." },

  // ─ Huiles végétales supplémentaires (INCIDecoder) ─
  "ROSEHIP OIL":                    { role: "Émollient",        description: "Huile de rose musquée. Riche en linoléique et acides gras essentiels. Réparatrice. Peaux concernées : peaux sèches, matures et cicatrices." },
  "MARULA OIL":                     { role: "Émollient",        description: "Huile de marula (Afrique). Légère, riche en oléique. Pénètre facilement, nourrissante sans film gras. Peaux concernées : tous types." },
  "MEADOWFOAM SEED OIL":            { role: "Émollient",        description: "Huile de limnanthe (meadowfoam). Très stable grâce à ses acides gras longs (C20-C22). Émolliente longue durée. Peaux concernées : tous types." },
  "LIMNANTHES ALBA SEED OIL":       { role: "Émollient",        description: "Huile de limnanthe (INCI officiel). Stable, légère et émolliente. Peaux concernées : tous types." },
  "SQUALENE":                       { role: "Émollient",        description: "Squalène — précurseur naturel du squalane (forme non hydrogénée). Antioxydant naturel du sébum. Peaux concernées : tous types." },
  "SPHINGOLIPIDS":                  { role: "Barrière",         description: "Sphingolipides naturels (membrane cellulaire). Renforcent la barrière cutanée et l'hydratation. Peaux concernées : peaux sèches et atopiques." },

  // ─ Actifs supplémentaires (INCIDecoder) ─
  "COPPER TRIPEPTIDE-1":            { role: "Actif",            description: "Tripeptide cuivre GHK-Cu. Stimule le collagène et l'élastine, cicatrisant. Peaux concernées : peaux matures et acnéiques." },
  "ASCORBYL PALMITATE":             { role: "Antioxydant",      description: "Dérivé liposoluble de la vitamine C. Antioxydant mais moins stable que l'acide ascorbique. Peaux concernées : tous types." },
  "SH-OLIGOPEPTIDE-1":              { role: "Actif",            description: "EGF (Epidermal Growth Factor) biosimilaire. Stimule le renouvellement cellulaire et la synthèse de collagène. Peaux concernées : peaux matures." },
  "TRIPEPTIDE-1":                   { role: "Actif",            description: "Peptide GHK (glycine-histidine-lysine). Fragment de collagène naturel, stimule la synthèse de collagène. Peaux concernées : peaux matures." },
  "GLUTAMINE":                      { role: "Actif",            description: "Acide aminé conditionnel. Précurseur du glutathion, antioxydant cellulaire. Peaux concernées : tous types." },
  "LYSINE":                         { role: "Actif",            description: "Acide aminé essentiel. Composant clé du collagène, aide à la cicatrisation. Peaux concernées : tous types." },
  "PROLINE":                        { role: "Actif",            description: "Acide aminé (collagène). Non essentiel, améliore l'élasticité cutanée. Peaux concernées : peaux matures." },
  "SERINE":                         { role: "Humectant",        description: "Acide aminé naturel (NMF). Hydratant et water-binding. Peaux concernées : tous types." },
  "GLYCINE":                        { role: "Humectant",        description: "Acide aminé le plus simple. Composant du NMF, humectant. Peaux concernées : tous types." },
  "THREONINE":                      { role: "Actif",            description: "Acide aminé essentiel. Précurseur de la collagénopoïèse, hydratant. Peaux concernées : tous types." },
  "PYRUVIC ACID":                   { role: "Exfoliant AHA",    description: "Acide pyruvique. AHA très actif et pénétrant. Exfoliant puissant, à utiliser prudemment. Peaux concernées : peaux épaisses, acnéiques." },
  "TARTARIC ACID":                  { role: "Exfoliant AHA",    description: "AHA (acide tartrique) extrait de raisin. Exfoliant doux, améliore la texture. Peaux concernées : tous types." },
  "MALIC ACID":                     { role: "Exfoliant AHA",    description: "AHA (acide malique) extrait de pomme. Exfoliant doux, améliore l'éclat. Peaux concernées : tous types." },
  "HYDROLYZED WHEAT PROTEIN":       { role: "Actif",            description: "Protéines de blé hydrolysées. Film protecteur, renforce les fibres cutanées. Peaux concernées : tous types." },
  "HYDROLYZED SOY PROTEIN":         { role: "Actif",            description: "Protéines de soja hydrolysées. Renforce la barrière, lissant. Peaux concernées : tous types." },
  "HYDROLYZED OAT PROTEIN":         { role: "Apaisant",         description: "Protéines d'avoine hydrolysées. Apaisantes, anti-irritantes, réparatrices. Peaux concernées : peaux sensibles et atopiques." },

  // ─ Apaisants supplémentaires (INCIDecoder) ─
  "ALOE VERA":                      { role: "Apaisant",         description: "Gel d'aloe vera. Hydratant, apaisant et cicatrisant naturel. Peaux concernées : tous types, idéal peaux irritées et après-soleil." },
  "ALOE BARBADENSIS LEAF JUICE":    { role: "Apaisant",         description: "Jus de feuille d'aloe vera. Hydratant, apaisant et anti-inflammatoire. Peaux concernées : tous types." },
  "BETA-GLUCAN":                    { role: "Apaisant",         description: "Polysaccharide de levure ou avoine. Apaisant, immunomodulateur et hydratant. Peaux concernées : peaux sensibles, irritées et matures." },
  "AVENA SATIVA KERNEL EXTRACT":    { role: "Apaisant",         description: "Extrait de noyau d'avoine. Apaisant cliniquement prouvé, anti-prurit. Peaux concernées : peaux sensibles et atopiques." },
  "OAT EXTRACT":                    { role: "Apaisant",         description: "Extrait d'avoine colloïdale. Apaisant anti-irritant. Peaux concernées : peaux sensibles, eczémateuses." },
  "CALENDULA OFFICINALIS EXTRACT":  { role: "Apaisant",         description: "Extrait de calendula (souci). Apaisant, cicatrisant et anti-inflammatoire. Peaux concernées : peaux sensibles et irritées." },
  "CHAMOMILLA RECUTITA EXTRACT":    { role: "Apaisant",         description: "Extrait de camomille matricaire. Puissant apaisant anti-inflammatoire. Peaux concernées : peaux sensibles et réactives." },

  // ─ Antioxydants supplémentaires (INCIDecoder) ─
  "CAMELLIA SINENSIS LEAF EXTRACT": { role: "Antioxydant",      description: "Extrait de feuille de thé vert. Riche en EGCG et polyphénols. Antioxydant puissant et anti-inflammatoire. Peaux concernées : tous types." },
  "GREEN TEA EXTRACT":              { role: "Antioxydant",      description: "Extrait de thé vert. Polyphénols antioxydants, anti-inflammatoire. Peaux concernées : tous types." },
  "BHT":                            { role: "Antioxydant",      description: "Butylhydroxytoluène. Antioxydant synthétique, stabilise les formules. Bien toléré à faibles doses. Peaux concernées : tous types." },
  "SODIUM METABISULFITE":           { role: "Antioxydant",      description: "Agent anti-oxydant et conservateur. Stabilise les formules à base de vitamine C. Peaux concernées : tous types." },

  // ─ Émollients supplémentaires (INCIDecoder) ─
  "COCO-CAPRYLATE":                 { role: "Émollient",        description: "Ester d'origine coco. Alternative légère aux silicones volatiles, texture sèche. Peaux concernées : tous types." },
  "DICAPRYLYL ETHER":               { role: "Émollient",        description: "Éther capryloyl léger. Texture sèche, étalement facile. Non comédogène. Peaux concernées : tous types." },
  "ETHYLHEXYL STEARATE":            { role: "Émollient",        description: "Ester de l'acide stéarique. Émollient moyen, réduit le film gras des autres huiles. Peaux concernées : tous types." },
  "NEOPENTYL GLYCOL DIHEPTANOATE":  { role: "Émollient",        description: "Ester synthétique très léger, presque volatile. Texture sèche, idéal écrans solaires. Peaux concernées : tous types." },
  "ISOPROPYL PALMITATE":            { role: "Émollient",        description: "Ester isopropylique de l'acide palmitique. Émollient léger à bonne glisse. Légèrement comédogène. Peaux concernées : tous types sauf peaux très acnéiques." },
  "GLYCERYL OLEATE":                { role: "Émulsifiant",      description: "Co-émulsifiant naturel (glycérol + acide oléique). Adoucissant, aide à stabiliser les émulsions. Peaux concernées : tous types." },

  // ─ Épaississants supplémentaires (INCIDecoder) ─
  "AMMONIUM ACRYLOYLDIMETHYLTAURATE/VP COPOLYMER": { role: "Épaississant", description: "Polymère acrylique (Aristoflex AVC). Gélifiant haute performance, crée des textures légères et non-collantes. Très utilisé en K-beauty. Peaux concernées : tous types." },
  "ACRYLATES/AMMONIUM METHACRYLATE COPOLYMER": { role: "Épaississant",   description: "Copolymère acrylique (Carbopol Aqua SF-1). Gélifiant et stabilisant d'émulsion. Texture légère. Peaux concernées : tous types." },
  "CARNAUBA":                       { role: "Épaississant",     description: "Cire de carnauba (alias CARNAUBA WAX). Végétale, structurante, point de fusion élevé. Peaux concernées : tous types." },
  "SYNTHETIC BEESWAX":              { role: "Épaississant",     description: "Cire d'abeille synthétique. Propriétés similaires à la cire naturelle. Structurante et filmogène. Peaux concernées : tous types." },
  "METHYLCELLULOSE":                { role: "Épaississant",     description: "Dérivé méthylé de la cellulose. Gélifiant et épaississant, sensible à la température. Peaux concernées : tous types." },
  "CELLULOSE":                      { role: "Épaississant",     description: "Polymère végétal naturel (paroi cellulaire). Épaississant et améliorant de texture. Peaux concernées : tous types." },
  "TAPIOCA STARCH":                 { role: "Épaississant",     description: "Amidon de tapioca. Poudre douce absorbante, remplace le talc. Matifiante. Peaux concernées : tous types." },
  "STARCH":                         { role: "Épaississant",     description: "Amidon végétal. Texturant absorbant, matifiant. Peaux concernées : tous types." },

  // ─ Émulsifiants supplémentaires (INCIDecoder) ─
  "CETEARETH-12":                   { role: "Émulsifiant",      description: "Alcool cétéarylique éthoxylé (12 OE). Émulsifiant et co-stabilisant. Peaux concernées : tous types." },
  "CETEARETH-20":                   { role: "Émulsifiant",      description: "Alcool cétéarylique éthoxylé (20 OE). Émulsifiant huile-dans-eau courant. Peaux concernées : tous types." },
  "SORBITAN ISOSTEARATE":           { role: "Émulsifiant",      description: "Émulsifiant non-ionique lipophile (sorbitol + acide isostéarique). Crée des émulsions eau-dans-huile douces. Peaux concernées : tous types." },

  // ─ Solvants supplémentaires (INCIDecoder) ─
  "DIPROPYLENE GLYCOL":             { role: "Solvant",          description: "Diol de synthèse. Solvant et humectant léger, bon tolérance. Peaux concernées : tous types." },
  "ETHOXYDIGLYCOL":                 { role: "Solvant",          description: "Solvant polaire. Améliore la pénétration des actifs (vitamine C, DHA). Peaux concernées : tous types." },
  "HEXYLENE GLYCOL":                { role: "Solvant",          description: "Diol court, solvant fluidifiant. Réduit la viscosité des formules. Peaux concernées : tous types." },

  // ─ Conservateurs supplémentaires (INCIDecoder) ─
  "SODIUM LEVULINATE":              { role: "Conservateur",     description: "Sel de l'acide lévulinique (sucre). Conservateur naturel doux, Ecocert. Peaux concernées : tous types." },
  "SODIUM ANISATE":                 { role: "Conservateur",     description: "Sel de l'acide anisique. Conservateur naturel antibactérien et antifongique. Peaux concernées : tous types." },
  "SORBIC ACID":                    { role: "Conservateur",     description: "Acide sorbique. Conservateur naturel actif contre levures et moisissures. Peaux concernées : tous types." },

  // ─ Actifs pharmaceutiques / antiseptiques ─
  "IBUPROFEN PICONOL":              { role: "Actif",            description: "Dérivé lipophile de l'ibuprofène. Anti-inflammatoire topique utilisé dans les crèmes OTC acné (Japon). Pénètre mieux dans la peau que l'ibuprofène seul. Peaux concernées : peaux acnéiques." },
  "ISOPROPYLMETHYLPHENOL":          { role: "Antibactérien",    description: "IPMP (o-Cymen-5-ol). Antiseptique topique puissant, actif contre P. acnes. Très utilisé dans les soins anti-acné japonais. Bien toléré aux concentrations habituelles (0,1–0,3%). Peaux concernées : peaux acnéiques." },

  // ─ Émulsifiants PEG supplémentaires ─
  "PEG-40 STEARATE":                { role: "Émulsifiant",      description: "Émulsifiant non-ionique (stéarate polyéthoxylé). Stabilise les émulsions huile-dans-eau. Aussi solubilisateur d'huiles. Peaux concernées : tous types." },

  // ─ Régulateurs pH supplémentaires (INCIDecoder) ─
  "PHOSPHORIC ACID":                { role: "Régulateur pH",    description: "Acide phosphorique. Ajuste le pH des formules. Utilisé à très faibles doses. Peaux concernées : tous types." },
  "TROMETHAMINE":                   { role: "Régulateur pH",    description: "Trométhamine (TRIS). Base organique douce pour ajuster le pH, notamment des formules acides (carbomère, acide hyaluronique). Bien tolérée. Peaux concernées : tous types." },

  // ─ Acides aminés NMF supplémentaires ─
  "PCA":                            { role: "Humectant",        description: "Acide pyrrolidone carboxylique (forme libre). Composant majeur du NMF (facteur naturel d'hydratation). Hygroscopique, retient l'eau dans le stratum corneum. Peaux concernées : tous types." },
  "ALANINE":                        { role: "Humectant",        description: "Acide aminé non essentiel. Composant du NMF, hydratant et water-binding. Peaux concernées : tous types." },
  "GLUTAMIC ACID":                  { role: "Humectant",        description: "Acide aminé acide. Composant du NMF, humectant naturel présent dans la peau. Peaux concernées : tous types." },
  "HISTIDINE":                      { role: "Humectant",        description: "Acide aminé essentiel. Composant du NMF, antioxydant et humectant. Peaux concernées : tous types." },
  "HISTIDINE HCL":                  { role: "Humectant",        description: "Chlorhydrate d'histidine. Forme soluble de l'histidine. Humectant et antioxydant doux. Peaux concernées : tous types." },
  "CITRULLINE":                     { role: "Humectant",        description: "Acide aminé naturel (pastèque). Améliore la microhydratation cellulaire et l'éclat. Peaux concernées : tous types." },
  "GLYCOGEN":                       { role: "Humectant",        description: "Polysaccharide de réserve énergétique. Hydratant filmogène, stimule le renouvellement cellulaire. Peaux concernées : tous types, idéal peaux fatiguées." },

  // ─ Barrière supplémentaire ─
  "HYDROXYPROPYL BISPALMITAMIDE MEA": { role: "Barrière",       description: "Lipide bifonctionnel (céramide synthétique). Restaure la barrière lipidique cutanée. Peaux concernées : peaux sèches, atopiques et fragilisées." },

  // ─ Acide gras supplémentaire ─
  "ARACHIDIC ACID":                 { role: "Émollient",        description: "Acide gras saturé (C20) naturel. Co-émulsifiant et émollient structurant, non comédogène. Peaux concernées : tous types." },

  // ─ Alias courants ─
  "2-HEXANEDIOL":                   { role: "Conservateur",     description: "Diol conservateur (alias de 1,2-Hexanediol). Actif contre bactéries et moisissures, doux. Peaux concernées : tous types." },
  "PEG":                            { role: "Humectant",        description: "Polyéthylène glycol (terme générique). Humectant et solvant courant. Non irritant aux concentrations habituelles. Peaux concernées : tous types." },
  "ETHANOL":                        { role: "Solvant",          description: "Éthanol (alcool éthylique). Solvant et antibactérien. Peut assécher l'épiderme à forte concentration. Peaux concernées : peaux sèches et sensibles." },

  // ─ Humectants supplémentaires (INCIDecoder) ─
  "FRUCTOOLIGOSACCHARIDES":         { role: "Humectant",        description: "Prébiotiques végétaux (FOS). Soutiennent le microbiome cutané et hydratent. Peaux concernées : tous types." },
  "GLUCOSE":                        { role: "Humectant",        description: "Sucre naturel. Humectant doux, water-binding. Peaux concernées : tous types." },
  "LACTOSE":                        { role: "Humectant",        description: "Sucre du lait. Humectant doux, améliore la texture. Peaux concernées : tous types." },

  // ─ Actifs populaires manquants ─
  "BENZOYL PEROXIDE":               { role: "Actif",            description: "Peroxyde de benzoyle. Anti-acné puissant : détruit C. acnes et kératolytique. Peut irriter et décolorer les textiles — introduire progressivement. Peaux concernées : peaux acnéiques." },
  "HYDROQUINONE":                   { role: "Dépigmentant",     description: "Dépigmentant de référence médicale. Inhibe la tyrosinase. Soumis à prescription en Europe. Peaux concernées : hyperpigmentation sévère et mélasma." },
  "MELALEUCA ALTERNIFOLIA LEAF OIL": { role: "Actif",           description: "Huile essentielle d'arbre à thé. Anti-bactérienne, anti-fongique et anti-inflammatoire. Doit être diluée — irritante pure. Peaux concernées : peaux acnéiques." },
  "ARTEMISIA VULGARIS EXTRACT":     { role: "Apaisant",         description: "Extrait d'armoise (mugwort). Apaisant et antioxydant. Populaire dans la K-beauty pour les peaux sensibles. Peaux concernées : peaux sensibles et irritées." },
  "GALACTOMYCES FERMENT FILTRATE":  { role: "Actif",            description: "Filtrat de fermentation de levure Galactomyces. Éclairant, resserre les pores et renforce la barrière. Popularisé par la K-beauty. Peaux concernées : tous types, idéal peaux grasses et ternes." },
  "SNAIL SECRETION FILTRATE":       { role: "Actif",            description: "Filtrat de bave d'escargot. Hydratant, cicatrisant et anti-âge. Riche en allantoïne, glycoprotéines et hyaluronique. Peaux concernées : tous types." },
  "PANAX GINSENG ROOT EXTRACT":     { role: "Antioxydant",      description: "Extrait de ginseng rouge (racine). Antioxydant puissant, stimule le métabolisme cellulaire et l'éclat. Peaux concernées : peaux matures et ternes." },
  "PROPOLIS EXTRACT":               { role: "Actif",            description: "Propolis (résine d'abeille). Anti-bactérien naturel, cicatrisant et antioxydant. Peaux concernées : peaux acnéiques et sensibles." },
  "PROPOLIS":                       { role: "Actif",            description: "Propolis (résine d'abeille). Anti-bactérien naturel, cicatrisant et antioxydant. Peaux concernées : peaux acnéiques et sensibles." },

  // ─ Silicones supplémentaires ─
  "CAPRYLYL METHICONE":             { role: "Émollient",        description: "Silicone légère à chaîne capryloyl. Texture sèche, non grasse, excellente glisse. Non comédogène. Peaux concernées : tous types." },
  "POLYMETHYLSILSESQUIOXANE":       { role: "Texturant",        description: "Résine silicone en poudre microsphérique. Lisse les rides de surface et matifie. Toucher poudré. Peaux concernées : tous types." },
  "VINYL DIMETHICONE":              { role: "Émollient",        description: "Silicone vinylique réticulante. Agent de texture filmogène, améliore la douceur et la tenue. Non comédogène. Peaux concernées : tous types." },

  // ─ Alcools gras C14-22 ─
  "C14-22 ALCOHOLS":                { role: "Émollient",        description: "Mélange d'alcools gras (myristylique à béhénylique). Émollient structurant, texturant et co-émulsifiant. Non comédogène. Peaux concernées : tous types." },

  // ─ Émulsifiants glucosidiques ─
  "C12-20 ALKYL GLUCOSIDE":         { role: "Émulsifiant",      description: "Émulsifiant non-ionique d'origine sucre (alkyl glucoside). Doux, biodégradable, Ecocert. Peaux concernées : tous types, idéal peaux sensibles." },

  // ─ Polymères conditionneurs ─
  "POLYQUATERNIUM-51":              { role: "Humectant",        description: "Polymère phospholipidique (phosphorylcholine). Biomimétique de la membrane cellulaire. Hydratant intense et filmogène sans sensation étouffante. Peaux concernées : tous types, idéal peaux déshydratées." },

  // ─ Actifs végétaux rares ─
  "COPTIS JAPONICA ROOT EXTRACT":   { role: "Antioxydant",      description: "Extrait de rhizome de coptide du Japon. Riche en berbérine : antioxydant, antibactérien et anti-inflammatoire. Peaux concernées : peaux acnéiques et ternes." },
  "TANNIC ACID":                    { role: "Antioxydant",      description: "Acide tannique (tanin végétal). Astringent, antioxydant et antibactérien. Resserre les pores. Peaux concernées : peaux grasses et acnéiques." },

  // ─ ADN / biotechnologie ─
  "SODIUM DNA":                     { role: "Actif",            description: "ADN de sodium (sodium désoxyribonucléate). Réparateur cellulaire, hydratant filmogène. Favorise la régénération de la barrière cutanée. Peaux concernées : peaux matures, fragilisées et sèches." },

  // ─ Eaux florales / distillats ─
  "CENTELLA ASIATICA LEAF WATER":   { role: "Apaisant",         description: "Eau de distillation de centella (CICA). Apaisante, anti-inflammatoire douce. Peaux concernées : peaux sensibles et irritées." },
  "CAMELLIA SINENSIS LEAF WATER":   { role: "Antioxydant",      description: "Eau de distillation de thé vert. Antioxydante et tonifiante. Peaux concernées : tous types, idéal peaux ternes." },
  "MELALEUCA ALTERNIFOLIA LEAF WATER": { role: "Antibactérien", description: "Eau de distillation d'arbre à thé. Antibactérienne douce, moins irritante que l'huile essentielle. Peaux concernées : peaux acnéiques." },

  // ─ Acide hyaluronique hydrolysé ─
  "HYDROLYZED HYALURONIC ACID":     { role: "Humectant",        description: "Acide hyaluronique fragmenté (faible poids moléculaire). Pénètre dans les couches suprabasales. Complément du HA standard pour une hydratation multi-niveaux. Peaux concernées : tous types." },

  // ─ Agents conditionneurs cationiques ─
  "BEHENTRIMONIUM CHLORIDE":        { role: "Émulsifiant",      description: "Tensioactif cationique (ammonium quaternaire C22). Conditionneur et émulsifiant, lisse et démêle. Très utilisé dans les soins capillaires et crèmes riches. Peaux concernées : tous types." },

  // ─ Huiles végétales supplémentaires ─
  "RICINUS COMMUNIS SEED OIL":      { role: "Émollient",        description: "Huile de ricin. Riche en acide ricinoléique (90%), très filmogène et occlusif. Épaissit les formules. Légèrement comédogène (1/5). Peaux concernées : tous types sauf peaux très acnéiques en formule épaisse." },
  "MAURITIA FLEXUOSA FRUIT OIL":    { role: "Émollient",        description: "Huile de buriti (palmier amazonie). Exceptionnellement riche en bêta-carotène et acides oléique/palmitique. Antioxydante, régénérante et protectrice solaire naturelle. Peaux concernées : tous types, idéal peaux matures et sèches." },

  // ─ Protéines hydrolysées ─
  "HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL": { role: "Actif", description: "Protéine végétale hydrolysée greffée silicone. Filmogène, renforce la cohésion des fibres capillaires et la barrière cutanée. Peaux concernées : tous types, idéal peau fragilisée." },
  "HYDROLYZED RICE PROTEIN":        { role: "Actif",            description: "Protéine de riz hydrolysée. Filmogène légère, lisse la surface et renforce la barrière. Volume et éclat. Peaux concernées : tous types." },

  // ─ Extraits végétaux supplémentaires ─
  "TRIFOLIUM PRATENSE FLOWER EXTRACT": { role: "Antioxydant",   description: "Extrait de fleurs de trèfle rouge. Riche en isoflavones (formonétine, biochaïnine A). Antioxydant et soutien à la densité cutanée. Peaux concernées : peaux matures." },
  "MENTHA PIPERITA LEAF EXTRACT":   { role: "Actif",            description: "Extrait de feuilles de menthe poivrée. Rafraîchissant, antiseptique léger et stimulant de la microcirculation. Peut piquer sur peaux très sensibles. Peaux concernées : peaux grasses et acnéiques." },

  // ─ Peptides capillaires / anti-chute ─
  "ACETYL TETRAPEPTIDE-3":          { role: "Actif",            description: "Tétrapeptide acétylé. Stimule l'ancrage des follicules pileux en boostant les protéines de la matrice extracellulaire. Actif anti-chute et densifiant. Peaux concernées : cuir chevelu." },

  // ─ Vitamines sous forme acide ─
  "NIACIN":                         { role: "Actif",            description: "Niacine (vitamine B3, acide nicotinique). Précurseur du nicotinamide. À forte concentration, vasodilatateur local (flush). Distincts de la niacinamide — moins utilisé en topique. Peaux concernées : tous types." },

  // ─ Polysaccharides filmogènes ─
  "DEXTRAN":                        { role: "Humectant",        description: "Polysaccharide (glucose). Filmogène hydrophile, volumisant en capillaire. Hydratant de surface, améliore la texture. Peaux concernées : tous types." },

  // ─ Colorants naturels ─
  "CARAMEL":                        { role: "Colorant",         description: "Colorant alimentaire (sucre caramélisé, E150). Teinte brun/dorée dans les formules. Utilisé à très faibles doses. Peaux concernées : tous types." },

  // ─ Régulateurs pH naturels ─
  "VINEGAR":                        { role: "Régulateur pH",    description: "Vinaigre (acide acétique dilué). Acidifie légèrement les formules, propriétés antimicrobiennes douces. Peaux concernées : tous types." },

  // ─ Filtres UV ─
  "DIETHYLHEXYL BUTAMIDO TRIAZONE": { role: "Filtre UV",        description: "Uvasorb HEB : filtre UVB très photostable et à faible pénétration cutanée. Bien toléré, souvent combiné aux filtres UVA. Peaux concernées : tous types." },

  // ─ Émollients ─
  "BUTYLOCTYL SALICYLATE":          { role: "Émollient",        description: "Ester salicylique utilisé comme émollient léger et booster de SPF. Améliore la stabilité des filtres UVA. Peaux concernées : tous types, y compris peaux grasses." },
  "C12-C15 ALKYL BENZOATE":         { role: "Émollient",        description: "Ester synthétique léger (C12-C15 Alkyl Benzoate). Texture sèche, non comédogène, bonne glisse sur la peau. Souvent dans les SPF et les crèmes légères. Peaux concernées : tous types." },
  "HYDROGENATED VEGETABLE GLYCERIDES": { role: "Émollient",     description: "Glycérides végétaux hydrogénés. Émollient riche issus d'huiles végétales. Structure la formule, adoucit et nourrit. Peaux concernées : tous types, idéal peaux sèches." },

  // ─ Humectants ─
  "METHYL GLUCETH-20":              { role: "Humectant",        description: "Dérivé méthylé du polyéthylène glycol de glucose. Humectant doux et filmogène. Compatible peaux sensibles. Peaux concernées : tous types." },

  // ─ Texturants ─
  "ALUMINA":                        { role: "Texturant",        description: "Oxyde d'aluminium (Al₂O₃). Abrasif doux, opacifiant et stabilisateur de formule. Non irritant aux doses cosmétiques. Peaux concernées : tous types." },
  "TRIACONTANYL PVP":               { role: "Texturant",        description: "Copolymère PVP-triacontanol, filmogène. Améliore la tenue et la résistance à l'eau des formules SPF. Peaux concernées : tous types." },

  // ─ Émulsifiants ─
  "POLYGLYCERYL-2 CAPRATE":         { role: "Émulsifiant",      description: "Émulsifiant polyglycérol doux, origine végétale. Bien toléré, non irritant. Peaux concernées : tous types, idéal peaux sensibles." },

  // ─ Antioxydants ─
  "TOCOPHERYL PHOSPHATE DIPOTASSIUM SALT": { role: "Antioxydant", description: "Phosphate de tocophérol (sel dipotassique). Forme hydrosoluble de la vitamine E, très stable. Antioxydant et protecteur cellulaire. Peaux concernées : tous types." },

  // ─ Antibactériens ─
  "OCTENIDINE":                     { role: "Antibactérien",    description: "Octénidine HCl. Antiseptique très efficace contre bactéries et levures, utilisé en dermato médicale. Conservateur de plus en plus présent dans les soins clean. Peaux concernées : tous types." },
  // Cires & texturants
  "BEESWAX":                        { role: "Épaississant",     description: "Cire d'abeille jaune naturelle. Structurante, filmogène, légèrement émolliente. Peaux concernées : tous types." },
  // Minéraux / sels
  "COPPER SULFATE":                 { role: "Conservateur",     description: "Sulfate de cuivre. Trace minérale antibactérienne et antifongique, conservateur auxiliaire à faible concentration. Peaux concernées : tous types." },
  "MAGNESIUM STEARATE":             { role: "Texturant",        description: "Sel de magnésium de l'acide stéarique. Lubrifiant et agent de glissement dans les formules poudrées. Peaux concernées : tous types." },
  "MAGNESIUM SULFATE":              { role: "Régulateur pH",    description: "Sel d'Epsom (MgSO4). Électrolyte et régulateur osmotique dans les émulsions, améliore la stabilité. Bien toléré. Peaux concernées : tous types." },
  "ZINC SULFATE":                   { role: "Sébo-régulateur",  description: "Sulfate de zinc. Astringent minéral léger, contribue à la régulation du sébum et aux propriétés apaisantes. Peaux concernées : peaux grasses, acnéiques." },
  "ALUMINUM STEARATE":              { role: "Texturant",        description: "Sel d'aluminium de l'acide stéarique. Gélifiant et stabilisant d'émulsion lipophile, agent suspensif. Peaux concernées : tous types." },
  // Émollients
  "HYDROGENATED VEGETABLE OIL":     { role: "Émollient",        description: "Huile végétale hydrogénée (générique). Émollient riche à texture structurante. Adoucit et nourrit la peau. Peaux concernées : tous types, idéal peaux sèches." },
  // Émulsifiants PEG
  "PEG-22/DODECYL GLYCOL COPOLYMER": { role: "Émulsifiant",     description: "Copolymère PEG-22 / glycol dodécylique. Émulsifiant et stabilisant d'émulsions huile-dans-eau. Peaux concernées : tous types." },
  "POLYGLYCERYL-2 SESQUIISOSTEARATE": { role: "Émulsifiant",    description: "Émulsifiant polyglycérol d'origine végétale. Doux, stabilise les émulsions eau-dans-huile. Peaux concernées : tous types, idéal peaux sensibles." },
  // Actifs propriétaires
  "AVENE AQUA":                     { role: "Apaisant",         description: "Eau thermale d'Avène. Riche en silicates et calcium, apaise les peaux réactives et réduisent les démangeaisons. Peaux concernées : peaux sensibles, réactives, atopiques." },
  "AQUAPHILUS DOLOMIAE FERMENT FILTRATE": { role: "Apaisant",   description: "Filtrat de fermentation d'Aquaphilus dolomiae, micro-organisme isolé de l'eau thermale d'Avène. Renforce la barrière cutanée et apaise les peaux réactives. Peaux concernées : peaux sensibles, atopiques." },
};

// ─── V2 : Analyse multi-baromètres ────────────────────────────────────────────

export type SkinProfile = {
  skinType?: "normale" | "grasse" | "seche" | "mixte" | "sensible";
  acneTypes?: string[];
  intensity?: "legere" | "moderee" | "severe";
};

export type Barometer = { score: number; label: "Faible" | "Modéré" | "Élevé" };

export type AnalysisResultV2 = {
  ingredients: AnalyzedIngredient[];
  barometers: { irritation: Barometer; comedogenic: Barometer; pe: Barometer };
  productType: "Nettoyant" | "Tonique" | "Crème/Huile" | null;
  usageReco: "daily" | "occasional" | "caution" | "avoid";
  skinProfileUsed: boolean;
  edHighCount: number; edMediumCount: number; allergenCount: number;
  irritantCount: number; petrochemCount: number; comedogenicCount: number;
};

// ─── Rôles fonctionnels des ingrédients signalés ─────────────────────────────
// Maps normalized INCI key → functional role (for UI categorization)
export const FUNCTIONAL_ROLES: Record<string, string> = {
  // ─ Irritants ─
  "SODIUM LAURYL SULFATE":        "Tensioactif",
  "SODIUM DODECYL SULFATE":       "Tensioactif",
  "SODIUM LAURETH SULFATE":       "Tensioactif",
  "AMMONIUM LAURYL SULFATE":      "Tensioactif",
  "AMMONIUM LAURETH SULFATE":     "Tensioactif",
  "ALCOHOL DENAT":                "Solvant",
  "SD ALCOHOL":                   "Solvant",
  "ISOPROPYL ALCOHOL":            "Solvant",
  "SODIUM CHLORIDE":              "Texturant",

  // ─ Allergènes — molécules parfumantes ─
  "PARFUM":                       "Parfum",
  "FRAGRANCE":                    "Parfum",
  "LIMONENE":                     "Parfum",
  "LINALOOL":                     "Parfum",
  "CITRAL":                       "Parfum",
  "CITRONELLOL":                  "Parfum",
  "GERANIOL":                     "Parfum",
  "EUGENOL":                      "Parfum",
  "FARNESOL":                     "Parfum",
  "COUMARIN":                     "Parfum",
  "CINNAMALDEHYDE":               "Parfum",
  "CINNAMYL ALCOHOL":             "Parfum",
  "HEXYL CINNAMAL":               "Parfum",
  "AMYL CINNAMAL":                "Parfum",
  "AMYLCINNAMYL ALCOHOL":         "Parfum",
  "BENZYL SALICYLATE":            "Parfum",
  "BENZYL CINNAMATE":             "Parfum",
  "BENZYL BENZOATE":              "Parfum",
  "ISOEUGENOL":                   "Parfum",
  "HYDROXYCITRONELLAL":           "Parfum",
  "METHYL 2-OCTYNOATE":           "Parfum",
  "ANISE ALCOHOL":                "Parfum",
  "ALPHA-ISOMETHYL IONONE":       "Parfum",
  "BUTYLPHENYL METHYLPROPIONAL":  "Parfum",
  "LILIAL":                       "Parfum",
  "HYDROXYISOHEXYL 3-CYCLOHEXENE CARBOXALDEHYDE": "Parfum",
  "HICC":                         "Parfum",
  "BENZYL ALCOHOL":               "Conservateur",
  "HYDROXYMETHYLPENTYLCYCLOHEXENECARBOXALDEHYDE": "Parfum",
  "METHYL HEPTINE CARBONATE":     "Parfum",
  "METHYL OCTINE CARBONATE":      "Parfum",
  "TREEMOSS":                     "Parfum",
  "OAKMOSS":                      "Parfum",
  "SANTALOL":                     "Parfum",
  "COSTUS ROOT":                  "Parfum",
  "PERU BALSAM":                  "Parfum",
  "MYROXYLON PEREIRAE":           "Parfum",
  "YLANG YLANG OIL":              "Parfum",
  "JASMINE":                      "Parfum",
  "JASMIN ABSOLUTE":              "Parfum",
  "ROSE FLOWER OIL":              "Parfum",
  "CANANGA ODORATA":              "Parfum",
  "NARCISSUS POETICUS":           "Parfum",
  "ATRANORIN":                         "Parfum",
  "CHLOROATRANORIN":                   "Parfum",
  "HEXAMETHYLINDANOPYRAN":             "Parfum",
  "TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES": "Parfum",
  "TRIMETHYLBENZENEPROPANOL":          "Parfum",
  "LINALYL ACETATE":                   "Parfum",
  "TERPINEOL":                         "Parfum",

  // ─ Perturbateurs endocriniens ─
  "BENZOPHENONE-3":               "Filtre UV",
  "OXYBENZONE":                   "Filtre UV",
  "HOMOSALATE":                   "Filtre UV",
  "ETHYLHEXYL METHOXYCINNAMATE":  "Filtre UV",
  "OCTINOXATE":                   "Filtre UV",
  "OCTYL METHOXYCINNAMATE":       "Filtre UV",
  "4-METHYLBENZYLIDENE CAMPHOR":  "Filtre UV",
  "BENZOPHENONE-4":               "Filtre UV",
  "SULISOBENZONE":                "Filtre UV",
  "ETHYLHEXYL DIMETHYL PABA":     "Filtre UV",
  "OCTYL DIMETHYL PABA":          "Filtre UV",
  "DROMETRIZOLE TRISILOXANE":     "Filtre UV",
  "BUTYLPARABEN":                 "Conservateur",
  "ISOBUTYLPARABEN":              "Conservateur",
  "PROPYLPARABEN":                "Conservateur",
  "ISOPROPYLPARABEN":             "Conservateur",
  "METHYLPARABEN":                "Conservateur",
  "ETHYLPARABEN":                 "Conservateur",
  "BENZYLPARABEN":                "Conservateur",
  "TRICLOSAN":                    "Antibactérien",
  "TRICLOCARBAN":                 "Antibactérien",
  "DIETHYL PHTHALATE":            "Solvant",
  "DIBUTYL PHTHALATE":            "Solvant",
  "DIISOBUTYL PHTHALATE":         "Solvant",
  "BHA":                          "Antioxydant",
  "BUTYLATED HYDROXYANISOLE":     "Antioxydant",
  "RESORCINOL":                   "Actif",
  "KOJIC ACID":                   "Actif",
  "P-PHENYLENEDIAMINE":           "Colorant",
  "CYCLOTETRASILOXANE":           "Solvant",
  "CYCLOPENTASILOXANE":           "Solvant",
  "MUSK AMBRETTE":                "Parfum",
  "MUSK TIBETENE":                "Parfum",
  "MUSK MOSKENE":                 "Parfum",

  // ─ Pétrochimiques ─
  "PARAFFINUM LIQUIDUM":          "Émollient",
  "PETROLATUM":                   "Émollient",
  "MINERAL OIL":                  "Émollient",
  "VASELINE":                     "Émollient",
  "POLYISOBUTENE":                "Émollient",
  "HYDROGENATED POLYISOBUTENE":   "Émollient",
  "POLYBUTENE":                   "Émollient",
  "POLYDECENE":                   "Émollient",
  "HYDROGENATED POLYDECENE":      "Émollient",
  "ISOEICOSANE":                  "Émollient",
  "ISOHEXADECANE":                "Solvant",
  "ISODODECANE":                  "Solvant",
  "NAPHTHA":                      "Solvant",
  "CERA MICROCRISTALLINA":        "Épaississant",
  "MICROCRYSTALLINE WAX":         "Épaississant",
  "OZOKERITE":                    "Épaississant",
  "CERESIN":                      "Épaississant",
  "PARAFFIN":                     "Épaississant",
  "SYNTHETIC WAX":                "Épaississant",

  // ─ Comédogènes (non couverts par COMMON_INGREDIENTS) ─
  "ISOPROPYL MYRISTATE":          "Émollient",
  "ISOPROPYL PALMITATE":          "Émollient",
  "MYRISTYL MYRISTATE":           "Émollient",
  "OCTYL STEARATE":               "Émollient",
  "ETHYLHEXYL PALMITATE":         "Émollient",
  "OCTYL PALMITATE":              "Émollient",
  "DECYL OLEATE":                 "Émollient",
  "ISOPROPYL ISOSTEARATE":        "Émollient",
  "ISOSTEARYL NEOPENTANOATE":     "Émollient",
  "BUTYL STEARATE":               "Émollient",
  "CETYL ACETATE":                "Émollient",
  "POLYGLYCERYL-3-DIISOSTEARATE": "Émollient",
  "LAURIC ACID":                  "Émollient",
  "MYRISTIC ACID":                "Émollient",
  "LANOLIN ALCOHOL":              "Émollient",
  "ACETYLATED LANOLIN ALCOHOL":   "Émollient",
  "LAURETH-4":                    "Tensioactif",
  "D&C RED NO. 17":               "Colorant",
  "D&C RED NO. 21":               "Colorant",
  "D&C RED NO. 27":               "Colorant",
  "COCOS NUCIFERA OIL":           "Émollient",
  "COCOS NUCIFERA FRUIT OIL":     "Émollient",
  "THEOBROMA CACAO SEED BUTTER":  "Émollient",
  "WHEAT GERM OIL":               "Émollient",
  "TRITICUM VULGARE GERM OIL":    "Émollient",
  "LINUM USITATISSIMUM SEED OIL": "Émollient",
};

function lookupFunctionalRole(norm: string): string | undefined {
  const key = Object.keys(FUNCTIONAL_ROLES).find((k) => matchesKey(norm, k));
  return key ? FUNCTIONAL_ROLES[key] : undefined;
}

// ─── Inférence de catégorie par pattern INCI ─────────────────────────────────
// La nomenclature INCI est standardisée : les suffixes et préfixes portent le
// rôle fonctionnel. Ce fallback couvre ~80% des ingrédients non répertoriés.
function inferRoleFromName(inci: string): { role: string; description: string } | null {
  if (/PEPTIDE/.test(inci))
    return { role: "Actif",           description: "Peptide bioactif." };
  if (/HYDROLYZED|COLLAGEN|ELASTIN/.test(inci))
    return { role: "Actif",           description: "Protéine ou polymère bioactif hydrolysé." };
  if (/FERMENT|FILTRATE/.test(inci))
    return { role: "Actif",           description: "Filtrat de fermentation ou biotechnologie." };
  if (/CONE$|CONOL$|SILOXANE$|SILSESQUIOXANE$/.test(inci))
    return { role: "Émollient",       description: "Silicone ou dérivé silicié." };
  if (/\bOIL$/.test(inci))
    return { role: "Émollient",       description: "Huile végétale ou minérale." };
  if (/BUTTER$/.test(inci))
    return { role: "Émollient",       description: "Beurre végétal." };
  if (/ALCOHOL$/.test(inci))
    return { role: "Émollient",       description: "Alcool gras émollient." };
  if (/FLOWER WATER$|LEAF WATER$|PETAL WATER$|BLOSSOM WATER$/.test(inci))
    return { role: "Apaisant",        description: "Eau florale ou hydrolat." };
  if (/WATER$/.test(inci))
    return { role: "Solvant",         description: "Eau ou distillat aqueux." };
  if (/EXTRACT$|EXTRACTUM$/.test(inci))
    return { role: "Antioxydant",     description: "Extrait végétal ou marin." };
  if (/WAX$/.test(inci) || /\bCERA\b/.test(inci))
    return { role: "Épaississant",    description: "Cire naturelle ou synthétique." };
  if (/STARCH$/.test(inci))
    return { role: "Épaississant",    description: "Amidon végétal texturant." };
  if (/GLUCOSIDE$/.test(inci))
    return { role: "Émulsifiant",     description: "Tensioactif glucosidique doux." };
  if (/GLYCOL$/.test(inci))
    return { role: "Humectant",       description: "Glycol — humectant et solvant." };
  if (/SULFATE$|SULPHATE$|SULFOSUCCINATE$/.test(inci))
    return { role: "Tensioactif",     description: "Tensioactif anionique." };
  if (/BETAINE$/.test(inci))
    return { role: "Tensioactif",     description: "Tensioactif amphotère doux." };
  if (/ACID$/.test(inci))
    return { role: "Actif",           description: "Acide actif ou régulateur de pH." };
  if (/^CI \d+/.test(inci))
    return { role: "Colorant",        description: "Colorant cosmétique (numéro CI)." };
  if (/QUATERNIUM|POLYQUATERNIUM/.test(inci))
    return { role: "Conditionneur",   description: "Agent conditionneur quaternaire." };
  if (/CHLORIDE$/.test(inci))
    return { role: "Émulsifiant",     description: "Agent conditionneur ou émulsifiant ionique." };
  if (/PHOSPHATE$|CARBONATE$|HYDROXIDE$/.test(inci))
    return { role: "Régulateur pH",   description: "Régulateur de pH minéral." };
  if (/TRIAZINE$|TRIAZONE$/.test(inci))
    return { role: "Filtre UV",       description: "Filtre UV photostable (triazine ou triazone)." };
  if (/PVP$|POLYVINYLPYRROLIDONE$/.test(inci))
    return { role: "Texturant",       description: "Polymère PVP filmogène — stabilisateur et modificateur de texture." };
  if (/^POLYGLYCERYL/.test(inci))
    return { role: "Émulsifiant",     description: "Émulsifiant polyglycérol d'origine végétale, doux." };
  if (/GLUCETH/.test(inci))
    return { role: "Humectant",       description: "Dérivé éthoxylé du glucose — humectant filmogène doux." };
  if (/BENZOATE$/.test(inci))
    return { role: "Émollient",       description: "Ester benzoate — émollient léger à texture sèche." };
  if (/^GLYCERETH/.test(inci))
    return { role: "Humectant",       description: "Éther PEG de glycérine — humectant et solubilisant doux." };
  if (/CELL CULTURE|CALLUS CULTURE|STEM CELL|MERISTEM|LYSATE$/.test(inci))
    return { role: "Actif",           description: "Biotechnologie végétale (cellules souches ou lysat de culture)." };
  if (/FLOUR$|POWDER$/.test(inci))
    return { role: "Texturant",       description: "Poudre végétale — texturant et agent de glissement." };
  if (/GALLATE$/.test(inci))
    return { role: "Antioxydant",     description: "Ester gallique — antioxydant et conservateur." };
  if (/^ASCORBYL/.test(inci))
    return { role: "Actif",           description: "Dérivé stable de la vitamine C — antioxydant et dépigmentant." };
  if (/ESTERS$/.test(inci))
    return { role: "Émollient",       description: "Esters cireux — émollients à texture sèche ou grasse." };
  if (/ANHYDRO|XYLITOL$|SORBITOL$|MANNITOL$/.test(inci))
    return { role: "Humectant",       description: "Sucre-alcool — humectant filmogène doux." };
  if (/PROPANEDIOL$/.test(inci))
    return { role: "Solvant",         description: "Propanediol — solvant et humectant léger, bonne tolérance." };
  if (/^SODIUM LAUR|^POTASSIUM LAUR|^SODIUM MYRIST|LAURATE$|MYRISTATE$/.test(inci))
    return { role: "Tensioactif",     description: "Sel de savon — tensioactif doux d'origine naturelle." };
  if (/CYCLODEXTRIN/.test(inci))
    return { role: "Texturant",       description: "Cyclodextrine — agent d'encapsulation et de solubilisation." };
  if (/COPOLYMER$/.test(inci))
    return { role: "Texturant",       description: "Copolymère filmogène — modificateur de texture et stabilisant." };
  if (/GLYCOLIPID/.test(inci))
    return { role: "Barrière",        description: "Glycolipide — lipide de barrière identique à la peau." };
  if (/MALTODEXTRIN$/.test(inci))
    return { role: "Texturant",       description: "Maltodextrine — texturant filmogène d'origine amidonnée." };
  if (/COBALAMIN/.test(inci))
    return { role: "Actif",           description: "Vitamine B12 — antioxydant et actif réparateur." };
  if (/RESIN$/.test(inci))
    return { role: "Émollient",       description: "Résine végétale — émolliente et filmogène." };
  if (/^COPAIFERA/.test(inci))
    return { role: "Émollient",       description: "Résine de copaïba — émolliente et anti-inflammatoire." };
  if (/^CARNOSINE$/.test(inci))
    return { role: "Antioxydant",     description: "Dipeptide naturel (beta-alanine + histidine) — antioxydant et anti-glycation." };
  if (/SACCHARIDE|OLIGOSACCHARIDE/.test(inci))
    return { role: "Humectant",       description: "Saccharide — humectant et prébiotique cutané." };
  if (/CERAMIDE/.test(inci))
    return { role: "Barrière",        description: "Céramide — lipide de barrière identique à la peau, hydratant profond." };
  if (/PALMITOYL|ACETYL HEXAPEPTIDE|MATRIXYL/.test(inci))
    return { role: "Actif",           description: "Peptide signal — stimule le collagène et la réparation cutanée." };
  if (/\bESTER\b/.test(inci))
    return { role: "Émollient",       description: "Ester — émollient ou solubilisant." };
  return null;
}

const SURFACTANT_KEYS = new Set([
  "SODIUM LAURYL SULFATE", "SODIUM DODECYL SULFATE",
  "SODIUM LAURETH SULFATE", "AMMONIUM LAURYL SULFATE", "AMMONIUM LAURETH SULFATE",
]);
const ALCOHOL_DENAT_KEYS = new Set(["ALCOHOL DENAT", "SD ALCOHOL"]);

function posWeight(index: number): number {
  if (index < 3)  return 2.0;
  if (index < 10) return 1.2;
  return 0.8;
}

function makeBarometer(score: number): Barometer {
  return { score, label: score <= 3 ? "Faible" : score <= 6 ? "Modéré" : "Élevé" };
}

export const INGREDIENT_ROLES = [
  "Actif", "Humectant", "Émollient", "Solvant", "Tensioactif",
  "Conservateur", "Texturant", "Apaisant", "Antioxydant",
  "Filtre UV", "Barrière cutanée", "Exfoliant", "Colorant",
  "Épaississant", "Émulsifiant", "Filmogène",
] as const;

export function analyzeIngredientsV2(raw: string, profile?: SkinProfile, customIngredients?: Map<string, string>): AnalysisResultV2 {
  const tokens = raw.split(/(?<!\d),(?!\d)|\n|(?<!\d)\.\s+/).map((t) => stripQuantity(t.trim().replace(/\.$/, ""))).filter(Boolean);

  const ingredients: AnalyzedIngredient[] = tokens.map((token) => {
    const norm = translateToInci(normalize(token));

    const edKey = Object.keys(ENDOCRINE_DISRUPTORS).find((k) => matchesKey(norm, k));
    if (edKey) {
      const entry = ENDOCRINE_DISRUPTORS[edKey];
      return { raw: token, normalized: norm, flag: entry.severity === "high" ? "ed_high" : "ed_medium", reason: entry.reason, description: entry.description, role: lookupFunctionalRole(norm) ?? inferRoleFromName(norm)?.role };
    }

    const allergenKey = Object.keys(ALLERGENS).find((k) => matchesKey(norm, k));
    if (allergenKey) {
      const entry = ALLERGENS[allergenKey];
      return { raw: token, normalized: norm, flag: "allergen", euMandatory: entry.euMandatory, description: entry.description, role: lookupFunctionalRole(norm) ?? inferRoleFromName(norm)?.role };
    }

    const irritantKey = Object.keys(IRRITANTS).find((k) => matchesKey(norm, k));
    if (irritantKey) {
      const entry = IRRITANTS[irritantKey];
      return { raw: token, normalized: norm, flag: "irritant", reason: entry.reason, description: entry.description, role: lookupFunctionalRole(norm) ?? inferRoleFromName(norm)?.role };
    }

    const petroKey = Object.keys(PETROCHEMICALS).find((k) => matchesKey(norm, k));
    if (petroKey) {
      const entry = PETROCHEMICALS[petroKey];
      return { raw: token, normalized: norm, flag: "petrochem", description: entry.description, role: lookupFunctionalRole(norm) ?? inferRoleFromName(norm)?.role };
    }

    const comedoKey = Object.keys(COMEDOGENIC_INGREDIENTS).find((k) => matchesKey(norm, k));
    if (comedoKey) {
      const entry = COMEDOGENIC_INGREDIENTS[comedoKey];
      if (entry.rating >= 3) {
        const commonKeyForComedo = Object.keys(COMMON_INGREDIENTS).find((k) => matchesKey(norm, k));
        const role = commonKeyForComedo ? COMMON_INGREDIENTS[commonKeyForComedo].role : (lookupFunctionalRole(norm) ?? inferRoleFromName(norm)?.role);
        return { raw: token, normalized: norm, flag: "comedogenic", reason: `Comédogène — indice ${entry.rating}/5`, description: entry.description, comedogenicRating: entry.rating, role };
      }
      // Rating 1–2 : not flagged, fall through to COMMON_INGREDIENTS for description
    }

    const commonKey = Object.keys(COMMON_INGREDIENTS).find((k) => matchesKey(norm, k));
    if (commonKey) {
      const entry = COMMON_INGREDIENTS[commonKey];
      return { raw: token, normalized: norm, flag: "ok", description: `${entry.role} — ${entry.description}`, role: entry.role };
    }

    // Fallback: scraped INCIDecoder DB (267 entries, role_fr only — no curated FR description)
    const dbEntry = INCI_DB.get(norm);
    if (dbEntry?.role_fr) {
      return { raw: token, normalized: norm, flag: "ok", role: dbEntry.role_fr };
    }

    // Custom admin-classified ingredients (stored in Firestore, no deploy needed)
    const customRole = customIngredients?.get(norm);
    if (customRole) {
      return { raw: token, normalized: norm, flag: "ok", role: customRole };
    }

    const inferred = inferRoleFromName(norm);
    return { raw: token, normalized: norm, flag: "ok", role: inferred?.role, description: inferred?.description ?? "Ingrédient non répertorié dans nos bases de données. Peaux concernées : tous types." };
  });

  // Scores bruts pondérés par position
  let irritationRaw = 0;
  let peRaw = 0;
  let comedogenicRaw = 0;

  ingredients.forEach((ing, i) => {
    const w = posWeight(i);
    if (ing.flag === "irritant") {
      const key = Object.keys(IRRITANTS).find((k) => ing.normalized === k || ing.normalized.includes(k));
      irritationRaw += (key ? IRRITANTS[key].irritationLevel : 1) * w;
    }
    if (ing.flag === "ed_high")   peRaw += 3 * w;
    if (ing.flag === "ed_medium") peRaw += 1.5 * w;
    if (ing.flag === "comedogenic" && ing.comedogenicRating) {
      const r = ing.comedogenicRating;
      comedogenicRaw += (r >= 5 ? 3 : r === 4 ? 2 : r === 3 ? 1.5 : 0.5) * w;
    }
  });

  // Normalisation 0-10
  let irritationScore  = Math.min(Math.round((irritationRaw  / 12) * 10), 10);
  let peScore          = Math.min(Math.round((peRaw          /  9) * 10), 10);
  let comedogenicScore = Math.min(Math.round((comedogenicRaw /  9) * 10), 10);

  // Pondération profil peau
  let skinProfileUsed = false;
  if (profile) {
    const isOily        = profile.skinType === "grasse";
    const hasAcneComedo = profile.acneTypes?.some((t) => ["comedons", "microkystes"].includes(t)) ?? false;
    const isSensitive   = profile.skinType === "sensible";
    const isSevere      = profile.intensity === "severe";
    const hasCysts      = profile.acneTypes?.includes("kystes") ?? false;

    if (isOily || hasAcneComedo) {
      comedogenicScore = Math.min(Math.round(comedogenicScore * 1.4), 10);
      skinProfileUsed = true;
    }
    if (isSensitive || isSevere) {
      irritationScore = Math.min(Math.round(irritationScore * 1.4), 10);
      skinProfileUsed = true;
    }
    if (hasCysts) {
      peScore = Math.min(Math.round(peScore * 1.2), 10);
      skinProfileUsed = true;
    }

    const isDry   = profile.skinType === "seche";
    const isMixed = profile.skinType === "mixte";
    if (isDry) {
      irritationScore = Math.min(Math.round(irritationScore * 1.2), 10);
      skinProfileUsed = true;
    }
    if (isMixed) {
      comedogenicScore = Math.min(Math.round(comedogenicScore * 1.1), 10);
      skinProfileUsed = true;
    }
  }

  // Détection type produit
  const top10 = ingredients.slice(0, 10);
  const top5  = ingredients.slice(0, 5);
  let productType: AnalysisResultV2["productType"] = null;
  if (top10.some((i) => SURFACTANT_KEYS.has(i.normalized)))         productType = "Nettoyant";
  else if (top5.some((i) => ALCOHOL_DENAT_KEYS.has(i.normalized))) productType = "Tonique";
  else if (top5.filter((i) => i.flag === "comedogenic").length >= 3) productType = "Crème/Huile";

  // Recommandation d'usage
  const maxScore = Math.max(irritationScore, comedogenicScore, peScore);
  const usageReco: AnalysisResultV2["usageReco"] =
    maxScore >= 10 ? "avoid" : maxScore >= 7 ? "caution" : maxScore >= 4 ? "occasional" : "daily";

  const edHighCount      = ingredients.filter((i) => i.flag === "ed_high").length;
  const edMediumCount    = ingredients.filter((i) => i.flag === "ed_medium").length;
  const allergenCount    = ingredients.filter((i) => i.flag === "allergen").length;
  const irritantCount    = ingredients.filter((i) => i.flag === "irritant").length;
  const petrochemCount   = ingredients.filter((i) => i.flag === "petrochem").length;
  const comedogenicCount = ingredients.filter((i) => i.flag === "comedogenic").length;

  return {
    ingredients,
    barometers: {
      irritation:   makeBarometer(irritationScore),
      comedogenic:  makeBarometer(comedogenicScore),
      pe:           makeBarometer(peScore),
    },
    productType, usageReco, skinProfileUsed,
    edHighCount, edMediumCount, allergenCount, irritantCount, petrochemCount, comedogenicCount,
  };
}
