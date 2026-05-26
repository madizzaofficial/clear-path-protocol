import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { course, allLessons } from "@/lib/course-data";
import { Play, Check, Sun, Moon, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil — Protocole Clear" },
      { name: "description", content: "Ton espace personnalisé pour suivre ton protocole peau." },
    ],
  }),
  component: Dashboard,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type RoutineStep = { id: string; category: string; product: string };

type SkinCheckEntry = "ok" | "moyen" | "probleme" | null;
type SkinCheckData = { acne: SkinCheckEntry; sensitivity: SkinCheckEntry; barrier: SkinCheckEntry };

type HomeData = {
  loading: boolean;
  completedLessons: string[];
  routine: { am: RoutineStep[]; pm: RoutineStep[] } | null;
  enrolledAt: number | null;
  checkedAm: string[];
  checkedPm: string[];
  firestoreDisplayName: string | null;
  skinCheck: SkinCheckData;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function getPosition(enrolledAt: number): { week: number; day: number } {
  const days = Math.max(1, Math.floor((Date.now() - enrolledAt) / 86_400_000) + 1);
  return { week: Math.ceil(days / 7), day: days };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 space-y-4 animate-pulse">
        <div className="h-7 w-40 rounded-lg bg-muted" />
        <div className="h-4 w-56 rounded-md bg-muted" />
        <div className="h-32 rounded-2xl bg-muted" />
        <div className="h-48 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<HomeData>({
    loading: true,
    completedLessons: [],
    routine: null,
    enrolledAt: null,
    checkedAm: [],
    checkedPm: [],
    firestoreDisplayName: null,
    skinCheck: { acne: null, sensitivity: null, barrier: null },
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const skinCheckDocId = `${user.uid}-${todayKey}`;

    Promise.allSettled([
      getDoc(doc(db, "progress", user.uid)),
      getDoc(doc(db, "routines", user.uid)),
      getDoc(doc(db, "users", user.uid)),
      getDoc(doc(db, "routine_checkins", user.uid, "days", todayKey)),
      getDoc(doc(db, "daily_checkins", skinCheckDocId)),
    ]).then(([progressRes, routineRes, userRes, todayRes, skinCheckRes]) => {
      const routineSnap = routineRes.status === "fulfilled" ? routineRes.value : null;
      const routineData = routineSnap?.exists() ? routineSnap.data() : null;
      const routine = routineData?.status === "sent"
        ? { am: routineData.am ?? [], pm: routineData.pm ?? [] } : null;

      const progressSnap = progressRes.status === "fulfilled" ? progressRes.value : null;
      const userSnap = userRes.status === "fulfilled" ? userRes.value : null;
      const todaySnap = todayRes.status === "fulfilled" ? todayRes.value : null;
      const skinCheckSnap = skinCheckRes.status === "fulfilled" ? skinCheckRes.value : null;
      const savedSkinCheck = skinCheckSnap?.exists() ? (skinCheckSnap.data().skinCheck ?? {}) : {};

      setData({
        loading: false,
        completedLessons: progressSnap?.exists() ? (progressSnap.data().completedLessons ?? []) : [],
        routine,
        enrolledAt: userSnap?.exists() ? (userSnap.data().enrolledAt ?? null) : null,
        checkedAm: todaySnap?.exists() ? (todaySnap.data().am ?? []) : [],
        checkedPm: todaySnap?.exists() ? (todaySnap.data().pm ?? []) : [],
        firestoreDisplayName: userSnap?.exists() ? (userSnap.data().displayName ?? null) : null,
        skinCheck: {
          acne: savedSkinCheck.acne ?? null,
          sensitivity: savedSkinCheck.sensitivity ?? null,
          barrier: savedSkinCheck.barrier ?? null,
        },
      });
    });
  }, [user?.uid]);

  const lessons = allLessons();
  const { loading, completedLessons, routine, enrolledAt, checkedAm, checkedPm, firestoreDisplayName, skinCheck } = data;

  async function saveSkinMetric(metric: keyof SkinCheckData, value: SkinCheckEntry) {
    if (!user || !value) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    setData((prev) => ({ ...prev, skinCheck: { ...prev.skinCheck, [metric]: value } }));
    try {
      await setDoc(doc(db, "daily_checkins", `${user.uid}-${todayKey}`), {
        uid: user.uid, date: todayKey, skinCheck: { [metric]: value },
      }, { merge: true });
    } catch { toast.error("Impossible de sauvegarder."); }
  }

  async function toggleStep(session: "am" | "pm", stepId: string) {
    if (!user) return;
    const field = session === "am" ? "checkedAm" : "checkedPm";
    const current = data[field];
    const updated = current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId];
    const newAm = session === "am" ? updated : data.checkedAm;
    const newPm = session === "pm" ? updated : data.checkedPm;
    setData((prev) => ({ ...prev, [field]: updated }));
    const total = (data.routine?.am.length ?? 0) + (data.routine?.pm.length ?? 0);
    if (total > 0 && newAm.length + newPm.length >= total) toast.success("Routine du jour complète ! 🎉");
    const key = new Date().toISOString().slice(0, 10);
    try {
      await setDoc(doc(db, "routine_checkins", user.uid, "days", key), { am: newAm, pm: newPm }, { merge: true });
    } catch { toast.error("Impossible de sauvegarder. Réessaie."); }
  }

  const done = completedLessons.length;
  const next = lessons.find((l) => !completedLessons.includes(l.id) && !l.locked);
  const allDone = done === lessons.length;
  const hasRoutine = (routine?.am.length ?? 0) + (routine?.pm.length ?? 0) > 0;
  const isNewUser = !loading && done === 0 && !hasRoutine;
  const progress = Math.round((done / lessons.length) * 100);

  if (authLoading || !user) return <DashboardSkeleton />;
  if (loading) return (
    <AppShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    </AppShell>
  );

  const firstName = (firestoreDisplayName ?? user.displayName)?.split(" ")[0] ?? "toi";
  const position = enrolledAt ? getPosition(enrolledAt) : { week: 1, day: 1 };

  const currentChapter = course.chapters.find((ch) => ch.lessons.some((l) => !completedLessons.includes(l.id)));
  const chapterDone = currentChapter
    ? currentChapter.lessons.filter((l) => completedLessons.includes(l.id)).length : 0;
  const routineAllDone = hasRoutine && checkedAm.length + checkedPm.length >= (routine?.am.length ?? 0) + (routine?.pm.length ?? 0);

  if (isNewUser) {
    return <AppShell><WelcomeState firstName={firstName} next={next} /></AppShell>;
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6">

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Semaine {position.week} · Jour {position.day}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {getGreeting()}, {firstName}.
          </h1>
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">

          {/* ── Main column ─────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* 1. Protocole */}
            {(next || allDone) && (
              <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
                <div className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Protocole · {progress}%
                    </p>
                    {currentChapter && (
                      <p className="mt-1 text-sm font-semibold">{currentChapter.title}</p>
                    )}
                    {next && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">→ {next.title}</p>
                    )}
                    {currentChapter && (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/50">
                      {chapterDone}/{currentChapter?.lessons.length ?? 0} leçons dans ce chapitre
                    </p>
                  </div>
                  {next ? (
                    <Link
                      to="/lesson/$lessonId"
                      params={{ lessonId: next.id }}
                      className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
                    >
                      <Play className="h-3.5 w-3.5 fill-primary-foreground" /> Reprendre
                    </Link>
                  ) : (
                    <Link to="/finish" className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90">
                      Terminé 🎉
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* 2. Routine du jour */}
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
              <div className="px-5 pt-5 pb-4">
                <h2 className="font-display text-lg font-semibold">Routine du jour</h2>
              </div>

              {!hasRoutine ? (
                <div className="px-5 pb-5">
                  <div className="rounded-2xl bg-muted/50 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Ton coach prépare ta routine personnalisée.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 px-5 pb-5">
                  {(routine!.am.length > 0) && (
                    <div>
                      <div className="mb-3 flex items-center gap-2 border-t border-border/40 pt-3">
                        <Sun className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matin</span>
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{checkedAm.length}/{routine!.am.length}</span>
                      </div>
                      <RoutineBlock steps={routine!.am} checked={checkedAm} onToggle={(id) => toggleStep("am", id)} />
                    </div>
                  )}
                  {(routine!.pm.length > 0) && (
                    <div>
                      <div className="mb-3 flex items-center gap-2 border-t border-border/40 pt-3">
                        <Moon className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Soir</span>
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{checkedPm.length}/{routine!.pm.length}</span>
                      </div>
                      <RoutineBlock steps={routine!.pm} checked={checkedPm} onToggle={(id) => toggleStep("pm", id)} />
                    </div>
                  )}
                  {routineAllDone && (
                    <div className="flex items-center justify-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium">
                      <Check className="h-4 w-4 text-primary" /> Routine complète pour aujourd'hui 🎉
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Skin check — mobile only (shown in sidebar on desktop) */}
            <div className="lg:hidden">
              <SkinCheckCard skinCheck={skinCheck} hasRoutine={hasRoutine} onSave={saveSkinMetric} />
            </div>

          </div>

          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <div className="mt-4 hidden lg:block lg:mt-0 space-y-4">
            <SkinCheckCard skinCheck={skinCheck} hasRoutine={hasRoutine} onSave={saveSkinMetric} />
            <PwaInstallBanner />
          </div>

        </div>

        <div className="mt-4 lg:hidden">
          <PwaInstallBanner />
        </div>

      </main>
    </AppShell>
  );
}

// ── Quick skin check card ─────────────────────────────────────────────────────

const SKIN_METRICS: {
  key: keyof SkinCheckData;
  label: string;
  options: { value: SkinCheckEntry; label: string; color: string; active: string }[];
}[] = [
  {
    key: "acne",
    label: "Acné",
    options: [
      { value: "ok", label: "Contrôlée", color: "text-emerald-600", active: "bg-emerald-500 text-white border-emerald-500" },
      { value: "moyen", label: "Légère", color: "text-amber-600", active: "bg-amber-400 text-white border-amber-400" },
      { value: "probleme", label: "Poussée", color: "text-red-500", active: "bg-red-400 text-white border-red-400" },
    ],
  },
  {
    key: "sensitivity",
    label: "Sensibilité",
    options: [
      { value: "ok", label: "Calme", color: "text-emerald-600", active: "bg-emerald-500 text-white border-emerald-500" },
      { value: "moyen", label: "Légère", color: "text-amber-600", active: "bg-amber-400 text-white border-amber-400" },
      { value: "probleme", label: "Réactive", color: "text-red-500", active: "bg-red-400 text-white border-red-400" },
    ],
  },
  {
    key: "barrier",
    label: "Barrière",
    options: [
      { value: "ok", label: "Solide", color: "text-emerald-600", active: "bg-emerald-500 text-white border-emerald-500" },
      { value: "moyen", label: "Normale", color: "text-amber-600", active: "bg-amber-400 text-white border-amber-400" },
      { value: "probleme", label: "Fragilisée", color: "text-red-500", active: "bg-red-400 text-white border-red-400" },
    ],
  },
];

function SkinCheckCard({ skinCheck, hasRoutine, onSave }: {
  skinCheck: SkinCheckData;
  hasRoutine: boolean;
  onSave: (metric: keyof SkinCheckData, value: SkinCheckEntry) => void;
}) {
  if (!hasRoutine) return null;
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
      <p className="mb-4 text-sm font-semibold">Comment va ta peau ?</p>
      <div className="space-y-4">
        {SKIN_METRICS.map((metric) => (
          <div key={metric.key}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{metric.label}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {metric.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSave(metric.key, opt.value)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium transition-all ${
                    skinCheck[metric.key] === opt.value
                      ? opt.active
                      : "border-border bg-background hover:bg-muted/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Routine block ─────────────────────────────────────────────────────────────

function RoutineBlock({ steps, checked, onToggle }: {
  steps: RoutineStep[]; checked: string[]; onToggle: (id: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {steps.map((s) => {
        const isChecked = checked.includes(s.id);
        return (
          <li
            key={s.id}
            onClick={() => onToggle(s.id)}
            className="flex cursor-pointer select-none items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-muted/60 active:bg-muted"
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
              isChecked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
            }`}>
              {isChecked && <Check className="h-3 w-3" />}
            </span>
            <span className={`flex-1 truncate ${isChecked ? "text-muted-foreground line-through" : ""}`}>
              {s.product}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Welcome state ─────────────────────────────────────────────────────────────

function WelcomeState({ firstName, next }: { firstName: string; next: ReturnType<typeof allLessons>[number] | undefined }) {
  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
      <section className="mb-10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Bienvenue</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Bonjour, {firstName}.
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Ton protocole commence ici. Voici comment transformer ta peau en 12 semaines.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {next ? (
            <Link to="/lesson/$lessonId" params={{ lessonId: next.id }} className="group block min-w-0">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-warm p-8 shadow-elegant md:p-10">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
                <div className="relative">
                  <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
                    <Play className="h-3 w-3 fill-primary text-primary" />
                    Commencer le protocole
                  </span>
                  <h2 className="mt-5 font-display text-2xl font-semibold md:text-3xl">{next.title}</h2>
                  <p className="mt-2 max-w-md text-sm text-foreground/70">{next.summary}</p>
                  <div className="mt-6 flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform group-hover:scale-[1.02]">
                      Commencer <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="overflow-hidden rounded-3xl bg-gradient-warm p-8 shadow-elegant">
              <p className="font-display text-xl font-semibold">Les leçons arrivent bientôt.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { n: "01", title: "Le protocole", body: "Des leçons progressives pour comprendre ta peau." },
              { n: "02", title: "Ta routine", body: "Une routine AM/PM personnalisée par ton coach." },
              { n: "03", title: "Tes progrès", body: "Photos et journal pour visualiser l'évolution." },
            ].map((c) => (
              <div key={c.n} className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
                <span className="font-display text-2xl font-semibold text-primary">{c.n}</span>
                <h3 className="mt-3 font-display text-base font-semibold">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">Ton coach prépare ta routine</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Tu recevras un email dès que ta routine est prête. En attendant, commence les leçons.
            </p>
            {next && (
              <Link
                to="/lesson/$lessonId"
                params={{ lessonId: next.id }}
                className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium transition-colors hover:bg-primary/20"
              >
                Commencer maintenant <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
