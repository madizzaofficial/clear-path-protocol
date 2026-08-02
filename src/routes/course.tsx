import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { course as staticCourse } from "@/lib/course-data";
import { useAuth } from "@/hooks/use-auth";
import { useRestrictedRedirect } from "@/hooks/use-restricted-redirect";
import { useEffect, useState } from "react";
import { Play, Check, Lock, Clock, ChevronRight, ArrowRight, Loader2 } from "lucide-react";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types (mirrored from admin course-editor) ─────────────────────────────

type FLesson = {
  id: string;
  title: string;
  duration: string;
  summary: string;
  videoUrl: string;
  locked: boolean;
  order: number;
};

type FChapter = {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: FLesson[];
};

type FCourse = {
  title: string;
  subtitle: string;
  estimatedHours: number;
  chapters: FChapter[];
};

const COURSE_ID = "clear-skin-protocol";

// ─── Route ─────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/course")({
  head: () => ({
    meta: [
      { title: "Le Protocole — Protocole Clear" },
      { name: "description", content: "Ton protocole guidé de 12 semaines contre l'acné." },
    ],
  }),
  component: CoursePage,
});

function CoursePage() {
  const { user, loading } = useAuth();
  const restricted = useRestrictedRedirect();
  const navigate = useNavigate();
  if (restricted) return null;
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [courseData, setCourseData] = useState<FCourse | null>(null);
  const [courseLoading, setCourseLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "progress", user.uid)).then((snap) => {
      if (snap.exists()) setCompletedLessons(snap.data().completedLessons ?? []);
    });
  }, [user]);

  useEffect(() => {
    async function load() {
      setCourseLoading(true);
      try {
        const snap = await getDocFromServer(doc(db, "courses", COURSE_ID));
        if (snap.exists()) {
          const data = snap.data() as FCourse;
          const sorted: FCourse = {
            ...data,
            chapters: [...data.chapters]
              .sort((a, b) => a.order - b.order)
              .map((ch) => ({ ...ch, lessons: [...ch.lessons].sort((a, b) => a.order - b.order) })),
          };
          setCourseData(sorted);
          return;
        }
      } catch {
        // network error — fall through to static fallback
      }
      setCourseData({
        title: staticCourse.title,
        subtitle: staticCourse.subtitle,
        estimatedHours: staticCourse.estimatedHours,
        chapters: staticCourse.chapters.map((ch, i) => ({
          id: ch.id,
          title: ch.title,
          description: ch.description,
          order: i,
          lessons: ch.lessons.map((l, j) => ({
            id: l.id,
            title: l.title,
            duration: l.duration,
            summary: l.summary,
            videoUrl: "",
            locked: l.locked,
            order: j,
          })),
        })),
      });
    }
    load().finally(() => setCourseLoading(false));
  }, []);

  if (loading || !user || courseLoading || !courseData) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const allLessons = courseData.chapters.flatMap((ch) => ch.lessons);
  const total = allLessons.length;
  const done = completedLessons.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const next = allLessons.find((l) => !completedLessons.includes(l.id) && !l.locked);

  return (
    <AppShell>
      <main className="pb-24">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60 bg-gradient-warm">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-6 py-16 md:py-24">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Ton protocole</p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              {courseData.title}
            </h1>
            <p className="mt-4 max-w-xl text-foreground/70 md:text-lg">{courseData.subtitle}</p>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm">
              <Stat label="Chapitres" value={String(courseData.chapters.length)} />
              <Stat label="Leçons" value={String(total)} />
              <Stat label="Durée totale" value={`${courseData.estimatedHours}h`} />
              <Stat label="Progression" value={`${progress}%`} />
            </div>
            <div className="mt-8 max-w-md">
              <div className="h-1.5 overflow-hidden rounded-full bg-background/60">
                <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* Resume banner */}
        {next && (
          <div className="border-b border-border/60 bg-background px-6 py-4 md:px-10">
            <div className="mx-auto max-w-7xl">
              <Link
                to="/lesson/$lessonId"
                params={{ lessonId: next.id }}
                className="group flex items-center justify-between gap-4 rounded-2xl bg-foreground px-6 py-4 text-background transition-opacity hover:opacity-90"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/15">
                    <Play className="h-4 w-4 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-background/60 uppercase tracking-wider">Reprendre là où tu t'es arrêté</p>
                    <p className="mt-0.5 truncate text-base font-semibold text-background">{next.title}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-full bg-background/15 px-5 py-2 text-sm font-semibold">
                  Continuer <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Chapters */}
        <section className="mx-auto max-w-7xl px-6 py-12">
          <div className="space-y-6">
            {courseData.chapters.map((ch, i) => {
              const cdone = ch.lessons.filter((l) => completedLessons.includes(l.id)).length;
              const cprog = ch.lessons.length > 0 ? Math.round((cdone / ch.lessons.length) * 100) : 0;
              return (
                <article key={ch.id} className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
                  <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 p-6 md:p-8">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-display text-sm font-medium text-primary">Chapitre {i + 1}</span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                        <span className="text-xs text-muted-foreground">{cdone}/{ch.lessons.length} terminée{cdone > 1 ? "s" : ""}</span>
                      </div>
                      <h2 className="mt-2 font-display text-2xl font-semibold">{ch.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{ch.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-muted sm:block">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${cprog}%` }} />
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{cprog}%</span>
                    </div>
                  </header>

                  <ul className="divide-y divide-border/60">
                    {ch.lessons.map((l, idx) => (
                      <li key={l.id}>
                        <Link
                          to={l.locked ? "/course" : "/lesson/$lessonId"}
                          params={l.locked ? undefined : { lessonId: l.id }}
                          className={`flex items-center gap-4 px-6 py-4 transition-colors md:px-8 ${
                            l.locked ? "cursor-not-allowed opacity-60" : "hover:bg-primary-soft/40"
                          }`}
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                              completedLessons.includes(l.id) ? "bg-primary text-primary-foreground" : l.locked ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary"
                            }`}
                          >
                            {completedLessons.includes(l.id) ? <Check className="h-4 w-4" /> : l.locked ? <Lock className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{idx + 1}. {l.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{l.summary}</p>
                          </div>
                          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                            <Clock className="h-3.5 w-3.5" /> {l.duration}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs uppercase tracking-wider text-foreground/60">{label}</p>
    </div>
  );
}
