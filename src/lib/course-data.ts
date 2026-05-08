export type Lesson = {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
  locked: boolean;
  summary: string;
  resources: { name: string; size: string }[];
};

export type Chapter = {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
};

export const course = {
  id: "clear-skin-protocol",
  title: "The Clear Skin Protocol",
  subtitle: "A 12-week guided transformation for calmer, healthier skin",
  totalLessons: 18,
  estimatedHours: 6.5,
  chapters: [
    {
      id: "ch-1",
      title: "Foundations of Skin Health",
      description: "Understand the biology of acne and your unique skin.",
      lessons: [
        { id: "l-1", title: "Welcome to the Protocol", duration: "4 min", completed: true, locked: false, summary: "Set your intentions and learn how to use this program.", resources: [{ name: "Welcome guide.pdf", size: "1.2 MB" }] },
        { id: "l-2", title: "How Acne Actually Works", duration: "12 min", completed: true, locked: false, summary: "The four pillars: sebum, keratin, bacteria, inflammation.", resources: [{ name: "Skin biology cheatsheet.pdf", size: "800 KB" }] },
        { id: "l-3", title: "Identify Your Skin Type", duration: "9 min", completed: true, locked: false, summary: "A quick framework to know your skin in 3 minutes.", resources: [] },
        { id: "l-4", title: "Tracking Your Baseline", duration: "7 min", completed: false, locked: false, summary: "Take your first photos and notes the right way.", resources: [{ name: "Tracking template.pdf", size: "420 KB" }] },
      ],
    },
    {
      id: "ch-2",
      title: "Building Your Daily Routine",
      description: "Morning and evening rituals that actually work.",
      lessons: [
        { id: "l-5", title: "The Minimal Morning Routine", duration: "11 min", completed: false, locked: false, summary: "Cleanse, treat, hydrate, protect — without overload.", resources: [{ name: "AM routine card.pdf", size: "300 KB" }] },
        { id: "l-6", title: "Evening Reset Ritual", duration: "10 min", completed: false, locked: false, summary: "Why double cleansing changes everything.", resources: [] },
        { id: "l-7", title: "Active Ingredients 101", duration: "15 min", completed: false, locked: false, summary: "Retinoids, BHA, AHA, niacinamide — when and how.", resources: [{ name: "Ingredients guide.pdf", size: "1.6 MB" }] },
        { id: "l-8", title: "Layering Without Irritation", duration: "8 min", completed: false, locked: true, summary: "The order that protects your barrier.", resources: [] },
      ],
    },
    {
      id: "ch-3",
      title: "Lifestyle & Inner Health",
      description: "Sleep, stress, nutrition — the invisible levers.",
      lessons: [
        { id: "l-9", title: "Diet Triggers Decoded", duration: "14 min", completed: false, locked: true, summary: "Dairy, sugar, omega ratios — what the data really says.", resources: [] },
        { id: "l-10", title: "Sleep & Skin Repair", duration: "9 min", completed: false, locked: true, summary: "How REM cycles drive cell turnover.", resources: [] },
        { id: "l-11", title: "Stress, Cortisol & Breakouts", duration: "11 min", completed: false, locked: true, summary: "Calm nervous system, calmer skin.", resources: [] },
      ],
    },
    {
      id: "ch-4",
      title: "Long-Term Maintenance",
      description: "Protect your transformation forever.",
      lessons: [
        { id: "l-12", title: "Reading Your Skin Signals", duration: "8 min", completed: false, locked: true, summary: "Adjust your routine before flare-ups happen.", resources: [] },
        { id: "l-13", title: "Seasonal Adjustments", duration: "10 min", completed: false, locked: true, summary: "Winter barrier care vs. summer oil control.", resources: [] },
        { id: "l-14", title: "Graduation & Beyond", duration: "6 min", completed: false, locked: true, summary: "Your maintenance protocol for life.", resources: [] },
      ],
    },
  ] satisfies Chapter[],
};

export const products = [
  { id: "p1", name: "Gentle Gel Cleanser", brand: "La Roche-Posay", category: "Cleanser", price: "€16", reason: "Non-stripping for your combination skin's morning reset.", tone: "AM + PM" },
  { id: "p2", name: "Niacinamide 10% Serum", brand: "The Ordinary", category: "Serum", price: "€7", reason: "Calms inflammation and regulates sebum on your t-zone.", tone: "AM" },
  { id: "p3", name: "Adapalene 0.1% Gel", brand: "Differin", category: "Treatment", price: "€22", reason: "Gold-standard retinoid for clearing your forehead breakouts.", tone: "PM" },
  { id: "p4", name: "Ceramide Moisturizer", brand: "CeraVe", category: "Moisturizer", price: "€18", reason: "Restores barrier between active ingredient layers.", tone: "AM + PM" },
  { id: "p5", name: "Mineral SPF 50", brand: "EltaMD UV Clear", category: "Sunscreen", price: "€38", reason: "Non-comedogenic, protects healing skin from PIH.", tone: "AM" },
  { id: "p6", name: "BHA 2% Exfoliant", brand: "Paula's Choice", category: "Exfoliant", price: "€34", reason: "Unclogs pores 2x weekly without disrupting barrier.", tone: "PM" },
];

export const findLesson = (id: string) => {
  for (const ch of course.chapters) {
    const l = ch.lessons.find((x) => x.id === id);
    if (l) return { lesson: l, chapter: ch };
  }
  return null;
};

export const allLessons = () => course.chapters.flatMap((c) => c.lessons.map((l) => ({ ...l, chapterId: c.id, chapterTitle: c.title })));
