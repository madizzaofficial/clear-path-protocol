import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { allLessons } from "@/lib/course-data";
import {
  Check, BookOpen, Camera, CalendarDays, MessageSquare, ChevronRight, Loader2,
  Target, Zap, ArrowRight, Flame, AlertTriangle, Shield, TrendingUp,
  CheckCircle2, Circle, ChevronDown, ChevronUp,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, getDocs, query, orderBy, limit, where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/suivi")({
  head: () => ({
    meta: [
      { title: "Mon Suivi — Protocole Clear" },
      { name: "description", content: "Ton état de peau, tes objectifs et ta progression." },
    ],
  }),
  component: Suivi,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminSkinState = {
  uid: string;
  acneLevel: number;
  barrierLevel: number;
  sensitivityLevel: number;
  currentObjective: string;
  currentStrategy: string;
  nextEvolution: string;
  nextCallDate?: string;
  updatedAt: number;
  coachPhrase?: string;
  currentPhase?: string;
  priority?: string;
  thingsToAvoid?: string;
  toleranceLevel?: "faible" | "moyenne" | "bonne";
  roadmapPhases?: string;
  roadmapCurrentIndex?: number;
  nextCallTime?: string;
};

type CoachNote = { id: string; note: string; authorName: string; createdAt: string; isFromStudent?: boolean };

type SuiviData = {
  loading: boolean;
  skinState: AdminSkinState | null;
  completedLessons: string[];
  enrolledAt: number | null;
  totalRoutineSteps: number;
  checkins28: Record<string, { am: string[]; pm: string[] }>;
  streak: number;
  adherencePct: number;
  adherenceDays: number;
  latestNote: CoachNote | null;
  latestPhotoUrl: string | null;
  latestPhotoDate: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeek(enrolledAt: number): number {
  const days = Math.max(1, Math.floor((Date.now() - enrolledAt) / 86_400_000) + 1);
  return Math.min(12, Math.ceil(days / 7));
}

function getDaysUntil(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(isoDate);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86_400_000);
}

function formatCallDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function computeAdherence(
  checkins28: Record<string, { am: string[]; pm: string[] }>,
  totalSteps: number,
): { pct: number; days: number; streak: number } {
  const today = new Date();
  let days = 0;
  let streak = 0;
  let streakBroken = false;

  for (let i = 0; i < 28; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const c = checkins28[key];
    const done = totalSteps > 0 && c && (c.am?.length ?? 0) + (c.pm?.length ?? 0) >= totalSteps;
    if (done) {
      days++;
      if (!streakBroken) streak++;
    } else if (i === 0) {
      // today not yet done — don't break streak
    } else {
      streakBroken = true;
    }
  }

  const pct = totalSteps > 0 ? Math.round((days / 28) * 100) : 0;
  return { pct, days, streak };
}

const ACNE_LABELS: Record<number, string> = { 1: "Contrôlée", 2: "Légère", 3: "Modérée", 4: "Active", 5: "Très active" };
const BARRIER_LABELS: Record<number, string> = { 1: "Compromise", 2: "Fragilisée", 3: "En reconstruction", 4: "Bonne", 5: "Excellente" };
const SENSITIVITY_LABELS: Record<number, string> = { 1: "Élevée", 2: "Modérée", 3: "Légère", 4: "Faible", 5: "Très faible" };

const TOLERANCE_CONFIG = {
  faible: { label: "Faible", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  moyenne: { label: "Moyenne", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  bonne: { label: "Bonne", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function LevelDots({ level, inverted }: { level: number; inverted?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < level;
        const isPositive = inverted ? level <= 2 : level >= 4;
        const isMid = !isPositive && !(inverted ? level >= 4 : level <= 2);
        return (
          <span key={i} className={`h-2 w-2 rounded-full transition-colors ${
            filled
              ? isPositive ? "bg-emerald-500" : isMid ? "bg-amber-400" : "bg-red-400"
              : "bg-muted"
          }`} />
        );
      })}
    </div>
  );
}

function SkinCard({ label, level, levelLabel, inverted }: {
  label: string; level: number; levelLabel: string; inverted?: boolean;
}) {
  const isPositive = inverted ? level <= 2 : level >= 4;
  const isMid = !isPositive && !(inverted ? level >= 4 : level <= 2);
  const colorClass = isPositive
    ? "text-emerald-600 dark:text-emerald-400"
    : isMid ? "text-amber-500 dark:text-amber-400"
    : "text-red-500 dark:text-red-400";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <LevelDots level={level} inverted={inverted} />
      <p className={`text-sm font-semibold ${colorClass}`}>{levelLabel}</p>
    </div>
  );
}

function RoadmapTimeline({ phases, currentIndex }: { phases: string[]; currentIndex: number }) {
  return (
    <div className="space-y-1">
      {phases.map((phase, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isUpcoming = i > currentIndex;
        return (
          <div key={i} className="flex items-start gap-3">
            <div className="flex shrink-0 flex-col items-center">
              {isDone ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : isCurrent ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-primary-soft">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/30" />
              )}
              {i < phases.length - 1 && (
                <div className={`mt-1 w-px flex-1 ${isDone ? "bg-primary/30" : "bg-muted"}`} style={{ minHeight: 16 }} />
              )}
            </div>
            <p className={`mt-0.5 pb-3 text-sm leading-snug ${
              isDone ? "text-muted-foreground line-through" : isCurrent ? "font-semibold text-foreground" : "text-muted-foreground/60"
            }`}>
              {phase}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function MiniWeekDots({ checkins28, totalSteps }: {
  checkins28: Record<string, { am: string[]; pm: string[] }>;
  totalSteps: number;
}) {
  const today = new Date();
  const dots = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (27 - i));
    const key = d.toISOString().slice(0, 10);
    const isPast = i <= 27 - (today.getDay() === 0 ? 0 : 0);
    const isFuture = d > today;
    const c = checkins28[key];
    const sum = c ? (c.am?.length ?? 0) + (c.pm?.length ?? 0) : 0;
    const done = totalSteps > 0 && sum >= totalSteps;
    const partial = !done && sum > 0;
    return { key, isFuture, done, partial };
  });

  return (
    <div className="grid grid-cols-7 gap-1">
      {dots.map((dot, i) => (
        <div key={i} className={`h-3 w-full rounded-sm transition-colors ${
          dot.isFuture ? "bg-muted/20"
          : dot.done ? "bg-primary"
          : dot.partial ? "bg-primary/30"
          : "bg-muted"
        }`} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function Suivi() {
  const { user } = useAuth();
  const [prepOpen, setPrepOpen] = useState(false);
  const [data, setData] = useState<SuiviData>({
    loading: true,
    skinState: null,
    completedLessons: [],
    enrolledAt: null,
    totalRoutineSteps: 0,
    checkins28: {},
    streak: 0,
    adherencePct: 0,
    adherenceDays: 0,
    latestNote: null,
    latestPhotoUrl: null,
    latestPhotoDate: null,
  });

  useEffect(() => {
    if (!user) return;
    async function load() {
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      const start28 = new Date(today);
      start28.setDate(today.getDate() - 27);
      const start28Key = start28.toISOString().slice(0, 10);

      const [skinStateSnap, progressSnap, userSnap, routineSnap, notesSnap, photosSnap] = await Promise.all([
        getDoc(doc(db, "admin_skin_state", user!.uid)).catch(() => null),
        getDoc(doc(db, "progress", user!.uid)).catch(() => null),
        getDoc(doc(db, "users", user!.uid)).catch(() => null),
        getDoc(doc(db, "routines", user!.uid)).catch(() => null),
        getDocs(query(collection(db, "users", user!.uid, "notes"), orderBy("createdAt", "desc"), limit(3))).catch(() => null),
        getDocs(query(collection(db, "progress_photos"), where("uid", "==", user!.uid))).catch(() => null),
      ]);

      const checkins28Snap = await getDocs(
        query(
          collection(db, "routine_checkins", user!.uid, "days"),
          where("__name__", ">=", start28Key),
          where("__name__", "<=", todayKey),
        ),
      ).catch(() => null);

      const checkins28: Record<string, { am: string[]; pm: string[] }> = {};
      checkins28Snap?.forEach((d) => { checkins28[d.id] = d.data() as any; });

      const routine = routineSnap?.exists() ? routineSnap.data() : null;
      const totalRoutineSteps = routine?.status === "sent"
        ? (routine.am?.length ?? 0) + (routine.pm?.length ?? 0)
        : 0;

      const { pct, days, streak } = computeAdherence(checkins28, totalRoutineSteps);

      const allNotes: CoachNote[] = notesSnap?.docs.map((d) => ({ id: d.id, ...d.data() } as CoachNote)) ?? [];
      const latestNote = allNotes.find((n) => !n.isFromStudent) ?? null;

      let latestPhotoUrl: string | null = null;
      let latestPhotoDate: string | null = null;
      if (photosSnap && !photosSnap.empty) {
        const sorted = photosSnap.docs
          .map((d) => d.data())
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
        const p = sorted[0];
        latestPhotoUrl = p.front ?? p.left ?? p.right ?? null;
        latestPhotoDate = p.date ?? null;
      }

      setData({
        loading: false,
        skinState: skinStateSnap?.exists() ? (skinStateSnap.data() as AdminSkinState) : null,
        completedLessons: progressSnap?.exists() ? (progressSnap.data().completedLessons ?? []) : [],
        enrolledAt: userSnap?.exists() ? (userSnap.data().enrolledAt ?? null) : null,
        totalRoutineSteps,
        checkins28,
        streak,
        adherencePct: pct,
        adherenceDays: days,
        latestNote,
        latestPhotoUrl,
        latestPhotoDate,
      });
    }
    load().catch(() => setData((d) => ({ ...d, loading: false })));
  }, [user?.uid]);

  const { loading, skinState, completedLessons, enrolledAt, totalRoutineSteps,
    checkins28, streak, adherencePct, adherenceDays, latestNote, latestPhotoUrl, latestPhotoDate } = data;

  const lessons = allLessons();
  const done = completedLessons.length;
  const total = lessons.length;
  const protocolPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const week = enrolledAt ? getWeek(enrolledAt) : 1;
  const nextLesson = lessons.find((l) => !completedLessons.includes(l.id));

  const roadmapPhases = skinState?.roadmapPhases
    ? skinState.roadmapPhases.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];
  const roadmapCurrentIndex = skinState?.roadmapCurrentIndex ?? 0;

  const daysUntilCall = skinState?.nextCallDate ? getDaysUntil(skinState.nextCallDate) : null;

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 pb-28 pt-8">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-8">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-warm p-6 shadow-elegant">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50">Mon Suivi</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <h1 className="font-display text-3xl font-semibold">Semaine {week}</h1>
            <span className="font-display text-xl text-foreground/40">/12</span>
          </div>
          {skinState?.coachPhrase ? (
            <p className="mt-2 text-sm italic text-foreground/60">"{skinState.coachPhrase}"</p>
          ) : (
            <p className="mt-2 text-sm text-foreground/50">Ton protocole de transformation en cours.</p>
          )}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${Math.round((week / 12) * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-foreground/40">{week} semaine{week > 1 ? "s" : ""} sur 12</p>
        </div>

        {/* ── Grid layout ───────────────────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">

          {/* ── Main column ─────────────────────────────────────────────────── */}
          <div className="space-y-4 lg:col-span-2">

            {/* Phase actuelle */}
            {skinState?.currentPhase ? (
              <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Phase actuelle</p>
                <h2 className="font-display text-xl font-semibold">{skinState.currentPhase}</h2>

                <div className="mt-4 space-y-2.5">
                  {skinState.priority && (
                    <div className="flex items-start gap-3 rounded-2xl bg-primary-soft/40 px-4 py-3">
                      <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">Priorité</p>
                        <p className="mt-0.5 text-sm text-foreground">{skinState.priority}</p>
                      </div>
                    </div>
                  )}
                  {skinState.thingsToAvoid && (
                    <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 dark:bg-amber-950/20">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">À éviter</p>
                        <p className="mt-0.5 text-sm text-foreground">{skinState.thingsToAvoid}</p>
                      </div>
                    </div>
                  )}
                  {skinState.toleranceLevel && (
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tolérance cutanée :</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TOLERANCE_CONFIG[skinState.toleranceLevel].color}`}>
                        {TOLERANCE_CONFIG[skinState.toleranceLevel].label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              skinState && (skinState.currentObjective || skinState.currentStrategy || skinState.nextEvolution) && (
                <div className="space-y-2">
                  {skinState.currentObjective && (
                    <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-soft/40 px-4 py-3.5">
                      <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">Objectif actuel</p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">{skinState.currentObjective}</p>
                      </div>
                    </div>
                  )}
                  {skinState.currentStrategy && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-800/40 dark:bg-amber-950/20">
                      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">Stratégie en cours</p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">{skinState.currentStrategy}</p>
                      </div>
                    </div>
                  )}
                  {skinState.nextEvolution && (
                    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5">
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Prochaine évolution</p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">{skinState.nextEvolution}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Roadmap */}
            {roadmapPhases.length > 0 && (
              <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Roadmap</p>
                <RoadmapTimeline phases={roadmapPhases} currentIndex={roadmapCurrentIndex} />
              </div>
            )}

            {/* État de ta peau */}
            {skinState ? (
              <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">État de ta peau</p>
                  {skinState.updatedAt && (
                    <p className="text-[10px] text-muted-foreground/60">
                      mis à jour le {new Date(skinState.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <SkinCard label="Acné" level={skinState.acneLevel} levelLabel={ACNE_LABELS[skinState.acneLevel] ?? ""} inverted />
                  <SkinCard label="Barrière" level={skinState.barrierLevel} levelLabel={BARRIER_LABELS[skinState.barrierLevel] ?? ""} />
                  <SkinCard label="Sensibilité" level={skinState.sensitivityLevel} levelLabel={SENSITIVITY_LABELS[skinState.sensitivityLevel] ?? ""} inverted />
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">État de ta peau</p>
                <p className="mt-3 text-sm text-muted-foreground">Ton coach met à jour ton bilan de peau prochainement.</p>
              </div>
            )}

            {/* Notes du coach */}
            {latestNote && (
              <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Note de ton coach
                </div>
                <p className="text-sm italic leading-relaxed text-foreground/80">"{latestNote.note}"</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {new Date(latestNote.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  </p>
                  <Link to="/" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Voir tout <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}

            {!skinState && !latestNote && (
              <div className="rounded-3xl border border-dashed border-border/60 bg-card/50 p-6 text-center">
                <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">Ton coach prépare ton bilan personnalisé.</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Il apparaîtra ici dès qu'il sera disponible.</p>
              </div>
            )}
          </div>

          {/* ── Sidebar ─────────────────────────────────────────────────────── */}
          <div className="mt-4 space-y-4 lg:mt-0 lg:col-span-1">

            {/* Prochain appel */}
            {skinState?.nextCallDate && (
              <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Prochain point coach
                </div>

                <p className="text-base font-semibold capitalize">
                  {formatCallDate(skinState.nextCallDate)}
                  {skinState.nextCallTime && <span className="text-muted-foreground"> · {skinState.nextCallTime}</span>}
                </p>

                {daysUntilCall !== null && (
                  <p className={`mt-1 text-sm font-medium ${
                    daysUntilCall <= 0 ? "text-primary" : daysUntilCall <= 3 ? "text-amber-600" : "text-muted-foreground"
                  }`}>
                    {daysUntilCall < 0 ? "Passé"
                      : daysUntilCall === 0 ? "Aujourd'hui"
                      : daysUntilCall === 1 ? "Demain"
                      : `Dans ${daysUntilCall} jours`}
                  </p>
                )}

                <div className="mt-4">
                  <button
                    onClick={() => setPrepOpen((o) => !o)}
                    className="flex w-full items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Préparer mes questions
                    {prepOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {prepOpen && (
                    <textarea
                      placeholder="Note tes questions ici avant l'appel…"
                      rows={4}
                      className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Adhérence */}
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Adhérence · 28 jours</p>

              <div className="mb-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-display text-3xl font-semibold">{adherencePct}<span className="ml-0.5 text-base font-medium text-muted-foreground">%</span></p>
                  <p className="text-xs text-muted-foreground">{adherenceDays} jours complets</p>
                </div>
                {streak > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 dark:bg-orange-950/40">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">{streak}</span>
                  </div>
                )}
              </div>

              <MiniWeekDots checkins28={checkins28} totalSteps={totalRoutineSteps} />

              <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-primary" />Complète</div>
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-primary/30" />Partielle</div>
              </div>
            </div>

            {/* Protocole */}
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Protocole</p>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700" style={{ width: `${protocolPct}%` }} />
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">{protocolPct}%</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{done}/{total} leçons · Semaine {week}/12</p>
              {nextLesson && (
                <Link
                  to="/lesson/$lessonId"
                  params={{ lessonId: nextLesson.id }}
                  className="mt-3 flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-2.5 transition-colors hover:bg-primary/20"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                  <p className="min-w-0 flex-1 truncate text-xs font-medium">{nextLesson.title}</p>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                </Link>
              )}
            </div>

            {/* Journal photo */}
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Journal photo</p>
                <Link to="/journal" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Voir tout <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              {latestPhotoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={latestPhotoUrl} alt="Dernière photo" className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Dernière photo</p>
                    {latestPhotoDate && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(latestPhotoDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                      </p>
                    )}
                    <Link to="/journal" className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                      <Camera className="h-3 w-3" /> Journal
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30">
                    <Camera className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Commence ton journal photo</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Documente ta progression semaine après semaine.</p>
                  </div>
                  <Link
                    to="/journal"
                    className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm"
                  >
                    <Camera className="h-3 w-3" /> Ajouter une photo
                  </Link>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
