import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useState, useEffect } from "react";
import {
  ArrowLeft, Loader2, Check, Sun, Moon, ClipboardList,
  BookOpen, ChevronDown, Lock, Play, ImageOff,
} from "lucide-react";
import { course } from "@/lib/course-data";

export const Route = createFileRoute("/admin_/student/$uid")({
  head: () => ({ meta: [{ title: "Fiche élève — Protocole Clear" }] }),
  component: StudentPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type StudentProfile = {
  uid: string;
  email: string;
  displayName: string | null;
  enrolledAt?: number;
  lastSeen?: number;
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

type RoutineStep = { id: string; order: number; category: string; product: string; instructions: string };
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

type Tab = "profil" | "routine" | "photos" | "progression";

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
  const [tab, setTab] = useState<Tab>("profil");
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
    if (!authLoading && user && !isAdmin) navigate({ to: "/" });
  }, [user, authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin || !uid) return;
    async function load() {
      setLoading(true);
      const [profileSnap, intakeSnap, routineSnap, progressSnap, photosSnap] = await Promise.all([
        getDoc(doc(db, "users", uid)),
        getDoc(doc(db, "intake_answers", uid)),
        getDoc(doc(db, "routines", uid)),
        getDoc(doc(db, "progress", uid)),
        getDocs(query(collection(db, "progress_photos"), where("uid", "==", uid))),
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
    { id: "profil", label: "Profil peau", icon: BookOpen },
    { id: "routine", label: "Routine", icon: Sun },
    { id: "photos", label: "Photos", icon: ClipboardList },
    { id: "progression", label: "Progression", icon: Check },
  ];

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-8 md:pt-10">
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
          <Link
            to="/admin/routines"
            search={{ uid }}
            className="flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-primary-muted"
          >
            <ClipboardList className="h-4 w-4" /> Modifier la routine
          </Link>
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
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

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
          </div>
        )}

        {/* ── Routine ─────────────────────────────────────────────────────────── */}
        {tab === "routine" && (
          <div>
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
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.product}</p>
                <p className="text-xs text-muted-foreground">{s.category}</p>
                {s.instructions && <p className="mt-0.5 text-xs italic text-muted-foreground/80">{s.instructions}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
