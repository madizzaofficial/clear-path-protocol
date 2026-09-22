/**
 * Seed the LOCAL Firebase emulators with a test admin + a test student who has
 * a full example routine (paliers de fréquence, presets quantité, vidéos) +
 * nutrition, compléments et rappels ("à savoir").
 *
 * Safe by construction: talks only to the emulators via the *_EMULATOR_HOST env
 * vars below — never the real "methode-clear" project.
 *
 * Usage:
 *   1. npm run emulators   (terminal 1 — keep running)
 *   2. npm run seed:emu    (terminal 2 — once)
 *   3. npm run dev:emu     (terminal 3 — the app)
 *   Log in at http://localhost:8080/login with the credentials printed below.
 */

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8085";
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= "127.0.0.1:9199";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = "methode-clear";
const PASSWORD = "clear1234";
const ADMIN = { uid: "admin-test", email: "admin@clear.test", displayName: "Coach Test" };
const STUDENT = { uid: "eleve-test", email: "eleve@clear.test", displayName: "Camille Martin" };

const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

const DAY = 86_400_000;
const now = Date.now();
const DAILY = []; // jours = [] → tous les jours (cf. isDaily)

async function upsertUser({ uid, email, displayName }) {
  const data = { uid, email, password: PASSWORD, displayName, emailVerified: true };
  try {
    return await auth.createUser(data);
  } catch (e) {
    if (e.code === "auth/uid-already-exists" || e.code === "auth/email-already-exists") {
      await auth.updateUser(uid, { email, password: PASSWORD, displayName });
      return auth.getUser(uid);
    }
    throw e;
  }
}

// Routine d'exemple — exerce paliers, presets quantité, "à venir", vidéos.
const amSteps = [
  {
    id: "am-1", order: 0, category: "Nettoyant", product: "Gel Nettoyant Doux", brand: "La Roche-Posay",
    instructions: "Masser sur peau humide 30 s, puis rincer à l'eau tiède. Sécher en tamponnant.",
    amountPreset: "noisette",
    schedule: [{ fromWeek: 1, days: DAILY, moment: "am" }],
    whyThisProduct: "Nettoie sans décaper la barrière cutanée — la base avant les actifs.",
    purchaseUrl: "https://www.laroche-posay.fr/",
  },
  {
    id: "am-2", order: 1, category: "Sérum", product: "Sérum Niacinamide 10%", brand: "The Ordinary",
    instructions: "Appliquer sur peau propre et sèche. Attendre 60 s avant l'étape suivante.",
    amountPreset: "2-3-gouttes",
    schedule: [{ fromWeek: 1, days: DAILY, moment: "am" }],
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    whyThisProduct: "Régule le sébum et atténue les rougeurs.",
  },
  {
    id: "am-3", order: 2, category: "Traitement", product: "Acide Azélaïque 10%", brand: "The Ordinary",
    instructions: "Sur peau sèche, après le sérum. Commencer doucement pour laisser la peau s'habituer.",
    amountPreset: "noisette",
    schedule: [
      { fromWeek: 2, days: [0, 2, 4], moment: "am" },
      { fromWeek: 3, days: DAILY, moment: "am", note: "Si la peau tolère bien après une semaine." },
    ],
    whyThisProduct: "Anti-taches et anti-inflammatoire, très bien toléré.",
  },
  {
    id: "am-4", order: 3, category: "Sérum", product: "Sérum Vitamine C", brand: "SkinCeuticals",
    instructions: "Le matin, avant l'hydratant. Boost antioxydant et éclat.",
    amountPreset: "4-5-gouttes",
    schedule: [{ fromWeek: 5, days: DAILY, moment: "am" }],
    whyThisProduct: "Unifie le teint une fois la peau stabilisée.",
    purchaseUrl: "https://www.skinceuticals.fr/",
  },
  {
    id: "am-5", order: 4, category: "Protection solaire", product: "Fluide Solaire SPF 50+", brand: "Avène",
    instructions: "Dernière étape du matin. Réappliquer toutes les 2 h en cas d'exposition.",
    amountPreset: "2-doigts",
    schedule: [{ fromWeek: 1, days: DAILY, moment: "am" }],
    introNote: "Le geste anti-taches le plus important du protocole.",
  },
];

const pmSteps = [
  {
    id: "pm-1", order: 0, category: "Nettoyant", product: "Gel Nettoyant Doux", brand: "La Roche-Posay",
    instructions: "Double nettoyage si SPF ou maquillage. Rincer soigneusement.",
    amountPreset: "noisette",
    schedule: [{ fromWeek: 1, days: DAILY, moment: "pm" }],
  },
  {
    id: "pm-2", order: 1, category: "Traitement", product: "Adapalène 0,1%", brand: "Différine",
    instructions: "Sur peau parfaitement sèche. Éviter le contour des yeux. Un léger picotement est normal.",
    amountPreset: "noisette",
    schedule: [
      { fromWeek: 3, days: [0], moment: "pm" },
      { fromWeek: 5, days: [0, 3], moment: "pm" },
      { fromWeek: 7, days: [0, 2, 4], moment: "pm", note: "Palier maximal — ne pas dépasser 3×/semaine." },
    ],
    videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    introNote: "On monte en fréquence seulement si la peau tolère bien.",
  },
  {
    id: "pm-3", order: 2, category: "Hydratant", product: "Baume Réparateur", brand: "CeraVe",
    instructions: "Couche généreuse pour sceller les actifs et réparer pendant la nuit.",
    amountPreset: "grosse-noisette",
    schedule: [{ fromWeek: 1, days: DAILY, moment: "both" }],
  },
];

const extras = [
  {
    id: "extra-1", name: "Soin ciblé",
    steps: [
      {
        id: "ex-1", order: 0, category: "Masque", product: "Masque à l'argile", brand: "Sur zones grasses",
        instructions: "Poser 10 min sur la zone T, puis rincer. Un soir sans actif.",
        amountPreset: "couche-fine",
        schedule: [{ fromWeek: 1, days: [6], moment: "pm" }],
      },
    ],
  },
];

const phases = [
  { id: "p1", fromWeek: 1, toWeek: 2, title: "Reset", description: "On apaise et on renforce la barrière." },
  { id: "p2", fromWeek: 3, toWeek: 6, title: "Stabilisation", description: "Introduction progressive des actifs." },
  { id: "p3", fromWeek: 7, toWeek: 12, title: "Amélioration", description: "Montée en puissance du traitement." },
];

const nutrition = {
  toEat: [
    { id: "e1", label: "Poissons gras", emoji: "🐟" },
    { id: "e2", label: "Légumes verts", emoji: "🥦" },
    { id: "e3", label: "Fruits rouges", emoji: "🫐" },
    { id: "e4", label: "Eau (1,5 L/j)", emoji: "💧" },
  ],
  toAvoid: [
    { id: "a1", label: "Produits laitiers", emoji: "🥛" },
    { id: "a2", label: "Sucres rapides", emoji: "🍬" },
    { id: "a3", label: "Fritures", emoji: "🍟" },
  ],
  supplementsToTake: [
    { id: "s1", label: "Zinc", emoji: "💊", dosage: "15 mg/jour, au dîner" },
    { id: "s2", label: "Oméga-3", emoji: "🐟", dosage: "1000 mg/jour" },
    { id: "s3", label: "Vitamine D", emoji: "☀️", dosage: "2000 UI/jour l'hiver" },
  ],
  supplementsToAvoid: [
    { id: "sa1", label: "Biotine (B8)", emoji: "🚫", dosage: "peut aggraver l'acné" },
    { id: "sa2", label: "Whey / protéines lactées", emoji: "🥛", dosage: "favorise les poussées" },
  ],
  lifestyle: [
    { id: "l1", text: "Dors 7–8 h : la peau se répare la nuit.", emoji: "😴" },
    { id: "l2", text: "Change ta taie d'oreiller 2×/semaine.", emoji: "🛏️" },
    { id: "l3", text: "Évite de toucher/gratter les boutons.", emoji: "🙅" },
    { id: "l4", text: "Nettoie ton écran de téléphone régulièrement.", emoji: "📱" },
    { id: "l5", text: "Gère le stress : 10 min de marche ou de respiration.", emoji: "🧘" },
  ],
};

const reminders = [
  { id: "r1", text: "N'introduis qu'un seul nouveau produit à la fois.", emoji: "🧴" },
  { id: "r2", text: "Finis toujours le matin par la protection solaire.", emoji: "☀️" },
  { id: "r3", text: "Ne superpose jamais deux actifs forts le même soir.", emoji: "⚠️" },
  { id: "r4", text: "Un picotement léger est normal, une brûlure non — espace les applications.", emoji: "🌡️" },
];

// Écrit le "paquet client" complet pour un uid : dates + routine prête +
// intake + progress + nutrition (pour que /ma-routine et le rail s'affichent).
async function seedClientBundle(uid, email, displayName) {
  await db.collection("users").doc(uid).set(
    {
      uid, email, displayName,
      enrolledAt: now - 20 * DAY,
      routineStartedAt: now - 16 * DAY, // → semaine 3
      productOrderedAt: now - 18 * DAY,
      productReceivedAt: now - 14 * DAY,
      lastSeen: now - 1 * DAY,
    },
    { merge: true },
  );
  await db.collection("routines").doc(uid).set({
    uid, am: amSteps, pm: pmSteps, extras, phases,
    status: "sent", sentAt: now - 16 * DAY, updatedAt: now - 16 * DAY,
  });
  await db.collection("intake_answers").doc(uid).set({
    skinType: "mixte", acneTypes: ["papules", "comedons"], intensity: "moderee", completedAt: now - 19 * DAY,
  });
  await db.collection("progress").doc(uid).set({ completedLessons: [] });
  await db.collection("nutrition").doc(uid).set(nutrition);
  await db.collection("admin_skin_state").doc(uid).set({
    uid,
    inflammationPct: 45,
    barrierPct: 35,
    acnePct: 50,
    currentPhase: "stabilisation",
    coachPhrase:
      "Belle régularité cette semaine — on continue. L'azélaïque passe à tous les jours si la peau tient bien.",
    updatedAt: now,
  });
}

async function main() {
  const admin = await upsertUser(ADMIN);
  const student = await upsertUser(STUDENT);

  await seedClientBundle(student.uid, STUDENT.email, STUDENT.displayName);
  await seedClientBundle(admin.uid, ADMIN.email, ADMIN.displayName);
  await db.collection("users").doc(admin.uid).set({ is_admin: true, role: "admin" }, { merge: true });
  await db.collection("config").doc("admins").set({ uids: FieldValue.arrayUnion(admin.uid) }, { merge: true });

  // Rappels "à savoir" — globaux (config/reminders).
  await db.collection("config").doc("reminders").set({ items: reminders });

  console.log("\n✅ Émulateur seedé.\n");
  console.log("  Admin  →", ADMIN.email, "/", PASSWORD, "(fiches élèves + sa propre routine prête sur /ma-routine)");
  console.log("  Élève  →", STUDENT.email, "/", PASSWORD, "(voir /ma-routine, semaine 3)");
  console.log("\n  App : http://localhost:8080/login   ·   Émulateur UI : http://localhost:4000\n");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("❌ Seed échoué :", e);
  console.error("   Les émulateurs tournent-ils ? (npm run emulators)");
  process.exit(1);
});
