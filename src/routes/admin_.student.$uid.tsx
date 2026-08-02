import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteField, orderBy, setDoc, deleteDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Check, Sun, Moon, ClipboardList,
  BookOpen, ChevronDown, Lock, Play, ImageOff, MessageSquare, Send, AlertTriangle,
  Ban, UserCheck, Pencil, X, ShoppingCart, Package, Activity, Flame, CalendarDays, History, Sparkles, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  analyzeIntakeFn,
  analyzeIntakeFinalFn,
  analyzeProgressFn,
  analyzeProgressFinalFn,
  type AiAnalysisResult,
} from "@/lib/ai-coach";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { course } from "@/lib/course-data";

// ── Server function — delete Firebase Auth user ───────────────────────────────
// callerToken: Firebase ID token of the admin making the request.
// The handler verifies it, checks admin role in Firestore, and blocks self-deletion.

const deleteAuthUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { uid: string; callerToken: string }) => d)
  .handler(async (ctx) => {
    const { uid, callerToken } = ctx.data;

    // Same env var pattern as firebase-admin.ts (base64-encoded service account JSON)
    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT manquant");

    const { getApps, initializeApp, cert } = await import("firebase-admin/app");
    const { getAuth }      = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");

    // Named "admin" app — same as firebase-admin.ts, safe against hot-reload double-init
    const app = getApps().find((a) => a.name === "admin")
      ?? initializeApp(
           { credential: cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))) },
           "admin"
         );

    // 1. Verify caller identity
    let callerUid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(callerToken);
      callerUid = decoded.uid;
    } catch {
      throw new Error("Unauthorized: invalid token");
    }

    // 2. Check caller is admin via config/admins.uids[]
    const configSnap = await getFirestore(app).collection("config").doc("admins").get();
    const adminUids: string[] = configSnap.data()?.uids ?? [];
    if (!adminUids.includes(callerUid)) throw new Error("Forbidden: not an admin");

    // 3. Block self-deletion
    if (callerUid === uid) throw new Error("Forbidden: cannot delete your own account");

    try {
      await getAuth(app).deleteUser(uid);
    } catch (err: unknown) {
      // If the Auth account was already deleted, treat as success and continue Firestore cleanup
      const code = (err as { code?: string }).code;
      if (code !== "auth/user-not-found") throw err;
    }
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────

type Tab = "profil" | "routine" | "photos" | "progression" | "notes" | "suivi" | "historique";

type SkinStateHistoryEntry = {
  id: string;
  timestamp: number;
  inflammationPct: number;
  barrierPct: number;
  acnePct: number;
};

type RoutineHistoryEntry = {
  id: string;
  timestamp: number;
  isUpdate: boolean;
  reasonTag: "initial" | "irritation" | "allergie" | "ajustement" | "rupture_stock" | "autre";
  note: string;
  am: { product: string; category: string }[];
  pm: { product: string; category: string }[];
};

const REASON_TAG_LABELS: Record<string, string> = {
  initial: "Routine initiale",
  irritation: "Irritation produit",
  allergie: "Allergie",
  ajustement: "Ajustement protocole",
  rupture_stock: "Rupture de stock",
  autre: "Autre",
};

const REASON_TAG_COLORS: Record<string, string> = {
  initial: "bg-primary/10 text-primary",
  irritation: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  allergie: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  ajustement: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  rupture_stock: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  autre: "bg-muted text-muted-foreground",
};

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
  accountType?: "full" | "routine_only";
  adminCreated?: boolean;
};

type IntakeAnswers = {
  skinType?: string;
  acneTypes?: string[];
  intensity?: string;
  currentRoutine?: string;
  mainGoal?: string;
  photoUrls?: string[];
  completedAt?: number;
  aiAnalysis?: AiAnalysisResult;
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
  aiProgress?: AiAnalysisResult;
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingIntake, setEditingIntake] = useState(false);
  const [intakeDraft, setIntakeDraft] = useState<IntakeAnswers>({});
  const [savingIntake, setSavingIntake] = useState(false);
  const [checkins28Admin, setCheckins28Admin] = useState<Record<string, { am: string[]; pm: string[] }>>({});
  const [editingAdminSkinState, setEditingAdminSkinState] = useState(false);
  const [editingAdminCallDate, setEditingAdminCallDate] = useState(false);
  const [routineStartedAt, setRoutineStartedAt] = useState<number | null>(null);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");
  const [savingStartDate, setSavingStartDate] = useState(false);
  const [skinStateHistory, setSkinStateHistory] = useState<SkinStateHistoryEntry[]>([]);
  const [routineHistory, setRoutineHistory] = useState<RoutineHistoryEntry[]>([]);
  const { tab: initialTab } = Route.useSearch();

  // ── AI coach states ──────────────────────────────────────────────────────
  type AiStep = "idle" | "analyzing" | "draft" | "finalizing" | "final";
  const [intakeAiStep, setIntakeAiStep] = useState<AiStep>("idle");
  const [intakeAiDraft, setIntakeAiDraft] = useState("");
  const [intakeAiAdminNote, setIntakeAiAdminNote] = useState("");
  const [intakeAiFinal, setIntakeAiFinal] = useState("");
  const [progressAiStep, setProgressAiStep] = useState<AiStep>("idle");
  const [progressAiDraft, setProgressAiDraft] = useState("");
  const [progressAiAdminNote, setProgressAiAdminNote] = useState("");
  const [progressAiFinal, setProgressAiFinal] = useState("");
  const [selectedPhotoEntries, setSelectedPhotoEntries] = useState<string[]>([]);
  const [progressAiContext, setProgressAiContext] = useState("");
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
      const profileData = profileSnap.exists() ? (profileSnap.data() as StudentProfile) : null;
      setProfile(profileData);
      if (profileSnap.exists()) {
        const rsa = profileSnap.data().routineStartedAt as number | undefined;
        if (rsa) {
          setRoutineStartedAt(rsa);
          setStartDateInput(new Date(rsa).toISOString().slice(0, 10));
        }
      }
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
        if (ss.aiProgress) {
          setProgressAiDraft(ss.aiProgress.draft);
          setProgressAiAdminNote(ss.aiProgress.adminNote);
          setProgressAiFinal(ss.aiProgress.final);
          setProgressAiStep("final");
        }
      }
      if (intakeSnap.exists() && intakeSnap.data().aiAnalysis) {
        const ai = intakeSnap.data().aiAnalysis as AiAnalysisResult;
        setIntakeAiDraft(ai.draft);
        setIntakeAiAdminNote(ai.adminNote);
        setIntakeAiFinal(ai.final);
        setIntakeAiStep("final");
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

      // Load history subcollections (non-blocking)
      getDocs(query(collection(db, "users", uid, "skin_state_history"), orderBy("timestamp", "asc")))
        .then((snap) => setSkinStateHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SkinStateHistoryEntry))))
        .catch(() => {});
      getDocs(query(collection(db, "users", uid, "routine_history"), orderBy("timestamp", "desc")))
        .then((snap) => setRoutineHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RoutineHistoryEntry))))
        .catch(() => {});

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
    { id: "historique", label: "Historique", icon: History },
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

  async function markRoutineStarted() {
    const now = Date.now();
    setSavingStartDate(true);
    try {
      await updateDoc(doc(db, "users", uid), { routineStartedAt: now });
      setRoutineStartedAt(now);
      setStartDateInput(new Date(now).toISOString().slice(0, 10));
      toast.success("Date de début de routine enregistrée !");
    } catch {
      toast.error("Impossible d'enregistrer la date.");
    } finally {
      setSavingStartDate(false);
    }
  }

  async function saveStartDate() {
    const ts = new Date(startDateInput).getTime();
    if (isNaN(ts)) return;
    setSavingStartDate(true);
    try {
      await updateDoc(doc(db, "users", uid), { routineStartedAt: ts });
      setRoutineStartedAt(ts);
      setEditingStartDate(false);
      toast.success("Date mise à jour.");
    } catch {
      toast.error("Impossible de mettre à jour la date.");
    } finally {
      setSavingStartDate(false);
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

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setConfirmDeleteOpen(false);
    try {
      const callerToken = await auth.currentUser?.getIdToken();
      if (!callerToken) throw new Error("Non authentifié");

      // Delete Firebase Auth account — ignores user-not-found (already deleted)
      await deleteAuthUserFn({ data: { uid, callerToken } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("[deleteAccount] Auth error:", msg);
      // Only block if it's an auth/permissions error, not a missing-user error
      if (msg.includes("Unauthorized") || msg.includes("Forbidden")) {
        toast.error(`Impossible de supprimer — ${msg}`);
        setDeleting(false);
        return;
      }
    }

    // Always clean Firestore regardless of Auth result
    await Promise.allSettled([
      deleteDoc(doc(db, "users", uid)),
      deleteDoc(doc(db, "intake_answers", uid)),
      deleteDoc(doc(db, "routines", uid)),
      deleteDoc(doc(db, "progress", uid)),
      deleteDoc(doc(db, "routine_reports", uid)),
      deleteDoc(doc(db, "admin_skin_state", uid)),
    ]);

    toast.success("Compte supprimé définitivement.");
    navigate({ to: "/admin/tokens" });
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

  // ── AI coach handlers ────────────────────────────────────────────────────

  function getSelectedPhotosFlat() {
    return photos
      .filter((p) => selectedPhotoEntries.includes(p.date))
      .flatMap((p) =>
        (
          [
            p.front ? { url: p.front, date: p.date, label: "Face" } : null,
            p.left ? { url: p.left, date: p.date, label: "Profil gauche" } : null,
            p.right ? { url: p.right, date: p.date, label: "Profil droit" } : null,
          ] as ({ url: string; date: string; label: string } | null)[]
        ).filter((x): x is { url: string; date: string; label: string } => x !== null)
      );
  }

  function getSkinStateHistoryInput() {
    return skinStateHistory.map((e) => ({
      inflammation: e.inflammationPct,
      barrier: e.barrierPct,
      acne: e.acnePct,
      date: e.timestamp,
    }));
  }

  async function handleIntakeAnalyze() {
    if (!intake) return;
    setIntakeAiStep("analyzing");
    try {
      const res = await analyzeIntakeFn({
        data: {
          intake: {
            skinType: intake.skinType,
            acneTypes: intake.acneTypes,
            intensity: intake.intensity,
            currentRoutine: intake.currentRoutine,
            mainGoal: intake.mainGoal,
          },
          photoUrls: intake.photoUrls ?? [],
        },
      });
      setIntakeAiDraft(res.text);
      setIntakeAiStep("draft");
    } catch {
      setIntakeAiStep("idle");
      toast.error("Analyse impossible. Réessaie.");
    }
  }

  async function handleIntakeFinalize() {
    if (!intake || !intakeAiAdminNote.trim()) return;
    setIntakeAiStep("finalizing");
    try {
      const res = await analyzeIntakeFinalFn({
        data: {
          intake: {
            skinType: intake.skinType,
            acneTypes: intake.acneTypes,
            intensity: intake.intensity,
            currentRoutine: intake.currentRoutine,
            mainGoal: intake.mainGoal,
          },
          photoUrls: intake.photoUrls ?? [],
          draft: intakeAiDraft,
          adminNote: intakeAiAdminNote,
        },
      });
      const result: AiAnalysisResult = { draft: intakeAiDraft, adminNote: intakeAiAdminNote, final: res.text, analyzedAt: Date.now() };
      await setDoc(doc(db, "intake_answers", uid), { aiAnalysis: result }, { merge: true });
      setIntakeAiFinal(res.text);
      setIntakeAiStep("final");
    } catch {
      setIntakeAiStep("draft");
      toast.error("Impossible de finaliser. Réessaie.");
    }
  }

  async function handleProgressAnalyze() {
    setProgressAiStep("analyzing");
    try {
      const res = await analyzeProgressFn({
        data: {
          photos: getSelectedPhotosFlat(),
          skinStateHistory: getSkinStateHistoryInput(),
          adminContext: progressAiContext || undefined,
        },
      });
      setProgressAiDraft(res.text);
      setProgressAiStep("draft");
    } catch {
      setProgressAiStep("idle");
      toast.error("Analyse impossible. Réessaie.");
    }
  }

  async function handleProgressFinalize() {
    if (!progressAiAdminNote.trim()) return;
    setProgressAiStep("finalizing");
    try {
      const res = await analyzeProgressFinalFn({
        data: {
          photos: getSelectedPhotosFlat(),
          skinStateHistory: getSkinStateHistoryInput(),
          adminContext: progressAiContext || undefined,
          draft: progressAiDraft,
          adminNote: progressAiAdminNote,
        },
      });
      const result: AiAnalysisResult = { draft: progressAiDraft, adminNote: progressAiAdminNote, final: res.text, analyzedAt: Date.now() };
      await setDoc(doc(db, "admin_skin_state", uid), { aiProgress: result }, { merge: true });
      setProgressAiFinal(res.text);
      setProgressAiStep("final");
    } catch {
      setProgressAiStep("draft");
      toast.error("Impossible de finaliser. Réessaie.");
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

      // Write snapshot to history
      const historyEntry: SkinStateHistoryEntry = {
        id: "",
        timestamp: clean.updatedAt,
        inflammationPct: clean.inflammationPct ?? 0,
        barrierPct: clean.barrierPct ?? 0,
        acnePct: clean.acnePct ?? 0,
      };
      addDoc(collection(db, "users", uid, "skin_state_history"), {
        timestamp: clean.updatedAt,
        inflammationPct: clean.inflammationPct ?? 0,
        barrierPct: clean.barrierPct ?? 0,
        acnePct: clean.acnePct ?? 0,
      }).then((ref) => {
        setSkinStateHistory((prev) => [...prev, { ...historyEntry, id: ref.id }]);
      }).catch(() => {});

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
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {profile?.displayName ?? "—"}
              </h1>
              {profile?.accountType === "routine_only" && (
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:bg-orange-950/40" title="Créé par l'admin — pas d'onboarding">
                  Sans onboarding
                </span>
              )}
            </div>
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
            <button
              onClick={() => setConfirmDeleteOpen(true)}
              className="flex items-center gap-2 rounded-full bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
            {!routineStartedAt ? (
              <button
                onClick={markRoutineStarted}
                disabled={savingStartDate}
                className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {savingStartDate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                A commencé sa routine
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-primary-soft px-4 py-2 text-sm font-medium text-primary">
                <Check className="h-4 w-4" />
                Routine démarrée le {new Date(routineStartedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </div>
            )}
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
          const startTs = routineStartedAt ?? profile?.enrolledAt ?? null;
          const dayCount = startTs ? Math.max(1, Math.floor((Date.now() - startTs) / 86_400_000) + 1) : 1;
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
          const barDesc = barPct >= 67 ? "Compromise" : barPct >= 34 ? "En cours" : "Excellente";
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

              {/* Début de routine */}
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">Début de la routine</p>
                      <p className="text-xs text-muted-foreground">
                        {routineStartedAt
                          ? `Démarrée le ${new Date(routineStartedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · Semaine ${week}`
                          : "Non renseigné — les semaines sont calculées depuis l'inscription"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingStartDate((v) => !v)}
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    {editingStartDate ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </button>
                </div>
                {editingStartDate && (
                  <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                    <input
                      type="date"
                      value={startDateInput}
                      onChange={(e) => setStartDateInput(e.target.value)}
                      className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      onClick={saveStartDate}
                      disabled={savingStartDate}
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                    >
                      {savingStartDate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Enregistrer
                    </button>
                  </div>
                )}
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
                        { key: "barrierPct" as const, label: "🧱 Barrière cutanée", hint: "0 = excellente → 100 = compromise" },
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
                        <AdminCircleMetric label="Barrière" emoji="🧱" pct={barPct} inverted description={barDesc} />
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

              {/* ── Bilan IA progression ── */}
              <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bilan IA progression</p>
                </div>

                {progressAiStep === "idle" && (
                  <div className="space-y-4">
                    {photos.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Photos à inclure (optionnel)</p>
                        <div className="flex flex-wrap gap-2">
                          {photos.slice(0, 8).map((p) => (
                            <label key={p.date} className="flex cursor-pointer items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={selectedPhotoEntries.includes(p.date)}
                                onChange={() =>
                                  setSelectedPhotoEntries((prev) =>
                                    prev.includes(p.date) ? prev.filter((d) => d !== p.date) : [...prev, p.date]
                                  )
                                }
                                className="h-3.5 w-3.5 rounded border-border accent-primary"
                              />
                              <span className="text-xs text-muted-foreground">
                                {new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <textarea
                      value={progressAiContext}
                      onChange={(e) => setProgressAiContext(e.target.value)}
                      rows={2}
                      placeholder="Contexte : changement alimentation, stress, nouvel actif…"
                      className="w-full resize-none rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleProgressAnalyze}
                      className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted"
                    >
                      <Sparkles className="h-4 w-4 text-primary" />
                      Analyser la progression
                    </button>
                  </div>
                )}

                {(progressAiStep === "analyzing" || progressAiStep === "finalizing") && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {progressAiStep === "analyzing" ? "Analyse en cours…" : "Génération du verdict…"}
                  </div>
                )}

                {progressAiStep === "draft" && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{progressAiDraft}</p>
                    </div>
                    <textarea
                      value={progressAiAdminNote}
                      onChange={(e) => setProgressAiAdminNote(e.target.value)}
                      rows={3}
                      placeholder="Votre analyse / observations avant le verdict final…"
                      className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleProgressFinalize}
                      disabled={!progressAiAdminNote.trim()}
                      className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" /> Valider →
                    </button>
                  </div>
                )}

                {progressAiStep === "final" && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-primary/20 bg-primary-soft/30 px-4 py-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{progressAiFinal}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60">Verdict IA · GPT-4o</span>
                      <button
                        onClick={() => { setProgressAiStep("idle"); setProgressAiDraft(""); setProgressAiAdminNote(""); setSelectedPhotoEntries([]); }}
                        className="text-[10px] text-muted-foreground/60 underline underline-offset-2 hover:text-muted-foreground"
                      >
                        Ré-analyser
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Évolution métriques peau */}
              {skinStateHistory.length >= 2 && (
                <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Évolution métriques peau</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={skinStateHistory.map((e) => ({
                      date: new Date(e.timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
                      Inflammation: e.inflammationPct,
                      Barrière: e.barrierPct,
                      Acné: e.acnePct,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="Inflammation" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Barrière" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Acné" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

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

                    {/* ── Analyse IA du bilan ── */}
                    <IntakeSection title="Analyse IA du bilan">
                      {intakeAiStep === "idle" && (
                        <button
                          onClick={handleIntakeAnalyze}
                          className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted"
                        >
                          <Sparkles className="h-4 w-4 text-primary" />
                          Analyser le bilan
                        </button>
                      )}
                      {(intakeAiStep === "analyzing" || intakeAiStep === "finalizing") && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          {intakeAiStep === "analyzing" ? "Analyse en cours…" : "Génération du verdict…"}
                        </div>
                      )}
                      {intakeAiStep === "draft" && (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{intakeAiDraft}</p>
                          </div>
                          <textarea
                            value={intakeAiAdminNote}
                            onChange={(e) => setIntakeAiAdminNote(e.target.value)}
                            rows={3}
                            placeholder="Votre analyse / avis avant le verdict final…"
                            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                          <button
                            onClick={handleIntakeFinalize}
                            disabled={!intakeAiAdminNote.trim()}
                            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                          >
                            <Check className="h-4 w-4" /> Valider →
                          </button>
                        </div>
                      )}
                      {intakeAiStep === "final" && (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-primary/20 bg-primary-soft/30 px-4 py-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{intakeAiFinal}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground/60">Verdict IA · GPT-4o</span>
                            <button
                              onClick={() => setIntakeAiStep("idle")}
                              className="text-[10px] text-muted-foreground/60 underline underline-offset-2 hover:text-muted-foreground"
                            >
                              Ré-analyser
                            </button>
                          </div>
                        </div>
                      )}
                    </IntakeSection>
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
                <RoutineBlock label="Matin" icon={Sun} steps={routine.am} reports={reports} />
                <RoutineBlock label="Soir" icon={Moon} steps={routine.pm} reports={reports} />
              </div>
            )}
          </div>
        )}

        {/* ── Historique ──────────────────────────────────────────────────────── */}
        {tab === "historique" && (
          <div className="space-y-10">

            {/* ── États de peau ── */}
            <section>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">États de peau</p>
              {skinStateHistory.length === 0 ? (
                <EmptyState icon="🧴" title="Aucun bilan enregistré" body="Les bilans apparaîtront ici après chaque sauvegarde de l'état de peau." />
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute left-5 top-4 bottom-4 w-px bg-border/60" />
                  {[...skinStateHistory].reverse().map((entry) => {
                    const infDesc = entry.inflammationPct >= 67 ? "Active" : entry.inflammationPct >= 34 ? "Modérée" : "Sous contrôle";
                    const barDesc = entry.barrierPct >= 67 ? "Excellente" : entry.barrierPct >= 34 ? "En cours" : "Compromise";
                    const acnDesc = entry.acnePct >= 67 ? "Active" : entry.acnePct >= 34 ? "Modérée" : "Contrôlée";
                    return (
                      <div key={entry.id} className="relative flex gap-4 pb-6">
                        <div className="relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted shadow-sm">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
                          <p className="mb-3 text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <AdminCircleMetric label="Inflammation" emoji="🔥" pct={entry.inflammationPct} inverted description={infDesc} />
                            <AdminCircleMetric label="Barrière cutanée" emoji="🧱" pct={entry.barrierPct} inverted description={barDesc} />
                            <AdminCircleMetric label="Acné" emoji="🧴" pct={entry.acnePct} inverted description={acnDesc} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Routines ── */}
            <section>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Routines</p>
              {routineHistory.length === 0 ? (
                <EmptyState icon="📋" title="Aucun historique" body="L'historique se construira à chaque envoi de routine." />
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute left-5 top-4 bottom-4 w-px bg-border/60" />
                  {routineHistory.map((entry) => (
                    <div key={entry.id} className="relative flex gap-4 pb-6">
                      <div className={`relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background shadow-sm ${entry.isUpdate ? "bg-muted" : "bg-primary"}`}>
                        {entry.isUpdate ? <History className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REASON_TAG_COLORS[entry.reasonTag] ?? REASON_TAG_COLORS.autre}`}>
                            {REASON_TAG_LABELS[entry.reasonTag] ?? entry.reasonTag}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="mb-3 text-sm italic text-muted-foreground">"{entry.note}"</p>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[{ label: "☀️ Matin", steps: entry.am }, { label: "🌙 Soir", steps: entry.pm }].map(({ label, steps }) => (
                            <div key={label}>
                              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{label} — {steps.length} étape{steps.length !== 1 ? "s" : ""}</p>
                              <ul className="space-y-0.5">
                                {steps.map((s, j) => (
                                  <li key={j} className="text-xs text-foreground/80">• {s.product}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

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

      {/* Confirmation suppression compte — Dialog renders via portal, position in tree doesn't matter */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Supprimer ce compte</DialogTitle>
          <DialogDescription>
            Cette action est <strong>irréversible</strong>. Le compte Firebase, les réponses d'onboarding, la routine et les données de progression seront supprimés définitivement.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <strong>{profile?.displayName ?? profile?.email}</strong> — {profile?.email}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={() => setConfirmDeleteOpen(false)}
            disabled={deleting}
            className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="flex items-center gap-2 rounded-full bg-destructive px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Supprimer définitivement
          </button>
        </div>
      </DialogContent>
    </Dialog>
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
  reports = {},
}: {
  label: string;
  icon: React.ElementType;
  steps: RoutineStep[];
  reports?: Record<string, "irritant" | "allergie">;
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
          {steps.map((s, i) => {
            const reaction = reports[s.id];
            return (
            <li key={s.id} className={`flex items-start gap-3 rounded-xl p-1.5 -mx-1.5 ${reaction ? "bg-orange-50/60 dark:bg-orange-950/10" : ""}`}>
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium leading-tight">{s.product}</p>
                  {reaction && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      reaction === "allergie"
                        ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                        : "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
                    }`}>
                      {reaction === "allergie" ? "⚠ Allergie" : "⚠ Irritant"}
                    </span>
                  )}
                </div>
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
          );
          })}
        </ol>
      )}
    </div>
  );
}
