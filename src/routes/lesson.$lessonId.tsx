import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { course, findLesson, allLessons } from "@/lib/course-data";
import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock, Download, FileText, Lock, Menu, Play, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const Route = createFileRoute("/lesson/$lessonId")({
  head: ({ params }) => {
    const found = findLesson(params.lessonId);
    return {
      meta: [
        { title: `${found?.lesson.title ?? "Leçon"} — Protocole Clear` },
        { name: "description", content: found?.lesson.summary ?? "Protocole Clear" },
      ],
    };
  },
  loader: ({ params }) => {
    const found = findLesson(params.lessonId);
    if (!found) throw notFound();
    return found;
  },
  component: LessonPage,
});

function LessonPage() {
  const { lesson, chapter } = Route.useLoaderData();
  const all = allLessons();
  const idx = all.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "progress", user.uid)).then((snap) => {
      if (snap.exists()) setCompletedLessons(snap.data().completedLessons ?? []);
    });
  }, [user]);

  if (loading || !user) return null;

  const isCompleted = completedLessons.includes(lesson.id);

  async function toggleComplete() {
    if (!user || marking) return;
    setMarking(true);
    const ref = doc(db, "progress", user.uid);
    await setDoc(
      ref,
      { completedLessons: isCompleted ? arrayRemove(lesson.id) : arrayUnion(lesson.id) },
      { merge: true }
    );
    setCompletedLessons((prev) =>
      isCompleted ? prev.filter((id) => id !== lesson.id) : [...prev, lesson.id]
    );
    setMarking(false);
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-80 shrink-0 border-r border-border/60 bg-sidebar lg:block">
        <SidebarContent currentId={lesson.id} completedLessons={completedLessons} />
      </aside>

      {/* Mobile sidebar */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85%] overflow-y-auto bg-sidebar shadow-elegant" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-4">
              <button onClick={() => setMenuOpen(false)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <SidebarContent currentId={lesson.id} completedLessons={completedLessons} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(true)} className="rounded-full p-2 hover:bg-muted lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/course" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Retour au protocole</span>
            </Link>
          </div>
          <div className="text-xs text-muted-foreground">
            Leçon {idx + 1} sur {all.length}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8 md:px-10 md:py-12">
          {/* Crumb */}
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">{chapter.title}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">{lesson.title}</h1>
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {lesson.duration}</span>
            {isCompleted && <span className="flex items-center gap-1.5 text-primary"><Check className="h-4 w-4" /> Terminée</span>}
          </div>

          {/* Video */}
          <div className="mt-8 overflow-hidden rounded-3xl bg-foreground shadow-elegant">
            <div className="relative aspect-video bg-gradient-primary">
              <div className="absolute inset-0 flex items-center justify-center">
                <button className="flex h-20 w-20 items-center justify-center rounded-full bg-background/95 shadow-elegant transition-transform hover:scale-105">
                  <Play className="ml-1 h-8 w-8 fill-foreground text-foreground" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/20">
                <div className="h-full w-1/3 bg-primary" />
              </div>
            </div>
          </div>

          {/* Content grid */}
          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <section>
                <h2 className="font-display text-xl font-semibold">Résumé</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">{lesson.summary}</p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Dans cette leçon, on explore les principes clés étape par étape. Prends des notes pendant le visionnage — tu les appliqueras directement dans ta routine via la liste ci-dessous.
                </p>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold">Liste de contrôle</h2>
                <div className="mt-4 space-y-2 rounded-2xl border border-border/60 bg-card p-5">
                  {[
                    "Regarder la vidéo en entier sans distraction",
                    "Prendre des photos de référence en lumière naturelle",
                    "Mettre à jour ta fiche routine du soir",
                    "Réfléchir aux déclencheurs dans tes notes",
                  ].map((item, i) => (
                    <label key={item} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-primary-soft/40">
                      <input type="checkbox" defaultChecked={i < 2} className="h-4 w-4 rounded border-border accent-[var(--primary)]" />
                      <span className="text-sm">{item}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold">Tes notes</h2>
                <textarea
                  placeholder="Note tes observations pendant le visionnage…"
                  className="mt-3 min-h-32 w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </section>
            </div>

            <aside className="space-y-6">
              {lesson.resources.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
                  <h3 className="font-display text-base font-semibold">Ressources</h3>
                  <ul className="mt-3 space-y-2">
                    {lesson.resources.map((r: { name: string; size: string }) => (
                      <li key={r.name}>
                        <button className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background p-3 text-left transition-colors hover:bg-primary-soft/40">
                          <FileText className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{r.name}</p>
                            <p className="text-xs text-muted-foreground">{r.size}</p>
                          </div>
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-2xl bg-gradient-warm p-5 shadow-soft">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">Ensuite</p>
                {next ? (
                  <Link to="/lesson/$lessonId" params={{ lessonId: next.id }} className="mt-2 block">
                    <p className="font-display text-base font-semibold">{next.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{next.duration}</p>
                  </Link>
                ) : (
                  <p className="mt-2 font-display text-base font-semibold">Protocole terminé 🎉</p>
                )}
              </div>
            </aside>
          </div>

          {/* Footer actions */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-8">
            {prev ? (
              <Link to="/lesson/$lessonId" params={{ lessonId: prev.id }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-xs uppercase tracking-wider">Précédent</p>
                  <p className="font-medium">{prev.title}</p>
                </div>
              </Link>
            ) : <div />}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleComplete}
                disabled={marking}
                className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                  isCompleted
                    ? "border-primary bg-primary-soft text-primary hover:bg-primary-soft/70"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                {isCompleted && <Check className="h-4 w-4" />}
                {isCompleted ? "Terminée" : "Marquer comme terminée"}
              </button>
              {next && (
                <Link to="/lesson/$lessonId" params={{ lessonId: next.id }} className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90">
                  Leçon suivante <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarContent({ currentId, completedLessons, onNavigate }: { currentId: string; completedLessons: string[]; onNavigate?: () => void }) {
  const initialOpen = course.chapters.find((c) => c.lessons.some((l) => l.id === currentId))?.id;
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(course.chapters.map((c) => [c.id, c.id === initialOpen]))
  );

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-border/60 p-6">
        <Link to="/" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary">
            <img src="/logo_clear.png" alt="Protocole Clear" className="h-full w-full rounded-full object-cover" />
          </div>
          <span className="font-display text-lg font-semibold">Protocole Clear</span>
        </Link>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">Protocole</p>
        <p className="mt-1 font-display text-base font-semibold leading-tight">{course.title}</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        {course.chapters.map((ch, i) => {
          const isOpen = open[ch.id];
          const cdone = ch.lessons.filter((l) => completedLessons.includes(l.id)).length;
          const cprog = Math.round((cdone / ch.lessons.length) * 100);
          return (
            <div key={ch.id} className="mb-2">
              <button
                onClick={() => setOpen((s) => ({ ...s, [ch.id]: !s[ch.id] }))}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-sidebar-accent"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{ch.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${cprog}%` }} />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{cprog}%</span>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <ul className="ml-3 mt-1 space-y-0.5 border-l border-border/60 pl-3">
                  {ch.lessons.map((l) => {
                    const active = l.id === currentId;
                    const done = completedLessons.includes(l.id);
                    return (
                      <li key={l.id}>
                        <Link
                          to={l.locked ? "/course" : "/lesson/$lessonId"}
                          params={l.locked ? undefined : { lessonId: l.id }}
                          onClick={onNavigate}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                            active ? "bg-primary-soft font-medium text-foreground" : l.locked ? "cursor-not-allowed text-muted-foreground/60" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                          }`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-primary text-primary-foreground" : l.locked ? "bg-muted" : active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            {done ? <Check className="h-3 w-3" /> : l.locked ? <Lock className="h-2.5 w-2.5" /> : active ? <Play className="h-2.5 w-2.5 fill-current" /> : null}
                          </span>
                          <span className="line-clamp-1 flex-1">{l.title}</span>
                          <span className="text-[10px] text-muted-foreground">{l.duration}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
