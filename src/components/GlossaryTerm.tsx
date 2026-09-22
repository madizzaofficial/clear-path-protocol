/**
 * Terme de glossaire tappable : souligné en pointillés, affiche sa définition
 * dans un popover au clic. Rien à afficher si le terme n'est pas au glossaire.
 */
import { useState } from "react";
import { lookupGlossary } from "@/lib/skincare-education";

export function GlossaryTerm({ term, children }: { term: string; children?: React.ReactNode }) {
  const def = lookupGlossary(term);
  const [open, setOpen] = useState(false);
  if (!def) return <>{children ?? term}</>;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="cursor-help font-medium text-primary underline decoration-dotted underline-offset-2 hover:opacity-80"
      >
        {children ?? term}
      </button>
      {open && (
        <>
          <span
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10"
            aria-hidden="true"
          />
          <span className="absolute left-0 top-full z-20 mt-1.5 block w-64 max-w-[78vw] rounded-2xl border border-border bg-card p-3 text-left text-xs font-normal leading-relaxed text-foreground/80 shadow-elegant">
            <b className="mb-1 block capitalize text-primary">{term}</b>
            {def}
          </span>
        </>
      )}
    </span>
  );
}
