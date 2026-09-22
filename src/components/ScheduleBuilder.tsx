/**
 * Constructeur de paliers de fréquence + assistant titration.
 * Édite un FreqPhase[] : chaque palier = dès la semaine N, quels jours, quel
 * moment, note optionnelle. Utilisé dans l'éditeur d'étape (routines + templates).
 */
import { useState } from "react";
import { Plus, Trash2, Wand2, CalendarDays } from "lucide-react";
import { DAY_LABELS, isDaily, buildTitration, type FreqPhase, type Moment } from "@/lib/routine-schedule";

const MOMENTS: { v: Moment; label: string }[] = [
  { v: "am", label: "Matin" },
  { v: "pm", label: "Soir" },
  { v: "both", label: "Matin & soir" },
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function ScheduleBuilder({
  value,
  onChange,
}: {
  value: FreqPhase[];
  onChange: (s: FreqPhase[]) => void;
}) {
  const phases = value ?? [];
  const [showTitration, setShowTitration] = useState(false);
  const [tStart, setTStart] = useState(3);
  const [tTimes, setTTimes] = useState(1);
  const [tInc, setTInc] = useState(1);
  const [tInterval, setTInterval] = useState(2);
  const [tMax, setTMax] = useState(3);
  const [tMoment, setTMoment] = useState<Moment>("pm");

  // Un palier stocke ses jours en explicite (0..6). 7 jours cochés = tous les jours.
  const daysOf = (p: FreqPhase) => (isDaily(p.days) ? ALL_DAYS : p.days);

  const update = (i: number, patch: Partial<FreqPhase>) =>
    onChange(phases.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => onChange(phases.filter((_, idx) => idx !== i));
  const add = () => {
    const lastWeek = phases.length ? Math.max(...phases.map((p) => p.fromWeek)) : 0;
    onChange([...phases, { fromWeek: lastWeek + 1 || 1, days: ALL_DAYS, moment: "am" }]);
  };
  const toggleDay = (i: number, d: number) => {
    const cur = daysOf(phases[i]);
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b);
    update(i, { days: next });
  };

  function generate() {
    onChange(
      buildTitration({
        startWeek: tStart,
        startTimes: tTimes,
        increment: tInc,
        intervalWeeks: tInterval,
        maxTimes: tMax,
        moment: tMoment,
      }),
    );
    setShowTitration(false);
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-sm font-medium">Fréquence par paliers</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTitration((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft/50"
        >
          <Wand2 className="h-3.5 w-3.5" /> Assistant titration
        </button>
      </div>

      {showTitration && (
        <div className="rounded-xl border border-primary/20 bg-primary-soft/20 p-3 space-y-2 text-xs">
          <p className="font-medium text-foreground/80">Montée régulière automatique</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1">Dès la semaine
              <input type="number" min={1} value={tStart} onChange={(e) => setTStart(+e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2" />
            </label>
            <label className="flex flex-col gap-1">Départ (×/sem)
              <input type="number" min={1} max={7} value={tTimes} onChange={(e) => setTTimes(+e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2" />
            </label>
            <label className="flex flex-col gap-1">Max (×/sem)
              <input type="number" min={1} max={7} value={tMax} onChange={(e) => setTMax(+e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2" />
            </label>
            <label className="flex flex-col gap-1">+ combien
              <input type="number" min={1} max={7} value={tInc} onChange={(e) => setTInc(+e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2" />
            </label>
            <label className="flex flex-col gap-1">tous les (sem.)
              <input type="number" min={1} value={tInterval} onChange={(e) => setTInterval(+e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2" />
            </label>
            <label className="flex flex-col gap-1">Moment
              <select value={tMoment} onChange={(e) => setTMoment(e.target.value as Moment)} className="h-8 rounded-lg border border-border bg-background px-2">
                {MOMENTS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={generate} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            <Wand2 className="h-3.5 w-3.5" /> Générer les paliers
          </button>
        </div>
      )}

      {phases.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun palier — ajoute-en un ou utilise l'assistant.</p>
      )}

      <div className="space-y-2">
        {phases.map((p, i) => {
          const days = daysOf(p);
          const daily = isDaily(p.days);
          return (
            <div key={i} className="rounded-xl border border-border/60 bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Dès la semaine</span>
                <input
                  type="number" min={1} value={p.fromWeek}
                  onChange={(e) => update(i, { fromWeek: +e.target.value })}
                  className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-sm"
                />
                <select
                  value={p.moment}
                  onChange={(e) => update(i, { moment: e.target.value as Moment })}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  {MOMENTS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
                </select>
                <button type="button" onClick={() => remove(i)} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {DAY_LABELS.map((d, di) => {
                  const on = days.includes(di);
                  return (
                    <button
                      key={di} type="button" onClick={() => toggleDay(i, di)}
                      className={`h-7 w-7 rounded-lg text-xs font-semibold transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground/60 hover:bg-muted/70"}`}
                    >
                      {d}
                    </button>
                  );
                })}
                <button
                  type="button" onClick={() => update(i, { days: ALL_DAYS })}
                  className={`ml-1 rounded-lg px-2 py-1 text-[11px] font-medium ${daily ? "bg-primary-soft text-primary" : "border border-border text-muted-foreground hover:bg-muted"}`}
                >
                  Tous les jours
                </button>
              </div>
              <input
                type="text" value={p.note ?? ""}
                onChange={(e) => update(i, { note: e.target.value || undefined })}
                placeholder="Note (ex. si bien toléré)"
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              />
            </div>
          );
        })}
      </div>

      <button
        type="button" onClick={add}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> Ajouter un palier
      </button>
    </div>
  );
}
