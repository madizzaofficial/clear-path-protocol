/**
 * Visuel de quantité par preset (voir QTY_PRESETS dans lib/routine-schedule).
 * SVG inline, sans dépendance — pensé pour être remplacé/complété par des motion
 * graphics plus tard sans changer les appels.
 */
import { qtyLabel } from "@/lib/routine-schedule";

function Drop({ x, s = 1 }: { x: number; s?: number }) {
  // Goutte centrée en x, échelle s (base ~ hauteur 16).
  return (
    <path
      d={`M${x} ${20 - 12 * s} C${x} ${20 - 12 * s} ${x - 5 * s} ${20 - 2 * s} ${x - 5 * s} ${20 + 1 * s} a${5 * s} ${5 * s} 0 0 0 ${10 * s} 0 C${x + 5 * s} ${20 - 2 * s} ${x} ${20 - 12 * s} ${x} ${20 - 12 * s} Z`}
      className="fill-primary/80"
    />
  );
}

export function QuantityVisual({
  preset,
  className = "",
}: {
  preset?: string;
  className?: string;
}) {
  const label = qtyLabel(preset) || "—";
  const cls = `h-full w-full ${className}`;

  const art = (() => {
    switch (preset) {
      case "noisette":
        return (
          <svg viewBox="0 0 48 40" className={cls}>
            <circle cx="24" cy="22" r="7" className="fill-primary/80" />
          </svg>
        );
      case "grosse-noisette":
        return (
          <svg viewBox="0 0 48 40" className={cls}>
            <circle cx="24" cy="22" r="11" className="fill-primary/80" />
          </svg>
        );
      case "2-3-gouttes":
        return (
          <svg viewBox="0 0 48 40" className={cls}>
            <Drop x={15} /> <Drop x={24} /> <Drop x={33} />
          </svg>
        );
      case "4-5-gouttes":
        return (
          <svg viewBox="0 0 48 40" className={cls}>
            <Drop x={11} s={0.8} /> <Drop x={19} s={0.8} /> <Drop x={27} s={0.8} /> <Drop x={35} s={0.8} />
          </svg>
        );
      case "1-pression":
      case "2-pressions": {
        const n = preset === "2-pressions" ? 2 : 1;
        return (
          <svg viewBox="0 0 48 40" className={cls}>
            {/* flacon pompe */}
            <rect x="18" y="14" width="12" height="20" rx="3" className="fill-primary/15 stroke-primary/60" strokeWidth="1.5" />
            <rect x="21" y="7" width="6" height="7" rx="1.5" className="fill-primary/60" />
            <rect x="20" y="5" width="12" height="3" rx="1.5" className="fill-primary/60" />
            {Array.from({ length: n }).map((_, i) => (
              <circle key={i} cx={36} cy={20 + i * 7} r="2.4" className="fill-primary/80" />
            ))}
          </svg>
        );
      }
      case "couche-fine":
        return (
          <svg viewBox="0 0 48 40" className={cls}>
            <rect x="10" y="18" width="28" height="2.5" rx="1.25" className="fill-primary/80" />
            <rect x="12" y="23" width="24" height="2" rx="1" className="fill-primary/40" />
          </svg>
        );
      case "couche-genereuse":
        return (
          <svg viewBox="0 0 48 40" className={cls}>
            {[14, 19, 24, 29].map((y, i) => (
              <rect key={y} x={10 - i} y={y} width={28 + i * 2} height="3.5" rx="1.75" className={i % 2 ? "fill-primary/50" : "fill-primary/80"} />
            ))}
          </svg>
        );
      case "2-doigts":
        return (
          <svg viewBox="0 0 48 40" className={cls}>
            <rect x="15" y="8" width="7" height="26" rx="3.5" className="fill-primary/15 stroke-primary/60" strokeWidth="1.5" />
            <rect x="26" y="8" width="7" height="26" rx="3.5" className="fill-primary/15 stroke-primary/60" strokeWidth="1.5" />
            <rect x="13" y="16" width="22" height="4" rx="2" className="fill-primary/80" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 48 40" className={cls}>
            <circle cx="24" cy="22" r="7" className="fill-muted-foreground/30" />
          </svg>
        );
    }
  })();

  return (
    <div className="flex flex-col items-center gap-1" title={label}>
      <div className="flex h-12 w-16 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/20">
        {art}
      </div>
      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">{label}</span>
    </div>
  );
}
