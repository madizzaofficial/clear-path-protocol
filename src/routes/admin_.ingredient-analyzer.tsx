import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FlaskConical, AlertTriangle, Info, Leaf } from "lucide-react";
import { analyzeIngredients, type AnalysisResult } from "@/lib/cosmetic-ingredients";

export const Route = createFileRoute("/admin_/ingredient-analyzer")({
  component: IngredientAnalyzerPage,
});

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (score >= 70) return "text-lime-600 bg-lime-50 border-lime-200";
  if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  if (score >= 25) return "text-orange-600 bg-orange-50 border-orange-200";
  return "text-red-600 bg-red-50 border-red-200";
}

function scoreLabel(score: number): string {
  if (score >= 85) return "Très bon";
  if (score >= 70) return "Bon";
  if (score >= 50) return "Moyen";
  if (score >= 25) return "Mauvais";
  return "Très mauvais";
}

function IngredientAnalyzerPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/admin" });
  }, [user, isAdmin, loading, navigate]);

  function handleAnalyze() {
    if (!input.trim()) return;
    setResult(analyzeIngredients(input));
  }

  return (
    <AdminShell>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft">
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold">Analyseur d'ingrédients</h1>
              <p className="text-sm text-muted-foreground">Colle une liste INCI pour identifier les ingrédients problématiques</p>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
          <label className="mb-3 block text-sm font-medium">Liste INCI</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Water, Glycerin, Niacinamide, Methylparaben, Limonene, Paraffinum Liquidum, ..."
            rows={6}
            className="w-full resize-y rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-2 text-xs text-muted-foreground">Séparés par des virgules ou des retours à la ligne</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />PE avéré</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />PE suspecté</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Allergène</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-200 border border-yellow-400" />Pétrochimique</span>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!input.trim()}
              className="rounded-2xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Analyser
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-5">
            {/* Score + summary */}
            <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
              <div className={`flex flex-col items-center justify-center rounded-2xl border px-6 py-4 ${scoreColor(result.score)}`}>
                <span className="font-display text-4xl font-bold tabular-nums">{result.score}</span>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-70">/ 100</span>
                <span className="mt-1 text-xs font-medium">{scoreLabel(result.score)}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {result.edHighCount > 0 && (
                  <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    {result.edHighCount} PE avéré{result.edHighCount > 1 ? "s" : ""}
                  </div>
                )}
                {result.edMediumCount > 0 && (
                  <div className="flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-500">
                    <AlertTriangle className="h-4 w-4" />
                    {result.edMediumCount} PE suspecté{result.edMediumCount > 1 ? "s" : ""}
                  </div>
                )}
                {result.allergenCount > 0 && (
                  <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-600">
                    <Info className="h-4 w-4" />
                    {result.allergenCount} allergène{result.allergenCount > 1 ? "s" : ""}
                  </div>
                )}
                {result.petrochemCount > 0 && (
                  <div className="flex items-center gap-2 rounded-2xl bg-yellow-50 px-4 py-2.5 text-sm font-semibold text-yellow-600">
                    <Leaf className="h-4 w-4" />
                    {result.petrochemCount} pétrochimique{result.petrochemCount > 1 ? "s" : ""}
                  </div>
                )}
                {result.edHighCount === 0 && result.edMediumCount === 0 && result.allergenCount === 0 && result.petrochemCount === 0 && (
                  <p className="text-sm text-emerald-600 font-medium">✓ Aucun ingrédient problématique détecté.</p>
                )}
              </div>
            </div>

            {/* Ingredient list — one per row */}
            <div className="rounded-3xl border border-border/60 bg-card shadow-soft overflow-hidden">
              <div className="border-b border-border/60 px-6 py-4">
                <h2 className="font-display text-base font-semibold">Détail par ingrédient</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{result.ingredients.length} ingrédients analysés</p>
              </div>
              <ul className="divide-y divide-border/40">
                {result.ingredients.map((ing, i) => (
                  <IngredientRow key={i} ing={ing} />
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </AdminShell>
  );
}

type IngredientRowProps = { ing: ReturnType<typeof analyzeIngredients>["ingredients"][number] };

function IngredientRow({ ing }: IngredientRowProps) {
  const config = {
    ed_high:   { dot: "bg-red-500",     bg: "bg-red-50",     name: "text-red-700 font-semibold",   badge: "bg-red-100 text-red-600",     label: "PE avéré" },
    ed_medium: { dot: "bg-orange-400",  bg: "bg-orange-50",  name: "text-orange-700 font-semibold", badge: "bg-orange-100 text-orange-600", label: "PE suspecté" },
    allergen:  { dot: "bg-amber-400",   bg: "bg-amber-50",   name: "text-amber-700 font-semibold",  badge: "bg-amber-100 text-amber-700",  label: "Allergène" },
    petrochem: { dot: "bg-yellow-400",  bg: "bg-yellow-50",  name: "text-yellow-700 font-medium",   badge: "bg-yellow-100 text-yellow-700", label: "Pétrochimique" },
    ok:        { dot: "bg-emerald-400", bg: "bg-emerald-50/60", name: "text-emerald-700 font-medium", badge: "", label: "" },
  }[ing.flag];

  const note =
    ing.flag === "allergen"
      ? ing.euMandatory ? "Allergène — déclaration obligatoire EU (Règlement 1223/2009)" : "Allergène — liste SCCS étendue"
      : ing.reason ?? (ing.flag === "ok" ? "Aucun signal dans nos bases de données" : undefined);

  return (
    <li className={`flex items-start gap-3 px-6 py-3 ${config.bg}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm ${config.name}`}>{ing.raw}</span>
          {config.label && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.badge}`}>
              {config.label}
            </span>
          )}
        </div>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
    </li>
  );
}
