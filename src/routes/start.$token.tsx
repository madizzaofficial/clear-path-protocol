import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { db, storage } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { inngest } from "@/lib/inngest";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Sparkles,
  ArrowRight,
  Camera,
  X,
  Mail,
  Lock,
  User,
  LinkIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Server functions ──────────────────────────────────────────────────────────

const triggerSignUpFn = createServerFn({ method: "POST" })
  .inputValidator((d: { uid: string; email: string; firstName: string }) => d)
  .handler(async (ctx) => {
    await inngest.send({ name: "user/signed.up", data: ctx.data });
  });

const triggerIntakeFn = createServerFn({ method: "POST" })
  .inputValidator((d: { uid: string; email: string; firstName: string }) => d)
  .handler(async (ctx) => {
    await inngest.send({ name: "user/intake.completed", data: ctx.data });
  });

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/start/$token")({
  head: () => ({ meta: [{ title: "Bilan peau — Protocole Clear" }] }),
  component: OnboardingPage,
});

// ── Types & constants ─────────────────────────────────────────────────────────

type IntakeAnswers = {
  // Page 1-3
  skinType: string;
  acneTypes: string[];
  intensity: string;
  // Page 4 — Routine
  usesCleanser: boolean;
  usesMoisturizer: boolean;
  usesSPF: boolean;
  usesActives: boolean;
  activeProductsList: string;
  currentRoutine: string; // auto-generated summary for backward compat
  // Page 5 — Historique
  durationAcne: string;
  previousTreatments: string[];
  skinReactivity: string;
  // Page 6 — Objectif
  mainGoal: string;
  priorityGoal: string;
};

const SKIN_TYPES = [
  { value: "normale", label: "Normale", desc: "Ni trop grasse, ni trop sèche, peu de réactivité" },
  { value: "grasse", label: "Grasse", desc: "Brillances fréquentes, pores dilatés, teint luisant" },
  { value: "seche", label: "Sèche", desc: "Tiraillements, inconfort, desquamation" },
  { value: "mixte", label: "Mixte", desc: "Zone T grasse, joues normales ou sèches" },
  { value: "sensible", label: "Sensible", desc: "Réactivité marquée, rougeurs, inconfort fréquent" },
];

const ACNE_TYPES = [
  { value: "comedons", label: "Comédons", desc: "Points noirs et points blancs peu visibles" },
  { value: "papules", label: "Papules / Pustules", desc: "Boutons rouges ou avec du pus" },
  { value: "microkystes", label: "Microkystes", desc: "Petites bosses sous la peau, sans tête visible" },
  { value: "kystes", label: "Kystes / Nodules", desc: "Boutons profonds, douloureux, inflammatoires" },
];

const INTENSITY_OPTIONS = [
  { value: "legere", label: "Légère", desc: "Quelques boutons de temps en temps, peu visibles" },
  { value: "moderee", label: "Modérée", desc: "Zones visiblement touchées, apparition régulière" },
  { value: "severe", label: "Sévère", desc: "Inflammations fréquentes, étendues ou douloureuses" },
];

const ROUTINE_QUESTIONS: { key: "usesCleanser" | "usesMoisturizer" | "usesSPF" | "usesActives"; label: string }[] = [
  { key: "usesCleanser",    label: "Utilises-tu un nettoyant ?" },
  { key: "usesMoisturizer", label: "Utilises-tu une crème hydratante ?" },
  { key: "usesSPF",         label: "Utilises-tu une protection solaire ?" },
  { key: "usesActives",     label: "Utilises-tu des actifs ? (sérum, BHA, niacinamide…)" },
];

const DURATION_OPTIONS = [
  { value: "moins_3mois", label: "Moins de 3 mois" },
  { value: "3_12mois",    label: "3 à 12 mois" },
  { value: "1_3ans",      label: "1 à 3 ans" },
  { value: "plus_3ans",   label: "Plus de 3 ans" },
];

const TREATMENT_OPTIONS = [
  { value: "retinoides",       label: "Rétinoïdes" },
  { value: "benzoyl_peroxide", label: "Benzoyl peroxide" },
  { value: "antibiotiques",    label: "Antibiotiques" },
  { value: "aucun",            label: "Aucun" },
  { value: "autre",            label: "Autre" },
];

const PRIORITY_GOAL_OPTIONS = [
  { value: "boutons",     label: "Réduire les boutons actifs" },
  { value: "cicatrices",  label: "Estomper les cicatrices / marques" },
  { value: "teint",       label: "Unifier le teint" },
  { value: "sensibilite", label: "Calmer la sensibilité" },
];

const STEPS = [
  "Type de peau",
  "Types d'acné",
  "Intensité",
  "Routine actuelle",
  "Historique",
  "Ton objectif",
  "Photos",
  "Créer ton compte",
];

type HelpContent = {
  title: string;
  intro: string;
  items: { label: string; text: string }[];
};

const SKIN_TYPE_HELP: HelpContent = {
  title: "Les types de peau",
  intro: "Pour identifier ton type, observe ta peau 2–3 heures après le nettoyage, sans rien appliquer.",
  items: [
    { label: "Normale", text: "Teint uniforme, pores peu visibles, ni brillances ni tiraillements, confortable toute la journée." },
    { label: "Grasse", text: "Brillances fréquentes (front, nez, menton), pores dilatés visibles, tendance aux boutons." },
    { label: "Sèche", text: "Sensation de tiraillement après le lavage, peau parfois squameuse ou terne, inconfort fréquent." },
    { label: "Mixte", text: "Zone T (front, nez, menton) grasse avec brillances, joues normales ou sèches." },
    { label: "Sensible", text: "Rougeurs fréquentes, réactivité aux produits, picotements ou inconfort sans raison apparente." },
  ],
};

const ACNE_TYPE_HELP: HelpContent = {
  title: "Les types de boutons",
  intro: "Tu peux avoir plusieurs types en même temps — coche tout ce que tu reconnais sur ta peau.",
  items: [
    { label: "Comédons", text: "Points noirs (pores bouchés ouverts, noircis par oxydation) ou points blancs (petite bosse lisse, pore fermé, sans inflammation)." },
    { label: "Papules / Pustules", text: "Boutons rouges et surélevés (papules) ou avec un point blanc de pus au sommet (pustules). Souvent douloureux au toucher." },
    { label: "Microkystes", text: "Petites bosses dures sous la peau, sans tête visible, difficiles à éliminer seul." },
    { label: "Kystes / Nodules", text: "Boutons profonds, très enflammés, douloureux, parfois de la taille d'une bille. Risque de cicatrices si mal traités." },
  ],
};

const INTENSITY_HELP: HelpContent = {
  title: "Comment évaluer l'intensité",
  intro: "Compte les lésions actives (boutons, comédons) visibles sur l'ensemble du visage.",
  items: [
    { label: "Légère", text: "Moins de 10 lésions, peu ou pas d'inflammation, boutons isolés et peu fréquents." },
    { label: "Modérée", text: "Entre 10 et 30 lésions, zones visiblement touchées (front, menton, joues), apparitions régulières." },
    { label: "Sévère", text: "Plus de 30 lésions, ou présence de kystes/nodules, inflammations fréquentes, parfois douloureuses." },
  ],
};

// ── Main component ────────────────────────────────────────────────────────────

function normalizeRegError(code: string): string {
  const map: Record<string, string> = {
    "auth/email-already-in-use": "Cette adresse email est déjà utilisée.",
    "auth/invalid-email": "Adresse email invalide.",
    "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
    "auth/network-request-failed": "Erreur réseau. Vérifie ta connexion.",
    "auth/too-many-requests": "Trop de tentatives. Réessaie plus tard.",
  };
  return map[code] ?? "Une erreur est survenue. Réessaie.";
}

function OnboardingPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [tokenStatus, setTokenStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [showWelcome, setShowWelcome] = useState(true);
  const [recipientName, setRecipientName] = useState("");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>({
    skinType: "",
    acneTypes: [],
    intensity: "",
    usesCleanser: false,
    usesMoisturizer: false,
    usesSPF: false,
    usesActives: false,
    activeProductsList: "",
    currentRoutine: "",
    durationAcne: "",
    previousTreatments: [],
    skinReactivity: "",
    mainGoal: "",
    priorityGoal: "",
  });
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // Registration fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regError, setRegError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [helpOpen, setHelpOpen] = useState<"skinType" | "acneTypes" | "intensity" | null>(null);

  // If already logged in, go to dashboard (token links are for new users)
  useEffect(() => {
    if (!authLoading && user && tokenStatus === "valid") navigate({ to: "/" });
  }, [user, authLoading, tokenStatus, navigate]);

  // Validate token
  useEffect(() => {
    getDoc(doc(db, "onboarding_tokens", token)).then((snap) => {
      if (!snap.exists() || snap.data().used || snap.data().expiresAt < Date.now()) {
        setTokenStatus("invalid");
      } else {
        setRecipientName(snap.data().recipientName ?? "");
        setTokenStatus("valid");
      }
    });
  }, [token]);

  function toggleAcneType(value: string) {
    setAnswers((prev) => ({
      ...prev,
      acneTypes: prev.acneTypes.includes(value)
        ? prev.acneTypes.filter((v) => v !== value)
        : [...prev.acneTypes, value],
    }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []).filter(
      (f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024
    );
    const combined = [...photoFiles, ...incoming].slice(0, 3);
    photoPreviews.forEach((p) => URL.revokeObjectURL(p));
    setPhotoFiles(combined);
    setPhotoPreviews(combined.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  }

  function removePhoto(idx: number) {
    URL.revokeObjectURL(photoPreviews[idx]);
    const newFiles = photoFiles.filter((_, i) => i !== idx);
    setPhotoFiles(newFiles);
    setPhotoPreviews(newFiles.map((f) => URL.createObjectURL(f)));
  }

  function canAdvance(): boolean {
    if (step === 0) return !!answers.skinType;
    if (step === 1) return answers.acneTypes.length > 0;
    if (step === 2) return !!answers.intensity;
    if (step === 3) return true; // routine questions are all optional
    return true;
  }

  async function saveIntakeAndFinish(fbUser: FirebaseUser, nameOverride?: string) {
    const displayName = nameOverride ?? fbUser.displayName ?? "";

    // Atomic token claim: read + mark used in a single transaction.
    // If two accounts race on the same link, only one succeeds.
    await runTransaction(db, async (tx) => {
      const tokenRef = doc(db, "onboarding_tokens", token);
      const tokenSnap = await tx.get(tokenRef);
      if (!tokenSnap.exists() || tokenSnap.data().used || tokenSnap.data().expiresAt < Date.now()) {
        throw new Error("TOKEN_ALREADY_USED");
      }
      tx.update(tokenRef, { used: true, usedAt: Date.now(), usedBy: fbUser.uid });
    });

    const photoUrls: string[] = [];
    for (const file of photoFiles) {
      const storageRef = ref(storage, `intake_photos/${fbUser.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      photoUrls.push(await getDownloadURL(storageRef));
    }

    // Auto-generate currentRoutine summary for backward compat
    const routineParts = [
      answers.usesCleanser && "Nettoyant",
      answers.usesMoisturizer && "Hydratant",
      answers.usesSPF && "SPF",
      answers.usesActives && `Actifs${answers.activeProductsList.trim() ? ` (${answers.activeProductsList.trim()})` : ""}`,
    ].filter(Boolean);
    const currentRoutineSummary = routineParts.length > 0 ? routineParts.join(" + ") : "Rien";

    await setDoc(doc(db, "intake_answers", fbUser.uid), {
      ...answers,
      currentRoutine: currentRoutineSummary,
      mainGoal: answers.mainGoal.trim(),
      photoUrls,
      uid: fbUser.uid,
      completedAt: Date.now(),
    });

    await setDoc(
      doc(db, "users", fbUser.uid),
      {
        uid: fbUser.uid,
        email: fbUser.email ?? "",
        displayName,
        photoURL: fbUser.photoURL ?? null,
        enrolledAt: Date.now(),
        welcomeSeen: false,
      },
      { merge: true }
    );

    const firstName = displayName.split(" ")[0] || fbUser.email?.split("@")[0] || "";
    const eventPayload = { uid: fbUser.uid, email: fbUser.email ?? "", firstName };
    triggerSignUpFn({ data: eventPayload }).catch(() => {});
    triggerIntakeFn({ data: eventPayload }).catch(() => {});
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await saveIntakeAndFinish(credential.user, name);
      setSubmitted(true);
    } catch (err: any) {
      setRegError(normalizeRegError(err.code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setRegError("");
    setSubmitting(true);
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      await saveIntakeAndFinish(credential.user);
      setSubmitted(true);
    } catch (err: any) {
      setRegError(normalizeRegError(err.code));
    } finally {
      setSubmitting(false);
    }
  }

  // ── States ──────────────────────────────────────────────────────────────────

  if (authLoading || tokenStatus === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tokenStatus === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <LinkIcon className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Lien invalide</h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Ce lien a déjà été utilisé ou a expiré. Contacte ton coach pour recevoir un nouveau lien d'accès.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background px-6 py-16">
        <div className="mx-auto max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10 text-center"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary shadow-elegant">
              <Check className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Ton protocole est en cours de création</h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Nous analysons ton profil pour construire une routine parfaitement adaptée à ta peau.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 text-sm text-amber-700 font-medium">
              Délai estimé : 24 à 48 heures
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="mb-10 rounded-3xl border border-border/60 bg-card p-6 space-y-4"
          >
            {[
              "Analyse de tes réponses",
              "Analyse de tes photos (si fournies)",
              "Construction de ta routine personnalisée",
              "Vérification des compatibilités produits",
            ].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm font-medium">{item}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* EDIT: Remplace cette div par <video src="/onboarding-explainer.mp4" controls /> ou une iframe YouTube */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mb-10 overflow-hidden rounded-3xl border border-border/60 bg-muted aspect-video flex items-center justify-center"
          >
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary-soft flex items-center justify-center mx-auto">
                <ArrowRight className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">[EDIT : Ajoute ta vidéo d'explication ici]</p>
              <p className="text-xs text-muted-foreground/60">Comment fonctionne la plateforme · 30–90 sec</p>
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            onClick={() => navigate({ to: "/welcome" })}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-4 text-base font-semibold text-background shadow-elegant transition-all hover:opacity-90"
          >
            Accéder à mon espace <ArrowRight className="h-5 w-5" />
          </motion.button>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-background px-6 py-16 flex flex-col items-center justify-center">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-10 flex items-center gap-3">
            <img src="/logo_clear.png" alt="Protocole Clear" className="h-9 w-9 rounded-full object-cover" />
            <span className="font-display text-lg font-semibold">Protocole Clear</span>
          </div>

          <h1 className="font-display text-4xl font-semibold tracking-tight leading-tight mb-6">
            Bienvenue dans le Protocole Clear 👋
          </h1>

          <div className="space-y-4 text-base leading-relaxed text-muted-foreground mb-8">
            <p>
              {recipientName ? `Salut ${recipientName} 👋,` : "Salut 👋,"}
            </p>
            <p>
              Je suis vraiment heureux de t'accueillir dans le Protocole Clear.
            </p>
            <p>
              Tu viens de faire un premier pas important pour améliorer ta peau, et je vais t'accompagner tout au long du processus.
            </p>
            <p>
              Avant de commencer, j'ai besoin d'en apprendre un peu plus sur ta peau afin de construire un protocole réellement adapté à ta situation.
            </p>
            <p className="font-medium text-foreground">Le questionnaire prend environ 2 à 3 minutes.</p>
            <p>Réponds simplement et honnêtement, je m'occupe du reste.</p>
          </div>

          <div className="rounded-2xl bg-primary-soft border border-primary/20 px-5 py-4 text-sm text-primary/80 mb-8">
            À la fin, ton espace personnel sera prêt pendant que j'analyse ton profil et prépare ton protocole.
          </div>

          <button
            onClick={() => setShowWelcome(false)}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-4 text-base font-semibold text-background shadow-elegant transition-all hover:opacity-90"
          >
            Commencer mon analyse <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Header + progress */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo_clear.png" alt="Protocole Clear" className="h-7 w-7 rounded-full object-cover" />
              <span className="font-display text-base font-semibold">Protocole Clear</span>
            </div>
            <span className="text-xs text-muted-foreground">{step + 1} / {STEPS.length}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6 py-12">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">{STEPS[step]}</p>

        {/* Step 0 — Type de peau */}
        {step === 0 && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">On commence par comprendre ta peau actuelle.</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Quel est ton type de peau ?</h1>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-muted-foreground">Choisis celui qui te correspond le mieux en ce moment.</p>
              <HelpButton onClick={() => setHelpOpen("skinType")} />
            </div>
            <div className="mt-8 space-y-3">
              {SKIN_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setAnswers((a) => ({ ...a, skinType: t.value }))}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                    answers.skinType === t.value
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    answers.skinType === t.value ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {answers.skinType === t.value && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  <div>
                    <p className="font-semibold">{t.label}</p>
                    <p className="text-sm text-muted-foreground">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 1 — Type de boutons */}
        {step === 1 && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Tu peux sélectionner plusieurs réponses si besoin.</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Quel type de boutons as-tu ?</h1>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-muted-foreground">Tu peux en sélectionner plusieurs.</p>
              <HelpButton onClick={() => setHelpOpen("acneTypes")} />
            </div>
            <div className="mt-8 space-y-3">
              {ACNE_TYPES.map((t) => {
                const sel = answers.acneTypes.includes(t.value);
                return (
                  <button
                    key={t.value}
                    onClick={() => toggleAcneType(t.value)}
                    className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                      sel ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      sel ? "border-primary bg-primary" : "border-border"
                    }`}>
                      {sel && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    <div>
                      <p className="font-semibold">{t.label}</p>
                      <p className="text-sm text-muted-foreground">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Step 2 — Intensité */}
        {step === 2 && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Sois simplement honnête avec ton ressenti.</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Quelle est l'intensité ?</h1>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-muted-foreground">Décris ce que tu vis au quotidien avec ta peau.</p>
              <HelpButton onClick={() => setHelpOpen("intensity")} />
            </div>
            <div className="mt-8 space-y-3">
              {INTENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAnswers((a) => ({ ...a, intensity: opt.value }))}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                    answers.intensity === opt.value
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    answers.intensity === opt.value ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {answers.intensity === opt.value && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  <div>
                    <p className="font-semibold">{opt.label}</p>
                    <p className="text-sm text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3 — Routine actuelle */}
        {/* Step 3 — Routine actuelle */}
        {step === 3 && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Même si tu ne fais rien, c'est totalement OK.</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Ta routine actuelle</h1>
            <p className="mt-2 text-muted-foreground">Dis-moi ce que tu utilises déjà au quotidien.</p>
            <div className="mt-8 space-y-4">
              {ROUTINE_QUESTIONS.map((q) => {
                const val = answers[q.key];
                return (
                  <div key={q.key} className="rounded-2xl border-2 border-border p-4 space-y-3">
                    <p className="font-semibold">{q.label}</p>
                    <div className="flex gap-3">
                      {([true, false] as const).map((choice) => (
                        <button
                          key={String(choice)}
                          onClick={() => setAnswers((a) => ({ ...a, [q.key]: choice }))}
                          className={`flex-1 rounded-xl border-2 py-2 text-sm font-medium transition-all ${
                            val === choice
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          {choice ? "Oui" : "Non"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {answers.usesActives && (
                <div className="rounded-2xl border border-border p-4 space-y-2">
                  <p className="text-sm font-medium">Lesquels ? <span className="font-normal text-muted-foreground">(optionnel)</span></p>
                  <input
                    autoComplete="off"
                    type="text"
                    value={answers.activeProductsList}
                    onChange={(e) => setAnswers((a) => ({ ...a, activeProductsList: e.target.value }))}
                    placeholder="Ex : niacinamide, BHA, vitamine C…"
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 4 — Historique acné */}
        {step === 4 && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Ces informations m'aident à mieux comprendre ton profil.</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Ton historique</h1>
            <p className="mt-2 text-muted-foreground">Quelques questions sur ton parcours avec l'acné.</p>
            <div className="mt-8 space-y-8">

              {/* Duration */}
              <div>
                <p className="mb-3 text-sm font-semibold">Depuis combien de temps as-tu de l'acné ?</p>
                <div className="space-y-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAnswers((a) => ({ ...a, durationAcne: opt.value }))}
                      className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                        answers.durationAcne === opt.value ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        answers.durationAcne === opt.value ? "border-primary bg-primary" : "border-border"
                      }`}>
                        {answers.durationAcne === opt.value && <Check className="h-3 w-3 text-primary-foreground" />}
                      </span>
                      <p className="font-semibold">{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Previous treatments */}
              <div>
                <p className="mb-3 text-sm font-semibold">As-tu déjà essayé des traitements ? <span className="font-normal text-muted-foreground">(plusieurs choix possibles)</span></p>
                <div className="space-y-2">
                  {TREATMENT_OPTIONS.map((opt) => {
                    const sel = answers.previousTreatments.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setAnswers((a) => ({
                          ...a,
                          previousTreatments: sel
                            ? a.previousTreatments.filter((v) => v !== opt.value)
                            : [...a.previousTreatments, opt.value],
                        }))}
                        className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                          sel ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          sel ? "border-primary bg-primary" : "border-border"
                        }`}>
                          {sel && <Check className="h-3 w-3 text-primary-foreground" />}
                        </span>
                        <p className="font-semibold">{opt.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Skin reactivity */}
              <div>
                <p className="mb-3 text-sm font-semibold">Ta peau réagit-elle facilement aux nouveaux produits ?</p>
                <div className="flex gap-3">
                  {[{ value: "oui", label: "Oui, souvent" }, { value: "non", label: "Non, rarement" }].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAnswers((a) => ({ ...a, skinReactivity: opt.value }))}
                      className={`flex-1 rounded-2xl border-2 py-3 text-sm font-semibold transition-all ${
                        answers.skinReactivity === opt.value ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </>
        )}

        {/* Step 5 — Objectif */}
        {step === 5 && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Plus c'est précis, mieux c'est.</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Ton objectif</h1>
            <p className="mt-2 text-muted-foreground">Qu'est-ce que tu veux améliorer en priorité ?</p>
            <div className="mt-8 space-y-6">
              <div>
                <p className="mb-2 text-sm font-semibold">
                  Décris ton objectif <span className="font-normal text-muted-foreground">(optionnel)</span>
                </p>
                <textarea
                  placeholder="Ex. : Réduire mon acné kystique, retrouver un teint uniforme, arrêter les boutons sur le menton…"
                  value={answers.mainGoal}
                  onChange={(e) => setAnswers((a) => ({ ...a, mainGoal: e.target.value.slice(0, 1000) }))}
                  maxLength={1000}
                  className="min-h-28 w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">{answers.mainGoal.length}/1000</p>
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold">
                  Priorité principale <span className="font-normal text-muted-foreground">(optionnel)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_GOAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAnswers((a) => ({ ...a, priorityGoal: a.priorityGoal === opt.value ? "" : opt.value }))}
                      className={`rounded-2xl border-2 py-3 px-4 text-sm font-semibold transition-all text-left ${
                        answers.priorityGoal === opt.value ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 6 — Photos */}
        {step === 6 && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Optionnel, mais très utile pour affiner ton protocole.</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Photos de ta peau</h1>
            <p className="mt-2 text-muted-foreground">
              Envoie jusqu'à 3 photos de ton visage ou des zones concernées. Plus elles sont nettes, plus l'analyse sera précise.
            </p>
            <div className="mt-8 space-y-4">
              <div>
                <p className="mb-1 text-sm font-semibold">
                  Photos <span className="font-normal text-muted-foreground">(optionnel · 3 max)</span>
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Aide ton coach à visualiser l'état de ta peau pour personnaliser ta routine.
                </p>
                {photoPreviews.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-3">
                    {photoPreviews.map((url, i) => (
                      <div key={i} className="relative">
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="h-24 w-24 rounded-2xl object-cover border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background shadow"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {photoFiles.length < 3 && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-border px-5 py-4 transition-colors hover:border-primary/40 hover:bg-primary-soft/20">
                    <Camera className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Ajouter une photo</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG · max 10 Mo par photo</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </>
        )}

        {/* Step 7 — Créer ton compte */}
        {step === 7 && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Dernière étape avant ton analyse.</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Crée ton compte</h1>
            <p className="mt-2 text-muted-foreground">
              Ton bilan est prêt. Crée ton accès pour que ton coach puisse le consulter et préparer ta routine.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleEmailSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/80">Ton prénom et nom</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Ton nom complet"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm shadow-soft outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/80">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="toi@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm shadow-soft outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/80">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="Au moins 6 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm shadow-soft outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {regError && (
                <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{regError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-medium text-background shadow-elegant transition-all hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Créer mon compte et envoyer mon bilan
                  </>
                )}
              </button>

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-4 text-xs uppercase tracking-wider text-muted-foreground">ou</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={submitting}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card text-sm font-medium shadow-soft transition-colors hover:bg-muted disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continuer avec Google
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* Navigation — hidden on registration step */}
        {step < 7 && (
          <div className="mt-10 flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" /> Retour
              </button>
            ) : (
              <div />
            )}
            <button
              disabled={!canAdvance()}
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 disabled:opacity-40"
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Back button on registration step */}
        {step === 7 && (
          <button
            onClick={() => setStep(6)}
            className="mt-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Retour
          </button>
        )}
      </div>

      <HelpDialog help={SKIN_TYPE_HELP}  open={helpOpen === "skinType"}   onClose={() => setHelpOpen(null)} />
      <HelpDialog help={ACNE_TYPE_HELP}  open={helpOpen === "acneTypes"}  onClose={() => setHelpOpen(null)} />
      <HelpDialog help={INTENSITY_HELP}  open={helpOpen === "intensity"}  onClose={() => setHelpOpen(null)} />
    </div>
  );
}

function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">?</span>
      Aide
    </button>
  );
}

function HelpDialog({ help, open, onClose }: { help: HelpContent; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{help.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{help.intro}</p>
        <div className="mt-2 space-y-3">
          {help.items.map((item) => (
            <div key={item.label} className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
