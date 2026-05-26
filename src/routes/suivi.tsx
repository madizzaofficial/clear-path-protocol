import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { allLessons } from "@/lib/course-data";
import {
  BookOpen, Camera, CalendarDays, MessageSquare, ChevronRight, Loader2,
  Flame, Sparkles, Phone, Check,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/suivi")({
  head: () => ({
    meta: [
      { title: "Mon Suivi — Protocole Clear" },
      { name: "description", content: "Ton état de peau, ta progression et ton coaching." },
    ],
  }),
  component: Suivi,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminSkinState = {
  uid: string;
  inflammationPct?: number;
  barrierPct?: number;
  acnePct?: number;
  currentPhase?: "reset" | "stabilisation" | "purge" | "amélioration";
  coachPhrase?: string;
  nextCallDate?: string;
  nextCallTime?: string;
  updatedAt: number;
};

type CoachNote = { id: string; note: string; authorName: string; createdAt: string; isFromStudent?: boolean };
type PhotoEntry = { uid: string; date: string; front?: string; left?: string; right?: string };

type SuiviData = {
  loading: boolean;
  skinState: AdminSkinState | null;
  completedLessons: string[];
  enrolledAt: number | null;
  totalRoutineSteps: number;
  checkins28: Record<string, { am: string[]; pm: string[] }>;
  adherencePct: number;
  adherenceDays: number;
  streak: number;
  latestNote: CoachNote | null;
  photos: PhotoEntry[];
  skinType: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKIN_TYPE_LABELS: Record<string, string> = {
  normale: "Normale", grasse: "Grasse", seche: "Sèche", mixte: "Mixte", sensible: "Sensible",
};

function getSkincareWeek(enrolledAt: number): number {
  const days = Math.max(1, Math.floor((Date.now() - enrolledAt) / 86_400_000) + 1);
  return Math.ceil(days / 7);
}

function getDaysUntil(isoDate: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const t = new Date(isoDate); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86_400_000);
}

function formatCallDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function computeAdherence(
  checkins28: Record<string, { am: string[]; pm: string[] }>,
  totalSteps: number,
): { pct: number; days: number; streak: number } {
  if (totalSteps === 0) return { pct: 0, days: 0, streak: 0 };
  const today = new Date();
  let days = 0, streak = 0;
  let streakBroken = false;
  for (let i = 0; i < 28; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const c = checkins28[key];
    const done = c && (c.am?.length ?? 0) + (c.pm?.length ?? 0) >= totalSteps;
    if (done) { days++; if (!streakBroken) streak++; }
    else if (i === 0) { /* today may not be done yet */ }
    else { streakBroken = true; }
  }
  return { pct: Math.round((days / 28) * 100), days, streak };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const JOURNEY_PHASES = [
  { id: 1, shortLabel: "S.1", label: "Semaine 1", description: "Tu démarres ta nouvelle routine.", dayStart: 1, dayEnd: 7 },
  { id: 2, shortLabel: "S.2", label: "Semaine 2", description: "Ta peau s'adapte. Tu trouves le rythme.", dayStart: 8, dayEnd: 14 },
  { id: 3, shortLabel: "S3-4", label: "Semaines 3–4", description: "La purge peut commencer — c'est bon signe.", dayStart: 15, dayEnd: 28 },
  { id: 4, shortLabel: "S4-6", label: "Semaines 4–6", description: "La purge se calme. Les premières améliorations arrivent.", dayStart: 29, dayEnd: 42 },
  { id: 5, shortLabel: "S6-12", label: "Semaines 6–12", description: "La peau s'éclaircit progressivement.", dayStart: 43, dayEnd: 84 },
  { id: 6, shortLabel: "M3+", label: "Mois 3+", description: "Intègre un soin ciblé pour les marques.", dayStart: 85, dayEnd: Infinity },
];

function CircleMetric({ label, emoji, pct, inverted }: { label: string; emoji: string; pct: number; inverted?: boolean }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const arcClass = inverted
    ? pct >= 67 ? "text-red-400" : pct >= 34 ? "text-amber-400" : "text-emerald-500"
    : pct >= 67 ? "text-emerald-500" : pct >= 34 ? "text-amber-400" : "text-red-400";
  const numClass = inverted
    ? pct >= 67 ? "text-red-500 dark:text-red-400" : pct >= 34 ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
    : pct >= 67 ? "text-emerald-600 dark:text-emerald-400" : pct >= 34 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-[88px] w-[88px]">
        <svg viewBox="0 0 80 80" className="-rotate-90 h-full w-full">
          <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" />
          <circle
            cx="40" cy="40" r={r}
            fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"
            className={arcClass}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.7s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-xl leading-none">{emoji}</span>
          <span className={`text-sm font-bold tabular-nums leading-tight ${numClass}`}>{pct}</span>
        </div>
      </div>
      <span className="text-center text-xs font-medium text-foreground/70">{label}</span>
    </div>
  );
}

function MiniWeekDots({
  checkins28,
  totalSteps,
}: {
  checkins28: Record<string, { am: string[]; pm: string[] }>;
  totalSteps: number;
}) {
  const today = new Date();
  const dots = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (27 - i));
    const isFuture = d > today;
    const key = d.toISOString().slice(0, 10);
    const c = checkins28[key];
    const sum = c ? (c.am?.length ?? 0) + (c.pm?.length ?? 0) : 0;
    const done = totalSteps > 0 && sum >= totalSteps;
    const partial = !done && sum > 0;
    return { isFuture, done, partial };
  });
  return (
    <div className="grid grid-cols-7 gap-1">
      {dots.map((dot, i) => (
        <div
          key={i}
          className={`h-3 w-full rounded-sm ${
            dot.isFuture ? "bg-muted/20" : dot.done ? "bg-primary" : dot.partial ? "bg-primary/30" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function Suivi() {
  const { user } = useAuth();
  const [data, setData] = useState<SuiviData>({
    loading: true,
    skinState: null,
    completedLessons: [],
    enrolledAt: null,
    totalRoutineSteps: 0,
    checkins28: {},
    adherencePct: 0,
    adherenceDays: 0,
    streak: 0,
    latestNote: null,
    photos: [],
    skinType: null,
  });

  useEffect(() => {
    if (!user) return;
    async function load() {
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      const start28 = new Date(today);
      start28.setDate(today.getDate() - 27);
      const start28Key = start28.toISOString().slice(0, 10);

      const results = await Promise.allSettled([
        getDoc(doc(db, "admin_skin_state", user!.uid)),
        getDoc(doc(db, "progress", user!.uid)),
        getDoc(doc(db, "users", user!.uid)),
        getDoc(doc(db, "routines", user!.uid)),
        getDocs(query(collection(db, "users", user!.uid, "notes"), orderBy("createdAt", "desc"), limit(5))),
        getDocs(query(collection(db, "progress_photos"), where("uid", "==", user!.uid))),
        getDoc(doc(db, "intake_answers", user!.uid)),
      ]);

      const checkins28Snap = await getDocs(
        query(
          collection(db, "routine_checkins", user!.uid, "days"),
          where("__name__", ">=", start28Key),
          where("__name__", "<=", todayKey),
        ),
      ).catch(() => null);

      const get = (i: number) =>
        results[i].status === "fulfilled" ? (results[i] as PromiseFulfilledResult<any>).value : null;

      const skinStateSnap = get(0);
      const progressSnap = get(1);
      const userSnap = get(2);
      const routineSnap = get(3);
      const notesSnap = get(4);
      const photosSnap = get(5);
      const intakeSnap = get(6);

      const checkins28: Record<string, { am: string[]; pm: string[] }> = {};
      checkins28Snap?.forEach((d: any) => { checkins28[d.id] = d.data(); });

      const routineData = routineSnap?.exists() ? routineSnap.data() : null;
      const totalRoutineSteps =
        routineData?.status === "sent"
          ? (routineData.am?.length ?? 0) + (routineData.pm?.length ?? 0)
          : 0;

      const { pct, days, streak } = computeAdherence(checkins28, totalRoutineSteps);

      const allNotes: CoachNote[] = notesSnap?.docs.map((d: any) => ({ id: d.id, ...d.data() })) ?? [];
      const latestNote = allNotes.find((n) => !n.isFromStudent) ?? null;

      const allPhotos: PhotoEntry[] = photosSnap?.docs.map((d: any) => d.data() as PhotoEntry) ?? [];
      const photos = [...allPhotos]
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, 3);

      setData({
        loading: false,
        skinState: skinStateSnap?.exists() ? (skinStateSnap.data() as AdminSkinState) : null,
        completedLessons: progressSnap?.exists() ? (progressSnap.data().completedLessons ?? []) : [],
        enrolledAt: userSnap?.exists() ? (userSnap.data().enrolledAt ?? null) : null,
        totalRoutineSteps,
        checkins28,
        adherencePct: pct,
        adherenceDays: days,
        streak,
        latestNote,
        photos,
        skinType: intakeSnap?.exists() ? (intakeSnap.data().skinType ?? null) : null,
      });
    }
    load().catch(() => setData((d) => ({ ...d, loading: false })));
  }, [user?.uid]);

  const {
    loading, skinState, completedLessons, enrolledAt, totalRoutineSteps,
    checkins28, adherencePct, adherenceDays, streak, latestNote, photos, skinType,
  } = data;

  const lessons = allLessons();
  const done = completedLessons.length;
  const total = lessons.length;
  const protocolPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const dayCount = enrolledAt ? Math.max(1, Math.floor((Date.now() - enrolledAt) / 86_400_000) + 1) : 1;
  const currentPhase = JOURNEY_PHASES.find((p) => dayCount >= p.dayStart && dayCount <= p.dayEnd) ?? JOURNEY_PHASES[JOURNEY_PHASES.length - 1];
  const nextLesson = lessons.find((l) => !completedLessons.includes(l.id));
  const daysUntilCall = skinState?.nextCallDate ? getDaysUntil(skinState.nextCallDate) : null;

  const hasSkinMetrics =
    skinState &&
    (skinState.inflammationPct !== undefined ||
      skinState.barrierPct !== undefined ||
      skinState.acnePct !== undefined);

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6">
        {/*
          DOM order = mobile order: 1→2→3→4→5→6
          Desktop: explicit col-start/row-start repositions sections into 3-col grid
          col 1-2: Header(r1) · Évolution(r2) · Progression(r3) · Journal(r4)
          col 3:   Coaching(r1) · Feedback(r2)
        */}
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">

          {/* ── 1. Journey hero ─────────────────────── col-span-2 row-1 ── */}
          <div className="overflow-hidden rounded-3xl bg-gradient-warm p-6 shadow-elegant lg:col-span-2 lg:row-start-1">
            {/* Day count + skin type */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50">Mon parcours</p>
                <h1 className="mt-1 font-display text-5xl font-semibold leading-none">Jour {dayCount}</h1>
              </div>
              {skinType && (
                <span className="mt-1 rounded-full bg-background/60 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  Peau {(SKIN_TYPE_LABELS[skinType] ?? skinType).toLowerCase()}
                </span>
              )}
            </div>

            {/* Current phase name + description */}
            <div className="mt-4">
              <p className="text-base font-semibold">{currentPhase.label}</p>
              <p className="mt-0.5 max-w-sm text-sm text-foreground/70">{currentPhase.description}</p>
              {skinState?.coachPhrase && (
                <p className="mt-2 text-sm italic text-foreground/60">"{skinState.coachPhrase}"</p>
              )}
              <span className="mt-3 inline-flex items-center rounded-full bg-background/50 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                Phase {currentPhase.id}/6
              </span>
            </div>
          </div>

          {/* ── 2. État de ta peau ─────────────── col-span-2 row-2 ── */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft lg:col-span-2 lg:row-start-2">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                État de ta peau
              </p>
              {skinState?.updatedAt && (
                <p className="text-[10px] text-muted-foreground/50">
                  mis à jour{" "}
                  {new Date(skinState.updatedAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}
            </div>

            {hasSkinMetrics ? (
              <div>
                <div className="grid grid-cols-3 gap-4">
                  <CircleMetric label="Inflammation" emoji="🔥" pct={skinState!.inflammationPct ?? 0} inverted />
                  <CircleMetric label="Barrière" emoji="🧱" pct={skinState!.barrierPct ?? 0} />
                  <CircleMetric label="Acné" emoji="🧴" pct={skinState!.acnePct ?? 0} inverted />
                </div>
                {skinState!.currentPhase && (
                  <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Phase coach</span>
                    <span className="rounded-full bg-primary-soft px-3 py-0.5 text-xs font-semibold capitalize text-primary">
                      {skinState!.currentPhase}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3 py-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                <div>
                  <p className="text-sm text-muted-foreground">Ton coach met à jour ton bilan de peau.</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/50">
                    Il sera disponible après ta première consultation.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── 3. Mon parcours ──────────────── col-span-2 row-3 ── */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft lg:col-span-2 lg:row-start-3">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Mon parcours</p>
            <div className="space-y-1">
              {JOURNEY_PHASES.map((phase) => {
                const isPast = dayCount > phase.dayEnd;
                const isCurrent = dayCount >= phase.dayStart && dayCount <= phase.dayEnd;
                return (
                  <div
                    key={phase.id}
                    className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                      isCurrent ? "bg-primary-soft" : ""
                    }`}
                  >
                    {/* State icon */}
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isPast
                        ? "bg-emerald-100 dark:bg-emerald-950/40"
                        : "border border-border/60 bg-transparent"
                    }`}>
                      {isPast ? (
                        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      ) : isCurrent ? (
                        phase.id
                      ) : (
                        <span className="text-foreground/25">{phase.id}</span>
                      )}
                    </div>
                    {/* Text */}
                    <div className={`min-w-0 flex-1 ${isPast ? "opacity-50" : !isCurrent ? "opacity-35" : ""}`}>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isCurrent ? "text-foreground" : ""}`}>{phase.label}</p>
                        {isCurrent && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">
                            Phase actuelle
                          </span>
                        )}
                      </div>
                      <p className={`mt-0.5 text-xs ${isCurrent ? "text-foreground/70" : "text-muted-foreground"}`}>
                        {phase.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 4. Progression protocole ──────── col-span-2 row-4 ── */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft lg:col-span-2 lg:row-start-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Protocole
              </p>
              <span className="text-xs font-semibold text-primary">
                {done}/{total} leçons · {protocolPct}%
              </span>
            </div>

            <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${protocolPct}%` }}
              />
            </div>

            {nextLesson && (
              <Link
                to="/lesson/$lessonId"
                params={{ lessonId: nextLesson.id }}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                    Prochaine leçon
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium">{nextLesson.title}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              </Link>
            )}

            {/* Adhérence 28j */}
            <div className="mt-4 border-t border-border/60 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Adhérence · 28 jours
                </p>
                <div className="flex items-center gap-2">
                  {streak > 0 && (
                    <div className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 dark:bg-orange-950/40">
                      <Flame className="h-3 w-3 text-orange-500" />
                      <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{streak}</span>
                    </div>
                  )}
                  <span
                    className={`text-sm font-semibold ${
                      adherencePct >= 70
                        ? "text-emerald-600 dark:text-emerald-400"
                        : adherencePct >= 40
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-500"
                    }`}
                  >
                    {adherencePct}%
                  </span>
                </div>
              </div>
              <MiniWeekDots checkins28={checkins28} totalSteps={totalRoutineSteps} />
              <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm bg-primary" /> Complète
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm bg-primary/30" /> Partielle
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. Coaching & suivi ──────── col-start-3 row-1 ── */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft lg:col-start-3 lg:row-start-1">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Prochain point coaching
            </div>

            {skinState?.nextCallDate ? (
              <>
                <p className="text-base font-semibold capitalize">
                  {formatCallDate(skinState.nextCallDate)}
                </p>
                {skinState.nextCallTime && (
                  <p className="text-sm text-muted-foreground">à {skinState.nextCallTime}</p>
                )}
                {daysUntilCall !== null && (
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      daysUntilCall <= 0
                        ? "text-primary"
                        : daysUntilCall <= 3
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {daysUntilCall < 0
                      ? "Passé"
                      : daysUntilCall === 0
                      ? "Aujourd'hui !"
                      : daysUntilCall === 1
                      ? "Demain"
                      : `Dans ${daysUntilCall} jours`}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ton prochain point coaching sera bientôt fixé.
              </p>
            )}

            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20">
              <Phone className="h-4 w-4" /> Contacter le coach
            </button>
          </div>

          {/* ── 5. Feedback du coach ──────── col-start-3 row-2 ── */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft lg:col-start-3 lg:row-start-2">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Message du coach
            </div>

            {latestNote ? (
              <>
                <p className="text-sm italic leading-relaxed text-foreground/80">"{latestNote.note}"</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  — {latestNote.authorName ?? "Coach"} ·{" "}
                  {new Date(latestNote.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </>
            ) : (
              <div className="flex items-start gap-3 py-1">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Ton coach ne t'a pas encore envoyé de message.
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/50">
                    Ses retours et observations apparaîtront ici.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* ── 6. Journal photo ─── col-start-1 col-span-2 row-5 ── */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft lg:col-start-1 lg:col-span-2 lg:row-start-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Journal photo
              </p>
              <Link
                to="/journal"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Voir tout <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, i) => {
                  const url = photo.front ?? photo.left ?? photo.right;
                  if (!url) return null;
                  return (
                    <div
                      key={i}
                      className="relative aspect-square overflow-hidden rounded-2xl border border-border"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {photo.date && (
                        <p className="absolute bottom-1.5 left-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                          {new Date(photo.date).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30">
                  <Camera className="h-7 w-7 text-muted-foreground/30" />
                </div>
                <div>
                  <p className="text-sm font-medium">Commence ton journal photo</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prends une photo chaque semaine pour visualiser ta transformation.
                  </p>
                </div>
                <Link
                  to="/journal"
                  className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm"
                >
                  <Camera className="h-4 w-4" /> Ajouter ma première photo
                </Link>
              </div>
            )}
          </div>

        </div>
      </main>
    </AppShell>
  );
}
