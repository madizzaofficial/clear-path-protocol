export type Lesson = {
  id: string;
  title: string;
  duration: string;
  locked: boolean;
  summary: string;
  resources: { name: string; size: string; url?: string }[];
};

export type Chapter = {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
};

export const course = {
  id: "clear-skin-protocol",
  title: "Clear - Formation vidéo",
  subtitle: "Une aventure de 12 semaines pour une peau en meilleure santé",
  totalLessons: 18,
  estimatedHours: 6.5,
  chapters: [
    {
      id: "ch-1",
      title: "Comprendre ta peau",
      description: "Avant d'acheter quoi que ce soit, tu dois savoir ce que tu as.",
      lessons: [
        { id: "l-1", title: "Sébum, pores, barrière cutanée, kézako ?", duration: "4 min", locked: false, summary: "Comprends le rôle du sébum, la structure des pores et comment ta barrière cutanée te protège — ou se retrouve fragilisée.", resources: [{ name: "Welcome guide.pdf", size: "1.2 MB" }] },
        { id: "l-2", title: "Identifier ton type de peau", duration: "12 min", locked: false, summary: "Peau grasse, sèche, mixte ou sensible — comment le déterminer avec précision pour ne plus te tromper de produits.", resources: [{ name: "Skin biology cheatsheet.pdf", size: "800 KB" }] },
        { id: "l-3", title: "C'est quoi ce truc sur mon visage ?", duration: "9 min", locked: false, summary: "Points noirs, microkystes, papules, pustules, kystes — les distinguer pour adapter ton traitement et arrêter de tout confondre.", resources: [] },
        { id: "l-4", title: "C'est quoi ces traces que l'acné a laissées ?", duration: "7 min", locked: false, summary: "Cicatrices post-inflammatoires, taches brunes, érythème résiduel : comprendre ce que chaque type de marque signifie et comment l'aborder.", resources: [{ name: "Tracking template.pdf", size: "420 KB" }] },
        { id: "l-5", title: "Pourquoi ta peau réagit à ta vie ?", duration: "7 min", locked: false, summary: "Stress, sommeil, alimentation, hormones — comment ton mode de vie s'imprime directement sur ta peau et sur ton acné.", resources: [{ name: "Tracking template.pdf", size: "420 KB" }] },
      ],
    },
    {
      id: "ch-2",
      title: "Les 3 gestes non négociables",
      description: "Les bases du matin et du soir qui font vraiment la différence.",
      lessons: [
        { id: "l-5", title: "Matin VS Soir : Ce que tu mets sur ton visage", duration: "11 min", locked: false, summary: "Les règles d'or de l'ordre d'application : ce qui va le matin, ce qui va le soir, et pourquoi ça change tout.", resources: [{ name: "AM routine card.pdf", size: "300 KB" }] },
        { id: "l-6", title: "Quelle texture selon ton type de peau ?", duration: "10 min", locked: false, summary: "Gel, crème, huile, sérum : choisir la bonne texture pour ton type de peau sans obstruer tes pores ni assécher ta barrière.", resources: [] },
        { id: "l-7", title: "UVA VS UVB : Comprendre les rayons qui attaquent ta peau", duration: "15 min", locked: false, summary: "Les UV aggravent les cicatrices et accélèrent le vieillissement — pourquoi la protection solaire est le geste anti-acné le plus sous-estimé.", resources: [{ name: "Ingredients guide.pdf", size: "1.6 MB" }] },
      ],
    },
    {
      id: "ch-3",
      title: "Combattre l'acné active",
      description: "Les causes profondes, les actifs qui marchent, les produits à éviter.",
      lessons: [
        { id: "l-8", title: "Les 2 vrais responsables de ton acné", duration: "14 min", locked: true, summary: "Sébum en excès + bactéries P. acnes : comment ce duo crée une imperfection et où agir en priorité pour casser le cycle.", resources: [] },
        { id: "l-9", title: "C'est quoi ton type d'acné ?", duration: "9 min", locked: true, summary: "Acné hormonale, bactérienne, mécanique, cosmétique — identifier l'origine pour ne plus traiter dans le vide.", resources: [] },
        { id: "l-10", title: "Les actifs qui marchent vraiment et pourquoi", duration: "11 min", locked: true, summary: "Niacinamide, BHA, peroxyde de benzoyle, rétinoïdes — ce que la science dit réellement sur chaque actif anti-acné.", resources: [] },
        { id: "l-11", title: "Les produits qui aggravent ton acné sans que tu le saches", duration: "11 min", locked: true, summary: "Comédogènes, perturbateurs endocriniens, irritants cachés — les ingrédients à repérer sur une étiquette INCI.", resources: [] },
        { id: "l-12", title: "Comment introduire les actifs sans cramer ta barrière", duration: "11 min", locked: true, summary: "La méthode d'introduction progressive des actifs pour éviter les réactions, les rougeurs et l'irritation qui font renoncer.", resources: [] },
      ],
    },
    {
      id: "ch-4",
      title: "Traiter les cicatrices",
      description: "Estomper les marques laissées par l'acné avec les bons actifs au bon moment.",
      lessons: [
        { id: "l-12", title: "Comprendre ce que l'acné a laissé sur ta peau", duration: "8 min", locked: true, summary: "Hyperpigmentation, érythème post-inflammatoire, cicatrices atrophiques : différencier chaque type de marque pour mieux cibler le traitement.", resources: [] },
        { id: "l-13", title: "AHA et vitamine C — les actifs qui effacent les taches", duration: "10 min", locked: true, summary: "Glycolique, lactique, mandélique, vitamine C — les dosages et protocoles pour estomper les marques post-acné sans irriter.", resources: [] },
        { id: "l-14", title: "Les rétinoïdes — pour qui, quand, comment", duration: "6 min", locked: true, summary: "Rétinol, rétinal, trétinoïne — les différences, les effets attendus, et comment les introduire sans abîmer ta barrière.", resources: [] },
        { id: "l-15", title: "Mon protocole cicatrices en temps réel", duration: "6 min", locked: true, summary: "Le protocole exact utilisé avec les élèves : l'ordre des actifs, la fréquence, et les erreurs à ne pas reproduire.", resources: [] },
      ],
    },
    {
      id: "ch-5",
      title: "Rasage sans casser ta peau",
      description: "Raser sans déclencher d'inflammation ni aggraver l'acné.",
      lessons: [
        { id: "l-16", title: "Pourquoi le rasage aggrave l'acné", duration: "8 min", locked: true, summary: "Irritation mécanique, micro-coupures, ingrowns — comment chaque geste de rasage peut déclencher ou aggraver une poussée.", resources: [] },
        { id: "l-17", title: "Choisir son matériel selon sa peau", duration: "7 min", locked: true, summary: "Rasoir électrique vs lame, mousse vs gel vs huile — quels produits et quel matériel choisir selon ton type de peau et ton acné.", resources: [] },
        { id: "l-18", title: "La technique de rasage anti-inflammatoire", duration: "9 min", locked: true, summary: "Sens du poil, pression, fréquence, soin après-rasage — la méthode complète pour raser sans provoquer de réaction.", resources: [] },
        { id: "l-19", title: "Intégrer le rasage dans ta routine Clear", duration: "6 min", locked: true, summary: "Comment adapter ta routine matin quand tu rases : l'ordre des étapes, les actifs à éviter le jour J, et le soin après-rasage optimal.", resources: [] },
      ],
    },
  ] satisfies Chapter[],
};

export type RoutineStep = {
  step: number;
  category: string;
  productName: string;
  brand: string;
  howTo: string;
  amount: string;
  frequency: string;
};

export type RoutineBlock = {
  id: "morning" | "evening";
  title: string;
  subtitle: string;
  totalMinutes: number;
  steps: RoutineStep[];
};

export const routine: RoutineBlock[] = [
  {
    id: "morning",
    title: "Morning Ritual",
    subtitle: "After waking, before breakfast",
    totalMinutes: 4,
    steps: [
      { step: 1, category: "Cleanser", productName: "Gentle Gel Cleanser", brand: "La Roche-Posay", howTo: "Massage onto damp skin for 30 seconds. Rinse with lukewarm water.", amount: "Pea-sized amount", frequency: "Every morning" },
      { step: 2, category: "Serum", productName: "Niacinamide 10% Serum", brand: "The Ordinary", howTo: "Apply to clean, dry skin. Wait 60 seconds before next step.", amount: "3–4 drops", frequency: "Every morning" },
      { step: 3, category: "Moisturizer", productName: "Ceramide Moisturizer", brand: "CeraVe", howTo: "Press gently into skin until fully absorbed.", amount: "Pea-sized amount", frequency: "Every morning" },
      { step: 4, category: "Sunscreen", productName: "Mineral SPF 50", brand: "EltaMD UV Clear", howTo: "Apply as the final step. Reapply every 2 hours outdoors.", amount: "Two-finger length", frequency: "Every morning" },
    ],
  },
  {
    id: "evening",
    title: "Evening Ritual",
    subtitle: "30 minutes before bed",
    totalMinutes: 6,
    steps: [
      { step: 1, category: "Cleanser", productName: "Gentle Gel Cleanser", brand: "La Roche-Posay", howTo: "Double cleanse if you wore SPF or makeup. Rinse thoroughly.", amount: "Pea-sized amount", frequency: "Every evening" },
      { step: 2, category: "Treatment", productName: "Adapalene 0.1% Gel", brand: "Differin", howTo: "Apply to fully dry skin. Avoid eye area. Mild tingling is normal.", amount: "Pea-sized amount", frequency: "Every evening" },
      { step: 3, category: "Exfoliant", productName: "BHA 2% Exfoliant", brand: "Paula's Choice", howTo: "Skip on Adapalene nights. Apply on alternate evenings only.", amount: "A few drops", frequency: "2× per week" },
      { step: 4, category: "Moisturizer", productName: "Ceramide Moisturizer", brand: "CeraVe", howTo: "Layer generously to seal in actives and support overnight repair.", amount: "Generous layer", frequency: "Every evening" },
    ],
  },
];

export const findLesson = (id: string) => {
  for (const ch of course.chapters) {
    const l = ch.lessons.find((x) => x.id === id);
    if (l) return { lesson: l, chapter: ch };
  }
  return null;
};

export const allLessons = () => course.chapters.flatMap((c) => c.lessons.map((l) => ({ ...l, chapterId: c.id, chapterTitle: c.title })));
