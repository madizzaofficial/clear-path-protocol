/**
 * Frise de semaine pour un palier de fréquence : 7 jours (L→D), jours actifs
 * en couleur, + le moment (matin / soir / matin & soir).
 */
import { Sun, Moon } from "lucide-react";
import { DAY_LABELS, phaseDays, freqLabel, type FreqPhase } from "@/lib/routine-schedule";

export function WeekStrip({ phase }: { phase: FreqPhase }) {
  const active = new Set(phaseDays(phase));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {DAY_LABELS.map((d, i) => {
            const on = active.has(i);
            return (
              <span
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold ${
                  on
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground/50"
                }`}
              >
                {d}
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 font-semibold text-primary">
          {freqLabel(phase)}
        </span>
        <span className="inline-flex items-center gap-1">
          {phase.moment !== "pm" && <Sun className="h-3.5 w-3.5 text-amber-500" />}
          {phase.moment !== "am" && <Moon className="h-3.5 w-3.5 text-indigo-400" />}
          {phase.moment === "am" ? "Matin" : phase.moment === "pm" ? "Soir" : "Matin & soir"}
        </span>
      </div>
      {phase.note && (
        <p className="text-xs italic text-muted-foreground">{phase.note}</p>
      )}
    </div>
  );
}
