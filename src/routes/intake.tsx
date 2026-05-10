import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Check, Loader2, Sparkles } from "lucide-react";
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
  concerns: string[];
  sensitivities: string[];
  usesSPF: string;
  routineComplexity: string;
  skinHistoryDuration: string;
  seenDermatologist: string;
  mainGoal: string;
};

const SKIN_TYPES = [
  { value: "normale", label: "Normale", desc: "Ni trop grasse, ni trop sèche, peu de réactivité" },
  { value: "grasse", label: "Grasse", desc: "Brillances fréquentes, pores dilatés, teint luisant" },
  { value: "seche", label: "Sèche", desc: "Tiraillements, inconfort, desquamation" },
  { value: "mixte", label: "Mixte", desc: "Zone T grasse, joues normales ou sèches" },
  { value: "sensible", label: "Sensible", desc: "Réactivité marquée, rougeurs, inconfort fréquent" },
];

const CONCERNS = [
  "Acné / Boutons",
  "Points noirs / Pores dilatés",
  "Rougeurs / Irritation",
  "Hyperpigmentation / Taches",
  "Rides / Perte de fermeté",
  "Texture irrégulière",
  "Teint terne / Manque d'éclat",
];

const SENSITIVITIES = [
  "Parfums",
  "Alcool",
  "AHA / BHA (acides exfoliants)",
  "Rétinol / Dérivés vitamine A",
  "Huiles essentielles",
  "Aucune sensibilité connue",
];

const STEPS = ["Type de peau", "Préoccupations", "Sensibilités", "Routine", "Objectif"];

function IntakePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<IntakeAnswers>({
    skinType: "",
    concerns: [],
    sensitivities: [],
    usesSPF: "",
    routineComplexity: "",
    skinHistoryDuration: "",
    seenDermatologist: "",
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

  function toggleMulti(field: "concerns" | "sensitivities", value: string) {
    setAnswers((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }

  function canAdvance(): boolean {
    if (step === 0) return !!answers.skinType;
    if (step === 1) return answers.concerns.length > 0;
    if (step === 2) return answers.sensitivities.length > 0;
    if (step === 3) return !!answers.usesSPF && !!answers.routineComplexity && !!answers.skinHistoryDuration;
    if (step === 4) return !!answers.seenDermatologist;
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
    navigate({ to: "/welcome" });
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      answers.skinType === t.value ? "border-primary bg-primary" : "border-border"
                    }`}
                  >
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
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Tes préoccupations principales ?</h1>
            <p className="mt-2 text-muted-foreground">Sélectionne tout ce qui te concerne actuellement.</p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {CONCERNS.map((c) => {
                const sel = answers.concerns.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleMulti("concerns", c)}
                    className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left text-sm transition-all ${
                      sel ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
                        sel ? "bg-primary" : "border border-border bg-muted"
                      }`}
                    >
                      {sel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </span>
                    {c}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">As-tu des sensibilités connues ?</h1>
            <p className="mt-2 text-muted-foreground">Ingrédients ou familles qui ont causé des réactions.</p>
            <div className="mt-8 space-y-3">
              {SENSITIVITIES.map((s) => {
                const sel = answers.sensitivities.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleMulti("sensitivities", s)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                      sel ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        sel ? "border-primary bg-primary" : "border-border"
                      }`}
                    >
                      {sel && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    <span className="text-sm font-medium">{s}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Ta routine actuelle</h1>
            <p className="mt-2 text-muted-foreground">Pour adapter le protocole à ton point de départ.</p>
            <div className="mt-8 space-y-7">
              <div>
                <p className="mb-3 text-sm font-semibold">Utilises-tu une protection solaire ?</p>
                <div className="flex gap-3">
                  {["Oui, tous les jours", "Parfois", "Pas encore"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAnswers((a) => ({ ...a, usesSPF: opt }))}
                      className={`flex-1 rounded-2xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                        answers.usesSPF === opt ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold">Combien d'étapes dans ta routine actuelle ?</p>
                <div className="flex gap-3">
                  {["1–2 étapes", "3–5 étapes", "6+ étapes"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAnswers((a) => ({ ...a, routineComplexity: opt }))}
                      className={`flex-1 rounded-2xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                        answers.routineComplexity === opt ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold">Depuis combien de temps as-tu des problèmes de peau ?</p>
                <div className="flex gap-3">
                  {["Moins d'un an", "1 à 3 ans", "Plus de 3 ans"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAnswers((a) => ({ ...a, skinHistoryDuration: opt }))}
                      className={`flex-1 rounded-2xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                        answers.skinHistoryDuration === opt ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Pour finir...</h1>
            <p className="mt-2 text-muted-foreground">Quelques infos pour mieux personnaliser ton suivi.</p>
            <div className="mt-8 space-y-7">
              <div>
                <p className="mb-3 text-sm font-semibold">As-tu déjà consulté un dermatologue ?</p>
                <div className="flex gap-3">
                  {["Oui", "Non", "En cours"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAnswers((a) => ({ ...a, seenDermatologist: opt }))}
                      className={`flex-1 rounded-2xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                        answers.seenDermatologist === opt ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold">Quel est ton objectif principal avec ta peau ? <span className="text-muted-foreground font-normal">(optionnel)</span></p>
                <textarea
                  placeholder="Ex : Réduire mon acné kystique, retrouver un teint uniforme, arrêter les rougeurs persistantes..."
                  value={answers.mainGoal}
                  onChange={(e) => setAnswers((a) => ({ ...a, mainGoal: e.target.value.slice(0, 1000) }))}
                  maxLength={1000}
                  className="min-h-28 w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">{answers.mainGoal.length}/1000</p>
              </div>
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
                  <Sparkles className="h-4 w-4" /> Commencer mon protocole
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
