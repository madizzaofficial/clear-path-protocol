import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Link2, Plus, Scissors, Trash2 } from "lucide-react";
import type { RoutineStep } from "@/components/RoutineStepEditor";
import {
  defaultPhases,
  mergeWithNext,
  phaseLabel,
  resequence,
  splitPhase,
  stepsStartingInPhase,
  type RoutinePhase,
} from "@/lib/routine-phases";

/** Éditeur du parcours d'un élève : découpage en phases (Semaine 1,
 *  Semaines 2-3, …) avec un titre et une description par phase. */
export function PhaseEditor({
  phases,
  am,
  pm,
  onChange,
}: {
  phases: RoutinePhase[] | undefined;
  am: RoutineStep[];
  pm: RoutineStep[];
  onChange: (phases: RoutinePhase[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const list = phases?.length ? phases : defaultPhases();

  function update(i: number, patch: Partial<RoutinePhase>) {
    onChange(list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  function addPhase() {
    const last = list[list.length - 1];
    const from = last ? last.toWeek + 1 : 1;
    onChange([
      ...list,
      {
        id: `p${Date.now().toString(36)}`,
        fromWeek: from,
        toWeek: from,
        title: phaseLabel(from, from),
        description: "",
      },
    ]);
  }

  function removePhase(i: number) {
    onChange(resequence(list.filter((_, j) => j !== i)));
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <CalendarDays className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Parcours de l'élève</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {list.length} phase{list.length > 1 ? "s" : ""} · {list[list.length - 1]?.toWeek ?? 0}{" "}
          semaines
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 p-5">
          <p className="text-xs text-muted-foreground">
            Regroupe les semaines comme tu veux (Semaine 1, puis Semaines 2-3…) et décris chaque
            phase. Les étapes s'activent toujours selon leur semaine de départ.
          </p>

          {list.map((phase, i) => {
            const starting = [
              ...stepsStartingInPhase(am, phase),
              ...stepsStartingInPhase(pm, phase),
            ];
            const isMulti = phase.toWeek > phase.fromWeek;
            return (
              <div key={phase.id} className="rounded-2xl border border-border/60 bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                    {phaseLabel(phase.fromWeek, phase.toWeek)}
                  </span>

                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Durée
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={phase.toWeek - phase.fromWeek + 1}
                      onChange={(e) => {
                        const span = Math.max(1, Math.min(12, Number(e.target.value) || 1));
                        const updated = list.map((p, j) =>
                          j === i ? { ...p, toWeek: p.fromWeek + span - 1 } : p,
                        );
                        onChange(resequence(updated));
                      }}
                      className="w-14 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                    />
                    sem.
                  </label>

                  <div className="ml-auto flex items-center gap-1">
                    {i < list.length - 1 && (
                      <button
                        onClick={() => onChange(mergeWithNext(list, i))}
                        title="Fusionner avec la phase suivante"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isMulti && (
                      <button
                        onClick={() => onChange(splitPhase(list, i))}
                        title="Diviser cette phase en deux"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Scissors className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => removePhase(i)}
                      title="Supprimer cette phase"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  value={phase.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder={phaseLabel(phase.fromWeek, phase.toWeek)}
                  className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <textarea
                  value={phase.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  placeholder="Ce que l'élève doit retenir de cette phase…"
                  rows={2}
                  className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />

                {starting.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {starting.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      >
                        ✨ {s.product}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={addPhase}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Ajouter une phase
          </button>
        </div>
      )}
    </div>
  );
}
