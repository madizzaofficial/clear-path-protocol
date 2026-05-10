import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { routine } from "@/lib/course-data";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Sun, Moon, Clock, Sparkles, Check, Info, Lock } from "lucide-react";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Your Routine — Lumen" },
      { name: "description", content: "Your coach-prescribed daily skincare routine." },
    ],
  }),
  component: RoutinePage,
});

function RoutinePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const morning = routine[0];
  const evening = routine[1];

  if (loading || !user) return null;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-8 md:pt-12">
        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Your Routine</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Follow it blindly. We've done the thinking.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Your coach has hand-picked every product and step below. Trust the order, trust the timing — your skin will respond.
          </p>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border/60 bg-primary-soft/40 p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-foreground/80">
              This routine is locked to your protocol. It will only change when your coach updates it — never guess or substitute.
            </p>
          </div>
        </header>

        <div className="space-y-10">
          <RoutineBlockCard block={morning} icon={Sun} accent="from-peach/60 to-primary-soft" />
          <RoutineBlockCard block={evening} icon={Moon} accent="from-primary-muted/50 to-primary-soft/70" />
        </div>

        <footer className="mt-12 rounded-3xl border border-border/60 bg-card p-6 text-center shadow-soft md:p-8">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <h3 className="mt-4 font-display text-2xl font-semibold">Consistency over intensity</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Your skin renews every 28 days. Stay with this routine for at least 6 weeks before judging results.
          </p>
        </footer>
      </main>
    </AppShell>
  );
}

function RoutineBlockCard({
  block,
  icon: Icon,
  accent,
}: {
  block: typeof routine[number];
  icon: typeof Sun;
  accent: string;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      {/* Block header */}
      <div className={`relative bg-gradient-to-br ${accent} px-6 py-7 md:px-8`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 shadow-soft backdrop-blur">
              <Icon className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground/70">{block.id === "morning" ? "AM" : "PM"}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight md:text-3xl">{block.title}</h2>
              <p className="mt-1 text-sm text-foreground/70">{block.subtitle}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground/80 backdrop-blur sm:flex">
            <Clock className="h-3.5 w-3.5" />
            ~{block.totalMinutes} min
          </div>
        </div>
      </div>

      {/* Steps */}
      <ol className="divide-y divide-border/60">
        {block.steps.map((s, i) => (
          <li key={i} className="px-6 py-6 md:px-8 md:py-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
              {/* Step number + product visual */}
              <div className="flex shrink-0 items-start gap-4 sm:flex-col sm:items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background font-display text-sm font-semibold text-foreground">
                  {s.step}
                </div>
                <div className="hidden h-24 w-20 flex-col items-center justify-center rounded-2xl bg-gradient-warm shadow-soft sm:flex">
                  <Sparkles className="h-6 w-6 text-primary/60" />
                  <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-wider text-foreground/60">{s.brand.split(" ")[0]}</span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    {s.category}
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    {s.frequency}
                  </span>
                </div>

                <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">{s.productName}</h3>
                <p className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">{s.brand}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-background p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Amount</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{s.amount}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background p-3">
                    <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      <Info className="h-3 w-3" /> How to apply
                    </p>
                    <p className="mt-1 text-sm leading-snug text-foreground/85">{s.howTo}</p>
                  </div>
                </div>

                <button className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                  <Check className="h-3.5 w-3.5" /> Mark as done
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
