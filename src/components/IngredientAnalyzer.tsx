import { useState, useEffect } from "react";
import { FlaskConical, AlertTriangle, CheckCircle, Info, Leaf, Zap, ChevronDown, Droplets, User, ShieldAlert } from "lucide-react";
import { analyzeIngredientsV2, type AnalysisResultV2, type SkinProfile } from "@/lib/cosmetic-ingredients";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

// ─── ProfileCard ─────────────────────────────────────────────────────────────

const SKIN_LABELS: Record<string, string> = {
  normale: "normale", grasse: "grasse", seche: "sèche", mixte: "mixte", sensible: "sensible",
};
const INT_LABELS: Record<string, string> = {
  legere: "légère", moderee: "modérée", severe: "sévère",
};
const ACNE_TYPE_LABELS: Record<string, string> = {
  comedons: "comédons", microkystes: "microkystes", papules: "papules",
  pustules: "pustules", kystes: "kystes", nodules: "nodules",
};

const RECO_VERDICT: Record<string, { text: string; color: string; dotColor: string }> = {
  daily:      { text: "Ce produit semble adapté à ton profil.", color: "text-emerald-700", dotColor: "bg-emerald-500" },
  occasional: { text: "À utiliser avec modération selon ton profil.", color: "text-amber-700", dotColor: "bg-amber-500" },
  caution:    { text: "Potentiellement déconseillé pour ton type de peau.", color: "text-orange-700", dotColor: "bg-orange-500" },
  avoid:      { text: "Déconseillé pour ton profil peau.", color: "text-red-700", dotColor: "bg-red-500" },
};

function ProfileCard({ profile, usageReco }: { profile: SkinProfile; usageReco: AnalysisResultV2["usageReco"] }) {
  const skinLabel      = profile.skinType ? SKIN_LABELS[profile.skinType] ?? profile.skinType : null;
  const intensityLabel = profile.intensity ? INT_LABELS[profile.intensity] ?? profile.intensity : null;
  const acneLabels     = profile.acneTypes?.map((t) => ACNE_TYPE_LABELS[t] ?? t) ?? [];
  const verdict        = RECO_VERDICT[usageReco];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Analyse pour ton profil
          </p>
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {skinLabel && (
              <span className="rounded-full bg-background border border-border/60 px-2.5 py-0.5 text-xs font-medium text-foreground/70">
                Peau {skinLabel}
              </span>
            )}
            {intensityLabel && (
              <span className="rounded-full bg-background border border-border/60 px-2.5 py-0.5 text-xs font-medium text-foreground/70">
                Acné {intensityLabel}
              </span>
            )}
            {acneLabels.map((l) => (
              <span key={l} className="rounded-full bg-background border border-border/60 px-2.5 py-0.5 text-xs font-medium text-foreground/70">
                {l}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${verdict.dotColor}`} />
            <p className={`text-sm font-semibold ${verdict.color}`}>{verdict.text}</p>
          </div>
        </div>
      </div>
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

// ─── SignalSummaryCards ───────────────────────────────────────────────────────

function SignalSummaryCards({ result }: { result: AnalysisResultV2 }) {
  const comedogenic = result.ingredients.filter((i) => i.flag === "comedogenic");
  const petrochem   = result.ingredients.filter((i) => i.flag === "petrochem");
  const allergens   = result.ingredients.filter((i) => i.flag === "allergen" && i.euMandatory === true);
  const irritants   = result.ingredients.filter((i) => i.flag === "irritant");

  if (!comedogenic.length && !petrochem.length && !allergens.length && !irritants.length) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {comedogenic.length > 0 && (
        <div className="flex flex-col rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-pink-700">
            <Droplets className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Comédogènes</span>
          </div>
          <ul className="space-y-1">
            {comedogenic.map((i, idx) => (
              <li key={idx} className="text-xs text-pink-800">
                <span className="font-medium">{i.raw}</span>
                {i.comedogenicRating && <span className="ml-1 text-pink-500">({i.comedogenicRating}/5)</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] italic leading-tight text-pink-600/80">À éviter pour les peaux grasses ou à tendance acnéique.</p>
        </div>
      )}

      {petrochem.length > 0 && (
        <div className="flex flex-col rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-yellow-700">
            <Leaf className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Pétrochimiques</span>
          </div>
          <ul className="space-y-1">
            {petrochem.map((i, idx) => (
              <li key={idx} className="text-xs font-medium text-yellow-800">{i.raw}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] italic leading-tight text-yellow-700/80">Dérivés du pétrole — inertes sur la peau, origine non renouvelable.</p>
        </div>
      )}

      {allergens.length > 0 && (
        <div className="flex flex-col rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-amber-700">
            <Info className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Allergènes</span>
          </div>
          <ul className="space-y-1">
            {allergens.map((i, idx) => (
              <li key={idx} className="text-xs text-amber-800">
                <span className="font-medium">{i.raw}</span>
                {i.euMandatory && <span className="ml-1 text-amber-500">(EU)</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] italic leading-tight text-amber-700/80">Peuvent provoquer des réactions de contact chez les peaux sensibles.</p>
        </div>
      )}

      {irritants.length > 0 && (
        <div className="flex flex-col rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-violet-700">
            <Zap className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Irritants</span>
          </div>
          <ul className="space-y-1">
            {irritants.map((i, idx) => (
              <li key={idx} className="text-xs text-violet-800">
                <span className="font-medium">{i.raw}</span>
                {i.reason && <span className="ml-1 text-violet-500 font-normal">— {i.reason}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] italic leading-tight text-violet-700/80">Peuvent fragiliser la barrière cutanée, surtout en tête de liste.</p>
        </div>
      )}
    </div>
  );
}

// ─── GroupedIngredientList ────────────────────────────────────────────────────

const ROLE_TO_CATEGORY: Record<string, string> = {
  "Actif": "Actifs", "Exfoliant BHA": "Actifs", "Exfoliant AHA": "Actifs",
  "Exfoliant PHA": "Actifs", "Sébo-régulateur": "Actifs", "Dépigmentant": "Actifs",
  "Antioxydant": "Antioxydants",
  "Apaisant": "Apaisants", "Protecteur": "Apaisants",
  "Barrière": "Barrière cutanée",
  "Filtre UV minéral": "Filtres UV", "Filtre UV": "Filtres UV",
  "Humectant": "Hydratants",
  "Solvant": "Solvants",
  "Émollient": "Émollients",
  "Conservateur": "Conservateurs",
  "Épaississant": "Texturants", "Régulateur pH": "Texturants", "Chélateur": "Texturants",
  "Parfum": "Parfums",
  "Tensioactif": "Tensioactifs",
  "Antibactérien": "Antibactériens",
  "Colorant": "Colorants",
};

const ALL_CAT_ORDER = [
  "Actifs", "Antioxydants", "Apaisants", "Barrière cutanée", "Filtres UV",
  "Hydratants", "Émollients", "Solvants", "Conservateurs",
  "Parfums", "Tensioactifs", "Antibactériens",
  "Texturants", "Colorants", "Non classifié",
];

const CATEGORY_INFO: Record<string, string> = {
  "Actifs":          "Molécules à effet biologique démontré : exfoliants, vitamines, régulateurs de sébum, dépigmentants...",
  "Antioxydants":    "Protègent les cellules du stress oxydatif et freinent le vieillissement prématuré.",
  "Apaisants":       "Réduisent les rougeurs et inflammations. Idéaux pour les peaux réactives et sensibles.",
  "Barrière cutanée": "Céramides et lipides qui reconstituent le film hydrolipidique naturel de la peau.",
  "Filtres UV":      "Protègent des UVA/UVB. Les filtres minéraux (zinc, titane) sont les mieux tolérés.",
  "Hydratants":      "Humectants qui attirent et retiennent l'eau dans les couches superficielles de l'épiderme.",
  "Solvants":        "Base de la formule. Dissolvent les autres ingrédients et facilitent leur pénétration.",
  "Émollients":      "Adoucissent et assouplissent la peau en formant un film protecteur sur sa surface.",
  "Conservateurs":   "Empêchent la prolifération bactérienne pour préserver l'intégrité du produit. Certains conservateurs sont des perturbateurs endocriniens suspectés.",
  "Parfums":         "Molécules parfumantes — 26 allergènes EU à déclaration obligatoire. Peuvent provoquer des réactions de contact chez les peaux sensibles.",
  "Tensioactifs":    "Agents lavants et moussants. Les tensioactifs forts (SLS, ALS) perturbent la barrière cutanée.",
  "Antibactériens":  "Agents antimicrobiens — certains sont suspectés de perturber le microbiome cutané.",
  "Texturants":      "Donnent la texture, l'épaisseur et la stabilité à la formule sans effet actif sur la peau.",
  "Colorants":       "Pigments et colorants — certains peuvent être comédogènes pour les peaux acnéiques.",
  "Non classifié":   "Ingrédients non encore répertoriés dans notre base de données.",
};

function GroupedIngredientList({ ingredients }: { ingredients: Ing[] }) {
  const [openTip, setOpenTip] = useState<string | null>(null);

  const grouped = new Map<string, Ing[]>();
  for (const ing of ingredients) {
    const cat = ing.role ? (ROLE_TO_CATEGORY[ing.role] ?? "Non classifié") : "Non classifié";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(ing);
  }

  const visibleCats = ALL_CAT_ORDER.filter((c) => grouped.has(c));

  function renderCategory(cat: string) {
    const ings = grouped.get(cat)!;
    return (
      <div key={cat}>
        <div className="flex items-center gap-2 border-y border-border/40 bg-muted/30 px-6 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{cat}</span>
          <Tooltip open={openTip === cat} onOpenChange={(o) => { if (!o) setOpenTip(null); }}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground/40 transition-colors hover:text-muted-foreground"
                onMouseEnter={() => setOpenTip(cat)}
                onMouseLeave={() => setOpenTip(null)}
                onClick={() => setOpenTip(openTip === cat ? null : cat)}
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-center leading-relaxed" side="top">
              {CATEGORY_INFO[cat] ?? cat}
            </TooltipContent>
          </Tooltip>
          <span className="ml-auto text-[10px] text-muted-foreground/40">{ings.length}</span>
        </div>
        <ul className="divide-y divide-border/40">
          {ings.map((ing, i) => <IngredientRow key={i} ing={ing} />)}
        </ul>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="rounded-3xl border border-border/60 bg-card shadow-soft overflow-hidden">
        <div className="border-b border-border/60 px-6 py-4">
          <h2 className="font-display text-base font-semibold">Ingrédients</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ingredients.length} analysés · cliquer sur un ingrédient pour le détail
          </p>
        </div>
        {visibleCats.map(renderCategory)}
      </div>
    </TooltipProvider>
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
          {/* Profile card */}
          {skinProfile && (
            <ProfileCard profile={skinProfile} usageReco={result.usageReco} />
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

          {/* Signal summary cards */}
          <SignalSummaryCards result={result} />

          {/* Grouped ingredient list (catégories + détail fusionnés) */}
          <GroupedIngredientList ingredients={result.ingredients} />
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
