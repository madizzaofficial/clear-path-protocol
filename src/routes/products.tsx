import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { Sun, Moon, Clock, Sparkles, Loader2, Check, X, ShoppingCart, AlertTriangle, ImageOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RoutineStep = {
  id: string;
  order: number;
  category: string;
  product: string;
  description?: string;
  instructions: string;
  imageUrl?: string;
  purchaseUrl?: string;
};

type UserRoutine = {
  uid: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  updatedAt: number;
  sentAt: number | null;
  status: "draft" | "sent";
};

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
    ]).then(([routineRes, checkinRes, reportsRes, nutritionRes, remindersRes]) => {
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
      setLoadingRoutine(false);
    });
  }, [user]);

  function toggleStep(session: "am" | "pm", stepId: string) {
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
    setDoc(doc(db, "routine_checkins", user.uid, "days", key), { am: newAm, pm: newPm }, { merge: true });
  }

  async function submitReport(type: "irritant" | "allergie") {
    if (!user || !reportStep) return;
    setReporting(true);
    const updated = { ...reports, [reportStep.id]: type };
    setReports(updated);
    await setDoc(doc(db, "routine_reports", user.uid), updated, { merge: true });
    setReporting(false);
    setReportStep(null);
  }

  if (authLoading || !user) return null;

  if (loadingRoutine) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!routine || routine.status !== "sent") {
    return (
      <AppShell>
        <main className="mx-auto max-w-5xl px-6 pb-24 pt-8 md:pt-12">
          <header className="mb-10">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Ma Routine</p>
            <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
              En cours de préparation
            </h1>
          </header>
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card py-20 text-center shadow-soft">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold">Votre routine est en préparation</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Votre coach analyse votre bilan et prépare une routine personnalisée pour votre peau. Vous recevrez un e-mail dès qu'elle sera prête.
            </p>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Ma Routine</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Votre routine sur-mesure
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Préparée spécialement pour votre peau par votre coach. Suivez l'ordre et les instructions à la lettre.
          </p>
        </header>

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
                checked={checkedAm}
                reports={reports}
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
                checked={checkedPm}
                reports={reports}
                onToggle={(id) => toggleStep("pm", id)}
                onReport={setReportStep}
              />
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
  title, icon: Icon, accent, session, steps, checked, reports, onToggle, onReport,
}: {
  title: string;
  icon: typeof Sun;
  accent: string;
  session: "am" | "pm";
  steps: RoutineStep[];
  checked: string[];
  reports: Record<string, "irritant" | "allergie">;
  onToggle: (id: string) => void;
  onReport: (step: RoutineStep) => void;
}) {
  const doneCount = steps.filter((s) => checked.includes(s.id)).length;

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
                {steps.length} étape{steps.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          {doneCount === steps.length && steps.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary backdrop-blur">
              <Check className="h-3.5 w-3.5" /> Complète
            </span>
          )}
        </div>
      </div>

      <ol className="divide-y divide-border/60">
        {steps.map((step, i) => {
          const isChecked = checked.includes(step.id);
          const report = reports[step.id];
          return (
            <li key={step.id} className={`px-6 py-5 transition-colors md:px-8 ${isChecked ? "bg-muted/30" : ""}`}>
              <div className="flex gap-4">

                {/* Product image */}
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted md:h-28 md:w-28">
                  {step.imageUrl ? (
                    <img src={step.imageUrl} alt={step.product} className="h-full w-full object-contain p-1" />
                  ) : (
                    <ImageOff className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                          {step.category}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground/60">#{i + 1}</span>
                        {report && (
                          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${report === "allergie" ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {report === "allergie" ? "Allergie signalée" : "Irritant signalé"}
                          </span>
                        )}
                      </div>
                      <h3 className={`mt-1.5 font-display text-base font-semibold ${isChecked ? "text-muted-foreground line-through" : ""}`}>
                        {step.product}
                      </h3>
                      {step.description && (
                        <p className="mt-0.5 text-xs italic text-muted-foreground/70">{step.description}</p>
                      )}
                      {step.instructions && (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.instructions}</p>
                      )}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {step.purchaseUrl && (
                          <a
                            href={step.purchaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
                          >
                            <ShoppingCart className="h-3 w-3" /> Acheter
                          </a>
                        )}
                        <button
                          onClick={() => onReport(step)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-orange-300 hover:text-orange-500"
                        >
                          <AlertTriangle className="h-3 w-3" /> Signaler
                        </button>
                      </div>
                    </div>

                    {/* Check toggle */}
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
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
