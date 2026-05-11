import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { course, allLessons } from "@/lib/course-data";
import { Play, Check, Sparkles, Sun, Moon, ArrowRight, TrendingUp, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

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

type HomeData = {
  loading: boolean;
  completedLessons: string[];
  routine: { am: RoutineStep[]; pm: RoutineStep[] } | null;
  enrolledAt: number | null;
  needsIntake: boolean;
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<HomeData>({
    loading: true,
    completedLessons: [],
    routine: null,
    enrolledAt: null,
    needsIntake: false,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!data.loading && data.needsIntake) navigate({ to: "/intake" });
  }, [data.loading, data.needsIntake, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getDoc(doc(db, "progress", user.uid)),
      getDoc(doc(db, "routines", user.uid)),
      getDoc(doc(db, "users", user.uid)),
      getDoc(doc(db, "intake_answers", user.uid)),
    ]).then(([progressSnap, routineSnap, userSnap, intakeSnap]) => {
      setData({
        loading: false,
        completedLessons: progressSnap.exists() ? (progressSnap.data().completedLessons ?? []) : [],
        routine: routineSnap.exists()
          ? { am: routineSnap.data().am ?? [], pm: routineSnap.data().pm ?? [] }
          : null,
        enrolledAt: userSnap.exists() ? (userSnap.data().enrolledAt ?? null) : null,
        needsIntake: !intakeSnap.exists(),
      });
    });
  }, [user]);

  const lessons = allLessons();
  const { loading, completedLessons, routine, enrolledAt, needsIntake } = data;

  const done = completedLessons.length;
  const progress = Math.round((done / lessons.length) * 100);
  const next = lessons.find((l) => !completedLessons.includes(l.id) && !l.locked);
  const allDone = done === lessons.length;

  if (authLoading || !user) return null;

  const firstName = user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "toi";
  const position = enrolledAt ? getPosition(enrolledAt) : { week: 1, day: 1 };
  const daysIn = enrolledAt ? Math.max(0, Math.floor((Date.now() - enrolledAt) / 86_400_000)) : null;

  const currentChapter = course.chapters.find((ch) =>
    ch.lessons.some((l) => !completedLessons.includes(l.id))
  );
  const chapterDone = currentChapter
    ? currentChapter.lessons.filter((l) => completedLessons.includes(l.id)).length
    : 0;

  const MILESTONES = [
    { label: "Photos de base & bilan peau", targetWeek: 1 },
    { label: "Routine entièrement intégrée", targetWeek: 2 },
    { label: "Premiers signes d'amélioration", targetWeek: 4 },
    { label: "Réduction visible des éruptions", targetWeek: 6 },
    { label: "Teint uniforme restauré", targetWeek: 10 },
  ];

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">

        {/* Intake banner */}
        {needsIntake && !loading && (
          <Link
            to="/intake"
            className="mb-8 flex items-center gap-4 rounded-2xl border border-border/60 bg-gradient-warm p-4 shadow-soft transition-shadow hover:shadow-elegant"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Complète ton bilan peau</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Aide ton coach à personnaliser ton protocole — 2 minutes
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}

        {/* Welcome header */}
        <section className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Semaine {position.week} · Jour {position.day}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            {getGreeting()}, {firstName}.
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            {allDone
              ? "Protocole terminé — tu as fait un travail incroyable. 🎉"
              : done === 0
              ? "Prêt à commencer ? Ta peau va te remercier."
              : `${done} leçon${done > 1 ? "s" : ""} terminée${done > 1 ? "s" : ""}. Continue sur cette lancée.`}
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── Main column ───────────────────────────────────────────────── */}
          <div className="lg:col-span-2">

            {/* Hero card */}
            {!allDone && next ? (
              <Link to="/lesson/$lessonId" params={{ lessonId: next.id }} className="group block">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-warm p-8 shadow-elegant md:p-10">
                  <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
                  <div className="relative">
                    <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
                      <Play className="h-3 w-3 fill-primary text-primary" />
                      {done === 0 ? "Commencer le protocole" : "Continuer"}
                    </span>
                    <h2 className="mt-5 font-display text-2xl font-semibold md:text-3xl">{next.title}</h2>
                    <p className="mt-2 max-w-md text-sm text-foreground/70">{next.summary}</p>
                    <div className="mt-6 flex items-center gap-4">
                      <div className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform group-hover:scale-[1.02]">
                        {done === 0 ? "Démarrer" : "Reprendre"} <ArrowRight className="h-4 w-4" />
                      </div>
                      <span className="text-sm text-foreground/60">{next.duration}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-8 shadow-elegant md:p-10">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-foreground/20 blur-3xl" />
                <div className="relative">
                  <p className="text-sm font-medium uppercase tracking-wider text-primary-foreground/80">Terminé</p>
                  <h2 className="mt-3 font-display text-3xl font-semibold text-primary-foreground">Félicitations ! 🎉</h2>
                  <p className="mt-2 text-primary-foreground/80">Tu as complété les {lessons.length} leçons du Clear Skin Protocol.</p>
                </div>
              </div>
            )}

            {/* Stats strip */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard
                icon={TrendingUp}
                label="Protocole"
                value={`${progress}%`}
                sub={`${done}/${lessons.length} leçons`}
              />
              <StatCard
                icon={Sparkles}
                label="Dans le protocole"
                value={daysIn !== null ? `J+${daysIn}` : "—"}
                sub={`Semaine ${position.week} sur 12`}
              />
              <StatCard
                icon={BookOpen}
                label="Chapitre en cours"
                value={currentChapter ? `${chapterDone}/${currentChapter.lessons.length}` : "✓"}
                sub={currentChapter ? currentChapter.title : "Protocole terminé"}
              />
            </div>

            {/* Milestones */}
            <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6 shadow-soft md:p-8">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold">Jalons de transformation</h3>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Semaine {position.week} / 12
                </span>
              </div>
              <div className="mt-6 space-y-4">
                {MILESTONES.map((m) => {
                  const isDone = position.week > m.targetWeek;
                  const isCurrent = position.week === m.targetWeek;
                  return (
                    <div key={m.label} className="flex items-center gap-4">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                          isDone
                            ? "border-primary bg-primary text-primary-foreground"
                            : isCurrent
                            ? "border-primary bg-primary-soft"
                            : "border-border bg-muted"
                        }`}
                      >
                        {isDone ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-[10px] font-semibold text-muted-foreground">S{m.targetWeek}</span>
                        )}
                      </div>
                      <p className={`flex-1 text-sm ${isDone ? "text-muted-foreground line-through" : "font-medium"}`}>
                        {m.label}
                      </p>
                      {isCurrent && (
                        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">
                          En cours
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Sidebar ───────────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Today's routine */}
            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
              <h3 className="font-display text-lg font-semibold">Routine du jour</h3>
              {loading ? (
                <div className="mt-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : !routine || (routine.am.length === 0 && routine.pm.length === 0) ? (
                <div className="mt-4 rounded-2xl bg-muted/50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Ton coach prépare ta routine personnalisée.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  {routine.am.length > 0 && (
                    <HomeRoutineBlock icon={Sun} label="Matin" steps={routine.am} />
                  )}
                  {routine.pm.length > 0 && (
                    <HomeRoutineBlock icon={Moon} label="Soir" steps={routine.pm} />
                  )}
                </div>
              )}
            </div>

            {/* Current chapter goal */}
            {currentChapter ? (
              <div className="rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-elegant">
                <p className="text-xs uppercase tracking-[0.2em] opacity-80">Objectif</p>
                <h3 className="mt-2 font-display text-xl font-semibold leading-tight">
                  {currentChapter.title}
                </h3>
                <p className="mt-2 text-sm opacity-90">
                  {currentChapter.lessons.length - chapterDone} leçon
                  {currentChapter.lessons.length - chapterDone > 1 ? "s" : ""} restante
                  {currentChapter.lessons.length - chapterDone > 1 ? "s" : ""}
                </p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20">
                  <div
                    className="h-full rounded-full bg-primary-foreground/90 transition-all"
                    style={{
                      width: `${Math.round((chapterDone / currentChapter.lessons.length) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft text-center">
                <p className="text-2xl">🏆</p>
                <p className="mt-3 font-display text-base font-semibold">Protocole complété</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Continue à prendre soin de ta peau.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function HomeRoutineBlock({ icon: Icon, label, steps }: { icon: any; label: string; steps: RoutineStep[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">{steps.length} étapes</span>
      </div>
      <ul className="space-y-2">
        {steps.slice(0, 4).map((s) => (
          <li key={s.id} className="flex items-center gap-3 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-background" />
            <span className="flex-1 truncate">{s.product}</span>
          </li>
        ))}
        {steps.length > 4 && (
          <li className="pl-8 text-xs text-muted-foreground">
            +{steps.length - 4} autre{steps.length - 4 > 1 ? "s" : ""}
          </li>
        )}
      </ul>
    </div>
  );
}
