export type EDSeverity = "high" | "medium";
export type EDEntry = { severity: EDSeverity; reason: string; description: string };
export type AllergenEntry = { euMandatory: boolean; description: string };
export type IrritantEntry = { reason: string; description: string };
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
  "PROPYLPARABEN":               { severity: "high",   reason: "Parabène, PE avéré (SCCS 2013)",            description: "Classé PE avéré par le SCCS en 2013. Perturbe les hormones thyroïdiennes et reproductives. Peaux concernées : toutes, à éviter sur grandes surfaces cutanées." },
  "ISOPROPYLPARABEN":            { severity: "high",   reason: "Parabène, PE avéré",                        description: "Isomère du propylparaben, même niveau de risque PE. Interdit dans les produits bébé EU. Peaux concernées : toutes." },
  "METHYLPARABEN":               { severity: "medium", reason: "Parabène, activité estrogénique faible",    description: "Conservateur très répandu. Activité œstrogénique 10 000× plus faible que l'œstradiol naturel, mais bioaccumulable. Peaux concernées : toutes, surtout peaux à tendance hormonale." },
  "ETHYLPARABEN":                { severity: "medium", reason: "Parabène, activité estrogénique faible",    description: "Conservateur parabène, activité œstrogénique légère. Souvent combiné à d'autres parabènes (effet cocktail non évalué). Peaux concernées : toutes." },
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
  "CYCLOHEXASILOXANE":           { severity: "medium", reason: "Silicone cyclique D6, PE suspecté",        description: "Silicone cyclique D6, restrictions EU en cours. PE suspecté par analogie avec D4/D5. Peaux concernées : toutes." },

  // Muscs nitrés
  "MUSK AMBRETTE":               { severity: "high",   reason: "Musc nitré, PE avéré, interdit EU",        description: "Musc nitré interdit dans les cosmétiques EU. Neurotoxique, photoallergiène et PE avéré. Peaux concernées : toutes." },
  "MUSK TIBETENE":               { severity: "high",   reason: "Musc nitré, PE avéré",                     description: "Musc nitré bioaccumulable et PE avéré. Peaux concernées : toutes." },
  "MUSK MOSKENE":                { severity: "high",   reason: "Musc nitré, PE avéré",                     description: "Musc nitré interdit ou fortement restreint. Bioaccumulable, PE avéré. Peaux concernées : toutes." },

  // Autres
  "KOJIC ACID":                  { severity: "medium", reason: "PE suspecté (perturbateur thyroïdien)",     description: "Agent dépigmentant populaire contre les taches. Perturbateur thyroïdien suspecté à concentrations élevées. Limité à 1% en EU. Peaux concernées : toutes les peaux sous traitement dépigmentant prolongé." },
  "PHENOXYETHANOL":              { severity: "medium", reason: "PE suspecté, débat scientifique en cours",  description: "Conservateur courant présenté comme alternative aux parabènes. PE suspecté selon certaines études in vitro, jugé sûr par le SCCS (max 1%). Déconseillé chez les nourrissons. Peaux concernées : peaux sensibles, à utiliser avec modération." },
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
};

// ─── Irritants cutanés ────────────────────────────────────────────────────────
export const IRRITANTS: Record<string, IrritantEntry> = {
  "SODIUM LAURYL SULFATE":       { reason: "Tensioactif irritant, perturbateur de barrière cutanée", description: "SLS : tensioactif très moussant mais agressif. Détruit le film lipidique, augmente l'inflammation et déshydrate l'épiderme. Peaux concernées : peaux acnéiques, sensibles et à barrière fragilisée — à éviter dans les nettoyants visage." },
  "SODIUM DODECYL SULFATE":      { reason: "Alias du SLS — tensioactif irritant",                   description: "Alias chimique du Sodium Lauryl Sulfate. Même profil d'irritation et de perturbation de barrière. Peaux concernées : peaux acnéiques et sensibles." },
  "SODIUM LAURETH SULFATE":      { reason: "Tensioactif, peut être contaminé au 1,4-dioxane",       description: "SLES : version moins irritante du SLS, mais peut contenir du 1,4-dioxane (cancérogène possible, sous-produit de fabrication). Peaux concernées : peaux sensibles et réactives." },
  "AMMONIUM LAURYL SULFATE":     { reason: "Tensioactif irritant, similaire au SLS",                description: "Tensioactif anionique proche du SLS, même potentiel irritant. Peaux concernées : peaux acnéiques et sensibles." },
  "AMMONIUM LAURETH SULFATE":    { reason: "Tensioactif irritant",                                  description: "Version ammonium du SLES. Profil irritant similaire. Peaux concernées : peaux sensibles." },
  "ALCOHOL DENAT":               { reason: "Alcool dénaturé, assèche et peut irriter",              description: "Alcool éthylique dénaturé. À fortes concentrations, assèche l'épiderme, détruit le microbiome et peut déclencher un rebond sébacé. Peaux concernées : peaux sèches, sensibles et acnéiques." },
  "SD ALCOHOL":                  { reason: "Alcool dénaturé, assèche et peut irriter",              description: "Alias américain d'Alcohol Denat. Même profil desséchant et potentiellement irritant. Peaux concernées : peaux sèches, sensibles et acnéiques." },
  "ISOPROPYL ALCOHOL":           { reason: "Alcool irritant, perturbateur de barrière",             description: "Alcool isopropylique très astringent. Dégraisse fortement, peut déclencher un rebond sébacé. Peaux concernées : peaux acnéiques, sèches et sensibles." },
  "ISOPROPYL MYRISTATE":         { reason: "Comédogène avéré",                                      description: "Ester gras très comédogène (indice 5/5). Obstrue facilement les follicules pileux. Peaux concernées : peaux acnéiques et grasses — à éviter absolument." },
  "ISOPROPYL PALMITATE":         { reason: "Comédogène",                                            description: "Ester gras comédogène (indice 4/5). Peut boucher les pores. Peaux concernées : peaux acnéiques et grasses." },
  "MYRISTYL MYRISTATE":          { reason: "Comédogène",                                            description: "Ester gras comédogène. Présent dans certains émollients et fonds de teint. Peaux concernées : peaux acnéiques et grasses." },
  "SODIUM CHLORIDE":             { reason: "Sel — peut irriter et assécher à haute concentration",  description: "Sel (chlorure de sodium) utilisé comme modificateur de viscosité. Irritant aux concentrations élevées dans les nettoyants. Peaux concernées : peaux sensibles et peaux sèches." },
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
  "ISOPROPYL MYRISTATE":          { rating: 5, description: "Ester gras synthétique. Indice comédogénique maximal (5/5) : obstrue quasi systématiquement les follicules pileux. Peaux concernées : peaux acnéiques et grasses — à éviter absolument dans les soins visage." },
  "ISOPROPYL PALMITATE":          { rating: 4, description: "Ester gras synthétique comédogène (4/5). Peut boucher les pores en s'accumulant. Peaux concernées : peaux acnéiques et grasses." },
  "MYRISTYL MYRISTATE":           { rating: 5, description: "Ester gras très comédogène (5/5). Présent dans certains émollients et fonds de teint. Peaux concernées : peaux acnéiques et grasses." },
  "OCTYL STEARATE":               { rating: 5, description: "Ester gras synthétique. Indice comédogénique très élevé (5/5). Peaux concernées : peaux acnéiques — à éviter dans les formules visage." },
  "WHEAT GERM OIL":               { rating: 5, description: "Huile de germe de blé, riche en acides gras lourds. Indice comédogénique 5/5. Peaux concernées : peaux acnéiques et mixtes à grasses — malgré ses qualités nutritives, à éviter sur le visage acnéique." },
  "TRITICUM VULGARE GERM OIL":    { rating: 5, description: "Huile de germe de blé (nom INCI). Indice comédogénique 5/5. Peaux concernées : peaux acnéiques et grasses." },
  "LAURETH-4":                    { rating: 5, description: "Tensioactif éthoxylé dérivé de l'acide laurique. Indice comédogénique 5/5. Peaux concernées : peaux acnéiques." },
  "MYRISTIC ACID":                { rating: 5, description: "Acide gras saturé à chaîne moyenne (C14). Indice comédogénique très élevé (5/5), peut obstruer les pores rapidement. Présent naturellement dans les huiles de coco, palmiste et noix de muscade. Peaux concernées : peaux acnéiques et grasses." },
  "ACETYLATED LANOLIN":           { rating: 5, description: "Lanoline acétylée. Indice comédogénique 5/5. Très occlusif, bouche fortement les pores. Peaux concernées : peaux acnéiques — à éviter sur le visage." },
  "ACETYLATED LANOLIN ALCOHOL":   { rating: 4, description: "Alcool de lanoline acétylé. Indice comédogénique 4/5. Peaux concernées : peaux acnéiques." },

  // Indice 4 — fortement comédogène
  "ETHYLHEXYL PALMITATE":         { rating: 4, description: "Ester très répandu dans les écrans solaires et fond de teint. Indice comédogénique 4/5 : peut accélérer la formation de comédons. Peaux concernées : peaux acnéiques et grasses — présence à surveiller notamment dans les SPF quotidiens." },
  "OCTYL PALMITATE":              { rating: 4, description: "Ester palmitate d'origine synthétique. Indice comédogénique 4/5. Peaux concernées : peaux acnéiques." },
  "COCOS NUCIFERA OIL":           { rating: 4, description: "Huile de coco. Riche en acide laurique (antibactérien) mais indice comédogénique élevé (4/5). Peut aggraver l'acné sur le visage malgré ses propriétés bénéfiques pour le corps. Peaux concernées : peaux acnéiques et grasses — usage déconseillé sur le visage." },
  "COCOS NUCIFERA FRUIT OIL":     { rating: 4, description: "Huile de coco (nom INCI alternatif). Même profil comédogénique élevé (4/5). Peaux concernées : peaux acnéiques et grasses." },
  "THEOBROMA CACAO SEED BUTTER":  { rating: 4, description: "Beurre de cacao. Indice comédogénique élevé (4/5) malgré ses propriétés émollientes. Peaux concernées : peaux acnéiques — à éviter sur le visage, convient pour le corps." },
  "LANOLIN ALCOHOL":              { rating: 4, description: "Alcool de lanoline. Indice comédogénique 4/5, peut obstruer les pores. Peaux concernées : peaux acnéiques et grasses." },
  "DECYL OLEATE":                 { rating: 4, description: "Ester de l'acide oléique. Indice comédogénique 3-4/5. Peaux concernées : peaux acnéiques." },
  "ISOPROPYL ISOSTEARATE":        { rating: 4, description: "Ester synthétique. Indice comédogénique 4-5/5, très occlusif. Peaux concernées : peaux acnéiques et grasses." },
  "LINUM USITATISSIMUM SEED OIL": { rating: 4, description: "Huile de lin. Riche en oméga-3 mais s'oxyde rapidement et peut déclencher de l'acné. Indice comédogénique 4/5. Peaux concernées : peaux acnéiques — malgré son image 'naturelle', peut aggraver l'acné." },

  // Indice 3 — modérément comédogène
  "BUTYL STEARATE":               { rating: 3, description: "Ester gras synthétique. Indice comédogénique 3/5. Peaux concernées : peaux acnéiques et grasses." },
  "CETYL ACETATE":                { rating: 3, description: "Ester de l'acide acétique et du cétanol. Indice comédogénique 3/5. Peaux concernées : peaux acnéiques." },
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

    const petroKey = Object.keys(PETROCHEMICALS).find(
      (k) => norm === k || norm.includes(k)
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
      (k) => norm === k || norm.includes(k)
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

    return {
      raw: token, normalized: norm, flag: "ok",
      description: "Aucun signal identifié dans les bases consultées (ECHA, SCCS, Acne Clinic NYC). Peaux concernées : tous types.",
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
