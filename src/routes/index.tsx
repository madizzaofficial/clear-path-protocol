import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { course, routine, allLessons } from "@/lib/course-data";
const featured = routine[1].steps[1];
import { Play, Check, Sparkles, Sun, Moon, ArrowRight, Flame, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Your Dashboard — Lumen" },
      { name: "description", content: "Your personalized acne recovery dashboard." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const lessons = allLessons();
  const completed = lessons.filter((l) => l.completed).length;
  const progress = Math.round((completed / lessons.length) * 100);
  const next = lessons.find((l) => !l.completed && !l.locked)!;

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
        {/* Welcome */}
        <section className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Week 3 · Day 4</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Good morning, Léa.
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Your skin is healing — visible changes typically appear around week 6. Stay consistent today.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Continue watching - hero */}
          <div className="lg:col-span-2">
            <Link to="/lesson/$lessonId" params={{ lessonId: next.id }} className="group block">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-warm p-8 shadow-elegant md:p-10">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
                <div className="relative">
                  <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
                    <Play className="h-3 w-3 fill-primary text-primary" /> Continue where you left off
                  </span>
                  <h2 className="mt-5 font-display text-2xl font-semibold md:text-3xl">{next.title}</h2>
                  <p className="mt-2 max-w-md text-sm text-foreground/70">{next.summary}</p>
                  <div className="mt-6 flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform group-hover:scale-[1.02]">
                      Resume lesson <ArrowRight className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-foreground/60">{next.duration} · {next.chapterTitle}</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Progress */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard icon={TrendingUp} label="Protocol" value={`${progress}%`} sub={`${completed}/${lessons.length} lessons`} />
              <StatCard icon={Flame} label="Streak" value="12 days" sub="Keep it going" />
              <StatCard icon={Sparkles} label="Skin score" value="7.2" sub="+1.4 this week" />
            </div>

            {/* Milestones */}
            <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6 shadow-soft md:p-8">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold">Transformation milestones</h3>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Week 3 of 12</span>
              </div>
              <div className="mt-6 space-y-4">
                {[
                  { label: "Baseline photos & assessment", done: true, week: "W1" },
                  { label: "Routine fully integrated", done: true, week: "W2" },
                  { label: "First visible calming", done: false, current: true, week: "W4" },
                  { label: "Active breakout reduction", done: false, week: "W6" },
                  { label: "Even skin tone restored", done: false, week: "W10" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-4">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                        m.done ? "border-primary bg-primary text-primary-foreground" : m.current ? "border-primary bg-primary-soft" : "border-border bg-muted"
                      }`}
                    >
                      {m.done ? <Check className="h-4 w-4" /> : <span className="text-xs font-semibold">{m.week}</span>}
                    </div>
                    <p className={`flex-1 text-sm ${m.done ? "text-muted-foreground line-through" : "font-medium"}`}>{m.label}</p>
                    {m.current && <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">In progress</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Side */}
          <div className="space-y-6">
            {/* Today's routine */}
            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
              <h3 className="font-display text-lg font-semibold">Today's routine</h3>
              <div className="mt-5 space-y-5">
                <RoutineBlock icon={Sun} label="Morning" steps={["Gentle gel cleanser", "Niacinamide 10%", "Ceramide moisturizer", "Mineral SPF 50"]} done={3} />
                <RoutineBlock icon={Moon} label="Evening" steps={["Oil cleanse", "Gel cleanse", "Adapalene 0.1%", "Ceramide moisturizer"]} done={0} />
              </div>
            </div>

            {/* Recommended product */}
            <Link to="/products" className="block rounded-3xl border border-border/60 bg-card p-6 shadow-soft transition-shadow hover:shadow-elegant">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">For you this week</h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-warm">
                  <Sparkles className="h-6 w-6 text-foreground/70" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{featured.productName}</p>
                  <p className="text-xs text-muted-foreground">{featured.brand} · {featured.category}</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{featured.howTo}</p>
            </Link>

            {/* Weekly goal */}
            <div className="rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-elegant">
              <p className="text-xs uppercase tracking-[0.2em] opacity-80">Weekly goal</p>
              <h3 className="mt-2 font-display text-xl font-semibold">Complete Chapter 2</h3>
              <p className="mt-2 text-sm opacity-90">3 of 4 lessons remain. Finish by Sunday to stay on track.</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20">
                <div className="h-full w-1/4 rounded-full bg-primary-foreground/90" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function RoutineBlock({ icon: Icon, label, steps, done }: { icon: any; label: string; steps: string[]; done: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">{done}/{steps.length}</span>
      </div>
      <ul className="space-y-2">
        {steps.map((s, i) => {
          const ok = i < done;
          return (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${ok ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                {ok && <Check className="h-3 w-3" />}
              </span>
              <span className={ok ? "text-muted-foreground line-through" : ""}>{s}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
