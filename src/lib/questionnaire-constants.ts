// ─── Full Intake Questionnaire Types & Constants ─────────────────────────────────
//
// This file defines the data model for the 14-section onboarding questionnaire
// (replacing the old 10-step stepper and the Tally form).
// It is the single source of truth for question labels, options, and field names.

// ─── Types ────────────────────────────────────────────────────────────────────────

export type FullIntakeAnswers = {
  // Section 1 — Informations générales
  ageRange: string;
  gender: string;

  // Section 2 — Tes objectifs
  goals: string[];
  priorityGoal: string;
  durationAcne: string;
  problemDescription: string;

  // Section 3 — Type de peau et sensibilité
  skinType: string;
  sensitivity: string;
  skinReactions: string[];

  // Section 4 — Imperfections et marques
  acneLocations: string[];
  imperfectionTypes: string[];
  botherLevel: number;
  mainBother: string;

  // Section 5 — Historique dermatologique
  dermatologistVisit: string;
  prescribedTreatments: string[];
  currentlyOnTreatment: string;
  currentTreatmentDetails: string;
  isotretinoinCures: number | null;
  isotretinoinLastEnd: string;
  acneReturnedAfter: string;

  // Section 6 — Routine actuelle
  morningRoutine: string;
  eveningRoutine: string;
  occasionalProducts: string;
  routineDuration: string;
  productPhotos: string[];

  // Section 7 — Réactions et expériences
  hadReaction: string;
  reactionProduct: string;
  reactionDescription: string;
  toleratedProducts: string;
  hatedProducts: string;

  // Section 8 — Informations de santé
  allergies: string;
  medication: string;
  medicationDetails: string;
  pregnancy: string;
  sopk: string;
  menstrualCycle: string;

  // Section 9 — Budget et préférences
  budget: string;
  productsPreference: string;
  purchaseChannels: string[];
  constraints: string[];
  brandPreferences: string;

  // Section 10 — Habitudes
  routineTime: string;
  spfFrequency: string;
  routineAdherence: number;
  adherenceObstacles: string[];

  // Section 11 — Facteurs qui influencent
  aggravatingFactors: string[];
  pimpleTouching: string;

  // Section 12 — Photos
  photoFront: string;
  photoLeft: string;
  photoRight: string;
  photoExtras: string[];

  // Section 13 — Attentes
  fears: string[];
  successDefinition: string;
  purchaseReason: string;
  additionalInfo: string;

  // Section 14 — Alimentation & compléments
  dietBalance: string;
  foodFrequency: string[];
  takesSupplements: string;
  supplementsList: string[];
  supplementsDuration: string;
  foodAggravates: string;

  // Meta
  completedAt: number | null;
  completedSections: number[];
  photoUrls: string[];
};

export const EMPTY_INTAKE: FullIntakeAnswers = {
  ageRange: "",
  gender: "",
  goals: [],
  priorityGoal: "",
  durationAcne: "",
  problemDescription: "",
  skinType: "",
  sensitivity: "",
  skinReactions: [],
  acneLocations: [],
  imperfectionTypes: [],
  botherLevel: 0,
  mainBother: "",
  dermatologistVisit: "",
  prescribedTreatments: [],
  currentlyOnTreatment: "",
  currentTreatmentDetails: "",
  isotretinoinCures: null,
  isotretinoinLastEnd: "",
  acneReturnedAfter: "",
  morningRoutine: "",
  eveningRoutine: "",
  occasionalProducts: "",
  routineDuration: "",
  productPhotos: [],
  hadReaction: "",
  reactionProduct: "",
  reactionDescription: "",
  toleratedProducts: "",
  hatedProducts: "",
  allergies: "",
  medication: "",
  medicationDetails: "",
  pregnancy: "",
  sopk: "",
  menstrualCycle: "",
  budget: "",
  productsPreference: "",
  purchaseChannels: [],
  constraints: [],
  brandPreferences: "",
  routineTime: "",
  spfFrequency: "",
  routineAdherence: 0,
  adherenceObstacles: [],
  aggravatingFactors: [],
  pimpleTouching: "",
  photoFront: "",
  photoLeft: "",
  photoRight: "",
  photoExtras: [],
  fears: [],
  successDefinition: "",
  purchaseReason: "",
  additionalInfo: "",
  dietBalance: "",
  foodFrequency: [],
  takesSupplements: "",
  supplementsList: [],
  supplementsDuration: "",
  foodAggravates: "",
  completedAt: null,
  completedSections: [],
  photoUrls: [],
};

// ─── Section definitions ────────────────────────────────────────────────────────

export type SectionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export const SECTIONS: { id: SectionId; slug: string; title: string; description: string }[] = [
  { id: 1, slug: "01-infos", title: "Informations générales", description: "Quelques bases pour commencer." },
  { id: 2, slug: "02-objectifs", title: "Tes objectifs", description: "Ce que tu veux améliorer en priorité." },
  { id: 3, slug: "03-type-peau", title: "Type de peau & sensibilité", description: "Ta peau, telle qu'elle est au naturel." },
  { id: 4, slug: "04-imperfections", title: "Imperfections & marques", description: "Où et comment se manifestent tes imperfections." },
  { id: 5, slug: "05-historique", title: "Historique dermatologique", description: "Tes expériences passées avec les traitements." },
  { id: 6, slug: "06-routine", title: "Routine actuelle", description: "Ce que tu mets sur ta peau au quotidien." },
  { id: 7, slug: "07-reactions", title: "Réactions & expériences", description: "Les produits qui t'ont fait du bien… ou du mal." },
  { id: 8, slug: "08-sante", title: "Informations de santé", description: "Ces informations permettent d'éviter des recommandations inadaptées." },
  { id: 9, slug: "09-budget", title: "Budget & préférences", description: "Pour t'orienter vers les produits les plus adaptés." },
  { id: 10, slug: "10-habitudes", title: "Habitudes", description: "Ton mode de vie au quotidien." },
  { id: 11, slug: "11-facteurs", title: "Facteurs qui influencent", description: "Ce qui peut aggraver ou améliorer ta peau." },
  { id: 12, slug: "12-photos", title: "Photos", description: "Indispensables pour analyser ta peau." },
  { id: 13, slug: "13-attentes", title: "Tes attentes", description: "Ce qui ferait une vraie différence pour toi." },
  { id: 14, slug: "14-alimentation", title: "Alimentation & compléments", description: "L'état de la peau dépend aussi de ce que tu manges." },
];

// ─── Option lists ────────────────────────────────────────────────────────────────

export const AGE_OPTIONS = [
  { value: "moins_18", label: "Moins de 18 ans" },
  { value: "18_24", label: "18 à 24 ans" },
  { value: "25_34", label: "25 à 34 ans" },
  { value: "35_44", label: "35 à 44 ans" },
  { value: "45_plus", label: "45 ans et plus" },
];

export const GENDER_OPTIONS = [
  { value: "homme", label: "Homme" },
  { value: "femme", label: "Femme" },
  { value: "autre", label: "Autre" },
  { value: "nr", label: "Je préfère ne pas répondre" },
];

export const GOAL_OPTIONS = [
  { value: "reduire_acne", label: "Réduire mon acné" },
  { value: "boutons_inflammatoires", label: "Réduire les boutons inflammatoires" },
  { value: "boutons_douloureux", label: "Réduire les boutons douloureux ou kystiques" },
  { value: "points_noirs", label: "Réduire les points noirs" },
  { value: "microkystes", label: "Réduire les microkystes ou comédons fermés" },
  { value: "marques_rouges", label: "Atténuer les marques rouges post-acné" },
  { value: "taches_brunes", label: "Atténuer les taches brunes post-acné" },
  { value: "rougeurs", label: "Réduire les rougeurs" },
  { value: "barriere", label: "Réparer ma barrière cutanée" },
  { value: "sebum", label: "Contrôler l'excès de sébum" },
  { value: "secheresse", label: "Réduire la sécheresse et les tiraillements" },
  { value: "routine_simple", label: "Construire une routine simple et cohérente" },
  { value: "arreter_tester", label: "Arrêter de tester des produits au hasard" },
  { value: "autre", label: "Autre" },
];

export const DURATION_OPTIONS = [
  { value: "moins_6mois", label: "Moins de 6 mois" },
  { value: "6_12mois", label: "Entre 6 mois et 1 an" },
  { value: "1_3ans", label: "Entre 1 et 3 ans" },
  { value: "3_5ans", label: "Entre 3 et 5 ans" },
  { value: "plus_5ans", label: "Plus de 5 ans" },
  { value: "depuis_adolescence", label: "Depuis l'adolescence" },
];

export const SKIN_TYPE_OPTIONS = [
  { value: "tres_grasse", label: "Elle devient grasse sur tout le visage" },
  { value: "zone_t", label: "Elle devient surtout grasse sur la zone T" },
  { value: "equilibree", label: "Elle reste confortable et équilibrée" },
  { value: "seche", label: "Elle tiraille ou paraît sèche" },
  { value: "mixte", label: "Elle est grasse à certains endroits et sèche à d'autres" },
  { value: "sais_pas", label: "Je ne sais pas" },
];

export const SENSITIVITY_OPTIONS = [
  { value: "tres_sensible", label: "Oui, très sensible" },
  { value: "plutot_sensible", label: "Plutôt sensible" },
  { value: "peu_sensible", label: "Peu sensible" },
  { value: "pas_sensible", label: "Pas sensible" },
  { value: "sais_pas", label: "Je ne sais pas" },
];

export const SKIN_REACTION_OPTIONS = [
  { value: "rougeurs", label: "Rougeurs" },
  { value: "picotements", label: "Picotements" },
  { value: "brulure", label: "Sensation de brûlure" },
  { value: "tiraillements", label: "Tiraillements" },
  { value: "desquamation", label: "Desquamation ou peau qui pèle" },
  { value: "demangeaisons", label: "Démangeaisons" },
  { value: "boutons_nouveaux", label: "Boutons après l'utilisation de nouveaux produits" },
  { value: "aucune", label: "Aucune réaction particulière" },
  { value: "autre", label: "Autre" },
];

export const ACNE_LOCATION_OPTIONS = [
  { value: "front", label: "Front" },
  { value: "tempes", label: "Tempes" },
  { value: "nez", label: "Nez" },
  { value: "joues", label: "Joues" },
  { value: "menton", label: "Menton" },
  { value: "machoire", label: "Mâchoire" },
  { value: "cou", label: "Cou" },
  { value: "dos", label: "Dos" },
  { value: "torse", label: "Torse" },
  { value: "autre", label: "Autre" },
];

export const IMPERFECTION_TYPE_OPTIONS = [
  { value: "boutons_rouges", label: "Petits boutons rouges" },
  { value: "boutons_blancs", label: "Boutons avec une tête blanche" },
  { value: "boutons_profonds", label: "Boutons profonds ou douloureux" },
  { value: "kystes", label: "Kystes" },
  { value: "points_noirs", label: "Points noirs" },
  { value: "points_blancs", label: "Points blancs" },
  { value: "microkystes", label: "Microkystes ou comédons fermés" },
  { value: "marques_rouges", label: "Marques rouges après les boutons" },
  { value: "taches_brunes", label: "Taches brunes après les boutons" },
  { value: "cicatrices", label: "Cicatrices creusées" },
  { value: "rougeurs_diffuses", label: "Rougeurs diffuses" },
  { value: "texture_irreguliere", label: "Texture irrégulière" },
  { value: "sais_pas", label: "Je ne sais pas" },
];

export const DERMATOLOGIST_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
];

export const PRESCRIBED_TREATMENT_OPTIONS = [
  { value: "peroxyde_benzoyle", label: "Peroxyde de benzoyle" },
  { value: "adapalene", label: "Adapalène" },
  { value: "tretinoine", label: "Trétinoïne" },
  { value: "acide_azelaque", label: "Acide azélaïque" },
  { value: "antibiotiques_topiques", label: "Antibiotiques à appliquer sur la peau" },
  { value: "antibiotiques_oraux", label: "Antibiotiques par voie orale" },
  { value: "isotretinoine", label: "Isotrétinoïne ou Roaccutane" },
  { value: "traitement_hormonal", label: "Traitement hormonal" },
  { value: "autre", label: "Autre" },
  { value: "sais_plus", label: "Je ne me souviens plus" },
];

export const ROUTINE_DURATION_OPTIONS = [
  { value: "moins_2sem", label: "Moins de 2 semaines" },
  { value: "2sem_1mois", label: "Entre 2 semaines et 1 mois" },
  { value: "1_3mois", label: "Entre 1 et 3 mois" },
  { value: "3_6mois", label: "Entre 3 et 6 mois" },
  { value: "plus_6mois", label: "Plus de 6 mois" },
  { value: "change_regulierement", label: "Ma routine change régulièrement" },
];

export const BUDGET_OPTIONS = [
  { value: "moins_50", label: "Moins de 50 €" },
  { value: "50_80", label: "Entre 50 et 80 €" },
  { value: "80_120", label: "Entre 80 et 120 €" },
  { value: "120_180", label: "Entre 120 et 180 €" },
  { value: "plus_180", label: "Plus de 180 €" },
  { value: "pertinence", label: "Je veux surtout les produits les plus pertinents" },
  { value: "sais_pas", label: "Je ne sais pas encore" },
];

export const PRODUCTS_PREFERENCE_OPTIONS = [
  { value: "conserver", label: "Je veux en conserver le plus possible" },
  { value: "remplacer_partie", label: "Je suis prêt à en remplacer une partie" },
  { value: "zero", label: "Je préfère repartir entièrement de zéro" },
  { value: "laisser_decider", label: "Je te laisse décider selon ce qui est le plus pertinent" },
];

export const PURCHASE_CHANNEL_OPTIONS = [
  { value: "pharmacie", label: "Pharmacie ou parapharmacie" },
  { value: "amazon", label: "Amazon" },
  { value: "yesstyle", label: "YesStyle" },
  { value: "stylevana", label: "Stylevana" },
  { value: "sephora", label: "Sephora" },
  { value: "sites_marques", label: "Sites de marques" },
  { value: "peu_importe", label: "Peu importe" },
  { value: "autre", label: "Autre" },
];

export const CONSTRAINT_OPTIONS = [
  { value: "sans_parfum", label: "Sans parfum" },
  { value: "sans_huiles_essentielles", label: "Sans huiles essentielles" },
  { value: "sans_alcool", label: "Sans alcool dénaturé" },
  { value: "vegan", label: "Vegan" },
  { value: "cruelty_free", label: "Cruelty-free" },
  { value: "coreen", label: "Produits coréens" },
  { value: "pharmacie_dispo", label: "Produits disponibles en pharmacie" },
  { value: "textures_legeres", label: "Textures légères" },
  { value: "faciles_trouver", label: "Produits faciles à trouver" },
  { value: "aucune", label: "Aucune préférence" },
  { value: "autre", label: "Autre" },
];

export const ROUTINE_TIME_OPTIONS = [
  { value: "moins_3min", label: "Moins de 3 minutes" },
  { value: "5min", label: "Environ 5 minutes" },
  { value: "10min", label: "Jusqu'à 10 minutes" },
  { value: "necessaire", label: "Le temps nécessaire si la routine reste raisonnable" },
];

export const SPF_FREQUENCY_OPTIONS = [
  { value: "tous_les_jours", label: "Tous les jours" },
  { value: "presque_tous_les_jours", label: "Presque tous les jours" },
  { value: "soleil", label: "Seulement lorsqu'il fait beau" },
  { value: "rarement", label: "Rarement" },
  { value: "jamais", label: "Jamais" },
];

export const ADHERENCE_OBSTACLE_OPTIONS = [
  { value: "temps", label: "Manque de temps" },
  { value: "motivation", label: "Manque de motivation" },
  { value: "budget", label: "Budget" },
  { value: "routine_longue", label: "Routine trop longue" },
  { value: "peur_reactions", label: "Peur des réactions" },
  { value: "difficulte_trouver", label: "Difficulté à trouver les produits" },
  { value: "oubli", label: "J'oublie facilement" },
  { value: "rien", label: "Rien en particulier" },
  { value: "autre", label: "Autre" },
];

export const AGGRAVATING_FACTOR_OPTIONS = [
  { value: "stress", label: "Stress" },
  { value: "manque_sommeil", label: "Manque de sommeil" },
  { value: "cycle_menstruel", label: "Cycle menstruel" },
  { value: "chaleur", label: "Chaleur" },
  { value: "soleil", label: "Soleil" },
  { value: "froid", label: "Froid" },
  { value: "transpiration", label: "Transpiration" },
  { value: "sport", label: "Sport" },
  { value: "rasage", label: "Rasage" },
  { value: "masque", label: "Port d'un masque" },
  { value: "certains_produits", label: "Certains produits" },
  { value: "alimentation", label: "Alimentation" },
  { value: "tabac", label: "Tabac ou vapotage" },
  { value: "sais_pas", label: "Je ne sais pas" },
  { value: "aucun", label: "Aucun facteur identifié" },
  { value: "autre", label: "Autre" },
];

export const PIMPLE_TOUCHING_OPTIONS = [
  { value: "jamais", label: "Jamais" },
  { value: "rarement", label: "Rarement" },
  { value: "parfois", label: "Parfois" },
  { value: "souvent", label: "Souvent" },
  { value: "tres_souvent", label: "Très souvent" },
];

export const FEAR_OPTIONS = [
  { value: "irriter", label: "Irriter davantage ma peau" },
  { value: "purge", label: "Faire une purge" },
  { value: "aggraver", label: "Aggraver mon acné" },
  { value: "depenser", label: "Dépenser encore de l'argent inutilement" },
  { value: "routine_compliquee", label: "Recevoir une routine trop compliquée" },
  { value: "pas_resultats", label: "Ne pas obtenir de résultats" },
  { value: "remplacer_tout", label: "Devoir remplacer tous mes produits" },
  { value: "autre", label: "Autre" },
];

export const DIET_BALANCE_OPTIONS = [
  { value: "tres_equilibree", label: "Très équilibrée" },
  { value: "plutot_equilibree", label: "Plutôt équilibrée" },
  { value: "moyennement", label: "Moyennement équilibrée" },
  { value: "peu_equilibree", label: "Peu équilibrée" },
];

export const FOOD_FREQUENCY_OPTIONS = [
  { value: "produits_laitiers", label: "Produits laitiers (lait, yaourts, fromage…)" },
  { value: "whey", label: "Whey / protéines en poudre" },
  { value: "fast_food", label: "Fast-food" },
  { value: "boissons_sucrees", label: "Boissons sucrées" },
  { value: "confiseries", label: "Bonbons, pâtisseries et autres produits riches en sucres raffinés" },
  { value: "ultra_transformes", label: "Produits ultra-transformés (plats préparés, chips, snacks industriels…)" },
];

export const SUPPLEMENT_OPTIONS = [
  { value: "vitamine_d", label: "Vitamine D" },
  { value: "zinc", label: "Zinc" },
  { value: "magnesium", label: "Magnésium" },
  { value: "omega3", label: "Oméga-3" },
  { value: "creatine", label: "Créatine" },
  { value: "whey", label: "Whey / protéines en poudre" },
  { value: "collagene", label: "Collagène" },
  { value: "biotine", label: "Biotine" },
  { value: "vitamine_b12", label: "Vitamine B12" },
  { value: "ashwagandha", label: "Ashwagandha" },
  { value: "probiotiques", label: "Probiotiques" },
  { value: "fer", label: "Fer" },
  { value: "multivitamines", label: "Multivitamines" },
  { value: "autre", label: "Autre" },
];

// ─── Section slugs for routing ────────────────────────────────────────────────────

export const SECTION_SLUGS = SECTIONS.map((s) => s.slug);