import type { RoutineStep } from "@/components/RoutineStepEditor";

/** Retourne la semaine courante du protocole depuis la date de début réelle de la routine.
 *  Utilise routineStartedAt en priorité, sinon enrolledAt comme fallback. */
export function currentProtocolWeek(routineStartedAt: number): number {
  const ms = Date.now() - routineStartedAt;
  return Math.min(Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000))), 12);
}

export function stepsForWeek(steps: RoutineStep[], week: number): RoutineStep[] {
  return steps.filter((s) => (s.startWeek ?? 1) <= week);
}

export function isNewThisWeek(step: RoutineStep, week: number): boolean {
  return (step.startWeek ?? 1) === week;
}
