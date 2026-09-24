import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { useState, useEffect, Fragment } from "react";
import {
  Sun, Moon, Loader2, Check, Sparkles, ShoppingCart, PlayCircle, Info,
  Printer, Salad, Pill, Lightbulb, Leaf, Ban, HeartPulse, Eye, Droplet, Clock,
} from "lucide-react";
import { currentProtocolWeek } from "@/lib/routine-week";
import { defaultPhases, phaseLabel, type RoutinePhase } from "@/lib/routine-phases";
import {
  activePhase, nextPhase, firstWeek, describePhase, qtyLabel,
  phaseDays, freqLabel, DAY_LABELS, type FreqPhase,
} from "@/lib/routine-schedule";
import { WeekStrip } from "@/components/WeekStrip";
import { QuantityVisual } from "@/components/QuantityVisual";
import { weeklyGuidance, didYouKnow } from "@/lib/skincare-education";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import type { PurchaseLink } from "@/lib/product-catalog";
import { toast } from "sonner";

// Nouvelle page routine client — plus visuelle que /products. /products reste la
// vue de prod tant qu'on ne bascule pas dessus. Même doc Firestore routines/{uid}.

type RoutineStep = {
  id: string;
  order: number;
  category: string;
  product: string;
  brand?: string;
  instructions: string;
  imageUrl?: string;
  videoUrl?: string;
  frequency?: string;
  amount?: string;
  amountPreset?: string;
  amountImageUrl?: string;
  waitAfter?: string;
  schedule?: FreqPhase[];
  purchaseUrl?: string;
  purchaseLinks?: PurchaseLink[];
  startWeek?: number;
  introNote?: string;
  whyThisProduct?: string;
};

type ExtraBlock = { id: string; name: string; steps: RoutineStep[] };

type UserRoutine = {
  uid: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  extras?: ExtraBlock[];
  phases?: RoutinePhase[];
  updatedAt: number;
  sentAt: number | null;
  status: "draft" | "sent";
};

type NutritionItem = { id: string; label: string; emoji: string };
type Supplement = { id: string; label: string; emoji: string; dosage?: string };
type TipItem = { id: string; text: string; emoji: string };

export const Route = createFileRoute("/ma-routine")({
  // ?as=<uid> : aperçu admin de la routine d'un élève (réservé aux admins).
  validateSearch: (search: Record<string, unknown>) => ({
    as: typeof search.as === "string" ? search.as : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ma Routine — Protocole Clear" },
      { name: "description", content: "Ta routine, étape par étape, en clair." },
    ],
  }),
  component: MaRoutinePage,
});

// N'autorise que les URLs http(s) — bloque javascript:, data:, etc. (URLs
// saisies par le coach : défense en profondeur contre XSS).
function safeHttpUrl(raw?: string): string | null {
  const u = (raw ?? "").trim();
  if (!u) return null;
  try {
    const { protocol } = new URL(u);
    return protocol === "http:" || protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

// ── Export PDF ──────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function weekStripHtml(phase: FreqPhase): string {
  const active = new Set(phaseDays(phase));
  const cells = DAY_LABELS.map(
    (d, i) => `<span class="day${active.has(i) ? " on" : ""}">${d}</span>`,
  ).join("");
  const m = phase.moment === "am" ? "Matin" : phase.moment === "pm" ? "Soir" : "Matin & soir";
  return `<div class="freq"><div class="strip">${cells}</div><span class="chip freq">${escapeHtml(freqLabel(phase))} · ${m}</span></div>`;
}

function stepRowsHtml(steps: RoutineStep[], week: number): string {
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  return ordered
    .map((s, i) => {
      const phase = activePhase(s.schedule, week);
      const introWeek = firstWeek(s.schedule) ?? s.startWeek ?? null;
      const upcoming = introWeek != null && introWeek > week;
      const qty = qtyLabel(s.amountPreset) || s.amount || "";
      const qtyHtml = s.amountImageUrl
        ? `<img class="amt-img" src="${escapeHtml(s.amountImageUrl)}" alt="Quantité" />`
        : qty
          ? `<span class="chip amt">${escapeHtml(qty)}</span>`
          : "";
      const freqHtml = upcoming
        ? `<p class="soon">◷ À introduire dès la semaine ${introWeek}</p>`
        : phase
          ? `${weekStripHtml(phase)}${qtyHtml}`
          : `<div class="freq">${s.frequency ? `<span class="chip freq">${escapeHtml(s.frequency)}</span>` : ""}${qtyHtml}</div>`;
      return `
      <div class="step">
        ${s.imageUrl ? `<img src="${escapeHtml(s.imageUrl)}" alt="" />` : `<div class="ph">${i + 1}</div>`}
        <div class="body">
          <span class="cat">${escapeHtml(s.category)}</span>
          <p class="name">${i + 1}. ${escapeHtml(s.product)}${s.brand ? ` <span class="brand">· ${escapeHtml(s.brand)}</span>` : ""}</p>
          ${freqHtml}
          ${s.instructions ? `<p class="instr">${escapeHtml(s.instructions)}</p>` : ""}
          ${s.whyThisProduct ? `<p class="why"><b>Pourquoi&nbsp;:</b> ${escapeHtml(s.whyThisProduct)}</p>` : ""}
        </div>
      </div>${
        s.waitAfter && i < ordered.length - 1
          ? `<p class="wait">⏱ ${escapeHtml(s.waitAfter)}</p>`
          : ""
      }`;
    })
    .join("");
}

function printRoutine(opts: {
  name: string;
  week: number;
  phase: string;
  routine: UserRoutine;
  toEat: NutritionItem[];
  toAvoid: NutritionItem[];
  suppTake: Supplement[];
  suppAvoid: Supplement[];
  lifestyle: TipItem[];
  reminders: TipItem[];
}) {
  const { name, week, phase, routine, toEat, toAvoid, suppTake, suppAvoid, lifestyle, reminders } =
    opts;
  const section = (title: string, steps: RoutineStep[]) =>
    steps.length ? `<h2>${escapeHtml(title)}</h2>${stepRowsHtml(steps, week)}` : "";
  const extras = (routine.extras ?? []).map((b) => section(b.name, b.steps)).join("");

  const tags = (items: { label: string; emoji: string }[], cls: string) =>
    `<div class="tags">${items
      .map((it) => `<span class="tag ${cls}">${escapeHtml(it.emoji)} ${escapeHtml(it.label)}</span>`)
      .join("")}</div>`;
  const tips = (items: { text: string; emoji: string }[]) =>
    `<ul class="tips">${items
      .map((it) => `<li>${escapeHtml(it.emoji)} ${escapeHtml(it.text)}</li>`)
      .join("")}</ul>`;

  const advice = [
    toEat.length || toAvoid.length
      ? `<div class="advice"><h3>Alimentation</h3>${toEat.length ? `<p class="sub good">À privilégier</p>${tags(toEat, "good")}` : ""}${toAvoid.length ? `<p class="sub bad">À éviter</p>${tags(toAvoid, "bad")}` : ""}</div>`
      : "",
    suppTake.length || suppAvoid.length
      ? `<div class="advice"><h3>Compléments alimentaires</h3>${suppTake.length ? `<p class="sub good">À privilégier</p>${tags(suppTake, "good")}` : ""}${suppAvoid.length ? `<p class="sub bad">À éviter</p>${tags(suppAvoid, "bad")}` : ""}</div>`
      : "",
    lifestyle.length ? `<div class="advice"><h3>Hygiène de vie</h3>${tips(lifestyle)}</div>` : "",
    reminders.length ? `<div class="advice"><h3>À savoir</h3>${tips(reminders)}</div>` : "",
  ].join("");
  const adviceSection = advice
    ? `<h2>Conseils &amp; hygiène de vie</h2><div class="conseils">${advice}</div>`
    : "";

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
    <title>Ma routine — ${escapeHtml(name)}</title>
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #2b2420; margin: 0; padding: 32px; }
      .head { border-radius: 16px; background: linear-gradient(135deg, #fbe7d6, #f5d3bd); padding: 20px 24px; margin-bottom: 22px; }
      .head .k { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #b5613c; font-weight: 700; }
      .head h1 { font-size: 28px; margin: 4px 0 2px; }
      .head p { margin: 0; color: #6b5a4d; font-size: 13px; font-weight: 600; }
      h2 { font-size: 15px; margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #c4724b; color: #b5613c; }
      .step { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0e9e2; page-break-inside: avoid; }
      .step img, .step .ph { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; flex: none; background: #f4ece4; }
      .step .ph { display: flex; align-items: center; justify-content: center; font-weight: 700; color: #c9b7a5; font-size: 18px; }
      .cat { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #a08b7a; font-weight: 600; }
      .name { font-size: 14px; font-weight: 700; margin: 3px 0; }
      .brand { font-weight: 400; color: #a08b7a; }
      .freq { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 5px 0; }
      .strip { display: flex; gap: 3px; }
      .day { width: 19px; height: 19px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; background: #efe6dc; color: #c2ab98; }
      .day.on { background: #c4724b; color: #fff; }
      .chip { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 2px 9px; display: inline-block; }
      .chip.freq { background: #f6e9e1; color: #b5613c; }
      .chip.amt { background: #fbeecb; color: #a9791a; }
      .amt-img { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; vertical-align: middle; margin-left: 4px; }
      .instr { font-size: 12px; color: #514a43; line-height: 1.5; margin: 5px 0 0; }
      .why { font-size: 11px; color: #6b5a4d; background: #faf1ea; border-radius: 8px; padding: 6px 9px; margin: 5px 0 0; }
      .wait { text-align: center; font-size: 11px; font-weight: 600; color: #b5613c; margin: 2px 0; }
      .conseils { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .advice { break-inside: avoid; border: 1px solid #f0e9e2; border-radius: 12px; padding: 12px 14px; }
      .advice h3 { font-size: 13px; margin: 0 0 4px; }
      .sub { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; margin: 8px 0 4px; }
      .sub.good { color: #2f9e6f; }
      .sub.bad { color: #d64545; }
      .tags { display: flex; flex-wrap: wrap; gap: 5px; }
      .tag { font-size: 11px; border-radius: 999px; padding: 2px 9px; }
      .tag.good { background: #e7f5ee; color: #217a53; }
      .tag.bad { background: #fbeaea; color: #b03636; }
      .tips { margin: 2px 0 0; padding-left: 16px; }
      .tips li { font-size: 12px; color: #514a43; line-height: 1.5; margin: 2px 0; }
      .soon { font-size: 12px; color: #b5613c; font-weight: 600; margin: 5px 0; }
      @media print { body { padding: 0; } }
    </style></head>
    <body>
      <div class="head">
        <p class="k">Protocole Clear · Ma routine</p>
        <h1>${escapeHtml(name)}</h1>
        <p>Semaine ${week}${phase ? ` · ${escapeHtml(phase)}` : ""}</p>
      </div>
      ${section("Matin", routine.am)}
      ${section("Soir", routine.pm)}
      ${extras}
      ${adviceSection}
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Autorise les pop-ups pour télécharger le PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => setTimeout(() => w.print(), 300);
}

// ── Lecteur vidéo ───────────────────────────────────────────────────────────
function VideoEmbed({ url }: { url: string }) {
  const u = safeHttpUrl(url);
  if (!u) return null;
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(u)) {
    return (
      <video controls playsInline className="aspect-video w-full rounded-2xl border border-border bg-black">
        <source src={u} />
      </video>
    );
  }
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  const vimeo = u.match(/vimeo\.com\/(\d+)/);
  const embed = yt
    ? `https://www.youtube.com/embed/${yt[1]}`
    : vimeo
      ? `https://player.vimeo.com/video/${vimeo[1]}`
      : null;
  if (embed) {
    return (
      <iframe
        src={embed}
        title="Vidéo d'application"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-2xl border border-border"
      />
    );
  }
  return (
    <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
      <PlayCircle className="h-4 w-4" /> Voir la vidéo d'application
    </a>
  );
}

// ── Carte d'une étape ─────────────────────────────────────────────────────────
// Deux zones : contenu (gauche) + panneau fréquence/quantité (droite, motion/visuel).
function StepCard({
  step,
  index,
  checked,
  currentWeek,
  onToggle,
  showCheck = true,
}: {
  step: RoutineStep;
  index: number;
  checked: boolean;
  currentWeek: number;
  onToggle: () => void;
  showCheck?: boolean;
}) {
  const phase = activePhase(step.schedule, currentWeek);
  const soon = nextPhase(step.schedule, currentWeek);
  const introWeek = firstWeek(step.schedule) ?? step.startWeek ?? null;
  const upcoming = introWeek != null && introWeek > currentWeek;
  const buyUrl = safeHttpUrl(step.purchaseLinks?.[0]?.url ?? step.purchaseUrl);
  const fact = didYouKnow(step.category, step.product);
  // Eau / hydratation : icône plutôt qu'une image (souvent absente → bloc vide).
  const isWater = /\beau\b|hydrat|water/i.test(`${step.product} ${step.category}`);
  const [imgError, setImgError] = useState(false);
  const showImg = !!step.imageUrl && !imgError;

  return (
    <div
      className={`overflow-hidden rounded-3xl border bg-card shadow-soft ${
        upcoming ? "border-dashed border-primary/40" : "border-border/60"
      }`}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Contenu (gauche) */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted sm:h-24 sm:w-24">
              {showImg ? (
                <img
                  src={step.imageUrl}
                  alt={step.product}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : isWater ? (
                <div className="flex h-full w-full items-center justify-center text-primary/70">
                  <Droplet className="h-9 w-9" />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-muted-foreground/40">
                  {index}
                </div>
              )}
              <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-[10px] font-bold text-primary shadow-sm">
                {index}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {step.category}
              </span>
              <p className="mt-1.5 font-display text-base font-semibold leading-tight">{step.product}</p>
              {step.brand && <p className="text-xs text-muted-foreground">{step.brand}</p>}
            </div>
            {showCheck && !upcoming && (
              <button
                onClick={onToggle}
                aria-label={checked ? "Décocher" : "Cocher"}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  checked
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-border bg-background text-transparent hover:border-primary"
                }`}
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {/* Pour un produit "à venir" : on affiche quand même le "pourquoi" et
                surtout le bouton acheter — le client doit pouvoir commander en avance. */}
            {upcoming ? (
              <p className="flex items-start gap-2 rounded-2xl bg-primary-soft/50 px-3 py-2 text-xs font-medium leading-relaxed text-primary">
                <ShoppingCart className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Commande-le dès maintenant pour l'avoir prêt le moment venu.
              </p>
            ) : (
              <>
                {step.instructions && (
                  <p className="text-sm leading-relaxed text-foreground/80">{step.instructions}</p>
                )}
                {step.introNote && (
                  <p className="flex items-start gap-2 rounded-2xl bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {step.introNote}
                  </p>
                )}
              </>
            )}
            {step.whyThisProduct && (
              <div className="rounded-2xl bg-primary-soft/40 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Pourquoi ce produit</p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground/75">{step.whyThisProduct}</p>
              </div>
            )}
            {buyUrl && (
              <a
                href={buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                <ShoppingCart className="h-4 w-4" /> Acheter
              </a>
            )}
            {!upcoming && fact && (
              <details className="rounded-2xl bg-muted/40 px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-primary">
                  <Lightbulb className="h-3.5 w-3.5" /> Le savais-tu ?
                </summary>
                <p className="mt-1.5 text-xs leading-relaxed text-foreground/75">{fact}</p>
              </details>
            )}
          </div>
        </div>

        {/* Panneau fréquence / quantité / vidéo (droite) */}
        <div className="shrink-0 border-t border-border/50 bg-muted/20 p-4 sm:w-72 sm:border-l sm:border-t-0">
          {upcoming ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Sparkles className="h-5 w-5" />
              <p className="text-sm font-medium">À introduire dès la semaine {introWeek}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fréquence</p>
                {phase ? (
                  <WeekStrip phase={phase} />
                ) : step.frequency ? (
                  <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                    {step.frequency}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
                {soon && (
                  <p className="mt-2 rounded-lg bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">
                    ⤴ Dès la S{soon.fromWeek} : {describePhase(soon)}
                  </p>
                )}
              </div>
              {(step.amountImageUrl || step.amountPreset || step.amount) && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quantité</p>
                  {step.amountImageUrl ? (
                    <img
                      src={step.amountImageUrl}
                      alt="Quantité"
                      className="h-24 w-24 rounded-xl border border-border object-cover"
                    />
                  ) : step.amountPreset ? (
                    <QuantityVisual preset={step.amountPreset} />
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      {step.amount}
                    </span>
                  )}
                </div>
              )}
              {/* Vidéo : seulement si renseignée (sinon rien) + légende "comment appliquer" par-dessus. */}
              {safeHttpUrl(step.videoUrl) && (
                <div className="relative">
                  <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white">
                    🎬 Comment appliquer
                  </span>
                  <VideoEmbed url={step.videoUrl!} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bloc Matin / Soir / Extra ─────────────────────────────────────────────────
function RoutineSection({
  title,
  icon: Icon,
  accent,
  steps,
  checked,
  currentWeek,
  onToggle,
  trackable = true,
}: {
  title: string;
  icon: typeof Sun;
  accent: string;
  steps: RoutineStep[];
  checked: string[];
  currentWeek: number;
  onToggle: (id: string) => void;
  trackable?: boolean;
}) {
  if (steps.length === 0) return null;
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  const active = ordered.filter((s) => {
    const iw = firstWeek(s.schedule) ?? s.startWeek ?? null;
    return iw == null || iw <= currentWeek;
  });
  const doneCount = active.filter((s) => checked.includes(s.id)).length;

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${accent}`}>
          <Icon className="h-5 w-5 text-foreground/70" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          {trackable && (
            <p className="text-xs text-muted-foreground">
              {doneCount}/{active.length} fait{doneCount > 1 ? "s" : ""} aujourd'hui
            </p>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {ordered.map((step, i) => (
          <Fragment key={step.id}>
            <StepCard
              step={step}
              index={i + 1}
              checked={checked.includes(step.id)}
              currentWeek={currentWeek}
              onToggle={() => onToggle(step.id)}
              showCheck={trackable}
            />
            {step.waitAfter && i < ordered.length - 1 && (
              <div className="flex items-center justify-center gap-2" aria-label={`Attendre : ${step.waitAfter}`}>
                <span className="h-px w-6 bg-primary/30" />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
                  <Clock className="h-3.5 w-3.5 shrink-0" /> {step.waitAfter}
                </span>
                <span className="h-px w-6 bg-primary/30" />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

// ── Carte conseil (rail) ──────────────────────────────────────────────────────
function RailCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Salad;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {children}
    </div>
  );
}

function TipList({ items }: { items: TipItem[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((t) => (
        <li key={t.id} className="flex items-start gap-2.5 text-sm text-foreground/80">
          <span className="shrink-0 text-base leading-none">{t.emoji}</span>
          <span className="leading-snug">{t.text}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function MaRoutinePage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { as } = Route.useSearch();
  const navigate = useNavigate();
  // Aperçu admin : on lit la routine d'un autre élève (uid `as`), en lecture seule.
  const previewUid = isAdmin && as && as !== user?.uid ? as : null;
  const targetUid = previewUid ?? user?.uid ?? null;
  const [previewName, setPreviewName] = useState<string>("");
  const [routine, setRoutine] = useState<UserRoutine | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAm, setCheckedAm] = useState<string[]>([]);
  const [checkedPm, setCheckedPm] = useState<string[]>([]);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [toEat, setToEat] = useState<NutritionItem[]>([]);
  const [toAvoid, setToAvoid] = useState<NutritionItem[]>([]);
  const [suppTake, setSuppTake] = useState<Supplement[]>([]);
  const [suppAvoid, setSuppAvoid] = useState<Supplement[]>([]);
  const [lifestyle, setLifestyle] = useState<TipItem[]>([]);
  const [reminders, setReminders] = useState<TipItem[]>([]);
  const [coachPhrase, setCoachPhrase] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!targetUid) return;
    setLoading(true);
    setRoutine(null);
    const todayKey = new Date().toISOString().slice(0, 10);

    // Routine en écoute live : une modif publiée par le coach s'affiche sans
    // recharger la page (et met à jour l'onglet déjà ouvert de l'élève).
    const unsubRoutine = onSnapshot(doc(db, "routines", targetUid), (snap) => {
      setRoutine(snap.exists() ? (snap.data() as UserRoutine) : null);
    });

    // Le reste change rarement pendant la session → lecture ponctuelle.
    Promise.allSettled([
      getDoc(doc(db, "routine_checkins", targetUid, "days", todayKey)),
      getDoc(doc(db, "users", targetUid)),
      getDoc(doc(db, "config", "nutrition")),
      getDoc(doc(db, "config", "reminders")),
      getDoc(doc(db, "admin_skin_state", targetUid)),
    ]).then(([checkinRes, userRes, nutritionRes, remindersRes, skinRes]) => {
      if (checkinRes.status === "fulfilled" && checkinRes.value.exists()) {
        setCheckedAm(checkinRes.value.data().am ?? []);
        setCheckedPm(checkinRes.value.data().pm ?? []);
      }
      if (userRes.status === "fulfilled" && userRes.value.exists()) {
        const d = userRes.value.data();
        setStartTs((d.routineStartedAt ?? d.enrolledAt) ?? null);
        setPreviewName(d.displayName ?? d.email ?? "");
      }
      if (nutritionRes.status === "fulfilled" && nutritionRes.value.exists()) {
        const d = nutritionRes.value.data();
        setToEat(d.toEat ?? []);
        setToAvoid(d.toAvoid ?? []);
        setSuppTake(d.supplementsToTake ?? d.supplements ?? []);
        setSuppAvoid(d.supplementsToAvoid ?? []);
        setLifestyle(d.lifestyle ?? []);
      }
      if (remindersRes.status === "fulfilled" && remindersRes.value.exists())
        setReminders(remindersRes.value.data().items ?? []);
      if (skinRes.status === "fulfilled" && skinRes.value.exists())
        setCoachPhrase(skinRes.value.data().coachPhrase ?? "");
      setLoading(false);
    });

    return () => unsubRoutine();
  }, [targetUid]);

  async function toggleStep(session: "am" | "pm", stepId: string) {
    if (!user || previewUid) return; // aperçu admin : lecture seule
    const current = session === "am" ? checkedAm : checkedPm;
    const updated = current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId];
    if (session === "am") setCheckedAm(updated);
    else setCheckedPm(updated);
    const key = new Date().toISOString().slice(0, 10);
    const newAm = session === "am" ? updated : checkedAm;
    const newPm = session === "pm" ? updated : checkedPm;
    try {
      await setDoc(doc(db, "routine_checkins", user.uid, "days", key), { am: newAm, pm: newPm }, { merge: true });
    } catch {
      toast.error("Impossible de sauvegarder. Réessaie.");
    }
  }

  if (authLoading || !user) return null;

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!routine || routine.status !== "sent") {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-6 pb-24 pt-12">
          <div className="rounded-3xl border border-border/60 bg-card p-8 text-center shadow-soft md:p-12">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-semibold">Ta routine est en préparation</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Ton coach analyse ton profil et prépare une routine sur-mesure. Tu recevras un e-mail dès qu'elle est prête.
            </p>
          </div>
        </main>
      </AppShell>
    );
  }

  const currentWeek = startTs ? currentProtocolWeek(startTs) : 1;
  const phases = routine.phases?.length ? routine.phases : defaultPhases();
  const currentPhase = phases.find((p) => currentWeek >= p.fromWeek && currentWeek <= p.toWeek) ?? phases[0];
  const phaseName = currentPhase ? currentPhase.title || phaseLabel(currentPhase.fromWeek, currentPhase.toWeek) : "";
  const hasConseils =
    toEat.length > 0 || toAvoid.length > 0 || suppTake.length > 0 || suppAvoid.length > 0 || lifestyle.length > 0 || reminders.length > 0;

  return (
    <AppShell>
      {/* Conteneur aligné sur le menu (AppShell : max-w-7xl px-6) */}
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pt-10">
        {previewUid && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            <Eye className="h-4 w-4 shrink-0" />
            <span>
              Aperçu élève — tu vois la routine de <strong>{previewName || "cet élève"}</strong>, en lecture seule.
            </span>
          </div>
        )}
        {/* Hero */}
        <header className="mb-8 overflow-hidden rounded-3xl bg-gradient-warm p-6 shadow-elegant sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50">Ma Routine</p>
              <h1 className="mt-1 font-display text-3xl font-semibold leading-tight sm:text-4xl">Semaine {currentWeek}</h1>
              {phaseName && <p className="mt-1 text-sm font-medium text-foreground/70">{phaseName}</p>}
            </div>
            <button
              onClick={() =>
                printRoutine({
                  name: user.displayName ?? user.email?.split("@")[0] ?? "",
                  week: currentWeek,
                  phase: phaseName,
                  routine,
                  toEat,
                  toAvoid,
                  suppTake,
                  suppAvoid,
                  lifestyle,
                  reminders,
                })
              }
              className="flex shrink-0 items-center gap-2 rounded-full bg-background/60 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-background/80"
            >
              <Printer className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/70">
            Suis chaque étape dans l'ordre. La fréquence évolue au fil des semaines — réfère-toi à la frise du jour.
          </p>
        </header>

        {/* Routine (gauche, Matin puis Soir empilés) + Conseils (droite) */}
        <div className={hasConseils ? "lg:grid lg:grid-cols-3 lg:gap-8" : ""}>
          <div className={`space-y-10 ${hasConseils ? "lg:col-span-2" : ""}`}>
            {(() => {
              const g = weeklyGuidance(currentWeek);
              return (
                <section className="rounded-3xl border border-primary/20 bg-primary-soft/30 p-5 sm:p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                    Cette semaine · Semaine {currentWeek}
                  </p>
                  <h2 className="mt-1 font-display text-xl font-semibold">{g.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">{g.body}</p>
                  {coachPhrase && (
                    <p className="mt-3 border-l-2 border-primary/50 pl-3 text-sm italic text-foreground/75">
                      « {coachPhrase} »{" "}
                      <span className="text-xs not-italic text-muted-foreground">— ton coach</span>
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                    <span>Comprendre :</span>
                    <GlossaryTerm term="purge" />
                    <GlossaryTerm term="barrière cutanée" />
                    <GlossaryTerm term="actif" />
                    <GlossaryTerm term="titration" />
                  </div>
                </section>
              );
            })()}
            <RoutineSection
              title="Matin" icon={Sun} accent="from-amber-200/70 to-primary-soft"
              steps={routine.am} checked={checkedAm} currentWeek={currentWeek}
              onToggle={(id) => toggleStep("am", id)} trackable={!previewUid}
            />
            {routine.am.length > 0 && routine.pm.length > 0 && (
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <RoutineSection
              title="Soir" icon={Moon} accent="from-indigo-200/60 to-primary-soft"
              steps={routine.pm} checked={checkedPm} currentWeek={currentWeek}
              onToggle={(id) => toggleStep("pm", id)} trackable={!previewUid}
            />
            {(routine.extras ?? []).map((block) => (
              <RoutineSection
                key={block.id} title={block.name} icon={Sparkles}
                accent="from-primary-muted/50 to-primary-soft/70"
                steps={block.steps} checked={[]} currentWeek={currentWeek}
                onToggle={() => {}} trackable={false}
              />
            ))}
          </div>

          {hasConseils && (
            <aside className="mt-10 space-y-5 lg:mt-0 lg:self-start">
              {(toEat.length > 0 || toAvoid.length > 0) && (
                <RailCard icon={Salad} title="Alimentation">
                  {toEat.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Leaf className="h-3.5 w-3.5" /> À privilégier
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {toEat.map((it) => (
                          <span key={it.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <span>{it.emoji}</span> {it.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {toAvoid.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                        <Ban className="h-3.5 w-3.5" /> À éviter
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {toAvoid.map((it) => (
                          <span key={it.id} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-300">
                            <span>{it.emoji}</span> {it.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </RailCard>
              )}

              {(suppTake.length > 0 || suppAvoid.length > 0) && (
                <RailCard icon={Pill} title="Compléments alimentaires">
                  {suppTake.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Leaf className="h-3.5 w-3.5" /> À privilégier
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {suppTake.map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <span>{s.emoji}</span> {s.label}{s.dosage ? ` · ${s.dosage}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {suppAvoid.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                        <Ban className="h-3.5 w-3.5" /> À éviter
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {suppAvoid.map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-300">
                            <span>{s.emoji}</span> {s.label}{s.dosage ? ` · ${s.dosage}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </RailCard>
              )}

              {lifestyle.length > 0 && (
                <RailCard icon={HeartPulse} title="Hygiène de vie">
                  <TipList items={lifestyle} />
                </RailCard>
              )}

              {reminders.length > 0 && (
                <RailCard icon={Lightbulb} title="À savoir">
                  <TipList items={reminders} />
                </RailCard>
              )}
            </aside>
          )}
        </div>
      </main>
    </AppShell>
  );
}
