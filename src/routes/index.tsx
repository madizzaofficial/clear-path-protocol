import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { course, allLessons } from "@/lib/course-data";
import { Play, Check, Sparkles, Sun, Moon, ArrowRight, TrendingUp, BookOpen, Flame, Send, Loader2, MessageSquare, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, addDoc,
  collection, getDocs, query, orderBy, limit, documentId, where,
} from "firebase/firestore";
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

// ── Constants ─────────────────────────────────────────────────────────────────

const MILESTONES = [
  { pct: 25, label: "Un quart du chemin ! 🌱", emoji: "🌱" },
  { pct: 50, label: "À mi-parcours ! 💪",      emoji: "💪" },
  { pct: 75, label: "Presque là ! 🚀",          emoji: "🚀" },
  { pct: 100, label: "Protocole terminé ! 🎉",  emoji: "🎉" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type RoutineStep = { id: string; category: string; product: string };
type CoachNote = { id: string; note: string; authorName: string; createdAt: string; isFromStudent?: boolean };

type HomeData = {
  loading: boolean;
  completedLessons: string[];
  routine: { am: RoutineStep[]; pm: RoutineStep[] } | null;
  enrolledAt: number | null;
  checkedAm: string[];
  checkedPm: string[];
  streak: number;
  monthCheckins: Record<string, { am: string[]; pm: string[] }>;
  firestoreDisplayName: string | null;
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

async function computeStreak(uid: string, totalSteps: number): Promise<number> {
  if (totalSteps === 0) return 0;

  const snaps = await getDocs(
    query(
      collection(db, "routine_checkins", uid, "days"),
      orderBy(documentId(), "desc"),
      limit(31),
    )
  );

  const doneSet = new Set<string>();
  snaps.forEach((snap) => {
    const d = snap.data();
    if ((d.am?.length ?? 0) + (d.pm?.length ?? 0) >= totalSteps) doneSet.add(snap.id);
  });

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 31; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (doneSet.has(key)) {
      streak++;
    } else if (i === 0) {
      continue; // today not yet done — don't break streak
    } else {
      break;
    }
  }

  return streak;
}

// ── Skeleton (rendu pendant l'initialisation Firebase) ────────────────────────

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 pb-28 pt-6 space-y-4 animate-pulse">
        <div className="h-7 w-40 rounded-lg bg-muted" />
        <div className="h-4 w-56 rounded-md bg-muted" />
        <div className="h-32 rounded-2xl bg-muted" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted" />)}
        </div>
        <div className="h-24 rounded-2xl bg-muted" />
        <div className="h-24 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [coachNotes, setCoachNotes] = useState<CoachNote[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [milestone, setMilestone] = useState<typeof MILESTONES[number] | null>(null);
  const [data, setData] = useState<HomeData>({
    loading: true,
    completedLessons: [],
    routine: null,
    enrolledAt: null,
    checkedAm: [],
    checkedPm: [],
    streak: 0,
    monthCheckins: {},
    firestoreDisplayName: null,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  if (authLoading) return <DashboardSkeleton />;

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const monthPrefix = now.toISOString().slice(0, 7);
    const monthStart = `${monthPrefix}-01`;
    const monthEnd = `${monthPrefix}-31`;

    Promise.allSettled([
      getDoc(doc(db, "progress", user.uid)),
      getDoc(doc(db, "routines", user.uid)),
      getDoc(doc(db, "users", user.uid)),
      getDoc(doc(db, "routine_checkins", user.uid, "days", todayKey)),
      getDocs(query(
        collection(db, "routine_checkins", user.uid, "days"),
        where(documentId(), ">=", monthStart),
        where(documentId(), "<=", monthEnd),
      )),
      getDocs(query(collection(db, "users", user.uid, "notes"), orderBy("createdAt", "desc"), limit(10))),
    ]).then(async ([progressRes, routineRes, userRes, todayRes, monthRes, notesRes]) => {
      const routineSnap = routineRes.status === "fulfilled" ? routineRes.value : null;
      const routineData = routineSnap?.exists() ? routineSnap.data() : null;
      const routine =
        routineData && routineData.status === "sent"
          ? { am: routineData.am ?? [], pm: routineData.pm ?? [] }
          : null;

      const totalSteps = (routine?.am.length ?? 0) + (routine?.pm.length ?? 0);
      const streak = await computeStreak(user.uid, totalSteps).catch(() => 0);

      const monthCheckins: Record<string, { am: string[]; pm: string[] }> = {};
      if (monthRes.status === "fulfilled") {
        monthRes.value.forEach((snap) => {
          monthCheckins[snap.id] = snap.data() as { am: string[]; pm: string[] };
        });
      }

      const progressSnap = progressRes.status === "fulfilled" ? progressRes.value : null;
      const userSnap = userRes.status === "fulfilled" ? userRes.value : null;
      const todaySnap = todayRes.status === "fulfilled" ? todayRes.value : null;

      if (notesRes.status === "fulfilled") {
        const allNotes = notesRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as CoachNote));
        setCoachNotes(allNotes.filter((n) => !n.isFromStudent).slice(0, 3));
      }

      setData({
        loading: false,
        completedLessons: progressSnap?.exists() ? (progressSnap.data().completedLessons ?? []) : [],
        routine,
        enrolledAt: userSnap?.exists() ? (userSnap.data().enrolledAt ?? null) : null,
        checkedAm: todaySnap?.exists() ? (todaySnap.data().am ?? []) : [],
        checkedPm: todaySnap?.exists() ? (todaySnap.data().pm ?? []) : [],
        streak,
        monthCheckins,
        firestoreDisplayName: userSnap?.exists() ? (userSnap.data().displayName ?? null) : null,
      });
    });
  }, [user]);

  const lessons = allLessons();
  const { loading, completedLessons, routine, enrolledAt, checkedAm, checkedPm, streak, monthCheckins, firestoreDisplayName } = data;

  const done = completedLessons.length;
  const progress = Math.round((done / lessons.length) * 100);

  useEffect(() => {
    if (data.loading || progress === 0) return;
    const last = parseInt(localStorage.getItem("lastMilestone") ?? "0");
    const reached = [...MILESTONES].reverse().find((m) => progress >= m.pct);
    if (reached && reached.pct > last) {
      localStorage.setItem("lastMilestone", String(reached.pct));
      setMilestone(reached);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      setTimeout(() => setMilestone(null), 4000);
    }
  }, [data.loading, progress]);

  const next = lessons.find((l) => !completedLessons.includes(l.id) && !l.locked);
  const allDone = done === lessons.length;

  if (authLoading || !user) return null;
  if (loading) return <AppShell><div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" /></div></AppShell>;

  const firstName = (firestoreDisplayName ?? user.displayName)?.split(" ")[0] ?? "toi";
  const position = enrolledAt ? getPosition(enrolledAt) : { week: 1, day: 1 };
  const daysIn = enrolledAt ? Math.max(0, Math.floor((Date.now() - enrolledAt) / 86_400_000)) : null;

  const currentChapter = course.chapters.find((ch) =>
    ch.lessons.some((l) => !completedLessons.includes(l.id))
  );
  const chapterDone = currentChapter
    ? currentChapter.lessons.filter((l) => completedLessons.includes(l.id)).length
    : 0;

  const totalRoutineSteps = (routine?.am.length ?? 0) + (routine?.pm.length ?? 0);
  const routineAllDone = totalRoutineSteps > 0 && checkedAm.length + checkedPm.length >= totalRoutineSteps;
  const hasRoutine = totalRoutineSteps > 0;
  const isNewUser = !loading && done === 0 && !hasRoutine;

  async function toggleStep(session: "am" | "pm", stepId: string) {
    if (!user) return;

    const field = session === "am" ? "checkedAm" : "checkedPm";
    const current = data[field];
    const updated = current.includes(stepId)
      ? current.filter((id) => id !== stepId)
      : [...current, stepId];

    const newAm = session === "am" ? updated : data.checkedAm;
    const newPm = session === "pm" ? updated : data.checkedPm;

    const total = (data.routine?.am.length ?? 0) + (data.routine?.pm.length ?? 0);
    const wasComplete = total > 0 && data.checkedAm.length + data.checkedPm.length >= total;
    const isNowComplete = total > 0 && newAm.length + newPm.length >= total;
    const newStreak = !wasComplete && isNowComplete ? data.streak + 1 : data.streak;

    setData((prev) => ({ ...prev, [field]: updated, streak: newStreak }));
    if (!wasComplete && isNowComplete) toast.success("Routine du jour complète ! 🎉");

    const key = new Date().toISOString().slice(0, 10);
    try {
      await setDoc(doc(db, "routine_checkins", user.uid, "days", key), { am: newAm, pm: newPm }, { merge: true });
    } catch {
      toast.error("Impossible de sauvegarder. Réessaie.");
    }
  }

  if (isNewUser) {
    return (
      <AppShell>
        <WelcomeState firstName={firstName} next={next} />
      </AppShell>
    );
  }

  async function sendReply(noteId: string) {
    if (!user || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      await addDoc(collection(db, "users", user.uid, "notes"), {
        note: replyText.trim(),
        authorUid: user.uid,
        authorName: user.displayName ?? user.email ?? "Moi",
        isFromStudent: true,
        createdAt: new Date().toISOString(),
      });
      setReplyText("");
      setReplyingTo(null);
      toast.success("Réponse envoyée.");
    } catch {
      toast.error("Impossible d'envoyer la réponse.");
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <AppShell>
      <AnimatePresence>
        {milestone && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-20 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-2xl bg-foreground px-6 py-3.5 text-background shadow-elegant"
          >
            <span className="text-2xl">{milestone.emoji}</span>
            <p className="text-sm font-semibold">{milestone.label}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">

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
          {allDone && (
            <div className="mt-4">
              <Link
                to="/finish"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
              >
                <Trophy className="h-4 w-4" /> Voir mon récap de fin
              </Link>
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── Hero card — row 1, col 1-2 ────────────────────────────────── */}
          {!allDone && next ? (
            <Link to="/lesson/$lessonId" params={{ lessonId: next.id }} className="group block min-w-0 lg:col-span-2">
              <div className="relative h-full overflow-hidden rounded-3xl bg-gradient-warm p-8 shadow-elegant md:p-10">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
                <div className="relative">
                  <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
                    <Play className="h-3 w-3 fill-primary text-primary" />
                    {done === 0 ? "Commencer le protocole" : "Continuer le protocole"}
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
            <div className="relative lg:col-span-2 overflow-hidden rounded-3xl bg-gradient-primary p-8 shadow-elegant md:p-10">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-foreground/20 blur-3xl" />
              <div className="relative">
                <p className="text-sm font-medium uppercase tracking-wider text-primary-foreground/80">Terminé</p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-primary-foreground">Félicitations ! 🎉</h2>
                <p className="mt-2 text-primary-foreground/80">Tu as complété les {lessons.length} leçons du Clear Skin Protocol.</p>
              </div>
            </div>
          )}

          {/* ── Routine du jour — row 1, col 3 ───────────────────────────── */}
          <div className="min-w-0 overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Routine du jour</h3>
              {streak > 0 && (
                <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-500 dark:bg-orange-950/40">
                  <Flame className="h-3.5 w-3.5" />
                  {streak}j
                </div>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : !routine || (routine.am.length === 0 && routine.pm.length === 0) ? (
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Ton coach prépare ta routine personnalisée.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-5">
                  {routine.am.length > 0 && (
                    <HomeRoutineBlock
                      icon={Sun}
                      label="Matin"
                      steps={routine.am}
                      checked={checkedAm}
                      onToggle={(id) => toggleStep("am", id)}
                    />
                  )}
                  {routine.pm.length > 0 && (
                    <HomeRoutineBlock
                      icon={Moon}
                      label="Soir"
                      steps={routine.pm}
                      checked={checkedPm}
                      onToggle={(id) => toggleStep("pm", id)}
                    />
                  )}
                </div>
                {routineAllDone && (
                  <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    Routine complète pour aujourd'hui
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Calendar — row 2, col 1-2 ─────────────────────────────────── */}
          <div className="lg:col-span-2">
            <RoutineCalendar
              totalSteps={totalRoutineSteps}
              monthCheckins={monthCheckins}
              checkedAm={checkedAm}
              checkedPm={checkedPm}
            />
          </div>

          {/* ── Progression — row 2, col 3 ────────────────────────────────── */}
          <ProtocolProgressCard
            progress={progress}
            done={done}
            total={lessons.length}
            week={position.week}
            currentChapter={currentChapter}
            chapterDone={chapterDone}
          />

          {/* ── Coach notes — row 3, full width ──────────────────────────── */}
          {coachNotes.length > 0 && (
            <div className="lg:col-span-3 rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Messages de ton coach
              </p>
              <div className="space-y-3">
                {coachNotes.map((n) => (
                  <div key={n.id} className="rounded-2xl bg-primary-soft/40 p-4">
                    <p className="text-sm text-foreground leading-relaxed">{n.note}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {n.authorName} · {new Date(n.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                      {replyingTo !== n.id && (
                        <button
                          onClick={() => { setReplyingTo(n.id); setReplyText(""); }}
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                        >
                          <MessageSquare className="h-3 w-3" /> Répondre
                        </button>
                      )}
                    </div>
                    {replyingTo === n.id && (
                      <div className="mt-3 flex items-end gap-2">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Ta réponse…"
                          rows={2}
                          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => sendReply(n.id)}
                            disabled={sendingReply || !replyText.trim()}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => setReplyingTo(null)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-xs text-muted-foreground transition-colors hover:bg-muted"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <PwaInstallBanner />
      </main>
    </AppShell>
  );
}

// ── Welcome state (new user, no routine, no lessons) ─────────────────────────

function WelcomeState({ firstName, next }: { firstName: string; next: ReturnType<typeof allLessons>[number] | undefined }) {

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">

      {/* Header */}
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

        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-6 lg:col-span-2">

          {/* Hero CTA */}
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
                      Commencer la première leçon <ArrowRight className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-foreground/60">{next.duration}</span>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-warm p-8 shadow-elegant md:p-10">
              <p className="font-display text-xl font-semibold">Les leçons arrivent bientôt.</p>
              <p className="mt-2 text-sm text-muted-foreground">Ton coach prépare le contenu de ton protocole.</p>
            </div>
          )}

          {/* 3 feature cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { n: "01", title: "Le protocole", body: "Des leçons courtes et progressives pour comprendre ta peau et adopter les bons gestes durablement." },
              { n: "02", title: "Ta routine", body: "Une routine AM/PM personnalisée par ton coach selon ton type de peau et tes objectifs." },
              { n: "03", title: "Tes progrès", body: "Photos hebdomadaires et journal de peau pour visualiser l'évolution semaine après semaine." },
            ].map((c) => (
              <div key={c.n} className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
                <span className="font-display text-2xl font-semibold text-primary">{c.n}</span>
                <h3 className="mt-3 font-display text-base font-semibold">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div>
          <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">Ton coach prépare ta routine</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Tu recevras un email dès que ta routine personnalisée est prête. En attendant, commence par les leçons du protocole — c'est la meilleure façon de démarrer.
            </p>
            {next && (
              <Link
                to="/lesson/$lessonId"
                params={{ lessonId: next.id }}
                className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-primary/20"
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

// ── Sub-components ────────────────────────────────────────────────────────────

function RoutineCalendar({
  totalSteps,
  monthCheckins,
  checkedAm,
  checkedPm,
}: {
  totalSteps: number;
  monthCheckins: Record<string, { am: string[]; pm: string[] }>;
  checkedAm: string[];
  checkedPm: string[];
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const monthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // Merge today's live checkin into the month map
  const todayKey = now.toISOString().slice(0, 10);
  const allCheckins = { ...monthCheckins, [todayKey]: { am: checkedAm, pm: checkedPm } };

  const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div className="h-full rounded-3xl border border-border/60 bg-card p-6 shadow-soft md:p-8">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold">Suivi de routine</h3>
        <span className="text-xs capitalize text-muted-foreground">{monthLabel}</span>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-0.5 grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const checkin = allCheckins[key];
          const isToday = day === today;
          const isFuture = day > today;

          let isDone = false;
          let isPartial = false;
          if (checkin && totalSteps > 0) {
            const checked = (checkin.am?.length ?? 0) + (checkin.pm?.length ?? 0);
            isDone = checked >= totalSteps;
            isPartial = checked > 0 && !isDone;
          }

          return (
            <div
              key={day}
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium transition-all ${
                isFuture
                  ? "text-muted-foreground/25"
                  : isDone
                  ? "bg-primary text-primary-foreground"
                  : isPartial
                  ? "bg-primary-soft text-primary"
                  : isToday
                  ? "ring-2 ring-primary text-foreground font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {isDone ? <Check className="h-3 w-3" /> : day}
            </div>
          );
        })}
      </div>

      {totalSteps > 0 && (
        <div className="mt-4 flex items-center gap-5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary" />
            Complète
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary-soft" />
            Partielle
          </div>
        </div>
      )}
    </div>
  );
}

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

function ProtocolProgressCard({
  progress,
  done,
  total,
  week,
  currentChapter,
  chapterDone,
}: {
  progress: number;
  done: number;
  total: number;
  week: number;
  currentChapter?: { title: string; lessons: { id: string }[] };
  chapterDone: number;
}) {
  const CIRCUMFERENCE = 314.16;
  const [offset, setOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setOffset(CIRCUMFERENCE * (1 - progress / 100));
    });
    return () => cancelAnimationFrame(frame);
  }, [progress]);

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Progression</p>

      {/* SVG Ring */}
      <div className="mt-4 flex justify-center">
        <div className="relative">
          <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10"
              stroke="currentColor" className="text-muted/40" />
            <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10"
              stroke="currentColor" className="text-primary" strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.8s ease" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-semibold">{progress}%</span>
            <span className="text-xs text-muted-foreground">{done}/{total} leçons</span>
          </div>
        </div>
      </div>

      {/* Week dots */}
      <div className="mt-5 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/60 w-5 shrink-0">S1</span>
          <div className="flex flex-1 items-center justify-center gap-1">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className={`h-2 w-2 rounded-full transition-colors ${i < week ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground/60 w-5 shrink-0 text-right">S12</span>
        </div>
        <p className="text-center text-xs text-muted-foreground">Semaine {week} sur 12</p>
      </div>

      {/* Chapter */}
      <div className="mt-5 border-t border-border/60 pt-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          Chapitre en cours
        </div>
        <p className="text-sm font-medium line-clamp-1">{currentChapter?.title ?? "Protocole terminé"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {chapterDone}/{currentChapter?.lessons.length ?? 0} leçons
        </p>
      </div>
    </div>
  );
}

function HomeRoutineBlock({
  icon: Icon,
  label,
  steps,
  checked,
  onToggle,
}: {
  icon: any;
  label: string;
  steps: RoutineStep[];
  checked: string[];
  onToggle: (id: string) => void;
}) {
  const doneCount = steps.filter((s) => checked.includes(s.id)).length;
  const allDone = doneCount === steps.length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className={`text-xs font-medium tabular-nums ${allDone ? "text-primary" : "text-muted-foreground"}`}>
          {doneCount}/{steps.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {steps.map((s) => {
          const isChecked = checked.includes(s.id);
          return (
            <li
              key={s.id}
              onClick={() => onToggle(s.id)}
              className="flex min-w-0 cursor-pointer select-none items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-muted/60 active:bg-muted"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                  isChecked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                }`}
              >
                {isChecked && <Check className="h-3 w-3" />}
              </span>
              <span
                className={`flex-1 truncate transition-colors duration-150 ${
                  isChecked ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                {s.product}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
