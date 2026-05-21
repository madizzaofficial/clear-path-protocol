import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Calendar, Check, ChevronRight, FlaskConical, Loader2, LogOut, Mail, Pencil, X } from "lucide-react";
import { allLessons } from "@/lib/course-data";

type IntakeAnswers = {
  skinType?: string;
  acneTypes?: string[];
  intensity?: string;
  currentRoutine?: string;
  mainGoal?: string;
};

const SKIN_TYPE_LABELS: Record<string, string> = {
  normale: "Normale", grasse: "Grasse", seche: "Sèche", mixte: "Mixte", sensible: "Sensible",
};
const ACNE_TYPE_LABELS: Record<string, string> = {
  comedons: "Comédons", papules: "Papules / Pustules", microkystes: "Microkystes", kystes: "Kystes / Nodules",
};
const INTENSITY_LABELS: Record<string, string> = {
  legere: "Légère", moderee: "Modérée", severe: "Sévère",
};

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Mon profil — Protocole Clear" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [intake, setIntake] = useState<IntakeAnswers | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [enrolledAt, setEnrolledAt] = useState<number | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getDoc(doc(db, "intake_answers", user.uid)),
      getDoc(doc(db, "progress", user.uid)),
      getDoc(doc(db, "users", user.uid)),
    ]).then(([intakeSnap, progressSnap, userSnap]) => {
      if (intakeSnap.exists()) setIntake(intakeSnap.data() as IntakeAnswers);
      if (progressSnap.exists()) setCompletedLessons(progressSnap.data().completedLessons ?? []);
      if (userSnap.exists()) {
        setEnrolledAt(userSnap.data().enrolledAt ?? null);
        setStreak(userSnap.data().streak ?? 0);
      }
      setLoading(false);
    });
  }, [user]);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  async function handlePasswordReset() {
    if (!user?.email || resetLoading) return;
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success("Email de réinitialisation envoyé à " + user.email);
    } catch {
      toast.error("Impossible d'envoyer l'email. Réessaie.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSaveName() {
    if (!user || savingName || !nameInput.trim()) return;
    setSavingName(true);
    try {
      const name = nameInput.trim();
      await updateProfile(user, { displayName: name });
      await updateDoc(doc(db, "users", user.uid), { displayName: name });
      setEditingName(false);
      toast.success("Prénom mis à jour.");
    } catch {
      toast.error("Impossible de mettre à jour le prénom.");
    } finally {
      setSavingName(false);
    }
  }

  if (authLoading || !user) return null;

  const lessons = allLessons();
  const done = completedLessons.length;
  const pct = Math.round((done / lessons.length) * 100);
  const daysIn = enrolledAt ? Math.max(0, Math.floor((Date.now() - enrolledAt) / 86_400_000)) : null;
  const week = daysIn !== null ? Math.ceil((daysIn + 1) / 7) : 1;

  const initials = user.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user.email?.slice(0, 2).toUpperCase() ?? "?";

  const enrolledDate = enrolledAt
    ? new Date(enrolledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-8 md:pt-12">
        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Compte</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Mon profil</h1>
        </header>

        {/* Identity */}
        <div className="mb-6 rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xl font-semibold text-primary-foreground shadow-elegant">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-semibold">{user.displayName ?? "—"}</p>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              {enrolledDate && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>Inscrit le {enrolledDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Protocol progress */}
            <div className="mb-6 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
              <div className="border-b border-border/60 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Progression protocole
                </p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">
                <div className="p-5 text-center">
                  <p className="font-display text-3xl font-semibold">{pct}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">Complété</p>
                </div>
                <div className="p-5 text-center">
                  <p className="font-display text-3xl font-semibold">
                    {done}
                    <span className="text-lg font-normal text-muted-foreground">/{lessons.length}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Leçons</p>
                </div>
                <div className="p-5 text-center">
                  <p className="font-display text-3xl font-semibold">S{Math.min(week, 12)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">sur 12 semaines</p>
                </div>
                <div className="p-5 text-center">
                  <p className="font-display text-3xl font-semibold">🔥 {streak}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Jours de suite</p>
                </div>
              </div>
              <div className="px-6 pb-5">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Skin profile */}
            {intake ? (
              <div className="mb-6 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
                <div className="border-b border-border/60 px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Profil peau
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {intake.skinType && (
                      <span className="rounded-full bg-gradient-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
                        Peau {SKIN_TYPE_LABELS[intake.skinType] ?? intake.skinType}
                      </span>
                    )}
                    {intake.intensity && (
                      <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
                        Acné {INTENSITY_LABELS[intake.intensity] ?? intake.intensity}
                      </span>
                    )}
                  </div>

                  {(intake.acneTypes?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {intake.acneTypes!.map((t) => (
                        <span key={t} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                          {ACNE_TYPE_LABELS[t] ?? t}
                        </span>
                      ))}
                    </div>
                  )}

                  {intake.currentRoutine && (
                    <div className="rounded-2xl bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Routine actuelle</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{intake.currentRoutine}</p>
                    </div>
                  )}

                  {intake.mainGoal && (
                    <div className="rounded-2xl bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Objectif</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{intake.mainGoal}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-6 rounded-3xl border border-dashed border-border bg-card p-6 text-center shadow-soft">
                <p className="text-sm text-muted-foreground">Bilan peau non renseigné.</p>
              </div>
            )}
          </>
        )}

        {/* Account settings */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
          <div className="border-b border-border/60 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Paramètres du compte
            </p>
          </div>

          {/* Display name row */}
          {editingName ? (
            <div className="flex items-center gap-3 border-b border-border/60 px-6 py-4">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="rounded-full p-2 text-primary hover:bg-primary-soft disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className={`flex items-center justify-between px-6 py-4 ${user.providerData[0]?.providerId !== "google.com" ? "border-b border-border/60" : ""}`}>
              <div>
                <p className="text-xs text-muted-foreground">Prénom</p>
                <p className="mt-0.5 text-sm font-medium">{user.displayName ?? "—"}</p>
              </div>
              <button
                onClick={() => { setNameInput(user.displayName ?? ""); setEditingName(true); }}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Password reset row — email accounts only */}
          {user.providerData[0]?.providerId !== "google.com" && (
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-xs text-muted-foreground">Mot de passe</p>
                <p className="mt-0.5 text-sm font-medium">••••••••</p>
              </div>
              <button
                onClick={handlePasswordReset}
                disabled={resetLoading}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
              >
                {resetLoading ? "Envoi…" : "Réinitialiser"}
              </button>
            </div>
          )}
        </div>

        {/* Admin tools */}
        {isAdmin && (
          <div className="mb-6 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
            <div className="border-b border-border/60 px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Outils admin
              </p>
            </div>
            <button
              onClick={() => navigate({ to: "/admin/ingredient-analyzer" })}
              className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
                <FlaskConical className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Analyseur d'ingrédients</p>
                <p className="text-xs text-muted-foreground">Analyser une liste INCI cosmétique</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 px-6 py-3.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </main>
    </AppShell>
  );
}
