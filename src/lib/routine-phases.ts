import type { RoutineStep } from "@/components/RoutineStepEditor";

/** Une phase du parcours : un groupe de semaines contigu, avec un titre et une
 *  description propres à l'élève. Ex. « Semaine 1 », puis « Semaines 2-3 ».
 *  Les étapes gardent leur `startWeek` — les phases ne changent pas
 *  l'activation, elles regroupent et racontent. */
export type RoutinePhase = {
  id: string;
  fromWeek: number;
  toWeek: number;
  title: string;
  description: string;
};

export const DEFAULT_PHASE_COUNT = 12;

/** Un titre est « automatique » s'il a la forme d'un libellé généré
 *  (« Semaine 3 », « Semaines 2-3 ») ou s'il est vide. On teste la *forme*,
 *  pas l'égalité avec les bornes courantes : sinon un titre auto devenu
 *  périmé après un décalage serait pris pour un titre personnalisé et figé,
 *  laissant l'élève lire « Semaines 1-2 » sur une phase allant de 1 à 3. */
export function isAutoTitle(title: string): boolean {
  return title.trim() === "" || /^Semaines?\s+\d+(\s*-\s*\d+)?$/i.test(title.trim());
}

/** Libellé par défaut d'une phase, dérivé de ses bornes. */
export function phaseLabel(fromWeek: number, toWeek: number): string {
  return fromWeek === toWeek ? `Semaine ${fromWeek}` : `Semaines ${fromWeek}-${toWeek}`;
}

/** Parcours par défaut : 12 semaines individuelles, sans description.
 *  Utilisé quand un élève n'a pas encore de parcours personnalisé. */
export function defaultPhases(count: number = DEFAULT_PHASE_COUNT): RoutinePhase[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `w${i + 1}`,
    fromWeek: i + 1,
    toWeek: i + 1,
    title: phaseLabel(i + 1, i + 1),
    description: "",
  }));
}

/** Bornes en jours d'une phase, comptées depuis le début du protocole
 *  (jour 1 = premier jour). Semaine N couvre les jours (N-1)*7+1 → N*7.
 *  `isLast` étend la dernière phase à l'infini : un élève qui dépasse la durée
 *  prévue doit rester sur la dernière phase plutôt que de n'en avoir aucune. */
export function phaseDayRange(
  phase: RoutinePhase,
  isLast: boolean,
): { dayStart: number; dayEnd: number } {
  return {
    dayStart: (phase.fromWeek - 1) * 7 + 1,
    dayEnd: isLast ? Infinity : phase.toWeek * 7,
  };
}

/** Phase en cours au jour `dayCount` du protocole (1 = premier jour).
 *  C'est ce qui fait avancer « Phase actuelle » tout seul avec la date. */
export function phaseForDay(phases: RoutinePhase[], dayCount: number): RoutinePhase | undefined {
  if (phases.length === 0) return undefined;
  const found = phases.find((p, i) => {
    const { dayStart, dayEnd } = phaseDayRange(p, i === phases.length - 1);
    return dayCount >= dayStart && dayCount <= dayEnd;
  });
  return found ?? phases[phases.length - 1];
}

/** Phase contenant une semaine donnée, ou undefined hors parcours. */
export function phaseForWeek(phases: RoutinePhase[], week: number): RoutinePhase | undefined {
  return phases.find((p) => week >= p.fromWeek && week <= p.toWeek);
}

/** Dernière semaine couverte par le parcours (1 si vide). */
export function lastWeek(phases: RoutinePhase[]): number {
  return phases.reduce((max, p) => Math.max(max, p.toWeek), 1);
}

/** Étapes qui démarrent pendant cette phase — ce que l'élève découvre. */
export function stepsStartingInPhase(steps: RoutineStep[], phase: RoutinePhase): RoutineStep[] {
  return steps.filter((s) => {
    const w = s.startWeek ?? 1;
    return w >= phase.fromWeek && w <= phase.toWeek;
  });
}

/** Re-séquence les phases pour qu'elles soient contiguës à partir de la
 *  semaine 1, en conservant la durée de chacune. Appelé après ajout,
 *  suppression, fusion ou division — pour qu'il n'y ait jamais ni trou ni
 *  chevauchement dans le parcours d'un élève.
 *  Les titres laissés au libellé automatique sont recalculés ; les titres
 *  personnalisés sont préservés. */
export function resequence(phases: RoutinePhase[]): RoutinePhase[] {
  let cursor = 1;
  return phases.map((p) => {
    const span = Math.max(1, p.toWeek - p.fromWeek + 1);
    const fromWeek = cursor;
    const toWeek = cursor + span - 1;
    cursor = toWeek + 1;
    const wasAutoTitle = isAutoTitle(p.title);
    return {
      ...p,
      fromWeek,
      toWeek,
      title: wasAutoTitle ? phaseLabel(fromWeek, toWeek) : p.title,
    };
  });
}

/** Fusionne la phase d'index `i` avec la suivante. */
export function mergeWithNext(phases: RoutinePhase[], i: number): RoutinePhase[] {
  if (i < 0 || i >= phases.length - 1) return phases;
  const a = phases[i];
  const b = phases[i + 1];
  const merged: RoutinePhase = {
    ...a,
    toWeek: b.toWeek,
    title: isAutoTitle(a.title) ? phaseLabel(a.fromWeek, b.toWeek) : a.title,
    // On garde les deux descriptions plutôt que d'en perdre une silencieusement.
    description: [a.description, b.description].filter(Boolean).join("\n\n"),
  };
  return resequence([...phases.slice(0, i), merged, ...phases.slice(i + 2)]);
}

/** Coupe une phase de plusieurs semaines en deux phases. */
export function splitPhase(phases: RoutinePhase[], i: number): RoutinePhase[] {
  const p = phases[i];
  if (!p || p.toWeek <= p.fromWeek) return phases;
  const mid = Math.floor((p.fromWeek + p.toWeek) / 2);
  const first: RoutinePhase = {
    ...p,
    toWeek: mid,
    title: isAutoTitle(p.title) ? phaseLabel(p.fromWeek, mid) : p.title,
  };
  const second: RoutinePhase = {
    id: `${p.id}-b${Date.now().toString(36)}`,
    fromWeek: mid + 1,
    toWeek: p.toWeek,
    title: phaseLabel(mid + 1, p.toWeek),
    description: "",
  };
  return resequence([...phases.slice(0, i), first, second, ...phases.slice(i + 1)]);
}
