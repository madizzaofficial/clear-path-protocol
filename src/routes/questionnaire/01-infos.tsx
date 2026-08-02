import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import {
  QuestionnaireShell,
  Section,
  Field,
  Pills,
} from "@/components/questionnaire/QuestionnaireUI";
import { AGE_OPTIONS, GENDER_OPTIONS, SECTION_SLUGS } from "@/lib/questionnaire-constants";

export const Route = createFileRoute("/questionnaire/01-infos")({
  head: () => ({ meta: [{ title: "Section 1 — Protocole Clear" }] }),
  component: Section1,
});

function Section1() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance = !!answers.ageRange && !!answers.gender;

  function handleNext() {
    if (!canAdvance) return;
    markSection(1);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[1]}` });
  }

  return (
    <QuestionnaireShell step={1} totalSteps={14} title="Informations générales">
      <Section title="Ton profil">
        <Field label="Quel âge as-tu ?" required>
          <Pills
            options={AGE_OPTIONS}
            value={answers.ageRange}
            onChange={(v) => setField("ageRange", v)}
          />
        </Field>
        <Field label="Quel est ton sexe ?" required>
          <Pills
            options={GENDER_OPTIONS}
            value={answers.gender}
            onChange={(v) => setField("gender", v)}
          />
        </Field>
      </Section>
      <NavButtons onNext={handleNext} canAdvance={canAdvance} />
    </QuestionnaireShell>
  );
}

function CenterSpinner() {
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
}: {
  onNext: () => void;
  canAdvance: boolean;
  prev?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => (prev ? navigate({ to: prev }) : navigate({ to: "/questionnaire" }))}
        className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <ArrowLeft className="h-4 w-4" /> Précédent
      </button>
      <button
        onClick={onNext}
        disabled={!canAdvance}
        className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Suivant <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
