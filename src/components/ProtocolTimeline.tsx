/**
 * Barre chronologique du parcours d'un élève : où il en est dans le protocole
 * (semaines → mois, phases, position actuelle). Deux variantes :
 *  - compact : mini-barre pour la liste du dashboard (vue d'ensemble).
 *  - complète : segments de phases + marqueur + axe en mois (fiche élève).
 */
import { currentProtocolWeek } from "@/lib/routine-week";
import { defaultPhases, type RoutinePhase } from "@/lib/routine-phases";

export function ProtocolTimeline({
  startTs,
  phases,
  compact = false,
}: {
  startTs: number | null;
  phases?: RoutinePhase[];
  compact?: boolean;
}) {
  const ph = phases?.length ? [...phases].sort((a, b) => a.fromWeek - b.fromWeek) : defaultPhases();
  const maxWeek = Math.max(...ph.map((p) => p.toWeek), 12);
  const week = startTs ? Math.min(currentProtocolWeek(startTs), maxWeek) : 0;
  const pct = Math.max(0, Math.min(100, (week / maxWeek) * 100));
  const months = Math.ceil(maxWeek / 4);
  const current = ph.find((p) => week >= p.fromWeek && week <= p.toWeek) ?? null;

  if (compact) {
    return (
      <div className="w-full min-w-[120px]">
        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="truncate">{week > 0 ? (current?.title ?? "En cours") : "Pas démarré"}</span>
          <span className="shrink-0 tabular-nums">{week > 0 ? `S${week}/${maxWeek}` : "—"}</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
          {Array.from({ length: maxWeek - 1 }).map((_, i) => (
            <span
              key={`wk-${i}`}
              className="pointer-events-none absolute inset-y-0 w-px bg-background/70"
              style={{ left: `${((i + 1) * 100) / maxWeek}%` }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">
          {week > 0 ? (
            <>
              Semaine {week} <span className="font-normal text-muted-foreground">sur {maxWeek}</span>
              {current?.title && <span className="text-muted-foreground"> · {current.title}</span>}
            </>
          ) : (
            "Parcours pas encore démarré"
          )}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground">≈ {months} mois</span>
      </div>

      <div className="relative flex h-9 w-full overflow-hidden rounded-xl border border-border/60">
        {ph.map((p, i) => {
          const span = p.toWeek - p.fromWeek + 1;
          const isCur = week >= p.fromWeek && week <= p.toWeek;
          const isPast = week > p.toWeek;
          return (
            <div
              key={p.id}
              style={{ flexGrow: span, flexBasis: 0 }}
              title={`${p.title} · S${p.fromWeek}–${p.toWeek}`}
              className={`flex items-center justify-center overflow-hidden px-1 text-[10px] font-semibold ${
                isCur
                  ? "bg-primary text-primary-foreground"
                  : isPast
                    ? "bg-primary-soft text-primary"
                    : "bg-muted text-muted-foreground/60"
              }`}
            >
              <span className="truncate">{p.title}</span>
            </div>
          );
        })}
        {/* Traits blancs à chaque limite de semaine (lisibilité de la frise). */}
        {Array.from({ length: maxWeek - 1 }).map((_, i) => (
          <span
            key={`wk-${i}`}
            className="pointer-events-none absolute inset-y-0 w-px bg-background/70"
            style={{ left: `${((i + 1) * 100) / maxWeek}%` }}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="relative mt-1 h-4">
        {Array.from({ length: months + 1 }).map((_, i) => {
          const isFirst = i === 0;
          const isLast = i === months;
          return (
            <span
              key={i}
              className={`absolute text-[10px] text-muted-foreground ${
                isFirst ? "left-0" : isLast ? "right-0" : "-translate-x-1/2"
              }`}
              style={isFirst || isLast ? undefined : { left: `${(i * 4 * 100) / maxWeek}%` }}
            >
              {isFirst ? "Début" : `M${i}`}
            </span>
          );
        })}
        {week > 0 && (
          <span
            className="absolute -top-[6px] h-2 w-2 -translate-x-1/2 rotate-45 rounded-[2px] bg-foreground"
            style={{ left: `${pct}%` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
