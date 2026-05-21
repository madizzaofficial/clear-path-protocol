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
                  <p className="text-sm text-muted-foreground">Aucun ingrédient problématique détecté.</p>
                )}
              </div>
            </div>

            {/* Ingredient pills */}
            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
              <h2 className="mb-4 font-display text-base font-semibold">Détail par ingrédient</h2>
              <div className="flex flex-wrap gap-2">
                {result.ingredients.map((ing, i) => (
                  <IngredientPill key={i} ing={ing} />
                ))}
              </div>
            </div>

            {/* Flagged details */}
            {(result.edHighCount + result.edMediumCount + result.allergenCount) > 0 && (
              <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
                <h2 className="mb-4 font-display text-base font-semibold">Ingrédients signalés</h2>
                <div className="space-y-2">
                  {result.ingredients
                    .filter((i) => i.flag !== "ok" && i.flag !== "petrochem")
                    .map((ing, i) => (
                      <div key={i} className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
                        ing.flag === "ed_high"   ? "bg-red-50" :
                        ing.flag === "ed_medium" ? "bg-orange-50" :
                        "bg-amber-50"
                      }`}>
                        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                          ing.flag === "ed_high"   ? "bg-red-500" :
                          ing.flag === "ed_medium" ? "bg-orange-400" :
                          "bg-amber-400"
                        }`} />
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${
                            ing.flag === "ed_high"   ? "text-red-700" :
                            ing.flag === "ed_medium" ? "text-orange-600" :
                            "text-amber-700"
                          }`}>{ing.raw}</p>
                          {ing.reason && <p className="mt-0.5 text-xs text-muted-foreground">{ing.reason}</p>}
                          {ing.flag === "allergen" && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Allergène{ing.euMandatory ? " — déclaration obligatoire EU" : " (liste SCCS étendue)"}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </AdminShell>
  );
}

function IngredientPill({ ing }: { ing: ReturnType<typeof analyzeIngredients>["ingredients"][number] }) {
  const [showTip, setShowTip] = useState(false);

  const cls =
    ing.flag === "ed_high"   ? "bg-red-100 text-red-700 border-red-200 cursor-help" :
    ing.flag === "ed_medium" ? "bg-orange-100 text-orange-600 border-orange-200 cursor-help" :
    ing.flag === "allergen"  ? "bg-amber-100 text-amber-700 border-amber-200 cursor-help" :
    ing.flag === "petrochem" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
    "bg-muted/50 text-muted-foreground border-border/40";

  return (
    <div className="relative">
      <span
        className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        {ing.raw}
      </span>
      {showTip && ing.reason && (
        <div className="absolute bottom-full left-0 z-10 mb-1.5 w-max max-w-xs rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
          {ing.reason}
        </div>
      )}
    </div>
  );
}
