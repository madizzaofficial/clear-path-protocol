import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { products } from "@/lib/course-data";
import { Sparkles, Sun, Moon, Sun as SunIcon } from "lucide-react";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Your Routine — Lumen" },
      { name: "description", content: "Personalized skincare product recommendations." },
    ],
  }),
  component: ProductsPage,
});

const categories = ["All", "Cleanser", "Serum", "Treatment", "Moisturizer", "Sunscreen", "Exfoliant"];

function ProductsPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Your Routine</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Picked for your skin, not the algorithm.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Based on your assessment, current routine, and protocol stage. Every product is reviewed by our skincare team.
          </p>
        </header>

        {/* Routine integration banner */}
        <div className="mb-10 grid gap-4 rounded-3xl border border-border/60 bg-gradient-warm p-6 md:grid-cols-2 md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background/70">
              <Sun className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">Morning</p>
              <p className="mt-1 font-display text-lg font-semibold">4-step routine</p>
              <p className="mt-1 text-sm text-foreground/70">Cleanse → Treat → Hydrate → Protect</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background/70">
              <Moon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">Evening</p>
              <p className="mt-1 font-display text-lg font-semibold">4-step routine</p>
              <p className="mt-1 text-sm text-foreground/70">Cleanse → Active → Hydrate → Repair</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((c, i) => (
            <button
              key={c}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                i === 0 ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <article key={p.id} className="group overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
              <div className="relative flex aspect-square items-center justify-center bg-gradient-warm">
                <div className="flex h-32 w-24 flex-col items-center justify-center rounded-2xl bg-background/70 shadow-soft backdrop-blur-sm">
                  <Sparkles className="h-8 w-8 text-primary/60" />
                  <span className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/60">{p.brand}</span>
                </div>
                <span className="absolute left-4 top-4 rounded-full bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur">
                  {p.category}
                </span>
                <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-foreground/90 px-3 py-1 text-xs font-medium text-background backdrop-blur">
                  <SunIcon className="h-3 w-3" /> {p.tone}
                </span>
              </div>
              <div className="p-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{p.brand}</p>
                <h3 className="mt-1 font-display text-lg font-semibold">{p.name}</h3>
                <div className="mt-3 rounded-2xl bg-primary-soft/50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-primary">Why for you</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/80">{p.reason}</p>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className="font-display text-xl font-semibold">{p.price}</span>
                  <button className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90">
                    Add to routine
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
