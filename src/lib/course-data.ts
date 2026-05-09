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
