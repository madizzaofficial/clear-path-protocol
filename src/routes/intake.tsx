import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Check, Loader2, Sparkles, ArrowRight, Camera, X } from "lucide-react";
import { inngest } from "@/lib/inngest";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const triggerIntakeEventFn = createServerFn({ method: "POST" })
  .inputValidator((d: { uid: string; email: string; firstName: string }) => d)
  .handler(async (ctx) => {
    await inngest.send({ name: "user/intake.completed", data: ctx.data });
  });

export const Route = createFileRoute("/intake")({
  head: () => ({ meta: [{ title: "Bilan peau — Protocole Clear" }] }),
  component: IntakePage,
});

type IntakeAnswers = {
  skinType: string;
  acneTypes: string[];
  intensity: string;
  currentRoutine: string;
  mainGoal: string;
};

type HelpContent = {
  title: string;
  intro: string;
  items: { label: string; text: string; imageSrc?: string }[];
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
  const [helpOpen, setHelpOpen] = useState<"skinType" | "acneTypes" | "intensity" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
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
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setPhotoFiles(newFiles);
    setPhotoPreviews(newPreviews);
  }

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

    const photoUrls: string[] = [];
    for (const file of photoFiles) {
      const storageRef = ref(storage, `intake_photos/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      photoUrls.push(await getDownloadURL(storageRef));
    }

    await setDoc(doc(db, "intake_answers", user.uid), {
      ...answers,
      mainGoal: answers.mainGoal.trim(),
      photoUrls,
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

        {step === 0 && (
          <>
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

        {step === 1 && (
          <>
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

        {step === 2 && (
          <>
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
            <p className="mt-2 text-muted-foreground">Deux dernières choses — toutes les deux optionnelles.</p>
            <div className="mt-8 space-y-8">
              {/* Objective */}
              <div>
                <p className="mb-2 text-sm font-semibold">
                  Ton objectif principal{" "}
                  <span className="font-normal text-muted-foreground">(optionnel)</span>
                </p>
                <textarea
                  placeholder="Ex. : Réduire mon acné kystique, retrouver un teint uniforme, arrêter les rougeurs persistantes…"
                  value={answers.mainGoal}
                  onChange={(e) => setAnswers((a) => ({ ...a, mainGoal: e.target.value.slice(0, 1000) }))}
                  maxLength={1000}
                  className="min-h-28 w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">{answers.mainGoal.length}/1000</p>
              </div>

              {/* Photo upload */}
              <div>
                <p className="mb-1 text-sm font-semibold">
                  Photos de ta peau{" "}
                  <span className="font-normal text-muted-foreground">(optionnel · 3 max)</span>
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Aide ton coach à visualiser l'état de ta peau pour personnaliser au mieux ta routine.
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

                <p className="text-xs text-muted-foreground">
                  {photoFiles.length}/3 photos
                  {photoFiles.length >= 3 && <span className="ml-1 font-medium text-primary">— limite atteinte</span>}
                </p>

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
