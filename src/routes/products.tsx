import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { Sun, Moon, Clock, Sparkles, Loader2 } from "lucide-react";

type RoutineStep = {
  id: string;
  order: number;
  category: string;
  product: string;
  instructions: string;
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

function RoutinePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [routine, setRoutine] = useState<UserRoutine | null>(null);
  const [loadingRoutine, setLoadingRoutine] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "routines", user.uid)).then((snap) => {
      if (snap.exists()) setRoutine(snap.data() as UserRoutine);
      setLoadingRoutine(false);
    });
  }, [user]);

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
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-8 md:pt-12">
        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Ma Routine</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Votre routine sur-mesure
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Préparée spécialement pour votre peau par votre coach. Suivez l'ordre et les instructions à la lettre.
          </p>
        </header>

        <div className="space-y-10">
          {routine.am.length > 0 && (
            <RoutineBlock
              title="Routine du matin"
              icon={Sun}
              accent="from-peach/60 to-primary-soft"
              steps={routine.am}
            />
          )}
          {routine.pm.length > 0 && (
            <RoutineBlock
              title="Routine du soir"
              icon={Moon}
              accent="from-primary-muted/50 to-primary-soft/70"
              steps={routine.pm}
            />
          )}
        </div>

        <footer className="mt-12 rounded-3xl border border-border/60 bg-card p-6 text-center shadow-soft md:p-8">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <h3 className="mt-4 font-display text-2xl font-semibold">La régularité avant tout</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Votre peau se renouvelle en 28 jours. Suivez cette routine pendant au moins 6 semaines avant de juger les résultats.
          </p>
        </footer>
      </main>
    </AppShell>
  );
}

function RoutineBlock({
  title,
  icon: Icon,
  accent,
  steps,
}: {
  title: string;
  icon: typeof Sun;
  accent: string;
  steps: RoutineStep[];
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      <div className={`relative bg-gradient-to-br ${accent} px-6 py-7 md:px-8`}>
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
      </div>

      <ol className="divide-y divide-border/60">
        {steps.map((step, i) => (
          <li key={step.id} className="px-6 py-5 md:px-8">
            <div className="flex gap-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background font-display text-sm font-semibold">
                {i + 1}
              </div>
              <div className="flex-1">
                <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {step.category}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold">{step.product}</h3>
                {step.instructions && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.instructions}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
