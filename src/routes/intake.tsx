import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Check, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { inngest } from "@/lib/inngest";

const triggerIntakeEventFn = createServerFn({ method: "POST" }).handler(
  async (ctx) => {
    const d = ctx.data as unknown as { uid: string; email: string; firstName: string };
    await inngest.send({ name: "user/intake.completed", data: d });
  }
);

export const Route = createFileRoute("/intake")({
  head: () => ({ meta: [{ title: "Bilan peau — Lumen" }] }),
  component: IntakePage,
});

type IntakeAnswers = {
  skinType: string;
  acneTypes: string[];
  intensity: string;
  currentRoutine: string;
  mainGoal: string;
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

const CURRENT_ROUTINE_OPTIONS = [
  "Rien",
  "Nettoyant",
  "Nettoyant + SPF",
  "Nettoyant + Crème hydratante + SPF",
  "Nettoyant + Crème hydratante + SPF + Sérum",
];

const STEPS = ["Type de peau", "Type de boutons", "Intensité", "Routine actuelle", "Objectif"];

function IntakePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<IntakeAnswers>({
    skinType: "",
    acneTypes: [],
    intensity: "",
    currentRoutine: "",
    mainGoal: "",
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "intake_answers", user.uid)).then((snap) => {
      if (snap.exists()) navigate({ to: "/" });
    });
  }, [user, navigate]);

  function toggleAcneType(value: string) {
    setAnswers((prev) => ({
      ...prev,
      acneTypes: prev.acneTypes.includes(value)
        ? prev.acneTypes.filter((v) => v !== value)
        : [...prev.acneTypes, value],
    }));
  }

  function canAdvance(): boolean {
    if (step === 0) return !!answers.skinType;
    if (step === 1) return answers.acneTypes.length > 0;
    if (step === 2) return !!answers.intensity;
    if (step === 3) return !!answers.currentRoutine;
    if (step === 4) return true;
    return false;
  }

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    await setDoc(doc(db, "intake_answers", user.uid), {
      ...answers,
      mainGoal: answers.mainGoal.trim(),
      uid: user.uid,
      completedAt: Date.now(),
    });
    const firstName = user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "";
    triggerIntakeEventFn({
      data: { uid: user.uid, email: user.email ?? "", firstName },
    }).catch(() => {});
    setSubmitting(false);
    setSubmitted(true);
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary shadow-elegant">
            <Check className="h-7 w-7 text-primary-foreground" />
          </div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Bilan envoyé</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            On s'occupe de tout.
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Votre routine personnalisée est en cours de préparation. Vous recevrez un e-mail dès qu'elle sera disponible dans votre espace.
          </p>
          <button
            onClick={() => navigate({ to: "/welcome" })}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-3.5 text-base font-semibold text-background shadow-elegant transition-all hover:opacity-90"
          >
            Accéder à mon espace <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary">
                <span className="text-xs font-semibold text-primary-foreground">L</span>
              </div>
              <span className="font-display text-base font-semibold">Lumen</span>
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

        {step === 0 && (
          <>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Quel est ton type de peau ?</h1>
            <p className="mt-2 text-muted-foreground">Choisis celui qui te correspond le mieux en ce moment.</p>
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

        {step === 1 && (
          <>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Quel type de boutons as-tu ?</h1>
            <p className="mt-2 text-muted-foreground">Tu peux en sélectionner plusieurs.</p>
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

        {step === 2 && (
          <>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Quelle est l'intensité ?</h1>
            <p className="mt-2 text-muted-foreground">Décris ce que tu vis au quotidien avec ta peau.</p>
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

        {step === 3 && (
          <>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Ta routine actuelle</h1>
            <p className="mt-2 text-muted-foreground">Sélectionne ce qui décrit le mieux ce que tu fais aujourd'hui.</p>
            <div className="mt-8 space-y-3">
              {CURRENT_ROUTINE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAnswers((a) => ({ ...a, currentRoutine: opt }))}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                    answers.currentRoutine === opt
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    answers.currentRoutine === opt ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {answers.currentRoutine === opt && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  <p className="font-semibold">{opt}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Pour finir…</h1>
            <p className="mt-2 text-muted-foreground">Décris ton objectif principal en quelques mots.</p>
            <div className="mt-8">
              <textarea
                placeholder="Ex. : Réduire mon acné kystique, retrouver un teint uniforme, arrêter les rougeurs persistantes…"
                value={answers.mainGoal}
                onChange={(e) => setAnswers((a) => ({ ...a, mainGoal: e.target.value.slice(0, 1000) }))}
                maxLength={1000}
                className="min-h-36 w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{answers.mainGoal.length}/1000</p>
              <p className="mt-3 text-xs text-muted-foreground">Optionnel — mais très utile pour personnaliser ta routine.</p>
            </div>
          </>
        )}

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
          {step < STEPS.length - 1 ? (
            <button
              disabled={!canAdvance()}
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 disabled:opacity-40"
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              disabled={!canAdvance() || submitting}
              onClick={handleSubmit}
              className="flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-elegant transition-all hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Envoyer mon bilan
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
