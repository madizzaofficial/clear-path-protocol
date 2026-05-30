import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { allLessons } from "@/lib/course-data";
import {
  BookOpen, Camera, CalendarDays, MessageSquare, ChevronRight, Loader2,
  Sparkles, Phone, Check, Sun, Moon, UserCircle,
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
  amSteps: number;
  pmSteps: number;
  checkins28: Record<string, { am: string[]; pm: string[] }>;
  adherencePct: number;
  adherenceDays: number;
  streak: number;
  latestNote: CoachNote | null;
  photos: PhotoEntry[];
  skinType: string | null;
  acneTypes: string[] | null;
  intensity: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKIN_TYPE_LABELS: Record<string, string> = {
  normale: "Normale", grasse: "Grasse", seche: "Sèche", mixte: "Mixte", sensible: "Sensible",
};

const ACNE_TYPE_LABELS: Record<string, string> = {
  comedons: "Comédons", papules: "Papules", microkystes: "Microkystes", kystes: "Kystes",
};

const INTENSITY_LABELS: Record<string, string> = {
  legere: "Légère", moderee: "Modérée", severe: "Sévère",
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
  { id: 1, shortLabel: "S.1",  label: "Semaine 1",    description: "Tu démarres ta nouvelle routine et observes les premiers ajustements de ta peau.", dayStart: 1,  dayEnd: 7 },
  { id: 2, shortLabel: "S.2",  label: "Semaine 2",    description: "Ta peau commence à trouver son équilibre avec la nouvelle routine.", dayStart: 8,  dayEnd: 14 },
  { id: 3, shortLabel: "S3-4", label: "Semaines 3–4", description: "Des ajustements peuvent apparaître. C'est une phase normale d'adaptation de la peau.", dayStart: 15, dayEnd: 28 },
  { id: 4, shortLabel: "S4-6", label: "Semaines 4–6", description: "La peau se stabilise progressivement et les premiers changements visibles commencent à apparaître.", dayStart: 29, dayEnd: 42 },
  { id: 5, shortLabel: "S6-12",label: "Semaines 6–12",description: "La texture de peau s'améliore progressivement et devient plus régulière.", dayStart: 43, dayEnd: 84 },
  { id: 6, shortLabel: "M3+",  label: "Mois 3+",      description: "On entre dans une phase d'optimisation pour corriger les marques et uniformiser la peau.", dayStart: 85, dayEnd: Infinity },
];

function CircleMetric({ label, emoji, pct, inverted, description }: { label: string; emoji: string; pct: number; inverted?: boolean; description?: string }) {
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
    <div className="flex flex-col items-center gap-1">
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
      {description && (
        <span className={`text-center text-[10px] font-semibold ${numClass}`}>{description}</span>
      )}
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

// ── Pending state ─────────────────────────────────────────────────────────────
// EDIT: remplace par ton numéro WhatsApp (format international sans +)
const WA_PHONE = "33762688174";
function buildWaUrl(firstName: string) {
  const name = firstName || "membre";
  const msg = `Bonjour Mehdi 👋\nJe m'appelle ${name} et je suis membre du Protocole Clear. J'ai une question concernant mon suivi.`;
  return `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(msg)}`;
}

const PENDING_STEPS = [
  { label: "Questionnaire reçu",     done: true,  active: false },
  { label: "Photos reçues",          done: true,  active: false },
  { label: "Analyse en cours",       done: false, active: true  },
  { label: "Routine en préparation", done: false, active: false },
  { label: "Routine disponible",     done: false, active: false },
];

// ── Main ──────────────────────────────────────────────────────────────────────

function Suivi() {
  const { user } = useAuth();
  const [data, setData] = useState<SuiviData>({
    loading: true,
    skinState: null,
    completedLessons: [],
    enrolledAt: null,
    totalRoutineSteps: 0,
    amSteps: 0,
    pmSteps: 0,
    checkins28: {},
    adherencePct: 0,
    adherenceDays: 0,
    streak: 0,
    latestNote: null,
    photos: [],
    skinType: null,
    acneTypes: null,
    intensity: null,
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
      const amSteps = routineData?.status === "sent" ? (routineData.am?.length ?? 0) : 0;
      const pmSteps = routineData?.status === "sent" ? (routineData.pm?.length ?? 0) : 0;
      const totalRoutineSteps = amSteps + pmSteps;

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
        amSteps,
        pmSteps,
        checkins28,
        adherencePct: pct,
        adherenceDays: days,
        streak,
        latestNote,
        photos,
        skinType: intakeSnap?.exists() ? (intakeSnap.data().skinType ?? null) : null,
        acneTypes: intakeSnap?.exists() ? (intakeSnap.data().acneTypes ?? null) : null,
        intensity: intakeSnap?.exists() ? (intakeSnap.data().intensity ?? null) : null,
      });
    }
    load().catch(() => setData((d) => ({ ...d, loading: false })));
  }, [user?.uid]);

  const {
    loading, skinState, completedLessons, enrolledAt, totalRoutineSteps, amSteps, pmSteps,
    checkins28, adherencePct, adherenceDays, streak, latestNote, photos, skinType, acneTypes, intensity,
  } = data;

  const lessons = allLessons();
  const done = completedLessons.length;
  const total = lessons.length;
  const protocolPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const dayCount = enrolledAt ? Math.max(1, Math.floor((Date.now() - enrolledAt) / 86_400_000) + 1) : 1;
  const currentPhase = JOURNEY_PHASES.find((p) => dayCount >= p.dayStart && dayCount <= p.dayEnd) ?? JOURNEY_PHASES[JOURNEY_PHASES.length - 1];
  const nextLesson = lessons.find((l) => !completedLessons.includes(l.id));
  const daysUntilCall = skinState?.nextCallDate ? getDaysUntil(skinState.nextCallDate) : null;
  const todayKey = new Date().toISOString().slice(0, 10);
  const amDone = checkins28[todayKey]?.am?.length ?? 0;
  const pmDone = checkins28[todayKey]?.pm?.length ?? 0;

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

  const firstName = user?.displayName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6">
        {firstName && (
          <p className="mb-5 font-display text-2xl font-semibold tracking-tight">
            Bonjour, {firstName} 👋
          </p>
        )}

        {/* ── État d'attente : routine pas encore assignée ── */}
        {!data.loading && (data.totalRoutineSteps ?? 0) === 0 && (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

            {/* Gauche 70 % — statut */}
            <div className="rounded-3xl border border-border/60 bg-card p-7 shadow-soft lg:flex-[7]">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Statut</p>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Ta routine est en préparation</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Ton questionnaire a bien été reçu. Je suis actuellement en train d'analyser ton profil
                afin de construire une routine adaptée à ta peau.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
                Temps estimé : 24 à 48 heures
              </div>
              <div className="mt-7 space-y-3">
                {PENDING_STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {s.done ? (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                    ) : s.active ? (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary-soft">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="h-6 w-6 shrink-0 rounded-full border-2 border-border bg-muted" />
                    )}
                    <p className={`text-sm ${s.done ? "font-medium" : s.active ? "font-medium text-primary" : "text-muted-foreground"}`}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Droite 30 % — vidéo + WhatsApp */}
            <div className="flex flex-col gap-5 lg:flex-[3]">

              {/* Vidéo — remplace par <video src="…" controls /> ou une iframe YouTube */}
              <div className="aspect-video overflow-hidden rounded-2xl border border-border/60 bg-muted flex items-center justify-center">
                <div className="space-y-1 px-4 text-center">
                  <p className="text-sm font-medium text-muted-foreground">Vidéo de bienvenue</p>
                  <p className="text-xs text-muted-foreground/60">45 – 90 sec</p>
                </div>
              </div>

              {/* WhatsApp */}
              <div className="rounded-2xl border border-border/60 bg-card p-5">
                <p className="mb-1 text-sm font-semibold">Une question ?</p>
                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  Tu peux me contacter directement sur WhatsApp.
                </p>
                <a
                  href={buildWaUrl(firstName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Contacter Mehdi sur WhatsApp
                </a>
              </div>

            </div>
          </div>
        )}

        {/* ── Dashboard complet (routine disponible) ── */}
        {(data.totalRoutineSteps ?? 0) > 0 && (
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6">

          {/* ── 1a. Hero gradient ───────────────── col-1 row-1 ── */}
          <div className="overflow-hidden rounded-3xl bg-gradient-warm p-6 shadow-elegant lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50">Mon parcours</p>
            <h1 className="mt-1 font-display text-5xl font-semibold leading-none">Jour {dayCount}</h1>
            <div className="mt-4 flex-1">
              <p className="text-base font-semibold">{currentPhase.label}</p>
              <p className="mt-0.5 text-sm text-foreground/70">{currentPhase.description}</p>
              {skinState?.coachPhrase && (
                <p className="mt-2 text-sm italic text-foreground/60">"{skinState.coachPhrase}"</p>
              )}
            </div>
            <span className="mt-3 inline-flex items-center rounded-full bg-background/50 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              Phase {currentPhase.id}/6
            </span>
          </div>

          {/* ── 1b. État de ta peau ─────────────── col-2 row-1 ── */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">État de ta peau</p>
              {skinState?.updatedAt && (
                <p className="text-[10px] text-muted-foreground/50">
                  mis à jour{" "}
                  {new Date(skinState.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
            <div className="flex flex-1 items-center">
              {hasSkinMetrics ? (() => {
                const infPct = skinState!.inflammationPct ?? 0;
                const barPct = skinState!.barrierPct ?? 0;
                const acnPct = skinState!.acnePct ?? 0;
                const infDesc = infPct >= 67 ? "Active" : infPct >= 34 ? "Modérée" : "Sous contrôle";
                const barDesc = barPct >= 67 ? "Excellente" : barPct >= 34 ? "En cours" : "Compromise";
                const acnDesc = acnPct >= 67 ? "Active" : acnPct >= 34 ? "Modérée" : "Contrôlée";
                return (
                  <div className="grid w-full grid-cols-3 gap-4">
                    <CircleMetric label="Inflammation" emoji="🔥" pct={infPct} inverted description={infDesc} />
                    <CircleMetric label="Barrière cutanée" emoji="🧱" pct={barPct} description={barDesc} />
                    <CircleMetric label="Acné" emoji="🧴" pct={acnPct} inverted description={acnDesc} />
                  </div>
                );
              })() : (
                <div className="flex items-start gap-3 py-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ton coach met à jour ton bilan de peau.</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/50">Il sera disponible après ta première consultation.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Prochain point coaching ─────────── col-3 row-1 ── */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft lg:col-start-3 lg:row-start-1 lg:flex lg:flex-col">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Prochain point coaching
            </div>
            <div className="flex-1">
              {skinState?.nextCallDate ? (
                <>
                  <p className="text-base font-semibold capitalize">{formatCallDate(skinState.nextCallDate)}</p>
                  {skinState.nextCallTime && (
                    <p className="text-sm text-muted-foreground">à {skinState.nextCallTime}</p>
                  )}
                  {daysUntilCall !== null && (
                    <p className={`mt-1 text-sm font-semibold ${
                      daysUntilCall <= 0 ? "text-primary"
                      : daysUntilCall <= 3 ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                    }`}>
                      {daysUntilCall < 0 ? "Passé"
                        : daysUntilCall === 0 ? "Aujourd'hui !"
                        : daysUntilCall === 1 ? "Demain"
                        : `Dans ${daysUntilCall} jours`}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Ton prochain point coaching sera bientôt fixé.</p>
              )}
            </div>
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20">
              <Phone className="h-4 w-4" /> Contacter le coach
            </button>
          </div>

          {/* ── Right sidebar wrapper ── col-3, rows 2-4, flex-col packed ── */}
          <div className="flex flex-col gap-4 lg:col-start-3 lg:row-start-2 lg:row-span-3 lg:gap-6">

            {/* Profil de peau */}
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Profil de peau</p>
              {(skinType || (acneTypes && acneTypes.length > 0) || intensity) ? (
                <div className="space-y-3">
                  {skinType && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Type</span>
                      <span className="text-sm font-semibold">{SKIN_TYPE_LABELS[skinType] ?? skinType}</span>
                    </div>
                  )}
                  {intensity && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Intensité</span>
                      <span className="text-sm font-semibold">{INTENSITY_LABELS[intensity] ?? intensity}</span>
                    </div>
                  )}
                  {acneTypes && acneTypes.length > 0 && (
                    <div className="flex items-start justify-between gap-3">
                      <span className="shrink-0 text-xs text-muted-foreground">Types d'acné</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {acneTypes.map((t) => (
                          <span key={t} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                            {ACNE_TYPE_LABELS[t] ?? t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ton profil sera renseigné après ton bilan d'intake.</p>
              )}
              <Link
                to="/profile"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <UserCircle className="h-4 w-4" /> Modifier mon profil
              </Link>
            </div>

            {/* Message du coach */}
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Message du coach
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
                <div className="flex items-start gap-3 py-1">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ton coach ne t'a pas encore envoyé de message.</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/50">Ses retours et observations apparaîtront ici.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Routine du jour */}
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Routine du jour</p>
              {totalRoutineSteps > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30">
                      <Sun className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Matin</span>
                        <span className={`text-xs font-semibold tabular-nums ${amDone >= amSteps ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                          {amDone}/{amSteps}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${amDone >= amSteps ? "bg-emerald-500" : "bg-primary"}`}
                          style={{ width: amSteps > 0 ? `${Math.min((amDone / amSteps) * 100, 100)}%` : "0%" }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/30">
                      <Moon className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Soir</span>
                        <span className={`text-xs font-semibold tabular-nums ${pmDone >= pmSteps ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                          {pmDone}/{pmSteps}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pmDone >= pmSteps ? "bg-emerald-500" : "bg-primary"}`}
                          style={{ width: pmSteps > 0 ? `${Math.min((pmDone / pmSteps) * 100, 100)}%` : "0%" }}
                        />
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/products"
                    className="mt-1 flex items-center justify-center gap-1.5 rounded-2xl border border-border/60 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    Voir la routine complète <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="flex items-start gap-3 py-1">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ta routine personnalisée sera bientôt disponible.</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/50">Ton coach la prépare pour toi.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Protocole */}
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Protocole</p>
                <span className="text-xs font-semibold text-primary">{done}/{total} · {protocolPct}%</span>
              </div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${protocolPct}%` }} />
              </div>
              {nextLesson && (
                <Link
                  to="/lesson/$lessonId"
                  params={{ lessonId: nextLesson.id }}
                  className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-xs font-medium">{nextLesson.title}</p>
                  <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground">
                    Continuer
                  </span>
                </Link>
              )}
            </div>

          </div>{/* end right sidebar wrapper */}

          {/* ── Mon parcours ─────────────────── col-span-2 row-2 ── */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft lg:col-span-2 lg:row-start-2 lg:self-start">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Mon parcours</p>
            <div className="space-y-1">
              {JOURNEY_PHASES.map((phase) => {
                const isPast = dayCount > phase.dayEnd;
                const isCurrent = dayCount >= phase.dayStart && dayCount <= phase.dayEnd;
                return (
                  <div
                    key={phase.id}
                    className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors ${isCurrent ? "bg-primary-soft" : ""}`}
                  >
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isCurrent ? "bg-primary text-primary-foreground"
                      : isPast ? "bg-emerald-100 dark:bg-emerald-950/40"
                      : "border border-border/60 bg-transparent"
                    }`}>
                      {isPast ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        : isCurrent ? phase.id
                        : <span className="text-foreground/25">{phase.id}</span>}
                    </div>
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

          {/* ── Journal photo ─────────────── col-span-2 row-3 ── */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft lg:col-span-2 lg:row-start-3 lg:self-start">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Journal photo</p>
              <Link to="/journal" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Voir tout <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {photos.slice(0, 2).map((photo, i) => {
                  const url = photo.front ?? photo.left ?? photo.right;
                  if (!url) return null;
                  return (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-2xl border border-border">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {photo.date && (
                        <p className="absolute bottom-1.5 left-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                          {new Date(photo.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30">
                  <Camera className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground">Prends une photo chaque semaine pour suivre ta transformation.</p>
                <Link
                  to="/journal"
                  className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm"
                >
                  <Camera className="h-3.5 w-3.5" /> Ajouter une photo
                </Link>
              </div>
            )}
          </div>

        </div>
        )}
      </main>
    </AppShell>
  );
}
