import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { allLessons } from "@/lib/course-data";
import {
  Check, BookOpen, Camera, CalendarDays, MessageSquare, ChevronRight, Loader2,
  Target, AlertTriangle, Shield, Flame, CheckCircle2, Circle,
  ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
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
  // Classic skin metrics (1–5)
  acneLevel: number;
  barrierLevel: number;
  sensitivityLevel: number;
  // Coaching text
  currentObjective: string;
  currentStrategy: string;
  nextEvolution: string;
  // New %‑based metrics (0–100, set by coach)
  inflammationPct?: number;
  sensibilityPct?: number;
  comedonsPct?: number;
  toleranceRoutinePct?: number;
  hydrationPct?: number;
  coachObservation?: string;
  // Objectives list (newline-separated, ✓ done / ○ pending)
  objectives?: string;
  // Direction
  coachPhrase?: string;
  currentPhase?: string;
  priority?: string;
  thingsToAvoid?: string;
  toleranceLevel?: "faible" | "moyenne" | "bonne";
  roadmapPhases?: string;
  roadmapCurrentIndex?: number;
  // Next call
  nextCallDate?: string;
  nextCallTime?: string;
  updatedAt: number;
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
  const today = new Date();
  let days = 0, streak = 0;
  let streakBroken = false;
  for (let i = 0; i < 28; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const c = checkins28[key];
    const done = totalSteps > 0 && c && (c.am?.length ?? 0) + (c.pm?.length ?? 0) >= totalSteps;
    if (done) { days++; if (!streakBroken) streak++; }
    else if (i === 0) { /* today not yet done */ }
    else { streakBroken = true; }
  }
  return { pct: totalSteps > 0 ? Math.round((days / 28) * 100) : 0, days, streak };
}

function parseObjectives(raw: string): { done: boolean; text: string }[] {
  return raw.split("\n").map(s => s.trim()).filter(Boolean).map(line => ({
    done: line.startsWith("✓"),
    text: line.replace(/^[✓○]\s*/, ""),
  }));
}

const TOLERANCE_CONFIG = {
  faible: { label: "Faible", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  moyenne: { label: "Moyenne", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  bonne: { label: "Bonne", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricBar({ label, pct, inverted }: { label: string; pct: number; inverted?: boolean }) {
  // inverted: higher = worse (inflammation, sensibilité, comédons)
  const color = inverted
    ? pct >= 70 ? "bg-red-400" : pct >= 40 ? "bg-amber-400" : "bg-emerald-500"
    : pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-foreground/80">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniWeekDots({ checkins28, totalSteps }: { checkins28: Record<string, { am: string[]; pm: string[] }>; totalSteps: number }) {
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
        <div key={i} className={`h-3 w-full rounded-sm ${
          dot.isFuture ? "bg-muted/20" : dot.done ? "bg-primary" : dot.partial ? "bg-primary/30" : "bg-muted"
        }`} />
      ))}
    </div>
  );
}

function RoadmapTimeline({ phases, currentIndex }: { phases: string[]; currentIndex: number }) {
  return (
    <div className="space-y-1">
      {phases.map((phase, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
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
                <div className={`mt-1 w-px ${isDone ? "bg-primary/30" : "bg-muted"}`} style={{ minHeight: 16 }} />
              )}
            </div>
            <p className={`mt-0.5 pb-3 text-sm leading-snug ${
              isDone ? "text-muted-foreground line-through" : isCurrent ? "font-semibold" : "text-muted-foreground/50"
            }`}>{phase}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Placeholder card ──────────────────────────────────────────────────────────

function PlaceholderCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4 rounded-3xl border border-dashed border-border/60 bg-muted/20 p-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/60">{body}</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function Suivi() {
  const { user } = useAuth();
  const [prepOpen, setPrepOpen] = useState(false);
  const [data, setData] = useState<SuiviData>({
    loading: true, skinState: null, completedLessons: [], enrolledAt: null,
    totalRoutineSteps: 0, checkins28: {}, streak: 0,
    adherencePct: 0, adherenceDays: 0, latestNote: null,
    latestPhotoUrl: null, latestPhotoDate: null,
  });

  useEffect(() => {
    if (!user) return;
    async function load() {
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      const start28 = new Date(today); start28.setDate(today.getDate() - 27);
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
        query(collection(db, "routine_checkins", user!.uid, "days"),
          where("__name__", ">=", start28Key), where("__name__", "<=", todayKey)),
      ).catch(() => null);

      const checkins28: Record<string, { am: string[]; pm: string[] }> = {};
      checkins28Snap?.forEach((d) => { checkins28[d.id] = d.data() as any; });

      const routine = routineSnap?.exists() ? routineSnap.data() : null;
      const totalRoutineSteps = routine?.status === "sent"
        ? (routine.am?.length ?? 0) + (routine.pm?.length ?? 0) : 0;

      const { pct, days, streak } = computeAdherence(checkins28, totalRoutineSteps);

      const allNotes: CoachNote[] = notesSnap?.docs.map((d) => ({ id: d.id, ...d.data() } as CoachNote)) ?? [];
      const latestNote = allNotes.find((n) => !n.isFromStudent) ?? null;

      let latestPhotoUrl = null, latestPhotoDate = null;
      if (photosSnap && !photosSnap.empty) {
        const sorted = photosSnap.docs.map((d) => d.data()).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
        const p = sorted[0];
        latestPhotoUrl = p.front ?? p.left ?? p.right ?? null;
        latestPhotoDate = p.date ?? null;
      }

      setData({
        loading: false,
        skinState: skinStateSnap?.exists() ? (skinStateSnap.data() as AdminSkinState) : null,
        completedLessons: progressSnap?.exists() ? (progressSnap.data().completedLessons ?? []) : [],
        enrolledAt: userSnap?.exists() ? (userSnap.data().enrolledAt ?? null) : null,
        totalRoutineSteps, checkins28, streak,
        adherencePct: pct, adherenceDays: days,
        latestNote, latestPhotoUrl, latestPhotoDate,
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
  const daysUntilCall = skinState?.nextCallDate ? getDaysUntil(skinState.nextCallDate) : null;

  const roadmapPhases = skinState?.roadmapPhases
    ? skinState.roadmapPhases.split("\n").map((s) => s.trim()).filter(Boolean) : [];

  const objectives = skinState?.objectives ? parseObjectives(skinState.objectives) : [];

  const hasSkinMetrics = skinState && (
    skinState.inflammationPct !== undefined ||
    skinState.sensibilityPct !== undefined ||
    skinState.comedonsPct !== undefined ||
    skinState.toleranceRoutinePct !== undefined ||
    skinState.hydrationPct !== undefined
  );

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 pb-28 pt-8 flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-8 space-y-4">

        {/* ── 1. Hero ─────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-3xl bg-gradient-warm p-6 shadow-elegant">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50">Mon Suivi</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <h1 className="font-display text-3xl font-semibold">Semaine {week}</h1>
            <span className="font-display text-xl text-foreground/40">/12</span>
          </div>
          {skinState?.coachPhrase ? (
            <p className="mt-2 text-sm italic text-foreground/60">"{skinState.coachPhrase}"</p>
          ) : (
            <p className="mt-2 text-sm text-foreground/50">Ton protocole de transformation, semaine par semaine.</p>
          )}

          {/* Protocol progress inline */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-foreground/50">
              <span>Semaines</span>
              <span>{week}/12</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.round((week / 12) * 100)}%` }} />
            </div>
          </div>

          {/* Protocol lessons */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-primary/50" style={{ width: `${protocolPct}%` }} />
            </div>
            <span className="text-xs text-foreground/40 shrink-0">{done}/{total} leçons · {protocolPct}%</span>
          </div>
        </div>

        {/* ── 2. Skin Status ──────────────────────────────────────────── */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">État de ta peau</p>
            {skinState?.updatedAt && (
              <p className="text-[10px] text-muted-foreground/50">
                mis à jour le {new Date(skinState.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </p>
            )}
          </div>

          {hasSkinMetrics ? (
            <div className="space-y-3.5">
              {skinState!.inflammationPct !== undefined && (
                <MetricBar label="Inflammation" pct={skinState!.inflammationPct} inverted />
              )}
              {skinState!.sensibilityPct !== undefined && (
                <MetricBar label="Sensibilité" pct={skinState!.sensibilityPct} inverted />
              )}
              {skinState!.comedonsPct !== undefined && (
                <MetricBar label="Comédons" pct={skinState!.comedonsPct} inverted />
              )}
              {skinState!.toleranceRoutinePct !== undefined && (
                <MetricBar label="Tolérance routine" pct={skinState!.toleranceRoutinePct} />
              )}
              {skinState!.hydrationPct !== undefined && (
                <MetricBar label="Hydratation" pct={skinState!.hydrationPct} />
              )}

              {/* Coach observation */}
              {skinState!.coachObservation && (
                <div className="mt-4 rounded-2xl bg-muted/40 px-4 py-3.5">
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <MessageSquare className="h-3 w-3" /> Observation du coach
                  </p>
                  <p className="text-sm italic leading-relaxed text-foreground/80">"{skinState!.coachObservation}"</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 py-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
              <div>
                <p className="text-sm text-muted-foreground">Ton coach met à jour ton bilan de peau.</p>
                <p className="mt-0.5 text-xs text-muted-foreground/50">Il sera disponible après ta première consultation.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Phase actuelle ───────────────────────────────────────── */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Phase actuelle</p>

          {skinState?.currentPhase ? (
            <>
              <h2 className="font-display text-xl font-semibold">{skinState.currentPhase}</h2>
              <div className="mt-4 space-y-2.5">
                {skinState.priority && (
                  <div className="flex items-start gap-3 rounded-2xl bg-primary-soft/40 px-4 py-3">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">Priorité</p>
                      <p className="mt-0.5 text-sm">{skinState.priority}</p>
                    </div>
                  </div>
                )}
                {skinState.thingsToAvoid && (
                  <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 dark:bg-amber-950/20">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">À éviter</p>
                      <p className="mt-0.5 text-sm">{skinState.thingsToAvoid}</p>
                    </div>
                  </div>
                )}
                {skinState.toleranceLevel && (
                  <div className="flex items-center gap-2.5 px-1">
                    <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Tolérance cutanée :</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TOLERANCE_CONFIG[skinState.toleranceLevel].cls}`}>
                      {TOLERANCE_CONFIG[skinState.toleranceLevel].label}
                    </span>
                  </div>
                )}
              </div>

              {/* Roadmap (if set) */}
              {roadmapPhases.length > 0 && (
                <div className="mt-5 border-t border-border/60 pt-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Roadmap</p>
                  <RoadmapTimeline phases={roadmapPhases} currentIndex={skinState.roadmapCurrentIndex ?? 0} />
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3 py-2">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
              <div>
                <p className="text-sm text-muted-foreground">Ta phase de traitement sera définie lors de ta consultation.</p>
                <p className="mt-0.5 text-xs text-muted-foreground/50">Chaque phase a une durée et des objectifs précis.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── 4. Objectifs actuels ───────────────────────────────────── */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ce sur quoi on travaille</p>

          {objectives.length > 0 ? (
            <ul className="space-y-2.5">
              {objectives.map((obj, i) => (
                <li key={i} className="flex items-center gap-3">
                  {obj.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground/30" />
                  )}
                  <span className={`text-sm ${obj.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {obj.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-start gap-3 py-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
              <div>
                <p className="text-sm text-muted-foreground">Tes objectifs de transformation seront listés ici.</p>
                <p className="mt-0.5 text-xs text-muted-foreground/50">Définis avec ton coach en fonction de ta peau.</p>
              </div>
            </div>
          )}

          {/* Legacy fallback: show currentObjective / nextEvolution if no objectives */}
          {objectives.length === 0 && skinState?.currentObjective && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-0.5 text-xs">→</span>
                <span>{skinState.currentObjective}</span>
              </div>
              {skinState.nextEvolution && (
                <div className="flex items-start gap-2.5 text-sm text-muted-foreground/60">
                  <span className="mt-0.5 text-xs">○</span>
                  <span>{skinState.nextEvolution}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 5. Notes du coach ──────────────────────────────────────── */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Note de ton coach
            </div>
            {latestNote && (
              <Link to="/" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Voir tout <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {latestNote ? (
            <>
              <p className="text-sm italic leading-relaxed text-foreground/80">"{latestNote.note}"</p>
              <p className="mt-2 text-xs text-muted-foreground">
                — {latestNote.authorName ?? "Coach"} ·{" "}
                {new Date(latestNote.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              </p>
            </>
          ) : (
            <div className="flex items-start gap-3 py-2">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
              <div>
                <p className="text-sm text-muted-foreground">Ton coach ne t'a pas encore envoyé de message.</p>
                <p className="mt-0.5 text-xs text-muted-foreground/50">Ses retours et observations apparaîtront ici.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── 6. Adhérence ───────────────────────────────────────────── */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Adhérence · 28 jours</p>

          <div className="mb-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="font-display text-3xl font-semibold">
                {adherencePct}<span className="ml-0.5 text-base font-medium text-muted-foreground">%</span>
              </p>
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

        {/* ── 7. Journal photo ───────────────────────────────────────── */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Journal photo</p>
            <Link to="/journal" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Voir tout <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {latestPhotoUrl ? (
            <div className="flex items-center gap-4">
              <img src={latestPhotoUrl} alt="" className="h-20 w-20 shrink-0 rounded-2xl border border-border object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Dernière photo</p>
                {latestPhotoDate && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(latestPhotoDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  </p>
                )}
                <Link to="/journal" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                  <Camera className="h-3 w-3" /> Voir le journal
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30">
                <Camera className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-sm font-medium">Commence ton journal photo</p>
                <p className="mt-1 text-xs text-muted-foreground">Prends une photo chaque semaine pour visualiser ta transformation.</p>
              </div>
              <Link to="/journal" className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">
                <Camera className="h-4 w-4" /> Ajouter ma première photo
              </Link>
            </div>
          )}
        </div>

        {/* ── 8. Prochain rendez-vous ─────────────────────────────────── */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Prochain point coach
          </div>

          {skinState?.nextCallDate ? (
            <>
              <p className="text-base font-semibold capitalize">
                {formatCallDate(skinState.nextCallDate)}
                {skinState.nextCallTime && <span className="ml-1.5 text-muted-foreground">· {skinState.nextCallTime}</span>}
              </p>

              {daysUntilCall !== null && (
                <p className={`mt-1 text-sm font-semibold ${
                  daysUntilCall <= 0 ? "text-primary"
                  : daysUntilCall <= 3 ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
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
                  className="flex w-full items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-muted"
                >
                  Préparer mes questions
                  {prepOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {prepOpen && (
                  <textarea
                    placeholder="Note tes questions avant l'appel…"
                    rows={4}
                    className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 py-1">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
              <div>
                <p className="text-sm text-muted-foreground">Ton prochain point coaching sera bientôt fixé.</p>
                <p className="mt-0.5 text-xs text-muted-foreground/50">Tu recevras une notification dès que la date est confirmée.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Protocol next lesson ────────────────────────────────────── */}
        {nextLesson && (
          <Link
            to="/lesson/$lessonId"
            params={{ lessonId: nextLesson.id }}
            className="flex items-center gap-4 rounded-3xl border border-border/60 bg-card px-5 py-4 shadow-soft transition-colors hover:bg-muted/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">Prochain module</p>
              <p className="mt-0.5 truncate text-sm font-medium">{nextLesson.title}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/40" />
          </Link>
        )}

      </div>
    </AppShell>
  );
}
