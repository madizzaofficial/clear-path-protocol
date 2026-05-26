import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { course, allLessons } from "@/lib/course-data";
import {
  TrendingUp, Check, BookOpen, Camera, CalendarDays, MessageSquare,
  ChevronRight, Loader2, Target, Zap, ArrowRight, Clock,
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
};

type RoutineStep = { id: string };
type CoachNote = { id: string; note: string; authorName: string; createdAt: string; isFromStudent?: boolean };

type SuiviData = {
  loading: boolean;
  skinState: AdminSkinState | null;
  completedLessons: string[];
  enrolledAt: number | null;
  totalRoutineSteps: number;
  monthCheckins: Record<string, { am: string[]; pm: string[] }>;
  checkedAm: string[];
  checkedPm: string[];
  latestNote: CoachNote | null;
  latestPhotoUrl: string | null;
  latestPhotoDate: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPosition(enrolledAt: number): { week: number } {
  const days = Math.max(1, Math.floor((Date.now() - enrolledAt) / 86_400_000) + 1);
  return { week: Math.min(12, Math.ceil(days / 7)) };
}

function formatCallDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ── Skin level dot indicator ──────────────────────────────────────────────────

function LevelDots({ level, inverted }: { level: number; inverted?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < level;
        // inverted: high level = bad (acne, sensitivity). Normal: high = good (barrier)
        const isPositive = inverted ? level <= 2 : level >= 4;
        const isMid = !isPositive && !(inverted ? level >= 4 : level <= 2);
        return (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              filled
                ? isPositive
                  ? "bg-emerald-500"
                  : isMid
                  ? "bg-amber-400"
                  : "bg-red-400"
                : "bg-muted"
            }`}
          />
        );
      })}
    </div>
  );
}

const ACNE_LABELS: Record<number, string> = { 1: "Contrôlée", 2: "Légère", 3: "Modérée", 4: "Active", 5: "Très active" };
const BARRIER_LABELS: Record<number, string> = { 1: "Compromise", 2: "Fragilisée", 3: "En reconstruction", 4: "Bonne", 5: "Excellente" };
const SENSITIVITY_LABELS: Record<number, string> = { 1: "Élevée", 2: "Modérée", 3: "Légère", 4: "Faible", 5: "Très faible" };

// ── Main component ────────────────────────────────────────────────────────────

function Suivi() {
  const { user } = useAuth();
  const [data, setData] = useState<SuiviData>({
    loading: true,
    skinState: null,
    completedLessons: [],
    enrolledAt: null,
    totalRoutineSteps: 0,
    monthCheckins: {},
    checkedAm: [],
    checkedPm: [],
    latestNote: null,
    latestPhotoUrl: null,
    latestPhotoDate: null,
  });

  useEffect(() => {
    if (!user) return;

    async function load() {
      // Month range for checkins
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = `${year}-${String(month + 1).padStart(2, "0")}-31`;

      const [
        skinStateSnap, progressSnap, userSnap, routineSnap,
        notesSnap, photosSnap,
      ] = await Promise.all([
        getDoc(doc(db, "admin_skin_state", user!.uid)),
        getDoc(doc(db, "progress", user!.uid)),
        getDoc(doc(db, "users", user!.uid)),
        getDoc(doc(db, "routines", user!.uid)),
        getDocs(query(collection(db, "users", user!.uid, "notes"), orderBy("createdAt", "desc"), limit(3))),
        getDocs(query(collection(db, "progress_photos"), where("uid", "==", user!.uid))),
      ]);

      // Month checkins
      const monthCheckinsSnap = await getDocs(
        query(
          collection(db, "routine_checkins", user!.uid, "days"),
          where(/* docId range */ "__name__", ">=", firstDay),
          where("__name__", "<=", lastDay),
        ),
      );
      const monthCheckins: Record<string, { am: string[]; pm: string[] }> = {};
      monthCheckinsSnap.forEach((d) => { monthCheckins[d.id] = d.data() as any; });

      // Today's checkins
      const todayKey = now.toISOString().slice(0, 10);
      const todaySnap = await getDoc(doc(db, "routine_checkins", user!.uid, "days", todayKey));
      const todayData = todaySnap.exists() ? todaySnap.data() : { am: [], pm: [] };

      // Latest coach note (not from student)
      const allNotes: CoachNote[] = notesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CoachNote));
      const latestNote = allNotes.find((n) => !n.isFromStudent) ?? null;

      // Latest photo — sort client-side (avoids composite index on uid+createdAt)
      let latestPhotoUrl: string | null = null;
      let latestPhotoDate: string | null = null;
      if (!photosSnap.empty) {
        const sorted = photosSnap.docs
          .map((d) => d.data())
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
        const p = sorted[0];
        latestPhotoUrl = p.front ?? p.left ?? p.right ?? null;
        latestPhotoDate = p.date ?? null;
      }

      // Routine total steps
      const routine = routineSnap.exists() ? routineSnap.data() : null;
      const totalRoutineSteps = routine
        ? (routine.am?.length ?? 0) + (routine.pm?.length ?? 0)
        : 0;

      setData({
        loading: false,
        skinState: skinStateSnap.exists() ? (skinStateSnap.data() as AdminSkinState) : null,
        completedLessons: progressSnap.exists() ? (progressSnap.data().completedLessons ?? []) : [],
        enrolledAt: userSnap.exists() ? (userSnap.data().enrolledAt ?? null) : null,
        totalRoutineSteps,
        monthCheckins,
        checkedAm: todayData.am ?? [],
        checkedPm: todayData.pm ?? [],
        latestNote,
        latestPhotoUrl,
        latestPhotoDate,
      });
    }

    load().catch(console.error);
  }, [user?.uid]);

  const {
    loading, skinState, completedLessons, enrolledAt, totalRoutineSteps,
    monthCheckins, checkedAm, checkedPm, latestNote, latestPhotoUrl, latestPhotoDate,
  } = data;

  const lessons = allLessons();
  const done = completedLessons.length;
  const total = lessons.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const position = enrolledAt ? getPosition(enrolledAt) : { week: 1 };

  // Next incomplete lesson
  const nextLesson = lessons.find((l) => !completedLessons.includes(l.id));

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 pb-28 pt-8">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-8 space-y-4">

        {/* ── Header ─────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Mon Suivi</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">
            Semaine {position.week}
            <span className="text-muted-foreground">/12</span>
          </h1>
        </div>

        {/* ── État de ta peau ─────────────────────────────────── */}
        {skinState ? (
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">État de ta peau</p>
              {skinState.updatedAt && (
                <p className="text-[10px] text-muted-foreground/60">
                  Mis à jour le {new Date(skinState.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <SkinRow
                label="Acné"
                level={skinState.acneLevel}
                levelLabel={ACNE_LABELS[skinState.acneLevel] ?? ""}
                inverted
              />
              <SkinRow
                label="Barrière cutanée"
                level={skinState.barrierLevel}
                levelLabel={BARRIER_LABELS[skinState.barrierLevel] ?? ""}
              />
              <SkinRow
                label="Sensibilité"
                level={skinState.sensitivityLevel}
                levelLabel={SENSITIVITY_LABELS[skinState.sensitivityLevel] ?? ""}
                inverted
              />
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">État de ta peau</p>
            <p className="mt-3 text-sm text-muted-foreground">Ton coach met à jour ton bilan de peau prochainement.</p>
          </div>
        )}

        {/* ── Objectif · Stratégie · Prochaine évolution ──────── */}
        {skinState && (skinState.currentObjective || skinState.currentStrategy || skinState.nextEvolution) && (
          <div className="space-y-2">
            {skinState.currentObjective && (
              <CoachingCard
                icon={Target}
                label="Objectif actuel"
                text={skinState.currentObjective}
                accent="primary"
              />
            )}
            {skinState.currentStrategy && (
              <CoachingCard
                icon={Zap}
                label="Stratégie en cours"
                text={skinState.currentStrategy}
                accent="amber"
              />
            )}
            {skinState.nextEvolution && (
              <CoachingCard
                icon={ArrowRight}
                label="Prochaine évolution"
                text={skinState.nextEvolution}
                accent="muted"
              />
            )}
          </div>
        )}

        {/* ── Prochain appel ──────────────────────────────────── */}
        {skinState?.nextCallDate && (
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-soft">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Prochain appel</p>
              <p className="mt-0.5 text-sm font-medium">{formatCallDate(skinState.nextCallDate)}</p>
            </div>
          </div>
        )}

        {/* ── Dernier feedback coach ──────────────────────────── */}
        {latestNote && (
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Dernier feedback
            </div>
            <p className="text-sm leading-relaxed text-foreground">{latestNote.note}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(latestNote.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
            </p>
            <Link
              to="/"
              className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Voir tous les messages <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* ── Progression protocole ───────────────────────────── */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Progression protocole</p>

          {/* Bar + percentage */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-semibold tabular-nums shrink-0">{progress}%</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{done}/{total} leçons complétées</p>

          {/* Next lesson CTA */}
          {nextLesson && (
            <Link
              to="/lesson/$lessonId"
              params={{ lessonId: nextLesson.id }}
              className="mt-4 flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3 transition-colors hover:bg-primary/20"
            >
              <BookOpen className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">Prochain</p>
                <p className="truncate text-sm font-medium">{nextLesson.title}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-primary/60" />
            </Link>
          )}
        </div>

        {/* ── Calendrier d'adhérence ──────────────────────────── */}
        <SuiviCalendar
          totalSteps={totalRoutineSteps}
          monthCheckins={monthCheckins}
          checkedAm={checkedAm}
          checkedPm={checkedPm}
        />

        {/* ── Aperçu journal ─────────────────────────────────── */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Journal photo</p>
            <Link
              to="/journal"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Voir tout <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {latestPhotoUrl ? (
            <div className="flex items-center gap-4">
              <img
                src={latestPhotoUrl}
                alt="Dernière photo"
                className="h-20 w-20 shrink-0 rounded-2xl border border-border object-cover"
              />
              <div>
                <p className="text-sm font-medium">Dernière photo</p>
                {latestPhotoDate && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(latestPhotoDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  </p>
                )}
                <Link
                  to="/journal"
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary"
                >
                  <Camera className="h-3 w-3" /> Voir le journal
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30">
                <Camera className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aucune photo encore</p>
                <Link
                  to="/journal"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ajouter une photo <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkinRow({ label, level, levelLabel, inverted }: {
  label: string; level: number; levelLabel: string; inverted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-sm text-foreground/80">{label}</span>
      <LevelDots level={level} inverted={inverted} />
      <span className="text-sm font-medium">{levelLabel}</span>
    </div>
  );
}

function CoachingCard({ icon: Icon, label, text, accent }: {
  icon: any; label: string; text: string;
  accent: "primary" | "amber" | "muted";
}) {
  const accentMap = {
    primary: "border-primary/20 bg-primary-soft/40",
    amber: "border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20",
    muted: "border-border/60 bg-card",
  };
  const iconMap = {
    primary: "text-primary",
    amber: "text-amber-600 dark:text-amber-400",
    muted: "text-muted-foreground",
  };
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${accentMap[accent]}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconMap[accent]}`} />
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-widest ${iconMap[accent]}`}>{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{text}</p>
      </div>
    </div>
  );
}

function SuiviCalendar({ totalSteps, monthCheckins, checkedAm, checkedPm }: {
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
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const todayKey = now.toISOString().slice(0, 10);
  const allCheckins = { ...monthCheckins, [todayKey]: { am: checkedAm, pm: checkedPm } };
  const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Adhérence routine</p>
        <span className="text-xs capitalize text-muted-foreground">{monthLabel}</span>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const checkin = allCheckins[key];
          const isToday = day === today;
          const isFuture = day > today;
          let isDone = false, isPartial = false;
          if (checkin && totalSteps > 0) {
            const checked = (checkin.am?.length ?? 0) + (checkin.pm?.length ?? 0);
            isDone = checked >= totalSteps;
            isPartial = checked > 0 && !isDone;
          }
          return (
            <div key={day} className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium transition-all ${
              isFuture ? "text-muted-foreground/25"
              : isDone ? "bg-primary text-primary-foreground"
              : isPartial ? "bg-primary-soft text-primary"
              : isToday ? "ring-2 ring-primary text-foreground font-semibold"
              : "text-muted-foreground"
            }`}>
              {isDone ? <Check className="h-3 w-3" /> : day}
            </div>
          );
        })}
      </div>

      {totalSteps > 0 && (
        <div className="mt-4 flex items-center gap-5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary" />Complète
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary-soft" />Partielle
          </div>
        </div>
      )}
    </div>
  );
}
