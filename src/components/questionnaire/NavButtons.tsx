// ─── Shared nav helpers for questionnaire sections ─────────────────────────────

import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

export function CenterSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function NavButtons({
  onNext,
  canAdvance,
  prev,
  nextLabel = "Suivant",
}: {
  onNext: () => void;
  canAdvance: boolean;
  prev?: string;
  nextLabel?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => (prev ? navigate({ to: prev }) : navigate({ to: "/questionnaire" }))}
        className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Précédent
      </button>
      <button
        onClick={onNext}
        disabled={!canAdvance}
        className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {nextLabel} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
