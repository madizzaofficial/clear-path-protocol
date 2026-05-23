import { useState, useEffect, useRef } from "react";
import { FlaskConical, AlertTriangle, CheckCircle, Info, Leaf, Zap, ChevronDown, Droplets, User, ShieldAlert, Sparkles, ArrowRight, Barcode, Link, Loader2, Camera } from "lucide-react";
import { analyzeIngredientsV2, type AnalysisResultV2, type SkinProfile } from "@/lib/cosmetic-ingredients";
import { generateExplanationFn, compareProductsFn, toSnapshot } from "@/lib/ai-analysis";
import { computeInciHash, normalizeInciText } from "@/lib/inci-hash";
import { getProductCache, saveProductCache, saveAiSummary, makeProfileKey } from "@/lib/product-cache";
import { lookupBarcodeFn, extractInciFromUrlFn } from "@/lib/product-ingestion";
import { getCatalogProductByBarcode, autoSaveProductToCatalog } from "@/lib/product-catalog";
import { LiveBarcodeScanner } from "@/components/LiveBarcodeScanner";
import { logUnclassifiedIngredients } from "@/lib/unclassified-log";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Flag config ──────────────────────────────────────────────────────────────

type IngFlag = AnalysisResultV2["ingredients"][number]["flag"];

const FLAG_CONFIG: Record<IngFlag, { dot: string; bg: string; expandBg: string; name: string; badge: string; label: string }> = {
  ed_high:     { dot: "bg-red-500",     bg: "bg-red-50 dark:bg-red-950/20",           expandBg: "bg-red-100/60 dark:bg-red-950/30",     name: "text-red-700 dark:text-red-400 font-semibold",    badge: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",       label: "PE avéré" },
  ed_medium:   { dot: "bg-orange-400",  bg: "bg-orange-50 dark:bg-orange-950/20",     expandBg: "bg-orange-100/60 dark:bg-orange-950/30",  name: "text-orange-700 dark:text-orange-400 font-semibold", badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400",  label: "PE suspecté" },
  allergen:    { dot: "bg-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/20",       expandBg: "bg-amber-100/60 dark:bg-amber-950/30",    name: "text-amber-700 dark:text-amber-400 font-semibold",  badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",   label: "Allergène potentiel" },
  irritant:    { dot: "bg-violet-400",  bg: "bg-violet-50/60 dark:bg-violet-950/20",  expandBg: "bg-violet-100/60 dark:bg-violet-950/30",  name: "text-violet-700 dark:text-violet-400 font-semibold", badge: "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400",  label: "Irritant potentiel" },
  petrochem:   { dot: "bg-yellow-400",  bg: "bg-yellow-50 dark:bg-yellow-950/20",     expandBg: "bg-yellow-100/60 dark:bg-yellow-950/30",  name: "text-yellow-700 dark:text-yellow-400 font-medium",   badge: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400",  label: "Pétrochimique" },
  comedogenic: { dot: "bg-pink-400",    bg: "bg-pink-50 dark:bg-pink-950/20",         expandBg: "bg-pink-100/60 dark:bg-pink-950/30",      name: "text-pink-700 dark:text-pink-400 font-semibold",   badge: "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-400",      label: "Comédogène" },
  ok:          { dot: "bg-emerald-400", bg: "bg-emerald-50/50 dark:bg-emerald-950/10", expandBg: "bg-emerald-100/40 dark:bg-emerald-950/20", name: "text-emerald-700 dark:text-emerald-400 font-medium",  badge: "",                               label: "" },
};

// ─── BarometerCard ────────────────────────────────────────────────────────────

const BAR_COLORS = {
  low:    { text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/40", bg: "bg-emerald-50/60 dark:bg-emerald-950/20", dot: "#10b981" },
  medium: { text: "text-amber-600 dark:text-amber-400",     badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",         border: "border-amber-200 dark:border-amber-800/40",     bg: "bg-amber-50/60 dark:bg-amber-950/20",     dot: "#f59e0b" },
  high:   { text: "text-red-600 dark:text-red-400",         badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",                 border: "border-red-200 dark:border-red-800/40",         bg: "bg-red-50/60 dark:bg-red-950/20",         dot: "#ef4444" },
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
  daily:      { text: "Ce produit semble adapté à ton profil.", color: "text-emerald-700 dark:text-emerald-400", dotColor: "bg-emerald-500" },
  occasional: { text: "À utiliser avec modération selon ton profil.", color: "text-amber-700 dark:text-amber-400", dotColor: "bg-amber-500" },
  caution:    { text: "Potentiellement déconseillé pour ton type de peau.", color: "text-orange-700 dark:text-orange-400", dotColor: "bg-orange-500" },
  avoid:      { text: "Déconseillé pour ton profil peau.", color: "text-red-700 dark:text-red-400", dotColor: "bg-red-500" },
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
  daily:      { label: "Usage quotidien possible", sub: "Aucun signal majeur détecté sur la formulation globale.", icon: CheckCircle, color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" },
  occasional: { label: "Usage occasionnel conseillé", sub: "Certains signaux modérés — limiter la fréquence d'application.", icon: Info, color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40" },
  caution:    { label: "Utiliser avec prudence", sub: "Signaux élevés détectés. Surveiller la tolérance cutanée.", icon: AlertTriangle, color: "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40" },
  avoid:      { label: "Utilisation déconseillée", sub: "Formulation à risque élevé selon votre profil peau.", icon: AlertTriangle, color: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40" },
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

// ─── AllergenBadge ────────────────────────────────────────────────────────────

function AllergenBadge({ ingredients }: { ingredients: Ing[] }) {
  const eu  = ingredients.filter((i) => i.flag === "allergen" && i.euMandatory === true);
  const ext = ingredients.filter((i) => i.flag === "allergen" && !i.euMandatory);
  if (!eu.length && !ext.length) return null;

  const all   = [...eu, ...ext];
  const shown = all.slice(0, 4).map((i) => i.raw);
  const rest  = all.length - shown.length;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          {all.length} allergène{all.length > 1 ? "s" : ""} potentiel{all.length > 1 ? "s" : ""}
          {eu.length > 0 && (
            <span className="font-normal text-amber-600/70 dark:text-amber-400/60">
              {" "}· dont {eu.length} à déclaration obligatoire (UE)
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-amber-700/70 dark:text-amber-400/60">
          {shown.join(", ")}{rest > 0 ? ` et ${rest} autre${rest > 1 ? "s" : ""}` : ""}
        </p>
      </div>
    </div>
  );
}

// ─── SignalSummaryCards ───────────────────────────────────────────────────────

function SignalSummaryCards({ result }: { result: AnalysisResultV2 }) {
  const comedogenic = result.ingredients.filter((i) => i.flag === "comedogenic");
  const petrochem   = result.ingredients.filter((i) => i.flag === "petrochem");
  const allergens   = result.ingredients.filter((i) => i.flag === "allergen");
  const irritants   = result.ingredients.filter((i) => i.flag === "irritant");

  if (!comedogenic.length && !petrochem.length && !allergens.length && !irritants.length) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {comedogenic.length > 0 && (
        <div className="flex flex-col rounded-2xl border border-pink-200 dark:border-pink-800/40 bg-pink-50 dark:bg-pink-950/20 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-pink-700 dark:text-pink-400">
            <Droplets className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Comédogènes</span>
          </div>
          <ul className="space-y-1">
            {comedogenic.map((i, idx) => (
              <li key={idx} className="text-xs text-pink-800 dark:text-pink-300">
                <span className="font-medium">{i.raw}</span>
                {i.comedogenicRating && <span className="ml-1 text-pink-500 dark:text-pink-400">({i.comedogenicRating}/5)</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] italic leading-tight text-pink-600/80 dark:text-pink-400/70">À éviter pour les peaux grasses ou à tendance acnéique.</p>
        </div>
      )}

      {petrochem.length > 0 && (
        <div className="flex flex-col rounded-2xl border border-yellow-200 dark:border-yellow-800/40 bg-yellow-50 dark:bg-yellow-950/20 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400">
            <Leaf className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Pétrochimiques</span>
          </div>
          <ul className="space-y-1">
            {petrochem.map((i, idx) => (
              <li key={idx} className="text-xs font-medium text-yellow-800 dark:text-yellow-300">{i.raw}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] italic leading-tight text-yellow-700/80 dark:text-yellow-400/70">Dérivés du pétrole — inertes sur la peau, origine non renouvelable.</p>
        </div>
      )}

      {allergens.length > 0 && (
        <div className="flex flex-col rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <Info className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Allergènes potentiels</span>
          </div>
          <ul className="space-y-1">
            {allergens.map((i, idx) => (
              <li key={idx} className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-medium">{i.raw}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] italic leading-tight text-amber-700/80 dark:text-amber-400/70">Peuvent provoquer des réactions de contact chez les peaux sensibles.</p>
        </div>
      )}

      {irritants.length > 0 && (
        <div className="flex flex-col rounded-2xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-950/20 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-violet-700 dark:text-violet-400">
            <Zap className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Irritants potentiels</span>
          </div>
          <ul className="space-y-1">
            {irritants.map((i, idx) => (
              <li key={idx} className="text-xs text-violet-800 dark:text-violet-300">
                <span className="font-medium">{i.raw}</span>
                {i.reason && <span className="ml-1 text-violet-500 dark:text-violet-400 font-normal">— {i.reason}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] italic leading-tight text-violet-700/80 dark:text-violet-400/70">Peuvent fragiliser la barrière cutanée, surtout en tête de liste.</p>
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
  "Émulsifiant": "Émulsifiants",
  "Conservateur": "Conservateurs",
  "Épaississant": "Texturants", "Texturant": "Texturants", "Régulateur pH": "Texturants", "Chélateur": "Texturants",
  "Conditionneur": "Émollients",
  "Parfum": "Parfums",
  "Tensioactif": "Tensioactifs",
  "Antibactérien": "Antibactériens",
  "Colorant": "Colorants",
};

const ALL_CAT_ORDER = [
  "Actifs", "Antioxydants", "Apaisants", "Barrière cutanée", "Filtres UV",
  "Hydratants", "Émollients", "Émulsifiants", "Solvants", "Conservateurs",
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
  "Émulsifiants":    "Stabilisent le mélange eau + huile. Permettent d'obtenir crèmes et lotions stables.",
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

// ─── ExplanationCard ──────────────────────────────────────────────────────────

function ExplanationCard({
  result,
  skinProfile,
  hash,
}: {
  result: AnalysisResultV2;
  skinProfile: SkinProfile | null;
  hash: string | null;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "hidden">("idle");
  const [text, setText] = useState<string>("");

  async function handleGenerate() {
    if (!skinProfile) return;
    setState("loading");

    // Check cache first
    if (hash) {
      const key = makeProfileKey(skinProfile);
      const cached = await getProductCache(hash);
      if (cached?.aiSummaries?.[key]) {
        setText(cached.aiSummaries[key]);
        setState("done");
        return;
      }
    }

    try {
      const res = await generateExplanationFn({ data: { product: toSnapshot(result), skinProfile } });
      if (!res.text) { setState("hidden"); return; }
      setText(res.text);
      setState("done");
      // Cache for next time
      if (hash) {
        const key = makeProfileKey(skinProfile);
        saveAiSummary(hash, key, res.text).catch(() => {});
      }
    } catch {
      setState("hidden");
    }
  }

  if (!skinProfile || state === "hidden") return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-soft">
      {state === "idle" && (
        <button
          onClick={handleGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted/60 px-4 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Obtenir une explication personnalisée
        </button>
      )}

      {state === "loading" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
            Génération en cours…
          </div>
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      )}

      {state === "done" && (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Généré par IA · GPT-4o mini
            </span>
            <button
              onClick={() => setState("idle")}
              className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2"
            >
              Regénérer
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── ComparisonSection ────────────────────────────────────────────────────────

function MiniBarometer({ label, score, barLabel }: { label: string; score: number; barLabel: string }) {
  const tier = score <= 3 ? "low" : score <= 6 ? "medium" : "high";
  const c = BAR_COLORS[tier];
  const pct = Math.round((score / 10) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${c.badge}`}>{barLabel}</span>
      </div>
      <div className="relative h-3 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full" style={{ background: "linear-gradient(to right, #10b981 0%, #f59e0b 50%, #ef4444 100%)" }} />
        <div className="absolute h-3 w-3 rounded-full border-2 border-white shadow" style={{ left: `calc(${pct}% - 6px)`, backgroundColor: c.dot }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${c.text}`}>{score}<span className="text-[10px] font-normal text-muted-foreground">/10</span></span>
    </div>
  );
}

// ─── ProductComparator ────────────────────────────────────────────────────────

const RECO_BADGE: Record<string, string> = {
  daily:      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
  occasional: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
  caution:    "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400",
  avoid:      "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
};
const RECO_SHORT: Record<string, string> = {
  daily: "Quotidien", occasional: "Occasionnel", caution: "Avec prudence", avoid: "Déconseillé",
};

export function ProductComparator({ skinProfile }: { skinProfile: SkinProfile | null }) {
  const [inciA, setInciA] = useState("");
  const [inciB, setInciB] = useState("");
  const [resultA, setResultA] = useState<AnalysisResultV2 | null>(null);
  const [resultB, setResultB] = useState<AnalysisResultV2 | null>(null);
  const [compState, setCompState] = useState<"idle" | "loading" | "done" | "hidden">("idle");
  const [compText, setCompText] = useState("");

  function handleAnalyze() {
    if (!inciA.trim() || !inciB.trim()) return;
    const rA = analyzeIngredientsV2(inciA, skinProfile ?? undefined);
    const rB = analyzeIngredientsV2(inciB, skinProfile ?? undefined);
    setResultA(rA);
    setResultB(rB);
    logUnclassifiedIngredients(rA.ingredients);
    logUnclassifiedIngredients(rB.ingredients);
    setCompState("idle");
    setCompText("");
  }

  async function handleCompare() {
    if (!resultA || !resultB) return;
    setCompState("loading");
    try {
      const res = await compareProductsFn({
        data: { productA: toSnapshot(resultA), productB: toSnapshot(resultB), skinProfile: skinProfile ?? {} },
      });
      setCompText(res.text);
      setCompState("done");
    } catch {
      setCompState("hidden");
    }
  }

  return (
    <div className="space-y-5">
      {/* Two INCI inputs */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Produit A</label>
            <textarea
              value={inciA}
              onChange={(e) => { setInciA(e.target.value); setResultA(null); setCompState("idle"); }}
              placeholder="Water, Glycerin, Niacinamide, ..."
              rows={6}
              className="w-full resize-y rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Produit B</label>
            <textarea
              value={inciB}
              onChange={(e) => { setInciB(e.target.value); setResultB(null); setCompState("idle"); }}
              placeholder="Water, Glycerin, Niacinamide, ..."
              rows={6}
              className="w-full resize-y rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAnalyze}
            disabled={!inciA.trim() || !inciB.trim()}
            className="flex items-center gap-2 rounded-2xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Analyser et comparer
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {resultA && resultB && (
        <>
          {/* Side-by-side scores */}
          <div className="grid grid-cols-2 gap-3">
            {([["Produit A", resultA], ["Produit B", resultB]] as const).map(([name, r]) => {
              const allergens = r.ingredients.filter(i => i.flag === "allergen");
              return (
                <div key={name} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RECO_BADGE[r.usageReco]}`}>
                      {RECO_SHORT[r.usageReco]}
                    </span>
                  </div>
                  <MiniBarometer label="Irritation"  score={r.barometers.irritation.score}  barLabel={r.barometers.irritation.label} />
                  <MiniBarometer label="Comédogène"  score={r.barometers.comedogenic.score} barLabel={r.barometers.comedogenic.label} />
                  <MiniBarometer label="PE"           score={r.barometers.pe.score}          barLabel={r.barometers.pe.label} />
                  {allergens.length > 0 && (
                    <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5">
                      <Info className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        {allergens.length} allergène{allergens.length > 1 ? "s" : ""} potentiel{allergens.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* AI comparison */}
          {skinProfile && compState !== "hidden" && compState === "idle" && (
            <button
              onClick={handleCompare}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted/60 px-4 py-3 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              Comparer avec l'IA selon mon profil
            </button>
          )}

          {compState === "loading" && (
            <div className="space-y-2 rounded-2xl border border-border/60 bg-card px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
                Comparaison en cours…
              </div>
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            </div>
          )}

          {compState === "done" && (
            <div className="rounded-2xl border border-border/60 bg-card px-5 py-4 space-y-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{compText}</p>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Généré par IA · GPT-4o mini
                </span>
                <button
                  onClick={() => setCompState("idle")}
                  className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2"
                >
                  Regénérer
                </button>
              </div>
            </div>
          )}

          {/* Ingredient detail — two columns */}
          <div className="grid grid-cols-2 gap-3">
            {([["Produit A", resultA], ["Produit B", resultB]] as const).map(([name, r]) => (
              <div key={name} className="space-y-3">
                <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{name}</p>
                <SignalSummaryCards result={r} />
                <GroupedIngredientList ingredients={r.ingredients} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── IngredientAnalyzer ───────────────────────────────────────────────────────

// ─── Input method types ───────────────────────────────────────────────────────

type InputMethod = "text" | "barcode" | "url";

const INGEST_ERRORS: Record<string, string> = {
  INCI_NOT_FOUND: "Liste INCI introuvable sur cette page. Copie-la manuellement.",
  PAGE_INACCESSIBLE: "Page inaccessible. Vérifie l'URL et réessaie.",
  SERVICE_UNAVAILABLE: "Service temporairement indisponible.",
};

export function IngredientAnalyzer({ skinProfile }: { skinProfile: SkinProfile | null }) {
  const [method, setMethod] = useState<InputMethod>("barcode");
  const [input, setInput] = useState("");
  const [barcodeVal, setBarcodeVal] = useState("");
  const [urlVal, setUrlVal] = useState("");
  const [result, setResult] = useState<AnalysisResultV2 | null>(null);
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [productMeta, setProductMeta] = useState<{ name: string | null; brand: string | null; imageUrl: string | null } | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  function applyInci(
    inci: string,
    meta?: { name: string | null; brand: string | null; imageUrl?: string | null },
    barcode?: string | null
  ) {
    const analysis = analyzeIngredientsV2(inci, skinProfile ?? undefined);
    setResult(analysis);
    setProductMeta(meta ? { name: meta.name, brand: meta.brand, imageUrl: meta.imageUrl ?? null } : null);
    setIngestError(null);
    logUnclassifiedIngredients(analysis.ingredients);
    // Hash + cache + catalog auto-save in background
    computeInciHash(inci).then((hash) => {
      setCurrentHash(hash);
      saveProductCache(hash, normalizeInciText(inci), {
        productName: meta?.name,
        brand: meta?.brand,
      }).catch(() => {});
      if (meta?.name || meta?.brand) {
        autoSaveProductToCatalog({
          name: meta?.name ?? null,
          brand: meta?.brand ?? null,
          barcode: barcode ?? null,
          inciNormalized: normalizeInciText(inci),
          inciHash: hash,
          imageUrl: meta?.imageUrl ?? null,
        }).catch(() => {});
      }
    });
  }

  function handleAnalyzeText() {
    if (!input.trim()) return;
    setCurrentHash(null);
    applyInci(input);
  }

  function toInciDecoderSlug(brand: string | null, name: string | null): string {
    return [brand, name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  async function searchBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBarcodeVal(trimmed);
    setShowScanner(false);
    setIngesting(true);
    setIngestError(null);
    try {
      // ── Catalog lookup first (0ms, no API) ────────────────────────────────
      const catalogProduct = await getCatalogProductByBarcode(trimmed).catch(() => null);
      if (catalogProduct?.inciNormalized) {
        setInput(catalogProduct.inciNormalized);
        applyInci(catalogProduct.inciNormalized, {
          name: catalogProduct.name,
          brand: catalogProduct.brand ?? null,
          imageUrl: catalogProduct.imageUrl ?? null,
        });
        return;
      }

      // ── External API lookup ───────────────────────────────────────────────
      const product = await lookupBarcodeFn({ data: { barcode: trimmed } });

      // ── Got INCI directly ──────────────────────────────────────────────────
      if (product?.inci) {
        setInput(product.inci);
        applyInci(product.inci, { name: product.productName, brand: product.brand, imageUrl: product.imageUrl }, trimmed);
        return;
      }

      // ── Product found but no INCI → try InciDecoder auto-slug ─────────────
      if (product?.productName) {
        setIngestError("Composition introuvable — recherche sur InciDecoder…");
        const slug = toInciDecoderSlug(product.brand, product.productName);
        try {
          const extracted = await extractInciFromUrlFn({
            data: { url: `https://incidecoder.com/products/${slug}` },
          });
          setInput(extracted.inci);
          setIngestError(null);
          applyInci(
            extracted.inci,
            {
              name: product.productName ?? extracted.productName,
              brand: product.brand ?? extracted.brand,
              imageUrl: product.imageUrl ?? extracted.imageUrl,
            },
            trimmed
          );
          return;
        } catch {
          // slug guess failed — pre-fill URL tab with InciDecoder search
        }
        const q = encodeURIComponent([product.brand, product.productName].filter(Boolean).join(" "));
        setUrlVal(`https://incidecoder.com/search?query=${q}`);
        setMethod("url");
        setIngestError(`"${product.productName}" trouvé sans composition. URL InciDecoder prête — clique sur "Extraire la liste INCI".`);
        return;
      }

      // ── Product not found at all ───────────────────────────────────────────
      setIngestError("Produit non reconnu. Essaie l'onglet URL produit ou colle la liste INCI.");
    } catch {
      setIngestError("Erreur lors de la recherche. Réessaie.");
    } finally {
      setIngesting(false);
    }
  }

  function handleBarcodeSearch() {
    searchBarcode(barcodeVal);
  }

  async function handleUrlExtract() {
    if (!urlVal.trim()) return;
    setIngesting(true);
    setIngestError(null);
    try {
      const extracted = await extractInciFromUrlFn({ data: { url: urlVal.trim() } });
      setInput(extracted.inci);
      applyInci(extracted.inci, { name: extracted.productName, brand: extracted.brand, imageUrl: extracted.imageUrl });
    } catch (err: any) {
      setIngestError(INGEST_ERRORS[err?.message] ?? "Erreur lors de l'extraction.");
    } finally {
      setIngesting(false);
    }
  }

  function handleBarcodeDetected(code: string) {
    searchBarcode(code);
  }

  const LEGEND = (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />PE avéré</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />PE suspecté</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Allergène</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-400" />Irritant</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-pink-400" />Comédogène</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />Pétrochimique</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Input card */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft space-y-4">
        {/* Method selector */}
        <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
          {([
            { id: "barcode", icon: Barcode,      label: "Code-barres" },
            { id: "url",     icon: Link,         label: "URL produit" },
            { id: "text",    icon: FlaskConical, label: "INCI texte" },
          ] as { id: InputMethod; icon: React.ElementType; label: string }[]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { setMethod(id); setIngestError(null); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                method === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Text input */}
        {method === "text" && (
          <>
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); setResult(null); setCurrentHash(null); }}
              placeholder="Water, Glycerin, Niacinamide, Methylparaben, Limonene, ..."
              rows={6}
              className="w-full resize-y rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-muted-foreground">Séparés par des virgules, retours à la ligne ou points ( . )</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {LEGEND}
              <button
                onClick={handleAnalyzeText}
                disabled={!input.trim()}
                className="rounded-2xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Analyser
              </button>
            </div>
          </>
        )}

        {/* Barcode input */}
        {method === "barcode" && (
          <div className="space-y-3">
            {showScanner ? (
              <LiveBarcodeScanner onDetect={handleBarcodeDetected} onClose={() => setShowScanner(false)} />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Scanne le code-barres EAN/UPC en live ou entre-le manuellement</p>
                <button
                  onClick={() => setShowScanner(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted"
                >
                  <Camera className="h-4 w-4" />
                  Ouvrir le scanner
                </button>
                <div className="relative flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ou</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={barcodeVal}
                  onChange={(e) => setBarcodeVal(e.target.value)}
                  placeholder="3600523459858"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </>
            )}
            {!showScanner && (
              <button
                onClick={handleBarcodeSearch}
                disabled={!barcodeVal.trim() || ingesting}
                className="flex items-center gap-2 rounded-2xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {ingesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Barcode className="h-4 w-4" />}
                Rechercher le produit
              </button>
            )}
          </div>
        )}

        {/* URL input */}
        {method === "url" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Colle l'URL d'une page produit — la liste INCI sera extraite automatiquement</p>
            <input
              type="url"
              value={urlVal}
              onChange={(e) => setUrlVal(e.target.value)}
              placeholder="https://www.incidecoder.com/products/..."
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={handleUrlExtract}
              disabled={!urlVal.trim() || ingesting}
              className="flex items-center gap-2 rounded-2xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {ingesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
              Extraire la liste INCI
            </button>
          </div>
        )}

        {ingestError && (
          <p className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
            {ingestError}
          </p>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Product metadata (barcode / URL source) */}
          {productMeta && (productMeta.name || productMeta.brand) && (
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
              {productMeta.imageUrl ? (
                <img
                  src={productMeta.imageUrl}
                  alt={productMeta.name ?? ""}
                  className="h-14 w-14 shrink-0 rounded-xl object-contain bg-muted/30"
                />
              ) : (
                <FlaskConical className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div>
                {productMeta.name && <p className="text-sm font-semibold">{productMeta.name}</p>}
                {productMeta.brand && <p className="text-xs text-muted-foreground">{productMeta.brand}</p>}
              </div>
            </div>
          )}

          {/* Profile card */}
          {skinProfile && <ProfileCard profile={skinProfile} usageReco={result.usageReco} />}

          {/* 3 Barometers */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <BarometerCard label="Irritation" score={result.barometers.irritation.score} barLabel={result.barometers.irritation.label} icon={Zap} description="Tensioactifs et alcools irritants" />
            <BarometerCard label="Comédogénicité" score={result.barometers.comedogenic.score} barLabel={result.barometers.comedogenic.label} icon={Droplets} description="Huiles, esters, cires obstruants" />
            <BarometerCard label="Perturbateurs endo." score={result.barometers.pe.score} barLabel={result.barometers.pe.label} icon={ShieldAlert} description="PE avérés et suspectés" />
          </div>

          {/* Usage reco + score info */}
          <div className="space-y-2">
            <UsageReco reco={result.usageReco} productType={result.productType} />
            <button
              onClick={() => setShowInfo((v) => !v)}
              className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Info className="h-3.5 w-3.5" />
              Comment sont calculés ces scores ?
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showInfo ? "rotate-180" : ""}`} />
            </button>
            {showInfo && (
              <div className="space-y-1 rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
                <p><span className="font-semibold text-foreground/80">Position weighting :</span> les 3 premiers ingrédients comptent ×2, les suivants ×1.2, les derniers ×0.8.</p>
                <p><span className="font-semibold text-foreground/80">Irritation :</span> tensioactifs forts (+3), alcools (+2) · normalisé sur 12.</p>
                <p><span className="font-semibold text-foreground/80">Comédogénicité :</span> indices INCIDecoder (5→+3 pts, 4→+2, 3→+1.5) · normalisé sur 9.</p>
                <p><span className="font-semibold text-foreground/80">Perturbateurs endo. :</span> PE avéré (+3), PE suspecté (+1.5) · normalisé sur 9.</p>
                {result.skinProfileUsed && <p><span className="font-semibold text-primary">Profil peau appliqué :</span> scores adaptés à ton type de peau.</p>}
              </div>
            )}
          </div>

          {/* AI explanation (with cache) */}
          <ExplanationCard result={result} skinProfile={skinProfile} hash={currentHash} />

          {/* Signal summary cards */}
          <SignalSummaryCards result={result} />

          {/* Grouped ingredient list */}
          <GroupedIngredientList ingredients={result.ingredients} />
        </>
      )}
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export function IngredientAnalyzerPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"analyzer" | "comparator">("analyzer");
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "intake_answers", user.uid)).then((snap) => {
      if (snap.exists()) setSkinProfile(snap.data() as SkinProfile);
    });
  }, [user]);

  return (
    <main className="mx-auto max-w-4xl px-6 pb-28 pt-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
          <FlaskConical className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">Analyseur d'ingrédients</h1>
          <p className="text-sm text-muted-foreground">Identifie les ingrédients problématiques dans une formule INCI</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-muted/50 p-1">
        <button
          onClick={() => setTab("analyzer")}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            tab === "analyzer"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Analyseur
        </button>
        <button
          onClick={() => setTab("comparator")}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            tab === "comparator"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Comparateur
        </button>
      </div>

      {tab === "analyzer" ? (
        <IngredientAnalyzer skinProfile={skinProfile} />
      ) : (
        <ProductComparator skinProfile={skinProfile} />
      )}
    </main>
  );
}
