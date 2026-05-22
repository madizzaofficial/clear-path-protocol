import { useState, useEffect } from "react";
import { FlaskConical, AlertTriangle, CheckCircle, Info, Leaf, Zap, ChevronDown, Droplets, User, ShieldAlert } from "lucide-react";
import { analyzeIngredientsV2, type AnalysisResultV2, type SkinProfile } from "@/lib/cosmetic-ingredients";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// ─── Flag config ──────────────────────────────────────────────────────────────

type IngFlag = AnalysisResultV2["ingredients"][number]["flag"];

const FLAG_CONFIG: Record<IngFlag, { dot: string; bg: string; expandBg: string; name: string; badge: string; label: string }> = {
  ed_high:     { dot: "bg-red-500",     bg: "bg-red-50",        expandBg: "bg-red-100/60",     name: "text-red-700 font-semibold",    badge: "bg-red-100 text-red-600",       label: "PE avéré" },
  ed_medium:   { dot: "bg-orange-400",  bg: "bg-orange-50",     expandBg: "bg-orange-100/60",  name: "text-orange-700 font-semibold", badge: "bg-orange-100 text-orange-600",  label: "PE suspecté" },
  allergen:    { dot: "bg-amber-400",   bg: "bg-amber-50",      expandBg: "bg-amber-100/60",   name: "text-amber-700 font-semibold",  badge: "bg-amber-100 text-amber-700",   label: "Allergène" },
  irritant:    { dot: "bg-violet-400",  bg: "bg-violet-50/60",  expandBg: "bg-violet-100/60",  name: "text-violet-700 font-semibold", badge: "bg-violet-100 text-violet-600",  label: "Irritant" },
  petrochem:   { dot: "bg-yellow-400",  bg: "bg-yellow-50",     expandBg: "bg-yellow-100/60",  name: "text-yellow-700 font-medium",   badge: "bg-yellow-100 text-yellow-700",  label: "Pétrochimique" },
  comedogenic: { dot: "bg-pink-400",    bg: "bg-pink-50",       expandBg: "bg-pink-100/60",    name: "text-pink-700 font-semibold",   badge: "bg-pink-100 text-pink-700",      label: "Comédogène" },
  ok:          { dot: "bg-emerald-400", bg: "bg-emerald-50/50", expandBg: "bg-emerald-100/40", name: "text-emerald-700 font-medium",  badge: "",                               label: "" },
};

// ─── BarometerCard ────────────────────────────────────────────────────────────

const BAR_COLORS = {
  low:    { text: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50/60", dot: "#10b981" },
  medium: { text: "text-amber-600",   badge: "bg-amber-100 text-amber-700",     border: "border-amber-200",   bg: "bg-amber-50/60",   dot: "#f59e0b" },
  high:   { text: "text-red-600",     badge: "bg-red-100 text-red-700",         border: "border-red-200",     bg: "bg-red-50/60",     dot: "#ef4444" },
} as const;

function BarometerCard({
  label,
  score,
  barLabel,
  icon: Icon,
  description,
}: {
  label: string;
  score: number;
  barLabel: string;
  icon: React.ElementType;
  description: string;
}) {
  const tier = score <= 3 ? "low" : score <= 6 ? "medium" : "high";
  const c = BAR_COLORS[tier];
  const pct = Math.round((score / 10) * 100);

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border ${c.border} ${c.bg} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${c.text}`} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.badge}`}>
          {barLabel}
        </span>
      </div>

      {/* Gauge */}
      <div className="relative h-5 flex items-center">
        <div
          className="absolute inset-x-0 h-2 rounded-full"
          style={{ background: "linear-gradient(to right, #10b981 0%, #f59e0b 50%, #ef4444 100%)" }}
        />
        <div
          className="absolute h-4 w-4 rounded-full border-[3px] border-white shadow-md"
          style={{
            left: `calc(${pct}% - 8px)`,
            backgroundColor: c.dot,
            transition: "left 0.7s ease-out",
          }}
        />
      </div>

      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <span className={`font-display text-3xl font-bold tabular-nums leading-none ${c.text}`}>{score}</span>
          <span className="text-xs font-medium text-muted-foreground">/ 10</span>
        </div>
        <span className="text-[10px] text-muted-foreground/70 text-right leading-tight max-w-[100px]">{description}</span>
      </div>
    </div>
  );
}

// ─── ProfileBanner ────────────────────────────────────────────────────────────

const SKIN_LABELS: Record<string, string> = {
  normale: "normale", grasse: "grasse", seche: "sèche", mixte: "mixte", sensible: "sensible",
};
const INT_LABELS: Record<string, string> = {
  legere: "légère", moderee: "modérée", severe: "sévère",
};

function ProfileBanner({ profile }: { profile: SkinProfile }) {
  const parts = [
    profile.skinType ? `peau ${SKIN_LABELS[profile.skinType] ?? profile.skinType}` : null,
    profile.intensity ? `acné ${INT_LABELS[profile.intensity] ?? profile.intensity}` : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-primary-soft/60 px-4 py-2.5">
      <User className="h-3.5 w-3.5 shrink-0 text-primary" />
      <p className="text-xs font-medium text-primary">
        Analyse adaptée · {parts.join(", ")}
      </p>
    </div>
  );
}

// ─── UsageReco ────────────────────────────────────────────────────────────────

const RECO_CONFIG = {
  daily:      { label: "Usage quotidien possible", sub: "Aucun signal majeur détecté sur la formulation globale.", icon: CheckCircle, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  occasional: { label: "Usage occasionnel conseillé", sub: "Certains signaux modérés — limiter la fréquence d'application.", icon: Info, color: "text-amber-700 bg-amber-50 border-amber-200" },
  caution:    { label: "Utiliser avec prudence", sub: "Signaux élevés détectés. Surveiller la tolérance cutanée.", icon: AlertTriangle, color: "text-orange-700 bg-orange-50 border-orange-200" },
  avoid:      { label: "Utilisation déconseillée", sub: "Formulation à risque élevé selon votre profil peau.", icon: AlertTriangle, color: "text-red-700 bg-red-50 border-red-200" },
};

function UsageReco({ reco, productType }: { reco: AnalysisResultV2["usageReco"]; productType: AnalysisResultV2["productType"] }) {
  const { label, sub, icon: Icon, color } = RECO_CONFIG[reco];
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${color}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{label}</p>
          {productType && (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-current/70">
              {productType}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs opacity-80">{sub}</p>
      </div>
    </div>
  );
}

// ─── IngredientRow ────────────────────────────────────────────────────────────

type Ing = AnalysisResultV2["ingredients"][number];

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

// ─── ComedogenicCard ──────────────────────────────────────────────────────────

function ComedogenicCard({ result }: { result: AnalysisResultV2 }) {
  if (result.comedogenicCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
        <CheckCircle className="h-5 w-5" />
        <span className="mt-1.5 text-xs font-bold uppercase tracking-wider text-center">Non comédogène</span>
        <span className="mt-0.5 text-[10px] text-emerald-500 text-center leading-tight">selon notre base</span>
      </div>
    );
  }
  return (
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
  );
}

// ─── IngredientAnalyzer ───────────────────────────────────────────────────────

export function IngredientAnalyzer() {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnalysisResultV2 | null>(null);
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "intake_answers", user.uid)).then((snap) => {
      if (snap.exists()) setSkinProfile(snap.data() as SkinProfile);
    });
  }, [user]);

  function handleAnalyze() {
    if (!input.trim()) return;
    setResult(analyzeIngredientsV2(input, skinProfile ?? undefined));
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />PE avéré</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />PE suspecté</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Allergène</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-400" />Irritant</span>
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
          {/* Profile banner */}
          {result.skinProfileUsed && skinProfile && (
            <ProfileBanner profile={skinProfile} />
          )}

          {/* 3 Barometers */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <BarometerCard
              label="Irritation"
              score={result.barometers.irritation.score}
              barLabel={result.barometers.irritation.label}
              icon={Zap}
              description="Tensioactifs, alcools, allergènes"
            />
            <BarometerCard
              label="Comédogénicité"
              score={result.barometers.comedogenic.score}
              barLabel={result.barometers.comedogenic.label}
              icon={Droplets}
              description="Huiles, esters, cires obstruants"
            />
            <BarometerCard
              label="Perturbateurs endo."
              score={result.barometers.pe.score}
              barLabel={result.barometers.pe.label}
              icon={ShieldAlert}
              description="PE avérés et suspectés"
            />
          </div>

          {/* Usage reco + score info */}
          <div className="space-y-2">
            <UsageReco reco={result.usageReco} productType={result.productType} />

            <button
              onClick={() => setShowInfo((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              <Info className="h-3.5 w-3.5" />
              Comment sont calculés ces scores ?
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showInfo ? "rotate-180" : ""}`} />
            </button>
            {showInfo && (
              <div className="rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground space-y-1">
                <p><span className="font-semibold text-foreground/80">Position weighting :</span> les 3 premiers ingrédients (plus concentrés) comptent ×2, les suivants ×1.2, les derniers ×0.8.</p>
                <p><span className="font-semibold text-foreground/80">Irritation :</span> tensioactifs forts (+3), alcools (+2), allergènes (+1) · normalisé sur 12.</p>
                <p><span className="font-semibold text-foreground/80">Comédogénicité :</span> indices INCIDecoder (5→+3 pts, 4→+2, 3→+1.5, ≤2→+0.5) · normalisé sur 9.</p>
                <p><span className="font-semibold text-foreground/80">Perturbateurs endo. :</span> PE avéré (+3), PE suspecté (+1.5) · normalisé sur 9.</p>
                {result.skinProfileUsed && <p><span className="font-semibold text-primary">Profil peau appliqué :</span> scores adaptés à votre type de peau et votre acné.</p>}
              </div>
            )}
          </div>

          {/* Comedogenic detail card */}
          <div className="flex flex-wrap gap-3">
            <ComedogenicCard result={result} />

            {/* Flag summary badges */}
            <div className="flex flex-wrap gap-2 items-start content-start">
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
              {result.petrochemCount > 0 && (
                <div className="flex items-center gap-2 rounded-2xl bg-yellow-50 px-4 py-2.5 text-sm font-semibold text-yellow-600">
                  <Leaf className="h-4 w-4" />
                  {result.petrochemCount} pétrochimique{result.petrochemCount > 1 ? "s" : ""}
                </div>
              )}
              {result.edHighCount === 0 && result.edMediumCount === 0 && result.allergenCount === 0 &&
               result.irritantCount === 0 && result.petrochemCount === 0 && result.comedogenicCount === 0 && (
                <p className="text-sm text-emerald-600 font-medium pt-1">✓ Aucun ingrédient problématique détecté.</p>
              )}
            </div>
          </div>

          {/* Ingredient list */}
          <div className="rounded-3xl border border-border/60 bg-card shadow-soft overflow-hidden">
            <div className="border-b border-border/60 px-6 py-4">
              <h2 className="font-display text-base font-semibold">Détail par ingrédient</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {result.ingredients.length} ingrédients analysés · cliquer pour voir le détail
              </p>
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

// ─── Page wrapper ─────────────────────────────────────────────────────────────

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
