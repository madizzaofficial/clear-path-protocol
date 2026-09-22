/**
 * Modèle de fréquence "à paliers" : une étape de routine peut évoluer semaine
 * après semaine (titration). Partagé par l'éditeur (admin), la page /ma-routine
 * et le seed. Jours : 0 = Lundi … 6 = Dimanche. days=[] ou 7 jours = tous les jours.
 */

export type Moment = "am" | "pm" | "both";

export type FreqPhase = {
  fromWeek: number; // à partir de cette semaine de protocole
  days: number[]; // 0=Lun … 6=Dim ; [] ou 7 entrées = tous les jours
  moment: Moment;
  note?: string; // ex. "si bien toléré"
};

export const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
export const DAY_LABELS_FULL = [
  "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche",
];

export function isDaily(days: number[]): boolean {
  return days.length === 0 || days.length >= 7;
}

/** Jours normalisés (tous les jours → 0..6), triés. */
export function phaseDays(p: FreqPhase): number[] {
  return isDaily(p.days) ? [0, 1, 2, 3, 4, 5, 6] : [...p.days].sort((a, b) => a - b);
}

/** Palier actif pour une semaine = dernier palier dont fromWeek <= week (null si pas encore introduit). */
export function activePhase(schedule: FreqPhase[] | undefined, week: number): FreqPhase | null {
  if (!schedule?.length) return null;
  let active: FreqPhase | null = null;
  for (const p of [...schedule].sort((a, b) => a.fromWeek - b.fromWeek)) {
    if (week >= p.fromWeek) active = p;
  }
  return active;
}

/** Prochain palier à venir après la semaine donnée (null si aucun). */
export function nextPhase(schedule: FreqPhase[] | undefined, week: number): FreqPhase | null {
  if (!schedule?.length) return null;
  return [...schedule].sort((a, b) => a.fromWeek - b.fromWeek).find((p) => p.fromWeek > week) ?? null;
}

/** Première semaine où l'étape apparaît (pour l'instauration progressive). */
export function firstWeek(schedule: FreqPhase[] | undefined): number | null {
  if (!schedule?.length) return null;
  return Math.min(...schedule.map((p) => p.fromWeek));
}

export function momentLabel(m: Moment): string {
  return m === "am" ? "le matin" : m === "pm" ? "le soir" : "matin & soir";
}

export function freqLabel(p: FreqPhase): string {
  const n = phaseDays(p).length;
  return isDaily(p.days) ? "Tous les jours" : n === 1 ? "1×/semaine" : `${n}×/semaine`;
}

export function describePhase(p: FreqPhase): string {
  return `${freqLabel(p).toLowerCase()} ${momentLabel(p.moment)}`;
}

/** Répartit N applications sur la semaine, jours espacés : 1→L, 2→L·J, 3→L·Me·V… */
export function spreadDays(n: number): number[] {
  if (n <= 0) return [];
  if (n >= 7) return [0, 1, 2, 3, 4, 5, 6];
  const step = 7 / n;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.round(i * step) % 7);
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Assistant titration : génère les paliers d'une montée régulière. */
export function buildTitration(opts: {
  startWeek: number;
  startTimes: number; // applications/semaine au départ
  increment: number; // +N applications à chaque palier
  intervalWeeks: number; // tous les X semaines
  maxTimes: number; // plafond d'applications/semaine
  moment: Moment;
}): FreqPhase[] {
  const phases: FreqPhase[] = [];
  let times = Math.max(1, opts.startTimes);
  let week = opts.startWeek;
  for (let guard = 0; guard < 20; guard++) {
    phases.push({ fromWeek: week, days: spreadDays(times), moment: opts.moment });
    if (times >= opts.maxTimes) break;
    times = Math.min(times + opts.increment, opts.maxTimes);
    week += opts.intervalWeeks;
  }
  return phases;
}

// ── Quantité : bibliothèque préréglée ─────────────────────────────────────────

export type QtyPreset = { key: string; label: string };

export const QTY_PRESETS: QtyPreset[] = [
  { key: "noisette", label: "Noisette" },
  { key: "grosse-noisette", label: "Grosse noisette" },
  { key: "2-3-gouttes", label: "2–3 gouttes" },
  { key: "4-5-gouttes", label: "4–5 gouttes" },
  { key: "1-pression", label: "1 pression" },
  { key: "2-pressions", label: "2 pressions" },
  { key: "couche-fine", label: "Couche fine" },
  { key: "couche-genereuse", label: "Couche généreuse" },
  { key: "2-doigts", label: "2 doigts (règle SPF)" },
];

export function qtyLabel(key?: string): string {
  return QTY_PRESETS.find((p) => p.key === key)?.label ?? "";
}
