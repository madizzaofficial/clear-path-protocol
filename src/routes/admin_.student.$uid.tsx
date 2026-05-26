import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteField, orderBy, setDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Check, Sun, Moon, ClipboardList,
  BookOpen, ChevronDown, Lock, Play, ImageOff, MessageSquare, Send, AlertTriangle,
  Ban, UserCheck, Pencil, X, ShoppingCart, Package, Activity, Flame, CalendarDays,
} from "lucide-react";
import { course } from "@/lib/course-data";

type Tab = "profil" | "routine" | "photos" | "progression" | "notes" | "suivi";

export const Route = createFileRoute("/admin_/student/$uid")({
  head: () => ({ meta: [{ title: "Fiche élève — Protocole Clear" }] }),
  validateSearch: (s): { tab?: Tab } => ({ tab: s.tab as Tab | undefined }),
  component: StudentPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type StudentProfile = {
  uid: string;
  email: string;
  displayName: string | null;
  enrolledAt?: number;
  lastSeen?: number;
  disabled?: boolean;
};

type IntakeAnswers = {
  skinType?: string;
  acneTypes?: string[];
  intensity?: string;
  currentRoutine?: string;
  mainGoal?: string;
  photoUrls?: string[];
  completedAt?: number;
};

type RoutineStep = {
  id: string;
  order: number;
  category: string;
  product: string;
  instructions: string;
  imageUrl?: string;
  purchaseUrl?: string;
};
type Routine = { am: RoutineStep[]; pm: RoutineStep[] };

type PhotoEntry = {
  uid: string;
  date: string;
  front?: string;
  left?: string;
  right?: string;
  note?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOTAL_LESSONS = course.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);

const SKIN_TYPE_LABELS: Record<string, string> = {
  normale: "Normale", grasse: "Grasse", seche: "Sèche", mixte: "Mixte", sensible: "Sensible",
};

const ACNE_TYPE_LABELS: Record<string, string> = {
  comedons: "Comédons", papules: "Papules / Pustules", microkystes: "Microkystes", kystes: "Kystes / Nodules",
};

const INTENSITY_LABELS: Record<string, string> = {
  legere: "Légère", moderee: "Modérée", severe: "Sévère",
};

function formatDays(enrolledAt: number): string {
  const days = Math.floor((Date.now() - enrolledAt) / 86_400_000);
  if (days < 7) return `J+${days}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} semaine${weeks > 1 ? "s" : ""}`;
  return `${Math.floor(days / 30)} mois`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

type CoachNote = { id: string; note: string; authorName: string; authorUid: string; createdAt: string; isFromStudent?: boolean };

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

// ── Page ──────────────────────────────────────────────────────────────────────

function StudentPage() {
  const { uid } = Route.useParams();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [intake, setIntake] = useState<IntakeAnswers | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [reports, setReports] = useState<Record<string, "irritant" | "allergie">>({});
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [sendingNote, setSendingNote] = useState(false);
  const [skinState, setSkinState] = useState<AdminSkinState | null>(null);
  const [skinStateDraft, setSkinStateDraft] = useState<Partial<AdminSkinState>>({
    inflammationPct: 50,
    barrierPct: 50,
    acnePct: 50,
  });
  const [savingSkinState, setSavingSkinState] = useState(false);
  const [resolvingReport, setResolvingReport] = useState<string | null>(null);
  const [isDisabling, setIsDisabling] = useState(false);
  const [editingIntake, setEditingIntake] = useState(false);
  const [intakeDraft, setIntakeDraft] = useState<IntakeAnswers>({});
  const [savingIntake, setSavingIntake] = useState(false);
  const [checkins28Admin, setCheckins28Admin] = useState<Record<string, { am: string[]; pm: string[] }>>({});
  const [editingAdminSkinState, setEditingAdminSkinState] = useState(false);
  const [editingAdminCallDate, setEditingAdminCallDate] = useState(false);
  const { tab: initialTab } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(initialTab ?? "profil");
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
    if (!authLoading && user && !isAdmin) navigate({ to: "/" });
  }, [user, authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin || !uid) return;
    async function load() {
      setLoading(true);
      const [profileSnap, intakeSnap, routineSnap, progressSnap, photosSnap, notesSnap, reportsSnap, skinStateSnap] = await Promise.all([
        getDoc(doc(db, "users", uid)),
        getDoc(doc(db, "intake_answers", uid)),
        getDoc(doc(db, "routines", uid)),
        getDoc(doc(db, "progress", uid)),
        getDocs(query(collection(db, "progress_photos"), where("uid", "==", uid))),
        getDocs(query(collection(db, "users", uid, "notes"), orderBy("createdAt", "desc"))),
        getDoc(doc(db, "routine_reports", uid)),
        getDoc(doc(db, "admin_skin_state", uid)),
      ]);
      setProfile(profileSnap.exists() ? (profileSnap.data() as StudentProfile) : null);
      setIntake(intakeSnap.exists() ? (intakeSnap.data() as IntakeAnswers) : null);
      setRoutine(
        routineSnap.exists()
          ? { am: routineSnap.data().am ?? [], pm: routineSnap.data().pm ?? [] }
          : null
      );
      setCompletedLessons(progressSnap.exists() ? (progressSnap.data().completedLessons ?? []) : []);
      const sorted = photosSnap.docs
        .map((d) => d.data() as PhotoEntry)
        .sort((a, b) => b.date.localeCompare(a.date));
      setPhotos(sorted);
      setNotes(notesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CoachNote)));
      if (reportsSnap.exists()) setReports(reportsSnap.data() as Record<string, "irritant" | "allergie">);
      if (skinStateSnap.exists()) {
        const ss = skinStateSnap.data() as AdminSkinState;
        setSkinState(ss);
        setSkinStateDraft(ss);
      }
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      const start28 = new Date(today); start28.setDate(today.getDate() - 27);
      const start28Key = start28.toISOString().slice(0, 10);
      const checkinsSnap = await getDocs(
        query(collection(db, "routine_checkins", uid, "days"), where("__name__", ">=", start28Key), where("__name__", "<=", todayKey)),
      ).catch(() => null);
      const checkins28map: Record<string, { am: string[]; pm: string[] }> = {};
      checkinsSnap?.forEach((d: any) => { checkins28map[d.id] = d.data() as { am: string[]; pm: string[] }; });
      setCheckins28Admin(checkins28map);

      const initial = Object.fromEntries(course.chapters.map((c) => [c.id, true]));
      setOpenChapters(initial);
      setLoading(false);
    }
    load();
  }, [isAdmin, uid]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const initials = (profile?.displayName ?? profile?.email ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const done = completedLessons.length;
  const pct = Math.round((done / TOTAL_LESSONS) * 100);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "suivi", label: "Suivi", icon: Activity },
    { id: "profil", label: "Profil peau", icon: BookOpen },
    { id: "routine", label: "Routine", icon: Sun },
    { id: "photos", label: "Photos", icon: ClipboardList },
    { id: "progression", label: "Progression", icon: Check },
    { id: "notes", label: "Notes", icon: MessageSquare },
  ];

  async function sendNote() {
    if (!user || !noteInput.trim() || sendingNote) return;
    setSendingNote(true);
    try {
      const newNote = {
        note: noteInput.trim(),
        authorUid: user.uid,
        authorName: user.displayName ?? user.email ?? "Coach",
        studentUid: uid,
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "users", uid, "notes"), newNote);
      setNotes((prev) => [{ id: ref.id, ...newNote }, ...prev]);
      setNoteInput("");
      toast.success("Note envoyée.");
    } catch {
      toast.error("Impossible d'envoyer la note.");
    } finally {
      setSendingNote(false);
    }
  }

  async function resolveReport(stepId: string) {
    setResolvingReport(stepId);
    try {
      await updateDoc(doc(db, "routine_reports", uid), { [stepId]: deleteField() });
      setReports((prev) => {
        const next = { ...prev };
        delete next[stepId];
        return next;
      });
      toast.success("Signalement résolu.");
    } catch {
      toast.error("Impossible de résoudre le signalement.");
    } finally {
      setResolvingReport(null);
    }
  }

  async function toggleDisabled() {
    if (!profile || isDisabling) return;
    const newDisabled = !profile.disabled;
    setIsDisabling(true);
    try {
      await updateDoc(doc(db, "users", uid), { disabled: newDisabled });
      setProfile((prev) => prev ? { ...prev, disabled: newDisabled } : prev);
      toast.success(newDisabled ? "Compte désactivé." : "Compte réactivé.");
    } catch {
      toast.error("Impossible de modifier le compte.");
    } finally {
      setIsDisabling(false);
    }
  }

  async function saveIntake() {
    if (savingIntake) return;
    setSavingIntake(true);
    try {
      await updateDoc(doc(db, "intake_answers", uid), intakeDraft as Record<string, unknown>);
      setIntake(intakeDraft);
      setEditingIntake(false);
      toast.success("Profil peau mis à jour.");
    } catch {
      toast.error("Impossible d'enregistrer.");
    } finally {
      setSavingIntake(false);
    }
  }

  async function saveSkinState() {
    if (savingSkinState) return;
    setSavingSkinState(true);
    try {
      const data: Partial<AdminSkinState> & { uid: string; updatedAt: number } = {
        uid,
        inflammationPct: skinStateDraft.inflammationPct,
        barrierPct: skinStateDraft.barrierPct,
        acnePct: skinStateDraft.acnePct,
        currentPhase: skinStateDraft.currentPhase,
        coachPhrase: skinStateDraft.coachPhrase,
        nextCallDate: skinStateDraft.nextCallDate,
        nextCallTime: skinStateDraft.nextCallTime,
        updatedAt: Date.now(),
      };
      const clean = JSON.parse(JSON.stringify(data));
      await setDoc(doc(db, "admin_skin_state", uid), clean, { merge: true });
      setSkinState(clean as AdminSkinState);
      toast.success("État & direction sauvegardés.");
    } catch {
      toast.error("Impossible de sauvegarder.");
    } finally {
      setSavingSkinState(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-10">
        {/* Back */}
        <Link
          to="/admin"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au dashboard
        </Link>

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start gap-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-warm text-xl font-semibold">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {profile?.displayName ?? "—"}
            </h1>
            <p className="mt-1 text-muted-foreground">{profile?.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile?.enrolledAt && (
                <Chip>{formatDays(profile.enrolledAt)} dans le protocole</Chip>
              )}
              <Chip>{done}/{TOTAL_LESSONS} leçons · {pct}%</Chip>
              {profile?.lastSeen && (
                <Chip>Vu {formatDate(new Date(profile.lastSeen).toISOString().split("T")[0])}</Chip>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDisabled}
              disabled={isDisabling}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                profile?.disabled
                  ? "bg-primary-soft text-foreground hover:bg-primary-muted"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/20"
              }`}
            >
              {isDisabling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : profile?.disabled ? (
                <UserCheck className="h-4 w-4" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              {profile?.disabled ? "Réactiver" : "Désactiver"}
            </button>
            <Link
              to="/admin/routines"
              search={{ uid }}
              className="flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-primary-muted"
            >
              <ClipboardList className="h-4 w-4" /> Modifier la routine
            </Link>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-8 flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-muted/40 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors sm:px-4 ${
                  active ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Suivi ──────────────────────────────────────────────────────────── */}
        {tab === "suivi" && (() => {
          const enrolledAt = profile?.enrolledAt ?? null;
          const dayCount = enrolledAt ? Math.max(1, Math.floor((Date.now() - enrolledAt) / 86_400_000) + 1) : 1;
          const week = Math.min(12, Math.ceil(dayCount / 7));
          const totalSteps = (routine?.am?.length ?? 0) + (routine?.pm?.length ?? 0);
          const todayKey2 = new Date().toISOString().slice(0, 10);
          const todayCheckins = checkins28Admin[todayKey2];
          const amDoneAdmin = todayCheckins?.am?.length ?? 0;
          const pmDoneAdmin = todayCheckins?.pm?.length ?? 0;
          const amStepsAdmin = routine?.am?.length ?? 0;
          const pmStepsAdmin = routine?.pm?.length ?? 0;

          let adherenceDays = 0, adminStreak = 0, streakBroken = false;
          const todayAdm = new Date();
          for (let i = 0; i < 28; i++) {
            const d = new Date(todayAdm); d.setDate(todayAdm.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const c = checkins28Admin[key];
            const isDone = totalSteps > 0 && c && (c.am?.length ?? 0) + (c.pm?.length ?? 0) >= totalSteps;
            if (isDone) { adherenceDays++; if (!streakBroken) adminStreak++; }
            else if (i > 0) { streakBroken = true; }
          }
          const adherencePct = totalSteps > 0 ? Math.round((adherenceDays / 28) * 100) : 0;

          const infPct = skinState?.inflammationPct ?? 0;
          const barPct = skinState?.barrierPct ?? 0;
          const acnPct = skinState?.acnePct ?? 0;
          const infDesc = infPct >= 67 ? "Active" : infPct >= 34 ? "Modérée" : "Sous contrôle";
          const barDesc = barPct >= 67 ? "Excellente" : barPct >= 34 ? "En cours" : "Compromise";
          const acnDesc = acnPct >= 67 ? "Active" : acnPct >= 34 ? "Modérée" : "Contrôlée";

          return (
            <div className="space-y-6">
              {/* KPI chips */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Jour", value: `J+${dayCount}` },
                  { label: "Semaine", value: `S${week}/12` },
                  { label: "Adhérence 28j", value: `${adherencePct}%` },
                  { label: "Streak", value: adminStreak > 0 ? `🔥 ${adminStreak}j` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border border-border/60 bg-card p-4 text-center shadow-soft">
                    <p className="font-display text-2xl font-semibold">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Row 2: Prochain coaching + État de peau */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Prochain point coaching */}
                <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prochain point coaching</p>
                    <button
                      onClick={() => { setEditingAdminCallDate((v) => !v); }}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                    >
                      {editingAdminCallDate ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    </button>
                  </div>
                  {editingAdminCallDate ? (
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <input
                          type="date"
                          value={skinStateDraft.nextCallDate ?? ""}
                          onChange={(e) => setSkinStateDraft((d) => ({ ...d, nextCallDate: e.target.value }))}
                          className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          placeholder="18h"
                          value={skinStateDraft.nextCallTime ?? ""}
                          onChange={(e) => setSkinStateDraft((d) => ({ ...d, nextCallTime: e.target.value }))}
                          className="w-20 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <button
                        onClick={() => { saveSkinState(); setEditingAdminCallDate(false); }}
                        disabled={savingSkinState}
                        className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {savingSkinState ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Enregistrer
                      </button>
                    </div>
                  ) : skinStateDraft.nextCallDate ? (
                    <div>
                      <p className="font-semibold capitalize">
                        {new Date(skinStateDraft.nextCallDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                      {skinStateDraft.nextCallTime && (
                        <p className="text-sm text-muted-foreground">à {skinStateDraft.nextCallTime}</p>
                      )}
                      {(() => {
                        const now = new Date(); now.setHours(0,0,0,0);
                        const t = new Date(skinStateDraft.nextCallDate); t.setHours(0,0,0,0);
                        const diff = Math.round((t.getTime() - now.getTime()) / 86_400_000);
                        return (
                          <p className={`mt-1 text-sm font-semibold ${diff <= 0 ? "text-primary" : diff <= 3 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {diff < 0 ? "Passé" : diff === 0 ? "Aujourd'hui !" : diff === 1 ? "Demain" : `Dans ${diff} jours`}
                          </p>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun appel planifié.</p>
                  )}
                </div>

                {/* État de peau — CircleMetric + inline edit */}
                <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">État de peau</p>
                      {skinState?.updatedAt && (
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          mis à jour {new Date(skinState.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingAdminSkinState((v) => !v)}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                    >
                      {editingAdminSkinState ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    </button>
                  </div>
                  {editingAdminSkinState ? (
                    <div className="space-y-4">
                      {([
                        { key: "inflammationPct" as const, label: "🔥 Inflammation", hint: "0 = absente → 100 = sévère" },
                        { key: "barrierPct" as const, label: "🧱 Barrière cutanée", hint: "0 = compromise → 100 = excellente" },
                        { key: "acnePct" as const, label: "🧴 Acné", hint: "0 = contrôlée → 100 = sévère" },
                      ]).map(({ key, label, hint }) => (
                        <div key={key}>
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-sm font-medium">{label}</label>
                            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{skinStateDraft[key] ?? 50}%</span>
                          </div>
                          <input
                            type="range" min={0} max={100} step={5}
                            value={skinStateDraft[key] ?? 50}
                            onChange={(e) => setSkinStateDraft((d) => ({ ...d, [key]: parseInt(e.target.value) }))}
                            className="w-full cursor-pointer accent-primary"
                          />
                          <p className="mt-0.5 text-[10px] text-muted-foreground/60">{hint}</p>
                        </div>
                      ))}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Phase</label>
                        <div className="flex flex-wrap gap-2">
                          {(["reset", "stabilisation", "purge", "amélioration"] as const).map((v) => (
                            <button key={v} type="button"
                              onClick={() => setSkinStateDraft((d) => ({ ...d, currentPhase: v }))}
                              className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition-colors ${skinStateDraft.currentPhase === v ? "bg-primary text-primary-foreground" : "border border-border bg-muted/30 hover:bg-muted"}`}
                            >{v}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Phrase du coach</label>
                        <textarea
                          autoComplete="off"
                          value={skinStateDraft.coachPhrase ?? ""}
                          onChange={(e) => setSkinStateDraft((d) => ({ ...d, coachPhrase: e.target.value }))}
                          rows={2}
                          className="w-full resize-none rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => { saveSkinState(); setEditingAdminSkinState(false); }}
                          disabled={savingSkinState}
                          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          {savingSkinState ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Sauvegarder
                        </button>
                      </div>
                    </div>
                  ) : skinState ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <AdminCircleMetric label="Inflammation" emoji="🔥" pct={infPct} inverted description={infDesc} />
                        <AdminCircleMetric label="Barrière" emoji="🧱" pct={barPct} description={barDesc} />
                        <AdminCircleMetric label="Acné" emoji="🧴" pct={acnPct} inverted description={acnDesc} />
                      </div>
                      {skinState.currentPhase && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs text-muted-foreground">Phase :</span>
                          <span className="rounded-full bg-primary-soft px-3 py-0.5 text-xs font-semibold text-primary capitalize">{skinState.currentPhase}</span>
                        </div>
                      )}
                      {skinState.coachPhrase && (
                        <p className="text-xs italic text-muted-foreground">"{skinState.coachPhrase}"</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun bilan enregistré. Clique sur Modifier pour en créer un.</p>
                  )}
                </div>
              </div>

              {/* Row 3: Adhérence + Routine du jour */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Adhérence 28j */}
                <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adhérence — 28 derniers jours</p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 28 }, (_, i) => {
                      const d = new Date(todayAdm); d.setDate(todayAdm.getDate() - (27 - i));
                      const isFuture = d > todayAdm;
                      const key = d.toISOString().slice(0, 10);
                      const c = checkins28Admin[key];
                      const sum = c ? (c.am?.length ?? 0) + (c.pm?.length ?? 0) : 0;
                      const isDone = totalSteps > 0 && sum >= totalSteps;
                      const isPartial = !isDone && sum > 0;
                      return (
                        <div key={i} title={key} className={`h-4 rounded-sm ${isFuture ? "bg-muted/20" : isDone ? "bg-primary" : isPartial ? "bg-primary/30" : "bg-muted"}`} />
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> Complète</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/30" /> Partielle</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted" /> Manquée</span>
                  </div>
                </div>

                {/* Routine du jour */}
                <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Routine du jour</p>
                  {totalSteps > 0 ? (
                    <div className="space-y-4">
                      {[
                        { label: "Matin", icon: Sun, done: amDoneAdmin, total: amStepsAdmin, bg: "bg-amber-50 dark:bg-amber-950/30", ic: "text-amber-500" },
                        { label: "Soir", icon: Moon, done: pmDoneAdmin, total: pmStepsAdmin, bg: "bg-indigo-50 dark:bg-indigo-950/30", ic: "text-indigo-400" },
                      ].map(({ label, icon: Icon, done, total, bg, ic }) => (
                        <div key={label} className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                            <Icon className={`h-4 w-4 ${ic}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{label}</span>
                              <span className={`text-xs font-semibold tabular-nums ${done >= total && total > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{done}/{total}</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full transition-all ${done >= total && total > 0 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: total > 0 ? `${Math.min((done / total) * 100, 100)}%` : "0%" }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune routine assignée.</p>
                  )}
                </div>
              </div>

              {/* Envoyer une note */}
              <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Envoyer une note</p>
                <textarea
                  autoComplete="off"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Écris ton message pour l'élève…"
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={sendNote}
                    disabled={sendingNote || !noteInput.trim()}
                    className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {sendingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Envoyer
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Profil peau ─────────────────────────────────────────────────────── */}
        {tab === "profil" && (
          <div className="space-y-6">
            {!intake ? (
              <EmptyState
                icon="📋"
                title="Bilan peau non rempli"
                body="Cet élève n'a pas encore complété le formulaire d'intake."
              />
            ) : (
              <>
                {/* Edit / save toolbar */}
                <div className="flex justify-end gap-2">
                  {editingIntake ? (
                    <>
                      <button
                        onClick={() => setEditingIntake(false)}
                        className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-4 w-4" /> Annuler
                      </button>
                      <button
                        onClick={saveIntake}
                        disabled={savingIntake}
                        className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
                      >
                        {savingIntake ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Enregistrer
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setIntakeDraft(intake); setEditingIntake(true); }}
                      className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                    >
                      <Pencil className="h-4 w-4" /> Modifier
                    </button>
                  )}
                </div>

                {editingIntake ? (
                  <div className="space-y-4">
                    {/* Skin type + intensity */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <IntakeSection title="Type de peau">
                        <select
                          value={intakeDraft.skinType ?? ""}
                          onChange={(e) => setIntakeDraft((d) => ({ ...d, skinType: e.target.value }))}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        >
                          <option value="">—</option>
                          {Object.entries(SKIN_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </IntakeSection>
                      <IntakeSection title="Intensité acné">
                        <select
                          value={intakeDraft.intensity ?? ""}
                          onChange={(e) => setIntakeDraft((d) => ({ ...d, intensity: e.target.value }))}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        >
                          <option value="">—</option>
                          {Object.entries(INTENSITY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </IntakeSection>
                    </div>

                    {/* Acne types checkboxes */}
                    <IntakeSection title="Types de boutons">
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(ACNE_TYPE_LABELS).map(([k, v]) => {
                          const checked = intakeDraft.acneTypes?.includes(k) ?? false;
                          return (
                            <label key={k} className="flex cursor-pointer items-center gap-2">
                              <input

                                autoComplete="off"                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setIntakeDraft((d) => ({
                                    ...d,
                                    acneTypes: checked
                                      ? (d.acneTypes ?? []).filter((t) => t !== k)
                                      : [...(d.acneTypes ?? []), k],
                                  }))
                                }
                                className="h-4 w-4 rounded border-border accent-primary"
                              />
                              <span className="text-sm">{v}</span>
                            </label>
                          );
                        })}
                      </div>
                    </IntakeSection>

                    {/* Routine actuelle */}
                    <IntakeSection title="Routine actuelle">
                      <input

                        autoComplete="off"                        value={intakeDraft.currentRoutine ?? ""}
                        onChange={(e) => setIntakeDraft((d) => ({ ...d, currentRoutine: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="Ex. Nettoyant La Roche-Posay, hydratant…"
                      />
                    </IntakeSection>

                    {/* Objectif */}
                    <IntakeSection title="Objectif principal">
                      <textarea

                        autoComplete="off"                        value={intakeDraft.mainGoal ?? ""}
                        onChange={(e) => setIntakeDraft((d) => ({ ...d, mainGoal: e.target.value }))}
                        rows={3}
                        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="Objectif de l'élève…"
                      />
                    </IntakeSection>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <IntakeSection title="Type de peau">
                        <span className="rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary">
                          {SKIN_TYPE_LABELS[intake.skinType ?? ""] ?? intake.skinType ?? "—"}
                        </span>
                      </IntakeSection>
                      <IntakeSection title="Intensité">
                        <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                          intake.intensity === "severe"
                            ? "bg-destructive/10 text-destructive"
                            : intake.intensity === "moderee"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-primary-soft text-primary"
                        }`}>
                          {INTENSITY_LABELS[intake.intensity ?? ""] ?? intake.intensity ?? "—"}
                        </span>
                      </IntakeSection>
                      <IntakeSection title="Routine actuelle">
                        <p className="text-sm font-medium">{intake.currentRoutine ?? "—"}</p>
                      </IntakeSection>
                    </div>

                    {(intake.acneTypes?.length ?? 0) > 0 && (
                      <IntakeSection title="Type de boutons">
                        <div className="flex flex-wrap gap-2">
                          {intake.acneTypes!.map((t) => (
                            <Tag key={t}>{ACNE_TYPE_LABELS[t] ?? t}</Tag>
                          ))}
                        </div>
                      </IntakeSection>
                    )}

                    {intake.mainGoal && (
                      <IntakeSection title="Objectif principal">
                        <p className="text-sm leading-relaxed text-foreground/80">{intake.mainGoal}</p>
                      </IntakeSection>
                    )}

                    {(intake.photoUrls?.length ?? 0) > 0 && (
                      <IntakeSection title={`Photos de la peau (${intake.photoUrls!.length})`}>
                        <div className="flex flex-wrap gap-3">
                          {intake.photoUrls!.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={url}
                                alt={`Photo ${i + 1}`}
                                className="h-32 w-32 rounded-2xl object-cover border border-border transition-opacity hover:opacity-80"
                              />
                            </a>
                          ))}
                        </div>
                      </IntakeSection>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Routine ─────────────────────────────────────────────────────────── */}
        {tab === "routine" && (
          <div>
            {/* Produits signalés */}
            {Object.keys(reports).length > 0 && routine && (() => {
              const allSteps = [...(routine.am ?? []), ...(routine.pm ?? [])];
              const flagged = Object.entries(reports)
                .map(([stepId, type]) => ({ step: allSteps.find((s) => s.id === stepId), type }))
                .filter((f) => f.step);
              if (flagged.length === 0) return null;
              return (
                <div className="mb-6 rounded-3xl border border-orange-200 bg-orange-50 p-5 dark:border-orange-900/40 dark:bg-orange-950/20">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                      {flagged.length} produit{flagged.length > 1 ? "s" : ""} signalé{flagged.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {flagged.map(({ step, type }) => (
                      <div key={step!.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-4 py-2.5 dark:bg-black/20">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{step!.product}</p>
                          <p className="text-xs text-muted-foreground">{step!.category}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            type === "allergie"
                              ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                              : "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
                          }`}>
                            {type === "allergie" ? "Allergie" : "Irritant"}
                          </span>
                          <button
                            onClick={() => resolveReport(step!.id)}
                            disabled={resolvingReport === step!.id}
                            className="flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                          >
                            {resolvingReport === step!.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Traité
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {!routine || (routine.am.length === 0 && routine.pm.length === 0) ? (
              <EmptyState
                icon="🧴"
                title="Aucune routine définie"
                body="Aucune routine n'a encore été assignée à cet élève."
              />
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                <RoutineBlock label="Matin" icon={Sun} steps={routine.am} />
                <RoutineBlock label="Soir" icon={Moon} steps={routine.pm} />
              </div>
            )}
          </div>
        )}

        {/* ── Photos ──────────────────────────────────────────────────────────── */}
        {tab === "photos" && (
          <div>
            {photos.length === 0 ? (
              <EmptyState
                icon="📷"
                title="Aucune photo de suivi"
                body="L'élève n'a pas encore posté de photo dans son journal de peau."
              />
            ) : (
              <div className="space-y-6">
                {photos.map((p) => (
                  <div key={p.date} className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
                    <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
                      <p className="font-semibold">{formatDate(p.date)}</p>
                      {p.note && (
                        <p className="max-w-xs truncate text-xs text-muted-foreground">{p.note}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-px bg-border/40">
                      {(["front", "left", "right"] as const).map((angle) => {
                        const url = p[angle];
                        const labels = { front: "Face", left: "Gauche", right: "Droite" };
                        return (
                          <div key={angle} className="relative aspect-square bg-muted/30">
                            {url ? (
                              <img
                                src={url}
                                alt={labels[angle]}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/40">
                                <ImageOff className="h-6 w-6" />
                              </div>
                            )}
                            <span className="absolute bottom-2 left-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium backdrop-blur">
                              {labels[angle]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Progression ─────────────────────────────────────────────────────── */}
        {tab === "progression" && (
          <div>
            <div className="mb-6 rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Progression globale</p>
                <span className="font-display text-2xl font-semibold">{pct}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{done} sur {TOTAL_LESSONS} leçons complétées</p>
            </div>

            <div className="space-y-3">
              {course.chapters.map((ch, i) => {
                const chDone = ch.lessons.filter((l) => completedLessons.includes(l.id)).length;
                const chPct = Math.round((chDone / ch.lessons.length) * 100);
                const isOpen = openChapters[ch.id];
                return (
                  <div key={ch.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
                    <button
                      onClick={() => setOpenChapters((s) => ({ ...s, [ch.id]: !s[ch.id] }))}
                      className="flex w-full items-center gap-4 p-5 text-left"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{ch.title}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${chPct}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {chDone}/{ch.lessons.length}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <ul className="border-t border-border/60 divide-y divide-border/40">
                        {ch.lessons.map((l) => {
                          const isDone = completedLessons.includes(l.id);
                          return (
                            <li
                              key={l.id}
                              className="flex items-center gap-3 px-5 py-3"
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                  isDone
                                    ? "bg-primary text-primary-foreground"
                                    : l.locked
                                    ? "bg-muted"
                                    : "border border-border bg-background"
                                }`}
                              >
                                {isDone ? (
                                  <Check className="h-3 w-3" />
                                ) : l.locked ? (
                                  <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                                ) : null}
                              </span>
                              <span
                                className={`flex-1 text-sm ${
                                  isDone ? "text-muted-foreground line-through" : ""
                                }`}
                              >
                                {l.title}
                              </span>
                              <span className="text-xs text-muted-foreground">{l.duration}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* ── Notes ──────────────────────────────────────────────────────────── */}
        {tab === "notes" && (
          <div className="space-y-6">

            {/* Notes history */}
            {notes.length === 0 ? (
              <EmptyState
                icon="💬"
                title="Aucune note envoyée"
                body="Les notes que tu envoies à cet élève apparaîtront ici."
              />
            ) : (
              <div className="space-y-3">
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-2xl border p-5 shadow-soft ${
                      n.isFromStudent
                        ? "border-primary/20 bg-primary-soft/30 ml-6"
                        : "border-border/60 bg-card"
                    }`}
                  >
                    {n.isFromStudent && (
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Réponse de l'élève
                      </p>
                    )}
                    <p className="text-sm leading-relaxed text-foreground">{n.note}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {n.authorName} · {new Date(n.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border/60 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function Tag({ children, variant }: { children: React.ReactNode; variant?: "warn" }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        variant === "warn"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary-soft text-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function IntakeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card py-16 shadow-soft">
      <span className="text-4xl">{icon}</span>
      <p className="mt-4 font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function LevelSelector({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-40 shrink-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{help}</p>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`h-9 w-9 rounded-xl text-sm font-semibold transition-colors ${
              value === v
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdminCircleMetric({ label, emoji, pct, inverted, description }: { label: string; emoji: string; pct: number; inverted?: boolean; description?: string }) {
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
      <div className="relative h-[80px] w-[80px]">
        <svg viewBox="0 0 80 80" className="-rotate-90 h-full w-full">
          <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"
            className={arcClass} strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.7s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-lg leading-none">{emoji}</span>
          <span className={`text-xs font-bold tabular-nums leading-tight ${numClass}`}>{pct}</span>
        </div>
      </div>
      <span className="text-center text-[10px] font-medium text-foreground/70">{label}</span>
      {description && <span className={`text-center text-[10px] font-semibold ${numClass}`}>{description}</span>}
    </div>
  );
}

function RoutineBlock({
  label,
  icon: Icon,
  steps,
}: {
  label: string;
  icon: React.ElementType;
  steps: RoutineStep[];
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">{label}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{steps.length} étapes</span>
      </div>
      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune étape</p>
      ) : (
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              {s.imageUrl ? (
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted">
                  <img src={s.imageUrl} alt={s.product} className="h-full w-full rounded-xl object-cover" />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted">
                  <Package className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{s.product}</p>
                <p className="text-xs text-muted-foreground">{s.category}</p>
                {s.instructions && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">{s.instructions}</p>
                )}
                {s.purchaseUrl && (
                  <a
                    href={s.purchaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ShoppingCart className="h-3 w-3" /> Acheter
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
