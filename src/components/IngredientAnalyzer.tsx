import { useState } from "react";
import { FlaskConical, AlertTriangle, CheckCircle, Info, Leaf, Zap, ChevronDown, Droplets } from "lucide-react";
import { analyzeIngredients, type AnalysisResult } from "@/lib/cosmetic-ingredients";

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (score >= 70) return "text-lime-600 bg-lime-50 border-lime-200";
  if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  if (score >= 25) return "text-orange-600 bg-orange-50 border-orange-200";
  return "text-red-600 bg-red-50 border-red-200";
}

function scoreLabel(score: number, hasED: boolean): string {
  if (hasED && score >= 71) return "Bon (PE présent)";
  if (score >= 85) return "Très bon";
  if (score >= 70) return "Bon";
  if (score >= 50) return "Moyen";
  if (score >= 25) return "Mauvais";
  return "Très mauvais";
}

type Ing = ReturnType<typeof analyzeIngredients>["ingredients"][number];

const FLAG_CONFIG: Record<Ing["flag"], { dot: string; bg: string; expandBg: string; name: string; badge: string; label: string }> = {
  ed_high:     { dot: "bg-red-500",     bg: "bg-red-50",        expandBg: "bg-red-100/60",     name: "text-red-700 font-semibold",    badge: "bg-red-100 text-red-600",       label: "PE avéré" },
  ed_medium:   { dot: "bg-orange-400",  bg: "bg-orange-50",     expandBg: "bg-orange-100/60",  name: "text-orange-700 font-semibold", badge: "bg-orange-100 text-orange-600",  label: "PE suspecté" },
  allergen:    { dot: "bg-amber-400",   bg: "bg-amber-50",      expandBg: "bg-amber-100/60",   name: "text-amber-700 font-semibold",  badge: "bg-amber-100 text-amber-700",   label: "Allergène" },
  irritant:    { dot: "bg-violet-400",  bg: "bg-violet-50/60",  expandBg: "bg-violet-100/60",  name: "text-violet-700 font-semibold", badge: "bg-violet-100 text-violet-600",  label: "Irritant" },
  petrochem:   { dot: "bg-yellow-400",  bg: "bg-yellow-50",     expandBg: "bg-yellow-100/60",  name: "text-yellow-700 font-medium",   badge: "bg-yellow-100 text-yellow-700",  label: "Pétrochimique" },
  comedogenic: { dot: "bg-pink-400",    bg: "bg-pink-50",       expandBg: "bg-pink-100/60",    name: "text-pink-700 font-semibold",   badge: "bg-pink-100 text-pink-700",      label: "Comédogène" },
  ok:          { dot: "bg-emerald-400", bg: "bg-emerald-50/50", expandBg: "bg-emerald-100/40", name: "text-emerald-700 font-medium",  badge: "",                               label: "" },
};

function IngredientRow({ ing }: { ing: Ing }) {
  const [open, setOpen] = useState(false);
  const cfg = FLAG_CONFIG[ing.flag];

  const shortNote =
    ing.flag === "allergen"
      ? ing.euMandatory ? "Allergène — déclaration obligatoire EU" : "Allergène — liste SCCS étendue"
      : ing.flag === "comedogenic"
      ? `Comédogène — indice ${ing.comedogenicRating ?? "?"}/5`
      : ing.flag === "ok" ? null
      : ing.reason ?? null;

  return (
    <li className={cfg.bg}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 px-6 py-3 text-left hover:brightness-95"
      >
        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm ${cfg.name}`}>{ing.raw}</span>
            {cfg.label && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.badge}`}>
                {cfg.label}
              </span>
            )}
          </div>
          {shortNote && <p className="mt-0.5 text-xs text-muted-foreground">{shortNote}</p>}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && ing.description && (
        <div className={`space-y-2 px-6 py-3 ${cfg.expandBg}`}>
          <p className="rounded-xl border border-border/40 bg-background/60 px-4 py-3 text-xs leading-relaxed text-foreground/80">
            {ing.description}
          </p>
          {shortNote && (
            <div className={`rounded-xl px-4 py-2.5 ${cfg.bg} border border-current/10`}>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-50">Signal identifié</p>
              <p className={`text-xs font-medium ${cfg.name}`}>{shortNote}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function IngredientAnalyzer() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  function handleAnalyze() {
    if (!input.trim()) return;
    setResult(analyzeIngredients(input));
  }

  return (
    <div className="space-y-5">
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
        <p className="mt-2 text-xs text-muted-foreground">Séparés par des virgules, retours à la ligne ou points ( . )</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />PE avéré</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />PE suspecté</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Allergène</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-pink-400" />Comédogène</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />Pétrochimique</span>
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
        <>
          {/* Score + summary */}
          <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-start gap-4">
              {/* Score */}
              <div className={`flex flex-col items-center justify-center rounded-2xl border px-6 py-4 ${scoreColor(result.score)}`}>
                <span className="font-display text-4xl font-bold tabular-nums">{result.score}</span>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-70">/ 100</span>
                <span className="mt-1 text-xs font-medium">{scoreLabel(result.score, result.edHighCount + result.edMediumCount > 0)}</span>
              </div>

              {/* Comedogenic status card */}
              {result.comedogenicCount > 0 ? (
                <div className="flex flex-col rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 min-w-[160px]">
                  <div className="flex items-center gap-1.5 text-pink-700 mb-2">
                    <Droplets className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">Comédogène</span>
                  </div>
                  <ul className="space-y-1">
                    {result.ingredients
                      .filter((i) => i.flag === "comedogenic")
                      .map((i, idx) => (
                        <li key={idx} className="text-xs text-pink-800">
                          <span className="font-medium">{i.raw}</span>
                          {i.comedogenicRating && (
                            <span className="ml-1 text-pink-500">({i.comedogenicRating}/5)</span>
                          )}
                        </li>
                      ))}
                  </ul>
                  <p className="mt-2 text-[10px] italic leading-tight text-pink-600/80">À éviter pour les peaux grasses ou à tendance acnéique.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
                  <CheckCircle className="h-5 w-5" />
                  <span className="mt-1.5 text-xs font-bold uppercase tracking-wider text-center">Non comédogène</span>
                  <span className="mt-0.5 text-[10px] text-emerald-500 text-center leading-tight">selon notre base</span>
                </div>
              )}

              {/* Other flags */}
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
                {result.irritantCount > 0 && (
                  <div className="flex items-center gap-2 rounded-2xl bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-600">
                    <Zap className="h-4 w-4" />
                    {result.irritantCount} irritant{result.irritantCount > 1 ? "s" : ""}
                  </div>
                )}
                {result.comedogenicCount > 0 && (
                  <div className="flex items-center gap-2 rounded-2xl bg-pink-50 px-4 py-2.5 text-sm font-semibold text-pink-600">
                    <Droplets className="h-4 w-4" />
                    {result.comedogenicCount} comédogène{result.comedogenicCount > 1 ? "s" : ""}
                  </div>
                )}
                {result.petrochemCount > 0 && (
                  <div className="flex items-center gap-2 rounded-2xl bg-yellow-50 px-4 py-2.5 text-sm font-semibold text-yellow-600">
                    <Leaf className="h-4 w-4" />
                    {result.petrochemCount} pétrochimique{result.petrochemCount > 1 ? "s" : ""}
                  </div>
                )}
                {result.edHighCount === 0 && result.edMediumCount === 0 && result.allergenCount === 0 && result.irritantCount === 0 && result.petrochemCount === 0 && result.comedogenicCount === 0 && (
                  <p className="text-sm text-emerald-600 font-medium">✓ Aucun ingrédient problématique détecté.</p>
                )}
              </div>{/* /Other flags */}
            </div>{/* /flex row */}

            {/* Score explanation */}
            <div className="mt-4">
              <button
                onClick={() => setShowScoreInfo((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="h-3.5 w-3.5" />
                Comment est calculée cette note ?
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showScoreInfo ? "rotate-180" : ""}`} />
              </button>
              {showScoreInfo && (
                <div className="mt-2 rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
                  <ul className="space-y-1">
                    <li><span className="font-semibold text-red-600">PE avéré</span> — −30 pts par ingrédient · plafond 40/100</li>
                    <li><span className="font-semibold text-orange-500">PE suspecté</span> — −15 pts par ingrédient · plafond 70/100</li>
                    <li><span className="font-semibold text-amber-600">Allergène</span> — −5 pts par allergène (max −20 pts au total)</li>
                    <li className="text-muted-foreground/70">Irritants, comédogènes et pétrochimiques sont signalés mais n'impactent pas la note</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Ingredient list */}
          <div className="rounded-3xl border border-border/60 bg-card shadow-soft overflow-hidden">
            <div className="border-b border-border/60 px-6 py-4">
              <h2 className="font-display text-base font-semibold">Détail par ingrédient</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{result.ingredients.length} ingrédients analysés · cliquer pour voir le détail</p>
            </div>
            <ul className="divide-y divide-border/40">
              {result.ingredients.map((ing, i) => (
                <IngredientRow key={i} ing={ing} />
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export function IngredientAnalyzerPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-28 pt-10">
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
      <IngredientAnalyzer />
    </main>
  );
}
