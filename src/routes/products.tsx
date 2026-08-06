import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { Sun, Moon, Clock, Sparkles, Loader2, Check, X, ShoppingCart, AlertTriangle, ImageOff, Zap, CalendarDays } from "lucide-react";
import { currentProtocolWeek } from "@/lib/routine-week";
import { defaultPhases, lastWeek, type RoutinePhase } from "@/lib/routine-phases";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { PurchaseLink } from "@/lib/product-catalog";
import type { InciAnalysis } from "@/lib/inci-analysis";
import { getPersonalizedAnalysis } from "@/lib/inci-analysis";

type RoutineStep = {
  id: string;
  order: number;
  category: string;
  product: string;
  instructions: string;
  imageUrl?: string;
  /** @deprecated use purchaseLinks */
  purchaseUrl?: string;
  purchaseLinks?: PurchaseLink[];
  startWeek?: number;
  introNote?: string;
  whyThisProduct?: string;
  inciAnalysis?: InciAnalysis;
};

type ExtraBlock = { id: string; name: string; steps: RoutineStep[] };

type UserRoutine = {
  uid: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  extras?: ExtraBlock[];
  phases?: RoutinePhase[];
  updatedAt: number;
  sentAt: number | null;
  status: "draft" | "sent";
};

type ReportNotifPayload = {
  uid: string;
  studentEmail: string;
  studentName: string | null;
  product: string;
  category: string;
  type: "irritant" | "allergie";
};

const notifyAdminReportFn = createServerFn({ method: "POST" })
  .inputValidator((d: ReportNotifPayload) => d)
  .handler(async (ctx) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const apiKey = process.env.RESEND_API_KEY;
    if (!adminEmail || !apiKey) return;
    const rawFrom = process.env.RESEND_FROM ?? "onboarding@resend.dev";
    const from = rawFrom.includes("<") ? rawFrom : `Protocole Clear <${rawFrom}>`;
    const { uid, studentEmail, studentName, product, category, type } = ctx.data;
    const label = type === "irritant" ? "Irritant" : "Allergie";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: adminEmail,
        subject: `Signalement ${label.toLowerCase()} — ${product}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111">
            <h1 style="font-size:22px;font-weight:700;margin:0 0 16px">Signalement produit</h1>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              <tr><td style="padding:8px 0;color:#888;font-size:14px;width:120px;">Élève</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${studentName ?? studentEmail}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">Email</td><td style="padding:8px 0;font-size:14px;">${studentEmail}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">Produit</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${product}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">Catégorie</td><td style="padding:8px 0;font-size:14px;">${category}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">Type</td><td style="padding:8px 0;font-size:14px;color:${type === "irritant" ? "#d97706" : "#dc2626"};font-weight:600;">${label}</td></tr>
            </table>
            <a href="https://app.protocole-clear.com/admin/student/${uid}" style="display:inline-block;background:#c4724b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600;font-size:14px;">
              Voir le profil élève →
            </a>
          </div>
        `,
      }),
    });
  });

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Ma Routine — Protocole Clear" },
      { name: "description", content: "Votre routine skincare personnalisée." },
    ],
  }),
  component: RoutinePage,
});

type NutritionItem = { id: string; label: string; emoji: string };
type Reminder = { id: string; text: string; emoji: string };

function RoutinePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [routine, setRoutine] = useState<UserRoutine | null>(null);
  const [loadingRoutine, setLoadingRoutine] = useState(true);
  const [checkedAm, setCheckedAm] = useState<string[]>([]);
  const [checkedPm, setCheckedPm] = useState<string[]>([]);
  const [reports, setReports] = useState<Record<string, "irritant" | "allergie">>({});
  const [reportStep, setReportStep] = useState<RoutineStep | null>(null);
  const [reporting, setReporting] = useState(false);
  const [toEat, setToEat] = useState<NutritionItem[]>([]);
  const [toAvoid, setToAvoid] = useState<NutritionItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [intakeCompleted, setIntakeCompleted] = useState(false);
  const [skinProfile, setSkinProfile] = useState<{ skinType: string; acneTypes: string[] } | null>(null);
  const [enrolledAt, setEnrolledAt] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    Promise.allSettled([
      getDoc(doc(db, "routines", user.uid)),
      getDoc(doc(db, "routine_checkins", user.uid, "days", todayKey)),
      getDoc(doc(db, "routine_reports", user.uid)),
      getDoc(doc(db, "nutrition", user.uid)),
      getDoc(doc(db, "config", "reminders")),
      getDoc(doc(db, "intake_answers", user.uid)),
      getDoc(doc(db, "users", user.uid)),
    ]).then(([routineRes, checkinRes, reportsRes, nutritionRes, remindersRes, intakeRes, userRes]) => {
      if (routineRes.status === "fulfilled" && routineRes.value.exists())
        setRoutine(routineRes.value.data() as UserRoutine);
      if (checkinRes.status === "fulfilled" && checkinRes.value.exists()) {
        setCheckedAm(checkinRes.value.data().am ?? []);
        setCheckedPm(checkinRes.value.data().pm ?? []);
      }
      if (reportsRes.status === "fulfilled" && reportsRes.value.exists())
        setReports(reportsRes.value.data() as Record<string, "irritant" | "allergie">);
      if (nutritionRes.status === "fulfilled" && nutritionRes.value.exists()) {
        setToEat(nutritionRes.value.data().toEat ?? []);
        setToAvoid(nutritionRes.value.data().toAvoid ?? []);
      }
      if (remindersRes.status === "fulfilled" && remindersRes.value.exists())
        setReminders(remindersRes.value.data().items ?? []);
      if (intakeRes.status === "fulfilled" && intakeRes.value.exists()) {
        setIntakeCompleted(true);
        const intakeData = intakeRes.value.data();
        if (intakeData?.skinType || intakeData?.acneTypes) {
          setSkinProfile({ skinType: intakeData.skinType ?? "", acneTypes: intakeData.acneTypes ?? [] });
        }
      }
      if (userRes.status === "fulfilled" && userRes.value.exists()) {
        const data = userRes.value.data();
        const start = (data.routineStartedAt ?? data.enrolledAt) as number | undefined;
        if (start) {
          setEnrolledAt(start);
          setSelectedWeek(currentProtocolWeek(start));
        }
      }
      setLoadingRoutine(false);
    });
  }, [user]);

  async function toggleStep(session: "am" | "pm", stepId: string) {
    if (!user) return;
    const current = session === "am" ? checkedAm : checkedPm;
    const updated = current.includes(stepId)
      ? current.filter((id) => id !== stepId)
      : [...current, stepId];
    const newAm = session === "am" ? updated : checkedAm;
    const newPm = session === "pm" ? updated : checkedPm;
    if (session === "am") setCheckedAm(updated);
    else setCheckedPm(updated);
    const key = new Date().toISOString().slice(0, 10);
    try {
      await setDoc(doc(db, "routine_checkins", user.uid, "days", key), { am: newAm, pm: newPm }, { merge: true });
    } catch {
      toast.error("Impossible de sauvegarder. Réessaie.");
    }
  }

  async function submitReport(type: "irritant" | "allergie") {
    if (!user || !reportStep) return;
    setReporting(true);
    const updated = { ...reports, [reportStep.id]: type };
    setReports(updated);
    try {
      await setDoc(doc(db, "routine_reports", user.uid), updated, { merge: true });
      notifyAdminReportFn({
        data: {
          uid: user.uid,
          studentEmail: user.email ?? "",
          studentName: user.displayName ?? null,
          product: reportStep.product,
          category: reportStep.category,
          type,
        },
      }).catch(() => {});
      setReportStep(null);
    } catch {
      toast.error("Impossible d'enregistrer le signalement. Réessaie.");
    } finally {
      setReporting(false);
    }
  }

  if (authLoading || !user) return null;

  if (loadingRoutine) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!routine || routine.status !== "sent") {
    const hasRoutineDraft = routine?.status === "draft";
    const steps = [
      { label: "Inscription", done: true },
      { label: "Profil complété par ton coach", done: intakeCompleted },
      { label: "Routine en cours", done: hasRoutineDraft },
      { label: "Routine envoyée", done: false },
    ];
    return (
      <AppShell>
        <main className="mx-auto max-w-5xl px-6 pb-24 pt-8 md:pt-12">
          <header className="mb-10">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Ma Routine</p>
            <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
              En cours de préparation
            </h1>
          </header>
          <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-soft md:p-12">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold">Votre routine est en préparation</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Votre coach analyse votre bilan et prépare une routine personnalisée. Vous recevrez un e-mail dès qu'elle sera prête.
            </p>
            <ol className="mt-8 space-y-0">
              {steps.map((step, i) => {
                const isLast = i === steps.length - 1;
                const isActive = !step.done && (i === 0 || steps[i - 1].done);
                return (
                  <li key={step.label} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                        step.done
                          ? "border-primary bg-primary text-primary-foreground"
                          : isActive
                          ? "border-primary bg-background text-primary"
                          : "border-border bg-background text-muted-foreground"
                      }`}>
                        {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      {!isLast && (
                        <div className={`mt-1 w-0.5 flex-1 min-h-[20px] rounded-full ${step.done ? "bg-primary" : "bg-border"}`} />
                      )}
                    </div>
                    <p className={`pb-5 pt-0.5 text-sm font-medium ${
                      step.done ? "text-foreground" : isActive ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {step.label}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Ma Routine</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Votre routine sur-mesure
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Préparée spécialement pour votre peau par votre coach. Suivez l'ordre et les instructions à la lettre.
          </p>
        </header>

        {/* ── Sélecteur de semaines ─────────────────────────────────────── */}
        {enrolledAt && (
          <WeekSelector
            currentWeek={currentProtocolWeek(enrolledAt)}
            selectedWeek={selectedWeek}
            phases={routine.phases?.length ? routine.phases : defaultPhases()}
            allSteps={[...routine.am, ...routine.pm]}
            onSelect={setSelectedWeek}
          />
        )}

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">

          {/* ── AM/PM routine blocks ─────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-10">
            {routine.am.length > 0 && (
              <RoutineBlock
                title="Routine du matin"
                icon={Sun}
                accent="from-peach/60 to-primary-soft"
                session="am"
                steps={routine.am}
                selectedWeek={selectedWeek}
                currentWeek={enrolledAt ? currentProtocolWeek(enrolledAt) : 1}
                checked={checkedAm}
                reports={reports}
                skinProfile={skinProfile}
                onToggle={(id) => toggleStep("am", id)}
                onReport={setReportStep}
              />
            )}
            {routine.pm.length > 0 && (
              <RoutineBlock
                title="Routine du soir"
                icon={Moon}
                accent="from-primary-muted/50 to-primary-soft/70"
                session="pm"
                steps={routine.pm}
                selectedWeek={selectedWeek}
                currentWeek={enrolledAt ? currentProtocolWeek(enrolledAt) : 1}
                checked={checkedPm}
                reports={reports}
                skinProfile={skinProfile}
                onToggle={(id) => toggleStep("pm", id)}
                onReport={setReportStep}
              />
            )}

            {(routine.extras ?? []).length > 0 && (
              <BonusBlock blocks={routine.extras!} />
            )}

            <footer className="rounded-3xl border border-border/60 bg-card p-6 text-center shadow-soft md:p-8">
              <Sparkles className="mx-auto h-6 w-6 text-primary" />
              <h3 className="mt-4 font-display text-2xl font-semibold">La régularité avant tout</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Votre peau se renouvelle en 28 jours. Suivez cette routine pendant au moins 6 semaines avant de juger les résultats.
              </p>
            </footer>
          </div>

          {/* ── Nutrition sidebar ─────────────────────────────────────────── */}
          {(toEat.length > 0 || toAvoid.length > 0 || reminders.length > 0) && (
            <aside className="w-full space-y-6 lg:sticky lg:top-24 lg:w-80 lg:shrink-0">

              {(toEat.length > 0 || toAvoid.length > 0) && (
                <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                  <h3 className="mb-5 font-display text-lg font-semibold">Nutrition</h3>

                  {toEat.length > 0 && (
                    <div>
                      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <Check className="h-4 w-4" /> À privilégier
                      </p>
                      <ul className="space-y-2">
                        {toEat.map((item) => (
                          <li key={item.id} className="flex items-start gap-2.5 text-sm text-foreground">
                            <span className="shrink-0">{item.emoji}</span>
                            <span>{item.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {toEat.length > 0 && toAvoid.length > 0 && (
                    <div className="my-5 border-t border-border/60" />
                  )}

                  {toAvoid.length > 0 && (
                    <div>
                      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-destructive">
                        <X className="h-4 w-4" /> À éviter
                      </p>
                      <ul className="space-y-2">
                        {toAvoid.map((item) => (
                          <li key={item.id} className="flex items-start gap-2.5 text-sm text-foreground">
                            <span className="shrink-0">{item.emoji}</span>
                            <span>{item.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {reminders.length > 0 && (
                <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                  <h3 className="mb-4 font-display text-lg font-semibold">Rappels</h3>
                  <ul className="space-y-2">
                    {reminders.map((r) => (
                      <li key={r.id} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <span>{r.emoji}</span>
                        <span>{r.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          )}
        </div>
      </main>

      {/* Report dialog */}
      <Dialog open={!!reportStep} onOpenChange={(open) => !open && setReportStep(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Signaler un produit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{reportStep?.product}</span> — quelle réaction as-tu observée ?
          </p>
          <div className="mt-2 grid gap-3">
            <button
              onClick={() => submitReport("irritant")}
              disabled={reporting}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="font-semibold">Irritant</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Rougeurs, tiraillements, brûlures légères après application.</p>
              </div>
            </button>
            <button
              onClick={() => submitReport("allergie")}
              disabled={reporting}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="font-semibold">Allergie</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Gonflement, démangeaisons, urticaire ou réaction forte.</p>
              </div>
            </button>
          </div>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Ton coach sera notifié et ajustera ta routine.
          </p>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function RoutineBlock({
  title, icon: Icon, accent, session, steps, selectedWeek, currentWeek, checked, reports, skinProfile, onToggle, onReport,
}: {
  title: string;
  icon: typeof Sun;
  accent: string;
  session: "am" | "pm";
  steps: RoutineStep[];
  selectedWeek: number;
  currentWeek: number;
  checked: string[];
  reports: Record<string, "irritant" | "allergie">;
  skinProfile: { skinType: string; acneTypes: string[] } | null;
  onToggle: (id: string) => void;
  onReport: (step: RoutineStep) => void;
}) {
  const activeSteps = steps.filter((s) => (s.startWeek ?? 1) <= selectedWeek);
  const doneCount = activeSteps.filter((s) => checked.includes(s.id)).length;
  const isPreviewing = selectedWeek !== currentWeek;

  return (
    <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      <div className={`relative bg-gradient-to-br ${accent} px-6 py-7 md:px-8`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 shadow-soft backdrop-blur">
              <Icon className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-foreground/70">
                <Clock className="h-3.5 w-3.5" />
                {activeSteps.length} étape{activeSteps.length !== 1 ? "s" : ""}
                {isPreviewing && steps.length > activeSteps.length && (
                  <span className="ml-1 text-foreground/40">· {steps.length - activeSteps.length} à venir</span>
                )}
              </div>
            </div>
          </div>
          {!isPreviewing && doneCount === activeSteps.length && activeSteps.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary backdrop-blur">
              <Check className="h-3.5 w-3.5" /> Complète
            </span>
          )}
        </div>
      </div>

      <ol className="divide-y divide-border/60">
        {steps.map((step, i) => {
          const stepWeek = step.startWeek ?? 1;
          const isFuture = stepWeek > selectedWeek;
          const isNewThisWeek = stepWeek === selectedWeek && selectedWeek > 1;
          const isChecked = !isFuture && checked.includes(step.id);
          const report = reports[step.id];
          return (
            <li key={step.id} className={`px-6 py-5 transition-colors md:px-8 ${isFuture ? "opacity-45" : isChecked ? "bg-muted/30" : ""}`}>

              {/* ── Ligne haute : image + titre + check ── */}
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted md:h-20 md:w-20">
                  {step.imageUrl ? (
                    <img src={step.imageUrl} alt="" className="h-full w-full rounded-2xl object-contain p-1" />
                  ) : (
                    <ImageOff className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                          {step.category}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground/60">#{i + 1}</span>
                        {isNewThisWeek && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                            ✨ Nouveau cette semaine
                          </span>
                        )}
                        {isFuture && (
                          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" /> Dès la sem. {stepWeek}
                          </span>
                        )}
                        {report && !isFuture && (
                          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${report === "allergie" ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {report === "allergie" ? "Allergie" : "Irritant"}
                          </span>
                        )}
                      </div>
                      <h3 className={`mt-1 font-display text-base font-semibold leading-snug ${isChecked ? "text-muted-foreground line-through" : ""}`}>
                        {step.product}
                      </h3>
                    </div>

                    {/* Check toggle — disabled for future steps and when previewing */}
                    {!isFuture && !isPreviewing && (
                      <button
                        onClick={() => onToggle(step.id)}
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                          isChecked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50"
                        }`}
                      >
                        {isChecked && <Check className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Blocs texte pleine largeur ── */}
              {step.introNote && (
                <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-violet-50 px-3 py-2 dark:bg-violet-950/20">
                  <Clock className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" />
                  <p className="text-xs italic text-violet-700 dark:text-violet-300">{step.introNote}</p>
                </div>
              )}
              {step.whyThisProduct && (
                <div className="mt-3 rounded-xl bg-primary-soft/50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/60">Pourquoi ce produit</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-foreground/80">{step.whyThisProduct}</p>
                </div>
              )}
              {step.inciAnalysis && skinProfile && (() => {
                const { relevantFlags, textureWarning, textureSuited, personalizedVerdict } =
                  getPersonalizedAnalysis(step.inciAnalysis, skinProfile);
                return (
                  <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Analyse pour ton profil
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        personalizedVerdict === "compatible"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : personalizedVerdict === "prudence"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      }`}>
                        {personalizedVerdict === "compatible" ? "Compatible" : personalizedVerdict === "prudence" ? "Prudence" : "Déconseillé"}
                      </span>
                    </div>
                    <p className={`mt-1.5 text-xs ${
                      textureSuited
                        ? "text-green-700 dark:text-green-400"
                        : textureWarning
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground/70"
                    }`}>
                      Texture : {step.inciAnalysis.texture.label}
                      {textureSuited && " — adaptée à ta peau"}
                      {textureWarning && " — peut être trop riche pour ta peau"}
                    </p>
                    {relevantFlags.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {relevantFlags.map((f) => (
                          <li key={f.name} className="flex items-start gap-1.5 text-xs">
                            <span className={`mt-0.5 shrink-0 ${f.risk === "élevé" ? "text-red-500" : f.risk === "moyen" ? "text-amber-500" : "text-muted-foreground/50"}`}>
                              {f.risk === "élevé" ? "●" : f.risk === "moyen" ? "●" : "○"}
                            </span>
                            <span>
                              <span className="font-medium">{f.name}</span>
                              <span className="text-muted-foreground/70"> — {f.concern}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-xs text-green-700 dark:text-green-400">
                        Aucun ingrédient problématique pour ton profil ✓
                      </p>
                    )}
                  </div>
                );
              })()}
              {step.instructions && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Instructions</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.instructions}</p>
                </div>
              )}
              {!isFuture && <div className="mt-3 flex flex-wrap items-center gap-2">
                {(step.purchaseLinks?.[0]?.url || step.purchaseUrl) && (
                  <div className="flex flex-col gap-1">
                    <a
                      href={step.purchaseLinks?.[0]?.url ?? step.purchaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
                    >
                      <ShoppingCart className="h-3 w-3" /> {step.purchaseLinks?.[0]?.label ?? "Acheter"}
                    </a>
                    {step.purchaseLinks && step.purchaseLinks.length > 1 && (
                      <p className="text-[11px] text-muted-foreground/70">
                        Indisponible ?{" "}
                        {step.purchaseLinks.slice(1).map((l, i) => (
                          <span key={l.url}>
                            {i > 0 && " · "}
                            <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 transition-colors hover:text-muted-foreground">
                              {l.label}
                            </a>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}
                {report ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
                    <Check className="h-3 w-3" /> Signalement reçu · ton coach en est informé
                  </span>
                ) : (
                  <button
                    onClick={() => onReport(step)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-orange-300 hover:text-orange-500"
                  >
                    <AlertTriangle className="h-3 w-3" /> Signaler
                  </button>
                )}
              </div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function BonusBlock({ blocks }: { blocks: ExtraBlock[] }) {
  const totalSteps = blocks.reduce((sum, b) => sum + b.steps.length, 0);
  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-4 overflow-hidden rounded-3xl border border-yellow-200/60 bg-gradient-to-br from-yellow-50/80 to-amber-50/60 px-6 py-7 shadow-soft dark:border-yellow-900/30 dark:from-yellow-950/30 dark:to-amber-950/20 md:px-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 shadow-soft backdrop-blur">
          <Zap className="h-6 w-6 text-yellow-500" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">En cas de…</h2>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-foreground/70">
            <Clock className="h-3.5 w-3.5" />
            {blocks.length} bloc{blocks.length !== 1 ? "s" : ""} · {totalSteps} conseil{totalSteps !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Each named block */}
      {blocks.map((block) => (
        <div key={block.id} className="overflow-hidden rounded-3xl border border-yellow-200/60 bg-card shadow-soft dark:border-yellow-900/30">
          <div className="border-b border-yellow-100/60 bg-yellow-50/40 px-6 py-4 dark:border-yellow-900/20 dark:bg-yellow-950/10 md:px-8">
            <h3 className="font-display text-lg font-semibold">{block.name}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{block.steps.length} étape{block.steps.length !== 1 ? "s" : ""}</p>
          </div>
          <ol className="divide-y divide-border/60">
            {block.steps.map((step, i) => (
              <li key={step.id} className="px-6 py-5 md:px-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-yellow-200/60 bg-yellow-50/60 dark:border-yellow-900/30 dark:bg-yellow-950/20 md:h-20 md:w-20">
                    {step.imageUrl ? (
                      <img src={step.imageUrl} alt="" className="h-full w-full rounded-2xl object-contain p-1" />
                    ) : (
                      <Zap className="h-5 w-5 text-yellow-400/60" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
                        {step.category}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground/60">#{i + 1}</span>
                    </div>
                    <h4 className="mt-1 font-display text-base font-semibold leading-snug">{step.product}</h4>
                  </div>
                </div>
                {step.instructions && (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Instructions</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.instructions}</p>
                  </div>
                )}
                {(step.purchaseLinks?.[0]?.url || step.purchaseUrl) && (
                  <div className="mt-3 flex flex-col gap-1">
                    <a
                      href={step.purchaseLinks?.[0]?.url ?? step.purchaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
                    >
                      <ShoppingCart className="h-3 w-3" /> {step.purchaseLinks?.[0]?.label ?? "Acheter"}
                    </a>
                    {step.purchaseLinks && step.purchaseLinks.length > 1 && (
                      <p className="text-[11px] text-muted-foreground/70">
                        Indisponible ?{" "}
                        {step.purchaseLinks.slice(1).map((l, i) => (
                          <span key={l.url}>
                            {i > 0 && " · "}
                            <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 transition-colors hover:text-muted-foreground">
                              {l.label}
                            </a>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function WeekSelector({
  currentWeek, selectedWeek, phases, allSteps, onSelect,
}: {
  currentWeek: number;
  selectedWeek: number;
  phases: RoutinePhase[];
  allSteps: RoutineStep[];
  onSelect: (w: number) => void;
}) {
  // Semaine par semaine. Les phases ne servent ici qu'à connaître la durée
  // réelle du protocole de l'élève — le parcours détaillé est sur /suivi.
  const totalWeeks = Math.max(lastWeek(phases), ...allSteps.map((s) => s.startWeek ?? 1));
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <div className="mb-8 rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Planning du protocole</p>
        <span className="ml-auto rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
          Semaine {currentWeek} / {totalWeeks}
        </span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {weeks.map((w) => {
          const isActive = w === selectedWeek;
          const isCurrent = w === currentWeek;
          const isFuture = w > currentWeek;
          const hasNew = allSteps.some((s) => (s.startWeek ?? 1) === w);
          return (
            <button
              key={w}
              onClick={() => onSelect(w)}
              className={`relative flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isCurrent
                  ? "border-2 border-primary bg-primary-soft text-primary"
                  : isFuture
                  ? "bg-muted/40 text-muted-foreground hover:bg-muted"
                  : "bg-muted/60 text-foreground hover:bg-muted"
              }`}
            >
              {w}
              {hasNew && !isActive && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>

      {selectedWeek !== currentWeek && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          {selectedWeek < currentWeek
            ? `Aperçu de la semaine ${selectedWeek} — les cases à cocher sont désactivées en mode historique.`
            : `Aperçu de la semaine ${selectedWeek} — les étapes grisées ne sont pas encore actives.`}
        </p>
      )}
    </div>
  );
}

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <span className={!expanded ? "line-clamp-3" : undefined}>{text}</span>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="ml-1 text-xs font-medium text-primary/70 hover:text-primary"
      >
        {expanded ? "Voir moins" : "Voir plus"}
      </button>
    </>
  );
}
